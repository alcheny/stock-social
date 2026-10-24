# F-2 PR-1b: exploration and reach (engineer build log)

Scope (business lead, committee PR-3 §5 round 1; accepted before PR-4): exploration beyond the 200 candidates, the
section drawing from every eligible trader with traders who have no card in the list first, a way for a 4 to 6 close
record to reach a row under TR-9, and a per-card discount. Nothing personalized; no schema change; no dependency.
Product diff (no tests, no logs): 5 files, **+93 / −28**.

## 1. What changed

| # | Change | Where |
|---|---|---|
| 1 | The candidate statement also returns, flagged `x`, the best recent close of each eligible trader outside the 200 (at most `EXPLORE_EXTRA` = 150, ordered by `md5(day ‖ user_id)`: the same for every viewer, new each UTC day). One statement, not two: a second query cost ~75 ms on the 50-heavy fixture. Their weight-cache key is read from the window already scanned (counting their whole records cost ~60 ms a list). | `lib/feed.ts#candidateQuery` |
| 2 | `mixFeed(…, { extra })`: those cards join the exploration pool only; ranked slots never take one, so PR-1's ranked order and its pinned tests are unchanged. Traders new to the list still go first, in the seeded shuffle. | `lib/discovery/explore.ts` |
| 3 | `discounted()`: for traders with a card in the top 30, the k-th card moves to key (rank + 1) × 3^k; the list is re-sorted. Each trader's best card keeps its rank order. Why not a score discount: at every k the order would still be weight × score, and the cycle is slot-locked (a trader returns exactly 10 cards later because its next card outranks everyone outside the last 9), so only cards falling among other traders' break it. Why only the head: discounting every trader spread the ranked slots over everyone and left exploration nothing new (PR-1's "≥ 80% of picks new in the first 120" fell to 16 of 24). | `lib/discovery/explore.ts`, `lib/feed.ts#feedList` |
| 4 | Section pool = candidates plus outside traders. Order: no card earlier in the list and not in an earlier section; no card earlier; carded; each part in TR-9 order (criterion 8 unchanged). | `lib/discovery/section.ts#sectionCandidates` |
| 5 | "New record" slot: the third place goes to the weight-0 trader with no earlier card (not yet in a section while one is left), fewest closes, then lowest id; verified records only (Demo data is never promoted). The rows still read in non-increasing evidence, so the line "Ordered by how much evidence each record has" stays true. No raw average, no move size, no sign. | `lib/discovery/section.ts#newRecordSlot`, `TraderFacts.verified` from `weights()` |
| 6 | Cursor limit `FEED_LIST_MAX` (350) in the page and its paging action. | `lib/feed.ts`, `app/feed-actions.tsx` |
| 7 | The sheet keeps 2 px under the disclaimer: with a Demo record now first in the e2e section, its sheet's last line ended 0.4 px past the scroll end (PR-3's "wholly in view" e2e caught it). | `app/globals.css` |

## 2. Acceptance (business lead), signed out, fixture of 40 hot, 60 ordinary and 5 newcomers (5 or 6 closes)

`lib/feed.reach.test.ts`, pages 1 to 4 (120 cards) with their sections, 7 consecutive UTC day seeds:

| Seed | Seen (cards + rows) | Distinct on cards | Newcomers | Rows with no earlier card | Hot in first 60 | Repeated 3-trader runs (first 60) |
|---|---|---|---|---|---|---|
| 2026-10-20 | 78 / 105 | 71 | 2 / 5 | 12 / 12 | 37 | 0 |
| 2026-10-21 | 79 / 105 | 73 | 5 / 5 | 12 / 12 | 36 | 0 |
| 2026-10-22 | 78 / 105 | 74 | 1 / 5 | 12 / 12 | 37 | 0 |
| 2026-10-23 | 75 / 105 | 72 | 2 / 5 | 12 / 12 | 36 | 0 |
| 2026-10-24 | 77 / 105 | 72 | 2 / 5 | 12 / 12 | 36 | 0 |
| 2026-10-25 | 80 / 105 | 72 | 3 / 5 | 12 / 12 | 37 | 0 |
| 2026-10-26 | 80 / 105 | 73 | 2 / 5 | 12 / 12 | 36 | 0 |
| **Union** | **104 / 105 (99%)** (bound ≥ 80%) | | **5 / 5** | every section ≥ 2 of 3 (asserted) | | **0** |

Before PR-1b the same lists could only show the candidates' traders (the 40 hot ones fill the 200).

