# Coordination (snapshot)

Snapshot taken: 2026-11-01 by the fixes-cycle-4 session (F4-21, council cycle 4 C4-24), replacing the 10:37 UTC
snapshot of the process-docs session, which listed merged work as building or planned. Source: the GitHub MCP tool
`list_pull_requests` (state open), `git fetch origin`, `git rev-list --count` for ahead and behind, and
`git merge-tree --write-tree --name-only origin/main origin/claude/<topic>` for conflicting files, with main at
`e6731d5` (#83), then updated when main reached `8e3e9a5` (#86 approval council 4, #85 truthful labels). Merged work is not listed: `git log origin/main --first-parent` holds it (since the last snapshot,
among others, #46 sharded sync, #52 and #81 known limits, #54 F-10/F-12, #55 F-13, #56 F-7, #62 options, #64 F-14,
#65 F-9, #69 and #80 F-15, #75 the token-budget governor, #79 fixes cycle 3, #82 known-limits follow-up, #83 the
cycle-4 record).

Orchestrator of record: the owner's orchestrating chat session (its session id stays private:
[architecture.md](architecture.md)). Lane C: active on 2026-11-01 (orchestrator report).

Budget: Window resets 2026-11-01 15:00 UTC (orchestrator report; window type, five-hour or seven-day, unknown); admitting: _orchestrator fills: yes | queue-only_
([budget-and-rate.md](budget-and-rate.md)).

## Update rule

