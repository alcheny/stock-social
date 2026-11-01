# Options support: implementation plan (UX lead draft, 2026-11-01)

Input: `brief.md` (this folder). Owner's standing instruction: every open question is decided by the committee's
recommended option, so each question below has one recommendation and its reason. Placeholder ticker: `XYZ`.
Decisions are recorded in `committee-2026-11-01.md` once the business lead and engineer sign or send back.

## Summary
Long options (opened by a buy) are matched per contract and shown, labeled "Call option" / "Put option", with a
percent return on the premium paid, fees included. Short options, exercises, assignments, adjusted contracts, options on
futures and contracts that pass expiry with no closing record are excluded and counted under one new counter. Option
trades sit in the trader's trade list and feed, and get their own summary line next to the headline. The headline
stats, CH-1, TR-9 and trader ranking stay share-trades only, because their math (compounding, log returns) cannot
carry a −100% close. The strike stays private. The consent line is unchanged.

## Decisions (one recommendation per brief question)

**Q1 Storage.** New append-only raw table `option_activities` (`unique(source, external_id)`, `user_id` cascade, raw
jsonb). Closed option trades go into the existing `closed_trades` with two new nullable columns, `option_right`
(`call`|`put`) and `option_expiry` (date), both null for shares or both set (check constraint). *Why:* `activities`
cannot hold a 0-price expiry and its constraints can't be relaxed (CI). A separate derived table would duplicate
theses, likes, trade pages, deletion and purge. One table means deletion, freezes and thesis re-attachment by `sell_id`
cover options with no new code. The cost is that every reader of `closed_trades` must label options. AC-20 enforces that.

**Q2 Contract key.** `account | underlying | expiry | right | strike | multiplier`, built from the structured
`option_symbol` fields. The OCC `ticker` is used only as a cross-check. *Why:* vendors pad and format OCC strings
differently, while the fields are typed. Multiplier = 10 when `is_mini_option`, else 100. It is in the key because fees
are cash per row and prices are per share, so the basis is `units × price × multiplier + fee`. Mixing multipliers would
weight fees wrongly.

**Q3 Return bases.**
- **Long:** basis = premium paid + entry fees. Return = (exit proceeds − exit fees − basis) / basis. A worthless expiry
  is exactly −100%. Fees go in the denominator (unlike shares), so the worst case reads as a total loss, not −102%.
  /how says so.
- **Short: not shown, counted.** No basis is both honest and comparable. On the premium received, gains are capped at
  +100% and losses are unbounded: a run of +80% closes and one −600% close would dominate the averages and the
  range. A collateral basis depends on the broker's margin rule, which we can't read, and is undefined for an uncovered
  call. A strike-notional basis makes the risk look tiny (a −600% loss reads as −3%). Short stock sales are already
  excluded and counted for the same reason (F3c), so this keeps one rule. The counter is public on the profile, and
  /how names short options first, so the exclusion is disclosed, not hidden (TR-1, F4).

**Q4 Excluded and counted.** Unit of count = one closing row: sell-to-close, buy-to-close, expiry, assignment or
exercise, plus one per dangling contract (see below). Opening rows never count. Every counted row adds 1 to the new
`users.excluded_options`. Rules:
- **Missing `option_type`:** inferred from the signed ledger of that contract in that account. Positions in one
  contract net within an account, so a sell against long lots closes them and a buy against short lots closes them.
  This is computed from data, not guessed. A row that would flip the position (sell more than the long lots) is counted
  whole, like PR #40's oversell rule.
- **Explicit type contradicts the ledger** (sell-to-close with no long lots, buy-to-open while short): counted, and the
  contract is tainted until it is flat. Later closes of a tainted contract are counted.
- **Expiry row with no prior open:** counted. **Long expiry:** shown as −100%.
- **Exercise, early exercise** (long), **assignment, partial assignment** (short): counted per row. The option's
  result depends on the underlying's price at exercise, which we don't have. Stock rows the vendor posts for the
  delivered shares are matched as shares, as today (see Remaining exposure).
