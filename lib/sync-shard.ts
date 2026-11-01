// Sharded hourly sync (docs/SYNC.md; committee docs/features/logs/sync/committee-2026-11-01.md). One run syncs one
// shard's traders (`id % of = shard`) with bounded concurrency, a per-run deadline and a vendor request budget, under a
// fenced lease on the database clock so two runs of one shard never overlap. Each trader's sync is exactly
// lib/sync.ts#syncUser (one transaction: a failure publishes nothing). The durable cursor is the per-user round claim
// (lib/sync.ts): a run stopped at its deadline leaves the rest unclaimed at the head of the shard's queue (stalest
// first), so the next run resumes exactly there, and nobody is synced twice in a round.
import { randomUUID } from 'node:crypto';
import { POOL_MAX, sql } from './db.ts';
import { VENDOR_TIMEOUT_MS } from './broker.ts';
import {
  accountsOf, claimable, clockSql, defaultBroker, syncable, syncCost, syncUser, SYNC_FIT_CAP, SYNC_LEASE_MS, ROUND_MS,
  type Broker, type SyncableUser,
} from './sync.ts';
import {
  BACKOFF_BASE_MS, BACKOFF_CAP_MS, Breaker, classify, dbConfigCheck, errLabel, runConfig, TokenBucket,
  type FailureKind, type RunConfig, type Shard,
} from './sync-limits.ts';

export const SHARD_LEASE_MS = 60_000; // lapses within a minute of a killed run: the next 5-minute call is never busy
export const SHARD_RENEW_MS = 15_000;
const RENEW_BEFORE_DISPATCH_MS = 5_000; // a dispatch renews first unless the lease was renewed this recently
export const START_JITTER_MS = 15_000; // sharded calls (of > 1) spread their first dispatch over this window
export const MISSING_SHARD_MS = 15 * 60_000;
export const MAX_ATTEMPTS = 2; // unfinished claims before a trader is quarantined

// Test hooks: `ids` / `idRange` limit a run to a test's own traders; `shiftMs` moves the database clock for rounds.
export type Scope = { ids?: number[]; idRange?: [number, number]; shiftMs?: number | (() => number) };
const shiftOf = (s: Scope) => () => typeof s.shiftMs === 'function' ? s.shiftMs() : s.shiftMs ?? 0;
const scopeSql = (s: Scope) => sql`${s.ids ? sql`and u.id in ${sql(s.ids.length ? s.ids : [0])}` : sql``}
  ${s.idRange ? sql`and u.id between ${s.idRange[0]} and ${s.idRange[1]}` : sql``}`;
const inShard = (sh: Shard) => sql`u.id % ${sh.of}::int = ${sh.shard}::int`;
const notBackedOff = () => sql`(u.sync_retry_at is null or u.sync_retry_at <= clock.t)`;
// The next wait after `u.sync_failures` failures (the old value, in an update's set list): lib/sync-limits.ts#backoffMs.
const backoffSql = () => sql`least(${BACKOFF_CAP_MS}::float8, ${BACKOFF_BASE_MS}::float8 * power(2, least(users.sync_failures, 30))) * interval '1 millisecond'`;

export type RunReport = {
  of: number; shard: number; busy: boolean;
  done: number; skipped: number; deferred: number; transient: number; refused: number; failed: number; quarantined: number; releaseFailed: number;
  remaining: number | null; inBackoff: number | null;
  stoppedAtDeadline: boolean; breaker: boolean; leaseLost: boolean; aborted: boolean;
  concurrency: number; requests: number; tokenWaitMs: number; pages: number; ms: number;
};
export type Claimed = SyncableUser & { lease: string; prev: string | null };

// The shard lease: taken only when free or lapsed (an upsert, so a shard's first run creates its row).
export async function acquireShard(sh: Shard, holder: string, leaseMs = SHARD_LEASE_MS): Promise<boolean> {
  const rows = await sql`insert into sync_shards (of, shard, lease_until, holder, run_started_at, heartbeat_at)
    values (${sh.of}, ${sh.shard}, now() + ${leaseMs}::float8 * interval '1 millisecond', ${holder}, now(), now())
    on conflict (of, shard) do update set lease_until = excluded.lease_until, holder = excluded.holder,
      run_started_at = excluded.run_started_at, heartbeat_at = excluded.heartbeat_at
    where sync_shards.lease_until is null or sync_shards.lease_until <= now()
    returning holder`;
  return rows.length === 1;
}
// Renewal is fenced: only the holder, and only while its lease has not lapsed. False = the lease is lost.
export async function renewShard(sh: Shard, holder: string, leaseMs = SHARD_LEASE_MS): Promise<boolean> {
  const rows = await sql`update sync_shards set lease_until = now() + ${leaseMs}::float8 * interval '1 millisecond', heartbeat_at = now()
    where of = ${sh.of} and shard = ${sh.shard} and holder = ${holder} and lease_until > now() returning 1`;
  return rows.length === 1;
}
async function releaseShard(sh: Shard, holder: string, report: RunReport) {
  await sql`update sync_shards set lease_until = null, heartbeat_at = now(), last_run = ${sql.json(report)}
    where of = ${sh.of} and shard = ${sh.shard} and holder = ${holder}`;
}

