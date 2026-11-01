F-24 · Late-posted trades reach the record (insert-only reconciliation)

Feature: `docs/features/F-24-late-sell-reconciliation.md` (now `Status: built`). Prerequisite F-14 merged as #64
(44a134b). Committee record: `docs/features/logs/F-24/committee-2026-11-01.md`; plan: `docs/features/logs/F-24/plan.md`.

## What changes
- **A periodic full-history read per account (a "pass")** finds rows the vendor posted with a trade date older than the
  7-day re-read window (`lib/reconcile.ts`, `lib/sync.ts#syncUser` under `cadence`).
  - A pass runs every 7 days per account, one vendor page per due daily activities read, in place of that day's week
    read. Vendor requests per account per day are unchanged (F-14's budget).
  - A later page waits at least 47 h, so a multi-page account's daily reads go page, week, page, week.
  - The cursor is on `broker_accounts`, written inside the sync's transaction, and resumes across runs.
- **Insert-only:** inserts stay `on conflict (source, external_id) do nothing`. No raw row is updated or deleted, and
  closes change only through `rebuildTrades`/`rebuildRecord`.
- **Re-issues (D5):** a newly stored row whose account, symbol, side, time, units and price equal a row stored before
  the transaction is held in a side table, `activity_reissues` (pending, confirm, genuine or suspected). Activities stay raw, and
  the rebuild leaves out every held row.
  - Genuine: one vendor response (one pass page, one week read or one import page) decides by count. Per twin group,
    at most k − p listed held rows are cleared, where k is the rows listed and p the unheld rows, oldest first. The
    record keeps as many fills as the vendor lists. A read of a full vendor page or more decides nothing. Final.
  - Confirm: a complete pass listed the row and its twins, but never on one page. The account's next daily read is
    widened to the twins' trade date (one call, inside F-14's budget), and it decides.
  - Suspected: what no single read could clear. Held and counted; a later pass can re-examine it.
  - Rows that arrive together are never held. Import pages overlap by up to 50 rows, so neighbouring twins share a
    page.
- **Complete pass:**
  - Each later page overlaps the previous one by 50 rows, and exactly 50 shared vendor ids must come back.
  - Every listable row stored before the pass must be listed, except held rows and their twins.
  - A stable shortfall (the same missing ids as the previous pass) also decides.
  - Invalid and abandoned passes are counted (`broker_accounts.reconcile_invalid`) and logged.
  - A page step that fails twice (code errors count; outages, rate limits, timeouts and route cuts don't) gives the pass
    up, and the week is read instead.
- **Close-change count (D4):** every `rebuildRecord` compares share and option closes by id and row hash. Changed or
  removed closes that were already shown add to `users.closes_rewritten` and log one counts-only line.
- **No visible change (D6):** a found close renders like any close, and its thesis stays attached by `sell_id`. No file
  under `app/` changes.
- **TR-4 / "Updated":** a multi-page pass's page uses the positions-only rule and keeps `last_synced_at` (F-14's
  `midBackfill`). A one-page pass that returns everything counts as the week read.
- **Schema:** additive and idempotent (columns on `broker_accounts`, `users` and `sync_read_marks`; table
  `activity_reissues`). There is no volatile default: the first due date is staggered in code, on the account's hashed
  weekday, never within 7 days of its claim.
- **Docs:** `docs/SYNC.md` has a new "Late postings (F-24)" section with the log lines and the owner's SQL queries.

## Decisions taken by the committee
Recorded in the feature file's Decisions and in the committee log (UX lead, business lead, engineer and reliability
reviewer; 3 planning rounds, all signed):
- 7-day period, alternating pages, hash-weekday stagger.
- pending/genuine/suspected in a side table; genuine is final; twins stored before F-24 are not swept.
- Completeness by overlap plus a set check; a stable shortfall decides; invalid passes are counted.
- The failure rule.
- The close-change count in `rebuildRecord`, as a counter plus a log line.
- Option twins counted, not held (owner item).
- TR-4 and "Updated" through F-14's existing rules.

