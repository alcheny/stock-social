// F-2 PR-3: the suggestions section (criteria 7, 8, 9, 10) and the reject swipe's recognizer on section rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capped, chooseRows, holdBucket, median, reasonFor, SECTION_NEAR, SECTION_PER_BUCKET, SECTION_ROWS, SECTION_SPARES, sectionCandidates, sectionPool, type SectionTrader, type TraderFacts } from './section.ts';
import { canArm, horizontal, REJECT_QUIET_MS, swipeOutcome } from './reject.ts';
import { prng } from './explore.ts';
import type { ConfidenceInput } from '../trades.ts';
import { rankWeight } from '../rank-weight.ts';
import { readFileSync } from 'node:fs';
import { byEvidence } from './section.ts';
import { SECTION, SECTION_PERSONAL } from '../copy.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 23);

test('holding buckets and the median', () => {
  assert.deepEqual([0, 0.99, 1, 7, 7.5, 28, 28.1, 183, 183.5, 4000].map(holdBucket), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(median([]), 0);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

// A record of n closes with simple returns sign × (mean ± 0.01) (alternating spread), held d days each, no overlaps,
// one every 10 days. F-33: simple returns (was log returns), because the ranking weight is computed on simple returns
// (OD 2.32), so the mirrored record is the exact negation and the tie stays exact.
function record(n: number, mean: number, d = 3, sign: 1 | -1 = 1): ConfidenceInput[] {
  return Array.from({ length: n }, (_, i) => {
    const x = sign * (mean + (i % 2 ? 0.01 : -0.01));
    const openedAt = new Date(T0 - (n - i) * 10 * DAY);
    return { symbol: `S${i}`, returnPct: x, holdingDays: d, openedAt, closedAt: new Date(openedAt.getTime() + d * DAY) };
  });
}
const facts = (ts: ConfidenceInput[]): TraderFacts => ({ weight: rankWeight(ts), hold: median(ts.map((t) => t.holdingDays)), n: ts.length });

// Fix round 1 (tester Medium 2, criterion 8): the pool was ordered by rankTraders (weight × the biggest recent move); it
// is now ordered by the TR-9 weight alone, ties by closes counted then user id. Restated, not loosened: the expected
// order is the stricter one.
// F-33 (orchestrator ruling R1): ties by id only (was closes counted, then id). Trader 4 now carries weight too, so the
// fixture keeps three weighted traders (two of them the mirrored pair) and two at weight 0.
test('the pool is ordered by the ranking weight alone (never a raw average or the size of a move), ties by id; a losing record weighs exactly like the mirrored winning one', () => {
  const recs = new Map<number, ConfidenceInput[]>([[1, record(40, 0.02)], [2, record(40, 0.02, 3, -1)], [3, record(6, 0.3)], [4, record(40, 0.01)], [5, record(12, 0.05)]]);
  const f = new Map([...recs].map(([id, ts]) => [id, facts(ts)]));
  // Mirrored: the same weight, exactly.
  assert.ok(f.get(1)!.weight > 0);
  assert.equal(f.get(1)!.weight, f.get(2)!.weight);
  assert.ok(f.get(4)!.weight > 0 && f.get(4)!.weight < f.get(1)!.weight);
  assert.equal(f.get(5)!.weight, 0); // 12 bets: below the tier
  // Trader 3 has the highest raw average (+35% a trade) but too few bets: weight 0, so it ranks below every confident record.
  assert.equal(f.get(3)!.weight, 0);
  const cards = [1, 2, 3, 4, 5].flatMap((trader) => [{ trader, score: trader === 3 ? 9 : 1 + trader / 10 }, { trader, score: 0.5 }]);
  const pool = sectionPool(cards, f);
  const expected = [1, 2, 3, 4, 5].map((trader) => ({ trader, ...f.get(trader)! })).sort((a, b) => b.weight - a.weight || a.trader - b.trader);
  assert.deepEqual(pool.map((t) => t.trader), expected.map((t) => t.trader));
  assert.deepEqual(pool.map((t) => t.trader), [1, 2, 4, 3, 5]);
  for (let i = 1; i < pool.length; i++) assert.ok(pool[i - 1].weight >= pool[i].weight);
  assert.ok(pool.findIndex((t) => t.trader === 3) > pool.findIndex((t) => t.trader === 1));
  // A trader with no facts (not eligible at asOf) is not in the pool.
  assert.equal(sectionPool([{ trader: 9, score: 5 }], f).length, 0);
});

test('sign invariance: negating every return leaves the section unchanged; a loss is suggested exactly as a gain of the same evidence', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = prng(seed);
    const ids = Array.from({ length: 6 + Math.floor(r() * 30) }, (_, i) => i + 1);
    const means = new Map(ids.map((id) => [id, (r() - 0.5) * 0.08]));
    const sizes = new Map(ids.map((id) => [id, 5 + Math.floor(r() * 50)]));
    const build = (sign: 1 | -1) => {
      const f = new Map(ids.map((id) => [id, facts(record(sizes.get(id)!, means.get(id)!, 1 + (id % 40), sign))]));
      // the card score reads only the size of a move (lib/feed.ts: ln(1 + |r|·100) × recency), never its sign
      const cards = ids.map((trader) => ({ trader, score: Math.log1p(Math.abs(means.get(trader)!) * 100) }));
      const list = ids.slice(0, 4).flatMap((trader) => [{ trader }, { trader }]);
      return chooseRows(sectionCandidates(sectionPool(cards, f), list, 0, new Set([ids[ids.length - 1]])))?.map((t) => t.trader) ?? null;
    };
    assert.deepEqual(build(-1), build(1), `seed ${seed}`);
  }
});

const T = (trader: number, hold = 3, weight = 0, score = 1): SectionTrader => ({ trader, hold, weight, score, n: 5 });

test('candidates: the pool minus the traders in the 10 feed cards around the section and the skip set (viewer, follows, exclusions); fewer than 3 → no section; distinct traders, at most 2 per holding bucket', () => {
  const pool = Array.from({ length: 20 }, (_, i) => T(i + 1, i % 5 === 0 ? 0.5 : 3));
  const list = Array.from({ length: 60 }, (_, i) => ({ trader: (i % 12) + 1 }));
  const c0 = sectionCandidates(pool, list, 0, new Set([15]));
  const near = new Set(list.slice(0, SECTION_NEAR).map((c) => c.trader));
  assert.ok(c0.every((t) => !near.has(t.trader) && t.trader !== 15));
  assert.deepEqual(c0.map((t) => t.trader), [11, 12, 13, 14, 16, 17, 18, 19, 20]); // pool order kept
  const rows = chooseRows(c0)!;
  assert.equal(rows.length, SECTION_ROWS);
  assert.deepEqual(rows.map((t) => t.trader), [11, 12, 13]);
  // At most two share a holding bucket: three in bucket 1, then one in bucket 0.
  assert.deepEqual(chooseRows([T(1), T(2), T(3), T(4, 0.2)])!.map((t) => t.trader), [1, 2, 4]);
  assert.equal(chooseRows([T(1), T(2), T(3)]), null);
  assert.equal(chooseRows([T(1), T(1, 0.2), T(2, 40)]), null); // distinct traders
  for (const n of [0, 1, 2]) assert.equal(chooseRows(Array.from({ length: n }, (_, i) => T(i + 1, i * 30))), null);
  // Every candidate skipped (all hidden by the viewer) → no section.
  assert.equal(chooseRows(sectionCandidates(pool, list, 0, new Set(pool.map((t) => t.trader)))), null);
});

test('each page\'s section shows traders not shown in an earlier section of the same list while any are left, then reuses them', () => {
  const pool = Array.from({ length: 12 }, (_, i) => T(i + 1, [0.5, 3, 20, 60, 300][i % 5]));
  const list = Array.from({ length: 120 }, (_, i) => ({ trader: 100 + i })); // no pool trader on a card
  const pages = [0, 30, 60, 90].map((o) => chooseRows(sectionCandidates(pool, list, o, new Set()))!.map((t) => t.trader));
  assert.deepEqual(pages, [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]]);
  assert.deepEqual(chooseRows(sectionCandidates(pool, list, 120, new Set()))!.map((t) => t.trader), [1, 2, 3]);
});

