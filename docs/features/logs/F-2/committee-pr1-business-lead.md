# F-2 · PR-1 committee · Business lead

2026-10-23. Build of `cd355aa` (fresh `.next`), `next start` on 3104 with the vendor fake on 4184, Postgres 16, signed
out, 375×667, light and dark. No sync tick. Fixture: 60 scratch traders (5 hyperactive: 60 closes each in the last 20 h,
moves within ±8%; 55 ordinary: 6 to 20 closes over 30 days, moves within ±25%; 5 widely held symbols and 40 others),
on top of the demo traders and leftovers from earlier runs; a second committee member's 40 traders arrived mid-session.
Mine deleted afterwards (60 rows, 0 left). Server and fake stopped.

**Decision: fix two things, then merge.** The mechanics are right: caps hold, the join is invisible on the normal
path, and the copy is honest. But on a realistic mix the feed is five people on rotation, and Retry throws the reader
150 cards forward.

## User test

- **Normal path: the join is invisible.** I scrolled one card at a time, 36 cards, in light and dark. Page 2 is
  requested once, while card 23 is on screen. Cards 30 → 31 snap like any other card. "Show more" never appears on
  screen, there is no layout shift, and the stand-in charts and SW-1 match. On this path it is delivered.
- **Variety: the caps hold, but the feed repeats people.** These are the fixture's 7 pages and 192 cards
  (`lib/feed.ts:66-71`, candidates are the top 200 *closes*):
  - The 5 hyperactive traders got **161 of 192 cards (84%)**.
  - Pages 3 to 7 hold 5 to 9 distinct traders each. The same five faces come back every 10 cards.
  - **29 of the 38 exploration picks went to those same 5 traders.** The "pool outside the top 30" is the 31st to
    200th closes of the people already at the top (`lib/discovery/explore.ts:82`). So exploration re-serves the most
    seen traders instead of surfacing new ones.
  - 33 of the 67 eligible traders never appeared before "End of today's feed."
  - When the other member's 40 traders (larger, fresher moves) arrived, the 200 candidates became 100% theirs. All 60
    of mine and all 3 demo traders dropped out entirely.
  - Criterion 6 is met to the letter: ≤ 2 per trader or symbol in any 10, and 2 picks in 10. Its intent is not met:
    variety, and a new trader getting reach. That intent is the supply loop. A trader who connects and never appears
    in anyone's feed does not share and does not stay.
- **Retry: the copy is good, the behaviour is not.** "Couldn't load more. Retry" is one line, honest, 44 px and
  `role="status"`. Keep it. But after a successful Retry with card 30 on screen, the client fired **6 requests in a row
  and left the reader at card 180**. The same happens when the feed is scrolled straight to the bottom (End, a hard
  fling).
  - Cause: the control (`.feed-more`) is the same DOM node before and after an append, and it is in view. The
    browser's scroll anchoring keeps it in view while 30 cards are inserted above it. The observer
    (`app/feed-pager.tsx:184-187`, which watches the control) then fires again, until the list ends.
  - The engineer's e2e asserts that Retry appends, not where the reader is afterwards.
- **No JS.** "Show more" leads to `?after=…` with 30 cards and `noindex`. Bad cursors return 200 and page 1.
- **End card.** "End of today's feed." with one button, "Publish your trades". It is true (seeded per UTC day, capped at
  200) and makes no completeness claim. One primary action, and the right one: the end of the feed is where a reader
  becomes a trader. The duplicate of the header link is acceptable at that moment. The disclaimer is still on the page.
- **Demo-only feed (3 traders): 6 cards, then the end card.** Acceptable, no demand. It is the cap working, the cards
  are 3 losses and 3 gains, and every record is one swipe away (SW-1). A demo deploy that shows 6 honest cards and
  "Publish your trades" beats one that shows the same three people 17 times each. Log correction: the engineer's §3.1
  says the demo feed has no exploration. It has 1 pick: the pool counts closes (90 > 30), not traders.