## Testing
- `npx tsc --noEmit`: clean.
- `npm test`, run twice on the final tree (after the third orchestrator review, with main at 1eab2ef merged): 2268
  tests.
  - First run: one miss, an auth link test (`lib/auth/links.test.ts`, claimLink). It passed 3 times in a row on its
    own, and F-24 does not touch it.
  - Second run: 0 failures.
  - Earlier runs on this branch also saw main's likes heavy check (`lib/likes.test.ts`) miss intermittently, on a fresh
    database with main's own code too. This PR does not touch likes.
  - The existing owner TODOs (H4, F-20 OQ-2) show as "not ok" in both runs.
  - `lib/sync-test-hours.test.ts` (#90) passes; no F-24 test file calls `runShard` or names `sync_read_counts`.
- New tests:
  - `lib/sync-reconcile.db.test.ts`: AC1–AC4, including AC1 over the vendor fake through the real `lib/broker.ts`.
  - `.reissue.test.ts`: AC6 (a)–(n).
  - `.confirm.test.ts`: committee option C and the reviewer's R1/R2 (each failing on dc08182).
  - `.count.test.ts`: the third review's RA1, RA2, RB, RC (each failing on 61898e3) and the savepoint invariant.
  - `.log.test.ts`: AC5 and the log shapes.
  - `.copy.test.ts`: AC7, rendering the real Profile, TradePage and TradeCard.
  - `.review.test.ts`: code-review regressions; each one fails on the pre-fix commit.
  - One test added to `lib/sync-cadence.tr4.test.ts`, and `e2e/f24-found-close.spec.ts` at 360 px.
- `BASE_REF=main node scripts/compliance.ts auto`: exits 1 locally with exactly one violation, the license of
  `node_modules/@img/sharp-wasm32` (an optional native dependency this container installed). It is not in this diff:
  this PR changes neither `package.json` nor the lockfile. CI's `static` job runs the same check and is green.
- `node scripts/autopilot.ts guard origin/main`: ok.
- `npm run build`: ok.
- Full `npx playwright test` (one worker) on a fresh seeded database:
  - before the review fixes: 291 passed, 6 skipped, 0 failed;
  - after the first orchestrator review: 291 passed, 6 skipped, 0 failed;
  - after the second review (main at 63f48f4): 314 passed, 6 skipped, 0 failed;
  - on the final tree (third review, main at 1eab2ef): 316 passed, 6 skipped, 0 failed.
- Heavy use, per the tester: about 20–40 ms more per sync for a trader with 5,000 activities, within run-to-run noise
  next to the rebuild.

## Compliance
1. **Performance shown, ranked or described?** The display is unchanged. Records become more complete: a late close,
   loss or gain, joins the record and its stats like any close, and losses are ranked the same (tested). Held rows are
   only possible re-issues, counted for the owner. No close already shown is pulled by this rule.
2. **Personal data?**
   - New `activity_reissues` (vendor activity ids, account id, state) is deleted with the profile (cascade) and is in
     SCHEMA_MAP.
   - The `broker_accounts` pass columns (vendor activity ids of a running pass) are cleared when the pass ends or the
     account stops being read.
   - `users.closes_rewritten` and `sync_read_marks.reconcile_failures` are counts.
   - Logs carry the internal id and counts or a reason only, never an account id (POLICY P6). The shapes are pinned by
     tests and pass the privacy-logs scan.
3. **Money?** No.
4. **Email, push, tracking?** No.
5. **User content?** No; theses stay attached by `sell_id`.
6. **Sign-up, age, identity?** No.
7. **Vendor, dependency?** None new. `lib/broker.ts` is unchanged; it uses the existing `fetchActivitiesPage` within
   F-14's per-account limit.
8. **Accessibility?** No UI change.
9. **Security posture?** Unchanged.
10. **Claims?** None. No "late", "corrected" or "new" wording; the docs state the limits.
11. **Checkout?** No.

## Known limits (ponytails, each marked in code)
- A pass of a k-page history takes about 2k days (`RECONCILE_PAGE_GAP_MS`). Fix: the vendor's written answer on
  history pages (MR-1).
- Twins stored before F-24 are not swept (`markTwins`).
- Genuine is final: a later vendor cancel keeps both rows (`markGenuine`; owner Q3).
- Option twins are counted, not held (`optionTwins`).
- "Updated" can lag by up to a day across accounts on page days (`lib/sync.ts`).
- A vendor row with an id but no symbol inside the overlap ends that account's multi-page passes `shifted` every time
  (`recordPage`). The fix needs `lib/broker.ts`.
- A trader whose every connection is frozen keeps a running pass's ids (`dropUnread`).
- The close snapshot is taken on every rebuild, not gated (`rebuildRecord`).
- Only the cadence sync makes the widened confirm read: under `syncTick` a `confirm` row stays held until a cadence sync
  (`confirmFrom`).
- The widened read pages internally by 1,000 rows with no overlap, so a list shift inside that call can leave a genuine
  row suspected until the next pass (`lib/sync.ts`; the fix needs `lib/broker.ts`).
- The budget charge for a widened read applies even on a day the account isn't due, so it runs high, never low
  (`dueRequestsSql`).
- "Twins sorted by trade date are neighbours" is an unverified vendor assumption (`recordPage`). The confirm read is
  correct either way.

## Orchestrator review fixes
- **Blocking:** a pair is genuine only when ONE vendor response lists both rows. Before, a pass's union of pages could
  join an original listed before its re-issue with the re-issue listed after, days later, and publish both. A complete
  pass now marks every still-pending row `suspected`. Neighbouring twins share a page through the 50-row overlap. Tests:
  (c) rewritten, (f) reworked, (m) the repro in both variants, each failing on the previous head.
- **Nits:**
  - Import twins split across two pages (superseded in the second review: import pages now overlap and are checked
    one at a time; test (n)).
  - A pass needs a page limit above the overlap (`passPageLimitOk`).
  - The compliance note above is precise.

- **Second review (BLOCK on dc08182):**
  - F1: the import's previous-page union could join a re-issue across a backoff of an hour or more. Fix: import pages
    overlap and are checked one at a time; `imported_count` counts new rows only. Test: R1, four variants.
  - F2: the committee chose option C, recorded in the feature file and the committee log. A genuine identical fill
    listed far from its twin is no longer held forever (R2), at no request beyond F-14's caps.
  - F3: the first full read is checked page by page.
  - Found while re-running the suites: "rows stored by this transaction" is now its transaction id (`xmin`), not
    `created_at = now()`. Two concurrent import steps could start in the same microsecond, so one could count the
    other's rows as its own, in the twin check and in the import count. The import concurrency test caught it.
  - Since #85 split the trade page's figures and note into two sections, the AC7 checks cover both.

- **Third review (BLOCK on 61898e3, M1):**
  - M1: one response now clears held twins by count (at most k − p per twin group, oldest first), so a re-issued
    original can't hide a genuine late twin. Tests: RA1, RA2.
  - L1: a `fetchActivities` call of a full vendor page or more decides nothing. Test: RB.
  - L2: the widened read's budget counts every row kind. Test: RC.
  - L3: a static test pins "no savepoint around these inserts" (the `xmin` rule depends on it).
  - Nit: the retention text names the failure counters.

## Owner items
- Confirm that held rows (pending, confirm or suspected) are kept out of the record and counted for the owner only, so a held
  genuine fill can be absent until its pass decides it (D5's trade-off). See the owner queries in `docs/SYNC.md`.
- AC6 is built for share rows: a re-issued option close can show twice until you decide to hold option twins too.
- The symbol-less row limit, the widened read's page overlap and per-page id lists for multi-page reads (L1: such a read
  decides nothing today) need a `lib/broker.ts` change.
- `users.closes_rewritten` also counts closes that main's deploy-time matcher rebuild (#89, once per `MATCHER_VERSION`)
  rewrites (D4: every rebuild). Unchanged records add nothing. A cause column would separate matcher-driven from
  vendor-driven rewrites if you want them exposed apart.
- For an old confirm date, the widened read is in effect a whole-history read in one sync: the burst the pass's pacing
  avoids while MR-1 (the vendor's answer on history pages) is open.
- CLAUDE.md "Sync paths" (protected) could mention the weekly full-history pass.
- A true re-issue whose original the vendor still lists in one read is published twice (D5's own "lists both" rule)
  until the corrections question (cycle-3 Q3) is decided.
- Vendor question: the activities list order, its stability across offsets, and what `startDate` filters on (feature
  file Open questions).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8pUeevKsKbDqz2Rwnt