// Fix round 1 (business lead demand 2): one template. Restated: every row's reason is its record's holding bucket,
// whatever the account's age or the last close (the "New here this month" and "Closed a trade this week" cases are gone).
test('reasons: every row reads its record\'s typical holding period, true against its inputs; no ticker, no performance number', () => {
  for (const hold of [0.2, 0.99, 1, 3, 7, 7.5, 28, 60, 183, 200, 4000]) assert.deepEqual(reasonFor({ hold }), { kind: 'hold', bucket: holdBucket(hold) });
  assert.deepEqual(reasonFor({ hold: 3 }), { kind: 'hold', bucket: 1 });
  assert.deepEqual(reasonFor({ hold: 200 }), { kind: 'hold', bucket: 4 });
});

// Fix round 1 (tester Construction, Medium 2): a record with the higher raw average and a big recent move but the lower
// lower bound ranks after the steadier one.
test('TR-9 order: a lower raw average with a higher lower bound ranks first, whatever the size of the other\'s recent move', () => {
  const steady = record(40, 0.03); // +3% a trade, tight
  // +5.4% a trade on average, wide swings and a +100% last close: less evidence of a pace.
  const wild = record(40, 0.0).map((t, i) => ({ ...t, returnPct: Math.expm1(i === 39 ? Math.log(2) : (i % 2 ? 0.25 : -0.19)) }));
  const avg = (ts: ConfidenceInput[]) => ts.reduce((a, t) => a + t.returnPct, 0) / ts.length;
  assert.ok(avg(wild) > avg(steady), `${avg(wild)} vs ${avg(steady)}`);
  const f = new Map([[1, facts(wild)], [2, facts(steady)]]);
  assert.ok(f.get(2)!.weight > f.get(1)!.weight, `${f.get(2)!.weight} vs ${f.get(1)!.weight}`);
  const pool = sectionPool([{ trader: 1, score: 9 }, { trader: 2, score: 0.1 }], f);
  assert.deepEqual(pool.map((t) => t.trader), [2, 1]);
  // Equal weights (weight-0 records): the lower id first, never more closes or the bigger move (F-33, ruling R1; was
  // more closes first).
  const g = new Map([[3, facts(record(6, 0.3))], [4, facts(record(9, 0.01))], [5, facts(record(9, 0.02))]]);
  assert.ok([3, 4, 5].every((id) => g.get(id)!.weight === 0));
  assert.deepEqual(sectionPool([{ trader: 3, score: 9 }, { trader: 5, score: 1 }, { trader: 4, score: 0.1 }], g).map((t) => t.trader), [3, 4, 5]);
});

