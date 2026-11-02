// FIXES-CYCLE5 (F5-5, C5-7): feed page 1 shares one list per bucket. Pure parts: the gate, the floor on the database
// clock, and the kept-list cache (single flight, true LRU, failed builds not kept, stale lists dropped) driven through
// lib/feed.ts's FEED_SEAMS with a stub build (no wall-clock bounds, no database: the stub never queries).
// The loadFeedPage paths (bucket on/off, sampler never called with opts.now) are in lib/fixes-cycle5-feed.db.test.ts.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { CURSOR_MAX_AGE_MS, decodeCursor, encodeCursor, FEED_BUCKET_MAX_MS, flooredFirstPage, PAGE_SIZE, utcDay } from './discovery/pager.ts';
import { clearFeedCache, FEED_SEAMS, feedBucketMs } from './feed.ts';

const realBuild = FEED_SEAMS.build;
after(() => { FEED_SEAMS.build = realBuild; clearFeedCache('lists'); });

const T = Date.UTC(2026, 10, 2, 15, 37, 5, 123); // 5 s into its minute
type Built = Awaited<ReturnType<typeof FEED_SEAMS.build>>;
const empty = (): Built => ({ list: [], ranked: [], pool: [], extra: [] });
const cur = (asOf: number, offset = 0) => ({ day: utcDay(asOf), asOf, offset });

test('F5-5 gate: on for VERCEL_ENV=production even with ALLOW_DEV_AUTH=1; off for a plain local start; FEED_BUCKET_MS=0 off', () => {
  assert.equal(feedBucketMs({ VERCEL_ENV: 'production', ALLOW_DEV_AUTH: '1', NODE_ENV: 'production' }), 60_000);
  assert.equal(feedBucketMs({ VERCEL_ENV: 'production' }), 60_000);
  assert.equal(feedBucketMs({ NODE_ENV: 'production' }), 0, 'npm run start locally: off');
  assert.equal(feedBucketMs({ NODE_ENV: 'production', ALLOW_DEV_AUTH: '1' }), 0, 'the e2e server: off');
  assert.equal(feedBucketMs({}), 0);
  assert.equal(feedBucketMs({ VERCEL_ENV: 'preview' }), 0);
  assert.equal(feedBucketMs({ VERCEL_ENV: 'production', FEED_BUCKET_MS: '0' }), 0, 'FEED_BUCKET_MS=0 forces it off');
  assert.equal(feedBucketMs({ FEED_BUCKET_MS: '30000' }), 30_000, 'FEED_BUCKET_MS > 0 turns it on at that size');
  assert.equal(feedBucketMs({ FEED_BUCKET_MS: '30000', ALLOW_DEV_AUTH: '1' }), 30_000, 'never depends on ALLOW_DEV_AUTH');
  assert.equal(feedBucketMs({ FEED_BUCKET_MS: String(10 * FEED_BUCKET_MAX_MS) }), FEED_BUCKET_MAX_MS, 'capped');
  assert.equal(feedBucketMs({ FEED_BUCKET_MS: 'soon' }), 0, 'garbage: the default (off locally)');
});

test('F5-5 floor: every clock in one bucket gives one page-1 cursor; never later than the database time', () => {
  const a = flooredFirstPage(T, 0, 60_000), b = flooredFirstPage(T + 18_000, 0, 60_000);
  assert.deepEqual(a, b);
  assert.equal(a.asOf % 60_000, 0);
  assert.equal(a.offset, 0);
  assert.equal(a.day, utcDay(a.asOf));
  // Database 30 s behind the app: the floor is at most the database time.
  const db = flooredFirstPage(T, -30_000, 60_000);
  assert.ok(db.asOf <= T - 30_000, 'at most the database time');
  assert.ok(db.asOf > T - 30_000 - 60_000, 'within one bucket of it');
  // An offset past the skew limit is not trusted: the app clock is floored.
  assert.deepEqual(flooredFirstPage(T, 10 * 60_000, 60_000), flooredFirstPage(T, 0, 60_000));
  // Bucket 0: today's exact clock.
  assert.deepEqual(flooredFirstPage(T, -30_000, 0), { day: utcDay(T), asOf: T, offset: 0 });
});

