# F-24 · Late-posted trades reach the record (insert-only reconciliation)

Status: blocked
Blocked: waits for F-14 (sync cadence, PR #64, `claude/f14-sync-cadence`, rewrites `syncUser` and owns the per-account read limit)
Start conditions: F-14 (PR #64) merges. Shares one build slot (the ledger slot) with F-22; whichever starts second merges
`main` first.

## Why
The hourly read starts at the newest stored activity minus 7 days (`lib/sync.ts:12`, `:381` at 3d66114), so a row the
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
  fills must both survive: rows with different ids are both kept when the vendor's full read lists both, and a row is
  treated as a re-issue only when its original id is absent from that full read. Identity stays `unique(source, external_id)`. Why: approved by the approval council
  (cycle 3); RE, TS, DK (veto condition: DK, CS).
- 2026-11-01: No "late", "corrected" or "new" wording or styling on a found close, nothing that implies the trader
  edited anything; "updated" keeps meaning the last successful vendor read. Theses stay attached by `sell_id`. Why:
  approved by the approval council (cycle 3); UX, PD, CS.
- 2026-11-01: Sequencing and lapse: starts after F-14 merges; if F-14 has not merged by the next approval council
  (cycle 4), this approval lapses to that council. Why: approved by the approval council (cycle 3); lapse rule.
- 2026-11-01: A pass runs every 7 days per account. Each of its pages replaces that day's week read, so the requests per
  account per day are unchanged, and later pages wait at least 47 hours, so an account's daily reads alternate page,
  week, page, week. An account with no due date gets its own weekday, from a hash of its id, and is never due within 7
  days of its claim. Why: decided by the committee under the owner's instruction of 2026-11-01; it matches the 7-day re-read window, costs no vendor request beyond F-14's caps, and spreads
  the first passes over a week without a table rewrite at deploy (committee log, rounds 1–3).
- 2026-11-01: Possible re-issues live in a side table, `activity_reissues`, in one of three states: pending, genuine or
  suspected. The rebuild leaves out every row that is not genuine. Any read that lists both rows of a pair makes the pair
  genuine, and genuine is final. A week read can clear a held row but never mark one suspected. Rows that arrive together
  are never treated as each other's re-issue. Twins stored before F-24 are not swept. Why: decided by the committee under the owner's instruction of 2026-11-01; D5's "only when its original id
  is absent from that full read", without ever pulling a close already shown.
- 2026-11-01: A pass decides only when it is complete:
  - no break in the 50-row page overlap;
  - every stored listable row from before the pass is listed, except the originals of held rows.
  A pass whose only shortfall is ids the previous pass also missed also decides. Invalid and abandoned passes are counted
  and logged. Why: decided by the committee under the owner's instruction of 2026-11-01; a vendor list that shifts between pages days apart must never make a genuine fill look absent, and one
  vendor cancel must never hold an account undecided forever.
- 2026-11-01: Two counted failures of a page step in a row give the pass up, and the week is read instead. Code errors
  count. Outages, rate limits, timeouts and route-deadline cuts do not. Why: decided by the committee under the owner's instruction of 2026-11-01; a page that always fails must not starve an
  account's recent trades or quarantine the trader.
- 2026-11-01: Every rebuild, through `rebuildRecord`, compares share and option closes by id and row hash. Changed or
  removed closes are added to `users.closes_rewritten` and logged with the internal user id and counts only. Why: decided by the committee under the owner's instruction of 2026-11-01; D4 says
  "every rebuild"; the counter and the log line are the log and the count D4 asks for.
- 2026-11-01: Option twins are counted in the `sync reissues` log line but not held. AC6 is built for share rows, so a
  re-issued option close can show twice until the owner decides. Why: decided by the committee under the owner's instruction of 2026-11-01; holding them would roughly double the re-issue code
  for a rare case; this is listed as an owner item.
- 2026-11-01: A multi-page pass's page counts as a history page:
  - it follows the positions-only rule (TR-4);
  - "Updated" (`last_synced_at`) keeps its value, through F-14's mechanism.
  A one-page pass that returns everything counts as the week read. Why: decided by the committee under the owner's instruction of 2026-11-01; it reuses F-14's existing rules instead of adding
  a column; a one-day skew across accounts is a known limit.

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
