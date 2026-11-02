F-36 · Fees in the return's denominator

Feature: `docs/features/F-36-fees-in-the-return-denominator.md` (now `Status: built`). Owner answered cycle-5 Q1 yes on
2026-11-02. Committee record: `docs/features/logs/F-36/committee-2026-11-01.md`; plan: `docs/features/logs/F-36/plan.md`;
fixture audit: `docs/features/logs/F-36/audit.txt`.

**Merge order:** this PR merges only after chore C5-43(b) (matcher catch-up in the sync tick) is on main, and never in the
same deploy as F-32 Part A. Both bump `MATCHER_VERSION`; this PR takes **3**. Whichever of the two lands second takes the
next number (a one-line change in `lib/trades.ts` plus its comment).

## What changes
- **The return formula** (`lib/trades.ts#replay`): `return_pct = (exit − entry − fees) / (entry cost + entry fees)`.
  Before, it was `/ entry cost`. The numerator is unchanged, so no trade changes sign. A long share trade is worse than
  −100% only when its exit fee exceeds its sale proceeds. Stocks and options now use one formula; options already
  included entry fees.
- **No-basis guard:** a sell drawing a lot with no price (≤ 0), or with no positive denominator, is counted in
  `excludedCorporate` ("rows the importer can't price"). It is never priced from fees alone. Every unheld sell is still
  shown or counted exactly once, and the result does not depend on input order.
- **`MATCHER_VERSION` 2 → 3:** the deploy rebuilds every record once (`lib/matcher-rebuild.ts`).
  - The rebuild logs one counts-only line: `matcher rebuild {version, rebuilt, failed, left, returnsChanged, signChanged}`.
  - It logs an error line if `signChanged > 0` (expected never). The return shape `{rebuilt, failed, left}` is unchanged.
  - F-24's `logRewrites` adds each fee-bearing record's changed closes to `users.closes_rewritten`. This is intended, and
    the trader sees nothing new: no alert, badge or wording (decision: changed figures arrive only through the rebuild).
- **/how** (`lib/copy.ts`, `app/how/page.tsx`):
  - The formula appears once, as plain text that reflows at 320 px.
  - One fictional worked example: paid 100 plus a fee of 10, sold for 165, +50%.
  - A new last section, "Changes to the math", dated from `F36_RECALC_DATE` (rendered in UTC). It says that returns of
    trades with a purchase fee were recalculated, and that before, gains and losses both looked bigger.
- **COMPLIANCE §12:** a dated entry in the history of "How records are calculated".
- **DESIGN §2.5:** referenced, not edited (protected). The protected-files session is preparing the amendment.
- **Fixture audit (test-only):** `scripts/f36-audit.ts` and its hook rewrite `lib/trades.ts`'s `returnPct:` line in
  memory only.
  - It runs every test file, the `.db.test.ts` files included, under both the old and the new figure.
  - It fails if the hook didn't load, if the old-figure run collects no failure, or if any changed figure lacks an entry
    fee.
  - The production matcher carries no audit code.

## Decisions
Taken by the committee (UX lead, business lead, engineer; signed in round 2):
- The audit is test-only. It replaces the round-1 environment-variable hook in production code.
- No-basis and non-positive-denominator sells go to `excludedCorporate`, the bucket /how already describes.
- The sign-change count covers share closes only. Option closes already divide by premium plus entry fees.
- No payload `/fee/i` scan: the pattern matches "feed" and other unrelated words. AC8 is met by a source scan plus a
  render test.
- No options wording on /how.
- The example and the note stay as signed: unitless, labelled fictional.

