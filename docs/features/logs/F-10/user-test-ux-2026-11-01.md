# F-10 / F-12 user test (UX lead), 2026-11-01

Verdict: **NOT YET**: 3 blocking findings, 11 non-blocking.

## Setup
- Production server at `http://localhost:3100` (`ALLOW_DEV_AUTH=1`), seeded demo traders (`dividend_dan`, `yolo_yuki`,
  `momentum_maya`, 30 closed trades each).
- Playwright Chromium at 360×640 in light and dark, plus 320×640 light, with fonts from `e2e/fonts.conf`. I tested signed
  out first, then signed in as `momentum_maya` through `/login/dev` (handle, display name, 18+ checkbox).
- Pages: `/` (first screen, the "lucky" card `yolo_yuki` PLTR +16.9%, tapping "See their record, wins and losses →"),
  `/u/yolo_yuki/trade/demo-yolo_yuki-0-s` (TSLA -16.8%), `/u/yolo_yuki/month/2026-09` (losing month, -4.8% average),
  `/u/yolo_yuki/month/2026-11` (2 trades, Too early to tell), `/u/momentum_maya/trade/…` and `/month/2026-10` signed in,
  and the profiles.
- Images: `/u/yolo_yuki/trade/demo-yolo_yuki-0-s/opengraph-image`, `/u/yolo_yuki/month/2026-09/opengraph-image`,
  `/u/yolo_yuki/month/2026-11/opengraph-image` and `/t/TSLA/opengraph-image`. I decoded each one, found the text extent
  and checked it against the square crop x 285–915.
- Screenshots: `docs/features/logs/F-10/screenshots/`.

## What passes
- **Consistency:** the numbers match on every surface. Yuki shows 30 closed trades, +0.9% average and the range
  -2.9% to +4.7% on the feed card, profile, trade page, both month pages, the trade and month images and the og:image:alt.
  Maya (+1.4%, -0.1% to +2.8%) and Dan (+0.9%, +0.4% to +1.3%) match the same way.
- **Honest wording:** a short month says "Too early to tell" on the page and the image, with no bare average. A
  negative month average (-4.8%) uses the down tone with the sign in the text. Month pages have no "Past results:"
  verdict and no win rate. Images and alt text have no win rate. Trade and month pages and alt text never say
  "full record", "whole record" or "every trade".
- **Badge:** "Demo" leads the feed line, the pages say "Demo data", the images say "Demo data" or
  "Includes sample data", and nothing says "verified".
- **Layout:** no horizontal scroll at 320 or 360 on the feed, trade or month pages, signed in or out. The card return
  and the whole strip are in the first screen at 360×640.
- **Contrast:**

  | Text | Contrast |
  |---|---|
  | Strip text, light | 5.0:1 |
  | Up tone, light | 4.8:1 |
  | Down tone, light | 6.0:1 |
  | Strip text, dark | 5.8:1 |
  | Up tone, dark | 8.6:1 |
  | Image grey (139,139,152 on 11,11,15) | 5.8:1 |

- **Crop:** the text on all four images sits in x 309–758 and y 31–604, inside the centred square crop. Only the
  "Stock Social" brand box falls outside it, as designed. The trade and month images keep the disclaimer in full
  (3 lines at 26 px).
- **Reading order:** the feed card reads name → symbol → return → strip → thesis → record link. The strip is a real
  `<p>` and is not aria-hidden. Tapping the card's record link opens `/u/dividend_dan`.

## Blocking

### B1. Feed: the disclaimer is not on the first screen at 360×640 (F-10 AC9 not met)
- Screenshots: `feed-360-light-signedout.png`, `feed-lucky-card-360-light-signedout.png`, `feed-360-dark-signedout.png`.
- The only visible "Not investment advice…" on `/` is `footer#site-footer`, which starts at y = 640, just below the
  fold. A signed-out visitor from a shared link sees "+16.9%" in 72 px with no disclaimer. "Skip to disclaimer" is a link,
  not the disclaimer. The e2e "business lead glance" checks the return and the strip but not the disclaimer, so CI
  passes anyway.
- Fix: land fix #3 with F-10, or add a one-line `muted small` disclaimer in each `.card` footer under "See their
  record…". Add `await expect(page.getByText(DISCLAIMER).first()).toBeInViewport()` to the 360×640 glance test in
  `e2e/record-strip.spec.ts`.

### B2. Feed card: the range in brackets has no label and reads as the trader's lowest-to-highest trade
- Screenshots: `feed-lucky-card-360-light-signedout.png`, `feed-360-light-signedout.png`.
- The card shows "PLTR +16.9%" and then "30 closed trades · +0.9% average per trade (-2.9% to +4.7%)". A first-time
  reader can only read "(-2.9% to +4.7%)" as "their trades went from -2.9% to +4.7%". That contradicts the +16.9% hero
  above it, and it hides that the range crosses zero, which is the one fact that stops the lucky trade reading as
  skill. The profile, pages and images all say "· 95% range"; only the card drops it (the committee's two-line
  exception). The two-line budget is not the binding limit at 360: line 2 has about 60 px free.
- Fix: label the range in the feed variant with as few characters as possible. Use "(range -2.9% to +4.7%)" from
  `recordStrip(…, 'feed')`, or "· 95% range" where it fits. At 320, accept a third line, or drop "per trade" to
  "avg / trade" on the feed only. Add an e2e assertion that the feed strip contains "range".

