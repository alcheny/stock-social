# F-2 PR-4: likes and gestures (engineer build log)

2026-10-24. Built to the signed plan (`plan.md` → "PR-4 · Likes and gestures") as amended by the owner's decisions in the
feature file: **O1** (the reject swipe lives on the feed's trade card; the plan's "PR-4c"), **O4** (unfollow is a slight
negative, never a hide), with **O3** still open (the plan's default kept: one constant, 90 days, "Hidden for 90 days.").
The business lead's rulings in `committee-pr1b-business-lead.md` §5 and §7 are applied as written. No event table, no
dependency, no protected path, no change to package.json, CI, CODEOWNERS or `lib/session.ts` / `lib/broker.ts`.

## What it does

**Likes (double tap +3, private).**
- A double tap on a feed card's body (two taps on the same card within 300 ms and 24 px; never on a link, button or
  chart) likes that trade once. A second double tap never unlikes. The heart button on the card is the keyboard and
  screen-reader route: accessible name "Like. Only you can see likes.", `aria-pressed`, 44 × 44 px, outline to filled (the
  shape carries the state, not color). No burst, motion, vibration or count; a like on a loss is the same as on a gain.
- Signed out the heart (or a double tap) shows one inline line: "Sign in to like records. Only you can see likes." with a
  "Sign in" link. Nothing is written.
- `/me/following` gains **"Liked records"**: "SYMBOL · closed <date> · @handle" (no return), linking to the trade page,
  each with "Unlike" (works without JavaScript). A like whose trade is gone after a rebuild is kept and ignored on read;
  it re-attaches when the trade returns.
- No card is liked on the viewer's own record (no heart there), and the server refuses a like of your own trade.

**The reject swipe on a feed card (O1).**
- Swiping toward the pane opens it, exactly as before (SW-1). Swiping the other way drags the card itself off to the
  right over a "Hide trade" tray. Released after the finger travelled at least half the card, that one trade is hidden:
  the card drops in place, "Hidden for 90 days." with Undo for 5 s (`role="status"`, the existing bar), focus on Undo,
  then back to the card's "Hide this trade" after Undo. The trader's other cards stay.
- Guards (the section swipe's): it arms only on a touch that starts on a card with its row at rest, no sheet open and
  not within 400 ms after the row came back from its pane; the travel must be horizontal (≥ 2× vertical) and toward the
  tray; under half the card it snaps back (no transition under reduced motion). The snap stop: the card moves only under
  the finger, never by scrolling, so a fling back from the pane can never carry into a reject.
- "Hide this trade" (a 44 px button on the card, signed in only) is the same action for keyboard and screen-reader users.
- The reject stores a row in `trade_rejects` (state the viewer chose, not an event): the trade is out of that viewer's
  feed for `TRADE_REJECT_DAYS` (90, the O3 default), and its trader gets `WEIGHTS.rejectTrader = −1` for `PREF_DAYS` (90),
  ending early at Undo. A rejected trade is also never a "Similar trades" row for that viewer (the trader's next close in
  the bucket is used instead): "the card is not shown again".

**Unfollow (O4).** `WEIGHTS.unfollow = −1`, signed in only, never a hide in the feed or the section. Criterion 4 is
restated as the business lead ruled: "unfollow applies the unfollow weight to that trader's score for the viewer; it
never removes the trader's cards or section rows". The weight lives on the existing 90-day `unfollow` row, so it ages out
at 90 days and goes with the account. `FEED_HIDES_UNFOLLOWED` is retired: with O4 there is nothing left for it to switch.

**How a preference enters the ranking** (`lib/discovery/prefs.ts`, pure). A trader's preference p (the sum of the
running weights, ≤ 0) multiplies its ranking product by 0.8^(−p): in the feed, weight × score (the same comparator as
`rankTraders`, then the per-card discount); in the section, the TR-9 weight used to *choose* rows. Equal products go to
the trader with no preference, so an otherwise identical trader always ranks above. The section's rows still *read* in
evidence order (the preference only breaks ties there), so "Ordered by how much evidence each record has" stays true.
Preferences are read at the cursor's `asOf`, like the exclusions: one made mid-session enters at the next page 1, so a
same-day cursor's list never changes (demand B).

