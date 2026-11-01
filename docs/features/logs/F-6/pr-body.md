## What changes

F-6 · Open positions in every number (docs/features/F-6-open-positions.md). When a trader has open positions, every
surface except the share card images (they ship with F-4, which reuses the same module) shows realized (closed trades)
and unrealized (open positions at current unrealized percent) side by side. A trader with no open positions sees exactly
today's page.

- **`lib/open-split.ts`** (new, pure, string-free, for F-4 to reuse): `tone()` (the sign `pct()` prints; "0.0%" is
  flat), `openSummary()` (count, up / down / flat, equal-weight average; one symbol in two accounts is two positions),
  `combined()` (every closed trade and open position as one result; null unless both exist). Copy is `OPEN` in
  `lib/copy.ts`.
- **Profile** (`app/u/[handle]/page.tsx`, `app/open-rows.tsx`): realized grid (labelled "Realized · closed trades"),
  the unrealized grid directly beneath at the same size ("Unrealized · open positions at current value · as of Oct 30"),
  then "Including open positions at current value: −1.5% avg / result (26 results)". The evidence line is scoped to
  "Closed trades: …"; under the chart (closed trades only, CH-1, `chart.tsx` unchanged): "Chart: closed trades only. Not
  plotted: …". The open list adds "as of {date}"; 0.0% is uncolored. The unfurl text appends the open line (records with
  closes).
- **Feed** (`lib/feed.ts` additive: `open` / `openAsOf` on `FeedPage`, one read inside the existing `Promise.all`,
  connected or failed records only): the card gets one line, "Also open: 6 positions · 1 up, 5 down · −23.0% avg
  unrealized"; the pane (`app/pane.tsx`) leads with realized, unrealized and combined before the chart when there are open
  positions. The Similar trades pane (`/u/<h>/pane`, `app/lazy-pane.tsx`) carries the same.
- **Stock pages** (`app/t/**`): `/t/[symbol]` gets "Open positions in {symbol}" with the aggregate only (counts,
  average, number of traders, "not a prediction or a rating of the stock"), never who holds it; `/t/compare` one line per
  column. `/how` explains the figures.
- **Schema** (additive, idempotent): an index on `open_positions(symbol)` via `schema_add_index`.

## Decisions taken by the committee

Recorded in docs/features/logs/F-6/committee-2026-11-01.md and the feature file's Decisions (all "decided by the
committee under the owner's instruction of 2026-11-01"):
1. Realized leads; the unrealized grid sits directly beneath at the same size (TR-4 "as prominent as the headline").
2. One combined figure as a single line, "avg / result", no combined win rate (an open position has not "won").
3. Equal-weight unrealized average, up and down always printed ("0 up, 5 down"), tone by the printed sign.
4. The chart and the 95% range stay closed trades only and say so; open positions in TR-9 are a follow-up feature
   (no opened date is stored; it would move feed ranking).
5. Stock pages show the aggregate only (POLICY F1/F3b); per-trader positions stay on the profile.
6. The pane leads with the figures when there are open positions (SW-1); the unrealized row is dated "as of".
7. Positions are public only for connected or failed records; nothing while importing (TR-3).
8. The disclaimer is the site footer on every page (asserted by e2e on every page touched).

## Testing

- `npx tsc --noEmit`: clean.
- `npm test`: 715 tests, 703 pass, 0 fail (12 skipped as before). New: `lib/open-split.test.ts` (none, all winning,
  all losing, mixed hand case, open with no closes, two accounts, flat, tone agrees with `pct()` over 1,000 values, copy
  word list), `lib/feed.open.test.ts` (connected and failed carried; none, importing, deleted not; feed order unchanged
  by open positions).
- `BASE_REF=main node scripts/compliance.ts auto`: ok. `node scripts/autopilot.ts guard origin/main`: ok.
- `npm run build`: ok.
- `npx playwright test e2e/f6-open-positions.spec.ts`: 8 passed (with connect.spec.ts: 43 passed) (profile, all losing, open with no closes, unchanged
  no-positions path incl. a demo trader, feed card and pane order, stock pages and /how, the Similar pane route; 360 px,
  no horizontal scroll, footer disclaimer on every page). Full suite `npx playwright test` on the merged branch: 130
  passed, 3 skipped, 0 failed.
- Load (tester, `LOAD=1 node --expose-gc --test lib/feed.load.test.ts`): every timing within the existing budgets (500
  traders / 244,000 closes: p95 page 1 198 ms, all pages 171 ms; section pages signed out 136 ms, signed in 155 ms). No
  budget raised.

## Compliance

COMPLIANCE.md Section 1:
1. **Performance shown?** Yes, §2 applies. Footer disclaimer "Not investment advice. Past performance does not
   guarantee future results." on every page; losses as prominent as gains (same size grids, "0 up" printed, down color
   always with a "−" sign); the range and chart scoped to closed trades in words; no advice, signal or promissory words
   (copy tested against the banned list); stock pages show no per-trader roster and say "not a prediction or a rating of
   the stock". Note for the owner: the live "held by N traders" count on `/t` is aggregate positioning data; the
   committee judged it acceptable as facts with no handles (each holding is already public on that trader's profile).
2. **Personal data?** No new field. Existing `open_positions` (symbol, unrealized percent, read date) shown only for
   consented connected or failed records; deleted with the user (cascade).
3. **Money, amounts, prices, quantities?** None. Percent and counts only (P3).
4. **Messaging, notifications, tracking?** None.
5. **User-generated text?** None.
6. **Accounts or age?** No change.
7. **New vendor, dependency or third-party asset?** None (no package.json change). An axe check was planned but needs
   a new dependency, so it is not added (owner only).
8. **Accessibility:** words beside every color, named regions for both grids, no new controls, no horizontal scroll at
   360 px.
9. **Security:** read-only queries, no new endpoint (the existing pane route returns two more fields).
10. **Claims:** "at current value · as of {date}", "closed trades only"; no completeness claim.
11. **Checkout or payments?** None.

Committee record: docs/features/logs/F-6/ (plan rounds, sign-offs, committee-2026-11-01.md, user tests
committee-ux-lead.md and committee-business-lead.md, test-tester.md, review.md, screenshots).

Not in this PR: the share card images (AC1 "share card at every size", AC6 share-card e2e) ship with F-4.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
