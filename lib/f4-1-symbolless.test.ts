// Fixes cycle 4, F4-1 (docs/direction/cycle4-2026-11-01.md, C4-6): a vendor BUY/SELL with an id but no symbol is stored
// as an account-wide unusable trade row and counted, never dropped and never priced. Fictional rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toActivities, toOptionRows } from './broker.ts';
import { actionIndex, actionsFor, pairKey, type CorporateAction } from './corporate-actions.ts';
import { matchTrades, type Activity } from './trades.ts';

const row = (id: string, side: 'BUY' | 'SELL', units: number, price: number, at: string, symbol = 'FAKE', accountId = 'acc'): Activity =>
  ({ externalId: id, accountId, symbol, side, units, price, fee: 0, executedAt: new Date(at), verified: true });
const noSymbol = (id: string, side: 'BUY' | 'SELL', units: number, price: number, at: string, accountId = 'acc') =>
  toActivities(accountId, [{ id, symbol: null, type: side, trade_date: at, price, units: side === 'SELL' ? -units : units, fee: 0 }]).unusable[0] as CorporateAction;

test('F4-1: toActivities stores a BUY/SELL with an id and no symbol as an account-wide unusable row; option rows stay option rows', () => {
  const base = { type: 'SELL', trade_date: '2026-04-05', price: 15, units: -100, fee: 0 };
  const rows = [
    { ...base, id: 'ns1', symbol: null },
    { ...base, id: 'ns2', symbol: { symbol: '' }, type: 'BUY', units: 100 },
    { ...base, id: 'ns3' }, // no symbol field at all
    { ...base, id: 'ns4', symbol: null, price: 0, trade_date: null }, // unusable twice over: still one row
    { ...base, id: 'opt1', symbol: null, option_type: 'SELL_TO_CLOSE' }, // an option row with no symbol
    { ...base, id: 'opt2', symbol: null, option_symbol: { id: 'x' } },
    { ...base, id: 'div', symbol: null, type: 'DIVIDEND' }, // not a trade
    { ...base, id: undefined, symbol: null }, // no id: nothing to store
  ];
  const { activities, unusable } = toActivities('acc', rows as never);
  assert.deepEqual(activities, []);
  assert.deepEqual(unusable.map((a) => a.externalId), ['ns1', 'ns2', 'ns3', 'ns4']);
  for (const a of unusable) {
    assert.ok(a.kind === 'unpriceable' && a.reason === 'trade');
    assert.deepEqual([a.symbol, a.accountId, (a as { scope?: string }).scope], ['', 'acc', 'account']);
    assert.ok(a.raw);
  }
  const by = new Map(unusable.map((a) => [a.externalId, a as unknown as { side: string; units?: number; undated?: boolean }]));
  assert.deepEqual([by.get('ns1')!.side, by.get('ns1')!.units, by.get('ns1')!.undated], ['SELL', 100, undefined]);
  assert.deepEqual([by.get('ns2')!.side, by.get('ns2')!.units], ['BUY', 100]);
  assert.equal(by.get('ns4')!.undated, true);
  assert.deepEqual(toOptionRows('acc', rows as never).map((r) => r.externalId), ['opt1', 'opt2']);
  // A row with a symbol and a usable price is still an activity, never account-wide.
  const ok = toActivities('acc', [{ ...base, id: 'ok', symbol: { symbol: 'FAKE' } }]);
  assert.deepEqual([ok.activities.map((a) => a.externalId), ok.unusable], [['ok'], []]);
});

test('F4-1 probe: BUY 100 @10, SELL 100 @15 with no symbol, BUY 100 @20, SELL 100 @18 no longer publishes +80%: the symbol-less sell is counted, nothing wrong is shown', () => {
  const acts = [row('b1', 'BUY', 100, 10, '2026-04-01T14:00:00Z'), row('b2', 'BUY', 100, 20, '2026-04-08T14:00:00Z'), row('s2', 'SELL', 100, 18, '2026-04-10T14:00:00Z')];
  const before = matchTrades(acts); // what dropping the row published
  assert.deepEqual(before.trades.map((t) => +t.returnPct.toFixed(3)), [0.8]);
  const m = matchTrades(acts, [noSymbol('s1', 'SELL', 100, 15, '2026-04-05T14:00:00Z')]);
  assert.deepEqual(m.trades, []);
  assert.deepEqual([m.excluded, m.excludedCorporate], [0, 2]); // the symbol-less sell and the sell drawing its tainted lot
});

