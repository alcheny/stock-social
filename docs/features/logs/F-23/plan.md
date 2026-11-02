# F-23 · Implementation plan (UX lead, 2026-11-01, main at 63f48f4)

Input: the feature file (decisions and ACs fixed by the approval council, cycles 3 and 4), the engineer's
`inventory.md`, the code it cites. Start conditions are met: F3-2 (#85) and F-26 (#87) are on main. The feature
file still reads `Status: blocked`; only the owner or the committee updates it.

The rule in one line: **the server computes every figure from stored values, then sends only what the screen prints**
(returns at printed precision, dates as UTC days, hold days at one decimal, win rate as a whole percent). No stored
value, rank, interval or F-10 float changes.

## A. Design points (recommendation, then why)

1. **Rounding rule: `wire(v)`, as the engineer proposes.** Additive in `lib/format.ts`, beside `pct`/`tone` (F-19's
   one home). `wire(v)` returns the shortest decimal, starting at 1 decimal of a percent (3 decimals of the fraction)
   and going longer, such that `pct(w,1) === pct(v,1)`, `pct(w,0) === pct(v,0)`, `tone(w,1) === tone(v,1)` and
   `tone(w,0) === tone(v,0)`; at each length try round, then truncate; return `Number(string)` so JSON prints the
   short literal. Never coarser than 3 fraction decimals. `0` stays `0`; non-finite values pass through (pct prints
   them as it does today). Hold days: `Number(h.toFixed(1))` (idempotent with the sheet's `toFixed(1)`). Win rate:
   `Number((winRate*100).toFixed(0))`, exactly what profile (page.tsx:333) and pane print. Why: one function means one
   contract for every surface, and the 0-decimal check covers the chart's `aria-label` (total, drawdown). Unit tests:
   a sweep of 10^5 random values plus edges (±0.00049, ±0.0005, -0.99995, -0.999951, -0.9999999, 9.99949) asserting
   the four equalities and that no shorter candidate exists.
2. **Dates as UTC days: yes, but format explicitly in UTC instead of the 12:00 UTC trick.** Wire: packed charts carry
   integer day offsets from a `base` day (`base` = days since epoch); named fields carry `'YYYY-MM-DD'`. Client: one
   additive helper in `lib/date-text.ts`, `numericDay(d)` = `Intl.DateTimeFormat('en-US', {timeZone: 'UTC'})`, giving
   the same `M/D/YYYY` text as today's `toLocaleDateString('en-US')`. Use it at the three local-zone sites (pane
   "Last 5" rows `app/pane.tsx:112`, chart scrub subline and chart sheet in `chart.tsx`). Chart `<time dateTime>` →
   `'YYYY-MM-DD'`. `now` passed to `PerformanceChart` → the UTC day string (it is only used for `dateText`'s year once
   ranges come from the server, point 4). Why not noon-UTC: it is wrong in UTC+12..+14 and UTC-12, and point 5 places
   same-day closes at fractions of the day, so the noon guarantee would not hold anyway. Explicit UTC also removes a
   hydration mismatch that exists today (server renders in UTC, the browser re-renders in local time).
   **Visible change, stated:** a viewer whose local day differs from the UTC day of a close (e.g. a 02:00 UTC close
   seen at UTC-5, or a 23:00 UTC close at UTC+9) now sees the UTC day in the pane's rows and the chart's scrub/sheet,
   where today they see their local day. Acceptable: it is a date, not a figure, tone or Flat label; it is the
   decision's own rule ("sends dates as UTC days"); it matches what the server-rendered HTML, `dateText`, the chart
   ends, the status line, trade and month pages already print. The snapshot (AC 5) runs at `TZ=UTC` and shows no
   change; the PR names this change under `## Compliance` for the committee.
3. **The /pane JSON: `paneModel`, as the engineer proposes.** New pure `lib/pane-model.ts`:
   `paneModel(trades, open, openAsOf, state, now)` computes on stored values exactly what `ProfilePane` prints today:
   win rate (whole %), average (`wire`), worst (symbol + `wire`), since (UTC day), count, last 5 (id, symbol, day,
   `wire`), `paneEvidence` (range line as its printed string, New record flag), trust, `openSummary` (n, up, down,
   flat, `wire(avg)`), `combined` (n, `wire(avg)`), `openAsOf` (UTC day), and the chart (`feedPaneChart`, point 4
   format). `ProfilePane` takes `model` instead of `trades/open/openAsOf`; the feed (server) and the /pane route both
   call `paneModel`; `LazyPane` renders the fetched model and stops recomputing. The route never sends raw closes.
   Why: rounded inputs change tie-breaks and edges (e.g. worst of -5.04% and -5.03% both wire to -0.05; a 0.00001 close
   counts as a win but wires to 0), so only a server model keeps parity, and the same function on both paths makes
   pane/feed parity structural. Feed parity test: `paneModel(trades)` printed headline equals the profile's
   `(s.winRate*100).toFixed(0)` and `pct(s.avgReturn)` on a rounding-edge fixture (stored average 0.024499999, whose
   rounded closes would average to +2.5%).
4. **Profile chart: server-packed at full resolution, as the engineer proposes, with a size check first.**
   `profileChart(trades, now)` = `packChart` with `maxPoints = Infinity`, built from stored values (split the
   `packPoints → unpackPoints` round trip out of `paneChart`/`feedPaneChart` too, so no server figure is computed from
   rounded returns); every return, point value, `last`, `dd`, `min`, `max` through `wire`; `t0`/`t1` as days.
   `PerformanceChart` gets `chart` on the profile; the `points` path stays for any remaining caller and `packPoints`
   itself rounds (AC 9). **Budget:** estimate for the 2,828-close e2e record (a close every 7 h, ~825 days): trades
   ~107 KB, points ALL 2,828 + 1Y ~1,250 + 3M ~310 + 1M ~100 + 1W ~25 at ~16 B ≈ 72 KB, so ~180 KB raw, ~215 KB once
   escaped in the RSC flight, against ~150 KB for today's `packPoints`: about +65 KB. Step 1 of the build measures the
   heavy profile's HTML on main; if headroom under 400 KB is below 100 KB, use in order: (a) sub-ranges send values
   only plus a start offset into ALL's closes (x and close index derived; full resolution keeps them a suffix of
   ALL), (b) the profile loads non-ALL ranges from `/pane-chart?v=2&full=1` on first tab pick, as the feed's stand-in
   does. Never downsample the profile (F-1 round 7 keeps it full resolution).
