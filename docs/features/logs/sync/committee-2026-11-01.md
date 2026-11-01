# Sharded hourly sync · committee · 2026-11-01

Task: remove the known limit "`/api/sync` loops users sequentially (~5k traders/hour)" so the hourly cron covers at
least 100,000 connected traders within the hour, with no new dependency or service. Committee: business lead,
engineer, reliability reviewer (fresh-context subagents); the build session chairs and writes the decisions. Each
member read the proposal (the design below as first written), `lib/sync.ts`, `app/api/sync/route.ts`, `lib/db.ts`,
`lib/broker.ts` and the policy files. The owner's instruction for this build: decide open points with the committee's
recommended option after several rounds.

## Round 1 (summaries)

**Business lead: build, with demands.** Trust is the worry, not throughput: a trader whose sync keeps failing keeps a
record that looks live. Demands: (1) vendor 401/403 = disconnect (TR-5); (2) a visible "Last updated ‹date›" line on
the profile when the last sync is over 24 h old; (3) housekeeping (privacy deletions) can never be starved by a busy
shard; (4) a coverage alarm (`round incomplete`) when a round leaves traders unsynced; (5) the load test runs with
vendor latency, not zero. O1 cursor + lease, O2 defaults fine but the vendor quota is a contract gate, O3 1 h doubling
to 24 h, O4 shard 0, O5 counts only and drop the id, O6 by id, O7 200 `{busy:true}`.

**Engineer: feasible, with changes.** The real bottleneck is today's claim statement (it scans and sorts every syncable
trader on every claim: quadratic per round). A page query plus a claim by id fixes it. A contiguous "finished prefix"
watermark is fragile with C workers, skipped traders and traders that do not fit; the per-user round claim already is
the durable record of what is done. Lease the shard with an upsert on the database clock, never a session advisory
lock (breaks behind a transaction pooler). Clamp concurrency to the pool. Take rate tokens before claiming (never
inside the open transaction). Back off only trader-specific errors; add a circuit breaker; log the error class and
status, never the vendor's message (it can echo the vendor user id). Load test: bulk setup with `generate_series`, a
bulk control in the vendor fake, an id-range test hook (100,000 ids exceed the parameter limit), all shards at once,
plus a separate latency-model test. O1 claims + lease-only table, O2 16/6/10 but measure, O3 trader-specific only,
no new disconnect path, O4 shard 0 and counted, O5 counts in the run line, class not message on the failure line,
O6 `last_synced_at nulls first, id` (by id starves the same high ids whenever a round runs short), O7 200 busy.

**Reliability reviewer: blocking demands.** (1) Poison trader: a sync that kills the process never reaches `catch`,
so it would be retried first forever; count attempts at claim and quarantine after 2 unfinished claims. (2) A vendor
outage must not back off everyone: transport, timeout, 5xx and 429 never count against the trader; a run-level
breaker stops the run. (3) The shard lease must lapse before the next cron mark (a killed run must not make the next
call busy) and be fenced: renewed while the run works, and a run that lost it dispatches nothing more. (4) Database
connections, not shards, bind capacity (syncUser holds its transaction through vendor calls); enforce pool >= workers
+ 2. (5) The fit check includes the expected token wait; shards start with a small random delay. (6) Coverage
observability on shard 0: shards with no run lately, traders not claimed in the previous round, the stalest sync age,
deferred counts. (7) The load test injects slow traders (timeouts), poison traders, a 2-account mix and latency, with
headroom >= 1.5x. (8) The page query must not scan everything per claim (index). O1 claims only, O2 size by
connections (16 x 4), O3 trader-specific only, cap 6 h, needs-reconnect on 401/403, O4 shard 0 with a budget, O5 keep
the internal id on the failure line, never the vendor text, O6 `last_synced_at nulls first`, O7 200 busy.

## Decisions (chair's synthesis after round 1; signed in round 2 below)

