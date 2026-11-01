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

test('C4-1 with evidence: after an earlier oversell, a date-only same-day short publishes nothing (both input orders)', () => {
  for (const order of ['sell-first', 'buy-first']) {
    const sell = row('SELL', 100, 15, '2026-10-01T00:00:00Z'), buy = row('BUY', 100, 14, '2026-10-01T00:00:00Z');
    const m = matchTrades([row('SELL', 10, 12, '2026-09-01T14:00:00Z'), ...(order === 'sell-first' ? [sell, buy] : [buy, sell])]);
    assert.deepEqual(m.trades, [], order); // was +7.1% over 0 days, Verified
    assert.equal(m.excluded, 2, order);
  }
});

test('F-30 probe C: without evidence, a date-only same-day round trip stays published, losses included (no steering by close timing)', () => {
  // A losing long bought and sold on one date-only day, nothing else on the pair: shown, never turned into a count.
  assert.deepEqual(returns([row('BUY', 100, 15, '2026-10-01T00:00:00Z'), row('SELL', 100, 12, '2026-10-01T00:00:00Z')]), [-0.2]);
  // The same rows in the other input order give the same figure (F3-5: buy first at one instant).
  assert.deepEqual(returns([row('SELL', 100, 12, '2026-10-01T00:00:00Z'), row('BUY', 100, 15, '2026-10-01T00:00:00Z')]), [-0.2]);
});

test('C4-1 probe: the same rows with intraday stamps follow the clock (short counted)', () => {
  const m = matchTrades([row('SELL', 100, 15, '2026-10-01T14:00:00Z'), row('BUY', 100, 14, '2026-10-01T15:00:00Z')]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excluded, 1);
});

test('C4-1 with evidence: pre-history shares sold and rebought on one date after an earlier oversell publish no day trade', () => {
  const m = matchTrades([row('SELL', 10, 12, '2026-09-01T14:00:00Z'), row('SELL', 100, 15, '2026-10-01T00:00:00Z'), row('BUY', 100, 14, '2026-10-01T00:00:00Z'), row('SELL', 100, 18, '2026-10-09T00:00:00Z')]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excluded, 3);
});

