# Fixes cycle 2 (trust): independent code review

Date: 2026-11-01. Scope: `git diff origin/main...HEAD` at `34fec82` (after the re-scope in `6049e23`). The disclaimer
guard, `lib/disclaimer-routes.ts`, `lib/stock-labels.ts`, the `app/t/**` copy and the ticker `notFound()` are no longer
in this diff, so findings on those files were dropped.

## Verdict

No blocking findings. Four non-blocking findings, listed below.

## What I verified (not just read)

- `npx tsc --noEmit`: clean.
- `npm test` against the local Postgres: 0 failures over three full runs (only the owner's H4 todo is open). One
  earlier run had a one-off failure in a connect/import test whose file this diff does not touch, and it did not come
  back in the three re-runs.
- `lib/visible-users.ts`: I ran `describe()` on a query that nests both helpers. postgres.js 3.4.9 gives
  `... join users u on u.id=t.user_id and "u".deleted_at is null where t.user_id in (select v.id from users v where "v".deleted_at is null) and t.symbol = $1`.
  The fragments nest correctly. `sql(alias)` quotes the alias as an identifier. Parameter numbering is right. The
  inner alias `v` is scoped to its own subquery, so an outer `v` can't clash with it. `lib/visible-users.db.test.ts`
  passes. It only touches its own random-handle users and a random symbol, and cleans up with `delete from users`
  (closed_trades cascades).
- I made a production build of the branch in a scratch copy and ran Playwright with
  `e2e/fixes-cycle2-trust.spec.ts` plus the ticker, compare, search and sitemap tests in `e2e/app.spec.ts`: all
  passed. One run failed `ticker index: lists seeded symbols...`, because parallel fixtures pushed NVDA past the
  index's 100-row cap (155 symbols at that moment). That test passes on its own and the failure has nothing to do
  with this diff. It is an existing race between specs that share the database.
- `app/not-found.tsx`: `/no-such-page-here` and an unknown `/u/<handle>` both return 404 with the title
  `Page not found · Stock Social` and a single `<meta name="robots" content="noindex">`. I checked with both a browser
  user agent and a bot user agent.
- Metadata exports: every new static title is unique, and the fix #21 unit test enforces that.
- `/me/record` and `/me/likes` now use `toneClass`, which reads `tone()`. `toneClass` lives in `app/open-rows.tsx`,
  which is not a `'use client'` module, so calling it from a server component is safe.
- `/me/record`: `demo` means "any row is unverified" (`app/me/record/page.tsx:67`). So the new footer
  "(including demo data)" is correct for both all-demo and mixed records.
- Copy against POLICY: none of the changed strings says "pick", "signal", "every trade" or "only percentages". The new
  share-prompt line lists every `PUBLIC_FIELDS` entry plus handle, display name and reasons. I printed it to check.

## Findings

### 1. Compare page and stock share image still count users whose deletion is in progress (non-blocking)

- `app/t/compare/page.tsx:23` (`from closed_trades t where t.symbol in (...)`, with no visibility filter) and
  `app/t/[symbol]/opengraph-image.tsx:34`.
- `lib/visible-users.ts:1-4` says the rule covers "the stock index and compare, the stock share image" and that
  "every stock query reads it from here". Neither is true at this commit. The test lists these files as
  `PENDING_VISIBLE` with a ponytail note (`lib/fixes-cycle2-trust.test.ts:20`).
- Failure scenario: a trader starts deleting their profile and the vendor step fails, so `deleted_at` is set but the
  rows are kept. `/t/AAPL` now leaves their trades out, but `/t/compare?a=AAPL&b=MSFT` and the `/t/AAPL` share card
  still count them. The same stock then shows two different trade counts and win rates, and the share card keeps
  publishing a deleting user's data.
- This was already the case on main and is a documented deferral, not a regression. Fix: correct the header comment
  in `lib/visible-users.ts` so it describes what is covered today. Better: move the two queries onto the predicate in
  this PR. Each is a one-line change (`and t.user_id in (${visibleUserIds()})`).

### 2. `app/not-found.tsx:4` says invalid ticker symbols get a real 404, but they don't (non-blocking)

- The re-scope removed `notFound()` from `app/t/[symbol]/page.tsx`. Its lines 49 and 75 still render
  "Ticker not found".
- Verified: `GET /t/%3Cscript%3E` returns 200 on this build.
- Failure scenario: a reviewer or the next agent reads the comment, assumes fix #20 covers tickers, and the 200
  "not found" page (a soft 404 for crawlers) stays. Fix: remove "such as an invalid ticker symbol" from the comment,
  or note that the ticker half went to the other branch.

### 3. The fix #19 unit test pins the exact source line in `app/open-rows.tsx` (non-blocking)

- `lib/fixes-cycle2-trust.test.ts:72` asserts the full text
  `export const toneClass = (x: number) => { const t = tone(x); return t === 'flat' ? undefined : t; };`.
- The committee log (`docs/features/logs/fixes-cycle2/committee-2026-11-01.md:54`) says F-19 is moving `tone` to
  `lib/format.ts` in parallel.
- Failure scenario: F-19 merges first and rewrites or moves that line. The behaviour stays the same, but this test
  fails on main or on this PR's rebase. Someone then has to edit the test, which comes close to the "never weaken
  tests" rule. Fix: import `toneClass` and test what it returns (`toneClass(-0.0004) === undefined`,
  `toneClass(-0.0006) === 'down'`). The test already does this for `tone()`.

### 4. The DB test leaves `signup_attempts` and funnel rows behind in the shared database (non-blocking)

- `lib/visible-users.db.test.ts:23-24,40` creates two attempts through `createAttempt`. Each one also writes three
  funnel rows (`lib/auth/attempts.ts:25-27`). The test only deletes the users. `signup_attempts.user_id` is
  `on delete set null`, so the attempt and funnel rows stay as orphans on every run.
- Failure scenario: a later test that counts funnel or attempt rows over a window (no current test does) drifts
  because of this one. The shared database also grows on every CI run.
- Other tests already clean up this way: `lib/follows.load.test.ts:50` and `e2e/follow.spec.ts:168` both run
  `delete from signup_attempts where id = ...` after deleting the users. Fix: keep the two attempt ids and delete them
  in the `finally`, deleting the funnel rows first if their FK has no cascade.

## Simplicity notes (no action needed)

- `visibleUser` / `visibleUserIds` is the right size: one predicate, one subquery form, and a test that both agree
  with `isVisibleUser`. The fix #4 regex check (`sql\`([^\`]*)\``) works because none of the queries nests a
  backtick. The new `PENDING_VISIBLE` guard, which fails once a pending file adopts the predicate, stops the
  exemption list from going stale.
- Adding `'nav'` to `REFERRED_SURFACES` is safe: `referred_surface` has no CHECK constraint, and `legacyVia` still
  maps `nav` to null for the CHECKed legacy column (`lib/referral-nav.test.ts`).
- The `.badge-embed` CSS that was removed has no remaining references in `app/` or `lib/`.
