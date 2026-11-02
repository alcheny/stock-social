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

## The chart channel (independent review of #97, corrected 2026-11-01)
The table above covers a close's own published return. The performance chart is a second channel. It compounds
(`lib/trades.ts#equityCurve`: C_k = Π(1 + r_i) − 1), and every point is printed, and sent, at one absolute decimal of a
percent (`pct`; `wirePct` of C_k, `lib/chart-series.ts`). Two consecutive points give
r_k = (1 + C_k) / (1 + C_{k−1}) − 1, with an error of about 2ε / (1 + C). The further a record has compounded from 0%,
the finer each close's return comes back:

| 1 + C (curve level) | r_k half-width | Size pinned (×2) at F = $2 |
|---|---|---|
| 1 (near 0%) | 1e-3 | ~$667 |
| 10 (+900%) | 1e-4 | ~$6,700 |
| 100 | 1e-5 | ~$67,000 |
| 1,000 | 1e-6 | ~$670,000 |

So the threshold is about **F · (1 + C) / (6ε)**. The reviewer's decode got returns back to 1e-6 at 1 + C ≈ 123. On
the profile every close is a point (full resolution), so consecutive pairs always exist. A downsampled feed chart keeps
only some of them. F-23's contract still holds: these values are printed on screen while scrubbing, so the payload
carries nothing the screen does not. The leak is in what the screen prints.

**Closed by the owner's decision of 2026-11-02 (option 1).** From +100% the cumulative value prints, and goes out, at about 3 significant figures (`curvePct`, `wireCurve`). The decoded return's uncertainty from two consecutive points is then at least the row's own (0.1 point). `lib/f23-chart-sigfigs.test.ts` shows this on a record compounded past +12,000%, where one absolute decimal had given it back 10x finer than the row. Below +100% the curve is unchanged, and there 2ε/(1 + C) ≥ ε already holds. Residual (independent review, 2026-11-02): this bounds each single decode. Intersecting it with the row's own interval, or with the same close decoded from another range's curve (each dated range re-compounds from 0%), can narrow it below the row's 0.1 point, by a small factor at most (two or three overlapping intervals of similar width). That is printed on screen too.

The options that were put to the owner:
1. Print the cumulative value at about 3 significant figures once it is above ±100% (e.g. "+1,230%", not "+1,234.5%"),
   and send it at that precision: the error on r_k then stays near 1e-3 whatever the curve level.
2. Draw the "same size" line as a simple sum of returns (Σ r_i) instead of compounding: consecutive points then differ by
   r_k itself at one decimal, the same as the row.

## Statement for the PR
From a close's own published return at one decimal of a percent, **positions below about F / (3 × 0.0005), about $1,300
for a $2 round-trip commission (about $6,700 for $10), can still have their size estimated within a factor of two**, from
the published return and the day's prices, as the screen itself already allows. **Through the compounding chart the
threshold rises to about F · (1 + C) / (6 × 0.0005)**, where 1 + C is the record's curve level: ~$6,700 at 1 + C = 10 and
~$67,000 at 100, for F = $2. That is what the screen prints while scrubbing; closing it means changing the chart's
display (the options above, owner's call). **Closed 2026-11-02:** the owner chose option 1, so above +100% the curve now prints 3 significant figures and gives no return back finer than the row. The threshold is then the per-close one above (~$1,300 at F = $2) at any curve level. Before F-23, every position size could be recovered from the payloads.

Same-day order (the chart's spread of one day's closes) reveals only the order the list already shows. Hold days at one
decimal (ε = 0.05 day) and close days add no fee information.

Any caveat to the consent words (`lib/copy.ts:80`, `:82`) is for the owner and the AI legal committee, not this build
(decision, cycle 4).
