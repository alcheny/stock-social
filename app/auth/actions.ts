'use server';
// F-1 sign-in actions. Every path writes the 18+ attestation (signup_attempts) before any redirect; the users row
// is created only when a method completes (lib/auth/attempts.ts). Nothing personal is logged.
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db.ts';
import { createAttempt, isMethod } from '@/lib/auth/attempts.ts';
import { encodeTx, TX_COOKIE, type Tx } from '@/lib/auth/tx.ts';
import { authorizeUrl, discover, pkce, randomToken } from '@/lib/auth/oidc.ts';
import { providersFromEnv } from '@/lib/auth/providers.ts';
import { hashToken, linkExpiry, newLinkToken, normalizeEmail } from '@/lib/auth/links.ts';
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

export async function startSignIn(form: FormData) {
  const method = form.get('method');
  const r = await referral(form);
  if (!isMethod(method) || method === 'dev') return back({ ref: r.ref, via: r.via });
  const keep = { ref: r.ref, via: r.via, method };
  if (form.get('adult') !== 'on') return back({ ...keep, error: 'attest' });
  const landedAt = Number(form.get('landed_at'));
  const base = { method, attested: true, referredBy: r.referredBy, surface: r.surface, landedAt: landedAt ? new Date(landedAt) : null, source: r.surface ?? (r.ref ? 'profile' : 'direct') };

  if (method === 'email') {
    const email = normalizeEmail(form.get('email'));
    if (!email) return back({ ...keep, error: 'email' });
    if (!allow(`mail:${hashToken(email)}`, 5, 15 * 60_000)) return back({ ...keep, error: 'rate' });
    const attemptId = await createAttempt(base);
    await sendLink(attemptId, email);
    redirect(`/login/sent?a=${attemptId}`);
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

async function sendLink(attemptId: number, email: string) {
  const { token, hash } = newLinkToken();
  await sql`insert into login_links (token_hash, email, attempt_id, expires_at) values (${hash}, ${email}, ${attemptId}, ${linkExpiry()})`;
  await defaultSender()({ to: email, url: `${await origin()}/auth/email?t=${token}` });
}

export async function resendLink(form: FormData) {
  const attemptId = Number(form.get('a'));
  const [row] = await sql`select l.email from login_links l join signup_attempts a on a.id = l.attempt_id
    where l.attempt_id = ${attemptId} and a.completed_at is null order by l.expires_at desc limit 1`;
  if (!row) redirect('/login');
  if (!allow(`mail:${hashToken(row.email)}`, 5, 15 * 60_000) || !allow(`attempt:${attemptId}`, 3, 15 * 60_000)) redirect(`/login/sent?a=${attemptId}&again=1`);
  await sendLink(attemptId, row.email);
  redirect(`/login/sent?a=${attemptId}&again=1`);
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
