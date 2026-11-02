# F-37 · A finished connect link never signs a browser in

Status: ready
Queued: development paused by the owner 2026-11-02 (relayed by the orchestrator); not built until the owner resumes development.
Start conditions: none. One builder; not in the connect-consent slot (it does not touch consent).

## Why
Finishing a connect link signs the browser that finished it into the account that owns the broker accounts
(`app/connect/done/route.ts:33-37`, case `signin`). Someone can start a link, send it to a trader, and end up signed
in as that trader. The decline and the vendor cleanup already exist (`lib/connections.ts:377-381`,
`cleanupQuietly`; `lib/connections.test.ts:413-414`); the session is the hole. Brokerage-first sign-ups depend on
that path today: they create a user with no other identity (`app/connect/actions.ts:37-40`,
`lib/auth/attempts.ts:65-95`). Owner decision 2026-11-02 (OD 2.16, accepted en bloc; brief row 15; BUS:527; SEC:20).
Committee check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: A connect link that finishes in a browser with no session never creates a session. The page shows the
  owner's line: "These accounts are on @‹handle›'s record. Sign in with the method you used before." with a sign-in
  link, and the connection the link created is declined and cleaned up through the existing decline path. Why: the
  owner accepted OD 2.16 on 2026-11-02.
- 2026-11-02: "Clean up" removes only the vendor connection and authorization this link created. The record that
  already owns the accounts keeps its connections, claims, activities and sync unchanged. The luring attempt is not
  bound to that record's user (drop the `completeAttempt` call at `lib/connections.ts:378` on this path). Why: legal
  committee condition; engineer review.
- 2026-11-02: So that "the method you used before" always exists, brokerage-first sign-up adds an email or sign-in
  provider identity before it finishes; a trader can no longer hold an account whose only way in is a connect link.
  Existing demo and test accounts are unaffected. Why: engineer review (without this, removing the sign-in locks
  brokerage-first traders out); the owner's 2.16 line presumes another method exists.
- 2026-11-02: A finish inside another user's session keeps today's behaviour: it refuses to
  `/u/me?connect=account-claimed` (`app/connect/done/route.ts:32`) and never shows the owning record's handle. A
  finish inside the right session connects as today. Why: engineer review (showing the handle there would tell a
  signed-in stranger which profile owns the account).
- 2026-11-02: The page is `noindex` and `no-store`, and tells the trader to finish a connect in the browser where they
  started it. Why: UX and business lead reviews.

## Acceptance criteria
- [ ] A signed-out finish creates no session cookie and no `sessions` row (DB + e2e).
- [ ] It shows the owner's line with the handle and a sign-in link, and the "finish in the browser where you started"
      line; the response is `noindex` and `Cache-Control: no-store`.
- [ ] The vendor fake receives exactly the deletes the existing decline path sends (one connection delete and one
      vendor-user delete, as `lib/connections.test.ts:413-414`), and no activity is stored for the link.
- [ ] The owning record's connections, claims, activities and next sync are byte-identical before and after (DB test).
- [ ] The luring attempt is not completed against the owning user (test on `login_attempts`/attempt state).
- [ ] A finish in another user's session redirects to `/u/me?connect=account-claimed` and the response holds no handle
      of the owning record; a finish in the right session connects (tests).
- [ ] Brokerage-first sign-up cannot finish without an email or provider identity; a test signs up that way, signs out
      and signs back in with that identity.
- [ ] No log line holds an account id together with a user id (POLICY P6 scan).

## Out of scope
- `lib/session.ts` (security patch 3.11 is the protected-files session's).

## Open questions
- UX review proposed different words ("Nothing was connected. This link was started from @‹handle›. …"). The line is the
  owner's (OD 2.16); any change is the owner's call.

## POLICY notes
- P6 logging; F5 read-only; R1 (a link from someone else is untrusted).

## Rework notes

## Build log
