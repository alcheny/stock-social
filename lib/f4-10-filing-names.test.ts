// F4-10 (cycle 4, C4-14; WCAG 2.5.3, 2.4.4): the trade page's filing links' accessible names start with their visible
// words (minus the arrow glyph), and purchase links are told apart when a sale closes more than one purchase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC } from './copy.ts';

const visible = (s: string) => s.replace(/\s*↗\s*$/, '');

test('F4-10: each filing link name starts with its visible text, names the symbol and says it opens another site', () => {
  const bought = PUBLIC.boughtNameOf('ZQXA', 1, 1);
  const sold = PUBLIC.soldNameOn('ZQXA', 'Mar 4, 2024');
  assert.equal(bought, 'Bought: filing for the ZQXA purchase, opens another site');
  assert.equal(sold, 'Sold: filing for the ZQXA sale closed Mar 4, 2024, opens another site');
  for (const [name, label] of [[bought, PUBLIC.bought], [sold, PUBLIC.sold]]) {
    assert.ok(name.startsWith(visible(label)), `${name} starts with ${visible(label)}`);
    assert.match(name, /ZQXA/);
    assert.match(name, /, opens another site$/);
  }
});

test('F4-10: with two or more purchase filings each name is distinct ("filing 1 of 2"), and still starts with the visible text', () => {
  const names = [1, 2, 3].map((i) => PUBLIC.boughtNameOf('ZQXA', i, 3));
  assert.equal(new Set(names).size, 3);
  assert.equal(names[1], 'Bought: filing 2 of 3 for the ZQXA purchase, opens another site');
  for (const n of names) assert.ok(n.startsWith(visible(PUBLIC.bought)));
});

test('F4-10: the trade page names each purchase link by its place and the sale link by its close date', () => {
  const src = readFileSync(new URL('../app/u/[handle]/trade/[sellId]/page.tsx', import.meta.url), 'utf8');
  assert.match(src, /bought\.map\(\(u, i, all\) =>[^\n]*aria-label=\{PUBLIC\.boughtNameOf\(t\.symbol, i \+ 1, all\.length\)\}/);
  assert.match(src, /aria-label=\{PUBLIC\.soldNameOn\(t\.symbol, closed\)\}/);
  assert.doesNotMatch(src, /PUBLIC\.boughtName\(|PUBLIC\.soldName\(/);
});
