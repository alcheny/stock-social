# Hourly sync: shards, schedule and switch-on gate

How the hourly broker sync covers every connected trader, how to configure the cron, and what must be true before
the sharded schedule is switched on. Code: `app/api/sync/route.ts`, `lib/sync-shard.ts`, `lib/sync-limits.ts`,
`lib/sync.ts`. Decisions and reasons: `docs/features/logs/sync/committee-2026-11-01.md` (signed 2026-11-01).

## How it works

- `POST /api/sync?shard=i&of=N` with `Authorization: Bearer $CRON_SECRET` syncs only traders whose id satisfies
  `id % N = i`. No parameters means `shard=0&of=1`: every trader, the behavior before sharding. Parameters are checked
  after the secret: bad ones answer 400 (`0 <= i < N <= 1024`, whole numbers, both or neither).
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
  `(1 + 2n)` vendor bounds, plus the expected wait for rate tokens, fit before the limit (n = accounts). A trader that
  does not fit is left for the next call, which starts with a full budget.
- **Vendor budget.** Each run has a token bucket of `SYNC_VENDOR_RPS` requests per second. Because only one run per shard
  is possible, this is the shard's whole budget. A trader's `1 + 2n` requests are taken before it is claimed, outside
  its transaction. Any extra request (another page on a first sync) takes a token as it goes. The aggregate vendor
  ceiling is `N × SYNC_VENDOR_RPS`.
- **Failures.** What a failure does depends on its cause:
  - **Trader-specific** (a vendor refusal 401/403/404, another 4xx, an account claimed by another profile, a record the
    rebuild rejects): the trader backs off for 1 h after the first failure, then 2 h, 4 h and so on, capped at 24 h. A
    success clears the backoff.
  - **Transient** (429, 5xx, a vendor timeout, a dropped connection): never held against the trader. It keeps its round
    claim and is retried next round.
  - **Breaker:** once 20 attempts have finished, a run stops if at least half of the last 20 were transient or refused,
    since at that scale the cause is an outage or our own credentials.
  - **Unfinished claims:** two claims that never finished (the process died mid-sync) quarantine the trader, which is a
    backoff, so one poison record never stalls its shard.
- **Housekeeping** (expired sign-in links, the connections tick, pending deletions, the discovery purge) runs only on
  shard 0, before and regardless of its lease. Its time is reported as `housekeepingMs`.

## Logs (numbers only, no personal data)

| Line | When | Fields |
|---|---|---|
| `sync run start {…}` | a run took its lease | of, shard, concurrency, rps |
| `sync run {…}` | every call | of, shard, busy, done, skipped (lock held elsewhere), deferred (did not fit), transient, refused, failed, quarantined, releaseFailed, remaining (left this round), inBackoff, stoppedAtDeadline, breaker, leaseLost, aborted, concurrency, requests, tokenWaitMs, pages, ms |
| `sync coverage {…}` | every shard-0 call | missingShards (no heartbeat in 15 min, counting shards that never ran), unclaimedPrevRound, neverSynced, stalestHours, inBackoff, refused, quarantined, oldestRefusalHours, dbConfigOk, dbProblems, db settings |
| `sync round incomplete {…}` | the previous round left traders unclaimed, or a shard is missing | of, missingShards, unclaimedPrevRound |
| `sync failed <id> <class> <status>` | one trader's sync failed | internal user id, failure class, error name and HTTP status (never the message) |

Alert on `sync round incomplete`, on `breaker: true`, and on `dbConfigOk: false`.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `SYNC_CONCURRENCY` | 6 (1–32) | workers per run; clamped to `DATABASE_POOL_MAX − 2` |
| `SYNC_VENDOR_RPS` | 10 (1–1000) | vendor requests per second per shard |
| `SYNC_VENDOR_BURST` | = RPS | the most requests saved up |
| `SYNC_PAGE` | 500 | traders read per queue page |
| `SYNC_START_JITTER_MS` | 15000 | sharded calls (`of > 1`) start after a random delay up to this; 0 disables |
| `DATABASE_POOL_MAX` | 10 | the app's connection pool per instance (`lib/db.ts`) |

## Capacity and the production plan

The per-shard rate is `min(C / L, RPS / q)` traders per second, where C is the workers, L is one trader's sync time and
q is its vendor requests. Each round has 11 calls (every 5 minutes, never at :30) of 210 s of dispatching, so 2,310 s.

