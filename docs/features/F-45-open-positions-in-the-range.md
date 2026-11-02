# F-45 · Open positions in the TR-9 range

Status: ready
Start conditions: F-33 (ranking weight needs evidence) merges first; same ranking slot.

## Why
DESIGN TR-9 includes open positions in the range (`docs/DESIGN.md:340-341`), but the range is closed-only
(`lib/trades.ts:480-489`). A record that closes winners and holds losers open can reach the evidence tier (F-33's
hold-losers note). Owner decision 2026-11-02 (OD 2.34, accepted en bloc; F-6:58-59).

## Decisions
- 2026-11-02: The range counts each open position as a result at its unrealized percent and its days held so far,
  using an additive `open_positions.opened_at` (the earliest unmatched FIFO lot). The range and the ranking weight use
  the same set. Why: the owner accepted OD 2.34 on 2026-11-02; TR-9.
- 2026-11-02: The range's caption says it includes open positions at their last read value. The chart stays closed
  trades only (CH-1). Why: F-6's chart decision; F-34's as-of rule.
- 2026-11-02: The change needs a rebuild for `opened_at`, so it ships with a MATCHER_VERSION bump only after chore
  C5-43(b), never in the same deploy as F-32's or F-36's bump. Why: council cycle 5 version-bump rule.

## Acceptance criteria
- [ ] F-33's hold-losers AC passes (its `todo` becomes a live test): 30 winners at +1% with 10 losers open at −20%
      never outrank a 200-trade record with the same closed figures.
- [ ] A record with no open positions has the same range as before (byte-identical print).
- [ ] `opened_at` is additive in `db/schema.sql`, set by the rebuild, and equals the earliest unmatched lot (property
      test); rebuilds stay byte-identical for the same input.
- [ ] The caption names open positions; the chart is unchanged (render tests).
- [ ] Losses rank equal to gains of the same size (symmetric test).

## Out of scope
- Withholding thin names (deferred by the owner, OD 2.25).

## Open questions
- None.

## POLICY notes
- F4 whole record; percent only (P3).

## Rework notes

## Build log
