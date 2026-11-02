# F-32 Part A build brief (orchestrating build session, 2026-11-01)

Feature: `docs/features/F-32-transfers-named-never-remove-a-closed-trade.md`. Part A only. Part B waits on OD 2.28 and
the vendor's MRC2-10 answer and is not built here.

## Prerequisites
- F-24 merged as #84 (bdf3ea9): `held` rows, `heldKeys`, `excludedHeld` in `lib/trades.ts#replay`.
- Fixes cycle 4 (#89): the gap rule (`Book.gap`, every later sell of the pair counted in `excluded`).
- Chore C5-43(b) (matcher catch-up in the sync tick) is being built on `claude/chores-cycle5-matcher-catchup`. This
  PR's MATCHER_VERSION bump must merge after it. F-36's bump never ships in the same deploy.

## Where transfers enter today
- `lib/corporate-actions.ts#fromVendorRows`: vendor rows TRANSFER, EXTERNAL_ASSET_TRANSFER_IN and
  EXTERNAL_ASSET_TRANSFER_OUT (unpaired) become `{ kind: 'unpriceable', reason: 'unknown', units? }`, exactly like a
  lone ADJUSTMENT. A spin-off description wins first (`reason: 'spin-off'`).
- `lib/trades.ts#replay` counts their effects in `excludedCorporate` by three paths:
  1. backward window: `latePosted` (sell dated within 14 days before any repricing action on the pair);
  2. same day: `sameDayAction`;
  3. forward taint: the action taints the pair's lots (`taint`), a transfer in pushes a tainted no-basis lot, and a
     later sell drawing a tainted lot (oversell included) is counted.
  Profile line: `PROFILE.excludedCorporate` ("n trades excluded: a share move, corporate action or broker row the
  importer can't price."), from `users.excluded_corporate`.

## Engineering proposal (for the plan author to accept or change)
- Identify a transfer in the loader (`loadCorporateActions`) from the stored vendor row's type
  (`raw->>'type'` in the three transfer types) and set `transfer: true` on that unpriceable 'unknown' action. Why the
  loader: rows already stored carry no flag in `detail`, so it must be derived there anyway; one path, no new stored
  field, and `fromVendorRows`' existing tests stay unchanged. ADJUSTMENT is not a transfer (Part B names it).
- `Lot` gets `cause?: 'transfer'`, meaning "tainted, and every taint on this lot came from a transfer". A corporate
  taint clears it (the split wins); a transfer taint on an untainted lot sets it; on a corporate-tainted lot it does
  nothing.
- Window and same-day: two time lists (all repricing actions, as today, and non-transfer ones). A sell in the window
  of a non-transfer action, or on its day, is corporate; else in a transfer's window or on its day, transfer.
- Sell classification: held → excludedHeld (unchanged, first); oversell → corporate if a drawn lot has a corporate
  taint or the ledger is unknown, else transfer if a drawn lot has a transfer taint, else excluded; not oversold →
  corporate (corporate taint / window / same day), else transfer (transfer taint / window / same day), else gap →
  excluded, else shown. So Part A only relabels a subset of today's `excludedCorporate`: every shown figure and every
  other count is unchanged, and the partition shown / excluded / excludedCorporate / excludedTransfer / excludedHeld
  holds.
- `MatchResult` gains `excludedTransfer?: number` (present only when nonzero, as `excludedHeld`). One exported list of
  the `excluded*` keys and one sum function (`exclusionSum`), with a type-level and runtime test that fails if a key
  of `MatchResult` starting with `excluded` is missing from the list (F-21 is not built yet; it will consume this).
- `users.excluded_transfer int not null default 0` (additive), written by `rebuildTrades`; profile line and the
  owner tool's line render one `lib/copy.ts` label; `/how` gains a sentence rendering the same label with an anchor the
  profile line links to.
- MATCHER_VERSION 2 → 3 (Part A's own bump).
- Gap from a transfer out with 0 held stays `excluded` (it is missing history, the gap rule), not "transfer".

## The probe (C5-1, p5, fictional)
WX: BUY 100 @100, SELL 100 @40 (−60%); YX: BUY 100 @100, SELL 100 @140 (+40%); a +1 WX TRANSFER in 12 days after the
WX close. Today: only YX shows, corporate count 1. Part A: still only YX (Part B fixes that), but the count is
"transfer" 1, corporate 0, and the profile names it. The cycle-5 end-to-end variant (`/u/c5rt_xfer`) had five trades
(win rate 80% → 100%); the test reproduces that with a fictional five-close record.
