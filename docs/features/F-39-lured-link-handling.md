# F-39 · A finished connect link never signs a browser in

Status: ready
Start conditions: none; it edits `app/connect/done/route.ts` and adds copy.

## Why
Finishing a connect link signs the browser that opened it into the account (`app/connect/done/route.ts:36-40`,
case `signin`). Someone could send a trader a link and end up signed in as them. Owner decision 2026-11-02 (OD 2.16,
accepted en bloc; BUS:527; SEC:20).

## Decisions
- 2026-11-02: When a connect link finishes in a browser with no session, no session is created. The page says "These
  accounts are on @‹handle›'s record. Sign in with the method you used before." with a sign-in link, and the
  connection created by the link is declined and cleaned up on the vendor side and in the database. Why: the owner
  accepted OD 2.16 on 2026-11-02.
- 2026-11-02: When a session exists and belongs to the account the link was made for, the connect finishes as today.
  When the session belongs to someone else, it is the signed-out case above. Why: the same decision.

## Acceptance criteria
- [ ] A signed-out finish creates no session cookie and no `sessions` row (DB + e2e).
- [ ] It shows the line with the handle and a sign-in link; the handle is the only account detail shown.
- [ ] The connection made by the link is removed from the vendor (vendor fake receives one delete) and no activity is
      stored for it; a retry is idempotent.
- [ ] A finish with another user's session behaves like signed out; a finish with the right session connects (tests).
- [ ] No log line holds the account id together with a user id (POLICY P6 scan).

## Out of scope
- Changes to protected `lib/session.ts` (security patch 3.11 is the protected-files session's).

## Open questions
- None.

## POLICY notes
- P6 logging rule; F5 read-only connections; R-section posture: no session from a link alone.

## Rework notes

## Build log
