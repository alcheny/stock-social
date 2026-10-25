# F-4 PR-1: TR-9 floor of 5 bets and the 10-point width (tester log)

2026-10-24. Build under test: branch `worktree-agent-af2a9d77f0b6999cf`, `0666990..2da6953` (rename `2b62322`, tests
`9e9ef01`, code `f0108d4`, log `2da6953`). Spec: `plan.md` PR-1, `plan-signoff-business-lead.md` (C1 to C7; C3 applies
here), `plan-signoff-ux-lead.md` §5, owner decisions in `docs/features/F-4-share-card.md` (2026-10-22). No product code
was changed. Fixture users (`tsf4p1_*`) were deleted and the separate database `stock_social_f4_test` was dropped.

**Verdict: not ready to merge.** There is one blocker (B1: the business lead's C3 ruling has no effect in the served
feed) and one high finding for the business lead (H1). Everything else in criteria 2 and 3 conforms.

## Findings

### Blocker

**B1 (bug). C3 is dead code in production: `sectionPool` drops `tier`, so a thin record with weight > 0 can never take
the new-record slot.**
- `lib/feed.ts#weights` sets `tier` on `TraderFacts`. But `lib/discovery/section.ts#sectionPool` (line 41) builds each
  `SectionTrader` from `weight, hold, n, verified` only. `tier` never reaches `newRecordSlot`, so
  `(t.weight > 0 && t.tier !== 'thin')` is the same as the old `t.weight > 0` for every served page.
- The new unit test (`section.test.ts`, "F-4 C3 new-record slot") passes only because it builds `SectionTrader`
  objects by hand (helper `W`) and never goes through `sectionPool`.
- The business lead ruled this a product regression: "the newest records lose visibility exactly when their first
  few trades agree". It is still live.
- Repro:
  1. `node -e` or a scratch `.ts`:
     `sectionPool([{trader:1,score:1}], new Map([[1,{weight:0.03,hold:1,n:5,verified:true,tier:'thin'}]]))`
     returns `[{"trader":1,"score":1,"weight":0.03,"hold":1,"n":5,"verified":true}]`. There is no `tier`.
  2. End to end: seed demo traders, add a 5-bet thin record, call `feedList()`. Every `pool` entry reads
     `tier: undefined`.
- Measured fix direction (scratch copy only, nothing committed): with `tier` copied through `sectionPool` the way
  `verified` is, `section.test.ts` and `feed.test.ts` stay green. `feed.reach.test.ts` still fails at the same place
  ("seed 3 page 4"), so the engineer's root-cause analysis of that test holds on its own. A test is missing: C3
  through `sectionPool` (or `feedList`), not through hand-built rows.

### High

**H1 (spec, for the business lead). At the 5-bet floor, a small lucky or zero-spread sample tops the feed, which TR-9's
Ranking Must says can't happen.**
- DESIGN TR-9 Ranking says the lower-bound sort exists "so small lucky samples can't top it". The `feedList` comment
  says the same. With t(4) = 2.776 the weight formula is applied as specified, but at K = 5 it still lets a few short
  trades outrank long records. Measured with `feedList()` on a seeded copy:

| Record | Bets, span | Evidence weight | Feed position |
|---|---|---|---|
| 5 one-day trades, +1% to +3%, all in the last week | 5, 6 days | **0.305** | **card 1** |
| 40 bets, +2% average | 40, 160 days | 0.228 | card 2 |
| 150 bets, +0.8% average (strong) | 150, 500 days | 0.069 | card 5 |

- Zero spread: 5 trades at exactly +2% print "(+2.0% to +2.0%) · 95% range", tier thin, weight 0.119. That is a
  zero-width 95% range claimed from 5 bets. Before PR 1 the same result needed 10 identical trades.
- Losses are symmetric, so 5 identical losing trades rank the same way.
- This follows from the owner's floor and the existing pace formula, so it needs a decision rather than an
  engineering fix (for example, the planned shrinkage, or a minimum span before weight > 0). The committee should see
  it before merging, because PR 1 changes the feed app-wide.

