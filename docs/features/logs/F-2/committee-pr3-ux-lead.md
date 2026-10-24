# F-2 · PR-3 committee · UX lead

2026-10-23. Product code at `e84513e` (F-2 PR-3, the suggestions section). Another member's `CI=1` build finished at
22:01 while I was starting up. It was newer than every file under `app`, `lib` and `db` and held this PR's strings
("More records"), so I restarted on it and did not rebuild. No advisory was hit. Setup:

- Port 3114, with the vendor fake on 4194. No sync tick was run.
- My own database, `ss_ux_pr3` (Postgres 16, created as the superuser and owned by the shared role): the schema, the
  seed (3 demo traders), and 40 test traders (`uxp3_*`) with 5 closes each, losses included.
  - Holding periods are spread over the five buckets.
  - Four accounts are 5 days old, which gives "New here this month". The others are 60 days old.
  - One trader has a 36-character name and a 20-character handle (`uxp3_longhandle_2026`).
- Reduced motion. Keyboard only at 320 × 568, 375 × 667 and 1280 × 800, light and dark.
- Viewers:
  - Signed out.
  - Signed in as a fresh dev viewer in each context.
  - Without JavaScript, signed out and signed in.
- Touch: `hasTouch` and `isMobile` at 375 and 320, with real CDP touch events, so scrolling and snapping are native
  (the same method as the e2e).
- Screen reader view: ARIA snapshots, focus after each step, and the live regions. I could not check a real screen
  reader.

Screenshots are in `screenshots/pr3-ux/`, named `<shot>-<width>-<scheme>-<in|out>`. The launcher and scripts are in
the scratchpad (`ux/f2pr3`).

USABILITY: PROBLEMS (1 blocking, 12 follow-up)

## What works

- **Placement and rhythm** (`section-*`; 12 contexts):
  - The section comes after card 5 on every page. Paged to the end, there were 7 sections, each after card 5, 35,
    65 … 185 of 197. Each page shows new traders.
  - It is a true snap stop. From card 5, PageDown or an upward flick lands it at exactly 0 px. ArrowDown and a
    second flick go on to card 6, also at 0.
  - SW-1 is unchanged on the cards around it: a left swipe on card 5 and on card 6 opens the pane
    (`scrollLeft` = width).
  - It reads as a different kind of stop from a card. A card shows a symbol, a big signed return and a chart. The
    section has a heading, a short line, and three bordered rows with no number. It does not pass for a trade.
- **The rows** (`section-*-out`, `section-*-in`):
  - Each row shows the name, the handle (on its own line), the badge, and one reason.
  - The demo trader's row reads "Dan | @dividend_dan | Demo | New here this month".
  - **No performance number.** I checked each section's text for `%`, a signed number or `$`, in 12 contexts. None
    was found.
  - The reasons are plain and checkable: "Typical holding period: 1 to 6 months", "New here this month".
  - The page width equals the screen everywhere.
  - Signed out, each row is one target, 321 × 72 to 98 at 375. Signed in, Follow is 112 × 45 and "…" is 44 × 44.
- **Screen reader structure**:
  - The section is `region "More records"`, the only `h2` in the feed (after the h1 "Trade feed"), so heading
    navigation goes straight to it.
  - Each row is a list item holding one link, with the full name "Ux Trader 1 @uxp3_t1 ✓ Verified New here this
    month" and `aria-haspopup="dialog"`.
  - Signed in, `button "Follow"` and the "More for @x" group follow the link.
- **The sheet** (`sheet-*`; 6 contexts):
  - Enter, a tap, or → on a row opens a modal `dialog "Ux Trader 1’s record"`. Focus lands on "← Back" (88 × 45).
  - Esc, "← Back", and a click on the backdrop at 1280 all close it, and focus goes back to the same row link in every
    context.
  - Tab stays inside the sheet. After "See full profile →", focus passes through the browser's own controls and
    comes back to the dialog, then to Back. That is the native modal trap, and the page behind is inert.
  - ← on a row does nothing, so the keyboard cannot reject anyone.
  - "See full profile →" goes to `/u/x` (160 × 43). The chart is percent-only, with 0% on the axis.
  - Signed in, Follow in the sheet updates the row's button too ("Following"), and the privacy line comes once.
  - "Not interested" from the sheet's "…" closes the sheet, collapses the row, and puts focus on Undo
    (`hide-from-sheet-375-light`).
- **Follow on rows** (`row-followed-*`):
  - Enter gives "Following" in 76 to 78 ms.
  - The line "Following @uxp3_t1. Only you can see this." shows as a full-width line under the row.
  - Focus stays on the button.
- **The "…" menu on rows** (`row-menu-*`):
  - "Not interested in @uxp3_t28" (253 × 45) stays inside the screen at 320 (x 42–295), at 375 (97–350) and at
    1280.
  - Esc closes it and puts focus back on "…".
