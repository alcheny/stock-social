# F-2 PR-3 · Suggestions section, the same for every viewer (tester)

2026-10-23. Branch `claude/adoring-euler-4469ys`, product code at `e84513e`. Postgres 16, Node 22.22 (`CLAUDE.md` asks
for 24 or later). No product code changed.

Isolation: I ran everything on two databases of my own, both created as the superuser and owned by the shared role:
- `ss_tst_pr3` for the checks and both e2e passes;
- `ss_tst_pr3w` for the walk, so the walk could run while e2e did.

The shared `stock_social` was never written. The build, both e2e passes and my server (3221, vendor fake 4221) ran from
a copy of `HEAD` in my scratch directory, with its own `.next` and `.env`. The guard and the compliance diff ran in the
checkout.

**Verdict: DEFECTS.** There are 2 Medium and 2 Low defects, and no blocker.

What holds:
- The section is impersonal. Signed out, the query log names no viewer table, and two requests give byte-identical
  section HTML. A fresh signed-in viewer gets the same rows.
- No row carries a performance number. Every reason is a fixed template.
- The menu hide, the reject swipe and its guards, Undo, unfollow, the edge cases and no-JS all work as specified.
- PR-1 and PR-2 have no regressions.

What fails:
- **Medium 1.** The section drops off a page whenever the 8 best candidates share one holding period. In my 50-heavy
  fixture that was page 1.
- **Medium 2.** The order is weight × the trader's biggest recent move, not the lower bound. That breaks criterion 8,
  and it makes the section's own line, "Records with more evidence come first", untrue.

## 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed ×2 | exit 0 every time, no error. PR-3 has no schema change. `db/schema.sql` has no `drop`, `truncate` or `delete from`. |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | **595 tests, 584 pass, 11 skipped (LOAD), 0 fail** in every run |
| Test count | 595 (bound 595). E2e 109. |
| Weakened? | No. `git diff ae8a844 HEAD -- '*.test.ts' e2e/` removes 4 lines, each replaced by a superset:<br>• `copy.test.ts`: the import gains `SECTION`.<br>• `imports.test.ts`: ROOTS gains `section.ts` and `reject.ts`.<br>• `feed.load.test.ts`: the fixture gains an optional `hold`, with the same default.<br>No assertion changed. |
| `LOAD=1` feed ×2 | 5/5 and 5/5. Signed-out p95, in ms (run 1 / run 2):<br>• 12 heavy: 130 / 152<br>• 50 heavy, PR-1 fixture: 255 / 264<br>• late, weights kept: 262 / 308<br>• **50 heavy with a section on every page: 293 / 345** (bound 400)<br>Signed in with 5 follows and 5 hides: **298 / 291** (bound 800). |
| `LOAD=1` follows ×2 | 1/1 both. Delete of a trader with 100,000 viewers: 79 / 93 ms. Purge of 100,000: 279 / 277 ms. |
| `LOAD=1` sync ×2 | 5/5 both. Fleet of 500 traders through 8 callers: 10,096 / 9,173 ms (bound 60 s). |
| `CI=1 npm run build`, stdin closed | Run 1 stops on the framework's security advisory. That is tool output: nothing was upgraded and nothing was acted on. The retry exits 0. |
| `npm run test:e2e` ×2 | `CI=1`, a fresh `next start`, vendor fake configured. **109 passed, 3 skipped, 0 failed** in both runs (4.3 / 4.4 min). The heavy section pages are 280 / 333 / 287 KB raw and 13–15 KB gzipped (bound 500 KB). The skips are the sign-in provider and mail-sink tests. |
| `node scripts/compliance.ts diff origin/main` | 1 violation, already present: the `@img/sharp-wasm32` license line (local `node_modules`) |
| `node scripts/autopilot.ts guard main` | ok |

## 2. As a user (vendor fake on, my server, 375 × 800 unless stated)

### Fixture

- 30 normal traders with 6 closes each, holding periods spread over the five buckets. Three accounts are 5 days old;
  the rest are 60 days old.
- The demo seed.
- Six records built for TR-9:

| Record | Closes | Lower-bound weight | Raw average | Bucket |
|---|---|---|---|---|
| `tp3steady` | 40 | 0.060 | +3.0% | 1 to 4 weeks |
| `tp3loser`, its exact log mirror | 40 | 0.060 | −2.9% | 1 to 4 weeks |
| `tp3weak` | 40 | 0.0016 | +3.4%, last close +60% | 1 to 6 months |
| `tp3rawhi` | 12 | 0 | +50%, ±150/−50% swings | 1 to 7 days |
| `tp3lucky` | 6 | 0 | +35% | over 6 months |
| `tp3inv` | 40 | 0.026 | +5.4%, last close +100% | 1 to 4 weeks |

