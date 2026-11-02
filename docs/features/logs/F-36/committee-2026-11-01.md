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
- Engineer (fresh context, same reviewer as rounds 1-2): tests first (`5febd93`, failing on the old code: the first
  error was the missing `signChanges` export), then the change (`1442c3d`). Deviations from the plan, recorded: the
  no-positive-denominator check runs only when a lot was drawn (a zero-unit sell keeps today's behaviour); sign counts
  are summed only after a record's transaction commits; `scripts/f36-audit.test.ts` pins the hook's anchor. No axe
  library is in the repo, so the e2e checks heading order and no horizontal scroll instead of an axe pass.
- Tester QA: PASS, no defects. 2393 tests, 0 fail. 3,000 random histories: order independence and the partition
  invariant hold (held-row partition misses exist on main too, by design); main shows 153 infinite or NaN returns on
  them, this branch none; a 50k-activity history completes with every return finite. Notes taken: 2 and 3 as ponytails
  in `lib/trades.ts` (near-zero price; negative fee). Note 1 (guard bucket moves are not in the audit's list): the only
  bucket move is a gapped sell drawing an untainted price-0 lot (`excluded` → `excludedCorporate`), pinned in
  `lib/f36-fees.test.ts`; no existing expectation moved for it (the suite's only changed expectations are the audit's).
  Note 4 (zero-unit rows) predates F-36.
- Leads' user test at 360 and 320 px, light and dark (/how, a demo profile, a trade page): PASS. Formula as text, no
  horizontal scroll, example fictional and correct, dated note under "Changes to the math", Disclaimer right after the
  math list, no fee anywhere on profile or trade pages. Not taken: breaking the example inside a bracket (cosmetic; the
  copy is signed and pinned verbatim); "larger in size, whether up or down" (the business lead's signed wording stands).
  Outside F-36, for the fixes lane: the trade page's h2 "This trade" precedes its h1; the profile's "What's this?"
  toggle is 21 px tall.
- Independent code review: no blocking findings. Taken: finding 2 (the audit now fails unless the legacy run collects a
  failure in `lib/trades.test.ts`) and finding 1 (a ponytail: records the hourly sync rebuilt first are not in the
  deploy's counts). Findings 3-5 (per-file cross-check backed by the per-trade `entryFee=no` check; the date constant,
  an owner item; DB fixture legacy rows written by hand) are noted, not changed.
