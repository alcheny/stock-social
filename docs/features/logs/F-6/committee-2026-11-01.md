# F-6 committee decisions, 2026-11-01

Decided by the committee (UX lead, business lead, engineer) under the owner's instruction of 2026-11-01 (develop
autonomously; open questions take the committee's recommended option after debate). Debate: plan-round1-*.md (UX lead
draft, business lead REVISE, engineer REVISE), plan.md (round 2, with point-by-point responses), plan-signoff-*.md
(both SIGN; business lead's two copy demands applied: "avg / result", order realized → unrealized → combined).

1. **Realized leads the headline; the unrealized grid sits directly beneath it at the same size.** Why: TR-4 asks for
   open positions "next to realized stats, as prominent as the headline"; TR-9 keeps its range on the headline average;
   a record without open positions keeps exactly today's page.
2. **One combined figure, as a single line: "Including open positions at current value: X avg / result (N results)".**
   No combined win rate and no third grid. Why: the owner's reason for F-6 (realized-only flatters selling winners and
   holding losers) is answered by one number counting every result, open positions at current value; an open position
   has not "won", so no mixed win rate (business lead), and "/ result" because it mixes closed trades and positions.
3. **Unrealized aggregate:** each open-position row is one position (a symbol in two accounts is two), counted up /
   down / flat by the printed sign, averaged with equal weight. Up and down are always printed ("0 up, 5 down").
   Why: no amounts are stored (P3), so no amount-weighted figure exists; printing both counts keeps losses visible.
4. **Tone follows the printed value:** "0.0%" is flat and uncolored in every new element; existing realized elements
   keep today's coloring. Why: color and words never contradict the number; no-positions pages stay identical.
5. **The chart stays closed trades only (CH-1)**, with a line under it: "Chart: closed trades only. Not plotted: …".
   chart.tsx is unchanged. Why: CH-1 Must; the note says what is not plotted, in words.
6. **TR-9 with open positions is deferred.** The evidence line says "The range covers closed trades only; open
   positions aren't in it." Why: open_positions stores no opened date, so days held and clustering can't be computed;
   adding it moves feed ranking, so it is its own feature (recorded under F-6 Open questions).
7. **Stock pages show the aggregate only** ("Open positions in {symbol}", counts, average, number of traders, "not a
   prediction or a rating of the stock"); no handles, rows or links. Why: a live roster of who holds a stock is a cue
   to act (POLICY F1/F3b); per-trader positions stay on each trader's profile (TR-4).
8. **Feed card: one line, "Also open: N positions · u up, d down · X avg unrealized"**, the percent toned at body size;
   no symbols and no combined figure. The pane shows the unrealized grid, the combined line and the chart note.
9. **Positions are shown only for connected or failed records** (never with no consented connection; nothing while
   importing, TR-3). The profile's open list adds "as of {oldest read date}".
10. **The disclaimer is the site footer on every page** (F-1 PR-3 precedent), asserted by e2e on every page touched.
11. **Feed ranking and the TR-9 lower bound are unchanged by F-6** (lib/feed.open.test.ts pins the order).