## Testing
- `npx tsc --noEmit`: clean.
- `npm test` with the database: TESTS_LINE (baseline on main before this PR: 2371 tests, 0 failures).
- `BASE_REF=main node scripts/compliance.ts auto`: ok.
- `node scripts/autopilot.ts guard origin/main`: ok.
- `npm run build`: ok.
- `npx playwright test e2e/f36-how.spec.ts` (360 and 320 px): passed. Full `npx playwright test`: E2E_LINE.
- New tests:
  - `lib/f36-fees.test.ts`: AC1 probe; AC2 below −100% with its boundary table; AC3; AC5 no-basis, mixed and gapped draws;
    AC8 source scan.
  - `lib/f36-fees.db.test.ts`: AC6 rebuild with `signChanged: 0`, a counts-only log line and the unchanged return shape.
  - `lib/f36-how.test.ts`: AC7 render and AC8 render.
  - `lib/copy.test.ts` additions; `e2e/f36-how.spec.ts`; `scripts/f36-audit.test.ts` (the hook's anchor still matches).
- `lib/fixes-cycle4.property.test.ts`: the reference model divides by cost plus fees and records the legacy figure. It
  adds three checks per shown trade: same sign as before, `|new| ≤ |legacy|`, and equality when the entry fee is 0.
- **Changed expectations: the output of `node scripts/f36-audit.ts`, pasted from the run** (`audit.txt`):

```
# F-36 fixture audit (node scripts/f36-audit.ts)

## Expectations that change (tests that fail with the legacy figure, purchase cost alone)
- lib/corporate-actions.test.ts: 1:10 reverse split mid-position: buy 100 at 10 (fee 10), split, sell 10 at 110 (fee 0): +10% less the entry fee, fee per unit scaled
- lib/f36-fees.db.test.ts: F-36 AC6: the deploy rebuild recalculates fee-bearing returns, no return changes sign, and the report is counts only
- lib/f36-fees.test.ts: F-36 AC1: the probe (fictional: buy 2 @5, fee 10, sell @15) prints +50%
- lib/f36-fees.test.ts: F-36 AC2: a long share trade is worse than -100% only when its exit fee exceeds its sale proceeds
- lib/f36-fees.test.ts: F-36 AC5: a lot with no basis (price 0) is never priced from its fees: the sell stays counted
- lib/f36-fees.test.ts: F-36: entry fees are prorated by the units taken from each lot, as before; the numerator is unchanged
- lib/f36-fees.test.ts: F-36: the /how example (paid 100 plus a fee of 10, sold for 165, no fee on the sale) is exactly +50%
- lib/f36-how.test.ts: F-36 AC8: a fee-bearing trade renders its percent and no fee (render test)
- lib/fixes-cycle4.property.test.ts: C4 reference model with splits (2:1, 1:2) and 1:1 renames: shown figures hold in every reading; the gap splits and moves
- lib/fixes-cycle4.property.test.ts: C4 reference model: a shown figure is the same in every reading of ties and shortfalls; every sell shown or counted once; order-free
- lib/fixes-cycle4.property.test.ts: C4 reference model: all-distinct intraday stamps and no oversell are plain FIFO (every sell shown, nothing over-counted)
- lib/fixes-cycle4.property.test.ts: F-36: the model divides by purchase cost plus purchase fees; shown fee-bearing trades keep their sign and never grow
- lib/trades.test.ts: FIFO across two lots, fees on both legs

## Changed figures per test file (every one with an entry fee above 0)
- lib/corporate-actions.test.ts: 1946 trades
- lib/downsample.test.ts: 4703 trades
- lib/f36-fees.db.test.ts: 3 trades
- lib/f36-fees.test.ts: 9 trades
- lib/f36-how.test.ts: 1 trades
- lib/fixes-cycle4.property.test.ts: 8054 trades
- lib/sync.test.ts: 2 trades
- lib/trades.test.ts: 1 trades

Total changed figures: 14719; with no entry fee: 0.
```

  Existing assertions keep their shape. Only the figure moved, marked `// F-36`. The audit exits 0: 14,719 changed
  figures across the generated histories, none with an entry fee of 0.
- Tester QA: pass. It ran 3,000 random histories, checking order independence, the partition invariant and finite
  returns. Main shows 153 infinite or NaN returns on these histories; this branch shows none. A 50k-activity history
  also completes.
- Leads' user test at 360 and 320 px, light and dark: pass.
- Independent review: no blocking findings; findings 1–2 fixed.

## Compliance
1. Performance shown, ranked or described: yes (§2).
   - /how describes the return.
   - The Disclaimer stays right after the math list.
   - No advice words, no completeness claims. Losses are treated like gains (same formula, sign unchanged).
   - The example is labelled fictional (§11).
2. Personal data: no new field, column or payload. The rebuild log carries counts only.
3. Money: fees are used in the math, never shown. No payments.
4. Communications or tracking: none. By decision, the trader gets no alert.
5. User content: none.
6. Age or identity: none.
7. Vendors, dependencies, assets: none added.
8. Accessibility (§9):
   - The formula is text, not an image, with no horizontal scroll at 320 px.
   - Headings go h1 → h2, and the date is a `<time>` element.
   - No axe library is in the repo, so the e2e checks headings and reflow instead.
9. Security posture: unchanged.
10. Claims: none beyond the documented formula.
11. Checkout: none.
- §12 records: a dated /how history entry was added.

## Known limits
Each is marked `ponytail:` in code:
- Near-zero prices: a lot priced just above zero is still priced, so its fee can be nearly its whole basis (no price
  floor is decided).
- Negative fees: a negative fee (rebate) would lower the denominator. The importer reads fees with `Math.abs` today.
- Rebuild counts: the deploy's sign-change counts cover only the records it rebuilds. A record the hourly sync rebuilt
  first is not in them.
- Rebuild count scope: the sign count compares share closes by `sell_id`. Closes added or removed are counted by F-24's
  rewrites.

## Owner items
- **The /how date:** `F36_RECALC_DATE = '2026-11-02'` must be the day the version-3 rebuild runs in production. If the
  deploy slips, the orchestrator moves the constant (one line in `lib/copy.ts`) in the PR that orders the merge.
- **DESIGN §2.5 amendment:** lands through the protected-files session.
- **Merge order:** after C5-43(b); not in the same deploy as F-32 Part A; the second of the two takes the next version.
- **Fixes lane (from the user test, not F-36):**
  - On the trade page, the h2 "This trade" comes before the h1.
  - The profile's "What's this?" toggle is 21 px tall.

Committee record: `docs/features/logs/F-36/committee-2026-11-01.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8oG7JvZz7EkVdoBhzd