// The head of the shard's queue: syncable, claimable this round, not backed off, stalest first.
async function page(sh: Shard, scope: Scope, shift: number, exclude: number[], limit: number) {
  return sql<{ id: number; accounts: number }[]>`with clock as (${clockSql(shift)})
    select u.id, least(${accountsOf()}, ${SYNC_FIT_CAP})::int as accounts from users u, clock
    where ${syncable()} and ${inShard(sh)} ${scopeSql(scope)} and ${claimable()} and ${notBackedOff()}
      ${exclude.length ? sql`and u.id not in ${sql(exclude)}` : sql``}
    order by u.last_synced_at nulls first, u.id limit ${limit}`;
}
// Claim one trader by id: the round claim, the in-flight lease and an attempt, atomically and only while it has fewer
// than MAX_ATTEMPTS unfinished attempts (committee round 2, engineer).
export async function claimById(id: number, shift = 0): Promise<Claimed | null> {
  const [u] = await sql<Claimed[]>`with clock as (${clockSql(shift)})
    update users set sync_claimed_at = clock.t, sync_lease_until = clock.t + ${SYNC_LEASE_MS}::float8 * interval '1 millisecond',
      sync_attempts = users.sync_attempts + 1
    from clock, (select u.id, u.sync_claimed_at::text as prev from users u, clock
      where u.id = ${id} and ${syncable()} and ${claimable()} and ${notBackedOff()} and u.sync_attempts < ${MAX_ATTEMPTS}
      for update of u skip locked) pick
    where users.id = pick.id
    returning users.id, users.snaptrade_user_id, users.snaptrade_secret_enc, users.sync_lease_until::text as lease, pick.prev`;
  return u ?? null;
}
// A trader whose last MAX_ATTEMPTS claims never finished (the process died mid-sync) is backed off as a failure.
export async function quarantine(id: number, shift = 0): Promise<boolean> {
  const rows = await sql`with clock as (${clockSql(shift)})
    update users set sync_attempts = 0, sync_failures = users.sync_failures + 1, sync_retry_at = clock.t + ${backoffSql()},
      sync_failure_kind = 'quarantined', sync_failing_since = coalesce(users.sync_failing_since, clock.t)
    from clock, (select u.id from users u, clock where u.id = ${id} and u.sync_attempts >= ${MAX_ATTEMPTS} and ${claimable()} for update of u skip locked) pick
    where users.id = pick.id returning 1`;
  return rows.length === 1;
}
// How an attempt ends. Every statement applies only while the in-flight lease is still this claim's (compared as the
// database wrote it, `::text`), so a stale worker never touches a newer claim.
type End = 'done' | 'skipped' | FailureKind;
export async function finish(u: Claimed, end: End, shift = 0) {
  const mine = sql`users.id = ${u.id} and users.sync_lease_until = ${u.lease}::text::timestamptz`;
  if (end === 'done') {
    await sql`update users set sync_lease_until = null, sync_attempts = 0, sync_failures = 0, sync_retry_at = null,
      sync_failure_kind = null, sync_failing_since = null where ${mine}`;
  } else if (end === 'skipped') {
    // Another sync holds the trader's lock: the round claim it replaced goes back and the attempt is undone.
    await sql`update users set sync_claimed_at = ${u.prev}::text::timestamptz, sync_lease_until = null,
      sync_attempts = greatest(users.sync_attempts - 1, 0) where ${mine}`;
  } else if (end === 'transient') {
    // Not the trader's fault: no backoff; the round claim stays, so it is retried next round.
    await sql`update users set sync_lease_until = null, sync_attempts = 0 where ${mine}`;
  } else {
    await sql`with clock as (${clockSql(shift)})
      update users set sync_lease_until = null, sync_attempts = 0, sync_failures = users.sync_failures + 1,
        sync_retry_at = clock.t + ${backoffSql()}, sync_failure_kind = ${end},
        sync_failing_since = coalesce(users.sync_failing_since, clock.t)
      from clock where ${mine}`;
  }
}

