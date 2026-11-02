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
