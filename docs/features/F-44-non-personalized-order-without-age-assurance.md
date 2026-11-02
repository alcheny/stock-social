# F-44 · Non-personalized order for viewers without age assurance

Status: ready
Start conditions: must be on main before 2027-01-01. Rebases on F-16/F-17 (#100), which edits `lib/feed.ts`.

## Why
Two state laws on minors and feeds take effect on 2027-01-01 and 2027-01-25 (K18; F-2:150-153; F-16:143-144). The
product asks for an 18+ attestation but performs no age assurance. Signed-in viewers get a personalized order by
default (`users.personalize_feed` default true, `db/schema.sql:478`). Owner decision 2026-11-02 (OD 2.23, accepted en
bloc): viewers without age assurance get a non-personalized or follows-only order; no age-assurance build now.

## Decisions
- 2026-11-02: Every viewer without age assurance, which today is every viewer, gets the shared (non-personalized)
  order by default, minus their own hides, with an optional follows-only view. Personalized ordering stays built and
  can be turned on only once age assurance exists. No date of birth, ID or age estimation is collected. Why: the
  owner accepted OD 2.23 on 2026-11-02 (business lead's recommendation; MKT2:522).
- 2026-11-02: /how and the personalize setting say plainly why the order is shared ("the feed is in the same order for
  everyone"), with no mention of age cohorts. Why: POLICY P4 (no mention of minors), F1a.

## Acceptance criteria
- [ ] With no age assurance recorded, a signed-in viewer with personalization on gets the same order as signed out
      minus their hides (test over a fixture).
- [ ] The follows-only view lists only followed traders' records, in the shared order (test).
- [ ] No new personal field is collected (schema diff check: additive flag only if needed, no birth date).
- [ ] The personalized path is reachable only behind an `ageAssured` check that is false everywhere today (test).
- [ ] Copy names no age group (scanner and test).

## Out of scope
- Building age assurance (owner decision required first).

## Open questions
- Owner: the K18 method stays the owner's; this feature is the default until one is chosen.

## POLICY notes
- P4, F1a.

## Rework notes

## Build log
