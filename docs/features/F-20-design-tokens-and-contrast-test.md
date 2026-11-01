# F-20 · Design tokens and the contrast test

Status: blocked
Blocked: waits for PR #55 (F-13, carrying `lib/a11y-contrast.test.ts`) and cycle-2 fixes #12, #13, #26
Start conditions: fixes #12, #13 and #26 merge, and the F-13 contrast-test branch (`lib/a11y-contrast.test.ts` on
`claude/f13-a11y-fixes`) merges. F-20 lands before F-18 in their shared `app/globals.css` slot.

## Why
Light Verified is 3.77:1, light gain and loss are only ΔE00 2.8 apart under deutan, control borders are 1.2-1.3:1 and
`:target` rows fail AA. The fixes list repairs today's values, but no test stops the next regression. This feature
builds cycle 1's C14 and the design system's DS-1 to DS-4, DS-26 and DS-27: a value-neutral token layer and a contrast
test that every later change must pass. Approved by the approval council
(`docs/ideas/approval-2026-11-01-cycle2.md`, K9: second-vote mean 3.67, final vote 15/15).

## Decisions
- 2026-11-01: A value-neutral token layer in `app/globals.css`: every token at its value after the fixes, meaning
  colours on today's base (up and down ink, `--control`, `--warn`, `--demo`, `--verified`, `--flat`). No visible value
  changes beyond the fixes list and one stated focus change: the outlines that today use another colour or offset
  (`app/globals.css:276` checkbox offset −4 px, `:397` and `:407` sheet outlines in `var(--text)`) move to
  `var(--focus)` with a 2 px offset. Why: approved by the approval council (cycle 2); DS-1, DS-4 (veto condition: CS).
- 2026-11-01: Base, accent and on-accent values stay unchanged. They change only through the V-1 three-version test.
  Why: approved by the approval council (cycle 2); settled conflict 9 (veto condition: DK, CS).
- 2026-11-01: The contrast test extends `lib/a11y-contrast.test.ts` from the F-13 branch and keeps
  `lib/badge-contrast.test.ts`. There is no second set of contrast values. Why: approved by the approval council
  (cycle 2); A11Y, EN (veto condition: DK).
- 2026-11-01: The test covers every text and UI token pair in both schemes: at least 4.5:1 for text, 3:1 for large
  text, UI parts and the focus ring. Why: approved by the approval council (cycle 2); WCAG 1.4.3, 1.4.11; POLICY A1
  (veto condition: LG).
- 2026-11-01: The test adds a gain-versus-loss colour-blind floor at the design system's threshold (ΔE00 ≥ 9 under
  protan, deutan and tritan). The floor is never lowered to today's 2.8 to make it pass. Why: approved by the approval
  council (cycle 2). The red team showed a floor set before fix #26 would pin the defect (LG).
