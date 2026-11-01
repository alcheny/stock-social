// Sharded hourly sync, the pure parts (lib/sync-limits.ts; committee docs/features/logs/sync/committee-2026-11-01.md):
// shard parameters, run configuration, the token bucket, backoff, failure classes, the breaker and the database check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKOFF_BASE_MS, BACKOFF_CAP_MS, Breaker, MAX_SHARDS, TokenBucket, backoffMs, classify, dbConfigCheck, errLabel, parseShard, runConfig, shardOf,
} from './sync-limits.ts';
import { VendorTimeoutError } from './broker.ts';
import { AccountClaimedError } from './claims.ts';

const q = (s: string) => parseShard(new URLSearchParams(s));
const isErr = (r: ReturnType<typeof parseShard>) => 'error' in r;

test('parseShard: neither parameter is shard 0 of 1; both valid pass through', () => {
  assert.deepEqual(q(''), { shard: 0, of: 1 });
  assert.deepEqual(q('shard=0&of=1'), { shard: 0, of: 1 });
  assert.deepEqual(q('shard=3&of=32'), { shard: 3, of: 32 });
  assert.deepEqual(q(`shard=${MAX_SHARDS - 1}&of=${MAX_SHARDS}`), { shard: MAX_SHARDS - 1, of: MAX_SHARDS });
});

test('parseShard: only one parameter, non-integers, negatives, shard >= of, of 0 and of > 1024 are errors', () => {
  for (const s of ['shard=1', 'of=4', 'shard=&of=4', 'shard=1&of=', 'shard=1.5&of=4', 'shard=1&of=4.0', 'shard=-1&of=4', 'shard=1&of=-4',
    'shard=a&of=4', 'shard=1&of=1e3', 'shard=+1&of=4', 'shard= 1&of=4', 'shard=4&of=4', 'shard=5&of=4', 'shard=0&of=0', `shard=0&of=${MAX_SHARDS + 1}`, 'shard=0&of=99999']) {
    assert.ok(isErr(q(s)), `expected an error for ${s}`);
  }
  assert.equal(MAX_SHARDS, 1024);
});

test('shardOf: over ids 1..N*k every residue gets exactly k ids, each id exactly one shard, matching id % N', () => {
  for (const N of [1, 2, 3, 7, 32, 1024]) {
    const k = 5;
    const counts = new Array(N).fill(0);
    for (let id = 1; id <= N * k; id++) {
      const s = shardOf(id, N);
      assert.ok(Number.isInteger(s) && s >= 0 && s < N);
      assert.equal(s, id % N);
      counts[s]++;
    }
    assert.deepEqual(counts, new Array(N).fill(k));
  }
});

// Orchestrator review 2: the defaults are today's sequential rate (1 worker, 2 rps) until the switch-on gate.
test('runConfig: defaults 1 worker, 2 rps, burst = rps, page 500; values are clamped and junk falls back to the default', () => {
  assert.deepEqual(runConfig({}), { concurrency: 1, rps: 2, burst: 2, page: 500 });
  assert.deepEqual(runConfig({ SYNC_CONCURRENCY: '', SYNC_VENDOR_RPS: '', SYNC_PAGE: '' }), { concurrency: 1, rps: 2, burst: 2, page: 500 });
  assert.deepEqual(runConfig({ SYNC_CONCURRENCY: '6', SYNC_VENDOR_RPS: '10' }), { concurrency: 6, rps: 10, burst: 10, page: 500 }); // the plan
  assert.deepEqual(runConfig({ SYNC_VENDOR_RPS: '4' }).burst, 4); // burst follows rps
  assert.deepEqual(runConfig({ SYNC_CONCURRENCY: '100', SYNC_VENDOR_RPS: '5000', SYNC_VENDOR_BURST: '9999', SYNC_PAGE: '99999' }), { concurrency: 32, rps: 1000, burst: 1000, page: 5000 });
  assert.deepEqual(runConfig({ SYNC_CONCURRENCY: '0', SYNC_VENDOR_RPS: '0', SYNC_VENDOR_BURST: '0', SYNC_PAGE: '1' }), { concurrency: 1, rps: 1, burst: 1, page: 10 });
  assert.deepEqual(runConfig({ SYNC_CONCURRENCY: '-3' }).concurrency, 1);
  assert.deepEqual(runConfig({ SYNC_CONCURRENCY: '3.9' }).concurrency, 3);
  assert.deepEqual(runConfig({ SYNC_CONCURRENCY: 'abc', SYNC_VENDOR_RPS: 'Infinity', SYNC_PAGE: 'NaN' }), { concurrency: 1, rps: 2, burst: 2, page: 500 });
});

