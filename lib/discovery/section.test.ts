// F-2 PR-3: the suggestions section (criteria 7, 8, 9, 10) and the reject swipe's recognizer on section rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRows, holdBucket, median, MONTH_MS, reasonFor, SECTION_NEAR, SECTION_ROWS, sectionCandidates, sectionPool, WEEK_MS, type SectionTrader, type TraderFacts } from './section.ts';
import { canArm, horizontal, REJECT_QUIET_MS, swipeOutcome } from './reject.ts';
import { prng } from './explore.ts';
import { confidence, evidenceWeight, rankTraders, type ConfidenceInput } from '../trades.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 23);

test('holding buckets and the median', () => {
  assert.deepEqual([0, 0.99, 1, 7, 7.5, 28, 28.1, 183, 183.5, 4000].map(holdBucket), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(median([]), 0);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

// A record of n closes with log returns sign × (mean ± 0.01) (alternating spread), held d days each, no overlaps.
function record(n: number, mean: number, d = 3, sign: 1 | -1 = 1): ConfidenceInput[] {
  return Array.from({ length: n }, (_, i) => {
    const x = sign * (mean + (i % 2 ? 0.01 : -0.01));
    const openedAt = new Date(T0 - (n - i) * 10 * DAY);
    return { symbol: `S${i}`, returnPct: Math.expm1(x), holdingDays: d, openedAt, closedAt: new Date(openedAt.getTime() + d * DAY) };
  });
}
const facts = (ts: ConfidenceInput[]): TraderFacts => ({ weight: ts.length ? evidenceWeight(confidence(ts, new Date(T0))) : 0, hold: median(ts.map((t) => t.holdingDays)), last: Math.max(...ts.map((t) => t.closedAt.getTime())) });

test('the pool is ordered by rankTraders with the TR-9 lower-bound weight (never a raw average); a losing record weighs exactly like the mirrored winning one', () => {
  const recs = new Map<number, ConfidenceInput[]>([[1, record(40, 0.02)], [2, record(40, 0.02, 3, -1)], [3, record(6, 0.3)], [4, record(40, 0.002)], [5, record(12, 0.05)]]);
  const f = new Map([...recs].map(([id, ts]) => [id, facts(ts)]));
  // Mirrored in log space: the same weight.
  assert.ok(f.get(1)!.weight > 0);
  assert.ok(Math.abs(f.get(1)!.weight - f.get(2)!.weight) < 1e-12, `${f.get(1)!.weight} vs ${f.get(2)!.weight}`);
  // Trader 3 has the highest raw average (+35% a trade) but too few bets: weight 0, so it ranks below every confident record.
  assert.equal(f.get(3)!.weight, 0);
  const cards = [1, 2, 3, 4, 5].flatMap((trader) => [{ trader, score: trader === 3 ? 9 : 1 + trader / 10 }, { trader, score: 0.5 }]);
  const pool = sectionPool(cards, f, rankTraders);
  const expected = rankTraders([1, 2, 3, 4, 5].map((trader) => ({ trader, score: Math.max(...cards.filter((c) => c.trader === trader).map((c) => c.score)), ...f.get(trader)! })));
  assert.deepEqual(pool.map((t) => t.trader), expected.map((t) => t.trader));
  assert.ok(pool.findIndex((t) => t.trader === 3) > pool.findIndex((t) => t.trader === 1));
  // A trader with no facts (not eligible at asOf) is not in the pool.
  assert.equal(sectionPool([{ trader: 9, score: 5 }], f, rankTraders).length, 0);
});

test('sign invariance: negating every return (in log space) leaves the section unchanged; a loss is suggested exactly as a gain of the same evidence', () => {
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
      return chooseRows(sectionCandidates(sectionPool(cards, f, rankTraders), list, 0, new Set([ids[ids.length - 1]])))?.map((t) => t.trader) ?? null;
    };
    assert.deepEqual(build(-1), build(1), `seed ${seed}`);
  }
});

const T = (trader: number, hold = 3, weight = 0, score = 1): SectionTrader => ({ trader, hold, weight, score, last: T0 });

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

test('reasons: each true against its inputs, no ticker, no performance number', () => {
  const asOf = T0;
  assert.deepEqual(reasonFor({ hold: 3, last: asOf - 1, joined: asOf - MONTH_MS + 1000 }, asOf, []), { kind: 'new' });
  assert.deepEqual(reasonFor({ hold: 3, last: asOf - 1, joined: asOf - MONTH_MS - 1 }, asOf, []), { kind: 'hold', bucket: 1 });
  // A second row in the same bucket: "Closed a trade this week" only if its last close is within 7 days.
  assert.deepEqual(reasonFor({ hold: 3, last: asOf - WEEK_MS + 1000, joined: 0 }, asOf, [1]), { kind: 'week' });
  assert.deepEqual(reasonFor({ hold: 3, last: asOf - WEEK_MS - 1, joined: 0 }, asOf, [1]), { kind: 'hold', bucket: 1 });
  assert.deepEqual(reasonFor({ hold: 200, last: asOf, joined: 0 }, asOf, [1]), { kind: 'hold', bucket: 4 });
});

test('reject swipe recognizer: 49% snaps back, 51% commits; never commits unarmed; arms only at rest, with no pane open and ≥ 400 ms after one closed; a diagonal over the lock ratio scrolls', () => {
  const W = 375, rest = W;
  assert.equal(swipeOutcome(rest - 0.49 * W, rest, W, true), 'back');
  assert.equal(swipeOutcome(rest - 0.51 * W, rest, W, true), 'reject');
  assert.equal(swipeOutcome(0, rest, W, true), 'reject');
  assert.equal(swipeOutcome(0, rest, W, false), 'back');
  assert.equal(swipeOutcome(rest + 0.51 * W, rest, W, false), 'open');
  assert.equal(swipeOutcome(rest + 0.49 * W, rest, W, true), 'back');
  assert.equal(swipeOutcome(rest, rest, W, true), 'rest');
  assert.equal(canArm({ atRest: true, paneOpen: false, sinceClose: REJECT_QUIET_MS }), true);
  assert.equal(canArm({ atRest: true, paneOpen: false, sinceClose: 399 }), false);
  assert.equal(canArm({ atRest: true, paneOpen: true, sinceClose: 10_000 }), false);
  assert.equal(canArm({ atRest: false, paneOpen: false, sinceClose: 10_000 }), false);
  assert.equal(horizontal(40, 20), true);
  assert.equal(horizontal(39, 20), false);
});
