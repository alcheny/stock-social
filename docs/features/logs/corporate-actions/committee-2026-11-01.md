# Corporate actions: committee log, 2026-11-01

Task: price trades correctly across stock splits and corporate actions (POLICY F3c: trades the importer can't price
correctly are excluded and counted, never shown with a wrong return). The legal committee made this a precondition for
F-3's Record tools.
Committee: engineer, quant reviewer, business lead (fresh-context subagents). Three rounds of debate. All three signed
plan v2 with the round 3 change.
Owner's standing instruction (2026-11-01): decide open questions with the committee's recommended option.

## Facts the plan rests on
- `lib/broker.ts` (protected) asks the vendor for `type: 'BUY,SELL'` only and drops every other row. So **no
  corporate-action row reaches the app today**. The vendor's types include `SPLIT`, `STOCK_DIVIDEND`, `REI`,
  `ADJUSTMENT`, `TRANSFER` and `EXTERNAL_ASSET_TRANSFER_IN/OUT`. There is no dedicated type for a symbol change or a
  spin-off.
- `activities` only allows BUY/SELL rows with units and price above 0, so corporate actions need their own table.
- The rebuild streams one (account, symbol) pair at a time. A symbol change links two pairs.
- Vendor positions carry no units (`lib/broker.ts#fetchPositions`), so we can't check the ledger against the
  broker's holdings.

## Decisions

