# F-2 PR-3b "Similar trades" on profiles: UX lead verdict

2026-10-24, HEAD 266376e. `next start` on :3120 (fresh `CI=1 npm run build`; the first attempt stopped on the framework's
security advisory, which is tool output, and the retry passed), vendor fake on :4200, own Postgres 16 database (dropped
after). Fixture: 42 test traders (one 60-close record with paging, one 4-close record, 40 five-close records over the five
holding buckets, losses included). Viewed signed out (shared-link visitor) and signed in at 320, 375 and 1280, light and
dark, by keyboard, touch (CDP touch events, 375 mobile) and the accessibility tree. Screenshots: `screenshots/pr3b-ux/`.
Test users deleted, server and fake stopped, database dropped. No product code changed.

## What works

- **Placement reads as secondary.** The section starts below "Show 10 more" (32 px gap and a top rule), and before "← Feed".
  Its heading is 16 px against "Closed trades" at 24 px. On a 60-close record at 320 it begins about 4,900 px down; nothing of
  it shows on the first screens, so a visitor from a shared link stays with that trader. Rows are bordered cards, a little
  more boxed than the plain closes list, but with no number on them they don't compete with the record (`section-*.png`,
  `page-*.png`).
- **Copy.** "Similar trades" and the explainer are honest signed out ("held about as long as @x's typical trade. Records with
  more evidence come first. Losses count the same as gains."). A row is name, handle, "SYMBOL · closed Oct 14, 2026",
  Verified badge, "Held under a day": no return and no other performance number on the row, so it isn't a signal.
- **3 rows at 320.** Each row is 112 px. No clipping or ellipsis in name/trade/facts. Page scrollWidth equals the viewport at
  320/375/1280. The "…" (44×44) sits beside the card. The menu item "Not interested in @x" (249×45) opens leftward inside the
  screen.
- **Sheet from a row.** Enter or a tap opens a modal sheet named "Ux Trader 10's record". Focus lands on the trader's name
  with a visible focus ring. The sheet carries the pane (chart, closes with losses) and the F3 line "Not investment advice.
  Past performance does not guarantee future results." Esc, or the Back button on touch, closes it and focus returns to the
  same row. The panes are not in the DOM until a sheet first opens (lazy), so the profile keeps a single chart.
- **No JavaScript.** A row is a plain link to that trade's page (`/u/uxpb_t10/trade/uxpb-10-0`, which loads with its symbol
  heading). No dialogs render (`nojs-*.png`).
- **"…" and Undo (keyboard).** "Not interested" collapses the row in place. "Hidden for 90 days." shows with Undo, and focus
  goes to Undo. Undo brings the row back, with focus on its "…". Esc on the bar moves focus to the next row.
- **Touch: no collision with page scrolling.** A vertical drag that starts on a row scrolls the page (±210–330 px). So does a
  near-vertical drag (25 px sideways over 200 px down). Neither hides anything or opens the sheet. A 40 px horizontal nudge
  does nothing. A full swipe toward the tray hides the trader (one exclusion), and Undo by tap clears it. A swipe the other
  way opens the sheet. This matches the feed section.
- **Screen reader.** Region "Similar trades" › h2 › paragraph › list of 3 links. Each link's name reads as one sentence:
  "Ux Trader 10 @uxpb_t10 QKY0 · closed Oct 14, 2026 ✓ Verified Held under a day". The swipe tray and sentinel are
  aria-hidden. Tab order from "Show 10 more" goes row 1 → row 2 → row 3 → "← Feed" → footer, and signed in, each row's "…"
  comes after its row.
- **Empty case.** A 4-close record has no section, no heading and no rule (`empty-uxpb_few-320.png`). The section stays
  consistent with the feed section (same row, sheet, menu, bar and copy pattern). No page errors.
- **Stage 5 on the profile is intact.** The record chart is unchanged (0% shown), the confidence wording and the
  "per-trade, equal-weight" drawdown label are present, the full closes list and paging come first and are unhidden, and the
  disclaimer is in the footer. The fixture had no open positions, so that block was not exercised.

## Problems

1. **blocking: hiding all three rows leaves an empty section and drops keyboard focus to the page.** After the third "Not
   interested", the heading and explainer stay with no rows under them (143 px at 375). When the bar ends (Esc, or after
   5 s), focus goes to `body`. `FeedHides`' fallback looks for `.feed .row .card .who`, and a profile has no `.feed`
   (`allhidden-after-bar-375-light.png`). On the feed, PR-3 fix round 1 already collapses the section when no row is left.
   On the profile, the same scope should hide the whole `.similar` section, and focus should go to the next focusable item
   after it ("← Feed") instead of the page. This is a WCAG 2.4.3 focus loss and a heading over nothing. After a reload,
   three new rows come back, which is correct.
2. **follow-up: straight apostrophe in the explainer.** "@x's typical trade" uses `'`, while the rest of the app (and the
   sheet's name, "Ux Trader 10's record") uses `’`. Change it in `SIMILAR.explain` in `lib/copy.ts`.
3. **follow-up: row weight.** Rows are bordered cards on a page whose own closes are plain lines. They read as secondary
   because of their position and the small heading, not because of their styling. A borderless or lighter row would sit
   more quietly. This is a taste call for the designer, not a defect.

USABILITY: PROBLEMS
