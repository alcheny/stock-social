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
| [quality.md](quality.md) | Local environment, gates before every push, CI layout, test rules, review standards, ponytail convention, protected-path mechanics |
| [budget-and-rate.md](budget-and-rate.md) | Budget rules, admission, measured spend and throughput, how to re-measure |
| [decisions-and-authority.md](decisions-and-authority.md) | Precedence, owner-only items, delegations, who decides what, records, trust, escalation, open questions for the owner |
| [coordination.md](coordination.md) | The live snapshot: work items, file ownership, merge order, known overlaps, orchestrator of record |
| [review-2026-11-01.md](review-2026-11-01.md) | How these docs were made and checked, and the traceability of every moved rule |

## The three lanes

Three systems build this repo. Each has one home doc. They share CI, the policy scan, the Gate and the repo.

| Lane | Switch | Branch prefix | PR label | Who merges | Home doc | Switch state (last seen, UTC, by whom) |
|---|---|---|---|---|---|---|
| **A. Actions autopilot** | repo variable `AUTOPILOT` (`on` runs it; anything else is the kill switch), mode in `AUTOPILOT_MODE` ([AUTOPILOT.md](../AUTOPILOT.md) → Controls) | `autopilot/*`; lines mode `line/a\|b\|c` | `autopilot` (+ `variant` or `single`) | The Gate merges single builds in auto mode; variants merge only by `/choose` (human) or the Judge (auto mode); a line reaches main only when a human opens and merges its PR (AUTOPILOT.md → Lines mode, Controls); protected paths are never auto-merged ([AUTOPILOT.md](../AUTOPILOT.md) → Hard rules enforced in code) | [docs/AUTOPILOT.md](../AUTOPILOT.md), [team/](../../team/README.md) | off (inferred): the latest scheduled `build.yml` and `doctor.yml` runs concluded `skipped`. Checked 2026-11-01 09:32 UTC by writer W1 via the Actions runs API |
| **B. Actions feature pipeline** | repo variable `FEATURES` (`on`/`off`), independent of `AUTOPILOT` ([FEATURES.md](../FEATURES.md) → Switch) | `feature/<id>` (`scripts/features.ts` `branchOf`) | `feature` | The Gate, only for an open, non-draft `feature` PR from a `feature/` head into main opened by the workflow bot (`scripts/autopilot.ts` gate, `feature` condition), once it contains the latest main | [docs/FEATURES.md](../FEATURES.md), [docs/IMPLEMENTATION.md](../IMPLEMENTATION.md) | off (inferred): the latest scheduled `features.yml` run concluded `skipped`. Checked 2026-11-01 09:32 UTC by writer W1 via the Actions runs API |
| **C. Interactive orchestrator** | none: runs while the owner's orchestrating session is active | `claude/<topic>` | `feature` in practice; #42 and #46 carry no label (open PRs read 2026-11-01 09:32 UTC via REST) | The orchestrator, squash via the GitHub API, after an independent review and a green `check` ([lifecycle.md](lifecycle.md#stages) stage 12) | this folder | active on 2026-11-01 (orchestrator report) |