| # | Decision | Why | Votes |
|---|---|---|---|
| Q1 (replaced, see "Orchestrator review") | **Oversell safety net, inside `matchTrades`.** A sell needing more units than the ledger holds is excluded whole. So is every sell shown since that pair's ledger was last empty. Exclusion ignores whether the trades won or lost. | An oversell proves the position's history is missing an inflow: an unrecorded split or stock dividend, a transfer in, or a buy before the imported history. That makes the FIFO basis of that sell, and of the earlier sells in the episode, unknown. The episode boundary is a heuristic, since the missing inflow may predate it. This is the only protection that works before the broker change. | Quant B, business lead B, engineer B with a recorded dissent: the engineer wanted the owner's explicit OK to flip one existing assertion. Adopted under the owner's standing instruction and flagged first in the PR. |
| Q1a | The existing test "partial unmatched sell keeps the matched part" keeps its inputs and its count. Its title changes and its assertion flips: the matched part is no longer shown. The test count does not drop. | It is a stricter rule and a correctness fix under F3c, not a weakening. | all |
| Count | **Every removed sell adds 1** to `excluded` (the `excluded_positions` counter). Invariant: shown + excluded + excludedCorporate = number of SELL rows. | Round 3. The quant blocked counting once per episode: 5 trades vanishing with the counter rising by 1 hides 4 of them (TR-1). Per sell is already the counter's meaning, so the existing copy stays accurate. | all (round 3) |
| Q2 | Vendor units are read two ways against the shares the ledger holds: as the change in shares and as the new total. A ratio is accepted only when exactly one candidate p:q fits, or one confirmed by the parsed description ("2 FOR 1"). It must fit exactly, or with a cash-in-lieu leftover of at least 0 and under 1 share. Candidates: n:1 and 1:n up to 100, and p,q up to 10. Stock dividends use (q+k):q with q up to 100. Ambiguous, disagreeing, or ledger empty with no ratio means unpriceable. | Vendors report split units inconsistently. Guessing a ratio is exactly the wrong-return case F3c forbids. | all |
| Q2b | **Late posting.** A sell within 14 days before a repricing action on its pair (a split, a stock dividend, a rename with a share exchange, or an unpriceable action) is excluded and counted as corporate. | Brokers often post the split row days after the effective date. A sell in between traded at post-split prices against unadjusted lots. | quant, adopted by all |
| Order | At the same instant, actions apply before trades. | Trade dates are often day-only, and an action is dated on its effective day. | all |
| Q3 | Cash in lieu: the fraction is removed from the oldest lots at their per-share cost. It creates no trade and no count. /how discloses it. | It is not a sell the trader made, and counting it as an excluded trade would itself be a wrong number. | all |
| Q4 | Separate counter `users.excluded_corporate`, with its own profile line: "N trade(s) excluded: a stock split or other corporate action the importer can't price exactly." The `excluded_positions` wording is unchanged. | Different causes need their own words. Forward splits follow run-ups and reverse splits follow collapses, so these exclusions skew one way and must be disclosed (quant). | all |
| Q5 | A symbol change is accepted only from an explicit pair: shares out of A and into B, same account, same trade date, A's out-units equal to the ledger. A share exchange must be 1:1 or a clean ratio with no leftover. Anything else is unpriceable. A recycled ticker (new buys of A) starts fresh lots. | Guessing a link would invent returns. | all |
| Q6 | REI (dividend reinvestment) with units and price above 0 maps to a BUY lot in `fromVendorRows`; otherwise unpriceable. It is part of the owner's broker change request. | Without it every reinvested dividend causes an oversell, and Q1 excludes the whole episode. That is honest but costly to traders. | all |
| Q7 | A closed trade shows the symbol at the close. `sell_id` is unchanged, so theses re-attach. | | all |
| Q8 | Holding period runs from the original buy across splits, stock dividends and renames. | A split is not a sale. This matches tax treatment. | all |
| Spin-off | New shares with no basis become tainted lots. The parent's basis allocation is unknown. If the vendor row names no parent (the usual case), every open lot in that account at that instant is tainted. If it does, only the parent pair is. A later sell drawing a tainted unit is excluded whole and counted as corporate. Lots bought later, and other accounts, are untouched. | Spin-offs rarely post a row on the parent (quant). Erring this way is right under F3c. | all |
| Shorts | Unchanged: a sell with no lots is excluded and counted. | | all |
| Math | Split by p/q: units ×p/q, price and fee per unit ×q/p. Total cost and entry fees are conserved. Unit comparisons are relative to the size involved. | | quant |
| Storage | Append-only `corporate_actions` table (cascade-deleted with the user, `unique(source, external_id)`, raw jsonb), plus an `insertCorporateActions` helper with its own DB test. **Not wired into the sync** until the owner's broker change. There is no dead probe in `syncUser`. | Engineer: nothing can fill it before broker.ts passes the rows. | all |
| Rebuild | The user's actions are read once. Pairs linked by renames are grouped into chains up front, skipped in the stream, and matched per chain with one query. Account-wide actions reach every pair in their account. Simulated accounts' and future-dated actions are not applied. The counter is written with its own `update`. | Keeps the edits to the shared `lib/sync.ts` small and additive. | engineer |
| E2E | The vendor fake serves share-moving rows and honours the `type` filter like the vendor. The e2e imports across a 2:1 split and asserts the -45% wrong return appears nowhere (signed out, light and dark, 375px, page description, share card route) and the excluded line shows. The correct +10% after a split is proven by a DB test that feeds the fake's row shape through `fromVendorRows`. | broker.ts drops the split row, so the e2e can prove only the safety net until the owner's change. | engineer, business lead |

## Review and QA round 1 (independent code reviewer and tester, fresh context)
Every blocking finding was fixed and has a regression test. The fixes apply the committee's rule: when in doubt,
exclude and count.
- **Same-instant actions** (reviewer, blocking). A rename and a split at the same instant were applied in id order. That
  published -45% when the split's id sorted first. Now renames apply first. An action on the old symbol at the instant
  of its rename is ambiguous, so it taints the moved lots instead of being skipped.
- **/how copy** (reviewer, blocking). The split-adjustment sentence described behaviour that isn't live until the broker
  change, so it was removed. It lands with that change. The excluded item now says only what is true today: a position
  that sells more shares than its imported history holds is excluded whole.
- **Cash in lieu read as a wrong exact ratio** (tester, blocking). 33 shares becoming 3 fits 1:10 with 0.3 paid in cash,
  and exactly 1:11. "Prefer exact" picked 1:11. Now every fit counts, exact or with a leftover. Two ratios mean the
  action is unpriceable. Stock dividends resolve only to a whole percent (1% to 100%). The old q ≤ 100 grid let
  almost any share count fit. Small holdings without a description ratio are now often unpriceable. That is
  conservative and counted.
