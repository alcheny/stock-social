approve: true

# F-2 · PR-1 (feed mix and paging) · Reviewer

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys` at `6192225` vs `origin/main`. Product diff (`-- . ':!docs/features/logs'`):
29 files, ~790 product lines. Inputs: `team/reviewer.md`, POLICY, COMPLIANCE §1, CLAUDE.md, the F-2 feature file, plan
§1 (PR-1), §4, §8, §9, the engineer's log (build + fix rounds 1 to 3), the tester's re-run 3, the business lead's round 3
and the UX lead's round 2. Everything ran on my own database (`ss_rev`, Postgres 16, defaults: `work_mem` 4 MB,
2 parallel workers per gather). One product change, below (Low G), as the brief allows.

## Checks run

| Check | Result |
|---|---|
| Schema ×2 on a fresh database, seed | clean, idempotent; the only schema change is one `schema_add_index` (`activities_created`); no drop, truncate or delete from |
| `npx tsc --noEmit` | clean (before and after the G change) |
| `npm test` (after G) | **559 tests, 550 pass, 9 skipped (LOAD), 0 fail** |
| Test names / weakening | 558 → 559 over the last round; no test removed, no `.skip`/`.only`. The one rewritten e2e test (F-1 fix round 8: "50 heavy cards") now asserts each of pages 1 to 3 (30 cards each) under the same 500 KB bound, with more distinct heavy traders: a page-size change, not a weakening |
| `LOAD=1 node --expose-gc --test lib/feed.load.test.ts` ×2 (after G) | **4/4 both.** 12 heavy: all-pages p95 147 / 154 ms. 50 heavy: 253 / 278 ms. Round-2 late case (150,020 late activities): weights kept p95 279 / 301 ms, cold 294–491 ms. Own-late case (150,000 late closes, 15 listed traders): cold median ~740 / ~795 ms (bound 1 s), weights kept p95 590 / 551 ms |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` license line (local `node_modules`, not from this diff) |
| `node scripts/autopilot.ts guard main` | ok |
| `CI=1 npm run build`, stdin closed | run 1 stopped on the framework's security advisory (tool output; nothing upgraded); retry exit 0 |
| `npm run test:e2e` ×1, own database, `CI=1`, vendor fake variables set | **100 passed, 3 skipped (provider and mail-sink variables), 0 failed** (4.2 min). The run rewrote 3 committed `pr1-fix2` screenshots; restored with `git checkout` |

## Low G: agreed and applied

Own EXPLAIN on 600,000 late sells (analyzed statistics, all dated 30 days back, so in both `a` and `o`):

| Form | Plan | Time (3 runs, arrays consumed) |
|---|---|---|
| Round 3: one aggregate, `array_agg(…)` and `array_agg(…) filter (…)` | Gather (2 workers) → Partial Aggregate → Finalize Aggregate; the finalize step merging the partial arrays is most of it (Partial 536 ms, Finalize 804 ms) | 814, 754, 936 ms |
| `array(select …)` ×2 (two InitPlans, two scans) | two serial Seq Scans, no Gather | 395, 506, 413 ms |

Even with two scans, the `array(select …)` form is about 2× faster at this size (the tester's isolated 4–5× compares one
array; here both arrays are built). Change in `lib/feed.ts#candidateQuery`, CTE `late`: `a` is `lateArray(asOf)` (the
same expression the weight query uses) and `o` is `array(select external_id … and executed_at <= lo)`; semantics
unchanged (the `coalesce(…, '{}')` is not needed: `array(select …)` over no rows is `'{}'`). A dated comment records
why. The load runs above are after the change; the own-late cold medians match the tester's (751 / 803 ms).

## Adversarial read

- **Candidate statement (`lib/feed.ts`).** The recent-window shortcut is exact: with 200 window rows whose 200th score S
  exceeds `SIZE_MAX · e^(−7)` ≈ 0.65, no close older than the window can reach S, so the per-trader ranks of every
  close scoring ≥ S, and the top 200, are the full pass's. Eligibility stays exact in both modes (`c`'s count, else the
  5-row probe over all closes at `asOf`). Late handling: every filter is `not in (select unnest(…) from late)` over a
  materialized one-row CTE, so the planner sees an unnested array (10-row estimate, hashed) under custom and generic
  plans; the weight query reads `lateArray` itself, never a bound array. `sell_id` and `external_id` are `not null`, so
  `not in` has no null trap. All SQL is tagged-template parameters; `sql(arr)` takes only the literals `'a'`/`'o'`.
