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
- [ ] A signed-in viewer sees a "More like what you read" section built from their own event log
      (impressions, dwell, swipes, opens, shares, follows, watchlist, hides).
- [ ] Every event is written with viewer id, surface, target (trader, trade or symbol), type and
      timestamp only; a test asserts no event row contains personal data or brokerage data.
- [ ] "Not interested" on a suggestion removes that trader from the viewer's suggestions for 90 days
      and lowers similar records; unfollow does the same for the trader.
- [ ] Raw events older than 90 days are deleted by a nightly job; deleting an account deletes its
      events and affinities the same day (tested end to end).
- [ ] Diversity: in any 10 consecutive feed cards no trader or symbol appears more than twice; at
      least 2 of 10 are exploration picks (tested on generated feeds).
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
- Owner review of the Design overview (weights, metrics, the private-likes rule).
- Stage 2 and 3 model details (embedding size, model family, training cadence) are engineering
  decisions at the time; the acceptance criteria for them are the eval pipeline and the guardrails.
- Does this wait for the week-8 supply gate (demand feature, Phase 2) or get built right after F-1?
- Where does the section live: feed top, feed interleaved, profile bottom, or its own tab?
- Must suggestions of trader records go to the trader's profile or open the swipe pane?

## Rework notes