// Fix round 1 (tester Medium 1): the rows come from every candidate under the bucket cap, never from a fixed slice; the
// spares read per page are chosen the same way.
test('the section survives a run of candidates in one holding period: rows and spares chosen under the cap from the whole pool', () => {
  const pool = [...Array.from({ length: 12 }, (_, i) => T(i + 1, 3, 1 - i / 100)), T(13, 60, 0.5), T(14, 0.5, 0.4), T(15, 300, 0.3)];
  const list = Array.from({ length: 30 }, (_, i) => ({ trader: 100 + i }));
  const cands = sectionCandidates(pool, list, 0, new Set());
  assert.deepEqual(cands.slice(0, 8).map((t) => holdBucket(t.hold)), Array(8).fill(1)); // the old slice: one bucket only
  const spares = capped(cands, SECTION_SPARES);
  assert.deepEqual(spares.map((t) => t.trader), [1, 2, 13, 14, 15]);
  assert.deepEqual(chooseRows(spares)!.map((t) => t.trader), [1, 2, 13]);
  assert.deepEqual(chooseRows(cands)!.map((t) => t.trader), [1, 2, 13]);
  for (const b of new Set(spares.map((t) => holdBucket(t.hold)))) assert.ok(spares.filter((t) => holdBucket(t.hold) === b).length <= SECTION_PER_BUCKET);
});