- **Hide, keyboard** (`row-hidden-*`):
  - The row and all of the trader's feed cards collapse within 120 ms. The section stays in view (top 0).
  - The bar says "Hidden for 90 days." with Undo (70 × 44) focused. With focus there, it is still up at 5.6 s.
  - Undo brings the row back at rest and puts focus on its "…".
  - Esc closes the bar and moves focus to the next row.
- **Touch** (375, `swipe-*`):
  - A tap or a 70% left swipe opens the sheet.
  - A reject swipe right after the sheet closes snaps back, and nothing is written.
  - A slow 30% drag snaps back. A diagonal drag (80% across, 70 px down) snaps back.
  - A slow 75% drag commits: one exclusion, the row is gone, "Hidden for 90 days." with Undo. A tap on Undo removes
    the exclusion, and the row comes back at rest.
  - An upward flick that starts on a row moves the feed to card 6, so a row does not trap vertical travel.
  - Signed out, there is no tray. A 70% right swipe does nothing.
- **No JavaScript** (`nojs-*`):
  - Signed out, each row is a plain link to `/u/x`, with no tray, Follow or menu.
  - Signed in, the `<details>` menu posts and lands on the profile with "@x is hidden from your feed for 90 days.
    Their profile stays public." It also links "Following and hidden traders" (`/me/following`), so PR-2 follow-up 7
    is fixed.
  - No-JS Follow lands on "Following @x. Only you can see this."
- **DESIGN Stage 5**:
  - TR-1: a hide never touches a profile, and the sheet links the full record.
  - The chart is percent-only, with 0% on the axis.
  - The Verified and Demo badges show on rows.
  - The order is the documented lower bound. The line says so, and says losses count like gains.
  - SW-1 is intact.
  - Nothing celebrates.
- **PR-2 follow-ups**: the "Settings" link on your own profile is now 61 × 44 at 320 and 375, so item 5 is fixed.

## Problems

1. **blocking: a quick 50 px flick hides a trader for 90 days.**
   - **What happens.** At 375 the swipe area is 161 px wide, so "half" is about 80 px. A slow drag of 70 to 90 px
     snaps back, because the browser's touch slop eats about 15 px. Quick flicks behave differently:
     - 30 or 40 px in about 32 ms: nothing.
     - 50 px in 48 ms, 60 px in 48 ms, and a 35% flick (56 px): **committed** each time.
     - 50 px in 32 ms: nothing.
     - In short, a flick of a third of the area or less can hide a trader, while a slower drag of the same visible
       distance cannot.
   - **Why the flick commits.** Native momentum carries `scrollLeft` past half, and `swipeOutcome` judges where the
     scroll came to rest, not how far the finger moved.
   - **Why it blocks.** This is the accidental-trigger risk the brief asked me to judge.
     - The feed trains horizontal flicks on every card. A right flick is "back" on a card, and a no-op at rest.
     - On a section row, that same habit hides a trader for 90 days.
     - The plan's contract is "commits past half the width". The e2e only drives slow drags, so it does not see
       this.
     - Undo (5 s, focused, announced) and `/me/following` make it recoverable. A negative action should still never
       come from a gesture shorter than its own threshold.
   - **Fix direction** (the engineer's call):
     - Commit only when the finger's own travel toward the tray, measured from `touchstart` to `touchend`, is at
       least half the row, as well as `scrollLeft` being past half. A fling that lands past half without that
       travel snaps back.
     - Alternatively, stop momentum on the reject side (for example, `scroll-snap-stop` on the tray plus a check of
       the travel).
   - **Test to add.** At 375, signed in: a 50 px flick in 48 ms with no hold writes no exclusion and leaves the row
     at rest. A slow drag past half still commits.
2. **follow-up: at 320 the reject swipe never arms.**
   - The tray's content ("Not interested" plus 40 px padding) is 118 px wide, wider than the 106 px row. So the rest
     point is `scrollLeft` 118, while `rest()` assumes `clientWidth` (106).
   - `atRest` is therefore always false, and a 75% drag snaps back. `swipe-rejected-320-in` shows the snapped-back
     state, not a hide.
   - It fails safe, and the menu works. But the gesture silently does nothing at 320.
   - Measure the rest point from the row item's `offsetLeft`, and let the tray shrink (`min-width: 0`, a shorter
     label, or an icon).
3. **follow-up: the tray label is cut while it is revealed.**
   - Mid-drag it reads "t interested" at 375 and "rested" at 320 (`swipe-reject-mid-*`). The reader never sees the
     whole word before committing.
   - The label is right-aligned in a tray narrower than the label. Use a shorter label ("Hide") or an icon plus a
     word that fits in 80 px. The label should also be readable at the commit point.
