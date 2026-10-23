// F-2 PR-3 (criteria 7, 8, 9, 10): the suggestions section, impersonal. One full-height card after the 5th card of every
// 30-card page, 3 traders. Pure (lib/discovery/imports.test.ts): it orders and filters what it is given.
// - The pool is the feed's eligible traders at asOf (lib/feed.ts#feedList), ordered by `rank` (lib/trades.ts#rankTraders)
//   with weight = the TR-9 lower-bound evidence weight and score = the trader's best card score (|return| × recency):
//   never a raw average, and a loss weighs exactly like a gain of the same size.
// - Candidates for a page: the pool minus the traders in the 10 feed cards around the section and minus `skip` (signed
//   in: the viewer, their follows and every running exclusion, "Not interested" and unfollow alike; criterion 4).
//   Traders shown in an earlier page's section of the same list go after the others, so each page shows new faces while
//   any are left.
// - Rows: distinct traders, at most 2 sharing a holding bucket. Fewer than 3 → no section.
// - It never reads who is viewing beyond the `skip` set it is handed.
import { PAGE_SIZE } from './pager.ts';

export const SECTION_AT = 5; // the section follows the 5th card of a page (position 6)
export const SECTION_ROWS = 3;
export const SECTION_NEAR = 10; // the 10 feed cards around the section: 5 before, 5 after
export const SECTION_PER_BUCKET = 2;
export const SECTION_SPARES = 8; // candidates read per page (rows that turn out to be importing or deleted are skipped)
export const WEEK_MS = 7 * 86_400_000;
export const MONTH_MS = 30 * 86_400_000;

// Median holding period (days) → bucket: under a day, 1 to 7 days, 1 to 4 weeks, 1 to 6 months, over 6 months.
export const holdBucket = (days: number): number => (days < 1 ? 0 : days <= 7 ? 1 : days <= 28 ? 2 : days <= 183 ? 3 : 4);
export function median(xs: readonly number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Per trader, read at asOf: the evidence weight, the median holding days and the last close (ms).
export type TraderFacts = { weight: number; hold: number; last: number };
export type SectionTrader = TraderFacts & { trader: number; score: number };

export function sectionPool(cards: readonly { trader: number; score: number }[], facts: ReadonlyMap<number, TraderFacts>,
  rank: (items: SectionTrader[]) => SectionTrader[]): SectionTrader[] {
  const best = new Map<number, number>();
  for (const c of cards) best.set(c.trader, Math.max(best.get(c.trader) ?? -Infinity, c.score));
  const out: SectionTrader[] = [];
  for (const [trader, score] of best) {
    const f = facts.get(trader);
    if (f) out.push({ trader, score, weight: f.weight, hold: f.hold, last: f.last });
  }
  return rank(out);
}

// The section's rows from ordered candidates: distinct traders, at most SECTION_PER_BUCKET per holding bucket.
export function chooseRows<T extends { trader: number; hold: number }>(cands: readonly T[], n = SECTION_ROWS): T[] | null {
  const out: T[] = [], per = new Map<number, number>(), seen = new Set<number>();
  for (const t of cands) {
    const b = holdBucket(t.hold);
    if (seen.has(t.trader) || (per.get(b) ?? 0) >= SECTION_PER_BUCKET) continue;
    seen.add(t.trader); per.set(b, (per.get(b) ?? 0) + 1); out.push(t);
    if (out.length === n) return out;
  }
  return null;
}

// The ordered candidates for the section of the page at `offset` of `list` (the slots the viewer's pages slice).
export function sectionCandidates(pool: readonly SectionTrader[], list: readonly { trader: number }[], offset: number, skip: ReadonlySet<number>): SectionTrader[] {
  const earlier = new Set<number>();
  for (let o = 0; ; o += PAGE_SIZE) {
    const near = new Set(list.slice(o, o + SECTION_NEAR).map((c) => c.trader));
    const ok = pool.filter((t) => !skip.has(t.trader) && !near.has(t.trader));
    const cands = [...ok.filter((t) => !earlier.has(t.trader)), ...ok.filter((t) => earlier.has(t.trader))];
    if (o >= offset) return cands;
    for (const t of chooseRows(cands) ?? []) earlier.add(t.trader);
  }
}

// One reason line per row, each true against its inputs (lib/copy.ts#SECTION): "New here this month" (account under
// 30 days old at asOf), else the typical holding period; a second row in the same bucket says "Closed a trade this
// week" instead when its last close is within 7 days of asOf. No ticker, no number about performance.
export type Reason = { kind: 'new' } | { kind: 'week' } | { kind: 'hold'; bucket: number };
export function reasonFor(t: { hold: number; last: number; joined: number }, asOf: number, earlierBuckets: readonly number[]): Reason {
  if (t.joined > asOf - MONTH_MS) return { kind: 'new' };
  const bucket = holdBucket(t.hold);
  if (earlierBuckets.includes(bucket) && t.last > asOf - WEEK_MS && t.last <= asOf) return { kind: 'week' };
  return { kind: 'hold', bucket };
}