// Fix round 1 (tester Low 1): the 10 cards around the section are the displayed ones (a hidden trader's cards removed).
test('near cards are counted after hidden cards are removed', () => {
  const pool = [T(10, 0.5), T(50, 3), T(8, 14), T(60, 60)];
  // Page 2's slots: the hidden trader 99 holds 2 of the first 10; trader 50's card is slot 11 of the page.
  const page = [99, 1, 2, 3, 99, 4, 5, 6, 7, 9, 50, 11, 12].map((trader) => ({ trader }));
  const list = [...Array.from({ length: 30 }, (_, i) => ({ trader: 200 + i })), ...page];
  const shown = page.filter((c) => c.trader !== 99);
  const before = sectionCandidates(pool, list, 30, new Set()).map((t) => t.trader);
  assert.ok(before.includes(50)); // counted from the slots, trader 50 looked far away
  const after = sectionCandidates(pool, list, 30, new Set(), shown).map((t) => t.trader);
  assert.ok(!after.includes(50), 'trader 50 is displayed card 10');
  assert.deepEqual(after, [60, 10, 8]); // page 1's section showed 10, 50 and 8: new faces first
});

test('reject swipe recognizer: 49% snaps back, 51% commits; never commits unarmed; arms only at rest, with no pane open and ≥ 400 ms after one closed; a diagonal over the lock ratio scrolls', () => {
  const W = 375, rest = W, C = 343, full = C; // full: the finger travelled the whole card
  assert.equal(swipeOutcome(rest - 0.49 * W, rest, W, true, full, C), 'back');
  assert.equal(swipeOutcome(rest - 0.51 * W, rest, W, true, full, C), 'reject');
  assert.equal(swipeOutcome(0, rest, W, true, full, C), 'reject');
  assert.equal(swipeOutcome(0, rest, W, false, full, C), 'back');
  assert.equal(swipeOutcome(rest + 0.51 * W, rest, W, false, 0, C), 'open');
  assert.equal(swipeOutcome(rest + 0.49 * W, rest, W, true, full, C), 'back');
  assert.equal(swipeOutcome(rest, rest, W, true, full, C), 'rest');
  // Fix round 1 (business lead demand 1, UX 1): the finger's own travel decides, restated against the row card: a fling
  // that lands the row past half (or at the tray's end) commits only if the finger travelled half the card.
  const A = 149; // the swipe area beside Follow and "…" at 375
  assert.equal(swipeOutcome(0, A, A, true, 0.49 * C, C), 'back');
  assert.equal(swipeOutcome(0, A, A, true, 0.51 * C, C), 'reject');
  assert.equal(swipeOutcome(0, A, A, true, 0.4 * C, C), 'back'); // a fast 40% flick that the browser carried to the end
  assert.equal(swipeOutcome(0, A, A, true, 50, C), 'back'); // a 50 px flick
  assert.equal(swipeOutcome(0.6 * A, A, A, true, 0.6 * C, C), 'back'); // enough travel, but the row came back under half
  assert.equal(swipeOutcome(0, A, A, false, C, C), 'back'); // unarmed: never
  assert.equal(canArm({ atRest: true, paneOpen: false, sinceClose: REJECT_QUIET_MS }), true);
  assert.equal(canArm({ atRest: true, paneOpen: false, sinceClose: 399 }), false);
  assert.equal(canArm({ atRest: true, paneOpen: true, sinceClose: 10_000 }), false);
  assert.equal(canArm({ atRest: false, paneOpen: false, sinceClose: 10_000 }), false);
  assert.equal(horizontal(40, 20), true);
  assert.equal(horizontal(39, 20), false);
});

