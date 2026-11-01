# Options build: tester re-check (round 2), code review round 2 and user tests (2026-11-01)

## Code review round 2 (after fix round 1 and the merge with #40)
Approve with two should-fix items, both fixed in fix round 2: the exercise-day share rule now follows #40's rename
chains (`withRenames`), and a thesis on a removed OCC-symbol close is kept in `kept_theses` first. Round 1 blocker
and should-fix items 2–5 reproduced as fixed; no leak path; the merge dropped and duplicated nothing.

## User tests at 360 px (fix round 3)
- UX lead: compliance PASS (no option term, return, strike or contract symbol on any gated surface; contrast 5.03:1
  light, 5.84:1 dark; 44 px targets). Usability: pane chart caption and label spacing (blocking), /how anchor under
  the sticky header, row link names, figure wrapping, /how wording, link names. Screenshots in `screenshots/`.
- Business lead: business case delivered (honest counting, the open-position leak fix, a gate that opens without
  code). Blocking: one "Open positions" heading, the options summary at the headline's size, the options block after
  the evidence line, "Share trades" reads as a verb → "Excluding options". Non-blocking: plainer gated sentence, pane
  polish.
All fixed in fix round 3 with static-markup and copy tests. The e2e vendor fake on port 4102 is now shared through
an advisory lock (`e2e/vendor-lock.ts`), so `connect.spec.ts` and `options.spec.ts` never bind it at once.

## Tester re-check (pure probes)
Round 1 findings: 1–5, 7–10, 12 fixed; 6 partly (an assignment of a long is no longer counted as short; a short close
after a taint stays "other" while the contract is tainted: orchestrator decision, plan D4 "tainted until flat"); 11
partly (non-sensitive raw columns stay unmapped, as for the raw `activities` table).
New: N1 (should-fix) the record card image for an options-only trader dropped the options line; N2 the F-10 record
strip on trade and month pages needs the qualifier; N3 an account owed its option backfill reads one history page per
sync in place of its last-week read (known limit, rollout freshness); N4 an empty account list could mark a
connection backfilled; N5 tone followed the raw value, not the printed sign; N6 the user-test copy needs legal's
re-sign; N7 open gate with only short or technical counts gave the pane a label and no line; N8 the fake's IPv6
listener outlived `close`. N1, N2, N4, N5, N7, N8 go to fix round 4; N6 to legal.
