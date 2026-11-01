# F-20 · Design tokens and the contrast test

Status: built
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
  council, cycle 3** (`docs/ideas/approval-2026-11-01-cycle3.md`: second-vote mean 3.67, final vote 15/15). Every decision above stands word for word. PR #55
  (which carries `lib/a11y-contrast.test.ts` and the contrast and control-boundary fixes) merged as 92d03f4 during this
  council; F-20 starts once fix #26 merges and the build session confirms #55 covered fixes #12 and #13. F-18 is not
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

- 2026-11-01: Start conditions confirmed by the build session: #55 (92d03f4) carries `lib/a11y-contrast.test.ts` and
  fix #13's contrast and control borders; #71 (06edbdf) carries fix #12 (the `.hl` cue on `--focus`) and fix #26.
  Why: decided by the committee under the owner's instruction of 2026-11-01; committee log `logs/F-20/committee-2026-11-01.md`.
- 2026-11-01: Share-image colours stay byte-for-byte except gain and loss, which take the page's dark DS-4 ink
  (`#3cc4b4` / `#ff8a5b`, as #71 shipped for pages; were `#22c55e` / `#f43f5e`, ΔE00 6.3 under deutan), so a share card
  matches the page it opens and passes the same floors (protan 20.1, deutan 30.1, tritan 62.4; 9.12 / 8.46 on the card
  background). This resolves the conflict between two F-20 rules ("images are not exempt" from the ΔE00 9 floor, and "no
  image colour value changes"); the floor is not lowered and images are not exempted. The card's Demo hue (O-2) and every
  other image colour stay the owner's and unchanged. A test holds the image table to the page tokens' floors. Flagged to
  the owner, who may revert the image hues. Why: decided by the committee under the owner's instruction of 2026-11-01; the orchestrator raised the conflict (found by the design council, PR #74)
  and the committee took the recommended option shared with the design council.
- 2026-11-01: Flat is tested against gain and loss at ΔE00 9 in both schemes; passing pairs are real tests and the
  failing light pairs are `todo` until the owner rules. Why: decided by the committee under the owner's instruction of 2026-11-01; the cycle-3 decision names Flat; narrowing it would be a
  reinterpretation.
- 2026-11-01: `.switch-pair .switch.current` (a selected cue) keeps today's outline (2 px `--text`, offset 1 px) as a named
  exception to "every outline is focus"; a box-shadow redraw differed from today by about 100 pixels at the corners, so
  it would be a visible change. The owner decides (Open questions). Why: decided by the committee under the owner's
  instruction of 2026-11-01; the committee's fallback when the pixel proof failed (value-neutral first).
- 2026-11-01: `.pane .rows .line.hl` keeps its `--focus` outline as a named state exception; `.chart a:focus` keeps
  `outline: none` and the chart point's accent stroke and the skip link's accent border stay (marked `ponytail:`).
  Why: decided by the committee under the owner's instruction of 2026-11-01; #12 is pinned and changing non-outline cues is a visible change beyond the stated one.
- 2026-11-01: New tokens `--flat` and `--demo` alias `--muted`; `--warn` enters the token layer with F-11's values once
  F-11 merges; F-20 merges after F-11. Why: decided by the committee under the owner's instruction of 2026-11-01; value-neutral; F-11's literals would fail the literal test.
- 2026-11-01: The switch's focus ring keeps its 3 px width (unchanged from main; colour `--focus`, offset 2 px), so a
  focused, selected switch shows both cues by width and hue. The sign-in checkbox's ring at a 2 px offset wraps the 44 px
  hit area, about 12 px from the drawn box; drawing it closer (for example on `::before`) goes to the fixes list. {W}DS-27
  fixes the offset, not the width; the checkbox follows the decision as written (user test, UX lead).
- 2026-11-01: The no-JS bar's padding is not changed by F-20; the #71 comment is corrected (72 px, 6 px clear) and an
  e2e asserts the room still covers every bar; the padding change goes to the fixes list. Why: decided by the committee under the owner's instruction of 2026-11-01; a size change is outside
  the fixes plus the one stated focus change.

## Acceptance criteria
- [x] A node test pins every token's resolved value per scheme to the post-fix values; computed styles of sampled
      routes in both schemes are equal before and after the token layer.
- [x] Base, accent and on-accent values are unchanged (pinned test) (veto condition: DK, CS).
- [x] `lib/badge-contrast.test.ts` still exists and passes; the test count does not drop (veto condition: DK).
- [x] The contrast test checks every text and UI token pair in light and dark: ≥ 4.5:1 text, ≥ 3:1 large text, UI
      parts and focus ring (veto condition: LG).
- [x] The gain-versus-loss colour-blind floor is ΔE00 ≥ 9 under protan, deutan and tritan, and passes on main after
      fix #26. No lower floor appears in the test.
- [x] Share-image colours come from one exported table that both tests read. No `opengraph-image.tsx` or image helper
      keeps inline hex, and the table's values equal today's image colours.
- [x] A test fails on any colour literal outside the token file and the image colour table.
- [x] Every outline uses `var(--focus)` with a computed 2 px `outline-offset` on sampled controls; the ring is ≥ 3:1
      against bg and surface.
- [x] No externally hosted font or asset is loaded (test) (veto condition: LG).
- [x] Any limit the build leaves is marked in code with a `ponytail:` comment naming the limit and its next step, and
      the PR's hand-off note lists it.
- [ ] The contrast test enumerates the disclaimer, gain/loss/Flat (protan, deutan, tritan), the Demo and Verified
      badges, the focus ring and the share-image colour table, each at its floor.
- [x] A test fails if any floor constant is below the cycle-2 values (4.5:1 text, 3:1 large text, UI and focus,
      ΔE00 ≥ 9).
- [x] A computed-style snapshot of profile, pane and feed shows no colour change beyond fixes #12, #13 and #26.
- Not met (owner, OQ-2): light Flat vs gain is ΔE00 2.8 (protan), 7.0 (deutan), 19.5 (tritan), below 9. The pair runs at
  the floor as a `todo` test; every other enumerated pair, including Flat vs loss in both schemes and Flat vs gain in
  dark, passes. That one box stays open until the owner rules.

## Out of scope
- Base and accent changes (V-1), type, spacing and radius collapse (V-2): variant tests, not approved.
- Card Demo hue (O-2) and any image colour change: owner.
- The colour fixes themselves (#12, #13, #26): fixes list.
- One image palette and image trust band (K11): not approved.

## Open questions
- Owner (F-20 build, OQ-3): the selected switch (`.switch-pair .switch.current`) is the one non-focus outline left
  (2 px `--text`). Recommended: keep it as an outline (it is not blue, so it does not read as focus) and confirm the
  exception; the alternative is a box-shadow ring, a small visible change at the corners. Two related cues for the same
  ruling (user test): the pane's current row (`.line.hl`) is a selection cue drawn in the `--focus` blue, and on a
  focused, selected switch in light the 3 px blue ring covers most of the 2 px selected outline (the ✓ and
  `aria-pressed` still carry the state).
- Owner (F-20 build, OQ-1, decided by the committee, owner may revert): the share image's gain and loss now use the
  page's dark ink (#3cc4b4 / #ff8a5b; Decisions above). Reverting restores #22c55e / #f43f5e and their deutan 6.3, which
  fails the floor.
- Owner (F-20 build, OQ-2): light Flat (`--muted`) vs gain is ΔE00 2.8 under protanopia (floor 9; the spec names Flat).
  Context: Flat always prints the word "Flat" and no sign. Recommended: a Flat tone at ≥ 9 from both inks, via the fixes
  list; until then the failing pairs are `todo` tests.
- Owner (approval council cycle 3, flag 7): should the contrast floors live in a protected file (for example
  `scripts/invariants.test.ts`), so the change that breaks them cannot lower them? The council may not change a
  guardrail itself.

## Build log
- 2026-11-01: Built on `claude/f20-design-tokens` (committee record `logs/F-20/committee-2026-11-01.md`, plan
  `logs/F-20/plan.md`, QA `logs/F-20/qa-2026-11-01.md`). One criterion is partly open (light Flat vs gain, OQ-2, a `todo`
  test); the share-image gain/loss hues changed by committee decision (OQ-1), flagged to the owner. Merges after F-11.

## Rework notes
