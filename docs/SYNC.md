# Hourly sync: shards, schedule and switch-on gate

How the hourly broker sync covers every connected trader, how to configure the cron, and what must be true before
the sharded schedule is switched on. Code: `app/api/sync/route.ts`, `lib/sync-shard.ts`, `lib/sync-limits.ts`,
`lib/sync.ts`. Decisions and reasons: `docs/features/logs/sync/committee-2026-11-01.md` (signed 2026-11-01).

## How it works

- `POST /api/sync?shard=i&of=N` with `Authorization: Bearer $CRON_SECRET` syncs only traders whose id satisfies
  `id % N = i`. No parameters means `shard=0&of=1`: every trader, the behavior before sharding. Parameters are checked
  after the secret: bad ones answer 400 (`0 <= i < N <= 1024`, whole numbers, both or neither).
- **What a call does.** The unsharded call (no parameters, or `of=1`) does everything, as before: housekeeping, the
  privacy slots, the sync and the coverage report. A sharded call (`of > 1`, shard 0 included) only syncs its shard.
  `?task=housekeeping&of=N` runs the housekeeping, the privacy slots and the coverage report for an N-shard schedule,
  and syncs nobody. It has its own cron entry, so no shard spends its window on housekeeping.
- **Each trader's sync is `syncUser`, unchanged**: one transaction under the trader's lock that re-reads the last 7 days;
  any failure rolls back, so a partial record is never published (F-1 D4/D5).
- **Rounds and the durable cursor.** Rounds run from :30 to :30 on the database clock. A trader is claimed at most once per
  round (`users.sync_claimed_at`). A shard reads its queue stalest first (`last_synced_at nulls first, id`), a page at
  a time. A run that stops at its deadline leaves the rest unclaimed at the head of that queue, and the next call resumes
  there. Nobody is synced twice in a round, even when N changes mid-round.
- **One run per shard at a time.** A shard is leased in `sync_shards`. The lease lasts 60 s on the database clock and is
  renewed every 15 s. A run whose renewal fails stops dispatching. A second call for a busy shard answers
  `200 {run: {busy: true}}` and does nothing. A killed run's lease lapses within a minute, so the next 5-minute call
  goes ahead.
- **Bounded concurrency.** `SYNC_CONCURRENCY` workers per run, never more than `DATABASE_POOL_MAX − 2`. A sync holds
  its database connection for its whole transaction, vendor calls included.
