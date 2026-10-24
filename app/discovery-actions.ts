'use server';
import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { currentUser } from '@/lib/session.ts';
import { endExclusion, exclude, follow as followTrader, traderId, unfollow as unfollowTrader } from '@/lib/follows.ts';
import * as L from '@/lib/likes.ts';

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

// F-2 PR-4: likes (double tap or the like button, private) and the feed card's reject (O1), by trade_key; signed in
// only; the key is checked against its pattern before any query; never your own trade. Unlike from /me/following also
// works without JavaScript (the form posts and the page renders again; with it, the router refreshes the page).
const byKey = async (key: unknown, fn: (v: number, k: unknown) => Promise<boolean>): Promise<DiscoveryResult> => {
  const me = await currentUser();
  if (!me) return { ok: false, reason: 'signin' };
  return (await fn(me.id, key)) ? { ok: true } : { ok: false, reason: 'invalid' };
};
export async function like(key: unknown): Promise<DiscoveryResult> { return byKey(key, L.like); }
export async function unlike(key: unknown): Promise<DiscoveryResult> { return byKey(key, L.unlike); }
export async function rejectTrade(key: unknown): Promise<DiscoveryResult> { return byKey(key, L.rejectTrade); }
export async function undoRejectTrade(key: unknown): Promise<DiscoveryResult> { return byKey(key, L.undoReject); }
export async function unlikeForm(key: unknown): Promise<void> { if ((await unlike(key)).ok) refresh(); }