- **Dangling contract:** long lots still open more than 5 calendar days after expiry, with no closing row. Counted once
  per contract, never priced as −100%. Expired, exercised and auto-exercised can't be told apart without prices.
- **Adjusted contract** (OCC root ≠ underlying symbol, or multiplier not 10/100), **multiplier or currency mismatch**
  within one contract, **options on futures** (underlying type not equity, ETF or index), **malformed rows** (missing
  right, expiry, strike or underlying; units ≤ 0; price ≤ 0 on a trade row): counted, and the contract is tainted.
- **Cash cross-check:** when `amount` is present and |amount| matches `units × price` (a per-contract price) rather
  than `units × price × multiplier` (within 1%), the row is counted. It is the wrong-scale case F3c forbids.
- **Profile copy:** `PROFILE.excludedOptions(n)` = "N option trade(s) excluded: short options, exercises and
  assignments, and contracts the importer can't price exactly." Pluralized with `counted()`, muted, under the existing
  excluded lines, linking to /how. One counter is enough: the words name every cause, and /how lists each one.

**Q5 Labels and public terms.** Public: underlying symbol, call/put, expiry date, percent return, dates, holding days.
**Private: strike** (a price, P3), units, premium, fees, contract id, OCC string (it contains the strike). Labels
come from one helper, `optionLabel()` in `lib/options.ts`. At 360 px:
- *Profile row:* `XYZ` link, then a chip "Call option" / "Put option" (text, not color; meets contrast), then the
  return. The muted meta line adds "expires 12/19/2026" in the row's existing date format. Accessible name:
  "XYZ call option, expires December 19, 2026, −100.0%, open trade page".
- *Feed card and SW-1 pane:* the same chip under the symbol. The meta adds "expires Dec 19, 2026". The big return and
  its sign are unchanged.
- *Trade page* `/u/[h]/trade/[id]`: title "XYZ call option". Line: "Expires Dec 19, 2026. Return on the premium
  paid, fees included."
- *Share cards:* the per-trade card's symbol line is "XYZ call option · expires Dec 19, 2026". The record card adds
  the options line (Q6) in the same type size as the headline stats whenever the record has option trades.
- *`/t/[symbol]`:* share trades only (stats, spread, theses, open positions). If option trades on XYZ exist, one muted
  line under the explainer: "N option trades on XYZ are not in these numbers. They are on each trader's record." No
  option stats per security (F3b).
- *Consent line: unchanged, and the design is built to fit it.* A contract's symbol names its underlying, call or put,
  expiry and strike. We publish the first three under "symbols" and "dates" and keep the strike under "prices"
  (private). `lib/privacy-fields.ts` gains columns only: `closed_trades.option_right` → symbols, `option_expiry` →
  dates, the open-option columns → open positions, and the `option_activities` columns → quantities, prices
  (price, strike, OCC ticker), fees, account numbers. The words are unchanged, so the scope-line test still holds. The
  owner may read "symbols" more narrowly; that is on the owner list.

**Q6 Stats, chart, TR-9, ranking.**
- **Headline (win rate, avg return), CH-1, max drawdown, TR-9 range and edge, trader ranking: share trades only.**
  One −100% close zeroes an equal-weight compounded curve forever (CH-1 would sit at −100%). `confidence()` turns it
  into a log return of ≈ −20.7 (`max(1+r, 1e-9)`), which makes the range meaningless. Including options would break the
  numbers. It would not make the record more honest.
- **The options line keeps options as prominent as the headline** (TR-4 pattern), directly under the headline stats
  on the profile, SW-1 pane and record card: "Options: 14 trades · 36% wins · −22.0% avg on premium paid
  (−41.0% to −3.0%)". In the down color when negative, with the sign always shown. The range uses `optionSummary()`:
  the TR-9 cluster-robust t-interval on simple returns (no logs), clustered by underlying with overlapping holds, shown
  once K ≥ 5. No edge or verdict words.
