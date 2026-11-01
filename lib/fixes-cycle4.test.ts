// Fixes cycle 4 (docs/direction/cycle4-2026-11-01.md → Fixes list, Priority 1: record trust C4-1 / C4-2; decisions:
// docs/features/logs/fixes-cycle4/committee-2026-11-01.md). The record's probes, written before the fix (fictional rows).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTrades, type Activity } from './trades.ts';

let n = 0;
const row = (side: Activity['side'], units: number, price: number, at: string, extra: Partial<Activity> = {}): Activity => ({
  externalId: `c4-${n++}`, accountId: 'acc1', symbol: 'FAKE', side, units, price, fee: 0, executedAt: new Date(at), verified: true, ...extra,
});
const returns = (rows: Activity[]) => matchTrades(rows).trades.map((t) => +t.returnPct.toFixed(6));

test('C4-1 probe: a date-only same-day short (sell, then a cover on the same date) is counted, never a Verified long', () => {
  for (const order of ['sell-first', 'buy-first']) {
    const sell = row('SELL', 100, 15, '2026-10-01T00:00:00Z'), buy = row('BUY', 100, 14, '2026-10-01T00:00:00Z');
    const m = matchTrades(order === 'sell-first' ? [sell, buy] : [buy, sell]);
    assert.deepEqual(m.trades, [], order); // was +7.1% over 0 days, Verified
    assert.equal(m.excluded, 1, order);
  }
});

test('C4-1 probe: a losing date-only short is counted too (wins and losses alike)', () => {
  const m = matchTrades([row('SELL', 100, 12, '2026-10-01T00:00:00Z'), row('BUY', 100, 14, '2026-10-01T00:00:00Z')]);
  assert.deepEqual(m.trades, []); // was -16.7%
  assert.equal(m.excluded, 1);
});

test('C4-1 probe: the same rows with intraday stamps keep F3-5 and the clock order (short counted)', () => {
  const m = matchTrades([row('SELL', 100, 15, '2026-10-01T14:00:00Z'), row('BUY', 100, 14, '2026-10-01T15:00:00Z')]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excluded, 1);
});

test('C4-1 probe: pre-history shares sold and rebought on one date publish no made-up day trade and no later figure', () => {
  // 100 shares held from before the history; date-only SELL 100 @15 and BUY 100 @14; SELL 100 @18 later.
  const m = matchTrades([row('SELL', 100, 15, '2026-10-01T00:00:00Z'), row('BUY', 100, 14, '2026-10-01T00:00:00Z'), row('SELL', 100, 18, '2026-10-09T00:00:00Z')]);
  assert.deepEqual(m.trades, []); // was a made-up +7.1% day trade
  assert.equal(m.excluded + m.excludedCorporate, 2);
});

test('C4-2 probe: a short\'s cover never prices a later long trade', () => {
  const m = matchTrades([
    row('SELL', 100, 15, '2026-10-01T14:00:00Z'), // nothing held: a short (or earlier history)
    row('BUY', 100, 14, '2026-10-02T14:00:00Z'), // the cover
    row('BUY', 100, 20, '2026-10-05T14:00:00Z'),
    row('SELL', 100, 18, '2026-10-14T14:00:00Z'),
  ]);
  assert.ok(!m.trades.some((t) => Math.abs(t.returnPct - 18 / 14 + 1) < 1e-9), 'no +28.6% from the cover');
  assert.deepEqual(m.trades, []); // -10% can't be told apart from +28.6% (earlier history): counted
  assert.equal(m.excluded, 2);
});

test('C4-2: consuming the cover would publish a wrong figure under the earlier-history reading; the owed lot is counted', () => {
  // 100 shares from before the history; SELL 100 @15 (counted); BUY 100 @10; BUY 100 @20; SELL 100 @22.
  // Earlier history: the last sell draws the @10 lot (+120%). A short: the @10 buy covered, +10%. Neither is published.
  const m = matchTrades([row('SELL', 100, 15, '2026-10-01T14:00:00Z'), row('BUY', 100, 10, '2026-10-02T14:00:00Z'), row('BUY', 100, 20, '2026-10-03T14:00:00Z'), row('SELL', 100, 22, '2026-10-04T14:00:00Z')]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excluded, 2);
});

