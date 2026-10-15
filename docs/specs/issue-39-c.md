# Spec: Feed profile pane (SW-1), variant C: chart-first record pane

Variant: **C · Trust** · Spec agreed by designer and business analyst

## Agreed spec

docs/specs/issue-39-c.md

## Designer ⇄ business discussion

### Round 1

**Designer:** Spec for variant C is written and committed. Each feed item becomes a horizontal scroll-snap row of [trade card | profile pane]. The pane leads with the chart and a one-line honest summary, then the headline stats, the last 5 trades and a "See full profile →" link. One batched query serves all visible traders. There is no gesture library and no new vendor.

**Business analyst (approved):**
- Ease of use: Good. Swipe left opens the pane, and → does the same on desktop. The "← Back to trade" button, the visible name link and the "See full profile →" link give clear exits. The order is chart, honest summary, stats, last 5 trades, then link, so the record is clear within about 3 seconds. The spec honestly flags that a swipe starting on the chart (touch-action: pan-y) won't scroll the row. The back button covers that. Contrast is also covered: the demo line "Sample data, not from a real broker." and the Demo badge keep sample data distinct.
- Retention: Modest, which is fine for Phase 1. Each card now leads to the full record in one gesture, so a viewer can check several traders in one feed session. The always-shown worst trade and the last 5 trades with losses at equal weight give the viewer a reason to trust the feed and come back. The first-run hint is hidden after first use, so it won't nag. Consider recording, in the QA log, whether returning from the full profile lands on the same card (the spec correctly treats that as best-effort).
- Virality: Indirect but credible. The pane puts the verified, losses-included promise in front of every viewer, which is what makes a shared link worth trusting. The pane is stronger sales material than a name tap, so the "See full profile" tap rate is the metric to read, as the spec says. No share action is added to the pane, which is correct for this issue. Growth doesn't override trust here: no rank language, no confetti, no hype, and the "New record" label is gated on #12 so it isn't invented.
- Feedback: Approved. Do these in the build:
1. State the limit on the "share of sessions with a pane open" metric. A pane open leaves no route hit, so it can only be approximated from `/u/[handle]` hits that follow `/`. The spec already says this, so keep the sentence in the PR body.
2. The footer line "Every closed trade from the connected broker is published. Nothing can be hidden." must stay true. Don't ship it if the thesis/hold path or a TR-1 gap could contradict it. Reword it to "Every closed trade is published, losses included." if in doubt, and never say "all of their trades" (TR-8).
3. The summary line's "Record since <date>" must use the earliest closed trade. Label it "since first closed trade" rather than implying account age if the two can differ.
4. Pane stats use all-time trades, never a window, and the pane's win rate and avg return must equal the profile's numbers. Add one test asserting `paneSummary` equals `stats()` on the same input.
5. In the e2e test, run the keyboard checks with focus inside the chart figure too, and assert that ← and → step the chart points and do not move the row.
6. Record the iOS Safari direction-lock result in the QA log. If you can't test on a device, say "not verified on iOS Safari" explicitly.
7. Keep the diff within 400 lines. Cut the first-run hint before cutting tests if you run over.

## QA log

| Round | By | Result | Findings |
|---|---|---|---|
| 1 | tester | ✖ fail | [bug] app/pane.tsx + app/u/[handle]/chart.tsx:112,138: The pane's chart links points and the selected-trade panel to `#trade-<id>` ("Go to trade in list"). The feed has no such anchors, and the pane's last-5 list items don't set `id="trade-…"`. The link does nothing except change the URL hash. Either give the pane rows matching ids, or pass a prop so the chart hides or retargets these links to `/u/handle#trade-id`. · [spec] app/ui.tsx swipe-hint: The business analyst's sign-off says the first-run hint is hidden after first use. The hint is rendered on every card, every time, with no persistenc |
| 2 | tester | ✖ fail | [bug] app/pane.tsx summary line (`Worst: ... <b className="down">`): The worst trade is always styled red (`down`). If a trader's worst trade is a gain (for example, every trade is a win), the line shows a green-looking positive percentage in red, which misleads. The class should depend on the sign of `returnPct`. The avg-return `p.avgReturn > 0 ? 'up' : 'down'` styling is fine for the nonzero case. · [usability] app/page.tsx + app/pane.tsx: The same trader can appear in several feed rows, and each row renders a full PerformanceChart and the last-5 list. That means many heavy client SVG compon |
| 3 | tester | ✅ pass | [note] app/pane.tsx worst-trade colour: A worst trade of exactly 0% is coloured 'down' (red). Only matters if every trade is ≥0, which is rare. Consider a neutral colour at 0. · [note] e2e/app.spec.ts: I did not run the Playwright e2e test. No database or build was available here. The run of tsc --noEmit (clean) and npm test (49/49 pass) covered the type check and unit tests only. The chart's arrow-key handling calls preventDefault (chart.tsx:66), which is why FeedKeys ignores keys sent while the chart has focus. The e2e assertion for that is unverified. · [note] docs/specs/issue-39-c.md: The  |

## Cost

8 role calls, $1.27 total: designer#1 $0.17, business#1 $0.08, engineer#1 $0.44, tester#1 $0.14, engineer#2 $0.14, tester#2 $0.11, engineer#3 $0.07, tester#3 $0.11
