// F-2 PR-3 (criteria 7, 8, 9, 10): the suggestions section, impersonal. One full-height card after the 5th card of every
// 30-card page, 3 traders. Pure (lib/discovery/imports.test.ts): it orders and filters what it is given.
// - The pool is the feed's eligible traders at asOf (lib/feed.ts#feedList), ordered by the TR-9 lower-bound evidence
//   weight alone (criterion 8; fix round 1: no longer weight × the trader's biggest recent move), ties broken by the
//   number of closes counted at asOf, then by user id: never a raw average or the size of a move, and a loss weighs
//   exactly like a gain of the same size.
// - Candidates for a page: the pool minus the traders in the 10 feed cards around the section and minus `skip` (signed
//   in: the viewer, their follows and every running exclusion, "Not interested" and unfollow alike; criterion 4).
//   Traders shown in an earlier page's section of the same list go after the others, so each page shows new faces while
//   any are left.
// - Rows: distinct traders, at most 2 sharing a holding bucket, chosen from every candidate (fix round 1: the cap applies
//   while choosing, never to a fixed slice). Fewer than 3 → no section.
// - It never reads who is viewing beyond the `skip` set it is handed.
import { PAGE_SIZE } from './pager.ts';

export const SECTION_AT = 5; // the section follows the 5th card of a page (position 6)
export const SECTION_ROWS = 3;
export const SECTION_NEAR = 10; // the 10 feed cards around the section: 5 before, 5 after
export const SECTION_PER_BUCKET = 2;
export const SECTION_SPARES = 8; // candidates read per page, chosen under the bucket cap (rows that turn out importing or deleted are skipped)

// Median holding period (days) → bucket: under a day, 1 to 7 days, 1 to 4 weeks, 1 to 6 months, over 6 months.
export const holdBucket = (days: number): number => (days < 1 ? 0 : days <= 7 ? 1 : days <= 28 ? 2 : days <= 183 ? 3 : 4);
export function median(xs: readonly number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Per trader, read at asOf: the evidence weight, the median holding days and the number of closes counted.
export type TraderFacts = { weight: number; hold: number; n: number; verified?: boolean };
export type SectionTrader = TraderFacts & { trader: number; score: number };

export function sectionPool(cards: readonly { trader: number; score: number }[], facts: ReadonlyMap<number, TraderFacts>): SectionTrader[] {
  const best = new Map<number, number>();
  for (const c of cards) best.set(c.trader, Math.max(best.get(c.trader) ?? -Infinity, c.score));
  const out: SectionTrader[] = [];
  for (const [trader, score] of best) {
    const f = facts.get(trader);
    if (f) out.push({ trader, score, weight: f.weight, hold: f.hold, n: f.n, ...(f.verified === undefined ? {} : { verified: f.verified }) });
  }
  return out.sort((a, b) => b.weight - a.weight || b.n - a.n || a.trader - b.trader);
}

// Up to n of the ordered candidates: distinct traders, at most SECTION_PER_BUCKET per holding bucket.
export function capped<T extends { trader: number; hold: number }>(cands: readonly T[], n: number): T[] {
  const out: T[] = [], per = new Map<number, number>(), seen = new Set<number>();
  for (const t of cands) {
    if (out.length === n) break;
    const b = holdBucket(t.hold);
    if (seen.has(t.trader) || (per.get(b) ?? 0) >= SECTION_PER_BUCKET) continue;
    seen.add(t.trader); per.set(b, (per.get(b) ?? 0) + 1); out.push(t);
  }
  return out;
}
// The section's rows: the first n under the cap, or null when fewer qualify.
export function chooseRows<T extends { trader: number; hold: number }>(cands: readonly T[], n = SECTION_ROWS): T[] | null {
  const out = capped(cands, n);
  return out.length === n ? out : null;
}

// The ordered candidates for the section of the page at `offset` of `list` (the slots the viewer's pages slice).
// `shown`: fix round 1 (tester Low 1), the page's cards as displayed (hidden traders' cards removed), so the 10 cards
// around the section are the ones the reader sees.
export function sectionCandidates(pool: readonly SectionTrader[], list: readonly { trader: number }[], offset: number, skip: ReadonlySet<number>,
  shown?: readonly { trader: number }[]): SectionTrader[] {
  const earlier = new Set<number>();
  for (let o = 0; ; o += PAGE_SIZE) {
    const near = new Set((o >= offset && shown ? shown : list.slice(o)).slice(0, SECTION_NEAR).map((c) => c.trader));
    // F-2 PR-1b (business lead §5 item 2): traders with no card earlier in the list come first, then the rest; inside each
    // group, those not yet in an earlier section first; each part keeps the pool's order (the TR-9 lower bound).
    const carded = new Set(list.slice(0, o).map((c) => c.trader));
    const ok = pool.filter((t) => !skip.has(t.trader) && !near.has(t.trader));
    const cands = [false, true].flatMap((c) => [false, true].flatMap((e) => ok.filter((t) => carded.has(t.trader) === c && earlier.has(t.trader) === e)));
    newRecordSlot(cands, carded, earlier);
    if (o >= offset) return cands;
    for (const t of chooseRows(cands) ?? []) earlier.add(t.trader);
  }
}

// F-2 PR-1b: the "new record" slot. A record whose 30-day interval still spans zero has evidence weight 0 and, ordered by
// the lower bound alone, never reaches a row while records with evidence (or more closes) exist; a newcomer with 5 or 6
// closes is such a record. The third place goes to the weight-0 trader with no card earlier in the list, not yet in an
// earlier section while one is left, with the fewest closes counted (then the lower id): the newest record. The rows
// still read in non-increasing evidence (row 3 has weight 0 and no more closes than rows 1 and 2), so the section's line
// stays true; no raw average, size of a move or sign is read, and every viewer gets the same slot. Best effort under
// the bucket cap: when rows 1 and 2 share its holding bucket, the next candidate takes the place. Only a verified
// record (every close verified) takes the slot: Demo data is never promoted as a new record.
function newRecordSlot(cands: SectionTrader[], carded: ReadonlySet<number>, earlier: ReadonlySet<number>) {
  if (cands.length < SECTION_ROWS) return;
  let at = -1;
  for (let i = 2; i < cands.length; i++) {
    const t = cands[i];
    if (t.weight > 0 || t.verified === false || carded.has(t.trader)) continue;
    const u = cands[at];
    if (!u || (+earlier.has(t.trader) - +earlier.has(u.trader) || t.n - u.n || t.trader - u.trader) < 0) at = i;
  }
  if (at > 2) cands.splice(2, 0, cands.splice(at, 1)[0]);
}

// One reason line per row (fix round 1, business lead demand 2: one template): the trader's typical holding period, true
// against its record at asOf (lib/copy.ts#SECTION.holds). No ticker, no number about performance.
export type Reason = { kind: 'hold'; bucket: number };
export const reasonFor = (t: { hold: number }): Reason => ({ kind: 'hold', bucket: holdBucket(t.hold) });
