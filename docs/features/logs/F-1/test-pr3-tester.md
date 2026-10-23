# F-1 PR-3 · Heavy-use tests (tester)

2026-10-23. Branch `claude/adoring-euler-4469ys` at `8ba12f5`, Postgres 16. No product code changed.

## 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed | Clean both times. The new column and index each exist once. No drop, truncate or delete from. |
| `npx tsc --noEmit` | clean |
| `npm test` ×4 | 462 tests: 457 pass, 5 skipped (load), 0 fail every run (7.3–7.8 s) |
| `lib/trades.test.ts` (FIFO) | 14/14; `lib/trades.ts` unchanged |
| Load suite ×3 | 5/5 every run (22.2–22.7 s) |
| `CI=1 npm run build`, stdin closed | Run 1 stopped on the framework's security advisory (tool output; nothing upgraded; the owner decides). Retry: exit 0. |
| `npm run test:e2e` (fakes started by the specs) | 91 passed (3.0 min) |
| `compliance.ts diff origin/main` | 1 violation, already present before this change: the installed-tree license scan flags `@img/sharp-wasm32`. Packages unchanged. |
| `autopilot.ts guard main` | ok |

## 2. Load timings (ms, unless noted)

| Measure | Bound | Run 1 | Run 2 | Run 3 | Headroom |
|---|---|---|---|---|---|
| Heavy import, 14 steps | 15,000 | 1,145 | 1,139 | 1,061 | 13× |
| Slowest step | 3,000 | 368 | 419 | 354 | 7.2× |
| Rebuild | 5,000 | 362 | 366 | 325 | 13.7× |
| Hourly syncs, each | 5,000 | 373/395/356 | 335/329/299 | 334/320/312 | 12.7× |
| First sync, 10,000 paged | 15,000 | 966 | 862 | 789 | 15.5× |
| Fleet: 500 traders, 8 callers | 60,000 | 5,641 | 6,003 | 5,889 | 10× |
| Heap peak, MB (import / syncs / first) | +64 | 27.5/32.6/24.9 | 27.0/25.8/22.1 | 26.6/36.4/25.1 | **1.76×** |
| Rows held by the rebuild | ≤2,000 | 1,341 | 1,341 | 1,341 | structural |

Time bounds: at least 7× headroom. Only the heap bound is within 3× (defect 2). Fleet: each trader exactly once, 62–65 per caller.

## 3. Product fixes, verified (tester's scratch scripts)

- **Chunked insert.**
  - The old shape still fails: one 6,000-row statement gives `MAX_PARAMETERS_EXCEEDED`.
  - `insertActivities` with 6,500 rows succeeds and rebuilds to 3,250 closes.
- **Claimed tick.**
  - Two concurrent ticks over 12 traders synced each trader once.
  - Crash: a tick claimed one trader and stopped. A retry at +10 min synced the others; the next hourly tick synced it.
  - Five ticks, 60 minutes apart, synced every trader once per tick.
  - But see defect 1.
- **Ordered paged rebuild.**
  - Test record: 10,000 rows in 3 accounts, one pair spanning 6 pages, a tie every 17th row, stored in reverse.
  - Result: the same sell ids, percents, open times, holding days and excluded count as the unpaged matcher over the
    full history (3,385 closes, 17 excluded).
- **First-sync paging.** The unit test (pages 3/3/2, then the backfill week) and load test 4 pass.

## 4. Edge cases

- Zero activities: synced once, empty record.
- Vendor 503 mid-fleet: that trader in `failed`, 0 rows (rolled back); the other 11 synced.
- An import running: never claimed or synced, 0 rows.
- Schema twice: idempotent (§1).

## 5. Conformance and compliance

- **Heavy-use criteria.** Each one has a test that asserts it:
  - thousands of activities in several accounts, in bounded time: load tests 1, 2 and 4;
  - hourly syncs stay idempotent: load test 2 (same sha256, thesis kept);
  - 500 traders: load test 5.
- **Carried lows.** All three are fixed, tested and passing:
  - Low 1, "the broker": `lib/copy.test.ts`.
  - Low 2, `connectUrl` outside the lock: `lib/connections.test.ts`.
  - Info 3, a 5xx not counted: `lib/connections.test.ts`.
