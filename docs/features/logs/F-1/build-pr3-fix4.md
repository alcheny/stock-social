# F-1 PR-3 fix round 4: committee fixes (engineer)

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys`, from `fd7b91b` (committee: UX lead COMPLIANCE FAIL + DEMANDS,
business lead DEMANDS, engineer PASS with two notes). A compliance failure goes back to the plan step, so the plan
comes first. Every item has a test that fails on `fd7b91b`.

## Committee fix plan

Order: the blocker, then the compliance failure, then usability and the loop's own limits.

### 1. Blocker: the feed returns 500 once any close is older than about 4.1 years (business lead)

- **Root cause.** The score `ln(1 + |r|·100) · exp(-age_hours / 48)` asks the database for `exp(-746)` or less at
  35,800 hours (4.08 years). The result is below the smallest double, and the database raises
  `value out of range: underflow` instead of returning 0. TR-3 imports whole histories, so such closes are certain.
- **Change.** The ranking expression moves out of `app/page.tsx` into one place, `lib/feed.ts#feedCandidates`, and the
  exponent is clamped: `exp(-least(age_hours / 48, 600))`. e^-600 ≈ 2.7e-261 stays a normal double even after the
  multiply by the smallest non-zero `ln(1 + |r|·100)` (≈ 2.2e-16), so the expression is defined for any age. For closes
  younger than 600 × 48 h (3.3 years) the value, and so the order, is unchanged; older closes all decay by the same
  floor and keep their order by size of move. The order gets a total tie-break (`closed_at desc, id desc`).
- **Other `exp()` of an age.** Checked every `exp(` and `Math.exp` in `app/` and `lib/`: the feed is the only age
  decay. The stock page's `exp(avg(ln(greatest(1 + r, 1e-9))))` is bounded (its argument is at least ln(1e-9) ≈ -20.7);
  the pane, the recap and `confidence()` use `expm1` of bounded log-returns. No change there.
- **Tests.** DB `lib/feed.test.ts`: a trader with five recent closes and one dated 2015-03-02 gets no error, and the
  2015 close ranks last (and stays last through `rankTraders`); a pure test pins the clamp constant against the
  underflow age. e2e `app.spec.ts`: with a 2015 close on a seeded trader, `/` answers 200 and renders.

### 2. Compliance (UX lead, POLICY F3/A1): the long profile buries the disclaimer

- **Root cause.** The profile rendered every closed trade (and the chart rendered one link and one tooltip per
  point, with the whole record serialized for the client twice over): 3.8 MB for visitors at 2,828 closes, the footer
  5,669 Tab stops down, no skip link.