## Compliance: PASS

- **Losses ranked as gains.** The score is `abs(return_pct)`. The mix never reads a return. Sign invariance is tested
  on the score, the mix and records with zero weight. The **TR-9 asymmetry is not a compliance failure.** I measured
  it: on a 20-close record, a losing mirror image gets 2% more weight at ±2% moves, 10% more at ±10% and 27% more at
  ±25%. It always favours losses and never ranks a loss below an equal gain, so the rule's purpose (losses never
  buried) holds. It is F-1 behaviour, already merged.
  - The rule's wording ("equal") is not exact for those records. Owner, one line: either record "TR-9 is symmetric in
    log returns (a −20% move counts as large as +25%)", which is principled, or ask for a symmetric weight in a TR-9
    fix. My recommendation is to record the log-return definition and not spend a PR.
- **Works signed out.** Same list for every viewer. The action reads no session and writes nothing. The behavioural
  guard holds. The cursor carries only the day, `asOf` and the offset.
- **Nothing else.** No completeness words, no celebration, no advice, no new vendor or dependency. The disclaimer is
  unchanged. No third-party names in copy or fixtures.

## Business

- **What PR-1 is for.** Phase value is connected traders and shared-link reach. A feed's job for supply is that a new
  verified trader shows up in other people's feeds within a day.
- **Chain** (stated assumptions, not data):
  - eligible traders who never appear in a day's 200 cards × share of them who would share a first appearance;
  - today that is everyone outside the ~30 to 40 traders who own the top 200 closes;
  - it grows with every hyperactive or high-volatility trader who joins.
- **Most sensitive assumption:** the share of closes coming from a few hyperactive traders. Evidence tier: analogy.
  Participation in user-generated platforms is heavily skewed toward a few power users. I do not have our real
  distribution.
- **Cheapest test** (an hour): the candidate SQL with a per-trader limit, run on the fixture above. Count distinct
  traders per 200.
- **Size: ~1,290 changed lines against the 800 cap**, 828 of them tests. Pre-authorization #2, my recommendation to the
  owner:
  - For `feature` PRs, count only non-test, non-doc lines against `MAX_DIFF` = 800. Tests, logs and screenshots are
    uncapped.
  - Why: the cap exists to bound review risk in product code, and tests *reduce* that risk. The plan's required tests
    alone exceed 800. Splitting PR-1 into 1a and 1b costs a committee round, and 1b would still be over.
  - PR-1 product code is about 460 lines, inside the cap.
  - Until the owner answers, this PR merges as needs-human. Do not split it.

## Demands

1. **Blocker, builder: Retry and the jump must not skip cards.**
   - Fix: take the control out of scroll anchoring (`overflow-anchor: none` on `.feed-more`, or a new node per page),
     and only load from a card the reader has actually reached.
   - Verify (e2e, 375, light and dark):
     - From card 30, a failed load then a successful Retry → exactly **1** request, and card 30 or 31 at the top.
     - A jump to the bottom of page 1 → at most 1 request, and the reader lands within page 2.
   - Fails today: 6 requests, card 180.
2. **Blocker, builder: exploration must explore traders, and one trader cannot own the list.**
   - Limit each trader to at most **6** candidate closes in the 200. Six is the most the caps allow on a 30-card page,
     so nothing a page could show is lost. One window function in `feedCandidates`.
   - The exploration pool picks **traders not already placed in the list** before reusing one.
   - Sign-neutral. No per-trade hiding: profiles keep every close (TR-1).
   - Verify on a fixture of 5 hyperactive and 55 ordinary traders:
     - the 200 candidates span ≥ 33 traders;
     - no trader holds more than 6 cards in any 30;
     - ≥ 80% of exploration picks are traders not seen earlier in the list;
     - the sign-invariance and cap property tests are unchanged.
