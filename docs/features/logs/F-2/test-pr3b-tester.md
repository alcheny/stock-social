# F-2 PR-3b · Similar trades on profiles (tester)

2026-10-24. Branch `claude/adoring-euler-4469ys`, product code at `266376e`. Postgres 16, Node 22.22 (`CLAUDE.md` asks for 24
or later). No product code changed.

Isolation: two databases of my own, created as the superuser and owned by the shared role: `ss_tst_pr3b` (checks, build, both
e2e passes) and `ss_tst_pr3bw` (the walk and the timings). The shared `stock_social` was never written. Everything ran from a
copy of `HEAD` in my scratch directory with its own `.next`, `.env` and `node_modules`. The e2e runs used a Playwright config in
that copy on port 3473 (vendor fake on 4102). My walk server ran on 3474, and a build of the parent commit `4a5ee82` ran on 3475
for the "before" timings. Port 3000 was not touched.

**Verdict: CLEAN.** Every check passes, every behaviour in O2 and the plan holds, and there is no regression. I found no defects.

## 1. Checks

| Check | Result |
|---|---|
| Schema ×2 (both databases), seed | exit 0 every time. No schema change. `db/schema.sql` has no `drop`, `truncate` or `delete from`. |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | **622 tests: 610 pass, 12 skipped (LOAD), 0 fail** in each run. Count 622 ≥ 622. |
| Weakened? | No. `git diff 4a5ee82 HEAD -- '*.test.ts' e2e/` removes one line. `imports.test.ts` ROOTS gains `similar.ts`, so the new list is a superset. No assertion changed. |
| `LOAD=1` feed + follows + sync | First full run: 11/12. The sync fleet case failed once. That run came straight after my own mistaken invocation, which passed the same files twice in parallel against one database. Alone it passed 5/5 (fleet 8.4 s). The full run repeated: **12/12** (fleet 11.8 s, bound 60 s). Feed: section on every page, 50 heavy, signed-out p95 340 ms, signed in 336 ms. One-period case: 345 ms (bound 400). Follows: delete with 100,000 viewers took 134 ms. I count this as my setup, not a defect. |
| `CI=1 npm run build`, stdin closed | Run 1 stops on the framework's security advisory. That is tool output. Nothing was upgraded and nothing acted on it. The retry exits 0. |
| `npm run test:e2e` ×2 | **112 passed, 3 skipped, 0 failed** in both runs (4.4 / 4.6 min). The 3 `similar.spec.ts` tests pass. The skips are the sign-in provider and mail-sink tests. |
| `node scripts/compliance.ts diff origin/main` | 1 violation, already present: the `@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | ok |

## 2. As a user (my server, 375 × 800)

Fixture (prefix `tb_`, closes dated 2 days ago, accounts 60 days old). The demo seed was also present.

| Trader | Closes | Bucket | Role |
|---|---|---|---|
| `tb_t0` | 5 | 1 to 7 days | the profile under test (boundary: exactly 5) |
| `tb_t4` | 4 | 1 to 7 days | below the minimum |
| `tb_loss` | 40, every one a loss | 1 to 7 days | losses |
| `tb_v40`, `tb_v20`, `tb_v8`, `tb_fifty`, `tb_big` (5,000), `tb_viewer` | as named | 1 to 7 days | verified candidates of different evidence |
| `tb_v20`, `tb_v8` | latest close is `SAME` for both | 1 to 7 days | grouping by symbol |
| `tb_mix` | 9, median 3 days; its latest close was held 60 days (`MIXLONG`) | 1 to 7 days | the row must be its latest close in the bucket |
| `tb_demo` | 40, unverified | 1 to 7 days | Demo |
| `tb_m0` (5), `tb_m1..m3` (10 each) | | 1 to 6 months | a second bucket |
| `tb_p0..p499` | 25 each, spread over all five buckets | | load for the timings |

### When it shows (each boundary)

| Case | Result |
|---|---|
| 5 closes (`tb_t0`) | shown, 3 rows |
| 4 closes (`tb_t4`) | absent |
| Exactly 3 qualifying rows (`tb_m0`: m1, m2, m3) | shown |
| One of the 3 deleted (2 qualify) | absent. It returns when the trader is restored. |
| The profile's own import running (a consented `importing` connection on `tb_loss`) | absent on `/u/tb_loss`. It is back once the import is `connected`. |

### Rows

| Check | Result |
|---|---|
| Same bucket | `tb_t0` (bucket 1) shows only bucket-1 traders. `tb_m0` (bucket 3) shows `tb_m1..m3`. Every row reads "Held 1 to 7 days" / "Held 1 to 6 months". |
| Trade in the bucket | `tb_mix` shows `MIXB1`, its latest bucket-1 close, not its newer 60-day `MIXLONG`. |
| No performance number | I stripped the tags from the section's server HTML: no `%`, no `$`, no signed number. The only digits are dates and symbols. The sheet carries the record and the disclaimer. |
| TR-9 order | I recomputed the pool (`feedList` at the hour, `similarCandidates`): `tb_loss` 0.362, `tb_big` 0.277, `tb_fifty` 0.099, `tb_v40` 0.061, then the weight-0 records, then `tb_demo`. The rendered rows follow that order at each step as I removed the leaders. |
| Demo after verified | `tb_demo` has weight 0.061, above five verified records. It appears only once fewer than 3 verified candidates remain (loss, mix, **demo**), and it carries the Demo badge. |
| Losses included | The all-loss `tb_loss` is the first row. |
| Not grouped by symbol, not the ticker page | `tb_v20` and `tb_v8` both show `SAME` side by side. The no-JS link goes to `/u/<h>/trade/<sell_id>`. |

### Tap and no JS

- A tap opens `dialog.pane-sheet` with "Not investment advice. Past performance does not guarantee future results." (`sheet-375`).
- Before the first open, the profile's sheets are empty (inner HTML 0 / 0 / 0) and the section has no `svg`. After one open
  there are 2 `svg`. On the feed, the section's sheets still hold their panes before any open (2,987 / 2,881 / 2,824 chars), so
  the feed is unchanged.
- Without JavaScript the first row links to `/u/tb_loss/trade/tb_loss-0`, and a click lands on that trade's page
  (`nojs-375`).

### Who is viewing

| Check | Result |
|---|---|
| Signed out ×2 | Section HTML identical byte for byte (2,088 bytes). |
| Fresh signed-in viewer (`tb_viewer`, no follows or hides) | Each row's link HTML is identical to the signed-out one. Signed in adds only "…" and the hide bar. |
| Own record | Signed in as `tb_loss` on `/u/tb_t0`: rows are big, fifty, v40. `tb_loss` is never a row. |
| Not interested vs unfollow | Viewer `tb_loss` with `not_interested` on `tb_big` and `unfollow` on `tb_fifty`: rows are fifty, v40, v20. The hidden trader is out. The unfollowed one stays. |
| "…" → Not interested | The row collapses and "Hidden for 90 days." appears with Undo. 1 exclusion is written. Undo restores the row, and the exclusion count goes back to 0 (`row-menu-375`, `menu-hidden-undo-375`). |
| Reject swipe (touch, 375) | Flicks of 40% of the card and of 50 px write nothing, and the row returns to rest (scrollLeft 281). A slow drag of 55% commits, with 1 exclusion and the bar. Undo restores it, back to 0 (`reject-swipe-undo-375`). |

### The two 10-second caches

| Case (signed out, `/u/tb_t0`) | Result |
|---|---|
| A row trader's import starts | Next request, within 10 s: `tb_loss` is gone (big, fifty, v40). Import states are read on every view. |
| A row trader is soft-deleted | Next request: gone. The `deleted_at` filter runs on every view. |
| A row trader is hard-deleted | Next request: gone, even though the pool and the record cache still held them. A deleted trader never rendered from cache. |
| A new high-evidence trader | Absent at first. Once the pool is older than 10 s, the next request starts the rebuild, and a later request shows them (v40, **new**, v20). |
| That new trader hard-deleted while the pool still lists them | Gone on the next request (v40, v20, mix). |

The window behaves as designed: deletes and imports apply at once, and new pool entries appear after one 10-second rebuild.

### Cost: profile server time, `next start`, 150 sequential requests after 10 warm-ups, p95 in ms (3 runs)

500 load traders plus the fixture. In the 50-close profile's rows, the 5,000-close `tb_big` is one of the 3 (the heavy case).

| Profile | Before (`4a5ee82`) | After (`266376e`) | Change |
|---|---|---|---|
| 50 closes, signed out | 34.1 / 30.7 / 29.6 | 55.3 / 50.4 / 48.9 | about +20 |
| 50 closes, signed in | 30.9 / 26.4 / 28.2 | 55.5 / 53.8 / 48.1 | about +24 |
| 5,000 closes, signed out | 170.4 / 173.3 / 168.0 | 189.5 / 182.3 / 190.9 | about +17 |
| 5,000 closes, signed in | 195.3 / 166.9 / 165.4 | 175.8 / 187.1 / 205.4 | about +14 |

All four are inside the +50 ms budget. HTML for the 50-close profile grew from 65.5 KB to 98.8 KB, because the sheets' panes ride
in the payload.

### Shared link at 375

The section sits after the last close and after "Show 50 more", with a top border and a smaller heading. Below it there is only
"← Feed" (`paging-then-section-375`). A visitor reads the trader's whole page before reaching other traders.

### Regressions

Profile paging, the F-1 chart, the feed section, follow and hide: the e2e suites (`app`, `section`, `follow`) pass in both runs.
In the walk, the feed's section rendered 18 rows with eager panes.

## Screenshots

`screenshots/pr3b-test/`, each in light and dark: `section-signed-out-375`, `paging-then-section-375`, `sheet-375`, `nojs-375`,
`section-signed-in-375`, `row-menu-375`, `menu-hidden-undo-375`, `reject-swipe-undo-375`.

## Cleanup

All `tb_` users (515) deleted. `ss_tst_pr3b` and `ss_tst_pr3bw` dropped. My servers (3474, 3475) stopped. The e2e servers
stopped with their runs. Only this report and the screenshots are committed.

## Re-run 1 (2026-10-24, product code at `bbd48f2`, fix round 1)

Isolation: two databases of my own, created as the superuser and owned by the shared role: `ss_t2_pr3b` (checks, LOAD, build,
e2e) and `ss_t2_pr3bw` (the walk and the timings). The shared `stock_social` was never written. Detached worktrees of `bbd48f2`
and of the parent of PR-3b (`4a5ee82`) in my scratch directory, each with its own `.next`, `.env` and `node_modules`. e2e on
3473 through a temporary Playwright config (vendor fake 4102); walk server 3474; `4a5ee82` on 3475. Port 3000 was not touched.
Node 22.22, Postgres 16.

**Verdict: DEFECTS** (one Low). Every check passes, every fix-round behaviour holds, there is no regression; the new pane route
answers a NUL-byte handle with a 500.

### Checks

| Check | Result |
|---|---|
| Schema ×2, seed | exit 0 each time; no schema change; no `drop`/`truncate`/`delete from` |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | **623 tests: 611 pass, 12 skipped (LOAD), 0 fail** each run. 623 ≥ 623. |
| LOAD, one file at a time | feed 6/6, sync 5/5, follows 1/1 |
| LOAD, together | see below |
| `CI=1 npm run build`, stdin closed | exit 0. The framework's security advisory is printed (tool output; nothing upgraded). The `4a5ee82` build stopped on it on the first attempt and passed on the retry, as the engineer saw. |
| `npm run test:e2e` ×2 | **114 passed, 3 skipped, 0 failed**, both runs (5.3 and 5.5 min) |
| `node scripts/compliance.ts diff origin/main` | only the existing `@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | ok |
| Weakened tests | the fix round's diff removes no test, assertion or `expect` line |

