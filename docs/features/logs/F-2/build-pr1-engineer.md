# F-2 PR-1 · Feed mix and paging (engineer)

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys` (main at `ccbf285`, plan signed). Plan: `plan.md` §1 "PR-1 ·
Feed mix and paging", §4 and §8. Feature criteria: 6 (diversity and exploration), 8 (feed half: losses ranked as
gains, lower bound) and 10 (feed half: the signed-out feed is the same list and works on shared links).
No schema change, no dependency, no protected path, nothing committed.

## 1. What was built

The feed is now one list per (UTC day, `asOf`). Pages are 30-card slices of it.

| Step | Where | What it does |
|---|---|---|
| Candidates at `asOf` | `lib/feed.ts#feedCandidates({ ids, asOf })` | The F-1 score (size of move × recency, `abs(return)`), with its clock frozen at `asOf`. Only closes at or before `asOf` count, for the score, the 5-close eligibility and the candidate set. At most `FEED_CANDIDATES` = 200. |
| TR-9 ranking | `lib/feed.ts#feedList` | `rankTraders` with `evidenceWeight(confidence(...))`, computed from each trader's closes at or before `asOf`. |
| Diversity | `lib/discovery/diversity.ts` | `fits` / `diversify(cards, { window: 10, maxPerTrader: 2, maxPerSymbol: 2 })`. Greedy: each slot takes the best-ranked card that fits. A cap is never relaxed: when nothing fits, the list ends. |
| Exploration | `lib/discovery/explore.ts#mixFeed` | One slot in every 5 is an exploration slot, at a phase seeded by the UTC day. So any 10 consecutive slots hold exactly 2, page joins included. An exploration slot takes the first fitting card of a seeded shuffle of the pool outside the top 30 (where "too early" records rank). Every other slot takes the best-ranked card that fits. Never reads a return. No propensity stored. |
| Paging | `lib/discovery/pager.ts` | Cursor `{ day, asOf, offset }` as base64url JSON (≤ 200 bytes; about 60 in practice). Strictly validated. Anything invalid, including a cursor older than 48 h, reads as page 1. `pageOf` slices `[offset, offset + 30)`. |
| One page | `lib/feed.ts#loadFeedPage(after)` | Every query and computation the page needs: list, slice, the page traders' records for the panes, record states. |
| UI | `app/page.tsx`, `app/feed-rows.tsx`, `app/feed-actions.tsx`, `app/feed-pager.tsx` | See below. |
| Copy | `lib/copy.ts#FEED` | In the banned-claims walk; test in `lib/copy.test.ts`. |

The UI in detail:

- **Rendering.** `FeedRows` renders a page's rows exactly as the F-1 page did: one pane per trader, shared by that
  trader's cards, with a stand-in chart. The page and the action both use it, so an appended card is the same element
  as a server-rendered one, and SW-1 behaves the same on it.
- **The action.** `nextFeedPage(cursor)` is a server action. It reads no cookie and no session, and writes nothing.
  Given a stale or tampered cursor, it answers `{ stale }`, and the client shows "Load today's feed" linking to `/`.
- **Auto-append (`FeedPager`).** The sentinel is the card 5 from the end (card 25 of 30). When it comes into view, the
  next 30 cards are fetched and appended, with one request in flight. Cards 26 to 30 and the control are observed too,
  so a jump past card 25 still loads (see §4, item 2).
- **Failure.** A failed fetch shows one inline line, "Couldn't load more. Retry", with a 44 px button.
- **Without JS.** The same control is a plain `?after=<cursor>` link labelled "Show more".
- **End card.** "End of today's feed." with "Publish your trades" (→ `/login`). It is a full-height snap target.
- **Indexing.** `?after=` pages carry `robots: noindex`.

## 2. Tests (written first; each failed before its code)

