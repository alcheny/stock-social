// Sharded hourly sync load test (committee docs/features/logs/sync/committee-2026-11-01.md, row T and round 2): 100,000
// synthetic traders against the in-repo vendor fake (e2e/fakes/vendor.ts, its `/_bulk` control), a 2-account mix, 1% slow
// traders whose vendor calls exceed the request bound, 0.1% traders the vendor answers 400, with vendor latency, every
// shard of the production plan (docs/SYNC.md: 40 shards x 6 workers, 12 req/s per shard), asserting full coverage of a
// round with >= 1.5x headroom; plus a latency-model test in real time.
// Skipped unless LOAD=1 (and DATABASE_URL), so `npm test` stays fast. How to run:
//   set -a && . ./.env && set +a && LOAD=1 node --test lib/sync-shard.load.test.ts
// Timings and counters print as `# load: …` lines. The whole file takes about 10 minutes on a 4-core container.
//
// The time-scaled model (main test). Everything that is time scales by K = 10, so a production round (an hour) is
// simulated in a few minutes and a shard's work per call is the production one: vendor latency 0.5 s / K per request (the
// plan's p95, applied to every request: conservative), the request bound 30 s / K (vendorTimeout.ms), a call's window the
// route's 300 s / K with the 90 s / K reserve (deadline, routeEnd, vendorBoundMs), the start jitter 15 s / K, and the
// vendor budget 12 x K requests a second per shard. Concurrency (6) and the shard count (40) are the plan's. Leases,
// backoff and the database's round (1 h) are not scaled: each simulated round runs on its own shifted database clock
// (`shiftMs`). The database's own time per trader is not scaled either, so at K = 10 it weighs ten times more against
// the vendor's than in production: the measured calls are an upper bound, and the log splits a sync's time in two.
// Production runs each shard in its own function instance; here shards run in worker threads (one event loop and one
// pool each: a single loop driving 12 shards saturated one core long before the database). One server with
// max_connections 100 cannot hold 40 x 8 connections, so the shards run in batches (11 at once on such a server), each
// batch through the same round on the same round clock. Shards are disjoint (asserted), so a batch does exactly what its
// shards would do with the others running elsewhere; the per-shard figures are what the plan multiplies, and the log
// extrapolates them to 40 shards. The cron: a round is 11 calls; each call is one runShard per shard (concurrently),
// each with its own scaled window.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import type { RunReport } from './sync-shard.ts';
import type { RunConfig } from './sync-limits.ts';
import type { Broker, SyncableUser } from './sync.ts';

