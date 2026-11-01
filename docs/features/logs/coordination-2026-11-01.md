# Parallel build of 2026-11-01: file ownership and merge order

The owner's autonomous build runs thirteen sessions at once. Each owns the files below; everything else is shared and
takes additive edits only (a block named for the session; schema appended and idempotent; tests in new files).
The orchestrator merges one PR at a time in the order below, and every other session then merges `main` into its
branch (never rebase or force-push).

| Session | Owns |
|---|---|
| PR #25 (orchestrator) | scripts/team.ts, scripts/features.ts, scripts/autopilot.ts, .github/workflows/features.yml and build.yml, team/, docs/IDEAS.md, docs/features/*.md decisions |
| Privacy groundwork | lib/launch-gate.ts, lib/privacy-*.ts, lib/display-log.ts, the tick's purge additions, the likes and consent copy |
| CI speed | .github/workflows/ci.yml |
| Security hardening | next.config security headers and CSP, lib/rate-limit.ts, docs/security/ |
| Stock splits | lib/trades.ts matcher, lib/corporate-actions.ts |
| Sharded sync | lib/sync.ts structure, app/api/sync/**, lib/sync-*.ts |
| F-6 open positions | lib/open-split.ts, F-6 additions to the profile, feed card and pane, app/t/** |
| F-4 share card | lib/record-card.ts, lib/confidence.ts, the card image routes, share-prompt.tsx |
| F-2 PR-5 and PR-6 | lib/discovery/**, app/api/events/**, app/me/** |
| F-3 billing and Record tools | lib/billing.ts, lib/record-tools*.ts, app/api/billing/**, the Record tools and account routes |
| Idea board | docs/ideas/, docs/IDEAS.md (the only writer of the register), "Idea board" notes in feature files |
| Market research, creative direction, design direction councils | their own files under docs/direction/ (proposals go in a table at the end of each; the idea board adds them to the register) |

Merge order (smallest blast radius first, then dependencies): #25 → CI speed → Privacy groundwork → Security
hardening → Stock splits → Sharded sync → F-6 → F-4 → F-2 → F-3 → Idea board → the three councils (docs only; then the idea board reviews their proposals). A PR that is green and reviewed
earlier than its turn may merge earlier when it does not conflict with an unmerged one above it.

Known overlaps to handle at merge: lib/sync.ts (sync structure, privacy log hygiene); lib/feed.ts and app/page.tsx
(F-2, F-6); app/u/[handle]/page.tsx (F-4 record length, F-6); lib/copy.ts, app/globals.css, db/schema.sql (most
sessions); lib/trades.ts (splits; F-6 only if needed).

## Closing finished work (owner, 2026-11-01)

To save tokens, the orchestrator archives a session as soon as its work is complete: its PR merged, or its record
delivered and checked with nothing left for it. A session never schedules its own recurring check-ins; once its PR
is open and green and it has reported, it stops and waits for review findings or the merge.

New features approved by the approval council (`team/approval-council.md`, at most three per cycle) join this map
with their owned files and merge position before their build session starts.

## Approval council 2026-11-01: approved features (F-9 to F-14)

Record: `docs/ideas/approval-2026-11-01.md`. Each line lists the files the build will likely own, then the overlaps
with running work. Merge position is set by the orchestrator. The council's sequencing conditions are noted.

- **F-9 thesis safety** (`docs/features/F-9-thesis-safety.md`). Owns `lib/moderation.ts` (+test), the thesis path in
  `app/actions.ts`, new `lib/reports.ts`, new `app/user-note.tsx`, an owner-run `scripts/` release script, and an
  additive `db/schema.sql` block. Overlaps: security hardening (reuse `lib/rate-limit.ts`, don't edit it); F-2 #30
  and F-6 render theses on cards and rows (swap in `UserNote` after they merge); privacy groundwork's log hygiene
  (thesis text never logged).
- **F-10 feed record line + shared RecordStrip** (`docs/features/F-10-feed-record-line.md`). Owns new
  `app/record-strip.tsx` and `lib/record-strip.ts`, plus the record line in the feed card and its aggregate query. It
  starts only after F-2 #30 merges, because it edits the card markup in `lib/feed.ts` / `app/page.tsx`. Overlaps:
  F-6's "Also open" line (coexists), `lib/confidence.ts` (F-4 #35; read only), fix #3 (feed disclaimer).
- **F-11 record status line** (`docs/features/F-11-record-status-line.md`). Owns new `lib/record-status.ts` (+test), the
  status line under "Record since" in `app/u/[handle]/page.tsx`, and its use in `app/pane.tsx` and the trade and month
  pages. Overlaps: fix #4 (Disconnected; build the fix first), F-2 #30 (pane and card), F-10 (card), F-12 (trade and
  month pages). It merges before F-14.
- **F-12 trade and month record strip** (`docs/features/F-12-trade-month-record-strip.md`). Owns
  `app/u/[handle]/trade/**`, `app/u/[handle]/month/**` and their `opengraph-image.tsx`, `lib/trade-share.ts`,
  `lib/month-card.ts`, and the strip on `app/t/[symbol]/opengraph-image.tsx`. It starts only after F-4 #35 and F-10
  merge (it reuses F-10's RecordStrip). Overlaps: fixes #2, #3 and #8 touch the same files (build the fixes first);
  the F-4 record card (`lib/record-card.ts`) is untouched.
- **F-13 first-visit line and swipe hint** (`docs/features/F-13-first-visit-line.md`). Owns new `app/first-visit.tsx`, one
  entry in `lib/copy.ts`, and the nav label in `app/layout.tsx`. It starts after F-2 #30 merges (feed). Overlaps:
  privacy groundwork's cookie tests (no new cookie), F-7 (#43) if public profiles enter the feed.
- **F-14 sync cadence** (`docs/features/F-14-sync-cadence.md`). It is built inside the running sharded-sync session, which
  owns `lib/sync.ts` and `app/api/sync/**`, plus an additive `db/schema.sql` block for per-account timestamps. No
  `vercel.json` change. It merges after F-11.

Waiting, first in line next cycle: C9 handle and name integrity (would own new `lib/handles.ts` and the signup and
rename checks in `lib/auth/**`, after security hardening merges), and C17 privacy-safe gate counters (overlaps
`lib/display-log.ts` from privacy groundwork and `app/api/events/**` from F-2). C1's remainder rides with fix #3.
