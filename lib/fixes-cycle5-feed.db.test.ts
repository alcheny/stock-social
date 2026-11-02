// FIXES-CYCLE5 (F5-5, C5-7): loadFeedPage with the bucket gate. The clock, the database-clock sampler and the list build
// are lib/feed.ts's FEED_SEAMS (no wall-clock bounds); the build count proves one candidate build per bucket. The last
// test runs the real build twice for one key on fresh caches (no sync runs alongside: it writes nothing).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGE_SIZE, utcDay } from './discovery/pager.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
const ENV = { ...process.env };
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => {
  for (const k of ['FEED_BUCKET_MS', 'VERCEL_ENV']) if (ENV[k] === undefined) delete process.env[k]; else process.env[k] = ENV[k];
  if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 });
});

const T = Date.UTC(2026, 10, 2, 15, 37, 5, 123); // 5 s into its minute

async function seams() {
  const feed = await import('./feed.ts');
  const real = { build: feed.FEED_SEAMS.build, clock: feed.FEED_SEAMS.clock, sample: feed.FEED_SEAMS.sampleDbMs };
  const asOfs: number[] = [];
  let samples = 0;
  let now = T;
  feed.FEED_SEAMS.build = async (o) => { asOfs.push(o.asOf.getTime()); return { list: [], ranked: [], pool: [], extra: [] }; };
  feed.FEED_SEAMS.clock = () => now;
  feed.FEED_SEAMS.sampleDbMs = async () => { samples++; return now - 30_000; }; // the database 30 s behind
  feed.FEED_SEAMS.resetOffset();
  feed.clearFeedCache('lists');
  return {
    feed, asOfs, set: (ms: number) => { now = ms; }, samples: () => samples,
    restore: () => { Object.assign(feed.FEED_SEAMS, { build: real.build, clock: real.clock, sampleDbMs: real.sample }); feed.FEED_SEAMS.resetOffset(); feed.clearFeedCache('lists'); },
  };
}

dbTest('F5-5 on (FEED_BUCKET_MS): two loads in one bucket and 50 concurrent loads run ONE build, floored on the database clock', async () => {
  process.env.FEED_BUCKET_MS = '60000';
  delete process.env.VERCEL_ENV;
  const s = await seams();
  try {
    const before = s.feed.FEED_SEAMS.builds;
    const p1 = await s.feed.loadFeedPage(undefined);
    s.set(T + 20_000);
    const p2 = await s.feed.loadFeedPage(undefined);
    assert.equal(s.feed.FEED_SEAMS.builds - before, 1, 'two loads, one build');
    const floor = Math.floor((T - 30_000) / 60_000) * 60_000;
    assert.equal(p1.asOf.getTime(), floor, 'floored on the database clock (30 s behind)');
    assert.ok(p1.asOf.getTime() <= T - 30_000);
    assert.equal(p2.asOf.getTime(), floor);
    s.feed.clearFeedCache('lists');
    const all = await Promise.all(Array.from({ length: 50 }, () => s.feed.loadFeedPage(undefined)));
    assert.equal(s.feed.FEED_SEAMS.builds - before, 2, '50 concurrent loads, one more build');
    assert.ok(all.every((p) => p.asOf.getTime() === floor));
    assert.equal(s.samples(), 1, 'the offset is sampled once (at most every 5 minutes, single flight)');
    assert.deepEqual(s.asOfs, [floor, floor]);
  } finally { s.restore(); }
});

dbTest('F5-5: with opts.now the bucket is not applied and the sampler is never called (today\'s exact key)', async () => {
  process.env.FEED_BUCKET_MS = '60000';
  const s = await seams();
  try {
    const p = await s.feed.loadFeedPage(undefined, { now: T });
    assert.equal(p.asOf.getTime(), T);
    assert.equal(s.samples(), 0);
    assert.deepEqual(s.asOfs, [T]);
  } finally { s.restore(); }
});

dbTest('F5-5 off (plain local start; FEED_BUCKET_MS=0 even on production): page 1 is the exact clock, no sample', async () => {
  delete process.env.FEED_BUCKET_MS;
  delete process.env.VERCEL_ENV;
  const s = await seams();
  try {
    assert.equal((await s.feed.loadFeedPage(undefined)).asOf.getTime(), T);
    process.env.VERCEL_ENV = 'production';
    process.env.FEED_BUCKET_MS = '0';
    s.set(T + 1);
    assert.equal((await s.feed.loadFeedPage(undefined)).asOf.getTime(), T + 1);
    assert.equal(s.samples(), 0);
    delete process.env.FEED_BUCKET_MS;
    s.set(T + 2);
    const on = await s.feed.loadFeedPage(undefined);
    assert.equal(on.asOf.getTime() % 60_000, 0, 'VERCEL_ENV=production alone: on');
  } finally { s.restore(); delete process.env.VERCEL_ENV; }
});

dbTest('F5-5: a failed offset sample keeps the last value (0 before the first) and the page still loads', async () => {
  process.env.FEED_BUCKET_MS = '60000';
  const s = await seams();
  try {
    s.feed.FEED_SEAMS.sampleDbMs = async () => { throw new Error('db down'); };
    const p = await s.feed.loadFeedPage(undefined);
    assert.equal(p.asOf.getTime(), Math.floor(T / 60_000) * 60_000);
  } finally { s.restore(); }
});

dbTest('F5-5: a floored page 1 cursor serves page 2 from the same kept list', async () => {
  process.env.FEED_BUCKET_MS = '60000';
  const s = await seams();
  try {
    const before = s.feed.FEED_SEAMS.builds;
    const floor = Math.floor((T - 30_000) / 60_000) * 60_000;
    await s.feed.loadFeedPage(undefined);
    const { encodeCursor } = await import('./discovery/pager.ts');
    s.set(T + 45_000);
    const p2 = await s.feed.loadFeedPage(encodeCursor({ day: utcDay(floor), asOf: floor, offset: PAGE_SIZE }));
    assert.equal(p2.asOf.getTime(), floor, 'the floored cursor decodes');
    assert.equal(p2.offset, PAGE_SIZE);
    assert.equal(s.feed.FEED_SEAMS.builds - before, 1, 'page 2 reused page 1 list');
  } finally { s.restore(); }
});

dbTest('F5-5: two real builds of one key on fresh caches are equal', async () => {
  delete process.env.FEED_BUCKET_MS;
  const { loadFeedPage, clearFeedCache } = await import('./feed.ts');
  const now = Date.now();
  clearFeedCache();
  const a = await loadFeedPage(undefined, { now });
  clearFeedCache();
  const b = await loadFeedPage(undefined, { now });
  assert.deepEqual(b.cards.map((t) => [t.sell_id, t.user_id, t.score]), a.cards.map((t) => [t.sell_id, t.user_id, t.score]));
  assert.equal(b.next, a.next);
});