test('F5-5 floor: a floored page 1 still decodes on its later pages, up to the cursor lifetime', () => {
  const c = flooredFirstPage(T, 25_000, 60_000);
  const next = encodeCursor({ ...c, offset: PAGE_SIZE });
  assert.deepEqual(decodeCursor(next, T, 200), { ...c, offset: PAGE_SIZE });
  assert.deepEqual(decodeCursor(next, c.asOf + CURSOR_MAX_AGE_MS - 1, 200), { ...c, offset: PAGE_SIZE });
  // Just after UTC midnight the floor can be in the old day; its cursor names that day and still decodes.
  const mid = Date.UTC(2026, 10, 3, 0, 0, 10);
  const m = flooredFirstPage(mid, -30_000, 60_000);
  assert.equal(m.day, '2026-11-02');
  assert.ok(decodeCursor(encodeCursor({ ...m, offset: PAGE_SIZE }), mid, 200));
});

test('F5-5 single flight: two calls in one bucket, and 50 concurrent calls, run ONE build', async () => {
  clearFeedCache('lists');
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  FEED_SEAMS.build = async () => { await gate; return empty(); };
  const before = FEED_SEAMS.builds;
  const c = flooredFirstPage(T, 0, 60_000);
  const calls = Array.from({ length: 50 }, () => FEED_SEAMS.listFor(c, T));
  release();
  const out = await Promise.all(calls);
  assert.equal(FEED_SEAMS.builds - before, 1, '50 concurrent calls, one build');
  assert.ok(out.every((k) => k === out[0]), 'one shared list');
  await FEED_SEAMS.listFor(flooredFirstPage(T + 30_000, 0, 60_000), T + 30_000);
  assert.equal(FEED_SEAMS.builds - before, 1, 'a later call in the same bucket: still one build');
  await FEED_SEAMS.listFor(flooredFirstPage(T + 60_000, 0, 60_000), T + 60_000);
  assert.equal(FEED_SEAMS.builds - before, 2, 'the next bucket builds again');
});

test('F5-5 LRU: a page-2 cursor list survives 1,000 page-1 builds under 255 other keys', async () => {
  clearFeedCache('lists');
  FEED_SEAMS.build = async () => empty();
  const reader = cur(T - 5 * 60_000, PAGE_SIZE);
  const kept = await FEED_SEAMS.listFor(reader, T);
  const before = FEED_SEAMS.builds;
  for (let i = 0; i < 1_000; i++) {
    await FEED_SEAMS.listFor(cur(T - 1_000 * ((i % 255) + 1)), T);
    if (i % 100 === 99) assert.equal(await FEED_SEAMS.listFor(reader, T), kept, `the reader's list is kept at ${i + 1}`);
  }
  assert.equal(await FEED_SEAMS.listFor(reader, T), kept);
  assert.equal(FEED_SEAMS.builds - before, 255, 'each of the 255 other keys built once, then reused');
  // Past 256 keys the least recently used goes first, never the reader who just paged.
  await FEED_SEAMS.listFor(reader, T);
  await FEED_SEAMS.listFor(cur(T - 9_999_000), T);
  assert.equal(FEED_SEAMS.keptKeys().length, 256);
  assert.ok(FEED_SEAMS.keptKeys().some((k) => k.includes(`|${reader.asOf}|`)));
});

test('F5-5: a failed build is not kept (the next call builds again); a list past the cursor lifetime is dropped', async () => {
  clearFeedCache('lists');
  let fail = true;
  FEED_SEAMS.build = async () => { if (fail) throw new Error('boom'); return empty(); };
  const c = cur(T);
  const before = FEED_SEAMS.builds;
  await assert.rejects(FEED_SEAMS.listFor(c, T), /boom/);
  fail = false;
  await FEED_SEAMS.listFor(c, T);
  assert.equal(FEED_SEAMS.builds - before, 2);
  await FEED_SEAMS.listFor(c, T + CURSOR_MAX_AGE_MS - 1);
  assert.equal(FEED_SEAMS.builds - before, 2, 'still fresh');
  await FEED_SEAMS.listFor(c, T + CURSOR_MAX_AGE_MS + 1);
  assert.equal(FEED_SEAMS.builds - before, 3, 'stale: built again');
});

test('F5-5: clearFeedCache still forgets kept lists', async () => {
  FEED_SEAMS.build = async () => empty();
  await FEED_SEAMS.listFor(cur(T), T);
  assert.ok(FEED_SEAMS.keptKeys().length > 0);
  clearFeedCache('lists');
  assert.equal(FEED_SEAMS.keptKeys().length, 0);
});
