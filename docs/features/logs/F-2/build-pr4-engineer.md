# F-2 PR-4 · Likes and gestures · engineer build log

Date: 2026-10-24. Plan: `plan.md` (PR-4), amended by the owner's decisions of 2026-10-24 in
`docs/features/F-2-personal-discovery.md` (O1, O4) and the committee's O3 recommendation (owner silent), and the
business lead's O4 ruling (`committee-pr1b-business-lead.md` §5).

## What was built

- **Private likes (+3).** Double tap on a feed card's body = like; double tap again = unlike. Two taps within 300 ms
  and 24 px, each a press that moved under 10 px, not on a link, button, menu or chart (`lib/discovery/gestures.ts`,
  pure). `touch-action: manipulation` on the card. The double tap clicks the card's own Like button, so gesture and
  button are one action. The keyboard and screen-reader route is that button in the card's new "…" menu
  (`app/card-menu.tsx`): accessible name "Like. Only you can see likes.", `aria-pressed`, ≥ 44 px, a polite status
  line ("Liked. Only you can see likes." / "Like removed."). The liked state is quiet: a small muted ♥ by the menu, the
  icon filled. No count, animation, vibration or celebration anywhere. A like on a loss is the same as on a gain.
  Optimistic toggle (a like is neither money nor a record); a refusal puts it back. Signed out: no menu; a double tap
  shows one inline line "Sign in to like trades." with a link. Never on the viewer's own trade.
- **Feed card reject swipe (O1).** Swiping toward the profile still opens the pane natively (SW-1). Swiping the other
  way (finger to the right) on a card at rest moves the card with the finger and, when the finger travelled at least
  half the card, hides that trade: "Trade hidden." with Undo for 5 s (`app/feed-hides.tsx`, reused, now with a
  trade-level hide that drops only that card). Shorter snaps back (150 ms, none under reduced motion). Same guards as
  the section swipe: arms only at rest, not with a pane open, not within 400 ms after the row came back from its pane
  (a row counts as away while a quarter or more of its pane shows), horizontal only (≥ 2× vertical); the native snap
  stop on the row is unchanged. Keyboard route: "Hide this trade" in the same "…" menu.