**LOAD together, characterised.** Three ways:
- `node --test` with the three files (separate processes, run in parallel, the default): **12/12 pass**. In my first three
  such runs the feed suite's p95 sat at the bound (424 and 401 ms against 400 ms) while the sync suite ran beside it. That is
  CPU contention between processes, not the sync suite.
- `--test-concurrency=1` (one after another): **12/12 pass**.
- One process (`--experimental-test-isolation=none`, Node 22): **all 12 tests pass within their bounds** (heavy import 1,365 ms
  against 15,000; slowest step 433 against 3,000; rebuild 407 against 5,000; three syncs 466/387/417 against 5,000). The
  run then reports `not ok 13 – sync.load.test.ts`, `hookFailed: write CONNECTION_ENDED`: the feed file's `after` hook has
  already called `sql.end()` on the shared pool, so the sync file's cleanup hook cannot query, its fixture stays in the
  database, and the process does not exit (I stopped it after 35 idle minutes).
  **Tag: [Info, test harness, pre-existing]** the LOAD files are not built to share one process. Not a bound miss and not
  product code. Its consequence for anyone running it: leftover load users break `section`/`similar` e2e on the same database
  (my first two e2e passes failed 6 tests that way; after deleting the 502 leftover users both passes were green).

### As a user (375 px, light and dark)

