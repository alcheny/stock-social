# Issue: intermittent `lib/reflections.test.ts` failure (foreign key on `broker_accounts`)

Filed 2026-10-24 by the engineer (F-2 PR-1b fix round 1; business lead demand 6). Severity Low, pre-existing (not
PR-1b). For the next chore PR.

## Symptom

About 1 full `npm test` run in 8 (engineer run 1 of PR-1b; 0 of 4 tester runs, 0 of 3 in fix round 1): the file's 11
tests fail together because its `before` hook raises the `broker_accounts` → `users` foreign-key error.

## Root cause (tester, `test-pr1b-tester.md` §1)

- The `before` hook of `lib/reflections.test.ts` re-applies all of `db/schema.sql` while other test files run in
  parallel (node:test runs files concurrently).
- `db/schema.sql` (lines ~124–127) backfills `broker_accounts` with an `insert … select … from activities`. The F-1
  PR-2a fix filters already-claimed accounts in the same snapshot, but under READ COMMITTED a user deleted by a
  parallel file's `delete from users` can still be in the select's snapshot when the foreign-key check runs; the check
  sees the committed delete and fails.
- Both pieces predate PR-1b (hook: F-1 PR-1; backfill: F-1 PR-2a).

## Proposed fix (next chore PR)

1. Test side (the clean fix): stop re-applying the schema in a parallel `before` hook. The schema is applied once by
   the run's setup (`npm run db:schema` / `scripts/db-setup.ts`); the hook can assert the tables it needs exist instead.
   Nothing is weakened: the same tests run against the same schema.
2. Schema side (defence in depth, idempotent): guard the backfill with
   `and exists (select 1 from users u where u.id = a.user_id)` plus `on conflict do nothing`. This narrows, but does not
   close, the window (a delete can still commit between the check and the insert), so item 1 is the real fix.
3. Verify: 20 consecutive `npm test` runs with no `reflections` failure; test count unchanged.

Not fixed in PR-1b: the smallest test-only change is not a 5-line edit that weakens nothing (the hook's schema step is
shared by other suites), and the schema guard touches `db/schema.sql`, outside this PR's scope.
