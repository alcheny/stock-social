# F-36 implementation plan, round 1 (UX lead, 2026-11-02)

Decides how, never what: the formula, the counts, the /how copy and the ACs are fixed by
`docs/features/F-36-fees-in-the-return-denominator.md`. No new column, no new dependency, no protected file
(`package.json`, `docs/DESIGN.md`, `docs/POLICY.md`, `scripts/compliance*.ts`, `scripts/invariants.test.ts`,
`playwright.config.ts` and the rest of `.github/CODEOWNERS` stay untouched).

## 1. Matcher change (`lib/trades.ts#replay`, shown-trade branch)

- Formula: `returnPct = (a.units * a.price − cost − entryFees − exitFee) / (cost + entryFees)`. The numerator is
  unchanged; only the denominator gains `entryFees` (the prorated fee per unit of the lots taken, as today). Stocks
  now match options (`lib/options.ts:145`, `:220`).
- **No-basis guard.** In the lot loop, set `noBasis ||= !(lot.price > 0)` next to `tainted ||= …`. A sell that draws
  any lot with a price ≤ 0 (or NaN) that is not already tainted is counted in **`excludedCorporate`**, never shown.
  Why that count: it is the "trade rows without a usable price … excluded and counted" bucket /how already
  describes (F3-1), so no new copy or column is needed; `excluded` means "no recorded entry", which is not true here.
  Today such a sell would show ±Infinity (or a partial basis); after F-36 the fee alone could otherwise become its
  basis, which the decision forbids. Tainted lots are already counted in `excludedCorporate`; the guard does not
  rely on `lib/corporate-actions.ts#unusableTrade` filtering vendor rows.
- **Denominator not positive.** If `!(cost + entryFees > 0)` (only reachable with a negative fee, which the importer
  makes impossible with `Math.abs`, or with the guard above), the sell is counted in `excludedCorporate` too. One
  check, `if (noBasis || !(cost + entryFees > 0)) excludedCorporate++`, placed before the `openedAt` branch, so the
  partition invariant (every unheld sell shown or counted once) holds by construction.
- Sign: with a positive denominator and the same numerator, the sign equals the pre-F-36 sign. Below −100% happens
  iff `proceeds − exitFee < 0`, i.e. only when the exit fee exceeds the sale proceeds (algebra in the test comment).
- `MATCHER_VERSION = 3` (provisional: whichever of F-32 Part A / F-36 lands second takes the next number; the PR
  says so). Comment line appended: `// 3: F-36, a return divides by entry cost plus entry fees (DESIGN §2.5 as amended).`

## 2. Rebuild report (`lib/matcher-rebuild.ts`)

- `rebuildAllForMatcher` keeps its return shape `{ rebuilt, failed, left } | null` (`fixes-cycle4.db.test.ts`
  deep-equals it). Inside each record's transaction, before and after `rebuildRecord`, read
  `select sell_id, sign(return_pct) from closed_trades where user_id = $1` (shown share trades only; option closes
  are out of scope and already include fees).
- New pure export `signChanges(before: Map<string, number>, after: Map<string, number>): { changed: number;
  signChanged: number }` (ids in both maps only; a removed or added close is already counted by F-24's
  `logRewrites`). Summed across records.
- One counts-only log line at the end of the run, no ids, handles or figures:
  `console.log('matcher rebuild', JSON.stringify({ version, rebuilt, failed, left, returnsChanged, signChanged }))`.
  `scripts/db-setup.ts` keeps its own line unchanged. `signChanged > 0` additionally logs
  `console.error('matcher rebuild: a return changed sign', JSON.stringify({ count }))` (expected never).

## 3. /how copy (`lib/copy.ts`, `app/how/page.tsx`)

`HOW.math[1]` is replaced by two items (same `<ul>` under the existing `<h2>The math</h2>`):
- `'Return = (sale proceeds − purchase cost − purchase fees − sale fees) ÷ (purchase cost + purchase fees), shown as a percent, after the fees the broker reported. Nothing is weighted by size.'`
- `'A fictional example: paid 100 plus a fee of 10, sold for 165 with no fee on the sale. (165 − 100 − 10) ÷ (100 + 10) = 55 ÷ 110 = +50%.'`

