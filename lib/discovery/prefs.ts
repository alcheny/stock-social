// F-2 PR-4 (owner decisions O1 and O4): a signed-in viewer's negative preferences, before PR-5's personal scoring. Pure
// (lib/discovery/imports.test.ts). Computed from the state rows the viewer chose, never from events (no event table
// before PR-5): each running unfollow (WEIGHTS.unfollow) and each trade reject of the last PREF_DAYS
// (WEIGHTS.rejectTrader) adds its weight to that trader. A preference p ≤ 0 multiplies the trader's ranking product by
// PREF_BASE^(−p) (−1 → ×0.8: slight), in the feed (weight × score, lib/trades.ts#rankTraders) and in the section's
// choice of rows (the TR-9 weight); equal products go to the trader with no preference, so an otherwise identical
// trader ranks above. Nothing is hidden. Read at asOf, like the exclusions: a preference made after asOf enters at the
// viewer's next page 1, so a same-day cursor's list never changes. Signed out there are no preferences.
import { discounted } from './explore.ts';
import { byEvidence, type SectionTrader } from './section.ts';
import { PREF_BASE, PREF_DAYS, WEIGHTS } from './weights.ts';
import type { ExclusionRow, RejectRow } from './exclusions.ts';

const DAY = 86_400_000;
export type PrefRow = { trader: number; createdAt: number; until: number; weight: number };

export const prefFactor = (p: number): number => PREF_BASE ** -Math.min(0, p);

// The rows behind the preferences: running unfollows, and each reject's trader part (ends at PREF_DAYS, or at its Undo).
export function prefRows(exclusions: readonly ExclusionRow[], rejects: readonly RejectRow[]): PrefRow[] {
  return [
    ...exclusions.filter((r) => r.reason === 'unfollow').map((r) => ({ trader: r.trader, createdAt: r.createdAt, until: r.until, weight: WEIGHTS.unfollow })),
    ...rejects.map((r) => ({ trader: r.trader, createdAt: r.createdAt, until: Math.min(r.until, r.createdAt + PREF_DAYS * DAY), weight: WEIGHTS.rejectTrader })),
  ];
}

export function prefsAt(rows: readonly PrefRow[], asOf: number): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of rows) if (r.createdAt <= asOf && r.until > asOf) out.set(r.trader, (out.get(r.trader) ?? 0) + r.weight);
  return out;
}

// The impersonal order again with the preferences: the same comparator as rankTraders (cards with evidence first, then
// weight × score, then score), each side × its factor, then the factor, then the impersonal rank; then the per-card
// discount. With no preference on any listed trader it is the impersonal list itself.
export type RankSlot = { trader: number | string; score: number; weight: number; rank: number };
export function rerank<T extends RankSlot>(ranked: readonly T[], prefs: ReadonlyMap<T['trader'], number>): T[] {
  if (!ranked.some((c) => prefs.has(c.trader))) return [...ranked];
  const f = (c: T) => prefFactor(prefs.get(c.trader) ?? 0);
  return discounted([...ranked].sort((a, b) => {
    if ((a.weight > 0) !== (b.weight > 0)) return a.weight > 0 ? -1 : 1;
    const fa = f(a), fb = f(b);
    return b.weight * b.score * fb - a.weight * a.score * fa || b.score * fb - a.score * fa || fb - fa || a.rank - b.rank;
  }));
}

// The section's pool for this viewer: chosen by weight × factor; between equals, the evidence order (the trader with
// no preference first). The rows still read in evidence order (lib/discovery/section.ts#chooseRows).
export function preferPool<T extends SectionTrader>(pool: readonly T[], prefs: ReadonlyMap<number, number>): T[] {
  if (!pool.some((t) => prefs.has(t.trader))) return [...pool];
  const mine = pool.map((t) => (prefs.has(t.trader) ? { ...t, pref: prefs.get(t.trader) } : t));
  return mine.sort((a, b) => b.weight * prefFactor(b.pref ?? 0) - a.weight * prefFactor(a.pref ?? 0) || byEvidence(a, b));
}