| # | Decision | Reason |
|---|---|---|
| O1 | **The per-user round claim is the durable cursor**; no contiguous id watermark. A shard's runs read the head of its remaining queue (`last_synced_at nulls first, id`, not claimed this round), so a run stopped at its deadline resumes exactly where it stopped: synced traders moved to the tail (their `last_synced_at` is new) and claimed ones are not claimable again this round. The shard row (`sync_shards`) holds the lease, a heartbeat and the last run's counters plus the last key it dispatched (observability only, never trusted for correctness). | Engineer + reliability: the claims are already the source of truth and survive crashes; a watermark adds a stall surface (poison traders) and concurrency bugs. The business lead's goal (no rescan of the done prefix) holds: the done prefix is not at the head. |
| O2 | Code defaults: `SYNC_CONCURRENCY` 6 (clamped to `DATABASE_POOL_MAX` − 2), `SYNC_VENDOR_RPS` 10 per shard (burst = RPS), `DATABASE_POOL_MAX` 10 (additive in `lib/db.ts`). Unsharded calls (`of=1`) keep working and are already ~6x faster than before. Production plan in `docs/SYNC.md`: **32 shards x 6 workers, RPS 10**: per shard min(C/L, RPS/requests) = min(6/2 s, 10/4) = 2.5 traders/s at a p95 of 0.5 s per request and a 2-account mix (4 requests a trader), x 2,310 s of claiming per round (11 calls x 210 s) = 5,775 per shard, 185k per round (1.85x headroom over 100k). Peak database connections 32 x 8 = 256 (a server sized for it; a pooler does not reduce held transactions); aggregate vendor ceiling 320 req/s. **Sharding is switched on only after the vendor confirms that quota in writing** (DESIGN pre-scale gate); until then the cron calls `of=1`. | All three: the 16-shard figure had 23% headroom at one account and 1.5 s; reliability's 2-account p95 case put it at 74k. Size for >= 1.5x at p95. |
| O3 | **Backoff only for trader-specific failures**: a vendor refusal (401/403/404), any other 4xx, `AccountClaimedError`, or an error that is not the vendor's (a bad record, a rebuild error). 1 h after the first, doubling, capped at 24 h, on the database clock; a success clears it. **Transient** failures (429, 5xx, `VendorTimeoutError`, transport errors) never touch the trader's backoff: the trader keeps its round claim and is synced next round. **Breaker**: once a run has 20 finished attempts, if half of the last 20 were transient (or refusals, which on that scale mean our own credentials), the run stops dispatching (`breaker: true`). **Poison**: `sync_attempts` is incremented at claim and cleared when the attempt finishes; a claim that finds 2 unfinished attempts quarantines the trader instead (backoff as a failure, counted `quarantined`). No new disconnect path for 401/403 in this change: `disconnected_at` is set by nothing reversible today, so a false refusal (our own key, a vendor incident) would freeze a live record for good; refusals are counted (`refused`) and backed off, and the owner decides the TR-5 rule for refusals (open question). | Engineer + reliability on classification and breaker; reliability on poison. Cap 24 h (business lead + engineer) over 6 h: with transient errors excluded, a trader-specific failure rarely clears by itself. Disconnect on refusal: business lead and reliability asked for it; deferred because it is irreversible and changes a TR rule (owner's call). |
| O4 | Housekeeping (expired links, connections tick, pending deletions, discovery purge) **only on shard 0, and before and regardless of the shard lease** (a busy shard 0 still runs it; each housekeeping step is already safe to overlap). Its duration is logged (`housekeepingMs`) and comes out of shard 0's budget. | All three; the business lead's demand 3 (privacy deletions never starve). |
| O5 | One end-of-run line `sync run {…}` with counts and durations only (no ids). The per-failure line keeps the internal user id (unchanged behavior, needed to debug) plus the error class and HTTP status, **never the error message** (vendor text can echo the vendor user id). | Engineer + reliability. |
| O6 | Order inside a shard: `last_synced_at nulls first, id`, served by a new index. | Engineer + reliability: by id would miss the same high-id traders every time a round runs short; stalest-first rotates. |
| O7 | A shard already running answers **200 `{busy: true}`** and syncs nothing. | All three. |
| L | Shard lease on the **database clock**, 60 s, renewed every 15 s and before each dispatch with a holder token (fencing): a run whose renewal fails stops dispatching. A killed run's lease lapses within a minute, so the next 5-minute call is never busy. | Reliability demand 3; engineer's upsert. |
| R | Rate tokens (1 + 2n for an n-account trader) are taken **before** the claim, outside the transaction; the fit check counts the expected token wait. First-sync extra pages take tokens through a broker wrapper. Sharded calls (`of > 1`) wait a random 0-15 s before their first dispatch. | Engineer + reliability demand 5. |
| C | Coverage on shard 0, each call: shards (of the same N) with no heartbeat in 15 min, syncable traders not claimed in the previous round, the stalest sync age (hours), traders in backoff; a `round incomplete` line when the previous round left traders unclaimed. | Business lead demand 4, reliability demand 6. |
| T | Tests: unit (shard params, token bucket, backoff, classification, breaker); DB (shards disjoint and covering, deadline then resume, overlapping runs of one shard: one busy and no trader twice, lease lapse and fencing, poison quarantine, transient vs trader-specific failure, busy shard 0 still deletes); LOAD=1 with 100,000 synthetic traders against the in-repo vendor fake (bulk control), every shard at once, a 2-account mix, 1% slow traders past the vendor bound, 0.1% failing traders, time-scaled latency, asserting full coverage with >= 1.5x headroom; plus a latency-model test; e2e for auth and shard parameters. | All three. |

**Deferred to the owner (open questions):** (a) a visible "Last updated ‹date›" line when a connected record has not
synced for 24 h (business lead demand 2, reliability O3). It changes the profile (owned by F-4/F-6 this build) and is
a product change, which runs through the three-variant process; the committee agrees it should exist before sharding
is switched on. (b) Whether repeated vendor refusals disconnect a record under TR-5. (c) The vendor's written quota.

## Round 2 (sign-off)

**Business lead: SIGN** with two edits, both taken: (1) the switch-on gate is hard: `docs/SYNC.md` lists, as required
preconditions for any `of > 1` cron, the "Last updated" line shipped, the owner's decision on refusals under TR-5,
and the vendor's written quota; until all hold the cron calls `of=1`. (2) Shard 0's coverage line carries the count
of traders currently refused (last failure a refusal, in backoff) and the oldest such refusal's age in hours (no ids);
a DB test seeds a refusal 30 h old. Withdrew O6 (stalest-first is right).

**Reliability reviewer: OBJECT on one point, then SIGN.** Timeouts only in docs would go unnoticed. Taken: shard 0's
coverage step reads `statement_timeout`, `idle_in_transaction_session_timeout` and `max_connections` and logs
`dbConfigOk:false` with the values when either timeout is 0, the idle timeout is at or below the largest sync cost
((1 + 2 x SYNC_FIT_CAP) x 30 s) or at or above the per-user lease (10 min), or `max_connections` is below shards x
(workers + 2) + 20; `dbConfigOk:true` joins the switch-on gate. A unit test covers the rule, a DB test the real
settings. Clarifications taken: a sync skipped on the trader's lock undoes its attempt (not unfinished); `refused` and
`quarantined` appear in the coverage line.

> Chair's note on the idle-timeout rule as written: the statement timeout bounds one statement, while the largest sync
> cost is a whole transaction's vendor time; the check compares the idle timeout (the gap between statements, at most
> one vendor bound in a sync) as the reviewer specified, which is conservative. Recorded as signed.

