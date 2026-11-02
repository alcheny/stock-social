# F-23 · Engineer's inventory of public payloads (2026-11-01, main at 63f48f4)

Input to the plan. Every place a signed-out response carries a return, a stat or a time to the client, and what it
carries today. Server components send only their rendered text to the client; the leaks are client-component props
(RSC flight data), JSON routes and attributes.

| # | Surface | What leaks today | Consumer |
|---|---|---|---|
| 1 | `GET /u/<h>/pane` (`app/u/[handle]/pane/route.ts`) | every close: `returnPct` (float8), `holdingDays`, `closedAt` and `openedAt` in ms; `open` (`unrealized_pct` float8), `openAsOf` ms; `public, max-age=60` | `app/lazy-pane.tsx` (client) renders `ProfilePane` and **computes on the client**: `paneSummary` (win rate, average, worst, since, last 5), `openSummary`, `combined`, `paneEvidence` (95% range line, New record), `feedPaneChart` |
| 2 | `GET /u/<h>/pane-chart` (`lib/chart-series.ts#paneChart`) | per close: return to 6 decimals; per point: minutes after `base`, cumulative value to 6 decimals; per range: `t0`/`t1` minutes, `last`, `dd`, `min`, `max` unrounded; `public, max-age=60` | `PerformanceChart` (client) |
| 3 | Feed HTML (`app/feed-rows.tsx` → `ProfilePane` server-rendered) | the pane's `chart` prop (`feedPaneChart`: same format as 2, or the `lite` stand-in at 4 decimals) is a client prop → RSC flight in the HTML | `PerformanceChart` |
| 4 | Profile HTML (`app/u/[handle]/page.tsx:367`) | `points={packPoints(...)}`: return to 1e-8, `closedAt` ms, hold days 2 decimals; `now` as a full Date | `PerformanceChart` computes every range series, total, drawdown on the client from these points |
| 5 | Chart `<time dateTime>` (`app/u/[handle]/chart.tsx:207-208`) | `toISOString()` of the first/last close: ms | HTML attribute |
| 6 | Feed pager action (RSC) | same as 3 for appended pages | — |
| 7 | Status line `<time dateTime>` (`app/status-line.tsx`, `lib/record-status.ts`) | sync/connection instants (ISO ms) | the visible text shows relative times ("2 h ago") — record-status times, not trade times |

Not leaking (server components, text only): the pane figures in the feed, the profile headline/CI/stats sections,
trade rows, OG images and their alt text (printed strings), trade and month pages (only `TradeShare` is a client
component; it gets a printed title). Owner-only prompts (`SharePrompt`, `NewTradesPrompt`) are private (out of scope).

## Display facts that constrain the fix
- Returns print through `lib/format.ts#pct` at 1 decimal (chart header, rows, figures) and at 0 decimals (chart
  `aria-label`: total and drawdown); near −100% `pct` prints up to 4 more digits. Tone follows the printed sign.
- Hold days print `toFixed(1)` (chart sheet).
- Dates print `toLocaleDateString('en-US')` (local zone) and `dateText` — today a 14:31 UTC close can print a
  different day in a far-east zone than on the server.
- The profile computes chart ranges, cumulative values and the header total **in the browser** from `points`; if
  `points` carried rounded returns, compounding them would change printed totals and scrub values (drift ~ √n × 0.03 pt).
- `paneChart` itself runs `packPoints` → `unpackPoints` internally, so rounding inside `packPoints` would make the
  server compute figures from rounded returns unless that path is split.
- Same-day closes: the list order (`byListOrder`: close time, then id, newest first) is sent as `index` in packed
  trades, so a day-precision time keeps order through the index.
- Heavy profile HTML budget: `e2e/app.spec.ts` (2,828 closes) < 400 KB.
