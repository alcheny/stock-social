# F-22 build brief (orchestrating build session, 2026-11-02)

Feature: `docs/features/F-22-transfers-as-share-moves.md` (Status `ready` on the owner-decisions branch, #106: the owner
said yes to OD 2.28 on 2026-11-02, relayed by the orchestrator). Built on top of F-32 Part A (#108), on
`claude/f22-transfers-share-moves`, as a second PR. Separate MATCHER_VERSION bump (3 → 4), merged only after #107
(chore C5-43(b)) and #108, never in the same deploy as F-36's bump.

## Where transfers stand after F-32 Part A (#108)
- The loader flags vendor TRANSFER / EXTERNAL_ASSET_TRANSFER_IN / _OUT rows (`transfer: true` on an unpriceable
  'unknown' action; `lib/corporate-actions.ts#withTransfer`).
- In `lib/trades.ts#replay` a transfer is still an unpriceable action: it taints every lot of the pair (`taintBy`), a
  transfer in pushes a tainted no-basis lot, a transfer out removes oldest lots (gap for any shortfall), and it sits in
  the backward window and same-day lists. Sells it excludes are counted as `excludedTransfer` ("transfer"), unless a
  non-transfer action also reaches them.

## Proposed division F-22 / F-32 Part B (committee to decide)
- F-22 = the forward path (a transfer dated before the sell), per its decisions:
  - Transfer in (units > 0): pushes one tainted lot (cause transfer) for the moved-in units; older recorded lots stay
    priced. A sell drawing only older lots is shown; one drawing the moved-in lot is counted ("transfer").
  - Transfer out (units < 0): removes units oldest first ONLY where that cannot change a basis: the whole position moves
    (|units| = held, tolerance), or every lot of the pair has the same per-unit price and fee (proposal: and the same
    opening date, since oldest-first would otherwise change a shown holding period). The vendor never names lots today.
    Otherwise remove as today and taint the remaining lots (cause transfer): their sells are counted. A transfer out
    beyond what is held keeps today's gap.
  - Every transfer-out row is counted in a new additive counter `users.excluded_transferred_out`, shown on the profile
    with its own neutral line when above 0. It counts transfer rows, not sells, so it is not an `excluded*` sells key of
    `MatchResult` (F-32 Part A's `EXCLUDED_KEYS` partition is per sell); proposal: `MatchResult.transfersOut` plus a
    note for F-21 (whose sum is "sells and option closes, in the headline's unit").
  - A unit-less transfer row keeps today's taint (unknown kinds keep the taint).
- F-32 Part B = the backward window and the same-day rule for transfers (waits on the vendor's MRC2-10 answer, because the
  window exists in case the vendor posts an event's row on another day). Unchanged here.

## Hard questions for the committee
1. The acceptance property "inserting a TRANSFER never improves a shown average or win rate" cannot hold while the
   backward window stays (Part B), and fails for a whole-position transfer out followed by new buys (the later sell
   truly draws the new lot; without the transfer it would draw the old one). Proposal: test it for transfers in and
   unit-less transfers on sells outside the transfer's window and day; for transfers out, test that every sell whose
   drawn lots predate the transfer and were not moved is unchanged, and every removal is a named count.
2. If the vendor ever sends a split as a transfer-in row (MRC2-10 open), F-22 leaves older lots at the old basis and a
   partial sell after it is priced on that basis. This is the same accepted limit as an unreported split
   (`lib/corporate-actions.ts` header ponytail). Proposal: a `ponytail:` naming MRC2-10.
3. The copy: the transferred-out line names no cause and blames no one; /how names transfers out as a matching fact and
   calls FIFO the record's own matching method, not the broker's. There is no `VERIFIED_DEFINITION` constant in the
   code; the Verified wording is `HOW.verified` (`lib/copy.ts`). POLICY F3's list is the protected-files session's edit.
4. F-32 Part A tests that pin today's forward behaviour (probe p4 and the "relabel only" fuzz property) are updated,
   never deleted.
