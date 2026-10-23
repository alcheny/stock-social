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
import { mixFeed, type Mixed } from './explore.ts';
import type { MixCard } from './diversity.ts';

export type ExclusionRow = { trader: number; createdAt: number; until: number };

export function splitExclusions(rows: readonly ExclusionRow[], asOf: number, now: number): { shaping: Set<number>; hidden: Set<number> } {
  const shaping = new Set<number>(), hidden = new Set<number>();
  for (const r of rows) {
    if (r.createdAt <= asOf) { if (r.until > asOf) shaping.add(r.trader); }
    else if (r.until > now) hidden.add(r.trader);
  }
  return { shaping, hidden };
}

// The list for a viewer: the impersonal ranking minus the shaping exclusions, mixed (caps and exploration) as PR-1 mixes it.
export function shapeList<T extends MixCard>(ranked: readonly T[], shaping: ReadonlySet<MixCard['trader']>, day: string): Mixed<T>[] {
  return mixFeed(shaping.size ? ranked.filter((c) => !shaping.has(c.trader)) : ranked, { day });
}

export const displayFilter = <T extends { trader: MixCard['trader'] }>(slice: readonly T[], hidden: ReadonlySet<MixCard['trader']>): T[] =>
  hidden.size ? slice.filter((c) => !hidden.has(c.trader)) : [...slice];
