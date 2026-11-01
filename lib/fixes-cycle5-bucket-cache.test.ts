// FIXES-CYCLE5 (F5-5): lib/bucket-cache.ts — single flight, true LRU, failed builds evicted, stale entries rebuilt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketCache } from './bucket-cache.ts';

const tick = () => new Promise((r) => setImmediate(r));

test('F5-5 cache: 50 concurrent gets of one key run one build and share its value', async () => {
  const c = bucketCache<number>(4);
  let builds = 0;
  let release!: (v: number) => void;
  const gate = new Promise<number>((r) => { release = r; });
  const all = Array.from({ length: 50 }, () => c.get('k', () => { builds++; return gate; }));
  await tick();
  release(7);
  assert.deepEqual(await Promise.all(all), Array(50).fill(7));
  assert.equal(builds, 1);
  assert.equal(await c.get('k', async () => { builds++; return 8; }), 7);
  assert.equal(builds, 1);
});

test('F5-5 cache: least recently used is evicted, and a get refreshes recency', async () => {
  const c = bucketCache<string>(3);
  for (const k of ['a', 'b', 'c']) await c.get(k, async () => k);
  await c.get('a', async () => 'a2'); // a is now newest; b is oldest
  await c.get('d', async () => 'd');
  assert.deepEqual(c.keys(), ['c', 'a', 'd']);
  assert.equal(c.peek('a'), 'a');
  assert.equal(c.peek('b'), undefined);
});

test('F5-5 cache: a key read between 1,000 other builds survives them all', async () => {
  const c = bucketCache<number>(256);
  await c.get('page2', async () => 2);
  for (let i = 0; i < 1000; i++) {
    await c.get(`p1-${i}`, async () => i);
    if (i % 100 === 0) await c.get('page2', async () => -1);
  }
  // Read every 100 builds, it is never the least recently used key when the cache is full.
  assert.equal(c.peek('page2'), 2);
  assert.equal(c.size, 256);
});

test('F5-5 cache: a failed build is evicted and the next get builds again', async () => {
  const c = bucketCache<number>(4);
  await assert.rejects(c.get('k', async () => { throw new Error('boom'); }), /boom/);
  assert.equal(c.size, 0);
  assert.equal(await c.get('k', async () => 3), 3);
});

test('F5-5 cache: concurrent callers of a failing build all see the failure, then one rebuild serves the next', async () => {
  const c = bucketCache<number>(4);
  let builds = 0;
  const fail = () => { builds++; return Promise.reject(new Error('x')); };
  const rs = await Promise.allSettled([c.get('k', fail), c.get('k', fail), c.get('k', fail)]);
  assert.ok(rs.every((r) => r.status === 'rejected'));
  assert.equal(builds, 1);
  assert.equal(await c.get('k', async () => { builds++; return 1; }), 1);
  assert.equal(builds, 2);
});

test('F5-5 cache: a stale entry is rebuilt on read', async () => {
  const c = bucketCache<{ at: number }>(4, (v) => v.at < 10);
  await c.get('k', async () => ({ at: 5 }));
  assert.deepEqual(await c.get('k', async () => ({ at: 20 })), { at: 20 });
  assert.deepEqual(await c.get('k', async () => ({ at: 30 })), { at: 20 });
});

test('F5-5 cache: max must be a positive integer', () => {
  assert.throws(() => bucketCache(0), RangeError);
  assert.throws(() => bucketCache(1.5), RangeError);
});
