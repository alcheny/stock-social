## What changes

Removes the known limit "`/api/sync` loops users sequentially (~5k traders/hour)". The hourly cron can now cover
100,000+ connected traders within the hour, with no new dependency or service.

- **`POST /api/sync?shard=i&of=N`**: the Bearer `CRON_SECRET` auth is unchanged and is checked before the parameters
  (bad parameters → 400).
  - The call syncs only traders with `id % N = i`. No parameters means shard 0 of 1, today's behavior.
  - Shard 0 alone runs the housekeeping and the privacy slots (in #31's order) and logs the coverage report.
  - The answer keeps `ok`, `skipped`, `failed` (ids), `unclaimed`, `stoppedAtDeadline` and `connections`, and adds `run`
    (counters) and `coverage`.
- **`lib/sync-shard.ts`** (new): the shard runner.
  - Bounded concurrent workers (`SYNC_CONCURRENCY`, clamped to `DATABASE_POOL_MAX − 2`).
  - A per-run deadline and fit check. A run's first trader is always dispatched.
  - A fenced 60 s shard lease on the database clock, renewed every 15 s; a busy shard answers 200 `{busy: true}`.
  - A per-shard vendor token bucket (`SYNC_VENDOR_RPS`), taken before the claim, outside the transaction.
  - Per-trader backoff: 1 h doubling, capped at 24 h.
  - Transient failures are never held against the trader. A run breaker stops a run when its failures look fleet-wide.
  - Poison-trader quarantine.
  - Counters-only log lines (`sync run`, `sync coverage`, `sync round incomplete`).
- **The durable cursor is the per-user round claim.** A run stopped at its deadline leaves the rest unclaimed at the head
  of the shard's stalest-first queue, so the next call resumes there. Nobody is synced twice in a round.
- **Each trader's sync is still exactly `syncUser`.** It re-reads 7 days in one transaction, so D4/D5 hold. `lib/sync.ts`
  only exports a few helpers; `lib/broker.ts` is untouched.
- **`GET /api/sync`** (business council, PR #45): the host's cron sends GET. It is the same handler as POST, with the
  same constant-time bearer check and the same parameters. The owner adds the cron schedule as a deploy setting; the
  exact `vercel.json` lines are below.
- **F-3's `reconcileIfDue()`** runs once per tick on shard 0, inside the housekeeping, before the sync.
- **`lib/sync-limits.ts`** (new), the pure parts: shard parameters, run config, the token bucket, the backoff schedule,
  failure classes, the breaker, and the database settings check.
- **`lib/db.ts`**: `DATABASE_POOL_MAX` (default 10, clamped to 3–500).
- **`db/schema.sql`** (appended, idempotent): five `users.sync_*` columns, the `users_sync_order` partial index, the
  `sync_shards` table, and indexes on the `on delete set null` foreign keys that made bulk deletes scan whole tables.
  `sync_shards` is in `lib/privacy-retention.ts#SCHEMA_MAP` (no personal data).
- **The in-repo vendor fake** (`e2e/fakes/vendor.ts`) gains three additive controls: `/_bulk`, `/_latency`, `/_stats`.
- **`docs/SYNC.md`** (new): how it works, logs, configuration, measured capacity, the cron setup (32 shards on the
  existing 5-minute schedule), and a **hard switch-on gate**. Until that gate is met the cron stays at `of=1`, which is
  already about as fast as before, with 6 workers.

**For the owner: CLAUDE.md "Known limits"** (owner-only, so not edited here). Suggested replacement for the second bullet:
> `/api/sync` is sharded (`?shard=i&of=N`, docs/SYNC.md): measured 155k traders a round on 32 shards × 6 workers
> (1.55× over 100k). Switch-on gate in docs/SYNC.md (vendor quota in writing, the "Last updated" line, the owner's TR-5
> refusal rule, `dbConfigOk`). Remaining ponytail (lib/sync.ts): a sync past SYNC_FIT_CAP accounts, or reading more than
> one vendor page per account, can still overrun and roll back. The runner quarantines such a trader; per-account
> checkpoints are a follow-up PR.

DESIGN §2.7 still describes the sequential loop. It should point at docs/SYNC.md.

**For the owner: `vercel.json`** (deploy setting, not in this repo). Today, unsharded:

```json
{ "crons": [ { "path": "/api/sync", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" } ] }
```

After the switch-on gate: 32 entries, `{ "path": "/api/sync?shard=i&of=32", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" }`
for i = 0…31 (docs/SYNC.md → Cron setup). The hosting plan must allow 5-minute crons and 32 entries.

## Known limits (each marked `ponytail:` at its place)

- `lib/sync.ts` (SYNC_FIT_CAP): a sync of more than 4 accounts, or one reading more than one vendor page per account, can
  still overrun the call and roll back. The runner dispatches such a trader first in a call and quarantines it after two
  overruns. Fix: a resumable per-account sync, as a follow-up PR (orchestrator-agreed).
- `lib/sync-shard.ts` (fit check): every request is assumed to take its whole 30 s bound, so a 2-account trader is
  claimed only in a call's first ~150 s, which costs ~15% of a mixed shard's throughput. Fix: a measured p99 bound.
- `lib/sync-shard.ts` (vendor budget): the budget is per run, in process. A manual call during a sharded schedule adds
  its own budget. Fix: a budget row in the database.
- `lib/sync-shard.ts` (breaker): its window covers one run, so an outage is re-detected by every shard's run. Fix: a
  shared breaker row.
- `lib/sync-shard.ts` (prepaid tokens): a request beyond the prepaid 1 + 2n waits for its token inside the trader's
  transaction (rare). Fix: prepay from the page count.
- `lib/sync-shard.ts` (coverage): the counts scan every syncable trader on each shard-0 call (tens of ms at 100k). Fix:
  sum the shards' `last_run` counters past a few million.
- `db/schema.sql` (`users_sync_order`): the shard filter runs after the index, so each page reads past other shards'
  rows (21–26 ms a page at 100k). Fix: an expression index for a fixed shard count.
- `app/api/sync/route.ts`: the cron schedule is a deploy setting for the owner (above).

## Decisions taken by the committee

The committee was the business lead, the engineer and a reliability reviewer. It held two rounds and all three signed;
an independent code review followed. The log is `docs/features/logs/sync/committee-2026-11-01.md`.

- **Cursor:** the per-user round claims are the durable cursor, with no id watermark. The shard row holds the lease, the
  heartbeat and the last run's counts.
- **Queue order:** stalest first (`last_synced_at nulls first, id`), so a short round rotates which traders it misses.
- **Plan:** 32 shards × 6 workers at 10 req/s per shard, sized for at least 1.5× headroom at a p95 latency with a
  2-account mix.
- **Backoff:**
  - Trader-specific failures back off: 401/403/404 (counted as `refused`), other 4xx, and a claimed account.
  - Transient failures do not: 429, 5xx, timeouts, transport errors, database-wide errors and code errors. They trip the
    breaker instead.
  - Two unfinished claims quarantine a trader.
- **Vendor refusals do not disconnect a record.** This is the owner's TR-5 call, since nothing clears `disconnected_at`
  today.
- **Housekeeping** runs on shard 0, before and regardless of the lease. A busy shard answers 200 `{busy: true}`.
- **Shard lease:** 60 s, fenced by its holder, renewed every 15 s.
- **Coverage report on shard 0:** missing shards, traders not claimed last round, never-synced traders, the stalest age,
  backoff, refusals with the oldest refusal's age, quarantine, and `dbConfigOk`.
- **Deferred to the owner, and part of the switch-on gate:**
  - a visible "Last updated ‹date›" line, which is a product change for the three-variant process;
  - the TR-5 rule for refusals;
  - the vendor's quota in writing.

## Testing

- `npx tsc --noEmit`: clean.
- `npm test`: **851 tests, 837 pass, 0 fail**, 14 skipped (opt-in LOAD tests). New files:
  - `lib/sync-limits.test.ts` (16 unit tests);
  - `lib/sync-shard.test.ts` (12 DB tests): shard assignment, deadline then resume, overlapping runs, the lease and
    fencing, backoff by class, breaker, quarantine and skipped, the rate bound, coverage, failure isolation with the real
    `syncUser`, and the first-dispatch fit rule;
  - `lib/db-pool.test.ts`.

  Two source-order assertions now look for `await runShard(` instead of `await syncTick(`, with the same order checked:
  `lib/sync.test.ts` (F-2 purge before the sync) and `lib/privacy-purge.test.ts` (privacy slots around the sync).
- `LOAD=1 node --test lib/sync-shard.load.test.ts`: 2/2 pass in 647 s.
  - **100,000 synthetic traders** against the in-repo vendor fake on 32 shards × 6 workers. Time is scaled by 10: 50 ms a
    request, a 3 s bound, 30 s calls, 100 req/s per shard. Database time is not scaled.
  - The mix: half 1-account and half 2-account, 989 slow traders that time out, and 99 failing traders.
  - Results: 98,912 healthy traders synced exactly once. The slow ones counted as transient and were synced next round;
    the failing ones were backed off. Shards were disjoint.
  - Throughput: 20.6 traders/s per shard in scaled time. The worst shard used 7.08 of the round's 11 calls (**1.55×
    headroom**), and 8 whole calls (≥ 15% margin). Peak database connections were 78.
  - Latency-model test (real 200–500 ms latency, one shard): 2.58 traders/s against a predicted 2.60.
- `npm run build`: ok.
- e2e against `npm run start` and the vendor fake: `e2e/sync-shards.spec.ts` (new: auth before parameters for POST and GET, 400s,
  shard vs shard-0 answers), `e2e/connect.spec.ts`, `e2e/app.spec.ts`, `e2e/privacy-gate.spec.ts`: **94 passed**; after
  the GET and F-3 merge, sync-shards + connect + privacy-gate: **42 passed**.
  - Locally the pinned Playwright needed the pre-installed Chromium via a throwaway local config, not committed.
  - A new `e2e/cron-lock.ts` serializes cron calls across spec files: `connect.spec.ts` and `privacy-gate.spec.ts` take
    it shared around their calls.
- `node scripts/autopilot.ts guard origin/main`: ok.
- `BASE_REF=main node scripts/compliance.ts auto`: the only finding is `node_modules/@img/sharp-wasm32` (a dependency
  licence). That package comes from main's lockfile and is not touched by this PR.

## Compliance

1. **Performance shown, ranked or described?** No. No display change. The capacity figures in docs/SYNC.md are
   operational.
2. **Personal data collected, stored, shown or sent?**
   - New per-trader operational fields on `users`: `sync_failures`, `sync_retry_at`, `sync_attempts`,
     `sync_failure_kind`, `sync_failing_since`. They are internal, never shown, and deleted with the account (the users
     row).
   - `sync_shards` holds counts only (SCHEMA_MAP: not personal).
   - Logs carry counts. Per-failure lines carry the internal id, the failure class and `logSafe(e)`, never the error's
     message (`lib/privacy-logs.test.ts` passes).
3. **Money, payments or rewards?** No.
4. **Email, push, SMS or tracking?** No.
5. **User-written text or images?** No.
6. **Sign-up, age, identity or accounts?** No.
7. **New vendor, dependency, font, image or copied code?** No new dependency. The vendor is unchanged and still called
   only through `lib/broker.ts`; vendor requests are now rate-bounded per shard.
8. **Accessibility?** No UI change.
9. **Security posture?** The endpoint keeps its constant-time Bearer check, applied before any parameter is parsed. The
   new `GET` is the same handler with the same check: it needs no cookie, so it adds no CSRF surface, and it is dynamic,
   never cached.
   No new public surface. Shard leases and claims are fenced on the database clock.
10. **Marketing or product claims?** None. The docs claim capacity only as measured, and gate the switch-on on the
    vendor's written quota.
11. **Checkout, trial or renewal?** No.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8kUvuYVmt9MLT5SmC6