- Skewed fixture (PR-1's: 5 hyperactive, 55 ordinary): no repeated 3-trader run in the first 60 on 7 day seeds
  (`feed.reach.test.ts`); PR-1's own test: 19 of the first 60 hyperactive (bound 27), ≤ 5 of any 10, 23 of 24 picks new.
  Pure, 50 generated skewed fixtures: a repeated run in the first 60 on **40 of 50 before, 1 of 50 after**.
- Caps and sign-invariance property tests unchanged and passing.
- Budgets (LOAD, 500 traders): signed-out p95 **166 ms** (12 heavy), **341 ms** (50 heavy), **375 ms** (50 heavy, section
  on every page; signed in 375 ms), **363 ms** (45 in one period); bound 400. Page HTML, 50 heavy, pages 1–3: **321 / 322
  / 329 KB** raw (14–16 KB gzipped), bound 500 KB.
- Product lines: 121 changed (≤ 400).

## 3. Tests added (none weakened or deleted)

`lib/feed.reach.test.ts` (3), `lib/discovery/explore.test.ts` (+3: `discounted`, the extra pool, the cycle on 50 fixtures),
`lib/discovery/section.test.ts` (+3: groups, the slot, Demo never takes it), `lib/feed.signed-out.test.ts` (+1: signed
out the outside read touches no viewer table and outside traders reach pages 1 to 3; signed in the read is byte for byte
the same text and parameters, the viewer id is not one), `lib/discovery/imports.test.ts` (+1: the discount and the slot
live in pure modules lib/feed.ts uses).

## 4. Checks

| Check | Result |
|---|---|
| Merge of main (PR #20 squash) | clean; pushed |
| Own database `ss_eng_pr1b` (Postgres 16), schema, seed | no schema change |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 (+1) | **610 tests, 598 pass, 12 skipped (LOAD), 0 fail** on runs 2, 3, 4. Run 1: 11 failures in `lib/reflections.test.ts`, its `before` hook hit a foreign key on `broker_accounts` (a user removed by another file running in parallel); not touched by this PR, not seen again in three runs. Reported, not fixed here. |
| `LOAD=1` feed | **6/6** (numbers in §2; late-import cases p95 274 ms, cold median under 1 s) |
| `LOAD=1` sync, follows | **5/5, 1/1** |
| `CI=1 npm run build`, stdin closed | first run stops on the framework's security advisory (tool output; nothing upgraded); retry exit 0 |
| `npm run test:e2e` ×2 | **109 passed, 3 skipped, 0 failed** both runs (4.0 / 4.0 min). Port 3000 was held by a server this session did not start, so the runs used a throwaway config on port 3105 (deleted). Committed screenshots the runs rewrite were restored. |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | ok |

Screenshots (`screenshots/pr1b/`, light and dark): `section-signed-out-375`, `section-signed-out-1280`,
`section-signed-in-375`, `sheet-from-row-375`.

## 5. For the business lead and the UX lead

- In the e2e database the first section shows two Demo records above a verified one: both have no card earlier and more
  closes. True under the documented order; if Demo rows should never be suggested ahead of verified ones, that is a
  one-line rule, but a product call.
- Per seed, newcomers seen 1 to 5 (all 5 over the 7 seeds). The slot gives way to the bucket cap when rows 1 and 2
  share its holding period.
- Owner decision O4 (unfollow = a small negative weight, never a hide; recorded 2026-10-24): **not in PR-1b.** It replaces
  the section's unfollow exclusion, which `lib/feed.section.test.ts` pins (criterion 4 as written then); changing that
  pinned test belongs in its own PR with the restated criterion. Proposed for PR-4: `WEIGHTS.unfollow = -1` in
  `lib/discovery/weights.ts`, applied only on signed-in paths. O5: no change.

## 6. Policy and compliance (COMPLIANCE §1)

1. Performance: no number added anywhere; the section's order is the TR-9 lower bound with a documented slot that never
   reads a raw average; losses weigh like gains (sign-blind tests). 2. Personal data: nothing new read or stored; the
   new read is impersonal (tested byte for byte signed in vs out). 3, 4, 6, 7, 11: none. 5. User text: none.
   8. Accessibility: the disclaimer is wholly in view after the sheet's skip link. 9. Security: no new input; the cursor
   bound grows to 350. 10. Claims: the section's line stays true. No third-party company named.

## 7. Cleanup

Test users and fixtures deleted by each test; `ss_eng_pr1b` dropped after the last run; e2e servers and the vendor fake
stopped with their runs. The shared `stock_social` was never written.
