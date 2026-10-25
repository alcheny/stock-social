# F-2 · PR-5 finalization · Round 1 · Business lead

Date: 2026-10-25. Responds to the owner's request to finalize PR-5 now that the hard stops are resolved. Read:
`plan.md` (PR-5, §2 to §9), the F-2 file (Decisions to 2026-10-25, criteria incl. G1 to G6), POLICY F1 as amended
(bcaac14), `hardstops-resolution-business-lead.md` (§1 to §3), `hardstops-resolution-engineer.md` (D1 to D14, §3.3),
`build-pr4-engineer.md`, `lib/discovery/weights.ts`, `lib/discovery/prefs.ts`, `lib/copy.ts#SECTION`, `lib/feed.ts`
(14-day recency window), IMPLEMENTATION item #7. `plan-guardrails.md` does not exist yet; where this position depends on
it, that is stated as a demand. Nothing here is legal advice.

## 1. Decision

**Build PR-5 as one PR of explicit-signal personal scoring, with no event table, no implicit logger and no new stored
data. Drop PR-5a.** Strongest reason: under G3 the implicit logger and `/api/events` serve no real viewer, yet they are
about half of PR-5 (~550 of ~1,100 lines), they add a new data category, a new retention promise that depends on the
unscheduled item #7, and a Privacy Part B that would describe recording ("how long you look at one") we must not do.
Every signal G3 keeps (follows, likes, hides, watchlist) is already stored as a state row the viewer chose. PR-5 only
has to read them.

## 2. The demo sentence

"Double-tap two records you like, open the feed again, and traders who hold about as long come first, losses
included, with one line saying why."

## 3. What PR-5a and PR-5b become

### Dropped: PR-5a as planned (park it as "PR-5x, implicit signals", not built)

Deleted from this phase, every line: `discovery_events`, `discovery_event_types`, `discovery_surfaces`,
`lib/discovery/events.ts`, the emitters in the PR-2 and PR-4 actions, the watch actions and `share-button.tsx`,
`app/discovery-log.tsx`, `app/api/events/route.ts`, the event purge and its deletion step, the "demo viewer" exception
in G3, and Privacy Part B.

- **Why not build it "behind the G3 constant" (the ~10-line cost in the packet)?** Because the constant is the cheap
  part. The cost is the ~550 lines behind it, which then have to be tested, reviewed, kept true in the Privacy text
  and kept inside the purge, for zero real viewers. Code that is off is inventory, not progress. "Demo viewers" do not
  exist as a product role (demo is a trader property), so nothing would ever exercise it.
- **What we lose:** the share signal (proposed +4) and the owner's opening-swipe +2. The share signal has no state row,
  so it is the only explicit signal that would need an event table. The opening swipe is an "open", which G3 keeps off.
  Neither justifies a table on its own today. Both return with PR-5x.
- **When PR-5x comes back:** only when the owner lifts G3 after counsel answers Q4 and Q5. It then gets its own plan
  round, its own Privacy text, and the facts of that day (the minors' feed rules take effect in January 2027).

### The one PR-5: personal scoring from explicit choices (`autopilot/feature-2-personal`, target ≤ 500 product lines)

- **Inputs, all existing rows, all keyed by the session's viewer id, read only when G1 is on:** `follows`,
  `trade_likes` (joined to `closed_trades` by `trade_key` for symbol and holding days), `ticker_watches`,
  `viewer_exclusions` (`not_interested`, `unfollow`), `trade_rejects`.
- **Schema: none.** `discovery_trader_features` is deleted too. It would be refreshed in the tick, and the tick is not
  scheduled (item #7), so it would be empty or stale in exactly the environment we demo in. Trader features (holding
  bucket, recent symbols) are impersonal and already computed for the section and Similar trades. Compute them in one
  grouped query over the feed's candidates and cache them hourly in memory, the same as `lib/similar.ts`. Fallback only
  if the budget misses: the table, filled lazily on read with a TTL, never by the tick.
- **Scoring:** generalize `lib/discovery/prefs.ts` (today negative-only, ×0.8 per −1) into one bounded personal
  multiplier `m` per trader, applied the same way (`rerank` on the shared impersonal list, at the cursor's `asOf`, so a
  same-day cursor never changes and a new signal enters at the next page 1). `m = 1` with no signal. `m ∈ [0.5, 2]`.
  The section keeps "relevance picks the pool, the TR-9 lower bound orders the rows".
- **Exploration seed stays the UTC day.** Delete the planned "viewer id + UTC day" seed. It is not one of the viewer's
  actions, PR-1b already reaches every eligible trader, and a day-only seed keeps the G1-off equality trivial to test.
- **Reasons and heading** (§6), the criterion-11 fallback as a try/catch around the reason picker (no `ReasonWriter`
  model seam, no 300 ms timeout: no model exists in stage 1, and the seam returns with H3).
- **Privacy:** the three PR-5b replacement sentences from packet §3 (follows, likes, watchlist "appear higher"). No
  Part B. No new table row.
- **Split rule:** if the engineer's estimate exceeds 700 lines, split as PR-5 scoring (feed and section order, no copy
  change) then PR-5r reasons and heading. Not before.