3. **Reviewer: add to the checklist.**
   - A paging PR is not approved without (a) a position assertion after Retry and after a jump, and (b) a variety
     measure on a skewed fixture: distinct traders per page and the share held by the top 5 traders. The caps alone
     prove neither.
4. **Builder, log hygiene:** correct §3.1 (the demo feed has 1 exploration pick, because the pool counts closes).
5. **Owner (not blocking):**
   - Answer pre-authorization #2 as above.
   - One line on TR-9: log-return symmetry, as described under Compliance.

## What would change my mind

- **Demand 2.** If the owner's real early cohort is small and evenly active, the per-trader limit changes nothing
  visible and could wait for PR-3's section. The fastest test is the distinct-traders-per-200 count on the first 50 real
  traders. I still require it now: the fix is one window function, and getting it wrong breaks the supply loop.

## Demo sentence

"Scroll and you meet someone new every few cards, wins and losses alike; when today's list runs out, it
says so."

COMPLIANCE: PASS · USABILITY: DEMANDS
1. Retry or a jump past card 25 chains 6 loads and drops the reader at card 180: one request, the reader stays put.
2. Five hyperactive traders hold 84% of the feed and 29 of 38 exploration picks: limit each trader to 6 candidate closes
   and explore by trader.
3. Reviewer: position-after-Retry and skewed-fixture variety checks become required for paging PRs.
4. Builder log: correct the demo-feed exploration statement.
5. Owner: pre-authorization #2 (count non-test lines against 800 for feature PRs; do not split PR-1); TR-9 log-return
   symmetry line.

## Round 2

2026-10-23. Build of `8f1b88f` (`.next` newer than every source file), `next start` on 3106 with the vendor fake on
4186, Postgres 16, signed out, 375×667, light and dark. No sync tick. Same fixture shape as round 1 (5 hyperactive + 55
ordinary + the 3 demo traders), plus one "new" trader: 8 closes, the latest 2 days old. A second member's 40 traders
(6 closes each, ±50%, all in the last 2 hours) were in the database throughout. My 61 rows were deleted afterwards (0
left). Server and fake stopped. Scripts and screenshots: scratchpad `bl/f2pr1r2`.

**Decision: one more small fix, then merge.** Both round-1 blockers are fixed as specified. The paging is now
invisible in every way I could break it. But on the skewed fixture, the first two pages are still half the same five
people. A preference of about five lines fixes it, and I measured that it does.

### Blocker 1 (page join): delivered

| Path (375, light and dark) | Requests | Where the reader is |
|---|---|---|
| Card-by-card walk to card 62 | 1 at card 25 (none at 24), 1 at card 55 | on the card they scrolled to |
| Failed load at card 30, then Retry | exactly 1 (3 more cards: still 1) | card 31 at the top, offset 0, focus on card 31 |
| Jump to the end from card 3 | 1 | card 31 |
| Then the End key | 1 more (2 in total), no chain | bottom of page 2, page 3 below it, nothing skipped |
| Hard fling (6 × 6,000 px) | 1 | card 40 / 49: the fling's own momentum, not a jump |
| Slow server (3 s), reader at the control | 1; reads "Loading…" | card 31 |

- Round 1 was 6 requests and card 180. Now it is one request, and the reader stays where they are or lands on card
  31.
- The engineer's e2e asserts position after Retry and after a jump, so demand 3 is met in this PR.

### Blocker 2 (variety by trader): delivered as specified; the first minute still repeats

Measured with `feedList` on my cohort alone (the `ids` hook), on the day's seed:

- **Candidates:** 200 cards from 62 traders (demand ≥ 33).
- **The list:** 199 cards, 62 of the 63 eligible traders. In round 1, 33 of 67 never appeared.
- **Distinct traders per page:** 20, 18, 29, 24, 23, 20, 16 (round 1: 5 to 9).
- **The 5 hyperactive traders' share:** 15.1% (round 1: 84%).
- **Caps:** at most 6 cards per trader in any 30. No trader twice in a row.
- **Exploration:** 24 of 40 picks are new traders. All 24 fall in the first 120 cards, and no pick reused a trader
  while a new pool trader existed. The last new trader enters at card 118.
