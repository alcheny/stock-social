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