PR-6 shrinks to match: delete the 4 M expired-event backlog and the 200-concurrent-batch event assertions; replace
"5,000 viewers × 500 events" with 5,000 viewers × (50 follows, 500 likes, 20 watches, 50 hides).

## 4. How G1 and G3 bind PR-5

- **G3 deletes scope; it does not add a switch.** Nothing implicit is stored, so nothing has to be switched off. The
  test becomes static and behavioral: no event table, no events route, no `sendBeacon` or visibility logger in `app/`,
  and an e2e that scrolls 60 cards and opens 3 panes and sees no non-GET request except the actions tapped.
- **G1 is a precondition, not a PR-5 feature.** POLICY F1 already says "A viewer can turn personal ordering off in
  Settings", and PR-4's ×0.8 demotions are personal ordering that is live today. So the switch is owed now, in the
  guardrails PR, covering today's demotions. PR-5 then adds one branch: G1 off → `m ≡ 1`, no read of `trade_likes`
  or `ticker_watches` for ordering, impersonal heading and reasons. The order equals the signed-out order minus the
  viewer's own hides (criterion G1).
- **G2 and G4 copy must not promise "reading activity".** With no event table there is none to delete. "Reset my feed"
  deletes hides and unfollow notes. Its line must say follows and likes stay (they are visible lists with their own
  controls). The delete-profile screen drops "reading activity" from its list.

## 5. Weights

| Signal | Weight | Status | How it enters `m` |
|---|---|---|---|
| Like | +3 | owner, pinned | direct on the trader, plus the record's symbol and holding bucket; decays, half-life 30 days |
| Unlike | retracts | by construction | the row is deleted, so the like is gone at the next page 1 |
| Opening swipe | +2 | owner, pinned | **unused**: an open is an implicit signal under G3. Keep the constant with a comment |
| "Not interested" | −4 | owner, pinned | trader excluded 90 days (built); −4 into the similarity vectors while the row runs ("lowers similar") |
| Trade reject | −4 | owner, pinned | trade hidden (built); −4 into the similarity vectors while the row runs |
| Reject, trader part | −1 | built (PR-4) | unchanged, ×0.8 |
| Unfollow | −1 | built (PR-4, O4) | unchanged, ×0.8 |
| Follow | **+5, pin** | was proposed | direct on the trader while following; no decay (a standing choice, like a subscription: packet Q2) |
| Symbol watched | **+3, pin** | was proposed | symbol vector only, while watching; never a direct trader weight |
| Similarity coefficients | **0.6 symbols, 0.6 holding, pin** | was proposed | bounded: similarity moves at most half of `log m`'s range, so the viewer's direct choices always dominate |
| Share | +4 | proposed → **delete** | needs an event table (PR-5x) |
| Profile open +2, dwell +1 / +0.5, impression and skip 0 | | proposed → **delete** | implicit (G3) |

