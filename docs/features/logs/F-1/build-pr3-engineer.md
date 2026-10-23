# F-1 PR-3 · Heavy-use tests (engineer)

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys` (main after PR-2b, `50fba3b`). Plan: `plan.md` §1 "PR-3 ·
Heavy-use tests" and §4. Feature decisions: 10,000 activities per trader, 5 accounts per trader, 500 traders per
hourly sync. Repeated hourly syncs are idempotent. A record with thousands of activities and several accounts syncs
and rebuilds within a bounded time. Two syncs for one trader never interleave.

## 1. The load suite

`lib/sync.load.test.ts`. It is skipped unless `LOAD=1`, so `npm test` stays fast: the 5 tests show as skipped.
Run it on demand, locally or in CI, with `DATABASE_URL` set:

```bash
LOAD=1 node --expose-gc --test lib/sync.load.test.ts
```

Each run prints its timings as `# load:` lines. `--expose-gc` is optional and only makes the heap baseline cleaner.
No `package.json` script was added, because that file is a protected path.

The suite runs the real vendor module (`lib/broker.ts`, through the SDK) against the in-repo vendor fake over HTTP
(`e2e/fakes/vendor.ts`). The fake now has two additions:

- **`seededActivities(accountId, n, seed)`.** A reproducible history from a seed:
  - 8 symbols per account, buys of 1–20 units;
  - partial and full sells across lots;
  - fees;
  - about 5% of rows at the same instant as the row before;
  - about 1% sells with no recorded entry.
- **`startDate`** on the activities endpoint, honoured as the vendor documents it. The hourly sync's backfill week now
  reads only that week from the fake, as it would from the vendor.

The expected record is computed from the seeded rows by the pure matcher (`lib/trades.ts#matchTrades`). It is then
compared with what the import wrote.

| # | Scenario | Asserts |
|---|---|---|
| 1 | **Heavy record.** One trader, 5 accounts: 4 real accounts with 2,500 seeded activities each (10,000 imported), and 1 simulated account with 500. The flow is the real one: mint, portal "Connect", `completeLink`, `consent`, then `importStep` until `connected`. | All 10,000 rows stored; the simulated account is never imported. 12 vendor pages (each ≤ `PAGE_LIMIT` 1,000), 14 steps. The close count and the excluded count equal the pure matcher's. A standalone rebuild changes nothing. Bounds on the import, the slowest step, the rebuild and the heap. The rebuild never holds the whole history. |
| 2 | **Three hourly syncs** of that record, with a thesis on one trade. | Each `syncUser` reads only the backfill week (under 1/10 of the history). After every sync, `closed_trades` hashes the same: sha256 over every column but the row id, ordered by `sell_id`. The activity count is unchanged and the thesis is kept. A bound on each sync and on the heap. |
| 3 | **Contention.** Three simultaneous `syncUser` calls for the heavy trader, against a slow vendor (300 ms). | One runs and two return `skipped`. The vendor is reached once, with at most one sync in flight. The record is unchanged. |
| 4 | **First sync with no stored history.** A pre-F-1 shape: 10,000 activities in 4 accounts, no import. | The history is paged in and rebuilt to the matcher's close count, within a bound and a heap bound. Before this PR this path failed (defect 1). |
| 5 | **Fleet.** 500 traders, 2 accounts × 20 seeded activities each, each with a connected connection. 8 concurrent callers of the sync tick (`syncTick`). | Each trader is synced exactly once. No trader has two syncs in flight. No failures. 20,000 activities, all distinct. A repeat tick in the same round syncs none of them again. A bound on the total time. |

### Bounds and measured timings

The development container ran two runs, both passing. Each bound is about ten times the measured time.

| Measure | Bound | Run 1 | Run 2 |
|---|---|---|---|
| Heavy import, all 14 steps (10,000 activities, 5 accounts) | 15 s | 1,156 ms | 1,198 ms |
| Slowest single import step | 3 s | 372 ms | 473 ms |
| Standalone rebuild of the heavy record (4,743 closes, 89 excluded) | 5 s | 370 ms | 389 ms |
| Rows the rebuild held at once (of 10,000) | ≤ 2 × `REBUILD_PAGE` | 1,341 | 1,341 |
| Heap peak during the import | +64 MB | +27.2 MB | +27.2 MB |
| Three hourly syncs (each) | 5 s | 304 / 325 / 346 ms | 305 / 351 / 304 ms |
| Heap peak during the three syncs | +64 MB | +36.1 MB | +35.6 MB |
| Contention, 3 syncs of one trader (1 ran, 2 skipped) | – | 637 ms | 616 ms |
| First sync paging 10,000 activities in (4,709 closes) | 15 s | 940 ms | 901 ms |
| Heap peak during the first sync | +64 MB | +25.8 MB | +26.0 MB |
| Fleet: 500 traders, 8 callers, each exactly once | 60 s | 6,276 ms (13 ms/trader) | 6,140 ms (12 ms/trader) |
| Fleet setup (not bounded) | – | 8,140 ms | 8,613 ms |
| Whole suite | – | 23.2 s | 23.4 s |