- **Change.**
  - Paged list, no JavaScript needed: `?closes=N` shows the window of the 50 closes that ends at N (newest first;
    N rounded up to a multiple of 50, clamped to the record). Default: the 50 most recent. A line "Showing 50 of 2,828
    closed trades" (later windows: "Showing 51–100 of 2,828 closed trades"). A "Show 50 more" link (44 px tap target;
    "Show 28 more" on the last short window) goes to `?closes=N+50#trade-<first new row>`, so without JS the browser
    lands on row N+1. "Newest 50" goes back to the start. Nothing is hidden (TR-1): every close is one link away, in
    order, through to the oldest.
  - With JS on, a small client component moves focus to the row named in the URL hash (the first new row after "Show
    50 more", or a chart point's trade), so keyboard and screen-reader users land on it.
  - The stats, the evidence line and the chart still cover the whole record (computed from every close server-side).
  - The chart ships the record to the client as compact tuples (id, symbol, return, close time, hold, thesis) and
    renders the per-point trade links only after hydration (they were already `tabindex=-1`). Each point links to
    `?closes=<its window>#trade-<id>`, so every chart point reaches a row that exists (the pane's chart links to the
    profile the same way).
  - A skip link, first in the page: "Skip to disclaimer and legal links" to the footer (`#site-footer`).
  - The list order gets the same total tie-break as the windows (`closed_at desc, id desc`).
- **Tests.** Pure `lib/paging.test.ts` (window maths, clamping, the chart's window per trade). e2e `app.spec.ts` with a
  2,828-close trader: visitor HTML under 400 KB, at most 50 rows, the footer within 200 Tab presses, the page under
  15,000 px, "Showing 50 of 2,828 closed trades", "Show 50 more" without JS reaches rows 51–100 and lands on row 51,
  with JS focus moves to row 51, the last window reaches the oldest close, every chart link points at a row its target
  window renders, the skip link focuses the footer, and the chart still counts 2,828 trades.

### 3. Thousands separators (UX lead 2, business lead 5)

- **Change.** One helper, `count(n)` in `lib/format.ts` (en-US grouping, whole numbers). Used by every count on the
  profile (stats, excluded, simulated, paging line), the banner (status and activities lines), the feed pane and
  chart label, the share prompt, the profile/trade/month images and the metadata text (`lib/copy.ts`), and the evidence
  line (`lib/trades.ts`).
- **Tests.** `lib/format.test.ts`; `lib/copy.test.ts` asserts "2,828" (never "2828") in the banner, the activities
  line, the preview and the count text; e2e asserts "2,828" on the heavy profile.

### 4. Sync deadline (business lead 3)

- **Change.** `syncTick({ deadline })` stops claiming once the deadline is near and logs, at the end of every call,
  the number of syncable traders not yet claimed this round (a count; ids only if any are logged). The connections
  tick (`tick({ deadline })`) also stops starting import steps past the deadline, since it runs first in the same call.
  Durations, as literals in the routes (the framework reads them statically):
  - `/api/sync`: `maxDuration = 300` (the host's default and its lowest plan's ceiling). Claims stop at 300 − 90 s =
    210 s from the call's start (`SYNC_RESERVE_MS` = 3 × the 30 s vendor bound), so a sync started just before the
    cut-off has 90 s; one that still overruns is killed, rolls back and its lease lapses (retried by a later call).
  - `/api/import/step`: `maxDuration = 60` (request #8's ≥ 60 s; fits the strictest host default ceiling). The poll
    starts a step only while at least 35 s remain, so a step bounded at 30 s by the vendor timeout always fits.
- **Tests.** `lib/sync.test.ts`: three traders and a deadline that fits one sync: three calls in one round sync each
  exactly once, each call stops on the deadline, the logged unclaimed counts are 2, 1, 0. A unit test reads both
  routes' `maxDuration` and asserts each is above the vendor bound with margin and above the deadline it uses.
  `lib/connections.test.ts`: `tick` past its deadline starts no step.

### 5. Banner during a long import (UX lead notes 1 and 2)

- **Change.** A second, visually hidden live region announces "N activities imported so far" at most once per 5 s,
  and never within 5 s of any other announcement from the banner (the status line keeps its priority), so a screen
  reader hears movement while the closes count is 0. The 60 s line says "Still waiting for your broker. You can leave;
  the import continues." when the last step was deferred (timed out, rate-limited or the vendor was down: the cursor
  carries a pending `retryAt`); "Your broker is still sending history…" only otherwise. The step answer carries a
  `waiting` flag. Copy in `lib/copy.ts`.
- **Tests.** `lib/import-banner.test.ts`: zero closes and moving activities give one activities announcement per 5 s,
  none within 5 s of a status announcement; the 60 s line by `waiting`. `lib/copy.test.ts`: the new strings.
  `lib/connections.test.ts`: `ownerPoll` reports `waiting` after a timed-out step and clears it after a page read.

### 6. "Too early to tell (9 of 10 bets)" next to 2,828 trades (UX lead note 3)

- **Investigation.** Reproduced with the pure functions: the seeded record (4 accounts × 1,500 activities, 2,831
  closes) has K = 9; each account alone has 69–92 bets. The fake trades the same 8 symbols in every account from the
  same start date, and partial sells keep positions open, so the same-stock holds across the four accounts overlap
  into one chain per symbol (plus one gap). That is the rule working as designed: overlapping holds of one stock are
  one exposure, whatever the account. `confidence()` sorts each symbol's trades itself, so input order and paging do
  not change K (tested). Real records can hit this: a trader who keeps a core position and adds or trims, or holds
  the same stock in several accounts, has few independent bets however many trades.
- **Change.** The evidence line explains it when trades outnumber bets: "Too early to tell: 2,828 trades in 9
  overlapping positions (10 independent bets needed)", and in the other tiers "(12 bets from 4,731 trades, 2,190
  days)". Unchanged when every trade is its own bet.
- **Tests.** `lib/confidence.test.ts`: the new lines; K is the same for shuffled, reversed and concatenated pages.

### 7. Engineer's notes

- `releaseClaim` in the `finally` is guarded: a failure is logged with the trader id and swallowed, the tick goes on,
  and the lease lapses on its own. Test: a release that throws does not abort the tick.
- The rebuild's keyset includes `source` (`account_id, symbol, executed_at, external_id, source`). Test: two sources
  sharing a vendor id at a page boundary both reach the matcher.

### Owner items

`docs/IMPLEMENTATION.md` pre-authorization table: #7 amended to "cron every 5 minutes, never at :30" (owner's answer
left blank); #13 unchanged.

## What was built

| # | Finding | Change | Test (fails on `fd7b91b`) |
|---|---|---|---|
| 1 | Blocker: `/` 500 (`value out of range: underflow`) once a close is older than ~4.08 years | The ranking query moved to `lib/feed.ts#feedCandidates` (the feed calls it; `ids` is a test-only scope). Exponent clamped: `exp(-least(age_h / 48, 600))`; same value and order for closes under 3.3 years; total tie-break `closed_at desc, id desc`. Every other `exp(` checked: the stock page's `exp(avg(ln(greatest(1 + r, 1e-9))))` is bounded below by ln(1e-9); pane, recap and `confidence()` use `expm1` of bounded log-returns. No other age decay exists | `lib/feed.test.ts`: the clamp constant against the underflow age (pure); DB: a 2015-03-02 close gives no error, ranks last (also after `rankTraders`), the four recent closes score exactly `ln(1+|r|·100)·e^(-h/48)` in that order, and an all-old record orders by size. Verified failing by restoring the unclamped term: `value out of range: underflow`. e2e `app.spec.ts`: with a 2015 close `/` answers 200 and renders cards |
| 2 | Compliance FAIL (POLICY F3/A1): every close rendered, disclaimer 5,669 Tab stops down | `lib/paging.ts` (windows of 50 by `?closes=N`, rounded up and clamped; total list order; chart tuples; each chart link to its row's window). Profile: the window's rows only, "Showing 50 of 2,828 closed trades" / "Showing 51–100 of …", a 44 px "Show 50 more" plain link to `?closes=N+50#trade-<row N+1>` (works without JS; "Show 28 more" on the short last window) and "Back to the newest"; rows are focus targets (`tabindex=-1`) and `RowFocus` focuses the row named by the hash on load and on hash change. Stats, evidence and chart from the whole record. The chart ships compact tuples and draws its per-point links after hydration (they were `tabindex=-1` already). Skip link "Skip to disclaimer and legal links" first on every page, to the focusable footer. The feed packs each trader's record once and shares it across that trader's cards | `lib/paging.test.ts` (6 tests: windows, clamping, junk input, every row in exactly one window and the walk reaches the oldest, total order, chart hrefs, packing). e2e `app.spec.ts` at 2,828 closes: visitor HTML < 400 KB, 50 rows, "Showing 50 of 2,828 closed trades", stat "2,828", chart label "2,828 trades", height < 15,000 px at 375 px, footer within 200 Tab presses without the skip link, the skip link is the first stop and focuses the footer, all 2,828 chart links point into the window that renders their row, with JS "Show 50 more" lands on and focuses row 51, a far chart point opens `?closes=2850#…`, without JS "Show 50 more" shows exactly rows 51–100 with row 51 in view, the last window holds rows 2,801–2,828 ending at the oldest close with no "Show more", 44 px controls |
| 3 | Counts without separators | `lib/format.ts#count/counted` (en-US grouping). Used in `lib/copy.ts` (banner, activities lines, so-far, count text, connected line, consent accounts, simulated line, paging), `lib/trades.ts#evidenceLine`, the profile stats and excluded line, the pane, the chart label, the share prompt, the profile/trade images and the month page | `lib/format.test.ts`; `lib/copy.test.ts` "every count is grouped" (no 4-digit run in 14 strings at 1,000+); e2e above |
| 4 | Sync deadline | `/api/sync` `maxDuration = 300`, `/api/import/step` `maxDuration = 60` (literals; `SYNC_ROUTE_MAX_S`/`STEP_ROUTE_MAX_S` mirror them). `syncTick({ deadline })` checks before each claim (no lease is taken past it); `syncDeadline(start)` = start + 300 s − 90 s. The connections `tick` and `drive` start no step or cleanup past the same deadline; `ownerPoll` starts a step only while 35 s remain (`stepDeadline`). Each tick logs `sync tick {"ok","skipped","failed","unclaimed","stoppedAtDeadline"}` (counts only) and hands it to an optional `report` hook; the route answers `unclaimed` and `stoppedAtDeadline` too. The tick's return shape is unchanged (existing tests compare it exactly) | `lib/sync.test.ts`: both routes' literals parsed and checked against the vendor bound and their deadlines; 3 traders, a deadline that fits one 100 ms sync: three calls in one round sync each once, reports `[1,2,true] [1,1,true] [1,0,true]`, a fourth call `unclaimed 0, stoppedAtDeadline false`, a past deadline takes no lease and reports 3 unclaimed, the log line is counts only. `lib/connections.test.ts`: past the deadline `ownerPoll`, `drive` and `tick` make no vendor call and leave the cursor; with time left the poll steps |
| 5 | Silent paging phase; "still sending" during a timeout | `lib/import-banner.ts`: a hidden live region `import-read-live` announces `N activities imported so far` at most once per 5 s, not in the first 5 s, never while a status change is pending or within 5 s after one. **Deviation from the plan:** the plan also held the status line for 5 s after an activities announcement; the existing e2e (`connect.spec.ts:1126`) caught that this delayed the closes count at the rebuild, so the status line keeps strict priority (it is never held back; the two regions can be under 5 s apart only at that hand-over). `slowText`: "Still waiting for your broker. You can leave; the import continues." when the step answer's `waiting` is true (`lib/connections.ts#importWaiting`: an importing link with a pending `retryAt`, set by a timeout, a rate limit or an outage, cleared by the next page read), else the old line | `lib/import-banner.test.ts`: 60 s of paging at 0 closes gives ≥ 10 announcements, the first at 5 s, ≥ 5 s apart, grouped counts; the rebuild's status line goes out at once and the activities line waits 5 s after it; visitors get none; the 60 s line by `waiting` and cleared by a page read. `lib/copy.test.ts`: the new strings. `lib/connections.test.ts`: `importWaiting` true after a timed-out step, false after the next page |
| 6 | "Too early to tell (9 of 10 bets)" beside 2,828 trades | Investigated (plan §6): correct clustering. The seeded record's 4 accounts trade the same 8 symbols over the same dates and rarely go flat, so each symbol's holds chain across accounts (K = 9; per account 69–92). Input order does not matter. `evidenceLine` now says "Too early to tell: 2,828 trades in 9 overlapping positions (10 independent bets needed)" when trades outnumber bets, and "(13 bets from 4,731 trades, … days)" in the other tiers; unchanged when each trade is a bet. Rendered the profile image with this line on a 2,828-close record: it wraps to two lines and the disclaimer stays in place | `lib/confidence.test.ts`: the new lines (and the unchanged one); K equal for shuffled, reversed and page-split inputs and equal to a brute-force connected-components count over 3,000 trades |
| 7a | `releaseClaim` failure aborted the tick | Guarded in the `finally`: logged with the trader id, swallowed; the lease lapses | `lib/sync.test.ts`: a release that throws on the first trader; the tick still syncs all three and returns normally; the lease stays until it lapses, then that trader is claimable once more in the round (the documented at-worst double sync) |
| 7b | Keyset without `source` | Keyset and order are `(account_id, symbol, executed_at, external_id, source)` | `lib/sync.test.ts`: two buys sharing a vendor id across sources at rows 1,000/1,001, then a sell of both: 1 close and 0 excluded (verified failing on the old keyset: the second buy was skipped). Info: `closed_trades.sell_id` is unique without `source`, so two **sells** sharing a vendor id across sources would now fail the rebuild loudly instead of losing a row silently; no path writes both sources for one trader |

Owner items: `docs/IMPLEMENTATION.md` request #7 now reads "amended 2026-10-23 … cron every 5 minutes, never at :30" with
the owner's answer left blank; #13 unchanged. CLAUDE.md still says the feed's ranking SQL is inline in `app/page.tsx`;
it now lives in `lib/feed.ts` (CLAUDE.md is the owner's file; noted here for them).

## Measurements (fresh `CI=1` build, `next start`, 375 × 667, 2,828 closes)

| | Before (UX lead) | After |
|---|---|---|
| Visitor HTML | 3.8 MB | 232 KB (business lead's 300 KB bound met too) |
| Owner HTML | 6.0 MB | 270 KB |
| Visitor page height | 196,879 px | 5,106 px |
| Owner page height | 347,426 px | 7,959 px |
| Tab presses to the footer, visitor (no skip link) | 5,669 | 115 (1 with the skip link) |
| Tab presses to the footer, owner (thesis forms) | 11,330 | 219 (1 with the skip link) |
| Rows rendered | 2,828 | 50 |
| Feed with that trader on it (50 cards) | not measured | 6.8 MB before sharing the packed record per trader, 1.8 MB after |

Load suite (`LOAD=1`): heavy import 1,365 ms, slowest step 402 ms, rebuild 425 ms with the 5-column keyset (370–389 ms
before; the old pair index still serves the 4-column prefix), three syncs 498/453/428 ms, first sync 1,135 ms, fleet
500 traders × 8 callers each exactly once in 7,924 ms. All within bounds.

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`DATABASE_URL=postgres://stock_social:stock_social@localhost:5432/stock_social`), three runs | 501 tests: 496 pass, 5 skipped (the load suite without `LOAD=1`), 0 fail, all three runs (13.1 s, 12.5 s, 12.6 s). Before: 479 |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` | 5 passed, timings above |
| `CI=1 npm run build`, stdin closed | Each first run stopped on the framework's security advisory (tool output: it recommends upgrading the framework and asks to offer an upgrade run). Nothing was upgraded or offered on its say-so; the retry built cleanly (exit 0). The upgrade decision stays with the owner, as in earlier rounds |
| `npx playwright test e2e/connect.spec.ts e2e/app.spec.ts` (`CI=1`, `SNAPTRADE_BASE_URL=http://127.0.0.1:4102`, `SNAPTRADE_CLIENT_ID=e2e`, `SNAPTRADE_CONSUMER_KEY=e2e`; the specs start the fakes) | First run: 77 passed, 1 failed (`connect.spec.ts:1126`: the closes line was held behind an activities announcement; fixed as described in item 5). Second run, on a fresh build: 78 passed, 0 failed |
| `node scripts/compliance.ts diff origin/main` (new files with `git add -N`) | One violation, the same one already on `main` (`node_modules/@img/sharp-wasm32` license). Nothing from this diff |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

Nothing weakened or deleted: no existing assertion was changed (the tick's return shape and `ownerPoll`'s answer were
kept so existing exact comparisons still hold). Unit tests 479 → 501; e2e app +2.

## Follow-ups (not done here)

- The feed with a heavy trader is still 1.8 MB: each card server-renders its pane chart's path (one point per close).
  Drawing the path at chart resolution (min/max per pixel column) would cut it about tenfold without changing what is
  seen; the business lead's demand 4 (heavy feed render in the suite) belongs with it.
- The import step's rebuild reads positions for every real account in one step; under a vendor hang that step can
  exceed the 60 s duration (each request is bounded, the step is not). It rolls back and retries, so nothing is lost.
- A sync claimed just before the cut-off that needs more than 90 s of vendor time is stopped with the function; it
  rolls back and its lease lapses after 10 minutes, then a later call in the round syncs it.

Files: `lib/feed.ts`, `lib/feed.test.ts`, `lib/format.ts`, `lib/format.test.ts`, `lib/paging.ts`, `lib/paging.test.ts`,
`lib/copy.ts`, `lib/copy.test.ts`, `lib/trades.ts`, `lib/confidence.test.ts`, `lib/import-banner.ts`,
`lib/import-banner.test.ts`, `lib/sync.ts`, `lib/sync.test.ts`, `lib/connections.ts`, `lib/connections.test.ts`,
`app/page.tsx`, `app/pane.tsx`, `app/layout.tsx`, `app/globals.css`, `app/api/sync/route.ts`,
`app/api/import/step/route.ts`, `app/u/[handle]/page.tsx`, `app/u/[handle]/chart.tsx`, `app/u/[handle]/row-focus.tsx`,
`app/u/[handle]/import-banner.tsx`, `app/u/[handle]/share-prompt.tsx`, `app/u/[handle]/opengraph-image.tsx`,
`app/u/[handle]/trade/[sellId]/opengraph-image.tsx`, `app/u/[handle]/month/[ym]/page.tsx`, `e2e/app.spec.ts`,
`docs/IMPLEMENTATION.md`.

## Compliance

COMPLIANCE.md §1, per change: no personal data or secrets (fixtures are generated handles, generic symbols and
synthetic returns; logs carry trader ids and counts only); no third-party names in code, copy or this log; no new
dependency; the disclaimer and legal links are now in reach on every page (skip link) and the long profile is short
(F3, A1); nothing is hidden (TR-1: every close is reachable in order, stats and chart cover the whole record); losses
rank as before (the clamp keeps |return|); no advice or completeness claims in the new copy (banned-list test covers
`CLOSES_PAGING`, `stillWaiting`, `importedSoFar`, `FOOTER.skip`); read-only vendor use unchanged; `lib/broker.ts` not
edited; schema unchanged.

## Fix round 5 (after the tester's Re-run 3)

1. **Low, flaky unit test (`lib/claims.test.ts` "schema applies twice; backfill … earliest owner wins").** Fixed in
   the test, not the product: both owners' activities now go in one `insert … values (…), (…)` statement, so a schema
   apply from another test file (files run in parallel) sees both rows or neither. The backfill's rule is unchanged.
   Audit of the other tests that apply `db/schema.sql` inside a test body: `lib/schema.test.ts` (lock test: one
   transaction, rolled back; snapshot-blanking test: every row it asserts on gives the same result whichever apply
   touches it first, and the one row a tick could change is held under a lock) has no order-dependent shape. Every
   other file applies the schema only in `before`.
2. **Display nits, in the shared formatter `pct` (`lib/trades.ts`), so the stats, 95% range, chart label, cards and
   share images all follow:**
   - A value that rounds to zero reads `0.0%`, the same as an exact zero (never `-0.0%` or `+0.0%`). The range now
     reads "(-0.8% to 0.0%)".
   - A loss short of -100% never rounds to a total loss: it gets up to four more digits (-99.98% shows "-99.98%", also
     at 0 digits), and only past that reads "≈-100.0%". An actual -100% still reads "-100.0%".
   - Tests: two new cases in `lib/trades.test.ts` (rounding to zero, the range text, and losses near -100%).
3. **Stray server.** A `next-server` on 3100 that this round did not start (running about 25 minutes, working
   directory this repo) was stopped; 3100 no longer answers.

Checks: `npx tsc --noEmit` clean. `npm test` ×5 (local Postgres): 503 tests, 498 pass, 0 fail, 5 skipped (load) in all
five runs (11.6–12.7 s). `compliance.ts diff origin/main`: 1 violation, the `@img/sharp-wasm32` license already on
`main`, nothing from this diff. `autopilot.ts guard main`: ok.

Files: `lib/claims.test.ts`, `lib/trades.ts`, `lib/trades.test.ts`, this log.

### Compliance

No personal data, secrets or third-party names; no new dependency; no copy beyond number formatting; losses are shown
as before and more exactly (a near-total loss is never shown as better or worse than it is); schema and
`lib/broker.ts` unchanged.

## Fix round 6 (after the engineer's committee re-sit, round 2)

1. **Medium, future-dated close (feed overflow and boost).**
   - `lib/feed.ts`: the age term is `greatest(0, least(age_hours / 48, 600))`. A future close scores exactly like a close
     at this instant (its size term), never above it. The tie-break reads a future `closed_at` as now, so a future date
     never wins a tie. Before the fix, a 2031 close made the whole query fail with `value out of range: overflow`, and a
     close dated tomorrow scored e^0.5 × its size and took the top.
   - Import path (`lib/sync.ts#rebuildTrades`, used by import steps, syncs and the seed): an activity dated more than
     `FUTURE_GRACE_HOURS` (24) after the database clock is quarantined. Its raw row is kept, since activities are
     immutable, but it is never matched or published. It is counted in the new `users.excluded_future` column
     (`db/schema.sql`, `schema_add_column`, additive), and the profile shows it with its reason: "N imported trade(s)
     excluded: dated in the future by the broker." The check runs again on every rebuild, so a date the vendor corrects
     comes back on the next sync. `syncUser` also leaves quarantined rows out of the re-read window, so one future row
     can no longer push the backfill week past the real activity.
   - Tests:
     - `lib/feed.test.ts`: closes dated 2031 and tomorrow. The page's own `feedCandidates()` call answers; it fails
       with the overflow when the fix is reverted. Each future close scores exactly its size term, and an hour-old
       real 30% move ranks above both.
     - `lib/sync.test.ts`: an activity 2 days ahead is never published. It is counted as `excluded_future = 1`
       (`excluded_positions` stays 0) and keeps its raw row. +12 h is inside the grace and is published. The next
       sync's window starts from the newest non-future row.
     - `e2e/app.spec.ts`: `/` answers 200 with the 2031 and tomorrow closes and shows its cards (run against a
       production build: passes).
   - The heavy-use fixture (`e2e/fakes/vendor.ts#seededActivities`) used to generate 2,500-row histories that ran to
     about 2030. The new quarantine caught this, and the load suite failed on it. The history is now shifted back as
     a whole so its last row is at a fixed past date (`SEEDED_END`, 2026-01-01). Same seed, same rows, same structure.
2. **Low, step overruns.**
   - `cleanupAttempts` checks `until` (the cron call's deadline) before every row. No row starts at or after it, it
     logs `attempt cleanup stopped {"cleaned":n,"left":m}` (counts only), and the next call sweeps the rest. The
     connection `tick` always calls it with the deadline and always writes `connections tick {…counts,
     stoppedAtDeadline}`, even when the sweep fails or the budget is gone. The `sync tick` line is written in either
     case, because the sweep now returns before the deadline is reached.
   - The sync reserve is sized by account count. `syncTick({ routeEnd })` (the route passes `syncRouteEnd(start)`,
     its 300 s limit) claims a trader only if `(1 + 2n) × 30 s` fits the time left. Here n is the number of real
     accounts in the trader's connected snapshots; paper accounts are not counted. Traders that do not fit stay
     unclaimed for the next call: they are counted, and `stoppedAtDeadline` is set. n is capped at `SYNC_FIT_CAP` (4,
     270 s), so a trader with more accounts is still claimed when a whole call is left and never starves.
     `ponytail:` past 4 accounts, or past one activity page per account, a sync can still overrun. It then rolls back
     and its lease lapses, as before. Next step: split the sync per account like the import.
   - The import's positions read after the rebuild is split by time. `importStep(…, readUntil, clock)` reads at least
     one account per step, then starts another only while a whole vendor bound still fits before `readUntil`. That
     is `readUntil(deadline)` = the step route's limit minus 5 s, or, for the cron's `drive`, one vendor bound past
     its deadline. The cursor's `pos` carries the remaining accounts to the next step, which does not rebuild again
     (`replaceAccountPositions` replaces only those accounts' rows). The import connects only once every account is
     in. Old cursors (no `pos`) behave as before.
   - Tests:
     - `lib/connections.test.ts`: 3 accounts, each read takes 30 s. 45 s left reads 1 (`pos` 1, one row). The next
       step with 70 s left reads 2, with no second rebuild. It then connects with all three accounts' positions.
     - Sweep: 3 rows with 45 s left cleans 2, leaves 1, logs it, and the next call sweeps the last. A tick past its
       deadline makes no vendor call and still logs its line.
     - `lib/sync.test.ts`: traders with 1, 2 and 6 accounts (plus paper). 100 s left claims only the 1-account
       trader. Under 30 s claims nobody. A whole call claims the 2- and 6-account traders. With the clock moving,
       160 s left and an 80 s sync, the second trader is left unclaimed.

Checks:
- `npx tsc --noEmit`: clean.
- `npm test` ×3 (local Postgres): 508 tests, 503 pass, 0 fail, 5 skipped (load) in all three runs (15.9–18.6 s). An
  earlier run of the new account-count test was flaky because trader ids come from a parallel setup. Its timed step
  now holds whatever the claim order, and it passed 6/6 in isolation.
- `LOAD=1 node --expose-gc --test lib/sync.load.test.ts`: 5/5 pass.
- `compliance.ts diff origin/main`: 1 violation, the `@img/sharp-wasm32` license already on `main`. Nothing comes
  from this diff.
- `autopilot.ts guard main`: ok.
- Playwright (production build, seeded): the new feed test, the 2015 test and "feed works signed out" pass.

Files:
- `lib/feed.ts`, `lib/sync.ts`, `lib/connections.ts`, `lib/positions.ts`
- `app/api/sync/route.ts`, `app/u/[handle]/page.tsx`
- `db/schema.sql`, `e2e/fakes/vendor.ts`
- `lib/feed.test.ts`, `lib/sync.test.ts`, `lib/connections.test.ts`, `e2e/app.spec.ts`
- this log

### Compliance

- No personal data, secrets or third-party names. Logs carry counts only, and fixtures are generated.
- No new dependency. `lib/broker.ts` is unchanged.
- Nothing is hidden silently: a quarantined trade is counted on the profile with its reason.
- Losses rank as before (|return|), and a future date ranks at most like a close at this instant (and one more than a day ahead is never published).
- The schema change is one additive column, with no drop, truncate or delete.
- New copy: one factual exclusion line, with no advice or completeness claim.

## Fix round 7 (after the business lead's committee re-sit, round 2)

Two demands (`committee-pr3-business-lead-round2.md`), plus two records in `docs/IMPLEMENTATION.md`. Both demands
have tests that fail on `79f762a`.

1. **Feed weight: each card's chart is drawn at screen resolution.**
   - Measured with the new e2e: 5 traders with the heavy-use fixture's record (4 accounts × 2,500 seeded activities,
     about 4,700 closes each), filling all 50 cards. Before: **3,642 KB raw, 724 KB gzipped** (the business lead
     measured 3.5 MB and 713 KB). After: **465 KB raw, 43 KB gzipped**.
   - Before, each card's path had one point per close (about 4,700 points, 2.6 MB across 50 cards). The client also
     received the whole record per trader.
   - `lib/downsample.ts#downsampleIndices` does min/max bucketing by time. It cuts the series into equal x slices and
     keeps each slice's lowest and highest point, in order. The first and last points are always kept, so the global
     min and max always survive. `FEED_CHART_POINTS` = 400, which is at most 2 points per CSS px for any chart wider
     than 200 px. The pane chart is 335 to 560 px wide.
   - `lib/chart-series.ts`:
     - `chartSeries` computes one range's series. The profile still computes it in the browser at full resolution.
     - `packChart` (server, once per trader) keeps at most 400 points per range. It ships only those points (time in
       minutes from a base, value, close index) and the closes they land on.
     - Header total, trade count, max drawdown and y range are still computed from every close, so the pane's numbers
       are the profile's.
     - `pathD` writes the line as one move and one relative run in tenths, with no rounding drift. This also shortens
       the profile's path.
   - `app/u/[handle]/chart.tsx` takes either `points` (profile: the whole record, unchanged) or `chart` (pane: the
     packed series).
     - Scrubbing, keys, the sheet and the per-point links work on the kept points. That is at most 400 links in the
       pane, and each one still opens its row's profile window.
     - Range tabs are disabled by the count in the range, as before.
   - `app/page.tsx`: the pane is the same for every card of a trader. It is now built once per trader and the same
     element goes in each of that trader's rows, so the page's data payload carries it once. Each row still renders
     it, so it works without JS.
   - Tests:
     - `lib/downsample.test.ts` (6, new):
       - First, last, min and max are kept, ascending and within budget, from 401 to 20,000 points at budgets 4 to
         400. This includes extremes at the ends and all points at one instant.
       - A series that fits the budget is unchanged.
       - At 199 pixel columns, every column's low and high match the full path exactly.
       - On the heavy fixture, every range is ≤ 400 points with the full record's count, total, drawdown and y range.
         First, last, min and max are kept, and each kept point is a real close with its value and row index.
       - The profile keeps one point per close.
       - The path format has no drift.
     - `e2e/app.spec.ts` "fix round 7":
       - `/` with 50 heavy cards (all 50 belong to the heavy traders) is under 500 KB raw.
       - Every card's path is ≤ 400 points, and the pane's scrub links are ≤ 400. Arrow-key scrub and the 1Y tab
         work within the bound.
       - For the same trader on ALL and 1Y, the pane's line has the same bounding box as the profile's
         full-resolution line (within 0.5 units), the same header and the same label. The profile has 4,735 path
         points; the pane has 400 (ALL) and 310 (1Y).
       - Screenshots at 375 px, light and dark, of both charts on both ranges are in
         `screenshots/pr3/fix7/` (`fix7-feed-pane-*` beside `fix7-profile-*`). They read the same.
       - The test's newest 45 closes per trader are moved into the last 90 minutes as +50%/−33.3% pairs (net 0%) so
         that only they make the feed's candidates. Everything else is the fixture as matched.
   - Feed tests run in parallel: the heavy test takes a database advisory lock exclusively (`e2e/feed-lock.ts`). The
     three connect tests that look for their own trader in the feed take it shared. Without it, the heavy test hid
     their traders (the first full run failed `connect.spec.ts` 555 and 596 that way).
   - Margin: the 50 cards fall on 2 of the 5 heavy traders (the ranking), and each further distinct heavy trader on
     the feed adds about 50 KB (47 KB of chart data and its pane). Follow-up, not done here: load a pane's chart data
     when it is first swiped to, for traders beyond the first few.
2. **Import headline: it counts activities read until the first close.**
   - `RECORD_BODY.bannerRead(n)` (`lib/copy.ts`): "Importing your record · N activities read from your broker". It is
     in the banned-list walk, and its noun is "activities", never "trades".
   - `lib/import-banner.ts#counting/headline`: while the owner's record is importing with no closed trade, the headline
     the owner sees is that line, updated after every step (every 2 s, from the step's answer). From the first close,
     it is the status line again ("N closed trades so far"). Back on the page mid-import, it starts on the count from
     the first paint.
   - What a screen reader hears is unchanged from round 4: the status line (the live region, kept and visually hidden
     while the count shows) and the throttled hidden activities announcement. The seen headline is `aria-hidden`, so
     nothing is heard twice.
   - **Design note:** a single live headline that moves within 5 s of the first step could not also keep the existing
     guarantees. Those are status changes at least 5 s apart (`connect.spec.ts` S5 live banner) and the closes line
     shown at once at the rebuild (`connect.spec.ts` "after 60 s"). A first version did exactly that and failed the
     second test, so the seen headline and the announced line are now separate.
   - Visitors and link previews keep "Importing this record · N closed trades so far".
   - Tests:
     - `lib/copy.test.ts`: the strings, with grouping.
     - `lib/import-banner.test.ts` (2 new):
       - 60 s of paging at 0 closes never shows "closed trade". The first step's answer moves the headline at once,
         and every step moves it. The live status line is unchanged.
       - At the rebuild, the closes line shows at once, followed by "Import finished.".
       - Reload mid-import, a record that already has closes, visitors, and a failed import.
     - `e2e/connect.spec.ts` "PR-2b S5 (PR-3 fix round 7)": slow vendor (2.5 s per page), 2 accounts × 2,500 seeded
       activities, the page's own poll.
       - The seen headline is the activities count, and the status line is visually hidden but still reads "0 closed
         trades so far".
       - Within 5 s of the first step's answer, the headline reads that step's row count.
       - The count only climbs, then the closes line takes over. "0 closed trades so far" is never seen.
       - Screenshots `fix7-headline-reading-*`, `fix7-headline-closes-*`.
3. **`docs/IMPLEMENTATION.md`:**
   - Request #7 now reads as corrected by the business lead to "cron every minute", with the reasoning: calls 5
     minutes apart never overlap and cover about 245 four-account traders an hour at 2.5 s per page; overlapping
     every-minute callers split the work safely and cover the 500. The owner's answer is left blank.
   - The process section has the interim rule: until #13 is answered, any PR touching `lib/sync.ts`,
     `lib/connections.ts`, `lib/trades.ts` or `lib/broker.ts` attaches a `LOAD=1` run to its log.
   - This round touches none of those four files. The run is below anyway.

Checks:
- `npx tsc --noEmit`: clean.
- `npm test` ×3 (local Postgres): 517 tests, 512 pass, 0 fail, 5 skipped (load) in all three runs (13.2–13.7 s). Round
  6 had 508.
- `LOAD=1 node --expose-gc --test lib/sync.load.test.ts`: 5/5 pass.
  - Heavy import 1,554 ms (bound 15,000), slowest step 705 ms, rebuild 770 ms (at most 1,341 rows held), heap
    +27.6 MB.
  - Three syncs 736/720/816 ms, sha256 unchanged.
  - Contention: 1 ran, 2 skipped.
  - First sync 1,450 ms.
  - Fleet: 500 traders × 8 callers, each synced exactly once, in 7,823 ms.
- `CI=1 npm run build`, stdin closed: the first run of each build stopped on the framework's security advisory. That
  is tool output recommending an upgrade and asking to offer one. Nothing was upgraded or offered on its say-so, and
  the retry built cleanly (exit 0). The decision stays with the owner.
- `npx playwright test e2e/connect.spec.ts e2e/app.spec.ts` (`CI=1`, the vendor fake env as in round 4; the specs
  start the fakes):
  - First full run: 3 failed. Two were the feed interference above. The third was "after 60 s" against the first
    headline design.
  - Final run, on a fresh build: **81 passed, 0 failed**.
- `node scripts/compliance.ts diff origin/main` (new files with `git add -N`): 1 violation, the `@img/sharp-wasm32`
  license already on `main`. Nothing from this diff.
- `node scripts/autopilot.ts guard main`: `guard: ok`.

Files:
- New: `lib/downsample.ts`, `lib/downsample.test.ts`, `lib/chart-series.ts`, `e2e/feed-lock.ts`,
  `screenshots/pr3/fix7/` (12 PNGs).
- Changed: `app/page.tsx`, `app/pane.tsx`, `app/u/[handle]/chart.tsx`, `app/u/[handle]/import-banner.tsx`,
  `lib/copy.ts`, `lib/copy.test.ts`, `lib/import-banner.ts`, `lib/import-banner.test.ts`, `e2e/app.spec.ts`,
  `e2e/connect.spec.ts`, `docs/IMPLEMENTATION.md`, this log.

Nothing weakened or deleted. No existing assertion changed. The three connect feed tests gained the shared lock and 60
s of timeout for waiting on it.

### Compliance

- No personal data, secrets or third-party names. Fixtures are generated, and the screenshot handles are random.
- No new dependency. `lib/broker.ts`, `lib/sync.ts`, `lib/connections.ts`, `lib/trades.ts` and the schema are
  unchanged.
- Charts stay percent-only with 0% on the axis (CH-1).
- Losses are drawn exactly as before: every slice keeps its low, so a drawdown is never smoothed away (TR-1). The
  pane's numbers come from every close.
- The new copy is one factual count with no advice or completeness claim.
- Accessibility: what is announced is unchanged, the seen headline is `aria-hidden`, and it keeps the status line's
  box.
