## What changes
F-32 Part A (council cycle 5, C5-1). A sell that a vendor transfer row excludes is now counted under its own reason,
"transfer", never under the generic corporate line. Part A only relabels a subset of today's `excludedCorporate`:
every shown figure and every other count is unchanged (fuzz-checked against the unflagged run).

- `lib/corporate-actions.ts`: `TRANSFER_TYPES` and `withTransfer`. `loadCorporateActions` reads the stored row's vendor
  type (`raw->>'type'`) and flags TRANSFER, EXTERNAL_ASSET_TRANSFER_IN and EXTERNAL_ASSET_TRANSFER_OUT as transfers.
  Rows stored before F-32 read the same way, and nothing new is stored. ADJUSTMENT, spin-offs and unusable trade rows
  are not flagged.
- `lib/trades.ts`: `MatchResult.excludedTransfer` (present only when nonzero) covers the backward window, the same-day
  rule and draws on lots only a transfer tainted (`Lot.cause`). A split, stock dividend or other action that reaches the
  sell (taint, window or day, the oversell path too) wins the reason. `EXCLUDED_KEYS` and `exclusionSum` give F-21 its
  shared sum; a type-level test fails if a new `excluded*` key is left out. `MATCHER_VERSION` 2 → 3.
  `MatchOptions.reasons` is a test hook (per-sell reason); production callers never pass it.
- `db/schema.sql`: `users.excluded_transfer int not null default 0` (additive, a count only). `lib/sync.ts#rebuildTrades`
  writes and returns it.
- Copy (`lib/copy.ts`): one label, `TRANSFER_REASON` ("a share transfer in the same stock"). It is rendered by:
  - `PROFILE.excludedTransfer` on the profile (`app/u/[handle]/page.tsx`): a muted, underlined real link, at least 44 px
    tall, to `/how#transfers`, with a visually hidden "How share transfers are counted" after the visible text;
  - the compare cards (`lib/record-tools.ts`);
  - the /how item (`app/how/page.tsx`, `id="transfers"`), which names transfers in (POLICY F3) and says the count is "a
    limit of how trades are matched, not a judgment of the trader".

  The corporate /how bullet no longer names transfers. The "no recorded entry" bullet no longer opens with "Transfers
  in", because transfers now have one home.
- `lib/matcher-report.ts`: the deploy rebuild's per-reason report, as net counts only
  (`{version, shown, excluded, corporate, transfer, held}`). **Not wired yet; see the blocking item.**

## Merge order (blocking)
- [ ] **Merge after #107** (chore C5-43(b), matcher catch-up). This PR bumps
      MATCHER_VERSION, and the bump ships only once C5-43(b) is on main.
- [ ] **Before merge, wire the report.** Once C5-43(b) is on main, I merge main into this branch and call
      `reasonCounts` before and after each record in its rebuild loop, with `addMoves`, then log `movesLine` once per
      run. This is the engineer's sign-off condition, and the independent review flagged it too.
- [ ] **Never in the same deploy as F-36's MATCHER_VERSION bump.** The orchestrator orders the merges.

## Decisions
Full record: `docs/features/logs/F-32/committee-2026-11-01.md`. Plan: `docs/features/logs/F-32/plan.md`. The feature
file's Decisions and Build log are updated.

- **How a transfer is spotted:** in the loader, from the stored row's type, not a stored flag (P3: nothing new stored).
- **When "transfer" is the reason:** a lot carries the transfer as its cause only while every taint on it came from a
  transfer. A transfer-in lot that shares its day with another action does not carry it (independent review: otherwise
  the reason depended on which vendor id sorted first).
- **What stays "no recorded entry":** a transfer out, or a transfer with no units, on an empty ledger still leaves the
  gap, so later sells there stay `excluded`. Those are the missing-history rule, not a draw on a transfer.
- **Corporate line:** `PROFILE.excludedCorporate` keeps "a share move", because unpaired ADJUSTMENT rows still count
  there.
- **/how wording:** it says "close to the sell's date" and does not print the 14-day window. Printing it would show how
  to time a transfer while the forward path is open (until F-22). Whether to print it is an owner item.
- **OD 2.28:** the owner answered yes (relayed 2026-11-02). F-22 follows as its own PR on top of this one. This PR's copy
  makes no POLICY F3 claim about transfers out.

