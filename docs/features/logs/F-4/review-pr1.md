# F-4 PR-1 review (independent reviewer, 2026-10-25)

Scope: `git diff 0666990 1b4af5c` on branch `autopilot/feature-4-tr9`. I read the product and test diff line by line
(`-- . ':!docs'`) and the docs this branch adds (`docs/features/logs/F-4/`). I checked it against:
- the owner decisions in `docs/features/F-4-share-card.md`;
- `plan.md` PR-1 (all three sign-offs present; the O1 amendment doesn't touch PR 1);
- the business lead's binding `ruling-pr1-h1.md`;
- CLAUDE.md product rules, `docs/POLICY.md`, COMPLIANCE §1;
- the IMPLEMENTATION reviewer rules.

Where I ran things:
- worktree database `stock_social_f4`;
- the :3600 preview, already running from this worktree (not rebuilt or stopped);
- a Playwright config of my own in the session scratchpad, pointed at :3600 (the repo's config targets :3000, which I
  left alone).

Port 3000, the `stock_social` database and the main checkout were not touched. The e2e fixture users were removed by
the test itself (0 `heavy_feed_*` users left; 94 closes, as before the runs). I edited no file except this one.

## Findings

- **blocking (POLICY T1): third-party names in a committed doc.** `docs/features/logs/F-4/ruling-pr1-h1.md:57-58` cites
  two sources by URL. One link's domain is a private advisory firm's name; the
  other's is a named preprint platform. T1 bans company, product and platform names "in … docs", and only
  integrated vendors are excepted. The prose around the links already describes them generically ("an adviser
  commentary", "a preprint on a large-cap US index"), but the link targets carry the names. No main doc carries an
  external third-party URL (`git grep` over `0666990 -- docs` finds only localhost and `.example` hosts). The compliance
  scan passes only because `MARKS` doesn't list them, and POLICY leaves unlisted marks to the reviewer.
  - Fix (docs only, two lines): drop both links and keep the generic descriptions and figures. For example: "a
    published adviser commentary (18.6% over 93 years, 14.5% over 20 years) and a statistics preprint on a large-cap US
    index (rolling daily volatility mostly 0.5% to 2%)".
  - The business lead or the orchestrator makes the edit. No code, test or re-review of the product diff is needed; I
    re-check only that file.
- **non-blocking, fix in the same pass (PR body accuracy):** `pr1-body.md` → Tests says "Seven expectations moved to
  the owner's floor of 5. Two moved to the ruling's variance floor." That count is from round 1, when the seven included
  the two `section.test.ts` fixtures (now restored to main) and `feed.reach.test.ts` (never edited). The real list at
  `1b4af5c`:
  - **floor of 5:** 4 tests in `confidence.test.ts` (K<5 loop, tier boundaries, copy "(4 of 5 bets)", the overlapping
    line), plus one unasserted input string in `month-card.test.ts`;
  - **variance floor:** 2 tests ("hand-computed interval", and the zero-spread test, renamed);
  - **D9:** 1 assertion in `trades.test.ts` (`(-0.8% to 0.0%)` → `(-0.8% to -0.01%)`), which the body's Tests section
    doesn't mention.

  "None is deleted or loosened" is true (below). Correct the numbers so the human's audit matches the diff.
- **non-blocking: the size estimate was exceeded, within the cap.** The product diff is +85/−46 = **131** lines. The
  plan's estimate was 70–110 and the cap is 800. The extra lines trace to ruling H1 (variance floor, ranking floor) and
  the committee demands (D1, D4, D6, D7, D9, M1, N4), each in a file the plan already named. The body quotes only "cap
  800", which matches the plan. Mentioning the estimate and why it was exceeded would be clearer.
- **non-blocking: owner FYIs carried correctly.**
  - The variance floor changes the standard-error formula DESIGN TR-9 states in steps 2–3 (an owner file), and so the
    demo figure in TR-9's Example: dividend_dan (+0.4% to +1.3%) now prints (+0.3% to +1.4%).
  - No TR-9 **Must** is broken:
    - Display: a range from K ≥ 5, with t(K−1);
    - Copy: no banned word;
    - Ranking: the lower bound, now 0 below 10 bets;
    - Tests: zero spread still has no division by zero.
  - No F-4 owner decision changes. The body's Known limits names the DESIGN edit for the owner.
- **non-blocking: L5 cap.** The ruling put L5 out of scope; the engineer added it at the coordinator's request. The cap
  (`WEIGHT_CAP = 30`) is symmetric, below it no reachable weight moves, and it is tested. The business lead accepted it
  in round 2.
- **non-blocking, follow-up:** `COMPARE_COPY.tooEarly` (`lib/ticker.ts:327`) is now unused by any page; only the
  `compare.test.ts` copy scan reads it. Removing it is a later cleanup.
- **non-blocking: e2e decimals.** The restored e2e range patterns take `\d{1,2}` decimals. These are this PR's own new
  tests, not main's, and D9 makes 2-decimal bounds real output. Every pattern requires the sign again, as at `9e9ef01`.
- **checked, OK: owner decisions.**
  - `MIN_BETS = 5` and `TOO_WIDE = 0.10` (half-width in simple points; exactly 10 points is not too wide, `+1e-12` for
    float noise).
  - t(K−1) is tested against 2.776 / 2.262 / 2.045 / 1.984.
  - The range shows at K = 5, not at K = 4, and is kept when the record is too early by width (direction null,
    weight 0).
  - "Never by a count alone": 2,000 trades in 3 bets is too early; 5 bets is thin whether it holds 5 trades or 5,000;
    K = 4 is too early for any n.
  - `isNewRecord`'s 10 (TR-7) is unchanged, with a comment saying why.
- **checked, OK: ruling H1, applied exactly.**
  - The `spread()` expression matches the ruling character for character and feeds both standard errors.
  - `SIGMA_DAY = 0.01`, `PRIOR_BETS = 5`, `RANK_MIN_BETS = 10`.
  - `evidenceWeight` is guarded by `c.tier !== 'too-early' && c.k >= RANK_MIN_BETS`.
  - C3 is deleted. `lib/feed.ts`, `lib/discovery/` and `lib/feed.reach.test.ts` are byte-identical to `0666990`: the
    diff names none of them, and `git diff --quiet` on the reach test exits 0.
  - The M3 sweep and the lucky-5 ranking test (original and log mirror) are present and pass.
- **checked, OK: losses equal to gains.**
  - The weight is symmetric in log space (mirror tests).
  - `bound()` (D9) is sign-symmetric, and an exact zero stays "0.0%".
  - The width rule is sign-blind on the range shown.
  - The cap is symmetric.
  - No loss is hidden: the range and the "below zero" line show as before.
- **checked, OK: POLICY and COMPLIANCE §1 in the product diff.**
  - No advice word. "signal" is removed from the hold-time note, and "edge" from identifiers and strings (scan test).
  - Disclaimers are untouched. Percentages only. No new query, route, vendor, dependency, schema change or protected
    path (no file under `.github/CODEOWNERS`).
  - No user-controlled HTML.
  - The body's `## Compliance` answers all 11 items truthfully for the code.
  - The ticker baseline draws no verdict from a too-early range (unit test both ways).
- **checked, OK: no weakened test.** Every changed expectation in a main test is a restatement:
  - **floor of 5:** the expectations moved to the owner's floor;
  - **identifier renames:** the four `test(` titles removed by `-` lines are renames of the same tests, with the same
    assertions;
  - **ruling:** the zero-spread test now pins the exact floor interval to 1e-9, stronger than "collapses";
  - **D9:** the `trades.test.ts` range now reads `-0.01%`; its rule "never -0.0%" stands.

  `e2e/app.spec.ts` loses only one comment line from main. The three range patterns loosened to `[-+]?` in `6182f57`
  require `[-+]` again in `fe2c3f6`, the headline average keeps 1 decimal, and the engineer's log says plainly that the
  round-1 loosening was wrong. Test count is 623 → 641: 22 `test(` added minus 4 renamed. e2e goes 117 → 120.

## Heavy-feed e2e (`e2e/app.spec.ts:1146`; `:959` on main)

- **Reproduced on HEAD.** I ran it alone against :3600 several times, on a database whose demo seed is about 1.5 h
  old. Each run read "29 heavy cards from 18 distinct heavy traders" on page 1, the same numbers the engineer logged for
  HEAD and for main.
- **The extra card, captured.** I captured the live feed while the fixture was complete. The non-heavy card is demo
  `dividend_dan` (JNJ −1.4%) at position 18.
- **Not caused by this PR:**
  - I recomputed the 50 heavy traders' `evidenceWeight` with `lib/trades.ts` from `0666990` and from `1b4af5c` on the
    test's own fixture: 0 of 50 differ (max |Δ| = 0).
  - dan's weight is *lower* on this branch than on main (0.021 vs 0.025, ruled table).
  - So main ranks dan at least as high, and fails the same way. That matches the engineer's run on main's rebuilt
    product files.
- **Cause.** It depends on the seed's age, not on PR 1. The engineer queued it as its own task.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`.env`, `stock_social_f4`) | 641 tests: 629 pass, 0 fail, 12 skipped (LOAD) |
| `node scripts/autopilot.ts guard main` | `guard: ok` |
| `node scripts/compliance.ts diff origin/main` | `compliance: ok (diff vs origin/main)` (origin/main = `0666990`) |
| Product lines (`git diff --numstat 0666990 1b4af5c -- app lib`, no tests) | +85 / −46 = 131 (≤ 800; plan estimate 70–110) |
| `lib/feed.reach.test.ts` vs `0666990` | byte-identical |
| `lib/feed.ts`, `lib/discovery/` in the diff | not touched |
| Schema, protected paths, package files | none changed |
| Heavy-feed e2e alone on :3600 | fails 29/30, same as main (above); not this PR's |
| LOAD tests, build, full e2e | not re-run (no rebuild allowed); the engineer's fix-round-2 results in `build-pr1-engineer.md` |

## Verdict

REQUEST CHANGES. The only blocker is POLICY T1 in `ruling-pr1-h1.md:57-58`: remove the two third-party URLs (the
generic descriptions stay). Fix the PR body's moved-expectation count in the same pass. The product and test diff
pass as they are and need no re-review. Once the two lines are fixed, this is APPROVE.

## Resolution (2026-10-25, orchestrator)

Blocker fixed: both links removed from `ruling-pr1-h1.md`, plain descriptions and figures kept; the URLs are also
redacted from this review. `pr1-body.md` now states the test changes accurately (4 to the floor of 5, 2 to the variance
floor, 1 near-zero bound assertion). Docs only; no product or test file changed, so the code verdict above stands.
The same sweep removed outside links and third-party names from three other session docs.

**Verdict after the fix: APPROVE.**
