# F-42 · Export everything stored about the user

Status: ready
Start conditions: none; it edits `lib/record-tools.ts#exportFor` and the export route.

## Why
The export holds saved views, notes and subscription status only (`lib/record-tools.ts:248-259`): no trades, raw
activities, consent or attestation records. OD 2.8 defines the export. Owner decision 2026-11-02 (OD 2.8, accepted en
bloc; C3:611-620).

## Decisions
- 2026-11-02: The export holds everything stored about the user: profile fields, closed trades as percent only,
  open positions as stored, theses with their states, consent and attestation records (versions and dates), follows,
  likes, hides, preference data, the raw activities as stored, and the disclaimer. It never holds secrets (the vendor
  user secret, session tokens, link tokens) or other users' personal data. Why: the owner accepted OD 2.8 on
  2026-11-02; legal rater adds raw activities.
- 2026-11-02: One machine-readable file (JSON) with a plain index of sections; the request is rate-limited and
  available only to the signed-in owner of the data. Why: P6; COMPLIANCE §3.

## Acceptance criteria
- [ ] A fictional user with data in every personal table gets every section; a guard test fails when a new personal
      table in `lib/privacy-retention.ts` has no export section.
- [ ] The export holds no secret: a scan for the stored ciphertext, session and link token values finds none.
- [ ] Raw activities appear as stored; closed trades carry no quantities or prices (P3).
- [ ] Another user's handle appears only where the user follows or liked them; no other user's personal fields.
- [ ] Signed-out and other-user requests get 404; a second request within the limit window is refused politely.

## Out of scope
- Deletion (exists) and the 90-day purge (F-43).

## Open questions
- None.

## POLICY notes
- P3 percent only in derived data; P6 rights; S2 no secrets.

## Rework notes

## Build log
