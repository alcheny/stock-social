// F-2 PR-2 (plan demand B): a viewer's exclusions in a paged feed. Pure (lib/discovery/imports.test.ts).
// The list a cursor slices is a function of (day, asOf, the exclusions at asOf):
// - an exclusion made at or before asOf and still running at asOf shapes the list: that trader's cards are left out
//   before the mix, so the caps hold exactly;
// - one made after asOf and running now is a display filter: that trader's cards drop from every later slice in place,
//   the rest keep their positions (no card repeats, none vanishes but the hidden trader's);
// - Undo and "Show again" end an exclusion (until = now) instead of deleting it, and the tick deletes only rows that
//   ended over a day ago, so ending or purging a row never changes a same-day cursor's list.
// Removing cards brings others closer: in 10 consecutive displayed cards one trader or symbol appears at most
// 2 + 2·hides times (4 after one hide); a page 1 built at a new asOf obeys the caps (2) exactly.
// F-2 PR-4: a trade reject (O1) splits the same way, per card (key: the close's vendor id in the list, trade_key stored);
// an 'unfollow' row is never a hide (O4): it is a preference (lib/discovery/prefs.ts), shaping the order at asOf only.
import { mixFeed, type Mixed } from './explore.ts';
import type { MixCard } from './diversity.ts';
import { rerank, type RankSlot } from './prefs.ts';

export type ExclusionRow = { trader: number; createdAt: number; until: number; reason?: 'not_interested' | 'unfollow' };
export type RejectRow = { key: string; trader: number; createdAt: number; until: number };

function split<K>(rows: readonly { createdAt: number; until: number }[], key: (i: number) => K, asOf: number, now: number) {
  const shaping = new Set<K>(), hidden = new Set<K>();
  rows.forEach((r, i) => {
    if (r.createdAt <= asOf) { if (r.until > asOf) shaping.add(key(i)); }
    else if (r.until > now) hidden.add(key(i));
  });
  return { shaping, hidden };
}
export function splitExclusions(rows: readonly ExclusionRow[], asOf: number, now: number): { shaping: Set<number>; hidden: Set<number> } {
  const hides = rows.filter((r) => r.reason !== 'unfollow');
  return split(hides, (i) => hides[i].trader, asOf, now);
}
export const splitRejects = (rows: readonly RejectRow[], asOf: number, now: number) => split(rows, (i) => rows[i].key, asOf, now);

// The list for a viewer: the impersonal ranking minus the shaping exclusions and rejected cards, ordered with the
// viewer's preferences at asOf, mixed (caps and exploration, PR-1b's outside traders included) as PR-1 mixes it.
export function shapeList<T extends MixCard>(ranked: readonly T[], shaping: ReadonlySet<MixCard['trader']>, day: string,
  o: { keys?: ReadonlySet<string>; prefs?: ReadonlyMap<number, number>; extra?: readonly T[] } = {}): Mixed<T>[] {
  const keep = (c: T) => !shaping.has(c.trader) && !o.keys?.has(c.key);
  const list = ranked.filter(keep);
  return mixFeed(o.prefs?.size ? rerank(list as unknown as (T & RankSlot)[], o.prefs) : list, { day, extra: (o.extra ?? []).filter(keep) });
}

export const displayFilter = <T extends { trader: MixCard['trader']; key?: string }>(slice: readonly T[], hidden: ReadonlySet<MixCard['trader']>, keys?: ReadonlySet<string>): T[] =>
  hidden.size || keys?.size ? slice.filter((c) => !hidden.has(c.trader) && !(c.key !== undefined && keys?.has(c.key))) : [...slice];
