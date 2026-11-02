## What changes
F-35 (`docs/features/F-35-publish-once-the-date-has-passed.md`): a trade is published once its date has passed, never on
the 24-hour grace (amends #62's grace; approval council cycle 5, C5-30).

- **Publish rule.** The rebuild reads rows with `executed_at <= now()` (the transaction's clock) for shares, rename chains,
  options (keyed, loose, exercise days, option pairs) and corporate actions (`lib/sync.ts#published`, `lib/options-sync.ts`).
  `FUTURE_GRACE_HOURS` now bounds only the re-read window (unchanged quarantine distance).
- **Counted while waiting.** Share rows dated ahead stay in `users.excluded_future` (buys and sells, as before); option rows
  get `users.excluded_future_options`; a sell the importer could not price, dated ahead, waits on the same line. The profile
  shows the sum on one muted line, `PROFILE.futureWaiting(n)`: "1 imported trade excluded: dated in the future by the
  broker. It waits on this line until that date passes." The month page (while the month runs) and /me/record show it too.
- **Watermark.** `users.published_through` = the clock of the record's last committed rebuild (`rebuildRecord`, same
  transaction). An insert that stores a row dated ahead lowers it to its own clock (never fills a null).
- **Matured pass** (`lib/sync-shard.ts#maturePass`, every shard run from `/api/sync`, before the workers): one query over
  three partial indexes (`executed_at > created_at`) finds records whose row's date passed since their last rebuild, plus,
  once, records with no watermark that hold a row still dated ahead (the deploy catch-up: closes published early on the
  old grace leave at once, no matcher version bump). Per record: `pg_try_advisory_xact_lock(USER_LOCK)` (busy: next tick),
  `rebuildWithoutRead` (puts `last_synced_at` back: no "Updated" without a vendor read). At most 50 records and 20 s per run,
  oldest matured row first, stops at the deadline, route end or a lost lease. Frozen records included.
- Schema (additive): two `users` columns, three partial indexes.
- Docs: `docs/SYNC.md` "Publish once the date has passed (F-35)", log fields; F-21 hand-off note.
- Merged with main's matcher catch-up (C5-43 b): it rebuilds under the trader's lock with `rebuildRecord`, so it advances
  the watermark like any rebuild; the route runs the matured pass in `runShard` and the catch-up after it.

## Decisions
Recorded in the feature file (dated, with reasons) and the committee record. Highlights: corporate actions follow the
publish rule; a separate option counter, no sells-only counter (F-21 note instead); the line's second sentence describes the
line, not an outcome; no `MATCHER_VERSION` bump (the null-watermark catch-up instead); the pass is opt-in, runs before the
workers within its own box; frozen records publish (TR-5: a loss imported before the freeze is never held back); declined:
splitting buys and sells on the line (ponytail) and a smaller font for the line (it matches its sibling exclusion lines).
The compare tool's card keeps `PROFILE.excludedFuture` (its strings are pinned by `lib/fixes-cycle3.test.ts`) with the summed
count; switching it is a follow-up chore (business lead).

## Testing
- `npx tsc --noEmit` clean; `npm run build` ok; `node scripts/autopilot.ts guard origin/main` ok.
- `npm test` on the branch with main merged (2675fa1, with the matcher catch-up): 2,393 pass, 0 failures; F-24 gate: all 11 `lib/sync-reconcile*.test.ts` green.
- New `lib/f35-publish.test.ts` (18): AC1 (absent from closed_trades/option_trades, the profile reads and the compare card;
  counted), AC2 (first tick after the date, no new activity), AC3 (two ticks, one rebuild, a third none; counted by real
  rebuild calls), AC4 (failed rebuild leaves the watermark; retried), busy lock, scope (frozen publishes a loss with status
  and "Updated" unchanged; deleted, importing, other shard skipped), F-21 (a maturing BUY moves only the future line),
  F-24 (a held sell dated ahead counted once before and after), options, corporate action, unpriceable sell, deploy
  catch-up (shares and options only; thesis kept and returned; nothing-ahead never selected; never twice), insert-side
  lowering (two connections; one rebuild; null stays null), watermark = publish clock, budget (50 slow records: the box
  stops the pass, workers still sync), oldest first, AC7 plan (partial indexes in both branches), AC5 server zone
  (TZ=Pacific/Kiritimati), copy.
- AC6: the existing grace test `lib/sync.test.ts` "fix round 6" keeps every assertion except the two the rule changes:
  `['AAA', 'CCC']` → `['AAA']` and `[1, 0]` → `[2, 0]`; it then moves CCC's rows 13 h back and asserts `['AAA', 'CCC']`.
  Its twin "F-35 twin of fix round 6" covers the waiting +12 h sell published by the first tick. `lib/feed-imported.test.ts`
  dated a late sell `now() + 1 minute` and relied on the grace: it is dated at the insert's `now()` (still after asOf).
  `lib/shared-accounts.test.ts` counts the rebuild's `notShared` uses: 3 → 4 (the unpriceable-sell future count also
  leaves shared accounts out; the guard is stricter, not weaker).
