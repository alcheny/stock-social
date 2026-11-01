# F-23 · Fee-recovery probe (fictional, 2026-11-01)

Required by the cycle-4 decision: "The fee-recovery probe in the PR states the smallest position size at which
one-decimal output still reveals size." Fictional numbers only; no real trader, broker or fee schedule.

## Model
- A close's return includes fees (`lib/trades.ts` subtracts entry and exit fees from the FIFO result).
- The fictional broker charges a flat commission per round trip, `F` (entry plus exit).
- An observer knows the day's execution prices (public day prices), so the gross return `g` of the round trip is known
  up to the intraday spread; assume the worst case for the trader: `g` exactly known.
- Published return `r ≈ g − F/N` for a position cost `N` (first order). Fee drag `d = g − r = F/N`.
- A published value pins `r` to an interval of half-width `ε`. The drag is then known within `±ε`, so `N = F/d` is
  pinned within a factor of 2 when `d ≥ 3ε` (d between 2ε and 4ε), i.e. `N ≤ F/(3ε)`, and merely bounded above
  (fees detectable) when `d ≥ ε`, i.e. `N ≤ F/ε`.

## Results
| Payload precision | ε | Size pinned (×2) at F = $2 | at F = $10 | Upper bound only, F = $2 |
|---|---|---|---|---|
| Before F-23: 1e-8 (profile points), float8 (pane JSON) | ~5e-9 | ~$133,000,000 (every size) | every size | every size |
| Council option rejected: 4 decimals of the fraction | 5e-5 | ~$13,300 | ~$66,700 | ~$40,000 |
| **F-23: printed precision, 1 decimal of a percent** | **5e-4** | **~$1,333** | **~$6,667** | ~$4,000 |

A boundary value (|r| in [n.45%, n.5%)) goes out as a fixed stand-in chosen from the prints ("n.46%"), and the
near-total-loss band as one fixed value: neither adds digits beyond what the screen prints, so ε is unchanged.

## Statement for the PR
At one decimal of a percent, **positions below about F / (3 × 0.0005), about $1,300 for a $2 round-trip commission
(about $6,700 for $10), can still have their size estimated within a factor of two** from the published return and the
day's prices, as the screen itself already allows. Before F-23 every position size was recoverable from the payloads.

Same-day order (the chart's spread of one day's closes) reveals only the order the list already shows. Hold days at one
decimal (ε = 0.05 day) and close days add no fee information.

Any caveat to the consent words (`lib/copy.ts:80`, `:82`) is for the owner and the AI legal committee, not this build
(decision, cycle 4).