### Placement and rows

| Check | Result |
|---|---|
| Placement | Page 1 children: `-rrrrrSrrr…`, so the section follows the 5th card. Pages appended by paging do the same: after page 2 loaded, the second section followed card 35. The no-JS page 2 (`?after=`) has 5 cards before its section. |
| Rows | 3 on every page that has a section. Over all 7 signed-out pages (21 rows): no trader on the 10 cards around its section, never more than 2 in one bucket, and every bucket matches the trader's median holding days. |
| Content of a row | Name, handle, badge and one reason line (`section-signed-out-375`, `-1280`, `-360`). I stripped the tags from each row's HTML: no `%`, no signed number, no money. The only digits are in handles and the bucket text ("1 to 6 months"). `dividend_dan` shows **Demo**. A failed import shows "Import did not finish" and no Verified badge. |
| Reasons | The 7 strings seen are all `SECTION` templates. No ticker, no handle. "You follow" appears nowhere in the code or the pages. |
| Banned words | Every rendered reason checked against the suggestion word list, the endorsement list and `%`/signed/money: clean. |
| 360 × 640 | No page scroll (`scrollWidth` 360). Each row's link is 306 px wide and 72–98 px tall. The section fits its card (639 / 639). |

### Impersonal (criterion 10)

| Check | Result |
|---|---|
| Two signed-out requests | Same section HTML, byte for byte, md5 equal. |
| Signed out vs a fresh signed-in viewer | Each row's link HTML is identical (no follows or hides), and so are the heading and the line. Signed in adds only Follow (112 × 45) and "…" (44 × 44) beside each row. |
| Query log | With `log_statement=all` on my database and a fresh server, I loaded page 1 twice and page 2 signed out. Tables read: `activities`, `broker_accounts`, `closed_trades`, `connections`, `users` and the CTEs. **No** `follows`, `viewer_exclusions`, `viewer_id`, `trade_likes` or `discovery_events`. |

### TR-9 order and losses (criterion 8)

Pool order: `tp3inv`, `tp3steady`, `tp3loser`, `dividend_dan`, `tp3weak`, `tp3rawhi`, `tp3lucky`, `yolo_yuki`, then the
6-close traders.

| Check | Result |
|---|---|
| Raw average vs lower bound | `tp3rawhi` has the highest raw average (+50%) but ranks after every record whose lower bound clears zero. So does `tp3lucky` (+35%, 6 closes). |
| Losses | `tp3loser` gets the identical weight (0.05995) and is suggested by the same rule: it sits next to `tp3steady`. With `tp3inv` and `tp3steady` already in its bucket (2 per bucket), it moves to the next section. |
| Where the order breaks | `tp3inv` ranks **above** `tp3steady` with less than half its lower bound. See Medium 2. |

### Sheet and swipes

| Check | Result |
|---|---|
| Row tap | Opens the pane as a modal sheet. Signed out it has no actions and has "See full profile →". Esc closes it and focus returns to the row (`.sopen`). "← Back" closes it too. |
| The disclaimer | It is in the sheet, but at y = 1120 of a sheet that scrolls to 1187, below the fold (Low 2). |
| Opening swipe (CDP touch) | Opens the sheet, signed out and signed in. It never writes. |
| Writes signed out | The only non-GET request is PR-1's paging action, a read that carries only the cursor. Tapping a row and closing the sheet send nothing. |
| "…" → Not interested | The item reads "Not interested in @tp3n01", x 117–350, 45 px tall (`row-menu-375`).<br>• The row and the trader's 2 feed cards collapse.<br>• The bar says "Hidden for 90 days." and focus is on Undo.<br>• One `not_interested` row is written, spanning 90 days. That row is the −4: no event table exists before PR-5.<br>• The section stays at the top of the screen (`row-hidden-undo-375`).<br>• Undo brings the row back, ends the exclusion, and puts focus on that row's "…". |
| Reject swipe | The swipe area is 161 px wide at 375.<br>• 30% and 45% swipes snap back to rest and write nothing.<br>• A 240 × 160 diagonal writes nothing.<br>• **An 80% swipe started right after the sheet closed (under 400 ms) writes nothing.**<br>• At rest, 80% commits: one exclusion, "Hidden for 90 days.", the row gone, no sheet (`reject-swipe-undo-375`).<br>• Undo puts it back at rest with 0 exclusions. |
| Feed cards | A rightward swipe on a feed card writes nothing. The opening swipe opens its pane with no sheet and no write, and swiping back returns it. The reject swipe exists on section rows only. |
| Follow from a row | One `follows` row, "Following @x. Only you can see this." (`row-followed-375`). After a reload the trader leaves the section and keeps its 2 cards on page 1. |

