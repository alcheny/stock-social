# F-6 plan sign-off: business lead (round 2)

**SIGN**, with 2 copy demands the builder applies without another round.

The pushback on the combined figure holds. My round-1 objection was to the mixed win rate and the third grid, and both
are gone. One labelled average that counts every result is the most direct answer to the owner's reason for F-6 (sell
winners, hold losers), and it adds no grid. /t is aggregate only, with no handles or links. TR-4 prominence is pinned by
the font-size and next-sibling checks. TR-9 is deferred in words and recorded as a follow-up. No "yet" remains. The
scope is tight (~220 non-test lines, chart.tsx untouched, no schema, vendor or dependency change). Compliance: passes
F1, F2, F3, F3a, F3b and P3.

Demands (builder; testable):
1. The combined line says "avg / result", not "avg / position". Its average mixes closed trades and open positions,
   and "/ position" mislabels the 20 closed ones. The /how sentence already says "one result". Exact string:
   "Including open positions at current value: −1.5% avg / result (26 results)". e2e asserts this exact text on
   `f6_mixed` (profile and pane), and the percent carries the tone class (`down` there).
2. Never render the combined line without the realized grid above it and the unrealized grid between them, so the
   order is always realized, unrealized, combined. `combined()` returns null unless both sides are non-empty. e2e on
   `f6_openonly` asserts there is no combined line, and on `f6_mixed` asserts the order realized grid, unrealized
   grid, combined line in DOM order.

Demo sentence: "Next to a trader's closed-trade record, the same-size row underneath shows what they're still
holding, losses included, and one line shows the average with open positions counted."
