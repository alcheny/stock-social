# Fixes cycle 3, record pipeline: committee log (2026-11-01)

Rows from `docs/direction/cycle3-2026-11-01.md` → "Fixes list", in build order: F3-1, F3-5, F3-3 (PR first part), then
F3-4, F3-7, F3-13/F3-15. Branch `claude/fixes-cycle3-pipeline`. Line numbers below are at f467293 (main).

## 1. Engineer plan

### F3-1 (C3-1): count, never drop, a vendor trade row with no usable price, units or date
Today `lib/broker.ts:141` `continue`s past a BUY/SELL with no price, units or date. A dropped sell leaves its lot open
and the next round trip is priced against it (probe: +20% published as -76%).

- **Where the row goes.** `activities` cannot hold it (`price > 0`, `units > 0`, `executed_at not null` checks). It is
  stored, raw and immutable, in `corporate_actions` as `kind = 'unpriceable'` with `detail.reason = 'trade'`, its side,
  its units when usable and `undated: true` when the date is missing or unparseable (then `executed_at` is the epoch,
  so it applies before every row of its pair). No schema change: the table's checks already allow it.
- **Mapping (broker.ts, the mapping code only).** `toActivities` keeps every BUY/SELL row with an id and a symbol (options
  still skipped, PR #62's lane). A row with a finite positive price, finite non-zero units and a parseable date is an
  activity as today; anything else goes through a pure helper `unusableTrade()` in `lib/corporate-actions.ts`.
  A negative price, which today reaches the insert and fails the whole sync on the `price > 0` check, is unusable too.
  `fetchActivitiesPage` returns `{ activities, unusable, done }`; `fetchActivities` returns `{ activities, unusable }`.
  The sync and the import step store `unusable` with `insertCorporateActions`. Test fakes may still return a bare list
  (typed as such in `lib/sync.ts#Broker`), so no existing test changes.
- **Matcher (`lib/trades.ts`), "never guessed":**
  - SELL with usable units and date, no usable price (0 included): consumes its units from the oldest lots and is
    counted (`excludedCorporate`). Later round trips are priced from their own buys.
  - BUY with usable units and date, no usable price: opens a tainted lot of those units (no known basis); a sell
    drawing it is counted, never priced.
  - Row with no usable units, or no usable date (either side): the pair's ledger is unknown from that row on, so the
    pair's lots are tainted **and every later lot of the pair too** (a plain taint is not enough: a later buy would sit
    behind the unknown sell in FIFO and be drawn by the round trip after it, mispricing it). A SELL is counted.
  - These rows are not repricing actions: they never open the 14-day late-posting window or the same-day rule.
  - Count: under `excludedCorporate`, whose profile line F3-15 rewrites to neutral cause words ("a share move or
    corporate action the importer can't price"): an unpriceable sell is a share move the importer can't price. No new
    users column, no new profile line.
- **Same vendor id stored both ways** (a row first stored unusable, later re-read with a price, or the reverse): the
  first stored version wins in the rebuild (`created_at`), the other is ignored, so nothing is counted twice and a
  published trade never disappears because a later read lost its price. Correcting a stored row stays C3-9/Q3.
- Whether a price of 0 is ever a real close, and how often the vendor sends such rows, go to the vendor question list.

### F3-5 (C3-7): at the same instant, match BUY before SELL
`lib/trades.ts:75` gives buys and sells the same order, so the vendor id string decides. Rule: at the same instant,
symbol changes, then other corporate actions, then buys, then sells (input order breaks remaining ties). Reason: in a
long-only ledger a sell can only be filled from shares held, so a same-instant buy is the only order that can be true
when the sell needs it; when older lots cover the sell, FIFO draws them first and the order changes nothing. A sell is
never priced against a buy the broker dated after it.

### F3-3 (C3-5): a freeze needs confirmed absence; a frozen connection is not read
- New column `connections.missing_since timestamptz` (appended, idempotent).
- Each successful `listAccounts` read: a connected, unfrozen connection with none of its accounts listed gets
  `missing_since = now` if unset; one already missing for at least `FREEZE_CONFIRM_HOURS` (24) gets `disconnected_at =
  now`; one listed again gets `missing_since = null`. A vendor error rolls the transaction back (no stamp); the account
  list has no pages.
- `disconnected_at is not null` connections are left out of the consented set (not read, not claimed), `syncable()`
  (a trader whose every connection is frozen is not synced) and `accountsOf()` (cost cap).
- Not decided here (owner Q1): whether a relisted frozen account unfreezes. Nothing clears `disconnected_at`; the
  existing TR-5 test is updated to the two-read rule (strengthened, not removed).

### F3-4 (C3-6): open positions replaced per account, never per user
- Sync: replace the rows of the accounts read; rows of accounts the read did not list move to a new private table
  `unlisted_positions` (same columns plus `unlisted_at`), kept with their `fetched_at`, rendered nowhere; a relisted
  account's fresh rows replace them. Every reader of `open_positions` therefore still renders only the accounts the
  latest read listed (today's display), and either OD-9 answer can render later.
- Import step (`lib/connections.ts:591`): `replaceAccountPositions` for the accounts read, so an import never wipes an
  earlier connection's positions.
- Privacy maps, retention map and `scripts/shared-accounts.ts` cover the new table.

### F3-7 (C3-10): /how describes the whole feed order truthfully (copy only)
`HOW_PERSONAL.text` per the record, tied to `RECENCY_HOURS` and `RANK_MIN_BETS` by a test. Feed order unchanged.

### F3-13 / F3-15
- Tools card selects `excluded_corporate` and prints `PROFILE.excludedCorporate(n)` in the profile's order.
- `PROFILE.excludedCorporate` gets neutral cause words; /how's excluded list gains the unusable-row line; the sync's
  re-read comments say what the code does (the 7-day re-read inserts new vendor ids only). The oversell line (`:69`)
  and POLICY's transfer list are left alone (C3-3, C3-2).

## 2. Sign-off
(below)

### Round 1 (plan)
- **Business lead: CHANGES.** All taken: (1) the corporate line names every cause it counts ("a share move, corporate
  action or broker row the importer can't price"); (2) the F3-7 sentence was false against the code (return size, not
  position size; the evidence rule needs a range clear of zero, not just 10 bets): rewritten to the business lead's
  wording; (3) a /how excluded line stating the sticky rule openly; (4) tests: undated rows keep trades + counts equal,
  one vendor id stored both ways counts once; (5) `FREEZE_CONFIRM_HOURS = 24` is a constant, no timing promise in copy;
  (6) TR-6: a frozen account stays owned (test); (7) deletion of `unlisted_positions` tested; (8) shuffle property test.
- **Reliability reviewer: CHANGES.** All blocking items taken: (1) an unusable sell in a pair with no stored activity
  was never replayed, so never counted: the rebuild counts trade-row sells of pairs it never flushed; (2) the
  stored-first rule needs both directions and a tie rule: activities lose only to a strictly earlier trade row, trade
  rows lose to an activity stored earlier or at the same time; both limited to `reason = 'trade'`; (3) the probe sits in
  the stream query, the chain query and the `excluded_future` count. Non-blocking taken: (4) the unknown-ledger taint
  follows a rename; (5) undated rows stated in /how; (6) `lib/sync-shard.ts` coverage ignores frozen connections;
  (7) the freeze can be rolled back by a later failure in the same sync: ponytail; (9) `scripts/rebuild-records.ts`, a
  one-off rebuild of every profile after deploy (frozen traders are no longer synced, so the hourly sync would never
  apply the F3-1/F3-5 matcher to them); (10) cascade, primary key, upsert on move, `scripts/shared-accounts.ts` covers
  both tables, retention map updated.
- **Kept on purpose (reviewer item 8):** a list with no consented account returns before positions, so one possibly
  faulty empty answer changes no display (stated in `lib/positions.ts`).

### Round 2 (revised plan and working tree)
- **Business lead: SIGN** after one copy fix: the /how line's second clause read as contradicting the first; now
  "With no share count, that includes the later trades of the same stock in the same account; with no date, all of its
  trades there." (The business lead's first wording said "every later trade" / "every trade of it"; e2e caught it against
  POLICY's completeness-word rule, so "every trade" is gone and the meaning is kept.) Recency wording "(a close counts about a third as much after each 48 hours)"; the test computes the
  feed's score formula at `RECENCY_HOURS` instead of a bare constant.
- **Reliability reviewer: SIGN.** Follow-up taken: trade rows in an account marked as another profile's
  (`shared_account_marks`) are not loaded, like that account's activities (test).

### Round 3 (independent code review and tester QA of b0b632e)
- **Code review:** one verified defect, fixed: an oversell after an unusable row with no units or date (no lot left in
  the pair) was counted as `excluded` ("no matching entry in the imported history"), the wrong cause; it now counts
  under `excludedCorporate` (test). Non-blocking, fixed: `unlisted_positions.account_id` joins the private "account
  numbers" field.
- **Tester:** 100k random single-pair matcher cases and 60k with splits and renames held every invariant (each sell
  counted once, returns equal to a reference FIFO, no buy dated after its sell). Two defects, fixed with tests: lots a
  rename moves into a pair whose ledger an unusable row made unknown were priced (now tainted); a fee that is not a
  finite number published a NaN or -Infinity return (the row is now unusable and counted; strings must be plain
  decimals, so '0x10' is not read as 16).
- **e2e:** the first /how wording contained "every trade", which the /how spec rejects (POLICY completeness words);
  reworded, and the unit test now checks it too. `e2e/connect.spec.ts` pins the corporate exclusion line: updated to
  the new wording (same assertion).

## 3. Decisions
1. Unusable vendor trade rows live in `corporate_actions` (kind `unpriceable`, reason `trade`), counted in
   `excluded_corporate`; no new users column. Reason: the table is raw, immutable and already feeds the matcher; the
   count's line names the cause neutrally.
2. A row with no usable units or date makes its pair's ledger unknown from then on (from the start when undated).
   Reason: FIFO after an unknown quantity is a guess (POLICY F3c); a plain taint would let a later buy be mis-drawn.
3. First stored version of a vendor id wins between `activities` and trade rows. Reason: no double count, no published
   trade lost to a later bad read, and no correction policy decided (C3-9, Q3).
4. Same instant: buys before sells (record F3-5).
5. Freeze after two successful lists ≥ 24 h apart; frozen = not read, not synced, still owned. Unfreeze is Q1.
6. Positions: per account; unlisted accounts' last rows kept privately in `unlisted_positions` (Q2/OD-9 open).

## 4. Owner items
- **Q1 (TR-5 freeze rule):** whether a confirmed-absent account the vendor lists again unfreezes, and whether repeated
  refusals freeze. Today: nothing unfreezes, refusals never freeze. Also the confirmation window (24 h).
- **Q2 / OD-9:** whether a disconnected account's last positions show ("last known ‹date›"); the rows are kept.
- **Vendor question list:** whether a price of 0 is ever a real close; how often BUY/SELL rows arrive without a price,
  units or date.
- **Rollout:** run `node --env-file=.env scripts/rebuild-records.ts` once after deploy.
