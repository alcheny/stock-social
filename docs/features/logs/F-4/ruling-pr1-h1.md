# F-4 PR-1 · Business lead ruling: H1 (small lucky samples top the feed), M3, B1

Date: 2026-10-24. Read: `test-pr1-tester.md` (B1, H1, M3), `committee-pr1-business-lead.md`, `build-pr1-engineer.md`,
`lib/trades.ts` (`confidence`, `evidenceWeight`), `lib/discovery/section.ts`, `lib/feed.ts#weights`, F-4 owner
decisions (2026-10-22), DESIGN TR-7 and TR-9. Measured on a scratch copy of this branch (session scratchpad) with its own
database (`stock_social_bl_h1`, dropped afterwards). No repo file other than this one was edited.

**Decision: fix H1 with two small changes and one deletion. No owner decision changes.**
1. **Ranking floor:** `evidenceWeight` is 0 below 10 independent bets. Display keeps the owner's floor of 5.
2. **Variance floor:** the interval's spread is never narrower than a minimum per-day movement allows, so a range is
   never zero-width.
3. **Delete C3** (my own ruling, withdrawn). Its cause is gone, and B1 goes with it.

**Why.** PR 1 was meant to change what is shown. It also changed the ranking, by accident: 5 to 9-bet records gained
weight. The smallest correct fix is to remove that side effect, not to add machinery around it.

## 1. The rule (exact)

In `lib/trades.ts`:

```ts
export const SIGMA_DAY = 0.01, PRIOR_BETS = 5; // variance floor: 1% per √day held, weighted as 5 bets
export const RANK_MIN_BETS = 10;               // ranking only; display keeps MIN_BETS = 5
```

In `confidence()`, both standard errors use one helper. S is the sum of squared cluster residuals, as today:

```ts
const spread = (S: number) => Math.sqrt(Math.max((k / (k - 1)) * S, (PRIOR_BETS * SIGMA_DAY ** 2 * sumD + k * S) / (PRIOR_BETS + k - 1)));
const seM = spread(clusters.reduce((a, c) => a + (c.x - c.n * m) ** 2, 0)) / n;
const seR = spread(clusters.reduce((a, c) => a + (c.x - R * c.d) ** 2, 0)) / sumD;
```

```ts
export const evidenceWeight = (c: Confidence): number =>
  (c.pace30 && c.tier !== 'too-early' && c.k >= RANK_MIN_BETS ? Math.max(0, Math.log1p(c.pace30.low), -Math.log1p(c.pace30.high)) : 0);
```

What it means:

