'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db.ts';
import { currentUser, devGuard, rememberMethod, signIn } from '@/lib/session.ts';
import { completeAttempt, createAttempt, createUserForAttempt, DisplayNameError, HandleTakenError } from '@/lib/auth/attempts.ts';
import { checkDisplayName, checkHandle, devLoginRedirect } from '@/lib/handles.ts';
import { sanitizeUserText } from '@/lib/text-safety.ts';
import { afterSigninTools } from '@/lib/auth/landing.ts';
import { saveThesisFor } from '@/lib/thesis-save.ts';
import { tradeIdParam } from '@/lib/params.ts';
import { isDemoUser } from '@/lib/demo.ts';
import { normalizeHandle, normalizeVia, resolveReferrer } from '@/lib/referral.ts';
import { TRADES_PROMPT_ACTIONS, type TradesPromptAction } from '@/lib/new-trades.ts';
import { SHARE_ACTIONS, type ShareAction } from '@/lib/share-prompt.ts';
import { canWatch, normalizeSymbol } from '@/lib/ticker.ts';
import { checkReflection } from '@/lib/reflections.ts';
import { checkRule } from '@/lib/rules.ts';
import { signUpOpen } from '@/lib/launch-gate.ts';
import { LAUNCH } from '@/lib/copy.ts';
import { REPORT_COPY, reportMessage, reportThesis, type ReportState } from '@/lib/reports.ts';
import { logSafe } from '@/lib/privacy-log.ts';

// DEV-ONLY sign-in (/login/dev): no password, guarded like the old stub. It still goes through a signup_attempts row
// (method 'dev') so the attestation precedes the users row on this path too.
export async function login(form: FormData) {
  devGuard();
  const handle = normalizeHandle(form.get('handle')) ?? '';
  // Fix round 1: only a typed name is checked; a blank one falls back to the handle (createUserForAttempt).
  const name = String(form.get('name') ?? '').trim();
  // Fix round 2 (F): every refusal the form can name goes back to it with the reason (never a 500), and is decided
  // BEFORE createAttempt, so a refused try writes no signup_attempts row: the handle format, the 18+ box, and for a new
  // account the launch gate, the typed display name and the handle verdict. The typed handle comes back, the name never.
  const back = (code: string): never => redirect(devLoginRedirect(code, form.get('handle')));
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) back('handle-format');
  if (form.get('adult') !== 'on') back('attest');
  const [known] = await sql`select id from users where handle = ${handle} and deleted_at is null`; // fix round 3: a profile pending deletion is no account here
  if (!known) {
    if (!signUpOpen()) back('closed');
    // The same test createUserForAttempt applies: only a name that is not blank once cleaned is checked.
    if (sanitizeUserText(name, 400)) { const c = checkDisplayName(name); if (!c.ok) back(`name-${c.code}`); }
    const verdict = await checkHandle(handle);
    if (verdict !== 'ok') back(`handle-${verdict}`);
  }

  // Recorded only on insert: an existing handle signs in and keeps its referral.
  const refHandle = normalizeHandle(form.get('ref'));
  let referrer = null;
  if (refHandle) {
    const [r] = await sql`select id, handle from users where handle = ${refHandle}`;
    if (r) referrer = { id: r.id as number, handle: r.handle as string, isDemo: await isDemoUser(r.id) };
  }
  const referredBy = resolveReferrer({ refHandle, referrer, newHandle: handle });
  const attempt = await createAttempt({ method: 'dev', attested: form.get('adult') === 'on', referredBy, surface: referredBy ? normalizeVia(form.get('via')) : null, source: refHandle ? 'profile' : 'direct' });

  const [existing] = await sql`select id from users where handle = ${handle} and deleted_at is null`; // never a profile marked for deletion
  // Launch gate (orchestrator review 1): the dev form signs existing handles in, but creates a new account only while
  // sign-up is open (the e2e sandbox counts as open). Fix round 2: the closed case already went back to the form above;
  // this throw stays as the guard for a switch flipped mid-request (lib/launch-gate-signin.test.ts checks its order).
  if (!existing && !signUpOpen()) throw new Error(LAUNCH.closed);
  let id: number;
  if (existing) { await completeAttempt(attempt, existing.id); id = existing.id as number; } else {
    // A refused name or handle goes back to the form with its reason (a code, never the text typed), not a 500.
    let made: { id: number } | { error: string };
    try { made = await createUserForAttempt(attempt, { handle, name }); } catch (e) {
      if (e instanceof DisplayNameError) made = { error: `name-${e.code}` };
      else if (e instanceof HandleTakenError) made = { error: `handle-${e.verdict}` };
      else throw e;
    }
    // Fix round 2: reached only when a race beats the checks above (another sign-up took the handle in between).
    // ponytail: the redirect drops ref/via and the typed handle — carry them through if referred sign-ups start hitting
    // refused names.
    if ('error' in made) redirect(`/login/dev?error=${made.error}`);
    id = made.id;
  }
  await signIn(id);
  await rememberMethod('dev');
  redirect((await afterSigninTools()) ? '/tools' : `/u/${handle}`); // F-3: "Sign in to subscribe" comes back to Record tools
}