test('F4-1: after a symbol-less sell, a pair holding lots has an unknown ledger: no later sell of it is priced from shifted FIFO lots', () => {
  // The symbol-less sell really sold 50 of FAKE; read without it, the second sell would draw lots 2 and 3 at a mixed basis.
  const acts = [row('b1', 'BUY', 100, 10, '2026-04-01T14:00:00Z'), row('b2', 'BUY', 100, 20, '2026-04-08T14:00:00Z'), row('b3', 'BUY', 100, 30, '2026-04-09T14:00:00Z'),
    row('s2', 'SELL', 150, 25, '2026-04-10T14:00:00Z'), row('s3', 'SELL', 100, 33, '2026-04-11T14:00:00Z'), row('s4', 'SELL', 100, 40, '2026-04-12T14:00:00Z')];
  const m = matchTrades(acts, [noSymbol('s1', 'SELL', 50, 15, '2026-04-05T14:00:00Z')]);
  assert.deepEqual(m.trades, []);
  assert.deepEqual([m.excluded, m.excludedCorporate], [0, 4]); // s1, s2, s3 counted; s4 oversells an unknown ledger: corporate
});

test('F4-1: a symbol-less sell leaves a pair holding nothing as it was; a symbol-less buy makes the whole account unknown', () => {
  const acts = [row('b1', 'BUY', 100, 10, '2026-04-01T14:00:00Z'), row('yb', 'BUY', 10, 10, '2026-04-06T14:00:00Z', 'OTHR'), row('ys', 'SELL', 10, 12, '2026-04-07T14:00:00Z', 'OTHR'),
    row('zb', 'BUY', 10, 10, '2026-04-06T14:00:00Z', 'ZZZ', 'acc2'), row('zs', 'SELL', 10, 11, '2026-04-07T14:00:00Z', 'ZZZ', 'acc2')];
  const sold = matchTrades(acts, [noSymbol('s1', 'SELL', 100, 15, '2026-04-05T14:00:00Z')]);
  assert.deepEqual(sold.trades.map((t) => [t.sellId, +t.returnPct.toFixed(3)]), [['ys', 0.2], ['zs', 0.1]]);
  assert.equal(sold.excludedCorporate, 1);
  const bought = matchTrades(acts, [noSymbol('n1', 'BUY', 5, 15, '2026-04-05T14:00:00Z')]);
  assert.deepEqual(bought.trades.map((t) => t.sellId), ['zs']); // the other account is untouched
  assert.deepEqual([bought.excluded, bought.excludedCorporate], [0, 1]); // ys: its pair may hold the bought shares
});

test('F4-1: the rebuild\'s per-pair replay (each pair gets the account-wide rows) shows the same trades as one replay of the account', () => {
  const acts = [row('a1', 'BUY', 10, 10, '2026-04-01T14:00:00Z', 'AAA'), row('a2', 'SELL', 10, 12, '2026-04-09T14:00:00Z', 'AAA'),
    row('b1', 'BUY', 10, 10, '2026-04-06T14:00:00Z', 'BBB'), row('b2', 'SELL', 10, 13, '2026-04-09T14:00:00Z', 'BBB'),
    row('c1', 'BUY', 10, 10, '2026-04-02T14:00:00Z', 'CCC'), row('c2', 'SELL', 5, 14, '2026-04-03T14:00:00Z', 'CCC'), row('c3', 'SELL', 5, 9, '2026-04-09T14:00:00Z', 'CCC')];
  const actions = [noSymbol('s1', 'SELL', 10, 15, '2026-04-05T14:00:00Z'), noSymbol('s2', 'SELL', 3, 15, '2026-04-07T14:00:00Z')];
  const whole = matchTrades(acts, actions);
  const index = actionIndex(actions);
  const parts = ['AAA', 'BBB', 'CCC'].map((s) => {
    const keys = new Set([pairKey('acc', s)]);
    assert.deepEqual(index(keys), actionsFor(actions, keys));
    assert.equal(index(keys).length, 2); // every pair is handed both symbol-less sells
    return matchTrades(acts.filter((a) => a.symbol === s), index(keys));
  });
  assert.deepEqual(parts.flatMap((p) => p.trades).map((t) => t.sellId).sort(), whole.trades.map((t) => t.sellId).sort());
  assert.deepEqual(whole.trades.map((t) => t.sellId).sort(), ['c2']); // c2 closes before either symbol-less sell
  // Each part counts both symbol-less sells; taking those back and adding them once gives the one-replay count.
  const deduped = parts.reduce((s, p) => s + p.excludedCorporate - 2, 0) + 2;
  assert.equal(deduped, whole.excludedCorporate);
  assert.equal(whole.excludedCorporate, 5); // s1, s2, and a2, b2 (held lots at s2), c3 drawing tainted lots
});
