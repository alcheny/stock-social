# F-36 brief (orchestrating build session, 2026-11-02)

Feature: `docs/features/F-36-fees-in-the-return-denominator.md` (read it: Decisions and Acceptance criteria are fixed;
the plan decides how, never what). Owner answered cycle-5 Q1 YES on 2026-11-02. DESIGN §2.5 (protected) is amended by
the protected-files session; this build references that amendment and does not edit DESIGN.

## Where the math lives today
- `lib/trades.ts#replay`, the shown-trade branch: `returnPct: (a.units * a.price - cost - entryFees - exitFee) / cost`.
  `cost` and `entryFees` are the matched lots' price and fee per unit times units taken (fees prorated by units).
- Options already divide by premium plus entry fees (`lib/options.ts`), so after F-36 stocks and options agree.
- `MATCHER_VERSION = 2` (`lib/trades.ts`). A bump makes the deploy rebuild every record once
  (`lib/matcher-rebuild.ts#rebuildAllForMatcher`, called by `scripts/db-setup.ts`).
- Lots with no basis (F3-1 unusable rows, corporate-action shadows) are `tainted` with price 0 and fee 0; a sell
  drawing them is counted in `excludedCorporate`. Vendor rows with price ≤ 0 never become activities
  (`lib/corporate-actions.ts#unusableTrade`), but the matcher should not rely on that: a lot with cost 0 must never
  be priced by its fees alone.
- `/how` (`app/how/page.tsx`) renders `HOW.math` from `lib/copy.ts`; line 2 describes the return in words.
- COMPLIANCE §12 keeps the dated history of /how ("every change to the trade math is a product statement").
- F-24 (#84) and the cycle-4 fixes (#89) shaped `replay`: gap rule, held rows, `excludedHeld`, order independence
  (canonical sort), the partition invariant (every unheld sell is shown or counted exactly once).
- F-23 (on main): public payloads carry only the displayed precision; stats and ranking compute on stored returns.

## Ordering
- Merges after chore C5-43(b) (matcher catch-up in the sync tick), opening as its own PR.
- F-32 Part A also bumps MATCHER_VERSION. Never the same deploy. Whichever lands second takes the next number; this
  build uses 3 and says so in the PR.

## Constraints
POLICY (no fee amounts shown; percent only; disclaimers on performance surfaces; losses like gains), no new
dependencies, no new column, no protected files (scripts/autopilot.ts, team.ts, features.ts, doctor.ts, plan.ts,
invariants.test.ts, compliance*.ts, policy.test.ts, workflow-security.test.ts, .github/**, docs/POLICY.md, CLAUDE.md,
team/**, playwright.config.ts, lib/session.ts, lib/broker.ts, docs/DESIGN.md). Additive edits. Never weaken tests;
existing expectations that change because a fixture has an entry fee are updated, and the list comes from test output.