export async function saveThesis(form: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const tradeId = tradeIdParam(form.get('tradeId')); // F19: a non-numeric id is a no-op, not a bigint error and a 500
  if (!tradeId) return;
  await saveThesisFor(user.id, tradeId, String(form.get('thesis') ?? ''));
  revalidatePath(`/u/${user.handle}`);
}

// Share moment (issue #66). Best-effort measurement: session user only, never an id from the client.
export async function markSharePromptSeen() {
  const user = await currentUser();
  if (!user) return;
  await sql`update users set share_prompt_seen_at = now() where id = ${user.id} and share_prompt_seen_at is null`;
}

// Story-image adoption: first click on a Save link. Session user only, idempotent.
export async function markShareImageSaved() {
  const user = await currentUser();
  if (!user) return;
  await sql`update users set share_image_saved_at = now() where id = ${user.id} and share_image_saved_at is null`;
}

export async function recordSharePromptAction(action: ShareAction) {
  const user = await currentUser();
  if (!user || !SHARE_ACTIONS.includes(action)) return;
  // The first positive action wins: 'dismissed' never overwrites 'copied' or 'shared'.
  await sql`
    update users set share_prompt_action = ${action}, share_prompt_seen_at = coalesce(share_prompt_seen_at, now())
    where id = ${user.id} and (share_prompt_action is null or (share_prompt_action = 'dismissed' and ${action} <> 'dismissed'))`;
}

// New trade prompt. Best-effort, session user only, never an id from the client.
export async function markTradesPromptSeen() {
  const user = await currentUser();
  if (!user) return;
  await sql`update users set trades_prompt_seen_at = now() where id = ${user.id} and trades_prompt_seen_at is null`;
}

export async function recordTradesPromptAction(action: TradesPromptAction) {
  const user = await currentUser();
  if (!user || !TRADES_PROMPT_ACTIONS.includes(action)) return;
  // 'opened' replaces 'dismissed'; a later 'dismissed' never overwrites 'opened'.
  await sql`
    update users set trades_prompt_action = ${action}
    where id = ${user.id} and (trades_prompt_action is null or (trades_prompt_action = 'dismissed' and ${action} = 'opened'))`;
  await sql`update users set trades_prompt_seen_at = now() where id = ${user.id}`;
  revalidatePath(`/u/${user.handle}`);
}

export async function recordTradeShared() {
  const user = await currentUser();
  if (!user) return;
  await sql`update users set trade_shared_at = now() where id = ${user.id}`;
}

export async function toggleWatch(symbol: string) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const s = normalizeSymbol(String(symbol));
  if (!s) redirect('/t');
  const [existing] = await sql`select 1 from ticker_watches where user_id = ${user.id} and symbol = ${s}`;
  if (existing) {
    await sql`delete from ticker_watches where user_id = ${user.id} and symbol = ${s}`;
  } else {
    const [{ n }] = await sql`select count(*)::int as n from ticker_watches where user_id = ${user.id}`;
    const can = canWatch(n, s);
    if (!can.ok) redirect(`/t/${encodeURIComponent(s)}?watch=${can.reason}`);
    await sql`insert into ticker_watches (user_id, symbol, created_at, last_seen_at) values (${user.id}, ${s}, now(), now()) on conflict do nothing`;
  }
  revalidatePath('/t');
  revalidatePath(`/t/${s}`);
  redirect(`/t/${encodeURIComponent(s)}`);
}

export async function setReflection(form: FormData) {
  const user = await currentUser();
  const sellId = form.get('sellId');
  const owned = !!user && typeof sellId === 'string' && (await sql`select 1 from closed_trades where user_id = ${user.id} and sell_id = ${sellId}`).length > 0;
  const c = checkReflection({ userId: user?.id ?? null, reason: form.get('reason'), sellId, owned });
  if (!user) redirect('/login');
  if (!c.ok) throw new Error('Not allowed');
  if (c.reason) {
    await sql`insert into trade_reflections (user_id, sell_id, reason) values (${user.id}, ${c.sellId}, ${c.reason})
      on conflict (user_id, sell_id) do update set reason = excluded.reason`;
  } else {
    await sql`delete from trade_reflections where user_id = ${user.id} and sell_id = ${c.sellId}`;
  }
  revalidatePath('/me/record');
}

export async function setRule(form: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const c = checkRule({ userId: user.id, kind: form.get('kind'), days: form.get('days'), clear: form.get('intent') === 'clear' });
  if (!c.ok) throw new Error('Not allowed');
  if (c.days === null) {
    await sql`delete from trade_rules where user_id = ${user.id} and kind = ${c.kind}`;
  } else {
    await sql`insert into trade_rules (user_id, kind, days) values (${user.id}, ${c.kind}, ${c.days})
      on conflict (user_id, kind) do update set days = excluded.days, updated_at = now()`;
  }
  revalidatePath('/me/record');
}

// fix-user-text B (F-9): report a published thesis (app/report-note.tsx). The session user only, never an id from the
// client; signed out the action refuses (the control is not rendered then either). The answer goes to a polite live
// region and never says whether the note was held. Logged on failure as the error's class only (logSafe).
export async function reportNote(_prev: ReportState, form: FormData): Promise<ReportState> {
  try {
    const user = await currentUser();
    return { message: reportMessage(await reportThesis(user?.id ?? null, form.get('tradeId'))) };
  } catch (e) {
    console.error('report note failed', logSafe(e));
    return { message: REPORT_COPY.failed };
  }
}
