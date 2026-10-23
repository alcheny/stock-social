'use server';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/session.ts';
import { endExclusion, exclude, follow as followTrader, traderId, unfollow as unfollowTrader } from '@/lib/follows.ts';

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
// The same actions as form actions (no JavaScript: the page renders again with the new state).
export async function followForm(handle: unknown): Promise<void> { await follow(handle); }
export async function unfollowForm(handle: unknown): Promise<void> { await unfollow(handle); }
export async function notInterestedForm(handle: unknown): Promise<void> { await notInterested(handle); }
export async function showAgainForm(handle: unknown): Promise<void> { await undoNotInterested(handle); revalidatePath('/me/following'); }
