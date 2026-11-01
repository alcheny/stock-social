# F-6 committee review: business lead (build on `claude/f6-open-positions`, 088aaa1)

**Compliance: PASS.** **Usability / business: NOT PASS. 2 blocking demands (D1, D2) and 2 that can land in the same PR (D3, D4).**

Strongest reason: on the profile and the feed card, a trader who sells winners and holds losers is caught at a
glance. But the swipe pane (SW-1, where most viewers meet a record) still opens on the most flattering closed-only
number, with the unrealized row below the fold. Directly under the −3.4% combined figure, the evidence line still
says "above zero" in bold green.

## How I tested
`next start -p 3300` (ALLOW_DEV_AUTH=1), 360×800, Playwright, light and dark. Fixtures (`f6bl_*`, deleted afterwards):
- `f6bl_holder`, "sells winners, holds losers": 20 closes, 85% win rate, +7.6% avg, 5 closes in the last day (feed-eligible), plus 6 open positions, all losing, −40% avg.
- `f6bl_allwin`: every close and every open position up.
- `f6bl_openonly`: open positions and no closes.
- `f6bl_new`: a first-time trader via `/login/dev`.

Screenshots: `docs/features/logs/F-6/screenshots/bl-*.png`.

## What a viewer sees (f6bl_holder)
| Surface | First viewport at 360×800 | Caught? |
|---|---|---|
| Profile, signed out (`bl-profile-holder-fold.png`, `-dark.png`) | Realized 85% / **+7.6%**, then the unrealized row at the same size: 6 open, "0 up, 6 down", **−40.0%** in red, then "Including open positions at current value: **−3.4%** avg / result (26 results)". The combined line ends at y=648. | Yes |
| Feed card (`bl-feed-card.png`, `-js.png`) | Big +30.0% close, then "Also open: 6 positions · 0 up, 6 down · **−40.0%** avg unrealized" at body size in red | Yes |
| Feed pane (`bl-feed-pane-js.png`) | **+286.6% · All time** in large green (the closed-only equal-weight chart), the chart, then the realized grid. The unrealized grid starts at y=726 and ends at y=878, so it is cut off; the combined line is off screen. The only sign of open positions above the fold is the small muted chart note. | **No** |
| `/t/F6BLX`, `/t/F6BLV` (no closes), `/t/compare` | Aggregate line only: no handles or links, "not a prediction or a rating of the stock" | n/a, correct |
| `/how` | The 4 new math sentences | OK |
| First-time trader (`bl-trader-landing.png`) | Unchanged, zero `[data-open]` | OK (AC3) |
| Trader's own view with open positions (`bl-trader-own-with-open.png`) | Same rows below the share block | OK |

Losses as prominent as gains: yes. The same `.stat big` size, "0 up" is printed, the down color always comes with a "−" sign, and the all-winning record mirrors it in green.

## Fidelity to the plan and my sign-off
- "avg / result" (sign-off D1): **delivered** (`lib/copy.ts` `OPEN.combinedTail`; e2e asserts the exact string and the tone class).
- Order realized → unrealized → combined (sign-off D2): **delivered**. The grids and the line are DOM siblings on the profile and the pane, and `combined()` returns null without closes. `f6bl_openonly` shows no combined line.
- Two grids at most, no combined win rate, `chart.tsx`/schema/deps untouched, ~242 non-test lines: **delivered**.
- Every new node carries `data-open`, and a record with no positions renders today's HTML: **delivered** (e2e, plus `f6bl_new`).
- The plan put the pane's new rows "under the two existing stats". That is faithful to the plan, but it is what fails D1: the plan was wrong for the pane, not the build.

