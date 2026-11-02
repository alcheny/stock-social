# Parallel build of 2026-11-01: file ownership and merge order

Dated record of 2026-11-01. The live snapshot is `docs/process/coordination.md`; the rules now live in `docs/process/collaboration.md` and `docs/process/lifecycle.md`.

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

## Approval council 2026-11-01 (cycle 3): approved features (F-21 to F-24) and re-approvals (F-16, F-17, F-20)

Record: `docs/ideas/approval-2026-11-01-cycle3.md` (base f467293). Four build slots. Nothing can start today: every
file below is `Status: blocked` with a `Blocked:` line, and each approval lapses to council cycle 4 if its prerequisite
has not merged by then. The orchestrator flips each to ready as its prerequisites merge. F-18 went to `Status: draft`
and F-19's sweep lapsed (not re-approved).

- **Ledger slot: F-22 transfers as share moves, then F-24 late-posted trades** (`docs/features/F-22-transfers-as-share-moves.md`,
  `docs/features/F-24-late-sell-reconciliation.md`). Owns the TRANSFER path in `lib/trades.ts` and
  `lib/corporate-actions.ts`, a reconciliation step in `lib/sync.ts` (reads through the existing `fetchActivitiesPage`;
  `lib/broker.ts` is protected and untouched), an additive `excluded_transferred_out` column and re-issue counter in
  `db/schema.sql`, the transferred-out line in `app/u/[handle]/page.tsx` and `lib/copy.ts`, and /how's transfer line.
  F-22 waits for the owner's yes (it amends `lib/trades.ts:52`), F-14 (PR #64, `claude/f14-sync-cadence`, rewrites `syncUser`),
  cycle-3 fixes F3-1, F3-5, F3-15 and `claude/fix-truthful-labels`. F-24 waits for F-14 and runs inside its read
  budget. Overlaps: PR #62 options (`lib/trades.ts`, `lib/sync.ts`, `db/schema.sql`), the cycle-3 fixes branch.
