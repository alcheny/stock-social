// Sharded hourly sync (docs/SYNC.md; committee docs/features/logs/sync/committee-2026-11-01.md). One run syncs one
// shard's traders (`id % of = shard`) with bounded concurrency, a per-run deadline and a vendor request budget, under a
// fenced lease on the database clock so two runs of one shard never overlap. Each trader's sync is exactly
// lib/sync.ts#syncUser (one transaction: a failure publishes nothing). The durable cursor is the per-user round claim
// (lib/sync.ts): a run stopped at its deadline leaves the rest unclaimed at the head of the shard's queue (stalest
// first), so the next run resumes exactly there, and nobody is synced twice in a round.
import { randomUUID } from 'node:crypto';
import { POOL_MAX, sql } from './db.ts';
import { logSafe } from './privacy-log.ts';
import { VENDOR_TIMEOUT_MS } from './broker.ts';
import {
  accountsOf, claimable, clockSql, defaultBroker, syncable, syncCost, syncRequests, syncUser, SYNC_FIT_CAP, SYNC_LEASE_MS, ROUND_MS,
  type Broker, type SyncableUser,
} from './sync.ts';
import {
  BACKOFF_BASE_MS, BACKOFF_CAP_MS, Breaker, LatencyWindow, plannedSyncMs, routeEndMargin, RouteDeadlineError, TRANSIENT_LIMIT, classify, dbConfigCheck, runConfig, TokenBucket,
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
  done: number; skipped: number; deferred: number; transient: number; cutAtDeadline: number; refused: number; failed: number; quarantined: number; releaseFailed: number;
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
    select u.id, ${accountsOf()}::int as accounts from users u, clock
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
type End = 'done' | 'skipped' | 'cut' | FailureKind;
// Returns true when the attempt quarantined the trader (its TRANSIENT_LIMIT-th transient failure in a row).
export async function finish(u: Claimed, end: End, shift = 0): Promise<boolean> {
  const mine = sql`users.id = ${u.id} and users.sync_lease_until = ${u.lease}::text::timestamptz`;
  if (end === 'done') {
    await sql`update users set sync_lease_until = null, sync_attempts = 0, sync_failures = 0, sync_retry_at = null,
      sync_failure_kind = null, sync_failing_since = null, sync_transients = 0 where ${mine}`;
  } else if (end === 'skipped') {
    // Another sync holds the trader's lock: the round claim it replaced goes back and the attempt is undone.
    await sql`update users set sync_claimed_at = ${u.prev}::text::timestamptz, sync_lease_until = null,
      sync_attempts = greatest(users.sync_attempts - 1, 0) where ${mine}`;
  } else if (end === 'cut') {
    // Refused at the route's end (RouteDeadlineError): not a failure of any kind — no streak, no backoff, no attempt. The
    // round claim it replaced goes back (as for a skipped sync), so the next call in this round takes it first.
    await sql`update users set sync_claimed_at = ${u.prev}::text::timestamptz, sync_lease_until = null, sync_attempts = 0 where ${mine}`;
  } else if (end === 'transient') {
    // Not the trader's fault: no backoff; the round claim stays, so it is retried next round. Unless it is the
    // TRANSIENT_LIMIT-th in a row: then the trader is quarantined (a backoff), so a record that always times out (or
    // whose data always throws) is never retried every round forever.
    const hit = sql`users.sync_transients + 1 >= ${TRANSIENT_LIMIT}`;
    const rows = await sql`with clock as (${clockSql(shift)})
      update users set sync_lease_until = null, sync_attempts = 0,
        sync_transients = case when ${hit} then 0 else users.sync_transients + 1 end,
        sync_failures = case when ${hit} then users.sync_failures + 1 else users.sync_failures end,
        sync_retry_at = case when ${hit} then clock.t + ${backoffSql()} else users.sync_retry_at end,
        sync_failure_kind = case when ${hit} then 'quarantined' else users.sync_failure_kind end,
        sync_failing_since = case when ${hit} then coalesce(users.sync_failing_since, clock.t) else users.sync_failing_since end
      from clock where ${mine} returning users.sync_transients = 0 as quarantined`;
    return rows.length === 1 && rows[0].quarantined === true;
  } else {
    await sql`with clock as (${clockSql(shift)})
      update users set sync_lease_until = null, sync_attempts = 0, sync_failures = users.sync_failures + 1,
        sync_retry_at = clock.t + ${backoffSql()}, sync_failure_kind = ${end},
        sync_failing_since = coalesce(users.sync_failing_since, clock.t)
      from clock where ${mine}`;
  }
  return false;
}

// ponytail: a request beyond the prepaid syncRequests(n) (another page on a first sync) waits for its token inside the trader's
// transaction, holding its connection — rare; prepaying from the account's page count would avoid it.
// Every vendor request a sync makes takes a token. The trader's expected requests (syncRequests(n) = 1 + SYNC_REQUESTS_PER_ACCOUNT × n) are taken before the claim,
// outside its transaction; a request beyond them (another page on a first sync, an account the snapshot did not have)
// takes one more as it goes.
type Guard = { clock: () => number; routeEnd: number; boundMs: number };
function metered(b: Broker, bucket: TokenBucket, prepaid: { left: number }, count: { n: number }, latency?: LatencyWindow, guard?: Guard): Broker {
  const pay = async (n: number) => {
    // Refused before it starts (and before its token) when its n sequential requests, each at its bound, could reach the
    // route's last margin (10 s at the production bound): a multi-account activities read is one call of n requests
    // (orchestrator review, blocking 1).
    if (guard && guard.routeEnd !== Infinity && guard.clock() + n * guard.boundMs > guard.routeEnd - routeEndMargin(guard.boundMs)) throw new RouteDeadlineError();
    count.n += n;
    const free = Math.min(prepaid.left, n);
    prepaid.left -= free;
    if (n > free) await bucket.take(n - free);
  };
  // Each call is timed after its tokens are taken (vendor time only); `n` requests share the call's duration (a
  // multi-account activities read is one call of n requests).
  // ponytail: a multi-account activities read is timed as one call, so its requests enter the p99 at their average and
  // an outlier among them is hidden; and a read past one vendor page (an activities week or a share-move history over
  // 1,000 rows) makes requests the guard cannot see — timing and guarding each request needs lib/broker.ts (protected)
  // to take a per-request hook.
  const timed = async <T>(n: number, call: () => Promise<T>): Promise<T> => {
    await pay(n);
    const t0 = performance.now();
    try { return await call(); } finally { const per = (performance.now() - t0) / n; for (let i = 0; i < n; i++) latency?.record(per); }
  };
  return {
    pageLimit: b.pageLimit,
    listAccounts: (u) => timed(1, () => b.listAccounts(u)),
    // OPTIONS (final review blocking 1): every argument is forwarded, the option sinks included (fetchActivities' 4th,
    // fetchActivitiesPage's 5th, fetchPositions' 3rd); a wrapper that drops one silently stops option imports.
    fetchActivities: (...args: Parameters<Broker['fetchActivities']>) => timed(Math.max(1, args[2]?.length ?? 1), () => b.fetchActivities(...args)),
    ...(b.fetchActivitiesPage ? { fetchActivitiesPage: (...args: Parameters<NonNullable<Broker['fetchActivitiesPage']>>) => timed(1, () => b.fetchActivitiesPage!(...args)) } : {}),
    ...(b.fetchPositions ? { fetchPositions: (...args: Parameters<NonNullable<Broker['fetchPositions']>>) => timed(1, () => b.fetchPositions!(...args)) } : {}),
    // Corporate actions (#40): each real account's share moves; every broker function the sync uses must pass through.
    ...(b.fetchShareMoves ? { fetchShareMoves: (u: Parameters<NonNullable<Broker['fetchShareMoves']>>[0], id: string) => timed(1, () => b.fetchShareMoves!(u, id)) } : {}),
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
  const shift = shiftOf(o);
  const holder = o.holder ?? randomUUID();
  const sync = o.sync ?? ((u: SyncableUser, b: Broker) => syncUser(u, b));
  const broker = o.broker ?? defaultBroker;
  // ponytail: the vendor budget is this run's, in process: one run per (of, shard) at a time, but runs of another shard
  // count (a manual call during a sharded schedule) add their own — a budget row in the database would bound the fleet.
  const bucket = o.bucket ?? new TokenBucket(cfg.rps, cfg.burst);
  const r: RunReport = {
    of: sh.of, shard: sh.shard, busy: false, done: 0, skipped: 0, deferred: 0, transient: 0, cutAtDeadline: 0, refused: 0, failed: 0, quarantined: 0, releaseFailed: 0,
    remaining: null, inBackoff: null, stoppedAtDeadline: false, breaker: false, leaseLost: false, aborted: false,
    concurrency, requests: 0, tokenWaitMs: 0, pages: 0, ms: 0,
  };
  if (cfg.concurrency > concurrency) console.error('sync concurrency clamped to the pool', JSON.stringify({ asked: cfg.concurrency, used: concurrency, poolMax: POOL_MAX }));

  if (!(await acquireShard(sh, holder, leaseMs))) {
    r.busy = true;
    r.ms = Math.round(performance.now() - t0);
    emit('sync run', r, o.log);
    return { ...r, failedIds: [] };
  }
  emit('sync run start', { of: sh.of, shard: sh.shard, concurrency, rps: cfg.rps }, o.log);
  let lastRenew = Date.now();
  const renew = async () => {
    try {
      if (await renewShard(sh, holder, leaseMs)) lastRenew = Date.now(); else r.leaseLost = true;
    } catch (e) {
      console.error('sync shard renew failed', logSafe(e));
      if (Date.now() - lastRenew >= leaseMs) r.leaseLost = true;
    }
  };
  const heartbeat = setInterval(() => { void renew(); }, renewMs);
  heartbeat.unref?.();

  // ponytail: the breaker's window is one run's attempts; an outage is re-detected by every run of every shard (20
  // attempts each) — a shared breaker row would stop the fleet after the first.
  const breaker = new Breaker();
  const latency = new LatencyWindow();
  const failedIds: number[] = [];
  const queue: { id: number; accounts: number }[] = [];
  const inflight = new Set<number>();
  const passed: number[] = []; // not to be offered again this run (skipped on the lock, or no longer claimable)
  const unfit: number[] = []; // did not fit the time left: the next run takes them first, with a whole budget
  const popped = new Set<number>(); // taken from the queue by a worker and not yet claimed (waiting for tokens)
  let exhausted = false;
  let firstTaken = false;
  let refilling: Promise<void> | null = null;
  let stopReason: 'deadline' | null = null;
  const next = async () => {
    for (;;) {
      if (queue.length) { const c = queue.shift()!; popped.add(c.id); return c; }
      if (exhausted) return null;
      refilling ??= (async () => {
        try {
          const rows = await page(sh, o, shift(), [...inflight, ...popped, ...passed, ...unfit], cfg.page);
          r.pages++;
          if (!rows.length) exhausted = true;
          for (const row of rows) if (!inflight.has(row.id) && !popped.has(row.id)) queue.push(row);
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
    try { await work(); } catch (e) { r.aborted = true; console.error('sync run aborted', logSafe(e)); }
  };
  const work = async () => {
    for (;;) {
      if (stop()) return;
      const c = await next();
      if (!c) return;
      const requests = syncRequests(c.accounts);
      // The first trader a run takes is always dispatched (it has the whole call; one that cannot fit even a whole call is
      // cut, and after TRANSIENT_LIMIT such cuts quarantined),
      // so a trader with many accounts is never deferred forever by shard 0's housekeeping (review should-fix 2).
      const first = !firstTaken;
      firstTaken = true;
      // Fit rule v2 (committee round 3): the trader's requests at this run's observed p99 plus one whole bound for a
      // straggler (the worst case, every request at the bound, until 50 requests are timed), plus the route-end guard's
      // margin and the token wait — so a trader is not dispatched only to be cut by the guard.
      // ponytail: the guard covers each vendor call before it starts, not the database work after the last one (the
      // rebuild and the positions write, well under a second at 10,000 activities) nor the extra pages noted at
      // `metered`; a sync that needs more than one call's vendor time is cut every time it is first in a call, and its
      // cut streak quarantines it (backed off, counted) — the per-account resumable sync (follow-up PR) lets it finish.
      if (!first && routeEnd !== Infinity && plannedSyncMs(requests, bound, latency.p99()) + routeEndMargin(bound) + bucket.estimateWaitMs(requests) > routeEnd - clock()) {
        unfit.push(c.id); popped.delete(c.id); r.deferred++; stopReason = 'deadline';
        // Nothing smaller can fit either, or the list has grown past a few pages: stop reading the queue (the exclusion
        // list rides on every page query).
        if (c.accounts <= 1 || unfit.length >= 4 * cfg.page) { exhausted = true; queue.length = 0; }
        continue;
      }
      await bucket.take(requests);
      if (stop()) return;
      if (Date.now() - lastRenew > Math.min(RENEW_BEFORE_DISPATCH_MS, leaseMs / 4)) await renew();
      if (r.leaseLost) return;
      const u = await claimById(c.id, shift());
      if (u) inflight.add(u.id);
      popped.delete(c.id);
      if (!u) {
        passed.push(c.id);
        if (await quarantine(c.id, shift())) r.quarantined++;
        continue;
      }
      const count = { n: 0 };
      let end: End;
      try {
        end = (await sync(u, metered(broker, bucket, { left: requests }, count, latency, { clock, routeEnd, boundMs: bound }))) === 'skipped' ? 'skipped' : 'done';
      } catch (e) {
        // A cut at the route's end is given back to the round, unless the trader had the whole call (the run's first pick):
        // then it is counted as a transient failure, so a sync that can never fit a call reaches TRANSIENT_LIMIT and is
        // quarantined instead of holding a worker every call forever (orchestrator review, blocking 2).
        end = e instanceof RouteDeadlineError ? (first ? 'transient' : 'cut') : classify(e);
        if (e instanceof RouteDeadlineError && first) r.cutAtDeadline++;
        // The internal id, the failure class and the error's class and status; never the message (lib/privacy-log.ts).
        if (end === 'cut') console.error('sync cut at the route deadline', u.id);
        else if (end === 'transient') console.error('sync failed transient', u.id, logSafe(e));
        else if (end === 'refused') console.error('sync failed refused', u.id, logSafe(e));
        else console.error('sync failed trader', u.id, logSafe(e));
      }
      r.requests += count.n;
      if (end !== 'done' && end !== 'skipped' && end !== 'cut') failedIds.push(u.id);
      if (end === 'done') r.done++;
      else if (end === 'skipped') { r.skipped++; passed.push(u.id); }
      else if (end === 'cut') r.cutAtDeadline++;
      else if (end === 'transient') r.transient++;
      else if (end === 'refused') r.refused++;
      else r.failed++;
      if (end !== 'skipped' && end !== 'cut') breaker.record(end === 'transient' || end === 'refused');
      try { if (await finish(u, end, shift())) r.quarantined++; } catch (e) {
        // The lease lapses after SYNC_LEASE_MS; the attempt stays counted (visible here, so a false quarantine is too).
        r.releaseFailed++;
        console.error('sync release failed', u.id, logSafe(e));
      }
      inflight.delete(u.id);
    }
  };

  try {
    // Shard 0 spends its start on housekeeping already; the spread is for the other shards.
    if (sh.of > 1 && sh.shard !== 0) {
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
  } catch (e) { console.error('sync remaining count failed', logSafe(e)); }
  r.stoppedAtDeadline = stopReason === 'deadline' && (r.remaining ?? 1) > 0;
  r.ms = Math.round(performance.now() - t0);
  try { await releaseShard(sh, holder, r); } catch (e) { console.error('sync shard release failed', logSafe(e)); }
  emit('sync run', r, o.log); // counts and durations only
  return { ...r, failedIds };
}

// The log lines (numbers only). `log` is a test hook receiving the whole line; by default each kind is its own literal
// console call, which lib/privacy-logs.test.ts can check.
type LogKind = 'sync run start' | 'sync run' | 'sync coverage' | 'sync round incomplete';
function emit(kind: LogKind, report: object, log?: (line: string) => void) {
  if (log) return log(`${kind} ${JSON.stringify(report)}`);
  if (kind === 'sync run start') console.log('sync run start', JSON.stringify(report));
  else if (kind === 'sync run') console.log('sync run', JSON.stringify(report));
  else if (kind === 'sync coverage') console.log('sync coverage', JSON.stringify(report));
  else console.log('sync round incomplete', JSON.stringify(report));
}

// Shard 0's coverage step, each call (committee C and round 2): what a round missed, in numbers only. Never throws to the
// route's flow (the caller wraps it), never branches the sync.
export type Coverage = {
  of: number; missingShards: number; unclaimedPrevRound: number; neverSynced: number; stalestHours: number;
  inBackoff: number; refused: number; quarantined: number; oldestRefusalHours: number; dbConfigOk: boolean; dbProblems: string[];
  db: { statementTimeoutMs: number; idleInTxMs: number; maxConnections: number };
};
// ponytail: the coverage counts scan every syncable trader on each shard-0 call (100k rows: tens of ms) — past a few
// million, sum the shards' `last_run` counters instead.
export async function coverage(of: number, scope: Scope = {}, cfg: RunConfig = runConfig(), log?: (line: string) => void): Promise<Coverage> {
  const shift = shiftOf(scope)();
  const [c] = await sql`with clock as (${clockSql(shift)}), s as (
      select u.* from users u, clock where ${syncable()} ${scopeSql(scope)})
    select
      (select count(*)::int from generate_series(0, ${of}::int - 1) g left join sync_shards x on x.of = ${of}::int and x.shard = g
        where x.heartbeat_at is null or x.heartbeat_at < now() - ${MISSING_SHARD_MS}::float8 * interval '1 millisecond') as "missingShards",
      (select count(*)::int from s, clock where (s.sync_claimed_at is null or s.sync_claimed_at < clock.round_start - ${ROUND_MS}::float8 * interval '1 millisecond')
        and (s.sync_retry_at is null or s.sync_retry_at <= clock.t)
        and exists (select 1 from connections c where c.user_id = s.id and c.state = 'connected' and c.disconnected_at is null and c.connected_at < clock.round_start - ${ROUND_MS}::float8 * interval '1 millisecond')) as "unclaimedPrevRound",
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
  emit('sync coverage', out, log); // numbers only
  if (out.unclaimedPrevRound > 0 || out.missingShards > 0) emit('sync round incomplete', { of, missingShards: out.missingShards, unclaimedPrevRound: out.unclaimedPrevRound }, log);
  return out;
}
