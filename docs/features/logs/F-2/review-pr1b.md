# F-2 PR-1b review (independent reviewer)

Date: 2026-10-24. Branch `claude/adoring-euler-4469ys`. Scope: `git diff origin/main...HEAD -- . ':!docs/features/logs'`
(12 files; product code in `lib/feed.ts`, `lib/discovery/explore.ts`, `lib/discovery/section.ts`, `app/feed-actions.tsx`,
`app/globals.css`). Bar: `review-pr3.md`.

## Verification (own database `rv1b`, own ports)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (with DB) | 614 tests, 602 pass, 0 fail, 12 skipped (LOAD-gated) |
| LOAD suites | feed 6/6, follows 1/1, sync 5/5. Feed p95: 157 ms (12 heavy), 214 ms (50 heavy), bound 400 ms; late-import weights p95 207 ms |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` license line |
| `CI=1 npm run build` (stdin closed) | builds; the version advisory is tool output only, not acted on |
| `npm run test:e2e` (port 3251, vendor fake 4251) | 109 passed, 3 skipped, 0 failed |

## Findings

1. **Exploration from outside the 200** (`src` CTE, `mixFeed({extra})`): extra rows are `rk = 1` of `r`, excluded from
   `top`, flagged `x`, ordered after every ranked row, and fed only into the exploration pool (`ranked.slice(top)` plus
   `extra`); ranked slots never read them. The exactness test of the recent window now filters `!x`, so extra rows cannot
   fake a full 200. Cap 150 holds in SQL. Signed-out query-log and import-graph tests only gained cases. OK.
2. **Section selection**: newcomer slot is moved to the front before `capped`, so the bucket cap fills around it; Demo
   only after every verified candidate and never takes the newcomer slot; `chooseRows` displays by evidence with Demo
   last. When fewer than 3 verified qualify a badged Demo row fills and reads last, so "ordered by how much evidence" is
   still true of the verified rows; the trade-off is stated in the code and the spec. OK.
3. **Per-card discount**: `discounted` only re-keys cards of traders in the top 30; best card per trader keeps its
   rank order; stable on ties (Array sort is stable, keys distinct per index otherwise). Reads no return. OK.
4. **Weight fingerprint from the recent window**: a stale key would need a weight change with the same (pn, max id in c,
   late-old count, e.n). A rebuild renumbers every row (max id moves; every listed trader has a row in c); a new close
   adds to c; a close leaving the window changes pn; a late old close changes `ol`; the recent/full paths are prefixed
   `c`/`f` so their keys never collide. No path found that serves a wrong list. **Non-blocking**: the argument relies on
   ids being monotonic on rebuild (serial ids); a comment in `weights()` already says so, keep it if ids ever change.
5. **Pane records in two halves**: interleaved split, `flat()` of two disjoint sets; callers group by user, so output is
   identical. One half failing rejects `Promise.all`, so the page fails as it did with one query (no partial pane).
   **Non-blocking**: the other half's query is not cancelled; harmless.
6. **Cursor limit 350** (`FEED_LIST_MAX`): both readers use it; an offset past the list just yields the end card. OK.
7. **Policy**: nothing reads the viewer in the new paths (day seed only); no numbers added to rows; Demo badge path
   unchanged; losses weigh equal (`score` and weight untouched); no third-party names in the diff. OK.
8. **Reach measure** (business lead demand 5): `lib/feed.reach.test.ts` measures per-section reach at load. OK.
9. CSS 2 px pane padding: cosmetic, fixes a 0.4 px overflow. OK.

No blocking findings.

## Verdict

**APPROVE.**