5. **Same-day order: list-order `index` is the tie-break; points never share an x.** Within a UTC day the server
   orders closes oldest-first by list order (reverse `index`) and the client places the k-th of m same-day points at
   `day + (k+1)/(m+1)` of the day. Why: keyboard order already follows `pts` order, but with a shared x a pointer
   drag (`nearestIndex`) can only ever reach the first of the tie, so release would open the wrong trade. The spread
   reveals only order, which the list already shows. Unit: two closes on one day keep order through
   pack → JSON → unpack, have distinct x, `stepIndex` reaches each, and `nearestIndex` at each x picks its own trade.
   e2e: release on each opens its own sheet; Enter after ArrowRight opens the second.
6. **Cache re-key: `?v=2` on both routes plus `v: 2` in the body; the unversioned URL keeps working and serves the new
   body.** One constant `PAYLOAD_V = 2` (`lib/chart-series.ts`) used by `paneChartSrc`, `LazyPane` and both routes;
   clients treat a body whose `v` differs as a failed load (existing retry/"could not be loaded" paths). Why keep the
   old URL: a 404 on it does not purge anything (a cache serves its stored body without asking the origin; old bodies
   age out within 60 s either way), while existing tests (F-26's held-note scan of `/pane` and `/pane-chart`, F-6, F-7,
   F-11) keep their coverage; what the AC needs is that no new client ever asks for a key that may hold a pre-change
   body, which the version in the URL guarantees. Feed and profile HTML are dynamic (verify no `revalidate` on them).
7. **Status-line `<time dateTime>`: split by what the time is.** Trade-derived dates (`Last close`, `Record since` /
   first entry) and every date in the pane's static status (cached JSON) go to `'YYYY-MM-DD'`. Account and sync
   instants on the live profile (`updated 2 hours ago`, disconnected, account removed) stay out: they carry no trade
   information, the visible text already shows hour precision ("2 hours ago"), F-11's e2e pins them, and they are a
   separate consent item already noted in `lib/copy.ts` (ponytail above `CONSENT_SCOPE_LINE`). Mark them with
   `data-instant` (additive flag on `Segment`, rendered by `app/status-line.tsx`) so the scan allow-lists exactly
   those elements and nothing else.
