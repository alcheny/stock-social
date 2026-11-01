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
  the transaction is held in a side table, `activity_reissues` (pending, genuine or suspected). Activities stay raw, and
  the rebuild leaves out every held row.
  - Genuine: one vendor response (one pass page or one week read) listed the row and every unheld twin. That is final.
  - Suspected: what a complete pass leaves pending.
  - Rows that arrive together are never held.
  - `importStep` checks each page together with the account's previous import page.
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
- `npm test`, run twice on the final tree (after the orchestrator review fixes and main merged): 2001 tests.
  - The only code-unrelated misses: the existing owner TODO, H4, and the likes timing check (`lib/likes.test.ts`,
    "well under 100 ms"). That check measured 111–167 ms in this freshly restarted container and also misses on a fresh
    database. This PR does not touch likes.
- New tests:
  - `lib/sync-reconcile.db.test.ts`: AC1–AC4, including AC1 over the vendor fake through the real `lib/broker.ts`.
  - `.reissue.test.ts`: AC6 (a)–(l).
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
  - on the final tree, after the orchestrator review fixes: 291 passed, 6 skipped, 0 failed.
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

## Orchestrator review fixes
- **Blocking:** a pair is genuine only when ONE vendor response lists both rows. Before, a pass's union of pages could
  join an original listed before its re-issue with the re-issue listed after, days later, and publish both. A complete
  pass now marks every still-pending row `suspected`. Neighbouring twins share a page through the 50-row overlap. Tests:
  (c) rewritten, (f) reworked, (m) the repro in both variants, each failing on the previous head.
- **Nits:**
  - Import pages are checked with the account's previous import page (test (n)).
  - A pass needs a page limit above the overlap (`passPageLimitOk`).
  - The compliance note above is precise.

## Owner items
- Confirm that held rows (pending or suspected) are kept out of the record and counted for the owner only, so a held
  genuine fill can be absent until its pass decides it (D5's trade-off). See the owner queries in `docs/SYNC.md`.
- AC6 is built for share rows: a re-issued option close can show twice until you decide to hold option twins too.
- The symbol-less row limit needs a `lib/broker.ts` change (raw vendor ids per page).
- CLAUDE.md "Sync paths" (protected) could mention the weekly full-history pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8pUeevKsKbDqz2Rwnt
