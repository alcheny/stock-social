'use server';
import { writeShareAction } from '@/lib/share-actions.ts';
import { recordTradesPrompt } from '@/lib/trades-prompt.ts';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db.ts';
import { currentUser, devGuard, rememberMethod, signIn } from '@/lib/session.ts';
import { completeAttempt, createAttempt, createUserForAttempt, DisplayNameError, HandleTakenError } from '@/lib/auth/attempts.ts';
import { checkDisplayName, checkHandle, devLoginRedirect, findLiveUserByHandle } from '@/lib/handles.ts';
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
import { ownSellIdForKey } from '@/lib/reflection-target.ts'; // F-25
import { checkRule } from '@/lib/rules.ts';
import { signUpOpen } from '@/lib/launch-gate.ts';
import { LAUNCH } from '@/lib/copy.ts';
import { REPORT_COPY, reportMessage, reportThesis, type ReportState } from '@/lib/reports.ts';
import { logSafe } from '@/lib/privacy-log.ts';
import { isFilerHandle } from '@/lib/public-gate.ts';

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
  if (isFilerHandle(handle)) redirect('/login/dev?error=handle'); // F-7: a public filer is never signed into or signed up as (F-7's own line and alert)
  if (form.get('adult') !== 'on') back('attest');
  const known = await findLiveUserByHandle(handle); // fix round 3: a profile pending deletion is no account here
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

  const [existing] = await sql`select id from users where handle = ${handle} and deleted_at is null`; // never a profile marked for deletion (same filter as findLiveUserByHandle; lib/auth/links.hardening.test.ts reads this line)
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
  // FIXES-CYCLE5 (F5-2): the trade's stable key first (it survives a rebuild); the row id is the fallback a page rendered
  // before this change posts.
  const key = form.get('tradeKey');
  const tradeKey = typeof key === 'string' && /^[0-9a-f]{64}$/.test(key) ? key : null;
  const tradeId = tradeIdParam(form.get('tradeId')); // F19: a non-numeric id is a no-op, not a bigint error and a 500
  if (!tradeKey && !tradeId) return;
  const saved = await saveThesisFor(user.id, (tradeKey ?? tradeId)!, String(form.get('thesis') ?? ''));
  if (saved === 'changed') {
    // The trade is not on the record now: nothing was written, and the profile says so at the top of its closed trades
    // (role=alert, focused), on the same closes window. `n` lets the author's own tab show its unsaved text there
    // (note-recovery.tsx); the text itself never travels in a URL.
    const closes = form.get('closes');
    const w = typeof closes === 'string' && /^[1-9][0-9]{0,6}$/.test(closes) ? `&closes=${closes}` : '';
    redirect(`/u/${user.handle}?note=changed${tradeKey ? `&n=${tradeKey}` : ''}${w}#note-changed`);
  }
  revalidatePath(`/u/${user.handle}`);
  // FIXES-CYCLE5 (F5-2, code review 5): a save made from a page still showing "not saved" leaves that URL, so the alert
  // never stands over a note that was saved. The closes window is kept.
  if (form.get('leaveChanged') === '1') {
    const closes = form.get('closes');
    redirect(`/u/${user.handle}${typeof closes === 'string' && /^[1-9][0-9]{0,6}$/.test(closes) ? `?closes=${closes}` : ''}`);
  }
}

// Share moment (issue #66). Best-effort measurement: session user only, never an id from the client.
export async function markSharePromptSeen() {
  const user = await currentUser();
  if (!user) return;
  await sql`update users set share_prompt_seen_at = now() where id = ${user.id} and share_prompt_seen_at is null`;
}

// Fix #27 (cycle 2): the first completed share of the record from the profile's "Share my record" button (share sheet
// or link copied). The column keeps its old name (share_image_saved_at, from the removed Save image link). Session user
// only, idempotent.
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
  // One statement for the action and the seen time (lib/trades-prompt.ts): a reload between two updates showed the
  // prompt again after Dismiss.
  await recordTradesPrompt(user.id, action);
  revalidatePath(`/u/${user.handle}`);
}

// F-15 second half: one share row for the session user's own completed share (lib/share-actions.ts checks the
// path is the user's own record). Fire-and-forget from the share controls: it never throws to the page.
export async function recordShareAction(path: string, how: 'copied' | 'shared', picture: boolean) {
  try {
    const user = await currentUser();
    if (user) await writeShareAction({ id: user.id, handle: user.handle }, path, how, picture);
  } catch (e) {
    console.error('share action failed', logSafe(e));
  }
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
  // F-25: the form posts the trade_key; the stored reflection stays keyed by the sell id, looked up here for my own trade.
  const sellId = await ownSellIdForKey(user?.id, form.get('tradeKey'));
  const owned = sellId !== null;
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
  // FIXES-CYCLE5 (F5-22, C5-25): back to the same rule card, which names what changed and takes focus. `c.kind` passed
  // isRuleKind (checkRule), so the URL holds only a fixed kind and a fixed verb.
  redirect(`/me/record?rule=${c.kind}&did=${c.days === null ? 'clear' : 'set'}#rule-${c.kind}`);
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
