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
(below, after the revised plan is reviewed)
