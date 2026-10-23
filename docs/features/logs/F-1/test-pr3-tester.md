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

## Re-run 3 (after the engineer's fix round 4, the committee fixes)

Postgres 16 on localhost. Code under test: `35fced0` (no product code changed by the tester). Screenshots:
`docs/features/logs/F-1/screenshots/pr3/rerun3/`.

### 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed | Clean both times (exit 0, no errors); seed exit 0 |
| `npx tsc --noEmit` | clean |
| `npm test` ×4 | 501 tests, 5 skipped (load). Runs 1, 2 and 4: 496 pass, 0 fail (12.5–14.0 s). **Run 3: 1 fail**, `lib/claims.test.ts` "schema applies twice; backfill is idempotent and the earliest owner wins a duplicate" (expected owner 24389, got 24390). See defect 1. User count and claims unchanged across the runs |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` ×2 | 5/5 both runs (30.5 s, 27.4 s) |
| `CI=1 npm run build`, stdin closed | Run 1 stopped on the framework's security advisory again. This is tool output; nothing was upgraded and no upgrade was started on its say-so. The owner decides. Retry: exit 0 |
| `npm run test:e2e` (`CI=1`; the specs start the vendor, sign-in and mail fakes) | With only the vendor variables: 90 passed, 3 skipped (the provider and mail-sink tests, which need their server variables). With every variable from the spec headers: **93 passed, 0 skipped** (3.2 min) |
| `compliance.ts diff origin/main` | 1 violation, already on `main` (`@img/sharp-wasm32` license). Nothing from this diff |
| `autopilot.ts guard main` | ok |

Load timings (run 1 / run 2, ms unless noted; bounds unchanged):
- import: 1,290 / 1,157 (bound 15,000);
- slowest step: 417 / 355 (3,000);
- rebuild: 456 / 375 (5,000), holding at most 1,341 rows;
- hourly syncs: 480/523/525 and 374/409/360 (5,000 each);
- first sync: 1,252 / 948 (15,000);
- fleet: 7,975 / 6,975 (60,000), each trader exactly once, 62–63 per caller, no other trader's claim changed;
- heap peak: at most +37.1 MB (bound 160).

### 2. As a user (`next start` on the fresh build, vendor fake started by the tester on 4102, 375 px)

**Feed with a 2015 close.** Trader `rr3_old`: five closes in the last 5 hours and one on 2015-03-02 (+50%).
- `/` answers 200 in light and dark. The server log has no `value out of range`.
- With the feed's own score expression over every close in the database, the 2015 close scores 1.04e-260, the lowest
  of the trader's six, so it ranks last in that record.
- Across all traders it sits among the other closes older than 3.3 years. Those share the floor and are ordered by size
  of move, as designed.
- Screenshots: `feed-with-2015-close-375-{light,dark}.png` and `profile-2015-close-375-{light,dark}.png`.

**Heavy profile from a real import.** Trader `rr3heavy`: 4 accounts × 1,500 seeded activities, imported through the
portal and consent, which gave **2,863 closes**. The visitor view:

| Criterion | Result |
|---|---|
| Visitor HTML < 400 KB | 258 KB |
| Rows | 50, with "Showing 50 of 2,863 closed trades" |
| Page height < 15,000 px | 5,168 px, no horizontal scroll |
| Skip link | The first Tab stop is "Skip to disclaimer and legal links". Enter focuses `#site-footer`, which is in view with the disclaimer |
| Footer within 200 Tab presses (no skip link) | 112 |
| "Show 50 more", JS off | Goes to `?closes=100#trade-<row 51>`: 50 rows, the first is row 51 and it is in view, "Showing 51–100 of 2,863 closed trades" |
| "Show 50 more", JS on | Same URL; focus is on row 51 (`document.activeElement` is row 51) |
| The last page | Followed "Show 50 more" 57 times without JS to `?closes=2900`: "Showing 2,851–2,863 of 2,863 closed trades", 13 rows. The last row is the oldest close; only "Back to the newest" is offered |
| Chart links | 2,863 links in 58 windows. Each one points to a window that renders its row: 0 mismatches against the database order. Three opened (windows 50, 1,500 and 2,900): the row is rendered and focused |
| Grouped thousands | Stats "2,863 closed trades", chart label "2,863 trades, …", banner "1,000 activities imported", "2,863 closed trades so far". On the 2,828-close profile: metadata "2,828 verified trades". In the feed: "2,828 closed trades" and "2,828 trades" on every card. The visible text has no ungrouped count; the only 4-digit run is the year 2020 |

