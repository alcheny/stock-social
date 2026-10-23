# F-2 · Plan round 1 · Business lead

Date: 2026-10-23. Responds to `plan-round1-engineer.md` (base `0c7b4e1`). Read: CLAUDE.md, POLICY,
COMPLIANCE §1 to §3 and §13, DECISIONS (standing direction, #39 SW-1), DESIGN §2.8, §3.4, Stage 5 (SW-1,
TR-9), IMPLEMENTATION (hard stops, pre-authorization table, conflict #2), the F-2 feature file and its
git history, the F-1 plan and sign-off. No decision in the feature file changes here; where the plan
needs one, it is escalated to the owner. Nothing here is legal advice.

## 0. Verdict

**REVISE.** The engineering is careful and the policy reasoning is right, but the order has a dependency
bug (the "unblocked" PR-4a needs PR-1, which is blocked), the plan builds four things the feature file
does not ask for, and it starts collecting behavioral data before anything is allowed to use it.

**Demo sentence (the bar for the finished feature):** "Follow the records you read, and the feed shows
you more traders who trade like them, losses included, each with the reason it is there."

**Demo sentence for what can ship before counsel:** "The feed now mixes traders so no one dominates,
and you can follow anyone privately."

## 1. Is the engineer right that the gesture weights are missing? Yes, and the gap is wider

The F-2 file has no gesture, weight or like anywhere. Acceptance criterion 2 lists the signals
(impressions, dwell, swipes, opens, shares, follows, watchlist, hides) and **likes are not among them**.
The file's git history shows the decisions were made in the design session but never written down:

- `2688ad8` ("gestures (like, open, reject), private likes, design overview for owner review") only
  added an open question: "Owner review of the Design overview (weights, metrics, the private-likes rule)".
- `444be28` ("placement decided, overview approved, Status: ready") **deleted** that question and the two
  placement questions ("where does the section live", "do suggestions open the profile or the pane")
  without recording any answer under Decisions.

So four owner decisions are lost, not one: (1) the gestures and weights (double-tap like +3, swipe-open
+2, swipe-reject −4), (2) the private-likes rule, (3) where the section lives, (4) whether a suggestion
opens the pane or the profile. The engineer filled (3) with "feed position 4, then every 15, plus a
profile row" and (4) silently. Both are guesses. This is a recording failure in the design session
process (FEATURES.md requires the decision in the same turn), not an engineering one. It is hard stop H5
below.

## 2. The PR split and order

### 2.1 The dependency bug
PR-4a (impersonal placement) runs `diversify` and the exploration slots, which the plan puts in PR-1.
PR-1 waits on H1 and H2. So the "if H1 and H2 are not cleared" order (PR-2, 3a, 3b, 4a, 5) cannot build.
Fix: move `diversity.ts` and `explore.ts` (both impersonal, both sign-neutral) out of PR-1 into the first
PR. What stays blocked is only what reads one viewer's behavior: `profile.ts`, `score.ts`, the personal
reasons.

### 2.2 What ships value first
Most viewers arrive from a shared link, signed out. Personalization touches none of them in their first
3 seconds. The impersonal half is the part every visitor sees, it fixes a defect the owner already has
on the list (feed raw HTML 564 KB at 50 distinct heavy traders, over the 500 KB bound), and it needs no
counsel. So the impersonal feed goes first, not last. Is "impersonal before personal" right? Yes: it is
forced by H2, and it is also the higher-reach order.

Amended order (each ≤ the 800-line cap):

| # | PR | Criteria | Waits on |
|---|---|---|---|
| 1 | **Feed mix and paging**: `diversify`, day-seeded exploration, 30-card pages with a cursor, the honest end-of-feed card, the e2e eligibility fix | 6, 8 (feed), 10 (feed) | nothing |
| 2 | **Follow and "not interested"**: `follows`, `viewer_exclusions`, the explicit-event log (follow, unfollow, not_interested, undo, share, watch), lookup tables, deletion first step, the 90-day purge, `/me/following` | 1 (private follow), 3, 4 (exclusion half), 5 | nothing (H4 before real viewers) |
| 3 | **The section, signed out and signed in, impersonal**: placement per the owner's recorded answer, fact-based reasons from templates, the copy scan, exclusions honored | 7 (impersonal reasons), 9, 10 | H5 (placement) |
| 4 | **Private likes and double tap** | the owner's recorded gesture decision | H5 |
| 5 | **Implicit logger** (impressions, dwell, skip, swipe-open) | 2 (inputs) | H2, H4 |
| 6 | **Personal scoring, personalized feed and section, follow boost, "lowers similar"** | 1 (feeds ranking), 2, 4, 7, 8, 11 | H1, H2 |
| 7 | **Heavy use and the end-to-end matrix** | 11 (heavy) | 6 |

Each PR carries its own heavy-use checks for what it adds (PR 1: HTML bound; PR 2: purge and deletion).
PR 7 is the matrix across all of them. F-2 cannot reach `Status: built` before H2 clears: say so in the
status, do not imply otherwise.

Why the implicit logger moves behind H2: impressions, dwell and skips have exactly one consumer, the
personal ranker. Logging them before that ranker is allowed is collecting data with no permitted use
(POLICY P3 "collect the minimum"; COMPLIANCE §3 data minimization; §13 makes privacy defects per-user
liabilities). Follows, exclusions and likes are different: each is a user-visible feature the viewer
chose, so storing them is justified on its own.

### 2.3 Thirty cards per page: accepted, with three conditions
The reason is sound: 30 × ~11.3 KB ≈ 340 KB worst case against the 500 KB bound. Conditions:
1. **No tap to continue.** In a full-screen vertical swipe feed a "Show more" button at card 30 is a
   dead end. Append the next page automatically when the viewer is 5 cards from the end. The link is the
   no-JS fallback only.
2. **The diversity window spans the page join.** The cursor carries the last 9 cards' trader ids and
   symbols, so cards 25 to 34 obey the caps too. One test asserts it on 1,000 generated feeds.
3. **Order is stable within a UTC day** (the seed): no card repeats or vanishes across pages.

### 2.4 Swipe-reject: neither on the feed nor in the section
- Option (b), right swipe on a feed card, breaks SW-1's Must ("left/right on the default feed means
  profile"). The owner chose that pattern for being "easy, navigable" (DECISIONS #39). Rejected.
- Option (c), a horizontal swipe on a section row, puts a destructive meaning on the same gesture that
  opens a profile one card earlier. A viewer who has learned "swipe left opens the trader" will
  dismiss the trader they wanted to open. The section sits inside the default feed, so it is also "left/
  right on the default feed" under SW-1. Rejected.
- Option (a), −4 on a quick flick past a card, punishes fast readers. Rejected as a weight; the plan's
  `skip` at weight 0 stays (in PR 5).

**My recommendation to the owner:** the −4 attaches to the explicit "Not interested" control (one
negative action, not two). No reject gesture is built. If the owner wants a reject gesture, SW-1 already
says where it lives: a separate mode, not the default feed. Delete "Not now" as a second negative
control; it duplicates "Not interested" with a weaker effect nobody can tell apart.

In the section, a horizontal swipe on a trader row behaves exactly like the feed: it opens that
trader's pane (+2). One gesture, one meaning, everywhere.

### 2.5 The profile row ("Similar records"): cut
- Not in the acceptance criteria. Criterion 1 asks for Follow on the profile, nothing else. The plan
  decides how, not what (IMPLEMENTATION, 2026-10-22).
- It works against supply. A trader shares their profile to show their own record; a row sending that
  trader's visitors to other traders makes the link less worth sharing (intuition, not evidence, but the
  cost of being wrong lands on the 50-trader supply gate, and DECISIONS standing direction 1 is
  "supply before demand").