Two bounds I am adding, each a testable invariant:
- `m ∈ [0.5, 2]`. A follow can lift a trader at most 2×, so a stranger with more than twice the evidence-weighted
  score still ranks above. The floor keeps O4's "never a hide" honest for unfollow and rejects.
- Monotone: adding a like or a follow never lowers that trader. Adding a hide never raises a similar trader.
- **Symbol affinity sits behind one constant.** Setting it to 0 removes the watchlist input and its reason. Packet Q1
  rates symbol affinity the medium-risk part of personal ordering; if counsel ever objects, it must be a one-line
  change.

## 6. Personal reasons and the section heading

Reasons (section rows only; feed cards keep no reason line). Each is shown only when true against the inputs and is
the row's largest personal contributor. Otherwise the row keeps its impersonal reason ("Typical holding period: …"):

| Reason | True when | Verdict |
|---|---|---|
| "Holds trades about as long as @x" | x is a trader the viewer follows or liked (newest first), same holding bucket, x not deleted or hidden by the viewer | **keep** (the plan's "Similar holding period to @x"; the UX lead may reword within the rule) |
| "Trades symbols on your watchlist" | overlap between the trader's closes in the last 90 days and the viewer's watchlist; names no symbol | **keep**, behind the symbol constant |
| "Trades symbols you read" | needs reading data | **delete**: untrue under G3 |
| "New to you" | needs impressions to know what the viewer has seen | **delete**: untrue without them |

Heading: **"More like what you follow and like"**, shown only with G1 on and at least one follow or like counted.
Otherwise the impersonal "Other traders' records" stays. **Delete "More like what you read"**: it claims reading
tracking that G3 forbids and the Privacy text will not describe. The UX lead may rewrite within the rule (true, names
only the viewer's own actions actually used, no "Suggested", "Recommended", "Top", "Best", "AI", no "read" or
"activity").

## 7. Order

1. **Guardrails PR first** (G1 covering today's demotions, G2, G4, G5, G6). Reason: POLICY F1 promises the switch now.
   It also touches `lib/feed.ts#loadFeedPage`, the same lines as PR-5, so number order decides.
2. **Privacy PR** in parallel with 1 (different files): Part A with the G1 to G6 bracket lines resolved, no Part B.
   The owner merges it by hand. It goes live only once item #7 is scheduled (owner condition).
3. **PR-5.** Its pure module (`lib/discovery/personal.ts` and its tests) can start now in its own worktree. Integration
   and merge come after 1. The three Privacy sentences ride in PR-5, so the owner merges PR-5 by hand (O9).
4. PR-6, trimmed (§3).

Real (non-demo) viewers wait for all of: item #7 scheduled, the Privacy text live, the share-image font fetch fixed
(packet Q8). POLICY's "no public launch until counsel signs off" still holds. **Urgency note:** for the business,
scheduling item #7 and the font fix block real users more than PR-5 does. PR-5 must not take a worktree or a reviewer
slot from them.

## 8. Scorecard

| Dimension | This proposal | PR-5a + 5b as planned, under G3 |
|---|---|---|
| Market demand | **4**: observed behavior: a 2023 peer-reviewed field experiment on two large social platforms found that users switched from ranked to reverse-chronological feeds spent noticeably less time and were less active ([summary](https://gsb.stanford.edu/faculty-research/publications/how-do-social-media-feed-algorithms-affect-attitudes-behavior)). Caveat: that ranking used implicit signals; explicit-only is the weaker form. | 4, same evidence; the implicit part is off for real viewers anyway |
| Ease of adoption | **5**: zero new steps; the viewer already likes and follows | 5 |
| Phase fit | **4**: targets the D7-return gate (≥ 15%). Honest limit: with fewer than 50 traders, reordering a small pool moves little | 4 |
| Revenue impact | **3**: indirect (§10) | 3 |
| Aesthetics & clarity | **4**: one heading and one reason line change; no new UI | 4 |
| Trust & compliance | **5**: no new data, no new retention, every reason true by construction, sign-invariant, G1 first | **3**: Part B would describe recording that G3 forbids; retention depends on unscheduled #7 |
| Simplicity | **5**: ~400 to 500 lines, no schema, no route, no vendor (from ~1,100) | **2**: half the lines serve no real viewer |
| Craft & taste | **4**, pending the UX lead's heading and the 375 px e2e | 3: "More like what you read" and "New to you" would be untrue |

The proposal clears the bar. The plan as written does not (Trust 3, Simplicity 2).

## 9. What I deleted and what I said no to

- Deleted: the event table and both lookup tables, the implicit logger, `/api/events`, the emitters, the event purge,
  `discovery_trader_features`, the per-viewer exploration seed, the `ReasonWriter` model seam and timeout, two reasons,
  the "read" heading, Privacy Part B, the share and implicit weights, and the event half of PR-6.
- Said no to: logging explicit events "for later" (state rows already hold them with `created_at`); a holdout group
  for measurement (it would make the Privacy line "Followed traders appear higher" untrue for some viewers); per-viewer
  exploration "for reach" (no evidence at today's pool size).
- Reversing my own earlier position (committee PR-1b §5) on **O3**: I now back **90 days for both** trade hides and
  trader hides. New facts: (1) the feed scores closes older than its 14-day window low, so a 90-day trade hide is close
  to "not shown again" in the feed (inferred from `lib/feed.ts` `RECENT_HOURS`; Similar trades may still surface it
  after 90 days); (2) a permanent hide is a row we never purge, which adds a "until you remove it" retention line and
  makes G2 the only way out; (3) one constant keeps one copy line.

## 10. Revenue chain (Phase 1 earns nothing directly)

`signed-in viewers V × share giving at least one like or follow in week 1 (a) × change in D7 return from personal
ordering (Δ) × profile views per returning viewer-week (p) = extra profile views per week for traders`

- Assumptions (intuition tier; no data yet, because there are no real viewers): a = 15% / 30% / 50%; Δ = 0 / +1 / +4
  points among those viewers; p = 3 / 5 / 10.
- Low: 0 (Δ = 0). Base: V × 0.30 × 0.01 × 5 = 0.015·V views per week. High: V × 0.5 × 0.04 × 10 = 0.2·V.
- Read: a small effect per viewer. It matters only if V is large, which is why it ranks behind the supply blockers in §7.
- **Most sensitive assumption: a** (how many viewers give any explicit signal). If a is low, personal ordering touches
  almost no one, whatever the formula.
- **Cheapest test within two weeks of real viewers:** from existing rows, the share of viewers with a session in week 1
  who have at least one `trade_likes` or `follows` row (`created_at`). Zero new data, one query.

**What to measure after merge (all from existing rows, no new data):**
1. a, as above.
2. Likes per 100 hides per active viewer-week, before and after PR-5 for the same cohort. Personal ordering working
   means the ratio rises.
3. D7 return (`sessions.last_seen_at`) for viewers with signals against before PR-5. Directional only at small n.

## 11. Owner questions (each with the default the build uses)

| # | Question | Default |
|---|---|---|
| O3 | Hide duration | **90 days for both** trade hides and trader hides; closes O3 (§9) |
| O6 | Restate the criteria that assume an event log: 2 ("built from their own event log (impressions, dwell…)") → "built from their own follows, likes, watchlist and hides"; 3 → "no event table exists; scoring reads only the listed state rows (tested)"; 5 → event clause removed, "affinities" are computed on read, so none are stored; G2 and G4 drop "reading activity"; G3's test → the static and behavioral checks in §4 | **Yes**, as written here |
| O7 | PR-4's guard test asserts that the signed-in feed never reads `trade_likes`. PR-5 must read it when G1 is on | **Keep the assertion verbatim for a G1-off viewer and signed out; add a G1-on case (read only keyed by the session's id). Nothing removed; the test count rises.** |
| O8 | Pin the proposed weights: follow +5, watch +3, half-life 30 days, similarity 0.6 / 0.6, `m ∈ [0.5, 2]` | **Yes** (§5) |
| O9 | PR-5 carries the three Privacy sentences, so it is owner-merged | **Yes**; the alternative is a separate one-file Privacy PR the same day |

## 12. Compliance (COMPLIANCE §1)

1. **Performance:** no new number. Section rows stay figure-free; the pane carries the F3 disclaimer. The ordering is
   the documented method × a bounded personal multiplier that reads no sign or size of a return (F1, F4). Losses are
   liked, hidden and lifted like gains (sign-invariance tests).
2. **Personal data:** no new field, table or retention. New purpose for existing rows: likes, follows and the watchlist
   now raise ordering, disclosed by the three Privacy sentences before real viewers. Read only for the session's viewer
   and only with G1 on. Nothing is stored or read signed out. Deletion is unchanged (G4 adds the watchlist to the first
   step). No reasons cite another viewer; F1's "never uses another viewer's data" holds (no co-visitation).
3. **Money:** none. No points or rewards; a like or follow earns nothing (F6).
4. **Email, push, SMS, tracking:** none. No implicit tracking (G3), no third party, no notification (F3b).
5. **User text:** none new. Reasons are fixed, scanned templates with no ticker slot (F1).
6. **Sign-up, age:** unchanged. 18+ attestation; only signed-in attested viewers have inputs. The minors' feed laws
   (packet Q4) stay a residual risk mitigated by G1 and by no implicit signals.
7. **Vendor or dependency:** none. No model.
8. **Screen reader and keyboard:** no new control. The heading is a real heading, and the reason line is text inside
   the row's accessible name. The 375 px e2e covers keyboard order, light and dark.
9. **Security:** no new endpoint. All reads are session-bound, and the guard tests gain `trade_rejects` and
   `ticker_watches` (D13).
10. **Claims:** reasons and heading true by construction (tested); no "AI", "Suggested", "Recommended", "For you
    picks"; no completeness claim.
11. **Checkout:** no.

## 13. Acceptance tests (written first; each failing before the code)

1. **No new data:** the PR's `db/schema.sql` diff is empty. No `app/api/events`. A static scan finds no `sendBeacon`,
   no visibility logger, no `discovery_events` in `app/` or `lib/`. E2e at 375 px, signed in: scroll 60 cards and open
   3 panes; the only non-GET requests are the actions tapped (G3).
2. **G1 off:** on 200 seeded viewers with follows, likes, watches and hides, feed pages 1 to 3 and the section equal
   the signed-out order minus the viewer's own hides. The query log shows no `trade_likes` or `ticker_watches` read for
   ordering. Heading and reasons are impersonal.
3. **Cold start** (G1 on, no signal): output identical to today's.
4. **One follow:** the followed trader ranks above its identical twin. `m ≤ 2`. A stranger with more than 2× its
   weight × score still ranks above it.
5. **One like:** the liked trader ranks above its twin. A trader in the liked record's holding bucket ranks above its
   twin in another bucket, by less than the direct effect.
6. **Unlike:** the order at the next page 1 equals the order before the like.
7. **"Not interested" and trade reject lower similar records:** a trader sharing the bucket and symbols ranks below its
   twin while the row runs, and equal after it ends. The excluded trader is absent for 90 days (criterion 4).
8. **PR-4 unchanged:** every PR-4 preference test passes unmodified (×0.8 per −1). `m ≥ 0.5`.
9. **Sign invariance:** negating every `return_pct` leaves the personal order unchanged (1,000 seeds). A viewer who
   liked only losing records gets the same slate shape, and losses are suggested as gains (criterion 8).
10. **Caps:** on 1,000 seeded personal feeds × 3 pages, joins included, no trader or symbol appears more than twice in
    any 10 cards; at least 2 of 10 are exploration picks; the exploration seed is the UTC day only.
11. **Paging:** a like or follow made mid-session changes no slice of a same-day cursor and appears at the next page 1.
12. **Isolation:** swapping two viewers' rows swaps only their own orders. Signed-out output is byte-identical to
    before (the existing guard, unchanged).
13. **Reasons:** each personal reason is true against its inputs on fixtures. "Holds trades about as long as @x" never
    names a deleted, hidden or unfollowed x. No reason contains a symbol. The copy scan passes (PROMO, the suggestion
    word list, "AI", "Suggested", "Recommended", "read", "activity"). A forced throw in the reason picker yields the
    impersonal reason (criterion 11).
14. **Heading:** personal only with G1 on and at least one follow or like counted; otherwise impersonal; true in every
    state tested.
15. **Symbol constant at 0:** the watchlist never changes the order, and its reason never appears.
16. **Budgets:** scoring p95 ≤ 10 ms per viewer with 2,000 likes, 500 follows and 50 watches. Signed-in feed p95 <
    800 ms at 500 traders. 5,000 viewers scored in < 50 s on one core. Signed-out p95 < 400 ms unchanged.
17. **Deletion:** after account deletion, no row of the viewer remains in any F-2 table (unchanged), and the watchlist
    is gone in the first step (G4). A liked or followed trader who is deleted never appears in a reason.
18. **Demo e2e** (375 px, light and dark, keyboard and touch): a fixture of 12 verified traders across buckets. The
    viewer likes two records of one bucket and opens the feed again. The section heading is personal, and at least one
    row reads "Holds trades about as long as @x". Signed out, the same page shows the impersonal heading. Screenshots
    go in the build log.
19. **Privacy:** `/privacy` contains the three PR-5 sentences and no Part B. The e2e asserts the text.
20. **Guard tests:** with G1 on, the signed-in render reads `trade_likes` and `ticker_watches` keyed only by the
    session's id. `VIEWER_TABLES` gains `trade_rejects` and `ticker_watches`. No prior assertion changes (O7).

## 14. Demands

**Engineer (merging the three positions into the amendment), in priority order:**
1. Write the amendment with PR-5a dropped and PR-5x parked (§3). If you keep any event table, name the real
   (non-demo) viewer who would write a row before G3 lifts. I verify that the amendment has no event table in PR-5.
2. Put the G1 switch (including today's demotions) in the guardrails plan, ahead of PR-5. I verify the order table.
3. Carry §5's bounds as tests (4, 5, 8) and give a line estimate for PR-5. Over 700 lines, apply the split rule.
4. Restate criteria 2, 3, 5, G2, G3, G4 as in O6 and send them to the owner as one question, not five.

**Builder (PR-5):**
1. Delete before adding: extend `prefs.ts` and `rerank`; don't build a second ranking path. I verify that `rerank`
   remains the only re-ordering of the shared list.
2. No schema change. I verify that the `db/schema.sql` diff is empty.
3. "Done" is test 18 passing at 375 px signed in and signed out, with the screenshots, not unit tests alone.

**Reviewer:** run tests 2, 12 and 20 yourself against a real database with a query log. An approval from the diff
alone is not an approval here: the risk is a viewer-table read on the signed-out or G1-off path, which only the query
log shows.

**UX lead:** one heading and two reason templates, each true under §6's rules, at 375 px in one line where possible.
Also the Reset-my-feed line in the guardrails plan ("Follows and likes stay") and the switch's explanation, which must
list exactly the inputs used (follows, likes, hides, watchlist) and nothing about reading.

## 15. What would change my mind, and the fastest test

- **If a is below about 10%** (almost no viewer likes or follows in week 1), explicit-only personal ordering reaches
  almost no one. The real choice is then PR-5x after counsel, or no personal ordering at all. Test: the §10 query,
  two weeks after real viewers arrive.
- **If the merged estimate for PR-5 exceeds 800 lines** without the event log, the formula is over-built. Cut the
  similarity vectors to holding period only before cutting anything else.
- **If counsel later rates symbol affinity as advice-adjacent:** set the symbol constant to 0 (test 15).

Sources:
- [How do social media feed algorithms affect attitudes and behavior in an election campaign? (study summary)](https://gsb.stanford.edu/faculty-research/publications/how-do-social-media-feed-algorithms-affect-attitudes-behavior)