- **Compliance.** Fixtures are generic (`AAA`–`HHH`, "Fake Brokerage"); the diff has no emails, home paths or third-party names; the failure log carries the user id and message only.

## 6. Defects

1. **Medium · bug · `lib/sync.ts#claimNextUser`, `SYNC_ROUND_MS` = 50 min.**
   - The claim is a sliding 50-minute window from the call's start. A call that claims traders more than 10 minutes
     after the hourly tick makes the next on-time tick skip them: about 2 hours between syncs, not "every hour".
   - Reproduction: `syncTick({ now })` with 3 traders.
     - A late call at +12 min, then ticks at +60 and +120. Each trader is synced at [12, 120]: the +60 tick syncs
       nobody.
     - A crash after one claim at +0, a retry at +15, then a tick at +60. The two retried traders are synced at [15]
       only.
   - The unit test's "next round" at +51 min hides this. Fix (engineer's choice): a per-round claim key (the call's
     clock hour), or release the claim when the sync ends.
2. **Low · spec · heap bound too tight for CI.** +64 MB is 1.76× the worst measurement (+36.4 MB). Garbage-collector
   timing varies from run to run. Widen the bound, or rely on `maxHeld`.
3. **Low · spec · no CI path runs the load suite.** Nothing sets `LOAD=1`, so the heavy-use criterion is never
   checked automatically. Scripts and workflows are protected: a human wires it.
4. **Note.** The rebuild holds a whole (account, symbol) pair (a 6,000-row pair held 7,000); documented follow-up.

## 7. Cleanup

Every suite deleted its test users (the user table matches the pre-run list). The tester's six future-dated claims
were reset to null. The servers this run started are stopped.

Verdict: DEFECTS

## Re-run 1 (2026-10-23)

Branch `claude/adoring-euler-4469ys` at `fdc8bf8` (fix round 1), Postgres 16. No product code changed.

### 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed | Clean both times. `users.sync_lease_until` (timestamptz) exists once, added through `schema_add_column`. The diff adds no drop, truncate or delete from. |
| `npx tsc --noEmit` | clean |
| `npm test` ×4 | 466 tests: 461 pass, 5 skipped (load), 0 fail every run (8.0–8.5 s) |
| Load suite ×3 | 5/5 every run (23.4–27.9 s); timings in §2 |
| `CI=1 npm run build`, stdin closed | Run 1 stopped on the framework's security advisory. This is tool output, and it recommends an upgrade. Nothing was upgraded; the owner decides. Retry: exit 0. |
| `e2e/connect.spec.ts` (`CI=1`, vendor fake on 4102) | 34 passed (2.9 min) |
| `compliance.ts diff origin/main` | 1 violation, already on `main` (`@img/sharp-wasm32` license). Nothing from this diff. |
| `autopilot.ts guard main` | ok |

### 2. Load timings vs bounds (ms, unless noted)

| Measure | Bound | Run 1 | Run 2 | Run 3 | Headroom (worst) |
|---|---|---|---|---|---|
| Heavy import, 14 steps | 15,000 | 1,405 | 1,376 | 1,185 | 10.7× |
| Slowest step | 3,000 | 491 | 549 | 398 | 5.5× |
| Rebuild | 5,000 | 423 | 487 | 384 | 10.3× |
| Hourly syncs, each | 5,000 | 440/469/513 | 391/384/349 | 310/342/351 | 9.7× |
| First sync, 10,000 paged | 15,000 | 1,024 | 1,023 | 874 | 14.6× |
| Fleet: 500 traders, 8 callers | 60,000 | 6,830 | 6,686 | 5,822 | 8.8× |
| Heap peak, MB (import / syncs / first) | +160 | 27/36.7/25.7 | 27.2/25.9/25.9 | 27.2/32.6/25.8 | **4.36×** |
| Rows held by the rebuild | ≤2,000 | 1,341 | 1,341 | 1,341 | structural |

- **Heap bound.** Fixed (Low 2): the worst run in all five measured so far was +36.7 MB, so 160 MB is 4.36×. That meets the
  4× rule in the file header.
