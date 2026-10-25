# F-2 PR-4 review (independent reviewer, 2026-10-25)

Scope: `git diff 4741538 66a81b9 -- . ':!docs'`, product, test and e2e changes only (commits 06b90b2, e4c989f, 66a81b9).
The range also carries a365aea (`CLAUDE.md`, the owner's process change, not PR-4 code). The branch has moved on since
then (bcaac14 POLICY F1, then plan logs), but those commits change only docs, so the product files at HEAD are the same
as at 66a81b9.

Environment:
- The production server on :3000 (built from 66a81b9) and the shared `stock_social` database were used as they were,
  never rebuilt or stopped.
- Baseline: a scratch worktree at 0666990, with its own database `stock_social_rv4` (schema and seed) and port 3391.
- A second scratch worktree at 66a81b9 for one mutation check.
- Cleanup: both worktrees removed, the scratch server stopped, `stock_social_rv4` dropped.
- Shared database: one temporary like (`momentum_maya` on a `dividend_dan` trade) inserted and deleted again. The heavy
  fixture was removed by its own test (0 `heavy_feed_*` users left).
- Screenshots that the e2e run rewrote were restored.

## Reviewer rules (IMPLEMENTATION, plan §1)

| Rule | Result |
|---|---|
| No event table before PR-5 | **Pass.** The schema adds `closed_trades.trade_key`, `trade_likes` and `trade_rejects`. These are state the viewer chose: one row per viewer × trade, and Undo ends a row instead of adding one. The only `*event*` table is F-1's `funnel_events` (pinned in `lib/likes.test.ts`). `trade_rejects` is not in the plan's list, because the plan predates O1. It is the "row in the exclusions table, not a raw event" that the business lead asked for in committee PR-1b §5. A per-trade key can't live in `viewer_exclusions`, whose primary key is (viewer, trader). |
| No weakened or deleted test | **Pass.** 15 test lines were removed, and each one is a restatement the business lead ordered in §5. (1) `exclusions.test.ts`: the weights pin now includes `reject −4`, `rejectTrader −1` and `unfollow −1`. (2) `imports.test.ts`: `prefs.ts` was added to ROOTS (a superset). (3) `feed.section.test.ts`, criterion 4: the unfollowed trader stays in the section and ranks below its equals; k = 2 now gives a section with that trader last, and k = 1 or 0 gives none. (4) `follows.test.ts`: `FEED_HIDES_UNFOLLOWED` is asserted gone and "same order" became "same cards". The demotion that replaces "same order" is asserted by the new `lib/feed.prefs.test.ts` (ranked below an identical twin, equal again after 90 days). The e2e changes only add lines (the feed lock in `follow.spec.ts` and `similar.spec.ts`). |
| Test count not lower | **Pass.** 623 → 643, run on the same scratch database (base 0666990: 623; head: 643). |
| Schema additive | **Pass.** It uses `schema_add_column`, `schema_add_index` and `create table if not exists`. There is no `drop`, `truncate` or `delete from` (`guard main` ok). |
| ≤ 800 product lines | **Pass: 761** (+651 / −110), excluding tests, e2e, docs and a365aea's `CLAUDE.md`. The engineer's 769 includes those 8 `CLAUDE.md` lines. |
| No protected path | **Pass for PR-4's files** (checked against CODEOWNERS). The commit range itself carries `CLAUDE.md` (a365aea), and the branch carries `docs/POLICY.md` (bcaac14). A PR opened from this branch is therefore a needs-human merge, which is correct. |
| Quoted budgets match the plan's table | **Pass.** PR-4's only budget is tap to feedback < 100 ms (§4). The build log and the tester quote the same value (the toggle is optimistic and flips synchronously). The feed p95 of 400 ms that the logs cite is the signed-out budget as in §4, and the purge limit of ≤ 30 s is unchanged. |

## Decisions and acceptance

| Item | Result |
|---|---|
| Likes: double tap, +3, private | **Pass.** Two taps within 300 ms and 24 px. Taps on links, buttons and the chart never count. The like happens once, and a second double tap never unlikes. The heart button carries `aria-pressed` and is 44 px, with no count, motion or burst. The +3 stays pinned until PR-5 reads it. Signed out there is no heart. The plan's inline sign-in line was replaced at the business lead's D2, under the same rule as Follow. |
| **Likes private everywhere (own check)** | **Pass.** Code: only `lib/likes.ts`, `lib/delete.ts` and `lib/discovery/purge.ts` name `trade_likes`. Every read is keyed `viewer_id = ${viewer}`, and nothing counts likes. Live, with a temporary like on a `dividend_dan` trade: signed-out `/`, `/u/dividend_dan`, `/pane`, `/pane-chart`, the trade page and the liker's own profile carry no like markup or word. The OG image and the pane are byte-identical with and without the like. The only trade key on `/` is the row's `data-key`, which every card carries with or without likes (a sha256 of the sell id, which is already public in trade URLs). Signed out, `/me/liked` returns `{"liked":[]}`. `e2e/likes.spec.ts` + `follow.spec.ts` against :3000: **8/8 passed**. |
| O1: reject on the feed card | **Pass.** The opening direction still opens the pane (SW-1). The other direction drags the card. It arms only from rest, with no sheet open and not within 400 ms after the row came back from its pane. The drag must be horizontal at ≥ 2× vertical, and it commits at half the card. Undo lasts 5 s (`role="status"`). The section-row swipe (PR-3) stays. "Hide this trade" in the card's "…" is the button route (A1). |
| O1: −4 on the trade, slight negative on its trader | **Pass.** The trade is hidden (`WEIGHTS.reject −4` pinned). The trader gets −1 for 90 days, ended at Undo. The business lead accepted −1 and withdrew §5's "trader-level −4", since the owner's O1 text is later. A rejected trade is also never one of that viewer's Similar trades rows. |
| O3 (default 90 days) | **Pass.** `TRADE_REJECT_DAYS = 90`; the copy reads "Trade hidden for 90 days.". The permanent path (`until = 'infinity'`, never purged, trader part still 90 days) is tested. The §5 conditions hold: the trader part expires at 90 days, the reject is a row and not an event, account deletion removes it in the first step, and there is no hidden-trades screen. |
| O4: unfollow −1, never a hide | **Pass.** It runs on the existing 90-day `unfollow` row. The trader's cards and section rows stay, ranked below an identical twin, and are equal again after 90 days. The rows are deleted with the account. Criterion 4 is restated as §5 ordered. |
| Business lead's point 6 (reviewer to confirm) | **Confirmed by mutation.** In a scratch worktree at 66a81b9, I took `extra` out of `shapeList` (the 4741538 behaviour). `prefs.test.ts` "shapeList: … exploration-only cards are filtered too; no shaping and no preference is PR-1b's mix exactly" then fails (9/10). Restored, it passes 10/10. |
| CLAUDE.md product rules | **Pass.** Verified-only, Demo badge and percent-only are unchanged. Losses count the same as gains: prefs, likes and rejects never read a return's sign or size. There is no celebration and no frequency reward. TR-1 holds: a reject removes a card from one viewer's feed and Similar rows only, never a trade from the trader's own record. The feed and profiles work signed out. |
| POLICY / COMPLIANCE §1 | I agree with the build log's 11 answers. There is no new number, vendor, dependency, user text or advice word (`LIKES` is in `allCopy`). The actions are bound to the session and check the key pattern before any query. F6 holds. The one F1 point is below. |

## Merge condition (POLICY F1 as amended in bcaac14)

- **M1.** F1 now ends: "A viewer can turn personal ordering off in Settings."
  - PR-4 is the first personal ordering: the unfollow and trade-reject demotions in the feed and in the section's pool. It
    ships with no switch, so F1's last sentence is false on this branch from PR-4 until PR-7 (G1) merges. Main's
    pre-amendment F1 ("no personalized suggestions") is stricter still.
  - This can't be fixed inside PR-4. G1 is about 40 product lines (761 + 40 > 800), and it belongs to the signed
    guardrails plan (`plan-guardrails.md` §1 "Urgency"), whose PR-7 builds from PR-4's merge commit.
  - Ruling: this is not a defect in PR-4's code. It is a condition on the merge:
    - PR-7 merges next, before any other F-2 item and before H4 lets real viewers in.
    - The owner acknowledges the window when merging. The merge is a protected-path one anyway (`CLAUDE.md`,
      `docs/POLICY.md`).
    - For zero window, the owner merges PR-4 and PR-7 together.

## Findings (non-blocking)

- **Unit-suite flake, pre-existing.**
  - What I saw: 2 of 4 `npm test` runs on the shared database failed in a `before` hook, once in `lib/likes.test.ts` and
    twice in `lib/funnel.test.ts`.
  - Cause: the `db/schema.sql:124` `broker_accounts` backfill races a parallel file's user delete
    (`broker_accounts_user_id_fkey`, 23503). This is the race already reported in `test-pr1b-tester.md` and
    `test-pr2-tester.md`.
  - On a fresh scratch database, base and head alternated 4 times each with 0 failures.
  - PR-4 adds two schema-applying files (20 → 22), so the race is likelier on a large database. Fix it in its own
    chore: guard the backfill as PR-1b's tester suggested, or lock around the hook's schema apply.
- **Guard gap.** `VIEWER_TABLES` (`lib/feed.signed-out.test.ts:13`) does not name `trade_rejects` (the engineer's
  inventory, D13). The feed has its own PR-4 case for it, but the signed-out section and Similar trades cases don't
  check it. Add `trade_rejects` to the regex; that adds a case and strengthens the guard.
- **Stale test name.** `lib/follows.test.ts` still says the feed doesn't "honor" an unfollow, but the feed now ranks by
  it. Rename it in a chore.
- **G5 and G6 are known and planned (PR-8).** `GET /me/liked?k=…` puts card keys in the URL, and "Liked records" stops
  at 200 (the page says so).
- **Signed-in page weight wasn't measured.** My estimate is about +1.5 KB per card (tray, heart, and the "…" with its
  no-JS form), so about 330 KB at the heavy fixture's 286 KB, under the 500 KB limit. Measure it in PR-7 or PR-6.
