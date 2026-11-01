# F-20 committee, 2026-11-01

Members (fresh-context subagents): UX lead (plan: `plan.md`), business lead and engineer (reviews), tester (QA), an
independent code reviewer. Open questions are decided by the committee's recommended option under the owner's
instruction of 2026-11-01, except where a decision belongs to the owner (image colours O-2/DS-6, base and accent V-1,
floors in a protected file, flag 7): those go to the owner with a recommendation.

## Start conditions checked (the step the feature file asks for)

| Condition | Evidence | Result |
|---|---|---|
| PR #55 merged with `lib/a11y-contrast.test.ts` | 92d03f4 on main; the file asserts badge text ≥ 4.5:1, the `:target` row, `--control` ≥ 3:1 and the control-border list | met |
| Fix #13 (text and control contrast) covered by #55 | A11Y-FIXES block: `.badge.verified { color: var(--verified) }`, `:target` bar in `--focus` without fill, control borders on `--control` (3.75/3.91 light, 4.29/3.93 dark) | met |
| Fix #12 (`.hl` cue) | #71 (06edbdf): `.pane .rows .line.hl { outline-color: var(--focus) }`, pinned by `lib/fixes-cycle2-a11y.test.ts` | met (in #71, not #55) |
| Fix #26 (gain/loss under deuteranopia) | #71: `--up`/`--down` at DS-4 values; CVD min 27.8 light / 20.1 dark pinned | met |

## Rounds

Round 1: the UX lead's plan; the business lead signed with five blocking demands, the engineer signed with thirteen
conditions. All accepted; the rulings are `plan.md` §10 (R1-R13). Both reviewers rejected the plan's narrowing of the
Flat floor (OQ-2) and its `.nojs-done` padding change (OQ-10).

## Open questions decided

| # | Question | Decision | Reason |
|---|---|---|---|
| OQ-1 | Share-image gain vs loss is ΔE00 6.3 under deutan (< 9) and image colours may not change | Round 1: values kept, a `todo` test at floor 9. Round 2 (orchestrator's message, from the design council, PR #74): the two F-20 rules conflict; the committee took the recommended option: only image gain/loss move to the page's dark DS-4 ink (#3cc4b4 / #ff8a5b), Demo hue (O-2) untouched; the todo became a real test; flagged to the owner as an "Owner decision" | Neither lowering the floor nor exempting images is allowed; the change matches the share card to the page it opens |
| OQ-2 | Flat (= `--muted`) vs gain is ΔE00 < 9 in light | Flat-vs-up/down tested at 9 in both schemes; passing pairs are real tests, failing pairs `todo`; owner question | The cycle-3 decision names Flat at ΔE00 ≥ 9; narrowing it would be a reinterpretation the committee cannot make |
| OQ-3 | `.switch-pair .switch.current` is a selected cue drawn as an outline | Tried a box-shadow ring; the pixel proof against main failed (100-109 pixels differ per switch pair at the corners), so the fallback holds: today's outline kept as a named exception, owner question | Value-neutral first; selected must not look focused, and `--text` is not the focus colour |
| OQ-4 | `.pane .rows .line.hl` current-row cue | Kept (already `--focus`, 2 px at 2 px); the base rule takes `var(--focus)` too; allow-listed as a state | #12 is pinned; computed value unchanged |
| OQ-5 | `.switch:focus-visible` 3 px | Width kept, colour `--focus` | Value-neutral apart from the stated colour |
| OQ-6 | New tokens | `--flat` and `--demo` as aliases of `--muted`; `--warn` only with F-11's merged values | Value-neutral |
| OQ-7 | Floors in a protected file | Owner question; until then the floor constants carry a comment and a test fails if any is below the cycle-2 values | Guardrail changes are the owner's |
| OQ-8 | Accent focus cues that are not outlines (chart point stroke, skip link) | Unchanged, marked `ponytail:` | Changing them is a visible change beyond the stated one |
| OQ-9 | `themeColor` | Kept `#0b0b0f`, read from the image palette table | A per-scheme value is DS-6 |
| OQ-10 | `.nojs-done` is 72 px, the #71 comment said ≤ 70 | Comment corrected to the measured numbers, e2e asserts the room still covers every bar; padding change filed for the fixes list | A size change is outside "the fixes plus the one stated focus change" |

## Merge precondition

F-20 merges after F-11 (`claude/fix-truthful-labels`): F-11 adds `--warn` and opengraph `#0b0b0f` literals that the
literal scanner would reject; after merging F-11 they move into TOKENS and the image palette.

## Build round 1 (engineer)

All gates green; AC5 (Flat vs gain, light: protan 2.8, deutan 7.0, tritan 19.5) and AC6 (image up vs down: deutan 6.3)
are `todo` tests at floor 9, reported not met. One ruling added: the snapshot treats the element that holds keyboard
focus at capture (the pane's handle link after →) as showing DS-27's stated change when its only difference is
outline-color accent → focus; every other difference fails. Reason: that is the stated focus change, scoped to one
element; the baseline is unchanged.

## Round 2 (QA, code review, user tests; orchestrator's OQ-1 message)

- Tester (`qa-2026-11-01.md`): pass, 0 High. Fixed: M1 (`ponytail:` on the chart point's accent stroke and the skip
  link's accent border), M2 (an inventory test of every inline floor in the older contrast tests; the three QA
  mutations now fail), L1 (TOKENS may hold only `:root` rules), L3 (tritan 19.5, not 31.4), L4 (`--accent` as text, plain
  and on its 15% tint, at the text floor). L2 (a named colour through a constant, hex in markup strings) stays a
  documented scanner limit.
- Code review: nothing blocking. Fixed: a third-party font name in a scanner fixture made generic. Kept as known limits:
  the snapshot groups by signature (a swap inside one group passes), the scanner misses named colours in ternaries and
  under non-colour keys, and `todo` tests do not alert when they start passing.
- User tests (business lead, UX lead; 360 px, light and dark, first-time trader and signed-out viewer): both PASS, no
  blocking demand. Recorded: the switch keeps its 3 px ring; `.line.hl` and the focused-selected switch go into OQ-3;
  the loose checkbox ring goes to the fixes list.
- OQ-1 decided as in the table above.
