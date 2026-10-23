# F-2 PR-1 · Feed mix and paging (tester)

2026-10-23. Branch `claude/adoring-euler-4469ys`, product code at `cd355aa`. Later commits on the branch (`e518d20`,
`512abda`, `11cd0cd`) change docs only; `git diff cd355aa HEAD -- app lib e2e scripts db` is empty. Postgres 16.
No product code changed.

## 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed | Clean both times, idempotent. The diff adds no schema, drop, truncate or delete from. |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | 547 tests: 541 pass, 6 skipped (load), 0 fail every run (18.0–18.9 s) |
| Test count | `origin/main` 520 → 547 (+27). `e2e/app.spec.ts` 46 → 50 (+4). None removed. |
| Weakened? | No. The only removed assertions are in the heavy-feed test: one 50-card page became three 30-card pages. Each page keeps the same bounds (< 500 KB, ≥ 10 distinct heavy traders), and caps across the joins were added. The page size is the plan's. |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` | 5/5 (fleet 10,353 ms, bound 60,000) |
| `LOAD=1 … lib/feed.load.test.ts` ×3 | 1/1 each. p95 337, 132 and 134 ms (bound 400). Run 1 followed the sync fleet. |
| `CI=1 npm run build`, stdin closed | Run 1 stopped on the framework's security advisory. That is tool output; nothing was upgraded. Retry: exit 0. |
| `npm run test:e2e` ×2, isolated database, a fresh server each run, vendor fake configured | **97 passed, 3 skipped, 0 failed**, both runs (4.5 and 4.4 min). Skips: the sign-in provider and email-sink tests. |
| Heavy-pane and pane e2e (`app.spec.ts:959`, `:120`) ×4 each | 8/8 pass: the F-1 chart race fix (layout effect) holds |
| `node scripts/compliance.ts diff origin/main` | 1 violation, already present: `@img/sharp-wasm32` license. Nothing from this diff. |
| `node scripts/autopilot.ts guard main` | ok |

About the e2e environment:

- A concurrent session wrote its own traders into the shared database during my first two e2e runs. Those runs failed
  7 and 8 feed-dependent tests, because the feed's page 1 held none of the expected cards.
- A harness slip of mine also left run 1's server holding port 3000, so run 2 reused it. That explains the
  vendor-framing failure: the probe answer is cached per process.
- Neither failure comes from the product. I re-ran both e2e passes against a database of my own (demo seed only), each
  on a fresh server. Those are the results in the table.
- This container runs Node 22.22. `CLAUDE.md` asks for Node 24 or later. Everything above ran on 22.22.

## 2. Measurements

The user walk ran on my own server (port 3217) against an isolated database, with the vendor fake on 4217.

| Measure | Budget | Result |
|---|---|---|
| Raw HTML per page, 50 heavy traders × 4,700 closes, 5 fresh closes each | ≤ 500 KB | Pages 1 to 7: **219, 225, 230, 229, 234, 224, 142 KB** (gzipped 15–22 KB), with 8–14 distinct traders per page |
| Raw HTML, worst case: 50 heavy traders with **one** fresh close each, so a page holds many distinct heavy panes | ≤ 500 KB | Page 1: **305 KB** with 27 distinct heavy traders; pages 2 to 7: 293, 279, 268, 291, 286, 195 KB. Within budget (1.64× headroom). |
| e2e heavy fixture (50 heavy) | ≤ 500 KB | 237 / 255 / 267 KB, 13 / 16 / 18 distinct traders (both runs) |
| Signed-out server time, the engineer's fixture (500 traders, 12 heavy) | p95 < 400 ms | `loadFeedPage` p95 **430 ms** (median 317). Full HTTP response, render included, 60 pages: p95 **634 ms** and **518 ms** (medians 416 and 385). Another session's browser was using the CPU, so these numbers carry noise. The quiet load-suite runs gave 132–337 ms on the data path. |
| Signed-out server time, 50 heavy traders | p95 < 400 ms | `loadFeedPage` median **1,394 ms**, p95 **1,835 ms**. HTTP 1.4–2.2 s per page over 3 rounds. **Defect 3.** |
| Same, worst case (one fresh close per heavy trader, 53 candidate traders) | p95 < 400 ms | `loadFeedPage` median **1,830 ms**, p95 **2,741 ms**. HTTP 2.2–3.6 s per page. **Defect 3.** |
| Card at which the next page is requested | card 25 | **card 24** at 360×640, 375×800 and 1280×800 (defect 4), then 54, 84, … |
| Requests in flight | 1 | max **1** (card-by-card walk, 40 fast flings with a 700 ms slower server, End key) |

## 3. The feed as a user (signed out unless stated)

Fixture: 120 traders × 6 closes plus the demo seed, so the list is 200 cards.