### Medium

**M1 (spec, criterion 3). Hold-time and concentration rows on ticker pages show a too-wide range with no "too early".**
- `HoldTime.tsx:28` and `Concentration.tsx:27` print the range whenever `rangeText` is non-null. A bucket or "rest"
  that is too early by width therefore reads only "(−27.7% to +32.9%) · 95% range" (or "Without them: … (−33.7% to
  +42.3%) · 95% range over 6 trades."), with no signal that it is too early.
- The profile, the ticker headline (line 154) and the compare column do say it.
- Repro: trader A with 8 TSFQ trades (±35%, 3-day holds) and trader B with 6 TSFQ trades (±30%, 10-day holds). Open
  `/t/TSFQ` at 360 px.
- Before PR 1 these rows read "Too early to tell (k of 10 bets)".

**M2 (usability). The ticker baseline contradicts itself for too early by width.** `/t/TSFQ` reads "Too early to tell:
the range is still too wide (14 bets, 95 days). Not enough independent bets for a comparison yet." The reason is the
width, not the number of bets. The fixed suffix in `Baseline.tsx:39` predates the width rule.

**M3 (spec, symmetry). The width test is in simple-return points, so log-mirrored records split.**
- The repo's mirror convention is the log mirror: `confidence.test.ts` "mirrors tie" uses r and 1/(1+r) − 1, and
  `section.test.ts` does the same. Under it, a winning record can be too early by width (weight 0) while its exact
  mirror is thin with full weight.
- Example: 6 bets, log mean ±0.25, log spread 0.07. The winner (+18.5% to +39.2%) is too early with weight 0. The
  loser (−28.1% to −15.6%) is thin with weight 1.017.
- The band covers log spreads of about 0.065 to 0.09 at 6 bets. Inside it, losses outrank equal-size gains.
- Under the simple mirror (r, −r) the width splits roughly evenly, but the weight was never symmetric there.
- This is the owner's rule as worded ("±10 points"). It goes to the business lead together with H1.

### Low

- **L1 (bug, boundary).** "Exactly 10.0 points is not too early" holds only for some magnitudes, because of
  floating-point error.
  - `tooWide({low:0.7, high:0.9})` is `true` (computed half-width 0.10000000000000003). `{-0.1, 0.1}`, `{-0.05, 0.15}`
    and `{0.1, 0.3}` are `false`.
  - The unit test checks only the symmetric case. A tolerance (or a comparison in rounded basis points) would make the
    stated rule hold everywhere.
- **L2 (usability, pre-existing).** The compare column says it twice: "too early. Too early to tell: the range is still
  too wide (14 bets, 95 days)" (`COMPARE_COPY.tooEarly` plus `evidenceLine`).
- **L3 (interim, PR 3 replaces it).** The story and profile share images show the range for records that are too early
  by width without saying "too early". The story pill "New record, wide uncertainty" is keyed to closed count < 10
  (TR-7). A too-wide record with 10 or more closes carries a range and no caveat until PR 3.
- **L4 (test environment).** In the full e2e run, the heavy-feed test (`app.spec.ts:1005`) got 29 of 30 heavy cards.
  Another member's 14 fixture users with 5 to 9 bets were in the shared database during the exclusive feed lock, and
  under the 5-bet floor they now carry weight. Re-run alone, the test passes (30/30/30). It is not a product bug, but
  the shared-database e2e is now more sensitive to parallel fixtures.
- **L5 (pre-existing, now easier to reach).** Five or more total-loss bets give `evidenceWeight = Infinity`, and the
  record sorts to the top of the weighted group. Before PR 1 this needed 10 bets.

### Known (not fixed, as instructed)

`lib/feed.reach.test.ts` "PR-1b acceptance" fails with "seed 3 page 4: no newcomer row", as the engineer reported. It
still fails with `tier` carried through `sectionPool` (see B1), so it waits on the business lead's ruling among options
(a) to (c).