| File | Tests | Covers |
|---|---|---|
| `lib/discovery/diversity.test.ts` | 5 | Caps, look-back of 9, deferral to the first slot that fits, the list ends instead of relaxing (3 traders → 6 cards; 2 symbols → 4) |
| `lib/discovery/explore.test.ts` | 6 | See the list below the table |
| `lib/discovery/pager.test.ts` | 5 | Round trip, base64url, ≤ 200 bytes; 27 bad or tampered cursors → page 1 (no throw); pages 1 to 3 = the list; `next` null at the end |
| `lib/discovery/imports.test.ts` | 4 | Demand A: `diversity.ts`, `explore.ts`, `pager.ts` reach nothing but `lib/discovery/*` and node built-ins. Never `lib/db.ts`, `lib/session.ts`, `postgres`, `next/headers`, `next/server`, `lib/connections.ts` or `lib/feed.ts`. The walker itself is checked (it finds `lib/db.ts` behind `lib/feed.ts`). `app/page.tsx` is not in it. |
| `lib/feed.signed-out.test.ts` | 2 | Demand A, behavioral. `globalThis.sql` is pre-seeded with a `debug` query logger before `lib/db.ts` loads. The test runs the page's own call, then pages 1 to 3 of a 40-trader fixture. No query mentions `follows`, `viewer_exclusions`, `trade_likes` or `discovery_events`. The page, rows, action and pager files import no db, session or `next/headers`, and query only through `loadFeedPage`. |
| `lib/feed.test.ts` (+3) | 3 | (1) A trade closed after `asOf` appears nowhere and moves nothing: a big fresh close, a newly eligible trader and an all-late trader; a new `asOf` sees them. (2) `loadFeedPage` pages 1 to 3 equal the unpaged list, with no repeat, caps across the joins, ≥ 18 exploration picks in 90, panes for the page's traders only, and tampered cursors → page 1. (3) Sign invariance (§3, deviation 4). |
| `lib/copy.test.ts` (+1) | 1 | End-card and paging copy; no completeness words |
| `lib/feed.load.test.ts` | 1 (`LOAD=1`) | p95 < 400 ms, pages 1 to 3, 500 traders (12 with 4,700 closes) |
| `e2e/app.spec.ts` (+4, 1 extended) | 5 | See the list below the table |

What `lib/discovery/explore.test.ts` covers:

- **The property test.** 1,000 generated feeds × 3 pages through real cursors, 750 realistic and 250 adversarial.
  - Pages = the list.
  - Every 10-window has at most 2 per trader and symbol, page joins included (> 500 joins crossed).
  - When the list ends, nothing left fits.
  - Every non-exploration card is the best-ranked card that fits its slot.
  - Exploration picks are from outside the top 30, in exploration slots.
  - An exploration slot takes a ranked card only when no pool card fits.
  - On realistic feeds, exactly 2 picks in every 10-window while the pool lasts: over 20,000 windows (asserted).
- **The day seed.** The same day gives the same list; at least 95 of 100 feeds differ on another day (asserted).
- **Sign invariance of the mix.**
- **Ranking order.** The ranking leads in order: the top 30 first, then rank order with 2 of 10 picks.
- **Small pools.** A pool of 30 or fewer has no exploration.

What the e2e tests cover:

- **The paging test (375 and 1280, light and dark).**
  - At card 20, nothing is fetched. At card 25, page 2 appends with no tap, in one request.
  - 60 distinct cards, with the caps holding across the join.
  - `↓` from card 30 lands on card 31.
  - SW-1 on card 31: `→` opens its pane (0% axis, "See full profile →"), `←` returns.
  - Without JS, page 1 has the same 30 cards; "Show more" goes to `?after=…`, which shows cards 31 to 60, identical to
    the appended ones.
  - At 1280, the same list.
- **Retry.** A failed POST shows "Couldn't load more. Retry" (44 px). Retry appends the page.
- **End card on the demo fixture**, signed out, at 375 and 1280, light and dark. It is reached by auto-append, and
  without JS by the links. The disclaimer is unchanged. The end card has no completeness words.
- **Cursors.** Five bad cursors each serve page 1 with status 200; `?after` pages are `noindex`, and page 1 is not.
- **Heavy feed (extended).** See §4.

## 3. Deviations from the plan, with reasons

1. **Exploration mechanics made explicit.**
   - The plan fixes "≥ 2 of every 10, from outside the top 30, seeded by day".
   - I placed exploration slots every 5th slot at a seeded phase, so the guarantee holds over every sliding window and
     across joins, not only over aligned tens.
   - The guarantee is conditional. It holds while a pool card fits the slot. If none fits, the slot takes the
     best-ranked fitting card, and that window holds one pick fewer. This is tested: it happens only when no pool card
     fits.
   - A pool of 30 or fewer candidates has nothing outside the top 30, so it has no exploration. Today's demo fixture
     (3 traders) is such a feed.
   - Ranked slots continue in rank order past the top 30. My first cut drew every slot from the shuffled pool once
     the top 30 ran out, which made pages 2 and 3 a shuffle (60 of 90 cards were "exploration"). The fixed version
     has exactly 18 of 90.
