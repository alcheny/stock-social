# F-2 PR-1b: exploration and reach (UX lead verdict)

Build: `claude/adoring-euler-4469ys` at 350522b, `CI=1 npm run build` (stdin closed), `next start -p 3118`, vendor fake on
4198, own database `ss_ux_pr1b` (Postgres 16, owned by the shared role, schema + 3 Demo traders). Fixture (`uxr_*`, 111
verified traders): 6 hyperactive (40 closes each in the last two days), 40 hot (8 closes), 60 ordinary (6 closes), 5
newcomers (5 closes, accounts 3 days old). 406 hot+hyperactive cards, so the ordinary and the newcomers sit outside the 200
candidates. Viewed at 375 and 1280 (plus 320 for the open follow-up), light and dark, signed out and in, by mouse and by
keyboard, reading names, roles and focus as a screen reader would. Screenshots: `screenshots/pr1b-ux/`.

## 1. Variety over the first 60 cards

Same list signed out and signed in (the read is impersonal, as promised).

| | Result |
|---|---|
| Distinct traders in 60 cards | **38** |
| Outside-the-200 traders reaching a card | 5 ordinary, 1 newcomer (cards 8, 33, 38, 43, 48, 53) |
| Hyperactive cards | 16 of 60 (6 of 111 traders) |
| Repeated 3-trader run | **0** |

It no longer reads as "the same handful": from card 30 on, an ordinary record appears about every fifth card. Sameness that
remains, both follow-ups (product order, not a defect of this PR):
- **Opening screen**: 6 of the first 7 cards are the 6 hyperactive traders (`feed-top-*.png`). A first-time visitor's first
  impression is the busiest accounts. *(follow-up)*
- **One trader on a beat**: `uxr_hyper4` lands at cards 17, 27, 37, 47, 57 (every 10th), 8 of 60. No 3-trader run repeats, so
  the acceptance test passes, but a scroller notices the same name returning on a rhythm. *(follow-up: extend the discount
  past the top 30, or cap one trader at about 1 in 12 cards)*

## 2. The section and its third row

- Section 1 (after card 5): Dan (Demo), Maya (Demo), `uxr_hot1` (Verified). Section 2 (after card 35): `uxr_hot4`, `uxr_hot12`,
  `uxr_new0` (the 5-close, 3-day-old record): the new-record slot works there. None of the six rows had an earlier card.
- **Row 3 reads honestly.** It looks exactly like rows 1 and 2: name, handle, Verified badge, "Typical holding period: 1 to 7
  days". No number, no "rising", no hint that it is good; the heading line "Ordered by how much evidence each record has"
  stays true because it has the least evidence and sits last. The reason line makes sense to a visitor (it describes a
  trading style, not a merit). A visitor is not told it is a new record; that is fine (no claim made), and the sheet shows the
  5 closes with losses. No change asked.
- In section 1 the slot went to an 8-close record although four newcomers (5 closes, other holding buckets) were outside the
  candidates. Possibly their interval already clears zero (weight > 0) so they are not slot-eligible; not investigated further.
  *(follow-up for the engineer: confirm, or this fixture shows a newcomer missing the first section)*
- **Two Demo rows above a Verified row** (`section-*.png`): true under the documented order, but for a visitor the first two
  suggestions are sample data, and the only real record is last. Badges are clear ("Demo", tooltip "Sample data, not from a
  real broker."), so it is not misleading. Recommendation: Verified records ahead of Demo in the section (the engineer's
  one-line rule); product call for the business lead. *(follow-up)*

## 3. Sheet disclaimer (375 / 320)

After "Skip to the disclaimer", focus lands on the disclaimer paragraph (focus-visible) and it is wholly on screen: 375
light/dark 597.8 to 665.2 of 667 (1.8 px spare); 320 499.0 to 566.4 of 568; 1280 pane 750.6 to 798.3 of 800
(`sheet-disclaimer-*.png`). Escape returns focus to the row link that opened it. **Fixed.**

## 4. Regressions

None found. Section rows: 44 px targets, no horizontal scroll (scrollWidth = viewport at 320, 375, 1280). Sheet/pane open
from row 3 by Enter, focus on the name link inside the dialog, Escape back to the row. Follow → "Following @dividend_dan. Only
you can see this." and back to Follow. Hide by mouse → row removed, "Hidden for 90 days. Undo", Undo restores. Paging to 60
cards: no duplicate trade, sections every 30 cards. Dark mode contrast unchanged.

## 5. Open follow-ups from PR-3 round 2 (unchanged by this PR; still open)

- **Cramped rows at 320 signed in** (`section-320-light-in.png`): the name column is 94 to 106 px, handles truncate to
  "@dividen…", the reason wraps to four lines, rows are 177 px tall. *(follow-up)*
- **Mouse-hide Undo timeout**: after a mouse hide, focus is moved to Undo, yet the bar is gone between 3 s and 6 s while focus
  is still on it. A keyboard or screen-reader user who lands on Undo and pauses loses it. *(follow-up; should pause while
  Undo has focus or hover)*

## 6. Cleanup

Test viewers and `uxr_*` traders deleted; server and fake stopped; `ss_ux_pr1b` dropped. No product code changed. No
third-party company named.

USABILITY: PASS (no blocking problems; follow-ups: opening-screen sameness and the every-10th-card trader, Demo rows ahead of
Verified, the first-section newcomer check, 320 signed-in rows, Undo timeout while focused)
