# F-2 PR-2 · Follow and "not interested" (engineer)

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys`, after merging main at `8feddb9` (PR #18, F-2 PR-1, squash). Plan:
`plan.md` §1 "PR-2 · Follow and 'not interested'", §4, §5, §8 and §9. Feature criteria: 1 (follow and unfollow from
the profile and the pane, private; "feeds the ranking" is PR-5), 4 (the 90-day exclusion for "Not interested" and
unfollow; "lowers similar" is PR-5) and 5 (deletion removes follows and exclusions the same day).
No dependency, no protected path, no CI or `package.json` change, no event table of any kind (plan demand C).
Product diff (no tests, no e2e, no logs): 23 files, +524 / −30.

## 1. What was built

| Part | Where | What it does |
|---|---|---|
| Schema | `db/schema.sql` | `follows(viewer_id, trader_id, created_at)`, PK (viewer, trader), `check (viewer_id <> trader_id)`, index `(trader_id)`. `viewer_exclusions(viewer_id, trader_id, created_at, until, reason in ('not_interested','unfollow'))`, same PK and check, indexes `(trader_id)` and `(until)`. Both `on delete cascade` on either account. `create table if not exists` and `schema_add_index` only. Plus one index, `users_referred_by` (§3, item 4). |
| Weights | `lib/discovery/weights.ts` | The owner's weights pinned: like +3, opening swipe +2, "Not interested" (= the reject swipe) −4. `EXCLUSION_DAYS = 90` (O3 default). Pure. |
| Exclusions in a paged feed | `lib/discovery/exclusions.ts` | `splitExclusions(rows, asOf, now)`: made at or before `asOf` and running at `asOf` → **shaping** (the trader's cards leave the ranked list before the mix, so the caps hold exactly); made after `asOf` and running now → **display filter** (dropped from each slice in place). `shapeList` = PR-1's `mixFeed` over the ranked list minus the shaping set. `displayFilter`. Pure. |
| Viewer data | `lib/follows.ts` | The only module that reads or writes the two tables (with the deletion step and the purge). `traderId(handle)` checks the pattern before any query. `follow` (also ends a running exclusion; returns `first`), `unfollow` (writes the `unfollow` exclusion only if a follow existed), `exclude` (a running exclusion is extended and keeps its start; an ended one starts again), `endExclusion` (`until = now()`, never a delete), `exclusionsFor`, `followingAmong`, `ownLists`. Every read is `where viewer_id = ${viewer}`; nothing counts. |
| Actions | `app/discovery-actions.ts` | `follow`, `unfollow`, `notInterested`, `undoNotInterested`: signed in only, handle validated, never yourself. Form variants (`followForm`, …, `showAgainForm`) for the no-JS path. |
| Feed | `lib/feed.ts#loadFeedPage(after, { viewer })`, `lib/viewer.ts` | The page and its paging action get the viewer id from `lib/viewer.ts#viewerId` (an id, nothing else) and pass it in. Signed in: the viewer's exclusions shape or filter the list (above); the kept PR-1 list now also keeps the ranked list before the mix, so a shaped list is re-mixed from the same cached ranking. `FeedPage.viewer = { id, following }`. Signed out: no viewer read at all (unchanged). |
| Follow control | `app/follow-button.tsx` | "Follow" / "Following", `aria-pressed`, ≥ 44 px, optimistic (reverted with "Couldn't save that. Try again." on refusal); other copies of the same trader's pane follow along. First follow: `role="status"` "Following @x. Only you can see this." Unfollow: "Unfollowed @x. Hidden from your feed for 90 days." with Undo for 5 s. Signed out: a link "Follow" named "Sign in to follow @x" → `/login`. A plain form posting the action without JS. On the profile header (not on your own) and in the pane header (not on your own record). |
| "Not interested" | `app/not-interested.tsx`, `app/feed-hides.tsx` | A "…" `<details>` menu (works without JS) with "Not interested in @x", in the pane header, signed in only, never on a feed card. With JS the feed hides the trader's rows in place (a style rule, so a page appended meanwhile drops them too), the card after the reader's moves to the top instantly (no motion), and a fixed `role="status"` bar says **"Hidden for 90 days."** with Undo, focused, for 5 s; then focus moves to that next card. Undo restores the rows where they were. Without JS the form posts and the feed comes back without them. |
| Lists | `app/me/following/page.tsx`, `/settings` link | Viewer only, `noindex`: Following (each with its control); Not interested, "until <date>", with "Show again" (ends the exclusion). Linked from `/settings` ("Following and hidden traders"). |
| Pager | `app/feed-pager.tsx` | The 6 observed rows before the end skip rows hidden by "Not interested" (they can never come into view). |
| Pane header | `app/globals.css` | `gap` on the pane's name link: "Name@handle" now reads "Name @handle" (the PR-1 UX item). |
| Deletion | `lib/delete.ts#deleteProfile` | First step, in one transaction with the `deleted_at` mark, before the vendor call: delete follows and exclusions made by the account or naming it. The cascade covers anything written meanwhile. |
| Purge | `lib/discovery/purge.ts`, `app/api/sync/route.ts` | `purgeDiscovery()` after the connection tick and the deletion retries, before `syncTick`, in a `try` (never a branch: traders are claimed exactly as before). Session advisory lock `(3, 0)` tried, never awaited (USER_LOCK is 1, ATTEMPT_LOCK 2); the loser skips only the purge. Box ≤ 30 s; batches of 10,000 by the `(until)` index; deletes exclusions with `until < now() − 1 day`; a cut call resumes on the next tick. |
| Copy | `lib/copy.ts#FOLLOW` | In the banned-claims walk (`allCopy`). The durations come from `EXCLUSION_DAYS`. |