// A fake clock for the bucket: sleep advances it.
const fakeTime = () => {
  const c = { t: 0, sleeps: [] as number[] };
  return { c, now: () => c.t, sleep: async (ms: number) => { c.sleeps.push(ms); c.t += ms; } };
};

test('TokenBucket: the burst is free, then the rate is respected (rps 5: 10 single takes take 1.8 s after a burst of 1)', async () => {
  const f = fakeTime();
  const b = new TokenBucket(5, 1, f.now, f.sleep);
  for (let i = 0; i < 10; i++) await b.take(1);
  assert.equal(f.c.t, 1800);
  assert.equal(b.taken, 10);
  assert.equal(b.waitedMs, 1800);

  const g = fakeTime();
  const big = new TokenBucket(10, 10, g.now, g.sleep);
  for (let i = 0; i < 10; i++) await big.take(1);
  assert.equal(g.c.t, 0); // ten at once from a full burst
  await big.take(1);
  assert.equal(g.c.t, 100);
});

test('TokenBucket: the saved budget never exceeds the burst after idle time', async () => {
  const f = fakeTime();
  const b = new TokenBucket(10, 3, f.now, f.sleep);
  await b.take(3);
  f.c.t += 60_000; // a minute idle: still only 3 saved
  await b.take(3);
  assert.equal(f.c.sleeps.length, 0);
  await b.take(1);
  assert.equal(f.c.sleeps.reduce((a, x) => a + x, 0), 100);
});

test('TokenBucket: waiters are served in FIFO order (a big request is not overtaken by later small ones)', async () => {
  const f = fakeTime();
  const b = new TokenBucket(10, 10, f.now, f.sleep);
  const order: string[] = [];
  await b.take(10); // empty it
  await Promise.all([
    b.take(8).then(() => order.push('a')),
    b.take(1).then(() => order.push('b')),
    b.take(1).then(() => order.push('c')),
  ]);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.equal(f.c.t, 1000);
});

test('TokenBucket: estimateWaitMs counts queued demand; zero when the budget covers it', async () => {
  const f = fakeTime();
  const b = new TokenBucket(10, 10, f.now, f.sleep);
  assert.equal(b.estimateWaitMs(10), 0);
  assert.equal(b.estimateWaitMs(11), 100);
  const p = b.take(10); // queued, not yet taken
  assert.equal(b.estimateWaitMs(5), 500);
  const p2 = b.take(5);
  assert.equal(b.estimateWaitMs(1), 600);
  await Promise.all([p, p2]);
  // All taken: the bucket is 5 short of a full refill at t=500.
  assert.equal(f.c.t, 500);
  assert.equal(b.estimateWaitMs(1), 100);
  f.c.t += 1000;
  assert.equal(b.estimateWaitMs(10), 0);
});

test('TokenBucket: a request above the burst is taken a burst at a time', async () => {
  const f = fakeTime();
  const b = new TokenBucket(10, 10, f.now, f.sleep);
  await b.take(25);
  assert.equal(b.taken, 25);
  assert.equal(f.c.t, 1500);
  assert.equal(b.waitedMs, 1500);
  assert.equal(b.estimateWaitMs(0), 0);
});