- 2026-11-01: Share-image colours move into one exported constant table, with today's values, that the contrast and
  colour-blind tests read. Images are not exempt. No image colour value changes (card Demo hue O-2 is the owner's).
  Why: approved by the approval council (cycle 2). The red team showed next/og can't read CSS variables, so an
  exemption would leave the most-shared surface unchecked (DK).
- 2026-11-01: A test fails on new colour literals outside the token file and the image colour table. Why: approved by
  the approval council (cycle 2); UX, DV.
- 2026-11-01: Every outline uses `var(--focus)` with a 2 px offset (DS-27). Dead CSS is removed (DS-26). Why: approved
  by the approval council (cycle 2).
- 2026-11-01: No colour is chosen to match a named brand. No externally hosted font or asset. Why: approved by the
  approval council (cycle 2); POLICY T3 (veto condition: LG).
- 2026-11-01: Sequencing: starts only after fixes #12, #13 and #26 and the F-13 contrast-test branch merge. It is
  rebased on the merged fix branch and merges after F-10..F-13's `app/globals.css` edits, in one PR. It lands before
  F-18 in their shared slot. If the contrast-test branch and fixes #12, #13 and #26 have not merged by the next
  approval council, this approval lapses to that council. Why: approved by the approval council (cycle 2); RT, BL,
  A11Y, DV (veto condition: DK, CS).

- 2026-11-01: Lapsed at approval council cycle 3 (its prerequisites had not merged) and **re-approved by the approval
  council, cycle 3** (`docs/ideas/approval-2026-11-01-cycle3.md`: second-vote mean 3.67, final vote 15/15). Every decision above stands word for word. It
  starts after PR #55 (which carries `lib/a11y-contrast.test.ts`) and fixes #12, #13 and #26 merge. F-18 is not
  re-approved this cycle, so F-20 holds its own build slot. If those have not merged by the next approval council
  (cycle 4), this approval lapses to that council. Why: approved by the approval council (cycle 3); lapse rule; DK.
- 2026-11-01: The tested pairs are listed by name: the disclaimer text, gain, loss and Flat tones (ΔE00 ≥ 9 under
  protan, deutan and tritan), the Demo and Verified badges, the focus ring (3:1) and the share-image colour table. No
  image colour changes (O-2 stays the owner's) and a computed-style snapshot shows no visible change beyond the fixes.
  Why: approved by the approval council (cycle 3); red team, DV, A11Y, PD.
- 2026-11-01: The floors should live where the change that breaks them cannot also lower them. Placing them in a
  protected file (for example `scripts/invariants.test.ts`) is a guardrail change the council may not make, so it goes
  to the owner as a request; until then the floor constants carry a comment and the test fails if any floor is lower
  than the cycle-2 values. Why: approved by the approval council (cycle 3); red team, DK (`team/approval-council.md`
  "What approval can and cannot do").

## Acceptance criteria
- [ ] A node test pins every token's resolved value per scheme to the post-fix values; computed styles of sampled
      routes in both schemes are equal before and after the token layer.
- [ ] Base, accent and on-accent values are unchanged (pinned test) (veto condition: DK, CS).
- [ ] `lib/badge-contrast.test.ts` still exists and passes; the test count does not drop (veto condition: DK).
- [ ] The contrast test checks every text and UI token pair in light and dark: ≥ 4.5:1 text, ≥ 3:1 large text, UI
      parts and focus ring (veto condition: LG).
- [ ] The gain-versus-loss colour-blind floor is ΔE00 ≥ 9 under protan, deutan and tritan, and passes on main after
      fix #26. No lower floor appears in the test.
- [ ] Share-image colours come from one exported table that both tests read. No `opengraph-image.tsx` or image helper
      keeps inline hex, and the table's values equal today's image colours.
- [ ] A test fails on any colour literal outside the token file and the image colour table.
- [ ] Every outline uses `var(--focus)` with a computed 2 px `outline-offset` on sampled controls; the ring is ≥ 3:1
      against bg and surface.
- [ ] No externally hosted font or asset is loaded (test) (veto condition: LG).
- [ ] Any limit the build leaves is marked in code with a `ponytail:` comment naming the limit and its next step, and
      the PR's hand-off note lists it.
- [ ] The contrast test enumerates the disclaimer, gain/loss/Flat (protan, deutan, tritan), the Demo and Verified
      badges, the focus ring and the share-image colour table, each at its floor.
- [ ] A test fails if any floor constant is below the cycle-2 values (4.5:1 text, 3:1 large text, UI and focus,
      ΔE00 ≥ 9).
- [ ] A computed-style snapshot of profile, pane and feed shows no colour change beyond fixes #12, #13 and #26.

## Out of scope
- Base and accent changes (V-1), type, spacing and radius collapse (V-2): variant tests, not approved.
- Card Demo hue (O-2) and any image colour change: owner.
- The colour fixes themselves (#12, #13, #26): fixes list.
- One image palette and image trust band (K11): not approved.

## Open questions
- None from the council.

## Rework notes
