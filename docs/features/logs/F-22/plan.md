# F-22 implementation plan (UX lead, round 1, 2026-11-02)

Scope: `docs/features/F-22-transfers-as-share-moves.md` (owner yes, OD 2.28, 2026-11-02), built on F-32 Part A (#108) on
`claude/f22-transfers-share-moves` as its own PR. Builds on `brief.md`, accepted with the changes in §9. Part B of F-32 (the
backward window and same-day rule for transfers) is not touched. No decision is changed; two points the letter of a
decision leaves open go to the owner (§8 items 1-3).

## 1. Matcher rules (`lib/trades.ts#replay`, transfer rows only; every other action unchanged)

A transfer row is `isTransfer(ca)` (F-32 Part A's loader flag). Its direction: `units > 0` in, `units < 0` out; the loader
(`lib/corporate-actions.ts#withTransfer`) adds `out: true` for type `EXTERNAL_ASSET_TRANSFER_OUT`, and when a type's
direction contradicts the sign (`_OUT` with units > 0, `_IN` with units < 0) it drops the units: the row is unit-less
(never guessed). Rules, in the `else` branch where unpriceable actions apply today:
- **R1 Transfer in** (units > 0): older lots of the pair are not tainted. One lot is pushed for the moved-in units,
  `{ price: 0, tainted: true, cause: 'transfer' }` (cause corporate when another action shares its day, as Part A). A sell
  drawing only older lots is priced; a sell drawing any moved-in unit is counted "transfer" (an oversell too). "The
  moved-in unit is counted" (probe 1) means exactly this: it stays an open no-basis lot until a sell draws it.
- **R2 Transfer out** (units < 0), `h` = units held, `x = |units|`; `transfersOut++` in every case:
  - `h = 0` (and no rename at that instant): gap of `x`, as today (later sells "no recorded entry").
  - `x ≥ h(1 − RATIO_TOLERANCE)`: the whole position moves. Remove every lot; no taint; a gap for `x − h` when it is beyond
    tolerance (beyond-held, as today).
  - `x < h` and every lot of the pair is **uniform** (same per-unit price, fee per unit, opening instant, `verified` and
    taint state, equal within 1e-9 relative): `removeOldest(x)`, no taint.
  - otherwise: `removeOldest(x)`, then `taintBy(lots, ca)` (cause transfer): sells of the shares left are counted.
  - The vendor never names lots today, so "the vendor names the lots" has no code path. `ponytail:` naming it.
- **R3 Unit-less transfer** (no units, or units dropped by the loader): `taintBy` every lot, as today. Counted in
  `transfersOut` only when the loader marked it `out` (type `_OUT`); a unit-less `TRANSFER` has no direction, so it is not.
- **R4** Unknown kinds, splits and stock dividends with an unknown ratio, spin-offs, adjustments: unchanged (taint).
- Window and same-day lists (`transferTimes`, `transferDays`), the same-instant rename rule (`moved.to`) and the
  classification order are F-32 Part A's, unchanged (Part B). Header comment rewritten; Part A's forward-path ponytail
  removed; new `ponytail:` lines: vendor-named lots; MRC2-10 (split or reverse split sent as a transfer row, §11 Q2);
  unit-less `TRANSFER` with no direction (a whole position can leave unseen, as before F-22).

## 2. Division with F-32 Part B (brief accepted)
F-22 owns what a transfer does to lots (R1-R3) and the `transfersOut` count. Part B owns whether a transfer sits in the
backward window and same-day lists; it still waits on MRC2-10. F-22 adds no window or day rule and removes none. Part A's
reason labels and `excludedTransfer` stay; F-22 only changes which sells reach them.

## 3. Data model and the shared sum
- `db/schema.sql`: `select schema_add_column('users', 'excluded_transferred_out', 'int not null default 0');` One additive
  line; no drop, truncate, delete or rewrite. No units, date or account of a transfer is stored (P3).
- `MatchResult.transfersOut?: number` (present only when nonzero). It counts transfer-out **rows**, not sells, so it is
  deliberately not named `excluded*` and is not in `EXCLUDED_KEYS` (that list is F-32's per-sell partition:
  `trades + exclusionSum = sells` stays true). New `COUNTED_KEYS = [...EXCLUDED_KEYS, 'transfersOut'] as const` and
  `countedSum(r)`: the function F-21 consumes. Guard: every numeric key of `MatchResult` is in `COUNTED_KEYS` (tsc
  `satisfies` + runtime), so a later count can't be left out.
- F-21 tension (owner/F-21 committee, §8 item 3): F-21 decided its sum counts "sells and option closes only, never mixed
  under 'trades'"; F-22 decided "summed by F-21's shared function". Plan: `countedSum` includes it (F-22's AC), and F-21's
  line must name both units ("sells and share transfers out"), never "trades". Hand-off note in F-21's file by the builder
  is out of scope here (edit no other file); listed for the orchestrator.
- `lib/sync.ts#rebuildTrades`: sum `m.transfersOut ?? 0`, write `excluded_transferred_out` in the same transaction, return
  it. `lib/matcher-report.ts`: add `transferred_out` to the per-reason counts (counts only, no ids).
- Reads: `app/u/[handle]/load.ts` and `lib/record-tools.ts#card` select the column.

## 4. What the trader and the viewer see

| State | Profile (signed in or out, same page) |
|---|---|
| `excluded_transferred_out = 0` | No line, no placeholder, no space |
| 1 | `1 share transfer out of an account: not a closed trade, so no return is shown for it.` muted link |
| n > 1 | `3 share transfers out of an account: not closed trades, so no return is shown for them.` |
| Signed out (shared link) | Identical; the count is public like every other exclusion count |
| Demo | Same rule; the seed has no transfers, so no line. Never "Verified" beside a demo |
| Probe 3 (no closes, n = 1) | Existing no-closes copy + this line; no win rate (unchanged) |
| With the transfer-sells line | Both lines: positions, future, corporate, transfer, **transferred out**, held, paper |
| Importing / before the v4 rebuild | Column default 0: no line until the rebuild writes it (true, just later) |
| Frozen (disconnected) / failed sync | The stored count stays and shows (records freeze, TR) |
| Compare cards | Same string as a plain line after the transfer line (cards are strings, no link, as the others) |
| `/me/record` | Not shown: needs `lib/session.ts` (protected). `ponytail:` as for `excluded_transfer` |
No warning colour, icon, badge, toast or tooltip; no new error or loading state (a static render of a column).

## 5. Copy (`lib/copy.ts`; neutral, no cause, no blame, no completeness claim)
```ts
PROFILE.excludedTransferredOut = (n: number) => n === 1
  ? '1 share transfer out of an account: not a closed trade, so no return is shown for it.'
  : `${count(n)} share transfers out of an account: not closed trades, so no return is shown for them.`;
PROFILE.excludedTransferredOutLink = 'How share transfers out are counted'; // visually hidden suffix of the link name
const TRANSFER_OUT_HOW = `Transfers out of an account. Shares that leave an account by transfer are not a closed trade
  and have no return; each transfer out is counted as “share transfer out of an account”. The shares that left are
  taken from the oldest buys first (first in, first out, which is this record’s own matching method, not the
  broker’s), and only where that can’t change the buy price or date of the shares left: the whole holding moved, or
  every buy still held has the same price, fee and date. Otherwise the sells of the shares left are counted as
  “excluded: ${TRANSFER_REASON}”, wins and losses alike.`;
```
- `TRANSFER_HOW` (Part A) becomes true for R1: "…when a transfer of that stock into or out of its account falls close to
  the sell's date, when the sell uses shares that arrived by transfer (their buy price is unknown), or when it sells shares
  left after part of a holding moved out by transfer (which shares left is unknown): a limit of how trades are matched,
  not a judgment of the trader." ("while the sold shares were held" is no longer true and goes.)
- `HOW.excluded`: `TRANSFER_OUT_HOW` right after `TRANSFER_HOW`; `app/how/page.tsx` gives it `id="transfers-out"`
  (same map as `#transfers`). `HOW.transferOut = TRANSFER_OUT_HOW`.
- `HOW.verified` (the Verified definition; there is no `VERIFIED_DEFINITION` constant) gains one sentence, same PR as the
  decision asks: "Shares moved into or out of an account by transfer are counted, not priced, as described below." F3a's
  meaning (broker-sourced, nothing more) is unchanged.
- Banned in this PR, extended in the copy scan (`lib/a11y-copy.test.ts` list): "can't remove a loss", "nothing hidden",
  "can't be steered", "every trade", "all trades", "complete record". "can't hide single trades" may appear only with the
  exclusion qualifier; this PR adds no such claim anywhere. The F-32 title stays out of product copy (Part B pending).

## 6. Component and accessibility (Part A's conventions, reused)
`app/u/[handle]/page.tsx`, after the transfer line:
`{user.excluded_transferred_out > 0 && <p className="muted" data-excluded-transferred-out><a className="tap44 excluded-link"
href="/how#transfers-out">{PROFILE.excludedTransferredOut(n)}<span className="sr-only"> {PROFILE.excludedTransferredOutLink}</span></a></p>}`
Accessible name = visible text first, then the suffix (WCAG 2.5.3); underlined (not colour alone); `--muted` ≥ 4.5:1 in
both schemes; ≥ 44 px tall; global focus ring; wraps inside 16 px gutters at 320 px. No new CSS.

## 7. Tests per acceptance criterion
Files: `lib/f22-transfers.test.ts` (the builder's draft already in the tree matches R1-R3; keep and extend it), `lib/f22-transfers.db.test.ts`,
`e2e/f22-transfer-out-line.spec.ts`; `e2e/fakes/vendor.ts` type union gains the two `EXTERNAL_ASSET_TRANSFER_*` types.
Fictional symbols and handles only (`WX`, `f22_out`).

| AC | Test |
|---|---|
| Probe 1 | Unit: BUY 100@100 d0, +1 transfer d20, SELL 100@40 d40 → one shown −60%, no counts; adding SELL 1 d50 → `excludedTransfer` 1 |
| Probe 2 | Unit: BUY 100@100, −1 transfer d20, SELL 99@40 d40 → shown −60% on 99, `transfersOut` 1 |
| Probe 3 | Unit: BUY 100, −100 d20 → no trade, `transfersOut` 1. DB: stored `EXTERNAL_ASSET_TRANSFER_OUT` row through loader + `rebuildTrades` → `users.excluded_transferred_out = 1` |
| Basis rule | Unit: lots 50@100 d0, 50@60 d5, −50 d20, SELL 50 d40 → transfer 1, out 1. Same price, other date → counted. Same price/date, one unverified → counted. Uniform lots → shown. Whole move then new BUY/SELL → shown on the new lot |
| Beyond held | Unit: hold 20, −15… and −25 → gap; later sells `excluded`; `transfersOut` 1 |
| Property | Fuzz §7.1 F3-F5 |
| Two own accounts | Unit + DB: −100 out of A, +100 into B, SELL in B → out 1 + transfer 1, no sell lost; B never sells → out 1; partial non-uniform move → A remainder counted, B counted; fuzz F2 |
| Unknown kinds | Unit: unit-less `TRANSFER`, unknown action with units, split with unknown ratio → tainted, counted as today; loader: `_OUT` with +units → unit-less, `out` |
| Byte-identical | DB: `rebuildTrades` twice → `closed_trades` rows (every column but the surrogate id, ordered by `sell_id`) and all `users.excluded_*` equal as JSON; unit: repeat + shuffle deep-equal |
| Schema additive | Existing invariant (no drop/truncate/delete) + scan: the only new schema line is the `excluded_transferred_out` add |
| Profile line + F-21 sum | e2e 360 px, light and dark, signed out: n=1 and n=3 text equals `PROFILE.excludedTransferredOut(n)`, link `/how#transfers-out`, name ends "How share transfers out are counted", height ≥ 44, colour `--muted`, contrast ≥ 4.5, no role=alert/icon; order after `[data-excluded-transfer]`; n=0 → absent; 320 px no horizontal scroll; following lands on `#transfers-out` containing "first in, first out" and "not the broker"; P3 scan for the seeded row's units 37.125, date 2024-03-14, account F22-ACCT in HTML and responses; compare card shows the string. Unit: `countedSum` includes `transfersOut`; `COUNTED_KEYS` guard |
| Taint tests kept | Every existing test file still runs; the count only rises; edited tests listed in the PR body (§7.2) |

**7.1 Fuzz** (`lib/f22-transfers.test.ts`, F-32's mulberry32 generator extended: outs that are whole, beyond, partial on
uniform and on mixed lots, unit-less `_OUT`, paired A→B moves; 2,000 fixed seeds; `FUZZ_SEED` replays; `seed N:` + ledger
JSON). Test hook `MatchOptions.touched?: Set<string>`: ids of sells that drew a lot opened after a transfer of the pair,
or one a transfer removed units from or tainted (production never passes it).
F1 order independence. F2 partition: `trades + exclusionSum = sells`; `transfersOut` = out-direction transfer rows.
F3 (AC "never changes a sell whose drawn lots predate it and were not moved"): every sell outside all transfer windows
and days and not in `touched` has the same reason, and if shown a deep-equal trade, as with every transfer row deleted.
F4 (AC "never improves", literal): ledgers whose transfers in and unit-less transfers are dated after the pair's last buy,
sells outside windows/days → `headline` win rate and average equal to the run without them.
F5: no sell is shown with a transfer at a figure it lacks without it, unless it draws only lots opened after that transfer.

**7.2 F-32 Part A tests updated, never deleted** (`lib/f32-transfers.test.ts`): "pinned (probe p4)" → renamed "formerly
pinned p4: F-22 closes the forward path"; asserts one shown −60% close and no transfer count (comment keeps the history).
Fuzz (b) "relabels only" → with the flag, every trade shown without it is still shown, deep-equal, and each sell's reason
changes only corporate → shown / transfer / excluded. C5-1 end-to-end: comment says only Part B fixes the window case
(assertions unchanged). `e2e/connect.spec.ts` XFERCO (transfer in to an empty pair) and the Part A e2e are unchanged.

## 8. Owner items (only the owner clears)
1. MRC2-10 widened: can a split or reverse split arrive as a transfer row, in either direction; is `TRANSFER`'s sign its
   direction; are unit-less transfers sent? Recommend: F-22 merges after the vendor's written "no" or the owner's written
   acceptance of the limit (§11 Q2: a reverse split as a transfer out can show a gain that is not there).
2. The uniform test adds opening instant and `verified` to the decision's "same per-unit price and fee": stricter, and
   needed for the AC "never changes a sell whose drawn lots…" (F3). Confirm, or drop it and that AC fails by design.
3. F-21's "sells only" sum vs F-22's "summed by F-21's function": confirm `countedSum` and F-21's two-unit wording.
4. Final wording of the line and `TRANSFER_OUT_HOW` (committee wording); POLICY F3 naming transfers out (protected-files
   session, approved); OD 2.7 consent version names this new public count; `/me/record` needs `lib/session.ts`.

## 9. Rollout and the brief
Merge order: #107 (C5-43(b)) → #108 (Part A, v3) deployed → this PR (`MATCHER_VERSION = 4`), never in the deploy carrying
#108's or F-36's bump; if F-36 lands first, whichever merges later takes the next number; an undrained version rebuilds
straight to the latest. Expected report: shown ≥ 0, transfer ≤ 0, excluded ≥ 0 (oversells that drew a transfer-tainted
lot), transferred_out ≥ 0, corporate and held 0; any other sign stops the deploy. Theses return by `sell_id`.
Brief: accepted R1, R3, the division, `transfersOut` outside `EXCLUDED_KEYS`, the ponytail, and the test updates. Changed:
the uniform test also checks `verified` and taint state; loader direction by type (sign contradictions are unit-less);
unit-less `_OUT` counted; `COUNTED_KEYS`/`countedSum` named; a link target `#transfers-out`; F3-F5 replace the brief's Q1 form.

## 10. COMPLIANCE §1
1. Performance: shows more true closes (losses as gains), a count and a reason; disclaimer already on the profile; no
   advice words; no completeness claim (§5). 2. Personal data: one public integer per user, deleted with the row; no
   units, date or account stored or shown (P3, e2e scan). 3. Money: no. 4. Messages/tracking: none. 5. User text: none.
6. Sign-up/age/identity: no. 7. Vendor/dependency/asset: none new; reads the stored vendor type. 8. Accessibility: §6,
   e2e. 9. Security: no endpoint or auth change. 10. Claims: none; banned-phrase scan extended. 11. Checkout: no.

## 11. The brief's four hard questions
- Q1: agreed, the literal property can't hold (backward window; whole move then new buys; a transfer in ahead of a later
  buy moves that sell to a count). Tested as F3 (unmoved sells unchanged, the AC's second half, strictly), F4 (literal
  "never improves" where it is a true guarantee: transfers in and unit-less after the last buy) and F5 (no shown figure
  changes; only moves to a named count). With the brief's date clause and `verified`, F3 holds; without them it fails.
- Q2: a `ponytail:` naming MRC2-10, as proposed, but it is wider: a reverse split sent as a transfer out on one lot passes
  the basis rule and can publish a gain that isn't there (buy 100 @10, −50 "out", sell 50 @20 → +100%, true 0%). Before
  F-22 the taint stopped this. Owner item 1; no heuristic (any size rule reopens probe 1 for that size).
- Q3: agreed: no cause, no blame; `HOW.verified` is the Verified definition and changes in this PR; FIFO is "this record's
  own matching method, not the broker's"; POLICY F3's list is the protected-files session's.
- Q4: agreed, with the exact updates in §7.2 (p4 renamed and flipped, fuzz (b) restated, C5-1 comment); none deleted.

## Round 2 changes (orchestrating build session, after round 1)
Business lead (CHANGES REQUIRED, 8) and engineer (CHANGES REQUIRED, 8). Both chose option (a) for Q5.
- Q5 (BL 1, EN 1-3): moved-in units are drawn last (`Lot.movedIn`; recorded buys, also later ones, go before them; a
  rename's merge keeps them last). A sell that draws recorded and moved-in units is shown, priced on its recorded units
  (exit fee prorated by units, `verified` and `openedAt` from recorded lots), and counted in `sellsPartlyTransferred`
  (`users.sells_partly_transferred`, a profile line linking to /how#transfers). A sell drawing only moved-in units is
  counted "transfer"; an oversell keeps today's reason. The count is in no sum (the sell is shown): `NOT_SUMMED_KEYS`.
- BL 2 (owner item 2 resolved by the committee): the "alike" test is price, fee, `verified`, taint state and moved-in;
  not the opening date (which share left changes no return, only the holding period, which follows this record's FIFO;
  /how says so). The UX lead's stricter clause is dropped.
- BL 3: a `ponytail:` names the remaining move (mixed lots: one share out leaves the rest counted). The measurement
  counter `transfer_out_then_counted` is not added: the per-reason rebuild report (#108) shows the transfer count's move
  per deploy, and a new column for a diagnostic is not worth its privacy map; noted for the owner.
- BL 4/5: copy as demanded ("1 transfer out of an account: not a closed trade, so no return is shown."; link "How
  transfers out are counted"; /how item in three sentences, with the limit in plain words).
- BL 6: `countedSum` returns `{ sells, transfersOut }`, never one number; guard test lists every numeric key.
- BL 7, EN 7: merge hold in both directions (a split sent as a transfer in publishes a false loss; a reverse split sent as
  a transfer out a false gain). Pinned tests for both rows. Owner item: the vendor's written MRC2-10 answer (preferred) or
  the owner's written acceptance.
- BL 8: the pre-deploy diagnostic (transfers whose units are a clean ratio of the holding) needs a ledger replay; it goes
  to the owner's deploy checklist with the merge hold, not into this PR.
- EN 5: a whole-position move clears every lot (no sliver below tolerance). EN 6: the loader direction rule is built
  (`out` for _OUT; a sign that contradicts the type drops the units); the `touched` hook is replaced by direct
  comparisons: against the same ledger without its transfers in, a sell shown in both is identical, a newly shown sell
  is one the ledger alone had no recorded entry for, and a removed one is in a transfer's window or day (the sell's or a
  buy's: Part B).
- EN 8: `TRANSFER_HOW` says moved-in shares are matched after every recorded buy, and a sell using both is shown for its
  recorded shares only.
- Found by the property (seed 111), fixed: a moved-in lot no longer makes a split taint the recorded lots (one share moved
  in before a split would have turned every later sell into a count).
