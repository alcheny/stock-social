import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byListOrder, CLOSES_PAGE, closesWindow, packPoints, tradeHref, unpackPoints, windowOf } from './paging.ts';

test('windows of 50, newest first; the default is the newest 50', () => {
  assert.equal(CLOSES_PAGE, 50);
  assert.deepEqual(closesWindow(undefined, 2828), { start: 0, end: 50, total: 2828, shown: 50, next: 100, prev: null });
  assert.deepEqual(closesWindow('100', 2828), { start: 50, end: 100, total: 2828, shown: 50, next: 150, prev: 50 });
  // The last window holds the oldest close: 2,828 = 56 × 50 + 28.
  assert.deepEqual(closesWindow('2850', 2828), { start: 2800, end: 2850, total: 2828, shown: 28, next: null, prev: 2800 });
});

test('the parameter is rounded up to a window and clamped to the record; junk is the first window', () => {
  assert.equal(closesWindow('73', 2828).end, 100);
  assert.equal(closesWindow('999999', 2828).end, 2850);
  for (const junk of ['0', '-50', 'abc', '', 'Infinity', 'NaN']) assert.equal(closesWindow(junk, 2828).end, 50, junk);
  assert.equal(closesWindow(['100', '150'], 2828).end, 100);
  assert.deepEqual(closesWindow('100', 0), { start: 0, end: 50, total: 0, shown: 0, next: null, prev: null });
  assert.deepEqual(closesWindow(undefined, 50), { start: 0, end: 50, total: 50, shown: 50, next: null, prev: null });
  assert.equal(closesWindow(undefined, 51).next, 100);
});

test('every row is in exactly one window, and walking "Show 50 more" from the first window reaches the oldest close', () => {
  const total = 2828;
  const seen: number[] = [];
  for (let w: number | null = closesWindow(undefined, total).end; w !== null; w = closesWindow(String(w), total).next) {
    const x = closesWindow(String(w), total);
    for (let i = x.start; i < x.start + x.shown; i++) seen.push(i);
  }
  assert.deepEqual(seen, Array.from({ length: total }, (_, i) => i));
  for (const i of [0, 49, 50, 99, 2827]) {
    const x = closesWindow(String(windowOf(i)), total);
    assert.ok(i >= x.start && i < x.start + x.shown, `row ${i} is rendered by its window`);
  }
});

test('list order is total: newest first, ties by the larger numeric id', () => {
  const at = new Date('2026-01-01T00:00:00Z');
  const rows = [{ id: '9', closedAt: at }, { id: '10', closedAt: at }, { id: '11', closedAt: new Date('2025-01-01') }, { id: '8', closedAt: at }];
  assert.deepEqual([...rows].sort(byListOrder).map((r) => r.id), ['10', '9', '8', '11']);
});

test('chart links: the anchor alone on the window already shown, else the window and the anchor', () => {
  assert.equal(tradeHref('', '7', 0, 50), '#trade-7');
  assert.equal(tradeHref('', '7', 60, 50), '?closes=100#trade-7');
  assert.equal(tradeHref('', '7', 60, 100), '#trade-7');
  assert.equal(tradeHref('/u/x', '7', 3), '/u/x?closes=50#trade-7');
});

test('packed points round-trip in list order with their row index; size stays small', () => {
  const t = (id: string, day: number, r: number) => ({ id, symbol: 'AAA', returnPct: r, closedAt: new Date(Date.UTC(2024, 0, day)), holdingDays: 1.234567, thesis: null });
  const packed = packPoints([t('1', 1, 0.123456789123), t('2', 3, -0.05), t('3', 2, 0)]);
  const back = unpackPoints(packed);
  assert.deepEqual(back.map((p) => [p.id, p.index]), [['2', 0], ['3', 1], ['1', 2]]);
  assert.equal(back[2].returnPct, 0.12345679);
  assert.equal(back[2].holdingDays, 1.23);
  assert.equal(back[0].closedAt.toISOString(), '2024-01-03T00:00:00.000Z');
  assert.ok(JSON.stringify(packed).length / packed.length < 60);
});