- **Pane and payload slot: F-21 exclusion counts, then F-23 payload precision** (`docs/features/F-21-exclusion-counts-beside-the-headline.md`,
  `docs/features/F-23-public-payload-precision.md`). Owns one shared exclusion-sum function (new, in `lib/`), its line in
  `app/pane.tsx` and the record strip (`app/record-strip.tsx`, `lib/record-strip.ts`), serialisation rounding in
  `app/u/[handle]/pane/route.ts`, the pane-chart route, `lib/chart-series.ts` and `lib/feed.ts` (client data only).
  Both wait for fix F3-2 (same pane files); F-21 also takes F-22's count when F-22 lands first. F-21 needs the
  rename-chain `notShared` fix (`lib/sync.ts:123-129`) on the fixes list. Overlaps: F-13 (merged as #55, 92d03f4; pane and feed),
  F-7 (merged as #56, d98f32d; it edited the pane and profile), F-11 (pane status line), F-16 (pane report control).
- **Trust and safety slot: F-16 (with K18's under-18 report), then F-17** (re-approved; files unchanged from cycle 2).
  Both wait for `claude/fix-user-text-safety` (F-9 built, open as PR #65; merge it next) to merge with F-9's criteria met on
  main; F-16 extends F-9's `lib/reports.ts` (one reports table); F-17 is rework on top of that branch's `lib/handles.ts`
  (`checkDisplayName`, the one normaliser).
- **F-20 design tokens and contrast test** (re-approved; own slot now that F-18 is not re-approved). PR #55 (`lib/a11y-contrast.test.ts`)
  merged as 92d03f4; it waits for cycle-2 fix #26 and a check that #55 covered fixes #12 and #13.

Fixes found during the vote (for the orchestrator's fixes list, no vote): the rename-chain read at `lib/sync.ts:123-129`
lacks `notShared`; `app/ui.tsx:57` says "No thesis posted." over a held thesis; `lib/copy.ts:70`'s oversell line should
name both possible causes (F3-15). Chores the council recommends (no vote): C3-34 health endpoint and 401 log line;
C3-39 Record tools while billing is off (business lead signs off the F-3 entry point) with C3-44; K20 home link
preview; K22 billing hygiene tests.

## Design council cycle 3 (2026-11-01): F-25, F-26, F-27

Record: `docs/features/logs/design-cycle3/committee-2026-11-01.md`. The three features are docs only and blocked. When
they unblock, their files and merge positions are as follows.
- **F-26 no empty-note line.** It builds first, after F-9 (PR #65) merges, and after F-11's branch if both are still
  pending.
  - Files: the note slot in `app/ui.tsx`, the note columns in `lib/feed.ts`, `lib/trade-share-load.ts`, and the trade page.
- **F-25 one link rule for trade rows.** It builds after F-26, F-9 and F-11.
  - Files: new `lib/trade-href.ts`; the trade route's legacy redirect (page body and image route); the row links in
    `app/pane.tsx`, `lib/pane.ts`, `app/t/[symbol]/**` and the month page; the card footer in `app/ui.tsx`; the
    shared footer constant in `lib/copy.ts`; `/me/record` and `app/actions.ts`; the label in `lib/privacy-fields.ts`; the trade match in `lib/views.ts`
    (`viewedUserId`, F-15's view counting).
  - It supersedes F3-8's naming of the stock-page rows.
- **F-27 colour follow-ups.** It builds after F-20 and F-11.
  - Files: a `WarnNotice` component and `.warn-notice` rules, the bar baseline in `app/t/[symbol]/Spread.tsx` and
    `Timeline.tsx`.
  - F-20's file is not edited: its build session owns it.

## F-26 build (branch `claude/f26-held-like-none`), 2026-11-01
- F-9 (#65) merged as ff25ad5, so F-26 is unblocked and built now; F-11 had no open branch at build start, so F-26
  merges origin/main after F-11 lands and re-runs every suite (committee log `docs/features/logs/F-26/committee-2026-11-01.md`).
- `lib/reports.ts`: **no edit.** It already answers a held note and a removed note alike ('not-found', "Reported.
  Thank you.") and maps reported/held to one string; F-26 only adds tests (`lib/f26-held-like-none.db.test.ts`). F-16/F-17
  keep sole ownership of the report categories in that file.
- Shared files, edits kept to the note slot: `app/ui.tsx` (`thesisLine`, new `ownHeld` prop), `app/feed-rows.tsx` (one
  prop), `lib/feed.ts` (the note columns of the candidate and page-row statements; `FeedCandidate.own_held/own_hold_rule`),
  the trade page body (author-only held line), `app/u/[handle]/pane-chart/route.ts` (one SQL line), `app/globals.css`
  (an F-26 block at the end, outside TOKENS). New: `lib/own-note.ts`; `HeldNote` in `lib/user-note.ts`;
  `HELD_EDIT_LINK` in `lib/report-copy.ts`.
- For F-11: if it adds a statement or surface that selects `thesis`, null it unless published (`case when thesis_status =
  'published'`), as F-26's tests require.
- For F-25: the card footer and trade-page links are untouched here; the held line's link uses `lib/paging.ts#tradeHref`.
- 2026-11-01 (F-26, after merging #80-#83): the exploration-extras statement #81 added to `lib/feed.ts` also nulls a
  non-published note now (F-26's source test counts three statements). F-16/F-17 hand-off: Report in F-26's note slots
  (profile, trade page) moves to `tradeKey(sell_id)` once `lib/reports.ts#reportThesis` accepts it (F-16/F-17); until
  then the slots send the row id, as the ponytail in `app/feed-rows.tsx` records. F-26 adds no Report anywhere.
## Approval council 2026-11-01 (cycle 4): approved features (F-28 to F-31) and re-approval (F-23)

Record: `docs/ideas/approval-2026-11-01-cycle4.md` (base e6731d5). Four build slots out of six. Nothing can start today.
Every file below is `Status: blocked` with a `Blocked:` line, and each approval lapses to council cycle 5 if its
prerequisite has not merged by then. The orchestrator flips each to `ready` as its prerequisites merge. F-21 and F-22
went to `Status: draft` (not re-approved, 3.47 each).

- **Matcher slot: F-28 a short's cover never prices a later trade, with F-30 same-instant order on date-only stamps.**
  - Files: `docs/features/F-28-short-cover-never-prices-a-later-trade.md`,
    `docs/features/F-30-same-instant-order-on-date-only-stamps.md`.
  - One builder. Owns the replay in `lib/trades.ts`: a pending-cover count per pair that follows renames, a cover-lot
    flag counted under `excluded`, and the evidence rule at one instant. Also owns `lib/trades.test.ts` and
    `lib/fixes-cycle3.test.ts`.
  - Adds one class-count row to `scripts/f15-readout.ts`, which it coordinates with the readout slot.
  - Both wait for owner Q1, (b) and (a).
  - Overlaps:
    - `claude/fix-truthful-labels` edits only `confidence()` in `lib/trades.ts` (no conflict).
    - The oversell copy (`lib/copy.ts:70`) ships on the fixes list.
    - `scripts/rebuild-records.ts` runs after merge.
  - F-22 (draft) joins this slot last if the owner says yes and a later council re-approves it.
- **Readout slot: F-31 readout limits and partial rows.**
  - File: `docs/features/F-31-readout-limits-and-partial-rows.md`.
  - Owns `scripts/f15-readout.ts` and its test: the limits block, partial rows and the concentration row. It may add an
    additive aggregate for beacons with no trusted address in `db/schema.sql` and `lib/views.ts`.
  - Waits for fixes F4-11 and F4-12 (same file, `claude/fixes-cycle4`), or the fixes builder carries it.
  - Overlaps: F-30's class-count row, and C4-32 / C4-33 if a later council approves them.
- **/how and options copy slot: F-29 gated options wording.**
  - File: `docs/features/F-29-gated-options-wording.md`.
  - Owns the OPTIONS block in `lib/copy.ts`, the options paragraph in `app/how/page.tsx`, the qualifier placement in
    `app/pane.tsx`, `app/u/[handle]/chart.tsx` and `lib/record-strip.ts`, and the gate state in the /how and
    share-image cache keys.
  - Waits for `claude/fix-truthful-labels` (all five files), PR #77 (`lib/record-strip.ts`) and the AI legal
    committee's words.
  - Overlaps: F4-4 and F4-5 (month recap and unfurl qualifiers kept), F-26 (`app/ui.tsx`, untouched here).
- **Pane and payload slot: F-23 public payload precision (re-approved).**
  - File: `docs/features/F-23-public-payload-precision.md`.
  - Owns serialisation rounding in `app/u/[handle]/pane/route.ts`, the pane-chart route, `lib/paging.ts`
    (`packPoints`), `lib/chart-series.ts` and the client data in `lib/feed.ts`.
  - Owns one test that scans every signed-out response.
  - Waits for F3-2 (on `claude/fix-truthful-labels`) and F-26 (`claude/f26-held-like-none`, which edits the pane-chart
    route).
  - Overlaps: F4-16 (chart sheet dates, `lib/chart-series.ts`, `lib/feed.ts`) rebases on whichever lands first.
  - F-21 (draft) would rejoin this slot if a later council re-approves it.

Not approved, with where each goes (no vote):
- Chores: C4-38, C4-39/13h, C4-42, C4-43, and C4-40 (owner Q7, protected files).
- Committees: C4-8.
- Hand-off acceptance criterion for the F-26 build: C4-35.
- Fixes list: C4-2's cause line (`lib/copy.ts:70`), the stale `Blocked:` lines on F-16, F-17, F-20 and F-24 (with
  F4-21), and SW-1 Back-to-card if it reproduces.
- a11y fixes lane: C4-34 (b, c).
- Owner checklists: C4-27, C4-28 and C4-29 on the F-7 switch-on checklist (owner Q2); C4-41 on the live-billing
  checklist.

## Fixes cycle 4 (2026-11-01): rows handed to the sessions that own their files

Record: `docs/direction/cycle4-2026-11-01.md` → Fixes list. Built on `claude/fixes-cycle4`: F4-2, F4-5, F4-6 half (1),
F4-7, F4-9, F4-10, F4-11, F4-12, F4-13, F4-18, F4-19, F4-20, F4-21, and the record-trust Priority 1 (C4-1, C4-2; committee
`docs/features/logs/fixes-cycle4/committee-2026-11-01.md`). These rows touch files another session owns, so they are left
to it, unbuilt (each owner builds the row as the record states it, or hands it back here):
- **F4-4 (month recap completeness claim)** → `claude/fix-truthful-labels`: the month page, its foot (`FL.monthFoot`),
  `lib/record-strip.ts`, `lib/recap-load.ts` and `lib/month-card.ts` are that branch's files.
- **F4-8 (home preview names public filings)** → after `claude/fix-truthful-labels` (it writes the root-description wording
  the row says to reuse) and PR #77 (`app/home-card/route.tsx`). Whichever lands later builds it.
- **F4-14 (space between the Demo and Public filing badges)** → `claude/fix-truthful-labels` and `claude/f26-held-like-none`
  both edit `app/ui.tsx` around that line; the first to merge adds the space.
- **F4-15 (the @handle never shrinks on the share card)** → PR #77 (`app/u/[handle]/record-card-image.tsx`).
- **F4-16 (chart sheet note dates)** → `claude/fix-truthful-labels` (`chart.tsx`, `lib/feed.ts`), then `claude/f26-held-like-none`
  (pane-chart route).
- **F4-17 (held reason described by the input)** → `claude/fix-truthful-labels` and `claude/f16-f17-trust-safety` (the profile page).
- **F4-1 (symbol-less vendor rows; future unusable sells)** → the store half is `lib/broker.ts` (protected: owner item); the
  future-count half is the query `claude/f24-late-postings` rewrites in `lib/sync.ts`: F-24 adds the unusable future sells
  to `excluded_future` there.
- **F4-21 (process docs)** → built here except that `docs/process/coordination.md` is also edited by
  `claude/fix-truthful-labels` (one row): this branch rewrote the snapshot; the later merge keeps this table and re-applies
  that row's file-name fix.
- **F4-22 (CLAUDE.md known limits line)** and **F4-6 half (2) (PROMO out of `scripts/compliance.ts`)** → owner (protected files).
- **Update after `claude/fix-truthful-labels` merged as #85 (8e3e9a5) without building F4-4, F4-14, F4-16 or F4-17:** the rows
  move to the sessions that still own their files: F4-17 → `claude/f16-f17-trust-safety` (profile page); F4-16 and F4-14 →
  `claude/f26-held-like-none` (`lib/feed.ts`, the pane-chart route, `app/ui.tsx`); F4-4 → a small follow-up after PR #77
  (`lib/record-strip.ts`) and F-16/F-17 (the month page) merge. F4-8 waits on PR #77 only (the labels wording is on main).
- **Update after #87 (F-26) and #77 (F-20) merged (63f48f4):** the orchestrator moved F4-4, F4-8, F4-14, F4-15 and F4-16 to a
  part-2 session (`claude/fixes-cycle4-part2`); F4-17 stays with `claude/f16-f17-trust-safety`.

## Approval council 2026-11-01 (cycle 5): approved features (F-32 to F-36) and re-approvals (F-29, F-21)

Record: `docs/ideas/approval-2026-11-01-cycle5.md` (base e16d6aa). Four new build slots out of six. F-29 is `ready`.
Every other file is `Status: blocked` with a `Blocked:` line naming its in-flight PRs or owner questions. The
orchestrator flips each to `ready` as they clear. F-28 and F-30 went to `Status: draft` (lapsed: F-28 overtaken by #89,
F-30 mostly on main).

- **Matcher slot: F-32 transfers are named, with F-36 fees in the denominator.**
  - Files: `docs/features/F-32-transfers-named-never-remove-a-closed-trade.md`,
    `docs/features/F-36-fees-in-the-return-denominator.md`.
  - One builder. Owns `lib/trades.ts` (`MatchResult`, the taint cause, the return formula), `lib/corporate-actions.ts`
    and their tests. Separate MATCHER_VERSION bumps, never in the same deploy, each after chore C5-43(b).
  - Waits: #84 (F-24) for both. F-32 Part B waits on OD 2.28 + MRC2-10, F-36 on cycle-5 Q1.
  - Overlaps: F-21's shared sum takes F-32's "transfer" key; `lib/copy.ts` (/how lines) with the pane/strip slot.
- **Ranking slot: F-33 ranking weight needs evidence.**
  - File: `docs/features/F-33-ranking-weight-needs-evidence.md`.
  - Owns `lib/confidence.ts`, `lib/bets.ts`, the weight in `lib/feed.ts`, and the printed range's one producer
    (`lib/copy.ts` `early`).
  - Waits: cycle-5 Q3 with OD 2.32/2.33/2.34, and #100 and #102 (both edit `lib/feed.ts`).
  - Overlaps: the fixes lane's zero-width step, which F-33 later supersedes.
- **Pane/strip slot: F-34 one open-positions line, with F-29 (ready) and F-21 riding as re-approvals.**
  - Files: `docs/features/F-34-one-open-positions-line.md`, `docs/features/F-29-gated-options-wording.md`,
    `docs/features/F-21-exclusion-counts-beside-the-headline.md`.
  - One builder owns the pane's line order (exclusions, open, options qualifier) and the 360 px criterion.
  - F-29 starts now (rebase on #97 if it merges first). F-21 waits on #97 and #84. F-34 waits on OD 2.25, #100, #102
    and #97.
  - Overlaps: F-23 (#97) on `app/pane.tsx`; #100 and #102 on the image routes and the record strip.
- **Sync slot: F-35 publish once the date has passed.**
  - File: `docs/features/F-35-publish-once-the-date-has-passed.md`.
  - Owns the future grace and a matured-rows query in `lib/sync.ts`, plus an additive watermark in `db/schema.sql`.
  - Waits: #84. Chore C5-43(d) can ride.

Not approved, with where each goes (no vote):
- Chore lane: C5-43 (part b before any matcher bump), C5-39, C5-38, C5-40, C5-42, C5-36 (narrowed), C5-37 (narrowed),
  and F-30's readout row.
- Fixes lane: MK-P6 (one /how sentence), C5-41 (legal words), C5-34 (preview equals the shared image), C5-4's
  zero-width step, and C5-5's "per closed trade" wording.
- Waiting: C5-32, C5-35, C5-33, C5-10, MK-P5, MK-P3, MK-P4.

## F-16/F-17 (`claude/f16-f17-trust-safety`) → F-26 note slots (2026-11-01)

`lib/reports.ts#reportThesis` now accepts a close's stable `trade_key` (64 hex) as well as its row id, and the feed
card sends the key. The note slots on `app/u/[handle]/page.tsx` (`reportId={String(t.id)}`) and
`app/u/[handle]/trade/[sellId]/page.tsx` (`t.note?.tradeId`) still send the row id, so a report from a page rendered
before a rebuild answers the neutral "not-found". F-26 owns those slots: please pass `tradeKey(t.sell_id)`
(`lib/likes.ts`) there. No change is needed in `app/user-note.tsx` or `app/report-note.tsx`.
