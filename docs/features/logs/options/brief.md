# Options support: fact brief for the committee (2026-11-01)

Task (owner's orchestrating session, 2026-11-01, under the owner's instruction to resolve every `ponytail:` known
limit, committee deciding open questions): remove the known limit `lib/broker.ts` "equities/ETFs/crypto only; options
need contract-level matching (Phase 2)" and CLAUDE.md "Options are skipped in fetchActivities; long-only FIFO".
Build options support: fetch option activities, match per contract, handle both sides (long and short options),
expiries, assignment and exercise (never guessed: what can't be priced honestly is excluded and counted), percent
returns on premium paid (long) or a committee-decided honest basis (short). Percent only on public surfaces (POLICY P3);
`closed_trades` stores no quantities or prices. The committee decides how options show on the record (labeled as
options; ranking treatment; whether short-option returns are shown, given their risk profile). Every decision is
recorded in `docs/features/logs/options/committee-2026-11-01.md`.

## Facts (verified in the repo and the vendor SDK in node_modules)

### Vendor (SnapTrade SDK `AccountUniversalActivity`, what `getAccountActivities` returns)
- `type`: `BUY`, `SELL`, ..., `OPTIONEXPIRATION`, `OPTIONASSIGNMENT`, `OPTIONEXERCISE` (for these three,
  "`option_symbol` contains the related option contract info").
- `option_type` (string): for option BUY/SELL, one of `BUY_TO_OPEN`, `BUY_TO_CLOSE`, `SELL_TO_OPEN`, `SELL_TO_CLOSE`.
  Optional: may be missing.
- `option_symbol` (`OptionsSymbolNullable`): `id`, `ticker` (the OCC symbol), `option_type` (`'CALL' | 'PUT'`),
  `strike_price` (number), `expiration_date` (string), `is_mini_option?` (boolean: "10 underlying shares per contract
  instead of the standard 100"), `underlying_symbol` (`UnderlyingSymbol`, with `symbol` string).
- `price`: "For option transactions, this represents the price per share of the option contract." `units`: contracts.
  `fee`, `trade_date`, `id`, `amount` (cash, signed), `currency`, `fx_rate`, `external_reference_id`.
- The request filter `type` is a comma list; today `lib/broker.ts` asks for `'BUY,SELL'` and `toActivities` drops any
  row with `option_symbol`.
- Open option positions: the SDK has an `OptionsPosition` model (a separate holdings endpoint); `fetchPositions` today
  reads stock positions only.

### Repo
- `activities` table: `side in ('BUY','SELL')`, `units > 0`, `price > 0`, `unique(source, external_id)`. An expiry
  (price 0) cannot be stored there, and schema.sql may not contain `drop`/`truncate`/`delete from` (CI), so a check
  constraint cannot be relaxed. Options need their own append-only raw table (PR #40 did the same for corporate actions:
  `corporate_actions`).
- `closed_trades`: `sell_id` (unique, activities external id of the closing row; theses re-attach by it), `symbol`,
  `opened_at`, `closed_at`, `return_pct`, `holding_days`, `verified`, thesis. No quantities or prices, by design.
  It is read by the feed, the profile, `/t/[symbol]` stock pages (count trades per symbol), share cards, similar
  traders, recap, likes (`trade_key` = hash of sell_id), privacy maps.
- Consent scope line (owner copy, `lib/copy.ts#CONSENT_SCOPE_LINE`, mirrored by `lib/privacy-fields.ts`, held equal by a
  test): "Public: percent returns, symbols, dates, holding periods, institution names, account count, and your current
  open positions with unrealized percent. Private: quantities, prices, fees and account numbers." A new public column
  on `closed_trades` must be listed in `lib/privacy-fields.ts` (as a field, which changes the consent line, or in
  `NOT_A_FIELD` with a reason).
- `/how` today: "What is excluded, and counted: Options, short sales and other activity the importer cannot price
  correctly." (`lib/copy.ts#HOW`). COMPLIANCE §2 CFTC row: "Options and futures are out of scope; `fetchActivities`
  skips them. If added, re-review." (Equity options are SEC/FINRA-listed securities; options on futures are CFTC and
  stay out of scope.)
- POLICY F3c: trades the importer can't price correctly are excluded and counted. F4: losses ranked like gains, whole
  record. P3: percent only, no quantities, prices or dollar amounts. F1/F3b: no advice, signals, rating securities.
- Rebuild (`lib/sync.ts#rebuildTrades`): streams activities per (account, symbol), `matchTrades` (pure FIFO, long only),
  writes `closed_trades`, re-attaches theses, sets `users.excluded_positions`.
- PR #40 (corporate actions, open, should merge soon) rewrites `matchTrades` (adds `replay`, `excludedCorporate`) and
  edits `rebuildTrades`. Options code must live in clearly separated functions/files so the merge is trivial.
- Confidence (TR-9) clusters trades by `symbol` (overlapping holds = one bet); feed ranking uses `evidenceWeight`.
- Tests: `node:test`, property tests exist for FIFO. E2E vendor fake: `e2e/fakes/vendor.ts` on port 4102.
- Protected (may not edit): scripts/autopilot.ts, team.ts, features.ts, doctor.ts, plan.ts, invariants.test.ts,
  compliance*.ts, policy.test.ts, workflow-security.test.ts, .github/**, docs/POLICY.md, CLAUDE.md, team/**,
  playwright.config.ts, lib/session.ts. `lib/broker.ts` may be edited for this task. No new npm dependencies.

## Questions the committee must decide
1. Storage: separate `option_activities` table (recommended by the facts above) and how closed option trades are
   written (same `closed_trades` with new nullable columns, or not).
2. Contract identity for matching: (account, underlying, expiry, strike, call/put, multiplier). OCC ticker as key?
3. Return bases: long = on premium paid (net of fees). Short = ? (premium received; strike notional; collateral;
   or not shown at all). Short call collateral is unbounded.
4. Missing `option_type` (open/close unknown), assignment, exercise, early exercise, partial assignment, expiry
   rows without a prior open, mini options, multiplier mismatch, adjusted contracts (non-standard deliverables after a
   corporate action), currency/fx: which are excluded and counted, and under which counter and copy.
5. How an option shows on the record: label words, what contract terms are public (call/put, expiry, strike? The
   strike is a price: P3), whether the consent line must change, how `/t/[symbol]` treats option trades of an
   underlying, share cards.
6. Whether option trades count in the headline stats (win rate, avg return), the chart (CH-1), TR-9 confidence and
   feed ranking; whether short-option returns are shown (asymmetric: capped gain, large loss).
7. Open option positions (TR-4): in scope now or recorded as a follow-up.
8. /how copy, COMPLIANCE re-review note, demo data.
