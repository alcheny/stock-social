import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeReturn, rangeTrades, curveDomain, equityCurve, matchTrades, maxDrawdown, nearestIndex, pct, rangeText, stats, stepIndex, type Activity } from './trades.ts';

const d = (day: number) => new Date(Date.UTC(2026, 0, day));
let n = 0;
const act = (side: Activity['side'], units: number, price: number, day: number, fee = 0, extra: Partial<Activity> = {}): Activity => ({
  externalId: `a${n++}`, accountId: 'acc', symbol: 'AAPL', side, units, price, fee, executedAt: d(day), verified: true, ...extra,
});

test('FIFO across two lots, fees on both legs', () => {
  const { trades, excluded } = matchTrades([
    act('SELL', 15, 130, 10, 1.5), // given out of order on purpose
    act('BUY', 10, 100, 1, 1),
    act('BUY', 10, 120, 3, 1),
  ]);
  assert.equal(excluded, 0);
  assert.equal(trades.length, 1);
  // cost = 10*100 + 5*120 = 1600; entry fees = 1 + 0.5; exit = 15*130 = 1950; exit fee 1.5
  assert.ok(Math.abs(trades[0].returnPct - (1950 - 1600 - 1.5 - 1.5) / 1600) < 1e-12);
  assert.equal(trades[0].holdingDays, 9);
});

test('sell with no recorded entry is excluded, not guessed', () => {
  const { trades, excluded } = matchTrades([act('SELL', 5, 50, 2), act('BUY', 5, 40, 3), act('SELL', 5, 44, 4)]);
  assert.equal(excluded, 1);
  assert.equal(trades.length, 1);
  assert.ok(Math.abs(trades[0].returnPct - 0.1) < 1e-12);
});

test('partial unmatched sell keeps the matched part and counts as excluded', () => {
  const { trades, excluded } = matchTrades([act('BUY', 2, 10, 1), act('SELL', 3, 11, 2)]);
  assert.equal(excluded, 1);
  assert.ok(Math.abs(trades[0].returnPct - 0.1) < 1e-12);
});

test('a trade touching any demo activity is not verified', () => {
  const { trades } = matchTrades([act('BUY', 1, 10, 1, 0, { verified: false }), act('SELL', 1, 12, 2)]);
  assert.equal(trades[0].verified, false);
});

test('accounts and symbols are matched independently', () => {
  const { trades, excluded } = matchTrades([act('BUY', 1, 10, 1, 0, { accountId: 'other' }), act('SELL', 1, 12, 2)]);
  assert.equal(trades.length, 0);
  assert.equal(excluded, 1);
});

test('stats: win rate, profit factor, drawdown in close order', () => {
  const t = (r: number, day: number, hold = 2) => ({ returnPct: r, holdingDays: hold, closedAt: d(day) });
  const s = stats([t(-0.5, 2), t(0.1, 1), t(0.2, 3, 4)]);
  assert.equal(s.trades, 3);
  assert.ok(Math.abs(s.winRate - 2 / 3) < 1e-12);
  assert.ok(Math.abs(s.profitFactor! - 0.3 / 0.5) < 1e-12);
  assert.equal(s.medianHoldingDays, 2);
  assert.ok(Math.abs(s.maxDrawdown - 0.5) < 1e-12); // 1.1 → 0.55
  assert.equal(stats([t(0.1, 1)]).profitFactor, null);
});

test('equityCurve compounds equal-weight in close order', () => {
  const t = (r: number, day: number) => ({ returnPct: r, closedAt: d(day) });
  const c = equityCurve([t(-0.5, 2), t(0.1, 1), t(0.2, 3)]);
  assert.deepEqual(c.map((p) => p.trade.returnPct), [0.1, -0.5, 0.2]);
  assert.ok(Math.abs(c[0].cumulative - 0.1) < 1e-12);
  assert.ok(Math.abs(c[1].cumulative - -0.45) < 1e-12);
  assert.ok(Math.abs(c[2].cumulative - (1.1 * 0.5 * 1.2 - 1)) < 1e-12);
});

test('equityCurve: empty, single trade, all losses', () => {
  assert.deepEqual(equityCurve([]), []);
  assert.equal(equityCurve([{ returnPct: 0.25, closedAt: d(1) }])[0].cumulative, 0.25);
  const c = equityCurve([{ returnPct: -0.1, closedAt: d(1) }, { returnPct: -0.1, closedAt: d(2) }]);
  assert.ok(Math.abs(c[1].cumulative - -0.19) < 1e-12);
  assert.ok(Math.abs(maxDrawdown(c) - 0.19) < 1e-12);
});

