import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moreText, newTradesSince, type NewTradeInput } from './new-trades.ts';
import { matchTrades, type Activity } from './trades.ts';

const at = (ms: number) => new Date(Date.UTC(2026, 0, 10) + ms);
const t = (sellId: string, ms: number, returnPct = 0.05): NewTradeInput => ({ sellId, symbol: 'AAPL', returnPct, closedAt: at(ms) });

test('empty trades', () => {
  assert.deepEqual(newTradesSince([], at(0)), { shown: [], more: 0 });
});

test('first visit (null seenAt) shows nothing', () => {
  assert.deepEqual(newTradesSince([t('a', 5)], null), { shown: [], more: 0 });
});

test('closedAt == seenAt is not new; 1 ms later is', () => {
  assert.equal(newTradesSince([t('a', 0)], at(0)).shown.length, 0);
  assert.equal(newTradesSince([t('a', 1)], at(0)).shown.length, 1);
});

test('cap of 3 newest first with remainder text', () => {
  const input = [1, 2, 3, 4, 5].map((i) => t(`s${i}`, i));
  const copy = structuredClone(input);
  const r = newTradesSince(input, at(0));
  assert.deepEqual(r.shown.map((x) => x.sellId), ['s5', 's4', 's3']);
  assert.equal(r.more, 2);
  assert.deepEqual(input, copy); // not mutated
  assert.equal(moreText(2), 'and 2 more closed trades');
  assert.equal(moreText(1), 'and 1 more closed trade');
  assert.equal(moreText(0), null);
});

test('result is unchanged after a simulated rebuildTrades; ties order by sellId only', () => {
  const day = (d: number) => new Date(Date.UTC(2026, 0, d));
  const acts = (): Activity[] => [
    { externalId: 'b1', accountId: 'x', symbol: 'AAPL', side: 'BUY', units: 1, price: 10, fee: 0, executedAt: day(1), verified: true },
    { externalId: 'b2', accountId: 'x', symbol: 'MSFT', side: 'BUY', units: 1, price: 10, fee: 0, executedAt: day(1), verified: true },
    { externalId: 'sB', accountId: 'x', symbol: 'AAPL', side: 'SELL', units: 1, price: 8, fee: 0, executedAt: day(5), verified: true }, // loss
    { externalId: 'sA', accountId: 'x', symbol: 'MSFT', side: 'SELL', units: 1, price: 12, fee: 0, executedAt: day(5), verified: true }, // gain, same time
  ];
  const run = () => newTradesSince(matchTrades(acts()).trades.map((x) => ({ sellId: x.sellId, symbol: x.symbol, returnPct: x.returnPct, closedAt: x.closedAt })), day(2));
  const first = run();
  assert.deepEqual(run(), first);
  assert.deepEqual(first.shown.map((x) => x.sellId), ['sA', 'sB']);
});
