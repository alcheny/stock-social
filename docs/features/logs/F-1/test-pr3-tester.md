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
