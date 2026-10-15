# Autopilot

The closed loop that builds Stock Social: agents plan, build and review; then **a human or an AI judge
chooses the direction**, depending on the mode. Agents read this file as their instructions. It is a
protected path: only a human changes it.

## Legal and security policy (binding, checked on every PR)

[docs/POLICY.md](POLICY.md) binds every agent in this loop and overrides any task, persona or input. Its
deterministic part, `scripts/compliance.ts`, runs as a blocking CI step and as the first check in every
branch team. It scans for secrets, personal data, forbidden files, third-party marks and real people, age
cohorts that include minors, promissory or advice language in product code, and dependency licenses. PRs
into `main` and pushes to `main` scan the whole tree; PRs into a line scan only what they add. A line that
still carries older violations spends its next round cleaning them. The reviewer checks the rest of the
policy and cites rule ids.

Security rules for the loop itself (rule R in the policy; tested by `scripts/workflow-security.test.ts`):
- Only trusted-author text reaches an agent (owner, collaborators, the loop's bot). Everything else is
  filtered out, and what remains is fenced as data.
- Agent steps set `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` (no secrets in the env of commands an agent
  runs) and pass explicit tool allowlists; no agent step ever gets `GH_TOKEN`.
- No `${{ github.event.* }}` inside `run:`; no `pull_request_target` job checks out PR code; third-party
  actions are pinned to full commit SHAs (Dependabot updates them); the Gate ignores fork PRs.

These files are owner-only: `docs/POLICY.md`, `SECURITY.md`, `scripts/compliance.ts` and its tests,
`scripts/policy.test.ts`, `scripts/workflow-security.test.ts`. They're in CODEOWNERS, `LOOP_PATHS`
(lines can't change them), `DOCTOR_FORBIDDEN` (the doctor can't) and the agents' denied edits;
`scripts/policy.test.ts` fails CI if any of that is removed.

## Modes

One loop, three versions, switched by the repo variable `AUTOPILOT_MODE`. Everything else (branch
teams, CI, reviewer, guardrails, protected paths, kill switch) is identical in all three.

A fourth mode, `lines`, runs three autonomous teams that each evolve their own direction, with no human input until you say stop: see **Lines mode** below.

| | `request` | `human` (default) | `auto` |
|---|---|---|---|
| Where work comes from | **Only issues you file** with the `ready` label | Your issues + the Planner's | Your issues + the Planner's |
| When the queue is empty | Waits for you | Planner writes the next tasks | Planner writes the next tasks |
| Planning, branch teams, CI, reviewer, gate, fix loop | Same | **Same** | **Same** |
| Who makes the final merge of a variant set | You: `/choose <why>` or the merge button | You: `/choose <why>` or the merge button | Business-lead (`judge.yml`, rules in `team/judge.md`) |
| `single` PRs (fixes, tests, chores) | Labeled `ready-to-merge`; you merge | Labeled `ready-to-merge`; you merge | Merged by the Gate when green |
| All versions rejected | Issue parked (`needs-human`) | Issue parked (`needs-human`) | Issue parked (`needs-human`) |
| Logged in DECISIONS.md as | `Decided by: human (@you)` | `Decided by: human (@you)` | `Decided by: business-lead (auto mode)` |
| Your role | Request every change, make every merge | Make every merge | Watch; a `/choose` you post first still wins |
| Throughput limited by | How fast you request and merge | How fast you merge | Your Claude usage limit |

**Human and auto are the same process.** Everything up to the final merge is identical: the same
planning debate, branch teams, checks, reviewer, gate and fix loop, the same labels and the same
DECISIONS.md record. The only difference is who makes the final merge: you in human mode, business-lead
(and the Gate, for green `single` PRs) in auto mode.

**Recommended path:** `request` while the product direction is forming; `human` once you want the Planner
to propose work; `auto` once DECISIONS.md has ~10 entries and its Standing direction reflects your taste.
New versions always branch from the newest main: Pick waits while any autopilot PR is open, records main's exact commit, and all variants start from that commit. If main moves after Pick (a choice just landed), the build stops and the merge's own kick starts a fresh one from the new main.

In every mode, a `/choose` you post before a decision is made wins. Once one version is chosen (by `/choose`, business-lead in auto mode, or merging it with the GitHub button) the other versions of that issue close automatically and their branches are deleted.

Never automated in any mode: protected paths, oversized diffs, `stuck` items. These wait for a human. A protected-path PR with failing checks is still repaired by the fix loop first, so what you approve is green; you approve it by commenting `/approve` on the PR (or by merging it yourself).

**`/approve`** (owner or collaborator, on the PR): approves its protected-path changes **at the current
commit only**. The changes stay on the PR's branch, and the Gate then treats it like any other PR: a
green `single` PR merges (auto) or becomes `ready-to-merge` (human), and a variant becomes
`ready-to-choose`. Any new commit (e.g. a fix round) needs a fresh `/approve`, so you never approve code
you haven't seen. Oversized diffs and `stuck` PRs still wait for you.

**Usage limit (every mode):** if Claude reports a usage limit, the run records it on the issue and new
work pauses for `LIMIT_COOLDOWN_HOURS`; the 6-hourly heartbeat resumes it. Each branch team's cost is
recorded on its issue too.

## Lines mode (`AUTOPILOT_MODE=lines`): three autonomous teams, no human input

Three teams each grow their own version of the product, in parallel, on their own branch, round after
round, until a human says stop in the Claude chat. **No team starts with a direction**: a one-time kickoff
gives each a different first step, and from then on each line's direction is whatever its own rounds make
it. Lines never merge into `main` and never wait for a human. When you come back, you compare
`line/a`, `line/b` and `line/c` and merge the one(s) you want.

```
kickoff (once, plan.yml kickoff=true): business lead ⇄ engineer pick 3 different FIRST STEPS
   └─► issues "Line A", "Line B", "Line C" (label `line`); branches line/a|b|c start at main
                    │ all three lines run in parallel, independently
                    ▼
 round n of line X ─ plan: business lead ⇄ engineer choose X's next step from X's own history and the
                    │       other two lines' (to stay distinct); round 1 uses the kickoff step
                    ▼
                    build: branch team on a branch off line/X (spec → engineer ⇄ tester, 3-engineer fixes)
                    ▼
                    PR into line/X → CI → Reviewer → Gate
                       green ─────────────► merged into line/X; round n+1 starts immediately
                       red ───────────────► fix loop, up to LINE_MAX_ATTEMPTS (10)
                                              still red → PR closed; line/X is still its last good state;
                                              round n+1 is planned from there
                       touches loop files ─► sent back to the fix loop to revert them (never merged)
```

### What can't stop a line, and how

| Past stop or edge case | Handling in lines mode |
|---|---|
| A PR waiting for a human (protected paths, `/approve`, big diffs) | Never happens: product files protected for `main` (`lib/broker.ts`, `package.json`, ...) may change on a line, since nothing reaches `main` without you; diff size isn't checked. **Loop files** (`LOOP_PATHS` in `scripts/autopilot.ts`: `.github/`, the loop scripts, `team/`, `CLAUDE.md`, `docs/AUTOPILOT.md`, `docs/DESIGN.md`, `docs/DECISIONS.md`, `playwright.config.ts`) are failed back to be reverted, so a line can't loosen its own rules. |
| A round that keeps failing | 10 fix attempts, then the PR is abandoned and the line continues from its last good state (the line branch only ever receives green PRs). |
| A run that dies (review crash, lost dispatch, gate error) | `nudge`: any line PR quiet for `STALL_MINUTES` (45) gets its CI, review or gate re-dispatched. |
| A round that fails before opening a PR (plan or team crash, nothing built) | The hourly heartbeat starts the line's next round. |
| Leftover branches from failed attempts | A new round force-pushes its branch. |
| A line branch created mid-run (round 1) | Publish fetches the base before comparing (this broke the first launch). |
| Loop changes merged to `main` while lines run | Build runs `main`'s snapshot of the loop scripts and team specs, and every round or fix first syncs the line's loop files (CI workflow, guard, specs) to `main`'s in one script-made commit, so CI on line PRs uses the current guard. |
| A fixer's work lost because it was left uncommitted, or a fix attempt that pushed nothing | Publish commits and pushes whatever the team left, finished or not, and CI judges it. A fix attempt that changed nothing re-kicks the line at once (bounded by `LINE_MAX_ATTEMPTS`); a crashed fix run does too. |
| Claude's permission classifier blocking allowlisted commands (it blocked a `git commit` as a "CI bypass") | Agent calls run with `--permission-mode dontAsk`: exactly the allowlisted tools, no classifier. The runner has no write credentials, and the Gate still rejects loop-file changes. |
| Guard false positive on a SQL comment ("never drop this table") | The schema guard ignores `--` comments. |
| Daily PR cap | Removed (`DAILY_PR_CAP` unset = no cap). |
| Claude usage limit | All lines pause for `LIMIT_COOLDOWN_HOURS`, then the heartbeat resumes them. |
| Lines converging on the same thing | Each round's planners see the other two lines' history and must stay distinct; the kickoff starts them far apart. |

| Anything not in this table: the loop itself keeps failing | The **Doctor** (below) diagnoses it and fixes the loop's own files, then the lines continue. |

### Doctor: the loop fixes itself

`doctor.yml` runs hourly, independently of the build loop, with its own script (`scripts/doctor.ts`, which
doesn't import `autopilot.ts`, so a broken loop can't disable it). Spec: [team/doctor.md](../team/doctor.md).

```
stuck? (scripts/doctor.ts detect)
  no round merged for STUCK_HOURS (3) and no build running, or a round abandoned after 10 attempts
  not stuck if: a PR waits for a human, a usage-limit pause, or the doctor treated it < 2h ago
      │ yes
      ▼
diagnose: line issue + PR comments, recent runs, failed-run logs → .autopilot/doctor.md
      ▼
treat: one Claude call (no GitHub credentials) edits the loop's own files, updates these docs, runs tests
      │ needs a human? → note on the line issue, nothing changed
      ▼
PR into main (label `doctor`) → CI (incl. invariants, workflow lint) → Reviewer (doctor rules) → Gate
      ▼ merged
every line syncs the fix on its next round (syncLoop) and continues
```

- **May change:** `.github/workflows/` (not `ci.yml`, `gate.yml`, `doctor.yml`), loop scripts in
  `scripts/`, `team/` (not `doctor.md`), `docs/AUTOPILOT.md`, `CLAUDE.md`, `.claude/agents/`.
- **May never change** (`DOCTOR_FORBIDDEN`, enforced by the Gate from `main` and by the doctor's tool
  allowlist): CODEOWNERS, `ci.yml`, `gate.yml`, `doctor.yml`, `scripts/doctor.ts` and its test,
  `scripts/invariants.test.ts`, `team/doctor.md`, `package.json`, `package-lock.json`. Product code is
  out of scope too.
- **Can't weaken the safety rules:** `scripts/invariants.test.ts` pins them (kill switch, nothing merges
  without green CI and review, protected main paths never auto-merge, lines never merge loop files, the
  doctor's limits, the guard, the protected-path list). CI runs it, and the test-count guard stops it
  being deleted.
- **Human carve-out:** if the simplest fix is a human approving or doing something (a protected change,
  CI or Gate changes, dependencies, tokens, billing, outages), the doctor changes nothing and leaves a
  note on the line issue saying what to do.
- **Limits:** one doctor at a time, `DOCTOR_DAILY_MAX` (6) fixes a day, a 2-hour cooldown per line,
  `DOCTOR_BUDGET_USD` ($5) per call. A doctor PR that fails CI or stalls for 2 hours is closed and retried.

**Outside the loop's control:**
- **GitHub Actions minutes.** This is a private repo, so Actions minutes are limited by your plan and spending limit. Three lines running nonstop use a lot of them; if they run out, every workflow stops.
- **The Claude OAuth token** expiring or being revoked.
- **GitHub outages.**

### Controls

- **Stop everything:** say "stop" in the Claude chat (Claude sets `AUTOPILOT` to `off`), or run
  `gh variable set AUTOPILOT -b off`. In-flight runs finish; nothing new starts or merges.
- **Stop one line:** close its `Line X` issue. **Steer a line:** comment on or edit its issue (its
  planners read the issue body as "how this line started").
- **Restart from scratch:** close the three `Line` issues and delete `line/a|b|c`; the next kick runs
  a new kickoff from the current `main`.
- **Ship a line:** `gh pr create --base main --head line/a`, review, merge yourself.
- `LINE_MAX_ATTEMPTS` (10), `STALL_MINUTES` (45), `TEAM_BUDGET_USD` (per round), `QA_ROUNDS`,
  `PLAN_ROUNDS`, `LIMIT_COOLDOWN_HOURS`.

`/approve` never merges into `main` in any mode; in lines mode it isn't needed.

## The loop

**Event-driven, never on a timer.** The loop develops whenever no autopilot PR is open, and waits
whenever one is awaiting checks or a decision. Every event that can free it kicks Build, which then
decides in seconds what to do:

```
        ┌─────────────── no ready issue ──► Plan ── creates issues ──┐
        ▼                                                             │
 Build: anything open? ── yes: failing → fix it · else → wait (exit)  │
        │ no                                                          │
        ▼                                                             │
 3 agents build A · B · C ──► CI + Review ──► Gate ── failure → kick Build (fix)
                                                │ all green
                                                ▼
                     human mode: you /choose · auto mode: Judge
                                                │ merge, close others, record in DECISIONS.md
                                                └──────────────► kick Build ◄─────┘
```

Kicks come from: a decision (`/choose`, `/reject`, Judge), a PR merged or closed (by the Gate or by
hand), a failed check (fix mode), the Planner creating issues, and a human labeling an issue `ready`.
A 6-hourly **recovery heartbeat** runs the same check, so the loop resumes after an outage or when the
daily budget resets; it does nothing while the loop is busy or waiting for you.

| Workflow | Trigger | Agent? | Does |
|---|---|---|---|
| `plan.yml` | Build finds no work | Business lead ⇄ engineer (read-only, `scripts/plan.ts`) | Tops up `ready` issues, each with 3 variant directions; posts the digest; kicks Build |
| `build.yml` | kicked by events (see above) | 3 branch teams in parallel (see Branch team) | Fixes a failing autopilot PR; else, if nothing is open, builds the oldest `ready` issue as A/B/C |
| `ci.yml` | PRs, pushes, dispatched by the loop | none | Types, unit tests, guardrails, schema + seed, build, e2e. On pass it starts Review; on failure it goes straight to the Gate (cheap checks first) |
| `review.yml` | autopilot PRs | Reviewer (read-only) | Verdict → commit status `ai-review` |
| `gate.yml` | after CI/Review | none | Variants → `ready-to-choose`; single builds → merge/label (runs main's copy, never the PR's) |
| `choose.yml` | `/choose` or `/reject` comment, or a variant merged on GitHub | none | Merges the pick, closes every sibling version (and its branch), writes `docs/DECISIONS.md` |
| `judge.yml` | dispatched by the Gate (auto mode) | Judge (read-only) | Picks a version; same merge/close/record path as `/choose` |
| `queue.yml` | PR closed/labeled by hand | none | Refreshes the pinned **Review queue** issue (Gate/Choose/Judge also refresh it); a close kicks Build |

**Core principle: agents never hold write access to GitHub.** They read, edit files locally and return
JSON. `scripts/autopilot.ts` does every push, label, comment, issue, merge and decision record, so the
loop's rules are tested code (`scripts/autopilot.test.ts`), not prompt instructions.

## Variants

Every **product change** is built three ways by three independent agents (separate jobs, branches,
contexts and PRs: they cannot see or copy each other). Each PR documents:

- **Direction:** the bet this version makes, in one or two sentences
- **Design choices:** what the user sees and how it's built
- **Business rationale:** which metric or DESIGN goal it moves, and why
- **Trade-offs:** what it gives up compared to the other directions
- **What to measure:** how we'd know after shipping whether it was right

**Choosing:** when all versions settle, the issue gets a comment listing them. In human mode, comment
`/choose <why>` on the one you want: it merges, the others close, and the decision with all three
options goes into `docs/DECISIONS.md`. `/reject <why>` discards all three. In auto mode the Judge does
the same thing with its own *why*. Either way, the *why* is the most valuable line in the log: future
planning reads it.

**Single builds:** issues labeled `single` (fixes, tests, chores, dependency bumps) build one version.
They merge automatically only in auto mode. Variant PRs are never merged without a choice.

**Default lenses** when an issue has no `## Variants` section: A · Lean (Engineer), B · Growth
(Business Lead), C · Trust (CEO), the same three perspectives as `docs/DESIGN.md`.

## Reviewing

**Start at the pinned "Review queue" issue.** It always lists, oldest first:
- **Decide:** every task whose versions have finished, each version with its direction, business bet,
  what it gives up, check status, size, a **▶ Preview** link, and **Compare code** links (A↔B, A↔C, B↔C)
- **Merge or fix:** finished `single` PRs, and anything the Gate parked for you, with the reason
- **Still building:** what's in progress

Open a version's PR and comment `/choose <why>`. In the GitHub mobile app, subscribe to the queue issue
and the "Autopilot log" issue to get notified. Everything you've decided is in `docs/DECISIONS.md`.

**Preview links** need Vercel + Neon (one-time, ~5 minutes, your accounts):
1. vercel.com → Add New Project → import `stock-social`. Framework: Next.js (detected). It builds with
   `npm run vercel-build`, which applies the schema and, on previews only, seeds demo data.
2. In the Vercel project: Storage / Integrations → **Neon** → create a database and enable a **branch per
   preview deployment**. This sets `DATABASE_URL` for every preview automatically.
3. Vercel → Settings → Environment Variables: `APP_SECRET_KEY` and `CRON_SECRET` (random strings, all
   environments) and `ALLOW_DEV_AUTH=1` for **Preview only** (the dev sign-in stub).
4. Keep Vercel's default **Deployment Protection** on for previews, so only you can open them.

Before real users exist, also make Neon preview branches start from a seeded dev branch, not
production: a Neon branch copies its parent's data.

**Locally:** `gh pr checkout <n> && npm run dev`, or ask Claude in the desktop app to open the
`stock-social` preview in its browser pane (`.claude/launch.json`).

## Controls (repo Settings → Secrets and variables → Actions → Variables)

| Variable | Default | Meaning |
|---|---|---|
| `AUTOPILOT` | unset = **off** | `on` runs the loop. Anything else is the kill switch: every agent workflow skips, and the Gate merges nothing |
| `AUTOPILOT_MODE` | unset = **human** | `request`, `human` or `auto`. See Modes |
| `SPEC_ROUNDS` | 2 | Designer ⇄ business analyst rounds per branch |
| `QA_ROUNDS` | 20 | Engineer ⇄ tester rounds per branch (each failing-checks round tries up to three engineers) |
| `TEAM_BUDGET_USD` | 15 | Spend cap per branch team (all role calls) |
| `MODEL_ENGINEER` | CLI default | Engineer's model (building and planning); the branch team's other roles use `sonnet` |
| `PLAN_ROUNDS` | 4 | Planning replies after business-lead's draft before the latest plan is used |
| `PLAN_BUDGET_USD` | 6 | Spend cap per planning discussion |
| `DAILY_PR_CAP` | unset = no cap | Optional budget guard: no new builds after this many autopilot PRs in a rolling 24h |
| `MAX_ATTEMPTS` | 3 | Attempts per issue/PR before it's labeled `stuck` + `needs-human` |
| `MAX_READY` | 3 | Planner keeps this many `ready` issues queued |
| `MAX_DIFF` | 800 | PRs with more changed lines go to `needs-human` |
| `LIMIT_COOLDOWN_HOURS` | 5 | Pause new work after a Claude usage-limit error |

Secret: `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`). Requires the Claude GitHub App installed on this repo.