test('C4-2 (business lead, round 1): the gap a short leaves stays in FIFO order, so a later sell is counted when the readings differ', () => {
  // Nothing older held. SELL 100 @15 (counted); BUY 100 @10; BUY 100 @20; BUY 100 @30; SELL 100 @22; SELL 100 @33.
  // Earlier history: the sells draw @10 and @20 (+120%, +65%). A short: @10 covered, they draw @20 and @30 (+10%, +10%).
  const m = matchTrades([
    row('SELL', 100, 15, '2026-10-01T14:00:00Z'), row('BUY', 100, 10, '2026-10-02T14:00:00Z'), row('BUY', 100, 20, '2026-10-03T14:00:00Z'),
    row('BUY', 100, 30, '2026-10-04T14:00:00Z'), row('SELL', 100, 22, '2026-10-05T14:00:00Z'), row('SELL', 100, 33, '2026-10-06T14:00:00Z'),
  ]);
  assert.deepEqual(m.trades, []); // the draft rule published +65% for the last sell
  assert.equal(m.excluded, 3);
});

test('C4-2: a sell publishes when every reading draws the same lot (one buy spans the gap and the sell)', () => {
  const m = matchTrades([
    row('SELL', 100, 15, '2026-10-01T14:00:00Z'), // counted; a gap of 100 units
    row('BUY', 300, 10, '2026-10-02T14:00:00Z'),
    row('SELL', 100, 12, '2026-10-03T14:00:00Z'), // units 0-100 (earlier history) or 100-200 (a short covered): both @10
    row('SELL', 100, 13, '2026-10-04T14:00:00Z'), // 100-200 or 200-300: both @10
    row('SELL', 100, 14, '2026-10-05T14:00:00Z'), // 200-300, or a second short: counted
  ]);
  assert.deepEqual(m.trades.map((t) => +t.returnPct.toFixed(6)), [0.2, 0.3]);
  assert.equal(m.excluded, 2);
});

test('C4-2: after a gap, small round trips stay counted (a short reading makes each sell a new short)', () => {
  const m = matchTrades([
    row('SELL', 100, 15, '2026-10-01T14:00:00Z'),
    row('BUY', 100, 10, '2026-10-02T14:00:00Z'), row('SELL', 100, 12, '2026-10-03T14:00:00Z'),
    row('BUY', 100, 20, '2026-10-05T14:00:00Z'), row('SELL', 100, 18, '2026-10-14T14:00:00Z'),
  ]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excluded, 3);
});

test('C4-2: a plain buy-sell history is unchanged', () => {
  assert.deepEqual(returns([row('BUY', 100, 10, '2026-10-01T00:00:00Z'), row('SELL', 100, 11, '2026-10-02T00:00:00Z'), row('BUY', 50, 20, '2026-10-03T14:00:00Z'), row('SELL', 50, 18, '2026-10-04T14:00:00Z')]), [0.1, -0.1]);
});

// ---- Committee round 1 and 2 probes (docs/features/logs/fixes-cycle4/committee-2026-11-01.md) ----

test('C4-1 (business lead, round 2): a date-only buy and an intraday sell 24.5 h later can be one local date: counted', () => {
  for (const order of [0, 1]) {
    const rows = [row('BUY', 100, 14, '2026-10-01T00:00:00Z'), row('SELL', 100, 15, '2026-10-02T00:30:00Z')];
    const m = matchTrades(order ? rows.reverse() : rows);
    assert.deepEqual(m.trades, []); // was +7.1%: a late-session short on 1 October and its cover
    assert.equal(m.excluded, 1);
  }
  // Two date-only stamps on different dates keep their order (one broker, one time zone): a swing trade is shown.
  assert.deepEqual(returns([row('BUY', 100, 10, '2026-10-01T00:00:00Z'), row('SELL', 100, 12, '2026-10-02T00:00:00Z')]), [0.2]);
  // An intraday sell outside the date's window is ordered by the clock.
  assert.deepEqual(returns([row('BUY', 100, 10, '2026-10-01T00:00:00Z'), row('SELL', 100, 12, '2026-10-02T13:00:00Z')]), [0.2]);
});