test('C4-1 with evidence: an unknown ledger (an unusable row with no units) counts a same-instant round trip', () => {
  const bad = { externalId: 'u1', accountId: 'acc1', symbol: 'FAKE', executedAt: new Date('2026-09-01T00:00:00Z'), kind: 'unpriceable', reason: 'trade', side: 'BUY' } as const;
  const m = matchTrades([row('BUY', 100, 14, '2026-10-01T00:00:00Z'), row('SELL', 100, 15, '2026-10-01T00:00:00Z')], [bad]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excludedCorporate, 1);
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

test('C4-2: consuming the cover would publish a wrong figure under the earlier-history reading; the sell is counted', () => {
  // 100 shares from before the history; SELL 100 @15 (counted); BUY 100 @10; BUY 100 @20; SELL 100 @22.
  // Earlier history: the last sell draws the @10 lot (+120%). A short: the @10 buy covered, +10%. Neither is published.
  const m = matchTrades([row('SELL', 100, 15, '2026-10-01T14:00:00Z'), row('BUY', 100, 10, '2026-10-02T14:00:00Z'), row('BUY', 100, 20, '2026-10-03T14:00:00Z'), row('SELL', 100, 22, '2026-10-04T14:00:00Z')]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excluded, 2);
});

test('C4-2 (business lead, round 1): tainting only the next k units still publishes +65%; every later sell is counted', () => {
  // Nothing older held. SELL 100 @15 (counted); BUY 100 @10; BUY 100 @20; BUY 100 @30; SELL 100 @22; SELL 100 @33.
  // Earlier history: the sells draw @10 and @20 (+120%, +65%). A short: @10 covered, they draw @20 and @30 (+10%, +10%).
  const m = matchTrades([
    row('SELL', 100, 15, '2026-10-01T14:00:00Z'), row('BUY', 100, 10, '2026-10-02T14:00:00Z'), row('BUY', 100, 20, '2026-10-03T14:00:00Z'),
    row('BUY', 100, 30, '2026-10-04T14:00:00Z'), row('SELL', 100, 22, '2026-10-05T14:00:00Z'), row('SELL', 100, 33, '2026-10-06T14:00:00Z'),
  ]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excluded, 3);
});

test('C4-2 (round 4): after a gap no sale size brings a sell back, wins and losses alike (no steering by sizing)', () => {
  for (const [first, price] of [[100, 12], [190, 12], [100, 8], [200, 8]] as const) {
    const m = matchTrades([row('SELL', 10, 15, '2026-10-01T14:00:00Z'), row('BUY', 300, 10, '2026-10-02T14:00:00Z'), row('SELL', first, price, '2026-10-03T14:00:00Z')]);
    assert.deepEqual([m.trades.length, m.excluded], [0, 2], `${first} @${price}`);
  }
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

test('C4-2 (F-28 probe B): the gap follows a rename, so the later trip in the new symbol is not priced from the cover', () => {
  const rename = { externalId: 'rn', accountId: 'acc1', symbol: 'FAKE', executedAt: new Date('2026-10-02T00:00:00Z'), kind: 'symbol-change', newSymbol: 'TEST', outUnits: 100, inUnits: 100 } as const;
  const m = matchTrades([
    row('SELL', 100, 15, '2026-10-01T14:00:00Z'), // gap in FAKE
    row('BUY', 100, 14, '2026-10-03T14:00:00Z', { symbol: 'TEST' }), row('BUY', 100, 20, '2026-10-04T14:00:00Z', { symbol: 'TEST' }),
    row('SELL', 100, 18, '2026-10-05T14:00:00Z', { symbol: 'TEST' }),
  ], [rename]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excluded + m.excludedCorporate, 2);
});

test('C4-2: a plain buy-sell history is unchanged', () => {
  assert.deepEqual(returns([row('BUY', 100, 10, '2026-10-01T00:00:00Z'), row('SELL', 100, 11, '2026-10-02T00:00:00Z'), row('BUY', 50, 20, '2026-10-03T14:00:00Z'), row('SELL', 50, 18, '2026-10-04T14:00:00Z')]), [0.1, -0.1]);
});

test('C4-1 (reliability, round 1): after a cover, a later sell is counted (+25% not published)', () => {
  const m = matchTrades([
    row('SELL', 100, 15, '2026-10-01T14:00:00Z'), row('BUY', 100, 14, '2026-10-02T14:00:00Z'), row('BUY', 100, 20, '2026-10-03T14:00:00Z'),
    row('SELL', 100, 18, '2026-10-04T14:00:00Z'), row('SELL', 100, 25, '2026-10-05T14:00:00Z'),
  ]);
  assert.deepEqual(m.trades, []);
  assert.equal(m.excluded, 3);
});

test('engineer, round 1: rows on one side at one instant are matched in vendor-id order, so the input order changes nothing', () => {
  // P1: two date-only buys on one date (100 @10, 100 @12), then SELL 100 @15: +50% or +25% by input order on main.
  const b1 = row('BUY', 100, 10, '2026-10-01T00:00:00Z', { externalId: 'id-a' }), b2 = row('BUY', 100, 12, '2026-10-01T00:00:00Z', { externalId: 'id-b' });
  const s = row('SELL', 100, 15, '2026-10-05T14:00:00Z');
  assert.deepEqual(returns([b1, b2, s]), returns([b2, b1, s]));
  // P2: two sells of 100 on one date over lots @10 and @12.
  const lots = [row('BUY', 100, 10, '2026-09-01T14:00:00Z'), row('BUY', 100, 12, '2026-09-02T14:00:00Z')];
  const s1 = row('SELL', 100, 13, '2026-10-01T00:00:00Z', { externalId: 'id-c' }), s2 = row('SELL', 100, 14, '2026-10-01T00:00:00Z', { externalId: 'id-d' });
  const out = (rows: Activity[]) => matchTrades(rows).trades.map((t) => [t.sellId, +t.returnPct.toFixed(6)]).sort();
  assert.deepEqual(out([...lots, s1, s2]), out([...lots, s2, s1]));
});

test('engineer, round 1: shares a rename names that the ledger lacks are drawn first in the new symbol (counted), not skipped', () => {
  const rename = { externalId: 'rn', accountId: 'acc1', symbol: 'FAKE', executedAt: new Date('2026-10-01T00:00:00Z'), kind: 'symbol-change', newSymbol: 'TEST', outUnits: 100, inUnits: 100 } as const;
  const rows = [row('BUY', 100, 10, '2026-10-02T14:00:00Z', { symbol: 'TEST' }), row('SELL', 100, 11, '2026-10-03T14:00:00Z', { symbol: 'TEST' }), row('SELL', 100, 12, '2026-10-04T14:00:00Z', { symbol: 'TEST' })];
  const m = matchTrades(rows, [rename]);
  // FIFO: the 100 renamed shares (no recorded basis) go first, so the @11 sell is counted; the @12 sell draws the @10 buy.
  assert.deepEqual([m.trades.map((t) => +t.returnPct.toFixed(6)), m.excludedCorporate], [[0.2], 1]);
});

test('code review: a date-only buy opened in the late-posting window before a split is counted, not priced', () => {
  const split = { externalId: 'sp', accountId: 'acc1', symbol: 'FAKE', executedAt: new Date('2026-03-02T00:00:00Z'), kind: 'split', ratio: { p: 2, q: 1 } } as const;
  const rows = [row('BUY', 100, 10, '2026-03-01T00:00:00Z'), row('SELL', 50, 6, '2026-03-02T06:00:00Z'), row('SELL', 50, 6, '2026-04-20T15:00:00Z')];
  for (const input of [rows, [...rows].reverse()]) {
    const m = matchTrades(input, [split]);
    assert.deepEqual(m.trades, []);
    assert.equal(m.excluded + m.excludedCorporate, 2);
  }
});