| Check | Result |
|---|---|
| Page size | 30 cards on page 1, then 30 per append |
| Whole list, JS, read card by card (375 light, 375 dark, 1280 dark) | 200 cards, 200 distinct, equal in order to `feedList` at the cursor's `asOf`. One request at a time, then the end card. |
| Diversity across joins | Worst window over all 200: 2 per trader, 2 per symbol. Each of the 6 joins checked separately: ≤ 2 / ≤ 2. |
| Exploration | 40 of 200 picks, 6 on page 1, and at least 2 in every sliding window of 10 |
| No JS | "Show more" is reachable by keyboard (focus + Enter). 7 pages (30 × 6 + 20), 200 distinct, equal to the list at its `asOf`. Every `?after=` page is `noindex`; page 1 is not. |
| JS on a `?after=` page | Page 2 is server-rendered; page 3 appends at its card 24 |
| Tampered or garbage cursors | 16 kinds served page 1 with status 200: garbage, empty, 3,000 bytes, padded, 49 h old, an hour ahead, offset 31, offset 210, offset −30, wrong day, an extra key, a float `asOf`, a string offset, `__proto__`, SQL-like text, non-ASCII. A repeated `after` gives 200. A valid cursor serves page 2. |
| Stale cursor sent to the action (49 h old, rewritten in flight) | "Load today's feed" linking to `/`, 44 px (`stale-375-light.png`) |
| Retry (POST blocked) | "Couldn't load more. Retry", `role="status"`, button 70 × 44 px, light and dark. No request fires while in error. A second failure keeps the line. Retry by keyboard appends 30 and the line goes. **But see defect 1** for where the reader lands. |
| End card | "End of today's feed." and "Publish your trades" (→ `/login`, 179 × 44 px), at 375 and 1280, light and dark. No completeness word. |
| Losses ranked like gains | Two traders with 5 closes each at +45% and −45%, closed at the same minutes. Positions: loss 1, 4, 11, 14, 21 and gain 2, 5, 12, 15, 22, interleaved. Scores are equal to the 5th decimal (the loss was inserted a second later). The walk showed 100 losses in 200 cards. |
| Signed in vs signed out | A dev-signed-in viewer's page 1 and appended page 2 are identical to the signed-out pages 1 and 2 |
| Disclaimer | Present on the feed, once ("Not investment advice. Past performance does not guarantee future results. …") |
| Demo-only feed | 6 cards (dividend_dan ×2, yolo_yuki ×2, momentum_maya ×2, each with the Demo badge), then the end card. No request. 375 and 1280, light and dark. |
| Server log | No error or warning over the whole walk |

## 4. Edge cases

- **0 traders.** "No trades yet" with the seed hint. A garbage cursor gives 200.
- **1 trader with 10 closes.** 2 cards, then the end card (the caps; see note 5).
- **A trader deleted between pages.** It does not error, and the deleted trader's cards don't appear after page 1. But
  cards repeat (defect 2):
  - In the browser, one page-1 trader soft-deleted after page 1 gave 200 cards shown but 194 distinct: 6 cards seen
    twice.
  - In data (scratch test, 60 traders, pages 1 to 3), a soft or hard delete gave 1 repeat and 14 cards skipped.
- **A future-dated close** (+20 h, +350%) does not break the feed: status 200, and it is not on the feed. The profile
  shows it.
- **A close imported after `asOf` but dated before it** is the hourly sync's normal case. 8 trials, each a different
  trader, gave 0 to 3 repeats and 0 to 11 skips in 90 (defect 2).
- **A rebuild between pages** (rows deleted and reinserted with new ids): 0 repeats, 0 skips. The `sell_id` tie-break
  works.
- **A second import starting (TR-3) between pages:** 1 repeat and 11 skipped.
- **Caps across a churned join:** they held in every scenario above (worst 2 / 2).

## 5. Regressions

- **Trust rule.** Demo cards carry Demo and never Verified. The e2e TR-3 tests pass: a failed import says "may be
  incomplete" with no Verified badge, and an import still running is omitted.
- **Consent gating.** The e2e tests pass: nothing public while waiting on consent, and the S8 line only after.
- **Pane.** SW-1 → and ← work on appended cards (e2e). The heavy pane loads its chart on first open (4/4).
- **Profile paging.** The 2,828-close profile test passes.
- **F-1 chart race** (`chart.tsx`, layout effect). 8 of 8 targeted repeats and both full runs pass.

## 6. Defects

