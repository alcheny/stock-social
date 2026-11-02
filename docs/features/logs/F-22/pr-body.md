## What changes
F-22 (owner OD 2.28, 2026-11-02): a vendor transfer row is a share move, not a repricing. Built on F-32 Part A (#108,
merged). MATCHER_VERSION 3 → 4.

- `lib/trades.ts#replay`:
  - **Transfer in** (units > 0): one no-basis lot (`movedIn`) for the moved-in units, kept **last** in the FIFO queue
    (recorded buys, also later ones, go before it; a rename merge keeps it last). Older recorded lots stay priced. A sell
    within the recorded holding draws exactly what it would without the transfer. A sell that draws recorded and moved-in
    units is shown, priced on its recorded units (exit fee prorated), and counted in `sellsPartlyTransferred`; one that
    draws only moved-in units is counted "transfer".
  - **Transfer out** (units < 0): always counted (`transfersOut`). Units leave oldest first; the lots left stay priced
    only when the whole holding moved or every recorded lot is alike (price, fee, `verified`, taint). Otherwise the lots
    left are tainted (their sells counted "transfer"). Beyond what is held keeps the gap. Alike lots with different
    opening dates are marked `datesUnknown`; a later rename merging them with recorded lots taints the merged holding.
  - A unit-less transfer, unknown kinds and splits with an unknown ratio keep today's taint. At one instant a transfer out
    applies after the other actions. A moved-in lot never makes a split taint the recorded lots.
  - `COUNTED_KEYS` / `countedSum` → `{ sells, transfersOut }` (two units, never one number, for F-21); `NOT_SUMMED_KEYS`
    names `sellsPartlyTransferred` (those sells are shown). Test hooks `reasons`, `lastDrawn` (production never passes them).
- `lib/corporate-actions.ts#withTransfer`: direction from the vendor type (`out` for EXTERNAL_ASSET_TRANSFER_OUT); a sign
  that contradicts the type drops the units (unit-less, tainted, never guessed).
- `lib/sync.ts`: writes `users.excluded_transferred_out` and `users.sells_partly_transferred` (both additive counts in
  `db/schema.sql`); counts a transfer out of a pair with no stored activity, never in an account marked as another
  profile's.
- `lib/matcher-report.ts`: the per-reason rebuild report adds `out` and `partly`.
- **F-21 (#118, merged into this branch):** `lib/exclusions.ts` classifies `excluded_transferred_out` as left out of the
  sells-only sum (transfer rows, not sells) and maps `transfersOut` to it; `sellsPartlyTransferred` is result data (shown
  sells). Both are named in the profile's `#excluded` section as context lines (n = 0, linked to their /how items,
  `app/u/[handle]/excluded-section.tsx`); the heading's sum is unchanged. Unit test in `lib/f22-transfers.test.ts`.
- Copy (`lib/copy.ts`) and pages: profile lines "1 transfer out of an account: not a closed trade, so no return is shown."
  (→ `/how#transfers-out`) and "1 sell used some shares that arrived by transfer: its return covers the recorded shares
  only." (→ `/how#transfers`), muted underlined real links, 44 px, also on compare cards; /how: the transfers item leads
  with transfers in and links to a new transfers-out item that calls FIFO "this record's own matching method, not the
  broker's"; `HOW.verified` adds "Shares moved into or out of an account by transfer are counted, not priced".

## Merge hold (blocking: owner)
- [ ] **The vendor's written MRC2-10 answer** (preferred) **or the owner's written acceptance**, in both directions: if
      the vendor ever sends a split as a transfer in, F-22 publishes a false loss; a reverse split as a transfer out, a
      false gain (pinned: `lib/f22-transfers.test.ts`, "pinned (MRC2-10 risk)"). Today's taint prevents both.
- [ ] **Deploy stop:** before the v4 deploy, the owner replays stored transfer rows and flags any whose |units| is a clean
      ratio of the holding at that instant (1/2, 2, 1/3, 3, 1/10, 10…); any hit stops the deploy (plan §8 item 5).
- [ ] Never in the same deploy as F-36's MATCHER_VERSION bump, nor #108's (v3). The orchestrator orders the deploys.

## Decisions
Committee record: `docs/features/logs/F-22/committee-2026-11-02.md`; plan: `docs/features/logs/F-22/plan.md`; brief:
`docs/features/logs/F-22/brief.md`; the feature file's Decisions and Build log are updated.
- F-22 owns what a transfer does to lots and the transfers-out count; F-32 Part B keeps the backward window and the
  same-day rule (still waiting on MRC2-10).
- Q5 (both reviewers, option a): moved-in units drawn last; a mixed sell priced on its recorded units and named.
- "Alike" excludes the opening date (business lead): a one-share move can't turn a loss into a count; the holding period
  follows this record's FIFO. Unknown dates taint a later rename merge (tester).
- The literal acceptance criterion "inserting a TRANSFER never improves a shown average or win rate" cannot hold (the
  backward window stays; a transfer in can make an oversold close exact on its recorded units). It is replaced by the
  properties below. Owner item.

