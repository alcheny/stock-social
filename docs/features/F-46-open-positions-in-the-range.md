# F-46 · Open positions in the TR-9 range

Status: blocked
Blocked: builds after F-33 (same ranking slot) merges; its MATCHER_VERSION bump (chore C5-43(b) merged as #107) never in the same deploy as F-22's, F-32's or F-36's (merge order); also development paused by the owner 2026-11-02 (resume: drop this clause)

## Why
DESIGN TR-9 includes open positions in the range (`docs/DESIGN.md:340-341`), but the range is closed-only
(`lib/trades.ts:479-489`). A record that closes winners and holds losers open can reach F-33's evidence tier (F-33's
hold-losers note). Owner decision 2026-11-02 (OD 2.34, accepted en bloc; F-6:58-59). Committee check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: The range counts each open position as a result at its unrealized percent and its days held so far,
  measured to the stored last-read time, never the clock. `rebuildTrades` sets an additive `open_positions.opened_at`
  from `openLots` (`lib/trades.ts:105`, the earliest unmatched FIFO lot); sync keeps writing the rest of the row
  (`lib/positions.ts:29-33`). A position with no unmatched lot (a transfer in) is excluded and counted. The range and
  the ranking weight use the same set. Why: the owner accepted OD 2.34 on 2026-11-02; TR-9; engineer and business lead
  reviews.
- 2026-11-02: The range caption reads "Includes ‹n› open positions at their last read value." and is omitted when n is
  0. The chart stays closed trades only (CH-1). Why: F-6's chart decision; UX review.
- 2026-11-02: The MATCHER_VERSION bump is the backfill for frozen records, which are never synced. Why: engineer
  review.

## Acceptance criteria
- [ ] F-33's hold-losers `todo` becomes a live test and passes: 30 winners at +1% with 10 losers open at −20% never
      outrank a 200-trade record with the same closed figures.
- [ ] A record with no open positions prints the same range as before, byte for byte, with `now` pinned.
- [ ] `opened_at` is additive in `db/schema.sql`, set by the rebuild, equal to the earliest unmatched lot (property
      test); a position without one is excluded and counted.
- [ ] The caption is pinned and absent at n = 0; the chart is unchanged (render tests, signed out).
- [ ] Losses rank equal to gains of the same size (symmetric test).

## Out of scope
- Withholding thin names (deferred, OD 2.25).

## Open questions
- None.

## POLICY notes
- F4; P3.

## Rework notes

## Build log
