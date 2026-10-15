import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holdBuckets, holdCaption, type TickerRow } from './ticker.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);
const today = new Date(t0 + 400 * DAY);
const hrow = (userId: number, days: number, r: number, verified = true): TickerRow => ({
  userId, returnPct: r, holdingDays: days, openedAt: new Date(t0), closedAt: new Date(t0 + 10 * DAY), verified,
});
const many = (days: number, n: number, r = 0.1) => Array.from({ length: n }, (_, i) => hrow(i + 1, days, r));

test('holdBuckets: empty', () => {
  const h = holdBuckets([], today);
  assert.equal(h.n, 0);
  assert.deepEqual(h.buckets.map((b) => b.key), ['lt1', '1to7', '7to28', 'gte28']);
  for (const b of h.buckets) {
    assert.equal(b.n, 0); assert.equal(b.shown, false);
    assert.equal(b.winRate, null); assert.equal(b.avgReturn, null); assert.equal(b.conf, null);
  }
});

test('holdBuckets: boundaries are half-open', () => {
  const h = holdBuckets([0.99, 1, 6.99, 7, 27.99, 28].map((d, i) => hrow(i + 1, d, 0.1)), today);
  assert.deepEqual(h.buckets.map((b) => b.n), [1, 2, 2, 1]);
  assert.equal(h.n, 6);
});

test('holdBuckets: fewer than 5 suppressed, 5 shown', () => {
  const four = holdBuckets(many(2, 4), today).buckets[1];
  assert.equal(four.shown, false);
  assert.equal(four.n, 4);
  assert.equal(four.winRate, null); assert.equal(four.avgReturn, null); assert.equal(four.conf, null);
  const five = holdBuckets(many(2, 5), today).buckets[1];
  assert.equal(five.shown, true);
  assert.notEqual(five.winRate, null); assert.notEqual(five.avgReturn, null); assert.notEqual(five.conf, null);
});

test('holdBuckets: all losses', () => {
  const b = holdBuckets(many(3, 5, -0.1), today).buckets[1];
  assert.equal(b.winRate, 0);
  assert.ok(b.avgReturn! < 0);
});

test('holdBuckets: a mix, stats per bucket only', () => {
  const rs = [0.1, 0.2, -0.1, -0.05, 0.05];
  const h = holdBuckets([...rs.map((r, i) => hrow(i + 1, 10, r)), ...many(0.5, 5, -0.5)], today);
  assert.equal(h.buckets[2].winRate, 0.6);
  assert.ok(Math.abs(h.buckets[2].avgReturn! - 0.04) < 1e-9);
  assert.equal(h.buckets[0].winRate, 0);
});

test('holdBuckets: NaN and negative go to lt1', () => {
  const h = holdBuckets([hrow(1, NaN, 0.1), hrow(2, -3, 0.1), hrow(3, 5, 0.1)], today);
  assert.deepEqual(h.buckets.map((b) => b.n), [2, 1, 0, 0]);
});

test('holdCaption', () => {
  assert.equal(holdCaption(holdBuckets([], today)), 'No trades');
  assert.equal(holdCaption(holdBuckets([hrow(1, 2, 0.1)], today)), '1 trade by hold time: 0 under 1 day, 1 1 to under 7 days, 0 7 to under 28 days, 0 28 days or more');
  const c = holdCaption(holdBuckets([...many(0.5, 3), ...many(10, 5, -0.2), ...many(40, 2)], today));
  assert.equal(c, '10 trades by hold time: 3 under 1 day, 0 1 to under 7 days, 5 7 to under 28 days, 2 28 days or more');
  for (const h of [holdBuckets([], today), holdBuckets(many(2, 6), today), holdBuckets(many(30, 5, -0.3), today)]) {
    assert.doesNotMatch(holdCaption(h), /best|worst|better|longer|higher/i);
  }
});
