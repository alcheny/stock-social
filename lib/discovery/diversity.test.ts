// F-2 PR-1 (criterion 6): in any 10 consecutive feed cards no trader or symbol appears more than twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diversify, fits, FEED_CAPS, worstWindow } from './diversity.ts';

const card = (key: string, trader: number, symbol: string) => ({ key, trader, symbol });

test('caps are the feature file\'s: 10-card window, at most 2 per trader and 2 per symbol', () => {
  assert.deepEqual(FEED_CAPS, { window: 10, maxPerTrader: 2, maxPerSymbol: 2 });
});

test('fits looks back 9 cards: a third card of one trader or symbol is refused inside the window, allowed after it', () => {
  const placed = [card('a', 1, 'AAA'), card('b', 1, 'BBB')];
  assert.equal(fits(placed, card('c', 1, 'CCC')), false, 'third card of trader 1');
  assert.equal(fits(placed, card('c', 2, 'AAA')), true, 'second AAA');
  const sym = [card('a', 1, 'AAA'), card('b', 2, 'AAA')];
  assert.equal(fits(sym, card('c', 3, 'AAA')), false, 'third AAA');
  // 8 fillers after the two trader-1 cards: trader 1 is at positions 0 and 1, the next slot is 10, window 1..10.
  const long = [...placed, ...Array.from({ length: 8 }, (_, i) => card(`f${i}`, 10 + i, `S${i}`))];
  assert.equal(fits(long, card('c', 1, 'CCC')), true, 'position 0 has left the window');
  assert.equal(fits(long.slice(0, 9), card('c', 1, 'CCC')), false, 'slot 9: both still in the window');
});

test('diversify keeps rank order where it can, defers a capped card to the first slot it fits, never relaxes a cap', () => {
  // Trader 1 holds the top five ranks; the rest are one card per trader.
  const ranked = [
    ...Array.from({ length: 5 }, (_, i) => card(`t1-${i}`, 1, `A${i}`)),
    ...Array.from({ length: 20 }, (_, i) => card(`o${i}`, 100 + i, `B${i}`)),
  ];
  const out = diversify(ranked);
  assert.deepEqual(out.slice(0, 3).map((c) => c.key), ['t1-0', 't1-1', 'o0']);
  assert.equal(out.length, ranked.length, 'everything fits eventually');
  // Trader 1's third card goes to slot 10 (the first slot whose window no longer holds two of its cards).
  assert.equal(out.findIndex((c) => c.key === 't1-2'), 10);
  assert.ok(worstWindow(out).trader <= 2 && worstWindow(out).symbol <= 2);
});

test('when the pool cannot fill a window the list ends; it never relaxes a cap', () => {
  // Three traders: at most 6 cards can sit in any 10 (2 each), so the greedy stops at 6.
  const ranked = Array.from({ length: 30 }, (_, i) => card(`k${i}`, i % 3, `S${i}`));
  const out = diversify(ranked);
  assert.equal(out.length, 6);
  for (const c of ranked.filter((r) => !out.includes(r))) assert.equal(fits(out, c), false, 'nothing left fits');
  // Symbols too: two symbols across 20 traders → 4 cards.
  const bySym = Array.from({ length: 20 }, (_, i) => card(`s${i}`, i, i % 2 ? 'X' : 'Y'));
  assert.equal(diversify(bySym).length, 4);
});

test('worstWindow counts the most of one trader and one symbol in any 10 consecutive cards', () => {
  const list = [card('a', 1, 'X'), card('b', 1, 'Y'), card('c', 2, 'X'), card('d', 1, 'X')];
  assert.deepEqual(worstWindow(list), { trader: 3, symbol: 3 });
  const spread = Array.from({ length: 30 }, (_, i) => card(`${i}`, i % 5, `S${i % 5}`));
  assert.deepEqual(worstWindow(spread), { trader: 2, symbol: 2 });
});