const IN_WORKER = !isMainThread && (workerData as { loadShardWorker?: boolean } | null)?.loadShardWorker === true;
const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const loadTest = (name: string, fn: () => Promise<void>) => {
  if (!IN_WORKER) test(name, { skip: !LOAD ? 'sharded-sync load suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 1_200_000 }, fn);
};

export const K = 10;
export const MODEL = {
  traders: Number(process.env.LOAD_TRADERS) || 100_000, // LOAD_TRADERS=n: a smaller fleet, a quick check of the harness only
  of: 40, concurrency: 6, rps: 12 * K, page: 500, // the plan after #40's third read per account (committee round 3)
  latencyMs: 500 / K, boundMs: 30_000 / K, routeMs: 300_000 / K, reserveMs: 90_000 / K, jitterMs: 15_000 / K,
  callsPerRound: 11,
  // Trader i (id lo + i, lo a multiple of 40, so shard = i % 40) has accounts[i % 80]: 1 for i % 80 < 40, else 2, so
  // every shard alternates 1- and 2-account traders (half each; 1 + 3 × 1.5 = 5.5 vendor requests a trader on average).
  // A pattern of period 2 would put all 2-account traders in the odd shards.
  accounts: [...Array<number>(40).fill(1), ...Array<number>(40).fill(2)],
  // Periods coprime with 40 spread the slow and failing traders over every shard (100 and 1000 would put them all in
  // the shards = 1 mod 4).
  slow: { every: 101, offset: 37, ms: 2 * 30_000 / K }, // ~1%: every request held twice the bound (a timeout: transient)
  fail: { every: 1009, offset: 501, status: 400 }, // ~0.1%: the vendor answers 400 (trader-specific: backed off)
};
// The latency-model test (real time, one shard).
export const LATENCY = { traders: 150, concurrency: 6, rps: 12, ms: 200, jitterMs: 300 }; // uniform 200–500 ms a request
// The bounds (asserted). Headroom: a round's calls used are at most 11 / 1.5 (the committee's >= 1.5x). The latency
// model's measured throughput is within ±25% of min(C / L_trader, RPS / requests_per_trader).
// Calls are whole, so "calls used" is measured two ways: whole calls (the worst shard's count of calls until its queue
// was empty) and fractional calls (each call that stopped at its deadline counts 1, the rest count their attempts over
// that shard's mean attempts in a call that stopped at its deadline: the round's work over the measured capacity of a
// call). The committee's >= 1.5x applies to the fractional measure; whole calls keep >= 1.15x (a shard that needs 7.01
// calls' work takes an 8th call for a handful of traders).
export const BOUNDS = { headroom: 1.5, wholeCallHeadroom: 1.15, modelTolerance: 0.25 };
const MAIN_POOL = 4; // the test thread's own pool: setup, sampling, assertions

const log = (s: string) => console.log(`# load: ${s}`);
const ms = (t0: number) => Math.round(performance.now() - t0);
const kindOf = (i: number) => i % MODEL.fail.every === MODEL.fail.offset ? 'fail' : i % MODEL.slow.every === MODEL.slow.offset ? 'slow' : 'healthy';

// ---- The shard worker (a worker thread running this file): runs the shards a call names, reports back. ----
type Report = RunReport & { failedIds: number[] };
type CallSpec = {
  shards: number[]; of: number; shiftMs: number; idRange: [number, number]; ids?: number[]; config: RunConfig; boundMs: number;
  routeMs?: number; reserveMs?: number; jitterMs?: number;
};
type CallResult = { reports: Report[]; attempts: number[]; timing: { n: number; syncMs: number; vendorMs: number }; failureLines: number };
async function shardWorker() {
  const { runShard } = await import('./sync-shard.ts');
  const { syncUser } = await import('./sync.ts');
  const broker = await import('./broker.ts');
  let failureLines = 0;
  const realError = console.error;
  // Failure lines are counted, not printed (1,100 of them).
  console.error = (...a: unknown[]) => { if (String(a[0]).startsWith('sync failed')) failureLines++; else realError(...a); };
  parentPort!.on('message', async (m: CallSpec | 'end') => {
    if (m === 'end') { await (await import('./db.ts')).sql.end({ timeout: 1 }); parentPort!.postMessage('ended'); return; }
    broker.vendorTimeout.ms = m.boundMs;
    failureLines = 0;
    const attempts: number[] = []; // (trader, shard) pairs
    const timing = { n: 0, syncMs: 0, vendorMs: 0 };
    const reports = await Promise.all(m.shards.map((shard) => {
      // Every attempt is counted, then runs the real syncUser. Where a sync's time goes: its vendor calls (latency,
      // timeouts) and the rest (the database: the transaction's statements, a wait for a pool connection). Only the
      // vendor part is scaled by K. Timed for syncs that succeed (the slow and failing ones throw).
      const sync = async (u: SyncableUser, b: Broker) => {
        attempts.push(u.id, shard);
        const t = performance.now();
        let vendor = 0;
        const timed = <A extends unknown[], R>(f: (...a: A) => Promise<R>) => async (...a: A) => { const v = performance.now(); try { return await f(...a); } finally { vendor += performance.now() - v; } };
        const wrapped: Broker = { pageLimit: b.pageLimit, listAccounts: timed(b.listAccounts), fetchActivities: timed(b.fetchActivities),
          ...(b.fetchActivitiesPage ? { fetchActivitiesPage: timed(b.fetchActivitiesPage) } : {}), ...(b.fetchPositions ? { fetchPositions: timed(b.fetchPositions) } : {}),
          // #40: the share-move read per account; every read the runner's metered broker hands over must pass through.
          ...(b.fetchShareMoves ? { fetchShareMoves: timed(b.fetchShareMoves) } : {}) };
        const out = await syncUser(u, wrapped);
        timing.n++; timing.syncMs += performance.now() - t; timing.vendorMs += vendor;
        return out;
      };
      const start = Date.now();
      return runShard({
        shard: { shard, of: m.of }, config: m.config, vendorBoundMs: m.boundMs, jitterMs: m.jitterMs,
        ...(m.routeMs ? { deadline: start + m.routeMs - m.reserveMs!, routeEnd: start + m.routeMs } : {}),
        idRange: m.idRange, ids: m.ids, shiftMs: m.shiftMs, sync, log: () => {},
      });
    }));
    parentPort!.postMessage({ reports, attempts, timing, failureLines } satisfies CallResult);
  });
}
if (IN_WORKER) await shardWorker();

// Worker threads, each with its own pool (DATABASE_POOL_MAX is read when lib/db.ts loads in that thread).
function startWorkers(n: number, poolEach: number) {
  const workers = Array.from({ length: n }, () => new Worker(new URL(import.meta.url), {
    workerData: { loadShardWorker: true }, env: { ...process.env, DATABASE_POOL_MAX: String(poolEach) },
  }));
  const ask = (w: Worker, m: unknown) => new Promise<unknown>((resolve, reject) => {
    const onError = (e: Error) => reject(e);
    w.once('error', onError);
    w.once('message', (r) => { w.off('error', onError); resolve(r); });
    w.postMessage(m);
  });
  return {
    // One call: the shards dealt round-robin over the workers, all at once.
    async call(spec: CallSpec): Promise<CallResult> {
      const parts = workers.map((_, k) => spec.shards.filter((_, j) => j % workers.length === k));
      const results = await Promise.all(parts.map((shards, k) => shards.length ? ask(workers[k], { ...spec, shards }) as Promise<CallResult> : null));
      const out: CallResult = { reports: [], attempts: [], timing: { n: 0, syncMs: 0, vendorMs: 0 }, failureLines: 0 };
      for (const r of results) if (r) {
        out.reports.push(...r.reports);
        for (const x of r.attempts) out.attempts.push(x);
        out.timing.n += r.timing.n; out.timing.syncMs += r.timing.syncMs; out.timing.vendorMs += r.timing.vendorMs;
        out.failureLines += r.failureLines;
      }
      return out;
    },
    async end() { await Promise.all(workers.map((w) => ask(w, 'end'))); await Promise.all(workers.map((w) => w.terminate())); },
  };
}

// ---- The tests (main thread). ----
const tag = `ls${Math.random().toString(36).slice(2, 7).padEnd(5, '0')}`; // handles `${tag}${i}`: at most 12 characters
const prefix = `${tag}v`; // vendor user ids and account ids start with it
const ID_BASE = 1_900_000_000; // explicit trader ids live above this (see bulkTraders)
let fake: ChildProcess | null = null;
let base = ''; // the fake's, on a free port (port 0), as its process reports it
const made: [number, number][] = []; // id ranges created
let attemptId: number | null = null;
let secretEnc = '';
const shardRows: [number, number][] = []; // sync_shards rows this file created
let budget = { maxConnections: 0, free: 0 };

const post = async (path: string, body: unknown) => {
  const r = await fetch(`${base}${path}`, { method: 'POST', body: JSON.stringify(body) });
  assert.equal(r.status, 200, `${path} answered ${r.status}`);
  return r.json();
};
// Deletes in slices: each cascades to the traders' activities, closed trades, connections and account claims.
async function deleteTraders(where: (lo: number, hi: number) => Promise<unknown>, lo: number, hi: number) {
  for (let x = lo; x <= hi; x += 10_000) await where(x, Math.min(hi, x + 9_999));
}

if (!IN_WORKER) {
  before(async () => {
    if (!LOAD || !hasDb) return;
    const postgres = (await import('postgres')).default;
    const probe = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
    const [s] = await probe`select current_setting('max_connections')::int as max, current_setting('superuser_reserved_connections')::int as reserved,
      (select count(*)::int from pg_stat_activity where backend_type = 'client backend') as used`;
    await probe.end();
    budget = { maxConnections: s.max, free: s.max - s.reserved - s.used - 10 }; // 10 stay free for other clients
    process.env.DATABASE_POOL_MAX = String(MAIN_POOL);
    const { sql } = await import('./db.ts');
    await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
    // Traders a killed earlier run of this file left behind (its `after` never ran): same id range, handle and name.
    const [old] = await sql`select min(id)::int as lo, max(id)::int as hi from users where id >= ${ID_BASE} and display_name = 'Load trader' and handle ~ '^ls[a-z0-9]{5}'`;
    if (old.lo !== null) {
      const mine = (a: number, b: number) => sql`select id from users where id between ${a} and ${b} and display_name = 'Load trader' and handle ~ '^ls[a-z0-9]{5}'`;
      await deleteTraders((a, b) => sql`delete from broker_accounts where user_id in (${mine(a, b)})`, old.lo, old.hi);
      await deleteTraders((a, b) => sql`delete from connections where user_id in (${mine(a, b)})`, old.lo, old.hi);
      await deleteTraders((a, b) => sql`delete from users where id in (${mine(a, b)})`, old.lo, old.hi);
    }
    // The fake runs in its own process, so its event loop never competes with the shards'.
    const vendor = fileURLToPath(new URL('../e2e/fakes/vendor.ts', import.meta.url));
    fake = spawn(process.execPath, ['--input-type=module', '-e',
      `const { startVendorFake } = await import(${JSON.stringify(vendor)}); const f = await startVendorFake(0); console.log('ready ' + f.base);`], { stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise<void>((resolve, reject) => {
      let out = '';
      fake!.stdout!.on('data', (d: Buffer) => { out += d.toString(); const m = /ready (\S+)\n/.exec(out); if (m) { base = m[1]; resolve(); } });
      fake!.on('exit', (c) => reject(new Error(`vendor fake exited ${c}`)));
    });
    process.env.SNAPTRADE_BASE_URL = base;
    process.env.SNAPTRADE_CLIENT_ID = 'test';
    process.env.SNAPTRADE_CONSUMER_KEY = 'test-consumer';
    process.env.APP_SECRET_KEY ??= 'load-test-secret';
    // One real registration through lib/broker.ts gives a valid encrypted secret; the fake ignores secrets, so every
    // synthetic trader stores this one.
    secretEnc = (await (await import('./broker.ts')).registerUser(`${tag}-load`)).secretEnc;
    const [a] = await sql`insert into signup_attempts (method, adult_attested_at, completed_at) values ('dev', now(), now()) returning id`;
    attemptId = Number(a.id);
  });
  after(async () => {
    if (!LOAD || !hasDb) return;
    const { sql } = await import('./db.ts');
    const t0 = performance.now();
    // Claims, then connections, then users: broker_accounts.connection_id (on delete set null) has no index, so a
    // connection deleted while the claims are still there scans broker_accounts (O(n^2) at 100,000 traders).
    for (const [lo, hi] of made) {
      await deleteTraders((a, b) => sql`delete from broker_accounts where user_id between ${a} and ${b}`, lo, hi);
      await deleteTraders((a, b) => sql`delete from connections where user_id between ${a} and ${b}`, lo, hi);
      await deleteTraders((a, b) => sql`delete from users where id between ${a} and ${b} and handle like ${`${tag}%`}`, lo, hi);
    }
    await sql`delete from broker_accounts where account_id like ${`${tag}%`}`;
    if (attemptId) await sql`delete from signup_attempts where id = ${attemptId}`;
    for (const [of, shard] of shardRows) await sql`delete from sync_shards where of = ${of} and shard = ${shard}`;
    log(`cleanup ${ms(t0)} ms`);
    fake?.kill();
    await sql.end({ timeout: 1 });
  });
}

// Bulk setup in SQL: `n` traders with vendor ids `${p}${i}`, a connected connection each with its accounts' snapshot (the
// same rule as the fake's: accounts[i % accounts.length] accounts `${p}${i}-a${j}` under `${p}${i}-auth`). All share one
// signup attempt (users.signup_attempt_id is not unique), so signup_attempts does not grow by 100,000 rows.
async function bulkTraders(p: string, handlePrefix: string, n: number, accounts: number[]) {
  const { sql } = await import('./db.ts');
  // Explicit ids far above the identity sequence: other sessions may insert users meanwhile, so a sequence range could
  // interleave with theirs, and `idRange` must cover this file's traders only. Trader i is id lo + i.
  const lo = ID_BASE + Math.floor(Math.random() * 60_000) * 3200; // a multiple of 40 (and 32): trader i is in shard i % 40
  const [r] = await sql`with ins as (
      insert into users (id, handle, display_name, adult_attested_at, snaptrade_user_id, snaptrade_secret_enc, signup_attempt_id)
      overriding system value
      select ${lo}::int + g, ${handlePrefix} || g, 'Load trader', now(), ${p} || g, ${secretEnc}, ${attemptId} from generate_series(0, ${n - 1}::int) g
      returning id)
    select min(id)::int as lo, max(id)::int as hi, count(*)::int as n from ins`;
  made.push([r.lo, r.hi]);
  assert.equal(r.lo, lo);
  assert.equal(r.hi - r.lo + 1, n, 'the ids are one contiguous range');
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, institution, state, pending_at, consent_at, importing_at, connected_at, accounts)
    select ${attemptId}, u.id, u.snaptrade_user_id || '-auth', 'Fake Brokerage', 'connected', now() - interval '3 hours', now() - interval '3 hours', now() - interval '3 hours', now() - interval '3 hours',
      (select jsonb_agg(jsonb_build_object('id', u.snaptrade_user_id || '-a' || j, 'authorizationId', u.snaptrade_user_id || '-auth',
        'institution', 'Fake Brokerage', 'isPaper', false, 'initialSyncCompleted', true))
       from generate_series(0, (${sql.json(accounts)}::jsonb ->> ((u.id - ${r.lo}::int) % ${accounts.length}::int))::int - 1) j)
    from users u where u.id between ${r.lo} and ${r.hi}`;
  await sql`analyze users`;
  await sql`analyze connections`;
  return { lo: r.lo as number, hi: r.hi as number };
}
async function noteShardRows(of: number, shards: number[]) {
  const { sql } = await import('./db.ts');
  const have = new Set((await sql`select shard from sync_shards where of = ${of}`).map((x) => x.shard as number));
  for (const s of shards) if (!have.has(s)) shardRows.push([of, s]);
}
// Peak database connections (every client of this database) while `fn` runs.
async function peakConnections<T>(fn: () => Promise<T>): Promise<{ value: T; peak: number }> {
  const { sql } = await import('./db.ts');
  let peak = 0, busy = false;
  const sample = async () => {
    if (busy) return;
    busy = true;
    try { peak = Math.max(peak, (await sql`select count(*)::int as n from pg_stat_activity where datname = current_database()`)[0].n); } catch { /* sampling only */ } finally { busy = false; }
  };
  const timer = setInterval(() => { void sample(); }, 250);
  try { return { value: await fn(), peak }; } finally { clearInterval(timer); await sample(); }
}
// The shard's page query (lib/sync-shard.ts#page), explained on the real 100,000 rows.
async function explainPage(shard: number, range: [number, number], shiftMs: number) {
  const { sql } = await import('./db.ts');
  const { clockSql, syncable, claimable, accountsOf, SYNC_FIT_CAP } = await import('./sync.ts');
  const rows = await sql`explain (analyze, buffers) with clock as (${clockSql(shiftMs)})
    select u.id, least(${accountsOf()}, ${SYNC_FIT_CAP})::int as accounts from users u, clock
    where ${syncable()} and u.id % ${MODEL.of}::int = ${shard}::int
      and u.id between ${range[0]} and ${range[1]} and ${claimable()} and (u.sync_retry_at is null or u.sync_retry_at <= clock.t)
    order by u.last_synced_at nulls first, u.id limit ${MODEL.page}`;
  const plan = rows.map((r) => r['QUERY PLAN'] as string);
  const exec = Number(plan.find((l) => l.startsWith('Execution Time'))?.match(/[\d.]+/)?.[0] ?? NaN);
  return { exec, plan };
}

loadTest('100,000 traders, 40 shards x 6 workers, 2-account mix, 1% slow, 0.1% failing, scaled latency: one round covers every healthy trader exactly once with >= 1.5x headroom (whole calls >= 1.15x); slow traders retried next round, failing ones backed off', async () => {
  const { sql } = await import('./db.ts');
  const { ROUND_MS } = await import('./sync.ts');
  const M = MODEL;

  // Connections: a shard's 6 workers hold at most one connection each at a time (a sync's transaction, or a claim, page
  // or release between syncs); each worker thread's pool adds 2 for heartbeats and page reads; the test thread keeps its
  // own. Batches of equal size, as many shards at once as the server holds (all 40 on a server sized for production).
  const threads = Math.max(1, availableParallelism() - 1); // one core for the database and the fake
  const fit = Math.max(1, Math.min(M.of, Math.floor((budget.free - MAIN_POOL - 2 * threads) / M.concurrency)));
  const batchCount = Math.ceil(M.of / fit);
  const atOnce = Math.ceil(M.of / batchCount);
  const workerCount = Math.min(threads, atOnce);
  const poolEach = Math.ceil(atOnce / workerCount) * M.concurrency + 2;
  assert.ok(poolEach >= M.concurrency + 2, 'a worker pool holds a shard without clamping');
  const shards = Array.from({ length: M.of }, (_, s) => s);
  const batches = Array.from({ length: batchCount }, (_, b) => shards.slice(b * atOnce, (b + 1) * atOnce));

  // Setup.
  const s0 = performance.now();
  const range = await bulkTraders(prefix, tag, M.traders, M.accounts);
  await post('/_bulk', { prefix, from: 0, to: M.traders - 1, accounts: M.accounts, activities: 1,
    slowEvery: M.slow.every, slowOffset: M.slow.offset, slowMs: M.slow.ms, failEvery: M.fail.every, failOffset: M.fail.offset, failStatus: M.fail.status });
  await post('/_latency', { ms: M.latencyMs });
  await noteShardRows(M.of, shards);
  const setupMs = ms(s0);
  const kinds = { healthy: [] as number[], slow: [] as number[], fail: [] as number[] };
  for (let i = 0; i < M.traders; i++) kinds[kindOf(i)].push(range.lo + i);
  const accountsOfId = (id: number) => M.accounts[(id - range.lo) % M.accounts.length];
  log(`setup: ${M.traders} traders (${kinds.healthy.length} healthy, ${kinds.slow.length} slow, ${kinds.fail.length} failing; half 1 account, half 2 in every shard) in ${setupMs} ms; ` +
    `K = ${K}: latency ${M.latencyMs} ms a request, bound ${M.boundMs} ms, window ${M.routeMs} ms with ${M.reserveMs} ms reserve, jitter ${M.jitterMs} ms, ${M.rps} req/s per shard; ` +
    `max_connections ${budget.maxConnections}: ${atOnce} shards at once (${batchCount} batches) on ${workerCount} worker threads, pool ${poolEach} each`);

  const config: RunConfig = { concurrency: M.concurrency, rps: M.rps, burst: M.rps, page: M.page };
  // A round's database clock: five minutes (round 1) or one minute (round 2) after a past round's :30 start, moving
  // with real time from the round's start (a constant shift).
  const hourMark = Math.floor(Date.now() / ROUND_MS) * ROUND_MS;
  const roundShift = (r: number, minutes: number) => hourMark - (12 - r) * ROUND_MS + 30 * 60_000 + minutes * 60_000 - Date.now();
  const attempts = [new Map<number, number>(), new Map<number, number>(), new Map<number, number>()];
  const shardSeen = new Map<number, Set<number>>();
  const reports: (Report & { round: number; call: number })[] = [];
  const timing = { n: 0, syncMs: 0, vendorMs: 0 };
  let failureLines = 0;
  type CallStat = { done: number; transient: number; failed: number; deferred: number; requests: number; tokenWaitMs: number; maxMs: number };
  const callStats = new Map<number, CallStat>(); // round 1, by call number, over every shard
  const record = (round: number, call: number, res: CallResult) => {
    for (let j = 0; j < res.attempts.length; j += 2) {
      const id = res.attempts[j], shard = res.attempts[j + 1];
      attempts[round].set(id, (attempts[round].get(id) ?? 0) + 1);
      let seen = shardSeen.get(id);
      if (!seen) shardSeen.set(id, seen = new Set());
      seen.add(shard);
    }
    failureLines += res.failureLines;
    for (const rep of res.reports) reports.push({ ...rep, round, call });
    if (round === 1) {
      timing.n += res.timing.n; timing.syncMs += res.timing.syncMs; timing.vendorMs += res.timing.vendorMs;
      const c = callStats.get(call) ?? { done: 0, transient: 0, failed: 0, deferred: 0, requests: 0, tokenWaitMs: 0, maxMs: 0 };
      for (const rep of res.reports) {
        c.done += rep.done; c.transient += rep.transient; c.failed += rep.failed; c.deferred += rep.deferred; c.requests += rep.requests;
        c.tokenWaitMs += rep.tokenWaitMs; c.maxMs = Math.max(c.maxMs, rep.ms);
      }
      callStats.set(call, c);
    }
  };

  const pool = startWorkers(workerCount, poolEach);
  const t0 = performance.now();
  try {
    const explainStart = await explainPage(0, [range.lo, range.hi], roundShift(1, 5));
    log(`page query (shard 0, 100,000 rows, nothing synced): ${explainStart.exec} ms; plan: ${explainStart.plan.slice(0, 3).map((l) => l.trim()).join(' | ')}`);

    // Round 1: up to 11 calls per shard, until each shard has nothing claimable left.
    const shift1 = roundShift(1, 5);
    const callsUsed = new Map<number, number>();
    const activeMs = new Map<number, number>(); // per shard: the time of its runs that did work
    const { peak: peak1 } = await peakConnections(async () => {
      for (const batch of batches) {
        let open = [...batch];
        for (let call = 1; call <= M.callsPerRound && open.length; call++) {
          const res = await pool.call({ shards: open, of: M.of, shiftMs: shift1, idRange: [range.lo, range.hi], config, boundMs: M.boundMs,
            routeMs: M.routeMs, reserveMs: M.reserveMs, jitterMs: M.jitterMs });
          record(1, call, res);
          for (const rep of res.reports) {
            if (rep.done + rep.transient + rep.failed > 0) activeMs.set(rep.shard, (activeMs.get(rep.shard) ?? 0) + rep.ms);
            if (rep.remaining === 0) callsUsed.set(rep.shard, call);
          }
          open = open.filter((s) => !callsUsed.has(s));
        }
      }
    });
    const round1Ms = ms(t0);
    const r1 = reports.filter((r) => r.round === 1);
    for (const [call, c] of [...callStats].sort((a, b) => a[0] - b[0])) {
      log(`round 1 call ${call}: done ${c.done}, transient ${c.transient}, failed ${c.failed}, deferred ${c.deferred}, requests ${c.requests}, token wait ${c.tokenWaitMs} ms (all shards), longest run ${c.maxMs} ms (window ${M.routeMs})`);
    }
    const sum = (k: keyof RunReport) => r1.reduce((a, r) => a + (r[k] as number), 0);
    const perShard = shards.map((s) => r1.filter((r) => r.shard === s).reduce((a, r) => a + r.done, 0) / ((activeMs.get(s) ?? 1) / 1000));
    const usersPerSec = perShard.reduce((a, b) => a + b, 0) / perShard.length;
    const worstCalls = Math.max(...shards.map((s) => callsUsed.get(s) ?? Infinity));
    const attemptsOf = (r: Report) => r.done + r.transient + r.failed;
    const fractional = shards.map((s) => {
      const runs = r1.filter((r) => r.shard === s);
      const full = runs.filter((r) => r.stoppedAtDeadline);
      if (!full.length) return runs.length;
      const perCall = full.reduce((a, r) => a + attemptsOf(r), 0) / full.length;
      return full.length + runs.filter((r) => !r.stoppedAtDeadline).reduce((a, r) => a + attemptsOf(r), 0) / perCall;
    });
    const worstFractional = Math.max(...fractional);
    const reqPer = sum('requests') / (sum('done') + sum('transient') + sum('failed'));
    const designRate = Math.min(M.concurrency / (reqPer * M.latencyMs / 1000), M.rps / reqPer); // reqPer: 1 + 3n, measured
    const healthyPerShard = kinds.healthy.length / M.of;
    const vendorPer = timing.vendorMs / timing.n, dbPer = (timing.syncMs - timing.vendorMs) / timing.n;
    // Production speed: the vendor part times K, the database part as measured here (not scaled).
    const lProd = (vendorPer * K + dbPer) / 1000;
    const prodRate = Math.min(M.concurrency / lProd, (M.rps / K) / reqPer);
    log(`round 1: ${round1Ms} ms; calls used per shard: fractional max ${worstFractional.toFixed(2)} of ${M.callsPerRound} (headroom ${(M.callsPerRound / worstFractional).toFixed(2)}x), ` +
      `whole max ${worstCalls} (headroom ${(M.callsPerRound / worstCalls).toFixed(2)}x; per shard ${shards.map((s) => callsUsed.get(s) ?? '-').join(',')}); ` +
      `done ${sum("done")}, cut ${sum("cutAtDeadline")}, transient ${sum('transient')}, failed ${sum('failed')}, refused ${sum('refused')}, quarantined ${sum('quarantined')}, skipped ${sum('skipped')}, deferred ${sum('deferred')}, releaseFailed ${sum('releaseFailed')}, ` +
      `requests ${sum('requests')} (${reqPer.toFixed(2)} a trader), pages ${sum('pages')}, token wait ${sum('tokenWaitMs')} ms, breaker ${r1.some((r) => r.breaker)}, lease lost ${r1.some((r) => r.leaseLost)}, aborted ${r1.some((r) => r.aborted)}; ` +
      `peak database connections ${peak1}; failure lines ${failureLines}`);
    log(`a healthy trader's sync: ${(timing.syncMs / timing.n).toFixed(0)} ms = vendor ${vendorPer.toFixed(0)} ms (scaled by K) + database ${dbPer.toFixed(0)} ms (not scaled)`);
    log(`per shard: ${usersPerSec.toFixed(1)} traders/s while dispatching, scaled time (min ${Math.min(...perShard).toFixed(1)}, max ${Math.max(...perShard).toFixed(1)}; design min(C/L, RPS/requests) = ${designRate.toFixed(1)} at K = ${K} with no database time); ` +
      `at production speed L_trader = ${lProd.toFixed(2)} s, so min(C/L = ${(M.concurrency / lProd).toFixed(2)}, RPS/requests = ${((M.rps / K) / reqPer).toFixed(2)}) = ${prodRate.toFixed(2)} traders/s per shard; ` +
      `measured: ${Math.round(M.traders / M.of)} traders a shard took ${worstFractional.toFixed(2)} calls' work (${worstCalls} whole calls) of ${M.callsPerRound}, so a round covers about ${Math.round(M.traders / M.of * M.callsPerRound / worstFractional)} a shard, ` +
      `${Math.round(M.traders * M.callsPerRound / worstFractional).toLocaleString('en-US')} on ${M.of} shards (${(M.callsPerRound / worstFractional).toFixed(2)}x the ${M.traders.toLocaleString('en-US')}); ` +
      `production holds ${M.of} x (${M.concurrency} + 2) = ${M.of * (M.concurrency + 2)} connections at once (this run: ${atOnce} shards at once, peak ${peak1})`);

    // Coverage and exactly-once.
    assert.ok(r1.every((r) => !r.busy && !r.breaker && !r.leaseLost && !r.aborted), 'no run busy, broken, fenced or aborted');
    assert.equal(sum('quarantined'), 0);
    assert.equal(sum('releaseFailed'), 0);
    assert.equal(sum('done'), kinds.healthy.length, 'every healthy trader synced');
    assert.equal(sum('transient'), kinds.slow.length, 'every slow trader timed out once (transient)');
    assert.equal(sum('failed'), kinds.fail.length, 'every failing trader failed once (trader-specific)');
    assert.deepEqual(r1.flatMap((r) => r.failedIds).sort((a, b) => a - b), [...kinds.slow, ...kinds.fail].sort((a, b) => a - b), 'the failed ids are the slow and failing traders');
    // Committee round 3: a sync refused at a call's end (cutAtDeadline: rolled back, nothing published) is attempted again
    // by a later call of the round; every other trader is attempted exactly once, and every sync that ran, ran once.
    const all = [...kinds.healthy, ...kinds.slow, ...kinds.fail];
    const never = all.filter((id) => !attempts[1].get(id));
    assert.equal(never.length, 0, `every trader attempted in round 1 (${never.length} not)`);
    const extra = all.reduce((a, id) => a + (attempts[1].get(id)! - 1), 0);
    assert.equal(extra, sum('cutAtDeadline'), 'attempts beyond one per trader are exactly the syncs cut at a call\'s end');
    // Orchestrator review: cuts are bounded, not just accounted for: at most 0.1% of the fleet in a round (measured 0)
    // and no trader cut more than once.
    assert.ok(sum('cutAtDeadline') <= M.traders / 1000, `cuts ${sum('cutAtDeadline')}`);
    assert.ok(all.every((id) => attempts[1].get(id)! <= 2), 'no trader cut twice in a round');
    assert.equal(attempts[1].size, M.traders, 'no trader outside the range attempted');
    const wrongShard = [...shardSeen].filter(([id, s]) => s.size !== 1 || !s.has(id % M.of));
    assert.equal(wrongShard.length, 0, 'every trader in exactly its own shard: shards disjoint');
    assert.ok(r1.every((r) => r.ms <= M.routeMs), `every run fits its window (${Math.max(...r1.map((r) => r.ms))} ms of ${M.routeMs})`);
    const [db1] = await sql`select
        count(*) filter (where last_synced_at is not null)::int as synced,
        count(*) filter (where sync_failure_kind = 'trader' and sync_failures = 1 and sync_retry_at is not null)::int as backed,
        count(*) filter (where sync_retry_at is null and sync_failures = 0 and sync_claimed_at is not null and last_synced_at is null)::int as transient,
        count(*) filter (where sync_lease_until is not null or sync_attempts <> 0)::int as leftover
      from users where id between ${range.lo} and ${range.hi}`;
    assert.equal(db1.synced, kinds.healthy.length);
    assert.equal(db1.backed, kinds.fail.length, 'failing traders backed off');
    assert.equal(db1.transient, kinds.slow.length, 'slow traders keep their round claim, with no backoff');
    assert.equal(db1.leftover, 0, 'no lease or attempt left behind');
    const [acts] = await sql`select count(*)::int as n from activities where user_id between ${range.lo} and ${range.hi}`;
    const [trades] = await sql`select count(*)::int as n from closed_trades where user_id between ${range.lo} and ${range.hi}`;
    const healthyAccounts = kinds.healthy.reduce((a, id) => a + accountsOfId(id), 0);
    assert.equal(acts.n, healthyAccounts * 2, 'two activities per account read');
    assert.equal(trades.n, healthyAccounts, 'one closed trade per account');
    assert.ok(Number.isFinite(worstCalls), 'every shard emptied its queue within the round');
    assert.ok(worstFractional <= M.callsPerRound / BOUNDS.headroom, `calls' work ${worstFractional.toFixed(2)} of ${M.callsPerRound}: headroom ${(M.callsPerRound / worstFractional).toFixed(2)}x < ${BOUNDS.headroom}x`);
    assert.ok(worstCalls <= M.callsPerRound / BOUNDS.wholeCallHeadroom, `whole calls ${worstCalls} of ${M.callsPerRound}: headroom ${(M.callsPerRound / worstCalls).toFixed(2)}x < ${BOUNDS.wholeCallHeadroom}x`);

    // Round 2: the slow traders' vendor recovers. The round is scoped to the slow and failing traders (re-syncing all
    // 100,000 would only repeat round 1): slow traders are retried and synced; failing ones are still backed off.
    await post('/_bulk', { prefix, from: 0, to: M.traders - 1, accounts: M.accounts, activities: 1, failEvery: M.fail.every, failOffset: M.fail.offset, failStatus: M.fail.status });
    const shift2 = roundShift(2, 1);
    const explain2 = await explainPage(0, [range.lo, range.hi], shift2);
    log(`page query (shard 0, round 2, every healthy trader synced once): ${explain2.exec} ms`);
    const ids2 = [...kinds.slow, ...kinds.fail];
    const t2 = performance.now();
    const { peak: peak2 } = await peakConnections(async () => {
      for (const batch of batches) record(2, 1, await pool.call({ shards: batch, of: M.of, shiftMs: shift2, idRange: [range.lo, range.hi], ids: ids2, config,
        boundMs: M.boundMs, routeMs: M.routeMs, reserveMs: M.reserveMs, jitterMs: M.jitterMs }));
    });
    const r2 = reports.filter((r) => r.round === 2);
    const sum2 = (k: keyof RunReport) => r2.reduce((a, r) => a + (r[k] as number), 0);
    log(`round 2 (slow and failing traders only, one call): ${ms(t2)} ms; done ${sum2('done')}, transient ${sum2('transient')}, failed ${sum2('failed')}, in backoff ${sum2('inBackoff')}, remaining ${sum2('remaining')}; peak connections ${peak2}`);
    assert.equal(sum2('done'), kinds.slow.length, 'every slow trader synced next round');
    assert.equal(kinds.slow.filter((id) => attempts[2].get(id) !== 1).length, 0, 'each slow trader attempted once in round 2');
    assert.equal(kinds.fail.filter((id) => attempts[2].has(id)).length, 0, 'no failing trader retried while backed off');
    assert.equal(sum2('inBackoff'), kinds.fail.length);
    assert.equal(sum2('remaining'), 0);
    const [db2] = await sql`select count(*)::int as n from users where id in ${sql(kinds.slow)} and last_synced_at is not null and sync_retry_at is null and sync_failures = 0`;
    assert.equal(db2.n, kinds.slow.length);
    log(`main test: ${ms(t0)} ms after setup; peak database connections ${Math.max(peak1, peak2)} (max_connections ${budget.maxConnections})`);
  } finally {
    await pool.end();
    await post('/_latency', { ms: 0 });
    await post('/_bulk', { prefix, clear: true });
  }
});

loadTest('latency model: one shard, real-time vendor latency 200–500 ms, rps 12, concurrency 6: throughput within ±25% of min(C / L_trader, RPS / requests_per_trader)', async () => {
  const { ROUND_MS } = await import('./sync.ts');
  const { VENDOR_TIMEOUT_MS } = await import('./broker.ts');
  const L = LATENCY;
  const p = `${tag}m`;
  const range = await bulkTraders(p, `${tag}m`, L.traders, MODEL.accounts);
  await post('/_bulk', { prefix: p, from: 0, to: L.traders - 1, accounts: MODEL.accounts, activities: 1 });
  await post('/_latency', { ms: L.ms, jitterMs: L.jitterMs });
  await noteShardRows(1, [0]);
  const pool = startWorkers(1, L.concurrency + 4);
  try {
    const shiftMs = Math.floor(Date.now() / ROUND_MS) * ROUND_MS - 20 * ROUND_MS + 35 * 60_000 - Date.now();
    const before = (await (await fetch(`${base}/_stats`)).json()).requests as number;
    const { reports: [rep] } = await pool.call({ shards: [0], of: 1, shiftMs, idRange: [range.lo, range.hi], boundMs: VENDOR_TIMEOUT_MS,
      config: { concurrency: L.concurrency, rps: L.rps, burst: L.rps, page: MODEL.page } });
    const took = rep.ms / 1000;
    const vendorRequests = (await (await fetch(`${base}/_stats`)).json()).requests - before;
    const requestsPerTrader = rep.requests / rep.done;
    const meanLatency = (L.ms + L.jitterMs / 2) / 1000;
    // A trader's sync makes its requests one after another: L_trader = requests x mean latency (database time aside).
    const lTrader = requestsPerTrader * meanLatency;
    const predicted = Math.min(L.concurrency / lTrader, L.rps / requestsPerTrader);
    const measured = rep.done / took;
    log(`latency model: ${rep.done} traders in ${took.toFixed(1)} s = ${measured.toFixed(2)} traders/s; ${requestsPerTrader.toFixed(2)} requests a trader (vendor saw ${vendorRequests}), L_trader ${lTrader.toFixed(2)} s; ` +
      `predicted min(C/L = ${(L.concurrency / lTrader).toFixed(2)}, RPS/requests = ${(L.rps / requestsPerTrader).toFixed(2)}) = ${predicted.toFixed(2)} (measured ${((measured / predicted - 1) * 100).toFixed(1)}%); token wait ${rep.tokenWaitMs} ms`);
    assert.equal(rep.done, L.traders);
    assert.equal(vendorRequests, rep.requests, 'every request the run counted reached the vendor');
    assert.ok(Math.abs(measured / predicted - 1) <= BOUNDS.modelTolerance, `measured ${measured.toFixed(2)} vs predicted ${predicted.toFixed(2)}`);
  } finally {
    await pool.end();
    await post('/_latency', { ms: 0 });
    await post('/_bulk', { prefix: p, clear: true });
  }
});