Screenshots: `profile-heavy-375-{light,dark}[-full].png`, `profile-paging-375-{light,dark}.png`,
`profile-show-more-{js,nojs}-375-light.png` and `profile-last-window-nojs-375-light.png`.

**Banner during the long import.** Each activities read was slowed by 2.5 s. A mutation observer recorded every
live-region change (ms after load):
- **Activities region.** It announced "1,000 / 1,500 / 2,500 / 3,000 activities imported so far" at 5,277, 10,277,
  16,276 and 21,276 ms, and "4,000 / 4,500 / 5,500 / 6,000 …" at 114,379, 120,276, 125,276 and 130,277 ms. There
  was never more than one announcement in 5 s, and none in the first 5 s. The status line stayed at "0 closed trades
  so far" the whole time.
- **Status line.** "2,863 closed trades so far" at 130,523 went out 246 ms after an activities announcement. That is
  the engineer's documented deviation: the status line keeps strict priority. "Import finished." followed 5 s later.
- **Deferred step.** The vendor was forced to 503 at 3,000 activities. After 61 s with no new rows, the line read
  "Still waiting for your broker. You can leave; the import continues." It never said the broker was sending. When the
  vendor came back, the line cleared at the next page read and the import finished. Screenshots:
  `banner-still-waiting-375-{light,dark}.png`.

**Evidence line, overlapping positions.**
- `rr3_overlap`: 2,828 closes in 8 symbols, each held 400 days, so the holds chain into one position per symbol. The
  line reads "Too early to tell: 2,828 trades in 8 overlapping positions (10 independent bets needed)".
- `rr3heavy`, the imported record: "Past results: below zero · Evidence: thin (10 bets from 2,863 trades, 2,193 days)".
- Screenshots: `evidence-overlapping-375-{light,dark}.png`.

**Sync deadline.** Scratch script against `lib/sync.ts` with the real wall clock. Three traders, each sync 300 ms, and a
deadline of start + 150 ms on each call:
- three calls each synced one trader, so each trader was synced exactly once;
- the logged lines were `{"ok":1,…,"unclaimed":2,"stoppedAtDeadline":true}`, then `…1…`, then `…0…`;
- a fourth call with time to spare claimed nobody (`unclaimed 0, stoppedAtDeadline false`).

**Dropped connection during release.**
- Scratch tick: the release closed its own database session. The tick still synced all 3 traders and logged
  `sync lease release failed <id> write CONNECTION_CLOSED` for each, with the lease left to lapse.
