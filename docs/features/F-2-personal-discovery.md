# F-2 · Personalized discovery of traders and records

Status: draft

## Why
A viewer who has looked at or followed certain traders and records should see more of what they like:
traders with similar styles, symbols and holding periods, and verified records worth reading. The owner
wants an AI-driven recommendation algorithm for this.

## Policy note (binding, docs/POLICY.md F1, DESIGN §2.8 and §3.4)
The product recommends **traders and records to look at**, never **trades to make**. "Suggested for you"
means "records like the ones you read", not "buy X". Copy never says buy, sell, hold, pick, signal or
advice. The owner has been told this and the scope below respects it.

## Decisions
- 2026-10-22: Add personalized discovery: suggest traders and records to a viewer based on the traders
  and records they already prefer. Why: the owner wants a recommendation algorithm using AI.
- 2026-10-22: Suggestions are of traders and closed records only, never of trades to place. Why: POLICY
  F1 and DESIGN §3.4 forbid personalized trade advice; it is also a regulatory line (adviser registration).

## Acceptance criteria
Each one testable; the pipeline writes a test for every line.
- [ ] A signed-in viewer sees a "More like what you read" section built from their own preference
      signals (profiles opened, panes swiped, watchlist symbols, traders followed).
- [ ] Each suggestion shows why it was suggested in plain words ("similar holding period to @x",
      "trades symbols on your watchlist").
- [ ] Losses and negative records are suggested with the same rules as gains; the ranking inside the
      section uses the confidence lower bound, never raw averages (TR-9).
- [ ] No suggestion copy contains buy, sell, hold, pick, signal, advice or price targets (scanner rule).
- [ ] A signed-out viewer sees a non-personalized version (same section, feed ranking) so shared links
      still work.
- [ ] Tests: cold start (no signals), one signal, many signals, a viewer who only reads losing records,
      heavy use (thousands of viewers scored per hour), and the deterministic fallback when the model
      call fails.

## Out of scope
- Trade recommendations, "AI picks", price targets, anything personalized about a symbol to buy.
- Pushing suggestions by notification (Phase 2 "make watching sticky").

## Open questions
- Preference signals: implicit only (opens, swipes, dwell), explicit only (follow, watchlist, a
  "more/less like this" tap), or both?
- Where does AI earn its place here: scoring (needs a model call per viewer, a second vendor, DESIGN
  Standing direction 3) or only writing the plain-words "why" line from deterministic scores? The
  design record's rule is every model call through one module with a 50-example eval file.
- Does this wait for the week-8 supply gate (demand feature, Phase 2) or get built right after F-1?
- Where does the section live: feed top, feed interleaved, profile bottom, or its own tab?
- Must suggestions of trader records go to the trader's profile or open the swipe pane?

## Rework notes
