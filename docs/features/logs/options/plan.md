# Options support: implementation plan v2 (UX lead, 2026-11-01)

Input: `brief.md`, the round 1 reviews (`plan-round1-reviews.md`) and the orchestrator's synthesis. The owner's
standing instruction applies: each open question is decided by the committee's recommended option. Decisions are
recorded in `committee-2026-11-01.md` once members sign. Placeholder ticker: `XYZ`. Change marks: BL = business
lead, L = legal, E = engineer, plus the demand number.

## Summary
One PR. Option activities are imported, matched per contract and counted now. Long options get a percent return on
the cost of the contracts plus fees. Short options are counted and never shown with a percent. Everything that would
publish contract terms or option returns sits behind one **consent gate**:
- the option trade list, the options line, open option rows and the call/put chip;
- the gate opens only when the owner's consent scope line names options.

Until then the profile shows one plain count line. Options live in their own derived tables, so `closed_trades` and
every existing reader (headline, CH-1, TR-9, ranking, feed, `/t/[symbol]`) stay share-trades only with no edits. The
existing leak of option symbols into `open_positions` is fixed in the same PR (E1).

## Decisions

**D1 Storage (E3, E4).**
- **`option_activities`** (raw, append-only): `unique(source, external_id)`, `user_id` cascade, raw jsonb,
  `source in ('snaptrade','demo')`. Parsed columns are nullable, so a malformed row is stored and counted: `kind`,
  `open_close`, `underlying`, `underlying_type`, `option_right`, `expiry`, `strike_milli` (integer thousandths),
  `multiplier`, `occ_ticker`, `units`, `price`, `fee`, `amount`, `currency`, `executed_at`, `account_id`. Keyset
  index `(user_id, account_id, contract_key, executed_at, external_id)`.
