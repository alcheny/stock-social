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
`docs/features/logs/token-budget/review-2026-11-01.md` (on main since #75, b7cf532).

1. **Never limit the rate.** "Do not limit rate": no per-hour limits, no pacing and no concurrency caps, in
   code or in config.
2. **Use the whole cap.** Use up to 100% of the weekly usage cap, and ideally end each window with nothing
   left ("Ideally, at the end, I should have no tokens left").
3. **Running sessions can finish.** New work is admitted only against what is left after the expected
   remaining cost of the sessions already running.
4. **When unsure whether new work fits.** "If unsure about if new work will go over limit cap, go with the more
   conservative estimate and risk going over the cap." Which way this reads (admit, or queue) is open question
   Q14 in [decisions-and-authority.md](decisions-and-authority.md#open-questions-for-the-owner). Today the
   orchestrator admits (orchestrator report, 2026-11-01), and the governor branch reads it as admit (commit
   `d2c93fa`, "optimistic admission with estimate ranges (owner)").
5. **Queue only clear overruns.** Queue only work that clearly exceeds 100% of the cap, and hold it until the
   window resets (`rate_limit_info.resetsAt`; the current reset time is the budget line in
   [coordination.md](coordination.md)).
6. **The warning only calibrates.** The near-limit warning (status `allowed_warning`) is never a brake. It
   only calibrates the cap: cap ≈ spend at the first warning / 0.75.
7. **Only rejection stops admission.** Only status `rejected`, or overage in use, stops admissions.
8. **Fill spare capacity.** When the spend rate falls below the baseline, fill the spare capacity with market
   research, business and design work, then shift back to development to build what those councils approve.

## Collaborator sessions

The rules above govern the owner's plan: the orchestrator's sessions and what it admits. A collaborator's
desktop/CLI session runs on the collaborator's own plan, which is theirs to manage. Every push still spends the
owner's GitHub Actions minutes: one full CI run per push, about 12.5 job-minutes on the sharded layout
([Actions minutes](#actions-minutes)). So push only after the local gates pass
([quality.md → Before every push](quality.md#before-every-push)), not to see what CI says (process-docs lead,
usability pass 5, 2026-11-01).

## Admission procedure

The orchestrator runs this on each scheduled check-in (see [architecture.md](architecture.md#actors)) and
before every `create_session`. It is the manual form of what the governor computes.

1. **Read the window.** From `get_session` on any running child: `rate_limit_info` status, `resetsAt` and
   whether overage is in use. If `now` ≥ `resetsAt`, the window has rolled over and spend restarts at 0.
   Children may report two windows, `five_hour` and `seven_day` (`rateLimitType`; governor spec
   [`docs/token-budget.md`](../token-budget.md) → Mixed windows); run this procedure
   once per window and start only what every window admits. The 15:00 UTC reset of 2026-11-01 is the orchestrator's
   reading; its window type is unknown (orchestrator report). The spec's example snapshot pairs that same
   `resetsAt` (`1793545200`) with `seven_day`, which suggests but does not confirm the seven-day window.
2. **Sum spend in the window.** Add `get_session` usage `cost_usd` for every session that started in the
   window. Cost is the proxy for tokens: it is the only per-session figure that adds up across sessions.
3. **Plan with the governor.** Steps 3 to 7 of this procedure (reserve for running sessions, know or calibrate
   the cap, admit in priority order, brake only on rejection, fill spare capacity) are computed by
   `scripts/token-budget.ts` from one snapshot built from steps 1 and 2; its method is
   [`docs/token-budget.md`](../token-budget.md). The orchestrator acts on the plan it prints (the tool starts and stops
   nothing). Rules 4 to 8 above still bind its reading (Q14 is open).
4. **Publish the status.** Write one line in [coordination.md](coordination.md):
   "Window resets <UTC>; admitting: yes | queue-only". No spend, percentage or cap figures (usage snapshots
   stay with the orchestrator; whether more may be published is open question Q9).

## Token-budget governor

On main since #75 (b7cf532): [`docs/token-budget.md`](../token-budget.md) (spec and method), `scripts/token-budget.ts`
(the planner) and its tests; the review rounds are in `docs/features/logs/token-budget/review-2026-11-01.md`. The
governor's history (past snapshots and plans) is not kept in the repo: usage snapshots stay with the orchestrator
session (step 4, Q9). This section became a link when the governor merged, as it said it would (fixes cycle 4, F4-21).

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
| CI runs created that day | 126 | `gh api 'repos/{owner}/{repo}/actions/workflows/ci.yml/runs?created=2026-11-01'` → `total_count`, read 09:47 UTC |
| Gate runs created that day | 230, ≈ 0.4 min wall each | same, `gate.yml`, read 09:41 UTC; mean of `updated_at − run_started_at` over the newest 100 completed runs: 0.44 min |
| One CI run after #29 (sharded layout) | ≈ 12.5 job-minutes (6 counted jobs; 7 with the skipped `notify-gate`, which is not counted); wall time in [quality.md → CI layout](quality.md#ci-layout) | jobs API of the 71 successful sharded runs at 09:41 UTC: the sum of job durations (median) |
| Job-minutes used that day | ≈ 1,220 | sum of job durations over 113 of the 116 completed CI runs at 09:41 UTC; 3 runs that straddle the API's +1 h timestamp jump (each reading ≈ 66 min) left out |

So ≈ 1,220 job-minutes of CI in one morning, plus the Gate runs (billing rounds each job up to a whole minute,
so the billed figure is higher). Runs on branches without #29 (merged 08:05 UTC) used the older one-job
layout. Plan limits and the cost of running over are in
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
- Spend rate: $385 / 1.317 h ≈ **$292/h** (orchestrator report, disputed: see below).
- Output rate: 5.5 M / 1.317 h ≈ **4.18 M output tokens/h**.
- Cache-read rate: 860 M / 1.317 h ≈ 653 M tokens/h.
- Development share: $228 / $384.5 ≈ 59%.

The orchestrator's report gave $296/h and 4.25 M/h. Those figures imply a window of 1.30 h (78 min):
$385 / $296 ≈ 1.30 h. The 79-minute window above gives $292/h.

**Disputed.** The governor's round-2 review (branch `claude/token-budget-governor` at `52728e0`,
`docs/features/logs/token-budget/review-2026-11-01.md` → Round 2, estimation maths, finding F3) says "the
orchestrator's ~$296/h is not consistent with the sessions (they sum to ~$74/h)": its example sessions add up to
about a quarter of that rate, and the figure equals the slope of a history reading about $234 below what the
sessions account for. So $292/h is an **orchestrator report, disputed**: it is the only measured rate, and every
estimate in this file that uses it carries that label. Admission (steps 3 and 5 above) uses the per-kind unit costs
below, not this rate.

**Typical cost per kind of work** (orchestrator observation, 2026-11-01, `get_session` `cost_usd` of finished
sessions):

| Kind | Typical cost |
|---|---|
| Feature build (committee cycle, including fix rounds) | $20–40+ |
| Council (idea board, direction, approval, business) | $30–50 |
| Independent review subagent (one per PR) | $1–4 |

The governor branch's priors use the same data (`DEFAULT_PRIORS` at head `52728e0`: build low $20 / point $40 /
high $55, council $30 / $40 / $60 (high raised from $50 in the round-1 fixes), review $1 / $3 / $4).

## Measured throughput

Method: count the PR commits on main's first-parent line by **committer date**
(`git log origin/main --first-parent --since=2026-11-01T06:00Z --format='%h %cI %s'`, the lines ending in `(#n)`;
run at 09:48 UTC by fact-checker FC2). Without `--first-parent` the log also lists the branch commits that #25
brought in as a merge commit. The GitHub pulls
API's `merged_at` and `created_at` read 1 h late for some events that day: merges between about 08:05 and 08:56 UTC
(for example #29: API 09:05Z, committer date 08:05Z; #43: API 09:56Z, committer date 08:56Z, container clock 09:20Z
at the time), while #25 (07:53), #37 (09:13) and #47 (09:38) agree (fact-checker FC1, 09:41 UTC). Actions run
timestamps show the same jump. The suspected cause is the
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
| #47 | 09:38 | market research council, cycle 2 |

- **20 merges in 07:05–09:38 UTC** (2 h 33 min = 2.55 h): 20 / 2.55 ≈ **7.8 merges/h**. 3 of them are
  dependency bumps (#26, #27, #28), so 17 / 2.55 ≈ 6.7 work-item merges/h.
- By clock hour: 07:00–08:00: 3; 08:00–09:00: 9; 09:00–09:38: 8.
- 10 merges in 07:53–08:56, and 6 in 09:13–09:23.
- The orchestrator's earlier "12 PRs merged between 07:50 and 09:00" counts #26 and #27, which merged at
  07:05. It holds as "12 in 07:05–08:56".
- The orchestrator's figure (orchestrator report, 2026-11-01) of 18 merges in 07:05–09:23 (18 / 2.3 h ≈ 7.8/h) was taken before #30 and #47 merged.

## Bottlenecks

- **CI round trips and review fix rounds** are the main bottleneck (orchestrator report, 2026-11-01). Each
  merge moves main, every open session then merges main, and each push runs full CI again (duration: [quality.md → CI layout](quality.md#ci-layout)).
- **Red CI**: the root causes on 2026-11-01 (font mismatch, a shared-database race, a layout bug, new-test
  fixtures) and their fixes are in [quality.md → Red CI on 2026-11-01](quality.md#red-ci-on-2026-11-01).
- **Merges one at a time**: merges are serialized by rule
  ([collaboration.md → Merge order](collaboration.md#merge-order)), so they come in bursts once a group of
  PRs is green and reviewed (6 merges in 09:13–09:23).
- **Concurrency**: [architecture.md → Concurrency](architecture.md#concurrency).
  By rule 1 the rate itself is never capped; the limit is the usage cap.

## How to re-measure

| What | How | Who can run it |
|---|---|---|
| Spend over a window | Sum `get_session` usage `cost_usd` (and output / cache-read tokens) over the sessions active in a stated UTC window; divide by the window in hours | Orchestrator only (session ids are private) |
| Window and status | `get_session` → `rate_limit_info` (`status`, `resetsAt`, overage) | Orchestrator only |
| Merge throughput | `git log origin/main --first-parent --since=<UTC> --format='%h %cI %s'`; count the lines ending in `(#n)`; divide by the window | Any client (git fetch works in cloud sessions) |
| CI duration per run | `gh api repos/{owner}/{repo}/actions/runs/<id>/jobs`: max − min of job times (wall), sum of job durations (job-minutes) | Any client (REST) |
| CI runs per day | `gh api 'repos/{owner}/{repo}/actions/workflows/ci.yml/runs?created=<date>'` → `total_count` | Any client (REST) |

State every number with its value, unit, UTC window, method and who measured it. Use REST, the GitHub MCP
tools or git ([collaboration.md → Tool recipes](collaboration.md#tool-recipes) says why).

**Estimating remaining work**

1. List the items still to do from [coordination.md](coordination.md) (States `planned`, `queued-budget`,
   and open PRs that still need fix rounds).
2. Cost: Σ (items of each kind × the kind's typical cost range). Example with illustrative counts: 8 builds
   × $20–40 + 2 councils × $30–50 + 12 reviews × $1–4 = $160–320 + $60–100 + $12–48 ≈ **$232–468**.
3. Capacity: compare that range with the budget left in the window (orchestrator only). At a constant
   $292/h (orchestrator report, disputed: [Measured spend](#measured-spend)), the 5 h 25 min from 09:35 to the
   15:00 UTC reset would spend ≈ $1,580; rule 8 then says fill the
   rest with research, business and design work.
4. Time: items ÷ the work-item merge rate (≈ 6.7/h on 2026-11-01), with the dependencies in
   coordination.md's merge order as the floor (an item that starts only after another merges cannot finish
   before it).

## Known limits

- The budget rules exist only in this file and on an unmerged branch; they are not a protected path — the
  owner adds `/docs/process/budget-and-rate.md` to CODEOWNERS and `PROTECTED` (Q7).
- "The baseline" in rule 8 is not defined; the only measured rate is $292/h over 79 minutes on 2026-11-01
  (orchestrator report, disputed) — the owner names a baseline, or the governor's `fill` output replaces it once
  merged.
- The $292/h spend rate is disputed by the governor's round-2 review (finding F3: its example sessions sum to about
  $74/h) and cannot be re-checked outside the orchestrator — the orchestrator re-measuring one stated window with
  its session list (sums per session, not a history slope) would settle it.
- Two usage windows are reported (`five_hour` and `seven_day`, governor spec `docs/token-budget.md` at `52728e0`),
  and which one the 15:00 UTC reset belongs to is not confirmed — the orchestrator writing the window type next
  to the reset time in the coordination budget line would remove it.
- Spend and window status can be read only by the orchestrator; other clients see only the coordination
  line — a repo-side, non-identifying budget record (Q9) would remove it.
- Cost is a proxy for tokens: cache reads are cheap in dollars but may weigh differently against the cap —
  a per-token usage figure from the provider would remove it.
- Spend from sessions the orchestrator cannot see (the owner's own sessions, lanes A/B if they share the
  cap) is missing, so a calibrated cap comes out low — reading the account's usage directly would remove it.
- The Actions-minutes figure is unbilled job time from the jobs API, with 3 runs left out — reading the owner's
  billing page for that day would replace it.
- The unit costs come from one day — re-measuring over more windows would firm them up.
