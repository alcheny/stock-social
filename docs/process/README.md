# Development process

This folder describes how Stock Social is built by many Claude clients at once. It owns lane C (the interactive
orchestrator and its sessions) and how the three lanes coexist. Everything else has its own home and is linked, not
restated: product and code rules in [CLAUDE.md](../../CLAUDE.md), legal and security rules in
[docs/POLICY.md](../POLICY.md), lane A in [docs/AUTOPILOT.md](../AUTOPILOT.md), lane B in
[docs/FEATURES.md](../FEATURES.md) and [docs/IMPLEMENTATION.md](../IMPLEMENTATION.md).

| Doc | What it owns |
|---|---|
| [README.md](README.md) | This map, reading paths, quick start, the glossary |
| [architecture.md](architecture.md) | Actors, channels, where state lives, concurrency, taking over as orchestrator |
| [lifecycle.md](lifecycle.md) | One work item from idea to archive: kinds, stages, States, lane-C hard-stop additions |
| [collaboration.md](collaboration.md) | Working in parallel: branches, the lane collision, file ownership, claims, merge order, conflicts, messaging, tool recipes, never-do list |
| [quality.md](quality.md) | Local environment, gates before every push, CI layout and duration, rendering determinism, test rules (incl. privacy maps), review standards, ponytail convention, compliance heading, protected-path mechanics, diff size, the red-CI record of 2026-11-01 |
| [budget-and-rate.md](budget-and-rate.md) | Budget rules, collaborator sessions, admission, the token-budget governor, lanes A/B budgets, Actions minutes, measured spend and throughput, bottlenecks, how to re-measure |
| [decisions-and-authority.md](decisions-and-authority.md) | Precedence, owner-only items, delegations, who decides what, records, trust, escalation, open questions for the owner |
| [coordination.md](coordination.md) | The live snapshot: orchestrator of record, budget line, work items with file ownership and State, merge order, known overlaps, switch state, feature-file Status after lane-C merges |
| [review-2026-11-01.md](review-2026-11-01.md) | How these docs were made and checked, and the traceability of every moved rule |

## The three lanes

Three systems build this repo. Each has one home doc. They share CI, the policy scan, the Gate and the repo.

| Lane | Switch | Branch prefix | PR label | Who merges | Home doc |
|---|---|---|---|---|---|
| **A. Actions autopilot** | repo variable `AUTOPILOT` (`on` runs it; anything else is the kill switch), mode in `AUTOPILOT_MODE` ([AUTOPILOT.md](../AUTOPILOT.md) → Controls) | `autopilot/*`; lines mode `line/a\|b\|c` | `autopilot` (+ `variant` or `single`) | The Gate merges single builds in auto mode; variants merge only by `/choose` (human) or the Judge (auto mode); a line reaches main only when a human opens and merges its PR (AUTOPILOT.md → Lines mode, Controls); protected paths are never auto-merged ([AUTOPILOT.md](../AUTOPILOT.md) → Hard rules enforced in code) | [docs/AUTOPILOT.md](../AUTOPILOT.md), [team/](../../team/README.md) |
| **B. Actions feature pipeline** | repo variable `FEATURES` (`on`/`off`), independent of `AUTOPILOT` ([FEATURES.md](../FEATURES.md) → Switch) | `feature/<id>` (`scripts/features.ts` `branchOf`) | `feature` | The Gate, only for an open, non-draft `feature` PR from a `feature/` head into main opened by the workflow bot (`scripts/autopilot.ts` gate, `feature` condition), once it contains the latest main | [docs/FEATURES.md](../FEATURES.md), [docs/IMPLEMENTATION.md](../IMPLEMENTATION.md) |
| **C. Interactive orchestrator** | none: runs while the owner's orchestrating session is active | `claude/<topic>` | `feature` in practice, not on every PR (label policy: open question Q4; current labels: [coordination.md](coordination.md#work-items)) | The orchestrator, squash via the GitHub API, after an independent review and a green `check` ([lifecycle.md](lifecycle.md#stages) stage 12) | this folder |

