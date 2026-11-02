# F-41 · Neutral demo seed; no return attached to a security

Status: ready
Start conditions: none for the seed; the stock-page part rebases on F-25 (#102), which edits `app/t/**`.

## Why
The demo seed uses tickers of listed companies, slang-style handles and one real-sounding thesis
(`scripts/seed.ts:15-17`, `:78`), and only one of three demo traders drifts negative. The compare page prints an
average return per security (`app/t/compare/page.tsx:84`) and Baseline prints a range of the average per stock
(`app/t/[symbol]/Baseline.tsx`). POLICY F3b bars rating a security. Owner decision 2026-11-02 (OD 2.38, accepted en
bloc; CRE:868-873, :884-885).

## Decisions
- 2026-11-02: Demo traders get neutral fictional handles and plain theses; every demo ticker resolves to no listed
  company (a reserved fictional pattern checked by a test); a fourth demo trader whose record ends at a loss is added.
  Why: the owner accepted OD 2.38 on 2026-11-02; POLICY P2, T1, T2.
- 2026-11-02: No page attaches a return to a security: the compare page drops its per-security return, and Baseline is
  reworded to describe traders' records without a per-stock average or range. Why: the same decision; POLICY F3b.
- 2026-11-02: The seed stays idempotent and `source='demo'`, and the Demo badge stays on every demo surface. Why:
  CLAUDE.md; P2.

## Acceptance criteria
- [ ] Every demo symbol fails a lookup against a listed-symbol pattern list kept in the test (no network), and no demo
      handle or thesis contains a slang or real-person pattern (test).
- [ ] Four demo traders; one ends with a negative average and a negative compounded figure on the fixed seed (test with a
      fixed random seed).
- [ ] `/t/compare` and `/t/[symbol]` print no return, average or range for a security (render scan).
- [ ] Re-running the seed changes nothing (idempotence test); demo rows keep `source='demo'`.
- [ ] Existing e2e that name demo handles are updated to the new handles, never deleted.

## Out of scope
- Real users' data; F-7 public filings.

## Open questions
- None.

## POLICY notes
- P2, T1, T2, F3b.

## Rework notes

## Build log
