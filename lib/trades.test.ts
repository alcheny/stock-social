import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeReturn, rangeTrades, curveDomain, equityCurve, matchTrades, maxDrawdown, nearestIndex, openLots, pct, rangeText, stats, stepIndex, type Activity } from './trades.ts';
import type { CorporateAction } from './corporate-actions.ts';

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
  // F-36: entry fee in the denominator
  assert.ok(Math.abs(trades[0].returnPct - (1950 - 1600 - 1.5 - 1.5) / (1600 + 1.5)) < 1e-12);
  assert.equal(trades[0].holdingDays, 9);
});

test('sell with no recorded entry is excluded, not guessed', () => {
  // Fixes cycle 4 (C4-2): the buy after an oversell may be a short's cover, so the later sell is a new short or a round
  // trip, and its figure is +10% or unknown: counted, never priced from the cover (it used to publish +10%). Both sells
  // are counted under `excluded`, one count per sell.
  const { trades, excluded, excludedCorporate } = matchTrades([act('SELL', 5, 50, 2), act('BUY', 5, 40, 3), act('SELL', 5, 44, 4)]);
  assert.equal(excluded, 2);
  assert.equal(excludedCorporate, 0);
  assert.equal(trades.length, 0);
  // Another account's round trip is untouched by this account's gap (+10%).
  const other = matchTrades([act('SELL', 5, 50, 2), act('BUY', 5, 40, 3, 0, { accountId: 'acc2' }), act('SELL', 5, 44, 4, 0, { accountId: 'acc2' })]);
  assert.equal(other.excluded, 1);
  assert.ok(Math.abs(other.trades[0].returnPct - 0.1) < 1e-12);
});