- **`option_trades`** (derived, rebuilt per user), one row per shown long close: `id`, `user_id`, `close_id` (unique,
  the closing row's external id), `account_id`, `verified`, `underlying`, `option_right`, `option_expiry`,
  `opened_at`, `closed_at`, `return_pct`, `holding_days`. No strike, units, prices or fees.
- **`open_option_positions`**: PK `(user_id, account_id, position_key)`; `underlying`, `option_right`,
  `option_expiry`, `unrealized_pct`, `fetched_at`.
- **Counters on `users`:** `excluded_options_short`, `excluded_options_other` (closes, set by the rebuild);
  `open_options_short`, `open_unsupported` (set by the positions step).
- *Why:* about 43 query sites read `closed_trades`. Separate tables make "shares only" the default with no edits, and
  merge trivially with PR #40.

**D2 Contract key (E2, E7).**
- Key: `account | underlying | expiry | right | strike_milli | multiplier`, built from the typed `option_symbol` fields.
- The expiry is `expiration_date[0..10]`, validated as a real date.
- The multiplier is 10 when `is_mini_option`, else 100. The basis is `units × price × multiplier + fees`, and fees
  are cash, so the multiplier matters.
- The OCC ticker is only a cross-check. Its root, with punctuation stripped, must equal the underlying; a mismatch
  (an adjusted contract) is counted.
- Units are taken as `abs(units)`. The currency comes from the activity.

**D3 Return bases.**
- **Long:** basis = premium paid + entry fees; return = (exit proceeds − exit fees − basis) / basis. A worthless
  expiry with no fee is −100%; fees can take a long below −100%, and /how says so, so no floor is promised (E7).
- **Short: counted, not shown.** No basis is both honest and comparable: premium received caps gains at +100% while
  losses are unbounded; collateral depends on a broker rule we can't read; strike notional makes losses look tiny.
  The same pricing reason already excludes short stock sales (F3c, L4).

**D4 Excluded and counted.** The unit is one closing row, or one dangling contract. Opening rows never count. The
matcher returns per-cause counts (BL10); the counters store two groups.
- **Short** (`excluded_options_short`): any close of a short lot, an assignment, and an expiry of a short lot.
- **Other** (`excluded_options_other`): exercise and early exercise; an expiry with a non-zero cash amount (L2); any
  event row without `option_symbol` (E2); an explicit type that contradicts the ledger, or a sell that would flip the
  position (the contract is tainted until flat); a closing row with no prior open; a dangling contract (long lots
  open more than 5 days after expiry with no closing row, against an injected `asOf`); an adjusted root; a
  multiplier or currency mismatch within one contract; an underlying type outside the allowlist `cs, et, ad, ps, cef,
  ut`, missing or unknown included (L3, E2); a malformed row; a cash scale failure (`|amount|` within a factor of 3
  of `units × price` but not of `units × price × multiplier`, E7).
- **Missing `option_type`:** taken from the contract's netted ledger (positions net within an account).
- **Order:** at equal instants, opens come before closes, then by id (E7).
- **Shares tied to an exercise or assignment (L2):** share BUY and SELL rows in the same account and underlying on the
  same UTC day as an exercise or assignment are never shown.
  - Delivered BUY rows are dropped before the share matcher. A sell that draws on them oversells and is counted
    under `excluded_positions` by the existing rule.
  - Removal SELL rows are matched (so the lots are consumed correctly), but their close is not written, and it is
    counted under `excluded_options_other`.
  - This is the only edit inside `rebuildTrades`: one optional `taint` parameter, used in two lines of `flush` and the
    page loop, marked `// OPTIONS`. It is coordinated with PR #40: whichever lands second rebases.
- **Exercise bias (BL1):** in-the-money longs that are exercised are left out, while worthless ones show −100%. /how
  says so plainly. The per-cause counts measure it. Allowlisted underlyings settle in shares, so there is no
  cash-settled exercise to price (ponytail K6).

**D5 The consent gate (L1, orchestrator).**
- `lib/options-gate.ts` exports `OPTION_PUBLIC_COLUMNS` (`option_trades.underlying|option_right|option_expiry|
  return_pct|opened_at|closed_at|holding_days`, `open_option_positions.underlying|option_right|option_expiry|
  unrealized_pct`).
- `optionsPublic(fields = PUBLIC_FIELDS)` is true only when every one of those columns is listed in a `PUBLIC_FIELDS`
  entry. `lib/privacy-fields.test.ts` holds `PUBLIC_FIELDS` equal to `CONSENT_SCOPE_LINE` (owner copy). So the gate
  opens when the owner adds the options wording and its field entry. There is no code change, env var or flag.
- Until then the columns sit in a new `GATED_COLUMNS` map in `lib/privacy-fields.ts`, with the reason "public only
  once the consent line names options". A test requires each column to be in exactly one of `PUBLIC_FIELDS`,
  `PRIVATE_FIELDS`, `NOT_A_FIELD` or `GATED_COLUMNS`.
- `loadOptionRecord(userId, gate = optionsPublic())` is the profile's separate loader. Closed gate: it selects counts
  only (no returns, terms or symbols) and returns `{ gated: true, closes, open }`. Open gate: the full model. The
  render is a pure component of that model. Tests force either state through the parameter; an inventory test fails
  if any file outside tests passes the argument.
- **While gated, the profile shows only** (muted, under the existing excluded lines, linking to /how): "N option
  trades and M open option positions imported, not shown yet: the public record's consent does not cover options
  yet." Zero parts are dropped.
  - The short-options line and the technical-exclusions line are **gated too**. While gated, every option result
    (gain, loss, short or counted) is withheld alike and counted in that one line. So nothing is hidden selectively,
    and no detail beyond today's words is published.
- **The open-position fix and the futures count are not gated.** Neither publishes option terms.
- **Proposed owner wording** (the owner decides): add "for options, call or put, expiry date and percent return on
  the premium paid" after "symbols". Strikes are added to the Private list as "strikes".

**D6 Profile when the gate is open (scope: profile only, E6).** Every element is within the 360 px frame, uses
existing color tokens only, and keeps 44 px tap targets.
- **Headline:** labeled "Share trades" only when the options line is visible (BL3). CH-1's label adds "· share trades
  only" in the same case. Headline, CH-1, max drawdown, TR-9 and trader ranking stay share-only. A −100% close would
  pin an equal-weight compounded curve at −100%, and `confidence()` would take its log as ≈ −20.7.
- **Options line**, directly under the headline at the same type size, in at most 2 lines at 360 px (BL4):
  "Options: 14 trades · 36% wins · −22.0% avg (−41.0% to −3.0%)". Down color when negative, sign always shown. The
  range comes from `optionSummary()` (E8): pure; simple returns; the TR-9 cluster-robust t-interval clustered by
  underlying with overlapping holds; no range under 5 bets; no verdict or edge words. "Premium paid" is on /how.
- **Short line**, on its own line in the stats block (BL2, L4): "Short options not shown: N closed, M open. Their risk
  has no fixed amount to measure a percent against." Shown only when N + M > 0.
- **Technical line:** "N option trades excluded: exercised, assigned or adjusted contracts and others the importer
  can't price exactly."
- **Option trades list:** its own section "Option trades", newest first, every row reachable in windows of 50 (TR-1).
  Row: `XYZ` (link to the share page `/t/XYZ`) · chip "Call option"/"Put option" (text, not color) · return
  right-aligned; muted meta "closed Oct 3, 2026 · exp Dec 19, 2026"; accessible name "XYZ call option, exp Dec 19,
  2026, −100.0%".
- **Expiry format:** one formatter, `expiryText()` → "exp Dec 19, 2026", used everywhere (BL5). It is an absolute
  date only: no countdown, "expiring soon" or direction words (L6).
- **Open block (TR-4, BL8):** long option rows with the chip and expiry join the existing "Open: N positions · −x%
  unrealized" block and its aggregate; shorts are the count in the short line; "Plus N open positions not shown:
  futures and similar contracts are out of scope." when `open_unsupported` > 0.
- **Verified and Demo (L7):** Verified when every source row is `snaptrade`; Demo badge on demo rows; the disclaimer
  already sits on the profile.
- **Display log (L9):** `lib/display-log.ts` adds what the options line showed (or the gated count) to its snapshot.

**D7 Open positions and the leak fix (E1).**
- `fetchPositions` keeps only equity-like instrument kinds in `open_positions`.
- `kind === 'option'` goes to options handling. Unrealized % = `(price − cost_basis) / cost_basis`: both are per
  share for options (SDK), so there is no multiplier.
- Long positions are written to `open_option_positions`; short ones (units < 0) to `open_options_short`.
- `future`, `future_option` and `cfd` are counted in `open_unsupported` and never shown.
- `purgeOccPositions()` in `lib/options-sync.ts` removes `open_positions` rows whose symbol parses as an OCC
  contract. It runs in `scripts/db-setup.ts`, which reaches frozen traders who never sync, and after each positions
  write. It is not in `schema.sql` (CI bans deletes there).
- Not broadcast (L6): open option positions appear on the profile only. They are kept out of `/t` aggregates (F-6
  reads `open_positions` only), feed, sections, recap and similar.

**D8 /how, COMPLIANCE, demo.**
- /how `math` adds:
  - "An option trade's return is on what the contracts cost, fees included: a contract that expires worthless shows
    about −100%, and fees can take it slightly lower."
  - "Option trades are summarized on their own line, with a range once there are 5 independent bets. The headline
    stats, chart, range and the order of traders use share trades only (L5)."
- /how `excluded` replaces "Options, short sales…" with three bullets:
  - "Short sales and short options: their risk has no fixed amount to measure a percent against."
  - "Exercised or assigned options, and share trades on the same day in that stock. These are left out of the options
    average, so it does not include contracts that ended in the money."
  - "Contracts adjusted after a corporate action, options on futures or other non-stock underlyings, and contracts
    past expiry with no closing record."
- While gated, /how adds: "Option trades are imported and counted; they are shown once the consent wording covers
  them."
- COMPLIANCE §2, CFTC row (L10, E11): "Re-reviewed 2026-11-01: listed equity and ETF options are imported read-only.
  Long options are shown as percent once the consent line covers them; short options, exercises and assignments are
  counted. Options on futures and other underlyings stay out of scope and are counted."
- COMPLIANCE §3: an inventory line for the three tables. §12: a "/how changed" note.
- `lib/broker.ts`: the ponytail is replaced by the precise limits K1–K9.
- Demo: one demo trader gets 3 long option trades (one expiry), 1 short close and 1 long open option, all marked
  `source='demo'`.
- Privacy (L8): `lib/privacy-retention.ts` and `lib/privacy-purge.ts` cover the three tables. A deletion test covers
  them. No raw payload, strike or OCC string is logged.

## Acceptance criteria (T = unit, D = DB, E = e2e at 360 × 740, light and dark)
Matching (`lib/options.ts`, pure):
1. T (property, E9): an inline seeded PRNG generates ≥ 1,000 random ledgers per property, checked against an
   independent reference model. Shown + every per-cause count = closing rows + dangling contracts. Each close is
   shown or counted exactly once.
2. T (property): no shown trade comes from a short lot. Every short close, assignment and short expiry is in the
   short count.
3. T (property): the long return before fees is ≥ −100%. The net return equals the reference model's value. A no-fee
   worthless expiry is exactly −100%.
4. T (property, E9): scaling units and fees together by k > 0 leaves returns unchanged. Ties at the same instant
   order opens first, then by id, and shuffled input gives the same output.
5. T: one hand case per D4 rule, including:
   - the missing-type inference;
   - a dangling contract counted at expiry + 6 days and not at + 5 under an injected `asOf`;
   - punctuation in the OCC root;
   - the factor-3 cash check;
   - an expiry with cash;
   - a row with no `option_symbol`;
   - an unknown underlying type.
6. T: a long return hand-computed with fees at ×100 and at ×10. The strike is normalized to integer thousandths and
   the expiry validated (E2).
7. T: `optionSummary()` (E8) gives the hand-computed example, no range under 5 bets, no division by zero with zero
   spread, and no verdict words.
8. T: `lib/trades.ts` has no diff in this PR. `matchTrades` output on the existing fixtures is unchanged (E9).

Storage, sync and vendor:
9. D: `option_activities` stores 0-price and malformed rows. A re-insert is a no-op. Paper accounts and future-dated
   rows are excluded from the option rebuild (E4).
10. D: `rebuildRecord` (wraps `rebuildTrades`, then runs `rebuildOptionTrades`) writes `option_trades` and both
    counters, and is idempotent. The exercise-day share taint is counted as in D4.
11. D: an options-only trader's hourly sync uses the 7-day window, measured from the newest row across both raw
    tables (E5).
12. T: `lib/broker.ts` adds the three event types through one exported list, `OPTION_EVENT_TYPES`. Option BUY/SELL
    rows reach an optional options sink, and existing signatures and the skip test are unchanged (E2, E5).
13. T: `fetchPositions` sends option kinds to the options path with the per-share percent, counts futures-type kinds,
    and never writes an OCC string to `open_positions` (E1).
14. D: `purgeOccPositions()` removes stored OCC rows, including a frozen trader's. Profile deletion removes every row
    in all three tables (L8).

Gate:
15. T: `optionsPublic()` is false with today's `PUBLIC_FIELDS`, and true with a test array that lists every
    `OPTION_PUBLIC_COLUMNS`. Each option column is in exactly one privacy map. No file outside tests passes the gate
    argument, and no env var is read.
16. T: the closed-gate loader returns counts only (its SQL selects no option return, term or underlying). Its render
    shows only the count line. The open-gate render shows every D6 element.
17. E (real app, gated): signed out, the demo trader's profile shows the count line. The page has no "Call option",
    no "exp ", no option return, no strike (seeded odd value 123.45) and no OCC string, in the HTML, description, alt
    text or JSON. The headline equals the shares-only fixture.

Surfaces when open (render tests on the pure component at 360 px through Playwright component pages, or a test-only
route that is not built into production; the engineer picks one):
18. Worst case (BL9): a 5-character underlying, "Put option" and −100.0% fit on one line with no truncation, 44 px
    targets and existing tokens only. The options line takes ≤ 2 lines.
19. "Share trades" headline label and CH-1 suffix appear only with the options line. The short line stands on its own
    line. One expiry format, from `expiryText()`.
20. The open block shows a long option with its chip, the short count and the futures count. No countdown words
    appear anywhere (scanner list extended: "expiring", "days left").
21. Display log rows include the options line or the gated count (L9). All new copy passes the F2 scanner and
    contains no third-party names.

E2E fixture through the vendor fake on port 4102 (E12), in the vendor's shapes: option BUY/SELL rows with and
without `option_type`; expiry, assignment and exercise events with and without `option_symbol`; positions with
option, future and future_option kinds; every D4 case. The fake honours the `type` filter.

## States
- No options: nothing changes; existing e2e snapshots hold. Gated: the count line only. Signed out: public.
- Open, options-only trader: "No closed share trades yet" in the headline slot, then the options line; CH-1 replaced
  by "The chart shows share trades. None yet." All losses: down color with the sign. Everything counted: the
  excluded and short lines only. Demo: Demo badge. Frozen: rows stay. Importing: the banner counts share closes (K4).

## Known limits (each a `ponytail:` comment where it lives)
- K1: option trades are not on feed cards or the SW-1 pane. When added, cap the ranking size term at 100% for options
  (long losses stop at −100%, so uncapped gains would tilt the feed toward winners).
- K2: share cards don't show the options line yet. Since a card could then show the share headline only, adding it
  is the first follow-up after the gate opens.
- K3: no option trade page, theses or likes on option trades.
- K4: similar, compare, recap, `/me/record` and the import banner count ignore options.
- K5: a corporate action on the underlying during a hold is caught only when the OCC root changes. Taint once PR #40's
  actions are wired.
- K6: cash-settled exercise is not priced; index underlyings are out of the allowlist.
- K7: per-cause counts are returned but not stored. Measure the share counted once real data flows; above ~10%,
  revisit.
- K8: the exercise-day taint is per (account, underlying, day), which can catch an unrelated same-day share trade.
  It is conservative and counted.
- K9: `connections.consent_at` stores a time, not the wording version (owner item).

## Files
- **New:** `lib/options.ts`, `lib/options-gate.ts`, `lib/options-sync.ts` (insert, `rebuildOptionTrades`,
  `rebuildRecord`, positions, purge), `lib/options-load.ts`, `app/u/[handle]/options-block.tsx`, tests for each,
  `e2e/options.spec.ts`.
- **Additive `// OPTIONS` blocks:** `db/schema.sql`; `lib/sync.ts` (callers use `rebuildRecord`, backfill window,
  inserts, the `taint` parameter); `lib/connections.ts`; `lib/broker.ts` (event types, optional sink, position
  kinds); `lib/privacy-fields.ts`; `lib/copy.ts`; `app/u/[handle]/page.tsx` (one JSX block, headline label) and
  `chart.tsx` (label); `lib/display-log.ts`, `lib/privacy-retention.ts`, `lib/privacy-purge.ts`;
  `scripts/db-setup.ts`, `scripts/seed.ts`; `e2e/fakes/vendor.ts`; `docs/COMPLIANCE.md`.
- **Not touched:** `lib/trades.ts` (AC 8), the feed, `/t/**`, share cards. The `LOAD=1` sync load run goes in the
  build log. Size: about 1,600 lines, ~40% tests.

## COMPLIANCE §1
1. Performance: disclaimer on the profile; option losses shown like gains; option figures gated until consent covers
   them; no verdicts. 2. Personal data: private strike, premium, units, fees, contract and OCC ids; call/put, expiry
   and option returns public only through the gate; the `open_positions` P3 leak fixed and purged; all three tables
   deleted with the profile. 3. Money: no. 4. Communications: no; nothing broadcast. 5. User content: none (no
   theses on options yet). 6. Accounts: no; the consent gap is an owner item. 7. Vendors and dependencies: none new.
   8. Accessibility: text chip, accessible names, 44 px targets. 9. Security: no new endpoint. 10. Claims: /how only.

## Owner items
- Amend `CONSENT_SCOPE_LINE` and add the field entry; this opens the gate. Suggested words are in D5.
- Decide whether consents given before the amendment cover options, since `consent_at` has no wording version.
  Recommended: re-consent, and store a wording version from now on.
- The vendor's written permission to show option-derived figures publicly, including quotes for open options.
- POLICY F3's /how list: "options" becomes "short, exercised and assigned options".
- CLAUDE.md known limits; Privacy Policy and Terms drafts (new raw option fields).
- Accept the residual risk that a strike can be roughly inferred from percent, dates and contract terms once public.

## Round 2 answers
| Demand | Answer |
|---|---|
| BL1 exercise bias | Adopted in part. /how discloses it and the per-cause counts measure it. Cash-settled pricing is moot under the equity/ETF allowlist (K6). |
| BL2 short line, BL3 headline label | Adopted (D6). The short line is gated while consent is pending; the label shows only with the options line. |
| BL4 ≤ 2 lines, BL5 one expiry format, BL9 worst-case layout | Adopted ("premium paid" moves to /how; `expiryText()`; AC 18). |
| BL6 one PR, BL7 drop the /t line, BL8 open options here, BL10 per-cause counts | Adopted (K1–K9; `/t` untouched; D7; returned by the matcher, K7). |
| L1 consent | Adopted as the gate (D5). The owner amends the line. |
| L2 never a wrong return | Adopted: exercise-day share taint; expiry with cash counted. |
| L3–L10 | Adopted (allowlist and source D1/D4; short line D6; headline coverage D6 and /how; profile only with absolute dates; Verified, Demo and disclaimer; privacy maps and deletion AC 14; display log AC 21; COMPLIANCE notes D8). |
| E1 leak and endpoint | Adopted (D7). My v1 multiplier formula was wrong for this endpoint. |
| E3 separate table, E6 profile-only scope, E10 privacy maps | Adopted (D1; K1–K4; AC 15). v1's `closed_trades` columns are dropped. |
| E5 minimal shared edits | Adopted, plus the one `taint` parameter L2 needs (coordinated with PR #40). |
| E2, E4, E7, E8, E9, E11, E12 | In the ACs as written. |