## Hard rules enforced in code

- **Protected paths** (`.github/CODEOWNERS`) are never auto-merged.
- **Test count can't drop** and **schema changes can't add `drop`/`truncate`/`delete from`** (CI `guard`).
- **Only trusted issues** (repo owner or the Plan workflow) are ever given to a branch team (in `request` mode, only the owner's).
- **Merges** of single builds require CI job `check` = success **and** an `ai-review` status written by
  the Review workflow on the exact head commit. `/choose` requires green CI on the chosen version.
- **`/choose` and `/reject`** are honored only from the repo owner, members or collaborators.
- **The Judge can only pick a `ready-to-choose` version** (green CI and review); anything else is
  recorded as a rejection. It runs only when `AUTOPILOT=on` and `AUTOPILOT_MODE=auto`.
- **Cheap checks first:** the AI Review runs only after CI's deterministic checks pass; inside each branch
  team, the tester runs only after type check, unit tests, build and e2e pass.
- **Request mode:** only issues filed by the repo owner are built, and the Planner never runs.
- **Circuit breaker:** `MAX_ATTEMPTS` per item, one issue in flight, `DAILY_PR_CAP` per 24h,
  `SPEC_ROUNDS`/`QA_ROUNDS`/`TEAM_BUDGET_USD` per branch, one Build run at a time.

## Industry patterns, and where each is enforced

| Problem | Pattern | Enforced by |
|---|---|---|
| An agent grades its own work | Maker/checker: separate roles, fresh context, the checker can't edit | Branch team (tester has no edit tools) and the independent Reviewer workflow |
| An agent "passes" by editing tests | Guardrails in code, not prompts | CI `guard` (test count, destructive SQL), protected paths in `.github/CODEOWNERS` |
| Bad code lands on `main` | PR + required checks | Gate merges only the exact checked commit with green `check` + `ai-review` |
| An agent has too much power | Least privilege | Agents get no GitHub credentials; `scripts/autopilot.ts` pushes, labels and merges |
| Push → CI → agent → push loops | Re-trigger guards | Workflow-token events don't chain; explicit dispatches; concurrency groups; "is work open?" check |
| Runaway cost | Budgets + kill switch | Per-call caps, `TEAM_BUDGET_USD`, `DAILY_PR_CAP`, `AUTOPILOT` switch |
| Unbounded "improve the code" | Small batches, WIP limit of 1 | Scoped issues with acceptance criteria; one issue in flight |
| Slow or expensive checks | Cheap checks first | Deterministic checks gate the tester and the Reviewer |

## Issue format (Planner writes it; humans should too)

```markdown
## Goal
One sentence: what a user can do after this ships.

## Acceptance criteria
- [ ] Observable, testable statements every variant must meet. Each becomes at least one test.

## Variants
### A — <short name>
The direction: what to optimize, the design idea, the business bet. 2–4 sentences.
### B — <short name>
...
### C — <short name>
...

## Test plan
- Unit: which pure function and cases (node:test, *.test.ts)
- E2E: which user flow (Playwright, e2e/*.spec.ts)

## Out of scope
What not to touch. Always: protected paths.

## Design reference
docs/DESIGN.md section(s) and docs/DECISIONS.md entries this builds on.
```

Omit `## Variants` and set `single` for fixes, tests and chores.

## Planning: business lead ⇄ engineer

When the queue runs low (`plan.yml`, never in request mode), the next issues come out of a debate between
[business-lead](../team/business-lead.md) (what and why: market, retention, revenue, the bar) and the
[engineer](../team/engineer.md) (how, how big, and what actually makes people come back, from building
short-video feeds, mobile games and a consumer brokerage). Both follow the issue format and rules in
[team/planner.md](../team/planner.md) (includes the human-approved backlog).

```
business-lead drafts N issues + business case
   │
   ▼
engineer: agree? ──yes──► done (plan agreed)
   │ no: critique + the full revised plan it would sign
   ▼
business-lead: agree? ──yes──► done
   │ no: critique + revised plan
   ▼
… alternating, ≤ PLAN_ROUNDS replies after the draft, ≤ PLAN_BUDGET_USD
```

- Agreement means one side accepts the other's latest plan **unchanged**, so neither can wave its own
  plan through.
- Each call is a fresh, read-only Claude call (`scripts/plan.ts`) with a JSON answer and a $1.5 cap
  (`BUDGET_PLAN_CALL`). Business-lead can also search the web.
- No agreement within the cap: the latest plan is still filed, and the discussion says so.
- Every planned issue gets the full discussion as its first comment, so the branch teams that build it
  read why it exists and what was argued.

## Branch team

Every branch (so every variant A, B and C, and every fix) is built by its own small product team. Each
role is a **separate headless Claude Code call**: fresh context, its own tools, a JSON answer, and turn
and dollar caps. `scripts/team.ts` runs the loops, enforces the caps, and writes everything down. The
agents hold no GitHub credentials; the Publish step pushes afterwards.

```
            ┌──────────── feedback (≤ SPEC_ROUNDS) ────────────┐
            ▼                                                   │
   Designer: spec draft ──► Business analyst: approve? ── no ──┘
            │ yes (or round cap → designer's final revision)
            ▼
   docs/specs/issue-<n>-<v>.md  (agreed spec + discussion, committed in the PR)
            ▼
   Engineer: tests first, then code, to the spec
            ▼
   ┌─► Deterministic checks (type check → unit tests → build → e2e), cheapest first
   │        │ fail: errors go straight back to the engineer (no LLM call spent)
   │        │ pass
   │        ▼
   │   Tester: spec conformance + edge cases + usability at 360px
   │        │ blocking findings
   └──── Engineer fixes ◄┘          (≤ QA_ROUNDS; clean → publish)
```

### Roles

| Role | Model (default) | Tools | Per-call cap | Answers with |
|---|---|---|---|---|
| **Designer** | `sonnet` | read only | $1, 30 turns | spec, summary, direction, design, business, trade-offs, what to measure |
| **Business analyst** | `sonnet` | read only | $0.50, 20 turns | approve, ease of use, retention, virality, feedback |
| **Engineer** | CLI default (frontier) | read, edit, run checks, commit | $4, 150 turns | done, title, summary |
| **Tester** | `sonnet` | read, run checks (no edit tools) | $1.50, 60 turns | pass, findings (bug / usability / spec / note) |

Each role's full spec is in `team/`: [designer](../team/designer.md), [business analyst](../team/business-analyst.md),
[engineer](../team/engineer.md), [tester](../team/tester.md). `scripts/team.ts` points every call at its file.

### Loops and caps (cost control)

- **Spec loop:** up to `SPEC_ROUNDS` (default 2) designer ⇄ business rounds. If they still disagree, the
  designer makes one final revision and the record says so. The business analyst's concerns stay visible
  in the doc for the human.
- **QA loop:** up to `QA_ROUNDS` (default 20). Each round runs the deterministic checks first, and only
  calls the tester if they pass. Failing checks go straight back to the engineer, so a broken build never
  costs a tester call.
- **Three engineers per failing round:** when the deterministic checks fail, three engineers with
  non-overlapping approaches try in turn from the same commit: a **root-cause debugger** (trace and fix
  the cause), a **minimal-diff surgeon** (smallest change; revert or simplify the risky part), and a
  **rebuilder** (re-implement the failing component from the spec). Each sees what the earlier ones tried.
  The first whose checks pass is kept; failed attempts are reset. Tester findings (checks already green)
  go to the root-cause engineer alone, since only another tester call can verify them.
- **Budget:** each call has a dollar and turn cap, and the whole team stops at `TEAM_BUDGET_USD`
  (default $15). A typical clean run is 2 designer + 2 business + 1–2 engineer + 1 tester calls.
- **Exit:** clean (checks pass and no blocking findings) publishes. Open findings after the cap still
  publish, listed in the PR, so CI, the independent Reviewer and you can decide. **Failing checks at the
  cap also publish**: the PR goes red in CI and the fix loop keeps working on it (up to `MAX_ATTEMPTS`,
  then `stuck`, still listed for you as "needs a look"). Only a branch where the engineer built nothing is
  dropped. So every variant set reaches you with all three versions.
- **Clean environment:** before each check run, anything an agent left listening on :3000 is killed (a
  leftover server made Playwright fail every round), and a failing check's output is printed to the job log.

### What the PR records

`docs/specs/issue-<n>-<variant>.md` is committed in each PR and contains the agreed spec, the full
designer ⇄ business discussion (with the analyst's ease-of-use, retention and virality notes), every QA
round with its findings, and the cost per call. The PR body links it. Fix runs append their QA rounds.

## Reviewer

Spec: [team/reviewer.md](../team/reviewer.md).

## Judge (auto mode)

Spec: [team/judge.md](../team/judge.md).

## What stays human

In human mode, choosing between variants. In both modes: switching modes, creating accounts and keys, anything in a protected path, phase changes
(the approved backlog in team/planner.md), curating "Standing direction" in DECISIONS.md, legal gates, production
launch, and the DESIGN week-8 kill decision.

## Known limits

- **Cost is ~3× per change:** three builders and three reviews per product issue. In human mode your
  choosing speed is the loop's throughput; in auto mode it runs continuously up to `DAILY_PR_CAP`.
- **Preview links** appear in the Review queue only after Vercel is connected (see Reviewing).
- **Private repo on GitHub Free:** branch protection isn't available, so nothing *technically* stops
  a direct push to `main`. The agents have no push credentials of their own, which mitigates it. For a
  hard guarantee, upgrade to GitHub Pro and require the `check` and `ai-review` statuses on `main`.
- **Actions minutes:** variants roughly triple Build time. Expect to exceed Free's 2,000 min/month;
  GitHub Pro gives 3,000, or lower `DAILY_PR_CAP`.
- Merges by the loop don't trigger `push` CI, so the loop dispatches CI on `main` after each one; the
  Planner makes a red `main` the top priority.