// Every vendor request a sync makes takes a token. The trader's expected requests (1 + 2n) are taken before the claim,
// outside its transaction; a request beyond them (another page on a first sync, an account the snapshot did not have)
// takes one more as it goes.
function metered(b: Broker, bucket: TokenBucket, prepaid: { left: number }, count: { n: number }): Broker {
  const pay = async (n: number) => {
    count.n += n;
    const free = Math.min(prepaid.left, n);
    prepaid.left -= free;
    if (n > free) await bucket.take(n - free);
  };
  return {
    pageLimit: b.pageLimit,
    listAccounts: async (u) => { await pay(1); return b.listAccounts(u); },
    fetchActivities: async (u, since, accountIds) => { await pay(Math.max(1, accountIds?.length ?? 1)); return b.fetchActivities(u, since, accountIds); },
    ...(b.fetchActivitiesPage ? { fetchActivitiesPage: async (u: Parameters<NonNullable<Broker['fetchActivitiesPage']>>[0], id: string, offset: number, limit?: number) => { await pay(1); return b.fetchActivitiesPage!(u, id, offset, limit); } } : {}),
    ...(b.fetchPositions ? { fetchPositions: async (u: Parameters<NonNullable<Broker['fetchPositions']>>[0], id: string) => { await pay(1); return b.fetchPositions!(u, id); } } : {}),
  };
}

export type RunOpts = Scope & {
  shard: Shard;
  config?: RunConfig;
  deadline?: number; // epoch ms on `clock`: no dispatch at or after it
  routeEnd?: number; // epoch ms on `clock`: the function's end; a trader is dispatched only if its cost fits before it
  clock?: () => number;
  sync?: (u: SyncableUser, broker: Broker) => Promise<number | 'skipped'>;
  broker?: Broker;
  vendorBoundMs?: number; // one vendor request's bound (the fit check's unit); VENDOR_TIMEOUT_MS
  jitterMs?: number; // the start spread for of > 1 (START_JITTER_MS, or SYNC_START_JITTER_MS)
  leaseMs?: number; renewMs?: number;
  bucket?: TokenBucket;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
  holder?: string;
};