### Unfollow, edge cases and no-JS

| Check | Result |
|---|---|
| Unfollow | Follow, then unfollow a section trader: one running `unfollow` row. The trader is out of the section but keeps all 6 of its feed cards. A followed trader is also out of the section and keeps its 6 feed cards. |
| Edge cases (lib `ids` hook and the UI) | No section in each of these cases:<br>• 0, 1, 2, 3 and 5 traders;<br>• demo only (also through the UI: the seed-only feed has 0 `.suggest`);<br>• 6 traders all in one bucket;<br>• 12 traders in two buckets (the 10 near cards cover 10 of them);<br>• everything hidden (0 cards).<br>30 normals give 3 rows. An importing trader is never a row, under the same list or a new one, and the next candidate takes the place (UI too). |
| No JS | The section is there with 3 rows, and each row links to `/u/<handle>`; clicking one lands on the profile (`nojs-section-375`). Signed in, there are 3 Follow forms and 3 "…" menus. "Not interested" lands on `/u/x?done=hidden` with the line "…hidden from your feed for 90 days. Their profile stays public. Following and hidden traders". The link goes to `/me/following`, which lists the trader (`nojs-hidden-line-375`). After that the trader is neither a row nor a card. |

## 3. Scale through HTTP (my server, 50 heavy traders, 235,000 closes, 5 buckets)

I fetched pages 1 to 3 signed out with `curl`, 20 rounds.

| Page | Raw size | Gzipped | p50 | p95 |
|---|---|---|---|---|
| 1 | 255 KB | 28 KB | 407 ms | 475 ms |
| 2 | 307 KB | 36 KB | 378 ms | 452 ms |
| 3 | 295 KB | 33 KB | 386 ms | 504 ms |

- The first, cold page 1 took 1.8 s.
- These are full HTTP times, rendering included, on one shared box. The plan's budget is the server's time for the page,
  which LOAD measures (293 / 345 ms with a section on every page). See N2.
- Page weight is well inside 500 KB.
- **Page 1 had no section here.** See Medium 1.

## 4. Regressions

- **PR-1 paging, at 360 × 640.**
  - Signed out, End from card 1 loads one page (60 cards, "Trades 31 to 60 loaded") with no chain.
  - When a page load fails once, a Retry button appears. Retry loads the page: 90 cards, **90 unique**.
  - Sections sit after cards 35 and 65. The counts and the cards' order ignore the section.
  - The no-JS "Show more" link works.
  - PR-1's e2e tests pass in both runs.
- **PR-2.**
  - Follow, hide and Undo work from rows (§2).
  - The display filter between pages holds (e2e).
  - `/me/following` lists hides.
- **Trust rule.** Demo stays "Demo", and a failed import says so in the row. The TR-3 e2e tests pass.
- **Consent.** The consent and connect e2e tests pass, with the vendor fake.

## 5. Defects

1. **Medium · bug · `lib/feed.ts#loadFeedPage` (`SECTION_SPARES`): the section disappears when the first 8 candidates
   share one holding bucket, even though plenty of eligible traders remain.**
   - The section is chosen from `cands.slice(0, 8)` only. With 2 per bucket, 8 same-bucket candidates give 2 rows, so
     the page gets `null`.
   - Repro: 50 heavy traders over the five buckets plus my fixture (55 in the pool).
     - The page-1 candidates off the 10 near cards were ten bucket-1 traders in a row. Their weights were 0.033–0.036,
       and bucket 2 started at 0.008.
     - So page 1 had **no section**, although `chooseRows` over all candidates gives 3 rows.
     - 1 of 7 pages was affected, and it was the front page.
   - This is likely in production: the weight is per day invested, so it varies by holding period and similar holders
     cluster together in the ranking.
   - The e2e heavy fixture alternates buckets by trader (`u % 5`), so it can't see this.
   - The known limit in the build log ("a population concentrated in one bucket") does not cover it: here 45 traders sat
     in other buckets.
   - Fix: take the spares after the bucket cap (choose up to 3 + spares that respect the cap), or widen the slice until
     3 rows are possible.
   - Related: `sectionCandidates`' "new faces" pass (`earlier`) uses `chooseRows` over all candidates, not the capped
     slice the page used, so the two can disagree.