- **`pk` window probe.** `pk` = `c`'s count + the not-late closes at or before the window edge, where "late" for those is
  `o` (late sells with `executed_at <= lo`). This relies on `closed_at` = the sell's `executed_at`; `matchTrades`
  copies the millisecond `Date` the driver reads, so an `executed_at` with microseconds written by SQL could sit up to
  1 ms after its close at the edge (tester note 3). The only effect is a weight-cache key off by one for that trader:
  a cache miss (the miss query computes the weight directly, exactly), never a wrong weight unless another state
  collides on the same (n, max id, k), which needs the same row set. Non-blocking.
- **Weight cache key.** (row count, max id, counted at asOf) identifies the counted set because rows change only by
  rebuild (new ids) and the counted subset is monotone in asOf. Sound.
- **`lib/discovery/*`.** `fits` never relaxes a cap; `diversify`/`mixFeed` end the list when nothing fits. Exploration is
  seeded by the cursor's UTC day only (FNV-1a + mulberry32), one slot per 5 at a seeded phase (exactly 2 per any 10
  slots), pool = outside the top 30, traders shuffled, fresh traders first. `pick` prefers traders not among the last
  9, then not the previous one: preferences, never caps, and nothing reads a return. Import-graph test confirms all
  three modules reach only `lib/discovery/` and `node:`.
- **Cursor (`pager.ts`).** base64url charset check, 200-byte cap, canonical re-encode (tamper/truncation → null), exact
  key set, safe integers, `day` must equal `utcDay(asOf)`, asOf within [now − 48 h, now + 60 s], offset a positive
  multiple of 30 below 200. Anything else is page 1 (e2e: bad and tampered cursors return 200 with page 1; later
  pages `noindex`). The cursor carries no viewer data; nothing from it reaches SQL except a validated timestamp.
- **`app/feed-pager.tsx`.** One request in flight (`busy` ref); after a load, an element counts only once it enters view
  anew (no chained loads); pin to card 31 when the control was in view, settle-snap at rest otherwise, never under a
  finger; the control is out of scroll anchoring; duplicate cards are dropped; polite live line names the positions;
  Retry keeps focus while loading (`aria-disabled`) and hands it to card 31; a stale cursor offers "Load today's feed".
  The e2e covers each of these.
- **Pages.** `app/page.tsx`, `feed-rows.tsx`, `feed-actions.tsx` import no db or session (static test), and the
  signed-out pages 1 to 3 query no viewer table (query-log test, passes). The action is public and read-only and
  validates the cursor before reading.
- **Product rules / policy.** Losses rank by `abs(return_pct)` and the mix never reads a return (sign-invariance tests
  unchanged). Verified/Demo badges unchanged (tester no-JS walk). The layout footer disclaimer (F3) is on every page,
  appended pages included. New copy has no advice, signal or completeness claim ("End of today's feed.", tested
  against the banned and completeness lists). Only the integrated vendor is named. No personal data, no secrets, no
  dependency, workflow, CODEOWNERS or CI change. Feed works signed out (e2e).

## Findings

1. **Fixed (was tester Low G), non-blocking:** the `late` CTE's parallel aggregate (above).
2. Non-blocking, known limit: a crafted `?after=` (or a cross-instance page) recomputes the list, linear in late sells
   since its `asOf` (~0.4 s at 150,000 cold). The paging action is a public POST that accepts any valid cursor, so
   distinct `asOf` values within the 48 h window each force a recompute. Rate limiting belongs with the deploy work;
   the planner item (`sell_imported_at` on each close) removes the late read entirely.
3. Non-blocking: `pk` relies on `closed_at` = the sell's `executed_at` at millisecond precision (above); the planner
   item removes that too.
4. Non-blocking: `app/layout.tsx` runs one `exists` query per signed-in page view to choose the end card's link. It
   reads only the viewer's own id and never changes the list. Cheap (indexed by `user_id`), but it is on every page;
   it could move into the end card if it ever shows in server time.
5. Non-blocking, harness: `npm run test:e2e` rewrites committed screenshots under `docs/features/logs/F-2/screenshots/`
   (tester note from an earlier re-run); run e2e from a copy or restore after.

Reviewer checklist (business lead demand 5), skewed fixture, my run: 58 traders among the 200 candidates; the 5
hyperactive traders hold 30 of 200 (15%), **14 of the first 60**, at most 5 of any 10 cards; 24 of 24 exploration picks
in the first 120 are traders new to the list. The 50-seed pure test (≤ 5 of any 10, ≤ 28 of the first 60, median ≤ 25)
passes.

Verdict: APPROVE. PR-1 does what plan §1 assigns it, every criterion has a passing test, no test was weakened, no
POLICY rule is broken; the one Low defect left by the committee is fixed and re-verified.
