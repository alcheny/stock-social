// Sharded hourly sync load test (committee docs/features/logs/sync/committee-2026-11-01.md, row T and round 2): 100,000
// synthetic traders against the in-repo vendor fake (e2e/fakes/vendor.ts, its `/_bulk` control), a 2-account mix, 1% slow
// traders whose vendor calls exceed the request bound, 0.1% traders the vendor answers 400, with vendor latency, every
// shard of the production plan (docs/SYNC.md: 32 shards x 6 workers, 10 req/s per shard), asserting full coverage of a
// round with >= 1.5x headroom; plus a latency-model test in real time.
// Skipped unless LOAD=1 (and DATABASE_URL), so `npm test` stays fast. How to run:
//   set -a && . ./.env && set +a && LOAD=1 node --test lib/sync-shard.load.test.ts
// Timings and counters print as `# load: …` lines.
//
// The time-scaled model (main test). Everything that is time scales by K = 10, so a production hour is simulated in
// about 6 minutes and the shard's work per call is the production one: vendor latency per request 0.5 s / K (the plan's
// p95, applied to every request: conservative), the request bound 30 s / K (vendorTimeout.ms), a call's window the
// route's 300 s / K with the 90 s / K reserve (deadline, routeEnd, vendorBoundMs), the start jitter 15 s / K, and the
// vendor budget 10 x K requests a second per shard. Concurrency (6) and the shard count (32) are the plan's. Leases,
// backoff and the database's round (1 h) are not scaled: each simulated round runs on its own shifted database clock
// (`shiftMs`), and the database's own work per trader is not scaled either (it is real time, which is what the test
// measures as headroom: a database that cannot keep up at K x the production rate shows as more calls used).
// One process cannot hold 32 x 8 connections when the server's max_connections is lower (100 on a development
// container): the shards then run in batches of SHARDS_AT_ONCE, each batch through its own simulated round on the same
// round clock. Shards are disjoint (asserted), so a batch's outcome is exactly what those shards would do with the others
// running in other processes; the per-shard figures are what the plan multiplies, and the log extrapolates them.
// The cron: a round is 11 calls; each call is one runShard per shard (concurrently), each with its own scaled window.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RunReport } from './sync-shard.ts';
import type { Broker, SyncableUser } from './sync.ts';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const loadTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !LOAD ? 'sharded-sync load suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 1_200_000 }, fn);

export const K = 10;
export const MODEL = {
  traders: Number(process.env.LOAD_TRADERS) || 100_000, of: 32, concurrency: 6, rps: 10 * K, page: 500,
  latencyMs: 500 / K, boundMs: 30_000 / K, routeMs: 300_000 / K, reserveMs: 90_000 / K, jitterMs: 15_000 / K,
  callsPerRound: 11,
  accounts: [1, 2], // trader i has accounts[i % 2]: half 1 account, half 2 (4 vendor requests a trader on average)
  slow: { every: 100, offset: 37, ms: 2 * 30_000 / K }, // 1%: every request held twice the bound (a timeout: transient)
  fail: { every: 1000, offset: 501, status: 400 }, // 0.1%: the vendor answers 400 (trader-specific: backed off)
};
// The latency-model test (real time, one shard).
export const LATENCY = { traders: 150, concurrency: 6, rps: 10, ms: 200, jitterMs: 300 }; // uniform 200–500 ms a request
// The bounds (asserted). Headroom: a round's calls used are at most 11 / 1.5 (the committee's >= 1.5x). The latency
// model's measured throughput is within ±25% of min(C / L_trader, RPS / requests_per_trader).
export const BOUNDS = { headroom: 1.5, modelTolerance: 0.25 };

