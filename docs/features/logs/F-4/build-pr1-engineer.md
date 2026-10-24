# F-4 PR-1: TR-9 floor and width (engineer build log)

2026-10-24. Built to `plan.md` PR-1, with the business lead's C3 (`plan-signoff-business-lead.md`) and the UX lead's
acceptance of the `tooEarlyText` wording (`plan-signoff-ux-lead.md` §5). The owner's decisions are in
`docs/features/F-4-share-card.md` (2026-10-22: floor of 5 independent bets, half-width threshold of 10 points, t with
K − 1 degrees of freedom). No schema change, no dependency, no protected path, no change to package files, CI or
CODEOWNERS. The UX lead's changes 1 to 7 are for PR 2 and PR 3; none applies here.

Commits: `2b62322` the rename (identifiers only), `9e9ef01` the tests (failing), `f0108d4` the code.

## What it does

- **Floor and width (`lib/trades.ts`).** `MIN_BETS = 5`, `TOO_WIDE = 0.10` and `tooWide(iv)` (half-width
  `(high − low) / 2 > 0.10`; exactly 10 points is not too wide). `confidence()`:
  - K < 5: too early, no intervals (as before, at the new floor).
  - K ≥ 5 and a per-trade half-width over 10 points: tier `too-early`, **both intervals kept**, direction `null`.
  - Otherwise thin, moderate or strong by the unchanged K and span rules.
- **Weight.** `evidenceWeight` is 0 for any too-early record, including one too early by width that keeps its intervals.
  Ranking changes only for records with 5 to 9 bets and a narrow range.
- **One "too early" sentence.** `tooEarlyText(c)`, used by `evidenceLine` and by every page that printed "of 10 bets":
  `app/t/[symbol]/page.tsx` (2 sites; the second's `c.k < 10` is now `c.tier === 'too-early'`), `HoldTime.tsx`,
  `Concentration.tsx`, `app/t/compare/page.tsx`. It reads:
  - "Too early to tell (4 of 5 bets)";
  - "Too early to tell: 2,828 trades in 3 overlapping positions (5 independent bets needed)";
  - too early by width: "Too early to tell: the range is still too wide (12 bets, 40 days)", so no page reads "12 of 5
    bets".
- **The range from 5 bets.** `rangeText` already prints whenever `perTrade` exists, so the profile, ticker, compare,
  share and recap surfaces show the range from 5 bets, and keep it when the record is too early by width.
- **Rename (IMPLEMENTATION conflict 9).** `Edge` → `Direction`, `edge` → `direction`, `edgeText` → `directionText`,
  in its own commit. No user-visible string changed (none said "edge").
- **C3, the new-record slot (`lib/discovery/section.ts`, `lib/feed.ts`).** `TraderFacts` gains `tier`, set in
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

## For the committee: `lib/feed.reach.test.ts` still fails (root cause, no edit)

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