## 2. Tests

Unit/DB: **559 → 574** (564 pass, 10 skipped LOAD, 0 fail). E2e: **100 → 102** passed (3 skipped, provider and mail-sink
variables). No PR-1 assertion changed: the guard tests gained cases only (the query-log hook now also records each
query's parameters; the signed-out assertions are as they were). Honest note on order: the pure modules and the
property test were written in the same step, then the DB tests before the UI; not every test was seen failing first.

| File | Tests | Covers |
|---|---|---|
| `lib/discovery/exclusions.test.ts` | 3 | Weights pinned (−4, +3, +2; 90 days). `splitExclusions` boundaries: shaping vs. display filter; Undo/"Show again" after `asOf` and a purge mid-day change nothing for a same-day cursor; excluded at 89 d 23 h 59 m, back at 90 d + 1 s. **Property, 1,000 seeded feeds, a hide between pages 1 and 2** (half of them hide a trader already rendered on page 1; 1, 2 or 3 hides): pages 1 to 3 never repeat a card; every card of the no-hide list except the hidden trader's appears in the same relative order; the hidden trader appears nowhere after the hide; every 10-card window ≤ 2 + 2·hides (4 / 6 / 8); the next page 1 obeys the caps exactly and holds no hidden trader. |
| `lib/discovery/imports.test.ts` | +2 | `exclusions.ts` and `weights.ts` import nothing that reads the database, the session or a viewer's data. |
| `lib/follows.test.ts` | 6 | Static: only `lib/follows.ts`, `lib/delete.ts` and the purge name the tables in SQL; every read in `lib/follows.ts` is keyed `viewer_id = ${viewer}`; no `count(`; no copy mentions followers; no share image, story, pane-chart, sitemap or robots file imports follow code. Handle validation (NUL byte, non-strings, unknown). Follow/unfollow/exclude/end semantics (rows end, never deleted; first-follow flag; unfollow without a follow writes nothing). Feed end to end: a hide after page 1 drops the trader from page 2 in place (same slice positions), signed out and another viewer unchanged, Undo restores, a new page 1 has no hidden trader and holds the caps, the 90-day boundary by backdated rows. Purge: boundary (ended 1 d + 1 s deleted, 23 h 59 m kept, running kept), time box cut and resume, two concurrent callers (one purges, the other returns at once). Deletion as viewer and as trader → zero rows; a failed vendor call still leaves zero. |
| `lib/feed.signed-out.test.ts` | +2 | The page and the paging action read the viewer only through `lib/viewer.ts#viewerId` (an id) passed to `loadFeedPage`. Signed in, pages 1 to 3: every query naming `follows` or `viewer_exclusions` is `where viewer_id = $1` with the session's viewer as `$1` (another viewer's rows exist); none names `trade_likes` or `discovery_events`. |
| `lib/sync.test.ts` | +1 | Two concurrent cron callers in the route's order: exactly one runs the purge, the other skips only the purge, **both claim traders**, every trader synced once; the route calls the purge after the deletion retries and before `syncTick`, inside a `try`. |
| `lib/follows.load.test.ts` (LOAD=1) | 1 | A trader followed (50,000) and hidden (50,000) by 100,000 viewers deleted in < 5 s, zero rows left; 100,000 ended exclusions purged in one call ≤ 30 s. |
| `e2e/follow.spec.ts` | 2 | (1) Keyboard only, 375 px light and dark: profile follow (44 px, `aria-pressed`, first-follow line), pane follow and unfollow with Undo, pane header spacing, tap-to-feedback < 100 ms, `/me/following` from `/settings` (`noindex`, privacy line), signed out → "Sign in to follow @x" → `/login`, no-JS follow, public pages and routes unchanged (share image and story byte-identical before/after; no viewer handle or "follower" on `/`, the profile, `/pane-chart`), deletion via `/settings` → zero rows in both tables. (2) "Not interested" in the pane (the "…" menu, 44 px, absent from cards): rows drop in place in order, the next card at the top, "Hidden for 90 days." with Undo focused; Undo restores; after 5 s the bar goes and focus lands on a card; page 2 appends without the trader, everything else in order; the trader's profile still lists every trade (TR-1); "Show again" on `/me/following`; the next feed has the trader again. |

