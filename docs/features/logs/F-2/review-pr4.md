# F-2 PR-4 review: likes and gestures (independent reviewer)

Date: 2026-10-24. Branch `claude/adoring-euler-4469ys`, product diff `git diff origin/main...HEAD -- . ':!docs/features/logs'`
(28 files). Read against plan §PR-4, owner decisions O1/O3/O4 (O3 is the committee recommendation, pending the owner),
the tester log (CLEAN twice), business lead (PASS) and UX lead (PASS). Own database, own port (3491), own fakes (4120-4122).

## Findings

- non-blocking: no rate limit on like/unlike/hide. Same stance as follow and "Not interested": signed in only, one
  primary-key upsert or delete per call, idempotent, private to the viewer (nothing counted, nothing shown to others).
  Revisit with real auth / edge work.
- non-blocking: `likedAmong` joins `closed_trades` on `trade_key` without `user_id`. A sell id equal across two sources
  (`unique(source, external_id)` is per source) could mark a card "Liked" by the other trader's like. The card id filter
  limits it to the page; the likes list (`ownLikes`) already joins on `user_id`. Add `and t.user_id = l.trader_id` when
  next touching the file.
- non-blocking: touch Undo pause gap (UX 3 fix round 1): on touch the bar no longer stays open because focus moved to
  Undo; it pauses only while the finger touches the bar. Accepted by UX; follow-up as the committee set.
- non-blocking: double tap has no visible hint (discoverability is an owner call); the menu's Like is the documented route.
- checked, OK: schema additive and idempotent (`schema_add_column`/`schema_add_index`, `create table if not exists`), no
  drop/truncate/delete; both tables cascade on either user; `check (viewer_id <> trader_id)`; no foreign key on
  `trade_key` by design (a rebuild deletes closes, the like re-attaches by key).
- checked, OK: `trade_key` is a stored generated column; backslash doubling makes the `::bytea` cast literal; parity with
  `node:crypto` sha256 tested (incl. backslashes, `\x` prefixes, non-ASCII); a like survives `rebuildTrades`.
- checked, OK: actions take the viewer from the session only; ids are checked against `^[0-9]{1,18}$` (keys against
  64 hex) before any query; own trades and deleted traders refused; tampered ids answer `invalid`.
- checked, OK: hide moves the like into `trade_exclusions.liked_at` in one statement (data-modifying CTE); Undo restores
  the like with its original `created_at`, so the likes list order is unchanged.
- checked, OK: gestures pure and tested; a tap must move < 10 px and land off links/buttons/menus/charts; a scrolled row
  never counts; the reject arms only at rest, horizontal (≥ 2x), toward the side away from the opening swipe, and
  commits at half the card. No motion beyond following the finger; reduced motion honoured.
- checked, OK: weights `unfollow = -1` (90 days), trade reject −4 on the trader for 90 days, trade exclusion permanent;
  `traderPreference` read by nothing shown (PR-5 gated by H1).
- checked, OK: the restated section criterion test is stronger (asserts the unfollowed trader stays and carries exactly
  −1, ageing out at 90 days); the k-candidates loop now uses follows instead of unfollow rows, same coverage. Test count
  rises; `guard main` ok.
- checked, OK: privacy: no count, no liker list; `lib/likes.test.ts` scans every SQL naming the tables (viewer-keyed,
  no count) and that no share image, story, pane, profile or sitemap imports them. No event table, no event endpoint.
- checked, OK: POLICY: no celebration, no rewards for frequency, no third-party names; copy has no number.
- checked, OK: `/me/likes` pages 50 at a time by keyset (10,000-like heavy test, under 100 ms a page); noindex, signed in.
- checked, OK: account deletion removes likes and exclusions (made or naming) in the first transaction with follows.
- checked, OK: `?done=` renders only the exact value `trade-hidden`, signed in; anything else renders nothing.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (with DB) | 638 tests: 626 pass, 12 skipped (LOAD), 0 fail |
| LOAD, one file at a time | feed 6/6, follows 1/1, sync 5/5 |
| `node scripts/autopilot.ts guard main` | ok |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` license line |
| `CI=1 npm run build` (stdin closed) | passes (first run exited on an advisory printed by the tool; ignored as instructed) |
| `npm run test:e2e` (port 3491, vendor fake env) | 120 passed, 3 skipped, 0 failed (5.3 min) |

## Verdict

APPROVE (no blocking findings).
