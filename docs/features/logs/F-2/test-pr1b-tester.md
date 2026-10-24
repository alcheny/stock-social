# F-2 PR-1b · Exploration and reach (tester)

2026-10-24. Branch `claude/adoring-euler-4469ys`, product code at `a6d3002` (HEAD `350522b`). Postgres 16, Node 22.22
(`CLAUDE.md` asks for 24 or later). No product code changed.

Isolation: one database of my own, `ss_tst_pr1b`, created as the superuser and owned by the shared role. The shared
`stock_social` was never written. The build, both e2e passes and my walk server (3232; e2e on 3231, vendor fake 4231)
ran from a copy of `HEAD` in my scratch directory, with its own `.next` and `.env`. A worktree of `a6d3002~1` gave a
same-machine baseline for one budget. The guard and the compliance diff ran in the checkout.

**Verdict: DEFECTS.** There are 2 Medium defects and 1 Low defect, and no blocker. Every acceptance number reproduces.

What holds:
- The business lead's acceptance test passes on my own run of the fixture: 104 of 105 traders seen, 5 of 5 newcomers,
  28 of 28 sections with at least 2 new rows, and no repeated run.
- Outside traders only ever fill exploration slots. Demo data never takes the new-record slot.
- The section is impersonal.
- e2e passes 109 of 109 twice, with no regression in PR-1, PR-2 or PR-3, the trust rule or consent.

What fails:
- **Medium 1.** The 400 ms signed-out budget with a section on every page now has about 0 to 50 ms of headroom. One LOAD
  run failed at 405 ms.
- **Medium 2.** The section's line "Ordered by how much evidence each record has" can now be untrue.

## 1. Checks