- AC7 at the LOAD shape (`LOAD=1 node --test lib/f35-matured.load.test.ts`, 100,000 traders, 2,000,000 activities, 200,000
  option rows, 20,000 corporate actions, 1% stored while dated ahead; one transaction, rolled back): every scan of the three
  raw tables is a Bitmap Heap Scan over its `*_future_stored` partial index, in both branches; rows read activities 20,000 /
  option rows 2,000 / corporate actions 200 = exactly the future-stored rows; no sequential scan.
- e2e: `e2e/f35-month-today.spec.ts` 9/9 at 360 px, browser zones UTC and Pacific/Kiritimati, light and dark (month page
  "through today", waiting row absent and named, profile line exact text and muted, gone after maturity). Full
  `npx playwright test`: 339 passed, 6 skipped; the one failure (`fixes-labels.spec.ts:242`, the swipe test #105 fixed) and
  the 7 serial tests after it pass on the merged build (20/20 with the F-35 spec).
- Playwright here pins chromium 1248; the container has 1243, used through a scratch `PLAYWRIGHT_BROWSERS_PATH` (no repo
  change).

## Compliance
1. **Performance shown, ranked or described?** When closes show changes (only once dated at or before now); one muted
   line. Disclaimers unchanged; no advice; losses are published like gains (a frozen record's matured loss is tested).
   F3a now holds: no page shows a close dated after today. F3c: every waiting row is counted on its own line.
2. **Personal data?** `users.published_through` (a timestamp) and `users.excluded_future_options` (a count) on `users`
   (SCHEMA_MAP: account retention, deleted with the account). No new public field; the public line shows a count already
   shown. Logs: counts and the internal id only (privacy-logs test).
3. **Money?** No. 4. **Email, push, tracking?** No. 5. **User content?** No (theses kept and re-attached by sell_id).
6. **Sign-up, age, identity?** No. 7. **Vendor, dependency?** None new; `lib/broker.ts` untouched.
8. **Accessibility?** A plain muted paragraph (contrast 5.03:1 light, 5.84:1 dark), no interaction, no horizontal scroll at
   360 px.
9. **Security posture?** Unchanged (the cron route passes `mature: true`).
10. **Claims?** The line states what it is; no promise of publication, no completeness word (tested).

## Known limits (ponytails, each marked in code)
- A matured row the pass misses for more than 8 days waits for the record's next rebuild (never, for a frozen record).
- A vendor timestamp seconds ahead of its insert costs one extra rebuild.
- A matured close's feed import time predates its publication (one tick at most).
- The box and stops are checked before each rebuild (one huge record can overrun them, as syncUser's rebuild can).
- An import running 8+ days after a row's date leaves it to the import's own rebuild.
- The line counts waiting buys and sells together; a matured buy shows no close.
- A vendor-corrected date (a new vendor id) arrives with the account's next activities read (F-14 cadence).

## Owner items
- The amendment of #62's 24 h grace ruling (council-approved, cycle 5).
- The frozen-record ruling: matured rows on a frozen record publish.
- The waiting-line copy (`PROFILE.futureWaiting`).
- Environment, not this PR: `node scripts/compliance.ts` flags `@img/sharp-wasm32`'s licence in this container's
  `node_modules` on main too (an optional dependency npm installs here); an exception is owner-only.
- Follow-up chore (business lead): the compare card to `PROFILE.futureWaiting`, updating its pin.

## Committee record
`docs/features/logs/F-35/` (brief, plan rounds 1–3, `committee-2026-11-01.md`, `committee-2026-11-02-build.md`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8pBJ7edkvbiWmmoxRU