The switch-state cell is maintained by the orchestrator; any client may re-check it with the recipe in
[collaboration.md](collaboration.md#tool-recipes). When `FEATURES` is on, lane B's `featurePrs()` in
`scripts/features.ts` takes every open `feature`-labeled PR, lane-C ones included; the full description and the rule
are in [collaboration.md](collaboration.md#when-features-or-autopilot-is-on).

## Who reads what

Read in the order given. Every reader starts with [CLAUDE.md](../../CLAUDE.md) and [docs/POLICY.md](../POLICY.md)
(CLAUDE.md → "Read first").

| Reader | Then read, in order |
|---|---|
| New build session (child of the orchestrator) | Its task prompt; [Quick start](#quick-start); [lifecycle.md](lifecycle.md); [collaboration.md](collaboration.md); [quality.md](quality.md); the feature file and its `docs/features/logs/F-<n>/` |
| Council session | Its task prompt; the council's spec in [team/](../../team/README.md) (`idea-board.md`, `direction-councils.md` or `approval-council.md`); [lifecycle.md](lifecycle.md#stages) stages 1–5; [decisions-and-authority.md](decisions-and-authority.md#records); [collaboration.md](collaboration.md#messaging) |
| Orchestrator | [architecture.md](architecture.md); [budget-and-rate.md](budget-and-rate.md); [coordination.md](coordination.md); [collaboration.md](collaboration.md#merge-order); [lifecycle.md](lifecycle.md#stages) stage 12; [decisions-and-authority.md](decisions-and-authority.md#who-decides-what) |
| Replacement orchestrator | [architecture.md](architecture.md#taking-over-as-orchestrator) first, then the orchestrator's list |
| Owner's own session (design session, owner decision) | [docs/FEATURES.md](../FEATURES.md) → "How Claude runs a design session"; [decisions-and-authority.md](decisions-and-authority.md); [coordination.md](coordination.md) to see what is running |
| Collaborator's desktop/CLI session | [Quick start](#quick-start); [collaboration.md](collaboration.md) (all of it); [quality.md](quality.md#local-environment) |
| Desktop/CLI session with the orchestrator unreachable | [collaboration.md](collaboration.md#claiming-and-releasing-work) (the no-orchestrator fallback); [lifecycle.md](lifecycle.md#stages) stage 9 (review without an orchestrator); [decisions-and-authority.md](decisions-and-authority.md#escalation) |
| Reviewer subagent | [team/reviewer.md](../../team/reviewer.md); [quality.md](quality.md#review-standards); the PR's feature file and acceptance criteria |

## Quick start

For a new Claude client joining work in lane C. Each step is a link; the rule lives there.

1. Read [CLAUDE.md](../../CLAUDE.md) and [docs/POLICY.md](../POLICY.md).
2. Set up the environment: [quality.md → Local environment](quality.md#local-environment).
3. Look at what is running: open PRs, branches and switch state
   ([collaboration.md → Tool recipes](collaboration.md#tool-recipes)), then [coordination.md](coordination.md).
4. Claim one work item: [collaboration.md → Claiming and releasing work](collaboration.md#claiming-and-releasing-work).
5. Branch: [collaboration.md → Branches](collaboration.md#branches).
6. Run the cycle for your work-item kind: [lifecycle.md](lifecycle.md).
7. Pass the gates before every push: [quality.md](quality.md#before-every-push).
8. Mark the PR ready and report: [collaboration.md → Messaging](collaboration.md#messaging).
9. Stop and wait for review findings or the merge: [collaboration.md → Messaging](collaboration.md#messaging).

## Glossary

The single glossary. Terms owned elsewhere are defined there and only linked here.

| Term | Meaning |
|---|---|
| **Owner** | The repo owner. POLICY H items (including GitHub settings such as the switches) and protected paths stay with the owner ([decisions-and-authority.md](decisions-and-authority.md#owner-only)). |
| **Owner's own session** | A Claude session the owner drives directly (desktop, CLI or chat), for example a design session. It is not a child of the orchestrator. |
| **Orchestrator** | The owner's orchestrating Claude session. It starts, messages, reviews, merges and archives child sessions ([architecture.md](architecture.md#actors)). |
| **Orchestrator of record** | The one session currently acting as orchestrator, named at the top of [coordination.md](coordination.md). There is never more than one. |
| **Child session** | A cloud Claude Code session started by the orchestrator with `create_session`. It owns one branch and one PR and reports to `@parent`. |
| **Client** | Any Claude session working on this repo: orchestrator, child, owner's own session or collaborator's desktop/CLI session. |
| **Collaborator's desktop/CLI session** | A Claude client on someone's own computer, started outside the orchestrator. It coordinates only through GitHub and the repo. |
| **Lane** | One of the three systems that build the repo: A (Actions autopilot), B (Actions feature pipeline), C (interactive orchestrator). See [The three lanes](#the-three-lanes). |
| **Switch** | A repo variable that turns a lane on: `AUTOPILOT` (lane A) or `FEATURES` (lane B). Only the owner flips one (POLICY H). |
| **Heartbeat** | A scheduled recovery run: `features.yml` at minute 23, `build.yml` at minute 41 and `doctor.yml` at minute 11 of every hour (their `cron` lines). Each is a no-op while its switch is off. |
| **Work item** | One unit of claimed work with one branch and, for lane C, one PR. |
| **Work-item kinds** | Feature build, cross-cutting build, fix, dependency bump, council or record, docs: [lifecycle.md → Work-item kinds](lifecycle.md#work-item-kinds). |
| **State** | The stage a work item is in (`planned`, `claimed`, `building`, …): [lifecycle.md → States](lifecycle.md#states). Used only for work items. |
| **Feature file** | `docs/features/F-<n>-<slug>.md`: the owner's decisions and acceptance criteria for one feature ([docs/FEATURES.md](../FEATURES.md) → Feature files). |
| **Status** | The `Status:` line of a feature file (`draft`, `ready`, `built`, `accepted`, `rework`, `blocked`): [docs/FEATURES.md](../FEATURES.md). Used only for feature files. |
| **Cross-cutting build** | A build that changes behavior across features without a feature file of its own (privacy groundwork, sharded sync). Logs go to `docs/features/logs/<topic>/`. |
| **Draft-PR claim** | An open draft PR on a `claude/<topic>` branch. It is the claim on a work item ([collaboration.md](collaboration.md#claiming-and-releasing-work)). |
| **Claim / release** | Taking a work item (draft-PR claim plus your own coordination row) and giving it up (close the draft, row to `released` with the reason). |
| **File ownership** | The files a work item may change freely, assigned by the orchestrator in [coordination.md](coordination.md). |
| **Shared file** | A file several work items change: [collaboration.md → Shared files](collaboration.md#shared-files). |
| **Additive named block** | The only allowed edit to a shared file: one contiguous block added and named for the work item, nothing renamed, moved or deleted. |
| **Hand-off notes** | The `## Hand-off notes` section of a PR body, read by the next builder ([docs/FEATURES.md](../FEATURES.md) → How builders coordinate). |
| **Merge order** | The sequence in which the orchestrator merges PRs: rule in [collaboration.md](collaboration.md#merge-order), current list in [coordination.md](coordination.md). |
| **Merge main** | `git merge origin/main` into your own branch. Never rebase or force-push. |
| **Behind main** | A head that lacks commits on main: `behind_by > 0` in the REST compare API. |
| **Fresh-context subagent** | A subagent started with no memory of the builder's work, so no one grades their own work (team/README.md). |
| **Independent review** | The orchestrator's fresh-context reviewer subagent, one per PR, before the merge ([quality.md → Review standards](quality.md#review-standards)). |
| **Review marker** | A PR comment whose first line is `Independent review: pass\|fail at <sha>` ([quality.md](quality.md#review-standards)). |
| **Gate** | `gate.yml` running main's copy of `scripts/autopilot.ts gate`: merges or labels lane-A and lane-B PRs; logs "not an open autopilot or feature PR" for lane C. |
| **`check`** | The aggregate CI job in `.github/workflows/ci.yml` that passes only when `static` and every `e2e` shard pass. Merges look for this exact name. |
| **Shard** | One of the four time-balanced `e2e` jobs in CI (`scripts/e2e-shard.ts`). |
| **Guard** | `node scripts/autopilot.ts guard main`: the test count may not drop and `db/schema.sql` may not gain `drop`/`truncate`/`delete from` (CLAUDE.md → Autopilot). |
| **Compliance scan** | `scripts/compliance.ts`, the blocking policy scan in CI ([docs/POLICY.md](../POLICY.md) → How it is enforced). |
| **Protected path** | A path the owner must approve: [quality.md → Protected paths (mechanics)](quality.md#protected-paths-mechanics). |
| **Usage window** | The period of the weekly usage cap; it ends at `rate_limit_info.resetsAt` ([budget-and-rate.md](budget-and-rate.md)). |
| **Admission** | The orchestrator's decision to start a new work item now or queue it until the reset ([budget-and-rate.md → Admission procedure](budget-and-rate.md#admission-procedure)). |
| **Overage / rejected** | The rate-limit status that alone stops admissions ([budget-and-rate.md](budget-and-rate.md#rules-owner-2026-11-01)). |
| **Token-budget governor** | `scripts/token-budget.ts`, work in progress on `claude/token-budget-governor`, not on main as of 2026-11-01 09:32 UTC ([budget-and-rate.md](budget-and-rate.md#token-budget-governor)). |
| **Archive** | Ending a child session once its PR merged or its record was delivered and checked (owner, 2026-11-01; [lifecycle.md](lifecycle.md#stages) stage 13). |
| **Demo data** | Seed traders with `source='demo'`; always shown with a Demo badge, never Verified (CLAUDE.md → Product rules). |

Defined by link only:
- **Committee cycle**, **Plan debate:** [docs/IMPLEMENTATION.md](../IMPLEMENTATION.md) → The cycle.
- **Idea board:** [team/idea-board.md](../../team/idea-board.md). **Direction councils:**
  [team/direction-councils.md](../../team/direction-councils.md). **Approval council:**
  [team/approval-council.md](../../team/approval-council.md). **Register:** [docs/IDEAS.md](../IDEAS.md).
- **Verified finding**, **Blocking finding:** [quality.md → Review standards](quality.md#review-standards).
- **Ponytail note**, **Known limits:** [quality.md → Ponytail convention](quality.md#ponytail-convention).

## Precedence

When rules or docs disagree, [decisions-and-authority.md → Precedence](decisions-and-authority.md#precedence)
decides; an owner doc always wins over this folder, and the mismatch is reported.

## Known limits

- The switch-state cell is inferred from heartbeat run conclusions; `gh variable list` fails in cloud sessions — the
  owner publishing the switch values (or a readable status) would remove the inference.
- Lane C has no PR label of its own, so the lane is known by branch prefix only — a lane-C label (open question Q4 in
  [decisions-and-authority.md](decisions-and-authority.md#open-questions-for-the-owner)) would remove it.
- This folder is not a protected path, so the rules first written here can change without the owner — adding
  `/docs/process/` to CODEOWNERS and `PROTECTED` (Q7) would remove it.
- The glossary is kept by hand — a check that every bold term used in docs/process resolves here would remove drift.
