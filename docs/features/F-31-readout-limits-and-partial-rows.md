# F-31 · The readout states its limits and splits trader and filer views

Status: built
Start conditions: F4-11 (demo filers in the demo exclusion) and F4-12 (invite views on Demo profiles) merge
(`docs/direction/cycle4-2026-11-01.md` §5), or the same builder carries all three. It is its own build slot (the readout
slot).

## Why
The F-15 readout feeds the owner's week-8 launch call (and the proposed LIVE_BILLING trigger, F-3), but it prints no
limits. Its strict G3 row (`scripts/f15-readout.ts:185` at e6731d5) counts every non-demo profile view with an external
referrer, and filers are counted targets (`lib/views.ts:110-111`). One widely shared filer profile can carry the gate.
A browser-shaped script passes the bot filter (`lib/views.ts:26-33`). With no trusted address the rate cap is skipped
(`:59`), and the readout warns only about the owner's own views (`scripts/f15-readout.ts:28`). Council cycle 4 briefs
C4-4 (rank 3) and C4-31 (rank 4), merged in round 0. Approved by the approval council
(`docs/ideas/approval-2026-11-01-cycle4.md`: second-vote mean 3.87, final vote 15/15, all with conditions).

## Decisions
- 2026-11-01: The readout adds partial rows only. The strict G3 row and every gate definition are unchanged (F-15
  `docs/features/F-15-measurement-foundation.md:40-43`). Gate definitions, including whether filer views count toward
  G3, stay the owner's (MRC2-3). Why: approved by the approval council (cycle 4); ruling R-1 (veto condition: DK, LG, CS).
- 2026-11-01: Under each G3 row, two partial rows: "of which: broker-trader profiles" and "of which: public-filing
  profiles". They use the same base-cell suppression, have no difference row, and leave no path to subtract back to a
  suppressed cell. Complementary suppression also holds across weekly and cumulative rows. Why: approved by the approval
  council (cycle 4); brief C4-4; RT, DV, LG (veto condition: LG, P3).
- 2026-11-01: A "limits of these counts" block prints above the first G-row, in plain sentences, on every run. It says:
  - these are first-party counts that can be inflated, not verified figures;
  - signed-out self, owner and team views cannot be told apart;
  - scripted clients can forge views and `via` with no drop trail;
  - tagged landings with no referrer sit outside the strict row, with one partial row "tagged link or external
    referrer";
  - "views, not people" applies to every row.

  No new G-row ships without this block in the same change. Why: approved by the approval council (cycle 4); brief
  C4-31; CS (veto condition: CS, V2).
- 2026-11-01: The block prints this week's facts, not only possibilities:
  - "address cap: live / not live", read from a deploy setting or from a stored weekly aggregate of beacons accepted
    with no trusted address (an additive schema change), never guessed;
  - while the cap is not shown to be live, a "not readable as a gate: address cap not live" flag beside the strict
    rows, which still print;
  - "internal accounts: not removed" when the env list of internal handles is unset.

  Why: approved by the approval council (cycle 4); red team; EN and DK (the flag sits beside the strict figure and
  never replaces it, R-1).
- 2026-11-01: One concentration row: the share of the week's strict G3 that comes from the single largest profile.
  It carries no id and is suppressed under 5. It catches one filer, or one trader's own scripted views, carrying the
  gate. Why: approved by the approval council (cycle 4); red team probe D.
- 2026-11-01: A weekly row "self-views removed (signed in)". An optional env list of internal handles prints G1 and G3
  partial rows. No handle, id or return is printed, logged or committed, and the handle list lives only in env. Why:
  approved by the approval council (cycle 4); brief C4-31 (veto condition: LG, TS, P1).
- 2026-11-01: Output is plain text: no meaning is carried only by colour or box-drawing. Why: approved by the approval
  council (cycle 4); A11Y.
- 2026-11-01: Sequencing and lapse: blocked until F4-11 and F4-12 merge, or the same builder carries them. If they
  have not merged and F-31 has not started by the next approval council (cycle 5), this approval lapses to that council.
  Why: approved by the approval council (cycle 4); lapse rule.
