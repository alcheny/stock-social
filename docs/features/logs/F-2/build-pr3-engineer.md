# F-2 PR-3 · Suggestions section, the same for every viewer (engineer)

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys`, after merging main at `ae8a844` (PR #19, F-2 PR-2, squash; clean, no
conflict, pushed). Plan: `plan.md` §1 "PR-3 · Suggestions section, impersonal", §4, §8 and §9, plus the reject swipe on section
rows (plan PR-4's non-colliding form, moved here by the brief; O1 stays open). Feature criteria: 7 (impersonal reasons),
8 (section ordered by the TR-9 lower bound, losses equal), 9 (copy scan), 10 (signed out sees the same section).
No dependency, schema change, protected path, CI or `package.json` change; no event table of any kind (plan demand C).
Product diff (no tests, no e2e, no logs): 12 files, **+370 / −30**.

## 1. What was built

| Part | Where | What it does |
|---|---|---|
| Section rules (pure) | `lib/discovery/section.ts` | `sectionPool`: the feed's eligible traders at asOf, one entry per trader (score = its best card's score, which reads only the size of a move), ordered by `rankTraders` with weight = `evidenceWeight(confidence(...))` (TR-9 lower bound; a mirrored losing record weighs exactly like the winning one). `sectionCandidates`: the pool minus the traders of the 10 feed cards around the section (5 before, 5 after) and minus `skip`; traders shown in an earlier page's section of the same list go after the others (each page shows new faces while any are left). `chooseRows`: 3 distinct traders, at most 2 per holding bucket, fewer than 3 → `null`. `reasonFor`: "New here this month" (account under 30 days at asOf), else "Typical holding period: …" (median holding days → under a day, 1 to 7 days, 1 to 4 weeks, 1 to 6 months, over 6 months); a second row in the same bucket says "Closed a trade this week" instead when its last close is within 7 days of asOf. Never reads a sign or a viewer beyond `skip`. |
| Reject recognizer (pure) | `lib/discovery/reject.ts` | `canArm` (row at rest, no pane open, ≥ 400 ms since one closed), `horizontal` (travel ≥ 2× vertical), `swipeOutcome` (past half the row toward the tray → reject if armed, else back; past half toward the sentinel → open; otherwise back). |
| Feed | `lib/feed.ts` | The TR-9 weight cache now keeps, under the same key, the facts the section needs at asOf (median holding days, last close): no extra read of any record. `feedList` returns the `pool`, kept with the list for its cursor's lifetime. `loadFeedPage` picks the section for the page from the kept list and the viewer's slots (shaped list), reads the users (handle, name, account age) and record states of ≤ 8 candidates and the records of the 3 likely rows in the same `Promise.all` as the page's reads (one round trip; a spare's record is read only when a row turns out importing or deleted). Nothing is read for it when the candidates cannot make 3 rows. `FeedPage.section` (rows with handle, name, reason) or `null`; the rows' records go into `byUser`/`records` for the pane. |
| Viewer data | `lib/follows.ts#sectionSkips` | Signed in only: one query, `follows` ∪ running `viewer_exclusions` (both reasons: the section honours the `unfollow` row; the feed still does not, `FEED_HIDES_UNFOLLOWED = false`), keyed `viewer_id = ${viewer}`. |
| Section card | `app/suggest-section.tsx`, `app/feed-rows.tsx` | A full-height snap card after the page's 5th card (position 6), on every page that has one (page 1 and every appended page, same element through `feedRowNodes`). Heading "More records" (true for every viewer, signed in or out), one muted line "The same for everyone. Records with more evidence come first, losses counted like gains.", 3 rows. A row: name, then handle (each cut only if it alone is too wide), badge (Verified / Demo / "Import did not finish"), one reason line. **No performance number.** Not a `.row`: the feed's cards, paging, SW-1 keys and every existing count see only cards. |
| Row | `app/suggest-row.tsx` | Tap or Enter opens the trader's pane (the same `ProfilePane`) as a modal `<dialog>` sheet; Esc, "← Back" or a tap outside closes it and focus returns to the row. The sheet covers the page's footer, so it carries POLICY F3's line itself. With JavaScript the name/reason part is its own native scroll-snap container `[reject tray (signed in) | row | open sentinel]` resting on the row (`scroll-snap-stop: always`): the opening swipe opens the sheet; the reject swipe commits past half the width when armed, else snaps back (`lib/discovery/reject.ts`). Signed in, Follow and "…" ("Not interested in @x") sit beside it, outside the swipe container (so the popover is never clipped). Without JavaScript the row is a link to the profile and the "…" form posts as in PR-2. |
| Hides | `app/feed-hides.tsx`, `app/not-interested.tsx` | A hide from a section row (menu, reject swipe or the sheet's pane) uses PR-2's path unchanged: the same action (−4, 90 days), "Hidden for 90 days." with Undo for 5 s. The style rule now hides every element of the trader in the feed (`[data-handle]`), so the row collapses with the trader's cards; the reader stays on the section; focus goes to the next row (then the cards), Undo returns to the row's "…". |
| No-JS hide line | `app/u/[handle]/page.tsx` | "@x is hidden from your feed for 90 days. Their profile stays public." now links "Following and hidden traders" (`/me/following`, where it can be undone). PR-2 UX follow-up 7. |
| Pane header | `app/globals.css` | A long name gives way first; the handle stays whole (PR-1/PR-2 UX follow-up: "cuts the name and hides the handle"). Same line as before (PR-2's e2e pins name and handle side by side). |
| Copy | `lib/copy.ts#SECTION` | Heading, line, the five holding templates, "Closed a trade this week", "New here this month", tray, close, incomplete. In `allCopy()` (banned claims) and scanned by the new suggestion word test. |

## 2. Tests

Unit/DB: **576 → 595** (584 pass, 11 skipped LOAD, 0 fail). E2e: **103 → 109** passed (3 skipped: provider and mail-sink
variables). No earlier assertion changed: the guard tests gained roots and cases only. Honest note on order: the pure tests
were written before the feed wiring, the DB and e2e tests alongside the UI; not every test was seen failing first.

| File | Tests | Covers |
|---|---|---|
| `lib/discovery/section.test.ts` | 7 | Buckets and median. Pool order equals `rankTraders` by the TR-9 weight; a 6-close +35%-a-trade record (weight 0) ranks below confident ones (never a raw average); a mirrored losing record has the same weight (1e-12). **Sign invariance, 200 seeded fixtures**: negating every log return leaves the rows unchanged. Candidate filter (near cards, skip set incl. viewer/follows/exclusions), pool order kept, distinct, ≤ 2 per bucket, 0/1/2 candidates → `null`, all skipped → `null`. New faces per page, then reuse. Reasons true on fixtures (account age, bucket, 7-day boundary both sides). Recognizer: 49% back, 51% commits, unarmed never commits, 399 ms no / 400 ms yes, pane open no, not at rest no, 39:20 diagonal scrolls. |
| `lib/discovery/imports.test.ts` | +2 | `section.ts` and `reject.ts` import nothing that reads the database, the session or a viewer's data. |
| `lib/copy.test.ts` | +1 | Every section string against PROMO, the banned-claims list, `\b(buy|sell|hold|pick|signal|advice|price target)s?\b` and `\b(suggested|recommended|top|best|ai)\b`; no `%`, signed number or money; "holding period" passes, "hold"/"holds"/"a pick"/"signals" fail. |
| `lib/feed.section.test.ts` | 5 | Signed out: section on page 1 and page 2 (new faces), 3 rows none on the 10 cards around it, ≤ 2 per bucket, order = the pool's, reason = the record's bucket, the rows' records on the page, identical on a second request. Losses only: same section shape. Signed in: viewer, follow, "Not interested" and **unfollow** leave the section; the unfollowed trader stays in the feed, the hidden one does not; exactly 2, 1, 0 candidates → no section (near cards unchanged); all hidden → no cards, no section. Demo-only and 1/2/3/5 traders → no section. An importing trader is never a row; the next candidate takes the place. |
| `lib/feed.signed-out.test.ts` | +3 | The section components import no db, session, viewer or follows module. **Signed out, pages 1 to 3 each with a section: no query names a viewer table**; same section on a second request. Signed in: the section's one read (`union`) is `where viewer_id = $1` with every parameter the session's viewer; no `trade_likes` or `discovery_events`. PR-1's and PR-2's cases untouched. |
| `lib/feed.load.test.ts` (LOAD=1) | +1 | 50 heavy traders (holding periods over the five buckets), a section on pages 1 to 3 whose rows are heavy records: signed-out p95 < 400 ms, signed-in (5 follows, 5 hides) p95 < 800 ms. The fixture function gained an optional `hold`; the PR-1 cases call it as before. |
| `e2e/section.spec.ts` | 6 | (1) Demo-only feed: no section. (2) Signed out, 375 and 1280, light and dark: 5 cards then the section; heading; 3 rows; no `%`/signed number/money in any row; no Follow or "…" signed out; "…" on no card; rows not among the 10 near cards; tap → sheet (stats, F3 line, "See full profile →" to `/u/x`, no actions); Esc closes, focus back on the row; Enter opens; "← Back" closes; **no non-GET request**; touch: the opening swipe opens the sheet, no tray signed out; no-JS: the same 3 rows, a row is a profile link. (3) Signed in: Follow and "…" on each row (all ≥ 44 px); the menu item inside 375; "Not interested" → row and the trader's cards collapse, "Hidden for 90 days.", Undo focused, the reader stays on the section, one exclusion; Undo restores, focus on the row's "…"; hide again → page 2 (appended) has no card of the trader and its own section; pane header at 375 and 320: a 20-character handle whole beside a 36-character name; rows inside 375 and 320. (4) Touch (CDP touch events, native scrolling): a feed card's horizontal swipe opens its pane and writes nothing; right after the sheet closes the same reject swipe snaps back and writes nothing; at rest it commits (one exclusion, row gone, Undo); Undo restores at rest; a 30% swipe snaps back; the opening swipe opens the sheet. (5) No-JS "Not interested" on a row → the profile line with its link to `/me/following`. (6) Heavy: 50 traders × 4,700 closes, pages 1 to 3 as served each with a section of heavy records, each < 500 KB raw. |

## 3. Measurements

| Budget | Bound | Measured |
|---|---|---|
| Signed-out feed p95, 12 heavy (PR-1 case, section included where it renders) | < 400 ms | **172 / 132 ms** all pages, two runs |
| Signed-out feed p95, 50 heavy, PR-1 fixture (one holding bucket: no section possible, nothing read for it) | < 400 ms | **268 / 258 ms** (PR-2 log: 237 to 272) |
| Signed-out feed p95, 50 heavy, a section of heavy records on every page | < 400 ms | **313 / 319 ms** (page 1 343 / 326; cold page 1 701 / 622) |
| Signed-in feed p95, same fixture, 5 follows + 5 hides | < 800 ms | **305 / 324 ms** |
| Raw HTML, 50 heavy, section on every page | ≤ 500 KB | pages 1 to 3: **280 / 333 / 287 KB** (14 / 15 / 14 KB gzipped), both e2e runs |
| Tap to feedback (follow toggle, PR-2 e2e) | < 100 ms | 3.0 to 3.8 ms |
| Late-import cases (PR-1) | as PR-1 | pass; weights-kept p95 326 ms; own-late cold median under 1 s (PR-1's known limit, unchanged) |

All LOAD measurements on an otherwise idle machine (load average about 1), files run one at a time; run side by side with
`sync.load` and `follows.load` they read 30 to 90 ms higher. One earlier `feed.load` run, before the section stopped reading
records when it cannot render, failed one of its five cases under load (output not kept); every run after that change
passed 5/5 (two runs).

## 4. Deviations from the plan, and why

1. **The reject swipe ships in PR-3** (plan: PR-4), as the brief asks, in exactly the plan's non-colliding form: section rows
   only, armed only on a touch starting on a row at rest with no pane open and ≥ 400 ms after one closed, travel ≥ 2× vertical,
   commits past half the width with a snap stop, same action and Undo. Feed cards keep SW-1 (e2e). O1 stays open.
2. **Heading "More records"**, not the placeholder "More verified records": a Demo or failed-import record can be a row, and
   "verified" would then be untrue. Plus one line saying how the rows are ordered (F1: rankings by the documented method). The
   UX lead may rewrite both within the scanned rules.
3. **"Closed a trade this week"**, not "Closed a record this week": a record is not closed; a trade is. Same input (last close
   within 7 days of asOf).
4. **Reason choice** (the plan lists the templates, not when each is used): "New here this month" first (it is the fact a reader
   cannot see elsewhere), else the holding period; a second row in the same bucket uses "Closed a trade this week" when true, so
   two rows never read the same.
5. **Each page's section shows new faces first** (traders shown in an earlier section of the same list go last). Without it every
   page repeated the same top three of the pool.
6. **The section is not a `.row`** (a sibling full-height snap card). The PR-1 and PR-2 e2e and the pager count `.feed > .row`
   as cards; a section row there would shift every index and SW-1's keys.
7. **Follow and "…" sit outside the swipe container**; only the name/reason part swipes. A popover inside a horizontal scroller
   is clipped by it. At 375 the swipe area is about 200 px, so "half" is about 100 px.
8. **The sheet carries the F3 line itself** ("Not investment advice. Past performance does not guarantee future results."): the
   modal covers the page footer that carries it for the feed.
9. Kept from PR-2: "Not interested" also stays in the pane header (PR-2 deviation 1; the business lead asked to keep it there).

## 5. Known limits

- **Holding-bucket cap**: a population concentrated in one bucket (or two traders in a second) shows no section (needs 3 rows,
  ≤ 2 per bucket; plan rule, never relaxed). The PR-1 load fixture is such a population. What to measure: share of feed pages
  with a section.
- **The pool is the 200 candidates' traders**, like exploration: a trader outside the 200 is never a row (see carried items).
- **Native fling**: a quick flick shorter than half the swipe area can carry past half and commit (the browser decides where a
  flung snap lands); a slow drag under half always snaps back. Undo covers it for 5 s. A trackpad's horizontal scroll never
  commits (unarmed without a touch) but can open the sheet.
- After a hide the section shows 2 rows until the next page load (no backfill, so nothing moves under the finger).
- At launch every account is under 30 days old, so every row reads "New here this month" for the first month (true).
- At 375 the sheet's header cuts a long name to a few letters to keep the handle whole (one line; stacking is a UX call).
- The kept list holds the pool for its cursor's lifetime (48 h at most); names and account age are read fresh per page.

## 6. Carried items

| Item | Where it goes | Why not here |
|---|---|---|
| Exploration pool beyond the 200 candidates; ≥ 80% of eligible traders in the first 120 cards within 7 day seeds (business lead PR-1 demand 3) | a PR-1b, before eligible traders pass about 35 | It changes PR-1's candidate SQL, the cursor's limit (`FEED_CANDIDATES`) and its load budget for every viewer; PR-3's plan scope is the section ("inserted after diversity"). The section's own pool has the same ceiling. |
| Score discount per card a trader already has; hyperactive traders recurring in the same order every 10 cards (business lead PR-1 taste) | the same PR-1b, with the skewed fixture's acceptance (no repeated 3-trader sequence in the first 60, caps unchanged) | It changes `mixFeed` for every viewer and PR-1's pinned shares (hyperactive ≤ 27 of the first 60, exploration 100% new); outside the section's scope. |
| "Not interested" on section rows | **done** | — |
| No-JS hide line linking to the list | **done** | — |
| Pane header cutting long names | **done** (handle whole; name gives way) | stacking name over handle would break PR-2's same-line assertion; UX call |
| PR-3b profile row | waits on **O2** | not built |
| O1 (reject placement), O3 (90 days) | owner | defaults kept |
| Plan P5: the suggestion word list into `scripts/compliance.ts` | owner (protected path) | `lib/copy.test.ts` enforces it meanwhile |
| Counsel packet item 7 (is an impersonal section the same class as the feed) | owner, before real viewers | not blocking the build (plan §7) |
| UX older items: a sign-in return path, "Manage hidden traders" in the menu, state said twice on the toggle, the 320 px avg-return tile | UX lead | unchanged |

## 7. Checks

| Check | Result |
|---|---|
| Merge of main (PR #19) | clean, no conflict; pushed |
| Schema ×2 on my database (`ss_eng_pr3`, Postgres 16), seed | idempotent; no schema change in this PR |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | **595 tests, 584 pass, 11 skipped (LOAD), 0 fail**, all three runs |
| `LOAD=1` feed / sync / follows | **5/5, 5/5, 1/1** (numbers in §3; fleet of 500 traders through 8 callers 12,456 ms, bound 60 s; delete a trader referenced by 100,000 viewers 86 ms; purge of 100,000 ended exclusions 274 ms) |
| `CI=1 npm run build`, stdin closed | each first run stops on the framework's security advisory (tool output; nothing upgraded); retry exit 0 |
| `npm run test:e2e` ×2 (fresh `next start`, vendor fake configured, own database) | **109 passed, 3 skipped, 0 failed** both runs (4.4 / 4.2 min). PR-1 and PR-2 committed screenshots the run rewrites were restored with `git checkout` |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` license line (local `node_modules`) |
| `node scripts/autopilot.ts guard main` | ok |

Screenshots (`screenshots/pr3/`, light and dark unless noted): `section-signed-out-375`, `section-signed-out-1280`,
`section-signed-in-375`, `row-menu-375`, `row-hidden-undo-375`, `reject-swipe-undo-375`, `sheet-from-row-375`,
`sheet-from-row-1280`, `sheet-from-swipe-375`, `nojs-section-375` (light), `nojs-hidden-line-375` (light).

## 8. Policy and compliance (COMPLIANCE §1)

1. Performance: rows show no number (e2e scans each row); the sheet shows the record with the F3 line at its end (corrected in fix
   round 1: at 375×667 the line sat at y 1,120, below the fold, at parity with the page footer elsewhere; it was not "in view";
   fix round 1 adds the sheet's own skip link to it); ordering by the
   documented TR-9 lower bound, losses equal (tests); no endorsement words ("Suggested", "Recommended", "Top", "Best", "AI"
   scanned out).
2. Personal data: nothing new stored; signed out nothing read about a viewer (query-log test); signed in one read keyed by the
   viewer; no event rows; H4 unchanged (no real viewer before the Privacy text).
3. Money, 4. messaging/tracking: none. 5. User text: none; reasons are fixed templates without a ticker slot. 6. Sign-up: unchanged.
7. Vendor or dependency: none. 8. Screen reader and keyboard: rows are links (Enter opens the sheet, Esc closes, focus returns),
   every control ≥ 44 px, the swipe has the menu as its button, Undo is `role="status"` and focused, reduced motion snaps
   instantly. 9. Security: no new action; the hide uses PR-2's validated, session-bound action; the style rule interpolates only
   handles that passed the pattern. 10. Claims: heading and reasons true by construction (tests). 11. Checkout: no.
No third-party company is named in the code, copy or this log.

## 9. Cleanup

Test users and fixtures deleted by each test (pass or fail); debug fixtures from manual checks deleted; my database
`ss_eng_pr3` dropped after the last run; the e2e servers and the vendor fake stopped with their runs, and my manual server
stopped. No other database touched.

## Fix round 1

Date: 2026-10-23. Inputs: `test-pr3-tester.md` (2 Medium, 2 Low), `committee-pr3-business-lead.md` (COMPLIANCE PASS, one
blocker, copy demands, PR-1b accepted), `committee-pr3-ux-lead.md` (1 blocking, 12 follow-ups). Product diff of this round
(no tests, e2e or logs): 10 files, **+99 / −66**; PR-3 in total stays far under 800.

### What changed

| # | Finding | Fix | Where | Proof |
|---|---|---|---|---|
| 1 | **Blocker** (business lead 1, UX 1): a fast 50–60 px flick hid a trader for 90 days; `swipeOutcome` read only where the scroll stopped | The reject commits only when **both** hold: the row rests past half its swipe area **and** the finger's own travel toward the tray, `touchend` clientX − `touchstart` clientX, is at least half the row card (`.srow-wrap`, 343 px at 375, so ≈ 172 px). Momentum never counts. | `lib/discovery/reject.ts#swipeOutcome` (two new arguments), `app/suggest-row.tsx` (travel kept from `touchstart`/`touchmove`/`touchend`) | Unit: 49%/51% restated against the row card; a 40% flick that the fling carried to the tray's end, a 50 px flick, enough travel but resting under half, and unarmed: all `back`. E2e (375, CDP touch, 4 ms steps, no hold): flicks of 40% of the card (136 px), 50 px and 60 px write nothing and the row is at rest; a slow 55% drag commits. **Seen failing:** with the travel check removed, the 136 px flick committed (`scrollLeft` 0). |
| 1b | At 320 (UX 2): the tray was wider than the row, so the swipe never armed | The tray now reads **"Hide"** (item 5), so it fits at 320: the gesture works there under the same travel rule (e2e: a 50 px flick writes nothing; a slow drag past half the 286 px card commits; Undo; then the menu path hides). Where a tray is still wider than its row (very large text), the row never reads as at rest and the swipe never arms: **fails safe**, the "…" menu stays the way (documented in `suggest-row.tsx`; the e2e branches on the measured geometry and asserts the snap-back in that case). | `lib/copy.ts`, `app/suggest-row.tsx` | e2e both runs: "320: tray fits; row card 286 px, swipe area 106 px" |
| 2 | **Medium 2** (tester, spec): the section was ordered by weight × biggest recent move, not by the TR-9 lower bound | `sectionPool` sorts by the lower-bound weight alone; ties by the number of closes counted at asOf (more evidence), then user id (deterministic). Sign-invariant: a mirrored loss has the same weight and count. | `lib/discovery/section.ts`, `lib/feed.ts` (`TraderFacts.n` replaces `last`) | Unit: the tester's construction (40 closes each; +5.4% raw average with a +100% last close and score 9 vs +3% steady with score 0.1): the steady record ranks first; weight-0 ties: more closes, then lower id, never the bigger move. 200-seed sign-invariance test unchanged and passing. DB: the pool's weights are non-increasing. |
| 3 | **Medium 1** (tester, `lib/feed.ts`): 8 candidates sharing one holding period → no section | The spares are chosen with `capped(candidates, 8)`: at most 2 per holding period **while choosing**, from every candidate, never a fixed slice. `chooseRows` is `capped(…, 3)` or `null`. | `lib/discovery/section.ts#capped`, `lib/feed.ts` | Unit: 12 bucket-1 candidates first → spares `[1, 2, 13, 14, 15]`, rows `[1, 2, 13]`. DB: 30 of 40 traders in one period with the bigger moves (lead under either order) → 3 rows, 2 of that period; **seen failing** on the old code (`a section`). LOAD: 50 heavy traders, 45 in one period: a section on pages 1 to 3 (rows in buckets 1, 1, 4 / 1, 1, 2 / 1, 1, 2), p95 268 ms. |
| 4 | Copy (business lead 2 and 3, UX 9) | One reason template, the holding period, on every row ("Closed a trade this week" and "New here this month" deleted with their `reasonFor` branches). Heading **"Other traders' records"**, line **"Ordered by how much evidence each record has. Losses count the same as gains."** (the UX lead's proposal; passes the scanner; true signed in or out; "The same for everyone." gone). | `lib/copy.ts#SECTION`, `lib/discovery/section.ts#reasonFor`, `app/suggest-section.tsx` | Copy test: every SECTION string scanned (11 strings, `week`/`fresh` asserted gone). E2e: heading and line exact; every row matches "Typical holding period: " and neither removed template. DB: every row's reason is its record's bucket. |
| 5a | Tester Low 1: the 10 cards around the section came from the slots before the display filter | `sectionCandidates` takes the page's displayed items (hidden traders' cards removed); after the reads, candidates on the first 10 cards actually rendered (a dropped importing/deleted card moves the next one in) are left out too. | `lib/discovery/section.ts`, `lib/feed.ts` | Unit: the tester's repro (hidden trader on slots 31 and 35, trader P on slot 40): P is no longer a candidate. |
| 5b | UX 3: tray label cut mid-reveal | Label "Hide" (whole at the commit point), and where the browser supports scroll-driven animation the label is invisible until wholly revealed (no motion: an opacity step). | `lib/copy.ts`, `app/globals.css` | E2e: mid-drag at the commit point the label's box is inside the row and opacity 1; back under half it is either whole or hidden (`tray-label-mid-375`). |
| 5c | UX 4: hiding all three rows left an empty full-height stop | When no row is left the style rule collapses the section (`:has()`, handles that passed the pattern only); the card after it takes its place at the top; Undo is focused, and when the bar closes focus lands on that card's name, on screen. | `app/feed-hides.tsx` | E2e (375): three menu hides → 3 exclusions, the section hidden, the next card at top 0, Esc → focus on its `.who`, in viewport (`section-all-hidden-375`). |
| 5d | UX 7 (open since PR-2): Undo timed out after a click or tap | The bar pauses once any pointer goes down on it (touch, pen or mouse), as well as on mouse hover and keyboard focus. Not focus-within: the app focuses Undo itself after every hide, so focus-within would never time out, and PR-2's e2e pins the 5 s close after a mouse hide with no further contact. | `app/feed-hides.tsx` | E2e: after a swipe hide, a tap on the bar's text, 5.6 s later the bar is still up; then Undo. |
| 5e | Tester Low 2, UX 5: the sheet's disclaimer was below the fold and the page's skip link is behind the modal | The sheet's first stop is its own skip link, "Skip to the disclaimer" (shown only on keyboard focus); it focuses the F3 line at the sheet's end. The footer-position line stays (business lead: no move to the top in this PR). | `app/suggest-row.tsx`, `app/suggest-section.tsx`, `app/globals.css`, `lib/copy.ts` | E2e: Enter on a row → the skip link focused and visible; Enter → the line focused and wholly in view (`sheet-skip-375`, `sheet-disclaimer-375`). |
| 5f | UX 10: `aria-haspopup="dialog"` in the no-JS HTML | Set only once the sheet is ready. | `app/suggest-row.tsx` | E2e no-JS: no `a.sopen[aria-haspopup]`. |
| 5g | UX 11: no-JS hide line's link 36 px tall | 44 px (`inline-flex`, `min-height`). | `app/globals.css` | E2e no-JS: height ≥ 44. |
| 5h | UX 6: the pane header's long-name fix did not hold (name width 0; handle cut by its container) | The name link asks for room for the whole handle plus the start of the name (`min-width: min(100%, (handle length + 4)ch)`, inline per pane), so the header wraps the badge (or the link) before squeezing the name away; the name ends in an ellipsis; the handle stays whole. A first try (`flex-basis: 14em`) pushed every signed-in pane header to three lines and moved the chart under the feed's mid-height swipe (PR-3's SW-1 e2e caught it); the per-handle width keeps short handles on the old two lines. | `app/pane.tsx`, `app/globals.css` | E2e at 375 and 320: name shown > 20 px and truncated, the handle's right edge inside the link (`pane-header-long-375`, `-320`). PR-2's same-line assertion unchanged and passing. |
| 5i | Log line claiming the sheet's F3 line was "in view" (business lead 4, UX 5) | §8.1 corrected above. | this log | — |

### Plan deviation recorded

**The section's order is the TR-9 lower bound, not the plan's `rankTraders` formula.** Plan §1 PR-3 prescribed `rankTraders`
(weight × the trader's best card score). The owner's acceptance criterion 8 says the ranking inside the section "uses the
confidence lower bound, never raw averages", and the section's own line says records with more evidence come first; the
criterion outranks the plan formula. Ties: closes counted at asOf, then user id. The feed's own ranking is unchanged.

### Tests changed (restated, none loosened)

- `section.test.ts`: the pool test now expects the weight order (stricter than `rankTraders`'s mixed order) and checks the
  weights are non-increasing; the reasons test is restated as "every reason is its record's bucket" (the business lead's
  demand 2 deletes the `new` and `week` outcomes); the recognizer's existing cases pass the new arguments (full travel), so
  each keeps its outcome, and the new travel cases are added. +3 tests (TR-9 construction, one-period run, displayed near cards).
- `copy.test.ts`: the scanned list swaps the two deleted templates for the new skip label (11 strings, as before) and asserts
  the deleted keys are gone.
- `feed.section.test.ts`: the reason assertion narrows from "hold or week" to "hold, and its bucket"; the fixture gains
  optional `hold`/`ret` with the old defaults; +1 test (one-period run).
- `feed.load.test.ts`: +1 LOAD case (50 heavy, 45 in one period).
- `e2e/section.spec.ts`: heading and line text follow the copy change; the reason regex narrows to the one template; the two
  commit swipes use 55% of the row card instead of 90% of the swipe area (the new threshold; the "right after the sheet
  closes" swipe is the same 55% so the quiet guard, not the threshold, is what stops it); new assertions as listed above.
  No assertion removed. E2e test count unchanged (109); unit 595 → 600.

### Measurements

| Budget | Bound | Measured |
|---|---|---|
| Signed-out feed p95, 12 heavy | < 400 ms | 163 ms |
| Signed-out feed p95, 50 heavy, PR-1 fixture | < 400 ms | 230 ms |
| Signed-out p95, 50 heavy, a section on every page | < 400 ms | 296 ms; signed in (5 follows, 5 hides) 244 ms (< 800) |
| Signed-out p95, 50 heavy, 45 in one holding period (new) | < 400 ms | 268 ms; a section on pages 1 to 3 |
| Raw HTML, 50 heavy, section on every page | ≤ 500 KB | 282 / 335 / 289 KB (14 / 15 / 14 KB gzipped), both e2e runs |

### Checks

| Check | Result |
|---|---|
| Own database `ss_eng_pr3f1` (created as the superuser, owned by the shared role), schema ×2, seed | idempotent; the shared `stock_social` never written |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | **600 tests, 588 pass, 12 skipped (LOAD), 0 fail**, all three runs |
| `LOAD=1` feed / sync / follows, one at a time | **6/6, 5/5, 1/1** (fleet of 500 through 8 callers 10,259 ms; purge of 100,000 ended exclusions 252 ms) |
| `CI=1 npm run build`, stdin closed | each first run stops on the framework's security advisory (tool output; nothing upgraded or acted on); the retry exits 0 |
| `npm run test:e2e` ×2 (fresh `next start`, vendor fake configured, own database) | **109 passed, 3 skipped, 0 failed** both runs (4.0 / 4.1 min); PR-3's committed screenshots the run rewrites were restored with `git checkout` |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` license line (local `node_modules`) |
| `node scripts/autopilot.ts guard main` | ok |

Screenshots (`screenshots/pr3-fix1/`, light and dark unless noted): `section-signed-out-375`, `section-signed-in-375`,
`sheet-from-row-375`, `sheet-skip-375`, `sheet-disclaimer-375`, `tray-label-mid-375`, `reject-swipe-undo-375`,
`row-hidden-undo-375`, `section-all-hidden-375`, `pane-header-long-375` (light), `pane-header-long-320` (light),
`nojs-hidden-line-375` (light).

### Follow-ups (recorded, not in this round)

| Item | From | Note |
|---|---|---|
| Rows cramped at 320 signed in (Follow and "…" leave the name ~94 px; the reason wraps; the third row ends inside the section's own scroller) | UX 8, business lead 5 | Put Follow and "…" on their own line under about 360 px, or on the name line; with one reason template the wrap is shorter now |
| Section block two-thirds full at 375×667 | business lead 5, UX 9 | Centre the heading-plus-rows block vertically |
| Focus ring inset and clipped at 1280; "…" popover elevation (PR-2 follow-up 2) | business lead 5 | — |
| A pane header with a 20-character handle uses three lines at 375 (four at 320) | this round | The price of a whole handle; stacking name over handle would change PR-2's same-line assertion (UX lead's call) |
| The swipe has no visible cue | UX 12 | Owner decision under O1; the menu is the visible path |
| Still open from PR-2: Follow plus "Not interested" both true, sign-in return path, "Manage hidden traders" in the menu, state said twice on the toggle, focus after "Show again" | UX 13 | unchanged |
| "Drag across the chart…" hint reads as a text field; 320 avg-return tile | UX older | unchanged |
| Reviewer checklist: gestures tested with fast flicks; "in view" claims checked by box; a discovery surface's overlap with the list counted | business lead 7 | for the reviewer |
| Plan P5 (word list into `scripts/compliance.ts`), counsel item 7, O1, O3, PR-3b (O2) | earlier | owner |

### Next PR: PR-1b (before PR-4; business lead §5, accepted)

Scope, and nothing else:
1. The exploration pool includes eligible traders outside the 200 candidates (best recent close, one card each, seeded order).
2. The section's pool is every eligible trader, not the 200's traders. Traders with no card earlier in the list come first;
   within each group the order stays the TR-9 lower bound (criterion 8 unchanged).
3. A per-card score discount, so the hyperactive traders stop recurring in the same order.

Acceptance test (one fixture, signed out, 7 consecutive UTC day seeds; 40 hot traders, 60 ordinary traders, 5 newcomers
with 5 or 6 closes):
- ≥ 80% of eligible traders appear as a card or a section row in the first 120 cards (with those pages' sections) at least
  once over the 7 seeds, and every newcomer appears at least once.
- In every section rendered while an eligible trader with no card earlier in the list exists, at least 2 of the 3 rows are
  such traders.
- Skewed fixture: no 3-trader sequence repeats in the first 60 cards; hyperactive traders ≤ 27 of the first 60; the
  diversity caps and the sign-invariance property tests unchanged.
- Budgets: signed-out p95 < 400 ms on the 50-heavy fixture plus 100 light traders; page HTML ≤ 500 KB.
- ≤ 400 product lines.

### Policy and compliance (COMPLIANCE §1, this round)

1. Performance: rows still show no number; the order is now exactly the documented TR-9 lower bound (F1), losses equal; the
   sheet's F3 line is one keyboard step away. 2. Personal data: nothing new read or stored (the users read drops
   `created_at`). 3, 4, 6, 7, 11: none. 5. User text: none. 8. Accessibility: whole tray label, skip link in the modal, Undo
   pauses on any contact, focus after the last row lands on a visible card, 44 px no-JS link, no false popup without JS.
   9. Security: the new style rule interpolates only handles that passed the pattern. 10. Claims: heading and line true
   signed in or out; one reason template, true by construction. No third-party company is named.

### Cleanup

Test users and fixtures deleted by each test (pass or fail); debug users deleted; `ss_eng_pr3f1` dropped after the last
run; the e2e servers and the vendor fake stopped with their runs. No other database touched.