- CH-1's label gains " · share trades only" when the record has option trades. Option rows stay in the list below.
- **Feed card ranking:** option trades are in the feed. Their size term uses `least(abs(return_pct), 1)`. Long
  options can't lose more than 100%, so uncapped gains would tilt the feed toward option winners (F4: losses ranked
  like gains). Shares are unchanged.
- **Trader ranking** (pace lower bound) is unchanged, on share trades. A trader with only options has weight 0 and is
  ordered after weighted traders, per the documented method. /how says so.
- TR-7 "New record" and "Record since" use all closed trades (they are about the record's age, not its math).

**Q7 Open option positions (TR-4): in scope now.** Options are the clearest "hold losers" case.
- Source: the holdings endpoint's `option_positions`. One extra bounded call per account in `lib/broker.ts`.
- Unrealized % = `(price × multiplier − average_purchase_price) / average_purchase_price`. The SDK documents `price`
  per share and `average_purchase_price` per contract. A unit test pins this trap.
- Long positions go in a new table `open_option_positions`, PK `(user_id, account_id, contract_id)`. It is separate
  because the `open_positions` PK `(user, account, symbol)` would collide with the shares in XYZ. Public columns:
  underlying, right, expiry, unrealized_pct.
- Short positions (units < 0) are counted in `users.open_short_options`. The open block shows the line "Plus N open
  short options, not shown: no fixed amount to measure a percent against."
- Option rows join the existing "Open: N positions · −x% unrealized" block, with the chip.

**Q8 Copy, compliance, demo.** /how (`lib/copy.ts#HOW`):
- *math* gains: "An option trade's return is on the premium paid, fees included, so a contract that expires worthless
  shows −100%. Option trades are listed with the other trades and summarized on their own line. The headline stats,
  chart, range and the order of traders use share trades."
- *excluded* replaces bullet 1 with two bullets:
  - "Short sales and short options (sold to open): their risk has no fixed amount to measure a percent against."
  - "Exercised or assigned options, contracts adjusted after a corporate action, options on futures, and contracts
    past expiry with no closing record."
- Demo: one demo trader gets 3 long option trades (one worthless expiry, −100%) and 1 counted short close. The data
  is fictional and carries the Demo badge (P2).
- COMPLIANCE §2, CFTC row (the build edits it): "Re-reviewed 2026-11-01: listed equity and index options
  (SEC/FINRA) are imported read-only. Long options are shown as percent on premium; short options, exercises and
  assignments are excluded and counted. Options on futures stay out of scope and are counted. No strike or premium is
  public. Labels name the contract type, never a direction or an outcome."

## Acceptance criteria (each is a test; T = `lib/options.test.ts`, D = DB test, E = e2e)
Matching (pure `matchOptions(rows, asOf)`; property tests use seeded random ledgers like the FIFO ones):
1. T(prop): for every user, the number of shown option trades + `excludedOptions` = the number of closing rows +
   the number of dangling contracts. Every close is shown or counted exactly once, never both.
2. T(prop): every shown option trade is long; no output row comes from a short lot.
3. T(prop): the return before fees is ≥ −100%; the net return is ≥ −100% − exit fees / basis; a long expiry is exactly −100%.
4. T(prop): scaling every row's units by k > 0 leaves every return unchanged. A mini contract with the same prices
   and no fees gives the same return as a standard one.
5. T(prop): adding any option rows leaves `matchTrades` output on the share rows identical, and the reverse. Neither
   matcher reads the other's rows.
6. T(prop): shuffling input order (with distinct timestamps) gives the same output. Rebuilding twice gives the same rows.
7. T: `openedAt ≤ closedAt`, holding days ≥ 0, `sell_id` = the closing row's external id, partial closes FIFO.
8. T: each Q4 rule has one hand-computed case: missing type inferred; contradiction counted and tainted; expiry
   without open counted; exercise, assignment and partial assignment counted; dangling contract counted at expiry + 6
   days and not at + 5; adjusted root, multiplier mismatch, currency mismatch, futures underlying, malformed row and
   per-contract `amount` counted.
9. T: the long return is hand-computed with fees and a ×100 multiplier (fees weighted correctly), and with ×10.
10. T: `optionSummary()` uses the hand-computed TR-9 example on simple returns; K < 5 gives no range; zero spread
    causes no division by zero.

Storage and sync:
11. D: `option_activities` accepts 0-price expiry rows. A re-insert of the same `(source, external_id)` is a no-op.
    Profile deletion removes every row of the user (P6).
12. D: `rebuildTrades` writes option rows with `option_right` and `option_expiry`. A thesis on an option trade
    survives a rebuild. `users.excluded_options` equals criterion 1's count.
13. D: an options-only trader's hourly sync uses the 7-day window (the newest row across both raw tables), not the
    full history.
14. T: `lib/broker.ts` sends the type filter with the three option types. Option BUY/SELL rows go to the options
    parser and never to `toActivities` (the existing skip test still passes).
15. T: the open-option percent uses ×multiplier against the per-contract cost. A short position adds to the short
    count and writes no row.

Surfaces (360 × 740, light and dark, signed out unless stated):
16. E: a profile option row shows the chip, the expiry, and −100.0% for the expiry. Its accessible name includes
    "call option". No horizontal scroll. Tap targets ≥ 44 px.
17. E: the strike (seeded as an odd value, e.g. 123.45) and the OCC string appear in no page HTML, page description,
    image alt text, record-card data or JSON response.
18. E: the headline stats and the CH-1 summary label equal those of the same fixture without option rows. The options
    line shows below the headline with its sign. The excluded-options line shows its count.
19. E: a feed card and an SW-1 pane show the chip. `/t/XYZ` numbers equal the shares-only fixture, and the "not in
    these numbers" line shows. The trade page shows "Return on the premium paid, fees included."
20. T (inventory): every SQL select of `closed_trades` in `app/` and `lib/` that reads `symbol` also reads
    `option_right` and renders through `optionLabel()`, or filters `option_right is null`, or is allowlisted with a
    reason (`lib/display-log.ts`, delete, purge).
21. T: every new string passes the scanner (no advice or promissory words) and contains no third-party name.
    `lib/privacy-fields.test.ts` passes with the consent line unchanged.
22. E: the open block shows a long open option with its chip, and the "open short options, not shown" line.

E2E runs through the vendor fake on port 4102 (`e2e/fakes/vendor.ts`, additive). It adds option rows with
`option_type` and `option_symbol` in the vendor's shape. The fixture has a long call closed at a gain, a long put
expired, a short put closed, an exercise, a dangling contract, and holdings with one long and one short option. The fake
honours the `type` filter and serves `option_positions` on the holdings route.

## Every state
- **No options:** nothing changes, with no chip, line or label suffix (the existing e2e snapshots hold).
- **Options-only trader:** the headline reads "No closed share trades yet". The options line is the first stats line.
  CH-1 is replaced by "The chart shows share trades. None yet."
- **All losses:** the options line is in the down color with the sign.
- **Importing:** the banner counts closed trades, options included.
- **Demo:** Demo badge. **Signed out:** everything public. **Frozen** (disconnected): unchanged rows, no new syncs.
- **Excluded only** (every option close counted): the excluded line alone, no options line.

## Rollout (three PRs, each shippable)
1. Raw table, parser, `matchOptions`, counters, /how. **Every option close is counted, none shown.** This already
   beats today, where option rows are dropped uncounted.
2. `closed_trades` columns, every surface, options line, feed cap, inventory test, demo data, e2e.
3. Open option positions (Q7).

## Files
- **New:** `lib/options.ts` (vendor-row parser with structural types, key, `matchOptions`, `optionSummary`,
  `optionLabel`, open-option percent), `lib/options.test.ts`, `lib/options-sync.ts` (`insertOptionActivities`,
  `rebuildOptionTrades`, `writeOpenOptions`), `lib/options-sync.test.ts`, `lib/options-surfaces.test.ts`,
  `e2e/options.spec.ts`.
- **Shared, additive `// OPTIONS` blocks only:**
  - `db/schema.sql`: table, `schema_add_column` calls, no drop/delete.
  - `lib/sync.ts`: one call to `rebuildOptionTrades(tx, userId, kept, attachedIds, now)` after the share flush and
    before `setAside`. Its own `update users set excluded_options`. The window query reads both raw tables. Inserts
    sit beside `insertActivities`.
  - `lib/connections.ts`: the import step's insert.
  - `lib/broker.ts`: type filter, option rows handed to the parser, holdings call.
  - `lib/privacy-fields.ts`, `lib/copy.ts`, `lib/feed.ts` (columns, cap), `lib/ticker.ts` and `app/t/**` (filter),
    `app/feed-rows.tsx`, `app/pane.tsx`, `app/ui.tsx`, `app/u/[handle]/**` (page, trade, month, chart label,
    new-trades, similar, record card), `lib/recap-load.ts`, `lib/likes.ts`, `lib/similar.ts`,
    `lib/trade-share-load.ts`, `app/me/**`, `scripts/seed.ts`, `e2e/fakes/vendor.ts`, `docs/COMPLIANCE.md`.
- **Not touched:** `lib/trades.ts` (`matchTrades`, `confidence` and `stats` are unchanged, so PR #40's rewrite merges
  cleanly). `lib/sync.ts` edits are separate blocks beside PR #40's. Whichever PR lands second rebases.
- **Load check:** a `LOAD=1` run of `lib/sync.load.test.ts` goes in the build log (interim rule). The option rebuild
  streams per (account, contract) with keyset pages like the share rebuild.

## COMPLIANCE §1 checklist
1. Performance: yes. The disclaimer is unchanged on every surface. No advice words. Losses are capped like gains
   in the feed, and the options line is as prominent as the headline. No edge or verdict on options.
2. Personal data: new private raw fields (strike, premium, contracts, contract id). New public fields: call/put and
   expiry, under the existing consent words. Deleted with the profile. Data inventory updated.
3. Money: no. 4. Communications: no. 5. User content: theses on option trades use the existing moderation.
6. Accounts: no. 7. Vendor or dependency: none new (same vendor, one more endpoint, no package).
8. Accessibility: the chip is text, the accessible names include the contract type, 44 px targets, keyboard and
   screen reader covered in E16/E22.
9. Security: no new endpoint. 10. Claims: /how changes only to describe the math.

## Remaining exposure (stated plainly)
- Shares delivered by an exercise or assignment are matched at the price the broker posts (usually the strike). That
  share trade's return leaves out the option premium. It is the real price change of the shares, but not the
  combined result. Follow-up: taint lots dated on an exercise or assignment day.
- A corporate action on the underlying during an option hold adjusts the contract. It is caught by the OCC root check
  only when the root changes. Follow-up once PR #40's actions are wired: taint contracts on an underlying with a
  repricing action during the hold.
- Measure on real data the share of option closes that are counted. Above ~10%, revisit the rules.

## Only the owner can clear
- CLAUDE.md (protected) still lists "Options are skipped... long-only FIFO". Replace it with the remaining-exposure
  limits above.
- POLICY F3's /how example list names "options" as excluded. It stays accurate in part (short, exercised and assigned
  options). The owner may reword it to "short and exercised options".
- Whether "symbols" covers call/put for consent. Recommended: yes. Otherwise the smallest owner-copy change is
  "symbols (for options: call or put and expiry)".
- Privacy Policy draft: list the new raw option fields.
