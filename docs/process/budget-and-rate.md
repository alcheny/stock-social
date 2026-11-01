# Budget and rate

How much interactive (lane C) work the orchestrator starts, how spend and throughput are measured, and what
the numbers were on 2026-11-01. Terms such as *usage window*, *admission*, *overage/rejected* and
*token-budget governor* are defined in [README → Glossary](README.md#glossary). Lanes A and B have their own
budgets (see [Lanes A and B budgets](#lanes-a-and-b-budgets)).

This file is the first written home of the budget rules below. They are not yet a protected path; the PR
that adds this file asks the owner to protect it (open question Q7 in
[decisions-and-authority.md](decisions-and-authority.md#open-questions-for-the-owner)).

## Rules (owner, 2026-11-01)

Set by the owner in the orchestrating chat on 2026-11-01 and relayed by the orchestrator (orchestrator report,
2026-11-01). The quoted phrases are the owner's corrections to the governor spec as recorded in
`docs/features/logs/token-budget/review-2026-11-01.md` on branch `claude/token-budget-governor` (not on main).

1. **Never limit the rate.** "Do not limit rate": no per-hour limits, no pacing and no concurrency caps, in
   code or in config.
2. **Use the whole cap.** Use up to 100% of the weekly usage cap, and ideally end each window with nothing
   left ("Ideally, at the end, I should have no tokens left").
3. **Running sessions can finish.** New work is admitted only against what is left after the expected
   remaining cost of the sessions already running.
4. **When unsure, admit.** "If unsure about if new work will go over limit cap, go with the more conservative
   estimate and risk going over the cap." The governor branch records the owner's reading as optimistic
   admission (commit `d2c93fa`, "optimistic admission with estimate ranges (owner)"), and the orchestrator
   relays it the same way: when it is unclear whether new work fits, admit it and accept the risk of going
   over.
5. **Queue only clear overruns.** Queue only work that clearly exceeds 100% of the cap, and hold it until the
   window resets (`rate_limit_info.resetsAt`). On 2026-11-01 the current window resets at 15:00 UTC.
6. **The warning only calibrates.** The near-limit warning (status `allowed_warning`) is never a brake. It
   only calibrates the cap: cap ≈ spend at the first warning / 0.75.
7. **Only rejection stops admission.** Only status `rejected`, or overage in use, stops admissions.
8. **Fill spare capacity.** When the spend rate falls below the baseline, fill the spare capacity with market
   research, business and design work, then shift back to development to build what those councils approve.

## Admission procedure

The orchestrator runs this on each scheduled check-in (see [architecture.md](architecture.md#actors)) and
before every `create_session`. It is the manual form of what the governor computes.

1. **Read the window.** From `get_session` on any running child: `rate_limit_info` status, `resetsAt` and
   whether overage is in use. If `now` ≥ `resetsAt`, the window has rolled over and spend restarts at 0.
2. **Sum spend in the window.** Add `get_session` usage `cost_usd` for every session that started in the
   window. Cost is the proxy for tokens: it is the only per-session figure that adds up across sessions.
3. **Reserve for running sessions.** For each running session, estimate its remaining cost from the unit
   costs in [Measured spend](#measured-spend) minus what it has spent, or from its recent burn, whichever is
   larger.
4. **Know or calibrate the cap.** Use a known cap when there is one. Otherwise, at the first `allowed_warning`
   reading at spend W, the cap is about W / 0.75 (rule 6). Before any warning the cap is unknown.
5. **Admit in priority order.** Start the next queued item while
   `spend + reserve + the admitted items' low estimates ≤ the cap's high estimate`. While the cap is unknown
   and the status is `allowed`, admit. Stop at the first item that does not fit, so a large important item is
   not starved by small ones.
6. **Brake only on rejection.** On `rejected` or overage, admit nothing. Running sessions keep going; if they
   stall, pause the lowest-priority one first, never the orchestrator. The work item's State becomes
   `queued-budget` ([lifecycle.md → States](lifecycle.md#states)) until `resetsAt` passes.
7. **Fill.** If the expected unused budget at reset is above 0 (cap − spend − reserve − admitted estimates),
   start research, business or design work whose typical duration fits before `resetsAt` (rule 8), then
   development.
8. **Publish the status.** Write one line in [coordination.md](coordination.md):
   "Window resets <UTC>; admitting: yes | queue-only". No spend, percentage or cap figures (usage snapshots
   stay with the orchestrator; whether more may be published is open question Q9).

## Token-budget governor

`scripts/token-budget.ts` turns the procedure above into a deterministic planner: it reads one JSON snapshot
(sessions, queue, window, history) and prints one JSON plan (admit, queued with reasons, reserve, cap range,
fill recommendation, brakes). It never starts or stops anything, never reads the clock and has no
dependencies.

- **Status, checked 2026-11-01 09:35 UTC:** work in progress on branch `claude/token-budget-governor`
  (head `a06ff78`), **not on main**, no PR. The branch adds `docs/token-budget.md` (the spec and method),
  `scripts/token-budget.ts`, `scripts/token-budget.test.ts` and
  `docs/features/logs/token-budget/review-2026-11-01.md`. At that time the review log held the owner's
  corrections, the build and round 1 (three reviewers plus the tester, with blocking findings); no later round
  was logged yet.
- **What it adds beyond this file:** cost priors per session kind (low / point / high, calibrated on
  2026-11-01), pro-rata spend for a session that started before the window, cap calibration that carries over
  between windows, an overshoot-risk rating, and a pause order under a brake. The method lives in its spec.
- **Owner's review bar:** "extensively review and test code before using this feature, with multiple rounds"
  (review log, owner quote). Until it merges, the orchestrator applies the procedure by hand.
- Once it merges to main, this section becomes a link to `docs/token-budget.md`, and the procedure above keeps
  only the steps the tool does not do (steps 1, 2 and 8).

## Lanes A and B budgets

The Actions lanes cap each run in dollars and turns, not by the usage window:
[FEATURES.md → Permissions and the failure budget](../FEATURES.md#permissions-and-the-failure-budget) (lane B)
and [AUTOPILOT.md → Controls](../AUTOPILOT.md) and "Loops and caps (cost control)" (lane A). Both pause after
a usage-limit error (IMPLEMENTATION.md Hard stop 9). Those caps run on a separate credential from the
orchestrator's sessions; whether both draw on the same weekly cap was not checked.

## Actions minutes

GitHub Actions minutes are a second budget, separate from the usage window. Every push of every lane-C
session runs full CI, and `gate.yml` runs after each CI run (it logs "not an open autopilot or feature PR" for
lane-C PRs).

| Measure (2026-11-01) | Value | Method |
|---|---|---|
| CI runs created that day | 116 | `gh api 'repos/{owner}/{repo}/actions/workflows/ci.yml/runs?created=2026-11-01'` → `total_count`, read 09:35 UTC |
| Gate runs created that day | 217, ≈ 0.4 min wall each | same, `gate.yml`; mean of `updated_at − run_started_at` over the first 99 completed runs |
| One CI run after #29 (sharded layout) | ≈ 3 min wall, ≈ 12 job-minutes (7 jobs) | jobs API of the 6 latest completed CI runs at 09:35 UTC: max − min of job times (wall), and the sum of job durations |

Rough order of magnitude: 116 runs × ≈ 12 job-minutes ≈ 1,390 job-minutes in one morning, plus the Gate
runs (billing rounds each job up to a whole minute). Runs before #29 merged (08:05 UTC) used the older
layout, so this is not a measurement. Plan limits and the cost of running over are in
[AUTOPILOT.md → Known limits](../AUTOPILOT.md#known-limits). Actual usage is shown only on the owner's billing
settings page, which sessions cannot read.

## Measured spend

Measured by the orchestrator on 2026-11-01 (orchestrator report): the sum of `get_session` usage over 15
child sessions, 07:25–08:44 UTC.

| Measure | Value |
|---|---|
| Window | 07:25–08:44 UTC = 79 min = 1.317 h |
| Spend | ≈ $385 (sum of `cost_usd`) |
| Split | development $228; research, business and design $156.5 (sum $384.5) |
| Output tokens | ≈ 5.5 M |
| Cache-read tokens | ≈ 860 M |

Derived here:
- Spend rate: $385 / 1.317 h ≈ **$292/h**.
- Output rate: 5.5 M / 1.317 h ≈ **4.18 M output tokens/h**.
- Cache-read rate: 860 M / 1.317 h ≈ 653 M tokens/h.
- Development share: $228 / $384.5 ≈ 59%.

The orchestrator's report gave $296/h and 4.25 M/h. Those figures imply a window of 1.30 h (78 min):
$385 / $296 ≈ 1.30 h. The 79-minute window above gives $292/h.

**Typical cost per kind of work** (orchestrator observation, 2026-11-01, `get_session` `cost_usd` of finished
sessions):

| Kind | Typical cost |
|---|---|
| Feature build (committee cycle, including fix rounds) | $20–40+ |
| Council (idea board, direction, approval, business) | $30–50 |
| Independent review subagent (one per PR) | $1–4 |

The governor branch's priors use the same data (for example build low $20 / point $40 / high $55, council
$30 / $40 / $50, review $1 / $3 / $4).

## Measured throughput

Method: count merge commits on main by **committer date**
(`git log origin/main --since=2026-11-01T06:00Z --format='%h %cI %s'`, run at 09:35 UTC). The GitHub pulls
API's `merged_at` and `created_at` read 1 h late for events after about 08:00 UTC that day (for example #43:
API 09:56Z, committer date 08:56Z, container clock 09:20Z at the time). The suspected cause is the
daylight-saving change in the committer's time zone. Never use API timestamps for 2026-11-01 without
cross-checking.

| PR | Merged (UTC) | Kind |
|---|---|---|
| #27, #26 | 07:05 | dependency bumps |
| #25 | 07:53 | pipeline and decisions |
| #29 | 08:05 | CI speed |
| #28 | 08:12 | dependency bump |
| #32 | 08:14 | idea board |
| #33 | 08:30 | F-6 |
| #31 | 08:46 | privacy groundwork |
| #34, #38 | 08:48, 08:49 | creative and design councils |
| #41 | 08:50 | font pin |
| #43 | 08:56 | owner decisions F-7/F-8 |
| #37 | 09:13 | publish isolation |
| #39 | 09:14 | market research council |
| #44, #36 | 09:19 | approval council; F-3 |
| #45 | 09:20 | business council |
| #35 | 09:23 | F-4 rework |
| #30 | 09:32 | F-2 PR-5/6 |

- **19 merges in 07:05–09:32 UTC** (2 h 27 min = 2.45 h): 19 / 2.45 ≈ **7.8 merges/h**. 3 of them are
  dependency bumps (#26, #27, #28), so 16 / 2.45 ≈ 6.5 work-item merges/h.
- By clock hour: 07:00–08:00: 3; 08:00–09:00: 9; 09:00–09:32: 7.
- 10 merges in 07:53–08:56, and 6 in 09:13–09:23.
- The orchestrator's earlier "12 PRs merged between 07:50 and 09:00" counts #26 and #27, which merged at
  07:05. It holds as "12 in 07:05–08:56".
- The FACTS figure of 18 merges in 07:05–09:23 (≈ 7.8/h) was taken before #30 merged.

## Bottlenecks

- **CI round trips and review fix rounds** are the main bottleneck (orchestrator report, 2026-11-01). Each
  merge moves main, every open session then merges main, and each push runs full CI (≈ 3 min wall) again.
- **Red CI**: the root causes on 2026-11-01 (font mismatch, a shared-database race, a layout bug, new-test
  fixtures) and their fixes are in [quality.md → Red CI on 2026-11-01](quality.md#red-ci-on-2026-11-01).
- **Merges one at a time**: merges are serialized by rule
  ([collaboration.md → Merge order](collaboration.md#merge-order)), so they come in bursts once a group of
  PRs is green and reviewed (6 merges in 09:13–09:23).
- **Concurrency** (about 24 sessions at peak): [architecture.md → Concurrency](architecture.md#concurrency).
  By rule 1 the rate itself is never capped; the limit is the usage cap.

## How to re-measure

| What | How | Who can run it |
|---|---|---|
| Spend over a window | Sum `get_session` usage `cost_usd` (and output / cache-read tokens) over the sessions active in a stated UTC window; divide by the window in hours | Orchestrator only (session ids are private) |
| Window and status | `get_session` → `rate_limit_info` (`status`, `resetsAt`, overage) | Orchestrator only |
| Merge throughput | `git log origin/main --since=<UTC> --format='%h %cI %s'`; count merge commits; divide by the window | Any client (git fetch works in cloud sessions) |
| CI duration per run | `gh api repos/{owner}/{repo}/actions/runs/<id>/jobs`: max − min of job times (wall), sum of job durations (job-minutes) | Any client (REST) |
| CI runs per day | `gh api 'repos/{owner}/{repo}/actions/workflows/ci.yml/runs?created=<date>'` → `total_count` | Any client (REST) |

State every number with its value, unit, UTC window, method and who measured it. Use REST, the GitHub MCP
tools or git: `gh pr list` (GraphQL) fails in cloud sessions.

**Estimating remaining work**

1. List the items still to do from [coordination.md](coordination.md) (States `planned`, `queued-budget`,
   and open PRs that still need fix rounds).
2. Cost: Σ (items of each kind × the kind's typical cost range). Example with illustrative counts: 8 builds
   × $20–40 + 2 councils × $30–50 + 12 reviews × $1–4 = $160–320 + $60–100 + $12–48 ≈ **$232–468**.
3. Capacity: compare that range with the budget left in the window (orchestrator only). At a constant
   $292/h, the 5 h 25 min from 09:35 to the 15:00 UTC reset would spend ≈ $1,580; rule 8 then says fill the
   rest with research, business and design work.
4. Time: items ÷ the work-item merge rate (≈ 6.5/h on 2026-11-01), with the dependencies in
   coordination.md's merge order as the floor (an item that starts only after another merges cannot finish
   before it).

## Known limits

- The budget rules exist only in this file and on an unmerged branch; they are not a protected path — the
  owner adds `/docs/process/budget-and-rate.md` to CODEOWNERS and `PROTECTED` (Q7).
- "The baseline" in rule 8 is not defined; the only measured rate is $292/h over 79 minutes on 2026-11-01 —
  the owner names a baseline, or the governor's `fill` output replaces it once merged.
- Spend and window status can be read only by the orchestrator; other clients see only the coordination
  line — a repo-side, non-identifying budget record (Q9) would remove it.
- Cost is a proxy for tokens: cache reads are cheap in dollars but may weigh differently against the cap —
  a per-token usage figure from the provider would remove it.
- Spend from sessions the orchestrator cannot see (the owner's own sessions, lanes A/B if they share the
  cap) is missing, so a calibrated cap comes out low — reading the account's usage directly would remove it.
- The Actions-minutes figure is an order of magnitude from mixed CI layouts — reading the owner's billing
  page for that day would replace it.
- The unit costs come from one day — re-measuring over more windows would firm them up.
