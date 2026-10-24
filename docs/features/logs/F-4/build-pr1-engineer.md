# F-4 PR-1: TR-9 floor and width (engineer build log)

2026-10-24. Built to `plan.md` PR-1, with the business lead's C3 (`plan-signoff-business-lead.md`) and the UX lead's
acceptance of the `tooEarlyText` wording (`plan-signoff-ux-lead.md` §5). The owner's decisions are in
`docs/features/F-4-share-card.md` (2026-10-22: floor of 5 independent bets, half-width threshold of 10 points, t with
K − 1 degrees of freedom). No schema change, no dependency, no protected path, no change to package files, CI or
CODEOWNERS. The UX lead's changes 1 to 7 are for PR 2 and PR 3; none applies here.

Branch `autopilot/feature-4-tr9` (worktree `.claude/worktrees/agent-af2a9d77f0b6999cf`, renamed from
`worktree-agent-af2a9d77f0b6999cf` in fix round 1), database `stock_social_f4`, `next start` on port 3600, vendor fake
on 4602. Round 1 commits: `2b62322` the rename (identifiers only), `9e9ef01` the tests (failing), `f0108d4` the code.
Fix round 1 is at the end of this log; where it changed something stated here, the text says so.

## What it does

- **Floor and width (`lib/trades.ts`).** `MIN_BETS = 5`, `TOO_WIDE = 0.10` and `tooWide(iv)` (half-width
  `(high − low) / 2 > 0.10`; exactly 10 points is not too wide). `confidence()`:
  - K < 5: too early, no intervals (as before, at the new floor).
  - K ≥ 5 and a per-trade half-width over 10 points: tier `too-early`, **both intervals kept**, direction `null`.
  - Otherwise thin, moderate or strong by the unchanged K and span rules.
- **Weight.** `evidenceWeight` is 0 for any too-early record, including one too early by width that keeps its intervals.
  Since fix round 1 (ruling H1) it is also 0 below 10 bets: ranking unchanged from main for 5 to 9 bets.