// F-2 PR-1b (business lead §5 item 2): traders with no card earlier in the list first; the "new record" slot.
test('PR-1b: traders with no card earlier in the list come first, each group in pool order', () => {
  const pool = Array.from({ length: 8 }, (_, i) => ({ ...T(i + 1, [0.5, 3, 20, 60][i % 4], 1 - i / 10), n: 40 }));
  const list = [...Array.from({ length: 30 }, (_, i) => ({ trader: i < 3 ? i + 1 : 100 + i })), ...Array.from({ length: 30 }, (_, i) => ({ trader: 200 + i }))];
  const c = sectionCandidates(pool, list, 30, new Set()).map((t) => t.trader);
  // Page 1's section took 4, 5, 6 (1 to 3 are its near cards); on page 2, 7 and 8 have neither a card nor a row yet.
  assert.deepEqual(c, [7, 8, 4, 5, 6, 1, 2, 3]);
});

test('PR-1b new-record slot: the third place goes to the weight-0 trader with no earlier card and the fewest closes; rows stay in non-increasing weight', () => {
  const W = (id: number, weight: number, n: number, hold = 3) => ({ ...T(id, hold, weight), n });
  const pool = [W(1, 0.3, 40, 0.5), W(2, 0.2, 40, 20), W(3, 0.1, 30, 60), W(4, 0, 30, 300), W(5, 0, 6), W(6, 0, 5)];
  const list = Array.from({ length: 30 }, (_, i) => ({ trader: 100 + i }));
  const rows = chooseRows(sectionCandidates(pool, list, 0, new Set()))!;
  assert.deepEqual(rows.map((t) => t.trader), [1, 2, 6]);
  // F-33 (ruling R1): the rows read weight first, then id (was weight, then closes).
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].weight < rows[i - 1].weight || (rows[i].weight === rows[i - 1].weight && rows[i].trader > rows[i - 1].trader));
  // Page 2: 6 was shown, so the slot goes to 5; page 3: both shown, the fewest closes again.
  const long = [...list, ...Array.from({ length: 60 }, (_, i) => ({ trader: 200 + i }))];
  assert.deepEqual(chooseRows(sectionCandidates(pool, long, 30, new Set()))!.map((t) => t.trader), [3, 4, 5]);
  // A newcomer with a card earlier in the list is not given the slot.
  const carded = [...Array.from({ length: 30 }, (_, i) => ({ trader: i === 20 ? 6 : 100 + i })), ...Array.from({ length: 30 }, (_, i) => ({ trader: 200 + i }))];
  assert.ok(!chooseRows(sectionCandidates(pool, carded, 30, new Set()))!.some((t) => t.trader === 6));
  // Sign-blind: the slot reads weight, closes and id only.
  assert.deepEqual(chooseRows(sectionCandidates(pool.map((t) => ({ ...t, score: -t.score })), list, 0, new Set()))!.map((t) => t.trader), [1, 2, 6]);
});

test('PR-1b new-record slot: a Demo (unverified) record never takes it', () => {
  const W = (id: number, weight: number, n: number, verified?: boolean) => ({ ...T(id, [0.5, 20, 60, 300, 3][id % 5], weight), n, ...(verified === undefined ? {} : { verified }) });
  const pool = [W(1, 0.3, 40), W(2, 0.2, 40), W(3, 0.1, 30), W(4, 0, 6, false), W(5, 0, 8, true)];
  const list = Array.from({ length: 30 }, (_, i) => ({ trader: 100 + i }));
  assert.deepEqual(chooseRows(sectionCandidates(pool, list, 0, new Set()))!.map((t) => t.trader), [1, 2, 5]);
});

