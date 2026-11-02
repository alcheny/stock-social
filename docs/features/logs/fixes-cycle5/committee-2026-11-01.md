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
    - **Deferred:** F5-14, which builds on F-23's (#97) wire format after F-23's 80,000-close re-measure. (Un-deferred
      2026-11-02 as WP5 once #97 merged; see "Resumed" below.)

## Build, QA, user test and review

(Filled in as each stage completes.)

### Paused 2026-11-01 (owner instruction via the orchestrator: weekly usage limit; resume after 2026-11-08 ~15:00 UTC)

State at the pause:
- Done and pushed: plan rounds 1-3, signed by the business lead and the engineer; WP0 (the `FC5` copy object,
  `lib/bucket-cache.ts` and its test, the F5-14 coordination line). Main merged through #103.
- Not started in code: WP1 (F5-2, F5-24, F5-26, F5-11, F5-25), WP2 (F5-8, F5-15, F5-16, F5-17, F5-18, F5-20), WP3 (F5-4,
  F5-27, F5-13) and WP4 (F5-5, F5-6, F5-7, F5-9, F5-10, F5-12, F5-19, F5-21, F5-22, F5-23). The builders were still
  reading; only WP2 had a first draft of `lib/fixes-cycle5-sync.db.test.ts`, kept unrun as
  `lib/fixes-cycle5-sync.db.test.ts.wip` (rename it to resume).
- Part 2 (a second PR from main): five items approval council 5 (#103) routed to the fixes lane: MK-P6, C5-41, C5-34,
  C5-4's zero-width split, C5-5's "per closed trade" wording (`docs/ideas/approval-2026-11-01-cycle5.md` → Fixes lane).
  Its plan was not written yet.
- To resume: re-fork WP1..WP4 from this branch with the briefs in the round-3 section (the builder brief is restated in
  the PR session's notes), then QA, the 360 px user test, the independent review, and one PR labelled `feature`.

### Resumed 2026-11-02 (the owner lifted the pause)

Main ca34767 (with #84 F-24, #97 F-23, #103, #104) was merged before the build, and later 1b0dbcc (#105). Owner
decisions of 2026-11-02 taken into the build:
- The F-24 held-sells line is now "N sells excluded while a possible duplicate is checked." (`PROFILE.excludedHeld`).
  Built in WP4; the dated line is recorded in `docs/features/F-24-late-sell-reconciliation.md`.
- Cycle-5 Q2 is accepted, subject to the legal committee: the 18+ tick survives an email error. The legal committee
  confirmed it with conditions A1-A12 (`legal-committee-2026-11-02.md` item 1). It is built as a 30 s, path-`/login`,
  httpOnly cookie, set only on the email-error redirect. It is not a consent record: the attestation is still read only
  from the next submit's field. `proxy.ts` clears the cookie on every other `/login` request, and it has a
  `COOKIE_TABLE` row.
- F5-14 was un-deferred as WP5 because F-23 had merged. It was re-measured on F-23's wire format: an 80,000-close
  fictional profile went from 458,297 to 94,833 bytes (gzip -9 HTML, production build), and the chart JSON alone from
  414,302 to 77,491 bytes.
- The legal committee re-signed the copy: the F5-6 connect line was reworded (except simulated accounts; "No trades are
  imported until …"), and B16 (a true minus) applies to the F5-9 takeaway.
  Why: decided by the committee under the owner's instruction of 2026-11-01; B16 is a binding legal condition. The
  site-wide hyphen stays for the F-19 sweep, as a ponytail in `lib/insights.ts`.

Build: five packages in parallel worktrees (WP1-WP5), each tests-first, each with its own database. All merged into
`claude/fixes-cycle5`.
- The only merge conflicts came from main: #105's `curvePct` beside `cut2`, and `wireCurve` beside the F5-14 import.
  Both were resolved additively, and the chart tests pass.
- Unit suite on the merged branch: 2,462 tests, 2,434 pass, 0 fail, 26 skipped (LOAD), 2 todo (owner items). Main had
  2,249.
- Deviations the builders made and the orchestrator accepted:
  - F5-21: Dismiss is a 44 × 44 "✕" whose accessible name is "Dismiss". The word made the bar 88 px tall at 360 px and
    broke the 94 px room test.
  - F5-4: the "others" side no longer returns a trader count. The page never printed it, and a distinct count can't be
    summed from per-symbol rows.
  - F5-16: the proof test runs each suite in a private schema of its own.

### Independent code review (part 1)

A fresh reviewer read the whole diff (97 files). It found no blocking defect. Protected files are unchanged, the schema
guard is clean, and every edited existing test is equal-strength or stronger.

Should-fix findings, all fixed:
1. F5-18: deletions used the whole call's deadline. They now get their own budget, `DELETION_BUDGET_MS` (two vendor
   timeouts from the stage's start), so the sync stage keeps the rest of the call.
   Test: "F5-18 review: 20 hanging deletions end within the deletion budget".
2. F5-24: a held note's field lost its count from its description, because F4-17's spread overrode it. The combined
   description now comes after the spread, which stays byte-identical. The pinning test is now stricter.
3. The F5-14 records said "deferred": corrected here and in `docs/process/coordination.md`.
4. This section was missing: it is now filled in.

Nits:
5. A later save from the "not saved" page left the alert standing. Fixed: it now redirects to the plain URL. Test added.
6. A deletion cut at the deadline keeps running: ponytail in `lib/delete.ts`.
7. The 60 s totals cache keeps a hidden profile in aggregate counts for at most one bucket. This is noted in
   `app/t/ticker-sums.ts`, and the PR's privacy answer says so.
8. The backfill re-scans when there is no countable row: ponytail in `db/schema.sql`.

## Part 2 (second PR): plan rounds

Scope: five items approval council 5 (#103) routed to the fixes lane (`docs/ideas/approval-2026-11-01-cycle5.md` →
Fixes lane): MK-P6, C5-41, C5-34, C5-4's zero-width split, C5-5's "per closed trade" wording. Legal committee:
`legal-committee-2026-11-02.md` §3 (C1-C16) and its addendum on the short strip wording (C17-C20).

- **Round 1** (`plan-part2-round1.md`, UX lead). Business lead: SIGN on 8 demands. Engineer: OBJECT on 5 demands plus
  build conditions. No direction changed, so the orchestrator folds both reviews in here as round 2. Where this section
  and the round-1 plan differ, this section wins.

### Round 2: conditions folded in
1. Short strip wording: the legal committee re-signed "‹avg› per closed trade" (C17-C20), which closes BL 1 and
   removes §6's open item.
2. Post-connect prompt (BL 2). e2e at 360 × 640: with the prompt's heading scrolled into view, "Share my record" is
   fully inside the viewport. If it isn't, cap the prompt's preview (for example `max-width: 240px`); never move the
   button.
3. One zero-width rule (BL 3, engineer 3).
   - `zeroWidth` takes the surface's `digits`, and a source test checks every range-printing `pct(low)`/`pct(high)`
     pair against it.
   - The options line (`lib/options-view.ts`) goes through the rule as well (C11: every surface).
   - `baselineKind` (`lib/ticker.ts`) uses the shown evidence, so a zero-width side never reads `data-kind="shown"`.
   - The C10 test gains a near-boundary fixture.
   - e2e: the zero-width fixtures read "Too early to tell" on both the month page and the profile.
   Why: decided by the committee under the owner's instruction of 2026-11-01. One rule must hold on every surface that
   prints a range, or one page says "+1% to +1%" while another says "Too early to tell".
4. Record tools (BL 4). e2e on `/tools`: a demo record's card shows the Demo badge, and every card shows its loss
   figures (win rate and lowest).
5. The C5 allow-list (BL 5) is pinned by file and enclosing function, never by line number. A test asserts that no
   `app/` server action imports those functions except whole-profile deletion.
6. Card redundancy (BL 6). The zero-width card says "too early" once: it keeps the trust line and drops the duplicate
   evidence word, and a test checks the visible card text holds "too early" exactly once.
7. Placeholders (BL 7). The C3 line carries the real date, and the worst case prints a true minus ("≈−100.0%").
8. Owner flag (BL 8). "Based on 4,731 trades. Too early to tell." goes to the owner as a question for the 2.32 session.
   Part 2 changes no build for it. Not part 2's scope: the business lead suggests "average per closed trade so far" on
   the card, so that card and strip agree.
9. `lib/confidence.test.ts:139` (engineer 1). This test is the only coverage of the grouped verdict branch. It keeps its
   original regex on a new grouped fixture with a real spread. The zero-width string becomes an extra assertion beside
   it, and other fixtures that are the only path of a branch are treated the same way.
   Why: decided by the committee under the owner's instruction of 2026-11-01. Never weaken an existing test.
10. C5-34 queries (engineer 2). One owner render gains no query: either `optionHeadline` becomes a per-request read, or
    one card model per request feeds both the unfurl and the square alt. A DB test counts the queries of one owner
    render before and after.
11. Naming (engineer 4). The short strip key is `RECORD_STRIP.perClosedShort`, not `perClosedTrade`, which already
    names the card's "average per closed trade". The key is added to `lib/record-strip.guard.test.ts`'s list.
12. Overlaps (engineer 5).
    - #100 also edits `lib/record-tools.ts` and `lib/display-log.ts`: re-run their tests after merging.
    - #102 (f25) edits `lib/f10-feed-card.test.ts` and `e2e/record-strip.spec.ts`.
    - Part 1's WP4 edits `e2e/record-strip.spec.ts`, `lib/copy.ts` and `lib/recap.ts`, and WP3 rewrites the `/t` sums,
      so the `/t` e2e runs after WP3 merges.
13. Build (engineer 6). Part 2 builds now on `claude/fixes-cycle5-part2`, forked from `claude/fixes-cycle5` after WP1
    merged (so the `page.tsx` wiring is built directly). The `/t` e2e and the `.db` suites run again after WP3 and WP4
    merge. Before the PR, part 2 merges `claude/fixes-cycle5`; it never rebases, per the build rules. The PR targets
    `claude/fixes-cycle5`'s PR, or `main` once PR 1 merges.
