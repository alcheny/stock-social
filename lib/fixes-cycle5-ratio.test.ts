// FIXES-CYCLE5 (F5-11, C5-21): a ratio below 1 never prints "1.00"; ratios are cut to two decimals, never rounded up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cut2 } from './format.ts';

test('F5-11: cut2 cuts down to two decimals (the plan\'s table)', () => {
  const table: [number, string][] = [[0.997, '0.99'], [0.9999, '0.99'], [1.003, '1.00'], [1.009, '1.00'], [0.29, '0.29'], [2.5, '2.50'], [2.999, '2.99'],
    [1, '1.00'], [0, '0.00'], [0.1 + 0.2, '0.30'], [1.15, '1.15'], [12.345, '12.34']];
  for (const [x, s] of table) assert.equal(cut2(x), s, String(x));
  // Never above the value, and never more than a cent below it.
  for (let i = 0; i < 2000; i++) {
    const x = i / 997;
    const v = Number(cut2(x));
    assert.ok(v <= x + 1e-9 && x - v < 0.01, `${x} -> ${v}`);
  }
});

test('F5-11: the profile\'s profit factor prints through cut2, and "—" when there is no ratio', () => {
  const s = readFileSync(new URL('../app/u/[handle]/page.tsx', import.meta.url), 'utf8');
  assert.match(s, /<b>\{s\.profitFactor === null \? '—' : cut2\(s\.profitFactor\)\}<\/b><small>profit factor<\/small>/);
  assert.doesNotMatch(s, /profitFactor\.toFixed/);
});
