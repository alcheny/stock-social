# F-2 · PR-1 committee · UX lead

2026-10-23, product code at `cd355aa` (no app or lib change since). I used the existing `CI=1` build, because no source
file is newer than it. Setup:

- Port 3105, with the vendor fake on 4185. No sync tick was run.
- Reduced motion. Keyboard only, at 375 × 667 and 1280 × 800, light and dark.
- Two viewers: signed out, and signed in as a dev viewer with no record (`uxf2_viewer`).
- Screen reader view: read from the DOM accessibility tree (ARIA snapshots).

Fixture: 40 test traders (`uxf2_t*`), each with 6 fresh closes, losses included, 8 shared symbols. That is 240
eligible cards, enough to reach the 200-card cap: 7 pages, the last one 20 cards. Screenshots are in
`screenshots/pr1-ux/`. Names are `<shot>-<width>-<scheme>-<out|in>`.

USABILITY: PROBLEMS (1 blocking, 8 follow-up)

## What works

- **The join at reading pace.** I pressed ↓ once every 0.8 s. The request goes out once, as card 24 comes into view.
  Page 2 is in place before card 26, and ↓ from card 30 lands on card 31. I saw no flash and no jump. The layout
  shift is 0, and focus stays where it was. The same holds in all 7 width × scheme × viewer runs (`join-card31-*`).
  Tab from card 30's last pane control ("See full profile →") goes straight to card 31's name link.
- **Same list for everyone.** Signed in and signed out get identical card ids for pages 1 to 3, the same 90 ids in all
  6 contexts.
- **SW-1 on appended cards** (cards 31 and 60, at 375 and 1280, light and dark; `sw1-card31-pane-*`):
  - → opens the pane, and ← returns to the card (`scrollLeft` back to 0).
  - The ✓ Verified badge is on both card and pane.
  - The chart is percent only, with "0%" on the axis. Its label reads "6 trades, +30% total, max drawdown -45%".
  - Losses show in the loss colour: 21 of the 60 cards on the first two pages are losses.
  - "See full profile →" links to the right trader.
- **Mix.**
  - Each 30-card page holds 22 to 25 distinct traders and 22 to 28 symbols, never more than 2 of either in 10.
  - Each page has 7 to 12 losses.
- **Retry line** (`retry-*`):
  - It reads "Couldn't load more. Retry" on one centred line.
  - It is `role="status"`, and the button is 70 × 44.
  - It looks right in light and dark at both widths.
- **No JavaScript** (`nojs-*`):
  - From card 30, 12 Tab presses reach "Show more" (115 × 44, visible focus ring).
  - Enter loads `?after=…` with cards 31 to 60 from the top, marked `noindex`.
  - 7 pages lead to the same end card, and Back returns to the previous page.
- **End card** (`end-*`, `nojs-end-*`):
  - It is a full-height snap target after the last card. It is the region "End of feed", with the level-2 heading
    "End of today's feed." and the link "Publish your trades".
  - Tab from that link goes to the footer links. The skip link goes to the footer, which holds the disclaimer.
  - I keep the wording. It is true, because the order is seeded per day, and it claims no completeness.

## Problems

