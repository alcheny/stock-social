# Options build: tester QA, round 1 (2026-11-01)

Fresh-context tester. Gated real app scanned (profile HTML and meta, pane JSON, feed, `/t/XYZ`, sitemap, OG image):
no option term, return, strike or OCC string. 360 px light and dark: no horizontal scroll. `npm test` 878/0 failed;
`e2e/options.spec.ts` 9/9; `lib/trades.ts` diff empty.

| # | Severity | Finding |
|---|---|---|
| 1 | blocking (only once the gate opens) | Open option rows used `position_key` (contains strike and multiplier) as the React key; server components serialize keys into the page payload, so the strike would reach the HTML. Static-markup tests drop keys, so they missed it. |
| 2 | should-fix | Pane JSON published the per-kind split of the gated counts (short/long/open), beyond the one gated line (D5). |
| 3 | should-fix | Share BUY/SELL rows whose symbol is an OCC contract (no `option_symbol`, or `option_type` with a symbol) reach `closed_trades` with the strike in the symbol (also code review item 5). |
| 4 | should-fix | A missing currency, OCC ticker or underlying type on an event row is read as a mismatch and excludes the whole contract. |
| 5 | should-fix | Mini and standard contracts on the same strike are grouped without the multiplier, so both are counted; a mini's conventional root (`XYZ7`) is counted as adjusted. |
| 6 | note | A short close after a taint counts as `contradict`, not short; an assignment of a long counts as short (misleading copy); the reference model mirrors the matcher's choices. |
| 7 | note | /how "fees can take it slightly lower": cheap contracts with per-contract fees go far below −100%. |
| 8 | note | Share closes removed by the exercise-day rule are counted in lines that say "option trades". |
| 9 | note | Option positions on preferred stock or units, and malformed ones, are described as "futures and similar contracts". |
| 10 | note | The countdown-word scan covers the options copy only. |
| 11 | note | Raw `option_activities` columns (strike, units, prices, fees, account) are in no privacy map. |
| 12 | note | `option_trades.close_id` unique across users (silent drop on collision); an empty account set passes the per-trader check; the record card says "average per share trade" rather than a "Share trades" label. |

Per-AC: met 1, 3, 4, 5, 7–11, 13–15, 17–19, 21–23; partly 2 (F6), 6 (F5), 12 (F3), 16 (F2), 20 (F10), 24 (F12).
