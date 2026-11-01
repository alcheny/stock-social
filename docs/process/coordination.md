# Coordination (snapshot)

Snapshot taken: 2026-11-01 09:35 UTC by a cloud child session (the process-docs session); source: REST
`gh api 'repos/alcheny/stock-social/pulls?state=open&per_page=100'`, the MCP tool `list_pull_requests`,
`git ls-remote origin 'refs/heads/claude/*'` and `git diff --name-only origin/main...origin/claude/<topic>`, with
main at `e12a834` (#30 merged 09:32 UTC).

Orchestrator of record: the owner's orchestrating chat session (its session id stays private:
[architecture.md](architecture.md)).

Budget: Window resets 2026-11-01 15:00 UTC (orchestrator report); admitting: _orchestrator fills: yes | queue-only_
([budget-and-rate.md](budget-and-rate.md)).

## Update rule

- GitHub beats this table. Whether a PR exists, is draft or ready, its CI and whether it merged are read from GitHub
  ([collaboration.md → Tool recipes](collaboration.md#tool-recipes)). This table holds what GitHub does not: files
  owned, merge position, depends-on and plans that have no PR yet. Columns GitHub already holds (Branch, PR) are
  *derived*: when they disagree with GitHub, GitHub is right.
- One row per work item. A client edits only its own row, in its own PR (the draft-PR claim:
  [collaboration.md → Claiming and releasing work](collaboration.md#claiming-and-releasing-work)).
- The orchestrator of record reconciles the table (adds planned rows, sets merge positions, fixes stale rows) and wins
  disagreements between clients; GitHub's state is above both.
- Rows are sorted by merge position, then by work item; rows without a position come last. On a merge conflict in this
  file, use the conflict recipe in [collaboration.md → Conflicts](collaboration.md#conflicts).
- No session ids, usage numbers, costs or personal data here (POLICY P1, P5; [budget-and-rate.md](budget-and-rate.md)).
- State values are the work-item States of [lifecycle.md → States](lifecycle.md#states).

## Work items

Merge positions 1–4 follow the coordination log's order for the items still open (security hardening → stock splits
→ sharded sync → councils); the orchestrator confirms or changes them. "—" = not set yet. "Files owned" for open
branches is what the branch changes against main at snapshot time, outside `docs/features/logs/` (each item also
writes its own log directory there).

| Work item | Kind | Client kind | Branch | PR | Files owned | State | Depends on | Merge position |
|---|---|---|---|---|---|---|---|---|
| Security hardening | cross-cutting build | cloud child session | `claude/security-hardening` | #42 (no label) | `next.config.ts` headers and CSP, `proxy.ts`, `instrumentation.ts`, `lib/csp.ts`, `lib/rate-limit.ts`, `lib/auth/**` hardening, `lib/secret-env.ts`, `lib/params.ts`, `docs/security/`; additive in `app/actions.ts`, `app/u/[handle]/page.tsx`, `lib/copy.ts`, `db/schema.sql` | pr-ready | — | 1 |
| Corporate actions (stock splits, F3c) | cross-cutting build | cloud child session | `claude/corporate-actions` | #40 (`feature`) | `lib/trades.ts` matcher, `lib/corporate-actions.ts` (+tests); additive in `lib/sync.ts`, `db/schema.sql`, `lib/copy.ts`, `app/u/[handle]/page.tsx`, privacy maps | pr-ready | — | 2 |
| Sharded sync | cross-cutting build | cloud child session | `claude/sharded-sync` | #46 (no label) | `lib/sync.ts` structure, `app/api/sync/**`, `lib/sync-*.ts`, `docs/SYNC.md`, `e2e/sync-shards.spec.ts`, `e2e/cron-lock.ts`; additive in `lib/db.ts`, `db/schema.sql`, privacy maps | pr-ready | — | 3 |
| Market research council, cycle 2 | council / record | cloud child session | `claude/market-research-2-2026-11-01` | #47 (`feature`) | `docs/direction/market-2026-11-01-cycle2.md` | pr-ready | — | 4 |
| Process docs (this file's PR) | docs | cloud child session | `claude/process-docs-2026-11-01` (not pushed at snapshot) | — | `docs/process/**`; structure-only edits to CLAUDE.md, AUTOPILOT.md, FEATURES.md, IMPLEMENTATION.md, COMPLIANCE.md, IDEAS.md, `team/**`, the coordination log's header (scope extension 09:08 UTC: [decisions-and-authority.md](decisions-and-authority.md#delegations-by-the-owner)) | building | — | — (touches CODEOWNERS paths: owner merges or approves) |
| F-7 public traders | feature build | cloud child session | `claude/f7-public-traders` | — | `lib/public-gate.ts`; additive in `db/schema.sql` (so far) | building | — | — |
| F-10 feed record line + F-12 trade and month record strip | feature build | cloud child session | `claude/f10-f12-record-strip` | — | `app/record-strip.tsx`, `lib/record-strip.ts`, `lib/png.ts` (+tests); F-12: `app/u/[handle]/trade/**`, `app/u/[handle]/month/**`, `lib/trade-share.ts`, `lib/month-card.ts`, the strip on `app/t/[symbol]/opengraph-image.tsx` (coordination log); additive in `app/globals.css`, `lib/copy.ts` | building | F-10: F-2 #30 (merged); F-12: F-4 #35 (merged) and F-10 | — |
| F-13 first-visit line + accessibility fixes | feature build | cloud child session | `claude/f13-a11y-fixes` | — | `app/first-visit.tsx`, one entry in `lib/copy.ts`, the nav label in `app/layout.tsx` (coordination log); additive in `app/globals.css` | building | F-2 #30 (merged) | — |
| Fix: truthful labels | fix | cloud child session | `claude/fix-truthful-labels` | — | `app/t/**` (ticker pages, `Concentration.tsx`, `opengraph-image.tsx`), `lib/ticker-sql.ts` (+tests); edits in `lib/trades.ts`, additive in `db/schema.sql` | building | — | — |
| Options trades | cross-cutting build | cloud child session | `claude/options-trades` | — | not yet (log directory only) | building | — | — |
| Token-budget governor | cross-cutting build | cloud child session | `claude/token-budget-governor` | — | `scripts/token-budget.ts` (+test), `docs/token-budget.md` | building | — | — |
| Design system council | council / record | cloud child session | `claude/design-system-2026-11-01` | — | `docs/direction/design-system-2026-11-01.md`, `docs/direction/screens-design-system-2026-11-01/` | building | — | — |
| F-8 prediction game (design only) | council / record | cloud child session | `claude/f8-game-design-2026-11-01` | — | `docs/direction/game-2026-11-01/**` | building | — | — |
| F-9 thesis safety | feature build | — | — | — | `lib/moderation.ts` (+test), the thesis path in `app/actions.ts`, new `lib/reports.ts`, new `app/user-note.tsx`, an owner-run `scripts/` release script, an additive `db/schema.sql` block (coordination log) | planned | swaps in `UserNote` on cards and rows after F-2 #30 (merged) and F-6 #33 (merged); reuses `lib/rate-limit.ts` from #42 without editing it | — |
| F-11 record status line | feature build | — | — | — | new `lib/record-status.ts` (+test), the status line under "Record since" in `app/u/[handle]/page.tsx`, its use in `app/pane.tsx` and the trade and month pages (coordination log) | planned | fix #4 (Disconnected) first | — (before F-14) |
| F-14 sync cadence | feature build (inside the sharded-sync session) | cloud child session | `claude/sharded-sync` (no F-14 change in #46 at snapshot) | — | `lib/sync.ts`, `app/api/sync/**`, an additive `db/schema.sql` block for per-account timestamps; no `vercel.json` change (coordination log) | planned | F-11 | — (after F-11) |
| Fix: user-text safety | fix | — | — | — | — | planned | — | — |
| Known-limits sweep | cross-cutting build | — | — | — | — | planned | — | — |

Waiting for the next approval cycle (coordination log, "Approval council 2026-11-01"): C9 handle and name integrity
(would own new `lib/handles.ts` and the signup and rename checks in `lib/auth/**`, after security hardening merges);
C17 privacy-safe gate counters (overlaps `lib/display-log.ts` and `app/api/events/**`). C1's remainder rides with
fix #3.

## Merge order (current)

#42 security hardening → #40 corporate actions → #46 sharded sync → #47 market research cycle 2 → the rest as they
reach green and reviewed, with these fixed constraints: F-10 before F-12; fix #4 before F-11; F-11 before F-14
(coordination log). A PR that is green and reviewed earlier may go earlier when it conflicts with no unmerged PR above
it ([collaboration.md → Merge order](collaboration.md#merge-order)). The process-docs PR is merged by the owner.

## Known overlaps

Files that two or more current items change. Every file here counts as shared
([collaboration.md → Shared files](collaboration.md#shared-files)) until the overlap ends.

| File | Items | Note |
|---|---|---|
| `db/schema.sql` | #40, #42, #46, F-7, truthful labels, F-9, F-14 | appended, idempotent blocks only |
| `lib/trades.ts` | #40 (matcher), truthful labels | not in `SHARED`; truthful labels merges main after #40 and keeps the matcher change |
| `lib/sync.ts` | #40, #46, F-14 | #46 owns the structure |
| `lib/privacy-retention.ts` | #40, #42, #46 | not in `SHARED`; additive `SCHEMA_MAP` entries only |
| `app/u/[handle]/page.tsx` | #40, #42, F-11 | in `SHARED` |
| `lib/copy.ts` | #40, #42, F-10/F-12, F-13 | in `SHARED` |
| `app/globals.css` | F-10/F-12, F-13 | in `SHARED` |
| `app/actions.ts` | #42, F-9 (thesis path) | in `SHARED` |
| `lib/rate-limit.ts` | #42, F-9 (reads only) | F-9 reuses it, never edits it (coordination log) |
| `lib/db.ts` | #46 | in `SHARED` |
| `e2e/connect.spec.ts`, `e2e/fakes/vendor.ts` | #40, #42, #46 (`connect.spec.ts`); #40, #46 (`fakes/vendor.ts`) | not in `SHARED`; additive tests only |
| `app/t/[symbol]/opengraph-image.tsx` | F-12, truthful labels | fixes #2, #3, #8 build first (coordination log) |
| `lib/feed.ts`, `app/page.tsx` (card markup) | F-10, F-13 | F-2 #30 merged; F-6's "Also open" line coexists |
| `app/pane.tsx` | F-11 | F-2 #30 merged |
| `lib/confidence.ts` | F-10 (reads only) | F-4 #35 merged |
| `lib/display-log.ts`, `app/api/events/**` | C17 (next cycle) | privacy groundwork #31 and F-2 #30 merged |

## Other lanes and reserved branches

| Branch | What | State at snapshot |
|---|---|---|
| `claude/serene-faraday-f45ffc` | orchestrator's own branch (PRs #24, #25, #41, #43) | all merged |
| `claude/adoring-euler-4469ys` | old pipeline branch (F-1/F-2 PRs #8–#11, #15–#23, 2026-10-23 to 10-24) | all merged |
| `claude/peaceful-dirac-33bucv` | no PR; last commit 2026-10-25 | stale, unclaimed: do not build on it |
| `claude/ci-shard-e2e`, `claude/idea-board-2026-11-01`, `claude/privacy-launch-gate`, `claude/publish-separate-job`, `claude/f2-discovery-pr5-pr6`, `claude/f3-viewer-subscriptions`, `claude/f4-share-card-rework`, `claude/f6-open-positions`, `claude/approval-council-2026-11-01`, `claude/business-council-2026-11-01`, `claude/market-research-council-2026-11-01`, `claude/creative-direction-2026-11-01`, `claude/design-direction-2026-11-01` | merged work (#29, #32, #31, #37, #30, #36, #35, #33, #44, #45, #39, #34, #38) | merged; branches kept |
| `autopilot/*`, `line/a`, `line/b`, `line/c` | lane A ([AUTOPILOT.md](../AUTOPILOT.md)) | `line/a|b|c` exist; switch `AUTOPILOT` off (inferred, [collaboration.md](collaboration.md#when-features-or-autopilot-is-on)) |
| `feature/*` | lane B ([FEATURES.md](../FEATURES.md)) | none exist; switch `FEATURES` off (inferred) |
| `dependabot/*` | dependency bot | one open branch, no open PR |

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
- Merge positions 1–4 are inferred from the coordination log's order — the orchestrator setting them would remove it.
- The budget line's "admitting" value needs the orchestrator, because usage data stays private — a published
  admission flag would remove it (open question Q9).
- Kinds without a branch (user-text safety, known-limits sweep) have no owned files yet — their sessions' claims will
  fill them.
