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

## Round 2 (HEAD 97d3c83, PR #33)

**Compliance: PASS.** **Usability / business: PASS, on one condition (D5, a regression this round introduced). The fix is CSS only and needs no committee re-sit; the tester verifies it.**

Tested: my own `next start -p 3300` on the current `.next` (BUILD_ID 08:00, which contains the round-2 copy), 360×800, JS
on, touch, light and dark, against the same `f6bl_*` fixtures (deleted afterwards). Screenshots: `screenshots/bl-r2-*.png`.
Correction to round 1: my round-1 server on 3300 was not stopped, although I reported it was (the port check used a
missing `ss`). I found and killed it this round before testing. Every number below comes from the fresh server.

| Demand | Result | Evidence |
|---|---|---|
| D1 pane leads with the figures | **Delivered** | Swiped pane, 360×800: realized grid y=157, unrealized grid y=294–518, combined line y=534–580, chart starts at y=596. The −40.0% and the −3.4% combined are both in the first viewport, light and dark (`bl-r2-feed-pane-light.png`, `-dark.png`). A demo trader with no positions has 0 `[data-open]` and keeps today's order. |
| D2 evidence scoped first | **Delivered** | "Closed trades: above zero · Evidence: thin (…)" and "Closed trades: Too early to tell: …". The trailing sentence is gone. A no-position record still reads "Past results: …". |
| D3 dated unrealized row | **Delivered** | "Unrealized · open positions at current value · as of Oct 31" on the profile and the pane |
| D4 count once, no-break spaces | **Delivered** | "6" over "open positions · 0 up, 6 down"; the HTML contains "0 up" |

Checked again: `/t` (the no-closes stock no longer says "figures above"), `/t/compare` (the empty column likewise),
`/how` (the corrected stock-page sentence), the footer disclaimer on every page, no horizontal scroll, percent only.
The sell-winners/hold-losers trader is now caught at a glance on the profile, the feed card and the pane, which are
the three places a viewer meets a record.

### Remaining demand
5. **D5 (condition): a percent never splits across lines.** The new `.open-stats .stat b { overflow-wrap: anywhere }`
   breaks "−40.0%" into "−40.0" / "%" at 360 px: the tile is 160 px wide and the value is 104 px tall against 52 px for "+7.6%".
   It is fine at 375 and 414. This happens on the profile and the pane (`bl-r2-profile-holder.png`, `bl-r2-feed-pane-light.png`). The number F-6 exists to show
   is the one that looks broken, and a two-digit loss is the typical case for a holder. Fix: keep the value on one
   line (`white-space: nowrap`) and size both grids' values with one shared rule (e.g. `font-size: clamp(…)` on
   `.stats .stat.big b`), so TR-4's equal font-size still holds and nothing overflows. Verify: e2e at 360 px with unrealized
   −99.9% and realized −40.0%. Every `.stat.big b` in both grids has the same computed font-size and the same height
   (one line), `scrollWidth ≤ 360`, and the text is unbroken (`b.getClientRects().length === 1`).

Notes, not demands:
- An open-only record's unfurl text no longer mentions its open positions (decision 20, pinned by an existing e2e).
  The profile shows them. F-4's share card should carry them.
- Share card images are deferred to F-4 (decision 21). AC1's "share card at every size" stays open until then, and
  the PR does not claim it.
- The `open_positions(symbol)` index is additive. CI's schema guard allows it.

Demo sentence (unchanged): "This trader wins 85% of closed trades. One row down, at the same size: 6 positions still
open, all down, −40%. Counting those, the average is −3.4%."
