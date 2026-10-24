approve: true

# F-2 · PR-3 (suggestions section, same for every viewer) · Reviewer

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys` vs `origin/main`. Product diff (`-- . ':!docs/features/logs'`):
20 files, +1,387 / −36 (product code about +500; the rest is tests and `e2e/section.spec.ts`). Inputs: POLICY, COMPLIANCE §1,
CLAUDE.md, the F-2 feature file, plan §1 PR-3 (with the recorded deviation: the order is the TR-9 lower bound alone,
owner criterion 8 over the plan formula), the engineer's log (build plus fix round 1), the tester's re-run 1 (CLEAN),
business lead round 2 (PASS/PASS) and UX lead round 2 (PASS). Everything ran on my own database (`ss_rev_pr3`, created
as the superuser and owned by the shared role; I never wrote to the shared `stock_social`).

## Checks run (after my change)

| Check | Result |
|---|---|
| Schema ×2 on a fresh database, seed | clean; **no schema change in this PR** (`db/` untouched) |
| `npx tsc --noEmit` | clean |
| `npm test` | **600 tests, 588 pass, 12 skipped (LOAD), 0 fail** (576 at PR-2 → 600) |
| Weakening | `lib/discovery/imports.test.ts` gains `section.ts` as a pure root; `lib/feed.signed-out.test.ts` gains section cases (signed out: no `follows`/`viewer_exclusions` read, no viewer input). No test removed, no `.skip`/`.only`. `node scripts/autopilot.ts guard main`: ok |
| `LOAD=1` feed / follows / sync | **6/6, 1/1, 5/5** (feed gains the section within the 400 ms p95 budget) |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` licence line (local `node_modules`) |
| `CI=1 npm run build`, stdin closed | run 1 stopped on the framework's security advisory (tool output; nothing upgraded, nothing offered); retry exit 0 |
| `npm run test:e2e` ×1 (own database, `CI=1`, vendor fake variables set), after my change | **109 passed, 3 skipped (the sign-in provider and mail-sink variables), 0 failed** (4.1 min). Rewritten committed screenshots restored with `git checkout` |

## Adversarial read

**Impersonal (POLICY F1).** `lib/discovery/section.ts` is pure and takes no viewer. The pool comes from `feedList`,
which is keyed by `(day, asOf, ids)` only and cached per key, so every viewer gets the same pool. The viewer affects the
section only by subtraction: `sectionSkips` (self, follows, running exclusions) is read only when `opts.viewer` is set,
and only by `viewer_id = $1`. Signed out, nothing is subtracted, and the query-log test proves that no viewer table is read.
Nothing is ranked for a viewer, so F1 holds. The `unfollow` exclusion is honoured by the section only: `exclusionsFor`
still filters `not_interested` unless `FEED_HIDES_UNFOLLOWED`, while `sectionSkips` takes every reason. This matches criterion 4.

**Ordering.** `sectionPool` sorts by `weight` (the TR-9 lower-bound evidence weight from `confidence`/`evidenceWeight`),
then by `n`, then by id. The card `score` is carried but never used in the sort. No raw average and no size of move,
and `evidenceWeight` is symmetric in sign, so losses count the same as gains. This is the recorded deviation.

**Bucket cap and pool.** `capped` applies the 2-per-bucket cap while choosing, across every candidate. `sectionCandidates`
replays earlier pages, so earlier faces go last. `loadFeedPage` reads 8 spares under the cap, drops deleted, importing
and nearby traders after the cards are resolved (gaps move the next card in), and reads any missing panes. Fewer
than 3 rows means no section. Checked: `onPage` now includes the section's traders, so `byUser`/`records` carry their panes.

**Reasons and copy.** There is one fixed template, "Typical holding period: …", from a 5-entry table (no ticker slot, no number
about performance). It is true against the median holding days read at asOf. The heading "Other traders' records" and the
explanation "Ordered by how much evidence each record has. Losses count the same as gains." are true (that is the sort)
and give no advice. `SECTION` is in `allCopy()` and scanned (PROMO plus the suggestion word list). Rows show no
percentage. The sheet carries the disclaimer itself, and the skip link reaches it. No third-party names.

**Gesture (`reject.ts`, `suggest-row.tsx`).** The swipe arms only at rest, with no dialog open, ≥ 400 ms after a close, and
with horizontal travel ≥ 2× vertical. It commits only if the scroll rests past half *and* the finger travelled half the card,
so momentum never counts. It is attached only to `.srow` (section rows), never to feed `.row` cards. SW-1 code is
untouched, and the section is not a `.row`, so paging and SW-1 keys skip it. Where the tray is wider than the row (320,
large text), `atRest` is never true, so the swipe fails safe to the "…" menu. "Not interested" reuses PR-2's action
unchanged (the handle is pattern-checked; the viewer comes from the session only). The client `ss:hide` event only
hides elements whose handle passed `HANDLE` before it is put into CSS.

**Sheet (`suggest-section.tsx`).** It uses a native `<dialog>.showModal()` (focus trap and Esc come from the platform).
A backdrop click and Back close it, and focus returns to the opener. `aria-label` is "<name>’s record", and
`aria-haspopup="dialog"` is set only with JS.

## Findings

| # | Tag | Finding | Resolution |
|---|---|---|---|
| V1 | non-blocking (fixed) | UX R2-2: a touch or keyboard open focused the offscreen "Skip to the disclaimer" first | `open()` now focuses the pane's name link after `showModal()`. The skip link stays the first Tab stop (Shift+Tab twice reaches it). `e2e/section.spec.ts` asserts both |
| V2 | non-blocking | UX R2-1: after a mouse hide, the bar can time out while Undo holds (non-visible) focus | Left as is: making any focus pause the bar changes PR-2's tested keyboard path. Follow-up |
| V3 | non-blocking | The section's pool is computed for every list even when no page shows a section | It is cheap (in memory, from weights already read), so no action |
| V4 | non-blocking | `npm run test:e2e` still rewrites committed screenshots (PR-1/PR-2 item) | Harness follow-up, unchanged |
| V5 | non-blocking | The 320 px signed-in rows are cramped (UX carried item) | Engineer follow-up table |

No blocking findings.

## Verdict

APPROVE
