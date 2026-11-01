# F-6 plan, round 1: UX lead

Scope: profile (headline, stats, evidence, chart, open list, unfurl description), feed card and pane, `/t/[symbol]`,
`/t/compare`, `/how`, new pure `lib/open-split.ts`. Share card images are out (another session; it should call the
same `lib/open-split.ts` so the numbers agree). No schema change, no vendor, no dependency.

## 1. Decisions (recommended options)
1. **Realized leads; unrealized and combined sit in the same headline block at the same size.** Reasons: (a) TR-9
   Must: the headline average carries its 95% range, and a combined figure can't have one yet (open positions have no
   opened date, see 3); (b) "no open positions = today's numbers" stays byte-identical; (c) TR-4 asks for the open
   line "next to realized stats, as prominent as the headline". The F-6 risk (sell winners, hold losers) is closed
   by giving the unrealized row and the combined row the same `.stat big` size directly under the realized row: no
   reader sees the realized figure without the other two in the same glance.
2. **Disclaimer:** the footer on every page (app/layout.tsx, one Tab away via the skip link, F-1 PR-3 round 4
   precedent) suffices; no copy beside each split. e2e asserts it on every page this build touches.
3. **TR-9 with open positions: deferred, said in words.** `open_positions` has no opened date, so neither days held
   nor clustering can be computed. The range and evidence line stay closed-only and say so. Follow-up (owner must
   clear, it departs from decision 2's "the range reflects them"): an additive `open_positions.opened_at` = earliest
   unmatched FIFO lot from `matchTrades` in `rebuildTrades`, then `confidence()` takes open positions (this also moves
   feed ranking, TR-9 lower bound, so it needs its own plan).

## 2. Definitions (lib/open-split.ts, pure)
- Each `open_positions` row is one position (a symbol in two accounts = two). Inputs are `unrealized_pct` only.
- `tone(x)`: sign of the **displayed** value, `Number((x*100).toFixed(1))`: `up` > 0, `down` < 0, `flat` = 0, so
  color and words never contradict the printed `pct()` ("0.0%" is flat, no color class).
- Unrealized aggregate: n, up/down/flat counts by `tone`, `avg` = equal-weight mean of `unrealized_pct`.
- Combined: closed returns ∪ open unrealized, equal weight. Win rate = share with value > 0 (same rule as
  `headline()`: 0 is not a win). Avg = mean of all. Only shown when both closes and open positions exist.
- Realized = `headline()` unchanged (never recomputed).
- Existing realized elements keep today's coloring (0 → `down`) for byte-identity; only new elements and the open
  list use `tone` (the list's `p.pct > 0 ? 'up' : 'down'` becomes `tone`, so a 0.0% position is no longer red).

## 3. Copy and layout at 360 px (new strings in `lib/copy.ts` as `OPEN`)
`openLine(o)`: "6 open positions · 1 up, 5 down · −23.0% avg unrealized". n=1: "1 open position · 0 up, 1 down ·
−4.0% unrealized". Up and down always printed (all-losing reads "0 up, 5 down"); ", 2 flat" only when > 0.

**Profile headline** (`complete` and positions > 0; with no positions nothing below renders, today's JSX untouched):
```
REALIZED · CLOSED TRADES                      (small muted row label)
 58%                │ +1.3%
 win rate           │ avg return / trade
                    │ −0.1% to +2.7% · 95% range
UNREALIZED · OPEN POSITIONS AT CURRENT VALUE
 6                  │ −23.0%   (down)
 open positions     │ avg unrealized / position
 1 up, 5 down       │
INCLUDING OPEN POSITIONS AT CURRENT VALUE
 48%                │ −1.5%    (down)
 win rate           │ avg return / position
```
Three `.stats` grids (2 columns fit 360 px today). Row labels are real text, not sr-only. Then the evidence line,
with one sentence appended: "The range covers closed trades only; open positions aren't in it yet."
- **Open, no closes** (connected): only the unrealized row, then "No closed trades yet, so there are no realized
  results." No combined row (it would repeat the unrealized row), no evidence, no chart (as today).
- **Secondary stats** (closed trades, profit factor, median hold, drawdown) unchanged: they are labelled closed.
- **Chart:** CH-1 stays closed-only. New optional `open?: { line: string; tone: Tone }` prop on `PerformanceChart`;
  when given, the caption reads "Return if every trade were the same size · closed trades only" and a line under
  the head reads "Not plotted: {openLine}" with the tone class; the svg `aria-label` gets ", 6 open positions not
  plotted". Without the prop the output is identical (profile without positions, any caller not passing it).
- **Open list:** heading "Open positions" kept, plus "Unrealized, at current value, as of {min(fetched_at) date}.
  Not in the closed-trade figures or the chart." Rows unchanged (symbol, account N, pct), ordered by symbol (never
  by return). Needs `fetched_at` added to the existing select (read only).
- **Unfurl description** (generateMetadata stats text): append " · {openLine}" when positions exist and state is
  connected or failed.

**Feed card** (one close): one muted line above the footer link, only when the trader has open positions:
"Also open: 6 positions · 1 up, 5 down · −23.0% avg unrealized" (tone class on the percent). No symbols, no combined.
**Feed pane:** under the existing two stats, the same unrealized row and combined row as the profile (no range,
like today's pane), and the chart gets the `open` prop. No per-position list (the profile has it; 5 of N would be a
selection).
**/t/[symbol]:** after "N trades · M traders", a section "Open now in {symbol}" (shown only if rows exist): line
"4 open positions held by 3 traders · 1 up, 3 down · −8.2% avg unrealized. Not included in the figures above, which
cover closed trades. This is what is open now, not a prediction or a rating of the stock." Rows `@handle (account N)
· pct` with RowBadge, linking to the profile, ordered by handle then account. No combined figure on a security page
(it would be a new security-level score, F3b). Also shown in the no-closes branch (instead of only "No verified
closed trades yet"). Only traders with state ≠ 'none' (via the batched `recordStates`), users not deleted.
**/t/compare:** per column, after "N trades · M traders": "Open now: {openLine} (not in the figures above)." No list.
**/how** (POLICY F3 "How records are calculated"): one paragraph under the math section: open positions are shown at
current value from the broker, each account's holding separately, averaged with equal weight; the combined figure counts
each open position as one result; the chart and the range cover closed trades only.

## 4. States
| State | Behaviour |
|---|---|
| No open positions | No new node anywhere: byte-identical HTML (also `none` state: demo, unconnected) |
| Open, no closes | Unrealized row only + "No closed trades yet…" line; open list; feed: not eligible (needs 5 closes), so nothing |
| All losing / all winning / mixed | Same layout; tone by sign; counts always show both up and down |
| Demo (`none`) | Positions are never public for `none`: identical to today |
| Importing | Today's rule: no headline rows, no aggregates (TR-3); the open list stays as today |
| Failed | Rows shown with the existing incomplete line (as today's stats) |
| Signed out | Identical to signed in; feed read stays viewer-free |
| Positions stale | "as of {date}" on the profile list says when values were read |

## 5. Data
- Profile `load()`: add `fetched_at` to the positions select; nothing else.
- `lib/feed.ts` (additive): `FeedPage.open: Map<number, number[]>` (unrealized pcts per trader). One extra read in the
  existing `Promise.all`: `select user_id, unrealized_pct from open_positions where user_id = any(${ids})` for the same
  trader set as `records(...)`, plus the `missing` section traders; kept only for `onPage` traders whose state ≠
  'none'. Touches no viewer table, so `lib/feed.signed-out.test.ts` (forbids follows, viewer_exclusions, trade_likes,
  trade_exclusions, discovery_events, and any db/session import in app/page.tsx, feed-rows.tsx, feed-actions.tsx,
  feed-pager.tsx) passes; add a case only. PK `(user_id, …)` serves it; the load suite (`LOAD=1`) must stay in budget.
- `/t/[symbol]` and compare: one read each of `open_positions` by symbol joined to non-deleted users.

## 6. lib/open-split.ts
```ts
export type Tone = 'up' | 'down' | 'flat';
export function tone(x: number): Tone;
export type OpenSummary = { n: number; up: number; down: number; flat: number; avg: number };
export function openSummary(unrealized: number[]): OpenSummary | null;            // null when empty
export type Headline = { n: number; winRate: number; avgReturn: number };
export type Split = { realized: Headline | null; open: OpenSummary | null; combined: Headline | null };
export function split(closed: number[], unrealized: number[]): Split;             // realized via headline(); combined only if both
export function openLine(o: OpenSummary): string;                                 // copy above, from OPEN in lib/copy.ts
export const toneClass = (t: Tone) => (t === 'flat' ? '' : t);
```

## 7. Tests (one per acceptance criterion)
- AC3, AC6 unit `lib/open-split.test.ts`: none (`open` and `combined` null; `realized` deep-equals `headline()` on 50
  random arrays); all winning; all losing ("0 up, 5 down", tone down); mixed (hand-computed combined: 20 closes avg
  +5%, 6 open avg −23% → −1.46%, win rate counts open > 0); open and no closes (realized null, combined null); same
  symbol in two accounts counted twice; flat: −0.0004 → `flat`, "0.0%", no class; n=1 copy; no "$", units or prices
  in any output.
- AC1, AC2, AC4, AC7 e2e `e2e/f6-open-positions.spec.ts` (360×800). Fixture in `beforeAll`, deleted in `afterAll`,
  demo seed untouched, handles `f6_*` (pattern of e2e/share-card.spec.ts): signup_attempt + user + `connections`
  (state 'connected', consent_at now) + verified closed_trades (≥ 5 within the last day so the feed takes them) +
  `open_positions` rows. Traders: `f6_mixed` (closes, 3 open incl. one symbol in two accounts and one 0%),
  `f6_losing` (all open losing), `f6_openonly` (no closes), `f6_none` (connected, no positions), plus one `none`-state
  trader with stray open_positions rows. Asserts: profile row labels and figures in text, combined label "Including
  open positions at current value", down class and "−" on all-losing, chart caption "closed trades only" and "Not
  plotted:" line, list "as of", openonly shows only the unrealized row; `f6_none` and the `none` trader show no
  `[data-open]` node and today's stat texts; footer disclaimer on every visited page; feed card line and pane rows
  for `f6_mixed` under `feedLock('shared')`, found as connect.spec.ts finds its trader; `/t/<sym>` open section and
  `/t/compare` line; axe pass and no horizontal scroll at 360 px.
- AC5: unit (above) plus the existing scanner; data model unchanged (pct only).
- Feed data: `lib/feed.open.test.ts` (db) returns pcts for connected and failed traders, nothing for `none`, deleted
  or importing; new case in `lib/feed.signed-out.test.ts` that the open read carries no viewer table.
- Share-card e2e (AC6 third part) belongs to the share-card session.

## 8. Accessibility
Row labels are visible text; tone never alone (sign + "up/down" words); stat values are plain text (screen readers read
"minus 23.0 percent avg unrealized"); no new controls; tap targets unchanged (list links already 44 px rows).

## 9. COMPLIANCE Section 1
1. Performance: yes → §2. Footer disclaimer on every page; no advice words; losses as prominent as gains (same size,
   up and down counts always shown, all-losing in down color with "−"); evidence label unchanged and scoped in words;
   no security score on /t (no combined there; "not a prediction or a rating").
2. Personal data: no new field. Shows existing public `open_positions` (symbol, unrealized percent) only for
   consented records (state ≠ 'none'); `fetched_at` shown as a date. Deleted with the user (cascade).
3. Money: no amounts, prices, units or sizes (P3). 4. Comms/tracking: none. 5. User text: none.
6. Accounts/age: none. 7. Vendor/dependency/asset: none. 8. Accessibility: section 8; axe in e2e.
9. Security: no new endpoint; reads only. 10. Claims: "at current value", "closed trades only", "not yet in the
   range"; no completeness claim. 11. Checkout: none.

## 10. Owner items
- TR-9 deferral (1.3): the range does not yet include open positions; follow-up needs an additive `opened_at`.
- Confirm a "who holds {symbol} now" list on /t is acceptable under F1/F3b (recommended: yes, facts only, looked up,
  ordered by handle); fallback is the summary line without rows.