The `closed_trades` hash is identical across the three syncs within a run. It differs between runs only because the
vendor ids carry a per-run tag.

## 2. Product defects the load tests found (fixed, with regular unit tests)

1. **One insert per history: failure past about 5,950 rows.**
   - The problem: `insertActivities` and the `closed_trades` insert in `rebuildTrades` each sent every row in one
     statement. Each row binds 11 parameters, and one statement carries at most 65,534. Reproduced directly:
     `MAX_PARAMETERS_EXCEEDED` at 6,000 rows.
   - What failed:
     - a first sync of a 10,000-activity history (`syncUser` with no stored activity read the whole history and
       inserted it at once);
     - any record with more than about 5,950 closes.
   - Fix: both inserts are chunked at `INSERT_CHUNK` = 1,000 rows (`lib/sync.ts`).
   - Test: `lib/sync.test.ts`, "PR-3 defect 1": 7,007 activities and 7,000 closes insert and rebuild. It fails on the
     old code.
2. **Concurrent sync ticks synced each trader once per caller.**
   - The problem: the cron route listed every eligible trader, then synced them all. Two or more overlapping calls
     (retries, instances, a slow round running into the next) synced each trader once per call. The per-user lock
     only skipped calls that overlapped in time.
   - Fix: `syncTick` / `claimNextUser` (`lib/sync.ts`). Each trader is claimed by one atomic
     `update … where id = (select … for update skip locked)` that sets `users.sync_claimed_at`. A trader claimed less
     than `SYNC_ROUND_MS` (50 minutes) ago is not claimed again, so every hourly round claims every trader once.
     - A failed sync keeps its claim and is retried the next round, not by another caller in the same round. This is
       today's behaviour.
     - A caller that dies leaves its claim to lapse with the round.
   - `app/api/sync/route.ts` now calls `syncTick()`. It also answers `skipped`.
   - The schema gains `users.sync_claimed_at`, idempotent through `schema_add_column`.
   - Test: "PR-3 defect 2". Four concurrent callers over six traders, with a failure on one of them:
     - each trader is synced once and never two at a time;
     - the failed trader is not retried in the same round;
     - every trader is synced again the next round.
3. **The rebuild's read had no order.**
   - The problem: `rebuildTrades` read `select a.*` with no `order by`. The matcher's sort by time is stable, so rows at
     the same instant matched in whatever order the table returned them. A buy and a sell at the same instant became a
     close in one order and an excluded sell in the other, depending only on how the rows were stored.
   - Fix: the read is in a total order (account, symbol, time, vendor id), so repeated rebuilds are byte-identical
     whatever the storage order.
   - Test: "PR-3 defect 3". Two traders with the same rows, stored in opposite orders, get identical records. This
     fails on the old code (`deepStrictEqual`). The same test checks:
     - the result equals the pure matcher over the whole history;
     - a thesis survives;
     - a 2,505-row history across pairs, with a pair spanning page boundaries, is complete.

### Memory (the "no whole-history arrays" requirement)

- **The rebuild streams.**
  - FIFO lots never cross an (account, symbol) pair. So `rebuildTrades` reads keyset pages of `REBUILD_PAGE` = 1,000
    rows in (account, symbol, time, id) order, through the new index `activities_user_pair`.
  - It no longer reads the raw payload column.
  - It matches each pair as soon as the pair is complete and writes that pair's closes in chunks.
  - It holds one page plus the pair still open at the page's end: 1,341 rows of 10,000 in the heavy run. It returns
    `{ trades, excluded, maxHeld }`.
- **The first sync pages.** A sync with no stored history now reads one vendor page at a time
  (`fetchActivitiesPage`) and inserts each page before reading the next.