// PR-1b fix round 1 (tester Medium 2): untraded-first decides which traders are chosen; the rows read in evidence order.
test('PR-1b fix 1: the rows read in evidence order whatever group chose them (tester 0.1 / 0.05 / 0.9 construction)', () => {
  const pool = [T(100, 0.5, 0.9), T(101, 20, 0.8), T(200, 60, 0.1), T(201, 300, 0.05)];
  const list = [...Array.from({ length: 30 }, (_, i) => ({ trader: i === 12 ? 100 : i === 14 ? 101 : 300 + i })), ...Array.from({ length: 30 }, (_, i) => ({ trader: 400 + i }))];
  const c = sectionCandidates(pool, list, 30, new Set());
  assert.deepEqual(c.slice(0, 2).map((t) => t.trader).sort(), [200, 201]); // chosen first: no earlier card
  const rows = chooseRows(c)!.map((t) => t.trader);
  assert.deepEqual(rows, [100, 200, 201]);
});

test('PR-1b fix 1: a Demo record never sits above a verified row, even with more evidence and no earlier card', () => {
  const V = (id: number, weight: number, verified: boolean, hold = 3) => ({ ...T(id, hold, weight), n: 40, verified });
  const pool = [V(1, 0.9, false, 0.5), V(2, 0.8, false, 20), V(3, 0.3, true, 60), V(4, 0.2, true, 300), V(5, 0.1, true, 3), V(6, 0.05, true, 0.5)];
  const list = Array.from({ length: 30 }, (_, i) => ({ trader: 100 + i }));
  const rows = chooseRows(sectionCandidates(pool, list, 0, new Set()))!;
  assert.deepEqual(rows.map((t) => t.trader), [3, 4, 5]);
  // With only two verified candidates the Demo record fills the third row, below both.
  const two = chooseRows(sectionCandidates(pool.filter((t) => t.trader < 5), list, 0, new Set()))!;
  assert.deepEqual(two.map((t) => t.trader), [3, 4, 1]);
  for (const r of [rows, two]) for (let i = 1; i < r.length; i++) assert.ok(!(r[i].verified && r[i - 1].verified === false));
});

test('PR-1b fix 1: the new-record slot is chosen before the bucket cap (a newcomer sharing the top rows\' bucket still gets a row)', () => {
  const W = (id: number, weight: number, n: number, hold: number) => ({ ...T(id, hold, weight), n });
  const pool = [W(1, 0.3, 40, 3), W(2, 0.2, 40, 3), W(3, 0.1, 30, 60), W(4, 0, 30, 300), W(9, 0, 5, 4)];
  const list = Array.from({ length: 30 }, (_, i) => ({ trader: 100 + i }));
  const rows = chooseRows(sectionCandidates(pool, list, 0, new Set()))!.map((t) => t.trader);
  assert.deepEqual(rows, [1, 3, 9]); // 9 shares bucket 1 with 1 and 2: it keeps its row, 2 gives way
});

// ---- F-33 (orchestrator ruling R1; business lead round 2, D1 and D2) ----