8. **The scan test (`e2e/f23-payload-scan.spec.ts`).** Fixture trader `f23_scan_e2e` (fictional, verified, connected,
   recent so it is on feed page 1 under the shared feed lock): close A `0.123456789` at 2026-10-14T14:31:07.123Z,
   close B `-0.0504999` the same day at 16:02:41 (worst-tie edge), close C `-0.99987654` (near -100%), close D
   `0.0000049` (Flat, a win), a rounding-edge set for the average, one published thesis, sell ids non-numeric
   (`f23-a`…); open position `0.087654321` fetched 09:12:45; record-status sync at a known instant. Signed out
   (fresh context, no cookies), fetch: `/`, `/u/h`, `/u/h?closes=100`, each with `RSC: 1` and with `?_rsc=x`,
   `/u/h/pane` and `?v=2`, `/u/h/pane-chart` and `?v=2`, the trade and month pages of A (HTML + flight), their
   `og:image:alt`/`twitter:image:alt`; then in a 360 px browser: load feed, scroll to append a page, open the pane,
   scrub, open the sheet, open a Similar sheet, open the profile chart and each range tab, capturing every
   document/fetch response body and, at the end, every `data-*`/`aria-*` value and the page's ARIA snapshot.
   Detectors (no generic "too many decimals" regex, so ids, SVG coordinates and hashes cannot trip it):
   (a) planted digits: none of `0.1234`, `12.34`, `0.0876`, `8.765`, `0.9998`, `99.987`, `0.0504`, `5.049` anywhere;
   (b) named fields: walk every JSON body and decoded flight object; any key in the return/stat set (`returnPct`,
   `return_pct`, `unrealized_pct`, `avg`, `avgReturn`, `last`, `dd`, `min`, `max`, `value`, `winRate`, `open[]`) must
   satisfy `wire(v) === v`; packed charts are decoded by schema (each trade's return, each point's value, x an integer
   day); (c) times: no `/\b1\d{12}\b/` (13-digit epoch), no `$D` or ISO string with a time part other than the
   fixture's allow-listed `data-instant` sync instant, no `14:31`/`16:02`/`09:12`. A self-check runs the detectors
   against the pre-change payloads (saved fixture strings) and must fail, so the scan is proven to bite.
9. **Fee-recovery probe: `docs/features/logs/F-23/probe.md`, linked from the PR.** Fictional model: returns include
   fees (`lib/trades.ts` subtracts entry and exit fees), flat commission F per round trip, the attacker knows the
   day's execution prices, so gross return g is known and fee drag d = g − r = F/N (N = position cost). Published r
   has half-width ε; N is pinned within a factor of 2 when d ≥ 3ε, i.e. N ≤ F/(3ε). At one decimal of a percent
   (ε = 0.0005): F = $2 → N ≤ ~$1,333; F = $10 → ~$6,667; fees merely detectable (an upper bound on size) up to
   F/ε = $4,000 / $20,000. For comparison: 4 fraction decimals (ε = 5e-5) → $13,333 at F = $2; today's 1e-8 →
   ~$133 million (every size). The probe states: **at one decimal, positions below about F/(3·0.0005), ~$1,300 for a
   $2 round-trip commission, still reveal size**; caveats to the consent words are for the owner and the AI legal
   committee (decision, cycle 4), not this build.

## B. Build order (engineer)

1. On main, before any change: record the display snapshot (`lib/snapshots/f23-display.json`: visible text and tone
   classes of profile, pane, feed and Similar-sheet pane for the scan fixture plus the demo traders, `TZ=UTC`) and
   measure the heavy profile HTML size (point 4).
2. `wire`, `numericDay`, day helpers, `PAYLOAD_V` + unit tests.
3. `packChart`/`unpackChart` day format, spread, `wire`; split stored-value path; `profileChart`; `packPoints` rounds.
4. `paneModel`; `ProfilePane`, `LazyPane`, feed rows on the model; /pane and /pane-chart routes (`v`).
5. Profile: `chart={profileChart(...)}`, `now` as day; chart `<time>`; status `iso` days + `data-instant`.
6. Tests (section D), then the probe, then the 360 px pass (section E).

## C. Every state (nothing new is drawn; each must render identically)
Signed out (shared link) and signed in; empty record (no chart, <2 closes); new trader (1 close, importing record
404s on /pane as today); all losses; all Flat; near -100%; demo data (Demo badge kept); public-filer record
(`no-store` kept); failed import (incomplete line kept); frozen record; open positions with and without closes;
loading (stand-in → full chart swap keeps the scrub position); error (`/pane` failure → "could not be loaded"; a body
with the wrong `v` → same path; `/pane-chart` failure → stand-in stays).

