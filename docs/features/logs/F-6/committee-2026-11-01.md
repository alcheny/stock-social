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

## Fix round 1 (after user tests, tester and independent review)
Sources: committee-ux-lead.md (D1–D5), committee-business-lead.md (D1–D4), test-tester.md (2 Medium, 2 Low),
review.md (B1, B2, N1–N8). Every blocking item is fixed; decisions taken:

12. **The feed pane leads with the figures when the trader has open positions** (realized grid, unrealized grid,
    combined line, then the chart and its note); without open positions, today's order. Why: SW-1 makes the pane the
    main way viewers meet a record; leading with the closed-only chart hid the open losses below the fold (business
    lead D1). Supersedes the plan's "under the two existing stats" for the pane.
13. **The evidence line is scoped first: "Closed trades: …"** in place of "Past results: " (or before "Too early to
    tell"), and the trailing "The range covers closed trades only…" sentence is removed. Why: a bold "above zero" right
    under a negative combined figure read as a contradiction; one fewer sentence (business lead D2; resolves UX lead D4).
14. **The unrealized row is dated: "… at current value · as of Oct 30"** (oldest read, UTC; the year only when not the
    current one) on the profile and the pane. Why: a failed record stops refreshing, so "current value" alone can be
    stale (business lead D3, review N3).
15. **The unrealized tile shows the count once** ("3" over "open positions · 1 up, 1 down, 1 flat"), each count joined
    to its word with a no-break space. Why: "4 4" for screen readers and an orphaned "0" at 360 px (UX lead D2, BL D4).
16. **Each grid is one named region** (aria-label with its row label; the visible label hidden from screen readers).
    Why: both rows announced the same way, label read once (UX lead D3).
17. **/how says what stock pages show:** "Stock pages show only a total of open positions in that stock, never who
    holds them; each trader's open positions are on their profile." Why: the earlier sentence was false (UX lead D1).
18. **On /t the open-positions section follows the closed-trade caveat;** with no closes in the stock (and on an empty
    compare column) it does not point to "the figures above". Why: each caveat sits with its own figures (UX D5, N2).
19. **The Similar trades pane (/u/<h>/pane) carries open positions** for connected or failed records, as the feed's
    pane does (review B2).
20. **The profile unfurl text adds the open-positions line only when the record has closes;** a record with no closes
    keeps its empty-record line (PR-2b behaviour pinned by e2e/connect.spec.ts). The profile page shows the positions.
21. **The share card images (AC1 "share card at every size", AC6 share-card e2e) ship with F-4,** which reuses
    lib/open-split.ts and OPEN; this PR does not mark them done (tester Medium 2, review N7).
22. Also fixed: the e2e fixture holds the shared feed lock while it exists (B1); a large unrealized percent wraps in its
    card at 360 px (tester Medium 1); compare with both stocks empty still shows each stock's open line (tester Low 1);
    `combined()` drops non-finite closes (N5); one `toneClass` (N6); an index on open_positions(symbol) (N4); the
    duplicate "no closed trades" line removed (N1). Not changed: a long symbol in the open list widening the page
    predates F-6 (tester Low 2, follow-up); an axe check needs a new dependency (owner only, UX lead note).

## Fix round 2 (committee re-sit and the orchestrator's independent review)
Re-sit: UX lead round 2 PASS (compliance and usability); business lead round 2 PASS on condition D5, fixed (both grids'
big values share one size and stay on one line at 360 px; e2e). Orchestrator review (no blockers), all six items done:
23. **Stock pages and compare are dated** ("held by 2 traders, as of Oct 30"; "Open positions as of Oct 30: …") and no
    longer say "now": a stalled import turns failed and its positions are never rewritten, so they must not read as current.
24. **The feed card line is dated** ("… avg unrealized, as of Oct 30"); one `asOfDay` format for every "as of".
25. **With open positions, the realized average is toned by its printed sign**, so "0.0%" is uncolored in both rows; a
    record without open positions keeps today's coloring.
26. OPEN strings are in the copy walk (`allCopy()`), as rendered; `symbolOpen` runs once per request (React `cache`).