Fixture: 500 traders × 25 closes, plus 50-, 40-, 30- and 5,000-close traders, all held 3 days.

| Check | Result |
|---|---|
| Tap a row | The sheet opens on that trade: heading "WA0 · closed Oct 22, 2026" equals the row's text and has focus; then "−2.0%", "Held 1 to 7 days", "Trade page →" whose href equals the no-JS row's (`/u/<h>/trade/<h>-0`). All three rows. |
| The pane below | Loads under the trade; the trade is marked (`.hl`, one `aria-current`) in "Last 5 trades"; "See full profile →" goes to `/u/<h>`; POLICY's disclaimer is in the sheet. Esc returns focus to the row. |
| Trade not in the last 5 | Given 6 newer closes in another holding period, the sheet still opens on the row's trade and the pane marks nothing (no `aria-current`); nothing breaks (`sheet-not-in-last5`). |
| Lazy load | No `/pane` request before a sheet opens; one per row trader on first open; reopening does not refetch. The profile HTML carries no "See full profile →". |
| 5,000-close row trader | `/pane` is 591,694 bytes; server time 41–52 ms, p95 37 ms over 150 requests; click to rendered pane 193 ms (40-/30-close traders: 62–110 ms). Read only on that sheet's open. |
| Explain line | One sentence, curly apostrophes, matches fix round 1. |
| Hide all three (signed in) | Undo is focused after each hide; after the third the whole section (heading, explainer, rows) is hidden, the bar stays (`all-hidden-bar`). Undo brings the section back with that row. Hiding it again and Esc puts focus on "← Feed" (`all-hidden-focus`). |

