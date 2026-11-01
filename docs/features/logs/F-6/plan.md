# F-6 plan: open positions in every number (committee plan, round 2)

Feature: docs/features/F-6-open-positions.md (ready). Round 1: plan-round1-{ux-lead,business-lead,engineer}.md.
Scope: profile (headline, evidence, chart note, open list, unfurl description), feed card and pane, `/t/[symbol]`,
`/t/compare`, `/how` copy, `lib/open-split.ts`, an additive read in `lib/feed.ts`. Share card images: other session
(it reuses `lib/open-split.ts` and `OPEN` copy). No schema, vendor or dependency change. `chart.tsx` is untouched.
Feed ranking and the TR-9 lower bound are unchanged by F-6.

## 1. Decisions
1. **Realized leads; the unrealized row sits directly beneath at the same size** (TR-4: "as prominent as the
   headline"; TR-9: the headline average keeps its range; the no-positions page stays byte-identical).
2. **One combined figure, as a single line, not a grid:** "Including open positions at current value: −1.5% avg /
   position (26 results)". No combined win rate or "above 0%" figure. Why: the owner's reason for F-6 is that
   realized-only numbers flatter a trader who sells winners and holds losers; one number that counts every result,
   open ones at current value, shows that directly (+5.0% realized can read −1.5% including open). The average is the
   same kind of number as the headline (equal-weight mean per result), only wider, and the label says so (AC2). The
   win-rate mix that BL objected to (an open position has not "won") is dropped, and there is no third `.stats` grid.
3. **Disclaimer:** the site footer on every page (app/layout.tsx, skip link, F-1 PR-3 round 4 precedent). e2e asserts
   it on every page this build touches.
4. **TR-9 with open positions is deferred** (no opened date in `open_positions`). The range and evidence line say
   in words that they cover closed trades only. Follow-up recorded under F-6 Open questions: an additive `opened_at`
   (earliest unmatched FIFO lot in `rebuildTrades`) and `confidence()` taking open positions, as its own feature.
5. **/t shows the aggregate only:** no handles, rows or links (a live roster of who holds a stock is a cue to act,
   F1/F3b). Per-trader positions stay on each trader's profile (TR-4).

## 2. Definitions (`lib/open-split.ts`: pure, no string literals except tone names, imports types only)
```ts
export type Tone = 'up' | 'down' | 'flat';
export function tone(x: number): Tone;   // sign of Number((x*100).toFixed(1)): agrees with what pct() prints
export type OpenSummary = { n: number; up: number; down: number; flat: number; avg: number };
export function openSummary(unrealized: number[]): OpenSummary | null;   // null when empty; non-finite dropped
export function combined(closed: number[], unrealized: number[]): { n: number; avg: number } | null; // null unless both non-empty
```
- One `open_positions` row = one position (a symbol in two accounts = two). Up/down/flat by `tone`; avg = equal-weight
  mean of `unrealized_pct`. Combined avg = mean over every closed return and every unrealized percent.
- Realized stays `headline()` via `stats()` / `paneSummary()`; never recomputed. `split()`, `Headline`, `toneClass`
  (already pushed) are removed; the class is inlined (`t === 'flat' ? '' : t`).
- New elements and the profile open list use `tone` ("0.0%" is flat, no color). Existing realized elements and
  closed-trade rows keep today's classes (0 → `down`).

## 3. Copy (`lib/copy.ts`, `OPEN`; no "yet", no buy/sell/hold/signal/$ anywhere)
- `OPEN.line(o)`: "6 open positions · 1 up, 5 down · −23.0% avg unrealized"; n=1: "1 open position · 0 up, 1 down ·
  −4.0% unrealized". Up and down always printed; ", 2 flat" only when > 0.
- Row labels: "Realized · closed trades", "Unrealized · open positions at current value".
- `OPEN.combined(c)`: "Including open positions at current value:" + bold toned `pct(avg)` + " avg / position (N results)".
- Evidence sentence: "The range covers closed trades only; open positions aren't in it."
- Chart note: "Chart: closed trades only. Not plotted: {line}".
- Open list sub-line: "Unrealized, at current value, as of {date}. Not in the closed-trade figures or the chart."
  Date = `min(fetched_at)`, `timeZone: 'UTC'`.
- No closes: "No closed trades, so there are no realized results."
- Feed card: label "Also open:" (muted) + "6 positions · 1 up, 5 down · " + toned "−23.0%" + " avg unrealized" at body size.
- /t: heading "Open positions in {symbol}"; paragraph "{line}, held by 3 traders. Not included in the figures above,
  which cover closed trades. This is what is open now, not a prediction or a rating of the stock."
- Compare: "Open positions: {line} (not in the figures above)."
- `/how` (`HOW.math` items): "Open positions are shown at current value from the broker, each account's holding
  separately, averaged with equal weight." "The combined figure counts each closed trade and each open position as one
  result." "The chart and the range cover closed trades only." "Open positions are listed on each trader's profile, not
  on stock pages."

## 4. Layout at 360 px
Rule: every new node carries `data-open` and renders only behind `open &&`, `open = openSummary(...)`, null when there
are no rows or the state is `none`/`importing`. No positions = no new node = today's HTML.

**Profile** (`complete`, positions > 0):
```
Realized · closed trades                       (row label, small muted, visible)
 58%           │ +1.3%  avg return / trade │ −0.1% to +2.7% · 95% range
Unrealized · open positions at current value
 6 open positions, 1 up, 5 down │ −23.0% (down) avg unrealized / position
Including open positions at current value: −1.5% avg / position (26 results)
[evidence line + "The range covers closed trades only; open positions aren't in it."]
[secondary stats unchanged] [figure.chart unchanged] [p.chart-note: Chart: closed trades only. Not plotted: …]
```
Two `.stats` grids; the unrealized grid directly follows the realized grid (no node between); values use `.stat big`.
- Open, no closes (connected/failed): unrealized grid + "No closed trades…" line; no combined, evidence or chart.
- Open list: heading kept, sub-line added, rows ordered by symbol, tone classes.
- Unfurl `og:description`: append " · {line}" (connected/failed, from `load()`'s positions, no new query).

**Feed pane:** under the two existing stats: the unrealized grid, the combined line, and the chart note under its
chart. No range, no list. **Feed card:** one `data-open` line above the footer link; no symbols, no combined.
**/t/[symbol]:** section after "N trades · M traders" (also in the no-closes branch), aggregate paragraph only.
**/t/compare:** one line per column after "N trades · M traders".

## 5. States
| State | Behaviour |
|---|---|
| No open positions; demo or any `none` | No `data-open` node anywhere; today's HTML |
| Open, no closes | Unrealized grid + "No closed trades…"; not feed-eligible (needs 5 closes) |
| All losing / all winning / mixed | Same layout; tone by sign; "0 up" / "0 down" printed |
| Importing | No aggregates anywhere (TR-3); profile open list as today; excluded from /t, compare, feed counts |
| Failed | Grids and line with the existing incomplete line |
| Signed out | Identical; feed read touches no viewer table |

## 6. Data
- Profile `load()`: add `fetched_at` to the existing positions select.
- `lib/feed.ts` (additive): `open?: Map<number, number[]>` on `FeedPage`. One query in the existing `Promise.all`
  on the `recordStates` id set (`withSection ? traders ∪ candIds : traders`, which already contains every `missing`
  trader): `select user_id, unrealized_pct from open_positions where user_id = any(...)`. Kept for `onPage` traders
  with state `connected` or `failed`.
- `/t/[symbol]` and compare: one read each, `open_positions` joined to non-deleted users by symbol, then the batched
  `recordStates` filter (connected/failed); count positions and distinct traders.

## 7. Tests
- **Unit `lib/open-split.test.ts`** (rewritten): none (null, null); all winning; all losing (down, "0 up, 5 down"
  via `OPEN.line`); mixed; open with no closes (`combined` null); two accounts counted twice; `tone(−0.0004)` flat;
  combined hand case (20 closes at +5%, 6 open at −23% → avg −0.0146, n 26); `tone` agrees with the sign of `pct()`
  over 1,000 seeded values incl. near −100%; `OPEN.*` output has no "$", "buy", "sell", "hold", "signal", "yet";
  open-split.ts source has no string literal other than tone names.
- **`lib/feed.open.test.ts`** (db, `ids`): connected and failed returned; none, importing, deleted absent; `feedList`
  order with `ids` is identical with and without `open_positions` rows. One added case in `lib/feed.signed-out.test.ts`
  (the open read touches no viewer table). `LOAD=1 node --test lib/feed.load.test.ts` within budget; PR records timings.
- **e2e `e2e/f6-open-positions.spec.ts`** (360×800). Fixture: delete `handle in (f6_*)` in beforeAll and afterAll;
  signup_attempt + user + `connections` (state, consent_at) + verified closed_trades + `open_positions`. Only `f6_mixed`
  is feed-eligible (exactly 5 closes in the last day, |r| ≥ 20%; 3 open incl. one symbol in two accounts and one 0%);
  `f6_losing` (≤ 4 closes or 40+ days old, all open losing), `f6_openonly` (no closes), `f6_none` (connected, no
  positions), `f6_stray` (state `none`, stray rows), `f6_importing` (importing, rows on the shared symbol). Asserts:
  - profile row labels, values and combined line strings exactly; realized and unrealized `b` computed font-size equal;
    unrealized grid is the realized grid's next sibling; at most 2 `.stats` before the evidence line on `f6_mixed`;
  - `f6_losing`: down class and "−"; `f6_openonly`: unrealized grid only; `.chart-note` directly after `figure.chart`;
    list "as of" date; `og:description` contains the line;
  - `f6_none`, `f6_stray` and one demo seed trader (profile, /t): zero `[data-open]`; `section.stats` and `figcaption`
    texts equal today's literals;
  - feed: under `feedLock('shared')` (released in `finally`), walk `?after=` pages (≤ 12); on a miss fail "f6_mixed not
    in feed list"; card line percent has the tone class and body size; pane grid, combined line, chart note;
  - `/t/<sym>`: heading "Open positions in {sym}", zero `a[href^="/u/"]` and no `f6_` text in the section, counts
    exclude `f6_stray` and `f6_importing`; `/t/compare` line;
  - footer disclaimer on every visited page; axe pass; no horizontal scroll.
- `git diff main -- 'app/u/[handle]/chart.tsx'` is empty. Share-card e2e belongs to the share-card session.

## 8. Accessibility
Visible row labels; tone never alone (sign plus "up/down" words); plain-text values; no new controls; tap targets unchanged.

## 9. Rollout
One PR if non-test lines stay ≤ ~400 (estimate ~220). Otherwise PR-1: open-split, copy, profile + unfurl, feed.ts,
pane, feed card; PR-2: /t, compare, /how.

## 10. COMPLIANCE Section 1
1. Performance: yes → §2. Footer disclaimer; no advice words; losses as prominent as gains (same size, both counts,
   down color with "−"); evidence scoped in words; /t aggregate only, "not a prediction or a rating"; feed ranking
   and TR-9 lower bound unchanged (test pins it).
2. Personal data: no new field; existing `open_positions` (symbol, unrealized percent, fetched date) shown only for
   connected/failed consented records; cascade delete with the user. No handles on security pages.
3. Money: none; percent only (P3). 4. Comms/tracking: none. 5. User text: none. 6. Accounts/age: none.
7. Vendor/dependency/asset: none. 8. Accessibility: §8, axe. 9. Security: read-only, no endpoint.
10. Claims: "at current value", "closed trades only"; no completeness claim. 11. Checkout: none.

## Responses
Business lead: 1 partly accepted: combined grid and combined win rate deleted, 2 grids max; one combined average
line kept (decision 1.2): it is the owner's stated reason for F-6 and adds no grid; the "no 'Including open positions'
string" check is replaced by the exact-string and 2-grid checks. 2, 3, 4, 5, 6 accepted. 7 accepted (profile-only
sentence added); the combined sentence stays to describe the kept line. 8, 9 accepted (headline() equality lives in
existing stats tests, since `realized` is gone). 10 accepted (merged with engineer 12, §9).
Engineer: 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13 accepted. 3: `combined` returns {n, avg} (no `positive`, per 5).
5 resolved further: no "above 0%" figure at all, "avg / position" under "Including open positions at current value".