- **DESIGN SW-1 needs the owner's edit.** Its "Reserved gesture: left/right on the default feed means profile" still
  stands. O1 amends it in the feature file, but `docs/DESIGN.md` is owner-only.
- **Deploy note.** The first apply of the stored `trade_key` column rewrites `closed_trades` once under a lock. Later
  applies take no lock.

## e2e `app.spec.ts:959` (PR-1 heavy feed): pre-existing and day-dependent, not PR-4

- **Reproduced on 66a81b9 (:3000).** Page 1 has 29 of 30 heavy cards.
- **Same on the baseline.** On 0666990 (own database with schema and seed only, port 3391), page 1 also has 29 of 30.
  A reverted print shows **card 18 = `dividend_dan`**.
- **PR-4 can't change this list.**
  - The request is signed out, and `loadFeedPage` with no viewer returns `kept.mixed`.
  - PR-4's only change on that path is `ranked` carrying `weight` and `rank`, and `mixFeed` reads neither.
  - The signed-out card markup is unchanged: actions render only for a signed-in viewer, and `data-key` sits on the
    row, outside the `<article>`.
- **Cause.**
  - Since PR-1b (#21), one recent close of every eligible trader outside the 200 candidates joins the exploration pool,
    and the pool's order is seeded by the UTC day.
  - The seed's demo traders have recent closes, so on some days one of them is drawn into page 1.
  - The test assumes only its fixture makes the cards, which is no longer reliably true. It passed on 2026-10-24 (the
    engineer's full run) and fails on 2026-10-25.
- **Proposed minimal fix (test-only, next chore).** Not applied here. I ran it once from a scratch copy against :3000,
  and it passes today: pages 1 to 3 had 29, 30 and 28 heavy cards at 286, 297 and 306 KB raw.
  - What stays as strong or gets stricter:
    - Every page still has 30 cards.
    - A non-fixture card is allowed only for a trader who existed before the fixture.
    - The 500 KB bound is stricter or equal: raw bytes are scaled to a page of 30 heavy cards.
    - The window caps and the 90-distinct check run over all cards.
  - What is now scoped to the fixture's rows: the heavy-only per-row checks (the verified badge, the stand-in chart,
    the handle shown once, and the pane that is opened).

```diff
@@ -989,6 +989,9 @@
     // Pages 1 to 3, each as served (the no-JS link carries the cursor), each under 500 KB raw.
+    // PR-1b reach: a trader that existed before the fixture can be drawn as an exploration pick (seeded by the UTC day).
+    const preexisting = new Set((await made[0].sql`select handle from users where handle !~ '^heavy_feed_[0-9]+$'`).map((r) => r.handle as string));
+    const heavyHandle = (h: string) => /^heavy_feed_\d+$/.test(h);
@@ -997,15 +1000,17 @@
-      const cards = [...html.matchAll(/<article class="card">[\s\S]*?href="\/u\/(heavy_feed_\d+)"[\s\S]*?href="\/t\/([A-Z]+)"/g)].map((m) => ({ handle: m[1], symbol: m[2] }));
+      const all = [...html.matchAll(/<article class="card">[\s\S]*?<\/article>/g)].map((m) => ({ handle: /href="\/u\/([a-z0-9_]+)"/.exec(m[0])![1], symbol: /href="\/t\/([A-Z]+)"/.exec(m[0])![1] }));
+      const cards = all.filter((c) => heavyHandle(c.handle));
@@
-      expect(bytes).toBeLessThan(500_000);
-      expect(cards).toHaveLength(30);
+      expect(all).toHaveLength(30);
+      expect(all.filter((c) => !heavyHandle(c.handle)).every((c) => preexisting.has(c.handle))).toBe(true);
+      expect(bytes * all.length / cards.length).toBeLessThan(500_000); // the page scaled to 30 heavy cards
@@
-      seen.push(...cards);
+      seen.push(...all);
@@ -1026,12 +1031,12 @@
-    for (const w of who) expect(w).toMatch(/^@heavy_feed_\d+$/); // every card is a heavy record
+    for (const w of who) expect(heavyHandle(w.slice(1)) || preexisting.has(w.slice(1))).toBe(true); // a heavy record, or an exploration pick
@@
-    for (const t of await page.locator('.feed .row .who').allInnerTexts()) expect(t).toMatch(/^@heavy_feed_\d+$/);
+    for (const t of await page.locator('.feed .row[data-handle^="heavy_feed_"] .who').allInnerTexts()) expect(t).toMatch(/^@heavy_feed_\d+$/);
@@
-    for (const row of await page.locator('.feed .row').all()) {
+    for (const row of await page.locator('.feed .row[data-handle^="heavy_feed_"]').all()) {
@@ -1040,9 +1045,10 @@
-    await expect(page.locator('.feed .pane figure.chart[data-chart="stand-in"]')).toHaveCount(30);
+    const heavyRows = page.locator('.feed .row[data-handle^="heavy_feed_"]');
+    await expect(heavyRows.locator('.pane figure.chart[data-chart="stand-in"]')).toHaveCount(await heavyRows.count());
@@
-    const row0 = page.locator('.feed .row').first();
+    const row0 = page.locator('.feed .row[data-handle^="heavy_feed_"]').first();
```

Longer term, IMPLEMENTATION's own rule applies: heavy fixtures belong in a database of their own, which for e2e means
a server of their own.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test`, shared DB, 4 runs | 643 tests, 12 skipped (LOAD). Run 2: **631 pass, 0 fail**. Runs 1, 3 and 4: 4 to 5 failures each, all in a `before` hook from the FK race above (pre-existing) |
| `npm test`, scratch DB, base and head alternated × 4 | base: 623 tests, 0 fail each run · head: 643 tests, 0 fail each run |
| `node --test lib/likes.test.ts` alone | 5/5 |
| `node scripts/autopilot.ts guard main` | ok |
| `node scripts/compliance.ts diff origin/main` | ok |
| Product lines | 761 (cap 800) |
| e2e `likes.spec.ts` + `follow.spec.ts` (:3000) | 8 passed |
| e2e `app.spec.ts:959` | fails the same way on 66a81b9 and 0666990 (29/30, `dividend_dan` at card 18); the proposed fix passes |
| Full e2e | not re-run by me; the engineer's fix-round-2 run had 118 passed, 1 failed (959, above), 3 skipped |

## Verdict

APPROVE. The PR meets every reviewer rule, owner decision and acceptance item in scope, and no test was weakened. The
merge carries condition M1: PR-7 (G1) merges next, before real viewers, with the owner's acknowledgement.