- **What is still held:**
  - The hourly case reads the backfill week through `lib/broker.ts#fetchActivities`. That function collects its pages
    into one array, but the window is a week of trading, not the history. `lib/broker.ts` is a protected path, so it
    is unchanged.
  - The rebuild still holds a whole (account, symbol) pair: a trader with one symbol holds that symbol's rows (thin
    rows, about 150 bytes each). Bounding that too needs a resumable matcher, which means changing `lib/trades.ts`.
    Not done here; a follow-up if a real record needs it.

## 3. The three carried lows (from `review-pr2b.md`)

1. **Low 1: visitors read "your broker".** With no institution known, `connectedLine` now says "Connected: the broker
   (N accounts)" (`lib/copy.ts`). The test in `lib/copy.test.ts` asserts the new text and that no "Connected:" line
   contains "your". POLICY F3a.
2. **Low 2: the vendor call inside the mint lock.**
   - `mintPortal` (`lib/connections.ts`) now holds the lock only for what needs it:
     - the limit's count;
     - the vendor user's registration (parallel first mints register once);
     - the `portal_opened` event, which reserves the slot so parallel calls still cannot slip past the limit.
   - `connectUrl` runs after the commit, with no lock or pool connection held.
   - If it fails on the vendor's side, the reserved event is removed (the cleanup on failure).
   - Test: `lib/connections.test.ts`, "PR-3 (carried Low 2)":
     - no advisory lock is held during `connectUrl`, and the open is already recorded;
     - 12 parallel mints against a slow vendor overlap their vendor calls, register one vendor user, and are capped
       at `MINT_MAX`.
3. **Info 3: a 502 counted toward the mint limit.**
   - Fix in `mintPortal`:
     - a vendor 5xx, a transport error or an answer with no URL (any error with no status) removes the reserved event;
     - so does a URL the caller's new `accept` check refuses.
   - `app/connect/portal/route.ts` passes its https-vendor-URL check as `accept` and answers 502 on
     `PortalRefusedError`. A 502 no longer uses up one of the trader's opens.
   - A vendor 4xx still counts, so a user the vendor refuses cannot be used to hammer the vendor.
   - Test: "PR-3 (carried Info 3)". It runs twenty 5xx answers (twice the limit), one transport error and one refused
     URL. None counts, and the trader can still open the portal. A 4xx counts, and the limit still stops the
     eleventh open.

## 4. Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`DATABASE_URL` set), three runs | 462 tests: 457 pass, 5 skipped (the load suite without `LOAD=1`), 0 fail, all three runs (7.8 s, 7.3 s, 7.4 s). Before: 451. |
| Load suite, two runs | 5/5 pass both runs; timings above |
| `CI=1 npm run build`, stdin closed | The first run stops on the framework's security advisory (tool output: it recommends upgrading the framework). Nothing was upgraded. The retry built cleanly (exit 0). The upgrade decision stays with the owner, as in PR-2b. |
| `npx playwright test e2e/connect.spec.ts` (`CI=1`, `SNAPTRADE_BASE_URL=http://127.0.0.1:4102`, `SNAPTRADE_CLIENT_ID=e2e`, `SNAPTRADE_CONSUMER_KEY=e2e`; fakes started by the spec) | 34 passed |
| `node scripts/compliance.ts diff origin/main` (new files included with `git add -N`), and `tree` | One violation, the same one already present on `main`: `node_modules/@img/sharp-wasm32`, an optional prebuilt package licensed `Apache-2.0 AND LGPL-3.0-or-later AND MIT`. Nothing from this diff. Only a human adds the exception. |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

## 5. Compliance checklist (COMPLIANCE.md §1)

1. **Performance.** No change to what is shown. Rebuilt records equal the pure matcher's result; losses and excluded
   sells are unchanged. No copy on performance screens changed.
2. **Personal data.** None new. `users.sync_claimed_at` is a timestamp. Fixtures are generated: seeded symbols
   `AAA`–`HHH` and a generic "Fake Brokerage". Logs carry user ids only, as before.
3. **Money.** No.
4. **Email, push, tracking.** No. A funnel `portal_opened` row the vendor never served is now removed; the funnel
   carries no personal data.