## Conformance

| Requirement | Result | Evidence |
|---|---|---|
| t with K − 1 df, tested at K = 5, 10, 30, 100 (df 4, 9, 29, 99 = 2.776, 2.262, 2.045, 1.984) | Pass | `tCrit95` gives 2.776, 2.262, 2.045, 1.9842; unit test plus the K = 5 hand-computed interval |
| Range shown from 5 bets, not at 4 | Pass | unit; e2e; `/u/tsf4p1_k5` "(+0.9% to +1.7%) · 95% range"; `/u/tsf4p1_k4` "Too early to tell (4 of 5 bets)", no range |
| Too early when K < 5 | Pass | K = 0, 1, 4 in unit tests; page check |
| Too early when half-width > 10 points; range and pace kept; direction null; weight 0 | Pass | unit (K = 200, ±11 points); `/u/tsf4p1_wide`, `/u/tsf4p1_wideloss` |
| Exactly 10 points is not too early | Pass, with L1 | symmetric case only |
| Never triggered by a count alone | Pass | 5,000 trades in 3 bets: too early by K; 5 bets with n = 5: thin; 20,000 distinct bets: strong (32 ms); 3,000 trades in 3 bets, page reads "(5 independent bets needed)" |
| One `tooEarlyText`; no "of 10" on any page | Pass | all 5 former sites replaced; 15 pages × 360 and 375 px: no "of 10 bets", "10 independent" or "edge" |
| Too-early text on every surface that shows a too-early range | **Fail (M1)** | hold-time and concentration rows |
| `evidenceWeight` 0 for any too-early record | Pass | unit; probe |
| `isNewRecord` keeps TR-7's 10 | Pass | unchanged; comment added |
| Rename `Edge` → `Direction`, identifiers only | Pass | no user-visible string changed |
| C3: thin record may take the new-record slot | **Fail (B1)** | `tier` dropped by `sectionPool` |
| Ticker baseline draws no verdict when too early by width | Pass, with M2 copy | unit; `/t/TSFQ` |
| Losses ranked like gains | Pass, with M3 | existing sign tests; all-losing records read "below zero" with the same prominence |
| All-losing, zero-spread and heavy records | Pass, with H1 and L5 | `/u/tsf4p1_loser`, `_zerovar`, `_heavy` (4,000 bets), `_heavy3` (3,000 trades) render; finite output |
| 360 and 375 px | Pass | 0 px horizontal overflow on all 15 pages at both widths; profile, ticker and compare readable (screenshots in the session scratchpad) |
| Share images | Pass (L3 interim) | profile, story and ticker images return 200 `image/png`, 75 to 113 KB |

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `node scripts/autopilot.ts guard main` | `guard: ok` |
| `node scripts/compliance.ts diff origin/main` | `compliance: ok` |
| `npm test` (on a separate database) | 632 tests: 619 pass, **1 fail** (`feed.reach.test.ts`, known), 12 skipped (LOAD). The count rose from 623 |
| `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` | 5/5 pass (import 786 ms, rebuild 289 ms, fleet 6,623 ms, heap within bounds) |
| `LOAD=1 node --expose-gc --test lib/feed.load.test.ts` | 6/6 pass (page 1 p95 111 to 369 ms; own-late p95 439 ms; every test within its asserted budget) |
| e2e, full suite on :3600 (no webServer) | 85 pass, 1 fail (L4, passes alone), 32 skipped. The :3600 server has no `SNAPTRADE_BASE_URL` in its `.env`, so the vendor-fake tests skip |
| e2e, `connect.spec.ts` on a temporary second server from the same build (:3601, vendor fake on :4702; stopped afterwards) | 35/35 pass, including "Too early to tell once" |
| e2e side effects | the tracked F-2 screenshots the run rewrote were restored with `git checkout` |