- GitHub beats this table. Whether a PR exists, is draft or ready, its CI and whether it merged are read from GitHub
  ([collaboration.md → Tool recipes](collaboration.md#tool-recipes)). This table holds what GitHub does not: files
  owned, merge position, depends-on and plans that have no PR yet. Columns GitHub already holds (Branch, PR) are
  *derived*: when they disagree with GitHub, GitHub is right. A pushed `claude/*` branch that this table does not name
  is a possible claim ([collaboration.md → Claiming and releasing work](collaboration.md#claiming-and-releasing-work)).
- One row per work item. A client edits only its own row, in its own PR (the draft-PR claim:
  [collaboration.md → Claiming and releasing work](collaboration.md#claiming-and-releasing-work)). Its own row is the
  one exception to the process-docs item's ownership of `docs/process/`
  ([collaboration.md → File ownership](collaboration.md#file-ownership)).
- The orchestrator of record reconciles the table (adds planned rows with the exact branch name before
  `create_session`, sets merge positions, fixes stale rows) and wins disagreements between clients; GitHub's state is
  above both.
- An item folded into a running session ([lifecycle.md](lifecycle.md#6-build-session-start) stage 6) takes that
  session's branch, PR and State (example: F-14 inside sharded sync).
- Rows are sorted by merge position, then by work item; rows without a position come last. On a merge conflict in this
  file, use the conflict recipe in [collaboration.md → Conflicts](collaboration.md#conflicts).
- No usage numbers, costs or personal data here (POLICY P1, P5; [budget-and-rate.md](budget-and-rate.md)), and no session
  ids (process-docs lead decision: [architecture.md → State and where it lives](architecture.md#state-and-where-it-lives)).
- State values are the work-item States of [lifecycle.md → States](lifecycle.md#states).

## Work items

"Files owned" is what the branch changes against main at snapshot time, outside `docs/features/logs/`. Behind and
conflict counts are against main at `e6731d5`.

| Work item | Kind | Client kind | Branch | PR | Files owned | State | Depends on | Merge position |
|---|---|---|---|---|---|---|---|---|
| Fixes, council cycle 4 | fix | cloud child session | `claude/fixes-cycle4` | opened by that session | `lib/trades.ts` (matcher), `lib/options.ts`, `lib/options-load.ts`, `lib/public-trades.ts`, `lib/public-import.ts`, `lib/record-card.ts`, `lib/moderation.ts`, `next.config.ts`, `scripts/f15-readout.ts`, `scripts/f15-bot-validation.ts`, process docs, the F-14 status line | building | — | 1 (main's freeze lifted when truthful labels merged as #85) |
| F-20 design tokens | feature build | cloud child session | `claude/f20-design-tokens` (21 ahead, 5 behind, 1 conflicting file) | #77 | `app/globals.css`, `app/home-card/route.tsx`, `app/u/[handle]/record-card-image.tsx`, `lib/palette.ts`, `lib/colour-math.ts`, `lib/record-strip.ts` | pr-ready | truthful labels (record strip) | — |
| F-16/F-17 trust and safety | feature build | cloud child session | `claude/f16-f17-trust-safety` (19 ahead, 1 behind, 0 conflicting) | — (no PR) | `lib/reports.ts`, `lib/trust-*.ts`, `lib/visible-users.ts`, `app/u/[handle]/report/**`, one-line edits to the profile, month and trade pages, additive `lib/copy.ts` and `db/schema.sql` | building | — | — |
| F-24 late postings | feature build | cloud child session | `claude/f24-late-postings` (16 ahead, 0 behind, 0 conflicting) | — (no PR) | `lib/reconcile.ts`, `lib/sync.ts` (including the future-count query), `lib/options-sync.ts` (`rebuildRecord` wrapper), `lib/connections.ts`, additive `db/schema.sql` | building | — | — |
| F-26 held like none | feature build | cloud child session | `claude/f26-held-like-none` (3 ahead, 6 behind, 2 conflicting files) | — (no PR) | `lib/user-note.ts`, `lib/own-note.ts`, `app/ui.tsx`, `app/feed-rows.tsx`, the trade page, `app/u/[handle]/pane-chart/route.ts`, `lib/feed.ts` | building | — | — |
| Fixes, council cycle 5 | fix | cloud child session | `claude/fixes-cycle5` | opened by that session | F5-2, F5-4..F5-27 of `docs/direction/cycle5-2026-11-01.md` section 5 (committee record `docs/features/logs/fixes-cycle5/committee-2026-11-01.md`); additive `FIXES-CYCLE5` blocks in shared files. F5-14 (bounded chart series) is not built here: it builds on F-23's (#97) wire format after its 80,000-close re-measure | building | — | — |

## Merge order (current)

Truthful labels (merged, #85) → fixes cycle 4 → the rest as they reach green and reviewed. A PR that is green and reviewed earlier
may go earlier when it conflicts with no unmerged PR above it
([collaboration.md → Merge order](collaboration.md#merge-order)).

## Known overlaps

| File | Items | Note |
|---|---|---|
| `lib/trades.ts` | truthful labels (confidence math), fixes cycle 4 (matcher) | different functions |
| `lib/sync.ts` | truthful labels, F-24 | F-24 edits the future-count query the cycle-4 record's F4-1 names; fixes cycle 4 leaves it to F-24 |
| `lib/copy.ts` | truthful labels, F-16/F-17, fixes cycle 4 | in `SHARED`; additive blocks |
| `app/ui.tsx` | truthful labels, F-26 | the cycle-4 badge space (F4-14) is handed to them |
| profile, trade and month pages | truthful labels, F-16/F-17, F-26, fixes cycle 4 (one trade-page line, F4-10) | in `SHARED` |
| `lib/feed.ts` | truthful labels, F-26 | in `SHARED` |
| `app/u/[handle]/record-card-image.tsx` | F-20 | the cycle-4 pill layout (F4-15) is handed to F-20 |
| `db/schema.sql` | truthful labels, F-16/F-17, F-24 | in `SHARED`; appended, idempotent blocks only |

## Other lanes and reserved branches

| Branch | What | State at snapshot |
|---|---|---|
| `claude/serene-faraday-f45ffc` | orchestrator's own branch (PRs #24, #25, #41, #43) | all merged |
| `claude/adoring-euler-4469ys` | old pipeline branch (F-1/F-2 PRs #8–#11, #15–#23, 2026-10-22 to 10-24) | all merged |
| `claude/peaceful-dirac-33bucv` | no PR; last commit 2026-10-25 | stale, unclaimed: do not build on it |
| `claude/ci-shard-e2e`, `claude/idea-board-2026-11-01`, `claude/privacy-launch-gate`, `claude/publish-separate-job`, `claude/f2-discovery-pr5-pr6`, `claude/f3-viewer-subscriptions`, `claude/f4-share-card-rework`, `claude/f6-open-positions`, `claude/approval-council-2026-11-01`, `claude/business-council-2026-11-01`, `claude/market-research-council-2026-11-01`, `claude/creative-direction-2026-11-01`, `claude/design-direction-2026-11-01`, `claude/market-research-2-2026-11-01`, `claude/corporate-actions`, `claude/design-system-2026-11-01`, `claude/security-hardening`, `claude/f8-game-design-2026-11-01`, `claude/approval-council-2-2026-11-01` | merged work (#29, #32, #31, #37, #30, #36, #35, #33, #44, #45, #39, #34, #38, #47, #40, #48, #42, #51, #53) | merged; branches kept |
| `autopilot/*`, `line/a`, `line/b`, `line/c` | lane A ([AUTOPILOT.md](../AUTOPILOT.md)) | `line/a|b|c` exist; switch `AUTOPILOT` off (inferred: the latest scheduled `build.yml` run, 09:40 UTC, and `doctor.yml` run, 05:52 UTC, concluded `skipped`; Actions runs API, checked 2026-11-01 09:41 UTC by fact-checker FC1 and re-read unchanged 10:07 and 10:37 UTC) |
| `feature/*` | lane B ([FEATURES.md](../FEATURES.md)) | none exist; switch `FEATURES` off (inferred: the latest scheduled `features.yml` run, 06:25 UTC, concluded `skipped`; same checks) |
| `dependabot/*` | the code host's dependency bot | one branch left (`npm-minor-patch-5f403fecb1`, its PR #27 merged), no open PR |

Issue #7 ("Review queue", label `review-queue`) is open; it belongs to lane A, not to a lane-C item.

The orchestrator keeps the switch state current; any client re-checks it with the recipe in
[collaboration.md → Tool recipes](collaboration.md#tool-recipes). What a switch that is on would do to lane-C PRs:
[collaboration.md → When FEATURES or AUTOPILOT is on](collaboration.md#when-features-or-autopilot-is-on).

## Feature files after lane-C merges

Lane C has no step that sets `Status: built` (open question Q8,
[decisions-and-authority.md](decisions-and-authority.md#open-questions-for-the-owner)). A feature file's `Status:` is
never a sign that a feature is free to claim: use the Work items table and GitHub. Read on main at `e6731d5` with
this branch's F-14 change: every merged feature reads `built` or `accepted`. F-11 reads `ready` and is being built on
`claude/fix-truthful-labels` (no PR yet); F-16, F-17, F-24 and F-26 read `blocked` while their branches build.

With `FEATURES=on`, lane B would pick these up and build them again
([collaboration.md → When FEATURES or AUTOPILOT is on](collaboration.md#when-features-or-autopilot-is-on), row (c)).

## History

The dated ownership map and merge order of the 2026-11-01 parallel build (thirteen sessions, the F-9..F-14 approval
section) stay unchanged in [docs/features/logs/coordination-2026-11-01.md](../features/logs/coordination-2026-11-01.md).
Its rules now live in [collaboration.md](collaboration.md) (ownership, shared files, merge order, one PR at a time,
merging main) and [lifecycle.md](lifecycle.md) (archiving); its current planning data (F-9..F-14 files and overlaps)
is copied into the tables above.

## Known limits

- The snapshot goes stale as soon as a PR opens or merges — GitHub wins (Update rule); a script that regenerates the
  derived columns from REST would remove the drift.
- "Files owned" for open branches is read from their diffs, not from an assignment by the orchestrator — the
  orchestrator confirming each row would remove it.
- Merge positions 1–3 are inferred from the coordination log's order — the orchestrator setting them would remove it.
- The budget line's "admitting" value needs the orchestrator, because usage data stays private — a published
  admission flag would remove it (open question Q9).
- The feature-file Status table is a reading, not a rule; it goes stale when a feature file changes — Q8's answer
  (a step that sets `built`) would make it unnecessary.
- Rows without files (user-text safety, the other fixes, issue #49) cannot be built until the orchestrator assigns
  files before `create_session` (lifecycle stage 6) — the orchestrator filling them removes this.
