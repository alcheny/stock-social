'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db.ts';
import { currentUser, signIn } from '@/lib/session.ts';
import { moderate } from '@/lib/moderation.ts';
import { isDemoUser } from '@/lib/demo.ts';
import { legacyVia, normalizeHandle, normalizeVia, resolveReferrer } from '@/lib/referral.ts';
import { TRADES_PROMPT_ACTIONS, type TradesPromptAction } from '@/lib/new-trades.ts';
import { SHARE_ACTIONS, type ShareAction } from '@/lib/share-prompt.ts';

export async function login(form: FormData) {
  const handle = normalizeHandle(form.get('handle')) ?? '';
  const name = String(form.get('name') ?? '').trim() || handle;
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw new Error('Handle: 3–20 lowercase letters, numbers or _');
  if (form.get('adult') !== 'on') throw new Error('Stock Social is 18+ only');

  // Recorded only on insert: the update clause below never touches referred_by_user_id.
  const refHandle = normalizeHandle(form.get('ref'));
  let referrer = null;
  if (refHandle) {
    const [r] = await sql`select id, handle from users where handle = ${refHandle}`;
    if (r) referrer = { id: r.id as number, handle: r.handle as string, isDemo: await isDemoUser(r.id) };
  }
  const referredBy = resolveReferrer({ refHandle, referrer, newHandle: handle });
  // referred_via keeps its old CHECK (profile|trade only), so month/badge land in referred_surface alone.
  const surface = referredBy ? normalizeVia(form.get('via')) : null;
  const via = legacyVia(surface);

  const [u] = await sql`
    insert into users (handle, display_name, adult_attested_at, referred_by_user_id, referred_via, referred_surface) values (${handle}, ${name}, now(), ${referredBy}, ${via}, ${surface})
    on conflict (handle) do update set handle = excluded.handle
    returning id`;
  await signIn(u.id);
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

// Embeddable badge adoption. Best-effort: session user only, idempotent.
export async function markBadgeCopied() {
  const user = await currentUser();
  if (!user) return;
  await sql`update users set badge_copied_at = now() where id = ${user.id} and badge_copied_at is null`;
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