- Live route: a temporary trigger on the test trader's row closed the session when its lease was released. `POST
  /api/sync` answered **200**, and the server logged `sync lease release failed 25850 write CONNECTION_CLOSED`, then the
  tick line. The trigger was dropped afterwards.

**Regression.**
- PR-2a trust rule. The imported record shows "✓ Verified" (every activity `snaptrade`), and the demo trader shows
  "Demo".
- PR-2a consent gating, for a new trader on the consent page:
  - a cron call answered 200 and imported nothing (0 activities, the link still `pending`);
  - a visitor saw "No trades yet.";
  - after "Import my record": 40 activities, 14 closes, `connected`, Verified.
- PR-2b portal: the portal opened embedded in the dialog (the fake's URL in the frame), and its Connect reached consent.
  Screenshot: `regress-portal-embedded-375-light.png`.
- The e2e suites (93/93) cover the rest of both.

### 3. Defects

1. **Low · spec · flaky unit test: `lib/claims.test.ts` "schema applies twice; backfill … earliest owner wins".**
   - It failed in 1 of 4 `npm test` runs. It passed in 12 targeted re-runs together with `feed`, `schema` and `delete`.
   - The test inserts the later owner's activity, then the earlier owner's, then applies the schema. If another test file
     applies `db/schema.sql` between those two inserts (`node --test` runs files in parallel), that backfill confirms the
     later owner first, and the test sees the wrong owner.
   - Several files already apply the schema in `before`. `lib/feed.test.ts`, new in this round, adds one more.
   - Not a product bug. It makes the required check red at random.
   - Fix (engineer's choice): insert both activities in one statement or transaction before any schema run, or use an
     account id no other file's backfill can reach until both rows exist.

Notes (not blocking):
- The stats show the 95% range as "(-0.8% to -0.0%)". A negative zero reads oddly.
- The equal-weight total and drawdown on the imported record round to "-100.0%" from -99.98%. That is arithmetically
  right, but reads as a total loss.
- The feed with heavy traders on it is 1.79 MB (the engineer's listed follow-up).

All committee items checked here pass.

### 4. Cleanup

- Test traders deleted: `rr3heavy`, `rr3_old`, `rr3_overlap`, `rr3gate` and the 3 deadline traders, with their
  `rr3-*` broker accounts.
- The cron calls had claimed other syncable traders left in the database by earlier runs. Every claim and lease was
  restored from a snapshot taken before the route calls. The user table is byte-identical to the list taken before this
  run (86 rows; claim and lease unchanged).
- The temporary trigger and its function are dropped.
- The tester's server (3000) and vendor fake (4102) are stopped. A server on 3100 that this run did not start was left
  alone.

Verdict: DEFECTS

## Re-run 4 (after the engineer's fix rounds 6 and 7)

Postgres 16 on localhost. Code under test: `fc40342` (no product code changed by the tester). Screenshots:
`docs/features/logs/F-1/screenshots/pr3/rerun4/`.

Another agent was working against the same database at the same time. It used its own servers on 3101 and 3400,
created about 15 `bl_*` traders between 08:35 and 09:00, and imported most of them as heavy records. That matters for
the e2e result below. Its traders and servers were left alone.

### 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed | Clean both times (exit 0, no errors); seed exit 0 |
| `npx tsc --noEmit` | clean |
| `npm test` ×4 | 517 tests: 512 pass, 0 fail, 5 skipped (load) in all four runs (13.0–14.2 s). The user count was unchanged after each run |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` ×2 | 5/5 both runs (32.6 s, 32.8 s) |
| `CI=1 npm run build`, stdin closed | Run 1 stopped on the framework's security advisory again. That is tool output asking for an upgrade. Nothing was upgraded or offered on its say-so; the owner decides. Retry: exit 0 |
| `npm run test:e2e` (`CI=1`, every variable from the spec headers; the specs start the fakes) | Run 1: **95 passed, 1 failed**. `connect.spec.ts:562` "the feed omits a trader whose second import is still running…" failed at line 586: its own trader was not in the feed after its first import. Run 2: **96 passed, 0 failed** (4.2 min). See §3, item 4 |
| `compliance.ts diff origin/main` | 1 violation, already on `main` (`@img/sharp-wasm32` license). Nothing from this diff |
| `autopilot.ts guard main` | ok |

Load timings (run 1 / run 2, ms; bounds unchanged):
- import: 1,266 / 1,457 (bound 15,000);
- slowest step: 398 / 493 (3,000);
- rebuild: 691 / 507 (5,000), holding at most 1,341 rows;
- hourly syncs: 454/466/431 and 438/578/449 (5,000 each), sha256 unchanged;
- contention: 1 ran, 2 skipped;
- first sync: 1,128 / 997 (15,000);
- fleet: 8,419 / 7,687 (60,000), each trader exactly once, 61–63 per caller;
- heap peak: at most +32.7 MB (bound 160).

The e2e heavy-feed test logged 465 KB raw and 43 KB gzipped in both runs. Path points: 400/310 in the pane, 4,735/511
on the profile.

### 2. As a user (`next start` on the fresh build, vendor fake started by the tester on 4102, 375 px)

