COMPLIANCE: PASS · USABILITY: PASS

# F-1 · PR-3 committee · UX lead · round 2

2026-10-23, `b95f281`, fresh `CI=1` build (the framework's advisory stopped it once; nothing upgraded), port 3102,
fake 4172, reduced motion, keyboard only, 375/360 px, light/dark. Screenshots: `screenshots/pr3/committee-ux-round2/`.

## Heavy profile (2,828 closes)

| | Visitor | Owner |
|---|---|---|
| HTML | 235 KB | 275 KB |
| Height | 5,100 px | 7,959 px |
| Rows | 50, "Showing 50 of 2,828 closed trades" | same |
| First Tab stop | the skip link; Enter focuses the footer with the disclaimer in view | same |
| Tab presses to the footer without the skip link | 115 | 219 |

- **"Show 50 more"** (44 px).
  - JS off: row 51 is in view under "Showing 51–100…".
  - JS on: Enter moves focus to row 51.
- **Last page** (56 follows): "Showing 2,801–2,828 of 2,828", 28 rows, only "Back to the newest".
- **Chart.** 2,828 point links over 57 pages, none to a missing row. Keyboard: arrows, Enter, "Go to trade in list"
  focuses that trade on its page.
- **Format.** Every count grouped; a range reads "(-0.4% to 0.0%)"; a near-total loss "-99.999%". No horizontal scroll.

## Long import (4 × 1,500, 2.5 s pages, forced 503 at 3,000)

- **Progress announcements.** The live region said "1,000 / 1,500 / 2,500 / 3,000 activities imported so far" at
  5/10/15/20 s, while the status line still showed 0 closes.
- **Timeout wording.** 59 s after the last new row: "Still waiting for your broker. You can leave; the import
  continues." It never said "still sending".
- A parallel test run on the shared database finished this import early (2 accounts empty), so "N closed trades so
  far" was not seen; Re-run 3 covers it. Environment, not product.

## Evidence line

Overlapping record (400-day holds): "Too early to tell: 2,828 trades in 8 overlapping positions
(10 independent bets needed)".

## Compliance: PASS

Disclaimer and legal links are one key press from the top; every close and chart point stays reachable.

## Notes (not blocking)

- The owner needs 219 Tab presses to reach the footer (a thesis form on every row). The skip link covers this.
- A "0.0%" average still shows in the loss colour.
- The footer's focus ring is only its top border.

Server and fake stopped; test users deleted.