- **Not yet great: the hyperactive traders are front-loaded.**
  - All 30 of their cards fall in the first 60. That is **29 of the first 60 cards**.
  - The worst 10-card window is **8 of 10** (cards 13 to 22). The worst 30 is 21.
  - Readers mostly see the first 60 cards, so the first minute is the round-1 problem in a smaller place: the same
    five faces, two each per 10 cards, for about 30 cards.
- **The fix, simulated.** I ran a scratch copy of `pick` (`lib/discovery/explore.ts:45-54`), changed from "prefer a
  trader other than the previous card's" to "prefer a trader not among the last 9 cards". It is still a preference
  that falls back the same way, and it reads no return.
  - 25 of the first 60, the worst 10 is 5 (each hyperactive trader once), the worst 30 is 15.
  - At most 3 per trader in any 30. The list is 198 cards, and exploration is unchanged (23 of 23 while a new trader
    existed).
- **This is my mistake, not the engineer's.** My round-1 criterion ("≤ 6 in any 30") allowed this. I am tightening it
  now because the fix costs about five lines and moves the first minute.

### The 80% measure: restate it, with a qualification

- **Accept the engineer's restatement for PR-1.**
  - Of the exploration picks made while a pool trader not yet in the list exists, ≥ 80% go to such a trader. It is
    100% today.
  - My whole-list version was wrongly specified: once every candidate trader is in the list (card ~120), it cannot be
    met.
- **The restatement measures the mechanism, not the outcome.** The outcome is a new trader getting reach, and in
  practice the 200-candidate ceiling decides it:
  - With the other member's 40 hot traders present, the 200 candidates were 100% theirs. Only 40 of 107 eligible
    traders appeared. 67 never did, including my new trader.
  - 27 of the 40 exploration picks re-served traders already shown, while those 67 waited outside.
  - With my cohort alone, the new trader appears at card 53 (an exploration pick).
  - So it works at launch scale (up to ~35 active traders, all inside the 200) and stops working above it. Any 34
    traders with 6 fresh large closes each lock everyone else out, every day, until those others trade big.
- **The fix belongs in the next PR, not this one.**
  - Let the exploration pool include eligible traders outside the 200: each one's best recent close, one card per
    trader, in the same seeded shuffle.
  - With the day's seed rotating, every eligible trader gets roughly a 24/N daily chance of a slot in the first 120
    cards.
  - PR-3's section does not cover this as planned. It ranks by the lower bound, so a new trader with 5 closes ranks
    last.

### Cold start: accept for now, with a trigger

- **My reading.** I ran `LOAD=1 lib/feed.load.test.ts` twice on an idle scratch database (cleaned up after). The
  machine was at load average 7 to 8 because of other agents.

  | Case | p95 | Cold page 1 |
  |---|---|---|
  | 12 heavy | 332 ms | 701 ms |
  | 50 heavy | 465 ms and 435 ms (the 400 ms assertion failed both times) | 1,292 ms and 735 ms |

  - The engineer's quiet-machine numbers (285 / 263 ms) are plausible. The budget has no headroom under contention.
- **What it means for the business.**
  - The kept list and the weights live in each server instance's memory. On a serverless deploy at low traffic, most
    requests reach a cold instance, so at launch the cold number is the typical one.
  - Launch has no 50-heavy cohort, though. At 12 heavy, cold page 1 is about 0.3 to 0.7 s, and a shared link still
    reaches its aha in well under 3 s.
  - On another instance, page 2 is recomputed pinned to `asOf`. The only miss is an outright account deletion
    (deviation 3), which is rare and covered by the client's repeat guard. Accepted.
