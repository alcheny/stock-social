# F-38 · Connect preview and the licensed-user question

Status: ready
Start conditions: fixes-list item F6-2 (the new consent version) merges first, because both edit the consent step.

## Why
The connect step lists what becomes public in words only (`app/connect/page.tsx`, `app/connect/consent/page.tsx`).
OD 2.11 asks to show a Demo record of what becomes public before consent, with no broker call. OD 2.62 asks the
trader at connect whether they are a registered representative or adviser. Owner decision 2026-11-02 (OD 2.11, 2.21,
2.62, accepted en bloc).

## Decisions
- 2026-11-02: Before consent, the connect step shows a fictional Demo record rendered with the real profile components:
  what a public profile row, the record strip and the share card show, each carrying the Demo badge. It is drawn from
  fixed fictional data, makes no broker or vendor call, and stores nothing. Why: the owner accepted OD 2.11 on
  2026-11-02 (#44; approval cycle 2).
- 2026-11-02: The consent step asks one required question: "Are you a registered representative or investment adviser?"
  (yes / no). The answer is stored with the consent record and is visible to the trader only. A "yes" does not block
  the connect; it puts the profile on the legal committee's review list (no public label). Why: the owner accepted
  OD 2.62 on 2026-11-02 (F-3:247-248; MKT2:564-565).
- 2026-11-02: The consent step says, in one line, that a broker account belongs to one profile and that a mistaken
  claim is reviewed by a person through the contact address. Why: the owner accepted OD 2.21 on 2026-11-02.

## Acceptance criteria
- [ ] The preview renders before consent with the Demo badge on every element and makes no vendor call (vendor fake
      asserts zero calls) and no database write (test).
- [ ] The preview shows only fields the current consent version lists as public (test against
      `lib/privacy-fields.ts`); a field outside the scope fails the test.
- [ ] The licensed-user question must be answered before the connect continues; the answer is stored with the consent
      row and appears in the trader's export (F-42) and nowhere public (scan of profile HTML, pane JSON and images).
- [ ] A "yes" adds the user to the review list read by the owner's digest; no public surface changes (test).
- [ ] The claims line renders with the contact address from configuration; with none set, the connect step refuses
      to open for non-demo users (test), as P6 requires a working contact.
- [ ] Keyboard and screen-reader use: the question is a fieldset with a legend; errors are announced (e2e, A1).

## Out of scope
- The consent wording itself (F6-2) and Terms text (owner).

## Open questions
- Legal committee: the exact wording of the question and of the review-list note in the Privacy Policy.

## POLICY notes
- P2: the preview is fictional and always Demo. P6: what becomes public is shown before consent. F1: the question
  never changes what a viewer sees.

## Rework notes

## Build log
