# F-2 PR-3b review (independent reviewer, 2026-10-24)

Scope: `git diff origin/main...HEAD -- . ':!docs/features/logs'` plus the reviewer fixes below. Own database
`review_pr3b` on the local Postgres 16, app on port 3291, vendor fake on 4291 (port 3000 untouched). Database dropped
and servers stopped afterwards.

## Reviewer fixes (Part A)

| Item | Change |
|---|---|
| D3 (business lead, blocking) | `SIMILAR.explain` is exactly "Other traders’ closed trades, held about as long as @x’s typical trade, losses included." (curly apostrophes kept, ranking clause removed). Banned-word scan (`lib/copy.test.ts` via `allCopy`) passes. |
| Tester Low (NUL byte 500) | `/u/<h>/pane` and `/u/<h>/pane-chart` return 404 for a handle outside `^[a-z0-9_]{3,20}$` (the schema's check) before any query. Checked: `a%00b` → 404 on both, unknown → 404, POST → 405. |
| UX: dialog name | `SuggestRow` takes an optional `label`; a Similar sheet is named after its trade ("SYM · closed Mon D, YYYY"). The feed section keeps "<name>’s record". |
| UX: row text at x=16 | `.similar .sitem` and its follow status lose the 12 px inset, so row text shares the heading's left edge. |
| UX: "← Feed" 44 px | the profile's "← Feed" link is `inline-flex`, `min-height: 44px` (`.tap44`). |

## Findings

- non-blocking: `/u/<h>/pane` has no rate limit. Same stance as `/pane-chart`: public data the profile already shows,
  `cache-control: public, max-age=60`, one indexed read. Acceptable now; revisit with the real-auth/edge work.
- non-blocking: pane JSON for a 5,000-close trader is ~600 KB uncompressed (engineer log); fine for one sheet open, a
  windowed pane is a follow-up.
- non-blocking: the 10 s pool cache and 10 s record cache are per process. Deletion is safe: the row query re-checks
  `deleted_at is null` on every view, so a deleted trader never renders as a row; a hard-deleted trader's pane route
  finds no user and answers 404; a soft-deleted one also 404s (`deleted_at is null` in the route).
- non-blocking: F1 (profile HTML +8 KB at 50 closes, bar 5 KB) and F2 focus box remain follow-ups as the committee set.
- checked, OK: impersonal and the same for every viewer (pool anchored to the UTC hour, `skip` = viewer + their running
  "Not interested" only, unfollow is not a hide, O4); 5-close gate (`SIMILAR_MIN`) and exactly-3-or-nothing; Verified
  before Demo, each in lower-bound (`byEvidence`) order; sign-blind (no `return_pct` read in ordering); bucket SQL
  matches `holdBucket`; importing records never a row and never served; theses only when published; no quantity or
  price anywhere; no number on a row, the percentage only inside the sheet with `DISCLAIMER`; heading "Similar trades"
  has no advice word; no third-party names; signed-out reads no viewer table (test).
- checked, OK: no weakened test; `guard main` ok; test count 622 → 623.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (with DB) | 623 tests: 611 pass, 12 skipped (LOAD), 0 fail |
| LOAD, one file at a time | feed 6/6, sync 5/5, follows 1/1 |
| `node scripts/autopilot.ts guard main` | ok |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` license line |
| `CI=1 npm run build` (stdin closed) | passes (an advisory printed by the tool on the first run was ignored, as instructed) |
| `npm run test:e2e` (port 3291) | 114 passed, 3 skipped, 0 failed |

## Verdict

APPROVE (the only blocker, D3, is fixed above).