2. **Future-dated closes in a paged feed.** `closed_at ≤ asOf` excludes a close dated ahead until its date arrives.
   The rebuild already quarantines anything more than a day ahead. The profile shows the close meanwhile.
   `feedCandidates()` without `asOf` keeps the F-1 behavior, so the F-1 tests pass unchanged.
3. **Tie-break.** Ties now break on `sell_id` instead of the row id. `rebuildTrades` renumbers row ids, so a rebuild
   between pages could swap two tied cards. `sell_id` is unique and survives rebuilds.
4. **Sign invariance scope.**
   - Exactly invariant under negating every return:
     - the SQL score (DB test);
     - the mix (pure test);
     - the whole feed for records under 10 bets, where the TR-9 weight is 0 (DB test, 30 traders, ≥ 60 cards).
   - Not exactly invariant: the full feed for traders with a TR-9 weight. TR-9's interval is computed on log returns,
     so a −x% record has a slightly wider log-distance from zero than a +x% one. Losing records get slightly more
     weight, never less. This is pre-existing F-1 behavior and is not changed here.
   - Flag for the business lead: whether TR-9 should be symmetric in simple returns is a TR-9 question, not a PR-1 one.
5. **Load measured on the data path.** The `LOAD=1` test times `loadFeedPage`, which is every query and computation
   of the page. Node cannot render the TSX. The rendered page is measured end to end by the e2e bytes and by
   time-to-first-byte on the running server.
6. **Performance work outside the plan's file list.** The budget missed at first: p95 978 ms. Four changes brought
   it under, with no schema fallback:
   - The score uses `date_part` (double) instead of `extract` (numeric since PostgreSQL 14). Same value, cheaper per
     row.
   - The candidate query selects eligible traders first (a materialized CTE), then makes one pass over their closes.
   - Record times travel as epoch milliseconds.
   - `lib/pane.ts#groupByUser` pushes instead of copying an array per row. The copy was quadratic: about 0.3 s for a
     few 4,700-close records. The old page had the same cost over every candidate.
7. **A chart race fixed in F-1 code (`app/u/[handle]/chart.tsx`).**
   - Found by the heavy e2e, which now opens the second row's pane. It failed 1 in 3 or 4 runs.
   - The cause: the remap that moves a scrub position from the stand-in's points to the full chart's points ran as a
     passive effect. A key press landing between the swap's commit and that effect was remapped as if it were on the
     stand-in's points, which reset it.
   - The fix: a layout effect, one word. 4 of 4 repeats and 2 full runs pass since.
8. **The behavioral guard cannot execute the TSX.**
   - It logs every query of `loadFeedPage` for pages 1 to 3.
   - It also asserts that `app/page.tsx`, `app/feed-rows.tsx`, `app/feed-actions.tsx` and `app/feed-pager.tsx`
     import no db, session or `next/headers`. So `loadFeedPage` is the page's only reader.
9. **Heavy e2e distinct-trader bound.** The bound is ≥ 10 distinct traders per page, as in F-1, not 15. The caps
   allow 6 cards of one trader in 30 (2 per 10), so 15 is not implied. The measured counts are in §4.
10. **Small additions.**
    - `noindex` on `?after` pages.
    - The `{ stale }` answer and "Load today's feed" for a cursor older than 48 h.
    - `makeTrader` (e2e) takes an optional per-close symbol, so fixtures do not all share AAA to HHH.
11. **Size.**
    - The diff is about 1,290 changed lines, against the plan's estimate of ~700. Of these, 828 are tests.
    - The Gate counts every line against `MAX_DIFF` = 800, so it will label this PR needs-human.
    - The plan's required tests alone exceed the cap. Raising the cap for feature PRs is pre-authorization request #2
      in `docs/IMPLEMENTATION.md`, still unanswered.
    - A split would be PR-1a (pure modules and their tests, about 460 lines) and PR-1b (wiring, UI and e2e, about 830).
      PR-1b would still be over. The owner decides.

## 4. Measurements