Plain text, real `−` (U+2212) and `÷` characters with spaces around every operator so lines break at spaces at
320 px; no image, no `<math>`, no `nowrap`. Screen readers read "minus" and "divided by". No currency sign (unitless
fictional figures, POLICY P3).

Dated note: new constant `F36_RECALC_DATE = '2026-11-02'` in `lib/copy.ts`, and a new section at the end of the page
(after the public-filings link) so it reads as history and future entries append to it:
- `HOW.changesTitle = 'Changes to the math'` rendered as `<h2 id="changes">`;
- `<ul><li><time dateTime={F36_RECALC_DATE}>November 2, 2026</time>: {HOW.feesChange}</li></ul>` with
  `HOW.feesChange = 'returns of trades with a purchase fee were recalculated to divide by the purchase cost plus that fee. Before, they divided by the purchase cost alone, which made those returns look larger. This note is kept as history.'`
  The visible date is formatted from the constant (`en-US`, UTC), never typed twice.
Heading order stays h1 → h2 (no skipped level); the disclaimer stays right after the math block.

COMPLIANCE §12 entry, appended under the /how history bullet:
`2026-11-02: /how states the return formula once in plain text, (sale proceeds − purchase cost − purchase fees − sale fees) ÷ (purchase cost + purchase fees), with one fictional example (paid 100 plus a fee of 10, sold for 165: +50%), and a dated "Changes to the math" note: returns of trades with a purchase fee were recalculated that day (matcher version 3) and kept as history. Shares and options now use one formula. No fee amount is shown anywhere.`

## 4. Tests (AC → file → assertion)

1. Probe: `lib/f36-fees.test.ts` — buy 2 @5 fee 10, sell 2 @15 fee 0 → `returnPct === 0.5` and `pct()` prints `+50%`.
   Also the /how example (100 + 10, 165) → exactly 0.5.
2. Below −100%: same file — exit fee > proceeds (buy 1 @10 fee 0, sell 1 @1 fee 5) → `< −1`; and a table of cases
   with exit fee ≤ proceeds (incl. large entry fees) → every one `≥ −1`.
3. Zero-fee byte-identical: (a) `lib/f36-fees.property.test.ts` — random histories with every fee 0: the result
   `deepStrictEqual`s the reference model's legacy output (x + 0 === x, so exact); (b) `lib/f36-fees.db.test.ts`
   (skips without `DATABASE_URL`, like the other `.db.test.ts`) — a zero-fee user rebuilt under version 3: the
   F-24 snapshot hashes are unchanged and the log line shows `returnsChanged: 0`.
4. Fixture check with the list from the run: **decision: an env-gated audit, not a public option.**
   `matchTrades` reads `process.env.MATCHER_FEE_AUDIT === '1'` (ignored when `NODE_ENV === 'production'`); then, for
   each shown trade whose legacy figure (`numerator / cost`, computed in the same branch) differs from the new one, it
   writes to stderr `f36-changed <symbol> <sellId> legacy=<pct> now=<pct> entryFee=yes` and throws if `entryFees === 0`.
   It prints percents and a yes/no, never a fee amount. `scripts/f36-audit.ts` (new, not protected; no npm script,
   since `package.json` is protected) runs `node --test` with the variable set, collects the lines, fails on any
   `entryFee=no`, and prints the sorted list the PR body pastes. Weighed: a `MatchOptions` flag (`basis: 'cost'`) is
   deterministic but puts a second formula on the public API, and inline fixtures in other test files never pass it,
   so it can't cover "every changed expectation"; loading main's `lib/trades.ts` from git breaks on relative imports.
   The env hook covers every fixture in every test file at the cost of one guarded branch.
   Expectations that change (e.g. `lib/trades.test.ts` "FIFO across two lots, fees on both legs") are updated to the
   new figure with a comment `// F-36: entry fee in the denominator`; no assertion is removed or loosened.
5. No-basis lot: `lib/f36-fees.test.ts` — an untainted buy at price 0 with fee 3, then a sell → no trade,
   `excludedCorporate === 1`; a mixed draw (priced lot + price-0 lot) → counted; a tainted lot with a fee → counted
   (unchanged). The partition helper from `fixes-cycle4.property.test.ts` holds in each.
