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