### B3. Images: the record block has no label, so the month and record figures run together
- Screenshots: `og-month-yolo_yuki-2026-09.png`, `og-trade-yolo_yuki-TSLA.png`.
- The September image stacks "12 closed trades this month / -4.8% average per trade / (-10.3% to +0.7%)" directly on
  "30 closed trades / +0.9% average per trade / (-2.9% to +4.7%)". Nothing says the second block is the record, so a
  viewer reads two conflicting averages for September. The trade image has the same problem in a milder form: "30 closed
  trades" follows the trade with no heading. The page labels the block "@yolo_yuki's record", and the alt text does too
  ("@yolo_yuki's record: …"); only the image drops it, and images are how most links travel.
- Fix: in `layoutBand`, move the `handle` line (28 px, muted) from the top of the band to just above the record count,
  as "@yolo_yuki's record". The line count stays the same, so it fits the band already checked to y 604. Keep the month
  block's lines first. Add an image test that the record label's y sits between the month block and the record count.

## Non-blocking

| # | Finding | Screenshot | Fix |
|---|---|---|---|
| N1 | A positive average whose 95% range crosses zero is bold green: Yuki +0.9% (-2.9% to +4.7%) and Maya +1.4% (-0.1% to +2.8%) on the card, pages and images. The profile calls these "Past results: unclear", but green still signals "up" at a glance. Consistent with the profile, so not an F-10 defect. | `feed-lucky-card-360-light-signedout.png`, `og-trade-yolo_yuki-TSLA.png` | Design system council: neutral (text) tone when the range crosses 0, on every surface at once (`toneOf` in `lib/record-strip.ts` and the profile). |
| N2 | Screen readers hear the strip run together: the accessible text is "Demo 30 closed trades+0.9% average per trade…". The " · " separator is aria-hidden and nothing replaces it. | `feed-360-light-signedout.png` | In `Figures`, render `<span aria-hidden="true"> · </span><span className="sr-only">, </span>` (or keep the separator visible to assistive tech). |
| N3 | Keyboard: after the first card's record link, Tab moves into the off-screen profile pane ("← Back", chart buttons 1W…ALL) at 360, so focus disappears from view. | `feed-360-light-signedout.png` | Make the closed pane `inert` (F-2 / SW-1 owner). |
| N4 | The strip wraps mid-phrase: "+0.9% average / per trade" on the card, "· 95% / range" on the trade and month pages. | `feed-360-light-signedout.png`, `trade-360-light-signedout.png` | Use `white-space: nowrap` on each `StripPart` span, or non-breaking spaces inside "average per trade" and "95% range". |
| N5 | Month page hierarchy: "12 closed trades this month" is a 3-line ~40 px hero, and the average or "Too early to tell" is 14 px below it. The count outweighs the result and the verdict. | `month-2026-09-360-light-signedout.png`, `month-2026-11-360-light-signedout.png` | Make the count a normal line and give the average or "Too early to tell" the hero size (or both 16 px bold). |
| N6 | Repetition: "@yolo_yuki's record" appears three times above the fold on the trade and month pages (back link, h2, strip link). The month page also keeps "See their record, wins and losses →", a second link to the profile, which the trade page removed as one link per destination. | `trade-360-light-signedout.png`, `month-2026-11-360-light-signedout.png` | Drop the strip link where the back link already points to the profile, or drop the footer link on month pages, so trade and month match. |
| N7 | The trade's own return has a different tone on each surface: red on the feed card, black on the trade page, white on the trade image. The sign is always in the text, so it is still honest. | `trade-360-light-signedout.png`, `og-trade-yolo_yuki-TSLA.png` | Give the trade return the up and down tone on the page and image too. |
| N8 | Image typography: the space between words is visibly wide ("Not investment  advice.", "Past performance  does not") on all images. | `og-trade-yolo_yuki-TSLA.png`, `og-stock-TSLA.png` | Check the bundled font's space glyph and any letter or word spacing in `RecordStripImage`. |
| N9 | Wording drift: month meta description says "30 demo trades", the strip says "30 closed trades", and the profile tile says "avg return / trade" where the strip says "average per trade". | none (meta tags; profile in `feed-tap-record-360-light.png`) | Build the description from the strip's own parts, and align the profile label later (D23). |
| N10 | At 320 px the site nav is clipped ("Publish your trad…") on every page. There is no horizontal scroll; the overflow is hidden. Not F-10 code, but it fails "nothing clipped". | `feed-320-light-signedout.png` | Let the nav wrap or shorten it at narrow widths (layout owner). |
| N11 | "Return if every trade were the same size" (the profile chart label, also in the feed's profile pane) trips the "every trade" ban. It is a hypothetical, not a completeness claim, and it is outside F-10 and F-12. | `feed-tap-record-360-light.png` (profile) | Reword it to "Return at equal size per trade" (chart owner). |

## Not observed live
- The seed data has no feed card with a short or wide record, an F-7 public-trader card, or open positions next to the
  strip. "Too early to tell" on the feed and "Also open" beside the strip rely on the e2e fixtures (`f10_early`,
  `f10_strip`) rather than this test.
- Signed in, the feed, trade and month pages match the signed-out results: same strips and no scroll. The nav shows
  "My record @momentum_maya" (`feed-360-light-signedin.png`).