## Testing
- `lib/f22-transfers.test.ts` (21 tests): the three probes; Q5 at a loss and a gain (exit fee prorated); moved-in last
  (buy, transfer in, buy, sell 150 = the no-transfer figure); the basis rule (mixed lots counted; alike lots with other
  dates shown; one unverified lot counted); beyond-held; two own accounts; unit-less and unknown kinds and unresolvable
  splits still taint; the window and same-day rule unchanged; identical rebuilds in any order; the split-window fix (seed
  111); one in and one out; same-instant ties in both id orders; the rename merge after an alike transfer out (tester);
  the pinned MRC2-10 risk rows; `COUNTED_KEYS` guard. Two seeded properties (3,000 cases each, `FUZZ_SEED` replays):
  against the same ledger without the transfer in, a sell shown in both is identical, a newly shown one is one the ledger
  alone had no recorded entry for, a removed one is in the window or day; a transfer out shows no sell the ledger alone
  doesn't, and a sell drawing only older lots keeps its return. Mutation checks: each named fix fails its test without it.
- `lib/f32-transfers.test.ts`: probe p4 now asserts the shown −60% close (F-22 closed the path; reason and count asserted);
  the fuzz's per-sell comparison is now against the ledger without its transfers in. Updated, nothing deleted.
- `lib/f22-transfers.db.test.ts` (3): the probes and Q5 through stored vendor rows, both counters, identical rebuilds; the
  loader's direction rule; a shared-marked account's transfer out not counted.
- `e2e/f22-transfer-lines.spec.ts` (7, 360 px, signed out): both lines in light and dark (descriptive names, 44 px,
  `--muted`, underline, AA contrast, no icon); order after the transfer line and 320 px reflow; /how#transfers-out; the
  partly line's target states its rule in ≤ 30 words and links to #transfers-out; P3 scan (units, date, account); hidden
  at 0. `e2e/f32-transfer-line.spec.ts`: the transfers item's text now ends with the transfers-out link (asserted).
- Edited existing tests: `lib/matcher-report.test.ts` and `lib/f32-transfers.db.test.ts` gain the `out`/`partly` keys
  (zeros asserted); no assertion removed or loosened.
- **QA:** tester (70,000 own ledgers, a reference model, a DB run): one defect found and fixed; its scripts re-run clean
  (0 of 20,000 mismatches). UX lead and business lead user test at 360/320 px: business lead PASS, UX lead copy changes
  taken. Independent review: two findings, both fixed.
- **Gates** (after merging main with F-21 #118): `npx tsc --noEmit` ok; `npm test` 2,539 passed, 0 failed, 26 skipped;
  compliance ok; guard ok; build ok; the F-21, F-22, F-32, F-24 and corporate-actions e2e specs pass (21/21). Before
  that merge: full `npx playwright test` 383 passed, 0 failed, 6 skipped.

## Compliance
1. **Performance shown, ranked or described?** Yes: sells a transfer used to remove are now shown when their recorded
   basis is exact, losses and gains alike; every transfer out and every partly-transferred sell is named. Disclaimer
   unchanged; no completeness claim ("can't remove a loss", "nothing hidden" appear nowhere; the backward window still
   applies, F3a).
2. **Personal data?** Two counts on `users`, deleted with the profile. No transfer units, date or account is stored anew
   or shown (P3; e2e scan). The report's one log line holds counts only.
3. Money: no. 4. Email/push/tracking: no. 5. User content: no. 6. Sign-up/age/identity: no.
7. **Vendor/dependency:** none new; `lib/broker.ts` untouched. The MRC2-10 question is the vendor's (merge hold).
8. **Accessibility:** real links, visible text first in the name, 44 px, underlined, AA in both schemes, 320 px reflow.
9. Security: unchanged. 10. **Claims:** none; POLICY F3's list naming transfers out is the protected-files session's edit.
11. Checkout: no.

## Known limits (each `ponytail:` in code)
- With buys at several prices, moving even one share out leaves the rest counted ("transfer"), so a trader can still turn
  such a close into a count; expected after v4: the transfer count rises and nothing else moves. Fix: the vendor's
  lot-level transfer detail.
- A transfer still excludes sells up to 14 days before it and on its day (F-32 Part B, MRC2-10).
- A split sent as a transfer row publishes a wrong figure (merge hold above).
- A unit-less TRANSFER has no direction, so a whole position can leave unseen (as before F-22).
- No lines on /me/record (`lib/session.ts` is protected).

## Owner items
1. The merge hold (MRC2-10, both directions) and the deploy stop above.
2. Confirm "alike" without the opening date (the committee's choice).
3. F-21 (merged): transfers out are named beside its sum, not summed (its sells-only unit rule); `countedSum` gives both
   units if the owner wants them summed.
4. The replaced acceptance criterion ("never improves") and the final wording of the lines and /how items; POLICY F3's
   edit (protected-files session); OD 2.7's consent version naming the counts.

Committee record: `docs/features/logs/F-22/committee-2026-11-02.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8mHwe7Ja1w5RqFfDk4
