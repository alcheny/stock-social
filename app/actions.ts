'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db.ts';
import { currentUser, devGuard, rememberMethod, signIn } from '@/lib/session.ts';
import { completeAttempt, createAttempt, createUserForAttempt } from '@/lib/auth/attempts.ts';
import { moderate } from '@/lib/moderation.ts';
import { isDemoUser } from '@/lib/demo.ts';
import { normalizeHandle, normalizeVia, resolveReferrer } from '@/lib/referral.ts';
import { TRADES_PROMPT_ACTIONS, type TradesPromptAction } from '@/lib/new-trades.ts';
import { SHARE_ACTIONS, type ShareAction } from '@/lib/share-prompt.ts';
import { canWatch, normalizeSymbol } from '@/lib/ticker.ts';
import { checkReflection } from '@/lib/reflections.ts';
import { checkRule } from '@/lib/rules.ts';

// DEV-ONLY sign-in (/login/dev): no password, guarded like the old stub. It still goes through a signup_attempts row
// (method 'dev') so the attestation precedes the users row on this path too.
export async function login(form: FormData) {
  devGuard();
  const handle = normalizeHandle(form.get('handle')) ?? '';
  const name = String(form.get('name') ?? '').trim() || handle;
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw new Error('Handle: 3–20 lowercase letters, numbers or _');

  // Recorded only on insert: an existing handle signs in and keeps its referral.
  const refHandle = normalizeHandle(form.get('ref'));
  let referrer = null;
  if (refHandle) {
    const [r] = await sql`select id, handle from users where handle = ${refHandle}`;
    if (r) referrer = { id: r.id as number, handle: r.handle as string, isDemo: await isDemoUser(r.id) };
  }
  const referredBy = resolveReferrer({ refHandle, referrer, newHandle: handle });
  const attempt = await createAttempt({ method: 'dev', attested: form.get('adult') === 'on', referredBy, surface: referredBy ? normalizeVia(form.get('via')) : null, source: refHandle ? 'profile' : 'direct' });

  const [existing] = await sql`select id from users where handle = ${handle}`;
  const id = existing ? (await completeAttempt(attempt, existing.id), existing.id as number) : (await createUserForAttempt(attempt, { handle, name })).id;
  await signIn(id);
  await rememberMethod('dev');
  redirect(`/u/${handle}`);
}

export async function saveThesis(form: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const id = String(form.get('tradeId'));
  const text = String(form.get('thesis') ?? '').trim().slice(0, 280);
  const status = moderate(text);

  await sql`
    update closed_trades set thesis = ${text || null}, thesis_status = ${text ? status : null}
    where id = ${id} and user_id = ${user.id}`;
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
