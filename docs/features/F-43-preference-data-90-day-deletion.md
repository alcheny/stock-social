# F-43 · Preference data deleted at 90 days

Status: ready
Start conditions: none; it edits `lib/discovery/purge.ts` and the housekeeping job.

## Why
The F-2 implicit activity log and expired like and reject events are kept until cleared or the account is deleted
(`lib/discovery/purge.ts:6`, `:27-30`; `lib/privacy-retention.ts:47`, `:54`). Ordering reads only the last 90 days
(`lib/discovery/activity.ts:14`), so older rows serve nothing. POLICY P3 says store the minimum. Owner decision
2026-11-02 (OD 2.13, accepted en bloc; BR:566-575). This supersedes F-2's earlier indefinite-storage decision.

## Decisions
- 2026-11-02: The implicit activity log and expired like and reject events are deleted 90 days after they were
  recorded (or expired), by the existing housekeeping job within its deadline. Follows and active hides are not
  touched. Why: the owner accepted OD 2.13 on 2026-11-02; POLICY P3.
- 2026-11-02: `PREFERENCE_DATA` copy, `lib/privacy-retention.ts` and /how say 90 days. Implicit logging stays off by
  default and only the owner turns it on (OD 2.14). Why: the same decision; OD 2.14.

## Acceptance criteria
- [ ] Rows 91 days old are deleted; 89-day rows stay (DB boundary test on database time).
- [ ] Ordering output for a fixture is unchanged by the purge (it read only 90 days).
- [ ] Follows and active hides survive the purge (test).
- [ ] The purge stops at the housekeeping deadline and resumes next run (existing pattern; test).
- [ ] The retention table and copy say 90 days (copy test); the schema change, if any, is additive.

## Out of scope
- Other retention periods (F-15's 120 days stay).

## Open questions
- None.

## POLICY notes
- P3 store the minimum; deletion here is a retention rule the owner decided, not an agent decision (POLICY H).

## Rework notes

## Build log
