# F-38 · Neutral demo seed

Status: ready
Start conditions: none (`scripts/seed.ts`, `lib/demo.ts`, demo-handle references in tests).

## Why
The demo seed uses tickers of listed companies, slang-style handles and one real-sounding thesis
(`scripts/seed.ts:15-17`, `:78`), and only one of three demo traders drifts negative. Every shared link and signed-out
visit lands on these records. Owner decision 2026-11-02 (OD 2.38, accepted en bloc; CRE:868-873). The stock-page half of
2.38 is F-39. Committee check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: Demo traders get neutral fictional handles from a fixed allowlist and plain theses; every demo symbol
  uses a reserved fictional pattern that cannot be a listed symbol by its structure (it contains a digit); a fourth
  demo trader whose record ends at a loss is added. Why: the owner accepted OD 2.38 on 2026-11-02; POLICY P2, T1, T2;
  legal committee condition (the pattern, not a list of real symbols, decides).
- 2026-11-02: The seed stays idempotent and `source='demo'`, and the Demo badge stays on every demo surface. Why:
  CLAUDE.md; P2.

## Acceptance criteria
- [ ] Every demo symbol matches the reserved fictional pattern (with a digit); no list of real symbols is kept in the repo.
- [ ] Demo handles equal the fixed allowlist in the test.
- [ ] Four demo traders; on the fixed random seed one ends with a negative average and a negative compounded figure.
- [ ] Re-running the seed changes nothing; demo rows keep `source='demo'`.
- [ ] Tests and e2e that name demo handles are updated to the new handles, never deleted.

## Out of scope
- Stock pages (F-39); real users' data; F-7 public filings.

## Open questions
- None.

## POLICY notes
- P2, T1, T2.

## Rework notes

## Build log
