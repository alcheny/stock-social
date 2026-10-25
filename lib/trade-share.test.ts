import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tradeSharePayload, type TradeShareInput } from './trade-share.ts';

const TODAY = new Date('2026-06-01T00:00:00Z');
const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));
const mk = (i: number, ret = 0.05) => ({ symbol: `S${i}`, openedAt: day(i * 5), closedAt: day(i * 5 + 3), returnPct: ret, holdingDays: 3 });
const input = (over: Partial<TradeShareInput> = {}, n = 12): TradeShareInput => ({
  symbol: 'AAPL', returnPct: 0.1, holdingDays: 3, closedAt: day(3), thesis: 'because', thesisStatus: 'published', demo: false,
  allTrades: Array.from({ length: n }, (_, i) => mk(i)), ...over,
});

test('loss and gain give the same key set and no sign-derived fields', () => {
  const gain = tradeSharePayload(input({ returnPct: 0.1 }), TODAY);
  const loss = tradeSharePayload(input({ returnPct: -0.1 }), TODAY);
  assert.deepEqual(Object.keys(gain), Object.keys(loss));
  assert.deepEqual(Object.keys(gain.record), Object.keys(loss.record));
  for (const k of ['up', 'down', 'sign', 'color', 'quantity', 'price']) assert.ok(!(k in gain), k);
});

test('thesis only when published', () => {
  assert.equal(tradeSharePayload(input({ thesisStatus: 'held' }), TODAY).thesis, null);
  assert.equal(tradeSharePayload(input({ thesisStatus: null }), TODAY).thesis, null);
  assert.equal(tradeSharePayload(input({ thesisStatus: 'rejected' }), TODAY).thesis, null);
  assert.equal(tradeSharePayload(input({ thesis: null }), TODAY).thesis, null);
  assert.equal(tradeSharePayload(input(), TODAY).thesis, 'because');
});

test('demo flag follows the trader', () => {
  assert.equal(tradeSharePayload(input({ demo: true }), TODAY).demo, true);
  assert.equal(tradeSharePayload(input({ demo: false }), TODAY).demo, false);
});

test('record is always present and counts every trade, even for a single-trade trader', () => {
  const one = tradeSharePayload(input({}, 1), TODAY);
  assert.equal(one.record.trades, 1);
  assert.equal(one.newRecord, true);
  assert.equal(tradeSharePayload(input({}, 12), TODAY).record.trades, 12);
});

test('newRecord: fewer than 10 trades, or under 30 days', () => {
  assert.equal(tradeSharePayload(input({}, 9), TODAY).newRecord, true);
  assert.equal(tradeSharePayload(input({}, 10), TODAY).newRecord, false);
  assert.equal(tradeSharePayload(input({}, 10), new Date('2026-01-20T00:00:00Z')).newRecord, true);
});

// F-4 PR-1 fix round 1 (UX lead D1): the "wide uncertainty" sentence follows the TR-9 state, not the closed count.
test('D1: record.tooEarly is the TR-9 too-early state (5 narrow bets: no; 4 bets or a wide record: yes)', () => {
  assert.equal(tradeSharePayload(input({}, 5), TODAY).record.tooEarly, false);
  assert.equal(tradeSharePayload(input({}, 4), TODAY).record.tooEarly, true);
  const wide = Array.from({ length: 8 }, (_, i) => mk(i, i % 2 ? 0.4 : -0.3));
  assert.equal(tradeSharePayload(input({ allTrades: wide }), TODAY).record.tooEarly, true);
});
