'use server';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { endExclusion, exclude, follow as followTrader, traderId, unfollow as unfollowTrader } from '@/lib/follows.ts';
import { like, rejectTrade, undoRejectTrade, unlike } from '@/lib/likes.ts';

// F-2 PR-2: follow, unfollow, "Not interested" and its Undo ("Show again" on /me/following is the same end). Signed in
// only; the handle is checked against the pattern before any query; never yourself. Each works as a form action
// without JavaScript (bound to the handle) and returns a result for the optimistic toggle with it.
export type DiscoveryResult = { ok: true; first?: boolean } | { ok: false; reason: 'signin' | 'invalid' };

async function pair(handle: unknown): Promise<{ viewer: number; trader: number } | DiscoveryResult> {
  const me = await currentUser();
  if (!me) return { ok: false, reason: 'signin' };
  const trader = await traderId(handle);
  if (!trader || trader === me.id) return { ok: false, reason: 'invalid' };
  return { viewer: me.id, trader };
}
const run = async (handle: unknown, fn: (v: number, t: number) => Promise<unknown>): Promise<DiscoveryResult> => {
  const p = await pair(handle);
  if ('ok' in p) return p;
  const r = await fn(p.viewer, p.trader);
  return { ok: true, ...(r && typeof r === 'object' && 'first' in r ? { first: (r as { first: boolean }).first } : {}) };
};

export async function follow(handle: unknown): Promise<DiscoveryResult> { return run(handle, followTrader); }
export async function unfollow(handle: unknown): Promise<DiscoveryResult> { return run(handle, unfollowTrader); }
export async function notInterested(handle: unknown): Promise<DiscoveryResult> { return run(handle, (v, t) => exclude(v, t, 'not_interested')); }
export async function undoNotInterested(handle: unknown): Promise<DiscoveryResult> { return run(handle, (v, t) => endExclusion(v, t)); }
// The same actions as form actions. Fix round 1 (UX 11): without JavaScript the reader lands on the trader they acted on,
// with a line saying what happened (app/u/[handle]/page.tsx checks it against the stored state); "Show again" (with or
// without JavaScript) comes back to /me/following saying who is back. A refused or invalid handle goes nowhere new.
const done = async (handle: unknown, r: DiscoveryResult, what: 'follow' | 'unfollow' | 'hidden') => {
  if (r.ok && typeof handle === 'string') redirect(`/u/${handle}?done=${what}${r.first ? '&first=1' : ''}`);
};
export async function followForm(handle: unknown): Promise<void> { await done(handle, await follow(handle), 'follow'); }
export async function unfollowForm(handle: unknown): Promise<void> { await done(handle, await unfollow(handle), 'unfollow'); }
export async function notInterestedForm(handle: unknown): Promise<void> { await done(handle, await notInterested(handle), 'hidden'); }
export async function showAgainForm(handle: unknown): Promise<void> {
  const r = await undoNotInterested(handle);
  if (r.ok && typeof handle === 'string') redirect(`/me/following?back=${handle}`);
}

// F-2 PR-4: private likes and rejected trades, by the feed card's id (lib/likes.ts). Signed in only; never your own.
const byCard = async (fn: (v: number, id: unknown) => Promise<boolean>, id: unknown): Promise<DiscoveryResult> => {
  const me = await currentUser();
  if (!me) return { ok: false, reason: 'signin' };
  return (await fn(me.id, id)) ? { ok: true } : { ok: false, reason: 'invalid' };
};
export async function likeTrade(id: unknown): Promise<DiscoveryResult> { return byCard(like, id); }
export async function unlikeTrade(id: unknown): Promise<DiscoveryResult> { return byCard((v, x) => unlike(v, { id: x }), id); }
export async function rejectTradeAction(id: unknown): Promise<DiscoveryResult> { return byCard(rejectTrade, id); }
export async function undoRejectTradeAction(id: unknown): Promise<DiscoveryResult> { return byCard(undoRejectTrade, id); }
// Without JavaScript: the card's "…" menu posts these; the reader lands on their likes (a like) or the feed (a hide).
export async function likeForm(id: unknown, liked: boolean): Promise<void> {
  const r = await (liked ? unlikeTrade(id) : likeTrade(id));
  if (r.ok) redirect('/me/likes');
}
export async function rejectTradeForm(id: unknown): Promise<void> { if ((await rejectTradeAction(id)).ok) redirect('/'); }
// /me/likes "Remove": by the like's key (its close may be gone after a rebuild).
export async function removeLikeForm(key: unknown, after: unknown): Promise<void> {
  const me = await currentUser();
  if (!me) redirect('/login');
  await unlike(me.id, { key });
  redirect(typeof after === 'string' && /^[0-9]{1,17}\.[0-9a-f]{64}$/.test(after) ? `/me/likes?after=${after}` : '/me/likes');
}