6. No sign change: unit — `signChanges` on maps (0 and 1 cases); db — rebuild a fee-bearing fixture user, capture
   `console.log` with `mock.method`, assert `signChanged: 0`. Property — `lib/f36-fees.property.test.ts` reuses the
   generator of `lib/fixes-cycle4.property.test.ts` (held rows, gaps/oversells, splits, renames, unpriceable actions,
   date-only ties, random fees ≥ 0), 500 seeded runs, asserting: order independence (shuffled input → same result);
   the partition invariant; same shown ids and counts as the reference model; every shown return has the same sign
   as the model's legacy return and `|new| ≤ |legacy|`; equality whenever the trade's entry fees are 0.
   The reference model in `fixes-cycle4.property.test.ts:126` moves to the new denominator (the product changed;
   the check stays as strict) and also records the legacy figure.
7. /how: `lib/copy.test.ts` — `HOW.math` contains the formula and the example strings verbatim, `HOW.feesChange`
   and `F36_RECALC_DATE === '2026-11-02'`; `lib/f36-how.test.ts` renders `app/how/page.tsx` with
   `react-dom/server` and asserts the text, `<time dateTime="2026-11-02">`, `id="changes"`, no `<img>`/`<svg>` in
   the math block, and h2 order. `e2e/f36-how.spec.ts` at 360 × 800 (and 320): formula and example visible as text,
   `scrollWidth ≤ clientWidth` on `<html>`, axe pass on `/how`.
8. No fee amount anywhere: source scan in `lib/f36-fees.test.ts` — no `fee` identifier in `app/**` outside `/how`'s
   copy, none in `lib/og*`/share-card and public JSON route files, and the `closed_trades`/`option_trades` DDL in
   `db/schema.sql` has no `fee` column. Render test: profile, feed card and share-card text builders render a
   fee-bearing fixture with no `fee` key or fee digits. `e2e/f23-payload-scan.spec.ts` gains one assertion: no
   signed-out response body except `/how` matches `/fee/i`.

## 5. Ponytails (marked in code)

