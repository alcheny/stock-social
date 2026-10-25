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

- 2026-10-22: The plan for each feature ends with a "Pre-authorization requests" section: the
  committee lists every bottleneck it foresees that would stop the autonomous cycle (protected paths,
  secrets, dependencies, vendors, external approvals) with the reason. The owner answers that list
  once, before the build starts, and the answers are logged; the pipeline then runs without further
  stops for those items. The committee identifies; only the owner authorizes (an agent never loosens a
  rule it is judged by, AUTOPILOT.md hard rules). Why: the owner wants pre-authorization driven by what
  the committee says the bottlenecks are.

- 2026-10-22: Members are distinct roles (business lead, UX lead, engineer, tester, reviewer) but every
  member has the full capability set: every tool and skill an agent in this repo can use, and the whole
  scope of the project (every doc, decision, spec and file) in view. The UX lead is a separate member
  from the engineer. What differs between members is only which ones are activated at each stage, and
  what each is told to prioritize, emphasize and watch for. Why: the owner's rule; roles are lenses,
  not capability limits. Note: today `team/README.md` restricts most members to read-only tools and
  states "no member grades their own work". Full capability is compatible with that as long as the
  member who built a round is not the one who passes it, so the reviewer stays independent of the
  committee and the committee's verdict is on the engineer's build, not its own. The owner edits the
  member specs (owner-only) to lift the tool restrictions.

- 2026-10-22: The phase limitations (DESIGN §3 Phase 1/2/3, "don't build Phase 2/3", the supply-gate
  timing) no longer apply to what gets built. The design sessions set the backlog and the order; every
  feature with Status ready or rework is built in number order, now. Why: the owner declared the
  phases an older version of the planning. What stays: legal gates are not phase gates. Anything the
  policy or the compliance reference marks as needing counsel (selling access to records or positions,
  payouts, anything that could be read as advice) still waits for that opinion, because the exposure
  is per user and the owner's own rule is that POLICY outranks everything.
- 2026-10-22: Legal compliance is validated at every stage of the cycle, always: (1) the plan answers
  the per-change checklist (COMPLIANCE.md Section 1) in writing and names the sections that apply;
  (2) the build runs the deterministic scanner before the tester; (3) every committee member reviews
  the built feature against POLICY and the applicable COMPLIANCE sections and returns a compliance
  pass or a list of failures, separate from the usability verdict; (4) the reviewer's independent check
  includes the same. A compliance failure at any stage sends the feature back to the plan step with the
  failure as the first item: the design is changed so it cannot fail that rule, never worked around,
  never waived by an agent. Why: the owner's rule, "always, always, always a step to validate legal
  compliance".

- 2026-10-22: The committee reviews at every stage, including F-2's later stages and every rework
  round; no build of any size merges without the full cycle. Why: the owner's rule.
- 2026-10-22: First run started in the owner's chat session, with the roles played by subagents
  reading the member specs, on the session branch, until the owner wires the process into the
  pipeline scripts. Logs go to `docs/features/logs/F-1/`. Why: the owner said to begin.

## Pre-authorization requests for the first run (F-1 → F-2 stage 1 → F-4)
Compiled 2026-10-22 from the business lead's and the engineer's reviews of the feature files, the
pipeline scripts and the workflows. Each is a yes/no for the owner; answers are logged here.

| # | Request | Why it stops the cycle | Owner's answer |
|---|---|---|---|
| 1 | Carve-out in CODEOWNERS and the Gate for `lib/session.ts`, `lib/broker.ts`, `package.json`, `package-lock.json`, scoped to feature PRs | Gate labels any PR touching them needs-human | pre-authorized (decision above); owner edits the files |
| 2 | Raise the Gate's diff cap (`MAX_DIFF`, 800 lines) to ~4000 for `feature` PRs, or let the plan split F-1 into three sequential PRs (sign-in; connection state machine + consent + import; heavy tests) | F-1 with tests is 2k to 4k lines; every PR would go needs-human | pre-authorized 2026-10-24: the 800-line cap counts product lines only (not tests, e2e, docs or screenshots); owner edits `scripts/autopilot.ts` to match |
| 3 | Repo variables: `TEAM_BUDGET_USD` ≈ 60 (now 15), `BUDGET_ENGINEER` ≈ 10, `FEATURE_MAX_ATTEMPTS` 10 for F-1 then 5 | F-1's size exhausts the current budgets and attempt cap | |
| 4 | Test-mode secrets created and passed to the build and CI jobs (names only): the vendor's test key pair, the email-provider sign-in client id and secret, the phone-maker sign-in team id, key id and private key, the email-sending key and from-address, a session secret, the public site URL | Only the owner creates secrets; without them the committee's running-preview test of sign-in and the portal is mocks only | |
| 5 | One new dependency: the vendor's web SDK for the embedded portal. Everything else built without dependencies (sign-in via standard OIDC with the runtime's crypto, email via one HTTPS call, the t multiplier inline) | POLICY H: new dependencies are the owner's | |
| 6 | One new vendor: an email-sending service for the magic link (the single Phase 1 exception to "no new vendor") | DESIGN §3 and Standing direction 3 | |
| 7 | A scheduled call to `/api/sync` in the deploy settings (nothing calls it today): **corrected 2026-10-23 by the business lead (F-1 PR-3 committee re-sit): cron every minute** (was hourly, then "every 5 minutes, never at :30" from the first committee round, now withdrawn). Why: each call stops claiming before its 300 s `maxDuration`, so calls 5 minutes apart never overlap, and at a slow vendor (2.5 s per page) they cover only about 245 four-account traders an hour, half the 500 target; calls every minute overlap, and overlapping callers split the work safely (each trader is claimed once per round; the fleet test runs 8 concurrent callers), which covers the 500. Consent expiry and the 90-day purge run in that tick, with lazy expiry on profile read | Deploy settings are owner-only | |
| 8 | Function duration limit ≥ 60 s in the deploy settings, for the chunked import (one vendor page per step, client-polled; no worker or queue yet) | Deploy settings are owner-only | |
| 9 | Preview deploys per feature PR (deployments are off today), or accept in-job `npm run start` plus browser screenshots as the committee's "running preview" | The committee and user tests need a running app | |
| 10 | Placeholder Terms and Privacy pages and the consent-screen copy (what becomes public), supplied by the owner | POLICY P6/F3: the attestation and consent screens must link them | |
| 11 | A `blocked` status the publish script may set when a feature hits a hard stop | Otherwise the picker returns the blocked feature forever and later features never build | |
| 12 | Process wiring: owner edits to `scripts/features.ts`, `scripts/team.ts`, `team/*.md`, CODEOWNERS and `features.yml` for the plan round, the UX lead, the committee, per-member user tests and `docs/features/logs/` | All owner-only paths | |
| 13 | Run the heavy-use suite automatically: a `test:load` script in `package.json` (`LOAD=1 node --expose-gc --test lib/sync.load.test.ts`) and a CI job on demand (manual dispatch, with Postgres) | Nothing sets `LOAD=1`, so the F-1 heavy-use criteria are never checked automatically; `package.json` and workflows are owner-only (F-1 PR-3 tester, Low 3) | |

