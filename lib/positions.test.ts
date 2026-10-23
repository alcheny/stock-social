// Reviewer fix (PR-2a, finding 5): open positions are listed per account and symbol, never merged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionRows } from './positions.ts';

test('positionRows: one symbol in two accounts gives two rows with distinct keys and account labels; a single holding has none', () => {
  const rows = positionRows([
    { accountId: 'acc-b', symbol: 'QQQ', pct: 0.12 },
    { accountId: 'acc-a', symbol: 'QQQ', pct: 0.1 },
    { accountId: 'acc-a', symbol: 'AAA', pct: -0.05 },
  ]);
  assert.deepEqual(rows, [
    { key: 'AAA:1', symbol: 'AAA', pct: -0.05, account: null },
    { key: 'QQQ:1', symbol: 'QQQ', pct: 0.1, account: 1 },
    { key: 'QQQ:2', symbol: 'QQQ', pct: 0.12, account: 2 },
  ]);
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  // No vendor account id reaches a row.
  assert.ok(rows.every((r) => !JSON.stringify(r).includes('acc-')));
  assert.deepEqual(positionRows([]), []);
});
