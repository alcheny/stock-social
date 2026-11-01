# F-24 · Late-posted trades reach the record (insert-only reconciliation)

Status: blocked
Blocked: waits for F-14 (sync cadence, `claude/f14-sync-cadence`, rewrites `syncUser` and owns the per-account read limit)
Start conditions: F-14 merges. Shares one build slot (the ledger slot) with F-22; whichever starts second merges
`main` first.

## Why
The hourly read starts at the newest stored activity minus 7 days (`lib/sync.ts:12`, `:381` at d98f32d), so a row the
vendor posts later with an older trade date is never read. A missed sell drops a close from a Verified record; a
missed buy turns a later sell into an "earlier position" exclusion. Council cycle 3 brief C3-9, split in round 0: this
is part (a), the late-row reconciliation; part (b), keeping vendor corrections in a revisions table, goes to the owner
(cycle-3 question Q3, CLAUDE.md "activities: raw, immutable"). Approved by the approval council
(`docs/ideas/approval-2026-11-01-cycle3.md`: second-vote mean 3.60, final vote 15/15, all with conditions).

## Decisions
- 2026-11-01: A periodic full-history read per account inserts activities the incremental read missed. It only
  inserts (`on conflict (source, external_id) do nothing`, `lib/sync.ts:37`, stays as is): no raw row is ever updated
  or deleted. Results reach `closed_trades` only through `rebuildTrades`. Why: approved by the approval council
  (cycle 3); CLAUDE.md "raw, immutable" and "never patch closed_trades" (veto condition: DK, LG).
- 2026-11-01: It reads BUY and SELL rows through the existing `fetchActivitiesPage` (`lib/broker.ts:96`); any edit to
  `lib/broker.ts` (a protected path) waits for the owner's merge. Why: approved by the approval council (cycle 3); EN,
  DK.
- 2026-11-01: It runs inside F-14's per-account read limit and request budget, paged with a cap per run that resumes
  where it stopped, and never runs for disconnected, frozen or paper accounts. Why: approved by the approval council
  (cycle 3); F-14:13-15 (veto condition: DK, LG).
- 2026-11-01: No silent rewrite: every rebuild that changes or removes a close that was already shown is logged per
  user (ids and counts only, no figures, no raw payloads) and counted, so the owner can expose the count later. Why:
  approved by the approval council (cycle 3); red team, CS (veto condition: LG, CS).
- 2026-11-01: A row with a new id that matches an existing row's account, symbol, time, units and price is never
  merged and never published twice silently: it is counted as a possible re-issue for the owner. Two genuine identical
  fills must both survive. Identity stays `unique(source, external_id)`. Why: approved by the approval council
  (cycle 3); RE, TS, DK (veto condition: DK, CS).
- 2026-11-01: No "late", "corrected" or "new" wording or styling on a found close, nothing that implies the trader
  edited anything; "updated" keeps meaning the last successful vendor read. Theses stay attached by `sell_id`. Why:
  approved by the approval council (cycle 3); UX, PD, CS.
- 2026-11-01: Sequencing and lapse: starts after F-14 merges; if F-14 has not merged by the next approval council
  (cycle 4), this approval lapses to that council. Why: approved by the approval council (cycle 3); lapse rule.

## Acceptance criteria
- [ ] Fake-vendor e2e: a SELL dated 10 days before the newest stored trade appears in `closed_trades` after
      reconciliation, and a second run inserts 0 rows.
- [ ] No raw `activities` row is updated or deleted by the reconciliation (test over before/after rows).
- [ ] The reconciliation stays inside F-14's per-account budget (request count asserted) and resumes from its
      position across runs when capped.
- [ ] Disconnected, frozen and paper accounts are never read (test).
- [ ] A rebuild that changes or removes an already-shown close writes one per-user log entry with ids and counts only,
      and increments the owner-visible count.
- [ ] A re-issued row (new id, same account, symbol, time, units, price) is counted as a possible re-issue and not
      published twice; two genuine identical fills with different ids are both kept when the vendor's full read lists
      both (tests both ways).
- [ ] A found close carries no "late", "corrected" or "new" label (copy test); its thesis, if any, stays attached.

## Out of scope
- Vendor corrections and cancels, and a revisions table (C3-9b: owner question Q3).
- Any public "corrected by the broker" count.

## Open questions
- Owner (cycle-3 Q3): may the importer keep vendor corrections in an append-only revisions table? Not decided here.
- Vendor question list: how corrections, cancels and late postings appear (unverified; `docs/direction/cycle3-2026-11-01.md` §9).

## Rework notes

## Build log