- **The variance floor** moderates the sample spread toward a prior: a trade's log return moves at least 1% per √day
  held. The prior counts as 5 bets (PRIOR_BETS reuses the owner's 5). It takes the larger of the two, so a range is
  **never narrower than the sample's own spread**.
  - At K = 5 the prior counts about as much as the data. At K = 150 it is about 3%, and it binds only when the sample
    spread falls below the floor.
  - One expression feeds both intervals. So display, direction, the width test and the weight all read the same
    honest spread.
- **The ranking floor** applies to weight only. A record with 5 to 9 bets shows its range, its tier "thin" and its
  direction exactly as the owner decided. It weighs 0, which is main's ranking for these records. Such a record still
  reaches readers through the new-record slot, which exists for exactly this case (F-2 PR-1b).
- **Kept as decided:** t with K − 1 degrees of freedom, MIN_BETS = 5, TOO_WIDE = 0.10 in simple points, tiers, the
  pace formula, and log-space symmetry.

**Why 1% per √day.** A broad US stock index moves about 1% a day: roughly 14.5% to 18.6% annualized, depending on the
window, and 1% × √252 ≈ 15.9%. Single stocks move more. So the floor sits at or below nearly every position a trader can
hold. It binds only when a sample is implausibly calm, which happens mostly when the sample is small. This is
analyst-tier evidence: [an adviser commentary citing 18.6% over 93 years and 14.5% over 20 years](https://www.wealthspire.com/blog/the-one-thing-the-market-almost-never-does),
and [a preprint on a large-cap US index: rolling daily volatility mostly 0.5% to 2%](https://arxiv.org/pdf/2403.01088).

**Why not the alternatives.**

| Option | Verdict | Measured reason |
|---|---|---|
| Ranking floor alone (no variance floor) | Not enough | "(+2.0% to +2.0%) · 95% range" still prints from 5 identical bets, which is false precision on a trust surface that PR 3 puts on the share card |
| Variance floor alone (no ranking floor) | Not enough | Lucky 5-bet record: 0.305 → 0.256 at 1%. It still beats both long records. A floor high enough to zero it (2%) widens every low-volatility record permanently: the demo record "dividend_dan" goes (+0.4% to +1.3%) → (−0.8% to +2.5%), and a 0.8%/day trader with 150 bets drops from weight 0.023 to 0.000 |
| Ranking weight 0 while TR-7 "New record" (< 10 trades or < 30 days) | Rejected | It breaks 2 feed diversity tests (`feed.test.ts` hyperactive cap, `feed.reach.test.ts` repeated runs) because 30-trade records under 30 days lose weight. That changes F-2 behavior beyond PR 1 |
| Population shrinkage now | Deferred | F-4 names it "the later upgrade". It needs a population estimate (a query and a constant per refresh) and changes the displayed average, which is an owner-visible change. It is the only fix for the residual in §6 |

## 2. Measured effect (scratch copy, `lib/trades.ts` patched as in §1)

| Record | As built: weight, range | Ruled: weight, range |
|---|---|---|
| 5 one-day trades, +1% to +3% (tester H1) | 0.305, (+1.0% to +3.0%) | **0**, (+0.9% to +3.2%), thin |
| 5 identical +2% trades, 3-day holds | 0.198, **(+2.0% to +2.0%)** | **0**, (+0.4% to +3.6%) |
| 6 losing trades, −4% to −6% | 0.435, (−5.7% to −4.3%) | 0, (−6.3% to −3.7%) |
| 40 bets, +2% average | 0.228 | 0.228 (unchanged) |
| 150 bets, +0.8% average | 0.069 | 0.069 (unchanged) |
| Demo maya, demo yuki | (−0.1% to +2.7%), (−3.4% to +4.3%) | unchanged |
| Demo dan | 0.025, (+0.4% to +1.3%) | 0.021, (+0.3% to +1.4%) |
| Every record above, log-mirrored | same weight as the original | same weight as the original |

**Monte Carlo** (20,000 zero-edge records, daily volatility 1% to 4%, 1-day holds): how often a record with no edge
outranks the 150-bet record.

| Record size | As built | Ruled |
|---|---|---|
| 5 bets | 3.35% | **0%** (ranking floor) |
| 10 bets | 2.36% | 2.32% |

The 10-bet figure is the same on main. A true-edge trader (+0.3%/day, 2% volatility) keeps the same mean weight at
K = 30 and K = 150. The variance floor is an honesty floor, not a ranking lever.

**Full unit suite on the scratch copy:** 633 tests, 621 pass, **0 fail**, 12 skipped (LOAD). `tsc --noEmit` is clean.
- `lib/feed.reach.test.ts` "PR-1b acceptance" **passes byte-identical**. On every seed: newcomers 5/5 (4/5 on one
  seed), rows with no earlier card 12/12, sections with a newcomer 3 to 4, union 104 of 105, repeated runs 0, hot
  36 to 37 of 60.
- The scratch copy also had C3 deleted (§4).

## 3. Tests the engineer adds or moves (none deleted from main, none loosened)

**New, in `lib/confidence.test.ts`.** Fixtures are copied from the tester's `lucky.ts`:
- **"H1: a 5-trade lucky record never outranks a 40-bet or a 150-bet record; mirrored losses rank the same."**
  - Fixtures: lucky = 5 one-day trades at +1, +2, +3, +1.5, +2.5% on distinct symbols; 40 bets, 2-day holds,
    `0.02 + ((i*7)%5 − 2)/100`; 150 bets, 2-day holds, 40 symbols, `0.008 + ((i*37)%13 − 6)/200`.
  - For both the original and its log mirror (r → 1/(1+r) − 1):
    - lucky weight === 0, and the other two weights > 0;
    - `rankTraders` gives [40-bet, 150-bet, lucky] even when lucky has the highest score;
    - lucky's tier is still `thin`, and it keeps its `perTrade`, so display follows the owner's floor.
- **"H1: zero spread never gives a zero-width range at any K from 5, for gains and losses."**
  - K ∈ {5, 6, 9, 10, 30, 200} × r ∈ {+0.02, −0.02, 0}: `perTrade` and `pace30` both have high − low > 1e-4.
- **"H1: the ranking floor is 10 bets and the display floor stays 5".**
  - K = 9, narrow: `perTrade` present, tier thin, weight 0.
  - K = 10, the same per-trade results: weight > 0.
  - A K = 5 record with 5,000 overlapping trades: weight 0 (never a count of trades).

**Moved expectations** (count unchanged; each gets stronger, not weaker):
- `confidence.test.ts` "hand-computed interval": same fixture.
  - The expected half-width becomes `2.262 · √max(10/9·0.004, (5·0.01²·50 + 10·0.004)/14) / 10`, so it hand-checks
    both terms of the floor.
- `confidence.test.ts` "zero spread collapses to the point estimate" is renamed **"zero spread never prints a
  zero-width range (ruling H1 floor)"**.
  - Same fixture (10 × +5%, 5-day holds).
  - It asserts the hand-computed floor interval `m ± 2.262·√(5·0.01²·50/14)/10`, with m = ln 1.05, to 1e-9.
  - It asserts pace high − low > 0.001.
  - Direction is still `positive`, and the pace is finite.
  - This flips a pinned behavior on purpose. TR-9's Tests Must reads "zero spread (no division by zero)" and still
    holds; the collapse was an artifact, not a requirement.

**Restored to main** (byte-identical to `0666990`):
- the two `section.test.ts` fixtures the engineer moved from record(6/9/9) to record(4/2/4/4). Under the ranking floor
  they weigh 0 again, as the tests intend.

**Verify:**
- `npm test` with a database: 0 fail;
- `feed.reach.test.ts` unchanged (`git diff 0666990 -- lib/feed.reach.test.ts` empty);
- `LOAD=1` sync and feed load tests pass (`lib/trades.ts` changed);
- e2e full run;
- the three H1 tests fail on HEAD and pass after the change (commit tests first, as before).

## 4. B1 and C3

- **B1 is a real bug.** `sectionPool` drops `tier`, and the C3 unit test bypassed it. As built, C3 was dead code. Had C3
  stayed, the fix would be one spread (`...(f.tier === undefined ? {} : { tier: f.tier })`) plus a test through
  `sectionPool` or `feedList`.
- **But C3 is withdrawn.** It existed only because the 5-bet floor gave 5 to 9-bet newcomers weight, so "weight 0" no
  longer meant "newest record". Under the ranking floor those records weigh 0 again, and the slot finds them as on main.
  - Keeping C3 would quietly widen the F-2 slot to thin records with 10 to 29 bets, which nobody decided.
  - It would also keep this PR on the same line of `newRecordSlot` that F-2 PR-4 edits.
- **The deletion:**
  - `lib/discovery/section.ts` and `lib/feed.ts` go back to `0666990` (the `tier` field, the C3 comment and the
    condition all go);
  - the "F-4 C3 new-record slot" test is removed (it was added in this PR, never on main);
  - B1 is resolved by deletion.
- **Withdrawn with it:**
  - my committee §1 ruling (restate the reach assertion and add two per-seed assertions), because the original
    assertion passes unchanged;
  - committee demand 6 (merge F-2 PR-4 first), provided `git diff --name-only 0666990` no longer lists
    `lib/discovery/section.ts` or `lib/feed.ts`. The orchestrator checks this. The per-seed assertions can go to an F-2
    follow-up if wanted.

## 5. M3: the width rule in simple points

**Ruling: keep the owner's rule as worded** ("±10 points per trade", simple points, as the reader sees the range). No
code change.

- The asymmetry comes from mixing a display threshold that readers see in simple points with log-space statistics. No
  single mirror makes both symmetric: under the simple mirror the weight was never symmetric; under the log mirror the
  width isn't.
- The rule is already sign-blind on the range shown: (low, high) and (−high, −low) have the same half-width.
- After this ruling the band the tester found (6 bets, log spread 0.065 to 0.09) weighs 0 on both sides (K < 10). The
  split now needs ≥ 10 bets averaging about ±25% a trade. It is rare, and it favors showing losses, which is the safe
  direction for trust.
- **Test to add:** `tooWide({low, high}) === tooWide({low: −high, high: −low})` for a sweep of intervals.
- **L1 may ride along** as a one-token fix: `(iv.high − iv.low) / 2 > TOO_WIDE + 1e-9`, with the boundary test extended
  to {0.7, 0.9} and {0.1, 0.3}.
- **L5 (an Infinity weight from ≥ 10 total-loss bets) is out of scope.** It is back to main's reachability.

## 6. Owner involvement

**No owner decision changes.** The floor of 5, the 10-point width, t(K − 1) and the trust lines all hold. The build
proceeds on the defaults above. Two FYIs go to the owner, neither blocking:

1. **DESIGN §5.2 TR-9 steps 2 and 3** state the standard-error formula. The variance floor amends it. The owner edits
   DESIGN, as with the 5-bet amendment.
   - Proposed sentence: "The spread used is never below the sample's, moderated toward 1% per √day held as if 5 bets at
     that spread had been seen, so a small or uniform sample never prints a near-zero range. Rankings count a record
     from 10 independent bets."
   - Default if the owner says nothing: as ruled.
2. **What remains of the TR-9 Ranking Must.** "Small lucky samples can't top it" now holds outright below 10 bets.
   From 10 bets it holds only in probability: about 2% of no-edge 10-bet records with one-day holds outrank a strong
   150-bet record, the same as on main. Only the population-shrunk estimate F-4 calls "the later upgrade" closes this.
   - Recommendation: schedule it as its own PR after F-4.
   - Default: not scheduled until the owner says so.

**M3:** the owner may say that "10 points" should be read in log terms. Default: simple points, as worded.

## 7. Demands (priority order)

1. **Engineer, blocking:** apply §1 exactly (two constants, one `spread` helper used by both SEs, the `c.k >=
   RANK_MIN_BETS` guard). Commit the §3 tests first, failing; then the code. Verify as in §3.
2. **Engineer, blocking:** delete C3 per §4, with `section.ts`, `feed.ts` and the two `section.test.ts` fixtures
   byte-identical to `0666990`. Verify with `git diff 0666990 -- lib/discovery lib/feed.ts lib/feed.reach.test.ts`,
   which should show only the removed C3 test.
3. **Engineer:**
   - the comments on `evidenceWeight` and `confidence` cite this ruling;
   - the build log's "Weight" line reads "ranking unchanged from main for 5 to 9 bets";
   - the log reports the measured table in §2 from the real build.
4. **Engineer:** the M3 symmetry test; L1 if taken.
5. **Tester, next round:**
   - re-run `lucky.ts` through `feedList()`: lucky is not card 1, and the 40- and 150-bet records precede it;
   - `/u/tsf4p1_zerovar` shows a non-zero range at 375 px;
   - add the check that every unit test of a feed rule goes through `sectionPool` or `feedList` at least once, because
     B1 hid behind hand-built rows.
6. **Committee demands 2, 3, 4, 5 and 7 stand.** Demands 1 and 6 are withdrawn per §4.

## 8. Demo sentence

"Five bets and you see an honest range, never a fake-precise one; ten before a record competes for the top of the
feed, losses ranked exactly like gains."

## 9. What would change my mind

- **The owner wants 5 to 9-bet records to compete on weight.** Then shrinkage moves forward into F-4, not a higher
  variance floor.
- **Real data (once traders connect) shows a calm 10 to 20-bet record often at card 1.** The test: print the top 10
  weights by K weekly from `feedList()`. If any K < 20 record holds card 1 for more than 2 days in a fortnight,
  shrinkage is scheduled immediately.
- **The variance floor binds on many real 30+ bet records** (sample spread under 1%/√day). The test: count how often
  the floor term is the max in `confidence()` across the fleet, from one script run on production data after launch.
  More than 5% means the floor is too high for this population.
