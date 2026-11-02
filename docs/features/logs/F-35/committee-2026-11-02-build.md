# F-35 build record, 2026-11-02 (QA, user test, review)

## Build
Tests first (`lib/f35-publish.test.ts`, 14 tests at first run, then the code). Full `npm test` green; LOAD EXPLAIN
(`lib/f35-matured.load.test.ts`, 100,000 traders, 2,000,000 activities): every scan of the three raw tables is a bitmap
scan on its `*_future_stored` partial index, in both branches; rows read 20,000 / 2,000 / 200 = exactly the
future-stored rows (activities / option rows / corporate actions); no sequential scan. e2e 9/9 (UTC and
Pacific/Kiritimati, light and dark, 360 px).
Rule-driven amendments of existing tests: `lib/sync.test.ts` fix round 6 (`['AAA','CCC']` → `['AAA']`, `[1,0]` →
`[2,0]`; every other assertion kept; CCC then published once its date passes); `lib/feed-imported.test.ts` (a late sell
dated `now() + 1 minute` relied on the old grace: dated at the insert's `now()`, still after asOf).

## UX lead user test (360 px; compliance FAIL on F3c, usability FAIL)
F3a PASS in all 12 waiting renders; copy, losses, disclaimers PASS; contrast 5.03:1 light, 5.84:1 dark; no scroll.
Demands and answers:
- F3c: the month page names the waiting rows while the month runs → taken (`[data-excluded-future]`, muted small, only
  when `monthSoFar`; e2e asserts it before maturity and its absence after).
- /me/record names them for the trader → taken (a sentence in the page's muted foot, `[data-excluded-future]`).
- Count buys and sells apart → declined: `excluded_future` has always counted buys and sells as "imported trades"
  (pinned copy); a split needs the sells counter the business lead had removed in round 1. Ponytail recorded.
- Same size as the "Record since" lines → declined: the line matches its sibling exclusion lines (plain `muted`), which
  is the group the business lead asked it to sit in.

## Independent code review (no blocking findings)
Verified clean: the publish predicate on every rebuild read agrees with the counters and the watermark clock; every
insert path and lock-waiting rebuild takes USER_LOCK first, so a rebuild never waits behind an insert with a later
clock; lowering never fills a null; the query's shard filter, scope, dedupe, order and limit; maturePass (try-lock,
stops, counters, null last_synced_at restore); additive schema; log privacy.
1. should-fix, taken: an unpriceable trade sell (corporate_actions reason 'trade') dated ahead was counted nowhere
   while it waited (main's grace had counted it in excluded_corporate). It is now counted on the future line (same
   stored-first and paper/shared rules as loadCorporateActions), and moves to excluded_corporate once its date passes.
   Test added.
2. nit, taken: lib/sync.test.ts's twin gets its own shard range (41..99).
3. nit, taken: the budget test moves off of = 2 (driven by e2e/sync-shards.spec.ts) to of = 5, cleaned up with the
   file's shard counts.
Note (no change): a record with a matured row and a null watermark is counted as `matured`, not `maturedInitial` (the
due branch wins the dedupe); the rebuild is the one it needed.

## Tester QA (pass, no blocking findings)
Ran green: f35-publish, sync.test (32), all 11 sync-reconcile* files (70, the F-24 regression gate), 6 sync-cadence*
(37), 11 options* (77), corporate-actions* (49), sync-shard (16), copy, privacy-logs, feed-imported. Own edge script
(own tagged users, deleted): a +50 h sell over three ticks publishes once; a paper-account future sell never counted,
one harmless rebuild; undated option rows published, never future, never selected; a row dated exactly at the
rebuild's now() publishes then and never enters the index; a null-watermark record with only a future BUY: one initial
then one matured rebuild, excluded_positions untouched; an older waiting transaction's insert lowers the watermark.
1. should-fix, taken: matured records ordered oldest matured row first (was by id), so a busy shard never strands the
   same records past the 8-day bound; test added.
2. note, taken: the rule "every writer and rebuild holds USER_LOCK" stated at lib/sync.ts#lowerWatermark (an unlocked
   rebuild could pass a row another open transaction has not committed; every production path holds it).
3. note, decided: the compare card keeps `PROFILE.excludedFuture` (pinned by lib/fixes-cycle3.test.ts) with the summed
   count; the profile, month page and /me/record carry `futureWaiting`. Intended: the compare tool is the signed-in
   viewer's tool, and its exact strings are an existing test's.
4. note: e2e re-run at HEAD after the rebuild (below).
5. note, ponytail: the box and stops are checked before each rebuild (a statement_timeout would cap one huge record).
6. note, ponytail: an import running 8+ days after a row's date leaves the row to the import's own rebuild.

## Business lead user test: compliance PASS, usability PASS
F3a and F3c hold on every waiting screenshot; the copy promises nothing; losses untouched; conditions (a)-(c) met by
the deploy catch-up and insert-side tests and the e2e (exact text, muted, absent after maturity). Agrees with both
declined UX demands. Caveat: the month page and /me/record lines rest on the e2e assertions (added after the
screenshots). Non-blocking follow-ups (a separate chore): the compare card to `PROFILE.futureWaiting` with its pin in
lib/fixes-cycle3.test.ts updated to the new string; the waiting-buy wording once F-21's sells-only count exists.