**Future-dated closes in the feed.**
- Trader `rr4_future`: five closes 1–5 h old, plus one dated 2031-01-02 (+50%) and one dated tomorrow (−33.3%).
- Trader `rr4_real`: a real +50% close 10 minutes old.
- `/` answers 200 in light and dark. The server log has no `out of range`.
- Scores, with the feed's own expression:
  - the 2031 close: 3.9318 = ln 51 exactly, its size term;
  - the close dated tomorrow: 3.5361 = ln 34.3, its size term;
  - the real 10-minute-old +50% close: 3.9180.
- Neither future close gets the boost the old feed gave. Each scores exactly like a close at this instant.
- In the rendered feed, the demo trader's 30 cards come first (lower-bound ranking, TR-9). The 2031 card is next (card
  31), above the real +50% close (card 32). See §3, item 3.
- Screenshots: `feed-future-closes-375-{light,dark}.png`.

**Activity 2 days ahead, through the import.** Trader `rr4fut` went through the embedded portal, consent and "Import my
record". The vendor returned 5 past round trips plus a ZZZ buy 3 days ago, with its sell dated 48 h ahead.
- Result: `connected`, 5 closes, `excluded_future = 1`, `excluded_positions = 0`. The raw sell row is kept, and ZZZ is
  never shown as a close.
- The profile, light and dark, reads "1 imported trade(s) excluded: dated in the future by the broker.", next to
  "✓ Verified".
- Screenshots: `profile-future-excluded-375-{light,dark}.png`.

**Feed with 50 heavy cards.** Five traders were built the way the e2e test builds them: the heavy fixture, 4 accounts
× 2,500 activities each, 23,817 closes in all, with the newest 45 closes per trader moved into the last 90 minutes.

