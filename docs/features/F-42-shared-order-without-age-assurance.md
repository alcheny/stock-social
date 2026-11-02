# F-42 · One shared feed order without age assurance

Status: blocked
Blocked: development paused by the owner 2026-11-02 (resume: set back to ready)
Start conditions: rebases on F-16/F-17 (#100), which edits `lib/feed.ts`. Must be deployed to production before
2027-01-01.

## Why
Two state laws on minors and feeds take effect on 2027-01-01 and 2027-01-25 (K18; F-2:150-153; F-16:143-144). The
product asks for an 18+ attestation but performs no age assurance. Signed-in viewers get a personalized order by default
(`users.personalize_feed` default true, `db/schema.sql:478`; `lib/feed.ts:507`), and follows and likes reorder their
feed (`lib/copy.ts:746`). Owner decision 2026-11-02 (OD 2.23, accepted en bloc): viewers without age assurance get a
non-personalized or follows-only order; no age-assurance build now. Committee check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: While no age assurance exists (a code constant `ageAssured = false`, no schema flag), every viewer gets
  the shared order, minus traders the viewer chose to hide. Follows and likes no longer reorder the feed; no implicit
  signal is used. Personalized ordering stays built behind the constant. The 18+ tick, the sign-up confirmation or a
  user setting never sets it; only an owner-chosen method recorded in DECISIONS can. No date of birth, ID or age
  estimate is collected. Why: the owner accepted OD 2.23 on 2026-11-02 (business lead's recommendation; the shared
  order alone meets "non-personalized or follows-only"); legal committee conditions.
- 2026-11-02: The personalize setting is replaced by the line "The feed is in the same order for everyone, except
  traders you hide." on `app/me/personalize` and wherever the feed links to it; no control that does nothing stays.
  This feature owns the rewrite of `lib/copy.ts:746`; no other item edits that string in parallel. No copy names an
  age group. Why: UX, business lead and legal reviews (a switch that does nothing misleads); POLICY P4.
- 2026-11-02: No follows-only view is built now (new scope; the decision is met without it). Why: business lead and
  engineer reviews.

## Acceptance criteria
- [ ] A signed-in viewer with `personalize_feed` true gets the signed-out order minus their hides (fixture test); follows
      and likes do not change it.
- [ ] The personalized path runs only when `ageAssured` is true, which it is nowhere (test); no code path sets it.
- [ ] `app/me/personalize` and the feed note show the pinned line and no toggle (render + e2e, keyboard).
- [ ] No new personal field (schema diff check); copy names no age group (scan).

## Out of scope
- Age assurance itself; a follows-only view.

## Open questions
- Owner: the K18 age-assurance method stays the owner's call; this is the default until one is chosen.

## POLICY notes
- P4, F1a.

## Rework notes

## Build log