test('F-33 R1: two records equal in weight, one of 200 closes and one of 20, order only by id (both input orders, all weights 0)', () => {
  const many = record(200, 0.01).map((t) => ({ ...t, openedAt: new Date(T0 - 60 * DAY + (+t.openedAt - T0) / 100), closedAt: new Date(T0 - 60 * DAY + (+t.closedAt - T0) / 100) }));
  const few = record(20, 0.01);
  const f = new Map([[7, facts(many)], [3, facts(few)]]);
  assert.equal(f.get(7)!.n, 200);
  assert.equal(f.get(3)!.n, 20);
  assert.equal(f.get(7)!.weight, 0);
  assert.equal(f.get(3)!.weight, 0);
  for (const cards of [[{ trader: 7, score: 2 }, { trader: 3, score: 2 }], [{ trader: 3, score: 2 }, { trader: 7, score: 2 }]]) {
    assert.deepEqual(sectionPool(cards, f).map((t) => t.trader), [3, 7]);
  }
  // Swap the ids: the order follows the id, not the count.
  const g = new Map([[3, f.get(7)!], [7, f.get(3)!]]);
  assert.deepEqual(sectionPool([{ trader: 7, score: 2 }, { trader: 3, score: 2 }], g).map((t) => t.trader), [3, 7]);
  // The comparator itself reads no count.
  assert.equal(byEvidence({ weight: 0, trader: 1, n: 200 } as never, { weight: 0, trader: 2, n: 20 } as never) < 0, true);
  assert.equal(byEvidence({ weight: 0, trader: 1, n: 20 } as never, { weight: 0, trader: 2, n: 200 } as never) < 0, true);
});

test('F-33 R1: every row with ranking weight precedes every row at weight 0, in the pool and in the rows', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const r = prng(seed);
    const pool = Array.from({ length: 12 }, (_, i) => ({ ...T(i + 1, [0.5, 3, 20, 60, 300][Math.floor(r() * 5)], r() < 0.4 ? r() : 0), n: 5 + Math.floor(r() * 300) }))
      .sort(() => r() - 0.5).sort(byEvidence);
    const zero = pool.findIndex((t) => t.weight === 0);
    if (zero >= 0) assert.ok(pool.slice(zero).every((t) => t.weight === 0), `seed ${seed}: pool`);
    const rows = chooseRows(pool);
    if (!rows) continue;
    const z = rows.findIndex((t) => t.weight === 0);
    if (z >= 0) assert.ok(rows.slice(z).every((t) => t.weight === 0), `seed ${seed}: rows`);
  }
});

test('F-33 R1: the section line is true of the comparator and says "ranking weight"; the section links to /how', () => {
  for (const line of [SECTION.explain, SECTION_PERSONAL.explain]) {
    assert.match(line, /Verified records with ranking weight come first, the rest in a fixed order, Demo records last\. Losses count the same as gains\.$/);
    assert.doesNotMatch(line, /how much evidence/);
  }
  assert.equal(SECTION.explain, 'Verified records with ranking weight come first, the rest in a fixed order, Demo records last. Losses count the same as gains.');
  // Review R4: a weighted Demo row reads after a weight-0 verified row, as the line says ("Demo records last").
  const rows = chooseRows([{ ...T(1, 0.5, 0.9), verified: false }, { ...T(2, 3, 0), verified: true }, { ...T(3, 20, 0.2), verified: true }])!;
  assert.deepEqual(rows.map((t) => t.trader), [3, 2, 1]);
  const verified = rows.filter((t) => t.verified !== false);
  assert.ok(verified.findIndex((t) => t.weight === 0) > verified.findIndex((t) => t.weight > 0), 'verified: weighted first');
  assert.equal(rows.at(-1)!.verified, false, 'Demo last');
  // "come first": weight > 0 sorts before weight 0; "a fixed order": equal weights by id, whatever the closes or score.
  assert.ok(byEvidence({ weight: 0.01, trader: 9 }, { weight: 0, trader: 1 }) < 0);
  assert.ok(byEvidence({ weight: 0, trader: 1 }, { weight: 0, trader: 9 }) < 0);
  assert.ok(byEvidence({ weight: 0, trader: 9 }, { weight: 0, trader: 1 }) > 0);
  // "Losses count the same as gains": the comparator reads only weight (sign-blind, AC6) and id.
  assert.deepEqual(byEvidence.length, 2);
  const src = readFileSync(new URL('../../app/suggest-section.tsx', import.meta.url), 'utf8');
  assert.match(src, /href="\/how"/);
  assert.match(src, /SECTION\.howLink/);
});
