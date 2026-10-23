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

# Round 3

2026-10-23, `9f1013c` (fix rounds 7–8), the existing `CI=1` build (no source newer than it; it lists
`/u/[handle]/pane-chart`), port 3103, vendor fake 4183, no tick, reduced motion. I tested as a trader and as a signed-out
visitor at 375 and 1280 px, light and dark, keyboard only. I read the accessibility tree and the live regions
from the DOM. Screenshots: `screenshots/pr3/ux-round3/`.

USABILITY: PROBLEMS (0 blocking, 6 follow-up)

## Import phase (2 accounts × 2,500 activities, 2.5 s vendor pages)

- **Copy.** The owner sees one count, which climbs each step:
  - "Importing your record · 0 / 1,000 / 2,000 / 2,500 / 3,500 / 4,500 / 5,000 activities read from your broker", about
    every 4.5 s;
  - then at 30 s, "2,355 closed trades so far", with "5,000 activities imported" under it;
  - then "Import finished.";
  - then the banner is gone at 40 s.
  - The duplicate line no longer shows while counting (`import-counting-*`, `import-closes-*`).
- **Motion.** There is no animation. The number changes in place. Layout shift during counting was 0.
- **Visitor** (signed out, `import-visitor-*`): "Importing this record · 0 closed trades so far". It is the one live
  region and has no activities line.
- **Screen reader.** Only the hidden status line and the hidden "N activities imported so far" twin are live. The seen
  headline is `aria-hidden`. The twin trails the headline by one step (2 s throttle), as designed.

## Pane: stand-in to full chart (2 records of about 4,800 closes each, route held 3 to 4 s to watch the swap)

- **Data.** Nothing is fetched at page load. The stand-in has 80 points and the full chart has 400, with 399 point
  links.
- **Request.** Opening the pane with → from the card fetches `/u/<handle>/pane-chart` once.
- **Swap.** At ALL the swap shows no flicker: figure height 312 px (375) and 373 px (1280) before and after, no
  layout-shift entries, and header and label identical ("4,818 trades, ≈-100% total, max drawdown ≈-100%"). The
  `pane-standin-*` and `pane-full-*` screenshots look the same apart from finer detail in the line.
- **Scrub position.** It is kept. Three ← presses on the stand-in landed on 8/28/2026. After the swap the header read
  "8/28/2026 · AAA" with focus still on the chart. The next ← moved one close, and Enter opened that close's sheet.
- **Keyboard path.** From the card name, Tab reaches the symbol, "See their record", "← Back", the name, then the chart.
- **No JS** (`nojs-pane-*`, all four):
  - The stand-in line is drawn, with "0%" on the axis.
  - The label is the full record's.
  - The badge is ✓ Verified, and the win rate and average return are shown.
  - No request is made, and the page has no horizontal scroll.

## Copy, names, trust

- **Plurals.** "1 earlier position excluded" (demo) and "38 earlier positions excluded" read correctly, and no "(s)"
  appears on the feed, profiles or /how.
- **Handle shown once.** A display name equal to the handle shows "@uxr3heavy" once on card and pane. A different name
  shows "Ux Named Trader @uxr3named" on the card.
- **Trust badges.** Card and pane agree on every row: Verified for both heavy records, Demo for the demo trader. Each
  badge stays outside the figure, so the swap never touches it.
- **Pane-chart route.**
  - It returns only `base, trades, ranges`: no badge or verified flag, and no prices or quantities.
  - It sends `public, max-age=60`, and an unknown handle gets 404 `no-store`.
  - So the trust rule stays where it was: rendered on the server with the page.

## Problems (none blocking)

1. **follow-up: one wrong frame when scrubbing before the full chart arrives.** The full series renders once with the old
   index before it is mapped to the nearest time, so for about 40 ms the dot jumps to 2018 and the header reads
   "-99.0% · 10/12/2018 · EEE". Then it shows "8/28/2026 · AAA". The polite live header changes twice. Seen at both
   widths (rAF trace). It only happens if a key is pressed inside the load window. The fix is to map the index in
   render or in a layout effect.
2. **follow-up: a range picked while loading shifts the layout.** "Loading the chart…" changes the figure height (312 →
   369 → 312 px at 375; 373 → 346 → 373 at 1280), and everything below moves twice. The fix is to give `.chart-empty`
   the chart's aspect ratio.
3. **follow-up: name and handle run together in the pane header.** It reads "Ux Named Trader@uxr3named", because
   `.pane .who` is inline-flex and drops the space. At 375 the handle is cut to "@u…". The card is fine. This is older
   than this round.
4. **follow-up: the end of the import shifts the layout, and the count changes verb.**
   - The activities line comes back with the first close (banner 86 → 106 px), then the banner shrinks to 0. The layout
     shift for the whole import is 1.01 (known: 0.98 in round 1).
   - The same count is "read from your broker", then "imported". One verb would read better.
5. **follow-up: what a screen reader user reads while counting.** Reading the banner line by line gives the hidden
   "Importing your record · 0 closed trades so far", the line sighted owners no longer see. Visitors also see "0 closed
   trades so far" for about 30 s.
6. **follow-up: the stand-in exposes an empty "Chart points: each links to its trade below" group.** Without JS, the
   "Drag across the chart…" hint and live-looking range tabs stay but do nothing. This is older than this round.

## Environment

Two early import walks went to `failed` (vendor) partway through. Another member's e2e run on the shared database was
running ticks that advanced every importing connection against its own fake. That is environment, not product. Those
walks only supplied the counting-phase observations above. The two full walks ran with no other tick.

Server and fake stopped. Test users (`uxr3*`) and their broker accounts deleted. No product code changed.
