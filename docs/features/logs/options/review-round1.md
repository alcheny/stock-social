# Options build: independent code review, round 1 (2026-11-01)

Fresh-context reviewer, full diff against origin/main. Verdict: request changes (1 blocking, 4 should-fix, 5 nits).
The gate and SQL hold: nothing publishes option terms or returns while gated; `lib/trades.ts` and the
`rebuildTrades` body are unchanged; keyset paging equals the pure matcher on 2,520 rows; SDK field names match.

## Blocking
1. Expiry processed before a same-day sell (`lib/options.ts` rank, expiry close): a date-only expiry row (midnight
   UTC) sorts before a same-day sell and closes the whole net position. Buy 2 at 1.00, sell 1 at 3.00 on expiry day,
   1 expires → one trade at −100% over both contracts, the sell counted as `noOpen` (correct: +200% and −100%). Fix:
   events rank after trades at equal instants, a midnight event orders at the end of its UTC day, the expiry closes
   `min(units, net)`; hand case added.

## Should-fix
2. An option position with a null price shows −100% unrealized (`splitPositionKinds`: `Number(null)` is 0).
3. Profile "as of Invalid Date" when a trader's only open positions are options; the combined open line leaves
   option percents out while the grid counts them.
4. Traders with share history never import older option history (the sync takes the 7-day path); closes whose opens
   predate the window count as `noOpen`. Fix: a one-time per-connection option backfill, or a known limit.
5. An option BUY/SELL row with `option_type` set, `option_symbol` null and an OCC string in `symbol` is treated as a
   share and reaches `closed_trades` with the strike in the symbol (pre-existing, breaks the no-OCC claim).

## Nits
Exercise rows without `option_symbol` never taint (fall back to the activity's symbol); `option_trades.close_id`
unique across users (use `(user_id, close_id)`); `excluded_options_other` includes removed share closes while the copy
calls them option trades; `optionSummary` duplicates `arithmeticRange`; the keyset sort's collation can't use the
index (fine at today's volumes).
