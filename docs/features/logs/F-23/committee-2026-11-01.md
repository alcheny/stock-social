# F-23 committee log, 2026-11-01

Build session for F-23 (`docs/features/F-23-public-payload-precision.md`), branch `claude/f23-payload-precision`,
under the owner's instruction of 2026-11-01 (develop autonomously; open questions decided by the committee's
recommended option after debate).

## Prerequisites
F3-2 (#85, 8e3e9a5), F-26 (#87, 67825e8), F-11 (#85) and F-20 (#77, 63f48f4) are on main. Build started from 63f48f4.
F-21 (slot partner) is draft and not built: this cycle owns the pane, pane-chart and public payload files.

## Round 1
- Engineer's inventory: `inventory.md` (every signed-out payload that carried a return, stat or time).
- UX lead's plan: `plan.md` (design points A1–A9, build order, AC → test map, states, 360 px checks, files).
- Business lead: DEMANDS (8). Engineer: DEMANDS (9). Summarised with their resolution below.

## Decisions (round 2; each also appended to the feature file)
1. **Helpers live in `lib/public-wire.ts`**, not `lib/format.ts` (F-19's shared file is untouched; one import is the
   contract). Business lead and engineer, over the plan's A1 placement.
2. **`wirePct` chooses the value from the prints alone**: the 1-decimal percent; for |x| in [n.45%, n.5%) (where the
   1-decimal value would move the 0-decimal print of the chart's accessible name) the fixed stand-in n.46%, or n.54%
   where float error misprints the literal; one fixed value (-0.99999999) for the "≈-100%" band; otherwise the shortest
   decimal printing as stored (the extra digits pct() itself prints near -100%). Tested: four prints and tones equal over
   a 20,000 sweep, idempotent over 100,000, monotone (so wired min/max bound wired points), Flat stays Flat.
   Hold days `Number(h.toFixed(1))`; win rate the printed whole percent.
3. **Dates are UTC days, printed in UTC.** Wire: day numbers (packed charts, rows) or `'YYYY-MM-DD'` (named fields,
   `<time dateTime>`). The browser prints with `numericDay`/`dateText` in UTC; no noon-UTC rebuild (wrong at UTC±12–14;
   UX lead, agreed by both). Visible change, accepted: a viewer whose local day differs from the UTC day now sees the
   UTC day in the pane rows and the chart scrub line and sheet (a date, not a figure, tone or Flat label; it is what the
   server-rendered HTML and every other date in the app print; it ends a server/browser mismatch). Listed for the owner.
4. **Same-day closes**: the wire x is an integer day; the browser spreads the k-th of m points of one day at
   (k+1)/(m+1) of the day, over the points kept after downsampling. Range ends decode to the first day's start and the
   last day's end, so every point is inside the chart. Reveals only order, which the list shows.
5. **Cache re-key**: `PAYLOAD_V = 2`, in the URL (`?v=2`, set by `paneChartSrc` and `LazyPane`) and the body (`v`).
   **The bare URLs answer 404 no-store** (business lead demand 3, over the plan's keep-serving option): a tab running
   pre-F-23 code shows "could not be loaded" instead of misreading a new body. Clients treat another `v` as a failed
   load (the chart forgets the promise and retries). Existing e2e calls moved to `?v=2` (listed in the PR).
6. **Status-line `<time dateTime>`**: a printed date carries its UTC day; a relative time ("2 hours ago", live pages
   only) carries its UTC hour (`YYYY-MM-DDTHH:00Z`): the line prints hours. Named carve-out from "no time finer than a
   UTC day" for account/sync instants only, which carry no trade data (business lead demand 4: by name, not silently).
7. **Profile chart**: server-packed at full resolution (`profileChart`), every figure from stored values; the browser
   compounds nothing. Measured on the 2,828-close e2e record: profile HTML 269 KB against the 400 KB budget, so no
   fallback is taken. Lazy range loading on the profile (engineer's fallback b) would be new behaviour: out of scope
   (business lead demand 6).
8. **`/pane` body**: `{ v, state, model, chart, status, options }`. `paneModel` (lib/pane-model.ts) computes every printed
   figure from stored values; the feed renders the pane from the same function on the server. No raw closes, no
   `unrealized_pct` array, no ms times.
9. **`now` to client components**: the start of the UTC day (`wireToday`); the chart reads only its UTC year from it.
10. **Existing assertions changed by the decision itself** (none deleted, each at least as strict): `lib/paging.test.ts`
    (1e-8 return, 2-decimal hold, ms close → `wirePct`, 1 decimal, UTC day), `lib/downsample.test.ts` (exact totals and
    minute floor → `wirePct` of the stored figure and UTC days; `paneChartSrc` with `?v=2`; `packValue` 6 decimals →
    printed precision; `heavyRecord` built from stored values via `chartPoints`), `lib/pane-evidence.test.ts` (evidence
    asserted in `lib/pane-model.ts` and the route's `paneModel(...)` call), `lib/user-note.test.ts` (sheet date via
    `numericDay`), `lib/sync-removed-flap.test.ts` (status `iso` as the UTC day), `e2e/f6-open-positions.spec.ts` (the
    model's open block and `openAsOf` day), `e2e/fixes-labels-status.spec.ts` (days; the relative time to the hour),
    `e2e/fixes-labels.spec.ts:381` (chart end `datetime` as the day), and `?v=2` in f6, f7, f26, follow, options,
    fixes-labels-status.
11. **Scope** (business lead demand 8): `paneModel` and `profileChart` are the only refactors, both needed for parity.
12. **Probe**: `probe.md`: at one decimal, positions under about $1,300 ($2 round-trip commission) still reveal size.
    Residual risk and any consent caveat go to the owner and the AI legal committee.

## Round 2 sign-off
- Business lead: SIGN (conditions for the build verdict: the display and scan specs, the self-check, the Compliance
  list in the PR).
- Engineer: SIGN after two more demands, both done: ALL runs edge to edge (t0/t1 from its first and last drawn point,
  dated ranges keep day ends); the scan's hash mask no longer hides float noise (a mask needs a hex letter), an
  unparsed packed chart is a finding, two noise self-checks. Accepted the display spec computing expectations from
  stored values with main's unchanged formatters instead of a snapshot recorded on main.

## Build, QA, user test, review (round 3)
- Tests first: `lib/f23-public-wire.test.ts`, `lib/chart-series.f23.test.ts`, `lib/pane-model.test.ts`,
  `e2e/f23-display.spec.ts`, `e2e/f23-payload-scan.spec.ts`; then the code.
- Tester: clean except Medium 1, fixed: a dense record (4,700 closes, 2 h apart) weighed 445 KB on the profile. Fix
  (the business lead's allowed fallback a): when nothing is downsampled, the chart goes out in a compact form (`sfx`:
  ALL as [day, value] pairs, row indices from position, dated ranges as values only); decoded to exactly the regular
  form (unit test); e2e pins the dense profile under 400 KB. Lows: dated ranges run to the end of today's UTC day
  (ponytail in `lib/chart-series.ts`); `follow.spec.ts:171` flaked once (pre-existing, passed alone); `/pane-chart`
  serves an importing record (pre-existing, not F-23's scope).
- Independent code review: blocking 1 fixed (the drawdown prints negated: rounded as printed, `-wirePct(-dd)`, so
  "max drawdown -99.999%" is unchanged); 2 fixed (a dated range's start sits on its left edge); 3 fixed (near -100% the
  wire value comes from the printed digits, at most one more, never the stored ones; 200,000-value test); 4 fixed (the
  dead `points` path of the chart removed: the browser compounds nothing).
- User test at 360 px (UX lead, business lead): compliance PASS both. Usability demands, all fixed: (1) closes at the
  same instant now run in list order in the chart (the last key step is the list's top row); (2) one UTC day's closes
  drawn under 2 CSS px apart are one pointer target, the newest, so a right-edge release opens the top row; (3) a
  one-day chart prints one end date ("First and last close ‹date›"); (4) the failed line has `role="status"` and its
  link does not wrap before the arrow. Business lead demand 2: `e2e/f23-display.spec.ts` checks the last key step and
  the right-edge release on the three seeded demo records, in UTC and Pacific/Auckland.

## Round 4: user test re-check (360 px, UTC and Pacific/Auckland, HEAD 65ddada)
- UX lead: compliance PASS, usability PASS. All four demands were verified on the demo records: same-instant order matches the list, a right-edge release opens the top row, a one-day chart has one end date, and the failed line has `role="status"` and does not wrap. The note dates (#95) show in the chart sheet. For later, not F-23: pane rows print "11/1/2026" where profile rows print "Nov 1".
- Business lead: compliance PASS, usability PASS. Demands 1–3 are met. The probe's residual risk stays with the owner and the AI legal committee.

## Round 5: independent review of #97 (orchestrator), narrow BLOCK, all items done
- MEDIUM, probe accuracy: the compounding chart is a second channel. Each point is printed at one absolute decimal, so
  r_k = (1 + C_k)/(1 + C_{k−1}) − 1 comes back to about 2ε/(1 + C), and the size threshold is about F·(1 + C)/(6ε): ~$6,700
  at 1 + C = 10, ~$67,000 at 100 (F = $2). The screen prints these values too, so F-23's contract holds. `probe.md` is
  corrected. Two options are listed for the owner, each changing the CH-1 display: cumulative values at ~3 significant
  figures above ±100%, or a simple-sum line.
- MEDIUM, sitemap: `/sitemap.xml` published each ticker's newest close to the millisecond (`lib/ticker.ts`
  `lastModified`). It now publishes that close's UTC day (midnight), tested in `lib/sitemap.test.ts`, and the scan spec
  checks `/sitemap.xml`.
- LOW: the scan spec now covers `/t/<symbol>`, `/t/compare`, `/t` and the feed's paging action.
- Info: a 4,700-close profile with 25% notes is about 407 KB, not a regression; listed under Known limits.

## 2026-11-02: owner decision on chart precision (closes the probe's curve channel)
- Decision (owner, 2026-11-02): above ±100% the cumulative chart value prints at about 3 significant figures; below,
  unchanged. Built on `claude/f23-chart-sigfigs`: `lib/format.ts#curvePct` (display), `lib/public-wire.ts#wireCurve`
  (payload: chosen from the print, monotone, idempotent), the chart header and accessible name, and the packed chart's
  point values, totals and y bounds. The OG and share images draw a line only and print no cumulative figure.
- `PAYLOAD_V` stays 2: the body's structure is unchanged, and the in-flight PRs keep `?v=2`. An edge cache can serve a
  pre-change body (finer curve values) for at most its 60 s max-age after deploy. Listed as a known limit.
- Tests: `lib/f23-chart-sigfigs.test.ts` (formatter, wire rule, a curve decode closing the probe item);
  `e2e/f23-chart-sigfigs.spec.ts` (header, scrub, name and payload on a +381% record); scan spec (curve fields checked
  with `wireCurve`, plus an old-precision self-check).
