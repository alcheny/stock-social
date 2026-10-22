# Implementation process for decided features (draft, being hashed out with the owner)

Status: draft. This file records how a feature that the owner decided in a design session
(`docs/features/F-<n>-*.md`, Status `ready` or `rework`) is implemented. It takes its shape from the
autopilot's branch-team process (`docs/AUTOPILOT.md`, `team/README.md`) and replaces the current
"engineer builds the owner's file as written" step of the feature pipeline (`docs/FEATURES.md`).
When the owner confirms it, the owner folds it into `docs/FEATURES.md`, `scripts/features.ts` and the
member specs in `team/` (all owner-only paths).

## Decisions
- 2026-10-22: Each ready feature goes through a planning debate before any code: the business lead and
  the user-experience lead (today's designer) agree how best to implement the design the owner decided,
  then debate it with the engineer on feasibility, size and market demand, until all three sign off on
  an implementation plan. Why: the owner wants the same collaborate-then-debate shape as the autopilot's
  planning, applied to the owner's decided designs.
- 2026-10-22: The plan never changes a decision in the feature file. It decides how, not what: screen
  flow, component choices, data model, rollout, and the test plan for every acceptance criterion. A
  disagreement with a decision is written to the feature file's Open questions for the owner, and the
  feature waits. Why: the feature files are the owner's decisions (FEATURES.md); agents can't edit them.
- 2026-10-22: Build: the engineer writes a test for every acceptance criterion first, then the code,
  and loops with the tester (deterministic checks, spec conformance, edge cases, heavy use, 360px
  usability) until clean, as today. Why: the owner requires tests for every feature including edge cases
  and heavy use (F-1 decision).
- 2026-10-22: Acceptance is by a committee, not by the engineer: the business lead and the
  user-experience lead each review the built feature against the feature file and against their own
  bar (functions implemented completely, cleanly, usably, to high expectations), on a running preview,
  and each returns pass or a list of demands. Both must pass. Why: the owner wants approval by the
  business executive and the user-experience member, not only green tests.
- 2026-10-22: A failed committee review sends the feature back through the cycle: the demands become
  the next round's plan (business lead ⇄ UX lead ⇄ engineer), then build, tests, review again. The
  cycle repeats until tests, preliminary user testing and the committee all pass. Why: the owner's rule.
- 2026-10-22: The pipeline continues feature by feature until every feature in `docs/features/` with
  Status ready or rework is built, then stops. Why: the owner's rule; the design sessions set the
  backlog.
- 2026-10-22: Every implementation discussion is documented: the plan, each debate round's positions
  and the sign-off, each committee verdict with its demands, and the test and QA record, in
  `docs/features/logs/F-<n>/` (never in the owner's feature file). Why: the owner wants the
  implementation details documented the way the design decisions are.

## The cycle (draft)
```
feature file (ready/rework)
   ▼
1 Plan     business lead ⇄ UX lead agree the implementation approach
           ⇄ engineer on feasibility, size, market demand   → signed plan (logged)
   ▼
2 Build    engineer: tests per acceptance criterion first, then code, on autopilot/feature-<n>
   ▼
3 Verify   deterministic checks (tsc, tests, compliance scanner, guard)
           ⇄ tester: conformance, edge cases, heavy use, 360px usability (logged)
   ▼
4 User test  preliminary user testing on the preview (see Open questions: who)
   ▼
5 Committee  business lead: pass / demands   +   UX lead: pass / demands   (both logged)
   ▼
pass → reviewer's independent check → Gate merges → Status: built → next feature
fail → demands become round n+1's plan → back to 1 (bounded by FEATURE_MAX_ATTEMPTS, then owner)
```

## What already exists and is reused
- Branch team roles and specs in `team/` (business lead, designer, engineer, tester, reviewer).
- `scripts/features.ts` picks the lowest ready/rework feature, one at a time, and publishes status.
- The Gate merges green PRs; protected paths wait for the owner.
- Deterministic checks and the compliance scanner run before the tester.

## What is new
- A planning debate per feature (today the engineer builds the file as written with no plan round).
- A two-member acceptance committee with a running preview, separate from the reviewer's pass/fail.
- A preliminary user-testing step.
- Per-feature implementation logs with the debate positions and committee verdicts.

## Open questions
- Who performs "preliminary user testing": the tester member on a scripted set of tasks, a new
  "user" member that role-plays first-time traders and viewers on the preview, or the owner by hand
  on a preview link before the committee?
- Is the UX lead the existing designer member with a widened spec, or a new member?
- Committee rounds: a hard cap per feature (today FEATURE_MAX_ATTEMPTS = 5) after which the owner is
  asked, or unlimited?
- Does the business lead's "market demand" debate apply to a feature the owner already decided, or
  only to how it is implemented (recommendation: only how; demand was settled in the design session)?
- Does the committee also review the three-stage items (F-2 stages 2 and 3) when they are built later,
  or only the stage-1 build?
- How the process is run: extend `scripts/features.ts` and `scripts/team.ts` (owner-only files) or a
  new script; either way the owner makes the change.