## 3. Deviations from the plan, and why

1. **"Not interested" is in the pane header.** The plan puts the "…" menu on PR-3's section rows "only"; PR-3 is not
   built, so the action would have had no surface to test, screenshot or measure. The pane is one per trader, opened
   from a card, not a card itself ("never on feed cards" holds). PR-3 reuses `NotInterested` on its rows; the UX lead
   can drop it from the pane then if wanted.
2. **Unfollow also hides the trader from the feed for 90 days** (plan: unfollow writes the same exclusion; exclusions
   are honored on the signed-in feed). The status line says exactly that, with Undo for 5 s. Owner-visible: a viewer
   who unfollows might not expect it; if the owner prefers, the feed can honor only `not_interested` and the section
   both reasons (one line in `splitExclusions`'s caller).
3. **Signed out, Follow links to `/login`**, not `/login?next=…`: `/login` has no return path today (it sends a signed-in
   viewer to their own profile), so a `next` parameter would be ignored. Same pattern as "Sign in to watch".
4. **One extra index, `users_referred_by`** (partial, additive). Deleting any `users` row checks
   `users.referred_by_user_id` (`on delete set null`), which had no index: a scan of `users` per deleted account. The
   heavy check's 100,000 fixture viewers took minutes to remove without it.
5. **A follow ends a running exclusion** (following is the opposite choice); "Not interested" leaves a follow in place.
6. Known limit (logged, not fixed): a re-hide of a trader whose exclusion predated a cursor's `asOf` and ended during the
   session starts a new exclusion (`created_at = now()`), so on another server that cursor's list is re-mixed with the
   trader back in (the display filter still hides them). It needs hide, "Show again" in another tab, hide again within one
   session. Also, a cursor 24 to 48 h old whose list was shaped by an exclusion that ended and was then purged can be
   re-mixed. Both are within the PR-1 client's repeat guard (no card shows twice); a skip is possible.

## 4. Checks

| Check | Result |
|---|---|
| Merge of main (PR #18) | clean, no conflict; pushed |
| Schema ×2 on my database (`ss_eng_pr2`, Postgres 16), seed | idempotent; no `drop`, `truncate` or `delete from` in `db/schema.sql` |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | **574 tests, 564 pass, 10 skipped (LOAD), 0 fail**, all three runs |
| `LOAD=1 lib/feed.load.test.ts` | 4/4. 12 heavy: all-pages p95 132 ms (page 1 169); 50 heavy: 272 ms; late case weights-kept p95 333 ms; own-late p95 650 ms (PR-1's known limit, unchanged) |
| `LOAD=1 lib/sync.load.test.ts` | 5/5; fleet of 500 traders through 8 callers in 9,857 ms (bound 60 s), each once |
| `LOAD=1 lib/follows.load.test.ts` (×2) | delete a trader referenced by 100,000 viewers: **86 / 119 ms** (bound 5 s), zero rows; purge of 100,000 ended exclusions in one call: **240 / 286 ms** (box 30 s) |
| Tap to feedback (e2e, pane unfollow, next frame) | **1.9 to 9.0 ms** over seven runs (budget 100 ms) |
| `CI=1 npm run build`, stdin closed | first run stops on the framework's security advisory (tool output; nothing upgraded); retry exit 0 |
| `npm run test:e2e` ×2 (fresh `next start`, vendor fake configured, own database) | **102 passed, 3 skipped, 0 failed** both runs (4.3 / 4.2 min); two earlier full runs on the previous revision gave the same. PR-1's committed screenshots the run rewrites were restored with `git checkout` |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` license line (local `node_modules`) |
| `node scripts/autopilot.ts guard main` | ok |

Screenshots (`screenshots/pr2/`, light and dark each): `profile-first-follow-375`, `profile-following-1280`,
`pane-following-375`, `pane-unfollowed-undo-375`, `pane-menu-375`, `not-interested-undo-375`,
`not-interested-undo-1280`, `me-following-375`, `me-following-show-again-375`, `nojs-profile-following-375`.

## 5. Policy and compliance (COMPLIANCE §1)

Private: no count, list or name of followers on any page, card, pane, share image, story or `/pane-chart` (static scan
and e2e byte comparison); the trader is never told. No event rows. Nothing stored signed out (the actions refuse; the
feed reads no viewer table signed out). TR-1: a hide never touches a profile (e2e). Losses: exclusions remove a trader
at the viewer's request and never read a return; ranking unchanged. No celebration, no notification. A1: every action is
a button or a link, 44 px, `aria-pressed`, `role="status"` lines, focus handled on hide, Undo and expiry; no motion.
Honest duration copy from the constant. No dependency or vendor; the integrated vendor only. Privacy text for these two
tables is H4 (plan §5 inventory): no real viewer before it.

## 6. Carried, not in this PR

- Planner items left by PR-1, still for PR-3 (or a PR-1b): the exploration pool beyond the 200 candidates; a score
  discount per card a trader already has in the list (breaks the 5-trader rhythm); the import time on each close
  (`closed_trades.sell_imported_at`) that removes the late-sell read. PR-2 does not change the impersonal list, so none
  of them moves.
- Measure (plan): the share of sessions with two or more hides.
- PR-5 reads `follows` and `viewer_exclusions` with `WEIGHTS`; the purge extends to the event log.

## 7. Cleanup

Test users and fixtures deleted by each test; my database `ss_eng_pr2` dropped after the last run; the e2e server and
the vendor fake stopped with their runs. No other database touched.