- **O3.** A rejected trade stays hidden for good: a `trade_exclusions` row (no expiry), dropped from that viewer's
  feed pages as a gap in place (`lib/feed.ts`, one extra read keyed by the viewer, in the page's parallel reads). The
  trader-level −4 it carries counts for 90 days (`TRADE_REJECT_TRADER_DAYS`). No management screen (5 s Undo).
- **O4.** `WEIGHTS.unfollow = -1`, signed in only, never a hide, ages out at 90 days (`UNFOLLOW_DAYS`; the stored
  `unfollow` row's `until`). The suggestions section no longer leaves out an unfollowed trader
  (`lib/follows.ts#sectionSkips` reads only "Not interested"). The F-2 criterion is restated in the feature file.
- **Stored, not yet used for what is shown.** Likes, trade rejects and unfollows are stored and readable as PR-5's
  input (`lib/likes.ts#signalsFor` → `lib/discovery/weights.ts#traderPreference`, tested), but nothing shown is
  ranked by them before PR-5 (H1, counsel). The only effect on what a viewer sees now is their own hidden set (a
  rejected trade) and their own likes list. No event table of any kind; no request to any event endpoint (e2e).
- **Schema (additive, idempotent).** `closed_trades.trade_key` generated as
  `encode(sha256(replace(sell_id, chr(92), chr(92) || chr(92))::bytea), 'hex')` stored, indexed (the primary path
  worked; no fallback needed). `trade_likes` and `trade_exclusions` `(viewer_id → users cascade, trade_key,
  trader_id → users cascade, created_at, primary key (viewer_id, trade_key))`, index on `trader_id`; likes also on
  `(viewer_id, created_at desc, trade_key desc)` for paging. No foreign key on `trade_key`: a like whose close is gone
  after a rebuild is kept and ignored on read.
- **Likes list.** `/me/likes` (signed in, noindex): the viewer's own likes, newest first, 50 a page by keyset
  (microsecond `created_at`, then key), "Older likes", Remove (a form, with or without JavaScript), linked from
  `/me/following`. Each row links to the trade's page.
- **Deletion.** The first step of `deleteProfile` deletes `trade_likes` and `trade_exclusions` made by or naming the
  account, before the vendor call (cascade covers the rest).
- **No JavaScript.** The card's menu is a `<details>` with two forms: Like posts and lands on `/me/likes`; "Hide this
  trade" posts and lands on the feed.

## Tests (first, then code)

- `lib/discovery/gestures.test.ts` (+4, pure): 299/300 ms like, 301 ms not; 24 px; tap slop; links/chart not taps;
  reject 49% back, 50/51% commit, unarmed never, 399 ms never, diagonal scrolls; O4/O3 weights (−1 below an identical
  trader for 90 days then equal; trade reject's trader −4 expires at 90 days; like +3).
- `lib/likes.test.ts` (+7): table names only in `lib/likes.ts` and `lib/delete.ts`, every read keyed by the viewer, no
  count, no public module imports them; no like copy carries a number; `trade_key` = node:crypto sha256 for `a\b`,
  `\x41`, `\\`, `\001`, a trailing `\`, non-ASCII and a quote; like/unlike/reject/undo, never your own, malformed ids
  refused; key stable across `rebuildTrades`, a like and a reject re-attach to the rebuilt close; the feed drops a
  rejected trade for that viewer only; a like whose close is gone is kept and ignored; 10,000 likes page 200 × 50, each
  once, in order (slowest page 9.4 ms); deletion leaves zero rows (failed vendor call too); signals and expiry.
- `lib/feed.signed-out.test.ts` (+2 cases, 2 strengthened): `trade_exclusions` joins the signed-out forbidden tables;
  signed-in pages 1–3 read `trade_exclusions` only for the session's viewer id and drop the rejected card; the page and
  paging action read likes only for `page.viewer.id`, after `loadFeedPage` (which reads none); `likedAmong` logs one
  read keyed `$1` = viewer.
- `lib/feed.section.test.ts`: the pinned case restated (O4), stronger: the unfollowed trader is asserted to stay in the
  section and the feed, with the unfollow weight −1 on them for this viewer, and gone at 90 days; the "k candidates"
  loop now removes candidates with follows (they leave the section, stay in the feed). Same test count.
- `lib/discovery/exclusions.test.ts`: the pinned weights object now also pins `unfollow: -1`.
- `lib/discovery/imports.test.ts` (+1): `gestures.ts` is pure.
- `e2e/likes.spec.ts` (+4): touch 375: a single slow second tap and vertical swipes never like; double tap likes once
  (row, `aria-pressed`, mark, polite line, no animation, no count), again unlikes; likes list and Remove; the opening
  swipe opens the pane and writes nothing; right after the pane closes the reject swipe never commits; 30% snaps back;
  past half hides that trade (one row), Undo restores, a reload keeps it hidden. Keyboard 1280: "…" → Like (44 px,
  name, pressed) and "Hide this trade" with focus on Undo. Signed out: no menu, the sign-in line. No-JS: Like posts to
  the likes list, Remove works. Every context: zero requests to any event endpoint.

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | **637 tests: 625 pass, 12 skipped (LOAD), 0 fail** each run (was 623 / 611) |
| `LOAD=1` feed, follows, sync (one file at a time) | **12 / 12 pass**: feed p95 page 1 160 ms (12 heavy) / 247 ms (50 heavy); follows purge 100,000 in 273 ms; sync heavy import 1276 ms |
| `CI=1 npm run build` (stdin closed) | exit 0; the first attempt stops on the framework's security advisory (tool output), the retry passes |
| `npm run test:e2e` ×2 | **118 passed, 3 skipped, 0 failed**, both runs (5.2 min) |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing wasm license line |
| `node scripts/autopilot.ts guard main` | ok |

Measurements: double tap to the liked state 177 ms in the e2e driver (CDP round trips included; the toggle itself is a
synchronous state change, no network wait); `/me/likes` page with 10,000 likes ≤ 9.4 ms server read. Product diff:
517 lines (490 added, 27 removed; tests, docs and screenshots excluded).

Screenshots: `screenshots/pr4/` (light and dark): like state 375 and 1280, the card menu 375, reject + Undo 375 and
1280, likes list 375, likes list without JavaScript 375, the signed-out sign-in line 375. Committed screenshots of
other PRs rewritten by the e2e runs were restored.

Environment: own databases `ss_pr4` and `ss_pr4_e2e` (owned by the shared role), server on port 3471 from a temporary
Playwright config (deleted); port 3000 and the shared database untouched. Test users deleted, both databases dropped,
servers stopped.

## Known limits

- Likes and the reject swipe are on feed cards only (not on profile rows or Similar trades rows).
- A rejected trade leaves a gap on its page (fewer than 30 cards), like any card that disappears between pages.
- The sign-in line for a signed-out double tap stays until closed or the page changes.