## D. Acceptance criteria → test
| AC | Test |
|---|---|
| 1 /pane, /pane-chart, feed HTML: printed precision, UTC days | `e2e/f23-payload-scan.spec.ts` (point 8) |
| 2 `unrealized_pct`, `openAsOf` | same scan: open fixture + `lib/pane-model.test.ts` (open block is `wire`d, `openAsOf` a day) |
| 3 pane headline = profile headline, rounding edge | `lib/pane-model.test.ts` parity (point 3) + scan fixture text compare |
| 4 same-day order, scrub opens right trade | `lib/chart-series.f23.test.ts` + e2e step in the scan spec (point 5) |
| 5 no displayed figure, tone or Flat change | `e2e/f23-display.spec.ts` vs snapshot from build step 1 |
| 6 ranking and CI tests unchanged | `npm test` with those files untouched; test count not lower |
| 7 cache key changes | unit: `paneChartSrc` and LazyPane URL carry `v=2`; e2e: both bodies carry `v: 2`, headers unchanged |
| 8 one scan of every signed-out response | the scan spec (point 8) |
| 9 `packPoints` rounded, UTC day, scrub order | new test in `lib/paging.test.ts` (A at 14:31:07 → day, `wire(0.123456789)`) |
| 10 average, bounds, headline rounded | `lib/pane-model.test.ts` + scan detector (b) |
| 11 probe states the smallest size at risk | `probe.md`, cited in the PR body |

**Existing assertions the decision itself changes (owner-visible; listed in the PR, none deleted, count not lower):**
`lib/paging.test.ts:55-56` (1e-8 return, 2-decimal hold) and `lib/downsample.test.ts:84-100` (exact `last`/`dd`,
minute floor, 5e-7 return) become the stricter F-23 contract (`wire(stored)`, printed equality, day floor);
`e2e/fixes-labels.spec.ts:381` (chart end `datetime` = ISO ms) becomes `'YYYY-MM-DD'`; any F-11 assertion on the
Last-close `datetime`. Each replaced assertion is at least as strict about what it checked.

## E. UX checks at 360 px (committee review, Playwright)
First-time viewer, signed out, from a shared profile link and from the feed: headline, chart header and aria-label,
range tabs, drag-scrub and release on two same-day closes (each opens its own sheet), keyboard ArrowRight/Enter/
Escape, chart ends dates, sheet "Held N.N days", pane rows dates and figures, worst line, 95% range line, New record,
open positions and as-of date, combined line, Similar sheet pane (lazy), "could not be loaded" path (route blocked),
F3 line in view on open, 44 px targets, screen-reader names match visible text. Repeat with the browser at
`Pacific/Auckland` and `America/Los_Angeles` time zones: dates show the UTC day, no hydration warning.
First-time trader via `/login/dev` (demo connect): own profile renders the same figures; private surfaces untouched
(out of scope), owner prompts unchanged.

## F. Files touched
New: `lib/pane-model.ts` (+test), `lib/chart-series.f23.test.ts`, `lib/format.f23.test.ts`,
`e2e/f23-payload-scan.spec.ts`, `e2e/f23-display.spec.ts`, `lib/snapshots/f23-display.json`,
`docs/features/logs/F-23/probe.md`.
Edited (additive in shared files): `lib/format.ts` (`wire`), `lib/date-text.ts` (`numericDay`, `utcDay`),
`lib/paging.ts` (`packPoints`), `lib/chart-series.ts`, `app/pane.tsx`, `app/lazy-pane.tsx`, `app/feed-rows.tsx`
(one call), `app/u/[handle]/chart.tsx`, `app/u/[handle]/page.tsx` (line 367 only), both routes,
`lib/record-status.ts` + `app/status-line.tsx` (day `iso`, `data-instant`), the tests in section D.
Not touched: `docs/POLICY.md`, `.github/`, `scripts/` guardrails, `scripts/invariants.test.ts`, the feature file,
`db/schema.sql`, `lib/trades.ts`, ranking/CI code and tests, package files (no dependency).

## G. Compliance (COMPLIANCE §1)
1 Performance shown: yes, unchanged figures and F3 lines (§2). 2 Personal data sent: yes, less of it (§3: returns,
dates, hold days, unrealized percent, now at printed precision; closes no longer sent raw). 3 Money: no. 4 Messages,
tracking: no. 5 User text: theses unchanged (published only, F-26). 6 Accounts: no. 7 Vendor/dependency: no.
8 Screen reader/keyboard: accessible names unchanged and no finer than visible text; keyboard scrub kept; pointer
reach of same-day closes improved. 9 Security posture: public endpoints keep their gates and cache headers.
10 Claims: none new.

## H. Only the owner can clear
- The probe's residual risk (small positions under a flat commission still reveal size at one decimal) and any
  caveat to the consent words (`lib/copy.ts:80`, `:82`): owner + AI legal committee.
- Status-line account/sync instants left at full precision (point 7) and their consent wording (existing ponytail).
- The visible date change for viewers whose local day differs from the UTC day (point 2).
- The replaced precision assertions in existing tests (section D) if the Gate flags them.
