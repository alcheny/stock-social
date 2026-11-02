# F-32 Part A implementation plan (UX lead, round 1, 2026-11-02)

Scope: Part A of `docs/features/F-32-transfers-named-never-remove-a-closed-trade.md` only. Part B is not built. Builds on
the brief (`brief.md`, accepted with the changes in §9). Context: the owner answered OD 2.28 yes (a transfer is a share
move under F-22's basis rule); F-22 lands later as a second PR on top of this one. Part A's scope is unchanged, and no
Part A copy says POLICY F3 names transfers out (that edit is drafted elsewhere and is the owner's).

## 1. What the trader and the viewer see

Part A changes no shown figure. It moves a subset of today's `excludedCorporate` count to its own reason, "transfer",
and names it on the profile with a link to one /how sentence. Every state:

| State | Profile (signed in or out, same page) | /how |
|---|---|---|
| No transfer exclusion (`excluded_transfer = 0`) | No line, no empty placeholder, no extra space | The sentence is always there (static page) |
| 1 transfer exclusion | `1 sell excluded: a share transfer in the same stock.` as a muted link | same |
| n > 1 | `3 sells excluded: a share transfer in the same stock.` (`counted()` plural, never "(s)") | same |
| Signed out (shared link) | Identical: the count is public, like every other exclusion count | same |
| Demo record | Same rule; seed has no transfer rows, so no line today. A demo with one shows the line beside the Demo badge, never "Verified" | same |
| Both corporate and transfer counts | Two separate lines, corporate first, then transfer, then held: positions, future, corporate, transfer, held, paper | same |
| Importing / no closes yet | Line follows `excluded_transfer` as the other count lines do (written by the rebuild); nothing else changes | same |
| All closes excluded (0 shown, n transfer) | Existing empty-closes copy plus the transfer line; no win rate shown (unchanged) | same |
| Compare cards (`lib/record-tools.ts` ~207-238) | `excluded_transfer` read; the same `PROFILE.excludedTransfer` string as a plain line (cards are strings; no link, as the other lines there) | n/a |
| Owner's `/me/record` | Not shown: needs `lib/session.ts` (protected). `ponytail:` like `excludedHeld` | n/a |

No warning colour, icon, badge, toast or tooltip anywhere. No new error state: the line is a static render of a column.

## 2. Copy (one constant, `lib/copy.ts`)

```ts
// F-32 Part A: one label for the transfer reason, rendered by the profile line, the compare card and /how.
export const TRANSFER_REASON = 'a share transfer in the same stock';
PROFILE.excludedTransfer = (n: number) => `${counted(n, 'sell')} excluded: ${TRANSFER_REASON}.`;
PROFILE.excludedTransferLink = 'How share transfers are counted'; // visually hidden suffix of the link's name
HOW.transfer = `Sells excluded: ${TRANSFER_REASON}. When shares of a stock move into or out of an account by transfer, the importer has no price for them, so a sell of that stock in that account close to the transfer's date, or one that uses transferred shares, is excluded and counted under this reason, wins and losses alike. This is a limit of how trades are matched, not a judgment of the trader.`;
```

Why "the same stock", not the brief's "this stock": the profile line sums over stocks, so "this" has no referent.
Noun "sell": the matcher counts sells (as `excludedHeld`). Why "close to the transfer's date" rather than "within 14
days": stating the exact window publishes how to time a transfer to remove a loss, while the forward path stays open
until F-22; the meaning is still plain (owner may choose otherwise, §8). The sentence names transfers in (as POLICY F3
does) and describes transfers out only as a matching fact; it never cites POLICY for them. Banned everywhere in this PR:
"can't remove a loss", "nothing hidden", "can't be steered", "every trade", "all trades" (scanner + §6 T10).

/how changes (`HOW.excluded`): add `HOW.transfer` as an `<li id="transfers">` right after the "Transfers in, and sells
with no recorded entry" bullet. In the corporate bullet "Stock splits ... spin-offs and transfers in: ..." drop
"and transfers in" (they now have their own reason). `PROFILE.excludedCorporate` stays word for word (it still covers
unpaired adjustments and unusable rows). The `HOW.excluded` keys stay plain strings except the transfer item, which
`app/how/page.tsx` renders with its id (map over items; give the one equal to `HOW.transfer` `id="transfers"`).

## 3. Component and styles

`app/u/[handle]/page.tsx`, after the corporate line:
```tsx
{user.excluded_transfer > 0 && (
  <p className="muted" data-excluded-transfer>
    <a className="excluded-link" href="/how#transfers">{PROFILE.excludedTransfer(user.excluded_transfer)}
      <span className="sr-only"> {PROFILE.excludedTransferLink}</span></a>
  </p>
)}
```
- Accessible name = the visible line + " How share transfers are counted" (descriptive; visible text first, WCAG 2.5.3).
  Uses the existing `.sr-only` class (`app/globals.css`).
- `app/globals.css`: `.excluded-link { color: inherit; text-decoration: underline; text-underline-offset: 2px;
  display: inline-flex; align-items: center; min-height: 44px; overflow-wrap: anywhere; }` with the global focus ring.
  Colour only via `--muted` (inherited from `.muted`; ≥4.5:1 in both schemes). Underline so the link is not identified
  by colour alone (A1). No new colour token, no hover colour change beyond the existing link rule.
- Reflow: text wraps inside the 16px gutters at 320px; no horizontal scroll; the box stays ≥44px tall.
- `app/u/[handle]/load.ts`: add `excluded_transfer` to the user select.

## 4. Data model and matcher (accepts the brief, with §9's changes)

- `db/schema.sql`: `select schema_add_column('users', 'excluded_transfer', 'int not null default 0');` additive, no
  rewrite, no drop/truncate/delete. No other column: no units, date or account of a transfer is stored (P3).
- `lib/corporate-actions.ts`: `CorporateAction` unpriceable `'unknown'` gains `transfer?: true`. `loadCorporateActions`
  sets it when `kind = 'unpriceable'`, `detail->>'reason' = 'unknown'` and `raw->>'type' in ('TRANSFER',
  'EXTERNAL_ASSET_TRANSFER_IN','EXTERNAL_ASSET_TRANSFER_OUT')` (one SQL boolean column). A spin-off described
  transfer stays `spin-off`; ADJUSTMENT is never a transfer; `fromVendorRows` unchanged.
- `lib/trades.ts`:
  - `Lot.cause?: 'transfer'`; `taint(lots, cause?)`: a corporate taint sets `tainted` and deletes `cause`; a transfer
    taint sets `cause` only on an untainted lot. A transfer-in lot is pushed `{ tainted: true, cause: 'transfer' }`.
    A rename's `moved.to` taint from a transfer carries the cause; shadow lots, `unknownFrom` and rename taints are
    corporate. A buy on a transfer-only day is tainted with cause transfer; on any other action's day, corporate.
  - Window and same day: two time lists / day sets (all repricing, non-transfer). Corporate first, then transfer.
  - Classification, in order: held → `excludedHeld`; oversell → corporate if any drawn lot is corporate-tainted or the
    ledger is unknown, else transfer if any drawn lot has a transfer taint, else `excluded`; else corporate (corporate
    taint / non-transfer window / day), else transfer (transfer taint / window / day), else gap → `excluded`, else shown.
  - `MatchResult.excludedTransfer?: number` (present only when nonzero). `export const EXCLUDED_KEYS = ['excluded',
    'excludedCorporate', 'excludedTransfer', 'excludedHeld'] as const` and `exclusionSum(r)` (F-21 consumes it).
  - A transfer out (or unit-less transfer) on an empty pair still leaves the gap: later sells are `excluded` (missing
    history, C4-2). The sell before it, inside the window, is "transfer". Both are pinned in tests.
  - Header comments updated; `ponytail:` on the forward path naming OD 2.28 / F-22.
  - `MATCHER_VERSION = 3`.
- `lib/sync.ts#rebuildTrades`: sum `m.excludedTransfer ?? 0`, write `users.excluded_transfer` in the same transaction;
  return it. The unusable-trade-row top-up (line ~178) stays corporate.
- Deploy report (decision "counts per reason"): `rebuildAllForMatcher` logs one JSON line of summed per-reason deltas
  (`{ shown, excluded, corporate, transfer, held }`, counts only, no ids or handles) plus failures with each cause class.
  If C5-43(b) already adds a report, Part A only adds the `transfer` key to it.

## 5. Rollout

1. Merge order: F-24 (#84, merged) → chore C5-43(b) (`claude/chores-cycle5-matcher-catchup`) on main → this PR. The
   bump never ships in the deploy that carries F-36's bump; if F-36 merges first, this waits a deploy (and vice versa).
2. Deploy: schema adds the column (default 0); the catch-up rebuilds each record to version 3; profiles show the line
   as records drain. Before a record is rebuilt it shows its old corporate count (true, just coarser).
3. Expected report: corporate −k, transfer +k, every other delta 0. Any nonzero shown/excluded/held delta is a bug:
   stop and investigate (the partition property says it cannot happen).
4. F-22 later: its own PR on top; it may change shown figures and carries its own bump and copy.

## 6. Tests per acceptance criterion

New pure tests in `lib/trades-transfer.test.ts`; DB tests in `lib/trades-transfer.db.test.ts`; fuzz in
`lib/trades-transfer.fuzz.test.ts`; e2e in `e2e/f32-transfer.spec.ts`. Every existing test kept unchanged, except
assertions that read `excludedCorporate` for a transfer fixture, which are split (old = new corporate + transfer, with
a comment); the test count only rises.

| # | Acceptance criterion | Test |
|---|---|---|
| T1 | p5 probe | Unit: WX BUY 100@100, SELL 100@40; YX BUY 100@100, SELL 100@140; `{unknown, transfer, units: +1}` on WX 12 days after the WX sell. Assert trades = [YX +40%], `excludedTransfer` 1, `excludedCorporate` 0. DB: same via stored rows (`raw.type = 'TRANSFER'`) through `loadCorporateActions` + `rebuildTrades`: `users.excluded_transfer = 1`, `excluded_corporate = 0` |
| T2 | RT's three forms + same-day + forward draw | Unit, one case each: transfer in (+units); transfer out (−units) with 0 held; transfer with no units; a sell on the transfer's own day; a sell drawing a transferred-in lot. Each: `excludedTransfer` 1, `excludedCorporate` 0 |
| T3 | Split wins | Unit: an unresolvable split and a transfer both within 14 days after one sell, and on one day with it → corporate 1, transfer 0. Also: a lot tainted by both → corporate |
| T4 | p4 pinned | Unit: transfer dated before the sell (+1 unit into a pair holding 100) → sell counted, `excludedTransfer` 1, trades []. Comment: "OD 2.28 / F-22 closes this path; update this test in that PR" |
| T5 | Split window unchanged | All existing window tests run unchanged; plus: a split-only window with no transfer flag gives the same result as on main (`MATCHER_VERSION` aside) |
| T6 | Key in the shared sum | Unit: `EXCLUDED_KEYS` equals every `MatchResult` key starting with `excluded` (type-level: a `satisfies` check that fails `tsc` if a key is missing; runtime: keys of a result built with every reason nonzero). `exclusionSum` equals the sum |
| T7 | No units, date, account | Source scan: `excluded_transfer` is the only schema addition; `MatchResult.excludedTransfer` is a number. Render test (e2e): the `[data-excluded-transfer]` text equals `PROFILE.excludedTransfer(n)` exactly (no date, unit or account text); the profile payload scan (F-23's `f23-payload-scan` pattern) finds no transfer row field |
| T8 | One constant, muted real link, 44px, 320px | Unit: `PROFILE.excludedTransfer(2)` and `HOW.transfer` both contain `TRANSFER_REASON`; copy scan for the banned phrases. e2e at 360px, signed out: the line is an `<a href="/how#transfers">`, accessible name contains the visible text and "How share transfers are counted", bounding box height ≥44, computed colour equals `--muted`, contrast ≥4.5 (axe), no icon/role=alert; following it lands on `#transfers` whose text contains `TRANSFER_REASON` and "not a judgment of the trader"; at 320px `scrollWidth <= clientWidth`. A trader with 0 transfer shows no `[data-excluded-transfer]` |
| T9 | Five-close record | Unit + e2e (fictional `f32_xfer`, symbols F32A..F32D and WX): four wins (+40, +10, +5, +20%) and WX −60% with a later +1 WX transfer. Before Part A: 80% win rate, corporate 1. After: win rate 100% (pinned with a comment: Part B and F-22 change this), transfer count 1, named on the profile, corporate line absent |
| T10 | Both counts | e2e: a trader with corporate 1 and transfer 2 shows both lines in order; signed out identical |
| T11 | Bump drain | DB: with C5-43(b)'s catch-up, 50 fictional records at version 2 drain to 3; report deltas are counts per reason only (no ids) |

Fuzz (`lib/trades-transfer.fuzz.test.ts`, mulberry32 as `lib/sync-reconcile.final.test.ts`; 2,000 fixed seeds in CI,
`FUZZ_SEED` replays one; every failure message starts `seed N:` with the ledger as JSON). Generator: 1-3 accounts and
symbols, buys/sells, splits (ratio, units, unresolvable), renames, stock dividends, unknown unpriceables, transfers
(in, out, no units; before, between, after sells; same day), unusable trade rows, held rows in 1 case in 10. Properties:
1. Order independence: shuffled activities and actions give a deep-equal result.
2. Partition (cases without held rows): `trades.length + excluded + excludedCorporate + excludedTransfer` equals the
   SELL activities plus SELL trade rows; every sell id is in exactly one bucket (instrumented per-sell reason list).
3. Flag drop: removing every `transfer` flag gives deep-equal `trades`, equal `excluded` and `excludedHeld`, no
   `excludedTransfer`, and `old.excludedCorporate === new.excludedCorporate + new.excludedTransfer` (all cases).
4. With no transfer-flagged action, the result is deep-equal to the flag-free run (no relabel without a transfer).

## 7. COMPLIANCE §1

1. Performance: shows a count and a reason, no figure changes; disclaimer already on the profile; no advice words; losses
   and gains alike (the sentence says so); `Verified` meaning unchanged (F3a). No completeness claim (§2 copy).
2. Personal data: one integer per user (`users.excluded_transfer`), public like the other counts, deleted with the user
   row. No transfer units, date or account stored or shown (P3).
3. Money: no. 4. Messages/tracking: none. 5. User text: none. 6. Sign-up/age/identity: no.
7. Vendor/dependency/asset: none new; reads a stored vendor field (`raw->>'type'`) of the integrated vendor.
8. Accessibility: real link, descriptive name, 44px, underline, `--muted` contrast, keyboard focus, reflow at 320px (T8).
9. Security: no new endpoint or auth change. 10. Claims: no claim; the title is never product copy. 11. Checkout: no.

## 8. Owner items

- Final wording of `TRANSFER_REASON` and `HOW.transfer` (committee wording, as for `excludedHeld`), including whether
  /how states the 14-day window exactly.
- POLICY F3: naming transfers out (drafted elsewhere); after it lands, /how may cite it. Not in this PR.
- OD 2.7: the consent version naming the public exclusion counts, now split by reason.
- F-22 (OD 2.28) on the launch-relevant list before Beta wave 0 (the forward path, T4, stays open until then).
- `/me/record` lines need `lib/session.ts` (protected).

## 9. Changes to the brief

- Accepted: loader-derived flag, lot `cause`, two window lists, the classification order, `EXCLUDED_KEYS` +
  `exclusionSum`, the column, the bump, gap stays `excluded`.
- Changed: label "the same stock" (not "this stock") and noun "sell"; /how drops "and transfers in" from the corporate
  bullet; /how does not print the 14-day window (owner item); compare card gets the line too (F3c on every surface
  that already lists counts); a per-reason deploy delta log (the decision asks for it, the brief omits it).
- Added: the fuzz properties above, and a DB test that the loader flags only the three transfer types.

## Round 2 changes (orchestrating build session, after round 1)

Business lead (CHANGES REQUIRED, 8 demands) and engineer (CHANGES REQUIRED, 8 demands); every demand taken except as noted.
- `HOW.transfer` is two sentences: "Sells excluded: a share transfer in the same stock. A sell is counted here, wins and
  losses alike, when a transfer of that stock into or out of its account falls close to the sell's date or while the
  sold shares were held: a limit of how trades are matched, not a judgment of the trader." It covers the forward case
  (BL 1: "uses transferred shares" was untrue for p4), keeps "close to" (BL 2), and is transfers' one home: the "Transfers
  in, and sells with no recorded entry" bullet now starts "Sells with no recorded entry" (BL 3); the corporate bullet drops
  "and transfers in".
- BL 4, kept: `PROFILE.excludedCorporate` still says "a share move": it still covers unpaired ADJUSTMENT rows, which are
  share moves that are not transfers (Part B names them broker-initiated). Changing it would make that line untrue.
- BL 5: the transfer-out-with-0-held case asserts both outcomes (the windowed sell "transfer", a later sell `excluded`).
- BL 6: edited existing tests are listed in the PR body; they only add the split (old corporate 1 = corporate 0 +
  transfer 1). No assertion is removed or loosened. No window test is edited.
- BL 7/8: e2e runs light and dark (computed colour = `--muted`, contrast ≥ 4.5) and seeds a stored transfer row with
  distinctive units (37.125), date (2024-03-14) and account (F32-ACCT), none of which may appear in the page or any
  response it loads. The OG card is an image built from closed_trades, which the transfer never reaches: not scanned.
- EN 1 (bug, fixed): an oversell drawing a transfer-only lot inside a split's window or on its day now takes the split's
  reason; pinned by a unit test.
- EN 2: the fuzz records each sell's reason (`MatchOptions.reasons`, a test hook), checks every sell has exactly one and
  the totals equal the reasons' counts, and that no sell a non-transfer action reaches (window or day) is "transfer". It
  adds unresolvable splits, renames (1:1 and 1:2), a second account, account-wide spin-offs and unusable trade rows;
  `FUZZ_SEED` replays one case, and messages start `seed N:` with the ledger JSON. Reverting the EN 1 fix fails it (seed 213).
- EN 3: `rebuildTrades` returns `excludedTransfer`.
- EN 4: the per-reason report is `lib/matcher-report.ts` (counts only, `{version, shown, excluded, corporate, transfer,
  held}` net changes). It is wired into the rebuild loop after merging chore C5-43(b), which rewrites that loop.
- EN 5: one name, `EXCLUDED_KEYS`. EN 6: `lib/f32-transfers.db.test.ts` (p5 through the DB; the three types flagged;
  ADJUSTMENT, a spin-off on a transfer row and an unusable trade row not). EN 7: comments updated. EN 8: built.
- Test files: `lib/f32-transfers.test.ts` (T1-T6, fuzz), `lib/f32-transfers.db.test.ts`, `lib/matcher-report.test.ts`,
  `e2e/f32-transfer-line.spec.ts` (T7-T10). T11 (two bumps drain over 50 records) is C5-43(b)'s own test.