- 2026-11-01: Filer/trader rows sit under the strict G3 row only, from a per-week split of the strict cell; existing base cells and every existing row are unchanged; a split row prints exactly only when everything derivable from it is 0 or ≥ 5, otherwise "(s)", with no bounds and no totals. Why: decided by the committee under the owner's instruction of 2026-11-01; splitting every base cell would have changed the strict row and existing output (AC1, AC8); plan D1, D9.
- 2026-11-01: The address cap's source of truth is a stored per-day presence mark of beacons with and without a trusted address (new table `view_cap_days`); a week reads "live" only with a trusted mark and no untrusted one. Why: decided by the committee under the owner's instruction of 2026-11-01; a deploy setting read on the owner's machine would be a guess about production; plan D2 (answers the second open question; the owner may override).
- 2026-11-01: The flag prints as an `address cap` row under the strict G3 row, per week, and the limits block states the latest week's cap. Why: decided by the committee under the owner's instruction of 2026-11-01; the flag sits beside the strict figure and never replaces it; plan D3.
- 2026-11-01: The concentration row prints a whole percent rounded down, with "(s)" unless the largest profile has ≥ 5 views and every derivable rest is 0 or ≥ 5. Why: decided by the committee under the owner's instruction of 2026-11-01; no small count can be worked out from the share; plan D4.
- 2026-11-01: "self-views removed (signed in)" counts every record surface, referrer and via for trader targets, as its own suppressed row. Why: decided by the committee under the owner's instruction of 2026-11-01; it shows everything the readout removes as self-views; plan D5.
- 2026-11-01: Internal handles are read from env `READOUT_INTERNAL_HANDLES` in the readout's main only; the G3 internal row needs both parts 0 or ≥ 5, the G1 internal row only G1 and the rest (the removed count is the owner's own list), and a line warns that changing the list between runs can reveal counts. Why: decided by the committee under the owner's instruction of 2026-11-01; keeps the G1 row useful for a small team without revealing third-party counts; plan D6, business lead B1, engineer E1.
- 2026-11-01: "tagged link" means a share or invite via; in-app nav and profile codes stay out. Why: decided by the committee under the owner's instruction of 2026-11-01; in-app links are not landings from outside; plan D7.

## Acceptance criteria
- [x] DB test: with one fictional real-filer view and one fictional trader view, both partial rows print. The strict
      G3 row equals today's value for the same data.
- [x] Small-cell rules hold for the partial rows and the concentration row. A test shows no suppressed weekly or
      cumulative cell can be recovered by subtraction.
- [x] The limits block prints above the first G-row on every run. A text test pins its sentences.
- [x] With the cap not shown to be live, the "not readable as a gate" flag prints beside the strict rows, and the
      strict rows still print.
- [x] With the internal-handles env unset, "internal accounts: not removed" prints. With it set, G1 and G3 partial
      rows print and no handle appears in the output or logs.
- [x] The concentration row prints the largest single profile's share, with no id, handle or return, and is
      suppressed under 5.
- [x] No row selects a user id, handle, return or filing name (source scan in the test).
- [x] With the env unset and no new data, output changes only by the new block and rows.

## Out of scope
- Changing what any gate measures (MRC2-3, owner).
- The demo-filer exclusion (fix F4-11) and invite rows (fix F4-12).
- Stripping `?via=` (C4-32, not approved: 3.47).

## Open questions
- Owner (MRC2-3): should filer views count toward G3 at all? This feature only shows them apart.
- Owner: which source of truth says the address cap is live (a deploy setting, or the stored weekly aggregate)?

## Rework notes

## Build log
- 2026-11-01: built on `claude/f31-readout-limits` through the committee cycle (plan signed in round 3; tester, business lead, UX lead and independent review in `docs/features/logs/F-31/committee-2026-11-01.md`). Address-cap marks in the new `view_cap_days` table; internal handles from env `READOUT_INTERNAL_HANDLES`.