// Corporate actions (POLICY F3c, committee 2026-11-01): this test used to assert that the matched part was shown at
// +10%. An oversell proves the position's recorded history is missing shares (an unrecorded split, a transfer in), so the
// matched part's basis is unknown: the whole sell is excluded and counted, never shown with a possibly wrong return.
test('partial unmatched sell is excluded whole and counted (its matched part is not shown)', () => {
  const { trades, excluded } = matchTrades([act('BUY', 2, 10, 1), act('SELL', 3, 11, 2)]);
  assert.equal(excluded, 1);
  assert.equal(trades.length, 0);
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
  assert.equal(rangeText({ perTrade: { low: -0.008, high: -0.0001 } } as Parameters<typeof rangeText>[0]), '(-0.8% to 0.0%)');
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

// ---- Fixes cycle 3 (docs/direction/cycle3-2026-11-01.md F3-1, F3-5; committee log docs/features/logs/fixes-cycle3/) ----
// A vendor BUY/SELL row the importer can't price (no usable price, units or date) reaches the matcher as an
// `unpriceable` action with reason 'trade' (lib/broker.ts#toActivities, lib/corporate-actions.ts#unusableTrade).
const unusable = (side: 'BUY' | 'SELL', day: number | null, units?: number): CorporateAction => ({
  externalId: `u${n++}`, accountId: 'acc', symbol: 'AAPL', executedAt: day === null ? new Date(0) : d(day), kind: 'unpriceable', reason: 'trade', side,
  ...(units !== undefined ? { units } : {}), ...(day === null ? { undated: true } : {}),
});

test('F3-1: a later round trip after an unpriceable sell is priced from its own buy, never from the earlier lot', () => {
  // The record's probe: buy 100 @50, sell @0 (unpriceable), buy 100 @10, sell 100 @12 published -76% instead of +20%.
  const m = matchTrades([act('BUY', 100, 50, 1), act('BUY', 100, 10, 3), act('SELL', 100, 12, 4)], [unusable('SELL', 2, 100)]);
  assert.equal(m.trades.length, 1);
  assert.ok(Math.abs(m.trades[0].returnPct - 0.2) < 1e-12, String(m.trades[0].returnPct));
  assert.equal(m.excludedCorporate, 1); // the unpriceable sell itself is counted
  assert.equal(m.excluded, 0);
});

test('F3-1: an unpriceable sell consumes only its own units, oldest first; the rest of the ledger still prices', () => {
  const m = matchTrades([act('BUY', 100, 50, 1), act('BUY', 100, 10, 2), act('SELL', 100, 11, 4)], [unusable('SELL', 3, 100)]);
  assert.deepEqual(m.trades.map((t) => +t.returnPct.toFixed(12)), [0.1]);
  assert.equal(m.excludedCorporate, 1);
});

test('F3-1: an unpriceable buy opens a lot with no basis: a sell drawing it is counted, never priced; later round trips price', () => {
  const m = matchTrades([act('SELL', 100, 12, 2), act('BUY', 10, 10, 3), act('SELL', 10, 11, 4)], [unusable('BUY', 1, 100)]);
  assert.equal(m.excludedCorporate, 1);
  assert.equal(m.excluded, 0);
  assert.deepEqual(m.trades.map((t) => +t.returnPct.toFixed(12)), [0.1]);
});

test('F3-1: a row with no usable units leaves the pair\'s ledger unknown from then on: nothing after it is priced, everything is counted', () => {
  // Without the forward taint, the buy @10 would sit behind the unknown sell and be drawn by the round trip after it (+230%).
  const m = matchTrades([
    act('BUY', 100, 50, 1), act('BUY', 100, 10, 3), act('SELL', 100, 12, 4), act('BUY', 100, 30, 5), act('SELL', 100, 33, 6),
    act('BUY', 1, 10, 1, 0, { symbol: 'MSFT' }), act('SELL', 1, 11, 6, 0, { symbol: 'MSFT' }), // another pair is untouched
  ], [unusable('SELL', 2)]);
  assert.equal(m.trades.length, 1);
  assert.equal(m.trades[0].symbol, 'MSFT');
  assert.equal(m.excludedCorporate, 3); // the unknown sell and the two sells after it
  assert.equal(m.excluded, 0);
});

test('F3-1: an undated row taints the whole pair (it can\'t be placed); an undated buy is not counted, an undated sell is', () => {
  const rows = [act('BUY', 10, 10, 1), act('SELL', 10, 11, 2), act('BUY', 10, 10, 3), act('SELL', 10, 11, 4)];
  const sell = matchTrades(rows, [unusable('SELL', null, 10)]);
  assert.equal(sell.trades.length, 0);
  assert.equal(sell.excludedCorporate, 3);
  const buy = matchTrades(rows, [unusable('BUY', null)]);
  assert.equal(buy.trades.length, 0);
  assert.equal(buy.excludedCorporate, 2);
});

test('F3-1: unusable trade rows are not repricing actions: they open no late-posting window and no same-day rule', () => {
  const m = matchTrades([act('BUY', 200, 10, 1), act('SELL', 100, 11, 10), act('BUY', 5, 10, 12), act('SELL', 5, 11, 13)], [unusable('SELL', 12, 100)]);
  // The sell on day 10 (two days before the unpriceable one) and the round trip on its day are priced.
  assert.deepEqual(m.trades.map((t) => +t.returnPct.toFixed(12)), [0.1, 0.1]);
  assert.equal(m.excludedCorporate, 1);
});

test('F3-5: at the same instant a buy is matched before a sell, whatever the vendor ids or the input order (date-only timestamps)', () => {
  for (const [sellId, buyId] of [['a', 'b'], ['b', 'a']]) {
    const buy: Activity = { ...act('BUY', 10, 100, 5), externalId: buyId };
    const sell: Activity = { ...act('SELL', 10, 90, 5), externalId: sellId };
    for (const input of [[sell, buy], [buy, sell]]) {
      const m = matchTrades(input);
      assert.equal(m.excluded, 0, `ids sell=${sellId} buy=${buyId}`);
      assert.equal(m.trades.length, 1);
      assert.ok(Math.abs(m.trades[0].returnPct + 0.1) < 1e-12);
      assert.equal(openLots(input).length, 0); // no phantom lot left behind
    }
  }
});

test('F3-5: same-instant buy first never changes a sell that older lots cover (FIFO draws them first)', () => {
  const rows = [act('BUY', 10, 100, 1), act('SELL', 10, 110, 5), act('BUY', 10, 200, 5), act('SELL', 10, 220, 9)];
  for (const input of [rows, [rows[0], rows[2], rows[1], rows[3]]]) {
    assert.deepEqual(matchTrades(input).trades.map((t) => +t.returnPct.toFixed(12)), [0.1, 0.1]);
  }
});

test('F3-1 + F3-5: an unpriceable sell at the same instant as a buy is placed after it, so it consumes that buy, not a later one', () => {
  const m = matchTrades([act('BUY', 100, 10, 1), act('BUY', 100, 20, 2), act('SELL', 100, 22, 3)], [unusable('SELL', 1, 100)]);
  assert.deepEqual(m.trades.map((t) => +t.returnPct.toFixed(12)), [0.1]);
  assert.equal(m.excludedCorporate, 1);
});

test('F3-1 (review): an oversell after a row with no units or date is counted under that cause, not as missing history', () => {
  for (const row of [unusable('BUY', 1), unusable('BUY', null, 100), unusable('SELL', 1)]) {
    const m = matchTrades([act('SELL', 100, 12, 2)], [row]);
    assert.equal(m.excluded, 0);
    assert.equal(m.excludedCorporate, row.kind === 'unpriceable' && row.reason === 'trade' && row.side === 'SELL' ? 2 : 1);
  }
});

test('F3-1 (QA): lots a rename moves into a pair whose ledger is unknown are tainted, never priced', () => {
  const rename: CorporateAction = { externalId: `r${n++}`, accountId: 'acc', symbol: 'OLD', executedAt: d(30), kind: 'symbol-change', newSymbol: 'NEW', outUnits: 10, inUnits: 10 };
  const rows = [act('BUY', 10, 10, 1, 0, { symbol: 'OLD' }), act('SELL', 10, 12, 60, 0, { symbol: 'NEW' })];
  for (const day of [null, 20]) {
    const bad: CorporateAction = { ...unusable('SELL', day), symbol: 'NEW' };
    const m = matchTrades(rows, [rename, bad]);
    assert.equal(m.trades.length, 0, `unusable row day ${day}`);
    assert.equal(m.excludedCorporate, 2);
  }
  assert.equal(matchTrades(rows, [rename]).trades.length, 1); // without the unusable row, the renamed lot prices
});

test('F3-1 (orchestrator review): an unknown ledger stays unknown through a rename that moves no lots or whose share count does not match', () => {
  const newRows = [act('BUY', 100, 10, 15, 0, { symbol: 'NEW' }), act('SELL', 100, 12, 20, 0, { symbol: 'NEW' })];
  // No lots: a unit-less (or undated) BUY on OLD leaves none, so the rename used to leave NEW clean (+20% published).
  for (const bad of [unusable('BUY', 1), unusable('BUY', null)]) {
    const rename: CorporateAction = { externalId: `r${n++}`, accountId: 'acc', symbol: 'OLD', executedAt: d(10), kind: 'symbol-change', newSymbol: 'NEW', outUnits: 100, inUnits: 100 };
    const m = matchTrades(newRows, [{ ...bad, symbol: 'OLD' }, rename]);
    assert.deepEqual(m.trades, [], `${(bad as { undated?: boolean }).undated ? 'undated' : 'unit-less'} buy`);
    assert.equal(m.excludedCorporate, 1);
  }
  // Lots whose count doesn't match the rename's: they stay behind, tainted, and NEW is unknown too.
  const rename: CorporateAction = { externalId: `r${n++}`, accountId: 'acc', symbol: 'OLD', executedAt: d(10), kind: 'symbol-change', newSymbol: 'NEW', outUnits: 999, inUnits: 999 };
  const m = matchTrades([act('BUY', 50, 10, 1, 0, { symbol: 'OLD' }), ...newRows], [{ ...unusable('BUY', 2), symbol: 'OLD' }, rename]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excludedCorporate, 1);
});
