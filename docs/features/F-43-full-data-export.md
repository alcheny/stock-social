# F-43 · Export everything stored about the user

Status: blocked
Blocked: development paused by the owner 2026-11-02 (resume: set back to ready)
Start conditions: rebases on F-16/F-17 (#100), which edits `lib/record-tools.ts` and `lib/privacy-retention.ts`.

## Why
The export holds saved views, notes and subscription status only (`lib/record-tools.ts:248-259`): no trades, raw
activities, consent or attestation records. Owner decision 2026-11-02 (OD 2.8, accepted en bloc; C3:611-620).
Committee check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: The export holds everything stored about the user: profile fields, sign-in identities and email address,
  closed trades as percent only, open and unlisted positions as stored, option tables, theses with their moderation
  states, consent and attestation records (versions, times, declines), the licensed-user answer (F-44), follows,
  likes, hides, preference data, reports the user filed, F-15 counters and `share_action` rows, session metadata
  without tokens, the raw activities as stored, and the disclaimer. It never holds secrets (the vendor user secret,
  session or link tokens) or other users' personal data. Why: the owner accepted OD 2.8 on 2026-11-02; legal committee
  condition.
- 2026-11-02: One JSON file with an index of sections, delivered only as a download in the signed-in session, never by
  email. One export per 10 minutes; a second request reads "You can download another export after ‹time›." with
  `Retry-After`. The button sits in account settings with an accessible name and a "Preparing…" status in a live
  region. Why: P6; F3b; UX and business lead reviews.

## Acceptance criteria
- [ ] A fictional user with data in every personal table gets every section; a guard test fails when a table in
      `lib/privacy-retention.ts` keyed by user id or account id has no export section.
- [ ] No secret: a scan for the stored ciphertext and session and link token values finds none.
- [ ] Raw activities appear as stored; closed trades carry no quantities or prices (P3).
- [ ] Other traders' handles appear only in follows, likes, or the user's own views and notes; no other user's personal
      fields.
- [ ] Signed-out and other-user requests get 404; a second request within 10 minutes gets the pinned line and
      `Retry-After`.
- [ ] The button and status are keyboard-reachable and announced (e2e).

## Out of scope
- Deletion (exists); the 90-day purge (F-47).

## Open questions
- None.

## POLICY notes
- P3; P6; S2.

## Rework notes

## Build log
