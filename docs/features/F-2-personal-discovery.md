# F-2 · Personalized discovery of traders and records

Status: built

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
- 2026-11-01 (O3): Likes and rejects shape a viewer's ordering for 90 days, fading over that window, in
  `signalsFor` and `viewerProfile`; they are stored until the viewer removes them or deletes the account, with a
  purge of orphans. A rejected trade stays hidden for good and "Not interested" lasts 90 days, as PR-4 built.
  The Privacy Policy says exactly this, with a test that the text matches the code. Why: the owner adopted the
  legal committee's recommendation, separating how long a choice is used from how long it is stored.
- 2026-11-01: Implicit activity logging (impressions, dwell, skips) is opt-in and off by default: a "Personalize
  with my activity" switch with On and Off equally prominent; Off means nothing is logged or used, and "Clear my
  activity" deletes it at once. The owner's rule: on by default only if that needs no legal work beyond
  changing the Privacy Policy. It does (a notice at collection, counsel's CIPA analysis of first-party logging,
  the age-assurance questions of SB 976 and the NY SAFE rules for activity-personalized feeds, Connecticut's
  profiling assessment), so it is off by default until counsel clears those points; then it may switch to on
  with notice. Why: the owner's conditional choice.
- 2026-11-01: Viewers also get "Personalize my feed: Off": with it off, ordering ignores follows, likes and
  activity and falls back to the order everyone gets, minus the viewer's own hides. Why: the owner adopted the
  legal committee's recommendation; it is cheap and strengthens the legal position.
- 2026-11-01: User preference data (follows, likes, hidden traders, swiped-away trades, "Not interested",
  watchlist, and the activity log when on) is stored indefinitely, until the viewer removes it or deletes the
  account; nothing is deleted on a timer. How long a choice affects ordering is unchanged (the 90-day fading
  window and the 90-day "Not interested" effect). The Privacy Policy says exactly this. Why: the owner's
  decision.
- 2026-11-01: F-2 is ready again: the pipeline builds PR-5 (behavior-based ordering) and PR-6 with the legal
  committee's conditions as acceptance criteria, its findings standing in for counsel's opinion (POLICY, owner
  decision 2026-11-01). Real viewers still wait for the Privacy Policy (H4). PR-1 to PR-4 and PR-3b are merged.
  Why: the owner's decision.