4. **follow-up: hiding all three rows leaves an empty full-height stop** (`section-all-hidden-375-light`).
   - The heading and the line stay over a blank screen. In a snap feed it reads as broken or loading.
   - After the last row goes, focus moves to card 6's name link at y = 731, below a 667 px screen, so the focus is
     not visible.
   - Collapse the section when no row is left. Move focus to card 6 and scroll it into view, or keep focus on the
     bar's Undo.
5. **follow-up: the sheet's disclaimer is below the fold.**
   - The F3 line is the last thing in the sheet. At 375 it starts at y 1,120 to 1,181 on a 667 px screen (1,132 to
     1,193 of 800 at 1280).
   - On opening, "+105.2%", "80% win rate" and "+18.5% avg return" are visible and the line is not. The engineer's
     log says "in view", which is not accurate.
   - This is the same as a feed card's pane, whose line is in the page footer, so it is not a regression. The sheet
     also blocks the "one Tab away" skip link, because the page behind is inert. That leaves scrolling as the only
     way to reach the line.
   - Put the line right under the stat tiles, or pin it to the sheet's bottom edge. The business lead may weigh this
     under F3.
6. **follow-up: the pane header with a long name: the claimed fix does not hold** (`pane-header-long-*`).
   - For "Ux Section Trader With A Long Name X" / `@uxp3_longhandle_2026`, the name's width is 0 at 320 and 375, so
     the name is gone.
   - The handle still reads "@uxp3_longhandle_" at 375 and "@uxp3_long" at 320, cut by its container. Its own box
     measures whole, which is probably why the e2e passed.
   - Even "Ux Trader 1" shows as "Ux Trad…" in the sheet at 375 (`sheet-375-dark-in`).
   - In the sheet, the name is how the reader confirms which row they tapped. Stack the name over the handle under
     the Back row, and update PR-2's same-line assertion.
7. **follow-up: Undo still times out after a click or tap** (PR-2 round 2 item 3).
   - After a mouse hide, focus is on Undo (not `:focus-visible`) and the bar closes at about 5 s anyway. Focus then
     moves to the first row. At 320 that row sits at y = −36, partly off screen inside the section's own scroll.
   - Pause while focus is inside the bar, whatever put it there.
8. **follow-up: at 320, signed in, the rows are cramped and the section scrolls inside itself**
   (`section-320-*-in`).
   - Follow (112) and "…" (44) leave the name and reason 94 px. "Ux Trader 28" is cut to "Ux Trader…", and the reason
     wraps to four lines. Rows are 136 to 177 px tall.
   - The third row ends at y 690 on a 568 px screen, inside a nested scroller (`.suggest-in`). An upward flick that
     starts on a row scrolls that list instead of moving to card 6.
   - At widths under about 360, put Follow and "…" on their own line under the text.
9. **follow-up: heading wording.**
   - **"More records."** After five records, this reads like a pager label ("more of the same") rather than a
     different set of people. The rows are traders, and each one opens a record.
   - **"The same for everyone."** This answers a question the reader has not asked. It also becomes untrue for
     signed-in readers at PR-5, so it would have to change then.
   - **Proposal**, within the scanned rules: heading **"Other traders' records"**, line **"Ordered by how much
     evidence each record has. Losses count the same as gains."** At PR-5 the line changes, and the heading stays
     true.
   - Taste, the engineer's or the owner's call: the rows fill only the top 55 to 70% of the stop at 375 and 1280.
     The empty lower part makes the stop feel unfinished. Centring the block vertically, or giving it a little
     more air, would settle it.
10. **follow-up: `aria-haspopup="dialog"` is in the server HTML.** Without JavaScript, the row is a plain link to the
    profile, yet it announces a popup. Add the attribute only once the sheet is ready.
11. **follow-up: the no-JS hide line's link is 303 × 36.** "Following and hidden traders" is above the 24 px minimum.
    44 px would match the other controls.
12. **follow-up: the swipe has no visible cue.**
    - Nothing on a row hints at the reject swipe, and the tray is `aria-hidden`.
    - I think that is right for a negative accelerator: "…" is the visible, announced path, and the gesture stays
      out of the way. I am recording it as a decision for the owner under O1, not as a defect.
    - If O1 keeps the gesture, items 1 to 3 have to be fixed first.
13. **Still open from PR-2** (recorded by the engineer): Follow plus "Not interested" both true, the sign-in return
    path, "Manage hidden traders" in the menu, the state said twice on the toggle (`button "Following" [pressed]`),
    and focus after "Show again".

## Older issues seen again (not this PR)

- The "Drag across the chart…" hint in the pane has an input-like border and reads as a text field (`sheet-*`).
- The 320 avg-return tile is unchanged.

## Environment

- The database was my own, `ss_ux_pr3`. No other member's fixture was in the feed.
- Another member's server (another database, another port) was running and was not touched.
- Build check: the build from 22:01 was used as is. No rebuild was needed, and no advisory was hit.