**Engineer: SIGN**, with implementation conditions, all taken: the claim by id increments `sync_attempts` atomically
and only while `sync_attempts < 2`; quarantine is a separate statement guarded by `sync_attempts >= 2`; attempts are
cleared in the release statement itself and only where the lease matches (`::text`), and `restoreClaim`'s path undoes
the increment; a failed release is logged and counted (`releaseFailed`). Renewal is `update … where holder = $token and
lease_until > now()`; losing it stops dispatching only. Workers are clamped at pool − 2. The page query re-reads the
head (no NULL-unsafe keyset) and logs rows scanned past. Coverage is wrapped in try/catch and never branches the
route; missing shards come from `generate_series(0, N-1)` left-joined to `sync_shards`; never-synced traders are their
own count. Sizing for 256 backends goes in `docs/SYNC.md`.

**Signed: business lead, engineer, reliability reviewer (round 2).** The decisions table above stands with these edits.

## After the build: measured against the decisions

The LOAD=1 test (100,000 traders, 32 x 6, time scaled by 10, database time unscaled) measured 1.55x headroom
(worst shard used 7.08 of 11 calls), against the design's 1.85x. The gap is the fit check: a 2-account trader is
claimed only while 5 request bounds fit, so late in a call a shard takes 1-account traders only. It still meets the
signed bar (>= 1.5x); `docs/SYNC.md` reports the measured figures. The bar's margin is thin, so before switch-on the
plan should be re-measured on the production account distribution (gate item 1 already requires re-running the
capacity table).

## Independent code review (after the build): changes against the signed table

- O3 refined: database-wide SQLSTATEs (53xxx resources, 57014 statement timeout, 55P03, 25P03, 42xxx) and code errors
  (`TypeError`, `ReferenceError`, `RangeError`, e.g. an unexpected vendor answer shape) are **transient**, not the
  trader's: an overloaded database or a fleet-wide bug must trip the breaker, never back off every trader for up to a
  day. A rebuild error from a trader's own rows (a constraint, a value out of range) stays trader-specific.
- Fit: a run's first trader is always dispatched, and shard 0 (which starts with housekeeping) skips the start spread,
  so a trader with SYNC_FIT_CAP accounts is never deferred forever on shard 0.
- `DATABASE_POOL_MAX` is clamped to 3..500 instead of falling back to 10; a run stops reading its queue once nothing
  smaller can fit, so the exclusion list stays small; e2e cron calls across spec files are serialized by a lock.