- **Trigger.**
  - Record the server time of the deployed feed's page 1 from day one.
  - Build the engineer's follow-up (a pane summary kept per record) before either of these happens: p95 above 400 ms,
    or more than 12 traders with 1,000+ closes among the candidates.
  - Keep the 50-heavy load case out of any CI gate until it has headroom. On a busy runner it fails.

### Compliance: PASS

- The new preference (mine, demanded below) and the shipped fix read no return. Sign invariance tests are unchanged.
- New copy ("Loading…", "30 more trades loaded", "See your record") is factual, with no completeness claim and no
  advice.
- The feed list is still the same for every viewer.
- The layout's `data-viewer` query reads the session only to pick which of two end-card links is shown. The page
  works signed out.
- No vendor, no dependency, no third-party name.
- **Size:** product lines across PR-1 are 722 (non-test, non-doc), inside 800 under pre-authorization #2 as proposed.

### Taste

- **"Loading…" is drawn as the filled purple primary button** (`loading-375-light`). A loading state that looks
  tappable invites taps that do nothing. Use the muted text style with no fill, and keep the filled button for Retry
  only. Not blocking; the UX lead's call.

### Demands

1. **Blocker, builder: the first 60 cards must not be half five people.**
   - In `pick`, prefer a trader not among the last 9 placed cards over one who is. Fall back in the same order as
     today (another trader than the previous card's, then any). It stays a preference, never a cap, and reads no
     return.
   - Verify (pure test + the DB skewed fixture, on 50 seeds):
     - the 5 hyperactive traders hold ≤ 5 of any 10 cards and ≤ 27 of the first 60;
     - list length is within 2 cards of today's;
     - exploration's "new trader while one exists" stays at 100%;
     - the sign-invariance and cap tests are unchanged;
     - the demo-only feed is still 6 cards.
2. **Builder, log:** restate the exploration criterion as above, in the PR body and the test name.
3. **Planner (PR-3 or a PR-1b, before eligible traders pass ~35):** add eligible traders outside the 200 to the
   exploration pool (best recent close, one card each, seeded order).
   - Acceptance: with the 40-hot-trader fixture plus 60 others, ≥ 80% of eligible traders appear in the first 120 cards
     at least once over 7 consecutive day seeds.
   - Budget: page 1 p95 unchanged.
4. **Planner / engineer:** cold-start trigger as above. Record page-1 server time from the first deploy. The pane
   summary follow-up starts when the trigger fires.
5. **Reviewer:** add to the paging checklist: the hyperactive share of the *first 60* cards and the worst 10-window,
   not only the whole-list share. 15% overall hid 48% in the first 60.

### What would change my mind

- If the owner's first cohort has no hyperactive traders, demand 1 changes nothing visible. I still require it: it is
  about five lines, and it is the first minute of every reader.
- Fastest test after launch: the hyperactive share of the first 60 cards on real data.

### Demo sentence

"Scroll and you meet someone new every few cards, wins and losses alike; when today's list runs out, it says so."

COMPLIANCE: PASS · USABILITY: DEMANDS
1. Blocker: the 5 hyperactive traders hold 29 of the first 60 cards (8 of 10 at worst). Prefer a trader not in the
   last 9 cards: simulated 25 of 60, ≤ 5 in any 10, exploration unchanged.
2. Builder log: restate exploration as "≥ 80% new traders while a new pool trader exists" (100% today). Accepted.
3. Planner: exploration pool to include eligible traders outside the 200 (67 of 107 got no reach with a hot cohort
   present); ≥ 80% of eligible traders in the first 120 within 7 days. Next PR, not blocking.
4. Cold page 1 (0.7 to 1.3 s under load, 50 heavy): accepted. Record deployed page-1 server time; pane-summary
   follow-up when p95 > 400 ms or > 12 heavy candidates.
5. Reviewer: check the first-60 share and the worst 10-window on a skewed fixture, not only the whole-list share.
