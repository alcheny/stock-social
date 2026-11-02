# F-47 · Preference data deleted after 90 days

Status: blocked
Blocked: development paused by the owner 2026-11-02 (resume: set back to ready)
Start conditions: rebases on F-16/F-17 (#100), which edits `lib/privacy-retention.ts`, `lib/discovery/activity.ts` and
`lib/likes.ts`. The copy and retention-table lines land with the Privacy Policy draft (L-1).

## Why
The F-2 implicit activity log and like and reject events are kept until cleared or the account is deleted
(`lib/discovery/purge.ts:6`, `:27-30`; `lib/privacy-retention.ts:47-54`). Ordering reads only the last 90 days
(`lib/discovery/activity.ts:14`). POLICY P3 says store the minimum. Owner decision 2026-11-02 (OD 2.13, accepted en
bloc; BR:566-575); it supersedes F-2's earlier keep-until-cleared decision. Committee check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: Deleted 90 days after the event, by the housekeeping job within its deadline, on database time: the
  implicit activity log (`discovery_events`, clock: recorded time), `trade_likes` (clock: liked time) and
  `trade_exclusions` rejects (clock: time set or expired). /me/likes therefore lists only the last 90 days. Follows
  and active hides are not touched. Why: the owner accepted OD 2.13 on 2026-11-02; engineer review (name each table
  and its clock).
- 2026-11-02: `PREFERENCE_DATA` copy, `lib/privacy-retention.ts` and /how say "deleted after 90 days"; the Privacy
  Policy states how long backups keep rows past that. Implicit logging stays off by default (OD 2.14). Why: legal
  committee condition; OD 2.14.

## Acceptance criteria
- [ ] For each named table, a 91-day-old row is deleted and an 89-day-old row stays (DB boundary test on database time).
- [ ] Ordering output for a fixture is unchanged by the purge.
- [ ] Follows and active hides survive; /me/likes shows only the last 90 days (tests).
- [ ] The purge stops at the housekeeping deadline and resumes next run.
- [ ] Copy and the retention table say "deleted after 90 days" (copy test); any schema change is additive.

## Out of scope
- Other retention periods (F-15's 120 days stay).

## Open questions
- None.

## POLICY notes
- P3. A retention rule the owner decided (POLICY H).

## Rework notes

## Build log
