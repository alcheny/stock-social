// Fix #1: demo data is never called verified on the stock pages or the stock image; one state name, "Demo".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STOCK_LABELS, tradesWord } from './stock-labels.ts';

const demo = { demoOnly: true, mixed: false };
const mixed = { demoOnly: false, mixed: true };
const real = { demoOnly: false, mixed: false };

test('only an all-verified set is called verified', () => {
  assert.equal(tradesWord(real), 'verified closed trades');
  assert.equal(tradesWord(demo), 'closed trades');
  assert.equal(tradesWord(mixed), 'closed trades');
  assert.equal(tradesWord(null), 'closed trades');
  assert.equal(STOCK_LABELS.title('NVDA', real), 'NVDA verified trades · Stock Social');
  assert.equal(STOCK_LABELS.title('NVDA', demo), 'NVDA demo trades · Stock Social');
  assert.equal(STOCK_LABELS.title('NVDA', mixed), 'NVDA closed trades · Stock Social');
  assert.equal(STOCK_LABELS.title('NVDA', null), 'NVDA closed trades · Stock Social');
  assert.equal(STOCK_LABELS.imageStatus(demo), 'Demo data');
  assert.equal(STOCK_LABELS.imageStatus(mixed), 'Includes demo data');
  assert.equal(STOCK_LABELS.imageStatus(real), 'Verified from broker');
  assert.equal(STOCK_LABELS.suffix(demo), ' Demo data.');
  assert.equal(STOCK_LABELS.suffix(real), '');
});

test('state-free strings never say verified, and nothing says "sample data"', () => {
  const free = [STOCK_LABELS.explainer, STOCK_LABELS.demoNote, STOCK_LABELS.mixedNote, STOCK_LABELS.pageDemoNote, STOCK_LABELS.pageMixedNote,
    STOCK_LABELS.empty('X'), STOCK_LABELS.imageAlt, STOCK_LABELS.imageNeutralLine, STOCK_LABELS.imageNeutralFooter, STOCK_LABELS.imageEmpty];
  for (const s of free) assert.doesNotMatch(s, /verified/i, s);
  for (const s of free) assert.doesNotMatch(s, /sample data/i, s);
});

// Every stock surface reads its state words from here: no literal "verified" or "sample data" in their copy.
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
test('stock pages, compare, the index and the stock image carry no literal verified/sample-data copy', () => {
  const root = new URL('../app/t/', import.meta.url).pathname;
  for (const f of walk(root).filter((p) => p.endsWith('.tsx'))) {
    const src = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*)/.test(l)).join('\n');
    // Strings only: quoted or JSX text. Identifiers (verified, verifiedTrades) and comments are allowed.
    const copy = [...src.matchAll(/'([^'\n]*)'|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3]);
    for (const s of copy) {
      assert.doesNotMatch(s, /sample data/i, `${f}: ${s}`);
      assert.doesNotMatch(s, /\bverified (closed )?trad/i, `${f}: ${s}`);
    }
  }
});