- **Deadline.** A run stops dispatching 90 s before the route's 300 s limit. It dispatches a trader only if
  `1 + 3n` vendor bounds (`syncRequests`: the account list, then each account's activities, positions and share moves), plus the expected wait for rate tokens, fit before the limit (n = accounts). A trader that
  does not fit is left for the next call, which starts with a full budget. A run's first trader is always dispatched
  (`SYNC_FIT_CAP` keeps any trader's worst case under one call), so the unsharded call's housekeeping can never defer
  a trader with many accounts forever.
- **Vendor budget.** Each run has a token bucket of `SYNC_VENDOR_RPS` requests per second. Because only one run per shard
  is possible, this is the shard's whole budget. A trader's `1 + 3n` requests are taken before it is claimed, outside
  its transaction. Any extra request (another page on a first sync) takes a token as it goes. The aggregate vendor
  ceiling is `N × SYNC_VENDOR_RPS`.
- **Failures.** What a failure does depends on its cause:
  - **Trader-specific** (a vendor refusal 401/403/404, another 4xx, an account claimed by another profile, a record the
    rebuild rejects): the trader backs off for 1 h after the first failure, then 2 h, 4 h and so on, capped at 24 h. A
    success clears the backoff.
  - **Transient** (429, 5xx, a vendor timeout, a dropped connection, a database-wide error such as too many connections
    or a statement timeout, or a code error such as a `TypeError` from an unexpected vendor answer): never held against
    the trader. It keeps its round
    claim and is retried next round.
  - **Breaker:** once 20 attempts have finished, a run stops if at least half of the last 20 were transient or refused,
    since at that scale the cause is an outage or our own credentials.
  - **Unfinished claims:** two claims that never finished (the process died mid-sync) quarantine the trader, which is a
    backoff, so one poison record never stalls its shard.
- **Housekeeping** (expired sign-in links, the connections tick, pending deletions, the discovery purge, the daily billing
  reconciliation) runs once per cron mark: in the unsharded call, or in the `task=housekeeping` call on a sharded
  schedule. It never waits on a shard lease. Its time is reported as `housekeepingMs`. Its own vendor calls (import
  steps, deletions) are outside the shards' request budgets.
- **Transient streak.** A trader that fails transiently 5 rounds in a row (`TRANSIENT_LIMIT`: a record that always
  times out, or whose own data always throws) is quarantined and backed off, never retried every round forever.

## Logs (numbers only, no personal data)

| Line | When | Fields |
|---|---|---|
| `sync run start {…}` | a run took its lease | of, shard, concurrency, rps |
| `sync run {…}` | every call | of, shard, busy, done, skipped (lock held elsewhere), deferred (did not fit), transient, refused, failed, quarantined, releaseFailed, remaining (left this round), inBackoff, stoppedAtDeadline, breaker, leaseLost, aborted, concurrency, requests, tokenWaitMs, pages, ms |
| `sync coverage {…}` | every unsharded or housekeeping call | missingShards (no heartbeat in 15 min, counting shards that never ran), unclaimedPrevRound, neverSynced, stalestHours, inBackoff, refused, quarantined, oldestRefusalHours, dbConfigOk, dbProblems, db settings |
| `sync round incomplete {…}` | the previous round left traders unclaimed, or a shard is missing | of, missingShards, unclaimedPrevRound |
| `sync failed <id> <class> <status>` | one trader's sync failed | internal user id, failure class, error name and HTTP status (never the message) |

Alert on `sync round incomplete`, on `breaker: true`, and on `dbConfigOk: false`.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `SYNC_CONCURRENCY` | 1 (1–32) | workers per run; clamped to `DATABASE_POOL_MAX − 2`. The plan sets 6 at switch-on |
| `SYNC_VENDOR_RPS` | 2 (1–1000) | vendor requests per second per shard. The plan sets 12 at switch-on |
| `SYNC_VENDOR_BURST` | = RPS | the most requests saved up |
| `SYNC_PAGE` | 500 | traders read per queue page |
| `SYNC_START_JITTER_MS` | 15000 | sharded calls (`of > 1`) other than shard 0 start after a random delay up to this; 0 disables |

The defaults are today's effective rate (one worker, about 2 vendor requests a second, the old sequential tick), so
merging this does not raise vendor load before the switch-on gate. The plan's values are set together with the
sharded cron.
| `DATABASE_POOL_MAX` | 10 | the app's connection pool per instance (`lib/db.ts`) |

## Capacity and the production plan

The per-shard rate is `min(C / L, RPS / q)` traders per second, where C is the workers, L is one trader's sync time and
q is its vendor requests. Each round has 11 calls (every 5 minutes, never at :30) of 210 s of dispatching, so 2,310 s.

| Plan | Assumptions | Per shard per round | Total |
|---|---|---|---|
| **40 shards × 6 workers, RPS 12** (the plan, committee round 3) | p95 0.5 s per request, half the traders with 2 accounts (q = 1 + 3 × 1.5 = 5.5, L ≈ 2.75 s) | design min(6/2.75, 12/5.5) = 2.18 a second × 2,310 ≈ 5,000; **measured ≈ 3,880** | **≈ 155k, extrapolated** from the measured per-shard rate × 40 (1.55× over 100k) |
| 32 × 6, RPS 10 (the plan before #40's third read) | the same | measured ≈ 3,125 | ≈ 100k: no headroom |
| of=1, defaults (1 worker, RPS 2) | the same | rate-bound: 2 / 5.5 ≈ 0.36 a second × 2,310 ≈ 840 at p95 latency | the old sequential rate (~5k/hour at 0.5 s a trader) |

**Measured** (`lib/sync-shard.load.test.ts`, opt-in `LOAD=1`, 2026-11-01, after #40). The test runs 100,000 synthetic
traders against the in-repo vendor fake on 40 shards × 6 workers, including the share-move read. Time is scaled by 10:
50 ms a request, a 3 s request bound, 30 s calls with a 9 s reserve, and 120 req/s per shard. Database time is not
scaled, so the test errs on the conservative side. The database server had 100 connections, so 10 shards ran at once
(in four batches), not all 40. The 155k total is therefore the measured per-shard rate times 40, an extrapolation that
assumes a database sized for 40 × 8 connections. The test drives `runShard` directly, not the route; with housekeeping
in its own call (above), every shard's window is the same.

- Of the 100,000 traders, 98,912 healthy ones were synced exactly once in round 1. The 989 slow traders, whose requests
  pass the bound, counted as transient and were synced in round 2. The 99 failing traders were backed off.
- Nothing was deferred, cut at a call's end or falsely quarantined. Shards were disjoint, at 16.5 traders a second per
  shard in scaled time (5.45 requests a trader).
- The worst shard used 7.09 of the round's 11 calls (**1.55× headroom**); in whole calls, 8 of 11 (1.38×).
- The latency-model test (one shard, real 200–500 ms latency, RPS 12, 6 workers) measured 2.17 traders a second. The
  prediction was 2.22 (−2.3%).

**Why the measured figure is below the design figure.** The database's own time (about 17 ms a sync) is not scaled in
the test, and the workers spend time waiting for pool connections. At production speed, a trader's sync is measured at
2.89 s, giving min(C/L = 2.07, RPS/requests = 2.20) ≈ 2.07 a second per shard. The plan has no concurrency slack:
C/L and RPS/requests are nearly equal, so latency spread lowers throughput directly. Re-measure on the real account
distribution before switch-on.

**Fit rule (committee round 3).** A trader is dispatched only if its requests fit before the call's end at the run's
observed p99, plus one whole bound for a straggler, plus a 10 s margin (all at the bound until 50 requests are timed).
The plan uses the trader's real account count. The run's first trader is always dispatched.

**Route-end guard.** A vendor call is refused (`RouteDeadlineError`) if its requests, each at its bound, could end in the
call's last 10 s; a multi-account activities read counts as n requests. The trader's transaction rolls back, so nothing
is published.
- A trader that was not the run's first pick gets its round claim back for the next call (`cutAtDeadline`), with no
  attempt, streak or backoff.
- The run's first pick had the whole call. A cut there counts as a transient failure, so a sync that can never fit a
  call is quarantined after 5 calls instead of holding a worker every call.

**What the guard does not cover** (`ponytail:` in `lib/sync-shard.ts`):
- the database work after the last vendor call (the rebuild and the positions write, well under a second);
- the requests of a read past one vendor page (an activities week or a share-move history over 1,000 rows), which run
  inside one broker call;
- per-request timing inside a multi-account read: its requests enter the p99 at their average.

Covering these needs a per-request hook in `lib/broker.ts`, or the resumable per-account sync (follow-up PR).

**Database:** peak connections are `N × (C + 2)` = 40 × 8 = **320**, plus the rest of the app. A pooler does not reduce
this: each held transaction pins a server connection. Size the server for about 360 backends (`max_connections` ≥ 340, the coverage check's `N × (C + 2) + 20`,
and memory for them: `work_mem` × backends must fit next to `shared_buffers`). Set timeouts at the role level, for
example:

```sql
alter role stock_social set statement_timeout = '60s';
alter role stock_social set idle_in_transaction_session_timeout = '6min';
```

The idle timeout must sit above the largest sync cost (`(1 + 3 × SYNC_FIT_CAP) × 30 s` = 300 s) and below the per-user lease
(10 min). The coverage line checks both timeouts and `max_connections ≥ N × (C + 2) + 20`, and reports
`dbConfigOk`.

## Cron setup

The endpoint answers both `POST` and `GET`, with the same bearer check and the same parameters. The host's cron
(`vercel.json` `crons`) sends `GET` with `Authorization: Bearer $CRON_SECRET` when the project's `CRON_SECRET` is set.
The schedule is a deploy setting for the owner: this repo has no `vercel.json`. Check that the hosting plan allows
5-minute crons, and how many cron entries it allows.

Today's entry (`of=1`):

```json
{ "crons": [ { "path": "/api/sync", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" } ] }
```

Sharded (after the switch-on gate): one entry per shard plus the housekeeping entry, on the same schedule:

```json
{ "crons": [
  { "path": "/api/sync?shard=0&of=40", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" },
  { "path": "/api/sync?shard=1&of=40", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" },
  …
  { "path": "/api/sync?shard=39&of=40", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" },
  { "path": "/api/sync?task=housekeeping&of=40", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" }
] }
```


- **Today (until the gate below is met):** one call `/api/sync` (shard 0 of 1) every 5 minutes, never at :30:
  `0,5,10,15,20,25,35,40,45,50,55 * * * *`. It does everything, at the default rate.
- **Sharded plan:** 40 calls on that same schedule, `/api/sync?shard=i&of=40` for i = 0…39, plus **one housekeeping
  call** `/api/sync?task=housekeeping&of=40` on the same schedule. Configure them as 41 cron entries, or one scheduler
  job that sends all 41 at once. Each call has `maxDuration` 300 s. The random start delay spreads them out. Set
  `SYNC_CONCURRENCY=6`, `SYNC_VENDOR_RPS=12` and `DATABASE_POOL_MAX=8` (C + 2).
- Runs with different shard counts do not exclude each other: a manual unsharded call during an `of=N` schedule adds
  its own vendor budget (round claims still prevent any double sync). Avoid manual calls while sharded.
- Changing N is safe at any time: round claims carry over, so nobody is synced twice. Leases are per (N, shard), so
  for one round both counts may run, and the vendor budget can briefly reach the sum of both plans.

## Switch-on gate (required before any `of > 1` cron)

Every item below must hold. Until then, the cron stays at `of=1`.

1. **The vendor has confirmed in writing both the quota and its cost**: at least `N × SYNC_VENDOR_RPS` (480 req/s for the
   plan), plus housekeeping's import and deletion calls, for the plan's account. If the quota is lower, the quota caps
   capacity, not N: lower RPS and re-run the capacity table. Whether the share-move read must run hourly is an open
   question for the owner and F-14 (sync cadence): read daily, it would cut the cost per account from 3 requests to
   about 2.
2. **The "Last updated ‹date›" line has shipped.** A connected record whose last sync is over 24 h old must say so on the
   profile and the open-positions block (owner decision via the three-variant process). Without it, a trader in backoff
   keeps a record that looks live.
3. **The owner has decided the TR-5 rule for vendor refusals:** whether repeated 401/403s disconnect (freeze) a record.
   Nothing clears `disconnected_at` today, so this is irreversible. Until then, refusals are counted (`refused`,
   `oldestRefusalHours`) and backed off.
4. **The coverage line reports `dbConfigOk: true`** against the production database, with the plan's N and C.
5. **The housekeeping entry is in the cron** (`task=housekeeping&of=N`). Without it, sharded calls run no deletions,
   purges, billing reconciliation or coverage report. Its `missingShards` must read 0 after one round.
