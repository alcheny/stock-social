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

1. Performance: rows show no number (e2e scans each row); the sheet shows the record with the F3 line in view; ordering by the
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