| Plan | Assumptions | Per shard per round | Total |
|---|---|---|---|
| **32 shards × 6 workers, RPS 10** (the plan) | p95 0.5 s per request, half the traders with 2 accounts (q ≈ 4, L ≈ 2.1 s) | design min(2.8, 2.5) × 2,310 = 5,775; **measured ≈ 4,860** | **≈ 155k measured (1.55× over 100k)** |
| 16 × 6, RPS 10 | the same | ≈ 4,860 | ≈ 78k: too small |
| of=1 (today's cron) | the same | ≈ 4,860 | ≈ 4.9k (sequential was ~5k at 0.5 s a trader) |

**Measured** (`lib/sync-shard.load.test.ts`, opt-in `LOAD=1`, 2026-11-01). The test runs 100,000 synthetic traders
against the in-repo vendor fake on 32 shards × 6 workers. Time is scaled by 10: 50 ms a request, a 3 s request bound,
30 s calls with a 9 s reserve, and 100 req/s per shard. Database time is not scaled, so the test errs on the
conservative side.

- Of the 100,000 traders, 98,912 healthy ones were synced exactly once in round 1. The 989 slow traders, whose requests
  pass the bound, counted as transient and were synced in round 2. The 99 failing traders were backed off.
- Shards were disjoint, at 20.6 traders a second per shard in scaled time. The worst shard used 7.08 of the round's
  11 calls (1.55× headroom); in whole calls, 8 of 11.
- The latency-model test (one shard, real 200–500 ms latency, RPS 10, 6 workers) measured 2.58 traders a second. The
  prediction was 2.60 (−0.6%).

**Why the measured figure is below the design figure.** The fit check (below) claims a 2-account trader only while 5
request bounds (150 s) still fit before the call's end. Late in each call a shard therefore claims only 1-account
traders, and 2-account traders wait for the next call. This keeps a worst-case sync from overrunning, at the cost of
about 15% of a mixed shard's throughput. A shard whose traders all have many accounts gets proportionally less
throughput: size N for the real account distribution.

**Database:** peak connections are `N × (C + 2)` = 32 × 8 = **256**, plus the rest of the app. A pooler does not reduce
this: each held transaction pins a server connection. Size the server for about 300 backends (`max_connections` ≥ 300,
and memory for them: `work_mem` × backends must fit next to `shared_buffers`). Set timeouts at the role level, for
example:

```sql
alter role stock_social set statement_timeout = '60s';
alter role stock_social set idle_in_transaction_session_timeout = '5min';
```

The idle timeout must sit above the largest sync cost (`(1 + 2 × SYNC_FIT_CAP) × 30 s`) and below the per-user lease
(10 min). Shard 0's coverage line checks both timeouts and `max_connections ≥ N × (C + 2) + 20`, and reports
`dbConfigOk`.

## Cron setup

- **Today (until the gate below is met):** one call `POST /api/sync` (shard 0 of 1) every 5 minutes, never at :30:
  `5,10,15,20,25,35,40,45,50,55,0 * * * *`. This already uses 6 concurrent workers.
- **Sharded plan:** 32 calls on that same schedule, `POST /api/sync?shard=i&of=32` for i = 0…31. Configure them as 32
  cron entries, or one scheduler job that sends all 32 at once. Each call has `maxDuration` 300 s. The random start
  delay spreads them out. Set `SYNC_CONCURRENCY=6`, `SYNC_VENDOR_RPS=10` and `DATABASE_POOL_MAX=8` (C + 2).
- Changing N is safe at any time: round claims carry over, so nobody is synced twice. Leases are per (N, shard), so
  for one round both counts may run, and the vendor budget can briefly reach the sum of both plans.

## Switch-on gate (required before any `of > 1` cron)

Every item below must hold. Until then, the cron stays at `of=1`.

1. **The vendor has confirmed the quota in writing**: at least `N × SYNC_VENDOR_RPS` (320 req/s for the plan), for the
   plan's account. If the quota is lower, the quota caps capacity, not N. Lower RPS and re-run the capacity table.
2. **The "Last updated ‹date›" line has shipped.** A connected record whose last sync is over 24 h old must say so on the
   profile and the open-positions block (owner decision via the three-variant process). Without it, a trader in backoff
   keeps a record that looks live.
3. **The owner has decided the TR-5 rule for vendor refusals:** whether repeated 401/403s disconnect (freeze) a record.
   Nothing clears `disconnected_at` today, so this is irreversible. Until then, refusals are counted (`refused`,
   `oldestRefusalHours`) and backed off.
4. **Shard 0 reports `dbConfigOk: true`** against the production database, with the plan's N and C.
