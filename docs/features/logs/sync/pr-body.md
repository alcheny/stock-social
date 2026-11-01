## What changes

Removes the known limit "`/api/sync` loops users sequentially (~5k traders/hour)". The hourly cron can now cover
100,000+ connected traders within the hour, with no new dependency or service.

- **`POST /api/sync?shard=i&of=N`**: the Bearer `CRON_SECRET` auth is unchanged and is checked before the parameters
  (bad parameters → 400).
  - The call syncs only traders with `id % N = i`. No parameters means shard 0 of 1, today's behavior.
  - What a call does (orchestrator review):
    - The unsharded call (no parameters or `of=1`) does everything, as before: the housekeeping, the privacy slots
      (in #31's order), the sync and the coverage report.
    - A sharded call (`of > 1`, shard 0 included) only syncs its shard.
    - `?task=housekeeping&of=N` runs the housekeeping, the privacy slots and the coverage report on a sharded schedule,
      as its own cron entry.
  - The answer keeps `ok`, `skipped`, `failed` (ids), `unclaimed`, `stoppedAtDeadline` and `connections`, and adds `run`
    (counters) and `coverage`.
- **`lib/sync-shard.ts`** (new): the shard runner.
  - Bounded concurrent workers (`SYNC_CONCURRENCY`, clamped to `DATABASE_POOL_MAX − 2`). The **defaults are today's
    effective rate** (1 worker, 2 req/s), so merging raises no vendor load; the plan's 6 workers and 12 req/s are set
    with the sharded cron, after the gate.
  - A per-run deadline and fit check (committee round 3): a trader is dispatched only if its requests fit at the run's
    observed p99, plus one bound and a 10 s margin. A run's first trader is always dispatched.
  - A route-end guard: a vendor call whose requests (n for an n-account read), each at its bound, could end in a call's
    last 10 s is refused (`RouteDeadlineError`). The trader rolls back and nothing is published. Its round claim goes
    back for the next call, with no attempt, streak or backoff. The exception is a run's first pick, which had the
    whole call: its cut counts as transient, so a sync that never fits is quarantined after 5 calls. What the guard does
    not cover is listed under Known limits.
  - A fenced 60 s shard lease on the database clock, renewed every 15 s; a busy shard answers 200 `{busy: true}`.
  - A per-shard vendor token bucket (`SYNC_VENDOR_RPS`), taken before the claim, outside the transaction.
  - Per-trader backoff: 1 h doubling, capped at 24 h.
  - Transient failures are never held against the trader. A run breaker stops a run when its failures look fleet-wide.
  - Poison-trader quarantine: two unfinished claims, or 5 transient failures in a row.
  - Counters-only log lines (`sync run`, `sync coverage`, `sync round incomplete`).
- **The durable cursor is the per-user round claim.** A run stopped at its deadline leaves the rest unclaimed at the head
  of the shard's stalest-first queue, so the next call resumes there. Nobody is synced twice in a round.
- **Each trader's sync is still exactly `syncUser`.** It re-reads 7 days in one transaction, so D4/D5 hold. `lib/sync.ts`
  only exports a few helpers; `lib/broker.ts` is untouched.
- **`GET /api/sync`** (business council, PR #45): the host's cron sends GET. It is the same handler as POST, with the
  same constant-time bearer check and the same parameters. The owner adds the cron schedule as a deploy setting; the
  exact `vercel.json` lines are below.
- **F-3's `reconcileIfDue()`** runs once per tick, inside the housekeeping block, before the sync. A source-order test
  (`lib/sync-route.test.ts`) checks it.
- **`lib/sync-limits.ts`** (new), the pure parts: shard parameters, run config, the token bucket, the backoff schedule,
  failure classes, the breaker, and the database settings check.
- **`lib/db.ts`**: `DATABASE_POOL_MAX` (default 10, clamped to 3–500).
- **`db/schema.sql`** (appended, idempotent): six `users.sync_*` columns, the `users_sync_order` partial index, the
  `sync_shards` table, and indexes on the `on delete set null` foreign keys that made bulk deletes scan whole tables.
  `sync_shards` is in `lib/privacy-retention.ts#SCHEMA_MAP` (no personal data).
- **The in-repo vendor fake** (`e2e/fakes/vendor.ts`) gains three additive controls: `/_bulk`, `/_latency`, `/_stats`.
- **`docs/SYNC.md`** (new): how it works, logs, configuration, measured capacity, the cron setup (40 shards on the
  existing 5-minute schedule, plus the housekeeping entry), and a **hard switch-on gate**. Until that gate is met the
  cron stays at `of=1`, at the default (today's) rate.

**For the owner: CLAUDE.md "Known limits"** (owner-only, so not edited here). Suggested replacement for the second bullet:
> `/api/sync` is sharded (`?shard=i&of=N`, docs/SYNC.md): ≈155k traders a round on 40 shards × 6 workers at 12 req/s,
> extrapolated from the measured per-shard rate (1.56× over 100k). Switch-on gate in docs/SYNC.md (vendor quota and cost in
> writing, the "Last updated" line, the owner's TR-5 refusal rule, `dbConfigOk`, the housekeeping cron entry). Remaining ponytail (lib/sync.ts): a sync past SYNC_FIT_CAP accounts, or reading more than
> one vendor page per account, can still overrun and roll back. The runner quarantines such a trader; per-account
> checkpoints are a follow-up PR.

DESIGN §2.7 still describes the sequential loop. It should point at docs/SYNC.md.

**For the owner: `vercel.json`** (deploy setting, not in this repo). Today, unsharded:

```json
{ "crons": [ { "path": "/api/sync", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" } ] }
```

After the switch-on gate there are 41 entries on the same schedule (docs/SYNC.md → Cron setup):
- `{ "path": "/api/sync?shard=i&of=40", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" }` for i = 0…39;
- `{ "path": "/api/sync?task=housekeeping&of=40", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" }`.

The hosting plan must allow 5-minute crons and 41 entries.

## Known limits (each marked `ponytail:` at its place)

- `lib/sync.ts` (SYNC_FIT_CAP): a sync of more than 3 accounts (SYNC_FIT_CAP after #40), or one reading more than one vendor page per account, can
  still overrun the call and roll back. The runner dispatches such a trader first in a call and quarantines it after two
  overruns. Fix: a resumable per-account sync, as a follow-up PR (orchestrator-agreed).
- `lib/sync-shard.ts` (route-end guard): it checks each vendor call before it starts. It does not cover the database
  work after the last call (well under a second), or the requests of a read past one vendor page inside one broker call
  (an activities week or a share-move history over 1,000 rows). Fix: a per-request hook in `lib/broker.ts`, or the
  resumable per-account sync (follow-up PR).
- `lib/sync-shard.ts` (latency): a multi-account activities read is timed as one call, so its requests enter the p99 at
  their average. Fix: the same per-request hook.
- `lib/sync-shard.ts` (traders that never fit): a sync needing more than one call's vendor time is cut each time it is
  first in a call, then quarantined after 5. Fix: the resumable per-account sync.
- `lib/sync-shard.ts` (vendor budget): the budget is per run, in process. A manual call during a sharded schedule adds
  its own budget. Fix: a budget row in the database.
- `lib/sync-shard.ts` (breaker): its window covers one run, so an outage is re-detected by every shard's run. Fix: a
  shared breaker row.
- `lib/sync-shard.ts` (prepaid tokens): a request beyond the prepaid 1 + 3n waits for its token inside the trader's
  transaction (rare). Fix: prepay from the page count.
- `lib/sync-shard.ts` (coverage): the counts scan every syncable trader on each unsharded or housekeeping call (tens of ms at
  100k). Fix: sum the shards' `last_run` counters past a few million.
- `db/schema.sql` (`users_sync_order`): the shard filter runs after the index, so each page reads past other shards'
  rows (21–26 ms a page at 100k). Fix: an expression index for a fixed shard count.
- `app/api/sync/route.ts`: the cron schedule is a deploy setting for the owner (above).
- `app/api/sync/route.ts`: housekeeping's own vendor calls (import steps, deletions) are outside the shards' budgets.
  Fix: let lib/connections.ts and lib/delete.ts take a budget.
- `lib/sync-limits.ts` (defaults): production stays at the old sequential rate until the owner sets the plan's
  values. Fix: the switch-on gate in docs/SYNC.md.

## Decisions taken by the committee

The committee was the business lead, the engineer and a reliability reviewer. It held three rounds and all three signed (the third after #40 changed the cost
of a sync, signed on the re-measurement); an independent code review and the orchestrator's review followed. The log is `docs/features/logs/sync/committee-2026-11-01.md`.

- **Cursor:** the per-user round claims are the durable cursor, with no id watermark. The shard row holds the lease, the
  heartbeat and the last run's counts.
- **Queue order:** stalest first (`last_synced_at nulls first, id`), so a short round rotates which traders it misses.
- **Plan:** 40 shards × 6 workers at 12 req/s per shard (round 3, after #40's share-move read made a sync cost
  1 + 3n requests). It is sized for at least 1.5× headroom at a p95 latency with a 2-account mix, and was measured at
  1.56×.
- **Fit rule v2 and the route-end guard** (round 3): the observed p99 plus one bound, and no platform kills (see
  above). The share-move cadence (hourly or daily) is an open question for the owner and F-14.
- **Backoff:**
  - Trader-specific failures back off: 401/403/404 (counted as `refused`), other 4xx, and a claimed account.
  - Transient failures do not: 429, 5xx, timeouts, transport errors, database-wide errors and code errors. They trip the
    breaker instead.
  - Two unfinished claims, or 5 transient failures in a row, quarantine a trader.
- **Vendor refusals do not disconnect a record.** This is the owner's TR-5 call, since nothing clears `disconnected_at`
  today.
- **Housekeeping** runs once per cron mark, never waiting on a lease: in the unsharded call, or in its own call when
  sharded (orchestrator review). A busy shard answers 200 `{busy: true}`.
- **Shard lease:** 60 s, fenced by its holder, renewed every 15 s.
- **Coverage report** (unsharded or housekeeping call): missing shards, traders not claimed last round, never-synced
  traders, the stalest age, backoff, refusals with the oldest refusal's age, quarantine, and `dbConfigOk`.
- **Deferred to the owner, and part of the switch-on gate:**
  - a visible "Last updated ‹date›" line, which is a product change for the three-variant process;
  - the TR-5 rule for refusals;
  - the vendor's quota and its cost in writing (480 req/s for the plan).

## Testing

- `npx tsc --noEmit`: clean.
- `npm test` (after merging main with #40 and #42), run twice: **1035 tests, 1016 pass, 0 fail**, 1 todo (owner), the
  rest skipped (opt-in LOAD tests). One of the two runs hit a race in `lib/auth/links.test.ts` (`purgeExpiredLinks() >= 1`
  against a parallel global purge; not this PR's code); it passed 5 of 5 on its own and in the other full run. New files:
  - `lib/sync-limits.test.ts` (21 unit tests, including the call modes, the latency window and the planned-time rule);
  - `lib/sync-shard.test.ts` (14 DB tests): shard assignment, deadline then resume, overlapping runs, the lease and
    fencing, backoff by class, breaker, quarantine and skipped, the rate bound, coverage, failure isolation with the real
    `syncUser`, the first-dispatch fit rule, the transient streak, the metered broker passing every read (share moves
    included), and the route-end guard (cut, rolled back, given back, synced by the next call);
  - `lib/db-pool.test.ts`;
  - `lib/sync-route.test.ts`: the housekeeping order with the billing reconciliation; the secret checked before the
    parameters; GET is POST.

  Two source-order assertions now look for `await runShard(` instead of `await syncTick(`, with the same order checked:
  `lib/sync.test.ts` (F-2 purge before the sync) and `lib/privacy-purge.test.ts` (privacy slots around the sync).
- `LOAD=1 node --test lib/sync-shard.load.test.ts` (after #40, round-3 plan): 2/2 pass in about 12 min.
  - **100,000 synthetic traders** against the in-repo vendor fake on 40 shards × 6 workers, with the share-move read.
    Time is scaled by 10: 50 ms a request, a 3 s bound, 30 s calls, 120 req/s per shard. Database time is not scaled.
  - The mix: half 1-account and half 2-account (5.45 requests a trader), 989 slow traders that time out, and 99 failing
    traders.
  - Results: 98,912 healthy traders synced exactly once in round 1. The slow ones counted as transient and were synced
    in round 2; the failing ones were backed off. Shards were disjoint. 0 deferred, 0 cut at a call's end, 0 quarantined.
  - The worst shard used 7.07 of the round's 11 calls (**1.56× headroom**); in whole calls, 7 of 11 (1.57×). Peak
    database connections were 73.
  - The database server had 100 connections, so 10 shards ran at once, and the 155k total is the measured per-shard rate
    × 40, an **extrapolation**. The test drives `runShard` directly; with housekeeping in its own call, every shard's
    window is the same.
  - Latency-model test (real 200–500 ms latency, one shard, 12 req/s): 2.17 traders/s against a predicted 2.22 (−2.4%).
  - The first round-3 run found that the route-end guard's margin was not scaled in the time-scaled test (1.25×, 35,901
    cuts). The margin now scales with the bound and is part of the fit check.
- `npm run build`: ok.
- **Full Playwright suite** against `npm run start` and the vendor fake, including the new `e2e/sync-shards.spec.ts`
  (auth before parameters for POST and GET, 400s, sharded vs housekeeping vs unsharded answers): **179 passed, 6
  skipped, 1 failed**.
  - The failure was `e2e/section.spec.ts` "demo-only feed", which saw 203 leftover `rt…` users written to the local
    database by `lib/record-tools.test.ts` (F-3), not by this PR. After removing them locally the spec passed 6 of 6. CI
    uses a fresh database.
  - The e2e run regenerates F-2 screenshots; they are restored to main's and are not part of this PR.
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
     `sync_failure_kind`, `sync_failing_since`, `sync_transients`. They are internal, never shown, and deleted with the
     account (the users row).
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
   never cached. No new public surface. Shard leases and claims are fenced on the database clock.
10. **Marketing or product claims?** None. The docs claim capacity only as measured, and gate the switch-on on the
    vendor's written quota.
11. **Checkout, trial or renewal?** No.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8kUvuYVmt9MLT5SmC6
