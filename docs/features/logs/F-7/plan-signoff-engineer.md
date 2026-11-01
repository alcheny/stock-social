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