- **Transfers read as a rename** (tester, blocking). Renames now come only from a pair of ADJUSTMENT rows. A transfer out
  plus a transfer in is unpriceable.
- **Late-posted renames, and buys inside the window** (tester, blocking). Any trade of the new symbol within
  LATE_POSTING_DAYS before a rename taints the moved lots. So does a buy of the old symbol before a rename that
  exchanges at a ratio. A buy within the window before a split or stock dividend taints the adjusted lots, because it
  may already be in post-split shares.
  Cost: a trader who buys in the 14 days before a split loses that position from the record (counted). The committee's
  F3c rule accepts that cost. Measure it once real data flows.
- `parseRatio` reads only "n for m". A bare "n:m" can be a time ("EFFECTIVE 10:30").
- Non-blocking, fixed: the late-posting lookup is a binary search per sell (it used to scan every action). The rebuild
  indexes actions once (`actionIndex`). A stored rename to the same symbol is unpriceable instead of dropping lots. An
  action that empties the lots ends the episode.

## Review and QA round 2
- **Off-grid ratios** (tester, blocking). A 10% distribution booked as a split (11:10) resolved to the only grid fit,
  1:10, and showed -90.5%. A 2.5% stock dividend resolved to 2%.
  Fix: a resolution from units alone must have no rival ratio, with both sides up to 100, fitting either reading
  exactly or with a leftover. Otherwise it is unpriceable unless the vendor states the ratio ("2 FOR 1", or "5%" for a
  stock dividend: `parsePercent`).
  Cost: most cash-in-lieu events and units-only stock dividends need the stated ratio. Exact splits on ordinary
  holdings still resolve.
- **Double-reported exchange** (tester). A split on the new symbol at the same instant as a rename with a share
  exchange may be the same event reported twice. It now taints instead of scaling twice.
- **Lots that arrived through a rename** (reviewer). They escaped the in-window check before a split and showed +46.7%.
  The check now reads each lot's own date.
- Rename exchanges are checked exactly (no leftover) against every ratio with both sides up to 100.
- Accepted as is (reviewer, non-blocking): a split on the old symbol at its rename's instant ends up counted in
  `excluded_positions` (an oversell) rather than `excluded_corporate`. It is counted, and nothing wrong is shown.

## Remaining exposure (stated plainly)
Until `lib/broker.ts` passes corporate-action rows, two cases are still published with a wrong return:
- an unrecorded split followed by a partial sale and no oversell (buy 100 @ 100, 2:1, sell 100 @ 55 shows -45%);
- an unrecorded reverse split (buy 100 @ 10, 1:10, sell 10 @ 110 shows a fake **+1000%**).

The safety net catches these only once the position is oversold. Reconciling against broker holdings would catch them
earlier, but needs position units, which broker.ts doesn't return. That is part of the owner change request. F3c is
not fully met until that change lands.

## Owner change request for lib/broker.ts (protected)
1. `getAccountActivities`: request `type: 'BUY,SELL,SPLIT,STOCK_DIVIDEND,REI,ADJUSTMENT,TRANSFER,EXTERNAL_ASSET_TRANSFER_IN,EXTERNAL_ASSET_TRANSFER_OUT'`
   in `fetchActivities` and `fetchActivitiesPage`.
2. Keep `toActivities` for BUY/SELL. Pass the other rows to `fromVendorRows(accountId, rows)` from
   `lib/corporate-actions.ts`, and return its `activities` (REI as BUY) with the trades and its `actions` alongside.
3. In the sync and import step, call `insertCorporateActions(tx, userId, 'snaptrade', actions)` next to
   `insertActivities` (the rebuild already reads the table).
4. `fetchPositions`: also return `units` per position, so a later change can reconcile the ledger (gap above).

## QA round 3
No blocking defect. The tester's brute force found 0 wrong resolutions across:
- 20,961 cash-in-lieu split cases and 18,960 cash-in-lieu stock-dividend cases;
- 155,240 off-grid ratios with both sides up to 30;
- half-percent stock dividends.

