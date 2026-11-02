# F-48 · The vendor connection is deleted when a record freezes

Status: draft
Blocked: waits for the vendor's written answer that derived percentages may stay public after a connection is deleted (OD 2.12; vendor letter), and for F-40; also development paused by the owner 2026-11-02 (resume: drop this clause)

## Why
After a freeze the vendor still holds the trader's connection. OD 2.12 deletes it once the vendor confirms the
derived percentages may stay public, amending DESIGN TR-5. `deleteConnection` already exists (`lib/broker.ts:141`,
in `Deps` at `lib/connections.ts:130`), so no protected code changes. Owner decision 2026-11-02 (OD 2.12, accepted en
bloc). Split from the in-app disconnect so that one can be built and marked built on its own (business lead and UX
reviews). Committee check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: When a record's connection freezes (in-app disconnect or confirmed freeze), the vendor connection is
  deleted once, idempotently, behind a switch that only the owner turns on, with a dated DECISIONS line citing the
  vendor's written reply. The record and its derived data stay. Why: the owner accepted OD 2.12 on 2026-11-02; legal
  committee condition (deleting data is the owner's decision, POLICY H).
- 2026-11-02: The DESIGN TR-5 amendment goes to the protected-files session. Why: DESIGN is protected.

## Acceptance criteria
- [ ] With the switch off, no vendor delete is ever called (vendor fake).
- [ ] With it on, each frozen connection gets exactly one delete; a retry sends none; failures are retried next run.
- [ ] The record's closed trades and theses are byte-identical before and after.

## Out of scope
- The in-app disconnect (F-40).

## Open questions
- Vendor (letter): may derived percentages stay public after the connection is deleted?

## POLICY notes
- H (deleting data), P6.

## Rework notes

## Build log
