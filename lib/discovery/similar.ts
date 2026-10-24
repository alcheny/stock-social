// F-2 PR-3b (owner decision O2, 2026-10-24): "Similar trades" on a trader's profile, below the trader's own trades.
// Rows are closed trades by OTHER traders held about as long as this trader's typical trade (the same holding bucket as
// the record's median holding period). Pure (lib/discovery/imports.test.ts): it orders and filters what it is given.
// - Candidates: the feed's section pool (eligible traders, TR-9 lower-bound order: lib/discovery/section.ts#sectionPool)
//   in the profile's bucket, minus the profile's trader and `skip` (signed in: the viewer and their running "Not
//   interested" exclusions). Verified records first, Demo after, each part in the pool's order. No raw average, no size
//   of a move and no sign is read: a loss counts exactly like a gain.
// - One trade per trader (its most recent close in the bucket, read by lib/similar.ts), 3 rows, fewer → no section.
// - Not grouped by symbol, and the same for every viewer apart from the `skip` set it is handed.
import { byEvidence, holdBucket, type SectionTrader } from './section.ts';

export const SIMILAR_ROWS = 3;
export const SIMILAR_MIN = 5; // the profile's record needs this many closes to have a typical holding period
export const SIMILAR_SPARES = 8; // candidates read per profile (a deleted, importing or bucketless one is skipped)

export function similarCandidates(pool: readonly SectionTrader[], self: number, hold: number, skip: ReadonlySet<number>): SectionTrader[] {
  const b = holdBucket(hold);
  const ok = pool.filter((t) => t.trader !== self && !skip.has(t.trader) && holdBucket(t.hold) === b);
  return [...ok.filter((t) => t.verified !== false).sort(byEvidence), ...ok.filter((t) => t.verified === false).sort(byEvidence)];
}

// The rows: candidates in order that have a trade in the bucket, distinct traders; exactly n or null.
export function similarRows<T extends { trader: number; holdingDays: number }>(cands: readonly { trader: number }[], trades: ReadonlyMap<number, T>, bucket: number, n = SIMILAR_ROWS): T[] | null {
  const out: T[] = [];
  for (const c of cands) {
    const t = trades.get(c.trader);
    if (t && t.trader === c.trader && holdBucket(t.holdingDays) === bucket && !out.some((o) => o.trader === t.trader)) out.push(t);
    if (out.length === n) return out;
  }
  return null;
}
