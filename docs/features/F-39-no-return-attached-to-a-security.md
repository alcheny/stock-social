# F-39 · No return attached to a security

Status: blocked
Blocked: builds after F-25 (#102) and F-16/F-17 (#100) merge, since both edit `app/t/**` (merge order)

## Why
Stock pages print returns per security: the compare page's average per trade (`app/t/compare/page.tsx:84`), Baseline's
range of the average per stock (`app/t/[symbol]/Baseline.tsx`), and the summary on `app/t/[symbol]/page.tsx:125-129`,
`HoldTime.tsx:31`, `Concentration.tsx:30`, `Spread.tsx` and the stock image (`opengraph-image.tsx`). POLICY F3b bars
rating or scoring a security. Owner decision 2026-11-02 (OD 2.38, accepted en bloc; CRE:884-885). Committee check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: No page or image attaches a return, average or range to a security: the compare page drops its
  per-security return; Baseline, the summary, HoldTime, Concentration, Spread and the stock image describe traders'
  records without a per-stock return figure. Why: the owner accepted OD 2.38 on 2026-11-02; POLICY F3b.
- 2026-11-02: Pages about securities never order securities by trader count or return; lists are alphabetical or by
  most recent close. Why: legal committee condition (F3b).

## Acceptance criteria
- [ ] `/t`, `/t/compare`, `/t/[symbol]` and the stock image print no return, average or range for a security
      (render scan signed out, on fictional fixtures).
- [ ] Any list of securities is in alphabetical or most-recent-close order (test).
- [ ] Each trader record linked from a stock page still shows its own figures with the disclaimer.
- [ ] Existing tests of these pages are updated, never deleted.

## Out of scope
- The demo seed (F-38).

## Open questions
- None.

## POLICY notes
- F3b.

## Rework notes

## Build log