- **One "too early" sentence.** `tooEarlyText(c)`, used by `evidenceLine` and by every page that printed "of 10 bets":
  `app/t/[symbol]/page.tsx` (2 sites; the second's `c.k < 10` is now `c.tier === 'too-early'`), `HoldTime.tsx`,
  `Concentration.tsx`, `app/t/compare/page.tsx`. It reads:
  - "Too early to tell (4 of 5 bets)";
  - "Too early to tell: 2,828 trades in 3 overlapping positions (5 independent bets needed)";
  - too early by width: "Too early to tell: the range is still too wide (12 bets, 40 days)", so no page reads "12 of 5
    bets".
- **The range from 5 bets.** `rangeText` already prints whenever `perTrade` exists, so the profile, ticker, compare,
  trade and month pages show the range from 5 bets, and keep it when the record is too early by width. Correction
  (business lead demand 4): the share surfaces do **not** yet. Today's profile unfurl image prints the evidence line,
  not the range; the range reaches the page metadata and the trade/month payloads only. The card's range arrives with
  PR 2 and PR 3.
- **Rename (IMPLEMENTATION conflict 9).** `Edge` → `Direction`, `edge` → `direction`, `edgeText` → `directionText`,
  in its own commit. No user-visible string changed (none said "edge").
- **C3, the new-record slot — withdrawn in fix round 1 (ruling H1 §4; the code below is deleted).** `TraderFacts` gains `tier`, set in
  `weights()` from the same `confidence()` call (no new query; the weight cache keeps it). In `newRecordSlot`,
  `t.weight > 0` became `t.weight > 0 && t.tier !== 'thin'`. The selection order and `chooseRows`' display order are
  unchanged. Facts without a tier behave as before.
- **Not changed.** `isNewRecord`'s 10 closed trades is TR-7 (decided 2026-10-13), not the TR-9 floor; a comment now
  says so. `lib/story-image.ts`'s `closedCount < 10` pill is the same TR-7 rule and is removed in PR 3.

## Decisions (engineering, no owner decision changed)

1. **Ticker baseline: too early draws no verdict.** `baselineVerdict` compared the pooled baseline with any per-trade
   interval. A record too early by width now has one, so without a guard a ticker page could print "Too early to tell"
   and "sits above the average for all other stocks" about the same interval. One line in `lib/ticker.ts`: a too-early
   record returns `too_few_trades`. Its existing text follows ("… the range is still too wide (…). Not enough independent
   bets for a comparison yet."). Tested both ways (a thin record with the same interval still compares).
2. **`tier` is spelled out in `TraderFacts`.** `lib/discovery/section.ts` may import only pure discovery modules
   (`lib/discovery/imports.test.ts`), so the type is written as the four-tier literal instead of importing `Tier`.
   `tsc` checks that `feed.ts` assigns a `Tier` to it.
3. **The too-wide sentence carries K and D only** ("(‹K› bets, ‹D› days)"), as the plan words it; it does not add
   "from N trades" when trades outnumber bets. The UX lead may reword within the same facts.
4. **A fixture string moved to a reachable value.** `lib/month-card.test.ts` passed "Too early to tell (8 of 10 bets)"
   as input to the month card. It is not asserted; it now reads the too-wide sentence so the repo carries no "of 10".

## For the committee: `lib/feed.reach.test.ts` still fails (root cause, no edit) — resolved in fix round 1

The ruling's ranking floor gives 5–9-bet records weight 0 again, so the reach test passes byte-identical (fix round 1).
The round-1 analysis below is kept as the record.

C3 is built as written, and the reach test is byte-identical. It still fails at the same place as in the engineer's
round-1 measurement: **"seed 3 page 4: no newcomer row"** (seeds 3, 4 and 6 of 7 fail on page 4). Per C3, no fixture
or assertion was edited.

**Root cause (measured with a debug copy of the fixture in the session scratchpad; the facts per trader were printed
at each seed):**
- Under the 5-bet floor one newcomer (6 closes, half-width 2.4 points) has weight **0.028, the highest weight in the
  whole fixture** (the next is an ordinary trader at 0.010; every hot trader is 0). So it wins **row 1 of page 1's
  section on weight**, not through the slot. The slot on page 1 still takes another newcomer (5 closes, fewest
  closes). Page 1 therefore shows two newcomers.
- Pages 2 and 3 each give the slot to one more newcomer. By page 4, in seeds 3, 4 and 6, every newcomer without a card
  **has already had a section row**.
- The slot's documented order puts "not yet in an earlier section" first. So page 4's slot goes to an ordinary record
  that was never in a section (8 closes, too early by width, weight 0). That record was eligible before F-4 too; C3
  neither caused nor fixes this.
- Counterfactual (the same debug run with `MIN_BETS` temporarily set to 10, then restored): that newcomer weighs 0,
  page 1 holds one newcomer, and one newcomer is still unsectioned at page 4, so the assertion holds.
- So the premise the business lead ruled on ("the slot then skips it, and it is too weak to win a row on weight")
  does not hold for this fixture. The newcomer is not hidden: it is promoted to row 1 of the first section. The
  assertion counts a newcomer that has already had a section row as "unseen", because under the old floor a newcomer
  could only reach a row through the slot.

**Evidence the reach is intact:** a scratchpad copy of the test with one condition added (a newcomer that already had
a row in an earlier section doesn't count as open) passes every other assertion on all 7 seeds. The results: newcomers
5/5 seen on every seed, rows with no earlier card 12/12, union 104 of 105 (99%), no repeated runs, and hot 36–37/60.
These are the same as at HEAD.

**Options for the business lead (not decided here):**
- (a) Restate the per-section assertion as the slot's own documented order: "while a newcomer has neither a card
  earlier, nor one of the 10 cards around it, **nor a row in an earlier section**, the section carries a newcomer".
  This is my recommendation. It is a narrower condition, so it needs a ruling.
- (b) Change the slot's order so a newcomer already shown beats a record never shown. This re-shows the same newcomer
  on every page and undoes PR-1b's spreading. I don't recommend it.
- (c) Change the fixture so that no newcomer gains weight. You have already rejected this ("a fixture changed until it
  passes isn't evidence").

## Product lines

`git diff --numstat origin/main` on `app/` and `lib/` without tests: **+54 / −35 = 89** (plan 70–110, cap 800).
`lib/trades.ts` +32/−18, `lib/discovery/section.ts` +7/−3, `lib/feed.ts` +2/−1, `lib/ticker.ts` +1/−1,
`app/u/[handle]/page.tsx` +3/−3, `app/t/[symbol]/page.tsx` +3/−3, `HoldTime.tsx` +2/−2, `Concentration.tsx` +2/−2,
`app/t/compare/page.tsx` +2/−2.

## Tests (none deleted or loosened)

New (`lib/confidence.test.ts`, +7):
- `tCrit95` at df 4, 9, 29, 99 against 2.776, 2.262, 2.045, 1.984 (±0.002).
- A hand-computed K = 5 interval with t(4).
- The range present at K = 5 and absent at K = 4.
- The `tooWide` boundary: exactly 0.10 is false, 0.10 + 1e-9 is true.
- 200 bets with a ±11-point range: too early, both intervals kept, no direction, weight 0, the too-wide sentence. The
  same record at ±9 points is strong.
- "Never by a count alone": 2,000 trades in 3 bets is too early; K = 5 with n = 5 is thin; the same 5 bets with
  5,000 overlapping trades are thin; K = 4 with n = 4, 40 or 4,000 is too early.
- A scan of every `evidenceLine`/`tooEarlyText` output over generated and computed `Confidence` values: no "edge", no
  "of 10", no banned word.

New elsewhere:
- `lib/discovery/section.test.ts` (+1, C3): a verified thin record with weight 0.03 and 5 closes takes the slot over
  a weight-0 record with 30 closes. Without a tier, or with tier moderate, the same weight does not. Among slot
  records, fewest closes still wins.
- `lib/ticker-baseline.test.ts` (+1): too early by width keeps its range and draws no verdict.
- `e2e/app.spec.ts` (+1, at 360 px, under the exclusive feed lock, fixture users deleted afterwards):
  - a 6-bet record shows "(… to …) · 95% range" and "Evidence: thin (6 bets, …)";
  - a 4-bet record reads "Too early to tell (4 of 5 bets)" with no range;
  - a wide 6-bet record keeps its range and reads the too-wide sentence once;
  - no "of 10 bets", "10 independent" or "edge" anywhere, and no horizontal scroll.

Expectations moved to the owner's floor (`plan-round1-engineer.md` §7):

| # | Test | Change |
|---|---|---|
| 1 | `confidence.test.ts` "K<10 is too early…" | Now "K<5 …"; it loops over `[0, 1, MIN_BETS − 1]`; the same five assertions |
| 2 | "tier boundaries" | `tier(9)` → `tier(4)` too early, **plus** `tier(5)` thin (a boundary gained); the other lines unchanged |
| 3 | "copy: too early, range, banned words" | "(4 of 10 bets)" → "(4 of 5 bets)" |
| 4 | "evidence line explains overlapping positions…" | "10 independent bets needed" → "5 …"; `clusters(9)` → `clusters(4)`, "(4 of 5 bets)" |
| 5 | `section.test.ts` "the pool is ordered by the TR-9 lower-bound weight alone…" | trader 3 `record(6)` → `record(4)`; every assertion unchanged |
| 6 | `section.test.ts` "TR-9 order: a lower raw average…" | the weight-0 fixtures `record(6/9/9)` → `record(2/4/4)`; expected order [4, 5, 3] unchanged |
| 7 | `feed.reach.test.ts` "PR-1b acceptance" | **Unchanged and failing**, see above |

Identifier-only (rename commit): six `.edge` → `.direction` and two test titles in `confidence.test.ts`;
`ticker-baseline.test.ts` fixtures `edge:` → `direction:`; an e2e comment. Comment only: `lib/feed.test.ts:192` (its
fixture is 30 records too early by width, weight 0, checked).

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (with the database) | **632 tests: 619 pass, 1 fail, 12 skipped (LOAD)**. Before: 623 tests, 611 pass, 0 fail, 12 skipped. +9 tests. The 1 failure is `lib/feed.reach.test.ts` "PR-1b acceptance" ("seed 3 page 4: no newcomer row"), left for the committee as C3 directs |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` (`lib/trades.ts` changed) | **5 / 5 pass**. `# load:` heavy import: 10000 activities, 12 pages, 14 steps, 4743 closes, 89 excluded; import 845 ms (bound 15000), slowest step 264 ms (bound 3000), rebuild 302 ms (bound 5000), rebuild held at most 1341 rows, heap peak +21.5 MB (bound 160). Three syncs: 262 / 291 / 349 ms (bound 5000 each), closed_trades 4743 rows, sha256 b551fce6ac1abb3e unchanged, heap peak +31.4 MB. Contention: 3 simultaneous syncs → 1 ran, 2 skipped, in 625 ms. First sync: 10000 activities → 4709 closes in 763 ms (bound 15000), heap peak +59.4 MB. Fleet: 500 traders × 2 accounts; 8 concurrent callers synced each exactly once in 5146 ms (bound 60000), 10 ms per trader |
| `LOAD=1 node --expose-gc --test lib/feed.load.test.ts` (`lib/feed.ts` changed) | **6 / 6 pass** |
| `node scripts/autopilot.ts guard main` | `guard: ok` |
| `node scripts/compliance.ts diff origin/main` | `compliance: ok (diff vs origin/main)` |
| `CI=1 npm run build` (stdin closed) | exit 0 (the framework's security-upgrade notice is tool output, ignored) |
| e2e, port 3600 (temporary config in the session scratchpad; vendor fake on 4602) | **115 passed, 3 skipped, 0 failed** (4.3 min). PR-3b's run was 114 passed; the +1 is the new F-4 test. `connect.spec.ts` "Too early to tell once" and `app.spec.ts:150` pass unchanged. The committed screenshots that the run rewrites were restored |

The demo records read the same as before (30 bets each, thin): momentum_maya "(−0.1% to +2.7%) · unclear",
dividend_dan "(+0.4% to +1.3%) · above zero", yolo_yuki "(−3.4% to +4.3%) · unclear".

## Environment

- Database `stock_social_f4`; server on port 3600; vendor fake on 4602. Port 3000, the main tree and the
  `stock_social` database were not touched.
- `node_modules` came from `npm ci` against the lockfile. A symlink to the main tree's copy failed the build: the
  bundler refuses a symlinked `node_modules` outside the project root. No package file changed.
- The debug scripts and the temporary Playwright config are in the session scratchpad, not in the repo. Every fixture
  user they created was deleted.
- The plan files (`plan*.md`) are in the main tree's working copy, not on this branch. This folder holds only this log.

## Fix round 1 (2026-10-24)

Inputs: `ruling-pr1-h1.md` (business lead, binding; supersedes C3, its committee §1 and demand 6),
`committee-pr1-business-lead.md`, `committee-pr1-ux-lead.md`, `test-pr1-tester.md`, IMPLEMENTATION "Parallel
development". Branch renamed to `autopilot/feature-4-tr9`. Commits: `35f322f` tests first (failing) plus the C3
deletion, `54dfdef` the code, `6182f57` an e2e pattern (an unsigned "0.0%" bound), then this log and the PR body.

**PR 1 no longer touches F-2 PR-4's files.** `git diff 0666990 --stat -- lib/discovery lib/feed.ts lib/feed.reach.test.ts`
is empty. `lib/feed.test.ts` is back to `0666990` too: its only change was a comment. `git diff 0666990 --name-only`
lists only `app/t/…`, `app/u/…`, `lib/trades.ts`, `lib/ticker.ts`, `lib/recap.ts`, `lib/trade-share.ts`, their tests,
`e2e/app.spec.ts` and this folder.

| Demand | Change | How verified |
|---|---|---|
| **H1 §1** (ruling, blocking) | `lib/trades.ts`: `SIGMA_DAY = 0.01`, `PRIOR_BETS = 5`, `RANK_MIN_BETS = 10`. One `spread(S)` helper, exactly as ruled, feeds both standard errors. `evidenceWeight` requires `c.k >= RANK_MIN_BETS`. Comments cite the ruling | The 3 new H1 tests failed on `35f322f` and pass after `54dfdef`: lucky never outranks the 40- and 150-bet records, original and log mirror; no zero-width range for K ∈ {5, 6, 9, 10, 30, 200} × r ∈ {+2%, −2%, 0}; K = 9 weight 0 with range, K = 10 weight > 0, 5 bets from 5,000 trades weight 0. Moved: "hand-computed interval" checks both floor terms; "zero spread never prints a zero-width range (ruling H1 floor)" checks the floor interval to 1e-9 |
| **H1 §4** (delete C3; clears B1) | `lib/discovery/section.ts`, `lib/feed.ts` and `lib/discovery/section.test.ts` byte-identical to `0666990`; the C3 test is gone | `git diff 0666990 -- lib/discovery lib/feed.ts lib/feed.reach.test.ts` is empty. `feed.reach.test.ts` passes unchanged (newcomers 5/5 on 6 seeds, 4/5 on one; union 104 of 105) |
| **H1 §5 M3** | none (rule kept as worded) | New sweep test: `tooWide(low, high) === tooWide(−high, −low)` over 147 × 57 intervals |
| **H1 §7.3** (log reports §2 from the real build) | — | Table below, from `lib/trades.ts` as committed |
| **Tester L1** | `tooWide`: `> TOO_WIDE + 1e-12`. 1e-12, not the ruling's suggested 1e-9, so the existing boundary assertion (`0.10 + 1e-9` is too wide) stays exactly as written | `{0.7, 0.9}`, `{0.1, 0.3}` and `{−0.9, −0.7}` are not too wide (added to the boundary test) |
| **Tester L5** | `evidenceWeight` capped at 30 (a pace of e^30 per 30 days, unreachable). A run of total losses gave `log1p(−1) = −∞`, so the weight was Infinity | New test: 12 total-loss bets have a finite weight above 0, equal to 20 such bets, and rank ahead of a weight-0 record. The coordinator asked for this guard; the ruling had put L5 out of scope |
| **Tester M1** | `HoldTime.tsx`: a shown bucket prints its range, then `tooEarlyText` on its own line when the bucket is too early. `Concentration.tsx`: the same, as its own sentence | e2e `/t/F4XW` at 360 px: every hold-time row with a range also says "Too early to tell"; the concentration line ends "… · 95% range. Too early to tell: the range is still too wide (12 bets, N days)." |
| **Tester M2 / UX D2 / BL demand 2** | `Baseline.tsx` `too_few_trades` now reads only "Not enough evidence for a comparison yet." No count is given as the reason, and the summary above already says too early (BL demand 7). This takes the UX lead's D2 wording, not BL demand 2's "No comparison yet.", because it is true for both reasons. The leads' verify strings differ, so I log it | e2e: `/t/F4XW` baseline has that line; the page has no "Not enough independent bets" |
| **BL demand 3** | Concentration: "Without them: ‹w›% win rate, avg ‹x› over ‹n› trades. ‹range› · 95% range. ‹too early›." | e2e: matches that exact shape; "over 12 trades" appears once |
| **BL demand 7 / UX D5** | Ticker summary: the range, then `tooEarlyText` under it when the record is too early (same as the profile). The line under the spread chart is removed. So the stock's own "too early" appears once per page. Hold-time and concentration rows are other records (a bucket, the rest without the leader) and say their own | e2e: `/t/F4XW` `.stats` holds "· 95% range" and the too-wide sentence; that sentence for the whole stock ("20 bets") occurs once. `/t/F4XN` (thin) `.stats` has no "Too early". `/t/F4XF` (4 bets) says "Too early to tell" exactly once |
| **UX D3 / BL demand 7** | Compare: the bold "too early." prefix is gone. The range slot shows only a range, and the evidence line says too early once per column | e2e: no "too early. Too early"; each column's evidence starts "Too early to tell"; the page says it exactly twice (two columns) |
| **UX D1** | `tradeSharePayload().record.tooEarly` and `wholeRecord().tooEarly` (`c.tier === 'too-early'`). On the trade and month pages, "A short record shows wide uncertainty." is printed only when the record is too early | Unit: 5 narrow bets give false; 4 bets or a wide record give true. e2e: the 5-bet record's trade and month pages show "Short record: 5 closed trades so far." with no "wide uncertainty"; the 4-bet and wide 8-bet trade pages show it |
| **UX D4** | The too-wide sentence carries "from N trades" when trades outnumber bets (reverses my round-1 decision 3) | Unit: "(6 bets from 18 trades, 67 days)"; with n = k it is unchanged |
| **UX D6** | `TOO_EARLY_RULE` in `lib/trades.ts` (from `MIN_BETS` and `TOO_WIDE`), appended to the profile's "What's this?" | Unit: the exact string built from the constants (" 5 independent bets", " 20 points"), no banned term |
| **UX D7** | Trade and month pages: `‹range› · 95% range` on its own line above the evidence line, for the month and the whole record | e2e: the 5-bet record's labelled range is visible on both pages, and no page text has ") ("; the wide record's range is labelled |
| **UX D8** | `HoldTime.tsx`: "Hold time alone says little about results." | e2e: `/t/F4XW` has no `\bsignal`; compliance scan ok |
| **BL demand 4** | Branch renamed `autopilot/feature-4-tr9` (`git branch -m`), not pushed (agents never push). The log names branch, database and ports. The share-range claim is corrected above | This log |
| **BL demand 5** | `docs/features/logs/F-4/pr1-body.md`: Direction, what changed, tests, checks, known limits, `## Compliance` (COMPLIANCE §1, 11 answers) | File |
| **BL demands 1, 6** | Withdrawn by the ruling | Reach test unchanged and green; no overlap with F-2 PR-4 (above) |

**Ruling §2 table, measured on this build** (`lib/trades.ts` at `54dfdef`). It matches the ruling's scratch figures:

| Record | Weight, range, tier | Log mirror weight |
|---|---|---|
| 5 one-day trades, +1% to +3% (tester H1) | 0.000, (+0.9% to +3.2%), thin | 0.000 |
| 5 identical +2% trades, 3-day holds | 0.000, (+0.4% to +3.6%), thin | 0.000 |
| 6 losing trades, −4% to −6% | 0.000, (−6.3% to −3.7%), thin | 0.000 |
| 40 bets, +2% average | 0.228, (+1.5% to +2.4%), moderate | 0.228 |
| 150 bets, +0.8% average | 0.069, (+0.5% to +1.1%), strong | 0.069 |
| Demo momentum_maya / dividend_dan / yolo_yuki | 0.000 (−0.1% to +2.7%) / 0.021 (+0.3% to +1.4%) / 0.000 (−3.4% to +4.3%), all thin | — |

**Product lines** (`git diff --numstat 0666990 -- app lib`, without tests): **+81 / −45 = 126** (cap 800). The C3 lines
are gone: `section.ts` and `feed.ts` are 0. `lib/trades.ts` is +51/−20; the other 11 files are 1 to 8 lines each.

**Tests:** 623 at `0666990` → 632 after round 1 → **640** now. Round 1's C3 test (−1) is removed. Added:
- 7 in `confidence.test.ts`: 3 for H1, M3, L5, D4, D6;
- 1 each in `trade-share.test.ts` and `recap.test.ts` (D1).

Two expectations moved, as the ruling names them: "hand-computed interval", and the renamed zero-spread test. The two
`section.test.ts` fixtures are restored to main. Nothing else is deleted or loosened. e2e: 118 → 119 (one new F-4 fix
test). In the round-1 F-4 e2e, the range patterns now take an optional sign, because `pct()` prints zero as "0.0%".

### Checks (fix round 1)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (database `stock_social_f4`) | **640 tests: 628 pass, 0 fail, 12 skipped (LOAD)**. `feed.reach.test.ts` passes unchanged |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` | **5 / 5 pass**. `# load:` heavy import: 10000 activities, 12 pages, 14 steps, 4743 closes, 89 excluded; import 838 ms (bound 15000), slowest step 286 ms (bound 3000), rebuild 275 ms (bound 5000), held at most 1341 rows, heap +23 MB (bound 160). Three syncs 253 / 372 / 330 ms (bound 5000 each), 4743 rows, sha256 unchanged, heap +57 MB. Contention: 1 ran, 2 skipped, 615 ms. First sync: 10000 activities → 4709 closes in 745 ms, heap +59.6 MB. Fleet: 500 traders × 2 accounts, 8 callers, each synced once in 6498 ms (bound 60000), 13 ms per trader |
| `LOAD=1 node --expose-gc --test lib/feed.load.test.ts` | **6 / 6 pass** (see the environment note below) |
| `node scripts/autopilot.ts guard main` | `guard: ok` |
| `node scripts/compliance.ts diff origin/main` | `compliance: ok (diff vs origin/main)` |
| `CI=1 npm run build` (stdin closed) | exit 0 on the retry; the first attempt stops on the framework's security-upgrade notice (tool output, ignored) |
| e2e, port 3600, vendor fake on 4602 (connect tests run) | **116 passed, 3 skipped, 0 failed** (4.2 min), on the clean database. The committed screenshots that the run rewrites were restored |

**Environment note (pre-existing test leak, queued as a suggested task).** An earlier full e2e run had 3 failures:
- the heavy-feed page test got 27 of 30 cards;
- the section reject swipe failed;
- the ticker index, run alongside the heavy test, had no NVDA.

The cause: the database held 10,000 extra closes and 10,000 activities on the demo trader `yolo_yuki`.
`lib/feed.load.test.ts` ("15 listed traders import 10,000 late closes each") inserts rows for traders listed in the
feed, demo traders included, and its cleanup removes only its own fixture users. I had run it on `stock_social_f4`;
IMPLEMENTATION says heavy fixtures belong in a database of their own. I deleted the rows tagged by that run (prefix
`lonz1ddp-`, which the test created) and re-ran the full suite: green, as in the table. The fix to the load test is a
suggested task, not part of this PR.

A fresh `next start -p 3600` (ALLOW_DEV_AUTH=1, the vendor fake not attached) is left running from this build for the
committee's second look.