Files: `lib/discovery/prefs.ts` (new, pure), `lib/discovery/exclusions.ts` (`splitRejects`, `shapeList` options,
`displayFilter` by card), `lib/discovery/reject.ts` (`cardOutcome`, `isDoubleTap`), `lib/discovery/weights.ts`,
`lib/discovery/section.ts` (`pref` tie-break), `lib/discovery/purge.ts`, `lib/likes.ts` (new), `lib/follows.ts`,
`lib/feed.ts`, `lib/similar.ts`, `lib/delete.ts`, `lib/copy.ts` (`LIKES`, in `allCopy`), `db/schema.sql`,
`app/card-gestures.tsx` (new), `app/me/liked/route.ts` (new), `app/feed-hides.tsx`, `app/feed-rows.tsx`, `app/ui.tsx`,
`app/page.tsx`, `app/me/following/page.tsx`, `app/discovery-actions.ts`, `app/globals.css`, `app/follow-button.tsx`
(comment).

**Product diff: +545 / −95 (640 lines; cap 800).** Tests, e2e, docs and screenshots not counted.

## Schema (additive, idempotent)

- `closed_trades.trade_key`: generated, stored, `encode(sha256(replace(sell_id, chr(92), chr(92) || chr(92))::bytea),
  'hex')`, indexed. **It works on Postgres 16** (tested on 16 here), so the plan's fallback was not needed. The
  database's value equals `node:crypto` sha256 of the UTF-8 sell id for `a\b`, `\x41`, `\\`, `\001`, a trailing `\` and
  non-ASCII text (tested); `lib/likes.ts#tradeKey` computes the same in the feed.
- `trade_likes(viewer_id, trade_key, trader_id, created_at)`, primary key `(viewer_id, trade_key)`, `(trader_id)` index.
- `trade_rejects(viewer_id, trade_key, trader_id, created_at, until)`, same key, `(trader_id)` and `(until)` indexes.
- Both cascade on either account; account deletion's first step (before the vendor call) deletes them; the tick's purge
  deletes rejects ended over a day ago (a permanent one, `until = 'infinity'`, is never purged). No `drop`, `truncate`
  or `delete from` in the schema; a repeat apply takes no table lock (`schema.test.ts`).

## Decisions I made, and why (the committee should look at 1, 2, 4 and 5)

1. **The card's reject is a drag of the card, not a scroll-snap tray.** The section rows use a native
   `[tray | row | sentinel]` scroller. On a feed card a tray before the card would move the card's rest point off
   `scrollLeft = 0`, which the SW-1 keys, the pager and pinned e2e assertions rely on. A drag of the card from rest gives
   the same guards and is a stronger snap stop: momentum never counts, only the finger does.
2. **"Slight negative preference to its trader" = −1**, the same as unfollow. The business lead's §5 wording ("the
   trader-level −4 that a trade reject also applies") predates the owner's O1 text ("−4 to the trade and a slight
   negative preference to its trader"); I followed the owner. One constant (`WEIGHTS.rejectTrader`) changes it.
3. **O3 stays the plan's default** (the feature file has not decided it). `TRADE_REJECT_DAYS = EXCLUSION_DAYS` (90) and
   the copy "Hidden for 90 days." The committee recommended "rejected trade permanent, trader 90 days" (business lead,
   committee PR-1b §5): setting `TRADE_REJECT_DAYS = Infinity` flips it (stored as `until = 'infinity'`, never purged,
   copy "Hidden."), while the trader part still ends at 90 days. That path is tested (`lib/feed.prefs.test.ts`, the
   `infinity` row). No "hidden trades" screen, as ruled.