Not needed for the first run (wait): a read replica, object storage, a vector index, a worker or
queue, an AI-model key (F-2 stages 2 and 3; F-2 stage 1 is SQL co-visitation on the primary database
and the reason line's model call is behind an injected interface with its fallback tested).

## Conflicts and gaps the committee found in the feature files (owner decides before the build)
1. ~~F-2 is a Phase 2 feature~~ Resolved 2026-10-22: phase limitations scratched by the owner; F-2
   builds in full in its number order. POLICY H's "Phase 2/3 features" clause and DESIGN §3.2 are the
   owner's to edit to match.
2. ~~**POLICY F1 says "no personalized suggestions"** literally.~~ Resolved 2026-10-25: the owner amended
   F1 (new F1a): personalized discovery of traders and records to read is allowed; personalized
   suggestions of securities or trades stay forbidden. Counsel (F-2 plan H2) still gates PR-5's build.
3. **F-2 depends on features that do not exist**: follow and unfollow, "not interested", account
   deletion. Resolved 2026-10-22 as scope: F-2 includes a `follows` table with follow/unfollow on the
   profile, the "not interested" control, and account deletion (POLICY P6) with event tables cascading
   on the user row. Recorded in F-2.
4. ~~F-1 trust notice~~ Resolved 2026-10-22: F-1 now phrases it as the vendor's own report of an
   independent audit of its security controls, never an audit of records (owner chose the compliant
   version).
5. (Applied to F-1, 2026-10-22) **"session by completing a connection"** for a returning trader conflicts with "already
   claimed → refused". Fix: a fresh connection whose accounts are all claimed by one existing trader
   signs in as that trader and drops the new link; refusal applies only when a different signed-in user
   tries.
6. (Applied to F-1, 2026-10-22) **"declined or expired → no claims"** vs TR-6 "claims are never released". Fix: claims are
   provisional until consent (`confirmed_at`); unconfirmed claims are released at decline or expiry.
7. (Applied to F-1, 2026-10-22) **attestation "before a user row exists"** vs the vendor registration needing an app user id.
   Fix: a `signup_attempts` row (no personal data) holds the attestation and the vendor link; the user
   row is created at consent.
8. **F-4 "threshold recorded in the design record"**: DESIGN.md is owner-only, so the constant lives in
   `lib/confidence.ts` with its test, and the owner keeps DESIGN.md in step (done for K ≥ 5).
9. **F-4 and `lib/confidence`** must drop any "Edge:" label (POLICY F3b bans "edge"); the evidence
   line keeps tier and sample only.

## The cycle (draft)
```
feature file (ready/rework)
   ▼
1 Plan     business lead ⇄ UX lead agree the implementation approach
           ⇄ engineer on feasibility, size, market demand   → signed plan (logged)
           + compliance checklist answered (COMPLIANCE.md §1) + pre-authorization requests
   ▼
2 Build    engineer: tests per acceptance criterion first, then code, on autopilot/feature-<n>
   ▼
3 Verify   deterministic checks (tsc, tests, compliance scanner, guard)
           compliance failure → back to 1 with the failure first
           ⇄ tester: conformance, edge cases, heavy use, 360px usability (logged)
   ▼
4 User test  every committee member on the preview as first-time trader and viewer (logged)
   ▼
5 Committee  each member: compliance pass/fail against POLICY + COMPLIANCE, then usability
             pass / demands (all logged); any compliance fail → back to 1
   ▼
pass → reviewer's independent check → Gate merges → Status: built → next feature
fail → demands become round n+1's plan → back to 1 (bounded by FEATURE_MAX_ATTEMPTS, then owner)
```

Interim rule (until request #13 is answered): any PR touching `lib/sync.ts`, `lib/connections.ts`, `lib/trades.ts` or `lib/broker.ts` attaches a `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` run (its `# load:` lines) to its build log.

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
- Committee rounds: a hard cap per feature (today FEATURE_MAX_ATTEMPTS = 5) after which the owner is
  asked, or unlimited?
- Does the business lead's "market demand" debate apply to a feature the owner already decided, or
  only to how it is implemented (recommendation: only how; demand was settled in the design session)?
- How the process is run: extend `scripts/features.ts` and `scripts/team.ts` (owner-only files) or a
  new script; either way the owner makes the change.