test('C4-1 (reliability, round 1): mixed precision on one day, and two rows tied at a broker-local midnight, are counted', () => {
  // P3: an intraday sell and a date-only buy on the same date.
  const p3 = matchTrades([row('SELL', 100, 15, '2026-10-01T15:00:00Z'), row('BUY', 100, 14, '2026-10-01T00:00:00Z')]);
  assert.deepEqual([p3.trades.length, p3.excluded], [0, 1]);
  // P4: both stamped 04:00Z (exact tie).
  const p4 = matchTrades([row('BUY', 100, 14, '2026-10-01T04:00:00Z'), row('SELL', 100, 15, '2026-10-01T04:00:00Z')]);
  assert.deepEqual([p4.trades.length, p4.excluded], [0, 1]);
});

test('C4-1 (reliability, round 1): an older lot plus a date-only round trip: what depends on the order is counted, the rest shown', () => {
  // P2: BUY 50 @5 (Sep 1, intraday); Oct 1 date-only BUY 100 @10 and SELL 100 @12; SELL 50 @20; SELL 50 @8.
  const m = matchTrades([
    row('BUY', 50, 5, '2026-09-01T14:00:00Z'), row('BUY', 100, 10, '2026-10-01T00:00:00Z'), row('SELL', 100, 12, '2026-10-01T00:00:00Z'),
    row('SELL', 50, 20, '2026-10-05T14:00:00Z'), row('SELL', 50, 8, '2026-10-06T14:00:00Z'),
  ]);
  // The Oct 1 sell is partly a short in one reading (counted). SELL @20 draws @10 units in every reading (+100%). The
  // last sell has no lot in the round-trip reading: counted.
  assert.deepEqual(m.trades.map((t) => +t.returnPct.toFixed(6)), [1]);
  assert.equal(m.excluded, 2);
});

test('C4-1 (reliability, round 1): after a cover, a later sell is counted when the readings differ (+25% not published)', () => {
  // P1: SELL 100 @15 (nothing held), BUY 100 @14, BUY 100 @20, SELL 100 @18, SELL 100 @25.
  const m = matchTrades([
    row('SELL', 100, 15, '2026-10-01T14:00:00Z'), row('BUY', 100, 14, '2026-10-02T14:00:00Z'), row('BUY', 100, 20, '2026-10-03T14:00:00Z'),
    row('SELL', 100, 18, '2026-10-04T14:00:00Z'), row('SELL', 100, 25, '2026-10-05T14:00:00Z'),
  ]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excluded, 3);
});

test('C4-1 (engineer, round 1): two buys tied at one instant: a sell taking part of them is counted, whatever the input order', () => {
  // P1: two date-only buys on one date (100 @10, 100 @12), then SELL 100 @15: +50% or +25% by row order before.
  const buys = [row('BUY', 100, 10, '2026-10-01T00:00:00Z'), row('BUY', 100, 12, '2026-10-01T00:00:00Z')];
  for (const input of [[...buys, row('SELL', 100, 15, '2026-10-05T14:00:00Z')], [buys[1], buys[0], row('SELL', 100, 15, '2026-10-05T14:00:00Z')]]) {
    const m = matchTrades(input);
    assert.deepEqual([m.trades.length, m.excluded], [0, 1]);
  }
});

test('C4-1 (engineer, round 1): two sells tied at one instant split differently priced lots: both counted', () => {
  // P2: older lots 100 @10 and 100 @12; two date-only sells of 100 on one date.
  const lots = [row('BUY', 100, 10, '2026-09-01T14:00:00Z'), row('BUY', 100, 12, '2026-09-02T14:00:00Z')];
  for (const flip of [false, true]) {
    const sells = [row('SELL', 100, 13, '2026-10-01T00:00:00Z'), row('SELL', 100, 14, '2026-10-01T00:00:00Z')];
    const m = matchTrades([...lots, ...(flip ? sells.reverse() : sells)]);
    assert.deepEqual([m.trades.length, m.excluded], [0, 2]);
  }
  // Tied sells drawing one alike lot get the same figure in either order: shown.
  const one = [row('BUY', 200, 10, '2026-09-01T14:00:00Z'), row('SELL', 100, 13, '2026-10-01T00:00:00Z'), row('SELL', 100, 14, '2026-10-01T00:00:00Z')];
  assert.deepEqual(returns(one).sort(), [0.3, 0.4]);
});

