# F-7 plan sign-off: engineer

Date: 2026-11-01. Reviewed: `plan.md` (round 3) against my `plan-round2-engineer.md` §4 and the legal conditions.
Process note: this session had no subagent tool, so the build session wrote this review in the engineer's role
(team/engineer.md), from the documents and the code they cite. All names are fictional.

## Round 1 verdict: REVISE

The amendments are right, but they change my §4 schema and size, and the plan does not say how.

### Blocking demands
1. **Re-estimate size and fix the cut list.** Round 3 adds `users.public_filer_id` and its check, the placeholder
   attempt, C2 readers, AC 28-32 (no Follow/Like incl. the feed card, noindex and sitemap, no New-record badge, the
   raw allow-list), the C14 log fields and (from the other members) a dry run: about +50 lines on my 770, so ~820.
   My cut 3 ("stale copy") is now a legal requirement (C10) and can't be cut. New cut order: `/how` section to 15
   lines (−15); operator `hide`/`unhide`/`remove` and `--dry-run` share one script and one argument parser (−15);
   `unhide` dropped (−10). Target ≤ 790; the builder runs `productLines` before each push.
2. **Schema: one pointer, not two.** §4.1 has `public_filers.user_id` and C1 adds `users.public_filer_id`: a
   circular, redundant link. Drop `public_filers.user_id`; `users.public_filer_id` is `unique`, `references
   public_filers on delete restrict` (filer rows are never deleted, removal sets `removed_at`). Replace the §4.1
   comment that calls the attestation columns "the import time" with the C1 placeholder comment.
3. **Placeholder attempt.** One `signup_attempts` row per source, `method 'dev'` (never `'brokerage'`, so
   `boundAttempt` can't pick it up), `adult_attested_at` epoch, `completed_at` and `user_id` null, found or created
   by the importer: `purgeUnfinishedAttempts` deletes it once no filer row points at it, so a later import must
   recreate it. Test: purge with zero filers, then import, succeeds.
4. **Corrections log per C14.** `public_filer_log.action in ('hide','unhide','rebuild','remove')` plus a
   `reason text check (reason in (…))` code; drop `note_id`. AC 23 asserts the reason code.
5. **AC 3 contradicts C16.** Drop "Theses and likes survive by `sell_id`" for filers (there are none); keep the
   percent change on amendment.

### Non-blocking notes
- `lib/display-log.ts` iterates all live users; filers will appear there. Harmless, but check it renders no amount.
- The import stage takes `min(20_000, left())` of the minute tick; with one worker at 250 ms that is ≤ 80 requests
  a tick, ~115k a day, well within a daily index plus new filings.

## Round 2 verdict: SIGN

Round 4 items 9-11 meet demands 1-5. The ≤ 790 target leaves ~10 lines of slack, so the builder measures early
(after the schema, importer and trust branches) rather than at the end.

## Independent sign-off (fresh context)

Date: 2026-11-01. Written by the engineer in a fresh context (not the role-play above). Read: the feature file,
`plan.md` with "Round 4 changes", `plan-round2-engineer.md` §4, `plan-round2-legal.md`. Spot-checked in code:
`lib/delete.ts`, `lib/privacy-purge.ts#purgeUnfinishedAttempts`, `lib/discovery/section.ts#newRecordSlot`,
`lib/feed.ts`, `app/sitemap.ts` with `lib/ticker.ts#buildSitemapEntries`, `lib/session.ts`,
`scripts/autopilot.ts#productLines`, and the `signup_attempts` / `users` schema.

### Verdict: SIGN

Every Round 4 item is buildable as written in one PR, and nothing I checked contradicts the plan:
- **Placeholder attempt.** The purge already keeps any attempt a `users` row points at
  (`not exists (... u.signup_attempt_id = a.id)`) and deletes an unreferenced unfinished one after 30 days, so
  find-or-create is the right call. `method 'dev'` is in the existing check; the epoch sentinel is a valid identifier
  for "the placeholder" (no real attempt can carry it).
- **Removal.** `deleteProfile` already does what C13/C3 need for a vendor-less user (handle reservation, cascade of
  `closed_trades`, no vendor call when `snaptrade_user_id` is null). `public_transactions` hangs off
  `public_filers`, so `remove` must delete it explicitly, as Round 4 item 7 says. `on delete restrict` on
  `users.public_filer_id` does not block deleting the `users` row.
- **New-record slot (AC 31).** `newRecordSlot` already skips `verified === false`; filer closes are `verified:false`,
  so AC 31 is a test, not new code.
- **Sitemap (AC 30).** Profiles are never in the sitemap; ticker entries need verified counts, which exclude filers.
- **Size.** `productLines` excludes tests, `e2e/` and `docs/`, so the fake and fixtures are free. ~790 against 800
  is tight but honest, and the stop-and-flag rule is the right guard.

### Build notes (non-blocking; the builder applies them)
1. `app/sitemap.ts`: add `where filing_url is null` to the aggregate. Without it a filer's close can move a ticker's
   `lastModified` to a filing-derived time while `/t` shows none of those closes. One line; not in §4.2's edit list.
2. Put the "a filer is never signed in" guard in one choke point (`createSession` in `lib/auth/sessions.ts`
   refuses a user with `public_filer_id`), then keep the per-path tests C2 asks for. Cheaper and harder to miss than
   a guard per sign-in path.
3. `remove`: set `public_filers.removed_at` first, then call `deleteProfile`, then delete raw rows and clear the
   fields. `deleteProfile` is two transactions, so an import that runs between them must already see the filer
   as removed.
4. Placeholder lookup: `method = 'dev' and adult_attested_at = 'epoch' and user_id is null and completed_at is null`,
   created under the importer's lock. The purge can race an import (it locks with `skip locked`, then the
   `users` insert fails its foreign key). Keep each filer's create in its own try/catch so a lost race only
   retries that filer on the next tick.
5. Measure `productLines` after the schema, importer and trust branches, not only before the push.
