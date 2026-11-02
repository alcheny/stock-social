# F-28 · A short's cover never prices a later long trade

Status: draft
Blocked: lapsed at approval council cycle 5 (draft); see the dated lapse decision
Start conditions: the owner answers Q1(b) yes (`docs/direction/cycle4-2026-11-01.md` §7). No in-flight branch edits
the matcher's replay (`claude/fix-truthful-labels` touches only `confidence()` in `lib/trades.ts`), so the build can
start the day the owner answers. Shares one build slot (the matcher slot) and one builder with F-30.

## Why
After an oversell the matcher counts the sell and empties the pair, and the next buy opens an ordinary lot
(`lib/trades.ts:247-251`, `:222-225` at e6731d5). If that buy was a short's cover, a later long round trip is priced
from it. In a fictional probe (intraday stamps: SELL 100 @15 with nothing held, cover BUY 100 @14, then BUY 100 @20
and SELL 100 @18), the short is counted correctly, but the last sell is published as +28.6% Verified instead of
-10%. Council cycle 4 brief C4-2 (rank 1). Approved by the approval council (`docs/ideas/approval-2026-11-01-cycle4.md`:
second-vote mean 4.67, final vote 15/15, all with conditions).

## Decisions
- 2026-11-01: On an oversell with `k` excess units, the next `k` units bought in that pair are tainted. That covers the
  cover if it was a short, or one over-counted round trip if the history was missing. Later lots stay fresh. A buy
  larger than `k` splits into `k` tainted units and a fresh rest. The rule counts more and never publishes more (POLICY
  F3c). Why: approved by the approval council (cycle 4); brief C4-2 (veto condition: CS, LG, DK).
- 2026-11-01: The tainted cover lot carries its own flag, so a sell drawing it counts under the oversell cause
  (`excluded`), never under `excludedCorporate`. Today every tainted draw goes to the corporate count
  (`lib/trades.ts:248-252`). `excluded` stays one count per sell. Why: approved by the approval council (cycle 4); EN, RE,
  RT (veto condition: DK, one count per sell).
- 2026-11-01: The pending-cover count travels with the lots when a rename moves them (`lib/trades.ts:199-204`), so a
  rename cannot drop it and bring the error back. Why: approved by the approval council (cycle 4); red team probe B
  (veto condition: LG).
- 2026-11-01: A counted sell's line names a true cause: "a short sale or earlier history". It never reads "no
  matching entry" when the entry was recorded, and never "corporate action". This wording is cycle 3's oversell-copy
  fix (`docs/ideas/approval-2026-11-01-cycle3.md:251-252`; `lib/copy.ts:70`). It goes through the fixes list whatever
  Q1 brings, and it lands no later than this rule. Why: approved by the approval council (cycle 4); DK, LG (veto
  condition: LG, CS, true cause wording).
- 2026-11-01: Probe A (shares bought before the imported history are sold, then a fully recorded later round trip)
  is an over-count this rule accepts under POLICY F3c: that trip is counted under the true cause. The taint is released
  early only on evidence that tells a cover from a re-buy, never on a time guess. The engineer showed that a flat broker
  position snapshot cannot tell the two apart: after a cover and after a pre-history sale it reads flat either way. Any
  release rule goes to the owner first (Open questions). Why: approved by the approval council (cycle 4); chair's ruling
  between RT's snapshot release and EN's finding; CS (an over-count is allowed, a wrong figure is not).
- 2026-11-01: A trade that the rebuild stops publishing keeps its thesis for the trader. The thesis is held or
  orphaned by `sell_id`, never deleted, and re-attaches if the trade returns. Once F-24 lands, the change appears in
  F-24's close-change log. Why: approved by the approval council (cycle 4); RT, RE (veto condition: DK, thesis never
  deleted).
- 2026-11-01: After merge, `scripts/rebuild-records.ts` runs at deploy and reports counts only, including how many
  trades moved from published to counted. Plain buy-sell histories rebuild byte-identical. Why: approved by the approval
  council (cycle 4); RE; CLAUDE.md "fix P&L in `lib/trades.ts` and rebuild".