1. **High · bug · `app/feed-pager.tsx` with `.feed-more`: an append from the control skips the appended cards, in a
   chain.** This confirms the business lead's blocker 1 and the UX lead's page-join jump, with numbers.
   - What happens: the new rows are inserted above the control. Scroll anchoring keeps the control in view. The
     observer (it watches the control too) fires again, and so on.
   - Reproduction 1, 375 × 800, light and dark: block the POST, scroll to card 25, scroll the error line into view,
     unblock, tap Retry. The feed loads all 200 cards in 7 requests, and the reader is left at **card 180**. Cards 31
     to 179 were never in view (`after-retry-375-*.png`).
   - Reproduction 2: a jump straight to the control (End, a fling, or a reader faster than the server), with 1.5 s per
     request. 4 requests in 4 s, and the reader lands at **card 120** (`after-jump-375-*.png`).
   - With defect 3 (1.4–3.6 s per page with heavy candidates), a reader at normal pace reaches the control while the
     request is in flight, so this is not limited to Retry.
   - Fix (engineer's choice): `overflow-anchor: none` on the control, or insert the rows after the reader's position.
     Load only from a card the reader has reached, never from the control alone.
2. **Medium · bug · `lib/feed.ts` / `lib/discovery/pager.ts`: cards repeat (and vanish) across joins whenever the data
   changes between pages.**
   - `asOf` filters `closed_at` only. A close imported after `asOf` but dated before it, a deleted trader, or an import
     starting all change the candidate set.
   - One change shifts the pool outside the top 30. The seeded shuffle then permutes a pool of a different length, so
     the exploration picks change everywhere.
   - Measured: up to 3 repeats and 11 skips in 90 (data), and 6 repeats in a 200-card session (browser).
   - The hourly sync imports closes dated before the time it runs, so any session longer than a sync step can hit this.
   - The engineer's known-limits section says "no card repeats in either case". That is not so.
   - Fix (engineer's choice): freeze on what existed at `asOf` (insertion time as well as `closed_at`), or have the
     client drop a card it already shows. Either way, add a test that inserts a close dated before `asOf` after page 1.
3. **Medium · spec (plan §4 budget) · signed-out server time with heavy candidates is 3.5–7× the budget.**
   - With the plan's own heavy fixture (50 heavy traders): `loadFeedPage` p95 1,835 ms; HTTP 1.4–2.2 s per page.
   - Worst case: p95 2,741 ms; HTTP up to 3.6 s.
   - Cause: every page loads the full record of every candidate trader, for TR-9, which the engineer names in known
     limits.
   - At the engineer's fixture (12 heavy), the data path passes (132–430 ms). The full HTTP response, render included,
     measured p95 518 and 634 ms on this shared machine. Re-measure that on a quiet machine.
   - The load suite covers only 12 heavy traders. Heavy traders are the ones with fresh closes, so a production feed's
     candidates lean heavy.
   - The plan's fallback (`feed_key` plus an index), or weights computed once per list instead of per page, is the next
     step. Add a 50-heavy case to `lib/feed.load.test.ts`.
4. **Low · spec · `app/feed-pager.tsx`: the next page is requested at card 24, not card 25.**
   - When card 24 snaps into view, card 25's top edge touches the feed's bottom edge. An edge-adjacent intersection
     counts, so the request fires one card early.
   - Seen at 360, 375 and 1280. The e2e checks cards 20 and 25 only.
   - Fix: a `threshold` above 0 or `rootMargin: '0px 0px -1px 0px'`.
5. **Note · usability.** The demo-only feed is 6 cards, each demo trader's two cards back to back. One trader with 10
   closes shows 2. This is the plan's "never relax a cap", already flagged to the UX lead.
6. **Note · harness.** Every e2e run rewrites `docs/features/logs/F-2/screenshots/pr1/`, the engineer's evidence. My
   runs changed 7 files; I restored them with `git checkout`.

## 7. Cleanup

- I created no product data in the shared database. The user table matches its pre-run list (87 users).
  - The 70 users that two mis-routed e2e runs left there (server on the shared database, spec cleanup on the isolated
    one) were deleted by id, all created between 12:25:52 and 12:32:57.
- My isolated database (with its fixtures, the `tstr_viewer` user and the e2e leftovers) was dropped.
- My servers (3000, 3217) and the vendor fake (4217) are stopped. The engineer's `pr1/` screenshots are restored.
- Screenshots are in `screenshots/pr1-test/`:
  - card 30 and 31 (375 light and dark, 1280 dark);
  - the end card after a full walk (375 light and dark, 1280 dark);
  - the demo-only end card (375 and 1280, light and dark);
  - no-JS Show more;
  - Retry (light, dark), stale, after Retry and after a jump (light, dark).

Verdict: DEFECTS (1 High, 2 Medium, 1 Low, 2 notes)

## Re-run 1

2026-10-23. Branch `claude/adoring-euler-4469ys` at `8f1b88f` (the engineer's fix round 1). Postgres 16, Node 22.22.
Everything ran on my own database. The build, the e2e runs and my server ran from a copy of `HEAD` outside the repo, so
the e2e did not rewrite any committed screenshot. No product code changed.

### 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed | Clean both times. The new `activities_created` index is created once and skipped the second time. No drop, truncate or delete from. |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | 555 tests: 548 pass, 7 skipped (load), 0 fail, every run (16–17 s) |
| Test count | 547 → 555 (+8); e2e 100 → 102 (+2). Nothing removed. |
| Weakened? | No. The property test's per-slot rule now prefers another trader than the previous card's. It still names one exact card for every slot. The load test was split into a fixture and a measure; the 12-heavy case keeps its fixture, bound and assertions. |
| `LOAD=1 … lib/sync.load.test.ts` | 5/5 (fleet 9,989 ms, bound 60,000) |
| `LOAD=1 … lib/feed.load.test.ts` ×5 | 2/2 every run. Quiet machine (runs 4, 5): 12 heavy p95 154 and 188 ms; **50 heavy p95 287 and 294 ms**; cold page 1 490 and 532 ms. Runs 1–3 shared the CPU with another session's browser and servers: 50 heavy p95 305, 312 and 386 ms (page 1 alone up to 538 ms). |
| `CI=1 npm run build`, stdin closed | Run 1 stopped on the framework's security advisory. That is tool output; nothing was upgraded. Retry: exit 0. |
| `npm run test:e2e` ×2, own database, fresh `next start` each run, vendor fake configured | **99 passed, 3 skipped, 0 failed**, both runs (4.6 and 4.2 min). The skips are the sign-in provider and email-sink tests. |
| `node scripts/compliance.ts diff origin/main` | Only the existing `@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | ok |

### 2. My first report's defects

| # | Then | Now |
|---|---|---|
| 1 High, the page-join chain | Retry left the reader at card 180; a jump left them at card 120 | **Closed** when the page arrives with the reader at the control (table 3). One new case is defect B below. |
| 2 Medium, repeats and skips across joins | Up to 3 repeats and 11 skips in 90 | **Closed** for late imports, soft deletes, imports starting and rebuilds, on both paths. An outright delete on another server still shifts the list (defect D). |
| 3 Medium, server time with 50 heavy traders | `loadFeedPage` p95 1,835 ms | Data path passes (287–294 ms). The full response is still over budget (defect C). |
| 4 Low, request at card 24 | card 24 | **Closed**: card 25 |

### 3. The feed as a user

Fixture A: 120 traders × 6 fresh closes plus the demo seed, so the list holds 200 cards. Signed out unless stated.

| Check | Result |
|---|---|
| Request point | 360×640, 375×800, 390×844 and 1280×800: **no request at card 24, one at card 25**; page 3 at card 55, not at 54 |
| Retry (POST blocked, then a 1.2 s server) by keyboard and by click, light and dark | 1 failed request, **0 while in error, exactly 1 for Retry**. The button reads "Loading…" and keeps focus meanwhile. After 3 s: 60 rows, **card 31 at the top**, focus on card 31's name (keyboard and click), live line "30 more trades loaded". Reading on: page 3 at card 55, once. A synthetic tap gives the same result, with focus left where it was. |
| Jump while page 2 is held (End key, a 60-event wheel fling, a 40-frame programmatic fling; 375 light and dark, 1280 dark) | **1 request** each. The control reads "Loading…" with `aria-busy="true"`. Two more End presses while held add nothing. After release: 60 rows, **card 31 at the top**, no further request in 3 s. |
| End, held, release, repeated to the end of the list | 6 requests for 6 pages, one each. Last live line: "20 more trades loaded". End card shown. But see defect B for where the reader stops. |
| Steady reader (PageDown every 650 ms, server 1.5 s per page), 375 and 1280 | 6 requests. Every card from 2 to 200 came into view in order; no backward move. 200 distinct cards, then the end card. |
| Reader at the control when a fast page arrives | **Defect B.** End key or a smooth scroll to the end, with the server answering in 0 to 500 ms: the reader stops between cards 30 and 31, unsnapped (4 of 4 hold times, light and dark, 375 and 1280). With 800 ms or more: card 31 at the top. |
| End card by viewer (375 light and dark, 1280 dark) | Signed out and a signed-in member with no record: "Publish your trades". A signed-in publisher: **"See your record"**. Only one is visible each time, 44 px high. Both go to `/login`, which takes a signed-in viewer to their own profile. `<body data-viewer>` reads guest, member and publisher. |
| No JS, 7 pages by keyboard | Page 1 has no `h1`. Pages 2–7 have the hidden headings **"Trades 31 to 60" … "Trades 181 to 200"**, and all are `noindex`. 200 cards, 200 distinct, then the end card. |
| Regressions | Card 40 (appended): → opens the pane with its chart and stats, ← returns. 59 Verified cards and 1 Demo card; none has both. The disclaimer is in plain view. No page errors. The 4,700-close profile pages by 50 (`?closes=100`) with its chart. Consent, TR-3, the pane, profile paging and the F-1 chart race are covered by the e2e, which passed twice. |

### 4. Variety (skewed fixture)

Five fixtures, each read on five days. Each has 5 hyperactive traders (60 closes each, last 20 h, |r| ≤ 8%) and 55
ordinary traders (6–20 closes over 30 days, |r| ≤ 25%), with mixed signs.

| Measure | Result |
|---|---|
| Traders among the 200 candidates | **57–61** (≥ 33). At most 6 per trader. |
| The 5 hyperactive traders' share of the list | **15%** (30 of 199–200) in all 25 lists. On page 1: 1–7 cards. |
| Exploration picks that are new traders, first 120 cards | **24 of 24 in all 25 lists** |
| The same, whole list | 24–29 of 40 (60–73%). This is the engineer's deviation 1: by card ~120 every candidate trader is already in the list. The business lead decides. |
| One trader twice in a row | 0 in all 25 lists |
| Most cards of one trader in any 30 | 6 |

### 5. Data changes between pages

I ran each case through `loadFeedPage` twice on fixture A. "Kept" means the same server; "recomputed" means the kept
list is cleared before every later page, as on another server. The reference is the list read page by page just
before the change.

| Change after page 1 | Kept | Recomputed |
|---|---|---|
| A +350% close dated 10 min before `asOf`, imported after it, for the trader at position 101; and a new trader whose 6 closes are all late | 0 repeats, 0 skips, 0 new cards, order unchanged | same |
| The trader at position 71 soft-deleted | Their 3 later cards leave gaps; nothing else moves | same |
| An import starts for the trader at position 96 | 1 card leaves a gap; nothing else moves | same |
| A rebuild of the trader at position 51 (rows reinserted with new ids) | unchanged | unchanged |
| The trader at position 41 deleted outright | Gaps only | **3 repeats, 3 skips, 3 cards from outside the list** (defect D) |
| All of the above together | Gaps only | 3 repeats, 3 skips, 2 new cards (from the outright delete) |

- A later page 1 includes all 7 late cards.
- In the browser, across a server restart after an outright delete, the client dropped every repeat (0 shown). But 10
  of the 136 remaining cards were skipped, and 4 cards from outside the list appeared.

### 6. Performance (quiet machine, load average about 1; my server only)

| Measure | Budget | Result |
|---|---|---|
| Full HTTP response, signed out, **50 heavy** × 4,700 closes, 5 fresh each; 3 server starts × 20 rounds × pages 1–3 (180 pages) | p95 < 400 ms | **p95 473 ms**, median 344. Page 1 p95 502, page 2 399, page 3 141. **Cold** first page: 956, 1,020 and 1,059 ms. |
| Same, worst case (1 fresh close per heavy trader) | p95 < 400 ms | **p95 569 ms**, median 95. Page 1 p95 602. Cold: 1,028–1,079 ms. |
| Same, 12 heavy (the original fixture) | p95 < 400 ms | p95 **320 ms**. Cold: 656–696 ms. |
| Data path (`loadFeedPage`, the LOAD suite) | p95 < 400 ms | 50 heavy: **287 and 294 ms**. 12 heavy: 154 and 188 ms. |
| Raw HTML per page, pages 1–7 | ≤ 500 KB | 50 heavy: 219–334 KB (gzipped 21–30), 16–27 traders a page. Worst case: 191–346 KB. 12 heavy: 187–328 KB. |
| Cursor page with no kept list after many recent imports (50 heavy, cursors 1, 12 and 47 h old) | – | 0 imports: 159–1,105 ms. 50,000: 352–808 ms. 100,000: 463–789 ms. **150,000: over 180 s twice (aborted), 129 s once** (defect A). |

### 7. Defects

A. **High · bug · `lib/feed.ts` (`late`): a cursor page with no kept list takes minutes once ~120,000 activities have
   been imported since the cursor's `asOf`.**
   - `sell_id not in (select external_id from late)` becomes a hashed subplan only while the late set fits in
     `work_mem` (4 MB by default). Above that, Postgres rescans the whole late set for every candidate row.
   - EXPLAIN, 150,000 late activities, 814 closes: `Materialize (actual rows=150000 loops=814)`, **14.0 s**. With
     `work_mem` 64 MB the same query is a hashed subplan: 129 ms.
   - Data path, fixture A, page 2 with no kept list:

     | Late activities | Page 2 time |
     |---|---|
     | 20,000 | 94–186 ms |
     | 60,000 | 293–333 ms |
     | 100,000 | 372–491 ms |
     | 150,000 | **7.6–32 s** |
     | 300,000 | **14–64 s** |

     Over HTTP with 50 heavy traders, see section 6. The `weights()` miss query uses the same `not in`.
   - Who hits it:
     - Every page 2 or later served by a process that did not serve that cursor's page 1: another instance, a
       restart or a deploy.
     - Every crafted `?after=`. The cursor is public JSON, and each new `asOf` misses the kept list. So one visitor
       can hold a database backend for minutes per request.
   - When: one trader's first import is up to ~10,000 activities (the sync load fixture). So about 12–15 first imports
     within a cursor's 48 h lifetime are enough.
   - Fix (engineer's choice):
     - an anti-join (`not exists`, or a left join with `is null`) instead of `not in`; it plans as a hash anti-join
       that spills to disk instead of rescanning;
     - and/or read the late set only for the candidate sell ids.

     Either way, add a load case with ≥ 150,000 activities imported after `asOf`, on a page with no kept list.
B. **Medium · bug · `app/feed-pager.tsx`: with a fast server, the End key leaves the reader between cards 30 and 31,
   unsnapped.**
   - What happens:
     - During the smooth scroll to the end, card 25 passes and page 2 is requested.
     - The page arrives while the scroll is still running, before the control is in view. So there is no pin, which
       is correct.
     - The scroll then finishes at its first target, the old end (scrollTop 23,520 at 375×800).
   - The reader sees card 30's lower 480 px over card 31's first 320 px. Card 30's "−45.8%" and "No thesis posted"
     sit directly above card 31's "T a15 ✓ Verified" (`end-key-fast-server-375-{light,dark}.png`,
     `chain-end-375-light.png`). A return reads as if it belonged to the next trader.
   - Measured with the server held 0, 150, 300 and 500 ms: the reader stops there every time (light, dark, 375,
     1280). With 800 ms or more: card 31 at the top.
   - Page 2 normally answers in 100–400 ms, so this is the usual End-key case on a desktop. The fix round's e2e holds
     the request until the scroll has ended, so it cannot see this. Seen in headless Chromium.
   - Fix (engineer's choice): when a scroll comes to rest inside the join at no card's top (`scrollend`), snap to the
     nearest card, or pin then. Test it with the request released before the scroll ends.
C. **Medium · spec (plan §4, "signed-out feed server time p95 < 400 ms") · the full response with 50 heavy traders
   is over budget.**
   - Full response: p95 473 ms; 569 ms in the worst case. Page 1 p95: 502 and 602 ms. A cold first page: about
     1.0 s.
   - The data path that the LOAD suite asserts passes (287–294 ms). Rendering adds about 180 ms.
   - If the business lead reads the budget as the data path only, this is closed. Otherwise, the pane summaries
     (engineer's follow-up) are the next step.
D. **Low · bug (engineer's deviation 3) · an outright delete on another server shifts the list.**
   - Recomputed pages: 3 repeats (seen without JS), 3 skips and 3 cards from outside the list.
   - In the browser across a restart: 0 repeats (the client's drop works), but 10 of 136 cards skipped and 4 new
     ones.
   - It needs an account deletion during someone's session, so it is rare.

Notes:

- **Exploration, whole list.** 60–73% of picks are new traders, against ≥ 80%. The first 120 cards are at 100%. This
  is the engineer's deviation 1; the business lead decides.
- **Page 1 has no `h1`.** Later pages do (the hidden position heading).
- **A slip of mine.** My first command failed to create my database, and the demo seed then ran against the shared
  database. The seed is idempotent (the 3 demo traders were already there), so nothing else was written.
- **Screenshots** are in `screenshots/pr1-test2/`:
  - Retry: the line, "Loading…", and after Retry by keyboard and by click (light, dark);
  - after a jump (End, wheel and programmatic fling; 375 light and dark, 1280 dark), and `loading-*`;
  - the End key with a fast server (defect B) and the end of the End chain;
  - the end card for a guest, a member and a publisher;
  - no-JS page 2, and the pane on card 40 (light, dark).

### 8. Cleanup

- My test users were deleted, then my database (`ss_tst2`) was dropped. I wrote nothing else to the shared database
  (see the seed note above).
- My server (3218) and the e2e servers are stopped. The copy of `HEAD` I built from is removed.

Verdict: DEFECTS (1 High, 2 Medium, 1 Low, 2 notes)

## Re-run 2

2026-10-23. Branch `claude/adoring-euler-4469ys` at `0a0150d` (the engineer's fix round 2). Postgres 16, Node 22.22.
Everything ran on my own database (`ss_tst3`). The build, the e2e runs and my servers ran from a copy of `HEAD` outside
the repo, so no committed screenshot was rewritten. No product code changed.

### 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed | Clean both times. No schema change this round. No drop, truncate or delete from. |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 (+1) | 558 tests, 550 pass, 8 skipped (load). Runs 2, 3 and a 4th: 0 fail. **Run 1: 4 fail**, all in `lib/funnel.test.ts`, from its `before` hook (note 4). |
| Test count | 555 → 558 (+3). e2e 102 → 103 (+1). Nothing removed. |
| Weakened? | No. The property test's per-slot rule names the card the new `pick` chooses, still one exact card per slot. The e2e live-line text changed with the copy. The exploration test gained an assertion. |
| `LOAD=1 … lib/sync.load.test.ts` ×2 | 5/5 both (fleet 9,123 and 10,360 ms, bound 60,000) |
| `LOAD=1 … lib/feed.load.test.ts` ×2 | 3/3 both. 12 heavy p95 155 and 159 ms. 50 heavy p95 264 and 278 ms. **Late case** (150,020 late activities): weights kept p95 292 and 350 ms; cold server 265–424 ms per read. |
| `CI=1 npm run build`, stdin closed | Run 1 stopped on the framework's security advisory. That is tool output; nothing was upgraded. Retry: exit 0. |
| `npm run test:e2e` ×2, own database, fresh `next start` each run, vendor fake configured | **100 passed, 3 skipped, 0 failed**, both runs (4.2 and 4.3 min) |
| `node scripts/compliance.ts diff origin/main` | Only the existing `@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | ok |

### 2. My re-run 1 defects

| # | Then | Now |
|---|---|---|
| A High, late-set rescan | 150,000 late activities: page 2 129 s to over 180 s | **Closed** for the late set (section 3). The same rescan remains in the weight query (defect E). |
| B Medium, End with a fast server | Reader stopped between cards 30 and 31 | **Closed**: card 31 in 56 of 56 runs (section 4) |
| C Medium, full HTTP p95 with 50 heavy traders | 473 ms | 422 and 428 ms. Still over 400; the business lead accepted it, with a trigger (note 1). |
| D Low, outright delete on another server | Shifts the list | Not changed (planner item) |

### 3. The late set, as a user

Fixture A (120 traders × 6 closes), or fixture C (50 heavy traders × 4,700 closes) over HTTP. "Cold" means no kept
list and no kept weights.

- **Exactly as before.** 150,000 late BUY activities, crafted `?after=` at 1, 12 and 47 h: **137–416 ms** (was over
  180 s). Data path, cold page 2: 0 to 300,000 late BUYs, 23–144 ms.
- **Sells, the case that counts now.** Only sells enter the late set, so I re-ran with SELL activities.
  - Data path, cold page 2: 150,000 sells 292–368 ms; 300,000 sells 637–867 ms; 600,000 sells (stale statistics)
    1.35–1.75 s.
  - Linear, about 2.3 ms per 1,000 late sells. No cliff. Same page as the kept list every time.
- **Crafted `?after=` over HTTP (50 heavy)**: 150,000 late sells 358–861 ms; 300,000 sells 658–1,051 ms. Stale
  statistics give the same: 364–758 and 658–964 ms.
- **Another instance.** Page 1 from server A, then 150,000 late activities (statistics stale), then page 2 from a fresh
  server B.
  - First request: 1,200 ms (BUYs) and 1,643 ms (150,020 SELLs). That includes B's cold start.
  - Next requests: 313–411 ms. All equal to A's kept page.
- **Crafted cursor, first request of a just-started server**: 282–1,337 ms.
- **EXPLAIN ANALYZE** of the exact candidate statement (captured from a cold page 2), with 150,000 late sells among
  300,000 late activities:
  - Run with stale statistics (autovacuum off, `n_mod_since_analyze` 300,000), with a custom plan and with a forced
    generic plan, then again after ANALYZE.
  - `CTE late` is one Index Scan (stale: estimated 1 row, actual 150,000) or one Seq Scan (analyzed), `loops=1`.
  - All three late filters are `NOT (hashed SubPlan n)` over a `ProjectSet` with `rows=150000 loops=1`. That holds
    inside the eligibility count too, whose outer subplan runs `loops=127`.
  - **No Materialize and no per-row rescan** in any of the four plans. Execution time is 411–508 ms.
- **But see defect E**: the weight query still rescans.

### 4. End key and smooth scroll with a fast server

Server answer delayed 0, 150, 300, 500 and 800 ms. Each case ran at 375 and 1280, light and dark.

| Input | Result |
|---|---|
| End key from card 3 (focus on its name) | 20 of 20: **card 31 at the top**, offset 0 px, still there 1.5 s later; 1 request |
| Smooth `scrollTo` to the end | 20 of 20: card 31, 1 request |
| End key with focus on the feed (re-run 1's method), 0 and 300 ms | 8 of 8: card 31 |
| End held, release, repeated to the end of the list (375 light) | Each End one request, card 31, 61, 91, 121, 151, 181 at the top; end card; last live line "Trades 181 to 200 loaded" |

- Screenshots: `end-fast-{end,endmain,smooth}-{375,1280}-{light,dark}.png`, `chain-end-375-light.png`.
- A 64,000 px wheel fling with a fast server carries on through the new cards (note 3).

### 5. Variety (skewed fixture, 5 fixtures × 5 days)

| Measure | Result |
|---|---|
| The 5 hyperactive traders in the first 60 cards | **19–24** in all 25 lists (≤ 27) |
| Worst 10-card window | **5** in all 25 |
| Worst 30-card window | 15 |
| Whole-list share | 15% (30 of 199–200), unchanged |
| Traders among the candidates; per trader | 57–61; at most 6 |
| Exploration picks that are new traders, first 120 cards | 24 of 24 in all 25 lists |
| One trader twice in a row | 0 in 23 lists, 1 in 2 lists (note 5) |
| Most cards of one trader in any 30 | 3–5 (was 6) |

### 6. Performance (quiet machine, load average about 1; my server only)

| Measure | Budget | Result |
|---|---|---|
| Full HTTP, signed out, 50 heavy, 3 server starts × 20 rounds × pages 1–3 (180 pages), two runs | p95 < 400 ms | **p95 428 and 422 ms**, median 280. Page 1 p95 455 and 457; page 2 352 and 363; page 3 156 and 171. Cold first page 974–1,142 ms. |
| Raw HTML, 50 heavy, pages 1–7 | ≤ 500 KB | 212–334 KB (gzipped 20–32), 16–27 traders a page |

### 7. Other checks as a user (fixture A, 200 cards)

| Check | Result |
|---|---|
| Request point | 360×640, 375×800, 390×844, 1280×800: no request at card 24, one at 25; page 3 at 55 |
| Live line per page | "Trades 31 to 60 loaded", then 61–90, 91–120, 121–150, 151–180 and "Trades 181 to 200 loaded": a different text on every append (375 light and dark, 1280 dark). Visually hidden, polite. |
| `h1` | Page 1: "Trade feed". No-JS pages 2–7: "Trades 31 to 60" … "Trades 181 to 200", one `h1` each. Pages 2–7 are `noindex`; page 1 is not. |
| "Loading…" | Link: no fill, muted text, weight 400. Retrying button: the same, 44 px high, `aria-disabled`. Contrast 5.0–5.3 (light) and 5.4–5.8 (dark). Retry keeps its fill. |
| Retry (keyboard, click, synthetic tap; light and dark) | 1 failed request, 0 while in error, 1 for Retry. "Loading…" keeps focus. Then 60 rows, card 31 at the top, focus on card 31's name (keyboard and click), live "Trades 31 to 60 loaded". Page 3 at card 55. |
| Jump while page 2 is held (End, wheel fling, programmatic fling; 375 light and dark, 1280 dark) | 1 request each, "Loading…" with `aria-busy`. After release, card 31 at the top, no further request. |
| Trust rule | 200 cards over 7 pages: 200 Verified, 0 Demo, none with both. The demo profiles show Demo and no Verified. The disclaimer is on all 7 pages. |
| Pane | Card 40 (appended): → opens the pane with its chart and stats; ← returns. No page errors. |
| Profile paging | The 4,700-close profile shows 50, then "Show 50 more" → `?closes=100` (51–100), with its chart |
| Consent, TR-3, pane, profile paging, the F-1 chart race | The e2e passed twice |

### 8. Defects

E. **Medium · bug · `lib/feed.ts` (`weights`): the weight query still rescans per row once the candidate traders' own
   late closes reach about 150,000.**
   - The miss query filters `sell_id not in (select unnest(${array}::text[]))`. The array is every missing trader's
     `pl`, their closes imported after `asOf`.
   - The array is a bound parameter. In a custom plan (the first five runs of a statement on a connection) the
     planner sees it as a constant and estimates its true length. Above `hash_mem` the subplan is no longer hashed.
     That is the same mechanism as defect A, which the candidate statement avoids by unnesting a non-constant
     column.
   - Fixture A, cold page 2 (no kept list, no kept weights). 15 listed traders each import their own late closes
     (dated before `asOf`, imported after it):

     | Late closes per trader (total) | Cold page 2 | Weight-query plan |
     |---|---|---|
     | 2,000 (30,000) | 361–449 ms | `NOT (hashed SubPlan 1)` |
     | 5,000 (75,000) | 566–687 ms | hashed |
     | 7,000 (105,000) | 771–957 ms | hashed |
     | 10,000 (150,000) | **over 60 s (statement timeout), 3 of 3**. Without the timeout, the first read ran 10 minutes before I cancelled it. | `NOT (SubPlan 1)` over `Materialize (rows=150000)` |

   - Who hits it:
     - Every cursor page with no kept list or kept weights: another instance, a restart or a deploy, or a crafted
       `?after=`.
     - It happens once the traders in that `asOf`'s candidate list have imported about 110,000–150,000 closes of
       their own since then. For example, 15 listed traders each connect a second account with 10,000 closes
       within the cursor's 48 hours.
     - The fingerprints change with the import, so a warm server's kept weights do not help.
     - The pool recycles connections every 30–60 minutes, so custom plans come back.
     - Much rarer than defect A, since it needs real large imports by listed traders. But once that data exists, a
       crafted cursor reaches it on every request.
   - The fix round's load case gives 20 listed traders one late close each, so it cannot see this. The engineer's
     deviation 3 names only the row size.
   - Fix (engineer's choice):
     - make the array non-constant to the planner, as in the candidate statement (for example, a materialized CTE
       over the parameter), or anti-join against it;
     - and add a load case with ≥ 150,000 late closes among listed traders.
F. **Low · spec (plan §4 budget) · a crafted `?after=` reads the whole late set per request: over 400 ms beyond about
   150,000 late sells.**
   - It is linear now, about 2.3 ms per 1,000 late sells. HTTP (50 heavy): 150,000 sells 358–861 ms; 300,000 sells
     658–1,051 ms. Data path at 600,000: 1.35–1.75 s.
   - The fix round's load case has about 75,000 late sells, so its p95 (275–350 ms) holds there.
   - An attacker picks `asOf` 47 h back to get the largest set. The cost is bounded and linear, not minutes.
   - Option for the engineer: cap or reject an `asOf` older than the newest kept list by more than a few minutes on a
     server with no kept list.

Notes:

1. **Full HTTP p95 with 50 heavy traders**: 422–428 ms, over 400. The business lead accepted this with a trigger.
   It is not counted as a defect.
2. **Stale comment.** `lib/feed.load.test.ts` describes the late-case fix as "Now an anti-join". The shipped fix is a
   hashed `not in` over an unnested array.
3. **Wheel fling with a fast server.** A 40-event, 64,000 px wheel fling with no server delay continues through the
   appended cards.
   - The reader rests at the new end, with the control in view and no card at the top: 375 and 1280, light and dark,
     1 or 2 requests.
   - That is the reader's own input. With a 300 ms server, the pin lands on card 61.
   - No request fires without input.
4. **Pre-existing test flake, not from this PR.** `npm test` run 1 failed the 4 funnel tests in their `before` hook.
   - The hook re-applies `db/schema.sql`. Its F-1 `broker_accounts` backfill raced another test file's user delete:
     `broker_accounts_user_id_fkey`.
   - Runs 2–4 passed. That schema block has not changed since F-1 PR-2a.
5. **Back-to-back.** With the last-9 preference, a trader appears twice in a row in 2 of 25 lists (1 time each; was 0
   of 25). It is still only when no other card fits that slot (the property test).
6. **A slip of mine.** My first command did not create my database. The demo seed then ran against the shared
   database. The seed is idempotent and the 3 demo traders were already there, so nothing else was written. Another
   session's users in the shared database were not touched.

### 9. Cleanup

- My 120 test users (prefix `tq`) and their activities were deleted. Then my database (`ss_tst3`) was dropped, with
  the e2e leftovers.
- My servers (3219, 3220), the e2e servers and the vendor fake are stopped. The copy of `HEAD` is removed.
- Screenshots are in `screenshots/pr1-test3/`:
  - End and smooth scroll with a fast server (375 and 1280, light and dark), and the End chain;
  - Retry, "Loading…" (muted, link and button), after Retry and after a jump;
  - the pane on card 40.

Verdict: DEFECTS (1 Medium, 1 Low, 6 notes)