| Measure | Budget | Result |
|---|---|---|
| Signed-out server time, pages 1 to 3, 500 traders (12 × 4,700 closes, 66,160 closes), 20 rounds | p95 < 400 ms | **p95 319 ms** (page 1: 312, page 2: 319, page 3: 306), median 251 ms. An earlier run: p95 308 ms. Before the §3.6 changes: p95 978 ms. |
| Phase split, steady state | – | candidates about 100 ms, records about 75 ms (25,160 rows, 88 traders), weights about 30 ms, mix about 1 ms, record states about 3 ms |
| Raw HTML per page, 50 distinct heavy traders in the fixture (238,895 closes) | ≤ 500 KB | page 1: **237 KB** (26 KB gzipped, 13 distinct traders); page 2: **255 KB** (29 KB, 16); page 3: **267 KB** (31 KB, 18). Two full runs, identical. |
| Projected worst page: 30 distinct heavy traders on one page | ≤ 500 KB | about 5.9 KB per extra distinct heavy pane (from a pre-fix run: 237 KB at 13, 302 KB at 24) → **about 340 KB**. Not measured directly. |
| Exploration picks, pages 1 to 3 at 500 traders | ≥ 2 per 10 | **18 of 90**, 60 distinct traders |
| Feed TTFB on the running server, demo data, 20 to 25 requests | – | median 54 to 70 ms, max 83 to 95 ms |
| Append request | one in flight, at card 25 | one POST at card 25, none before (e2e) |
| Cursor | ≤ 200 bytes | about 60 bytes |

Test runs:

- **`npm test` ×3**, with `DATABASE_URL` set: 547 tests, 541 passed, 0 failed, 6 skipped. The 6 are the load suites,
  skipped without `LOAD=1`. Previously 520 tests: +27, none removed or weakened.
- **`LOAD=1` load suites.**
  - `lib/sync.load.test.ts`: 5 of 5 (fleet 8,615 ms).
  - `lib/feed.load.test.ts`: 1 of 1.
- **`npx tsc --noEmit`**: clean.
- **`CI=1 npm run build`**, stdin closed: compiled. The framework prints a security advisory as tool output and exits;
  the retry builds. Nothing was upgraded.
- **`npm run test:e2e` ×2**, each on a fresh `npm run start` with the vendor fake configured: **97 passed, 0 failed,
  3 skipped**, both runs. The 3 skips are the sign-in provider and email-sink tests, which need server configuration
  this container doesn't have. There are 100 tests (F-1 had 96; +4).
  - One attempt reused a server process from the previous run. The vendor-framing test then failed, because the server
    caches the probe answer per process for an hour (`lib/portal-probe.ts`). On a fresh server it passes. This is
    environmental and unrelated to this PR.
- **`node scripts/compliance.ts diff origin/main`**: only the pre-existing `@img/sharp-wasm32` license line.
- **`node scripts/autopilot.ts guard main`**: `guard: ok`.

Screenshots are in `screenshots/pr1/` (11 PNGs):

- `join-card31-{375,1280}-{light,dark}`: card 31, the first appended card, after `↓` from card 30.
- `nojs-show-more-375-{light,dark}`: the no-JS link after card 30.
- `end-card-{375,1280}-{light,dark}`: "End of today's feed." with "Publish your trades".
- `retry-375-light`: the inline failure line with its 44 px Retry.

## 5. Policy checks (plan §8)

- **Losses ranked as gains.**
  - The score is unchanged: `abs(return)`.
  - The mix never reads a return.
  - The sign-invariance tests are listed in §3, deviation 4.
  - The demo feed shows losses (e2e "feed works signed out and shows losses alongside gains" passes).
- **Works signed out.**
  - The list is the same for every viewer.
  - Paging works without JS.
  - The action reads no session.
  - The behavioral guard holds.
- **No completeness claim.** The end card says "End of today's feed.", and its copy is tested against
  every/all/complete/whole/caught up.
- **Nothing per viewer.**
  - No viewer data is read.
  - The cursor carries only the day, `asOf` and the offset.
  - Nothing is stored.
- **Disclaimer unchanged.** The layout is not touched, and the e2e test asserts the line.
- **No celebration, advice or new dependency.**
- **Accessibility.**
  - Every control is ≥ 44 px.
  - "Couldn't load more. Retry" is `role="status"`.
  - The "Show more" link works by keyboard.
  - `↓` crosses the page join.
  - No motion is added.

## 6. Known limits