- It needs its own table (`discovery_trader_features`) and its own similarity code before anything else
  does.

If the owner's lost placement decision (H5) included "profile bottom", it comes back, and the wording
rule is: no "Suggested", "Recommended", "You may also like", "Traders to follow", "Top" or "Best". The
heading says what is similar ("Similar holding periods"), and each row carries its fact ("Holds 7 to 30
days"). "Similar records" alone passes F1 because the row is the same for every viewer, but it says
nothing a viewer can check, so it fails my bar.

### 2.6 The section itself, at 375px
- **Rows carry no numbers.** The plan puts the TR-9 line on every row. That makes the section a
  performance screen, which needs the disclaimer in plain view (F3); today it is only in the layout
  footer (`app/layout.tsx:30`), off screen on a full-height card. Criterion 8 asks for the lower-bound
  *order*, not a displayed number. Row = name, badge, one reason line, Follow. Tapping or swiping opens
  the pane, which shows the record.
- **3 rows, not 5.** Five rows of six elements is 30 targets on one card.
- **"…" menu on section rows only**, never on feed cards. Criterion 4 says "on a suggestion"; a feed
  card is not one. That keeps a control off every card in the product.
- **Signed out, the heading must be true.** "More like what you read" is false for a visitor who has
  read nothing. The UX lead picks the signed-out heading; "Recent record" as a reason is too vague to
  pass criterion 7 ("why it was suggested in plain words").
- **No duplicates of the cards around it.** Section rows exclude traders in the surrounding 10 feed
  cards. If fewer than 3 remain, the section is not rendered, signed in or out alike (so criterion 10's
  "same section" still holds). The UX lead confirms; the test covers the 3-trader demo case.

### 2.7 Reasons
- Drop "You follow @x" as a reason: suggesting a trader you already follow is not discovery.
- Drop the tickers from the reason lines. "Trades symbols on your watchlist" is exactly the owner's
  example in criterion 7; adding "AAA, BBB" puts a security name in a personalized line next to a
  trader suggestion, which is counsel question 2. Removing it removes the question.
- "New to you" for exploration, "Similar holding period to @x": keep.

## 3. What I deleted from the plan, and why

| Deleted | Why | Comes back when |
|---|---|---|
| `discovery_serves`, `discovery_serve_items`, propensity logging | Only stage 2 and 3 use them, and those need H3. There are no real viewers, so no history is lost by waiting. Not in criterion 3's field list (this answers Q6) | PR-6 (stage 2), with the owner's go |
| `viewer_affinities` (derived table plus per-event upserts) | 500 events per viewer, by index, computes in milliseconds on read. One less table to delete, purge and rebuild | Measured p95 misses the budget |
| Co-visitation (k ≥ 5) | Zero signal until there are real viewers, and it is the one feature that reads other viewers' private choices | Stage 2, with data |
| `discovery_trader_features` | Only the profile row and personal similarity need it | PR 6 |
| The profile row | §2.5 | The owner's placement record |
| "Not now" and the reject swipe | §2.4 | The owner chooses a separate mode |
| "Personalize my feed" switch (Q5) | No setting where a good default will do; ask counsel (question 4) instead of guessing | Counsel requires an opt-out |
| "Only you can see who you follow." under every Follow button | Repeated copy on every profile and pane. Say it once, in the status line after the first follow ("Following @x. Only you can see this."), and on `/me/following` | — |
| P9 test clock in `playwright.config.ts` | Backdate rows (`at`, `until`) in the DB fixture instead | — |

Kept on purpose: the `ReasonWriter` seam. Criterion 11 requires the fallback test; the seam is a function
parameter, not a module. No model is wired in stage 1.

## 4. Hard stops

| # | Real? | Blocks | Can proceed meanwhile | What the owner does (one sentence) |
|---|---|---|---|---|
| H1 POLICY F1 "no personalized suggestions" | Yes. IMPLEMENTATION conflict #2 is still open, and the reviewer reads POLICY as written | PR 6 only | PRs 1 to 5 (none ranks per viewer). PR 5 is held by H2 anyway | After counsel answers, amend F1 to the cleared wording, for example "no personalized suggestions of trades, securities or actions; suggestions of records to read follow F-2's guardrails". |
| H2 Counsel on the publisher's exclusion for F-2 | Yes. COMPLIANCE §2 Procedures: a suggestion that could be read as a recommendation goes to counsel **before build**, so it blocks writing PR 6, not only merging it | PRs 5 and 6 (and so `Status: built`) | PRs 1 to 4. They are the same class as today's feed: the same order for everyone, by the documented method | Send counsel the engineer's §8 questions (minus question 2, which §2.7 removes, plus: "is follow-based reordering of a viewer's own feed a suggestion?") and record the answer in the F-2 file. |
| H3 Stage 2 and 3 (model key, eval, compute) | Yes, but not for stage 1 | PR-6, PR-7 (later stages) | Everything in this plan | Nothing now; answer P6 and P7 only when stage 1 has run on real viewers. |
| H4 Privacy Policy covers the new data | Yes (POLICY P6, COMPLIANCE §3) | Real viewers using PRs 2 to 6 | The build | Add the data inventory (engineer §4, minus the deleted tables) to the Privacy placeholder already requested in item #10. |
| **H5 (new) The lost design decisions** | Yes (§1): the plan cannot decide what the owner decided and nobody wrote down | PRs 3 and 4 | PRs 1 and 2 | Re-state in a design session the gestures and weights, the private-likes rule, where the section lives and what a suggestion opens, so they are recorded under F-2 Decisions. |

## 5. Open questions

| Q | Answer |
|---|---|
| Q1 weights and likes not in the file | Right, escalated as H5. The engineer's extra weights (profile open +2, share +4, follow +5, watch +3, dwell +1 / +0.5) are fine as proposals to pin in one tested table; they reach the owner in the same H5 sentence. |
| Q2 where swipe-reject lives | None of (a), (b), (c). The −4 goes on "Not interested". Escalated to the owner with H5 (§2.4). |
| Q3 "profile row" | Cut (§2.5). Follow on the profile header stays. |
| Q4 thin supply, 6-card feed | Accepted: never relax the cap. With 3 traders, 50 cards of the same three people is worse than 6 honest ones. The end card must be great, not an apology: the UX lead writes it, with no completeness claim, and it carries the "Publish your trades" action for traders (supply). |
| Q5 personalize switch | No (§3), unless counsel requires it. |
| Q6 serves outside the event row | Correct reading of criterion 3, and the serves tables are deleted from stage 1 anyway. |
| Q7 30 cards | Yes, with §2.3's conditions. |

## 6. Heavy-use targets

The engineer's budgets stand, with these changes:
- **Purge throughput is set by the insert rate, not a round number.** At the plan's own estimate of
  2 M rows a day, one 300 s call must remove ≥ 2 days' worth (4 M) or resume within the same night. Test
  at 4 M.
- **Run the purge in the existing scheduled tick** (pre-authorization item #7, already requested) once a
  day, time-boxed, instead of a new route and a new schedule. If the engineer shows it cannot fit next
  to sync claiming, keep the separate route; the reason goes in the round-2 plan.
- **Deletion at scale:** a trader referenced by 100,000 other viewers' events and follows deletes in
  under 5 s, and leaves zero rows (cascade cost, not only correctness).
- **Signed-out feed, the number that matters most:** server p95 < 400 ms at 500 traders, raw HTML ≤
  500 KB per page with 30 distinct heavy traders. Every shared link lands here.
- Signed-in p95 < 800 ms, scoring ≤ 10 ms per viewer, events p95 < 50 ms, tap to feedback < 100 ms:
  keep. "Thousands of viewers scored per hour": the plan's 5,000 in < 100 s is ~180,000 an hour on one
  core, which clears it with margin.
- The 2.5 M-event fixture moves to PR 7; PR 2's fixture is explicit events only.

## 7. Pre-authorization requests

Under IMPLEMENTATION ("the committee identifies; only the owner authorizes") the committee can grant
**none** of P1 to P9: each touches POLICY, counsel, deploy settings, a protected path or a secret. What
the committee can do is remove requests by design.

| # | Committee view | Owner? |
|---|---|---|
| P1 amend F1 | Needed, after P2, before PR 6 | Owner |
| P2 counsel | Needed; the long pole. Send now, in parallel with PRs 1 to 4 | Owner |
| P3 nightly schedule | Withdrawn if the purge rides the existing tick (#7, §6) | Owner only if the separate route survives |
| P4 Privacy text | Fold into existing item #10 | Owner |
| P5 scanner rule in `scripts/compliance.ts` | Needed for criterion 9 as written ("scanner rule"). Until then `lib/copy.test.ts` enforces it. Word-bounded, so "holding period" passes | Owner |
| P6 stage 2 key | Not now; asking before stage 1 has data is premature | Owner, later |
| P7 stage 3 compute | Not now | Owner, later |
| P8 load test in CI | Fold into existing item #13 | Owner |
| P9 Playwright config | Withdrawn (§3) | — |

No new dependency or vendor in stage 1: confirmed.

## 8. Scorecard (the plan as amended; F-2's demand was settled by the owner, so demand scores the *how*)

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Category disclosures (copy-trading and social-investing platforms) show follow, per-viewer "for you" feeds mixing watchlist activity, and trader finders by preference. Tier: competitor product behavior, no usage numbers found; no unprompted user complaints found either way. |
| Ease of adoption | 4 | Follow and double tap are familiar patterns; nothing added to the signed-out path. Not 5 until the section is shown at 375px. |
| Phase fit | 4 | Moves viewer D7 return (DESIGN §3.5); the end card and no profile row protect the supply gate. |
| Revenue impact | 3 | Indirect only (§9). Accepted for an owner-decided feature; not a reason to add scope. |
| Aesthetics and clarity | 3 | Section unspecified at 375px; the UX lead owns it next round. |
| Trust and compliance | 5 (as amended) | Losses ranked by the symmetric lower bound, no numbers without the disclaimer, no tickers in personal lines, nothing collected without a permitted use, counsel before the personal half. The round-1 plan scores 4: implicit logging before H2. |
| Simplicity | 4 (as amended) | Five tables and two flows deleted; the round-1 plan scores 2. |
| Craft and taste | — | Nothing built yet. |

## 9. Revenue chain

F-2 earns nothing directly. Chain: signed-in viewers × share who follow at least one trader × lift in
D7 return × value of a returning viewer (later subscriptions, F-3). Every term is unknown today: there
are no real viewers. The assumption the result is most sensitive to is **the share of viewers who sign
in at all**, because personalization touches nobody else. The cheapest test, within two weeks of the
first real viewers: the share of shared-link sessions that end signed in, and of those, the share that
follow someone. If fewer than 1 in 10 sign in, PR 6 matters far less than the signed-out PRs 1 and 3.

## 10. Demands on the engineer for round 2 (prioritized)

1. **Fix the dependency.** `diversity.ts` and `explore.ts` live in PR 1, with their property tests.
   Verify: PR 1 has no import from `profile.ts` or `score.ts`.
2. **Adopt the order in §2.2**, with the implicit logger behind H2 and H4. Verify: no impression, dwell or
   skip event can be written before PR 5.
3. **Apply the deletions in §3**, or argue each one back with a measured need.
4. **Section rows: name, badge, reason, Follow; 3 rows; no numbers; "…" only on section rows.** Verify:
   375px light and dark screenshots of the section, signed in and out, in the round-2 log.
5. **Swipe in the section opens the pane; no reject gesture; −4 on "Not interested".** Verify: an e2e
   asserting a horizontal swipe on a section row logs `swipe_open` and opens the pane, never an exclusion.
6. **Paging conditions in §2.3.** Verify: the cross-page window test and the auto-append e2e.
7. **Reasons per §2.7.** Verify: the template list in the plan, scanned, with no ticker slot.
8. **Purge in the existing tick**, or the reason it cannot fit; the 4 M purge and 100,000-reference
   deletion tests (§6).
9. **Counsel packet** updated per H2 (one question removed, one added), ready for the owner to send.
10. **Keep §5 (policy checks) and the sign-invariance test exactly**; they are the best part of the plan.

For the UX lead: the signed-out section heading and reason, the end-of-feed card, the first-follow status
line, and the double-tap icon (no heart burst, no count; outline to filled).

For the reviewer: fail any F-2 PR that writes an implicit event before H2 is recorded as cleared, or that
shows a number on a section row.

## 11. What would change my mind

- Counsel clears personalization quickly and in full: then PR 5 and PR 6 move up behind PR 1, since
  signed-in viewers are where F-2's value lives.
- The owner's H5 answer puts the section on the profile: the "Similar holding periods" row comes back,
  wording per §2.5.
- The engineer measures read-time profile computation over 10 ms per viewer: `viewer_affinities`
  returns.

REVISE
1. Move diversity and exploration out of the blocked scoring PR into PR 1.
2. Reorder per §2.2; the implicit logger waits on H2 and H4.
3. Delete the serves tables, propensity, `viewer_affinities`, co-visitation, trader features, the profile
   row, "Not now", the settings switch and P9.
4. No reject gesture; the −4 goes on "Not interested"; a section swipe opens the pane.
5. Section rows without numbers, 3 rows, "…" on section rows only, a true signed-out heading.
6. Reasons without tickers and without "You follow @x".
7. Paging: auto-append and the diversity window across the page join.
8. Add H5 (the lost design decisions) to the hard stops; P3 and P9 withdrawn, P4 and P8 folded into
   items #10 and #13.
