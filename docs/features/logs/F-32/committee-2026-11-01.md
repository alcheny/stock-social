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
