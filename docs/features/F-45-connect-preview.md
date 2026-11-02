# F-45 · Connect preview: a Demo record of what becomes public

Status: blocked
Blocked: builds after F-44 (same consent page) and F-38 (its fictional handles and symbols) merge (merge order)

## Why
The connect step lists in words what becomes public (`app/connect/page.tsx`, `app/connect/consent/page.tsx`). OD 2.11
asks to show a Demo record of it before consent, with no broker call. POLICY P6 is already met by the list, so this
follows the Beta-blocking F-44. Owner decision 2026-11-02 (OD 2.11, accepted en bloc; #44; A2:183-185). Committee
check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: On the existing consent page, with no extra tap, a fictional Demo record shows what a public profile
  row, the record strip and the share card show, stacked in that order, each with the Demo badge and the disclaimer,
  using F-38's fictional handles and symbols. It is drawn from fixed data, calls no broker or vendor, and stores
  nothing. Why: the owner accepted OD 2.11 on 2026-11-02; legal committee conditions; UX and business lead reviews.

## Acceptance criteria
- [ ] The preview renders before consent with the Demo badge and the disclaimer on every element; zero vendor calls
      (fake) and zero database writes (test).
- [ ] It shows only fields the current consent version lists as public (test against `lib/privacy-fields.ts`).
- [ ] It sits on the consent page, adds no tap, fits 360 px with no horizontal scroll, row then strip then card (e2e).

## Out of scope
- The consent wording (F6-2).

## Open questions
- None.

## POLICY notes
- P2 fictional and Demo; P6.

## Rework notes

## Build log