## Compliance (POLICY, COMPLIANCE §1/§2): PASS
- F3: the footer disclaimer is on every page visited, light and dark.
- P3: percent and counts only. No $, prices, quantities or sizes anywhere in `[data-open]`.
- F1/F2: no buy/sell/hold/signal or promissory words.
- F3a: no completeness claims ("closed trades only", "not in the figures above").
- F3b: `/t` and compare show the aggregate only, with no roster of holders, and are labelled as not a rating.
- TR-3: importing and stray records are excluded.
- TR-4: losses are equal in size to gains.
- Accuracy note: "at current value" is not true for a `failed` record whose last read is old. D3 fixes this without changing AC2's wording.

## Demands (builder; prioritized, testable)
1. **D1 (blocking): pane order matches the profile.** When the trader has open positions, the pane renders the
   realized grid, the unrealized grid and the combined line *before* `figure.chart`, followed by the chart and the chart note. A
   pane with no positions keeps today's order (AC3). Why: SW-1 makes the pane the main way viewers meet a record. Today it
   leads with +286.6% in green and hides the −40%, which is exactly what F-6 exists to stop. Verify: e2e at 360×800 with
   JS, swiped to the `f6_mixed` pane. `section.open-stats` precedes `figure.chart` in DOM order, its boundingBox bottom is
   ≤ 800, and the no-positions pane (a demo trader) has `figure.chart` before `section.stats`.
2. **D2 (blocking): scope the evidence verdict first, and delete the trailing sentence.** With open positions, the evidence
   line starts "Closed trades: " in place of "Past results: " (when there is no "Past results:" prefix, it is put before the
   existing text), and "The range covers closed trades only; open positions aren't in it." is removed. The
   "Realized · closed trades" row label already scopes the range. Why: a bold green "above zero" right under a red
   −3.4% reads as the site contradicting itself, and the scope arrives only at the end of a 3-line paragraph. This is
   one fewer sentence, not one more. Verify: on `f6_mixed`, `.evidence p` text starts with "Closed trades: " and does not
   contain "The range covers"; on `f6_none` the text is unchanged.
3. **D3 (same PR): date the unrealized row.** The unrealized row label on the profile and the pane reads
   "Unrealized · open positions at current value · as of Oct 30". `min(fetched_at)`, UTC, "Mon D" when it falls in the
   current year, otherwise "Mon D, YYYY". The pane needs `fetched_at` in the `lib/feed.ts` open read. Why: a failed record
   stops refreshing, and "current value" without a date can be weeks stale (accuracy, F2). Verify: e2e asserts the label
   text on `f6_mixed` (profile and pane).
4. **D4 (same PR, taste): no repeated count, no orphaned "0".** The first unrealized stat shows the big count over
   "open positions · 0 up, 6 down", with no second "6". Each count and its word are joined by a no-break space, so
   "0 / up" never wraps across lines (it does today at 360 px, `bl-profile-holder-fold.png`). Verify: the small text does not
   start with a digit, and the HTML contains "0 up".

Reviewer/tester: the e2e checks the pane's content, not where it sits. Add the D1 viewport assertion. A check of the pane
that ignores the fold is not a check of what the viewer sees.

## Scorecard
| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Owner direction; record-trust complaints about "realized only" are the category's known gap (prior plan rounds) |
| Ease of adoption | 3 (5 after D1) | Profile and card: understood in < 2 s. Pane: the key number is below the fold |
| Phase fit | 4 | Strengthens "verified, losses included", the trust gate |
| Revenue impact | 3 | Indirect: trust in the record improves the quality of shared links |
| Aesthetics & clarity | 4 | Clean, uses existing tokens, works in light and dark; D4 wrap issue |
| Trust & compliance | 5 | See the compliance section |
| Simplicity | 4 | 2 grids, 1 line, ~242 lines; D2 deletes a sentence |
| Craft & taste | 3 (4 after D1, D2) | Pane ordering and the green "above zero" undercut the point |

## Demo sentence
"This trader wins 85% of closed trades. One row down, at the same size: 6 positions still open, all down,
−40%. Counting those, the average is −3.4%."

What would change my mind on D1: seeing that viewers mostly open full profiles rather than panes. The pane-open rate
in the funnel events would settle it in a week. Until then, the pane is the main surface.
