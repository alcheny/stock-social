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

## Fix round 1 (2026-10-24)

Inputs: `test-pr1b-tester.md` (Medium 1, Medium 2, Low 1), `committee-pr1b-business-lead.md` (demands 1, 2, 5, 6 and
§5), `committee-pr1b-ux-lead.md` (follow-ups). Product diff of PR-1b after this round: 5 files, **+117 / −36**
(153 changed lines, ≤ 400). No schema change, no dependency, no test weakened or deleted (614 tests, was 611).

### F1. Section order and copy (tester Medium 2, Low 1; business lead demands 1 and 2; UX)

The on-screen line "Ordered by how much evidence each record has" stays; the order now makes it true.

| Change | Where |
|---|---|
| Which three traders: the candidates' order decides (no earlier card first, then not in an earlier section). The new-record slot is chosen **before** the bucket cap: it moves to the front of the candidates, so the cap fills the other two rows around it instead of pushing it out. | `lib/discovery/section.ts#newRecordSlot` |
| Demo records go after every verified candidate (a Demo row appears only when fewer than 3 verified records qualify, and then last). | `sectionCandidates` |
| Display order: the three chosen rows are sorted by evidence (weight, then closes, then id: the pool's order), verified before Demo. Untraded-first decides WHO, evidence decides the ORDER. | `chooseRows`, `byEvidence` |

Tests added (`lib/discovery/section.test.ts`): the tester's construction (100 w 0.9 and 101 w 0.8 carded, 200 w 0.1 and
201 w 0.05 not) now renders **100, 200, 201** (0.9 first); a Demo record never sits above a verified row (with more
evidence and no earlier card); the slot survives the cap (a newcomer sharing rows 1 and 2's bucket keeps row 3).
`lib/feed.reach.test.ts` now asserts, **per section** (business lead demand 4), that while a newcomer has neither an
earlier card nor one of the 10 cards around the section, the section carries a newcomer: sections with a newcomer per
seed 4, 3, 4, 4, 4, 4, 4 of 4 (before: only section 1); newcomers seen per seed 4 to 5 of 5 (before 1 to 5); union 104 of
105 unchanged; rows with no earlier card 12 / 12 per seed; no repeated run.

Why the UX lead's first section gave row 3 to an 8-close record (`uxr_hot1`) with four 5-close newcomers outside the
candidates: **a bug of the cap order, now fixed.** The three Demo records have a median holding period of about 5 days
(bucket "1 to 7 days"; measured on the seeded data). The section's first two rows were Dan and Maya (Demo, more closes,
no earlier card), which filled that bucket's cap of 2. The slot picked the newest verified weight-0 record, a newcomer in
the same bucket, and moved it to place 3, where `capped()` skipped it for the bucket and the next candidate in another
bucket (`uxr_hot1`) took the row. It was the documented "best effort under the cap", and it spent the reach slot on the
wrong record twice over (Demo first, newcomer capped out). With Demo last and the slot chosen before the cap, the same
section reads verified rows only and keeps the newcomer.

Accepted trade-off in the copy: when a Demo row fills a section (fewer than 3 verified candidates), it reads last even if
it has more evidence. It is badged "Demo" ("Sample data, not from a real broker."); the line describes the verified
records' order. If the committee wants the line literal for that case too, the alternative is no Demo row at all.

### F2. Performance (tester Medium 1)

Profiled `loadFeedPage` on the 50-heavy fixture with a section on every page (500 traders, 50 × 4,700 closes, holding
periods over the five buckets: the LOAD fixture), timing each step. Page 1 (a new list) is the p95; pages 2 and 3 got
cheaper with PR-1b.

| Step, page 1 (median) | Before PR-1b | PR-1b | Fix round 1 |
|---|---|---|---|
| Candidate statement | 78 ms | 96 ms | ~50 ms |
| Section selection (`sectionCandidates`, pure) | < 1 ms | < 1 ms | < 1 ms |
| Pane records (`records()`) | 105–150 ms (14 heavy, 65,900 closes) | 134–170 ms (20 heavy, 94,150 closes) | ~half, two halves side by side |

- The section selection is not the cost. The outside-trader branch of the statement is ~3 ms and its fingerprint ~7 ms;
  the real growth is page 1 holding more heavy records: exploration slots now take outside (light) traders, so the tail
  of the 200 stays in ranked order and page 1 carries 20 heavy records instead of 14 (the tester's "rendered sequence"
  note). The largest single step of the statement was `pr` (pre-existing): counting the 200 candidates' **whole**
  records for the weight-cache key, ~45 ms (90,790 rows by index scan on 93 traders).
- Fix 1, `lib/feed.ts#candidateQuery`: one fingerprint for every listed trader, read from the window already scanned
  (`c`), as PR-1b already did for the outside traders: closes in `c`, newest id in `c`, closes counted, plus `ol`, the
  trader's closes older than the window whose sells are late (`o`, a small array, unique-index lookups). Why it is a
  valid key: a rebuild renumbers every row of a trader and a new close adds one, so the newest id in `c` changes with
  either (a listed trader always has a close in `c`); a close entering or leaving the window or ceasing to be late changes
  a count. Recent-window and full-pass keys carry different prefixes. All feed, signed-out, reach and late-import tests
  pass unchanged.
