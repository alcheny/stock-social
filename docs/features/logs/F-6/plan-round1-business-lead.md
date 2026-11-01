# F-6 plan, round 1: business lead

**REVISE.** The core bet is right (realized leads, unrealized at equal size directly beneath it, chart and range
honestly scoped in words). Two parts go: the per-trader holdings list on /t (signal risk) and the combined row (a
third pseudo-account number nobody asked for by name). Everything else signs once the demands below are in the plan.

Rulings (committee decides now, per the owner's instruction; no owner items remain):
1. **Headline: realized leads, and the combined row is deleted** from the profile and the feed pane. The owner asked
   for the account "divided between realized and unrealized"; two equal-size rows deliver exactly that. A combined
   equal-weight win rate mixes closed trades with open positions, so it is neither trade nor account return (the
   drawdown labelling trap) and costs a third grid, more copy and more tests at 360 px. The AC says "where one is
   shown", so none is required.
2. **TR-9 deferral: accepted.** Range and evidence line stay closed-only and say so in words. Adding `opened_at` and
   changing `confidence()` also moves feed ranking, so it needs its own feature; the coordinator records it under
   Open questions in F-6 as a follow-up. That is not a blocker for this build.
3. **"Who holds {symbol} now" list: rejected.** A security page listing named traders who hold that stock right
   now is the core of what signal and copy-trading products sell. It is a "who's in it" view built around a security,
   which F1 (no signals, no "hold" suggestions) and F3b (security pages never push and never rank) were written to
   prevent. Closed rows on /t are history. A live roster is a cue to act. Per-trader holdings stay on each trader's
   own profile (TR-4), where they are part of a record. /t gets the **aggregate line only**, with no handles, no
   rows and no links.
4. **Feed-card "Also open" line: approved.** It has no symbols and no combined figure.
5. **Copy:** approved with the edits in demands 5 to 7.
6. **TR-4 prominence:** see demands 3 and 4.

Demands (builder; testable):
1. Delete the combined row everywhere (profile, pane), `Split.combined` and its tests. `split()` returns
   `{ realized, open }`. Verify: no "Including open positions" string in the diff, and 2 `.stats` grids max on the profile.
2. /t/[symbol]: render only the aggregate paragraph. No `@handle`, no RowBadge, no profile link and no list inside the
   section. e2e asserts the section contains zero `a[href^="/u/"]` and no `f6_` handle text. Drop the `recordStates`
   join used for rows. The counts still filter on state != 'none' and non-deleted users.
3. TR-4: the unrealized row sits directly under the realized row with no other node between them (the range line
   stays inside the realized cell). Its values use the same `.stat big` class. e2e compares the computed font-size of
   the realized and unrealized `b` values at 360 px, and they must be equal.
4. Feed card: the "Also open" percent carries the tone class at the card's body text size, not `.small.muted`. The
   label text may be muted. e2e: on `f6_losing` the percent has class `down` and starts with "−".
5. /t heading becomes "Open positions in {symbol}", not "Open now" (that reads as a live alert, F3b). The
   paragraph keeps "Not included in the figures above, which cover closed trades. This is what is open now, not a
   prediction or a rating of the stock."
6. Evidence sentence: "The range covers closed trades only; open positions aren't in it." Drop "yet", which
   commits to work that isn't scheduled. Same for the chart caption: no "yet" anywhere in `OPEN`.
7. /how paragraph: remove the combined-figure sentence (demand 1). Add one sentence: "Open positions are
   listed on each trader's profile, not on stock pages."
8. Keep: the chart "Not plotted:" line and the caption, the open list "as of {date}" with symbol ordering, the unfurl
   description append, the /t/compare aggregate line, the byte-identical no-positions path, `tone()` for new
   elements, and the footer disclaimer (F-1 PR-3 precedent), asserted by e2e on every touched page.
9. Unit cases (AC6) stay: none / all winning / all losing / mixed / open with no closes / two accounts / flat. Add:
   `realized` deep-equals `headline()`, and `openLine` output never contains "$", "buy", "sell", "hold" or "signal".
10. Size: if the diff passes ~400 lines excluding tests, split it. PR-1 is the profile, pane and `lib/open-split.ts`.
    PR-2 is the feed card, /t, compare and /how.

Compliance verdict for the revised plan: passes F1, F2, F3, F3a, F3b and P3, provided demands 2, 5 and 6 are met.
Demo sentence: "Next to a trader's closed-trade record, the same-size row underneath shows what they're still
holding, losses included."
