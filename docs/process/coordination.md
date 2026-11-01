# Coordination (snapshot)

Snapshot taken: 2026-11-01 10:37 UTC by the process-docs session (first written 09:35 UTC, refreshed 09:41 and
10:06 UTC); source: the GitHub MCP tool `list_pull_requests` (state all, newest 15 by update) and REST
`gh api 'repos/alcheny/stock-social/pulls?state=open&per_page=100'` and `.../issues?state=open`,
`git ls-remote origin 'refs/heads/claude/*'` with the "Unregistered branches" recipe,
`git diff --name-only origin/main...origin/claude/<topic>` and `git log origin/main --first-parent`, with main at
`2aa8a74` (merges since 09:20 UTC by merge-commit committer date: #35 09:23, #30 09:32, #47 09:38, #40 09:48,
#48 10:03, #42 10:08, #51 10:21, #53 10:24).

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

Merge positions follow the coordination log's order for the items still open (security hardening → sharded sync →
councils); the orchestrator confirms or changes them. "—" = not set yet. "Files owned" for pushed branches is what the
branch changes against main at snapshot time, outside `docs/features/logs/` (each item also writes its own log
directory there). A `planned` row with an empty Branch cell has no session yet; a desktop/CLI session takes one only
as [collaboration.md → Claiming and releasing work](collaboration.md#claiming-and-releasing-work) says. Several
`building` rows have a pushed branch but no draft PR, which the claim rule does not allow; they count as claimed.
Two branches appeared at 10:33 UTC with no row from the orchestrator (`claude/fix-user-text-safety`,
`claude/fixes-cycle2-a11y`); their rows below are read from the branches, for the orchestrator to confirm.

| Work item | Kind | Client kind | Branch | PR | Files owned | State | Depends on | Merge position |
|---|---|---|---|---|---|---|---|---|
| Sharded sync (with F-14 folded in) | cross-cutting build | cloud child session | `claude/sharded-sync` | #46 (no label) | `lib/sync.ts` structure, `app/api/sync/**`, `lib/sync-*.ts`, `docs/SYNC.md`, `e2e/sync-shards.spec.ts`, `e2e/cron-lock.ts`; edits in `e2e/privacy-gate.spec.ts`; additive in `lib/db.ts`, `db/schema.sql`, privacy maps | pr-ready (no push since 09:44 UTC; #42 merged after it, so it must merge main) | — | 1 |
| Known-limits sweep | cross-cutting build | cloud child session (orchestrator report) | `claude/known-limits` (head `e7da0e0`) | #52 (`feature`, opened 10:11 UTC) | new `lib/sitemaps.ts`, `app/sitemaps/sitemap.ts`, `lib/shared-accounts.ts`, `scripts/shared-accounts.ts` and their tests, `lib/claims-identity.test.ts`, `lib/feed-imported.test.ts`, `lib/feed.crafted.load.test.ts`, `lib/privacy-purge.load.test.ts`; edits in `app/robots.ts`, `app/sitemap.ts`, `lib/claims.ts`, `lib/feed.ts`, `lib/privacy-purge.ts`, `lib/connections.ts`, `lib/billing.ts` (+test), `lib/record-tools.test.ts`, `lib/sync.ts`, `lib/trades.ts`, `lib/privacy-fields.ts`, `lib/privacy-retention.ts`, `e2e/cron-lock.ts` (#46 also adds it), `e2e/feed-lock.ts`, `e2e/app.spec.ts`, `e2e/connect.spec.ts`, `e2e/privacy-gate.spec.ts`, `e2e/share-card.spec.ts`; ponytail lines in `lib/auth/rate-limit.ts`, `lib/display-log.ts`, `lib/follows.ts`, `lib/similar.ts`, `app/u/[handle]/referral-feedback.tsx`, `app/u/[handle]/page.tsx`; `db/schema.sql` (file list as of 10:06 UTC) | pr-ready | its notes in files open PRs own: after those PRs merge ([quality.md → Ponytail convention](quality.md#ponytail-convention)) | — |
| F-10 feed record line + F-12 trade and month record strip | feature build | cloud child session | `claude/f10-f12-record-strip` (head `574ef95`) | #54 (`feature`, opened 10:35 UTC) | `app/record-strip.tsx`, `lib/record-strip.ts`, `lib/png.ts` (+tests), `e2e/record-strip.spec.ts`, `lib/snapshots/f4-record-card.json`, the F-10 and F-12 feature files (practice, not a rule: agents can't edit feature files, [collaboration.md → Never do](collaboration.md#never-do); open question Q8); edits in the trade and month pages and images, `app/feed-rows.tsx`, `app/ui.tsx`, `lib/feed.ts`, `lib/record-card.ts`, `lib/month-card.ts`, `lib/recap-load.ts`, `lib/trade-share-load.ts`, `e2e/app.spec.ts`, `e2e/connect.spec.ts`; additive in `app/globals.css`, `lib/copy.ts` (file list as of 10:06 UTC) | pr-ready | F-10: F-2 #30 (merged); F-12: F-4 #35 (merged) and F-10 | — |
| F-13 first-visit line + accessibility fixes | feature build | cloud child session | `claude/f13-a11y-fixes` (head `4074dd6`) | #55 (`feature`, opened 10:37 UTC) | `app/first-visit.tsx`, `app/first-visit-client.tsx`, `lib/device-flag.ts` (+tests), `e2e/f13-first-visit.spec.ts`, `e2e/a11y-*.spec.ts`, `lib/a11y-*.test.ts`, the nav label in `app/layout.tsx`, its own feature file (as for F-10/F-12: practice, open question Q8); edits in `app/page.tsx`, `app/feed-rows.tsx`, `app/feed-*.tsx`, `app/card-menu.tsx`, `app/pane.tsx`, `app/connect/**`, `app/login/**`, `app/me/**`, `app/t/**`, the trade and month pages and images, `app/u/[handle]/**`, `app/ui.tsx`, `lib/claims.ts`, `lib/record-tools.ts`, `lib/open-split.ts`, `lib/ticker.ts`, `e2e/app.spec.ts`, `e2e/connect.spec.ts`, `e2e/likes.spec.ts`; additive in `app/globals.css`, `lib/copy.ts` | pr-ready | F-2 #30 (merged) | — |
| Security hardening | cross-cutting build | cloud child session | `claude/security-hardening` | #42 (no label, merged 10:08 UTC) | — | merged | — | — |
| F-8 prediction game (design only) | council / record | cloud child session | `claude/f8-game-design-2026-11-01` | #51 (`feature`, merged 10:21 UTC) | — | merged | — | — |
| Approval council, cycle 2 | council / record | cloud child session | `claude/approval-council-2-2026-11-01` | #53 (`feature`, merged 10:24 UTC) | — | merged | — | — |
| Corporate actions (stock splits, F3c) | cross-cutting build | cloud child session | `claude/corporate-actions` | #40 (`feature`, merged 09:48 UTC) | — | merged | — | — |
| Market research council, cycle 2 | council / record | cloud child session | `claude/market-research-2-2026-11-01` | #47 (`feature`, merged 09:38 UTC) | — | merged | — | — |
| Design system council | council / record | cloud child session | `claude/design-system-2026-11-01` | #48 (`feature`, merged 10:03 UTC) | — | merged | — | — |
| Process docs (this file's PR) | docs | cloud child session | `claude/process-docs-2026-11-01` | #50 (draft, labeled `feature`: with `FEATURES=on`, lane B would treat it as one of its PRs, [collaboration.md → When FEATURES or AUTOPILOT is on](collaboration.md#when-features-or-autopilot-is-on); Q4) | `docs/process/**` except other items' rows in this file; structure-only edits to CLAUDE.md, AUTOPILOT.md, FEATURES.md, IMPLEMENTATION.md, COMPLIANCE.md, IDEAS.md, `docs/features/TEMPLATE.md`, `team/**`, the coordination log's header (scope extension 09:08 UTC: [decisions-and-authority.md](decisions-and-authority.md#delegations-and-process-decisions-by-the-owner)) | building | — | — (touches CODEOWNERS paths: owner merges or approves) |
| F-7 public traders | feature build | cloud child session | `claude/f7-public-traders` (head `5170a83`, 10:31 UTC) | — (no draft PR) | new `lib/public-gate.ts`, `lib/public-filings.ts`, `lib/public-import.ts`, `lib/public-trades.ts`, `scripts/public-filer.ts`, `app/public-records/**`, `e2e/f7-*`, `e2e/fakes/public-filings.ts`, `e2e/fixtures/public-filings/**`, `lib/f7-*.test.ts`; edits in `docs/features/F-7-public-traders.md` (its own feature file, protected `docs/features/**`; practice, not a rule: agents can't edit feature files, [collaboration.md → Never do](collaboration.md#never-do); open question Q8), `pw.local.config.ts`, `app/actions.ts`, `app/api/sync/route.ts`, `app/feed-rows.tsx`, `app/pane.tsx`, `app/t/**`, `app/u/[handle]/**`, `app/ui.tsx`, `lib/auth/attempts.ts`, `lib/auth/sessions.ts`, `lib/connections.ts`, `lib/feed.ts`, `lib/sync.ts`, `lib/record-card.ts`, `lib/month-card.ts`, other `lib/` readers, privacy maps, `.env.example`; additive in `db/schema.sql`, `app/globals.css`, `lib/copy.ts` | building | — | — |
| Fix: truthful labels | fix | cloud child session | `claude/fix-truthful-labels` (head `3b0aba7`, 09:20 UTC) | — (no draft PR) | `app/t/**` (ticker pages, `Concentration.tsx`, `opengraph-image.tsx`), `lib/ticker-sql.ts` (+tests); edits in `lib/trades.ts`, additive in `db/schema.sql` | building | #40 merged: merge main and keep its matcher change | — |
| Options trades | cross-cutting build | cloud child session | `claude/options-trades` (head `139e376`, 10:22 UTC) | — (no draft PR) | new `lib/options*.ts` (+tests), `lib/broker-options.test.ts`, `app/u/[handle]/options-block.tsx`, `app/lazy-pane.tsx`, `e2e/options.spec.ts`; edits in `lib/broker.ts` (the vendor file), `lib/connections.ts`, `lib/sync.ts`, `lib/feed.ts`, `lib/record-card.ts`, `lib/display-log.ts`, `lib/consent-versions.ts`, `lib/privacy-purge.ts`, privacy maps, `app/feed-rows.tsx`, `app/pane.tsx`, `app/how/page.tsx`, `app/u/[handle]/**`, `e2e/fakes/vendor.ts`, `scripts/db-setup.ts`, `scripts/seed.ts`, `docs/COMPLIANCE.md`; additive in `db/schema.sql`, `app/globals.css`, `lib/copy.ts` | building | — | — |
| Token-budget governor | cross-cutting build | cloud child session | `claude/token-budget-governor` (head `341e6c7`, 10:32 UTC) | — (no draft PR) | `scripts/token-budget.ts` (+test), `docs/token-budget.md` | building | — | — |
| F-9 thesis safety | feature build | — | — | — | `lib/moderation.ts` (+test), new `lib/reports.ts`, new `app/user-note.tsx`, an owner-run `scripts/` release script, an additive `db/schema.sql` block; replaces the thesis moderation call in `app/actions.ts` (not additive: in `SHARED`, so the orchestrator sequences it after #42 and F-7, [Known overlaps](#known-overlaps)) (coordination log) | planned | swaps in `UserNote` on cards and rows after F-2 #30 (merged) and F-6 #33 (merged); reuses `lib/rate-limit.ts` (on main since #16) without editing it; #42 changed that file and merged at 10:08 UTC, so merge main first | — |
| Fix #4: Disconnected label | fix | — | — | — | `app/u/[handle]/page.tsx`, `lib/copy.ts`, `app/pane.tsx` (`docs/ideas/approval-2026-11-01.md` → Fixes to build now, row 4) | planned | F-2 #30 (merged) | — (before F-11) |
| F-11 record status line | feature build | — | — | — | new `lib/record-status.ts` (+test), the status line under "Record since" in `app/u/[handle]/page.tsx`, its use in `app/pane.tsx` and the trade and month pages (coordination log) | planned | fix #4 (Disconnected) first | — (before F-14) |
| F-14 sync cadence | feature build (folded into sharded sync) | cloud child session | `claude/sharded-sync` | #46 (no F-14 change in its diff at 10:06 UTC) | `lib/sync.ts`, `app/api/sync/**`, an additive `db/schema.sql` block for per-account timestamps; no `vercel.json` change (coordination log) | building (the session's State; Update rule) | F-11 | — (after F-11) |
| Fix: user-text safety | fix | cloud child session (inferred from the branch) | `claude/fix-user-text-safety` (head `5668773`, 10:33 UTC; unregistered) | — (no draft PR) | from the branch diff: new `lib/text-safety.ts`, `lib/reports.ts`, `lib/report-copy.ts`, `lib/user-note.ts`, `lib/handles.ts`, `lib/thesis-review.ts`, `lib/thesis-save.ts`, `app/user-note.tsx`, `app/report-note.tsx`, `app/review/theses/page.tsx`, `scripts/review-theses.ts` (+tests), `e2e/thesis-safety.spec.ts`; edits in `lib/moderation.ts`, `lib/theses.ts`, `lib/auth/attempts.ts`, `lib/delete.ts`, `lib/feed.ts`, `lib/sync.ts`, `lib/ticker.ts`, `lib/trade-share-load.ts`, privacy maps, `app/actions.ts`, `app/auth/actions.ts`, `app/feed-rows.tsx`, `app/pane.tsx`, `app/t/[symbol]/**`, `app/u/[handle]/**`, `app/ui.tsx`, `app/login/dev/page.tsx`, `e2e/app.spec.ts`, `scripts/db-setup.ts`; additive in `db/schema.sql`, `app/globals.css` | building | its diff holds F-9's planned files and `lib/handles.ts` (C9, now an approval-cycle-2 feature): the orchestrator confirms whether F-9 is folded in | — |
| Fixes, approval cycle 2: accessibility | fix | cloud child session (inferred from the branch) | `claude/fixes-cycle2-a11y` (head `840ff5f`, 10:33 UTC; unregistered) | — (no draft PR) | not yet (log directory only: plan signed in round 2) | building | `docs/ideas/approval-2026-11-01-cycle2.md` → fixes list, "Possible overlap" column | — |
| Other fixes from the approval record (#2, #3, #5–#25) | fix | — | — | — | per fix, in `docs/ideas/approval-2026-11-01.md` → Fixes to build now ("the orchestrator builds them directly"); which of them truthful labels and user-text safety already hold: the orchestrator confirms | planned | as that table's "Possible overlap" column says | — |
| F-10 follow-up: feed-card ticker, three versions | feature build (three variants) | — | — | issue #49 (opened by the owner 09:59 UTC) | to be assigned | planned | F-10 merged; an open-pane-rate counter first (issue text) | — |
| F-15 to F-20 (approval cycle 2, #53) | feature build | — | — | — | to be assigned (`docs/ideas/approval-2026-11-01-cycle2.md`; F-15–F-18 and F-20 read `Status: blocked` on main, F-19 `ready`) | planned | as the approval record and the feature files say (its fix #28 goes before F-15; fix #4 before F-16) | — |

Waiting for the next approval cycle (coordination log, "Approval council 2026-11-01"): C9 handle and name integrity
(would own new `lib/handles.ts` and the signup and rename checks in `lib/auth/**`, after security hardening merges;
approval cycle 2 since approved F-17 handle and name integrity, and `claude/fix-user-text-safety` already adds
`lib/handles.ts`); C17 privacy-safe gate counters (overlaps `lib/display-log.ts` and `app/api/events/**`). C1's
remainder rides with fix #3.

## Merge order (current)

#46 sharded sync → the rest as they reach green and reviewed, with these fixed constraints: F-10 before F-12 (both
in #54); fix #4 before F-11; F-11 before F-14 (coordination log). Merged since the 09:41 snapshot: #40 (09:48 UTC),
#48 (10:03 UTC), #42 (10:08 UTC), #51 (10:21 UTC), #53 (10:24 UTC). A PR that is green and reviewed earlier may go earlier when it
conflicts with no unmerged PR above it ([collaboration.md → Merge order](collaboration.md#merge-order)). The
process-docs PR is merged by the owner.

## Known overlaps

Files that two or more current items change, from the branch diffs at 10:06 UTC plus the planned rows (#42 has
merged since: "#42 (merged)" means its change is on main, so merge main before editing that file). Not yet re-derived
for the branches that changed after 10:06 UTC (options trades, user-text safety, F-13): read their rows above. Every file here
counts as shared ([collaboration.md → Shared files](collaboration.md#shared-files)) until the overlap ends. "KL" =
the known-limits sweep.

| File | Items | Note |
|---|---|---|
| `db/schema.sql` | #42 (merged), #46, F-7, truthful labels, KL, F-9, F-14 | in `SHARED`; appended, idempotent blocks only |
| `lib/trades.ts` | truthful labels, KL | not in `SHARED`; #40's matcher is on main, keep it |
| `lib/sync.ts` | #46, F-7, KL, F-14 | #46 owns the structure |
| `app/api/sync/route.ts` | #46, F-7 | #46 owns `app/api/sync/**` |
| `e2e/cron-lock.ts`, `e2e/privacy-gate.spec.ts` | #46, KL | both add `e2e/cron-lock.ts`; the later one merges main and keeps #46's version |
| `lib/privacy-retention.ts` | #42 (merged), #46, F-7, KL | not in `SHARED`; additive `SCHEMA_MAP` entries only |
| `lib/privacy-fields.ts` | F-7, KL | not in `SHARED`; additive entries only |
| `lib/connections.ts` | #42 (merged), F-7, KL | not in `SHARED` |
| `lib/auth/attempts.ts`, `.env.example` | #42 (merged), F-7 | not in `SHARED` |
| `lib/recap-load.ts`, `lib/trade-share-load.ts` | #42 (merged), F-7, F-10/F-12 | not in `SHARED` |
| `app/u/[handle]/page.tsx` | #42 (merged), F-7, F-13, KL, F-11, fix #4 | in `SHARED` |
| `lib/copy.ts` | #42 (merged), F-7, F-10/F-12, F-13, fix #4 | in `SHARED` |
| `app/globals.css` | F-7, F-10/F-12, F-13 | in `SHARED` |
| `app/actions.ts` | #42 (merged), F-7, F-9 | in `SHARED`; F-9's change is not additive (sequenced after #42 and F-7) |
| `lib/rate-limit.ts` | #42 (merged), F-9 (reads only) | on main since #16; F-9 reuses it, never edits it (coordination log) |
| `lib/feed.ts` | F-7, F-10/F-12, KL | in `SHARED` |
| `app/feed-rows.tsx`, `app/ui.tsx` | F-7, F-10/F-12, F-13 | not in `SHARED` |
| `app/pane.tsx` | F-7, F-13, F-11, fix #4 | not in `SHARED` |
| `e2e/app.spec.ts` | F-10/F-12, F-13, KL | in `SHARED` |
| `e2e/connect.spec.ts` | #42 (merged), #46, F-10/F-12, F-13, KL | not in `SHARED`; additive tests only |
| `lib/claims.ts` | F-13, KL | not in `SHARED` |
| `lib/follows.ts`, `lib/similar.ts`, `app/sitemap.ts` | F-7, KL | not in `SHARED` |
| `lib/record-card.ts`, `lib/month-card.ts` | F-7, F-10/F-12 | not in `SHARED` |
| `app/card-menu.tsx`, `app/t/[symbol]/Theses.tsx`, `app/t/compare/page.tsx` | F-7, F-13 | not in `SHARED` |
| `app/t/[symbol]/page.tsx`, `app/t/page.tsx`, `app/t/[symbol]/opengraph-image.tsx` | F-7, truthful labels; F-13 (`page.tsx`); F-10/F-12 (`opengraph-image.tsx`) | fixes #2, #3, #8 build first (coordination log) |
| trade and month pages and images under `app/u/[handle]/` | F-7, F-10/F-12, F-13, F-11 | not in `SHARED` |
| `lib/db.ts` | #46 | in `SHARED` |
| `lib/confidence.ts` | F-10 (reads only) | F-4 #35 merged |
| `lib/display-log.ts`, `app/api/events/**` | C17 (next cycle), KL (one ponytail line in `lib/display-log.ts`) | privacy groundwork #31 and F-2 #30 merged |

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
never a sign that a feature is free to claim: use the Work items table and GitHub. Read on main 2026-11-01 09:41 UTC
(re-read 09:47 and 10:37 UTC, unchanged; F-8 reads `draft` after its design-only #51):

| Feature | Merged in | `Status:` line on main |
|---|---|---|
| F-6 | #33 | `ready` |
| F-3 | #36 | `ready` |
| F-2 | #30 (its PR-5 and PR-6) | `ready` |
| F-4 | #35 | `rework` (no row holds further F-4 rework; ask the orchestrator before treating it as free) |

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