## Testing
- `lib/f32-transfers.test.ts` (unit, 13 tests):
  - the p5 probe: the transfer count is 1, with no corporate count;
  - RT's three forms, plus the gap after a transfer out;
  - the same-day form and the forward draw, including an oversell;
  - pinned probe p4 (the forward path, naming OD 2.28 / F-22), asserting both the reason and the count;
  - a split and a transfer in one window, in every order and on the same day: the split wins;
  - a lot tainted by both, either order;
  - a split in the window taints as today;
  - C5-1 end to end: a fictional five-close record goes from 80% to 100% win rate, and the transfer count is 1, named;
  - `EXCLUDED_KEYS` guard;
  - the oversell-in-split-window case (engineer's bug, fixed);
  - the same-instant tie in both id orders (independent review, fixed). Both fixed cases fail without their fix.
- The fuzz test, part of `lib/f32-transfers.test.ts`, runs 2,000 seeded cases. They mix transfers, splits (including
  unresolvable ones), unpriceable rows, account-wide spin-offs, renames (1:1 and 1:2), unusable trade rows, held rows
  and two accounts. It checks:
  - order independence, for the counts and for each sell's reason;
  - every sell has exactly one reason, and the totals match the reasons;
  - no sell that a non-transfer action reaches is labelled "transfer";
  - trades, `excluded` and `excludedHeld` match the unflagged run, and old corporate = corporate + transfer.

  `FUZZ_SEED=n` replays one case.
- `lib/f32-transfers.db.test.ts` (3 tests):
  - p5 through stored vendor rows and `rebuildTrades`;
  - which vendor types are flagged, with counts that reset;
  - the loader flags exactly the three types.
- `lib/matcher-report.test.ts`: the report holds counts only.
- `e2e/f32-transfer-line.spec.ts` (7 tests, 360 px, signed out):
  - light and dark: the link has its descriptive name, is at least 44 px, uses `--muted` with contrast of at least 4.5,
    is underlined, and has no icon;
  - at 320 px the line reflows;
  - the link lands on `/how#transfers`, whose text is `HOW.transfer`;
  - P3: a stored transfer row's units (37.125), account (F32-ACCT) and date (2024-03-14) appear in no page or response;
  - the corporate, transfer and held lines appear in that order, and only the transfer line is a link;
  - the line is hidden at 0.
- **Existing tests edited.** Each edit only splits the old count; no assertion is removed or loosened:
  - `lib/broker-corporate.test.ts`: the transfer in changes from `[positions, corporate]` = `[0, 1]` to
    `[positions, corporate, transfer]` = `[0, 0, 1]`;
  - `e2e/connect.spec.ts` (corporate-actions import): the same split of the count, and the visible line it expects is now
    the transfer link.

  No window test was edited.
- **QA:**
  - Tester: PASS. It ran 60,000 extra random fictional ledgers and its own DB run, and found no defect.
  - UX lead and business lead user test at 360 and 320 px, light and dark: PASS.
  - Independent review: one finding, fixed. Its other point is the merge item above.
- **Gates:**
  - `npx tsc --noEmit`: ok.
  - `npm test`: 2,363 passed, 0 failed, 26 skipped.
  - `BASE_REF=main node scripts/compliance.ts auto`: ok.
  - `node scripts/autopilot.ts guard origin/main`: ok.
  - `npm run build`: ok.
  - The touched e2e specs pass.
  - The full `npx playwright test`: 337 passed and 1 failed (`e2e/fixes-labels.spec.ts:242`). That failure is the
    day-seeded swipe test #105 fixed, and it failed on origin/main too. Main is merged at 1b0dbcc.

## Compliance
1. **Performance shown, ranked or described?** No figure changes. A count that was shown under the generic corporate
   line is now shown under its true cause, "transfer" (POLICY F3c: excluded and counted, now with its cause). The line is
   neutral and muted, with no warning colour or icon, and the /how sentence says "wins and losses alike" and "not a
   judgment of the trader". There is no completeness claim: "can't remove a loss", "nothing hidden" and "can't be
   steered" appear nowhere (F3a). The disclaimer is unchanged.
2. **Personal data?**
   - `users.excluded_transfer` is a count and goes with the profile.
   - No transfer units, date or account is stored anew or shown (P3). The e2e scan checks the page and its responses.
   - There is no new table, cookie, public closed_trades column or log line with personal data. The report helper logs
     counts per reason only and is not yet called.
3. **Money?** No.
4. **Email, push, tracking?** No.
5. **User content?** No; theses still re-attach by `sell_id`.
6. **Sign-up, age, identity?** No.
7. **Vendor, dependency, font, image?** None new. `lib/broker.ts` is untouched.
8. **Accessibility?**
   - The line is a real link: its accessible name is the visible text plus a descriptive suffix (WCAG 2.5.3), the target
     is 44 px, and it is underlined, so colour does not mark it alone.
   - Contrast is AA in both schemes, the focus ring is visible, and it reflows at 320 px. All of this is tested.
9. **Security posture?** Unchanged.
10. **Claims?** None. The title is never product copy.
11. **Checkout?** No.

## Known limits (each marked `ponytail:` in code)
- **The steering path is still open, now named:** a transfer still excludes sells up to 14 days before it, and one dated
  before a sell taints every open lot of the pair (probe p4). Fix: F-22's basis rule (OD 2.28) and Part B (the vendor's
  MRC2-10 answer). See `lib/trades.ts`.
- **No line on /me/record:** `lib/session.ts` is protected. Fix: add the column to the session row (`lib/copy.ts`).
- **Wording is the committee's:** the owner's final wording is an owner item (`lib/copy.ts`).

## Owner items
- The final wording of `TRANSFER_REASON` and the /how sentence, and whether /how states the 14-day window.
- POLICY F3 naming transfers out (OD 2.28; drafted by the protected-files session, not in this PR).
- OD 2.7: the next consent version names the public exclusion counts, which this PR splits by reason.
- F-22 / OD 2.28 on the launch-relevant list before Beta wave 0 (the forward path survives Part A).

Committee record: `docs/features/logs/F-32/committee-2026-11-01.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8mHwe7Ja1w5RqFfDk4
