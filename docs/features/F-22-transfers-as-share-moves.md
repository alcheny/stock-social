# F-22 · Transfers as share moves, not repricings

Status: ready
Start conditions: met. The owner said yes on 2026-11-02 (OD 2.28); F-14 (#64), fixes F3-1, F3-5 and F3-15 (#79), the
truthful-labels branch (#85) and F-24 (#84) have merged. It edits `lib/trades.ts`, so it is in the matcher slot with
F-32 and F-36: one builder, separate MATCHER_VERSION bumps that never ship in the same deploy, each only once chore
C5-43(b) is on main.

## Why
Every TRANSFER is read as an unpriceable corporate action (`lib/corporate-actions.ts:200` at 3d66114) and taints every
lot on the pair (`lib/trades.ts:171`). Fictional probes from council cycle 3: transfer 1 share in, sell the 100
recorded units at a loss → the loss becomes a "corporate action" count; transfer 1 out, sell 99 → excluded; transfer
the whole position out → no trade, no count, no line. Any trader can trigger the last case at will, so a Verified
record can lose a real loss without a trace (DESIGN TR-1, `lib/trades.ts:41` "never dropped silently"). Council cycle 3
brief C3-2 (rank 1). Approved by the approval council (`docs/ideas/approval-2026-11-01-cycle3.md`: second-vote mean
4.07, final vote 15/15, all with conditions), **conditional on the owner's yes**, because it amends a decided rule.

## Decisions
- 2026-11-01: This feature amends two decided rules and is built only after the owner says yes, recorded here as a
  dated decision: the matcher's documented rule "an unpriceable action taints them" (`lib/trades.ts:52`) for
  transfers, and the corporate-actions committee's "when in doubt, exclude and count"
  (`docs/features/logs/corporate-actions/committee-2026-11-01.md:44-45`, `:57-58`). Why: approved by the approval
  council (cycle 3); the council may not change a decided rule (veto condition: DK).
- 2026-11-01: A transfer in pushes one tainted lot for the moved-in units and leaves older recorded lots priced.
  Moved-in units stay excluded and counted (their basis is unknown). Why: approved by the approval council (cycle 3);
  POLICY F3c (veto condition: DK, LG).
- 2026-11-01: A transfer out removes units oldest first only where that cannot change a basis: the vendor names the
  lots, the whole position moves, or every candidate lot has the same per-unit price and fee. Otherwise the remaining
  lots stay tainted, as today, and their sells are counted. Why: approved by the approval council (cycle 3); the red
  team showed "oldest first" otherwise publishes a basis the trader chose at the broker (veto condition: DK, LG, CS).
- 2026-11-01: Every transfer out is counted in a new additive `excluded_transferred_out` counter, shown on the profile
  with its own neutral line when above 0 and summed by F-21's shared function. Every probe case ends as a shown trade
  or a named count. Why: approved by the approval council (cycle 3) (veto condition: LG, CS).
- 2026-11-01: Unknown corporate-action kinds keep today's taint. Why: approved by the approval council (cycle 3)
  (veto condition: DK, LG).
- 2026-11-01: The new line names no cause and blames no one; /how names transfers out and calls FIFO the record's own
  matching method, not the broker's. POLICY's list of exclusion causes is the owner's to amend. VERIFIED_DEFINITION and
  /how change in the same PR. Why: approved by the approval council (cycle 3); LG, UX, PD.
- 2026-11-01: Existing taint tests are updated, never deleted. Rebuilds stay byte-identical for the same input. Why:
  approved by the approval council (cycle 3); CLAUDE.md test rule; RE.
- 2026-11-01: Sequencing and lapse: built in the ledger slot after F-14, the cycle-3 fixes F3-1, F3-5, F3-15 and the
  truthful-labels branch. If the owner has not answered, or a prerequisite has not merged, by the next approval
  council (cycle 4), this approval lapses to that council. Why: approved by the approval council (cycle 3); EN.

- 2026-11-01: Lapsed at approval council cycle 4: the owner had not answered cycle-3 flag 1, and F3-15 and
  `claude/fix-truthful-labels` had not merged. It was voted again and not re-approved: second-vote mean 3.47, below
  the 3.5 approval floor (`docs/ideas/approval-2026-11-01-cycle4.md`). The file and every decision above, including
  the basis rule, are kept word for word. The council puts flag 1 to the owner again with cycle-4 Q1 (the same matcher
  sitting). If the owner says yes, it returns to the next council for the matcher slot after F-28 and F-30. Why:
  approval council cycle 4; lapse rule; BL, PF, GR, UX (unchanged facts, unanswered owner question).
- 2026-11-02: The owner said yes to OD 2.28 as recommended: a transfer is a share move, with the basis rule above
  (oldest first only where it cannot change a basis; moved-in units excluded and counted; every transfer out counted;
  unknown kinds still tainted). F-22 is approved by the owner and goes to `Status: ready`; it does not return to the
  approval council. Naming transfers out in POLICY F3's exclusion list (brief 3.17) goes to the protected-files
  session; /how and VERIFIED_DEFINITION still change in this feature's PR. Why: the owner's decision of 2026-11-02 (OD
  2.28).
- 2026-11-02: Sequencing: F-32 Part A (counts transfer exclusions under their own reason) and this feature both edit
  the matcher; one builder takes them in the matcher slot, and this feature's forward rule replaces F-32's interim
  count where both apply. F-32 Part B still waits for the vendor's written MRC2-10 answer. Why: the owner's decision
  of 2026-11-02; F-32's hand-off notes.

## Acceptance criteria
- [ ] Fictional probe 1: buy 100, transfer 1 in, sell the 100 recorded units at -60% → a -60% close is shown and the
      moved-in unit is counted.
- [ ] Fictional probe 2: buy 100 (one lot), transfer 1 out, sell 99 at -60% → a -60% close on 99 is shown.
- [ ] Fictional probe 3: buy 100, transfer 100 out → `excluded_transferred_out` is 1 and the profile shows its line.
- [ ] Two lots with different bases, transfer out part of the position with no lot named → the remaining lots stay
      tainted and the later sell is counted, not shown (the basis rule).
- [ ] Property test: inserting a TRANSFER never improves a shown average or win rate, and never changes a sell whose
      drawn lots predate it and were not moved.
- [ ] A move between two of the trader's own connected accounts never makes a position vanish from both: it ends as a
      shown trade or a named count.
- [ ] A split or stock dividend with an unknown ratio, and any unknown action kind, still taints.
- [ ] Rebuilding twice from the same activities gives byte-identical `closed_trades` rows.
- [ ] `db/schema.sql` change is additive (a new counter column); no drop, truncate or delete.
- [ ] The profile shows the transferred-out line when n > 0 (e2e), and F-21's sum includes it.
- [ ] Every existing taint test still exists (updated where the rule changed).

## Out of scope
- Oversells (C3-3 was rejected; its copy fix is F3-15's).
- Corrections and cancels (C3-9b, owner question Q3).

## Open questions
- Resolved 2026-11-02 (OD 2.28): yes, as conditioned above (Decisions).
- Owner: amend POLICY's list of exclusion causes to name transfers out (brief 3.17; prepared by the protected-files session,
  merged by the orchestrator when green and independently reviewed).

## Rework notes

## Build log