1. **blocking: if the next page arrives while the reader is on the "Show more" control, the reader is pushed past it,
   and then past every later page.**
   - **What happens.** The control is the last snap target. When 30 cards are inserted above it, the scroller keeps
     the control in view: it re-snaps to the bottom of the now-longer list. So the reader jumps over the 30 new cards
     and lands on the last new card. That card is one of the observed last 6, so the next page is fetched at once, and
     the jump repeats.
   - **Measured.** I held the request until the reader was on the control, then released it (`loading-*` →
     `after-arrival-*`).
     - Within 0.2 s, the card in view was card 60 or 90.
     - 3 s later it was card **180 of 200**, in all 7 runs.
     - Cards 31 to 179 were never shown.
   - **It happens on every Retry.** The Retry button is on the control, so retrying always lands the reader there.
     Clicking Retry gave card 60 or 90, then 180 of 200 after 3 s, in all 7 runs (`after-retry-*`). Pressing Retry by
     keyboard did the same: the view moved 30 cards at a time, and focus went to the page body.
   - **When it occurs.** Slow networks: a 6 s response at a 0.8 s-per-card reading pace, by keyboard (375 light) and
     by wheel (1280 dark). A fling (12 quick wheel flicks from card 1) ended on card 180 of 200 within 1.5 s.
   - **When it does not.** If the page arrives while the reader is on card 30, the join is seamless (4 s and 5 s
     delays).
   - **Why it blocks.** This is the scroll anchoring and continuity the plan requires. Real phones will hit it on any
     slow connection, and a reader who skims fast hits it on every connection.
   - **Fix direction** (the engineer's call):
     - When the control is in view at append time, bring card 31 to the top after inserting, instantly.
     - Alternatively, take the control out of snapping and anchoring while loading.
   - **Test to add.** Hold the request until the control is in view, release it, and assert card 31 is at the top
     with 60 rows. Repeat for Retry.
2. **follow-up: loading looks the same as idle.** While loading, the control still reads "Show more" (`loading-*`). Only
   `aria-busy` on the link changes, and a screen reader does not announce it. Tapping the link does nothing. Suggest
   "Loading more…" as text, either in the control or as a `role="status"` line.
3. **follow-up: Retry drops focus.** The Retry button unmounts while loading, so focus falls to the page body, both
   after a failed retry and after a successful one. The next Tab then goes to "Show more" at the far end. Keep one
   element for the control, or move focus to card 31 on success.
4. **follow-up: Retry is hard to reach by keyboard.**
   - With the F-1 keys, focus does not follow ↓. A reader who reads with ↓ and sees the error has focus still on
     card 1, which is **360** Tab presses from Retry (72 from card 25; each row has 12 stops, mostly the pane's).
   - A route exists: the skip link, Enter, then Shift+Tab reaches the control in 3 keys, but nothing tells the reader
     about it.
   - Suggest one automatic retry when the control comes back into view, or letting ↓ at the end move focus to the
     control.
5. **follow-up: appending is silent for a screen reader.** Nothing is announced when 30 cards arrive. There is no live
   line, and the container has no `role="feed"` or `aria-busy`. Reading order is right, because the new articles sit
   before the control and have the same structure as server-rendered cards. A polite "30 more trades" line would help.
6. **follow-up: one trader can appear twice in a row.**
   - The caps allow it. There were 0 to 3 back-to-back pairs per 30 cards on the fixture.
   - The demo-only list opens with Dan, Dan. I computed it with `loadFeedPage(undefined, { ids: demo })`: 6 cards,
     `next` null.
   - Suggest a soft rule: no same trader in adjacent slots when another card fits. This is a plan change, for the
     business lead.
7. **follow-up: the demo-only feed is 6 cards, then "End of today's feed."**
   - The three demo traders hold 90 closes, and a first-time visitor sees 6 of them.
   - The wording is honest, and I keep it. The short list is the plan's "never relax a cap".
   - I suggest one more line on the end card when the list is short, telling the reader each card swipes left to
     the trader's record. The owner and business lead decide whether a short feed should relax a cap.
   - I could not render a demo-only feed live. See Environment.
8. **follow-up: "Publish your trades" for a signed-in viewer.** It goes to `/login`, which redirects to the viewer's
   own profile. That is fine with no record. For a viewer who already publishes, "See your record" would fit better.
9. **follow-up: two small notes.**
   - **No-JS page 2 gives no position cue.** It has no heading and the same title, and focus starts on the body.
     Suggest a visually hidden "Trades 31 to 60" heading.
   - **One fresh cohort fills the day's 200 candidates.** With my 40 fresh traders, the 3 demo records and 4 other
     records never appeared in 200 cards: 40 of 47 eligible traders were shown. That is the 200-candidate cap at
     work, not exploration. I flag it for the business lead.

## Older issues seen again (not this PR)

- The pane header runs name and handle together: "Ux Trader 3@uxf2_t3". This is planned for PR-2.
- The sticky header covers the top of the card's figure at 375.

## Environment

- **Leftover test traders.** Four verified traders from an F-1 e2e run at 04:00 UTC (`liv*`, 6 closes each, not mine)
  are in the shared database. So the live demo feed was 7 traders, not 3, and was not demo-only.
- **Another member's fixture.** For a while, the business lead's fixture (`blf2_*`) was in the feed too. All my
  measurements of pages, joins and Retry are from runs with only my fixture plus those leftovers.
- **Screenshots committed early.** Commit `512abda` included some early screenshots from my in-progress runs. This
  round replaces them with the final set.

Server and fake stopped. Test users (`uxf2_t0`–`uxf2_t39`, `uxf2_viewer`) deleted, 41 rows. No product code changed.
Launchers and scripts are in the scratchpad (`ux/f2pr1`).

USABILITY: PROBLEMS
