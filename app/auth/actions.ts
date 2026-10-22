'use server';
// F-1 sign-in actions. Every path writes the 18+ attestation (signup_attempts) before any redirect; the users row
// is created only when a method completes (lib/auth/attempts.ts). Nothing personal is logged.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db.ts';
import { createAttempt, isMethod } from '@/lib/auth/attempts.ts';
import { encodeTx, TX_COOKIE, type Tx } from '@/lib/auth/tx.ts';
import { authorizeUrl, discover, pkce, randomToken } from '@/lib/auth/oidc.ts';
import { providersFromEnv } from '@/lib/auth/providers.ts';
import { ATTEMPT_COOKIE, attemptCookieValue, EMAIL_COOKIE, EMAIL_COOKIE_SECONDS, hashToken, issueLink, normalizeEmail, ownsAttempt, pendingLinkEmail, requireLinkOrigin, SendFailedError } from '@/lib/auth/links.ts';
import { defaultSender } from '@/lib/auth/email.ts';
import { allow } from '@/lib/auth/rate-limit.ts';
import { sessionSecret, signToken } from '@/lib/auth/sessions.ts';
import { currentUser, origin, signOut as endSession } from '@/lib/session.ts';
import { deleteProfile as deleteRow } from '@/lib/delete.ts';
import { isDemoUser } from '@/lib/demo.ts';
import { normalizeHandle, normalizeVia, resolveReferrer } from '@/lib/referral.ts';

async function referral(form: FormData) {
  const refHandle = normalizeHandle(form.get('ref'));
  let referrer = null;
  if (refHandle) {
    const [r] = await sql`select id, handle from users where handle = ${refHandle}`;
    if (r) referrer = { id: r.id as number, handle: r.handle as string, isDemo: await isDemoUser(r.id) };
  }
  const referredBy = resolveReferrer({ refHandle, referrer });
  return { referredBy, surface: referredBy ? normalizeVia(form.get('via')) : null, ref: refHandle, via: normalizeVia(form.get('via')) };
}

const back = (q: Record<string, string | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  redirect(`/login?${p}`);
};

// The typed address survives a validation redirect, and the address a link went to survives the link's 15 minutes, in
// a short-lived httpOnly cookie, never in the URL (an address in a query string ends up in request logs). /login reads
// it back into the field, so an expired or already-used link offers "Send a new link" without retyping.
async function keepEmail(form: FormData) {
  const raw = form.get('email');
  const email = typeof raw === 'string' ? raw.trim().slice(0, 254) : '';
  (await cookies()).set(EMAIL_COOKIE, email, { httpOnly: true, sameSite: 'lax', path: '/login', maxAge: email ? EMAIL_COOKIE_SECONDS : 0, secure: (await origin()).startsWith('https://') });
}
// "Send again" is bound to the browser that started the attempt (lib/auth/links.ts#ownsAttempt).
async function bindAttempt(attemptId: number) {
  (await cookies()).set(ATTEMPT_COOKIE, attemptCookieValue(attemptId, sessionSecret()), { httpOnly: true, sameSite: 'lax', path: '/login', maxAge: 3600, secure: (await origin()).startsWith('https://') });
}

export async function startSignIn(form: FormData) {
  const method = form.get('method');
  const r = await referral(form);
  if (!isMethod(method) || method === 'dev') return back({ ref: r.ref, via: r.via });
  const keep = { ref: r.ref, via: r.via, method };
  if (form.get('adult') !== 'on') { await keepEmail(form); return back({ ...keep, error: 'attest' }); }
  const landedAt = Number(form.get('landed_at'));
  const base = { method, attested: true, referredBy: r.referredBy, surface: r.surface, landedAt: landedAt ? new Date(landedAt) : null, source: r.surface ?? (r.ref ? 'profile' : 'direct') };

  if (method === 'email') {
    requireLinkOrigin(); // production refuses to send a link whose origin would come from the Host header
    const email = normalizeEmail(form.get('email'));
    if (!email) { await keepEmail(form); return back({ ...keep, error: 'email' }); }
    if (!allow(`mail:${hashToken(email)}`, 5, 15 * 60_000)) { await keepEmail(form); return back({ ...keep, error: 'rate' }); }
    await keepEmail(form);
    const attemptId = await createAttempt(base);
    await bindAttempt(attemptId);
    redirect(`/login/sent?a=${attemptId}${await sendOrFail(attemptId, email)}`);
  }
  if (method === 'brokerage') {
    const attemptId = await createAttempt(base);
    redirect(`/connect?attempt=${attemptId}`); // S2; the portal flow lands in PR-2
  }
  const p = providersFromEnv().find((x) => x.key === method);
  if (!p) return back({ ...keep, error: 'provider' });
  const d = await discover(p.issuer);
  const { verifier, challenge } = pkce();
  const tx: Tx = { s: randomToken(16), n: randomToken(16), v: verifier, a: await createAttempt(base), m: method };
  (await cookies()).set(TX_COOKIE, signToken(encodeTx(tx), sessionSecret()), {
    httpOnly: true, path: '/auth', maxAge: 600, secure: p.responseMode === 'form_post' || (await origin()).startsWith('https://'),
    sameSite: p.responseMode === 'form_post' ? 'none' : 'lax', // a form_post callback is a cross-site POST
  });
  redirect(authorizeUrl(d, p, { state: tx.s, nonce: tx.n, challenge, redirectUri: `${await origin()}/auth/callback/${p.key}` }));
}

// Sends the link; a send failure becomes the error state on /login/sent (message + "Send again"), never a thrown
// error, and leaves no claimable link behind (lib/auth/links.ts#issueLink). Returns the query suffix to show.
async function sendOrFail(attemptId: number, email: string): Promise<string> {
  try {
    await issueLink(attemptId, email, defaultSender(), await origin());
    return '';
  } catch (e) {
    if (e instanceof SendFailedError) return '&error=send';
    throw e;
  }
}

export async function resendLink(form: FormData) {
  const attemptId = Number(form.get('a'));
  if (!ownsAttempt((await cookies()).get(ATTEMPT_COOKIE)?.value, attemptId, sessionSecret())) redirect('/login');
  const email = await pendingLinkEmail(attemptId);
  if (!email) redirect('/login');
  if (!allow(`mail:${hashToken(email)}`, 5, 15 * 60_000) || !allow(`attempt:${attemptId}`, 3, 15 * 60_000)) redirect(`/login/sent?a=${attemptId}&error=limit`);
  redirect(`/login/sent?a=${attemptId}${(await sendOrFail(attemptId, email)) || '&again=1'}`);
}

export async function signOut() {
  await endSession();
  redirect('/');
}

// Owner-only: the provisional handle is editable on the profile.
export async function setHandle(form: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { changeHandle, HandleTakenError } = await import('@/lib/auth/attempts.ts');
  try {
    const h = await changeHandle(user.id, form.get('handle'));
    revalidatePath('/', 'layout'); // the root-layout nav shows the handle; without this it keeps the old one (now a 404) until a reload
    redirect(`/u/${h}`);
  } catch (e) {
    if (e instanceof HandleTakenError) redirect(`/u/${user.handle}?handle=taken`);
    throw e;
  }
}

// Deletion (POLICY P6). The two-step screen is PR-2a; this is its only deleting action, session user only.
export async function deleteProfile() {
  const user = await currentUser();
  if (!user) redirect('/login');
  await deleteRow(user);
  await endSession();
  redirect('/');
}
