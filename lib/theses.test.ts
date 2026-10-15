import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reattachTheses, type KeptThesis } from './theses.ts';

const k = (sell_id: string, thesis = 't-' + sell_id, thesis_status: string | null = 'published'): KeptThesis => ({ sell_id, thesis, thesis_status });

test('a thesis follows its closing sell', () => {
  const { attached, orphaned } = reattachTheses([k('s1', 'my thesis')], [{ sellId: 's1' }]);
  assert.deepEqual(attached.get('s1'), k('s1', 'my thesis'));
  assert.deepEqual(orphaned, []);
});

test('reordered trades and new trades keep theses on the right sell', () => {
  const { attached, orphaned } = reattachTheses([k('s1'), k('s2')], [{ sellId: 's3' }, { sellId: 's2' }, { sellId: 's1' }]);
  assert.equal(attached.get('s1')?.thesis, 't-s1');
  assert.equal(attached.get('s2')?.thesis, 't-s2');
  assert.equal(attached.has('s3'), false);
  assert.deepEqual(orphaned, []);
});

test('a thesis whose sell is gone is orphaned, not dropped', () => {
  const { attached, orphaned } = reattachTheses([k('s1'), k('gone')], [{ sellId: 's1' }]);
  assert.equal(attached.has('gone'), false);
  assert.deepEqual(orphaned, [k('gone')]);
});

test('held status is preserved', () => {
  const { attached } = reattachTheses([k('s1', 'x', 'held')], [{ sellId: 's1' }]);
  assert.equal(attached.get('s1')?.thesis_status, 'held');
});

test('empty inputs', () => {
  const a = reattachTheses([], [{ sellId: 's1' }]);
  assert.equal(a.attached.size, 0);
  assert.deepEqual(a.orphaned, []);
  const b = reattachTheses([k('s1'), k('s2')], []);
  assert.equal(b.attached.size, 0);
  assert.deepEqual(b.orphaned, [k('s1'), k('s2')]);
});

test('duplicate sell_id: last wins, earlier is orphaned; inputs not mutated', () => {
  const kept = [k('s1', 'first'), k('s1', 'second')];
  const trades = [{ sellId: 's1' }];
  const keptClone = structuredClone(kept);
  const tradesClone = structuredClone(trades);
  const { attached, orphaned } = reattachTheses(kept, trades);
  assert.equal(attached.get('s1')?.thesis, 'second');
  assert.deepEqual(orphaned, [k('s1', 'first')]);
  assert.deepEqual(kept, keptClone);
  assert.deepEqual(trades, tradesClone);
});