| Check | Result |
|---|---|
| Schema ×2 | exit 0 both times. Run 2 prints only "already exists, skipping" notices. No schema change. `db/schema.sql` has no `drop`, `truncate` or `delete from` statement, only the words in two comments. |
| `npx tsc --noEmit` | clean |
| `npm test` ×4 | **611 tests, 599 pass, 12 skipped (LOAD), 0 fail** in every run |
| Test count | 611 (bound ≥ 610). E2e 112 (109 + 3 skipped). |
| Weakened? | No. `git diff a6d3002~1 HEAD -- '*.test.ts' e2e/` removes no line. |
| `LOAD=1` feed ×2 | **Run 1: 5 of 6, Run 2: 6 of 6.** Run 1 failed "with the section on every page, 50 heavy" at **signed-out p95 405 ms** (bound 400), with signed-in 369 ms. Run 2 gave 338 / 335 ms. Other p95s (run 1 / run 2): 12 heavy 173 / 165; 50 heavy 332 / 301; one-period 350 / 326; late, weights kept 282 / 255. See Medium 1. |
| `LOAD=1` sync ×2 | 5/5 both |
| `LOAD=1` follows ×2 | 1/1 both |
| `CI=1 npm run build`, stdin closed | Run 1 stops on the framework's security advisory. That is tool output: nothing was upgraded and its instructions were not followed. The retry exits 0. |
| `npm run test:e2e` ×2 | `CI=1`, fresh `next start` on 3231, vendor fake configured. **109 passed, 3 skipped, 0 failed** in both runs (4.2 / 4.1 min). |
| Page weight | e2e heavy section pages: 321 / 322 / 329 KB raw, 14–17 KB gzipped. My walk fixture (105 traders + demo): 348 / 367 / 350 KB raw, 37–39 KB gzipped. Bound 500 KB. |
| `node scripts/compliance.ts diff origin/main` | 1 violation, already present: the `@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | ok |

### The first-run `lib/reflections.test.ts` failure (pre-existing; not this PR)

I did not reproduce it: 0 failures in 4 full runs. What causes it:
- The file's `before` hook re-applies all of `db/schema.sql` while other test files run in parallel.
- `schema.sql` lines 124–127 backfill `broker_accounts` with an `insert … select … from activities`. The PR-2a fix
  filters already-claimed accounts in the same snapshot. Under READ COMMITTED, though, a user deleted by a parallel
  file's `delete from users` can still be in the select's snapshot when the foreign key check runs. That check sees the
  committed delete and raises the `broker_accounts` users foreign key error. That matches the engineer's report.
- Both pieces predate PR-1b: the hook is from F-1 PR-1 and the backfill from F-1 PR-2a.

**Tag: pre-existing flake, Low, not PR-1b.** Suggested fix in its own PR: guard the backfill with `exists (select 1 from
users where id = a.user_id)` plus `on conflict do nothing`. A partial fix only; the clean fix is to stop re-applying
the schema in a parallel hook.

## 2. Acceptance, reproduced independently

Method:
- My own script (not committed) rebuilds the business lead's fixture with the same generator: 40 hot, 60 ordinary and
  5 newcomers with 5 or 6 closes.
- Signed out, pages 1 to 4 (120 cards) and their sections, on 7 UTC day seeds from 2026-10-20 to 2026-10-26.
- The metrics are computed by my code, not the engineer's test. That test also passes in every `npm test` run.

| Seed | Seen / 105 | Newcomers | Hot in first 60 | Repeated 3-runs in 60 |
|---|---|---|---|---|
| 10-20 | 78 | 2 | 37 | 0 |
| 10-21 | 79 | 5 | 36 | 0 |
| 10-22 | 78 | 1 | 37 | 0 |
| 10-23 | 75 | 2 | 36 | 0 |
| 10-24 | 77 | 2 | 36 | 0 |
| 10-25 | 80 | 3 | 37 | 0 |
| 10-26 | 80 | 2 | 36 | 0 |
| **Union** | **104 (99%)**, bound ≥ 80% | **5 / 5** | | **0** |

- **≥ 2 of 3 rows with no earlier card:** 28 of 28 sections. In each of them an eligible trader with no earlier card
  existed. This is identical to the engineer's table.
- **Skewed fixture** (the reach test's version of PR-1's, 7 day seeds):
  - hyperactive cards in the first 60: 11 on every seed (bound ≤ 27);
  - worst 10-window: 5 (cap 5);
  - repeated runs: 0.
  - PR-1's own pinned version (19 of 60) passes in every `npm test` run.

### The 200-card ranking is unchanged by outside traders

Method: on the same seed, I mixed `ranked` with and without the outside cards (`mixFeed(ranked, {day})` against
`mixFeed(ranked, {day, extra})`), 7 seeds each.
- `ranked`, the 200 candidates in rank order, is built from the candidates alone. Outside rows (`x`) are filtered out
  before `rankTraders`/`discounted`.
- **The exploration slot positions are identical** in the first 200 on all 7 seeds.
- **Ranked slots never hold an outside card** on any seed.
- The sequence of ranked slots does differ, from card 5 to 35 onward. In both modes the non-explore cards in the first
  200 are 160 out of 200 ranked cards; with the outside cards on, 28 to 35 of them differ. Every such card is one that
  the run without outside cards had used as an exploration pick.
- Why: exploration now takes outside traders instead of tail cards, so those tail cards stay in ranked order. That is
  inherent to the design and not a defect. It does mean PR-1b changes which cards a reader sees in ranked slots, not
  only in exploration slots. "PR-1's ranked order unchanged" is true of the ranking, not of the rendered sequence.

### The new-record slot never promotes Demo

- In the database: I added 6 Demo records with weight 0, 5 closes and `verified=false`. Across 28 sections the third
  row had weight 0 every time and was never a Demo record. These Demo records tie the newcomers on closes, though, so
  this check is weak.
- Pure check (`sectionCandidates`): the Demo records have **fewer** closes and **lower ids**, so they would win the slot
  on its own ordering. Rows came out `100, 101, 50 (verified, w0)`.
  - With no verified weight-0 trader available, the slot stays empty and row 3 is the next record by evidence.
  - A Demo record can still reach a row by the ordinary order (see §3); it is never *promoted* there.

### Impersonality

On my server (`/`, 375 px), I compared the section's `outerHTML`:
- signed out, two requests: **byte-identical**;
- two fresh signed-in viewers: **byte-identical**.
- Signed out against signed in, the only difference is the signed-in "Hide" tray inside each row (a control, not a row).
  The rows, their order and their reasons are the same.

## 3. Defects

**Medium 1: the section budget has lost its headroom.**
- The PR-3 LOAD test "with the section on every page, 50 heavy traders" failed once at signed-out p95 **405 ms** (bound
  400).
- Same machine, same database, back to back (baseline `a6d3002~1` against PR-1b):

| Run | Baseline (signed out / signed in) | PR-1b (signed out / signed in) |
|---|---|---|
| 1 | 264 / 261 ms | 367 / 370 ms |
| 2 | 251 / 280 ms | 349 / 351 ms |

- That is about +100 ms (+40%) from the outside-trader read and the larger section pool.
- In both of my 50-heavy LOAD runs, page 1's p95 was 403–456 ms. The "all pages" figure stays under the bound only
  because pages 2 and 3 are cheap.
- Expected: a stable pass with margin. Actual: a pinned test that fails intermittently.
- The engineer's 375 ms already sat close to the bound.

**Medium 2: "Ordered by how much evidence each record has" can be false.**
- The pool is now grouped: no card earlier, then carded. Within each group the order is TR-9, but across groups it is
  not.
- When fewer than 3 uncarded traders fit (because of the bucket cap or a small pool), row 3 comes from the carded group
  and can carry more evidence than rows 1 and 2.
- Pure reproduction: traders 100 (w 0.9) and 101 (w 0.8) are carded on page 1; 200 (w 0.1) and 201 (w 0.05) are not.
  The page-2 section reads **200 (0.1), 201 (0.05), 100 (0.9)**.
- The engineer's log (§1 row 5) says the rows "still read in non-increasing evidence". That is true of the slot only.
- In my DB fixture it did not occur: 0 of 28 sections, because almost every pool trader has weight 0. It becomes
  likely once real records gain evidence.
- This is the same class as PR-3's Medium 2: the on-screen claim about the method has to match the order. Fix either
  the copy (for example, "Traders not shown above first, then by evidence") or the order.

**Low 1: a Demo record can head the section above verified records.**
- The engineer reported this. I see it too: on my walk fixture, page 1's section reads `@dividend_dan` (Demo), then
  `@tword59` (Verified), then `@twnew100` (Verified, the new-record slot). See the screenshot.
- It is correct under the documented order: Dan has no earlier card and more evidence.
- **Product question for the business lead and UX lead:** in a section meant for reach, should Demo records ever rank
  above verified ones? A one-line rule would make the answer no: Demo last, as the slot already does.
- It is Low because the Demo badge is shown, so nothing misleads a reader.

## 4. Regressions (e2e ×2, plus the walk)

- **PR-1:** paging, cursor, caps and heavy page weight pass. The cursor bound grows to 350 (`FEED_LIST_MAX`), and four
  pages were reached in my sweep.
- **PR-2:** follow, unfollow, hide and Undo pass.
- **PR-3:** section position 6, 3 rows, the sheet with Esc/Back/focus return, the reject swipe and its guards, and
  no-JS profile links all pass, including the 2 px disclaimer fix ("wholly in view").
- **Trust rule:** the Demo badge on Demo rows and cards, and the failed-import state, pass.
- **Consent and connect with the vendor fake:** pass.

## 5. Screenshots (`screenshots/pr1b-test/`)

- `section-signed-out-375-light.png`, `section-signed-out-375-dark.png`: the walk fixture, page 1 section (Demo first,
  then the verified rows, then the new-record slot).
- `sheet-from-row-375-light.png`: the sheet opened from row 1.

## 6. Cleanup

- Test users deleted: the 105-trader walk fixture, 2 viewers, and the fixtures from my script.
- `ss_tst_pr1b` dropped.
- My servers on 3231 and 3232 and the vendor fake stopped. Other servers, including the one on 3000, were left alone.
- The baseline worktree and scratch copy were removed.
- No product code changed; no third-party company named.
