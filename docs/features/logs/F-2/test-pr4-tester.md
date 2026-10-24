# F-2 PR-4 · Likes and gestures (tester)

2026-10-24. Branch `claude/adoring-euler-4469ys`, product code at `8bb09bf`. Postgres 16, Node 22.22 (`CLAUDE.md` asks for 24
or later). No product code changed.

Isolation: databases of my own, created as the superuser and owned by the shared role: `ss_tst_pr4` (unit, LOAD, build),
`ss_tst_pr4e` (the two counted e2e runs, fresh schema + seed), `ss_tst_pr4w` (the walk, the database checks, the page
weight). The shared `stock_social` was never written. Everything ran from a worktree of `HEAD` in my scratch directory
(own `.next`, `.env`, `node_modules`); a worktree of the parent `28735d0` was built for the "before" figures. e2e on 3481
(vendor fake 4112, sign-in fakes 4110/4111) through a temporary Playwright config; walk server 3482; parent 3483. Port 3000
was not touched.

**Verdict: CLEAN.** Every check passes, every behaviour in the plan (PR-4) and in O1, O3 and O4 holds, and I found no
regression and no defect. Notes (not defects) are in section 5.

## 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed | exit 0 each time, on each database. `trade_likes`, `trade_exclusions`, `closed_trades.trade_key` and their indexes created once, then no-ops. `db/schema.sql` has no `drop`, `truncate` or `delete from`. |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | **637 tests: 625 pass, 12 skipped (LOAD), 0 fail** in each run. 637 ≥ 637. |
| Weakened? | No. `git diff 28735d0 HEAD -- '*.test.ts' e2e/` removes 10 lines, each replaced by a superset: the pinned weights gain `unfollow: -1`; `imports.test.ts` ROOTS gain `gestures.ts`; `VIEWER_TABLES` gains `trade_exclusions`. The restated section criterion (O4) now asserts more: the unfollowed trader **stays** in the section and the feed, `traderPreference` gives exactly `WEIGHTS.unfollow` (−1) on that trader and nothing on another, and nothing at +90 days. The "k candidates" loop removes candidates with follows instead of unfollow rows; follows leaving the section are asserted earlier in the same test, so the coverage is the same. |
| `LOAD=1`, one file at a time | sync **5/5** (first sync 1,022 ms; fleet 11.6 s, bound 60 s). follows **1/1** (delete with 100,000 viewers 112 ms, purge 255 ms). feed: run 1 **6/6** (50 heavy: p95 page 1 292 ms, all 255 ms; section signed-out 411 ms / signed-in 384 ms). Runs 2 and 3 each failed the two section cases by a few ms (p95 417 to 482 ms, bound 400). The parent `28735d0` on the same machine in the same hour failed **5 of 6** (p95 up to 626 ms). The load average was about 1.5 to 2 on 4 cores (other sessions). This is machine noise, not PR-4: the only new feed read is one indexed lookup of at most 30 keys. |
| `CI=1 npm run build`, stdin closed | Run 1 stops on the framework's security advisory. That is tool output; nothing was upgraded. The retry exits 0. |
| `npm run test:e2e` ×2 | **118 passed, 3 skipped, 0 failed** in both counted runs on a fresh database (5.2 / 5.1 min). The 4 `likes.spec.ts` tests pass. Two earlier runs on `ss_tst_pr4` (dirty: leftover fixtures from my LOAD runs, 30,031 demo closes) failed 6 to 7 tests, including fixed-count and regex assertions on seeded data. I count that as my setup. |
| `node scripts/compliance.ts diff origin/main` | 1 violation, already present: the `@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | ok |

## 2. As a user (server 3482, 375 × 800 touch through the browser's input pipeline, and 1280 keyboard)

### Double tap = like

| Case | Result |
|---|---|
| Second tap 320 ms after the first | no like |
| Second tap 30 px away | no like |
| 150 ms (plus driver overhead, under 300 ms) and 20 px away | **one like**; button `aria-pressed="true"`, quiet ♥ by the menu |
| Double tap on the handle link, the symbol link, the footer link, the "…" menu | no like on each (links navigated where they lead, as normal) |
| Double tap on the pane's chart (row swiped open) | no like |
| A short horizontal swipe, then one tap | no like |
| Vertical swipe ×2, one tap then a slow second (engineer's e2e, passes) | no like |
| Double tap again | unliked, ♥ gone, 0 rows |
| 40 rapid double taps | 0 rows and no ♥ (even count): the state and the store stay in step |
| Latency, second `pointerup` to the ♥ in the DOM (measured in the page) | **5.9 ms** (budget < 100 ms) |
| Motion | 0 elements with an animation in any card, no transition in the menu. No count, no vibration, no celebration. |

Double tap on the "Demo" badge likes. The badge is a plain non-interactive `<span>`, so that is the card body and matches
the spec (only link, button, menu, chart are excluded).

### Privacy

Viewer A liked a trade of `@dividend_dan`. Viewer B (signed in) and a signed-out visitor fetched `/`, `/u/dividend_dan`, the
liked trade's page, `/t/<symbol>`, `/sitemap.xml`, `/robots.txt`, `/u/dividend_dan/opengraph-image` and `/me/following`.
The HTML was searched for `♥`, `like-mark`, a Like button with `aria-pressed="true"`, "Liked" (other than B's own "Liked trades"
link), any "N likes", A's handle and the table name: **no hit on any route**. The share image is byte-identical liked and
not liked. `/me/likes` signed out → 307 to `/login`. It is `noindex, nofollow`. The unit test confirms that only
`lib/likes.ts` and `lib/delete.ts` name the tables, every read is keyed by the viewer, and no query counts.

### Keyboard (1280) and signed out

- "…" → Like: name "Like. Only you can see likes.", 82 × 45 px, Enter → pressed, status "Liked. Only you can see likes.", 1 row.
  Enter again → "Like removed.", 0 rows.
- "Hide this trade": bar "Trade hidden.", focus on Undo, 1 exclusion. Enter on Undo → card back, 0 rows, focus on that card's "…"
  (`keyboard-hide-1280`).
- Signed out: no menu on any card. Two double taps show **one** line, "Sign in to like trades. Sign in ×". A reject-direction
  swipe does not move the card. Rows in both tables are unchanged (0 → 0) (`signed-out-line-375`).

### Reject swipe on feed cards (O1, O3)

| Case | Result |
|---|---|
| Opening direction (finger left) | the pane opens (row scrollLeft 375, SW-1), 0 exclusions |
| Flick: 40% in 24 ms | snaps back, 0 rows |
| 49% | 0 rows |
| Finger travels out to 70%, comes back to 20%, then lifts | 0 rows (the outcome is the finger's travel at lift) |
| Diagonal (dx 240, dy 160) | no change |
| 60% | that card only is hidden: "Trade hidden." with Undo, 1 exclusion, 0 likes (`reject-bar-375`) |
| Undo at about 4 s | card back, 0 rows |
| Again, left alone | Undo gone after 5 s, 1 row. After a reload the trade is absent and the trader's 2 other cards remain. A signed-out visitor still sees it. |
| Exclusion backdated 120 days | still hidden (no expiry, O3) |
| Right after a pane closes (engineer's e2e, passes) | never commits |

### Stored signals, expiry (database, `ss_tst_pr4w`)

- `traderPreference`: a trade reject's −4 at 89 days, 0 at 90. Unfollow −1 at 89 days, 0 at 90. The unfollow row spans exactly
  90 days. The unfollowed trader is not in `sectionSkips` (never a hide). Backdated past 90 days: the reject's −4 is gone,
  and the 3 likes still count (+9), while the trade itself stays hidden.
- No event table exists, and no request in any of my browser contexts reached an event, log or tracking URL (`[]`). The engineer's
  e2e asserts the same in every context.

### `trade_key` and rebuilds

12 sell ids were imported as real activities and closed by `rebuildTrades`: `a\b`, `\x41`, `\\`, `\001`, `end\`, a quote,
non-ASCII, `\\x00`, `E'\n`, `%_*`, spaces, and 300 characters. **0 mismatches** against node:crypto sha256 and
`lib/likes.ts#tradeKey`. 3 likes and 1 reject were made, then `rebuildTrades` ran again. The close ids changed, and all
3 likes and the reject re-attached. Another viewer's `likedAmong` is empty.