Remaining minor case: a true ratio with a side above 100 (57:113, 101:1) can still resolve to a nearby grid ratio.
This came up in 14,470 of 8.05M generated cases. No real split or stock dividend uses such ratios. Odd merger
exchanges arrive as renames, which need an exact match and are excluded otherwise.

## Orchestrator review (2026-11-01), decided under the owner's delegation
- **Q1 is replaced.** An oversell excludes only the oversold sell (whole, matched part included). Sells shown earlier
  were priced from recorded lots and stay shown (TR-1: no per-trade hiding). The committee's episode rule could make an
  already-shown loss disappear: buy 100 @ 100, sell 50 @ 50 (-50%), then an unimported share and a sell of 51 removed
  the -50%. The oversell empties the ledger, and later buys start fresh lots. Each oversold sell still adds 1 to
  `excluded`. The flipped `lib/trades.test.ts` assertion stands (the oversold sell's matched part is not shown).
- **Same-day trades.** A trade on the same UTC day as a repricing action is never priced on a guess, because the vendor
  may date the row on the ex-date or the payable date. Same-day sells are excluded and counted as corporate, and same-day
  buys are tainted. This replaces "actions apply first" for pricing; the order is kept only for bookkeeping. Examples
  that used to publish a wrong return: +120% (sell at pre-split price on the day), -45% (buy at pre-split price on the
  day), +1000% (the same for a reverse split).
- An oversell that draws lots an unresolved split left unscaled is counted in `excluded_corporate`, not
  `excluded_positions`.
- With the episode rule gone, the heavy-feed e2e fixture is back above its original floors (4,595 to 4,802 closes per
  trader), so `e2e/app.spec.ts` is unchanged by this PR.

## lib/broker.ts change (authorised by the orchestrator under the owner's instruction, 2026-11-01)
The owner's orchestrating session authorised this PR to make the broker change itself, so F3c holds end to end.
`lib/broker.ts` is still the only file that imports the vendor SDK. The change is a separate block at the end of the
file, so the options session's edits there do not conflict.
- `fetchShareMoves(u, accountId)` reads an account's whole history of share-moving rows, using the vendor's documented
  type-filter values `SPLIT,STOCK_DIVIDEND,REI,TRANSFER` (taken from the SDK's types, not guessed), and maps them with
  `fromVendorRows`.
- The sync (`syncUser`) and the import step (one account per step, cursor field `m`, after the trade pages and before
  the rebuild) store them: REI becomes a BUY activity, the rest go into `corporate_actions`.
- The trade read stays BUY/SELL only.
- Tests through the real path:
  - `lib/broker-corporate.test.ts`: the vendor fake over HTTP, then `syncUser` into the database;
  - the e2e import step in `e2e/connect.spec.ts`.
  The -45% (2:1 split, then a partial sale) and +1000% (1:10 reverse split) inputs read +10%. A 5% stock dividend and a
  reinvestment are priced, and a transfer in is excluded and counted.
- **What remains:**
  - a split the vendor never reports, followed by a partial sale (fix: reconcile the ledger with the vendor's position
    units);
  - renames and external transfers, whose types are not documented filter values (their sells are excluded, never
    priced);
  - one extra vendor request per account that `syncCost` does not count.
  Each has a ponytail note in the code.

## Follow-ups (not in this change)
- Widen the rival check past 100:100 if real data ever shows ratios that large.
- `confidence()` clusters bets by symbol, so a renamed position can count as two bets: at most one extra per rename.
  That one extra bet moves the 5-bet floor for showing a range and lowers the degrees of freedom of the interval.
  The fix is a chain key per trade (a `closed_trades` column).
- Business lead: the "earlier position" wording of `excluded_positions` now means one sell. Revisit the copy.
- Measure on real data how many trades the late-posting window and the account-wide spin-off taint exclude. If the
  safety net excludes more than about 10% of positions, prioritise the broker change.
- `/me/record` shows `excluded_positions` only. The corporate count is on the public profile. `lib/session.ts`
  (protected) would need the column to show it there.