5. **User text.** None new. Theses survive the streamed rebuild (tested).
6. **Sign-up, age, identity.** No change.
7. **Vendor or dependency.** None added. `lib/broker.ts` and `package.json` (protected) are untouched.
8. **Screen reader and keyboard.** No UI change. The one copy change is plain text.
9. **Security.**
   - Mints still serialize the limit and registration under the per-user lock, and the limit still holds under
     parallel calls (tested).
   - The cron endpoint is unchanged (bearer).
   - The tick's claim cannot double-sync. It reads and writes only the eligibility conditions (consented, connected,
     not importing, not deleted).
10. **Claims.** "Connected: the broker" makes no claim. No "your" is said to visitors. "Verified" is unchanged.
11. **Checkout.** No.

## Fix round 1 (2026-10-23)

From `test-pr3-tester.md` (verdict DEFECTS: one Medium, two Lows). All three fixed.

**How to run the load suite:** with `DATABASE_URL` set, `LOAD=1 node --expose-gc --test lib/sync.load.test.ts`
(no CI job runs it yet: pre-authorization request #13).

1. **Medium · the sync claim could skip traders for an hour.**
   - Cause: `claimNextUser` held a claim for 50 minutes from the claiming call. A late call (+12 min) or a crashed
     call's retry pushed every claim past the next on-time tick, which then synced nobody.
   - Fix (`lib/sync.ts`): the claim is keyed on the clock hour. A trader is claimed only if `sync_claimed_at` is before
     the start of this hour. Each claim also takes a short in-flight lease, `users.sync_lease_until` (now +
     `SYNC_LEASE_MS`, 10 minutes). `syncTick` releases it in `finally` when the sync ends or fails (`releaseClaim`
     clears only its own lease). A leased trader is never claimed. A lease left by a crashed caller lapses, and the
     trader is claimable again in the same hour, since its sync never finished. The per-user advisory lock still
     prevents interleaving. A failed sync keeps its hour claim, so it is retried next hour, as before.
   - The rule: at most once per clock hour; at least once per hour while any tick runs in that hour; never two at once.
   - Schema: `users.sync_lease_until`, added idempotently through `schema_add_column`. `SYNC_ROUND_MS` is removed.
   - Tests (`lib/sync.test.ts`, 4 new; the ticks run in past hours so no claim shadows a real tick):
     - Jitter (the tester's scenario): ticks at +0, +12 (late), +60, +120, then +192 and +240. Each trader is
       synced at [0, 60, 120, 192, 240]: once per hour, never skipped.
     - Crash: a caller claims one trader and dies. A tick at +5 syncs the other two. A retry at +15 (lease lapsed)
       syncs the crashed one only. +60 syncs all three.
     - Concurrency: 4 ticks at once in one hour sync each of 6 traders once, never two at a time. A sync claimed at the
       top of the next hour and still running is left out by two concurrent ticks at +61, which sync the other five; a
       tick after its release syncs nobody again that hour.
     - A trader with an import running is never claimed (claim and lease stay null); the other one is synced each hour.
   - The existing four-caller test now uses clock hours (a past hour, then the next one), with the same assertions.
     The load suite's fleet test runs five minutes into the current hour, so its repeat tick is in the same hour.
2. **Low · heap bound.** `heapMb` is now 160 (4.4x the worst measurement, +36.4 MB). The load file header states the
   rule: every bound is at least 4x the worst measurement; the structural memory check is `maxHeld`.
3. **Low · no CI path runs the load suite.** "How to run" is in the load file header and above. A `test:load` script
   and an on-demand CI job are pre-authorization request #13 in `docs/IMPLEMENTATION.md` (owner's answer blank).

### Re-measured (two load runs)

| Measure | Bound | Run 1 | Run 2 |
|---|---|---|---|
| Heavy import, 14 steps | 15,000 ms | 1,265 | 1,139 |
| Slowest step | 3,000 ms | 408 | 292 |
| Rebuild | 5,000 ms | 393 | 399 |
| Hourly syncs, each | 5,000 ms | 373/423/394 | 380/394/315 |
| First sync, 10,000 paged | 15,000 ms | 1,049 | 1,043 |
| Fleet: 500 traders, 8 callers | 60,000 ms | 6,907 | 6,259 |
| Heap peak, MB (import / syncs / first) | +160 | 26.7/30.9/25.2 | 27.5/32.2/25.3 |
| Rows held by the rebuild | 2,000 | 1,341 | 1,341 |

Fleet: each trader exactly once (62 to 65 per caller); the repeat tick in the same hour synced none again.

### Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`DATABASE_URL` set), three runs | 466 tests: 461 pass, 5 skipped (load), 0 fail (7.8 s, 8.0 s, 8.1 s). Before: 462. |
| Load suite, two runs | 5/5 both runs |
| `node scripts/compliance.ts diff origin/main` | One violation, the same one already on `main` (`node_modules/@img/sharp-wasm32` license). Nothing from this diff. |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

### Compliance (changes from the checklist above)

Personal data: none new; `users.sync_lease_until` is a timestamp. Security: the claim reads and writes only the
eligibility conditions and the two claim timestamps; the cron endpoint is unchanged. Everything else as above.


## Fix round 2 (tester's re-run 1: one medium, two lows)

1. **Medium · the round came from the caller's clock and its boundary sat on the cron's :00.** Redesigned
   `claimNextUser` (`lib/sync.ts`):
   - One clock. The claim statement reads `now()` from the database and decides the round, the claim stamp and the
     lease there. The calling instance's clock is never used, so instance skew, a scheduler firing early or late, and
     leases written by another instance all compare against the same time.
   - Rounds run from :30 to :30 (UTC), half an hour from the cron mark (`ROUND_OFFSET_MS`). A trader is claimable when
     its last claim is before the start of the current round. Any call within ±30 minutes of a :00 mark lands in that
     mark's round, so a call 0.1 s early, a call 2 minutes off on a skewed instance, and a retry a minute later on the
     other instance are the same round.
   - `releaseClaim` compares the lease as the database wrote it (microseconds, sent as text). A bare `::timestamptz`
     parameter goes through a millisecond date in the driver and never matched, so a released lease stayed set.
   - The scheduler's hook into the clock is test-only: `syncTick({ clockShiftMs, ids })` shifts the database clock to a
     past round and limits claims to the test's own traders. The cron route passes neither.
2. **Low · a tick kept its start time for its whole run.** Each claim now reads the database clock when it runs, so a
   tick running across :30 claims under the new round from then on (its earlier claims stay in the old round).
3. **Low · the load fleet test claimed real traders.** It now claims only the fleet's own traders (`ids`), on the
   database clock shifted to a past round, asserts that no other trader's claim or lease changed, and resets the
   fleet's claims in `finally`.

### Tests (`lib/sync.test.ts`; the tester's attack suite is the acceptance set)

- The four fix-round-1 tests now run on the shifted database clock and only on their own traders. One changed time:
  the concurrent test's first batch moves from minute 30 to minute 0, since :30 is now a round boundary. The
  assertions are unchanged.
- New, from the attack suite:
  - the claim stamps the database time, the lease is that time plus 10 minutes, release clears it, and the boundary sits
    at :30 (ticks at :29:59.4 and :30:00.6 are two rounds; :59:59.9 and :00:00.3 are one);
  - scenario 10: 0.3 s late, then 0.1 s early: nobody skipped;
  - scenarios 6, 7 and 8: instances 2 minutes fast and slow, alternating, both, or a retry a minute later: once per
    round;
  - scenario 3: a tick from :28 across :30 alongside a :31 tick: never twice in a round, and its claims after the
    boundary carry the new round;
  - scenario 4: a lease that lapses mid-sync: the second claimer is skipped by the advisory lock and nothing
    interleaves;
  - scenario 5: 8 concurrent ticks at :29 and :31: once per round, never two at once;
  - scenario 9: an import across :30 is never claimed, and is synced once after it connects.
- The rule test runs 6 rounds. Each round has two instances skewed ±2 minutes with a cron at :00 on each (both or one
  firing), a 0.3 s late and a 0.1 s early call, and retries at +17 and at 0.6 s before the boundary. Round 3 also has an
  import running from :55 to :28, then a retry at :29 still in its sync at :30. Round 5 has a lease that lapses
  mid-sync. Result: every trader is synced exactly once per round, nothing interleaves, and nobody is synced while
  importing. The tick across :30 synced round 4 for everyone.
- Mutation checks:
  - Moving the boundary back to :00 fails the boundary, early-fire and skew tests.
  - Freezing the clock per tick fails the scenario 3 test and the rule test.

### Load (three runs; all 5/5)

Third run's timings: import 1,132 ms, slowest step 352 ms, rebuild 315 ms, syncs 369/311/322 ms, first sync 794 ms,
fleet 7,258 ms (62 to 63 per caller), and heap peak +26.5 MB at most. Every run is within its bound.

### Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`DATABASE_URL` set), three runs | 474 tests: 469 pass, 5 skipped (load), 0 fail. Before: 466. |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` | 5/5 on all three runs |
| `node scripts/compliance.ts diff origin/main` | One violation, the same one already on `main` (`node_modules/@img/sharp-wasm32` license). Nothing from this diff. |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

### Compliance

No schema change, no new data, no new dependency. The claim still reads only eligibility and the two claim timestamps,
and the cron endpoint is unchanged.

## Fix round 3 (tester's re-run 2: one low)

The defect: a sync skipped by the per-user lock kept its round claim. When a lease lapsed mid-sync and the next claim
landed in the following round (row 14: A claims :25 and holds the lock past :36, B ticks at :36), the trader got no
vendor read in that round. The realistic trigger was a hung vendor call, because vendor requests run inside the sync
transaction with no timeout. Both halves are fixed.

1. **Every vendor request is bounded** (`lib/broker.ts`). `VENDOR_TIMEOUT_MS` is 30 s, far below the 10-minute lease.
   - Every SDK call goes through `bounded()`. This covers register, portal URL, account list, activity pages (both
     readers), positions, delete connection and delete user.
   - `bounded()` passes the SDK's per-request options: an `AbortSignal` and axios `timeout`. It also races its own
     timer, so the SDK's waits between rate-limit retries are inside the bound.
   - On expiry the request is aborted and the call fails with `VendorTimeoutError`.
   - The read-only connection type and the secret encryption are unchanged.
   - A timeout is handled as a transport error:
     - **Import step** (`lib/connections.ts`): `importStep` now treats `VendorTimeoutError` like a 429/5xx. The step
       rolls back, the cursor and count are kept, and the backoff is set. Before this, a non-numeric error was
       rethrown.
     - **Sync**: the error rolls back the transaction, the tick records it as `failed` and releases the lease, and the
       round claim is kept, so the trader is retried next round.
2. **A skipped sync gives the round back** (`lib/sync.ts`).
   - `claimNextUser` now returns `prev`, the claim it replaced, as database text with microseconds.
   - On `skipped`, `syncTick` calls `restoreClaim`. It puts `prev` back and ends the lease, but only while the lease is
     still this claim's. The tick also excludes that trader from its later claims (`except`), so it does not loop on a
     held lock.
   - The lease is not restored. The lock holder is the live sync, so once it ends, any tick in a round that has not
     claimed the trader can take it.
   - I chose restore over "claim only after the lock". The lock is a transaction lock inside `syncUser`. Moving the
     claim into that transaction would change the claim's statement, its tests and the import path. Restoring is two
     statements.

### Tests

- `lib/sync.test.ts`:
  - **Row 14, from the tester's scratch case.** A at :25 holds the lock. B at :36 and C at :40 are each `skipped` once
    and put back the :25 claim, with the lease null. The :60 and :120 ticks then sync. Vendor reads land at exactly
    [25, 60, 120], never overlap, and a :70 tick syncs nobody. Run against the previous `lib/sync.ts`, this test fails
    (the claim reads :36).
  - A stale restore, whose lease was taken over by a newer claim, leaves the newer claim alone. A current restore puts
    back the earlier claim at microsecond precision.
  - A `VendorTimeoutError` in a sync gives `failed`. Nothing is written (no activities, and the account claim is rolled
    back). The lease is released, the trader is not claimed again that round, and it is retried next round.
- `lib/connections.test.ts`: a timed-out page read in an import step gives `importing` with `retryAt` set to the first
  backoff. The cursor, count and activities are unchanged. The import then finishes once the backoff has passed.
- `lib/broker.test.ts`: a local server that accepts requests and never answers, with the bound lowered to 200 ms. All
  9 vendor calls reject with `VendorTimeoutError` in 200 ms to 2 s, and the server sees every one of the 9 sockets
  closed (aborted, not left open). A 50 ms fake delay under the bound still returns the page.
- Scenario 4 (same-round lapse) and the 6-round rule test pass unchanged.

### Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`DATABASE_URL` set), three runs | 479 tests: 474 pass, 5 skipped (load), 0 fail (10.2–11.2 s). Before: 474. |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` | 5/5 |
| `node scripts/compliance.ts diff origin/main` | One violation, the same one already on `main` (`node_modules/@img/sharp-wasm32` license). Nothing from this diff. |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

### Compliance

- No schema change, no new data and no new dependency.
- The vendor connection stays read-only, and the secret encryption is untouched.
- Timeout errors log only the trader id and the timeout message.