- 2026-11-01: Criterion 5's nightly deletion of events older than 90 days is superseded by the indefinite-storage decision; ordering reads only the last 90 days, fading; account deletion removes events the same day. Why: decided by the committee under the owner's instruction of 2026-11-01; it is what the owner's later decision requires (Q1).
- 2026-11-01: The switches live on /me/personalize (linked from Settings, Following and the feed's order line); On and Off are equal buttons named by their switch; "Clear my activity" is one tap. Why: decided by the committee under the owner's instruction of 2026-11-01; one screen with one job, and the decision says Clear deletes at once (Q2, Q5).
- 2026-11-01: Activity Off keeps stored events unused; with "Personalize my feed" Off nothing is logged either (server-side check). Why: decided by the committee under the owner's instruction of 2026-11-01; minimum collection (POLICY P3) (Q3, Q4).
- 2026-11-01: The opening swipe +2 is an activity event and counts only with activity On; implicit weights proposed for the owner: dwell_long +1, profile_open +1, share +1, skip −0.5, impression 0; follow bonus +2. Why: decided by the committee under the owner's instruction of 2026-11-01; passive reading needs the opt-in, and no implicit weight outweighs an explicit choice (Q6, Q8).
- 2026-11-01: A "Not interested" that ran its 90 days stays stored and unread, listed under "No longer applied" on /me/following with Remove; the purge deletes only exclusions the viewer ended, ended unfollow rows and orphans (a like or hidden trade whose close is still gone 30 days after it was found gone). Why: decided by the committee under the owner's instruction of 2026-11-01; the owner's storage rule, with every stored row visible and removable, and a rebuild that brings a close back never loses a viewer's choice (Q13).
- 2026-11-01: The watchlist is never an ordering input; the "symbols on your watchlist" reason in criteria 2 and 7 is superseded; reason lines are "Similar holding period to @x" (x followed or liked), "Trades symbols you read" and "New to you" (activity On). Why: decided by the committee under the owner's instruction of 2026-11-01; POLICY F1a and the owner's watchlist rule.
- 2026-11-01: "N trades hidden by you. Show them" and the order line share one quiet paragraph above the first card; the Hidden trades list ships in the same PR as behavior-based ordering. Why: decided by the committee under the owner's instruction of 2026-11-01; the first card stays in view at 360 px, and criterion 15 is met (Q9).
- 2026-11-01: /how documents how a signed-in feed is ordered, from the same constants. Why: decided by the committee under the owner's instruction of 2026-11-01; POLICY F1 asks for a documented method (Q12).
- 2026-11-02: The owner accepted OD 2.13: the implicit activity log and expired like and reject events are deleted at
  90 days. This replaces the earlier decision to keep them until cleared (POLICY P3, store the minimum) and is built
  as F-47. Why: the owner's decision of 2026-11-02 (OD 2.13).
- 2026-11-02: The owner accepted OD 2.14: implicit logging stays off and only the owner turns it on (main already
  defaults it off). Correction recorded with it: the +2 weight is the opening swipe (`lib/discovery/weights.ts:7`),
  not follow. Why: the owner's decision of 2026-11-02 (OD 2.14).
- 2026-11-02: The owner accepted OD 2.23: viewers without age assurance get a non-personalized or follows-only order,
  with no age-assurance build now; built as F-42, on main before 2027-01-01. Personalized ordering stays built behind
  it. Why: the owner's decision of 2026-11-02 (OD 2.23).

## Acceptance criteria
Each one testable; the pipeline writes a test for every line.
- [ ] A signed-in viewer can follow and unfollow a trader from the profile and the pane; follows are
      private to the viewer (no public follower counts, POLICY F6) and feed the ranking.
- [ ] A signed-in viewer sees a "More like what you read" section built from their own event log
      (impressions, dwell, swipes, opens, shares, follows, ~~watchlist~~ (superseded 2026-11-01), hides).
- [ ] Every event is written with viewer id, surface, target (trader, trade or symbol), type and
      timestamp only; a test asserts no event row contains personal data or brokerage data.
- [ ] "Not interested" on a suggestion removes that trader from the viewer's suggestions for 90 days
      and lowers similar records; unfollow applies the unfollow weight (−1, `lib/discovery/weights.ts`) to that
      trader's score for the viewer and never removes the trader's cards or section rows (restated 2026-10-24 per the
      business lead's O4 ruling, committee-pr1b §5; built in PR-4, the scoring use waits for PR-5).
- [ ] ~~Raw events older than 90 days are deleted by a nightly job;~~ (superseded 2026-11-01: stored until removed,
      read for 90 days) deleting an account deletes its events and affinities the same day (tested end to end).
- [ ] Diversity: in any 10 consecutive feed cards no trader or symbol appears more than twice; at
      least 2 of 10 are exploration picks (tested on generated feeds).
- [ ] Each suggestion shows why it was suggested in plain words ("similar holding period to @x",
      ~~"trades symbols on your watchlist"~~ (superseded 2026-11-01: the watchlist is never an input).
- [ ] Losses and negative records are suggested with the same rules as gains; the ranking inside the
      section uses the confidence lower bound, never raw averages (TR-9).
- [ ] No suggestion copy contains buy, sell, hold, pick, signal, advice or price targets (scanner rule).
- [ ] A signed-out viewer sees a non-personalized version (same section, feed ranking) so shared links
      still work.
- [ ] Tests: cold start (no signals), one signal, many signals, a viewer who only reads losing records,
      heavy use (thousands of viewers scored per hour), and the deterministic fallback when the model
      call fails.
- [ ] "Personalize with my activity" is off by default, On and Off equally prominent; with it off, no
      impression, dwell or skip is logged and none is used; "Clear my activity" deletes the events and any
      derived affinities at once (tests prove both).
- [ ] "Personalize my feed: Off" makes ordering ignore follows, likes and activity: the viewer gets the order
      everyone gets, minus their own hides.
- [ ] Likes and rejects affect ordering for 90 days, fading over the window (`signalsFor`, `viewerProfile`);
      they stay stored until removed or the account is deleted; orphaned rows are purged.
- [ ] A "Hidden trades" list with "Show again", and a persistent "N trades hidden by you. Show them" line,
      keyboard and screen-reader operable, ship before behavior-based ordering.
- [ ] The watchlist is never an ordering input, and no watch or unwatch event is written while the symbol
      flag is off.
- [ ] No reason line names a security to buy, sell or hold; every reason is a fact about the trader's record
      or the viewer's own actions (POLICY F1a).

## Out of scope
- Trade recommendations, "AI picks", price targets, anything personalized about a symbol to buy.
- Pushing suggestions by notification (Phase 2 "make watching sticky").

## Open questions
- Resolved 2026-10-24 (O1): see Decisions. Build in PR-4.
- Resolved 2026-11-01 (O3): see Decisions.
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
- Idea board 2026-11-01 (idea 7): the criterion "Raw events older than 90 days are deleted by a nightly job"
  contradicts the 2026-11-01 indefinite-storage decision; restate or strike it before PR-5. Proposed: keep follows,
  hides, permanent rejects, watchlist and a visible likes list; delete the implicit activity log and expired
  like/reject events at 90 days; a "Your choices" page; a notice after two years idle.
- Idea board 2026-11-01 (idea 8): keep Off; only the owner flips it, and a later default-on applies to new viewers
  only; with logging off, "More like what you read" uses explicit signals; drop the model if under ~10% opt in.
- Idea board 2026-11-01 (ideas 7-8): ordering by likes and rejects counts as an addictive feed under California
  Health & Safety Code §27000.5 even with logging off; from 2027-01-01 (California) and 2027-01-25 (New York) it
  needs a reasonable age determination, which self-attested 18+ likely isn't. Choose before then: follows-only
  ordering without age assurance, an age-assurance step, or the attorney review's answer.

## Rework notes

## Build log
- 2026-11-01: Merged to main in #30 (e12a834) by the orchestrator session; Status set to built (the pipeline sets it in its own PRs; interactive builds did not), so the feature pipeline does not pick it up as ready again. Waiting for the owner to try it.
