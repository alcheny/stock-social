// The e2e shard split (scripts/e2e-shard.ts): every test lands in exactly one shard, in order, whatever the weights.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listedTests, partition, slice, testListLine, verify, WEIGHTS, DEFAULT_WEIGHT, type ListedTest } from './e2e-shard.ts';

const slices = <T>(items: T[], w: (t: T) => number, of: number) => Array.from({ length: of }, (_, i) => partition(items, w, i + 1, of));

test('e2e shards: the slices are disjoint, cover every test and keep the order, for any weights and shard count', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
  for (let round = 0; round < 200; round++) {
    const items = Array.from({ length: 1 + Math.floor(rand() * 150) }, (_, i) => ({ i, w: rand() < 0.1 ? 0 : rand() * 30 }));
    for (const n of [1, 2, 3, 4, 5, 8]) {
      const parts = slices(items, (t) => t.w, n);
      assert.deepEqual(parts.flat(), items, `round ${round}, ${n} shards`); // concatenated in shard order = the list itself
    }
  }
});

test('e2e shards: slices balance the weight, and all-zero weights still place every test once', () => {
  const items = [...Array(10).fill(10), ...Array(40).fill(1)].map((w, i) => ({ i, w }));
  const sums = slices(items, (t) => t.w, 4).map((p) => p.reduce((s, t) => s + t.w, 0));
  assert.ok(Math.max(...sums) - Math.min(...sums) <= 10, `uneven: ${sums}`); // within one test of the heaviest kind
  assert.deepEqual(slices(items, () => 0, 3).flat(), items);
  assert.deepEqual(slices([], () => 1, 3), [[], [], []]);
});

test('e2e shards: a bad shard number fails instead of running nothing', () => {
  for (const [s, of] of [[0, 4], [5, 4], [1, 0], [1.5, 4], [NaN, 4]]) assert.throws(() => partition([1], () => 1, s, of), /bad shard/);
});

test('e2e shards: tests come from the list JSON in file order, with describe titles, and become --test-list lines', () => {
  const json = { suites: [
    { title: 'a.spec.ts', file: 'a.spec.ts', specs: [{ title: 'one', file: 'a.spec.ts' }],
      suites: [{ title: 'group', file: 'a.spec.ts', specs: [{ title: 'two', file: 'a.spec.ts' }] }] },
    { title: 'b.spec.ts', file: 'b.spec.ts', specs: [{ title: 'three → 0%', file: 'b.spec.ts' }] },
  ] };
  const tests = listedTests(json);
  assert.deepEqual(tests, [{ file: 'a.spec.ts', titles: ['one'] }, { file: 'a.spec.ts', titles: ['group', 'two'] }, { file: 'b.spec.ts', titles: ['three → 0%'] }]);
  assert.deepEqual(tests.map(testListLine), ['a.spec.ts › one', 'a.spec.ts › group › two', 'b.spec.ts › three → 0%']);
  for (const bad of [['a › b'], [' padded'], [''], ['two\nlines'], ['describe', '']].map((titles) => ({ file: 'x.spec.ts', titles })) as ListedTest[]) assert.throws(() => testListLine(bad));
});

test('e2e shards: every weight is positive and keyed by a file name relative to e2e/', () => {
  assert.ok(DEFAULT_WEIGHT > 0);
  for (const [f, w] of Object.entries(WEIGHTS)) { assert.match(f, /^[\w-]+\.spec\.ts$/); assert.ok(w > 0, f); }
});

test('e2e shards: verify flags a missing, an extra (prefix-matched) or a twice-matched test, even when counts agree', () => {
  const x = { file: 'a.spec.ts', titles: ['x'] }, xy = { file: 'a.spec.ts', titles: ['x', 'y'] }, z = { file: 'b.spec.ts', titles: ['z'] };
  assert.deepEqual(verify([x, z], [z, x]), []);
  assert.deepEqual(verify([x, z], [x, xy]), ['missing ["b.spec.ts","z"]', 'extra ["a.spec.ts","x","y"]']); // same count, wrong tests
  assert.deepEqual(verify([x, x], [x, x]), ['a test matched twice']);
});

test('e2e shards: slice covers the list across shards and refuses an empty list', () => {
  const tests = Array.from({ length: 30 }, (_, i) => ({ file: i < 20 ? 'connect.spec.ts' : 'new.spec.ts', titles: [`t${i}`] }));
  for (const n of [1, 3, 4]) assert.deepEqual(Array.from({ length: n }, (_, i) => slice(tests, i + 1, n)).flat(), tests);
  assert.throws(() => slice([], 1, 4), /no tests listed/);
});
