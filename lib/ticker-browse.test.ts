import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterTickerIndex, relatedSymbols } from './ticker.ts';

const idx = (symbol: string) => ({ symbol, trades: 1, traders: 1, lastClosedAt: new Date(0), demoOnly: false });
const rel = (symbol: string, userId: number, verified = true) => ({ symbol, userId, verified });

test('relatedSymbols: empty, single trader hidden, own symbol dropped', () => {
  assert.deepEqual(relatedSymbols([], 'NVDA'), []);
  assert.deepEqual(relatedSymbols([rel('AMD', 1), rel('MU', 1)], 'NVDA'), []);
  assert.deepEqual(relatedSymbols([rel('NVDA', 1), rel('NVDA', 2)], 'NVDA'), []);
});

test('relatedSymbols: counts, ordering, ties, demo flag, no return keys', () => {
  const out = relatedSymbols([rel('AMD', 1), rel('AMD', 2), rel('MU', 1), rel('MU', 1), rel('MU', 1), rel('ARM', 2), rel('KO', 2, false)], 'NVDA');
  assert.deepEqual(out.map((r) => r.symbol), ['AMD', 'ARM', 'KO', 'MU']);
  assert.deepEqual(out[0], { symbol: 'AMD', traders: 2, trades: 2, demoOnly: false });
  assert.equal(out[3].trades, 3);
  assert.equal(out[2].demoOnly, true);
  assert.deepEqual(Object.keys(out[0]).sort(), ['demoOnly', 'symbol', 'traders', 'trades']);
});

test('relatedSymbols: capped at 8', () => {
  const rows = Array.from({ length: 12 }, (_, i) => [rel('S' + String.fromCharCode(65 + i), 1), rel('S' + String.fromCharCode(65 + i), 2)]).flat();
  assert.equal(relatedSymbols(rows, 'NVDA').length, 8);
});

test('filterTickerIndex: all, exact, prefix, none', () => {
  const rows = [idx('NVDA'), idx('NVAX'), idx('BRK.B')];
  for (const q of [undefined, '', '  ', 5]) assert.equal(filterTickerIndex(rows, q).kind, 'all');
  const e = filterTickerIndex(rows, 'nvda');
  assert.equal(e.kind, 'exact');
  assert.equal(e.symbol, 'NVDA');
  assert.equal(filterTickerIndex(rows, 'brk.b').kind, 'exact');
  const p = filterTickerIndex(rows, '  nv  ');
  assert.equal(p.kind, 'prefix');
  assert.deepEqual(p.rows.map((r) => r.symbol), ['NVDA', 'NVAX']);
  assert.equal(filterTickerIndex(rows, 'ZZZ').kind, 'none');
});

test('filterTickerIndex: hostile input is invalid', () => {
  const rows = [idx('NVDA')];
  for (const q of ['%', '_', 'NV%', 'a b', 'x'.repeat(500)]) {
    const r = filterTickerIndex(rows, q);
    assert.equal(r.kind, 'invalid');
    assert.deepEqual(r.rows, []);
  }
});