test('backoffMs: 0, then 1 h doubling, capped at 24 h', () => {
  assert.equal(BACKOFF_BASE_MS, 3_600_000);
  assert.equal(BACKOFF_CAP_MS, 24 * 3_600_000);
  const H = 3_600_000;
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 10, 40, 1000].map(backoffMs), [0, H, 2 * H, 4 * H, 8 * H, 16 * H, 24 * H, 24 * H, 24 * H, 24 * H, 24 * H]);
  assert.equal(backoffMs(-1), 0);
});

test('classify: 429, 5xx, vendor timeouts, transport and database connection errors are transient', () => {
  const pg = (code: string) => Object.assign(new Error('pg'), { code });
  for (const e of [
    { status: 429 }, { status: 500 }, { status: 502 }, { status: 503 }, { response: { status: 504 } },
    new VendorTimeoutError(30_000), Object.assign(new Error('x'), { name: 'AxiosError' }),
    pg('ECONNRESET'), pg('ECONNREFUSED'), pg('ETIMEDOUT'), pg('CONNECTION_CLOSED'), pg('CONNECTION_ENDED'), pg('08006'), pg('08001'), pg('57P01'), pg('40P01'),
  ]) assert.equal(classify(e), 'transient', JSON.stringify(e));
});

test('classify: 401/403/404 are refusals; 400/422, AccountClaimedError and plain errors are the trader\'s', () => {
  for (const e of [{ status: 401 }, { status: 403 }, { status: 404 }, Object.assign(new Error('x'), { name: 'AxiosError', response: { status: 403 } })]) assert.equal(classify(e), 'refused');
  for (const e of [{ status: 400 }, { status: 422 }, new AccountClaimedError(), new Error('bad record'), Object.assign(new Error('pg'), { code: '23505' }), null, undefined, 'boom'])
    assert.equal(classify(e), 'trader', String(e));
});

test('errLabel: the class name and the status, never the message', () => {
  const vendorText = ['vendor', 'user', 'abc123'].join('-'); // text a vendor message might echo
  const e = Object.assign(new Error(`user ${vendorText} refused`), { status: 403 });
  assert.equal(errLabel(e), 'Error 403');
  assert.equal(errLabel(new VendorTimeoutError(30_000)), 'VendorTimeoutError');
  assert.equal(errLabel(Object.assign(new Error(vendorText), { name: 'AxiosError', response: { status: 502 } })), 'AxiosError 502');
  for (const x of [e, new Error(vendorText), new AccountClaimedError(), { status: 503, message: vendorText }, vendorText]) assert.ok(!errLabel(x).includes(vendorText) && !errLabel(x).includes('refused'), errLabel(x));
});

test('Breaker: never trips before 20 finished attempts; trips once >= 10 of the last 20 were bad; stays tripped', () => {
  const all = new Breaker();
  for (let i = 0; i < 19; i++) assert.equal(all.record(true), false);
  assert.equal(all.record(true), true);

  const nine = new Breaker();
  for (let i = 0; i < 40; i++) nine.record(i % 20 < 9);
  // 9 bad then 11 good, repeating: any 20 consecutive hold exactly 9 bad.
  assert.equal(nine.tripped, false);

  const ten = new Breaker();
  for (let i = 0; i < 10; i++) ten.record(false);
  for (let i = 0; i < 9; i++) assert.equal(ten.record(true), false); // 19 attempts
  assert.equal(ten.record(true), true); // 20th: 10 of 20 bad
  ten.record(false);
  assert.equal(ten.tripped, true); // sticky

  // Old failures slide out of the window.
  const slide = new Breaker();
  for (let i = 0; i < 9; i++) slide.record(true);
  for (let i = 0; i < 30; i++) slide.record(false);
  for (let i = 0; i < 9; i++) slide.record(true);
  assert.equal(slide.tripped, false);
});