- **The feed is not fully frozen.** A list is fixed for its (`day`, `asOf`) only as far as the data it reads at or
  before `asOf`. Between two pages:
  - a trader deleted, or whose second import starts (TR-3), drops out and shifts later cards up;
  - a rebuild that corrects an old close's return can move that card;
  - no card repeats in either case, but one can be skipped.

  Freezing those would need a stored snapshot, and the plan rules out storing anything per session.
- **The demo-only feed is 6 cards, then the end card.** Three traders at 2 per 10 fill 6 slots. This is the plan's
  "never relax a cap", but it is visible to anyone seeing the demo. Flag for the UX lead.
- **Exploration on small pools.** A database with 30 or fewer eligible closes has no exploration, because there is
  nothing outside the top 30.
- **Every page recomputes the whole list.** Each page reads up to 200 candidates and the full records of their traders
  (the TR-9 weight needs them). Cost grows with the heaviest candidate records:
  - about 75 ms of the 250 ms median at 12 heavy traders;
  - the candidate query is a full pass over every eligible close.

  The plan's fallback (`closed_trades.feed_key` plus an index) is the next step if a larger fixture misses the
  budget. Not needed at 500 traders.
- **TR-9's log-space asymmetry** (§3, deviation 4).
- **An exploration "pick" is not recorded** (no propensity, as the plan says). Stage 2's serves table would add it.
- **Cursor expiry.** A cursor older than 48 h restarts today's feed. The action answers "Load today's feed" rather
  than silently serving page 1 into an appended list.

## 7. Files

New:

- `lib/discovery/diversity.ts`, `lib/discovery/explore.ts`, `lib/discovery/pager.ts` and their tests;
  `lib/discovery/imports.test.ts`
- `lib/feed.signed-out.test.ts`, `lib/feed.load.test.ts`
- `app/feed-rows.tsx`, `app/feed-actions.tsx`, `app/feed-pager.tsx`
- `docs/features/logs/F-2/screenshots/pr1/`

Changed:

- `lib/feed.ts`, `app/page.tsx`, `app/globals.css`, `lib/copy.ts`
- `lib/pane.ts` (`groupByUser`)
- `app/u/[handle]/chart.tsx` (layout effect)
- `lib/feed.test.ts`, `lib/copy.test.ts`, `e2e/app.spec.ts`

## Fix round 1

2026-10-23. From the tester's report (1 high, 2 medium, 1 low), the business lead's verdict (2 usability blockers) and
the UX lead's verdict (1 blocking, 8 follow-ups). Nothing committed. No dependency, CI, cron, sync, CODEOWNERS or
protected path changed. One schema line: an index (below). Node 22.22 in this container, as in the tester's runs.

### Changes, in the order asked

1. **The page join (blocking, all three). `app/feed-pager.tsx`, `app/globals.css`.**
   - Cause: when a page arrived while the control was in view, the scroller kept the control in view while 30 cards
     went in above it. The reader skipped them, and the observer (which watched the control) fired again, in a chain.
   - When a page arrives with any of the control in view (after Retry, a jump to the end, a fling, a slow server),
     the pager puts the first new card (card 31) at the top before paint, instantly.
   - After a load, a watched card or the control loads the next page only when it comes into view again. Being in
     view as the page arrives does not count. So one Retry or one jump is one request.
   - `overflow-anchor: none` on the control.
   - `rootMargin: 0 0 -1px 0`: card 25 must be inside the feed, so a card 25 that only touches the bottom edge
     (card 24 in view) no longer counts. The request now fires at card 25, not card 24.
   - New e2e:
     - Retry by keyboard from the control, 375 light and dark: no request at card 24. The failed request, then
       exactly 1 for Retry. The reader is on card 31, which has focus. The live line reads "30 more trades loaded".
     - A jump to the end from card 3 while page 2 is held (375 light and dark, 1280 dark): 1 request, and "Loading…"
       with `aria-busy` meanwhile. The reader lands on card 31. Reading on loads page 3 at its card 25, once.
