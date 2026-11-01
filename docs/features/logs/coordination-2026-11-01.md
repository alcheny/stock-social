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

New features approved by the approval council (`team/approval-council.md`, at most six per cycle) join this map
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

## Approval council 2026-11-01 (cycle 2): approved features (F-15 to F-20)

Record: `docs/ideas/approval-2026-11-01-cycle2.md`. Each line lists the files the build will likely own, then the
overlaps with running work. Merge position is set by the orchestrator. The council's sequencing and lapse conditions
are noted. Five build slots: F-15, F-16, F-17, F-20 then F-18 (one `app/globals.css` slot), F-19 first slice.
Statuses: F-19 (first slice) is ready; F-15, F-16, F-17, F-18 and F-20 are `blocked` with a `Blocked:` line, flipped
to ready by the orchestrator as prerequisites merge. F-15, F-16 and F-17 all add additive `db/schema.sql` blocks and
`lib/privacy-retention.ts` `SCHEMA_MAP` rows (rebase, additive only). #42 has merged (ea7cd52).

- **F-15 measurement foundation, first slice** (`docs/features/F-15-measurement-foundation.md`). Owns a new beacon
  component and route (beside `app/api/events/**`), a new daily rollup table and readout script, the `via` registry
  in `lib/referral.ts`, `?via=` on `app/share-button.tsx`, and additive `db/schema.sql` blocks with `SCHEMA_MAP`
  rows in `lib/privacy-retention.ts`. Overlaps: fix #28 edits the same `REFERRED_SURFACES` list (lands first); F-7
  (`claude/f7-public-traders`) also edits `lib/referral.ts` and `db/schema.sql`; F-13 owns `app/layout.tsx` (the
  beacon mounts from its own component, not the layout, until F-13 merges); the `share_action` half edits
  `app/u/[handle]/share-prompt.tsx`, `app/u/[handle]/share-card.tsx` and `lib/display-log.ts` and starts after F-13
  merges; fix #27 relabels the share columns in the same area; #46 adds `db/schema.sql` blocks (rebase).
  Lapses to the next council if not started.
- **F-16 trust and safety slice** (`docs/features/F-16-trust-and-safety-slice.md`). Owns a profile target in F-9's
  `lib/reports.ts` (not on main yet), the report form and anti-impersonation line in `app/u/[handle]/page.tsx` and
  `app/pane.tsx`, the hidden state in fix #4's shared visible-user predicate, owner-run hide and digest scripts under
  `scripts/`, a new takedown page, a runbook doc, and an additive `db/schema.sql` audit block. Overlaps: F-9 (reports
  table, review-queue flag, `app/actions.ts`), fix #4 (`app/t/**`, `app/sitemap.ts`, stock image; build first), fix
  #27 (`app/actions.ts`; `lib/rate-limit.ts` from #42 reused, not edited), F-11 and F-7 (`app/u/[handle]/page.tsx`,
  `app/pane.tsx`), F-17 (`app/u/[handle]/page.tsx` only, small). Starts after F-9 and fix #4; lapses if F-9 has not
  merged by the next council.
- **F-17 handle and name integrity** (`docs/features/F-17-handle-and-name-integrity.md`). Owns new `lib/handles.ts`
  (+test), the sign-up and rename checks in `lib/auth/attempts.ts` and `app/auth/actions.ts` (`setHandle`), a hold
  table in an additive `db/schema.sql` block, release of holds in `lib/delete.ts`'s path, and the old-handle 404 page.
  Overlaps: #42 has merged its edits to `lib/auth/attempts.ts` and `app/auth/actions.ts`; F-7 also edits
  `lib/auth/attempts.ts`; reuses F-9's normaliser in `lib/moderation.ts` (read only); privacy groundwork's D22
  rename block (kept). Starts after F-9 merges (normaliser); lapses if F-9 has not merged by the next council.
- **F-20 design tokens and contrast test** (`docs/features/F-20-design-tokens-and-contrast-test.md`). Owns the token
  layer in `app/globals.css`, an extended `lib/a11y-contrast.test.ts` (from `claude/f13-a11y-fixes`, not on main),
  the kept `lib/badge-contrast.test.ts`, and a new exported image colour table read by every `opengraph-image.tsx`
  and `lib/month-card.ts`. Overlaps: fixes #12, #13, #26 (same lines; build first), fixes #14, #18, #30 and F-7,
  F-10..F-13 branches all edit `app/globals.css` (merge after them, one PR); F-12 owns the trade and month images
  (colour table only). Lands before F-18. Lapses if the contrast-test branch and fixes #12, #13, #26 have not merged.
- **F-18 one trust language** (`docs/features/F-18-one-trust-language.md`). Owns new `lib/trust-look.ts`, `Badge` in
  `app/ui.tsx`, trust strings in `lib/copy.ts`, `/how` anchors in `app/how/page.tsx`, the badge move in
  `app/u/[handle]/page.tsx` and `app/pane.tsx`, the footer in `app/layout.tsx`, `app/t/page.tsx` metadata, and
  `lib/record-card.ts` / `lib/month-card.ts` labels. Overlaps: F-10..F-13 (`app/ui.tsx`, `lib/copy.ts`,
  `app/pane.tsx`, `app/layout.tsx`, `app/globals.css`), F-7 (`app/ui.tsx`, `lib/copy.ts`, `app/how/page.tsx`,
  `app/t/page.tsx`; F-7's label stays F-7's), fixes #1, #2, #8, #9, #10 (build first, no duplicates). Shares F-20's slot, after F-20. Lapses if F-10..F-13 and those fixes have not merged.
- **F-19 number format and ranges** (`docs/features/F-19-number-format-and-ranges.md`). First slice (may start now)
  owns `lib/format.ts` (`pct`, `winPct`, `tone`), re-exports in `lib/trades.ts`, `lib/open-split.ts` and
  `app/open-rows.tsx` (`toneClass` delegates), and the What's-this constant.
  Overlaps: #40 merged (`lib/trades.ts` moved `pct`); F-13's branch edits `lib/open-split.ts`; fixes #7 and #19 (ranges and Flat on today's surfaces; the sweep builds on them). The call-site
  sweep (about 16 files), the every-surface range test and the What's-this placement are a later rework (after F-10..F-12, F-18 and fix #7), in the F-20, F-18, F-19
  lane. Sweep lapses if those have not merged by the next council.

Fixes list for cycle 2 (30 rows, #29 dropped as resolved by #40; `docs/ideas/approval-2026-11-01-cycle2.md`): built by the orchestrator without a vote, before the features that depend on them (fix #2 with the route-tree disclaimer guard first; fix #4 before F-16; fix #28 before F-15; fixes #12, #13, #26 before F-20; fixes #1, #2, #8, #9, #10 before F-18). Waiting, first in line next cycle: K18 age-law posture as an addition to F-16.