test('dbConfigCheck: each rule', () => {
  const plan = { shards: 32, workers: 6, maxSyncCostMs: 270_000, userLeaseMs: 600_000 };
  const good = { statementTimeoutMs: 60_000, idleInTxMs: 300_000, maxConnections: 32 * 8 + 20 };
  assert.deepEqual(dbConfigCheck(good, plan), { ok: true, problems: [] });
  const one = (s: Partial<typeof good>) => dbConfigCheck({ ...good, ...s }, plan);
  assert.deepEqual(one({ statementTimeoutMs: 0 }).problems, ['statement_timeout is 0']);
  assert.deepEqual(one({ idleInTxMs: 0 }).problems, ['idle_in_transaction_session_timeout is 0']);
  assert.deepEqual(one({ idleInTxMs: 270_000 }).problems, ['idle_in_transaction_session_timeout is at or below the largest sync cost']);
  assert.deepEqual(one({ idleInTxMs: 270_001 }).problems, []);
  assert.deepEqual(one({ idleInTxMs: 600_000 }).problems, ['idle_in_transaction_session_timeout is at or above the per-user lease']);
  assert.deepEqual(one({ idleInTxMs: 599_999 }).problems, []);
  assert.deepEqual(one({ maxConnections: 275 }).problems, ['max_connections is below 276']);
  assert.equal(one({ maxConnections: 276 }).ok, true);
  const bad = dbConfigCheck({ statementTimeoutMs: 0, idleInTxMs: 0, maxConnections: 100 }, plan);
  assert.equal(bad.ok, false);
  assert.equal(bad.problems.length, 3);
  // Unsharded: 1 x (6 + 2) + 20 = 28.
  assert.equal(dbConfigCheck({ ...good, maxConnections: 28 }, { ...plan, shards: 1 }).ok, true);
  assert.equal(dbConfigCheck({ ...good, maxConnections: 27 }, { ...plan, shards: 1 }).ok, false);
});

// Code review (should-fix 1): database-wide failures and code errors are never held against one trader; the breaker
// sees them.
test('classify: database-wide SQLSTATEs (53xxx, 57014, 55P03, 25P03, 42xxx) and code errors (TypeError, ReferenceError, RangeError) are transient', () => {
  for (const code of ['53300', '53200', '53100', '57014', '55P03', '25P03', '42P01', '42703'])
    assert.equal(classify(Object.assign(new Error('pg'), { code })), 'transient', code);
  for (const e of [new TypeError('x'), new ReferenceError('x'), new RangeError('x')]) assert.equal(classify(e), 'transient', e.name);
  // Still the trader's: a constraint on its own rows, a plain error from its record.
  for (const code of ['23505', '23503', '22003']) assert.equal(classify(Object.assign(new Error('pg'), { code })), 'trader', code);
});

// Orchestrator review 3: what one cron call does.
test('parseCall: no parameters and of=1 do everything; of > 1 (shard 0 too) syncs only; task=housekeeping takes of and no shard', async () => {
  const { parseCall } = await import('./sync-limits.ts');
  const p = (q: string) => parseCall(new URLSearchParams(q));
  assert.deepEqual(p(''), { mode: 'all', shard: { shard: 0, of: 1 } });
  assert.deepEqual(p('shard=0&of=1'), { mode: 'all', shard: { shard: 0, of: 1 } });
  assert.deepEqual(p('shard=0&of=32'), { mode: 'shard', shard: { shard: 0, of: 32 } });
  assert.deepEqual(p('shard=31&of=32'), { mode: 'shard', shard: { shard: 31, of: 32 } });
  assert.deepEqual(p('task=housekeeping&of=32'), { mode: 'housekeeping', shard: { shard: 0, of: 32 } });
  assert.deepEqual(p('task=housekeeping'), { mode: 'housekeeping', shard: { shard: 0, of: 1 } });
  for (const q of ['task=other', 'task=housekeeping&shard=0&of=2', 'task=housekeeping&of=0', 'task=housekeeping&of=2000', 'task=housekeeping&of=x', 'shard=1', 'shard=2&of=2'])
    assert.ok('error' in p(q), q);
});