2. **Variety by trader (business lead blocker 2). `lib/feed.ts`, `lib/discovery/explore.ts`.**
   - At most `FEED_PER_TRADER` = 6 of one trader's closes among the 200 candidates: one window function, the
     trader's best-scoring six. Profiles keep every close (TR-1).
   - Exploration picks by trader. The pool's traders (outside the top 30) are shuffled with the day's seed, each
     trader once, however many closes it has in the pool. An exploration slot takes the best-ranked fitting card of
     the first trader not yet in the list. It reuses a trader already in the list only when no new trader's card
     fits.
   - Every slot prefers a card whose trader differs from the previous card's (UX follow-up 6), within the same
     "best-ranked that fits" rule. A trader appears twice in a row only when no other trader's card fits that slot.
     It is a preference, never a cap: it never ends the list.
   - Sign-neutral: still no return read.
   - New tests:
     - pure, 50 skewed fixtures of 5 hyperactive + 55 ordinary traders;
     - a DB test on the same shape (5 traders × 60 fresh closes within ±8%, 55 traders × 6 to 20 closes over 30
       days within ±25%);
     - the adjacency rule on generated, adversarial and demo-shaped lists.
3. **Cards repeating or vanishing across joins (tester Medium 2). `lib/feed.ts`, `db/schema.sql`.**
   - With `asOf`, the list is pinned to what existed at `asOf`, not only to what was dated by then.
   - A close whose sell activity was imported after `asOf` counts nowhere: not in the candidates, the 5-close
     eligibility or the TR-9 weights. A close dated before but imported after waits for the next page 1. The late
     set is `activities.created_at > asOf`, a small, recent set read through the new index
     `activities_created on activities (created_at)`.
   - A trader deleted after `asOf`, or whose import started after `asOf`, keeps their places in the list. The page
     leaves their cards out (a gap): its cards are re-read by vendor id, joined to live users, and dropped for a
     trader importing now (TR-3).
   - A trader whose import was still running at `asOf` stays out of that list even after the import finishes.
   - The list for each (day, `asOf`) is kept in server memory for its cursor's lifetime (at most 256 lists; only
     vendor id, trader, pick and score per card). A later page from the same server slices exactly page 1's list.
     A trader deleted outright (rows gone) is then a gap too. Each page reads its cards' current rows, so a thesis
     held since page 1 is not shown.
   - The client also drops a card it already shows (by card id), as a last guard for the case below.
   - Tests (DB), on a server with no kept list, after page 1:
     - a close imported late and dated before `asOf` (+350%);
     - a 5th close imported late for a trader with 4;
     - a trader soft-deleted;
     - a second import started for another trader.

     Pages 2 and 3 are exactly the list's cards 31 to 90 minus the two removed traders' cards: no repeat, no move,
     no skip. A later page 1 sees the late closes. With the late-import filter or the at-`asOf` import rule removed,
     the test fails; I checked both mutations. A second test covers the same server with a hard delete: a gap,
     nothing repeats.
