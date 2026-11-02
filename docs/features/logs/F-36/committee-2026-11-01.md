# F-36 committee record (cycle opened 2026-11-01, built 2026-11-02)

Feature: `docs/features/F-36-fees-in-the-return-denominator.md`. Members: UX lead (plan author), business lead,
engineer, tester, independent code reviewer; each a fresh-context subagent. The orchestrating build session wrote the
brief (`brief.md`) and the round-2 synthesis (`plan.md` → "Round 2 changes").

## Prerequisites
- Owner answered cycle-5 Q1 yes on 2026-11-02 (a return divides by entry cost plus entry fees). DESIGN §2.5 (protected)
  is amended by the protected-files session; this build references it.
- F-24 (#84) is on main (`replay`'s held rows and `excludedHeld`; the cycle-4 gap rule from #89).
- Merge order (orchestrator): after chore C5-43(b); never in the same deploy as F-32 Part A's MATCHER_VERSION bump.
  This build takes version 3; whichever of the two lands second takes the next number.

## Round 1 (UX lead's draft; both reviewers: CHANGES REQUIRED)
UX lead: formula with `cost + entryFees`; no-basis guard counted in `excludedCorporate`; MATCHER_VERSION 3; counts-only
rebuild log with a sign-change count; /how formula, fictional example and a dated "Changes to the math" note; an
env-gated audit in `matchTrades` printing changed trades; a second property test; a `/fee/i` payload-scan assertion.

Business lead r1: CHANGES REQUIRED. 1 `/fee/i` matches "feed"; 2 trim the formula line; 3 the note must say gains and
losses both looked bigger, drop "kept as history"; 4 the date is the day the version-3 rebuild runs in production;
5 the env hook only if it never throws and is inert in production, removed at the next version; 6 zero-fee fixtures
byte-identical against the guard too; 7 no options wording on /how; 8 share closes only for the sign count; 9 example
exactly as decided, no currency sign; 10 review /how at 320 px light and dark, Disclaimer after the math list.

Engineer r1: CHANGES REQUIRED. 1 drop the production audit branch: a test-only loader hook rewrites `lib/trades.ts`'s
`returnPct:` line in memory (proved in scratch on main: 0 `entryFee=no` lines); 2 run the `.db.test.ts` files with
`DATABASE_URL`; 3 fold the guard into the first `excludedCorporate` condition, oversell branch unchanged, pin a gapped +
no-basis case; 4 keep the report, deep-equal the return shape, state `closes_rewritten` grows for fee-bearing records;
5 no second property file: extend the cycle-4 model; 6 a huge-entry-fee, zero-exit-fee case stays ≥ −1; 7 the
expected changed tests; 8 drop the payload `/fee/i` assertion; 9 render the date with `timeZone: 'UTC'`; 10 version 3,
name the F-32 conflict.

## Round 2 (orchestrator's synthesis, `plan.md` → "Round 2 changes"): both SIGNED
Conflicts settled: the audit is test-only (engineer 1 over the UX lead's env hook; the business lead preferred it in
round 2); no payload `/fee/i` assertion (engineer 8 over business lead 1: the AC asks for a source scan plus a render
test, and any word pattern trips on legitimate copy).

Business lead r2: SIGNED. Notes: the PR pastes the audit's printed list as output; the higher `closes_rewritten` count
shows the trader nothing new; the PR says who moves the date constant if the deploy slips.
Engineer r2: SIGNED. Notes: the audit must prove its hook loaded (anchor found once, else throw; an empty list passes
only when every test exited cleanly); `|new| ≤ |legacy|` and the zero-fee equality are exact float comparisons.

## Build
