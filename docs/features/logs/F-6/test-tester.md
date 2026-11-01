# F-6 tester log (branch claude/f6-open-positions, HEAD b01e27f)

Scope: conformance to the F-6 acceptance criteria and the signed plan (docs/features/logs/F-6/plan.md), edge cases,
heavy use, 360 px usability. Own server on :3100 (`next start`, prebuilt `.next`), own `f6qa_*` fixture traders
(deleted afterwards), Playwright at 360x800. Screenshots: `screenshots/tester-*.png`.

## Checks run
- `node --test lib/open-split.test.ts lib/feed.open.test.ts`: 10/10 pass.
- `LOAD=1 node --expose-gc --test lib/feed.load.test.ts`: 4 pass, 2 fail (see "Environment" below; not attributable to
  F-6). `# load:` lines:
  - 500 traders (12 heavy), 66,160 closes: p95 page 1 150 ms, page 2 56 ms, page 3 32 ms, all 138 ms (median 32 ms, 60 pages); cold page 1 269 ms
  - 500 traders (50 heavy), 244,000 closes: p95 page 1 198 ms, page 2 71 ms, page 3 62 ms, all 171 ms (median 42 ms); cold page 1 722 ms
  - section on every page, 50 heavy: signed-out p95 136 ms, signed-in p95 155 ms
  - one-period fixture: signed-out p95 149 ms (page 1 212 ms, all 149 ms, cold 382 ms)
  - Every timing assertion (p95 < 400 ms signed out, < 800 ms signed in) passed: the extra `open_positions` read keeps
    the feed within the existing budgets.
- Fixture traders and what they showed (all as the plan says unless listed under Findings):
  - `f6qa_many` (connected, 5 fresh closes, 202 open positions incl. one long symbol in two accounts at −99.99% and
    +5432.1%): realized grid, unrealized grid "202 open positions, 80 up, 121 down, 1 flat · +6.1%", combined
    "+6.1% avg / result (207 results)" (hand-checked), evidence sentence, chart note, "as of Oct 30, 2026"; profile
    server response 179 ms with 202 rows; og:description carries the open line. Feed page 1 (452 ms client-side) has
    its card line "Also open: 202 positions · 80 up, 121 down, 1 flat · +6.1% avg unrealized" (green `up`, words
    beside the color) and the pane grid, combined line and chart note.
  - `f6qa_one` (1 position −4%): "1 open position, 0 up, 1 down", "… · −4.0% unrealized" (singular wording correct).
  - `f6qa_zero` (0, −0.0004, +0.0004): "0 up, 0 down, 3 flat", 0.0% uncolored everywhere; combined 0.0% uncolored.
  - `f6qa_nan` / `f6qa_allnan` (NaN rows): dropped from the aggregates; all-NaN renders no `data-open` node. The
    list row prints "NaN%", but `lib/broker.ts#unrealizedPct` can't produce NaN (cost, price, units all > 0), so no
    finding.
  - `f6qa_failed`, `f6qa_failedopen`: grids and line beside the existing incomplete line; open-only failed record shows
    the unrealized grid plus "No closed trades, so there are no realized results."
  - `f6qa_importing`: no `data-open` node (TR-3); list as before. `f6qa_noconsent`: no positions at all.
    `f6qa_deleted`: 404 and excluded from /t. `f6qa_demo` and seed `momentum_maya`: zero `data-open` nodes.
  - `/t/F6QSHR` (4 eligible holders plus importing, no-consent, deleted and demo holders): "4 open positions · 0 up,
    4 down · −51.0% avg unrealized, held by 4 traders" (hand-checked: excludes the four ineligible ones), no handles
    or links, also in the no-closes branch.
  - `/how`: the four F-6 lines present. Footer disclaimer present on every page visited.
  - No new interactive elements, so no new tap targets. Muted text rgb(107,107,120) and up green rgb(21,128,61) on
    #fafafa both pass 4.5:1. Every tone comes with a sign and up/down words.

## Findings

### Medium 1 (usability, 360 px): a large unrealized average overflows its stat card and scrolls the page sideways
The unrealized grid puts the average in `.stat big` (36 px). A four-digit percent doesn't fit a half-width card at
360 px and the page gets a horizontal scroll (`scrollWidth` 383). Open positions held a long time reach these values
much more easily than an average closed-trade return does, so F-6 makes this case reachable.
Repro: a connected trader with no closes and open positions at −0.999 and +123.45 (avg +6122.6%); open `/u/<handle>`
at 360x800; `document.documentElement.scrollWidth` = 383; "+6122.6%" sticks out past the card edge
(screenshots/tester-u_f6qa_onlyopen.png). The same grid is used in the feed pane, and the combined line wraps
correctly, so only the big stat value needs a fix.

### Medium 2 (spec, AC1/AC6): the share card shows realized only for a trader with open positions
AC1 lists "share card at every size" and AC6 asks for e2e on the share card. On this branch `lib/record-card.ts` and
`app/u/[handle]/record-card-data.ts` read only `closed_trades`: the unfurl, square and story images and their alt text
show the realized figures and say nothing about open positions. The plan gives these to "the share card session", but
the coordination map merges F-6 **before** F-4. So once this merges, a trader who holds losers shares a realized-only
card, which is exactly the flattering picture F-6 exists to stop.
Repro: `f6qa_many`-style trader (202 open positions); GET `/u/<handle>/opengraph-image` or `/u/<handle>/story`: no open
positions on the image; `og:image:alt` has no open line. Don't mark F-6's AC1/AC6 done until the share-card part
lands. Alternatively, record in the feature file that it ships with F-4.

### Low 1 (spec): /t/compare shows no open-positions line when neither stock has closed trades
Plan §4: "/t/compare: one line per column". When both sides are empty, the page returns the `bothEmpty` message without
columns and drops the open lines. The single-stock page does show them in its no-closes branch.
Repro: `/t/compare?a=F6QSHR&b=Q001` where both symbols have open positions from connected traders and no closes. Each
`/t/<sym>` shows "Open positions in …", but compare shows none.

### Low 2 (pre-existing, not F-6): a very long symbol in the profile open-positions list scrolls the page sideways
`ul.positions` rows don't wrap. With symbol `F6QAVERYLONGSYMBOLNAME.WARRANT-2030` held in two accounts, `scrollWidth`
is 452 at 360 px (screenshots/tester-u_f6qa_many.png). The row markup comes from TR-4, not this branch. Recorded so the
F-6 360 px claim isn't read as covering it.

## Environment
`feed.load.test.ts` cases "fix round 2" and "fix round 3" failed on page identity, not timing. The actual page 2
contained `ni_e2e_*` traders from another process's concurrent Playwright run on the shared database, and the test reads
the global feed list. F-6 doesn't change the list or ranking (`openOf` only adds a map). Re-run these two on a quiet
database before merge. Separately, something on the shared DB deleted my `f6qa_*` users once mid-run (a cleanup that
matches `f6%`, by the look of it), so I re-seeded and re-ran everything.
