# Fixes cycle 5: committee record (2026-11-01)

Branch `claude/fixes-cycle5`. Scope: `docs/direction/cycle5-2026-11-01.md` section 5, items F5-2 and F5-4..F5-27
(F5-1 and F5-3 moved to the approval ballot and are not built here). Members, each a fresh-context agent: UX lead
(plan), business lead and engineer (reviewers), tester (QA loop), an independent code reviewer. Shared-file edits are
additive and marked `FIXES-CYCLE5`. Every probe and fixture is fictional.

Every open question below was decided by the committee's recommended option. Why, for each: decided by the committee
under the owner's instruction of 2026-11-01; the reason follows the decision.

## Plan rounds

- **Round 1** (`plan-round1.md`, UX lead). Business lead: OBJECT (15 demands). Engineer: OBJECT (13 demands). The
  orchestrator added one constraint: build now on main, since this session cannot wait on in-flight PRs.
- **Round 2** (`plan-round2.md`, UX lead). It answers all 32 demands with a register (section 1). Business lead: SIGN
  on 6 edits. Engineer: SIGN on 7 edits, and its final work-package lists replace round 2's section 2.
- **Round 3** (this section, orchestrator). It folds in the 13 conditions both reviewers named. Both signed on these
  terms, and no direction changed. Where this section and `plan-round2.md` differ, this section wins.

### Round 3: conditions folded in

1. **F5-2 copy (BL).** The alert has two strings. `FC5.noteChanged`: "Your note was not saved because this trade
   changed." `FC5.noteUnsaved`: "Your unsaved note is below. Copy it before you leave this page." The second shows only
   when the recovery box renders, so with no storage or no JavaScript the alert never points at text that isn't there.
   The e2e tests cover both cases, one with storage blocked and one without.
   Why: decided by the committee under the owner's instruction of 2026-11-01. "Reload and save again" asks for a reload
   that has already happened (the redirect) and for a save that is impossible once the trade has left the record.
2. **F5-2 no-JS (BL).** e2e: with JavaScript off, the URL ends `#note-changed` and the alert is inside the 360 × 640
   viewport. The plan makes no promise that the browser's Back restores the field.
   Why: decided by the committee under the owner's instruction of 2026-11-01. Without JavaScript nothing can move focus,
   and form restore after a POST and redirect varies by browser.
3. **F5-2 recovery box (engineer).** The box stashes text only on the owner's own profile, and stores `{ key, text }`.
   It shows only when the redirect's `n=<trade_key>` equals the stored key. It is cleared once shown and on every other
   load. One delegated `submit` listener inside try/catch does the stashing. The text is never logged and never placed
   in a URL.
   Why: decided by the committee under the owner's instruction of 2026-11-01. A stale stash must never appear under an
   unrelated alert.
4. **F5-5 gate (engineer, resolves BL 3).** The minute bucket is on when `VERCEL_ENV === 'production'` (the signal
   `lib/secret-env.ts` already uses) or when `FEED_BUCKET_MS` > 0, and `FEED_BUCKET_MS=0` turns it off. It does not
   depend on `ALLOW_DEV_AUTH`. A unit test checks that the gate is on for `VERCEL_ENV=production` with
   `ALLOW_DEV_AUTH=1` and off for a local `npm run start`.
   Why: decided by the committee under the owner's instruction of 2026-11-01. This way the fix runs in the real deploy
   and e2e keeps exact clocks without editing the protected `playwright.config.ts`. Tying the gate to the dev-auth stub
   would silently change behaviour the day that stub is removed.
5. **F5-5 clock (engineer).** The database-clock offset sampler is injected and is never called when `opts.now` is
   given. A ponytail records that the cross-server "same list" holds only for committed rows (`activities.created_at`
   is the transaction's start time). The db test "two builds of one key are equal" runs with no sync running alongside.
6. **F5-4 trigger cost (BL 6, engineer 3).** EXPLAIN cannot see inside a trigger function, so the cost is measured
   inside the rebuild transaction with `pg_stat_xact_user_tables` for `closed_trades` (`seq_tup_read + idx_tup_fetch`,
   read after `pg_stat_clear_snapshot()`). While `app.tts_defer` is on, the insert chunks add 0 rows read.
   `finishTickerSums` adds exactly the user's row count (±1 for the index probe), and its statement is also run on its
   own for an EXPLAIN rows-read check.
7. **F5-12 (BL).** The code and the test write the non-breaking space as the escape ` `, and a source scan finds
   no literal U+00A0 in `lib/chart-sub.ts` or in its test.
8. **F5-24 name (BL).** The field's accessible name is `Your note on ${symbol}`, which starts with the visible label
   "Your note" (WCAG 2.5.3) and does not use the word "thesis", which the screen never shows. In e2e,
   `getByRole('textbox', { name: 'Your note on <SYM>' })` matches exactly one field, and the e2e scopes each check to
   one row.
   Why: decided by the committee under the owner's instruction of 2026-11-01. A screen reader should say the words the
   screen shows.
9. **F5-24 link (engineer).** `lib/own-note.ts` builds the link as the window part plus `#note-<trade_key>` through a
   local helper. It never string-replaces on `tradeHref`'s output, so F-23's change to `tradeHref` stays a compile-time
   break and cannot become a silent wrong anchor.
10. **F5-10 (BL, minor).** The builder runs the deterministic seed, reads the months `e2e/record-strip.spec.ts:175-200`
    compares, and records in the build log which branch ships. There is no "either way" ponytail.
11. **`lib/sync.ts:91-93` comment** moves to WP3. It sits beside WP3's `set_config` line, and two packages editing
    adjacent lines would conflict.
12. **F5-25.** It is built: F3-16's ruling covers it. The three test edits are equal-strength: each asserts the role is
    absent on static uses and still present on the live ones. Owner item 7 notes F-27:34.
13. **Work packages.** These replace round 2's section 2. WP0 lands first as one commit, and WP1..WP4 fork from it.
    - **WP0:** the whole `FC5` copy object at the end of `lib/copy.ts`; `lib/bucket-cache.ts` (single flight and a true
      LRU) and its unit test; and the F5-14 line in `docs/process/coordination.md`.
    - **WP1, notes and profile:** F5-2, F5-24, F5-26, F5-11, F5-25. It is the only package that edits
      `app/u/[handle]/page.tsx`.
    - **WP2, sync and ops:** F5-8, F5-15, F5-16, F5-17, F5-18, F5-20.
    - **WP3, ticker:** F5-4, F5-27, F5-13.
    - **WP4, feed, focus and copy:** F5-5, F5-6, F5-7, F5-9, F5-10, F5-12, F5-19, F5-21, F5-22, F5-23.
    - **Deferred:** F5-14, which builds on F-23's (#97) wire format after F-23's 80,000-close re-measure.

## Build, QA, user test and review

(Filled in as each stage completes.)