- **How to run.** The header's line, `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` with `DATABASE_URL` set, is
  the command used above, and it works as written.
- **CI request.** Request #13 is in `docs/IMPLEMENTATION.md` §Pre-authorization, with the owner's answer blank (Low 3:
  recorded, waits on the owner).
- **Fleet.** Each trader was synced exactly once (61–64 per caller), and the repeat tick synced none of them again.

### 3. Claim rule, attacked (tester's scratch tests, outside the repo, run against the repo's modules)

| # | Scenario | Result |
|---|---|---|
| 1 | My report's late tick: +12 only, then +60, +120 | **pass**: [12, 60, 120] for each trader |
| 2 | My report's crash: one claim at +0 then the caller dies; retry at +15; tick at +60 | **pass**: [15, 60] for each trader |
| 3 | A tick started at :55 is still running when the :60 tick starts (the first trader's sync ends at :62) | **fail (Low)**: synced at real minutes [55, 63], [60], [62, 63]. One trader is synced twice in real hour 1. |
| 4 | The lease runs out mid-sync while the per-user advisory lock is still held (A holds it from :00 to past :12; B ticks at :12) | **pass**: B claims and is `skipped`, rows never interleave, the lease ends null, and a :20 tick does not sync again |
| 5 | 8 concurrent ticks over 12 traders (4 at :59, 4 at :61), then :65, :120 | **pass**: never two at once, at most once per hour label, every trader synced in hour 1 and once at :120 |
| 6 | Hourly cron at the exact hour, instance clocks +2 / −2 min, one call per hour on alternating instances | **fail (Medium)**: in 6 true hours, each trader is synced 3 times ([2, 122, 242]). Every call on the slow instance syncs nobody. |
| 7 | Both instances fire each true hour (−2 first, then +2) | **fail (Low part of Medium)**: the first hour syncs each trader twice ([58, 62, …]) |
| 8 | On-time call on the −2 instance, retry on the +2 instance a minute later | **fail**: each trader is synced twice ([58, 63]) |
| 9 | An import running from :58 to past :61, ticks at :58–:61 (two of them concurrent); the import then connects | **pass**: never claimed, claim and lease stay null; synced once at :62, not again at :63 |
| 10 | No skew, one instance: the scheduler fires 0.3 s late one hour and 0.1 s early the next | **fail (Medium)**: [0.005, 120.005]. The early call syncs nobody, so the gap is 2 hours. |

### 4. Defects

1. **Medium · bug · `lib/sync.ts#claimNextUser`: the hour key comes from the caller's clock, and the boundary sits on
   the cron mark.**
   - The hourly cron fires at :00, exactly on the boundary of the claim's key (`hourStart(now)`).
   - A call that lands a moment before the mark is keyed to the previous hour, and then syncs nobody. This happens when
     an instance's clock is a little fast or slow (rows 6, 7, 8) or when the scheduler fires a fraction of a second
     early (row 10). Every trader then goes 2 hours between syncs: the same outcome as the first Medium.
   - Calls that straddle the mark, such as a retry on another instance, are keyed to two different hours, and each
     syncs every trader (rows 7, 8).
   - Leases compare the claimer's clock with timestamps another instance's clock wrote.
   - The unit tests use exact :00 times, so they hide this.
   - Fix (engineer's choice):
     - Take the time from the database, in `now()` and `date_trunc` inside the claim statement, not from the caller.
     - Move the round boundary away from the schedule, for example rounds from :30 to :30, so that a call within
       ±30 minutes of :00 always maps to one round.
     - Assert both with ticks at :59:59.9 and :00:00.3.
2. **Low · bug · `syncTick` freezes `now` for the whole run (row 3).**
   - A tick that runs past the hour keeps claiming with its start time:
     - traders it reaches after :00 are keyed to the old hour, so the new hour's tick syncs them again (twice in real
       hour 1);
     - their lease (start + 10 min) may already have run out when they are claimed, so a concurrent tick claims a trader
       that is mid-sync.
   - The advisory lock keeps that from interleaving (row 4, `skipped`).
   - At the ~5k traders per hour of the known limit, one sequential tick runs for many minutes, so this case is real.
   - Fix: take the claim time per claim, from the database clock (it falls out of the fix for defect 1).
3. **Low · spec · the load fleet test claims other traders in the current hour.**
   - It ticks at "five minutes into the current hour", so every syncable trader in the database that isn't in the fleet
     is claimed and leased, but not synced.
   - The real tick then skips those traders for the rest of the hour.
   - On this database, it happened to 5 leftover traders from earlier e2e runs. I reset them to null.
   - The header says to run the suite on a development database, so it should restore the claims of traders it does not
     own, or tick in a past hour as the unit tests do.

### 5. Cleanup

- The scratch suite deleted its traders and their accounts.
- It restored every user's `sync_claimed_at` and `sync_lease_until` from a snapshot taken before it ran.
- The 5 claims in the current hour left by the load fleet test are reset to null, and no lease is set.
- The user table matches the list from before the run (85 rows). No servers are left running.

Verdict: DEFECTS

## Re-run 2 (after the engineer's fix round 2)

Postgres 16 on localhost. Code under test: `3b4b202` (no product code changed by the tester).

### 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed | Clean both times; seed exit 0 |
| `npx tsc --noEmit` | clean |
| `npm test` ×4 | 474 tests: 469 pass, 5 skipped (load), 0 fail every run (9.8–10.3 s). User count and claims unchanged across the runs. |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` ×2 | 5/5 both runs (26.3 s, 28.4 s). A full snapshot of every user's claim and lease is byte-identical before and after each run. |
| `CI=1 npm run build`, stdin closed | Run 1 stopped on the framework's security advisory again (tool output; nothing upgraded, the owner decides). Retry: exit 0. |
| `e2e/connect.spec.ts` (`CI=1`, vendor fake on 4102) | 34 passed (2.9 min) |
| `compliance.ts diff origin/main` | 1 violation, already on `main` (`@img/sharp-wasm32` license). Nothing from this diff. |
| `autopilot.ts guard main` | ok |

Load timings (run 1 / run 2, ms unless noted; bounds unchanged): import 1,349 / 1,124 (15,000); slowest step 437 / 338
(3,000); rebuild 417 / 387 (5,000); hourly syncs 382/385/364 and 337/373/422 (5,000 each); first sync 1,073 / 1,165
(15,000); fleet 6,855 / 7,336 (60,000), each trader once, 61–63 per caller; heap peak at most +32.7 MB (160).

### 2. Static checks

- **Cron route.** `app/api/sync/route.ts` calls `syncTick()` with no argument. With no options the claim runs with
  shift 0 and no `ids`, so it reads `now()` as is and claims every syncable trader. No other caller in `app/` or `lib/`
  passes `clockShiftMs` or `ids`.
- **Fleet scope.** The `ids` filter sits inside the claim's subselect, so the update can only touch a listed trader. An
  empty list returns before the query. The test asserts that every other trader is unchanged, and resets its own claims
  in `finally`. In this database, 12 syncable traders outside the fleet kept their exact claim and lease text through
  both runs (attack 16 checks the same thing directly).

### 3. Claim rule, attacked

Scratch suite (outside the repo, against the repo's modules), adapted so that every tick runs on the clock-shift hook
with its own `ids`. Minute 0 is a past :00 cron mark in database time. Round k covers minutes [60k − 30, 60k + 30).

| # | Scenario | Result |
|---|---|---|
| 1 | Late tick: +12 only, then +60, +120 | **pass**: [12, 60, 120] |
| 2 | Crash holding one claim at +0; retry +15; tick +60 | **pass**: [15, 60] |
| 3 | A tick from :25 whose first sync ends at :33, with a :31 tick alongside | **pass**: [[25, 33], [31], [31], [31]]. Once in each round, and the :31 tick never took the leased trader. |
| 4 | Lease lapses mid-sync while the advisory lock holds (A :00 to past :12, B at :12) | **pass**: B `skipped`, no interleave, lease null, :20 does not sync again |
| 5 | 8 concurrent ticks over 12 traders (4 at :29, 4 at :31), then :60, :120 | **pass**: never two at once, exactly once in rounds 1 and 2, at most once in round 0 |
| 6–8 | Instances ±2 min on the :00 cron: alternating, both firing, or a retry a minute later | **pass**: once per round in every case (previously the Medium) |
| 9 | An import from :28 to past :31 | **pass**: never claimed, claim and lease stay null; synced once at :32 |
| 10 | 0.3 s late, then 0.1 s early (:59:59.9), then on time | **pass**: 3 of 3 rounds (previously the Medium) |
| 11 | ±2 min across :30: calls at :28, :32, :60, :88, :92, :120; then :29:59.9 and :30:00.3 | **pass**: [28, 32, 92], once per round. :28 and :32 are two rounds by design, and :29:59.9 and :30:00.3 are two rounds. This only happens to a call that is 28+ minutes from any cron mark. |
| 11b | The database clock steps back 2 min across :30 (:31, then :29), then :60, :120 | **pass**: [31, 120], no double |
| 12 | A tick starts at :29 and runs past :30 (the clock moves 24 s per sync), then the :60 cron | **pass**: claims before :30 stamp round 0 and claims after stamp round 1. The same tick takes the round-0 traders again in round 1, and :60 syncs nobody. Exactly once in round 1, every lease cleared. |
| 13 | The cron fires twice at :00 on two instances (concurrent, same database time), then again 3 s later, then a pair at :120 | **pass**: the pair split 5/5, each trader exactly once per round, never two at once |
| 14 | Lease lapses mid-sync and the second claim lands in the **next** round (A claims at :25 and holds the lock past :36; B ticks at :36) | **fail (Low)**: B is `skipped`, but its claim stamps round 1. The :60 cron syncs nobody. The next vendor read starts at :120, so round 1 gets no read. |
| 15 | Lease release at microsecond precision | **pass**: the returned lease text equals the stored value (e.g. `…00:10:00.001264+00`, µs part 264). The lease is exactly claim + 600 s. Release clears it and keeps the round claim, and the trader is not claimable again in that round. A release against a lease 1 µs newer leaves it set. The same release statement matches under another session time zone. A full tick leaves 0 leases. |
| 16 | Scoped ticks with another syncable trader present; empty `ids` | **pass**: the other trader's claim and lease stay null. Empty `ids` claims nobody and calls no sync. |

### 4. Defects

1. **Low · bug · `lib/sync.ts#syncTick`: a `skipped` sync keeps its round claim, so a lease that lapses across :30
   costs that trader a round (row 14).**
   - The trigger is a single trader's sync that holds the advisory lock past `SYNC_LEASE_MS` (10 min) and across a :30
     boundary.
   - Measured syncs take about 1 s. But the vendor calls in `syncUser` run inside the transaction with no request
     timeout (nothing in `lib/broker.ts` or `lib/sync.ts`), so a hung vendor call is the realistic way to get there.
   - Every tick in the next round claims the trader, is `skipped` by the lock, and stamps the round. Once the hung sync
     finishes, the trader is not read again until the round after.
   - This breaks the stated rule "at least once per round while any tick runs in it". The worst case is one round of
     extra staleness.
   - Within a single round the same path is correct (row 4).
   - Fix (engineer's choice):
     - Bound each vendor request well below the lease, so a lease cannot lapse mid-sync.
     - Or, on `skipped`, put back the claim the tick had replaced, guarded by its lease.
     - Assert either fix with row 14's sequence.

The Medium and both Lows from re-run 1 are fixed (rows 3, 6–8, 10–13; §2 and row 16 for the fleet scope).

### 5. Cleanup

- The scratch suite deleted its traders and their accounts, and restored every user's claim and lease from a text
  snapshot: 0 differences afterwards.
- The e2e cron calls claimed 17 traders in the current round. All 17 were reset to their earlier values.
- 12 syncable test traders (`*-vendor`, created 05:52–05:57 today, before the fix commit) were left in the database,
  probably by interrupted engineer runs. They had no accounts or activities, and the e2e cron was syncing them against
  the fake. They are deleted.
- The four `npm test` runs leaked no users.
- The user table matches the re-run 1 baseline (85 rows, no claim or lease set). No servers are left running.

Verdict: DEFECTS