| Criterion | Result |
|---|---|
| 50 heavy cards, raw | **467,307 bytes** (under 500 KB), 43 KB gzipped. The 50 cards fall on 2 traders (21 + 29) |
| The same 50-card feed spread over 6 distinct heavy traders (the other agent's imported records, 2,367–4,701 closes each, 6 cards each, plus 14 demo cards) | **535,151 bytes raw**, 81 KB gzipped. Over the bound; see §3, item 2 |
| Pane path points, ALL / 1Y | 399 / 301 (profile: 4,698 / 462) |
| Pane vs profile, ALL | Box min y 209.7, max y 30.3, x 0–640, first (0, 30.3), last (640, 209.7): identical. Header "≈-100.0% · All time" and label "4,697 trades, ≈-100% total, max drawdown ≈-100%": identical |
| Pane vs profile, 1Y | Box identical; first (0, 38.7) and last (640, 206.9) identical; header "-96.0% · Past year" and label "460 trades, -96% total, max drawdown -98%": identical |
| Visually, 375 px light and dark | The lines read the same: `chart-feed-pane-{ALL,1Y}-375-{light,dark}.png` beside `chart-profile-{ALL,1Y}-375-{light,dark}.png` |
| Pane scrub | ArrowLeft moves the header to a close ("… · 10/23/2026 · DDD"), and Escape restores "≈-100.0% · All time". A pointer drag scrubs ("-99.9997% · 11/15/2020 · DDD"). Release restores and does not navigate. `feed-pane-scrub-375-light.png` |
| Pane scrub value near a total loss | **Differs from the profile.** At the same newest closes, the pane reads "-100.0%" and the profile reads "≈-100.0%". See §3, item 1. `feed-pane-scrub-near-total-loss-375-light.png` beside `profile-scrub-near-total-loss-375-light.png` |

**Import headline.** Trader `rr4head`: 2 accounts × 2,500 seeded activities, with each activities read slowed by 2.5 s
and the page's own poll running. The headline and the status line were sampled every 250 ms (ms after landing):

| ms | Headline seen (`aria-hidden`) | Status line (live region) |
|---|---|---|
| 11 | "Importing your record · 0 activities read from your broker" | "… 0 closed trades so far", 1 px wide (visually hidden) |
| 4,852 | "… 1,000 activities read …" (the step answered at 4,602) | unchanged |
| 9,295 / 13,911 / 18,679 / 23,269 / 27,852 | 2,000 / 2,500 / 3,500 / 4,500 / 5,000 activities read (each 80–250 ms after its step's answer) | unchanged |
| 30,151 | removed | "Importing your record · 2,413 closed trades so far", 343 px |
| 35,168 | none | "Import finished." |

- "0" was seen for 4.85 s, which is inside 5 s.
- The headline moved within 250 ms of every step and only climbed.
- "0 closed trades so far" was never seen.
- Screenshots: `headline-reading-375-{light,dark}.png` and `headline-closes-375-{light,dark}.png`.

**Sync claim by account count.** Scratch script against `lib/sync.ts#syncTick` with its clock hook and the route's own
`syncDeadline`/`syncRouteEnd`. Traders had 1, 4 and 2 real accounts, plus a paper account each. `SYNC_FIT_CAP` is 4
and the vendor bound is 30 s.
- **Call 1**, with 100 s of the 300 s left and each sync taking 80 s: it synced only the 1-account trader. Report:
  `{"ok":1,"unclaimed":2,"stoppedAtDeadline":true}`. The 4-account trader (270 s worst case) and the 2-account trader
  (150 s) were not claimed.
- **Call 2**, a whole call: it synced the 4-account and the 2-account traders. Report:
  `{"ok":2,"unclaimed":0,"stoppedAtDeadline":false}`.
- **Call 3**, in the same round: synced none.

**Cleanup deadline.**
- `cleanupAttempts` was given 3 attempts older than 24 h, a 45 s budget, and 30 s per vendor call. It cleaned 2,
  logged `attempt cleanup stopped {"cleaned":2,"left":1}`, and the next call cleaned the last one.
- `tick()` with its deadline already past made no vendor call; its deps throw on any call. It still logged
  `connections tick {…,"attemptsLeft":1,"stoppedAtDeadline":true}`.
- The live route (`POST /api/sync`) logged both `connections tick` and `sync tick`.

**Regression.**
- PR-2a trust rule. The imported record shows "✓ Verified" (every activity `snaptrade`). The demo trader shows "Demo"
  and no Verified badge.
- PR-2a consent gating, for `rr4fut` on the consent page:
  - a cron call answered 200 and imported nothing (0 activities, the link still `pending`, no consent time);
  - a visitor saw "No trades yet.";
  - after "Import my record": connected, 5 closes, Verified.
- PR-2b portal: the portal opened embedded in the dialog (the fake's URL in the frame), and its Connect reached consent.
  Screenshot: `regress-portal-embedded-375-light.png`.
- PR-3 paging, without JS, on a 120-close record:
  - "Showing 50 of 120 closed trades";
  - "Show 50 more" goes to `?closes=100#trade-…` with 50 rows, "Showing 51–100 of 120";
  - "Show 20 more" gives 20 rows, "Showing 101–120 of 120", with no further "more" link and "Back to the newest"
    offered.
  - Screenshot: `regress-paging-last-window-nojs-375-light.png`.

### 3. Defects

1. **Low · product: the feed pane's scrub reads a near-total loss as an exact total loss.**
   - `lib/chart-series.ts#packChart` rounds each kept value to 6 decimals (`r6`, line 41). A cumulative value of, for
     example, −0.9999997 is shipped as −1, so `pct` prints "-100.0%".
   - The profile computes the same point at full precision and prints "≈-100.0%". The pane header also prints
     "≈-100.0%". Only the scrubbed point is wrong.
   - The same rounding can show "-99.9999%" where the profile shows "≈-100.0%".
   - This breaks round 5's rule that a loss short of −100% never reads as a total loss, and round 7's demand that the
     pane read like the profile.
   - Fix (engineer's choice): ship the value with enough precision for `pct`'s four extra digits, or ship the
     formatted string.
2. **Medium · product: the 500 KB feed bound holds only when the 50 cards fall on 2–3 traders.**
   - The e2e and the tester's replica pass (465 and 467 KB) because the ranking puts all 50 cards on 2 heavy traders.
   - The same 50-card feed spread over 6 distinct heavy records (2,400–4,700 closes each) weighs **535 KB raw**.
   - Each further distinct heavy trader adds about 50 KB, as the engineer measured, so a feed of 50 distinct heavy
     traders would be about 2.5 MB. That is the original problem.
   - The engineer listed lazy pane data as a follow-up. The demand's bound fails on a realistic feed today.
   - Fix (engineer's choice): load a pane's chart data when it is first swiped to, past the first few traders, as
     planned. Or cap the packed points per pane lower for traders beyond the first few. Add an e2e with 50 cards over
     10 or more distinct heavy traders.
3. **Low · product: a close dated in the future is pinned at age 0.**
   - It scores exactly its size term (as designed), but it never decays. So it ranks above every real close of the same
     size for as long as it exists: the 2031 card sits above a 10-minute-old real +50% card.
   - The business lead's demand was "does not rank first". It does rank first among cards of its size.
   - The import makes this unreachable past 24 h: the activity is quarantined, as verified above. Within the 24 h
     grace, an activity dated ahead keeps its full score until its date arrives.
   - The card also prints "closed Jan 2" with no year for a 2031 date.
   - Fix (engineer's choice): give `closed_at > now()` the floor score, or leave such rows out of the candidates.
4. **Low · spec: the connect feed tests are not isolated from other writers, and they leak traders when they fail.**
   - The feed lock coordinates only the e2e tests. Any other writer to the same database can fill the feed and hide the
     test's trader: a dev session, another agent, or a seed with heavy records.
   - Records with a confident edge rank first (TR-9). The other agent's heavy imports took all 50 cards for the
     duration of this run, including 10-month-old closes, ahead of every fresh record.
   - Run 1 (08:36:47–08:40:54) overlapped those imports (`bl_h1` and `bl_h2` were created at 08:36).
   - A targeted repeat (`--repeat-each=4` of the feed tests) failed `connect.spec.ts:562` and `:604` 7 times out of 8.
     The feed held only those records at the time.
   - The failed tests delete their traders only on success, at the end. This run left 8 traders, plus 2 from an
     earlier run. Each one then takes 5 feed cards in later runs.
   - Verdict on the lock: it keeps the connect tests stable against the heavy-feed test. Both full runs had the heavy
     test and the three connect feed tests overlapping, and neither failed on that.
   - The tests are not stable on a shared database.
   - Fix (engineer's choice):
     - Clean up in `finally`.
     - Assert the trader's eligibility through `feedCandidates({ ids })`, or through a feed that ranks only the test's
       ids, instead of the shared top 50.
     - Or run e2e on its own database.

Notes (not blocking):
- The import banner shows "1,000 activities read from your broker" with "1,000 activities imported" right under it.
  The two lines say the same thing.
- "0 activities read" was seen for 4.85 s with a 2.5 s vendor page. A slower first page would pass 5 s, because the
  headline moves only when the first step answers.
- With the lower-bound ranking, records that already have a confident edge can fill all 50 cards with closes 10 months
  old, ahead of any fresh record. That is as designed (TR-9), but it is a cold-start question for the business lead.

### 4. Cleanup

- Test traders deleted: `rr4_future`, `rr4_real`, `rr4fut`, `rr4head`, `rr4page`, `rr4_hf0`–`rr4_hf4`, `rr4_fd`,
  `rr4_hv` and the three claim traders, with their `rr4-*` broker accounts. The 3 sweep attempts were also deleted.
- The traders the failed e2e tests left were deleted with their `e2e-*` accounts and activities:
  `fde39ioxty`, `fd26lyb2ui`, `ff2inkblmx`, `ffaj45j3me`, `fdh19ev728`, `ffq5lefbrj`, `fdjybhw0hj` and `ffu2qhfxer`,
  plus `fdbl6kip5f` and `ffb0hscih3`, which were already there before this run.
- Claims:
  - An e2e cron call at 08:37:01 stamped 5 pre-existing traders. They were restored to the values snapshotted before
    the run.
  - The claims that this run's cron calls stamped on the other agent's `bl_future` and `bl_h2b` were cleared, only
    where they were still those values. `bl_h1`'s claim had changed since and was left alone.
- Every pre-existing row matches the snapshot apart from the two deleted leftovers. No lease is set.
- The tester's server (3000) and vendor fake (4102) are stopped. The servers on 3101 and 3400 belong to the other
  agent and were left running.

Verdict: DEFECTS