### `GET /u/<h>/pane`

| Case | Result |
|---|---|
| Known trader | 200, `cache-control: public, max-age=60`; keys `state`, `trades[{id, symbol, returnPct, holdingDays, closedAt, thesis, verified}]`. No price, quantity, account, trust score or interval; theses only when published (`thesis_status = 'published'` in `records`). |
| Impersonal | Signed in and signed out bodies identical byte for byte; no viewer data. |
| Unknown, case-changed, `%2F..%2F` handles; soft-deleted trader | 404 `{"error":"not found"}`, `no-store` |
| POST, PUT, DELETE, PATCH | 405 |
| Rate limit | None, like the profile and `/pane-chart`: 60 requests in a row all 200. The shared 60 s cache is the only shield. Stance unchanged from the feed's pane chart; no finding. |
| NUL byte (`/u/%00/pane`, `/u/tw_%00/pane`) | **500**, server log `invalid byte sequence for encoding "UTF8": 0x00`. The profile and trade pages answer the same handles with 404. |

### Cost: profile p95 server time (time to first byte), `next start`, 150 sequential requests after 10 warm-ups, 3 runs

Same database, both builds up at once, requests interleaved per case. Signed in = a fixture trader's session.

| Profile, viewer | `4a5ee82` (no section) | `bbd48f2` | Change (mean) |
|---|---|---|---|
| 50 closes, signed out | 39.7 / 38.5 / 37.8 | 45.6 / 44.4 / 43.8 | +6 |
| 50 closes, signed in | 44.7 / 35.5 / 35.3 | 46.4 / 47.9 / 44.9 | +8 |
| 5,000 closes, signed out | 182.5 / 193.7 / 187.4 | 207.3 / 194.9 / 197.9 | +12 |
| 5,000 closes, signed in | 185.0 / 195.0 / 200.1 | 220.4 / 217.9 / 197.2 | +18 |

All four inside the +≤20 ms budget; the signed-in 5,000-close case is the closest (runs vary ±15 ms).

| Profile HTML | `4a5ee82` | `bbd48f2` |
|---|---|---|
| 50 closes, signed out / in | 64.7 / 64.9 KB | 72.7 / 74.9 KB |
| 5,000 closes, signed out / in | 324.3 / 324.4 KB | 332.3 / 334.4 KB |

### Regressions

Profile paging, the F-1 chart, the feed section, follow and hide: the `app`, `section`, `follow` and `similar` e2e suites pass in
both green runs.

### Defects

- **[Low] `/u/<h>/pane` returns 500 for a handle containing a NUL byte.** `app/u/[handle]/pane/route.ts` queries before
  checking the handle; Postgres rejects `0x00`. The profile and trade pages return 404 for the same input, and F-1 fixed the
  same 500 elsewhere by checking the handle against the pattern first (`lib/follows.ts`). No data leaks. Fix: the same
  pattern check (or a 404 on a handle that cannot exist) before the query.

### Observations (not defects of this fix round)

- **[Info, pre-existing]** Under `next start` the pane JSON is not compressed (592 KB on the wire for a 5,000-close trader;
  48 KB gzipped); `/pane-chart` behaves the same, while pages are gzipped. A hosting layer that compresses would remove it.
- **[Info, pre-existing, fixture-driven]** In the 5,000-close trader's pane the headline "Return if every trade were the same
  size" printed an unformatted, very long number that runs off the 375 px screen (`sheet-big-375`). My fixture compounds
  5,000 gains of about 3%, which no real record reaches; the pane component predates PR-3b. Recorded for the designer.
- **[Info]** The 5,000-close trader only entered the rows once its closes were recent (the section pool comes from the feed's
  cards for the hour); with closes spread over 200+ days it never qualified. Expected, noted for future fixtures.

### Screenshots

`screenshots/pr3b-test2/`, light and dark unless noted: `section-375`, `sheet-trade-375`, `sheet-big-375`,
`sheet-not-in-last5-375` (light), `all-hidden-bar-375`, `after-undo-375`, `all-hidden-focus-375`.

### Cleanup

All 504 `tw_` users deleted (the e2e database's leftovers went with it). `ss_t2_pr3b` and `ss_t2_pr3bw` dropped. My servers
(3473 via Playwright, 3474, 3475) stopped; worktrees removed. Only this report and the screenshots are committed.
