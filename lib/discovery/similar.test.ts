// F-2 PR-3b: "Similar trades" ordering (pure).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holdBucket, type SectionTrader } from './section.ts';
import { SIMILAR_ROWS, similarCandidates, similarRows } from './similar.ts';

const T = (trader: number, hold: number, weight: number, verified = true, n = 10): SectionTrader => ({ trader, hold, weight, n, score: 1, verified });

test('candidates: same holding bucket as the profile\'s record, never the profile\'s trader or a skipped one; verified by lower bound, then Demo', () => {
  const pool = [T(1, 3, 0.9), T(2, 3, 0.5, false), T(3, 40, 0.8), T(4, 2, 0.1), T(5, 6, 0.7), T(6, 3, 0.95, false), T(7, 1, 0.2), T(8, 3, 0.3)];
  const c = similarCandidates(pool, 1, 4, new Set([8]));
  assert.deepEqual(c.map((t) => t.trader), [5, 7, 4, 6, 2]);
  assert.ok(c.every((t) => holdBucket(t.hold) === holdBucket(4)));
  // Whatever order the pool comes in, the same rows.
  assert.deepEqual(similarCandidates([...pool].reverse(), 1, 4, new Set([8])).map((t) => t.trader), [5, 7, 4, 6, 2]);
  assert.deepEqual(similarCandidates(pool, 99, 300, new Set()), []);
});

test('rows: one trade per trader in candidate order, in the bucket; fewer than 3 → no section', () => {
  const cands = [T(1, 3, 0.9), T(2, 3, 0.5), T(3, 3, 0.4), T(4, 3, 0.3)];
  const tr = (trader: number, holdingDays = 3) => ({ trader, holdingDays, symbol: `S${trader}` });
  const all = new Map([1, 2, 3, 4].map((id) => [id, tr(id)]));
  assert.deepEqual(similarRows(cands, all, 1)!.map((r) => r.trader), [1, 2, 3]);
  // A trader without a trade in the bucket is skipped, the next one fills the row.
  assert.deepEqual(similarRows(cands, new Map([...all, [2, tr(2, 40)]]), 1)!.map((r) => r.trader), [1, 3, 4]);
  assert.equal(similarRows(cands, new Map([[1, tr(1)], [2, tr(2)]]), 1), null);
  assert.equal(SIMILAR_ROWS, 3);
});

test('a loss counts like a gain: the rows read no return, only the lower bound, closes and id', () => {
  // Rows carry no return: the same candidates with any returns behind their weights give the same order.
  const a = similarCandidates([T(1, 3, 0.4), T(2, 3, 0.4, true, 12), T(3, 3, 0.6)], 0, 3, new Set());
  assert.deepEqual(a.map((t) => t.trader), [3, 2, 1]);
});