// The answer adds `failedIds` (internal ids of this run's failed syncs, the route's `failed` as before); the log line and
// the shard row carry the counts only.
export async function runShard(o: RunOpts): Promise<RunReport & { failedIds: number[] }> {
  const t0 = performance.now();
  const sh = o.shard;
  const cfg = o.config ?? runConfig();
  const concurrency = Math.max(1, Math.min(cfg.concurrency, POOL_MAX - 2));
  const clock = o.clock ?? Date.now;
  const deadline = o.deadline ?? Infinity, routeEnd = o.routeEnd ?? Infinity;
  const bound = o.vendorBoundMs ?? VENDOR_TIMEOUT_MS;
  const leaseMs = o.leaseMs ?? SHARD_LEASE_MS, renewMs = o.renewMs ?? SHARD_RENEW_MS;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = o.log ?? ((line: string) => console.log(line));
  const shift = shiftOf(o);
  const holder = o.holder ?? randomUUID();
  const sync = o.sync ?? ((u: SyncableUser, b: Broker) => syncUser(u, b));
  const broker = o.broker ?? defaultBroker;
  const bucket = o.bucket ?? new TokenBucket(cfg.rps, cfg.burst);
  const r: RunReport = {
    of: sh.of, shard: sh.shard, busy: false, done: 0, skipped: 0, deferred: 0, transient: 0, refused: 0, failed: 0, quarantined: 0, releaseFailed: 0,
    remaining: null, inBackoff: null, stoppedAtDeadline: false, breaker: false, leaseLost: false, aborted: false,
    concurrency, requests: 0, tokenWaitMs: 0, pages: 0, ms: 0,
  };
  if (cfg.concurrency > concurrency) console.error('sync concurrency clamped to the pool', JSON.stringify({ asked: cfg.concurrency, used: concurrency, poolMax: POOL_MAX }));

  if (!(await acquireShard(sh, holder, leaseMs))) {
    r.busy = true;
    r.ms = Math.round(performance.now() - t0);
    log(`sync run ${JSON.stringify(r)}`);
    return { ...r, failedIds: [] };
  }
  log(`sync run start ${JSON.stringify({ of: sh.of, shard: sh.shard, concurrency, rps: cfg.rps })}`);
  let lastRenew = Date.now();
  const renew = async () => {
    try {
      if (await renewShard(sh, holder, leaseMs)) lastRenew = Date.now(); else r.leaseLost = true;
    } catch (e) {
      console.error('sync shard renew failed', errLabel(e));
      if (Date.now() - lastRenew >= leaseMs) r.leaseLost = true;
    }
  };
  const heartbeat = setInterval(() => { void renew(); }, renewMs);
  heartbeat.unref?.();

  const breaker = new Breaker();
  const failedIds: number[] = [];
  const queue: { id: number; accounts: number }[] = [];
  const inflight = new Set<number>();
  const passed: number[] = []; // not to be offered again this run (skipped on the lock, or no longer claimable)
  const unfit: number[] = []; // did not fit the time left: the next run takes them first, with a whole budget
  let exhausted = false;
  let refilling: Promise<void> | null = null;
  let stopReason: 'deadline' | null = null;
  const next = async () => {
    for (;;) {
      if (queue.length) return queue.shift()!;
      if (exhausted) return null;
      refilling ??= (async () => {
        try {
          const rows = await page(sh, o, shift(), [...inflight, ...passed, ...unfit], cfg.page);
          r.pages++;
          if (!rows.length) exhausted = true;
          for (const row of rows) if (!inflight.has(row.id)) queue.push(row);
        } finally { refilling = null; }
      })();
      await refilling;
    }
  };
  const stop = () => {
    if (clock() >= deadline) { stopReason = 'deadline'; return true; }
    return breaker.tripped || r.leaseLost || r.aborted;
  };

  // A database error outside a trader's sync (the page, a claim) stops the run cleanly: the lease is released, the
  // report is written, and claims already taken keep their leases' rules.
  const worker = async () => {
    try { await work(); } catch (e) { r.aborted = true; console.error('sync run aborted', errLabel(e)); }
  };
  const work = async () => {
    for (;;) {
      if (stop()) return;
      const c = await next();
      if (!c) return;
      const requests = 1 + 2 * c.accounts;
      if (routeEnd !== Infinity && syncCost(c.accounts) / VENDOR_TIMEOUT_MS * bound + bucket.estimateWaitMs(requests) > routeEnd - clock()) {
        unfit.push(c.id); r.deferred++; stopReason = 'deadline';
        continue;
      }
      await bucket.take(requests);
      if (stop()) return;
      if (Date.now() - lastRenew > RENEW_BEFORE_DISPATCH_MS) await renew();
      if (r.leaseLost) return;
      const u = await claimById(c.id, shift());
      if (!u) {
        passed.push(c.id);
        if (await quarantine(c.id, shift())) r.quarantined++;
        continue;
      }
      inflight.add(u.id);
      const count = { n: 0 };
      let end: End;
      try {
        end = (await sync(u, metered(broker, bucket, { left: requests }, count))) === 'skipped' ? 'skipped' : 'done';
      } catch (e) {
        end = classify(e);
        console.error('sync failed', u.id, end, errLabel(e)); // the internal id, the class and status; never the message
      }
      r.requests += count.n;
      if (end !== 'done' && end !== 'skipped') failedIds.push(u.id);
      if (end === 'done') r.done++;
      else if (end === 'skipped') { r.skipped++; passed.push(u.id); }
      else if (end === 'transient') r.transient++;
      else if (end === 'refused') r.refused++;
      else r.failed++;
      if (end !== 'skipped') breaker.record(end === 'transient' || end === 'refused');
      try { await finish(u, end, shift()); } catch (e) {
        // The lease lapses after SYNC_LEASE_MS; the attempt stays counted (visible here, so a false quarantine is too).
        r.releaseFailed++;
        console.error('sync release failed', u.id, errLabel(e));
      }
      inflight.delete(u.id);
    }
  };

  try {
    if (sh.of > 1) {
      const spread = o.jitterMs ?? (process.env.SYNC_START_JITTER_MS !== undefined ? Number(process.env.SYNC_START_JITTER_MS) || 0 : START_JITTER_MS);
      if (spread > 0) await sleep(Math.floor(Math.random() * spread));
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    clearInterval(heartbeat);
  }
  r.breaker = breaker.tripped;
  r.tokenWaitMs = bucket.waitedMs;
  try {
    const [c] = await sql`with clock as (${clockSql(shift())})
      select count(*) filter (where ${claimable()} and ${notBackedOff()})::int as remaining,
             count(*) filter (where not ${notBackedOff()})::int as "inBackoff"
      from users u, clock where ${syncable()} and ${inShard(sh)} ${scopeSql(o)}`;
    r.remaining = c.remaining as number;
    r.inBackoff = c.inBackoff as number;
  } catch (e) { console.error('sync remaining count failed', errLabel(e)); }
  r.stoppedAtDeadline = stopReason === 'deadline' && (r.remaining ?? 1) > 0;
  r.ms = Math.round(performance.now() - t0);
  try { await releaseShard(sh, holder, r); } catch (e) { console.error('sync shard release failed', errLabel(e)); }
  log(`sync run ${JSON.stringify(r)}`); // counts and durations only
  return { ...r, failedIds };
}

// Shard 0's coverage step, each call (committee C and round 2): what a round missed, in numbers only. Never throws to the
// route's flow (the caller wraps it), never branches the sync.
export type Coverage = {
  of: number; missingShards: number; unclaimedPrevRound: number; neverSynced: number; stalestHours: number;
  inBackoff: number; refused: number; quarantined: number; oldestRefusalHours: number; dbConfigOk: boolean; dbProblems: string[];
  db: { statementTimeoutMs: number; idleInTxMs: number; maxConnections: number };
};
export async function coverage(of: number, scope: Scope = {}, cfg: RunConfig = runConfig(), log = (line: string) => console.log(line)): Promise<Coverage> {
  const shift = shiftOf(scope)();
  const [c] = await sql`with clock as (${clockSql(shift)}), s as (
      select u.* from users u, clock where ${syncable()} ${scopeSql(scope)})
    select
      (select count(*)::int from generate_series(0, ${of}::int - 1) g left join sync_shards x on x.of = ${of}::int and x.shard = g
        where x.heartbeat_at is null or x.heartbeat_at < now() - ${MISSING_SHARD_MS}::float8 * interval '1 millisecond') as "missingShards",
      (select count(*)::int from s, clock where (s.sync_claimed_at is null or s.sync_claimed_at < clock.round_start - ${ROUND_MS}::float8 * interval '1 millisecond')
        and (s.sync_retry_at is null or s.sync_retry_at <= clock.t)
        and exists (select 1 from connections c where c.user_id = s.id and c.state = 'connected' and c.connected_at < clock.round_start - ${ROUND_MS}::float8 * interval '1 millisecond')) as "unclaimedPrevRound",
      (select count(*)::int from s where s.last_synced_at is null) as "neverSynced",
      (select coalesce(extract(epoch from clock.t - min(s.last_synced_at)) / 3600, 0)::float8 from s, clock group by clock.t) as "stalestHours",
      (select count(*)::int from s, clock where s.sync_retry_at > clock.t) as "inBackoff",
      (select count(*)::int from s where s.sync_failure_kind = 'refused') as refused,
      (select count(*)::int from s where s.sync_failure_kind = 'quarantined') as quarantined,
      (select coalesce(extract(epoch from clock.t - min(s.sync_failing_since)) / 3600, 0)::float8 from s, clock where s.sync_failure_kind = 'refused' group by clock.t) as "oldestRefusalHours"`;
  const settings = Object.fromEntries((await sql`select name, setting from pg_settings
    where name in ('statement_timeout', 'idle_in_transaction_session_timeout', 'max_connections')`).map((x) => [x.name as string, Number(x.setting)]));
  const db = { statementTimeoutMs: settings.statement_timeout ?? 0, idleInTxMs: settings.idle_in_transaction_session_timeout ?? 0, maxConnections: settings.max_connections ?? 0 };
  const workers = Math.max(1, Math.min(cfg.concurrency, POOL_MAX - 2));
  const check = dbConfigCheck(db, { shards: of, workers, maxSyncCostMs: syncCost(SYNC_FIT_CAP), userLeaseMs: SYNC_LEASE_MS });
  const out: Coverage = {
    of, missingShards: c.missingShards, unclaimedPrevRound: c.unclaimedPrevRound, neverSynced: c.neverSynced,
    stalestHours: Math.round((c.stalestHours ?? 0) * 10) / 10, inBackoff: c.inBackoff, refused: c.refused, quarantined: c.quarantined,
    oldestRefusalHours: Math.round((c.oldestRefusalHours ?? 0) * 10) / 10, dbConfigOk: check.ok, dbProblems: check.problems, db,
  };
  log(`sync coverage ${JSON.stringify(out)}`); // numbers only
  if (out.unclaimedPrevRound > 0 || out.missingShards > 0) log(`sync round incomplete ${JSON.stringify({ of, missingShards: out.missingShards, unclaimedPrevRound: out.unclaimedPrevRound })}`);
  return out;
}