- Fix 2, `lib/feed.ts#records`: more than 8 traders are read as two halves on two pool connections side by side (one
  aggregate of ~94,000 closes ran on one core, ~70 ms in the database + ~35 ms parsing). Same rows, same values.

p95, all pages, same machine, same database, back to back (scratch timer: 3 × 20 rounds of pages 1 to 3, cold list each
3 rounds; then the LOAD suite):

| Run | Before PR-1b (`3ac13ac`) | PR-1b (`8228090`) | Fix round 1 |
|---|---|---|---|
| Timer 1 | 263 ms | 371 ms | **256 ms** |
| Timer 2 | 269 ms | 387 ms | **263 ms** |
| Timer 3 | — | 372 ms | **266 ms** |
| LOAD "section on every page", signed out / signed in, run 1 | — | 375 / 375 ms (build log) | **253 / 254 ms** |
| LOAD same, run 2 | — | 338–405 ms (tester) | **267 / 235 ms** |
| LOAD one-period fixture, runs 1 / 2 | — | 363 ms | **218 / 242 ms** |

Target p95 ≤ 300 ms met; LOAD bound stays 400 ms (unchanged in the test).

### F3. `lib/reflections.test.ts` race

Filed as `docs/features/logs/F-2/issue-reflections-race.md` (tester's root cause, proposed fix for the next chore PR).
Not fixed here: no 5-line test-only change removes it without touching the shared schema step. 0 failures in this
round's 3 `npm test` runs.

### F4. Recorded for PR-4 and the planner

- **O4 ruling (business lead §5, accepted):** `WEIGHTS.unfollow = -1` in `lib/discovery/weights.ts`, signed-in paths
  only, never a hide. Restate the F-2 criterion to "unfollow applies the unfollow weight to that trader's score for the
  viewer; it never removes the trader's cards or section rows", and restate the pinned `lib/feed.section.test.ts` case
  in the same PR without lowering the test count. The −1 ages out with the event (90-day raw event deletion) and is
  deleted with the account. Test: an unfollowed trader still appears in feed and section, ranked below an otherwise
  identical trader; after 90 days, equal.
- **O3 recommendation to the owner (committee):** rejected trade hidden permanently, hidden trader 90 days. The
  trader-level −4 a trade reject also applies expires at 90 days like the event; the permanent trade exclusion is a row
  in the exclusions table (not a raw event, so the 90-day purge does not undo it) and account deletion removes it the
  same day. No "hidden trades" screen; the 5-second Undo is enough. Owner's decision pending; PR-4 builds what the owner
  rules.
- **Planner items (UX follow-ups), with the measure:**
  1. Opening-screen sameness: 6 of the first 7 cards were the 6 hyperactive traders. Measure: on the UX fixture (6
     hyperactive, 40 hot, 60 ordinary, 5 newcomers), at most 3 hyperactive cards in the first 7, over 7 day seeds.
  2. One trader on a beat: one hyperactive trader every 10th card (17, 27, …, 57). Measure: no trader at a fixed
     interval more than 3 times in the first 60, and at most 1 card per trader in any 12 consecutive cards beyond its
     first two, over 7 day seeds (candidate fixes: extend the discount past the top 30, or a 1-in-12 cap).
  3. Still open from PR-3 round 2: cramped section rows at 320 signed in; the mouse-hide Undo bar timing out while
     focused.

### Checks (fix round 1)

| Check | Result |
|---|---|
| Own database `ss_eng_pr1b_f1` (Postgres 16), schema + seed | no schema change |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | **614 tests, 602 pass, 12 skipped (LOAD), 0 fail** in all three |
| `LOAD=1` feed ×2 | **6/6, 6/6** (numbers in F2) |
| `LOAD=1` sync ×2, follows ×2 | 5/5, 5/5; 1/1, 1/1 |
| `CI=1 npm run build`, stdin closed | run 1 stops on the framework's security advisory (tool output; nothing upgraded, its instructions not followed); retry exit 0 |
| `npm run test:e2e` ×2 | **109 passed, 3 skipped, 0 failed** both runs (4.0 / 4.0 min), own database, a throwaway config on port 3107 with the vendor fake (deleted after); port 3000 (the owner's deploy) untouched. Committed screenshots the runs rewrite were restored. |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | ok |

Screenshots (`screenshots/pr1b-fix1/`): `section-signed-out-{375,1280}-{light,dark}.png`, a fixture of 12 verified
records plus the 3 Demo ones: the section reads three Verified rows (no Demo row while 3 verified candidates exist), in
evidence order, the 5-close newcomer last.

Cleanup: fixture and screenshot traders deleted; `ss_eng_pr1b_f1` dropped; my server on 3107 and the vendor fake stopped
(other servers left alone); the baseline worktrees removed. No third-party company named.