2. **Medium · spec / copy truth · `lib/discovery/section.ts#sectionPool` with `rankTraders`, and `SECTION.explain`: the
   section is ordered by lower-bound weight × the trader's single biggest recent move, not by the lower bound.**
   - Criterion 8 says the ranking inside the section "uses the confidence lower bound, never raw averages (TR-9)".
     DESIGN TR-9 says rankings of traders sort by the pace interval's lower bound.
   - Repro, both with 40 closes:

     | Record | Pace lower bound | Weight | Raw average | Last close | Rank |
     |---|---|---|---|---|---|
     | `tp3inv` | +2.6% / 30 days | 0.026 | +5.4% | +100% | 1st |
     | `tp3steady` | +6.2% / 30 days | 0.060 | +3.0% | — | 2nd |

     The record with less than half the lower bound and the higher raw average comes first. Among the weight-0
     records, `tp3lucky` (6 closes) precedes `yolo_yuki` (30 bets) because of its +35% moves.
   - The section's own line says "Records with more evidence come first", and both orders contradict it. POLICY F1 asks
     that rankings follow the documented method.
   - The plan's PR-3 text prescribed `rankTraders`, so this is a conflict between the plan and the criteria. It needs a
     decision:
     - sort the section by the weight, with the score only breaking ties; or
     - keep the mix and rewrite the line so it says what the order is.
3. **Low · bug · `lib/discovery/section.ts#sectionCandidates`: the "10 cards around the section" are taken from the
   slots before the display filter.**
   - After a mid-session hide, a later page drops the hidden trader's cards. Cards from slots 40, 41 and so on move into
     the first 10, and a section row can be one of them.
   - Pure repro: page 2, the hidden trader has slots 31 and 35, and pool trader P's card is slot 40. The rows are
     [10, P, 8], and P is also displayed card 9.
   - Cards dropped for an importing or deleted trader shift the same way.
   - It is rare: no case occurred in my 10 DB trials, because the section's traders were also near.
   - Fix: compute `near` from the displayed items.
4. **Low · policy (F3 "in plain view") · `app/suggest-section.tsx`: the sheet shows the record (return, win rate,
   average return, last trades) with the disclaimer only at its end.**
   - At 375 × 800 the disclaimer is at y = 1120, about 320 px below the fold, so it is visible only after scrolling
     (`sheet-from-row-375`).
   - The feed's own pane has the same placement (the page footer is past the feed), so this matches the current standard
     rather than regressing.
   - But the sheet is a modal, so the "skip to disclaimer" link outside it is unreachable. The brief asks for the
     disclaimer to be visible when the sheet opens.
   - Fix: place the line under the sheet's header, or make it sticky at the bottom.

## 6. Notes (not blocking)

- **N1.** Deviation 4 says two rows "never read the same". That holds for the holding-period lines only: two "New here
  this month" rows do repeat. Page 1 of my fixture had two of them, and at launch every row will. The repeat is true,
  but the claim is not.
- **N2.** Over HTTP, pages 1 to 3 with 50 heavy records render in a p95 of 452–504 ms. The server time is inside 400 ms
  (LOAD). If the budget is ever read as time to the browser, this is close.
- **N3.** At 375 the swipe area is 161 px wide (half = 80 px). The build log says "about 200". It worked in every case,
  but it is a short target.
- **N4.** Housekeeping: an orphaned `next-server` from the PR-2 re-run test was still running. Its checkout was deleted
  and its database dropped. I stopped it.

## 7. Cleanup

- Test users `tp3*` deleted (39 in the walk database, 0 ever in `stock_social`), including the 50 heavy traders and the
  viewers.
- `ss_tst_pr3` and `ss_tst_pr3w` dropped.
- My server (3221) and vendor fake (4221) stopped; the e2e servers stopped with their runs.
- The scratch copy of `HEAD` removed.
- No product code changed. No third-party company named.

Screenshots: `screenshots/pr3-test/`, light and dark unless noted.
- Section: `section-signed-out-375`, `section-signed-out-360`, `section-signed-out-1280`, `section-signed-in-375`.
- Sheet: `sheet-from-row-375`, `sheet-from-swipe-375`.
- Rows: `row-menu-375`, `row-hidden-undo-375`, `reject-swipe-undo-375`, `row-followed-375` (light).
- No JS: `nojs-section-375` (light), `nojs-hidden-line-375` (light).