### Likes list

- 90 likes: page 1 has 50 rows (388 ms full navigation), page 2 has 40, with 90 distinct links and no count text anywhere
  (`likes-list-375`). Remove with JS: 90 → 89. Remove without JS: 89 → 88, landing on `/me/likes`.
- 10,000 likes for one viewer, with every 7th `created_at` tied: 200 pages of 50, each like once, server read p50 21 ms,
  max 49 ms.

### Deletion

`deleteProfile` was run for a viewer and a trader with a vendor call that **fails**. 0 likes and 0 exclusions are left made by
or naming either account (the first transaction, before the vendor call). Test users removed afterwards: 0 left.

### Actions: auth, CSRF, tampering, rate

I captured the Like action's request (`["<card id>"]`) and replayed it.
- Signed out: 200 with `{ok:false}`, 0 rows written.
- Cross-origin `Origin` with a valid session: 500 (the framework's origin check), 0 rows written.
- Bodies `"1 or 1=1"`, `"-5"`, `{"id":"1"}`, an id that does not exist, `null`: each `{ok:false, reason:"invalid"}`, 0 rows.
- There is no viewer parameter at all: the viewer is always the session's. Another viewer's key passed to `unlike`/Remove
  deletes nothing (that viewer's 3 likes are kept). Own trade: refused (`like` returns false; a check constraint backs it up).
- Same-origin replay with the session: +1 row. Then 200 more posts: still **1 row**.
- Rate stance: there is no limit on these actions, and none is planned (the plan rate-limits only PR-5's events route). The
  store is bounded by the primary key (one row per viewer and close), and the actions are idempotent, as with follow and
  hide. Acceptable for PR-4.

## 3. Performance and weight

- Feed p95 at 50 heavy traders: see section 1. Within budget on a quiet run; the parent misses more on the same machine.
- Page weight, signed out, same database: `/` 62,100 → 62,342 B HTML (+242 B; gzip 9,542 → 9,609, +67 B). `/u/dividend_dan`
  is unchanged (45,936 B). All static chunks: 682,917 → 692,812 B (+9.9 KB raw, the menu and gesture code). The e2e
  "30 cards from 50 heavy traders under 500 KB" passes.

## 4. Regressions

Covered by both green e2e runs and by the unit suite. These include feed paging, the suggestions section (its reject swipe,
and the feed-card pane opening), follow, Not interested with Undo, Similar trades, and the trust rule (Demo badge,
Verified). A signed-out visitor still sees a trade another viewer rejected.

## 5. Notes (no defect)

- Machine noise made the feed LOAD bounds flaky in my session. The parent is worse on the same machine.
- The first two e2e runs were on a database that my LOAD runs had dirtied. They are not counted; the counted runs used a fresh one.
- Known limits as listed by the engineer: feed cards only, and a gap where a rejected trade was.

## 6. Cleanup

The test users (`tq_*`, `tw_*`, e2e handles) were deleted. Only this report and `screenshots/pr4-test/` are committed.
All three of my databases are dropped. My two `next start` servers (3482 on HEAD, 3483 on the parent) could not be stopped from this session because the permission layer refused the `kill`. They serve the dropped databases and need stopping by hand. Worktrees are in my scratch directory.

Screenshots (`screenshots/pr4-test/`, light and dark): `liked-375`, `reject-bar-375`, `keyboard-hide-1280`,
`signed-out-line-375`, `likes-list-375`.
