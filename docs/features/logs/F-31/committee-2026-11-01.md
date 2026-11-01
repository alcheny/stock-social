# F-31 committee record (2026-11-01)

Feature: docs/features/F-31-readout-limits-and-partial-rows.md. Plan: docs/features/logs/F-31/plan.md (UX lead).
Run under the owner's instruction of 2026-11-01: open questions are decided by the committee's recommended option
after debate; each member is a fresh-context subagent and none grades work it wrote.

## Planning debate

| Round | UX lead | Business lead | Engineer |
|---|---|---|---|
| 1 | Plan drafted (D1–D10) | DEMANDS B1 (G1 internal row prints when OK(g) and OK(g − k): k is owner-known), B2 (no file allowlist in the scan test); approved D1–D5, D7–D10, confirmed D9 | DEMANDS E1 (cross-run line for the internal list), E2 (lexer-based source scan with must-fail and must-pass fixtures), E3 (cap marks memoized per day and kind, 5-minute retry, after the `over` return), E4 (shared-DB isolation by a pre-1985 day), E5–E7 (strict identity with the env set, loadTop checks, exhaustive split test) |
| 2 | Answered B1, B2, E1–E9 (plan §13) | DEMAND: INTERNAL_RUNS_LINE only when the list holds a valid handle | SIGN (B1 opens no subtraction path against G1, G2 or G3) |
| 3 | Answered (plan §13, Round 3); adopted the engineer's optional INTERNAL_LINE wording | SIGN | (signed) |

## Decisions (committee's recommended option)

- D1: Partial rows "of which: broker-trader profiles" / "of which: public-filing profiles" sit under the strict G3 row
  only (D9), built from a per-week second-level split of the strict cell; existing base cells are untouched, so every
  existing row prints exactly as before. A family row prints only when every quantity the owner can derive from it is
  0 or ≥ 5, else "(s)"; never "≥ n"; no totals. Option B (splitting every base cell) was rejected: it changes existing output.
- D2: Address-cap source of truth: stored presence marks (`view_cap_days(day, trusted)`), written by the beacon route;
  a week is "live" only with a trusted mark and no untrusted mark. A deploy setting read on the owner's machine would be
  a guess about production, which the decision forbids.
- D3: The flag prints as an `address cap` row directly under the strict G3 row, per week; the strict row still prints.
  The limits block also states the latest printed week's cap.
- D4: Concentration row: the largest single profile's share of the week's strict G3, whole percent rounded down, no id;
  "(s)" unless the profile has ≥ 5 views and every derivable rest is 0 or ≥ 5.
- D5: "self-views removed (signed in)": every record surface, referrer and via, trader targets, its own base row.
- D6: Internal handles live only in env `READOUT_INTERNAL_HANDLES`, read only in `main`; G3 internal row "(s)" when the
  removed or remaining views would be 1–4; G1 internal row "(s)" only when G1 or the rest would be 1–4 (the removed
  count is the owner's own listed accounts). INTERNAL_RUNS_LINE warns about comparing runs with different lists.
- D7: "tagged link or external referrer": profile surface, trader targets, external referrer or a share or invite via.
- D8: Source scan over every `select` in the readout's `sql` templates; no path allowlist.
- D9: "Under each G3 row" = under the strict G3 row (business lead confirmed).
- D10: Whether filer views count toward G3 stays the owner's (MRC2-3); the limits block says so.