Lines-mode teams A/B/C (`line/a|b|c`) all belong to lane A; they are not lanes. Whether each switch is on right now,
and whether lane C is active, is live state: [coordination.md → Other lanes and reserved branches](coordination.md#other-lanes-and-reserved-branches)
(re-check with the recipe in [collaboration.md → Tool recipes](collaboration.md#tool-recipes)). How lanes A and B
collide with lane C when a switch is on: [collaboration.md → When FEATURES or AUTOPILOT is on](collaboration.md#when-features-or-autopilot-is-on).

## Who reads what

Read in the order given. Every reader starts with [CLAUDE.md](../../CLAUDE.md) and [docs/POLICY.md](../POLICY.md)
(CLAUDE.md → "Read first").

| Reader | Then read, in order |
|---|---|
| New build session (child of the orchestrator) | Its task prompt; [Quick start](#quick-start); lifecycle.md [Work-item kinds](lifecycle.md#work-item-kinds), [stage 7](lifecycle.md#7-committee-cycle), [stage 8](lifecycle.md#8-pull-request), [stage 15](lifecycle.md#15-interrupted-work) and [States](lifecycle.md#states); [collaboration.md](collaboration.md); quality.md [Local environment](quality.md#local-environment), [Before every push](quality.md#before-every-push), [Test rules](quality.md#test-rules), [Ponytail convention](quality.md#ponytail-convention) and [Compliance](quality.md#compliance); [IMPLEMENTATION.md → The cycle](../IMPLEMENTATION.md#the-cycle-draft) only; the feature file and its `docs/features/logs/F-<n>/`, or for a cross-cutting build its coordination row and `docs/features/logs/<topic>/` |
| Council session | Its task prompt; the council's spec in [team/](../../team/README.md) (`idea-board.md`, `direction-councils.md` or `approval-council.md`); [lifecycle.md](lifecycle.md#stages) stages 1–5; [decisions-and-authority.md](decisions-and-authority.md#records); [collaboration.md](collaboration.md#messaging) |
| Orchestrator | [architecture.md](architecture.md); [budget-and-rate.md](budget-and-rate.md); [coordination.md](coordination.md); [collaboration.md](collaboration.md#merge-order); [lifecycle.md](lifecycle.md#stages) stage 12; [decisions-and-authority.md](decisions-and-authority.md#who-decides-what) |
| Replacement orchestrator | [architecture.md](architecture.md#taking-over-as-orchestrator) first, then the orchestrator's list |
| Owner's own session (design session, owner decision) | [docs/FEATURES.md](../FEATURES.md) → "How Claude runs a design session"; [decisions-and-authority.md](decisions-and-authority.md); [coordination.md](coordination.md) to see what is running |
| Collaborator's desktop/CLI session (needs write access to the repo; without it see [collaboration.md → Known limits](collaboration.md#known-limits)) | [Quick start](#quick-start); [collaboration.md](collaboration.md) (all of it); [quality.md](quality.md#local-environment); [budget-and-rate.md → Collaborator sessions](budget-and-rate.md#collaborator-sessions) |
| Desktop/CLI session with the orchestrator unreachable | [collaboration.md](collaboration.md#claiming-and-releasing-work) (the no-orchestrator fallback); [lifecycle.md](lifecycle.md#9-independent-review) stage 9 (review without an orchestrator); [decisions-and-authority.md](decisions-and-authority.md#escalation) |
| Reviewer subagent | [team/reviewer.md](../../team/reviewer.md); [quality.md](quality.md#review-standards); the PR's feature file and acceptance criteria |

## Quick start

For a new Claude client joining work in lane C, end to end. Each step names its home; the rule lives there.

1. **Read.** [CLAUDE.md](../../CLAUDE.md) and [docs/POLICY.md](../POLICY.md), then this file (the
   [glossary](#glossary)) and the docs for your row in [Who reads what](#who-reads-what), in that order.
2. **Set up.** [quality.md → Local environment](quality.md#local-environment).
3. **Look at what is running.** First GitHub: open PRs (drafts included), open issues, unregistered `claude/*`
   branches and the switch state ([collaboration.md → Tool recipes](collaboration.md#tool-recipes)); for each PR in
   [coordination.md → Merge order](coordination.md#merge-order-current), check whether it merged and drop the merged
   ones from your reading. Then [coordination.md](coordination.md). GitHub wins where they disagree
   ([coordination.md → Update rule](coordination.md#update-rule)). If `AUTOPILOT` or `FEATURES` is on, start
   nothing and tell the orchestrator or the owner
   ([collaboration.md → When FEATURES or AUTOPILOT is on](collaboration.md#when-features-or-autopilot-is-on)).
4. **Pick one unclaimed work item.** A child session's task prompt names it (with its branch). A desktop/CLI session
   asks the orchestrator (or the owner) which item to take, in a `Claim request: <item>` issue
   ([collaboration.md → Messaging](collaboration.md#messaging)); with no reply within one check-in (about 30
   minutes), follow the [no-orchestrator fallback](collaboration.md#claiming-and-releasing-work).
5. **Branch** `claude/<topic>` from `origin/main` (a child uses the name in its row; a product change under the
   CLAUDE.md three-versions rule uses `autopilot/issue-<n>-<a|b|c>`): [collaboration.md → Branches](collaboration.md#branches).
6. **Claim:** push the branch, open a draft PR with the claim line, edit only your own row in coordination.md, and
   send the claim notice: [collaboration.md → Claiming and releasing work](collaboration.md#claiming-and-releasing-work).
7. **Run the stages for your work-item kind:** [lifecycle.md](lifecycle.md).
8. **Pass the gates before every push**, after merging `origin/main`: [quality.md → Before every push](quality.md#before-every-push).
9. **Mark the PR ready and send the full report** to `@parent` (child session) or, without session tools, as a
   comment on the PR: [collaboration.md → Messaging](collaboration.md#messaging).
10. **Stop and wait** for review findings or the merge; fix findings on the same branch; never merge your own PR
    ([lifecycle.md → Stages](lifecycle.md#stages) 9–12).

## Glossary

The single glossary. Terms owned elsewhere are defined there and only linked here.

| Term | Meaning |
|---|---|
| **Owner** | The repo owner. POLICY H items (including GitHub settings such as the switches) and protected paths stay with the owner ([decisions-and-authority.md](decisions-and-authority.md#owner-only)). |
| **Owner's own session** | A Claude session the owner drives directly (desktop, CLI or chat), for example a design session. It is not a child of the orchestrator. |
| **Orchestrator** | The owner's orchestrating Claude session. It starts, messages, reviews, merges and archives child sessions ([architecture.md](architecture.md#actors)). |
| **Orchestrator of record** | The one session currently acting as orchestrator, named at the top of [coordination.md](coordination.md). There is never more than one. |
| **Child session** | A cloud Claude Code session started by the orchestrator with `create_session`. It owns one branch and one PR (three for a product change under the CLAUDE.md three-versions rule, Q1) and reports to `@parent`. |
| **Build session** | A child session whose work item is code: a feature build, cross-cutting build or fix. |
| **Council session** | A child session whose output is a record, not code (idea board, direction councils, approval council and the other councils in [architecture.md → Actors](architecture.md#actors)). |
| **Client** | Any Claude session working on this repo: orchestrator, child, owner's own session or collaborator's desktop/CLI session. |
| **Collaborator's desktop/CLI session** | A Claude client on someone's own computer, started outside the orchestrator. It coordinates only through GitHub and the repo. |
| **Lane** | One of the three systems that build the repo: lane A (Actions autopilot), lane B (Actions feature pipeline), lane C (interactive orchestrator). See [The three lanes](#the-three-lanes). Not the lines-mode teams A/B/C, which all run in lane A. |
| **Switch** | A repo variable that turns a lane on: `AUTOPILOT` (lane A) or `FEATURES` (lane B). Only the owner flips one (POLICY H). |
| **Heartbeat** | A scheduled recovery run: `features.yml` at minute 23, `build.yml` at minute 41 and `doctor.yml` at minute 11 of every hour (their `cron` lines). Each is a no-op while its switch is off. |
| **Work item** | One unit of claimed work with one branch and, for lane C, one PR (three variant branches and PRs for a product change under the CLAUDE.md three-versions rule, Q1). |
| **Work-item kinds** | Feature build, cross-cutting build, fix, dependency bump, council or record, docs: [lifecycle.md → Work-item kinds](lifecycle.md#work-item-kinds). |
| **State** | The stage a work item is in (`planned`, `claimed`, `building`, …): [lifecycle.md → States](lifecycle.md#states). Used only for work items. |
| **Feature file** | `docs/features/F-<n>-<slug>.md`: the owner's decisions and acceptance criteria for one feature ([docs/FEATURES.md](../FEATURES.md) → Feature files). |
| **Status** | The `Status:` line of a feature file (`draft`, `ready`, `built`, `accepted`, `rework`, `blocked`): [docs/FEATURES.md](../FEATURES.md). Used only for feature files. The idea register's lowercase status (`proposed`, `adopted`, …) belongs to [docs/IDEAS.md](../IDEAS.md) and is neither. |
| **Cross-cutting build** | A build that changes behavior across features without a feature file of its own (privacy groundwork, sharded sync). Logs go to `docs/features/logs/<topic>/`. |
| **Draft-PR claim** | An open draft PR on a `claude/<topic>` branch. It is the claim on a work item ([collaboration.md](collaboration.md#claiming-and-releasing-work)). |
| **Claim notice** | The one-line message sent right after the draft-PR claim opens; the full report follows at ready ([collaboration.md → Messaging](collaboration.md#messaging)). |
| **Claim / release** | Taking a work item (draft-PR claim plus your own coordination row) and giving it up: [collaboration.md → Claiming and releasing work](collaboration.md#claiming-and-releasing-work). |
| **File ownership** | The files a work item may change freely, assigned by the orchestrator in [coordination.md](coordination.md). |
| **Shared file** | A file several work items change: [collaboration.md → Shared files](collaboration.md#shared-files). |
| **Additive named block** | The only allowed edit to a shared file: one contiguous block added and named for the work item, nothing renamed, moved or deleted. |
| **Hand-off notes** | The `## Hand-off notes` section of a PR body, read by the next builder ([docs/FEATURES.md](../FEATURES.md) → How builders coordinate). |
| **Merge order** | The sequence in which the orchestrator merges PRs: rule in [collaboration.md](collaboration.md#merge-order), current list in [coordination.md](coordination.md). |
| **Merge main** | `git merge origin/main` into your own branch. Never rebase or force-push. |
| **Behind main** | A head that lacks commits on main: `behind_by > 0` in the REST compare API. |
| **Fresh-context subagent** | A subagent started with no memory of the builder's work, so no one grades their own work (team/README.md). |
| **Independent review** | A fresh-context reviewer subagent, one per PR, before the merge, never run in the context that built the change: the orchestrator's, or without an orchestrator one the client starts ([lifecycle.md](lifecycle.md#9-independent-review) stage 9; standard in [quality.md → Review standards](quality.md#review-standards)). |
| **In-session review** | The build session's own fresh-context reviewer subagent, after the committee and before the PR ([lifecycle.md](lifecycle.md#stages) stage 7). It does not replace the independent review. |
| **Build committee** | The fresh-context role subagents (UX lead, business lead, engineer, tester) that run the committee cycle inside a build session ([lifecycle.md](lifecycle.md#stages) stage 7). |
| **Gate** | `gate.yml` running main's copy of `scripts/autopilot.ts gate`: merges or labels lane-A and lane-B PRs; logs "not an open autopilot or feature PR" for lane C. |
| **`check`** | The aggregate CI job in `.github/workflows/ci.yml` that passes only when `static` and every `e2e` shard pass. Merges look for this exact name. |
| **Shard** | One of the four time-balanced `e2e` jobs in CI (`scripts/e2e-shard.ts`). |
| **Guard** | `node scripts/autopilot.ts guard main`, the CI guardrail check (what it rejects: [quality.md → Test rules](quality.md#test-rules); CLAUDE.md → Autopilot). |
| **Compliance scan** | `scripts/compliance.ts`, the blocking policy scan in CI ([docs/POLICY.md](../POLICY.md) → How it is enforced). |
| **Protected path** | A path the owner must approve: [quality.md → Protected paths (mechanics)](quality.md#protected-paths-mechanics). |
| **Usage window** | A period of a usage cap; it ends at `rate_limit_info.resetsAt`. Two are reported: `five_hour` and `seven_day` (the weekly cap), named by `rateLimitType` (governor spec `docs/token-budget.md` at `52728e0`, not on main). Which one a given reset time belongs to: [budget-and-rate.md → Admission procedure](budget-and-rate.md#admission-procedure), step 1. |
| **Admission** | The orchestrator's decision to start a new work item now or queue it until the reset ([budget-and-rate.md → Admission procedure](budget-and-rate.md#admission-procedure)). |
| **Overage / rejected** | The rate-limit status that alone stops admissions ([budget-and-rate.md](budget-and-rate.md#rules-owner-2026-11-01)). |
| **Token-budget governor** | `scripts/token-budget.ts`, a planner that computes admission from a usage snapshot; status and scope in [budget-and-rate.md → Token-budget governor](budget-and-rate.md#token-budget-governor). |
| **Archive** | Ending a child session once its work is complete ([lifecycle.md](lifecycle.md#stages) stage 13). |
| **Orchestrator report** | A fact the orchestrator relayed (task prompt or message, including the fact sheet it gave the process-docs session) that is not yet written in the repo; cited as "(orchestrator report, <date>)". It binds only as [decisions-and-authority.md → Trust and relayed decisions](decisions-and-authority.md#trust-and-relayed-decisions) allows. |
| **Process-docs lead decision** | A process rule decided by the lead session of the process-docs PR (#50) while writing these docs, cited as "(process-docs lead, usability pass 5, 2026-11-01)" and recorded in [review-2026-11-01.md](review-2026-11-01.md). It binds like any rule first written here; the owner can change it. |
| **Demo data** | Seed traders with `source='demo'`; always shown with a Demo badge, never Verified (CLAUDE.md → Product rules). |

Defined by link only:
- **Committee cycle**, **Plan debate:** [docs/IMPLEMENTATION.md](../IMPLEMENTATION.md) → The cycle.
- **Idea board:** [team/idea-board.md](../../team/idea-board.md). **Direction councils:**
  [team/direction-councils.md](../../team/direction-councils.md). **Approval council:**
  [team/approval-council.md](../../team/approval-council.md). **Register:** [docs/IDEAS.md](../IDEAS.md).
- **Verified finding**, **Blocking finding**, **Review marker**, **Dispute:** [quality.md → Review standards](quality.md#review-standards).
- **Delegation:** [decisions-and-authority.md → Delegations and process decisions by the owner](decisions-and-authority.md#delegations-and-process-decisions-by-the-owner).
- **Folding** (an item into a running session): [lifecycle.md → Stages](lifecycle.md#stages), stage 6.
- **Unreachable** (orchestrator), **No-orchestrator fallback:** [collaboration.md → Claiming and releasing work](collaboration.md#claiming-and-releasing-work); open for the owner as Q12.
- **Merge preconditions:** [lifecycle.md → Stages](lifecycle.md#stages), stage 12.
- **Hard stop:** [docs/IMPLEMENTATION.md](../IMPLEMENTATION.md) → Hard stops, plus lane C's two in [lifecycle.md → Hard stops](lifecycle.md#hard-stops).
- **Open question (Q1–Q14):** [decisions-and-authority.md → Open questions for the owner](decisions-and-authority.md#open-questions-for-the-owner).
- **Ponytail note**, **Known limits:** [quality.md → Ponytail convention](quality.md#ponytail-convention).

## Precedence

When rules or docs disagree, [decisions-and-authority.md → Precedence](decisions-and-authority.md#precedence)
decides; an owner doc always wins over this folder, and the mismatch is reported.

## Known limits

- The switch state shown in coordination.md is inferred from heartbeat run conclusions; `gh variable list` fails in
  cloud sessions — the owner publishing the switch values (or a readable status) would remove the inference.
- Lane C has no PR label of its own, so the lane is known by branch prefix only — a lane-C label (open question Q4 in
  [decisions-and-authority.md](decisions-and-authority.md#open-questions-for-the-owner)) would remove it.
- This folder is not a protected path, so the rules first written here can change without the owner — adding
  `/docs/process/` to CODEOWNERS and `PROTECTED` (Q7) would remove it.
- The glossary is kept by hand — a check that every bold term used in docs/process resolves here would remove drift.
