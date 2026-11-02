# F-36 · Fees in the return's denominator

Status: building
Building: branch `claude/f36-fees-denominator` (2026-11-02). The owner answered cycle-5 Q1 yes on 2026-11-02; F-24 (#84)
is on main. The PR merges only after chore C5-43(b) (matcher catch-up in the sync tick) is on main, and never in the
same deploy as F-32 Part A's bump (the orchestrator orders the merges).
Start conditions: the owner answers cycle-5 Q1 yes (`docs/direction/cycle5-2026-11-01.md` §8), and #84 merges. It is
the matcher build slot, shared with F-32: one builder, separate version bumps that never ship in the same deploy.

## Why
The return divides by cost without the entry fee (`lib/trades.ts:317`; `docs/DESIGN.md:143`). In the cycle-5 audit's
fictional probe, buying 2 @5 with a fee of 10 and selling at 15 shows +100%, where the return on cash paid is +50%.
The feed sorts by size, so these trades lead. Options already include the entry fee in their basis (`lib/options.ts:145`,
`:220`), so stocks and options disagree today (council cycle 5, C5-31, brief rank 7). Approved by the approval council
(`docs/ideas/approval-2026-11-01-cycle5.md`: second-vote mean 3.80, final vote 15/15, all approving, 13 of them with
conditions).

## Decisions
- 2026-11-01: Approved as "waits on cycle-5 Q1". `return_pct = (exit − entry − fees) / (entry cost + entry fees)`,
  one formula for stocks and options. DESIGN §2.5 is protected, so its text changes in the owner's PR. Why: approved by
  the approval council (cycle 5); brief C5-31; DK check (protected DESIGN).
- 2026-11-01: Its own MATCHER_VERSION bump, after chore C5-43(b), never in the same deploy as F-32's. If a second bump
  arrives before the first has drained, the catch-up rebuilds straight to the latest version. The deploy rebuild
  reports counts only, including how many trades changed sign (expected 0, because the numerator is unchanged). Why:
  approved by the approval council (cycle 5); RT round 4, RE, RT.
- 2026-11-01: A lot with no basis or a zero price (F3-1 rows) is never priced by fees alone. It stays counted. Why:
  approved by the approval council (cycle 5); RT round 4.
- 2026-11-01: No new column. No fee amount or fee share is shown anywhere. Why: approved by the approval council (cycle
  5); EN, LC (P3).
- 2026-11-01: /how states the formula once, in plain text (not an image) that reflows at 320 px, with one fictional
  worked example: paid 100 plus a fee of 10, sold for 165, +50%. A dated note says returns with entry fees were
  recalculated on that date, and it is kept as history (COMPLIANCE §12). Why: approved by the approval council (cycle
  5); UX, CO, VW, A11Y, LC.
- 2026-11-02: Owner answered cycle-5 Q1 yes: a return divides by entry cost plus entry fees. The DESIGN §2.5 text
  is amended by the protected-files session (DESIGN is protected); this build references that amendment. Why: owner
  decision (cycle-5 Q1).
- 2026-11-01: Changed figures arrive only through the normal rebuild. The trader gets no alert or "your return
  dropped" message. Why: approved by the approval council (cycle 5); TR.

## Acceptance criteria
- [x] The probe (fictional: buy 2 @5, fee 10, sell @15) prints +50%.
- [x] A long share trade shows worse than −100% only when its exit fee exceeds its sale proceeds, and a test pins that
      case.
- [x] Zero-fee fixtures rebuild byte-identical.
- [x] A fixture check: every changed expectation belongs to a trade with an entry fee above 0. The PR's list of
      changed expectations comes from the test run's output, not a hand-written list.
- [x] A lot with no basis or a zero price stays counted and is never priced from fees.
- [x] No trade changes sign. The rebuild report's sign-change count is 0 on the fixtures.
- [x] /how renders the formula and the worked example as text, with the dated note.
- [x] No page, payload or image shows a fee amount (source scan plus a render test).

## Out of scope
- Showing fees.
- Changing how options compute their basis (already includes fees).

## Open questions
- (Answered 2026-11-02, yes) Owner (cycle-5 Q1): may the return divide by entry cost plus entry fees?

## POLICY notes
- F3a: one documented formula on /how, with dated history (COMPLIANCE §12).
- P3: percent only; no fee amounts.

## Hand-offs to in-flight work
- F-24 (#84) edits `lib/trades.ts`. Build after it.
- F-32 (same slot): one builder, separate bumps.
- Cycle-5 chore C5-43(b) must be on main before the bump ships.

## Rework notes

## Build log
- 2026-11-02: built on `claude/f36-fees-denominator` through the committee cycle (`docs/features/logs/F-36/committee-2026-11-01.md`):
  plan signed in round 2; tests first; tester QA pass; 360/320 px user test pass; independent review with no blocking
  finding. MATCHER_VERSION 3 (provisional against F-32 Part A). Fixture audit: `docs/features/logs/F-36/audit.txt`.