4. **Server time with 50 heavy traders (tester Medium 3). `lib/feed.ts`, `lib/trades.ts`.** Profile, warm, before the
   fixes (my fixture, below): candidates about 250 ms, the full records of 93 candidate traders (235,000 closes)
   about 270 ms, weights about 130 ms. Changes:
   - **Candidates from the last 14 days first.** This is an index range on `closed_at`, about 40 ms. It is exact when
     the window fills the 200 and its 200th score is above 709.78 · e^−7 ≈ 0.65, the most any older close can score.
     In that case every close scoring at or above the 200th is in the window, and the per-trader ranks of those
     closes are unchanged.
     - Otherwise the full pass runs (small or quiet databases).
     - A DB test checks that the window path equals a full JS reference. That reference scores every close, takes
       the top 6 per trader and the top 200, and includes a large 3-day-old move.
   - **TR-9 weights kept in memory per trader.** The key is the trader's row count, largest row id (a rebuild
     renumbers rows; a new close adds one) and the count of rows counted at `asOf`. One aggregate query (about 50 ms)
     finds the keys. Only traders whose record changed read their record again.
   - **Records as one JSON text per trader** instead of one row per close, for the panes and for weight misses. The
     database read ~56,000 rows in 30 ms, but the client took ~200 ms to parse them as rows. Values are unchanged:
     float8 text round-trips, and times are epoch ms as before.
   - **Panes for the page's traders only**, read in parallel with the page's cards and record states.
   - **The ranked list kept per (day, `asOf`)** (item 3), so pages 2 and 3 skip the candidates and weights.
   - `confidence()` grouped by symbol with a copy per trade (quadratic in a symbol's trade count); it now pushes.
     Same output.
   - `lib/feed.load.test.ts` gains the plan's heavy case: 500 traders, 50 with 4,700 closes and 5 fresh closes each.
     Both cases put every page in the p95, and log round 1 (a cold server) on its own.
5. **UX follow-ups done now.**
   - The control reads "Loading…" while loading (`aria-busy` kept).
   - Retry keeps keyboard focus: the same button reads "Loading…" while it retries. On success, focus moves to card
     31's name link. On another failure the line comes back on the same button.
   - A polite live line says "30 more trades loaded" (the count actually appended).
   - The end card shows "Publish your trades" to a signed-out viewer or one with no record, and "See your record" to
     a viewer who publishes. The feed still reads no session: the layout sets `<body data-viewer>` (one `exists`
     query, signed-in viewers only) and the stylesheet shows the one that applies. Both go to `/login`, which takes
     a signed-in viewer to their own profile.
   - A `?after=` page starts with a visually hidden heading "Trades 31 to 60" (no JS).
   - **Log correction to §3.1.** At `cd355aa` the demo-only feed had 1 exploration pick, not 0, because the pool
     counted closes (90 > 30). With the per-trader cap it now has 18 candidates (3 × 6), so it has none. It is still 6
     cards, and no longer opens with one trader twice.

### Measurements (quiet machine, own database `ss_eng`, Postgres 16)

| Measure | Budget | Result |
|---|---|---|
| `loadFeedPage`, 500 traders, **50 heavy** × 4,700 closes, 5 fresh each (244,000 closes), 20 rounds × pages 1–3, two runs | p95 < 400 ms | **p95 285 and 263 ms** over all 60 pages; page 1: 307 and 324 ms; page 2: 190 and 214 ms; page 3: 29 and 26 ms. Median 163 and 171 ms. Before: tester p95 1,835 ms. |
| Same, cold server (round 1, page 1: no kept list or weight) | – | **468 and 610 ms** (746 ms in an earlier run). This is the first request after a server starts, or a page 1 that recomputes many changed records. Over budget; see deviations. |
| Same fixture, the tester's worst case (1 fresh close per heavy trader), scratch run | p95 < 400 ms | p95 **337 ms**, median 13 ms; cold page 1 913 ms |
| `loadFeedPage`, 500 traders, 12 heavy (the original case), two runs | p95 < 400 ms | p95 **163 and 166 ms** (page 1: 179 and 194 ms); cold page 1 303 and 363 ms |
| Distinct traders in the 200 candidates | ≥ 33 | 50-heavy fixture: **93**; 12-heavy: **88 and 89**; skewed DB fixture (5 hyperactive + 55): **58**; pure skewed fixtures: ≥ 33 on all 50 seeds (54–58 in the five I printed) |
| Share of the skewed list held by the 5 hyperactive traders | – | **15%** (30 of 200; it was 84% at `cd355aa`). All 58 traders appear. |
| Exploration picks that are new traders | ≥ 80% | **First 120 cards: 100%** on every seed (24 of 24 in the DB test). **Whole list: 60–65%** (24–26 of 40). By card ~120 every candidate trader is in the list, so the later picks can only re-serve one. See deviation 1. |
| Most cards of one trader in any 30 | ≤ 6 | ≤ 6, every window, all fixtures |
| Request at | card 25 | card 25 (none at 24, e2e) |
| Requests for one Retry / one jump | 1 | **1 / 1** (e2e, 375 light and dark, 1280 dark); reader at card 31 |

Checks:

- **`npx tsc --noEmit`**: clean.
- **`npm test` ×3**: 555 tests (was 547, +8), 548 passed, 7 skipped (the load suites), 0 failed. Runs took 16 to
  18 s.
- **`LOAD=1 node --expose-gc --test lib/sync.load.test.ts`**: 5 of 5 (fleet 9,630 ms, bound 60,000).
- **`LOAD=1 … lib/feed.load.test.ts` ×2**: 2 of 2 each.
- **`CI=1 npm run build`**, stdin closed: the first attempt stopped on the framework's security advisory. That is
  tool output; nothing was upgraded. The retry exits 0.
- **`npm run test:e2e` ×2**, own database (demo seed), a fresh `next start` each run, vendor fake configured:
  **99 passed, 3 skipped, 0 failed** both runs (4.2 min). There are 102 tests (was 100, +2). The skips are the
  sign-in provider and email-sink tests.
- **`node scripts/compliance.ts diff origin/main`**: only the pre-existing `@img/sharp-wasm32` license line.
- **`node scripts/autopilot.ts guard main`**: ok.
- **Size of this round**: product 437 changed lines, tests 413.

Screenshots are in `screenshots/pr1-fix1/`. The e2e now writes there, so `pr1/` (the build's evidence) stays as it was
(tester note 6):

- `after-retry-375-{light,dark}`: card 31 at the top after Retry, focus ring on its name.
- `loading-375-{light,dark}`: "Loading…" on the control.
- `after-jump-{375-light,375-dark,1280-dark}`: card 31 after a jump.
- `end-card-publisher-375-{light,dark}`: "See your record" for a signed-in publisher.
- The PR-1 set, re-shot: `join-card31-*`, `nojs-show-more-*`, `end-card-*`, `retry-375-light`.

### Deviations

1. **"≥ 80% of exploration picks are new traders" holds over the first 4 pages (100%), not over the whole list.**
   - A list of 200 cards from 33 to 60 traders contains every trader by about card 120. The 15 or so picks after
     that cannot be new.
   - The test asserts the rule exactly: every pick is a new trader whenever a new trader's card fits that slot. It
     also asserts ≥ 80% over the first 120 cards.
   - Proposal for the business lead: measure "new traders per pick while one is available". The alternative is
     more candidates per list, which the plan caps at 200.
2. **The adjacency rule is greedy, not a swap pass.**
   - It is a preference inside "best-ranked card that fits". The PR-1 property test's per-slot assertion now uses
     that rule. It still names one exact card for every slot, so it is as strict as before.
   - A list ranked in blocks of one trader can still end with a pair when nothing else fits, for example 3 traders
     with 6 closes ranked by trader. The demo shape (interleaved) has none.
3. **Pinning across servers.**
   - The kept list is per server process. On another server or after a restart, the list is recomputed pinned to
     `asOf`: late imports, soft deletes and imports that start are exact (tested). A trader deleted outright
     (account deletion removes the row) shifts later cards.
   - The pager drops a card the reader already has, so JS readers see no repeat; a skip is possible. A no-JS reader
     can see a repeat on the next page.
   - Two smaller windows:
     - The sync inserts activities and rebuilds in one transaction, and `created_at` is the transaction's start. A
       close committed after `asOf` whose transaction started before it can appear on a later page.
     - A sell whose buy is imported after `asOf` becomes a close then.

     Both are rare; the client's drop covers repeats.
4. **Cold page 1 is over the budget** (468 to 913 ms with 50 heavy candidates). That is the first request on a new
   server, or a page 1 right after many candidate records changed. Each trader's weight is recomputed once per record
   change per server. The asserted p95 includes the cold page. The next step is a pane summary kept per record (see
   follow-ups).
5. **One schema line** (an index on `activities.created_at`, idempotent, no drop) and one `exists` query in the root
   layout for signed-in viewers. Neither was in the plan's file list.
6. **The load test was refactored** into a fixture and a measure so the 50-heavy case reuses them. The 12-heavy case
   keeps its fixture, its assertions and its bound, with every page still in the p95.

### Recorded as follow-ups (not done this round)

- **UX 4.** Retry is hard to reach by keyboard from card 1 (360 Tab presses). Options: one automatic retry when the
  control comes back into view, or letting ↓ at the end move focus to the control.
- **UX 7.** The demo-only feed is 6 cards. Should a short feed relax a cap? Owner and business lead. A line on the end
  card about swiping left to the record is the UX lead's suggestion.
- **UX 9b, business lead.** One fresh cohort can fill the day's 200 candidates. The per-trader cap reduces this but
  does not remove it.
- **Older issues.** The pane header runs the name and handle together (PR-2). The sticky header covers the top of the
  card at 375.
- **Performance.** A cold page 1 with many heavy candidates. Keep each heavy record's pane summary and stand-in line
  per (trader, row count, largest id), or compute them in SQL, so a page does not read ~50,000 closes for its panes.
- **Owner (from the business lead).** Pre-authorization #2 (count non-test lines against 800). The TR-9 log-return
  symmetry line.
- **Reviewer checklist (business lead demand 3).** Position after Retry and after a jump, plus a variety measure on a
  skewed fixture. Both are now in this PR's tests.