The server and the fake are stopped. Test users (`uxp3_*`, 61 rows) are deleted, and their follows and exclusions went
with them through the cascade. `ss_ux_pr3` is dropped. No product code was changed.

USABILITY: PROBLEMS

## Round 2 (fix round 1 at `24d93d1`)

2026-10-23. Fresh `CI=1` build (stdin closed; exit 0, no advisory hit). Port 3116, vendor fake on 4196, no sync tick. Own
database `ss_ux_pr3r2` (Postgres 16, created as the superuser, owned by the shared role), with the schema, the seed and
the same 40 `uxp3_*` traders. I tested at 320, 375 and 1280, in light and dark, with the keyboard, with CDP touch, and
from a screen reader's view (ARIA snapshot, focus, live regions). I also tested without JavaScript. Screenshots are in
`screenshots/pr3-ux2/`.

### Checked against round 1

1. **The flick is fixed (was blocking).** I tested at 375 (row card 343 px) and 320 (288 px), signed in:
   - No hide for: flicks of 50 px, 30% and 45% of the row in 48 ms; slow drags of 40% and 45%; and the old round-1
     flick set (30 to 90 px).
   - Hides for: slow drags of 55% and 70%, and a fast 60% drag in 64 ms.
   - Right after the sheet closes, a swipe stays unarmed. A diagonal swipe does nothing. The opening swipe still
     opens the sheet.
   - The commit point now follows the finger, not the momentum.
2. **The swipe now arms at 320.** It commits at 55% of the row (see 1).
3. **The tray label is fixed.** It reads "Hide", whole, mid-drag at 320 and 375 (`tray-label-mid-*`).
4. **Hiding all three rows is fixed.** The section collapses (height 0). Focus lands on card 6's name link, in view,
   with a visible focus ring (`section-all-hidden-375-light`).
5. **Fixed: the sheet's skip link.** "Skip to the disclaimer" is the sheet's first stop, and pressing it focuses the
   F3 line, which then sits on screen at y 600 to 667 (`sheet-skip-*`, `sheet-disclaimer-*`).
   - Tab still cycles inside the sheet.
   - The only stop outside the sheet is the browser's own chrome, which is normal for a native modal.
6. **The pane header is fixed.** At 320 and 375 the long name ends in an ellipsis and `@uxp3_longhandle_2026` is whole
   (192/192 px) (`pane-header-long-*`).
7. **Undo: partly fixed.** A tap on the bar keeps it open: still open 7 s later, after each swipe hide at 320 and
   375. After Undo, focus returns to the row's "…".
   - A mouse hide from the menu with no further contact still closes the bar at about 5 s, although focus is on
     Undo. See follow-up R2-1.
8. **Still open: rows at 320, signed in.** The rows are still cramped (Follow and "…" leave the text about 94 px; a
   handle shows as "@moment…"). They are recorded by the engineer as follow-ups.
9. **The heading is fixed.** "Other traders' records" plus the evidence line is in the ARIA region and on screen.
10. **`aria-haspopup` is fixed.** It is `dialog` with JavaScript and absent without it.
11. **The no-JS link is fixed.** "Following and hidden traders" is 186 × 44.
12. **Swipe cue:** unchanged. It is the owner's call under O1.
13. **PR-2 carry-overs:** unchanged, and recorded.

I also re-checked that nothing regressed:
- Follow is optimistic (about 60 to 85 ms) and announced.
- The "…" menu fits at every width with no horizontal scroll.
- A keyboard hide puts focus on Undo, and Esc on the menu returns to its summary.
- Hiding from the sheet closes the sheet and focuses Undo.
- Without JavaScript the paths work: hide, then the line and its link; follow, then the confirmation.
- Signed out, the rows are plain links with no Follow or menu.
- SW-1 swipe to profile still works on cards 5 and 6.

### Problems

- **R2-1 follow-up: after a mouse hide the bar can still time out with focus on Undo.** At 320 focus then falls to a
  row at y −73, inside the section's own scroll. Pausing while focus is inside the bar would close this. It is the
  same class as round 1 item 7, now much narrower.
- **R2-2 follow-up: on a touch open, the first focus is the offscreen "Skip to the disclaimer" (y −100).** A screen
  reader user starts on a skip link rather than the record's name. Taste: consider focusing the dialog (it is
  labelled "Maya's record") and keeping the skip link as the first Tab stop.
- Round 1 follow-ups 8, 12 and 13, and the older issues, stand as recorded in the engineer's follow-up table.

### Cleanup

The server and the fake are stopped. The `uxp3_*` users are deleted, and their follows and exclusions went with them.
`ss_ux_pr3r2` is dropped. No product code was changed. No third-party company is named.

USABILITY: PASS (0 blocking; follow-ups R2-1, R2-2 and the carried items)