const log = (s: string) => console.log(`# load: ${s}`);
const ms = (t0: number) => Math.round(performance.now() - t0);
const PORT = 5800 + Math.floor(Math.random() * 500);
const tag = `ls${Math.random().toString(36).slice(2, 7)}`; // handles `${tag}${i}`: at most 12 characters
const prefix = `${tag}v`; // vendor user ids and account ids start with it
let fake: ChildProcess | null = null;
const base = `http://127.0.0.1:${PORT}`;
const made: [number, number][] = []; // id ranges created
let attemptId: number | null = null;
let secretEnc = '';
const shardRows: [number, number][] = []; // sync_shards rows this file created
let SHARDS_AT_ONCE = 1;
let maxConnections = 0;

const post = async (path: string, body: unknown) => {
  const r = await fetch(`${base}${path}`, { method: 'POST', body: JSON.stringify(body) });
  assert.equal(r.status, 200, `${path} answered ${r.status}`);
  return r.json();
};

before(async () => {
  if (!LOAD || !hasDb) return;
  // The pool is sized before lib/db.ts is imported: a sync holds one connection for its transaction, so SHARDS_AT_ONCE
  // shards of 6 workers need 6 each plus one for the heartbeat or a page read, below the server's max_connections.
  const postgres = (await import('postgres')).default;
  const probe = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const [s] = await probe`select current_setting('max_connections')::int as max, current_setting('superuser_reserved_connections')::int as reserved,
    (select count(*)::int from pg_stat_activity where backend_type = 'client backend') as used`;
  await probe.end();
  maxConnections = s.max;
  // A worker holds at most one connection at a time (its sync's transaction, or a claim, page or release statement
  // between syncs), so the pool is 6 per shard plus 4 for heartbeats and the sampler; 15 stay free for other clients.
  const free = s.max - s.reserved - s.used - 15;
  const want = Number(process.env.LOAD_SHARDS_AT_ONCE) || MODEL.of;
  SHARDS_AT_ONCE = Math.max(1, Math.min(want, MODEL.of, Math.floor((free - 4) / MODEL.concurrency)));
  process.env.DATABASE_POOL_MAX = String(Math.max(MODEL.concurrency + 2, SHARDS_AT_ONCE * MODEL.concurrency + 4));
  const { sql, POOL_MAX } = await import('./db.ts');
  assert.ok(POOL_MAX >= MODEL.concurrency + 2, 'the pool holds a shard without clamping');
  await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
  // The fake runs in its own process, so its event loop never competes with the shards' (one machine, two cores used).
  const vendor = fileURLToPath(new URL('../e2e/fakes/vendor.ts', import.meta.url));
  fake = spawn(process.execPath, ['--input-type=module', '-e',
    `const { startVendorFake } = await import(${JSON.stringify(vendor)}); await startVendorFake(${PORT}); console.log('ready');`], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise<void>((resolve, reject) => {
    fake!.stdout!.on('data', (d: Buffer) => { if (d.toString().includes('ready')) resolve(); });
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
  for (const [lo, hi] of made) {
    // In slices: each delete cascades to the traders' activities, closed trades, connections and account claims.
    for (let x = lo; x <= hi; x += 10_000) await sql`delete from users where id between ${x} and ${Math.min(hi, x + 9_999)} and handle like ${`${tag}%`}`;
  }
  await sql`delete from broker_accounts where account_id like ${`${tag}%`}`;
  if (attemptId) await sql`delete from signup_attempts where id = ${attemptId}`;
  for (const [of, shard] of shardRows) await sql`delete from sync_shards where of = ${of} and shard = ${shard}`;
  log(`cleanup ${ms(t0)} ms`);
  fake?.kill();
  await sql.end({ timeout: 1 });
});

// Bulk setup in SQL: `n` traders with vendor ids `${p}${i}`, a connected connection each with its accounts' snapshot (the
// same rule as the fake's: accounts[i % accounts.length] accounts `${p}${i}-a${j}` under `${p}${i}-auth`). All share one
// signup attempt (users.signup_attempt_id is not unique), so signup_attempts does not grow by 100,000 rows that every
// later user delete would scan (signup_attempts.user_id has no index).
async function bulkTraders(p: string, handlePrefix: string, n: number, accounts: number[]) {
  const { sql } = await import('./db.ts');
  // Explicit ids in a range far above the identity sequence: other sessions may insert users meanwhile, so a sequence
  // range could interleave with theirs, and `idRange` must cover this file's traders only. Trader i is id lo + i.
  const lo = 1_900_000_000 + Math.floor(Math.random() * 2_000_000) * 100;
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
// Peak database connections (all clients of this database) while `fn` runs.
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
async function explainPage(shard: number, range: [number, number], shiftMs: number, ids?: number[]) {
  const { sql } = await import('./db.ts');
  const { clockSql, syncable, claimable, accountsOf, SYNC_FIT_CAP } = await import('./sync.ts');
  const rows = await sql`explain (analyze, buffers) with clock as (${clockSql(shiftMs)})
    select u.id, least(${accountsOf()}, ${SYNC_FIT_CAP})::int as accounts from users u, clock
    where ${syncable()} and u.id % ${MODEL.of}::int = ${shard}::int ${ids ? sql`and u.id in ${sql(ids)}` : sql``}
      and u.id between ${range[0]} and ${range[1]} and ${claimable()} and (u.sync_retry_at is null or u.sync_retry_at <= clock.t)
    order by u.last_synced_at nulls first, u.id limit ${MODEL.page}`;
  const plan = rows.map((r) => r['QUERY PLAN'] as string);
  const exec = Number(plan.find((l) => l.startsWith('Execution Time'))?.match(/[\d.]+/)?.[0] ?? NaN);
  return { exec, plan };
}

const kindOf = (i: number) => i % MODEL.fail.every === MODEL.fail.offset ? 'fail' : i % MODEL.slow.every === MODEL.slow.offset ? 'slow' : 'healthy';

loadTest('100,000 traders, 32 shards x 6 workers, 2-account mix, 1% slow, 0.1% failing, scaled latency: one round covers every healthy trader exactly once with >= 1.5x headroom; slow traders retried next round, failing ones backed off', async () => {
  const { sql } = await import('./db.ts');
  const { runShard } = await import('./sync-shard.ts');
  const { syncUser, ROUND_MS } = await import('./sync.ts');
  const broker = await import('./broker.ts');
  const M = MODEL;

  // Setup.
  const s0 = performance.now();
  const range = await bulkTraders(prefix, tag, M.traders, M.accounts);
  await post('/_bulk', { prefix, from: 0, to: M.traders - 1, accounts: M.accounts, activities: 1,
    slowEvery: M.slow.every, slowOffset: M.slow.offset, slowMs: M.slow.ms, failEvery: M.fail.every, failOffset: M.fail.offset, failStatus: M.fail.status });
  await post('/_latency', { ms: M.latencyMs });
  const setupMs = ms(s0);
  const idOf = (i: number) => range.lo + i;
  const kinds = { healthy: [] as number[], slow: [] as number[], fail: [] as number[] };
  for (let i = 0; i < M.traders; i++) kinds[kindOf(i)].push(idOf(i));
  const accountsOfId = (id: number) => M.accounts[(id - range.lo) % M.accounts.length];
  const shards = Array.from({ length: M.of }, (_, s) => s);
  await noteShardRows(M.of, shards);
  const batches: number[][] = [];
  for (let s = 0; s < M.of; s += SHARDS_AT_ONCE) batches.push(shards.slice(s, s + SHARDS_AT_ONCE));
  log(`setup: ${M.traders} traders (${kinds.healthy.length} healthy, ${kinds.slow.length} slow, ${kinds.fail.length} failing; accounts ${M.accounts.join('/')} alternating) in ${setupMs} ms; ` +
    `K = ${K}: latency ${M.latencyMs} ms a request, bound ${M.boundMs} ms, window ${M.routeMs} ms with ${M.reserveMs} ms reserve, jitter ${M.jitterMs} ms, ${M.rps} req/s per shard; ` +
    `max_connections ${maxConnections}, pool ${process.env.DATABASE_POOL_MAX}, ${SHARDS_AT_ONCE} shards at once (${batches.length} batches)`);

  // Counting: every sync attempt, by round, trader and shard.
  let round = 0;
  const attempts = [new Map<number, number>(), new Map<number, number>(), new Map<number, number>()];
  const shardSeen = new Map<number, Set<number>>();
  const makeSync = (shard: number) => async (u: SyncableUser, b: Broker) => {
    attempts[round].set(u.id, (attempts[round].get(u.id) ?? 0) + 1);
    let seen = shardSeen.get(u.id);
    if (!seen) shardSeen.set(u.id, seen = new Set());
    seen.add(shard);
    // Where a sync's time goes: its vendor calls (latency, timeouts) and the rest (the database: the transaction's
    // statements, waits for a pool connection). Only the vendor part is scaled by K.
    const t = performance.now();
    let vendor = 0;
    const timed = <A extends unknown[], R>(f: (...a: A) => Promise<R>) => async (...a: A) => { const v = performance.now(); try { return await f(...a); } finally { vendor += performance.now() - v; } };
    const wrapped: Broker = { pageLimit: b.pageLimit, listAccounts: timed(b.listAccounts), fetchActivities: timed(b.fetchActivities),
      ...(b.fetchActivitiesPage ? { fetchActivitiesPage: timed(b.fetchActivitiesPage) } : {}), ...(b.fetchPositions ? { fetchPositions: timed(b.fetchPositions) } : {}) };
    try { return await syncUser(u, wrapped); } finally {
      if (round === 1 && kindOf(u.id - range.lo) === 'healthy') { timing.n++; timing.syncMs += performance.now() - t; timing.vendorMs += vendor; }
    }
  };
  const timing = { n: 0, syncMs: 0, vendorMs: 0 };
  // A round's database clock: five minutes (round 1) or one minute (round 2) after a past round's :30 start, moving
  // with real time from the round's start.
  const hourMark = Math.floor(Date.now() / ROUND_MS) * ROUND_MS;
  const roundClock = (r: number, minutes: number) => {
    const at = hourMark - (12 - r) * ROUND_MS + 30 * 60_000 + minutes * 60_000, t0 = Date.now();
    return () => at + (Date.now() - t0) - Date.now();
  };
  // Failure lines are counted, not printed (1,100 of them).
  const errorLines = { failed: 0, other: 0 };
  const realError = console.error;
  console.error = (...a: unknown[]) => { if (String(a[0]).startsWith('sync failed')) errorLines.failed++; else { errorLines.other++; realError(...a); } };
  const reports: (RunReport & { failedIds: number[]; round: number; call: number })[] = [];
  vendorTimeout(broker, M.boundMs);
  type CallStat = { done: number; transient: number; failed: number; deferred: number; requests: number; tokenWaitMs: number; maxMs: number };
  const callStats = new Map<number, CallStat>(); // round 1, by call number, over every shard
  const runCall = async (shard: number, r: number, call: number, shift: () => number, ids?: number[]) => {
    const start = Date.now();
    const rep = await runShard({
      shard: { shard, of: M.of }, config: { concurrency: M.concurrency, rps: M.rps, burst: M.rps, page: M.page },
      deadline: start + M.routeMs - M.reserveMs, routeEnd: start + M.routeMs, vendorBoundMs: M.boundMs, jitterMs: M.jitterMs,
      idRange: [range.lo, range.hi], ids, shiftMs: shift, sync: makeSync(shard), log: () => {},
    });
    reports.push({ ...rep, round: r, call });
    if (r === 1) {
      const c = callStats.get(call) ?? { done: 0, transient: 0, failed: 0, deferred: 0, requests: 0, tokenWaitMs: 0, maxMs: 0 };
      c.done += rep.done; c.transient += rep.transient; c.failed += rep.failed; c.deferred += rep.deferred; c.requests += rep.requests;
      c.tokenWaitMs += rep.tokenWaitMs; c.maxMs = Math.max(c.maxMs, rep.ms);
      callStats.set(call, c);
    }
    return rep;
  };

  const t0 = performance.now();
  try {
    const explainStart = await explainPage(0, [range.lo, range.hi], roundClock(1, 5)());
    log(`page query (shard 0, 100,000 rows, nothing synced): ${explainStart.exec} ms; plan: ${explainStart.plan.slice(0, 3).map((l) => l.trim()).join(' | ')}`);

    // Round 1: up to 11 calls per shard, until each shard has nothing claimable left.
    round = 1;
    const shift1 = roundClock(1, 5);
    const callsUsed = new Map<number, number>();
    const activeMs = new Map<number, number>(); // per shard: the time its calls spent dispatching (runs that did work)
    const { peak: peak1 } = await peakConnections(async () => {
      for (const batch of batches) {
        let open = [...batch];
        for (let call = 1; call <= M.callsPerRound && open.length; call++) {
          const reps = await Promise.all(open.map((s) => runCall(s, 1, call, shift1)));
          for (const rep of reps) {
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
    const perShard = shards.map((s) => {
      const done = r1.filter((r) => r.shard === s).reduce((a, r) => a + r.done, 0);
      return done / ((activeMs.get(s) ?? 1) / 1000);
    });
    const usersPerSec = perShard.reduce((a, b) => a + b, 0) / perShard.length;
    const worstCalls = Math.max(...shards.map((s) => callsUsed.get(s) ?? Infinity));
    const designRate = Math.min(M.concurrency / ((1 + 2 * 1.5) * M.latencyMs / 1000), M.rps / (1 + 2 * 1.5));
    const healthyPerShard = kinds.healthy.length / M.of;
    log(`round 1: ${round1Ms} ms; calls used per shard max ${worstCalls} of ${M.callsPerRound} (headroom ${(M.callsPerRound / worstCalls).toFixed(2)}x; per shard ${shards.map((s) => callsUsed.get(s) ?? '-').join(',')}); ` +
      `done ${sum('done')}, transient ${sum('transient')}, failed ${sum('failed')}, refused ${sum('refused')}, quarantined ${sum('quarantined')}, skipped ${sum('skipped')}, deferred ${sum('deferred')}, releaseFailed ${sum('releaseFailed')}, ` +
      `requests ${sum('requests')} (${(sum('requests') / (sum('done') + sum('transient') + sum('failed'))).toFixed(2)} a trader), pages ${sum('pages')}, token wait ${sum('tokenWaitMs')} ms, breaker ${r1.some((r) => r.breaker)}, lease lost ${r1.some((r) => r.leaseLost)}, aborted ${r1.some((r) => r.aborted)}; ` +
      `peak database connections ${peak1}; failure lines ${errorLines.failed}`);
    const vendorPer = timing.vendorMs / timing.n, dbPer = (timing.syncMs - timing.vendorMs) / timing.n;
    log(`a healthy trader's sync: ${(timing.syncMs / timing.n).toFixed(0)} ms = vendor ${vendorPer.toFixed(0)} ms (scaled by K) + database ${dbPer.toFixed(0)} ms (not scaled)`);
    // Production speed: the vendor part times K, the database part as measured (it was not scaled, and ran with
    // SHARDS_AT_ONCE x 6 transactions on this machine's database).
    const lProd = (vendorPer * K + dbPer) / 1000, reqPer = sum('requests') / (sum('done') + sum('transient') + sum('failed'));
    const prodRate = Math.min(M.concurrency / lProd, (M.rps / K) / reqPer);
    log(`per shard: ${usersPerSec.toFixed(1)} traders/s while dispatching, scaled time (min ${Math.min(...perShard).toFixed(1)}, max ${Math.max(...perShard).toFixed(1)}; design min(C/L, RPS/requests) = ${designRate.toFixed(1)} at K = ${K} with no database time); ` +
      `at production speed L_trader = ${lProd.toFixed(2)} s, so min(C/L = ${(M.concurrency / lProd).toFixed(2)}, RPS/requests = ${((M.rps / K) / reqPer).toFixed(2)}) = ${prodRate.toFixed(2)} traders/s per shard; ` +
      `measured: ${Math.round(healthyPerShard)} traders a shard took ${worstCalls} of ${M.callsPerRound} calls, so a round covers about ${Math.round(healthyPerShard * M.callsPerRound / worstCalls)} a shard, ` +
      `${Math.round(M.of * healthyPerShard * M.callsPerRound / worstCalls).toLocaleString('en-US')} on ${M.of} shards (${(M.callsPerRound / worstCalls).toFixed(2)}x the ${M.traders.toLocaleString('en-US')}); ` +
      `production holds ${M.of} x (${M.concurrency} + 2) = ${M.of * (M.concurrency + 2)} connections at once (this run: ${SHARDS_AT_ONCE} shards at once, peak ${peak1})`);

    // Coverage and exactly-once.
    assert.ok(r1.every((r) => !r.busy && !r.breaker && !r.leaseLost && !r.aborted), 'no run busy, broken, fenced or aborted');
    assert.equal(sum('quarantined'), 0);
    assert.equal(sum('releaseFailed'), 0);
    assert.equal(sum('done'), kinds.healthy.length, 'every healthy trader synced');
    assert.equal(sum('transient'), kinds.slow.length, 'every slow trader timed out once (transient)');
    assert.equal(sum('failed'), kinds.fail.length, 'every failing trader failed once (trader-specific)');
    assert.deepEqual(r1.flatMap((r) => r.failedIds).sort((a, b) => a - b), [...kinds.slow, ...kinds.fail].sort((a, b) => a - b), 'the failed ids are the slow and failing traders');
    const notOnce = [...kinds.healthy, ...kinds.slow, ...kinds.fail].filter((id) => attempts[1].get(id) !== 1);
    assert.equal(notOnce.length, 0, `every trader attempted exactly once in round 1 (${notOnce.length} not)`);
    const wrongShard = [...shardSeen].filter(([id, s]) => s.size !== 1 || !s.has(id % M.of));
    assert.equal(wrongShard.length, 0, 'every trader in exactly its own shard');
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
    assert.ok(worstCalls <= M.callsPerRound / BOUNDS.headroom, `calls used ${worstCalls} of ${M.callsPerRound}: headroom ${(M.callsPerRound / worstCalls).toFixed(2)}x < ${BOUNDS.headroom}x`);

    // Round 2: the slow traders' vendor recovers. The round is scoped to the slow and failing traders (re-syncing all
    // 100,000 again would only repeat round 1): slow traders are retried and synced; failing ones are still backed off.
    round = 2;
    await post('/_bulk', { prefix, from: 0, to: M.traders - 1, accounts: M.accounts, activities: 1, failEvery: M.fail.every, failOffset: M.fail.offset, failStatus: M.fail.status });
    const shift2 = roundClock(2, 1);
    const ids2 = [...kinds.slow, ...kinds.fail];
    const explain2 = await explainPage(0, [range.lo, range.hi], shift2());
    log(`page query (shard 0, round 2, every trader synced once, unscoped): ${explain2.exec} ms`);
    const t2 = performance.now();
    const { peak: peak2 } = await peakConnections(async () => {
      for (const batch of batches) await Promise.all(batch.map((s) => runCall(s, 2, 1, shift2, ids2)));
    });
    const r2 = reports.filter((r) => r.round === 2);
    const sum2 = (k: keyof RunReport) => r2.reduce((a, r) => a + (r[k] as number), 0);
    log(`round 2 (slow and failing traders only, one call): ${ms(t2)} ms; done ${sum2('done')}, transient ${sum2('transient')}, failed ${sum2('failed')}, in backoff ${sum2('inBackoff')}, remaining ${sum2('remaining')}; peak connections ${peak2}`);
    assert.equal(sum2('done'), kinds.slow.length, 'every slow trader synced next round');
    assert.equal(kinds.slow.filter((id) => attempts[2].get(id) !== 1).length, 0, 'each slow trader attempted once in round 2');
    assert.equal(kinds.fail.filter((id) => attempts[2].has(id)).length, 0, 'no failing trader retried while backed off');
    assert.equal(sum2('inBackoff'), kinds.fail.length);
    assert.equal(sum2('remaining'), 0);
    const [db2] = await sql`select count(*) filter (where last_synced_at is not null)::int as synced from users where id in ${sql(kinds.slow)} and sync_retry_at is null and sync_failures = 0`;
    assert.equal(db2.synced, kinds.slow.length);
    log(`main test: ${ms(t0)} ms after setup; peak database connections ${Math.max(peak1, peak2)}`);
  } finally {
    console.error = realError;
    vendorTimeout(broker, broker.VENDOR_TIMEOUT_MS);
    await post('/_latency', { ms: 0 });
    await post('/_bulk', { prefix, clear: true });
  }
});

loadTest('latency model: one shard, real-time vendor latency 200–500 ms, rps 10, concurrency 6: throughput within ±25% of min(C / L_trader, RPS / requests_per_trader)', async () => {
  const { runShard } = await import('./sync-shard.ts');
  const { ROUND_MS } = await import('./sync.ts');
  const L = LATENCY;
  const p = `${tag}m`;
  const range = await bulkTraders(p, `${tag}m`, L.traders, MODEL.accounts);
  await post('/_bulk', { prefix: p, from: 0, to: L.traders - 1, accounts: MODEL.accounts, activities: 1 });
  await post('/_latency', { ms: L.ms, jitterMs: L.jitterMs });
  await noteShardRows(1, [0]);
  try {
    const at = Math.floor(Date.now() / ROUND_MS) * ROUND_MS - 20 * ROUND_MS + 35 * 60_000, t0 = Date.now();
    const before = (await (await fetch(`${base}/_stats`)).json()).requests as number;
    const s0 = performance.now();
    const rep = await runShard({ shard: { shard: 0, of: 1 }, config: { concurrency: L.concurrency, rps: L.rps, burst: L.rps, page: MODEL.page },
      idRange: [range.lo, range.hi], shiftMs: () => at + (Date.now() - t0) - Date.now(), log: () => {} });
    const took = ms(s0) / 1000;
    const vendorRequests = (await (await fetch(`${base}/_stats`)).json()).requests - before;
    const requestsPerTrader = rep.requests / rep.done;
    const meanLatency = (L.ms + L.jitterMs / 2) / 1000;
    // A trader's syncs make its requests one after another: L_trader = requests x mean latency (database time aside).
    const lTrader = requestsPerTrader * meanLatency;
    const predicted = Math.min(L.concurrency / lTrader, L.rps / requestsPerTrader);
    const measured = rep.done / took;
    log(`latency model: ${rep.done} traders in ${took.toFixed(1)} s = ${measured.toFixed(2)} traders/s; ${requestsPerTrader.toFixed(2)} requests a trader (vendor saw ${vendorRequests}), L_trader ${lTrader.toFixed(2)} s; ` +
      `predicted min(C/L = ${(L.concurrency / lTrader).toFixed(2)}, RPS/requests = ${(L.rps / requestsPerTrader).toFixed(2)}) = ${predicted.toFixed(2)} (${((measured / predicted - 1) * 100).toFixed(1)}%); token wait ${rep.tokenWaitMs} ms`);
    assert.equal(rep.done, L.traders);
    assert.equal(vendorRequests, rep.requests, 'every request the run counted reached the vendor');
    assert.ok(Math.abs(measured / predicted - 1) <= BOUNDS.modelTolerance, `measured ${measured.toFixed(2)} vs predicted ${predicted.toFixed(2)}`);
  } finally {
    await post('/_latency', { ms: 0 });
    await post('/_bulk', { prefix: p, clear: true });
  }
});

function vendorTimeout(broker: typeof import('./broker.ts'), msBound: number) { broker.vendorTimeout.ms = msBound; }
