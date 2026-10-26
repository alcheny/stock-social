# F-2 · Personalized discovery of traders and records

Status: blocked
Blocked: PR-5 needs counsel's opinion (plan H2) before it is built and the Privacy Policy update (H4) before real viewers; PR-6 follows PR-5. PR-1 to PR-4 and PR-3b are merged.

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
- 2026-10-25: Status blocked (new status, docs/FEATURES.md): everything buildable is merged; the rest waits on
  H2 and H4. Why: the pipeline now builds features in parallel and would otherwise start PR-5 without counsel.
- 2026-10-25: The owner amended POLICY F1 (F1a): per-viewer ordering of traders and records to read, by
  the viewer's own actions, is allowed; personalized suggestions of securities or trades stay forbidden.
  Why: the owner wants personalized discovery; this clears plan hard stop H1 (P1). H2 (counsel, before
  PR-5's build) and H4 (Privacy Policy, before real viewers) still hold.
- 2026-10-22 (restored 2026-10-23 from the design-session record; the plan debate found them missing):
  gestures and weights. Double-tap on a card = private like, affinity +3. Swipe in the opening
  direction (to the profile, SW-1) = +2. Swipe in the other direction = reject, −4, and the card is not
  shown again. Why: the owner chose a gesture vocabulary familiar from mainstream social and matching
  apps (inspirations deliberately not named) and approved the implementation overview with these weights.
- 2026-10-22 (restored 2026-10-23): likes are private to the viewer. No like count, no list of who
  liked, nothing on the trader's profile or share card. Why: POLICY F6 and the owner's instruction.
- 2026-10-22 (restored 2026-10-23): placement. Suggestions appear as a section in the feed and as a
  row on the trader profile. Why: the owner's placement answer in the design session.
- 2026-10-22 (restored 2026-10-23): a suggestion opens the same pane as any feed card; the profile is
  one swipe further (SW-1). Why: one interaction model everywhere.
- 2026-10-24 (O1 resolved): the reject swipe lives on the trade card in the feed. Swiping toward the
  profile opens it (SW-1); swiping the other way rejects that trade itself (the card), with the same
  guards as the section swipe (finger travel past half the card, snap stop, 5-second Undo). The reject
  applies −4 to the trade and a slight negative preference to its trader. This amends DESIGN SW-1,
  which reserved both directions for the profile: only the opening direction is reserved now. The
  section-row swipe (PR-3) stays. Why: owner decision; it matches the gesture vocabulary chosen earlier.
- 2026-10-24 (O2 resolved): the profile row stays, as a section on the trader's profile titled
  "Similar trades". Its rows are trades (closed records from other traders with a similar holding
  period or pattern), and tapping a row opens that trade on its trader's profile (the pane, then the
  profile one swipe further), the same path as a feed card. It is not the ticker page (`/t/<symbol>`)
  and does not group by symbol. Same for every viewer until counsel clears personalization; no
  performance numbers on rows; losses included under the same rules. Build as PR-3b. Why: owner decision.
- 2026-10-24 (O4): unfollow = slight negative preference on that trader in the recommendation score,
  never a hide. (O5): desktop gets a separate web version later; the current phone-width column stands.
- 2026-10-23: the engineer and business lead disagree on the reject gesture (SW-1 reserves left/right
  on the feed). Recorded below as an owner question; until answered, the engineer builds reject so that
  it cannot collide with the profile-opening swipe.

## Acceptance criteria
Each one testable; the pipeline writes a test for every line.
- [ ] A signed-in viewer can follow and unfollow a trader from the profile and the pane; follows are
      private to the viewer (no public follower counts, POLICY F6) and feed the ranking.
- [ ] A signed-in viewer sees a "More like what you read" section built from their own event log
      (impressions, dwell, swipes, opens, shares, follows, watchlist, hides).
- [ ] Every event is written with viewer id, surface, target (trader, trade or symbol), type and
      timestamp only; a test asserts no event row contains personal data or brokerage data.
- [ ] "Not interested" on a suggestion removes that trader from the viewer's suggestions for 90 days
      and lowers similar records; unfollow applies the unfollow weight (−1, `lib/discovery/weights.ts`) to that
      trader's score for the viewer and never removes the trader's cards or section rows (restated 2026-10-24 per the
      business lead's O4 ruling, committee-pr1b §5; built in PR-4, the scoring use waits for PR-5).
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
- Resolved 2026-10-24 (O1): see Decisions. Build in PR-4.
- Owner (O3): hide duration. Business lead backs 90 days (testable, accidental swipes not permanent,
  protects reach); engineer built 90 days as one constant. Suggested split: a rejected trade stays
  hidden permanently, a trader hidden via "Not interested" returns after 90 days.
  PR-4 (2026-10-24) builds the committee recommendation while the owner is silent: a rejected trade stays hidden
  for good (a `trade_exclusions` row, deleted with the account), "Not interested" stays 90 days, and the
  trader-level −4 of a trade reject counts for 90 days (`TRADE_REJECT_TRADER_DAYS`). Still the owner's to confirm.
- Resolved 2026-10-24 (O2): see Decisions ("Similar trades" section). Build as PR-3b.
- Stage 2 and 3 model details (embedding size, model family, training cadence) are engineering
  decisions at the time; the acceptance criteria for them are the eval pipeline and the guardrails.
- Resolved 2026-10-24 (O4): unfollow is neither a hide nor neutral. The feed is driven by the
  recommendation score, and an unfollow applies a slight negative preference to that trader (a small
  negative weight, smaller than "Not interested" −4; the engineer pins the value in
  `lib/discovery/weights.ts` and records it). The feed never removes the trader's cards on unfollow.
  Why: the owner's decision in the design session of 2026-10-24.
- Resolved 2026-10-24 (O5): the desktop layout stays a phone-width column for now. A separate web
  version will be designed later as its own feature. Why: owner decision.

## Rework notes
