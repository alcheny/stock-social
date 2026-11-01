// Sharded hourly sync, the database parts (lib/sync-shard.ts; committee docs/features/logs/sync/committee-2026-11-01.md):
// shard assignment, deadline and resume, overlapping runs and the fenced shard lease, backoff by failure class, the run
// breaker, poison quarantine, the concurrency and rate bounds, and shard 0's coverage report.
// Every test claims only its own traders (`ids`), in its own past round (the database clock shifted back), under an
// `of` no other test uses, with an injected `sync` instead of the vendor (one test uses the real syncUser with an
// in-memory broker). Traders that must share one shard get explicit ids `base + j * of + shard` far above the identity
// sequence, so a test controls which shard each trader is in.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SyncableUser } from './sync.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 60_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const MIN = 60_000;
const usedOf = new Set<number>();
const freshOf = () => { for (;;) { const of = 500 + Math.floor(Math.random() * 501); if (!usedOf.has(of)) { usedOf.add(of); return of; } } };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let roundSlot = 40;

async function harness() {
  const { sql } = await import('./db.ts');
  const S = await import('./sync.ts');
  const H = await import('./sync-shard.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  // A past :00 cron mark of its own per test; minute m is round floor((m + 30) / 60) (rounds run :30 to :30).
  const T0 = Math.floor(Date.now() / S.ROUND_MS) * S.ROUND_MS - (roundSlot += 12) * S.ROUND_MS;
  const at = (minute: number) => () => T0 + minute * MIN - Date.now();
  const ids: number[] = [];
  const accounts: string[] = [];
  const connect = async (id: number, tag: string) => {
    const acc = `${tag}-acc`;
    accounts.push(acc);
    await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${id}`;
    await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
      select signup_attempt_id, id, 'a', 'connected', now(), now(), now(), ${sql.json([{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }])}
      from users where id = ${id}`;
    ids.push(id);
    return { id, acc, tag };
  };
  const tagOf = () => `h${Math.random().toString(36).slice(2, 10)}`;
  // A connected trader with an id from the identity sequence.
  const trader = async () => {
    const tag = tagOf();
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
    return connect(u.id, tag);
  };
  // `n` connected traders all in shard `shard` of `of` (explicit ids above the sequence).
  const inShard = async (n: number, of: number, shard: number) => {
    const out = [];
    const base = (1_900_000_000 + Math.floor(Math.random() * 100_000) * 1024);
    for (let j = 0; j < n; j++) {
      const tag = tagOf();
      const id = base - (base % of) + j * of + shard;
      const attempt = await createAttempt({ method: 'dev', attested: true });
      await sql`insert into users (id, handle, display_name, adult_attested_at, signup_attempt_id) overriding system value
        select ${id}, ${`${tag}u`}, ${`${tag}u`}, adult_attested_at, id from signup_attempts where id = ${attempt}`;
      out.push(await connect(id, tag));
    }
    return out;
  };
  const row = async (id: number) => (await sql`select sync_failures, sync_retry_at, sync_attempts, sync_failure_kind, sync_failing_since,
    sync_claimed_at, sync_lease_until from users where id = ${id}`)[0];
  const cleanup = async (...ofs: number[]) => {
    if (ids.length) await sql`delete from users where id in ${sql(ids)}`;
    if (accounts.length) await sql`delete from broker_accounts where account_id in ${sql(accounts)}`;
    for (const of of ofs) await sql`delete from sync_shards where of = ${of}`;
  };
  // A stub sync that counts calls per trader (only this test's) and the peak in flight.
  const counter = (behave: (u: SyncableUser, n: number) => Promise<number | 'skipped'> = async () => 1) => {
    const calls = new Map<number, number>();
    const c = { calls, inFlight: 0, maxInFlight: 0, order: [] as number[] };
    const sync = async (u: SyncableUser) => {
      assert.ok(ids.includes(u.id), 'a run touched a trader outside its scope');
      calls.set(u.id, (calls.get(u.id) ?? 0) + 1);
      c.order.push(u.id);
      c.inFlight++; c.maxInFlight = Math.max(c.maxInFlight, c.inFlight);
      try { return await behave(u, calls.get(u.id)!); } finally { c.inFlight--; }
    };
    return { ...c, c, sync, count: (id: number) => calls.get(id) ?? 0 };
  };
  const quiet = () => {};
  return { sql, S, H, T0, at, ids, trader, inShard, row, cleanup, counter, quiet };
}
const cfg = (concurrency: number, rps = 1000) => ({ concurrency, rps, burst: rps, page: 500 });

dbTest('shard assignment: with of=3, three runs at once sync every scoped trader exactly once, each only in its shard id % 3', async () => {
  const h = await harness();
  try {
    for (let i = 0; i < 9; i++) await h.trader();
    const seen = new Map<number, number[]>();
    const runs = await Promise.all([0, 1, 2].map((shard) => h.H.runShard({
      shard: { shard, of: 3 }, ids: h.ids, shiftMs: h.at(5), jitterMs: 0, config: cfg(3), log: h.quiet,
      sync: async (u) => { seen.set(u.id, [...(seen.get(u.id) ?? []), shard]); return 1; },
    })));
    assert.deepEqual(runs.map((r) => r.busy), [false, false, false]);
    for (const id of h.ids) assert.deepEqual(seen.get(id), [id % 3], `trader ${id}`);
    assert.equal(runs.reduce((a, r) => a + r.done, 0), h.ids.length);
    for (const r of runs) assert.equal(r.remaining, 0);
  } finally {
    await h.cleanup();
  }
});

dbTest('deadline and resume: a run stopped at its deadline after k dispatches leaves the rest; the next run syncs exactly the remainder; a third syncs nobody; the next round syncs all again', async () => {
  const h = await harness();
  const of = freshOf();
  try {
    const ts = await h.inShard(6, of, 4);
    const sh = { shard: 4, of };
    const c = h.counter();
    const k = 2;
    const r1 = await h.H.runShard({ shard: sh, ids: h.ids, shiftMs: h.at(5), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c.sync, clock: () => (c.order.length >= k ? 1 : 0), deadline: 1 });
    assert.equal(r1.done, k);
    assert.equal(r1.stoppedAtDeadline, true);
    assert.equal(r1.remaining, 6 - k);
    const r2 = await h.H.runShard({ shard: sh, ids: h.ids, shiftMs: h.at(10), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c.sync });
    assert.equal(r2.done, 6 - k);
    assert.equal(r2.stoppedAtDeadline, false);
    assert.equal(r2.remaining, 0);
    assert.deepEqual(ts.map((t) => c.count(t.id)), ts.map(() => 1)); // nobody twice
    const r3 = await h.H.runShard({ shard: sh, ids: h.ids, shiftMs: h.at(20), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c.sync });
    assert.equal(r3.done, 0);
    assert.deepEqual(ts.map((t) => c.count(t.id)), ts.map(() => 1));
    const r4 = await h.H.runShard({ shard: sh, ids: h.ids, shiftMs: h.at(65), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c.sync });
    assert.equal(r4.done, 6);
    assert.deepEqual(ts.map((t) => c.count(t.id)), ts.map(() => 2));
  } finally {
    await h.cleanup(of);
  }
});

dbTest('overlap: two runs of one shard at once: exactly one is busy, every trader synced once, in flight never above the concurrency', async () => {
  const h = await harness();
  const of = freshOf();
  try {
    const ts = await h.inShard(12, of, 1);
    const c = h.counter(async () => { await sleep(40); return 1; });
    const go = () => h.H.runShard({ shard: { shard: 1, of }, ids: h.ids, shiftMs: h.at(5), jitterMs: 0, config: cfg(4), log: h.quiet, sync: c.sync });
    const [a, b] = await Promise.all([go(), go()]);
    assert.deepEqual([a.busy, b.busy].sort(), [false, true]);
    const busy = a.busy ? a : b;
    assert.equal(busy.done, 0);
    assert.deepEqual(busy.failedIds, []);
    assert.deepEqual(ts.map((t) => c.count(t.id)), ts.map(() => 1));
    assert.ok(c.c.maxInFlight <= 4, `in flight ${c.c.maxInFlight}`);
    assert.equal(c.c.maxInFlight, 4); // and the workers do run side by side
    assert.equal((a.busy ? b : a).concurrency, 4);
  } finally {
    await h.cleanup(of);
  }
});

dbTest('shard lease: held → not acquirable; lapsed → another run takes it; renewal fails for a wrong holder or a lapsed lease', async () => {
  const h = await harness();
  const of = freshOf();
  const sh = { shard: 0, of };
  try {
    assert.equal(await h.H.acquireShard(sh, 'one', 60_000), true);
    assert.equal(await h.H.acquireShard(sh, 'two', 60_000), false);
    assert.equal(await h.H.renewShard(sh, 'two'), false); // wrong holder
    assert.equal(await h.H.renewShard(sh, 'one'), true);
    // A killed run: its lease lapses (set in the past on the database clock).
    await h.sql`update sync_shards set lease_until = now() - interval '1 second' where of = ${of} and shard = 0`;
    assert.equal(await h.H.renewShard(sh, 'one'), false); // lapsed: the holder may not resume
    const ts = await h.inShard(2, of, 0);
    const c = h.counter();
    const r = await h.H.runShard({ shard: sh, ids: h.ids, shiftMs: h.at(5), jitterMs: 0, config: cfg(2), log: h.quiet, sync: c.sync, holder: 'three' });
    assert.equal(r.busy, false);
    assert.equal(r.done, 2);
    assert.deepEqual(ts.map((t) => c.count(t.id)), [1, 1]);
    // A short lease lapses by itself.
    assert.equal(await h.H.acquireShard(sh, 'four', 50), true);
    assert.equal(await h.H.acquireShard(sh, 'five', 50), false);
    await sleep(120);
    assert.equal(await h.H.acquireShard(sh, 'five', 50), true);
    // The released row keeps the last run's counters, numbers only.
    const [x] = await h.sql`select last_run from sync_shards where of = ${of} and shard = 0`;
    assert.equal(x.last_run.done, 2);
    assert.equal('failedIds' in x.last_run, false);
  } finally {
    await h.cleanup(of);
  }
});

dbTest('fencing: a run whose lease is taken mid-run reports leaseLost and dispatches nothing more', async () => {
  const h = await harness();
  const of = freshOf();
  try {
    await h.inShard(5, of, 3);
    const c = h.counter(async (_u, _n) => {
      if (c.c.order.length === 1) {
        await h.sql`update sync_shards set holder = 'thief' where of = ${of} and shard = 3`;
        await sleep(150); // the heartbeat (renewMs 20) notices before this sync ends
      }
      return 1;
    });
    const r = await h.H.runShard({ shard: { shard: 3, of }, ids: h.ids, shiftMs: h.at(5), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c.sync, renewMs: 20 });
    assert.equal(r.leaseLost, true);
    assert.equal(c.c.order.length, 1);
    assert.equal(r.done, 1);
    // The run did not clear the thief's lease on release.
    const [x] = await h.sql`select holder, lease_until is not null as held from sync_shards where of = ${of} and shard = 3`;
    assert.deepEqual({ holder: x.holder, held: x.held }, { holder: 'thief', held: true });
  } finally {
    await h.cleanup(of);
  }
});

dbTest('backoff: a refusal (403) backs off 1 h on the database clock (not retried this round or next), retried 2 rounds later, doubling on a second failure, cleared by a success; a 503 never backs off and is retried next round', async () => {
  const h = await harness();
  const of = freshOf();
  try {
    const [refuser, flaky] = await h.inShard(2, of, 7);
    const plan = new Map<number, (number | 'skipped' | { status: number })[]>([[refuser.id, [{ status: 403 }, { status: 422 }, 1]], [flaky.id, [{ status: 503 }, 1]]]);
    const c = h.counter(async (u, n) => { const x = plan.get(u.id)![n - 1]; if (typeof x === 'object') throw Object.assign(new Error('vendor said no to vendor-user-xyz'), x); return x; });
    const run = (minute: number) => h.H.runShard({ shard: { shard: 7, of }, ids: h.ids, shiftMs: h.at(minute), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c.sync });
    const near = (d: Date | null, ms: number) => { assert.ok(d); assert.ok(Math.abs(d.getTime() - ms) < 10_000, `${d.toISOString()} vs ${new Date(ms).toISOString()}`); };

    const r1 = await run(20); // round 0
    assert.deepEqual({ refused: r1.refused, transient: r1.transient, done: r1.done }, { refused: 1, transient: 1, done: 0 });
    assert.deepEqual(r1.failedIds.sort(), [refuser.id, flaky.id].sort());
    let a = await h.row(refuser.id);
    assert.equal(a.sync_failures, 1);
    assert.equal(a.sync_failure_kind, 'refused');
    near(a.sync_retry_at, h.T0 + 80 * MIN);
    near(a.sync_failing_since, h.T0 + 20 * MIN);
    assert.equal(a.sync_attempts, 0);
    const f = await h.row(flaky.id);
    assert.deepEqual({ failures: f.sync_failures, retry: f.sync_retry_at, kind: f.sync_failure_kind, attempts: f.sync_attempts }, { failures: 0, retry: null, kind: null, attempts: 0 });

    await run(25); // same round: neither
    assert.deepEqual([c.count(refuser.id), c.count(flaky.id)], [1, 1]);
    const r3 = await run(45); // next round: the transient one only; the refuser waits until minute 80
    assert.deepEqual([c.count(refuser.id), c.count(flaky.id)], [1, 2]);
    assert.equal(r3.inBackoff, 1);
    const r4 = await run(100); // two rounds after the refusal: retried, fails again (422) → 2 h
    assert.equal(c.count(refuser.id), 2);
    assert.equal(r4.failed, 1);
    a = await h.row(refuser.id);
    assert.equal(a.sync_failures, 2);
    assert.equal(a.sync_failure_kind, 'trader');
    near(a.sync_retry_at, h.T0 + 220 * MIN);
    near(a.sync_failing_since, h.T0 + 20 * MIN); // the streak's start is kept
    await run(160); // round 3: still backed off
    assert.equal(c.count(refuser.id), 2);
    const r6 = await run(225); // after the 2 h wait: a success clears everything
    assert.equal(r6.done, 2);
    a = await h.row(refuser.id);
    assert.deepEqual({ failures: a.sync_failures, retry: a.sync_retry_at, kind: a.sync_failure_kind, since: a.sync_failing_since }, { failures: 0, retry: null, kind: null, since: null });
  } finally {
    await h.cleanup(of);
  }
});

dbTest('breaker: 25 traders all failing transiently: the run stops with breaker true after 20 dispatches', async () => {
  const h = await harness();
  const of = freshOf();
  try {
    await h.inShard(25, of, 2);
    const c = h.counter(async () => { throw Object.assign(new Error('upstream'), { status: 503 }); });
    const r = await h.H.runShard({ shard: { shard: 2, of }, ids: h.ids, shiftMs: h.at(5), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c.sync });
    assert.equal(r.breaker, true);
    assert.equal(c.c.order.length, 20);
    assert.equal(r.transient, 20);
    assert.equal(r.remaining, 5);
    // With 4 workers it still stops at about 20 (at most the in-flight ones past it).
    const of2 = freshOf();
    const h2 = await harness();
    try {
      await h2.inShard(25, of2, 2);
      const c2 = h2.counter(async () => { await sleep(5); throw Object.assign(new Error('upstream'), { status: 429 }); });
      const r2 = await h2.H.runShard({ shard: { shard: 2, of: of2 }, ids: h2.ids, shiftMs: h2.at(5), jitterMs: 0, config: cfg(4), log: h2.quiet, sync: c2.sync });
      assert.equal(r2.breaker, true);
      assert.ok(c2.c.order.length >= 20 && c2.c.order.length <= 23, `dispatched ${c2.c.order.length}`);
    } finally { await h2.cleanup(of2); }
  } finally {
    await h.cleanup(of);
  }
});

dbTest('poison: a trader claimed twice by runs that died is quarantined (backed off, counted) and the others are still synced; a sync skipped on the lock restores its claim and undoes its attempt', async () => {
  const h = await harness();
  const of = freshOf();
  try {
    const [poison, b, cc, locked] = await h.inShard(4, of, 5);
    // Two killed runs: each claims, never finishes; the in-flight lease (10 min) lapses between them.
    assert.ok(await h.H.claimById(poison.id, h.at(0)()));
    assert.equal(await h.H.claimById(poison.id, h.at(5)()), null); // still leased
    assert.ok(await h.H.claimById(poison.id, h.at(11)()));
    assert.equal((await h.row(poison.id)).sync_attempts, 2);
    assert.equal(await h.H.quarantine(poison.id, h.at(15)()), false); // in flight: not yet
    const c = h.counter(async (u) => (u.id === locked.id ? 'skipped' : 1));
    const r = await h.H.runShard({ shard: { shard: 5, of }, ids: h.ids, shiftMs: h.at(22), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c.sync });
    assert.equal(r.quarantined, 1);
    assert.equal(c.count(poison.id), 0); // never dispatched again
    assert.deepEqual([c.count(b.id), c.count(cc.id), c.count(locked.id)], [1, 1, 1]); // the skipped one is offered once per run
    assert.equal(r.done, 2);
    assert.equal(r.skipped, 1);
    const p = await h.row(poison.id);
    assert.equal(p.sync_failure_kind, 'quarantined');
    assert.equal(p.sync_attempts, 0);
    assert.equal(p.sync_failures, 1);
    assert.ok(p.sync_retry_at && Math.abs(p.sync_retry_at.getTime() - (h.T0 + 82 * MIN)) < 10_000);
    const l = await h.row(locked.id);
    assert.deepEqual({ attempts: l.sync_attempts, claimed: l.sync_claimed_at, lease: l.sync_lease_until }, { attempts: 0, claimed: null, lease: null });
    // The skipped trader's round is not taken: a later run in the same round syncs it.
    const c2 = h.counter();
    await h.H.runShard({ shard: { shard: 5, of }, ids: h.ids, shiftMs: h.at(27), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c2.sync });
    assert.deepEqual(h.ids.map((id) => c2.count(id)), h.ids.map((id) => (id === locked.id ? 1 : 0)));
  } finally {
    await h.cleanup(of);
  }
});

dbTest('rate budget: concurrency 4 with a small rps: in flight never above 4, requests and token waits reported', async () => {
  const h = await harness();
  const of = freshOf();
  try {
    await h.inShard(8, of, 0);
    const broker = { listAccounts: async (_u: unknown) => [], fetchActivities: async () => [] };
    const brokers = new Map<number, typeof broker>();
    const c = h.counter(async (u) => { await brokers.get(u.id)!.listAccounts({} as never); await sleep(300); return 1; });
    const sync = (u: SyncableUser, b: typeof broker) => { brokers.set(u.id, b); return c.sync(u); };
    const t0 = Date.now();
    const r = await h.H.runShard({
      shard: { shard: 0, of }, ids: h.ids, shiftMs: h.at(5), jitterMs: 0, config: { concurrency: 4, rps: 20, burst: 1, page: 500 }, log: h.quiet,
      broker: broker as never, sync: sync as never,
    });
    const ms = Date.now() - t0;
    assert.equal(r.done, 8);
    assert.ok(c.c.maxInFlight <= 4 && c.c.maxInFlight >= 2, `in flight ${c.c.maxInFlight}`);
    assert.equal(r.requests, 8); // one metered list per sync (prepaid from the 3 taken before each claim)
    assert.ok(r.tokenWaitMs > 0);
    // 8 traders x 3 tokens at 20/s with a burst of 1: at least ~1.15 s of budget.
    assert.ok(ms >= 1000, `took ${ms} ms`);
  } finally {
    await h.cleanup(of);
  }
});

dbTest('coverage: refusals and the oldest refusal age, missing shards, numbers-only log lines, the real database settings checked', async () => {
  const h = await harness();
  const of = freshOf();
  try {
    const [refused, ok] = await h.inShard(2, of, 2);
    await h.sql`update users set sync_failure_kind = 'refused', sync_failures = 3, sync_failing_since = now() - interval '30 hours',
      sync_retry_at = now() + interval '1 hour' where id = ${refused.id}`;
    const lines: string[] = [];
    const log = (l: string) => lines.push(l);
    // Run only shard 2 of `of` (syncing the other trader), then the coverage step.
    const r = await h.H.runShard({ shard: { shard: 2, of }, ids: h.ids, jitterMs: 0, config: cfg(2), log, sync: async () => 1 });
    assert.equal(r.done, 1);
    const { runConfig, dbConfigCheck } = await import('./sync-limits.ts');
    const { POOL_MAX } = await import('./db.ts');
    const conf = runConfig();
    const cov = await h.H.coverage(of, { ids: h.ids }, conf, log);
    assert.equal(cov.of, of);
    assert.ok(cov.refused >= 1);
    assert.ok(cov.oldestRefusalHours >= 30 && cov.oldestRefusalHours < 31, String(cov.oldestRefusalHours));
    assert.equal(cov.inBackoff, 1);
    assert.equal(cov.missingShards, of - 1);
    assert.ok(lines.some((l) => l.startsWith('sync round incomplete')));
    // A fresh `of` (7 shards here would be shared across runs of this suite) with only shard 2 run: all others missing.
    const of7 = freshOf();
    await h.H.runShard({ shard: { shard: 2, of: of7 }, ids: [], jitterMs: 0, config: cfg(1), log, sync: async () => 1 });
    assert.equal((await h.H.coverage(of7, { ids: [] }, conf, log)).missingShards, of7 - 1);
    await h.sql`delete from sync_shards where of = ${of7}`;
    // Log lines: no internal ids, handles or vendor ids.
    const rows = await h.sql`select id, handle, snaptrade_user_id from users where id in ${h.sql(h.ids)}`;
    for (const l of lines) for (const x of rows) for (const v of [String(x.id), x.handle, x.snaptrade_user_id]) assert.ok(!l.includes(v), `log line carries ${v}: ${l}`);
    assert.ok(lines.length >= 4);
    // The real settings of this database, checked by the same rule.
    for (const k of ['statementTimeoutMs', 'idleInTxMs', 'maxConnections'] as const) assert.equal(typeof cov.db[k], 'number');
    assert.ok(cov.db.maxConnections > 0);
    const check = dbConfigCheck(cov.db, { shards: of, workers: Math.max(1, Math.min(conf.concurrency, POOL_MAX - 2)), maxSyncCostMs: h.S.syncCost(h.S.SYNC_FIT_CAP), userLeaseMs: h.S.SYNC_LEASE_MS });
    assert.equal(cov.dbConfigOk, check.ok);
    assert.deepEqual(cov.dbProblems, check.problems);
    assert.ok(ok);
  } finally {
    await h.cleanup(of);
  }
});

dbTest('failure isolation with the real syncUser: a vendor error mid-sync leaves activities and closed_trades unchanged and is classed, never partially published', async () => {
  const h = await harness();
  const of = freshOf();
  try {
    const [t] = await h.inShard(1, of, 6);
    const acct = [{ id: t.acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }];
    const act = (id: string, side: 'BUY' | 'SELL', price: number, day: number) => ({
      externalId: `${t.tag}-${id}`, accountId: t.acc, symbol: 'AAA', side, units: 1, price, fee: 0, executedAt: new Date(Date.UTC(2024, 0, day)), verified: true, raw: {},
    });
    const snapshot = async () => JSON.stringify([
      await h.sql`select external_id from activities where user_id = ${t.id} order by external_id`,
      await h.sql`select sell_id, return_pct from closed_trades where user_id = ${t.id} order by sell_id`,
    ]);
    const run = (minute: number, broker: unknown) => h.H.runShard({ shard: { shard: 6, of }, ids: h.ids, shiftMs: h.at(minute), jitterMs: 0, config: cfg(1), log: h.quiet, broker: broker as never });
    const r0 = await run(5, { listAccounts: async () => acct, fetchActivities: async () => [act('b1', 'BUY', 100, 1), act('s1', 'SELL', 110, 2)] });
    assert.equal(r0.done, 1);
    const before = await snapshot();
    assert.equal(JSON.parse(before)[1].length, 1);
    // Next round: new activities are read, then positions fail with a 503 after the insert and rebuild ran in the transaction.
    const r1 = await run(65, {
      listAccounts: async () => acct, fetchActivities: async () => [act('b2', 'BUY', 50, 3), act('s2', 'SELL', 60, 4)],
      fetchPositions: async () => { throw Object.assign(new Error('upstream'), { status: 503 }); },
    });
    assert.equal(r1.transient, 1);
    assert.equal(await snapshot(), before);
    // A round later: the vendor refuses the activity read (403) → refused and backed off, nothing written.
    const r2 = await run(125, { listAccounts: async () => acct, fetchActivities: async () => { throw Object.assign(new Error('nope'), { status: 403 }); } });
    assert.equal(r2.refused, 1);
    assert.deepEqual(r2.failedIds, [t.id]);
    assert.equal(await snapshot(), before);
    assert.equal((await h.row(t.id)).sync_failure_kind, 'refused');
  } finally {
    await h.cleanup(of);
  }
});

// Code review should-fix 2: a run's first trader is always dispatched, whatever its fit (it has the whole call), so
// traders with many accounts are never deferred forever on shard 0 behind its housekeeping; later ones that do not fit
// are deferred to the next call, and the run reports the stop.
dbTest('fit: the first trader a run takes is dispatched even when its worst-case cost does not fit; later unfit traders are deferred, not lost', async () => {
  const h = await harness();
  const of = freshOf();
  try {
    const ts = await h.inShard(3, of, 0);
    const four = (t: { id: number; acc: string }) => [0, 1, 2, 3].map((i) => ({ id: `${t.acc}-${i}`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }));
    for (const t of ts) await h.sql`update connections set accounts = ${h.sql.json(four(t))} where user_id = ${t.id}`;
    const c = h.counter();
    const now = Date.now();
    // 4 accounts at a 1 s bound cost 9 s; only 5 s are left before the route's end.
    const r = await h.H.runShard({ shard: { shard: 0, of }, ids: h.ids, shiftMs: h.at(5), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c.sync,
      vendorBoundMs: 1_000, clock: Date.now, routeEnd: now + 5_000 });
    assert.equal(r.done, 1, JSON.stringify(r));
    assert.equal(r.deferred, 2);
    assert.equal(r.stoppedAtDeadline, true);
    assert.equal(r.remaining, 2);
    // The next call (a whole budget) takes them.
    const r2 = await h.H.runShard({ shard: { shard: 0, of }, ids: h.ids, shiftMs: h.at(10), jitterMs: 0, config: cfg(1), log: h.quiet, sync: c.sync, vendorBoundMs: 1_000 });
    assert.equal(r2.done, 2);
    for (const t of ts) assert.equal(c.count(t.id), 1);
  } finally {
    await h.cleanup(of);
  }
});
