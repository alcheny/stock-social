import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outcomeSpread, spreadCaption, toSpreadPct } from './ticker.ts';

const idx = (sp: ReturnType<typeof outcomeSpread>) => sp.bins.map((b, i) => (b.count ? i : -1)).filter((i) => i >= 0);

test('spread: empty', () => {
  const sp = outcomeSpread([]);
  assert.equal(sp.n, 0);
  assert.equal(sp.bins.length, 12);
  assert.ok(sp.bins.every((b) => b.count === 0));
  assert.equal(sp.median, null);
  assert.equal(sp.min, null);
  assert.equal(sp.max, null);
});

test('spread: one trade, identical returns', () => {
  const one = outcomeSpread([3]);
  assert.deepEqual([one.n, one.up, one.median, one.min, one.max, one.bins[6].count], [1, 1, 3, 3, 3, 1]);
  assert.equal(spreadCaption(one), '1 trade: 1 up, median +3.0%, range +3% to +3%');
  assert.equal(spreadCaption(outcomeSpread([-3])), '1 trade: 1 down, median -3.0%, range -3% to -3%');
  const same = outcomeSpread([5, 5, 5, 5, 5]);
  assert.equal(same.bins[6].count, 5);
  assert.equal(same.median, 5);
  assert.equal(same.min, same.max);
});

test('spread: all losses, all wins', () => {
  const l = outcomeSpread([-1, -15, -70]);
  assert.equal(l.down, 3);
  assert.equal(l.up, 0);
  assert.ok(idx(l).every((i) => i <= 5));
  const w = outcomeSpread([1, 15, 70]);
  assert.equal(w.up, 3);
  assert.ok(idx(w).every((i) => i >= 6));
});

test('spread: mixed even count median, flat', () => {
  const sp = outcomeSpread([-10, 0, 4, 20]);
  assert.equal(sp.median, 2);
  assert.deepEqual([sp.up, sp.down, sp.flat], [2, 1, 1]);
  assert.equal(sp.bins[6].count, 2); // 0 and 4 in [0,10)
  assert.ok(spreadCaption(sp).includes('2 up, 1 down, 1 flat'));
  assert.ok(!spreadCaption(outcomeSpread([1, -1])).includes('flat'));
  assert.equal(outcomeSpread([-0]).flat, 1);
});

test('spread: bin edges are half-open', () => {
  assert.equal(outcomeSpread([-50]).bins[1].count, 1);
  assert.equal(outcomeSpread([50]).bins[11].count, 1);
  assert.equal(outcomeSpread([10]).bins[7].count, 1);
  assert.equal(outcomeSpread([0]).bins[6].count, 1);
  assert.equal(outcomeSpread([-10]).bins[5].count, 1);
  assert.equal(outcomeSpread([-0.0001]).bins[5].count, 1);
  assert.equal(outcomeSpread([-50.0001]).bins[0].count, 1);
});

test('spread: outliers stay in open bins with true min/max', () => {
  const sp = outcomeSpread([400, -62, 5]);
  assert.equal(sp.bins[11].count, 1);
  assert.equal(sp.bins[0].count, 1);
  assert.equal(sp.max, 400);
  assert.equal(sp.min, -62);
  assert.ok(spreadCaption(sp).includes('+400%'));
  assert.ok(spreadCaption(sp).includes('-62%'));
});

test('spread: counts always sum to n, input not mutated, exact caption', () => {
  for (const arr of [[1, -2, 0, 55, -80, 12.5], [0, 0, 0], [49.99, 50, -50, -50.01, 10, -10], Array.from({ length: 40 }, (_, i) => i * 7 - 100)]) {
    const copy = [...arr];
    const sp = outcomeSpread(arr);
    assert.equal(sp.bins.reduce((a, b) => a + b.count, 0), arr.length);
    assert.equal(sp.up + sp.down + sp.flat, arr.length);
    assert.deepEqual(arr, copy);
  }
  const sp = outcomeSpread([410, 0.4, 2, 2, 3, 4, 5, -62, -2, -3, -4, -5]);
  assert.equal(spreadCaption(sp), '12 trades: 7 up, 5 down, median +1.2%, range -62% to +410%');
});

test('spread: toSpreadPct converts fractions without missing edges', () => {
  assert.equal(toSpreadPct(0.3), 30);
  assert.equal(toSpreadPct(-0.1), -10);
  assert.equal(toSpreadPct(0.125), 12.5);
});