4. **The like state is read by the client (`GET /me/liked`), not by the feed's read.** The PR-2 and PR-3 guard tests pin
   that `loadFeedPage` signed in never reads `trade_likes`; changing that would weaken them. So the feed stays the same
   read for every viewer, and the page asks once per batch of cards (signed in only, `private, no-store`, keyed by the
   session's id, ≤ 60 keys). Trade-off: a liked card's heart fills one request after hydration, not on first paint. If the
   committee prefers a server-rendered state, the guard tests need an owner-approved restatement first.
5. **The slight preference is slight in practice.** ×0.8 per −1 moves a trader below its equals and a few places down a
   long list, but on a small feed the diversity caps and the per-card discount dominate: on a 6-trader fixture where the
   viewer rejected a trader's best card, that trader's other cards stayed within one slot of their places without the −1
   (one even moved a slot earlier, through the per-card discount). So the tests compare twins, not positions. That is
   the owner's "slight"; −2 would be ×0.64 if it reads too weak.
6. **PR-1b reach kept for re-shaped lists (bug fix).** A viewer's re-shaped list (any running hide) was re-mixed without
   PR-1b's exploration-only outside traders, so one "Not interested" silently removed them from that viewer's feed. With
   O4 every viewer who ever unfollowed gets a re-shaped list, so `shapeList` now takes the kept `extra` cards too.
7. **Committee PR-1b demands 1 and 2** (Demo after every verified candidate; the new-record slot chosen before the bucket
   cap) were already in the code (`section.ts`, PR-1b fix round 1) and their tests pass; nothing rebuilt.
8. **Pinned tests restated, none removed, count unchanged** (the business lead's §5 condition):
   - `lib/feed.section.test.ts`, criterion 4 case: the unfollowed trader no longer leaves the section; in a fixture where
     every record has the same evidence it reads after all of them; the "k candidates left" loop now removes candidates
     with follows (which leave the section, not the feed) and asserts k = 2 gives a section with the unfollowed trader as
     the last row (was: no section), k = 1 and 0 give none.
   - `lib/follows.test.ts`, fix round 1 case: `FEED_HIDES_UNFOLLOWED` is asserted gone and `WEIGHTS.unfollow` is −1; the
     signed-in feed has the same cards as signed out (was: the same order).
   - `lib/discovery/exclusions.test.ts`, the weights pin: now includes `reject −4`, `rejectTrader −1`, `unfollow −1`.

## Known limits

- A "Not interested" on a trader the viewer had unfollowed before the session's `asOf` replaces that row (same key), so
  that session's later pages are ordered once more without the trader's −1. The trader's cards are hidden either way;
  another card can move by a slot at a page boundary. Fixed at the next page 1.
- "Show again" after such a "Not interested" also ends the earlier unfollow's −1.
- The heart is on feed cards only (not the pane's list, the profile or Similar trades), as the plan scoped it.

## Tests (written first; none weakened or deleted)

Unit test count **623 → 643** (+20).
- `lib/discovery/prefs.test.ts` (+10, pure): the weights; `prefsAt` at asOf (made after asOf, ended, aged out, a
  permanent reject's trader part ending at 90 days, sums); `rerank` equals the impersonal ranking with no preference
  (200 seeds) and never hides; an unfollowed trader ranks below an otherwise identical one with and without evidence and
  at a zero score, yet above a record scoring under 0.8×; `shapeList` drops a rejected card and keeps PR-1b's extra
  cards, caps exact (100 seeds); `splitRejects`; a trade rejected between pages on 500 seeded feeds (no repeat, the
  rest in order, the card gone); the section (candidate kept, below its equal, rows in evidence order, the new-record
  slot); double tap (299/300 ms, 24/25 px, other card, non-plain target); the card swipe (50%/49%, unarmed, 399 ms).
- `lib/likes.test.ts` (+5, database): privacy scan (only `lib/likes.ts`, `lib/delete.ts` and the purge name the tables,
  every read keyed by the viewer, no count, no share image imports them, no event table); `trade_key` for the tricky ids;
  like/unlike (idempotent, own trade and unknown key refused, private, kept through a rebuild and re-attached); a rejected
  trade in the feed (89 d 23 h 59 m / 90 d + 1 s, dropped in place between pages, Undo, signed out and others
  unchanged); deletion and purge.
- `lib/feed.prefs.test.ts` (+2, database): O4 (every card still there, below its identical twin, still at 89 days, equal
  after 90, equal again on a new follow); O1 (the card hidden, the other five stay, the trader below its twin, and with a
  permanent trade exclusion after 90 days the trade stays hidden while the twins are equal again).
- `lib/feed.signed-out.test.ts` (+1): signed out no read of `trade_rejects` or `trade_likes`; signed in one
  `trade_rejects` read per page, keyed by the viewer's id; never `trade_likes`.
- `lib/similar.test.ts` (+1): a rejected trade is never that viewer's Similar trades row; the trader's next close is.
- `lib/discovery/imports.test.ts` (+1 case): `prefs.ts` is pure.
- `e2e/likes.spec.ts` (+3, 375 px, touch): double tap likes once, two taps 400 ms apart do not, a vertical swipe never
  likes, Enter/Space on the heart, the state after a reload, nothing on the public profile, "Liked records" with Unlike,
  no request to any event endpoint; the reject swipe (opening swipe still opens the pane and writes nothing; straight back
  from the pane never rejects; 40% snaps back; mid-drag tray label whole; past half hides only that trade with the bar and
  Undo; "Hide this trade" by keyboard with focus on Undo and back; the next page 1 omits it); signed out (the sign-in line,
  no tray or hide button, no write, `GET /me/liked` empty).

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` ×3 (2 after the last product change) | **643 tests: 631 pass, 12 skipped (LOAD), 0 fail** each run (baseline 623 / 611 / 12) |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` (interim rule; I did not touch sync, connections, trades or broker) | **5 / 5 pass**. `# load:` heavy import 10,000 activities in 855 ms (bound 15,000), slowest step 311 ms, rebuild 307 ms, heap +20.4 MB; three syncs 386 / 278 / 348 ms, sha256 of closed_trades unchanged; contention 1 ran, 2 skipped; first sync 774 ms; fleet 500 traders × 2 accounts, 8 callers, each synced once in 4,820 ms (bound 60,000) |
| `LOAD=1` feed and follows (I touched `lib/feed.ts` and `lib/follows.ts`), one file at a time | **6 / 6 and 1 / 1 pass**. Feed p95 at 500 traders / 50 heavy: page 1 164 to 181 ms, all pages 139 to 161 ms; section signed out 161 ms, signed in 180 ms; the own-late case's printed p95 was 410 ms against its stated 400 ms budget on one run (the test passed; the same case is not changed by this PR, and the run shared the machine with nothing else) |
| `CI=1 npm run build` (stdin closed) | exit 0 on the retry; the first attempt of each build stops on the framework's security advisory (tool output) |
| `npm run test:e2e` | **117 passed, 3 skipped, 0 failed** (4.6 min), the vendor fake on 4102; `e2e/likes.spec.ts` alone 3 / 3 (twice after its last fix) |
| `node scripts/compliance.ts diff origin/main` | ok |
| `node scripts/autopilot.ts guard main` | ok |

Not measured: the signed-in feed for a viewer with many preferences on the heavy fixture (each such page re-mixes the
kept list, as a viewer with a running hide already did since PR-2).

## Environment

The container had restarted: Postgres 16 was down and its role and database were gone. I started the cluster and
recreated the `stock_social` role and database to match `.env`, then applied the schema with the seed. The installed
Chromium is build 1243 while the repo's Playwright asks for 1248; I symlinked 1248 to the installed build (no download).
The server for e2e ran on port 3000 with the in-repo vendor fake (`SNAPTRADE_BASE_URL=http://127.0.0.1:4102`).
The build stops once on the framework's security advisory (tool output) and passes on the retry, as in earlier logs;
the advisory recommends a framework upgrade, which is a dependency change for the owner. Committed screenshots of other
PRs that the e2e run rewrites were restored.

Screenshots (375 px, light and dark) in `screenshots/pr4/`: `card-liked`, `reject-mid-drag`, `reject-undo`,
`liked-list`, `signed-out-like`.

## Compliance (COMPLIANCE §1)

1. Performance: no new performance number; the liked list shows symbol, date and handle only; losses and gains are
   liked, rejected and ranked the same (no sign is read).
2. Personal data: two new viewer tables (§5 of the plan already lists likes; trade rejects belong in the same Privacy
   text, item #10 / H4), private to the viewer, nothing stored signed out, deleted on account deletion's first step,
   rejects purged a day after they end. No event rows.
3. Money: none. No points, rewards or anything convertible; a like rewards nothing.
4. Email, push, tracking: none; no third party; `/me/liked` is first-party and `no-store`.
5. User text: none new.
6. Sign-up, age: unchanged.
7. Vendor or dependency: none.
8. Screen reader and keyboard: a button for every gesture (heart, "Hide this trade"), `aria-pressed`, 44 px, visible
   focus, reduced motion, Undo in the existing `role="status"` bar.
9. Security: session-bound server actions; the key is checked against `^[0-9a-f]{64}$` before any query; own trades
   refused; the route reads only the session's id.
10. Claims: no "AI", no recommendation words; copy scanned (`allCopy`).
11. Checkout: no.
POLICY F6: no counts, no celebration on a like, nothing tied to trade frequency. F1: nothing about a security is
suggested; a trader-level negative only lowers a trader for the viewer who chose it.

## Fix round 1 (2026-10-24)

Reports: UX lead COMPLIANCE FAIL (A1: focus after Unlike; signed-out "Sign in" link) + demands; business lead PASS with
D1 to D4 (all seven of my decisions accepted); tester 1 High, 2 Medium, 3 Low. Process: "Parallel development"
(IMPLEMENTATION.md) is in effect. This round owns the main checkout: branch `claude/peaceful-dirac-33bucv`, database
`stock_social`, `next start` and Playwright on port 3000, the vendor fake on 4102.

| Demand | Change | How verified |
|---|---|---|
| UX 2 (A1, WCAG 2.4.3): Unlike drops focus, announces nothing | "Liked records" is a client list (`app/me/following/liked-list.tsx`): Unlike moves focus to the next row's Unlike, else the previous one, else the "Liked records" heading (`tabIndex=-1`), and a `role="status"` line says "Unliked SYMBOL by @handle." Without JavaScript the form still posts (`refresh()`). | e2e: Enter on the first of two Unlikes → focus on the remaining Unlike and the status line; Enter again → focus on the heading, "No liked records yet." and the status names the handle; `document.activeElement` is never `body`. |
| UX 1 / tester High 1: Undo after a swipe never closes | `FeedHides` no longer reads `:focus-visible`. Each hide carries `via` (`'key'` when the menu item was activated from the keyboard, else `'pointer'`; swipes are `'pointer'`). Pointer: the 5 s run, Undo is focused with `focusVisible: false` and no ring (`.hide-bar[data-via=pointer]`). Keyboard: paused while Undo has focus, as before (WCAG 2.2.1). Hover and a press on the bar still pause (PR-3's pinned behavior). The section-row swipe goes through the same path. | e2e, card swipe and **section-row swipe** (new test): Undo focused with computed `outline-style: none`, the bar still open at 4.8 s and gone by 5.8 s, focus on the next card's name. Keyboard "Hide this trade": Undo still focused after 5.8 s. PR-2's `follow.spec.ts` keyboard-pause test passes unchanged. |
| Tester Medium 1: Undo where "Hide this trade" was; the bar covers the next card's controls; a double tap or two hides in a row undo the first | While the bar is open, feed cards get 100 px of bottom padding (`[data-hide-bar]`), so the next card's heart and "…" sit above it. "Hide this trade" is now in a popover above the footer (D1), never under Undo. | e2e: with the bar open, `elementFromPoint` at the next card's heart and "…" is not the bar; a double tap (120 ms) on "Hide this trade" leaves the trade hidden with 1 reject; a second hide right after keeps both (2 rejects). |
| BL D1: "Hide this trade" behind the card's "…"; footer one line at 375 | `HideTrade` reuses the pane's "…" menu (`MoreMenu` in `app/not-interested.tsx`), opening upward. Accessible name "More for SYMBOL by @handle". Works without JavaScript (`rejectTradeForm` posts and returns to `/`). Footer: link (13 px), heart, "…", one row at a fixed 44 px. | e2e: footer ≤ 46 px tall and the link in one line box at 375; keyboard "…" → Enter → Tab → Enter hides, Undo focused, Undo returns focus to "…". Screenshots `card-footer`, `card-menu`. |
| BL D2 (and UX 3, tester Low 2): no heart signed out | Signed out there is no heart, no sign-in line, no "…" and no tray; `CardGestures` is mounted only for a signed-in viewer, so a double tap does nothing. The unclear "Sign in" link no longer exists. | e2e: signed out, no `[data-like]`, `.card .more-menu`, `.ctray` or `.like-signin`; a double tap and a swipe send no non-GET request; footer height the same 44 px as signed in. |
| BL D3 + tester Medium 2: liked rows clip the handle; repeated privacy line | Each row's link wraps: "SYMBOL · closed DATE", then "@handle" on its own line, never clipped. `LIKES.explain` deleted (the page's line already says it). | e2e with a 20-character handle at 375: every link `scrollWidth ≤ clientWidth`; "Only you can see likes." absent. Screenshot `liked-list`. |
| BL D4: "Trade hidden for 90 days."; one name | `LIKES.hidden` = "Trade hidden for 90 days." (follows `TRADE_REJECT_DAYS`; "Trade hidden." if permanent). The tray, the menu item and the docs all say "Hide this trade" (`LIKES.tray` removed). | e2e text matches; copy scan (`allCopy`) passes. |
| UX 4 (should fix): the liked heart fills after first paint | The heart is invisible, with its space kept and not focusable, until `/me/liked` answers for that card, or after 1 s. A liked card never shows ♡ first. Batches of 60 keys now run in parallel. The guard tests are unchanged. | e2e: with `/me/liked` delayed 700 ms, glyph samples every 60 ms from reload read only "hidden" or "pressed", never "not pressed". |
| Tester Low 1: inert controls without JavaScript | The heart stays invisible without JavaScript (it shows only once its state is known). The "…" → "Hide this trade" is a real form. | By construction (`.like:not([data-ready])`); the no-JS form uses the same server action. |
| Tester Low 3: list stops at 200 | `LIKES_MAX = 200`, and when it is reached the list says "Showing your 200 most recent likes." Older likes appear as newer ones are removed. No paging. | Code path; the honest limit as asked. |
| Tester Note 3: e2e isolation | `e2e/similar.spec.ts` takes the shared feed lock around every test; `e2e/follow.spec.ts:23` takes it for that test (released in `afterEach`). No assertion changed. | Full e2e run: 0 failures (the tester's `section.spec.ts:439` run included). |
| Follow-ups also done (small) | Button names carry the trade ("Like SYMBOL by @handle. Only you can see likes.", BL F2 / UX 10). The tray darkens past half the card (UX 6 / BL F1; no motion, no new words). | e2e: the heart's name pattern; `.past` absent at 40% and present at 60%. |

Not done (follow-ups, the designer's call): a "Liked" text next to the heart after a double tap (UX 5); stopping the row
from scrolling toward the pane while a reject drag is cancelled (UX 7); renaming "Liked records" to "Liked trades" and
mentioning likes in the page title (UX 9 / BL F3: the h1 is pinned by `follow.spec.ts`); a lighter "…".

**Product diff, PR total vs main: +655 / −113 (768 lines; cap 800).** This round: +178 / −88.

### Checks (fix round 1)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` ×2 | **643 tests: 631 pass, 12 skipped (LOAD), 0 fail** both runs (this round added e2e tests, no unit tests) |
| `LOAD=1` `lib/sync.load.test.ts` | **5 / 5 pass**. Heavy import 935 ms, rebuild 269 ms, heap +23 MB. Fleet: 500 × 2 accounts, 8 callers, 4,430 ms (bound 60,000). No sync, connection, trade or broker file changed this round. |
| `LOAD=1` `lib/feed.load.test.ts`, `lib/follows.load.test.ts` (run because PR-4 touches feed and follows) | **6 / 6 and 1 / 1 pass**. Feed p95 at 500 traders: page 1 125 to 254 ms. |
| `node scripts/autopilot.ts guard main` | ok |
| `node scripts/compliance.ts diff origin/main` | ok |
| `CI=1 npm run build` | exit 0 on the retry (the first attempt stops on the framework's security advisory, which is tool output) |
| `npm run test:e2e` (full) | **118 passed, 3 skipped, 0 failed** (4.7 min). The run before it had 4 failures, all caused by a 400 ms "second tap" guard on Undo that swallowed quick deliberate taps PR-2 and PR-3 pin. The guard was removed: the layout fix makes it unnecessary. `e2e/likes.spec.ts`: 4 / 4. |

Screenshots (375 px, light and dark) in `screenshots/pr4-fix1/`: `card-footer`, `card-menu`, `reject-mid-drag`
(marked past half), `reject-bar` (the next card's controls above the bar), `liked-list` (20-character handle),
`liked-list-after-unlike`, `signed-out-card`. Committed screenshots of other PRs that the e2e run rewrote were restored.