- `ponytail:` the audit hook lives in production code behind an env variable — fix: drop it after the next matcher
  version has drained (it only serves this bump's fixture check).
- `ponytail:` the sign-change count compares stored and rebuilt rows by `sell_id`; a close that the rebuild removes or
  adds is counted by F-24's rewrites, not here — fix: one rebuild report table if a later bump needs per-cause counts.
- `ponytail:` the /how date is the decision date; records rebuild when the deploy runs (and the C5-43(b) catch-up),
  so a record can show the old figure until then — fix: none planned (decision: normal rebuild, no alert).

## 6. Files touched

`lib/trades.ts`, `lib/matcher-rebuild.ts`, `lib/copy.ts`, `app/how/page.tsx`, `docs/COMPLIANCE.md` (§12 entry),
`lib/trades.test.ts` and other tests whose fee-bearing expectations change (list from the audit), 
`lib/fixes-cycle4.property.test.ts` (model denominator), new `lib/f36-fees.test.ts`, `lib/f36-fees.property.test.ts`,
`lib/f36-fees.db.test.ts`, `lib/f36-how.test.ts`, `e2e/f36-how.spec.ts`, `scripts/f36-audit.ts`,
`e2e/f23-payload-scan.spec.ts` (one assertion), the feature file's Build log. Nothing under protected paths;
DESIGN §2.5 is referenced, not edited.

## Compliance (§1)
Performance shown: yes → §2: disclaimer placement unchanged, losses ranked like gains, no advice words. Personal data:
no. Money: no (fees used in math, never shown). Communications: no (no trader alert, by decision). User content: no.
Age: no. Vendors/dependencies: none. Accessibility: text formula, heading order, 320 px reflow (§9). Security: no.
Claims: the example is labelled fictional (§11). Records: §12 entry above.

## Open points for reviewers
1. `excludedCorporate` for no-basis and non-positive-denominator sells (vs `excluded`): agree it is the right bucket?
2. Env-gated audit in `matchTrades` vs a `MatchOptions` test flag: is a guarded production branch acceptable for
   one version, given it is the only way the list comes from the run over every inline fixture?
3. The /how date is fixed at 2026-11-02 by the brief; if the deploy slips (C5-43(b), F-32 ordering), keep the
   decision date or move the constant to the deploy day?
4. Should `OPTIONS.howMath` gain "the same formula as shares"? Not in the decisions, so not planned.
5. Sign-change count on share closes only (options already include fees): confirm.

## Round 2 changes (orchestrator's synthesis of the business lead's and the engineer's round-1 reviews)

Both reviewers: CHANGES REQUIRED in round 1. The changes below replace the round-1 text where they disagree.

- R2-1 (engineer 1, business lead 5): **no audit branch in `lib/trades.ts`.** The fixture check is test-only:
  `scripts/f36-audit.ts` runs `node --test` (every `*.test.ts`, the `.db.test.ts` files with `DATABASE_URL` set,
  engineer 2) with `NODE_OPTIONS=--import <hook>`; the hook (`scripts/f36-audit-hook.mjs` + loader) rewrites the
  `returnPct:` line of `lib/trades.ts` in memory only (anchor must match exactly once, else it throws), computes the
  legacy `numerator / cost` beside the new figure, and appends `<test file> <symbol> <sellId> legacy now
  entryFee=yes|no` per changed trade (percents and yes/no only, never a fee amount). The script fails on any
  `entryFee=no` line and prints the sorted list the PR body pastes. No production debris, no ponytail for it.
- R2-2 (engineer 3, business lead 6): the guard folds into the existing first condition:
  `if (tainted || noBasis || latePosted(a) || sameDayAction(a)) excludedCorporate++`, where `noBasis` is set when a
  drawn lot has `!(price > 0)` or the final `!(cost + entryFees > 0)`. The oversell branch is unchanged. A test pins
  the bucket for a gapped sell plus a no-basis sell. If a zero-fee fixture ever hits the guard, the PR lists it apart
  as a guard change.
- R2-3 (engineer 5): no second property test file. The cycle-4 model (`lib/fixes-cycle4.property.test.ts:126`) takes
  the new denominator and records the legacy figure; the same file adds: same sign as legacy, `|new| ≤ |legacy|`,
  equality when the trade's entry fees are 0. Order independence and the partition invariant are already asserted
  there.
- R2-4 (engineer 6): add a case with a huge entry fee and exit fee 0 → result ≥ −1.
- R2-5 (engineer 7): expected changed expectations (from the engineer's scratch audit on main): `lib/trades.test.ts`
  "FIFO across two lots, fees on both legs"; `lib/corporate-actions.test.ts` "1:10 reverse split … (fee 10)"; the C4
  property model's tests. Each keeps its assertion, only the figure moves, with `// F-36`. The audit output is final.
- R2-6 (engineer 8; business lead 1 superseded): no `e2e/f23-payload-scan` `/fee/i` assertion (it matches "feed" and
  unrelated words). The AC asks for a source scan plus a render test; both stay.
- R2-7 (engineer 4): `lib/f36-fees.db.test.ts` also deep-equals the unchanged return shape. The PR says that F-24's
  `logRewrites` adds each fee-bearing record's changed closes to `users.closes_rewritten` (intended).
- R2-8 (engineer 9, business lead 4): the date constant renders with `timeZone: 'UTC'` (pinned in a test). It must be
  the day the version-3 rebuild runs in production: if the deploy slips, the constant moves (owner item in the PR). The
  third round-1 ponytail is dropped.
- R2-9 (business lead 2, 3): copy:
  - math line: `Return = (sale proceeds − purchase cost − purchase fees − sale fees) ÷ (purchase cost + purchase fees),
    using the fees the broker reported. Nothing is weighted by size.`
  - example (unchanged, fictional, no currency sign): `A fictional example: paid 100 plus a fee of 10, sold for 165
    with no fee on the sale. (165 − 100 − 10) ÷ (100 + 10) = 55 ÷ 110 = +50%.`
  - note: `returns of trades with a purchase fee were recalculated to divide by the purchase cost plus that fee.
    Before, they divided by the purchase cost alone, so both gains and losses looked bigger.`
- R2-10 (business lead 7, 8): no options wording on /how; one sentence in the COMPLIANCE §12 entry. The sign-change
  count covers share closes only.
- R2-11 (business lead 10): the 360 px user test and the reviewer check /how at 320 px in light and dark, with the
  Disclaimer right after the math list.
