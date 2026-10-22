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

- 2026-10-22: The plan is the whole committee's: business lead, UX lead and engineer implement the
  feature the way they together judge best, within the owner's decisions; the planning discussion is
  where that is settled. Each member's feedback and an overall summary are logged per round. Why: the
  owner's rule; the planning debate exists to make the implementation choices.
- 2026-10-22: Preliminary user testing is done by every committee member, each on the running preview
  as a first-time trader and as a first-time viewer arriving from a shared link, each logging what
  confused or stopped them in plain words; the tester runs the scripted edge-case pass in addition.
  Why: the owner wants all of them to user-test, not one role.
- 2026-10-22: The process is fully autonomous from ready feature to merged PR: no step waits for a
  human unless one of the hard stops below is hit. Why: the owner's rule.

## Hard stops: where the autonomous cycle must wait for the owner
These are the only points where a human is needed. Each is a rule the owner set elsewhere, so
removing a stop is the owner's change, not the pipeline's.
1. **Protected paths** (`.github/CODEOWNERS`): the Gate never auto-merges a PR touching them. F-1
   needs `lib/session.ts` (replace the dev auth stub), `lib/broker.ts` (embedded portal, link deletion)
   and `package.json` (sign-in and vendor SDK dependencies). Without a change to the rule, F-1's PR
   stops at the Gate for the owner's merge. Options: the owner merges those PRs by hand (one stop per
   feature), or the owner pre-authorizes the feature pipeline for a named set of paths and the reviewer
   checks them with extra care.
2. **Secrets and credentials** (POLICY H): sign-in provider client IDs and secrets, the vendor's
   production keys, a billing vendor's keys. Only the owner creates them in the repository settings.
   Feature builds use test-mode keys the owner adds once, before the pipeline starts F-1.
3. **New dependencies and new vendors** (POLICY H, Standing direction 3): the plan may propose one;
   the owner approves it before the build (a single yes/no in the plan log).
4. **External approvals with their own clocks**: the vendor's production access per broker (days to
   weeks per broker) and the sign-in providers' app reviews. The pipeline builds and tests against the
   vendor's test environment and the providers' development apps; production approvals run in parallel
   and are not a stop for the build.
5. **A disagreement with a decision** in the feature file: logged to its Open questions, the feature
   waits, the pipeline moves to the next feature.
6. **The attempt cap** (`FEATURE_MAX_ATTEMPTS`): after N failed committee rounds the owner is asked,
   so a feature can't cycle forever.
7. **Phase 2/3 and counsel gates** (DESIGN §3.2, §3.3, POLICY F5): F-2's ranking stages after the
   supply gate and F-3 entirely wait on the owner's say-so.
8. **Owner acceptance**: `Status: built → accepted` is the owner trying the merged feature; the
   pipeline does not wait for it and starts the next feature.
9. **Usage limits** on the agent runs pause the loop until the cooldown passes (AUTOPILOT.md).

- 2026-10-22: Pre-authorization for protected paths: the feature pipeline may change `lib/session.ts`,
  `lib/broker.ts` and `package.json` (with its lockfile) when, and only to the extent that, a ready
  feature file requires it (F-1: real sign-in replacing the dev stub, the embedded portal and link
  deletion, the sign-in and vendor SDK dependencies). The reviewer checks those files line by line
  against the feature file and POLICY (read-only connection type kept, secret encryption unchanged,
  dependency licenses allowed) and fails the PR on anything beyond the feature's need. All other
  protected paths keep their stop. Why: the owner pre-authorized these so F-1 runs without a manual
  merge. Note: this is a CODEOWNERS and Gate change (`scripts/autopilot.ts`), both owner-only; the
  owner makes it when folding this file into the pipeline.

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
4 User test  every committee member on the preview as first-time trader and viewer (logged)
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
- Is the UX lead the existing designer member with a widened spec, or a new member?
- Committee rounds: a hard cap per feature (today FEATURE_MAX_ATTEMPTS = 5) after which the owner is
  asked, or unlimited?
- Does the business lead's "market demand" debate apply to a feature the owner already decided, or
  only to how it is implemented (recommendation: only how; demand was settled in the design session)?
- Does the committee also review the three-stage items (F-2 stages 2 and 3) when they are built later,
  or only the stage-1 build?
- How the process is run: extend `scripts/features.ts` and `scripts/team.ts` (owner-only files) or a
  new script; either way the owner makes the change.