test('max drawdown from the curve equals stats()', () => {
  const ts = [0.3, -0.2, -0.1, 0.5, -0.4, 0.05].map((r, i) => ({ returnPct: r, holdingDays: 1, closedAt: d(i + 1) }));
  assert.equal(maxDrawdown(equityCurve(ts)), stats(ts).maxDrawdown);
});

test('curveDomain always contains 0% and every point', () => {
  const up = equityCurve([{ returnPct: 0.5, closedAt: d(1) }, { returnPct: 0.1, closedAt: d(2) }]);
  assert.equal(curveDomain(up).min, 0);
  assert.ok(curveDomain(up).max > 0.6);
  const down = equityCurve([{ returnPct: -0.5, closedAt: d(1) }, { returnPct: -0.1, closedAt: d(2) }]);
  assert.equal(curveDomain(down).max, 0);
  assert.ok(curveDomain(down).min < -0.5);
  assert.deepEqual(curveDomain([]), { min: 0, max: 0 });
});

test('stepIndex clamps at both ends', () => {
  assert.equal(stepIndex(0, -1, 5), 0);
  assert.equal(stepIndex(4, 1, 5), 4);
  assert.equal(stepIndex(2, 1, 5), 3);
  assert.equal(stepIndex(2, -1, 5), 1);
});

test('nearestIndex snaps to the closest point', () => {
  const xs = [10, 12, 100, 300];
  assert.equal(nearestIndex(xs, -50), 0);
  assert.equal(nearestIndex(xs, 11.5), 1);
  assert.equal(nearestIndex(xs, 60), 2);
  assert.equal(nearestIndex(xs, 999), 3);
});

test('range tabs: filter by close date, re-compound from 0%, empty range is 0', () => {
  const now = d(31);
  const ts = [{ returnPct: 1, closedAt: d(1) }, { returnPct: 0.1, closedAt: d(28) }, { returnPct: -0.5, closedAt: d(30) }];
  assert.equal(rangeTrades(ts, 'ALL', now).length, 3);
  assert.equal(rangeTrades(ts, '1W', now).length, 2);
  assert.equal(rangeTrades(ts, '1M', now).length, 3);
  assert.ok(Math.abs(rangeReturn(ts, '1W', now) - (1.1 * 0.5 - 1)) < 1e-12);
  assert.ok(Math.abs(rangeReturn(ts, 'ALL', now) - (2 * 1.1 * 0.5 - 1)) < 1e-12);
  assert.equal(rangeReturn(ts, '1W', d(60)), 0);
  assert.equal(rangeTrades([], 'ALL', now).length, 0);
});

test('range tabs: one trade, all losses stay negative', () => {
  const now = d(10);
  assert.equal(rangeReturn([{ returnPct: 0.25, closedAt: d(9) }], '1W', now), 0.25);
  const losses = [{ returnPct: -0.1, closedAt: d(8) }, { returnPct: -0.1, closedAt: d(9) }];
  assert.ok(Math.abs(rangeReturn(losses, '1W', now) - -0.19) < 1e-12);
});

test('pct: a value that rounds to zero never reads "-0.0%" or "+0.0%"', () => {
  assert.equal(pct(-0.0001), '0.0%');
  assert.equal(pct(0.0001), '0.0%');
  assert.equal(pct(-0), '0.0%');
  assert.equal(pct(0), '0.0%');
  assert.equal(pct(-0.004, 0), '0%');
  assert.equal(pct(-0.0005), '-0.1%');
  assert.equal(pct(0.0005), '+0.1%');
  assert.equal(rangeText({ perTrade: { low: -0.008, high: -0.0001 } } as Parameters<typeof rangeText>[0]), '(-0.8% to -0.01%)'); // F-4 PR-1 fix round 2 (UX lead D9): a non-zero bound keeps its sign, never "-0.0%"
});

test('pct: a loss short of -100% never rounds to a total loss', () => {
  assert.equal(pct(-0.9998), '-99.98%');
  assert.equal(pct(-0.9998, 0), '-99.98%');
  assert.equal(pct(-0.99996), '-99.996%');
  assert.equal(pct(-0.9999999999), '≈-100.0%');
  assert.equal(pct(-1), '-100.0%');
  assert.equal(pct(-0.9994), '-99.9%');
  assert.equal(pct(-0.5), '-50.0%');
  assert.equal(pct(0.25, 0), '+25%');
  for (const x of [-0.99951, -0.9999, -0.999999, -0.99999999999]) assert.notEqual(pct(x), '-100.0%');
});