- 2026-11-01: Sequencing and lapse: blocked until the owner answers Q1(b). It builds with F-30 in the matcher slot,
  then F-22 if the owner re-opens it. If the owner has not answered by the next approval council (cycle 5), this
  approval lapses to that council. Why: approved by the approval council (cycle 4); lapse rule.

- 2026-11-01: Lapsed at approval council cycle 5: the owner had not answered OD 2.27 (cycle-4 Q1(b)). It was voted
  again and not re-approved: round-3 mean 0.47 (`docs/ideas/approval-2026-11-01-cycle5.md`). The council found it
  overtaken by #89: after an oversell, main already counts every later sell of the pair and never prices it, and a
  rename moves the mark (`lib/trades.ts:48-53`). This feature's "taint the next k units, later lots stay fresh" rule
  would publish sells main now counts (the fixes-cycle-4 committee's probes, +65%/+60%/+25%,
  `docs/features/logs/fixes-cycle4/committee-2026-11-01.md:119-122`). Its true-cause wording is already on main
  (`lib/copy.ts:73`). The file and every decision above are kept word for word. Owner note: OD 2.27 is overtaken by #89
  and needs no answer. The remaining cost to traders is that the oversell mark never clears (`lib/trades.ts:54-57`).
  Clearing it needs vendor position evidence (protected `lib/broker.ts`, stored units), which is the owner's call. Any
  future release rule must never publish a close that main counts. Why: approval council cycle 5; lapse rule; RT, LC
  (F3c veto against re-approval as written), CO.
- 2026-11-02: The owner accepted OD 2.27 as recommended. Council cycle 5 found it overtaken by #89: main already
  counts every later sell after an oversell, which is at least as strict as this file's rule, so the owner's yes is
  met by main and this feature stays `draft`; nothing is built for it. Clearing the oversell mark with vendor position
  evidence (protected `lib/broker.ts`, stored units) is not decided. Why: the owner's decision of 2026-11-02 (OD 2.27,
  accepted en bloc); council cycle 5 lapse record.

## Acceptance criteria
- [ ] Probe (intraday): SELL 100 @15 with nothing held, BUY 100 @14, BUY 100 @20, SELL 100 @18. The last sell is
      counted and nothing wrong is published. The probe's stats, chart series and confidence interval are pinned by a test.
- [ ] A pre-history oversell followed by two later round trips prices the second round trip.
- [ ] A plain buy-sell history rebuilds byte-identical (existing shuffle property, `lib/fixes-cycle3.test.ts:39`, holds).
- [ ] A buy larger than `k` splits into `k` tainted units and a fresh rest (unit test).
- [ ] A sell drawing the cover lot raises `excluded`, not `excludedCorporate`, and `excluded` rises by one per sell.
- [ ] Probe B: an oversell, then a rename, then the cover and a later round trip. The pending count follows the rename
      and the later trip is not priced from the cover.
- [ ] Probe A is pinned as counted, and its line reads "a short sale or earlier history".
- [ ] A thesis on a trade that the rebuild stops publishing survives (held or orphaned, never deleted) and re-attaches
      when the trade is published again.
- [ ] No existing test is removed and the test count does not drop.

## Out of scope
- A vendor zero-position clear (the ponytails at `lib/trades.ts:142-144`, `lib/corporate-actions.ts:8-10`).
- Same-instant ordering (F-30) and transfers (F-22, draft).

## Open questions
- Owner Q1(b): may the matcher taint the next `k` units bought after a `k`-unit oversell, amending "later buys start
  fresh lots" (`lib/trades.ts:46`)? The council recommends yes (cycle-4 record, Flags 1).
- Owner: is there a release rule for probe A that tells a cover from a re-buy? The council found none in the vendor
  data today, so the over-count stands until there is.

## Rework notes

## Build log