test('C4-1 (UX lead, round 2): one order filled in two pieces at one second, sold whole later, is shown', () => {
  // P5: 50 @10 and 50 @11 at the same second, then SELL 100 @12: every order gives the same cost and date.
  const fills = [row('BUY', 50, 10, '2026-10-01T14:30:00Z'), row('BUY', 50, 11, '2026-10-01T14:30:00Z')];
  for (const input of [[...fills, row('SELL', 100, 12, '2026-10-02T14:00:00Z')], [fills[1], fills[0], row('SELL', 100, 12, '2026-10-02T14:00:00Z')]]) {
    assert.deepEqual(matchTrades(input).trades.map((t) => +t.returnPct.toFixed(6)), [+(1200 / 1050 - 1).toFixed(6)]);
  }
  // Selling half of them is counted, and so is the other half later (the group was split).
  const half = matchTrades([...fills, row('SELL', 50, 12, '2026-10-02T14:00:00Z'), row('SELL', 50, 12, '2026-10-03T14:00:00Z')]);
  assert.deepEqual([half.trades.length, half.excluded], [0, 2]);
});

test('C4-1 (engineer, round 1): shares a rename names that the ledger lacks are drawn first in the new symbol (counted), not skipped', () => {
  const rename = { externalId: 'rn', accountId: 'acc1', symbol: 'FAKE', executedAt: new Date('2026-10-01T00:00:00Z'), kind: 'symbol-change', newSymbol: 'TEST', outUnits: 100, inUnits: 100 } as const;
  const rows = [row('BUY', 100, 10, '2026-10-02T14:00:00Z', { symbol: 'TEST' }), row('SELL', 100, 11, '2026-10-03T14:00:00Z', { symbol: 'TEST' }), row('SELL', 100, 12, '2026-10-04T14:00:00Z', { symbol: 'TEST' })];
  const m = matchTrades(rows, [rename]);
  // FIFO: the 100 renamed shares (no recorded basis) go first, so the @11 sell is counted; the @12 sell draws the @10 buy.
  assert.deepEqual([m.trades.map((t) => +t.returnPct.toFixed(6)), m.excludedCorporate], [[0.2], 1]);
});

test('C4-1 (engineer, round 2): on a mixed-stamp day only the date-only row floats; the intraday sell opens no gap', () => {
  // BUY 100 @10 at 10:00, SELL 100 @11 at 15:00, a date-only BUY 50 @9 the same day; later an ordinary round trip.
  const m = matchTrades([
    row('BUY', 100, 10, '2026-10-01T10:00:00Z'), row('SELL', 100, 11, '2026-10-01T15:00:00Z'), row('BUY', 50, 9, '2026-10-01T00:00:00Z'),
    row('SELL', 50, 12, '2026-10-08T14:00:00Z'), row('BUY', 100, 20, '2026-10-09T14:00:00Z'), row('SELL', 100, 22, '2026-10-10T14:00:00Z'),
  ]);
  // The 15:00 sell may have drawn the date-only buy (counted, no gap). The Oct 8 sell draws the rest of the day's tied buys
  // (counted). The later round trip is shown: +10%.
  assert.deepEqual(m.trades.map((t) => +t.returnPct.toFixed(6)), [0.1]);
  assert.equal(m.excluded, 2);
});

test('C4-1 (reliability, round 2): public filings pass their known order, so same-day rows keep it (no tie rules)', () => {
  // Probe B: an open-market buy and sale on one date-only day, in filing order.
  assert.deepEqual(matchTrades([row('BUY', 100, 10, '2026-10-01T00:00:00Z'), row('SELL', 100, 12, '2026-10-01T00:00:00Z')], [], { orderKnown: true }).trades.map((t) => +t.returnPct.toFixed(6)), [0.2]);
  // Probe A: an unpriced acquisition sold the same day, then an open-market round trip: +12.5% (as on main).
  const a = matchTrades([
    row('BUY', 500, 1, '2026-10-01T00:00:00Z', { verified: false }), row('SELL', 500, 30, '2026-10-01T00:00:00Z'),
    row('BUY', 200, 40, '2026-10-05T00:00:00Z'), row('SELL', 200, 45, '2026-10-09T00:00:00Z'),
  ], [], { orderKnown: true });
  assert.deepEqual(a.trades.filter((t) => t.verified).map((t) => +t.returnPct.toFixed(6)), [0.125]);
  // Broker rows (no option) are counted in both cases.
  assert.deepEqual(matchTrades([row('BUY', 100, 10, '2026-10-01T00:00:00Z'), row('SELL', 100, 12, '2026-10-01T00:00:00Z')]).trades, []);
});
