# F-32 Part A committee record, 2026-11-01 (continued 2026-11-02)

Feature: `docs/features/F-32-transfers-named-never-remove-a-closed-trade.md`, Part A only. Members: UX lead (plan author),
business lead, engineer, tester, independent reviewer, each a fresh-context subagent; the orchestrating build session
wrote the brief (`brief.md`), built the change (tests first) and recorded the rounds. Plan: `plan.md` (UX lead's draft
plus "Round 2 changes").

## Prerequisites and context
- F-24 merged as #84 (bdf3ea9); fixes cycle 4 (#89) gave the gap rule. Main merged at ca34767 before the build.
- Chore C5-43(b) (matcher catch-up) is its own PR on `claude/chores-cycle5-matcher-catchup`; this PR's MATCHER_VERSION
  bump (2 → 3) merges only after it, and never in the same deploy as F-36's bump (the orchestrator orders merges).
- Paused 2026-11-01 for the weekly usage limit (WIP commit of the brief); resumed 2026-11-02. On resume the orchestrator
  relayed the owner's answer to OD 2.28: yes. F-22 follows as a second PR on top of this one; Part A's scope is unchanged
  and its copy still makes no POLICY F3 claim about transfers out (the protected-files session drafts that edit).

## Round 1
- UX lead draft: accepted the brief, with changes: label "the same stock" (the profile line sums stocks), noun "sell",
  /how says "close to the transfer's date" instead of the 14-day window (stating it publishes how to time a transfer while
  the forward path is open), a per-reason deploy report, the compare-card line, and the gap rule pinned.
- Business lead: CHANGES REQUIRED (8). Engineer: CHANGES REQUIRED (8), including one real bug (an oversell drawing a
  transfer-only lot inside a split's window was labelled "transfer"). Resolutions: `plan.md` → "Round 2 changes".

## Decisions taken here (committee's recommended options)
- Identify transfers in the loader from the stored row's vendor type, not a stored flag: legacy rows read the same and
  nothing new is stored (P3).
- A lot carries `cause: 'transfer'` only while every taint on it came from a transfer; any other taint clears it. A
  non-transfer action reaching the sell (taint, window or day) wins the reason, on the oversell path too.
- The gap a transfer out (or a unit-less transfer) leaves on an empty ledger stays "no recorded entry" (`excluded`): it is
  the missing-history rule, not a draw on a transfer row's units.
- `PROFILE.excludedCorporate` keeps "a share move" (unpaired ADJUSTMENT rows still count there).
- The 14-day window is not printed on /how; whether to state it is an owner item.
- `MatchOptions.reasons` is a test hook (per-sell reason), so the fuzz checks reasons per sell, not only totals.

## Round 2 and review
- Business lead round 2: CHANGES REQUIRED (2: assert the underline in both schemes; T10, the corporate/transfer/held
  order with only the transfer line linked). Both added and green.
- Engineer round 2: SIGN, on condition that the per-reason report is wired into the rebuild loop once chore C5-43(b) is
  on main and before this PR merges (a blocking item in the PR body). Non-blocking: `MatchOptions.reasons` notes that
  production callers never pass it (done).
- `npm test` found one failure: `lib/copy.test.ts` requires /how's excluded list to name "Transfers in" (POLICY F3). The
  copy was fixed, not the test: the transfer sentence is now an item of that list ("Transfers in and out of an account.
  A sell is counted as "excluded: a share transfer in the same stock" ..."), still transfers' one home, with
  id="transfers".
- Independent review: invariants hold (relabel only, one bucket per sell, loader flags exactly the three types, count
  only). Finding 1 (verified, fixed): a transfer-in lot and another unpriceable action at the same instant gave the
  later sells a reason that depended on which vendor id sorted first; the lot now names the transfer as its cause only
  when no other action shares its day (as a buy that day). Pinned in both id orders; the test fails without the fix.
  Finding 2: the report wiring (same as the engineer's condition).
- Business lead round 3: SIGN, no demands. Engineer: SIGN (condition above).

## QA and user test (2026-11-02)
- Tester: PASS, no verified defects. Every Part A criterion has a passing test; 60,000 own random fictional ledgers
  (transfers with splits, stock dividends, spin-offs, renames, unusable rows, held rows, two accounts, same-day ties)
  checked against the unflagged run: trades, `excluded` and `excludedHeld` identical, old corporate = corporate +
  transfer, each sell's reason unchanged or moved corporate → transfer. A DB run of its own user: corporate 1, transfer
  2; the transfer's units, account and dates appear nowhere in the HTML or the flight payload.
- UX lead and business lead user test at 360 and 320 px, light and dark, signed out: PASS both. The link is 46 px tall,
  contrast about 5.0:1 (light) and 6:1 (dark), focus ring visible, reflows at 320 px, lands on /how#transfers below
  the sticky header. Optional, not taken here: a `:target` highlight on /how; the corporate line counts "trades" while
  the transfer and held lines count "sells" (the corporate line's wording is outside Part A; noted for F-21's sum
  wording). Note for F-21: its pane line should sit next to the headline.
- Full Playwright: 337 passed, 1 failed (`e2e/fixes-labels.spec.ts:242`, the day-seeded feed swipe; it failed on
  origin/main too and #105 fixed it; main merged at 1b0dbcc).
