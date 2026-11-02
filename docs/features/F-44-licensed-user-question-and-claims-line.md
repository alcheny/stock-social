# F-44 · The licensed-user question and the claims line at connect

Status: blocked
Blocked: builds after fixes-list item F6-2 (the new consent version, which edits the consent step) and F-43 (its export
AC), and rebases on F-25 (#102), which edits `lib/privacy-fields.ts` (merge order)

## Why
OD 2.62 asks the trader at connect whether they are a registered representative or adviser; OD 2.21 asks that a
mistaken account claim be reviewed by a person, explained at connect. Neither exists (`app/connect/consent/page.tsx`;
`lib/claims.ts:6-8`). Both come before Beta. Owner decision 2026-11-02 (OD 2.21, 2.62, accepted en bloc; F-3:247-248;
MKT2:564-565). The Demo preview is F-45. Committee check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: The consent step asks one required question, "Are you a registered representative or investment
  adviser?", with the hint "This means licensed to sell securities or give investment advice for pay." Neither answer
  is preselected; the error "Choose yes or no to continue." is announced and linked by `aria-describedby`. The legal
  committee may reword the question and hint. Why: the owner accepted OD 2.62 on 2026-11-02; UX review.
- 2026-11-02: The answer is an additive column on `connections` next to `consent_scope_hash`, visible to the trader
  only, listed in `lib/privacy-retention.ts`, exported (F-43), deleted with the profile and named in the Privacy
  Policy. A "yes" never blocks the connect and never changes ranking, visibility or labels; it adds the profile to a
  review list the owner reads. No log line or digest outside the database holds the answer next to an account id. Why:
  OD 2.62; legal committee conditions (F1, P6); engineer review.
- 2026-11-02: The consent step says in one line that a broker account belongs to one profile and that a person reviews
  a mistaken claim through the contact address. One helper reads the address: with none set, connect refuses to open
  for non-demo users; in development and previews the sentence is omitted. F6-3 uses the same helper. Why: the owner
  accepted OD 2.21; P6 (a working contact); business lead review.

## Acceptance criteria
- [ ] The question must be answered before the connect continues; neither radio is preselected; the error is pinned and
      announced; fieldset with legend (e2e, A1).
- [ ] The answer is stored on the connection, appears in the export, and nowhere public (scan of profile HTML, pane JSON,
      images); deleting the profile deletes it.
- [ ] A "yes" adds the profile to the review list and changes no public surface or ranking (tests).
- [ ] The claims line renders the configured address; with none set, connect refuses non-demo users (test), and the
      helper is shared with F6-3.
- [ ] No log line holds the answer with an account id (P6 scan).

## Out of scope
- The consent wording (F6-2); the Demo preview (F-45); Terms text (owner).

## Open questions
- Owner: who reviews the "yes" list and at what cadence (legal committee note; mirrors the held-thesis duty).

## POLICY notes
- F1; P6.

## Rework notes

## Build log
