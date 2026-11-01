# F-19 · Number format, tone and ranges: one sign, one Flat, ranges that hold their average

Status: ready
Start conditions: the first slice (`lib/` only) may start now. The call-site sweep and the placement of the
What's-this line wait for F-10, F-11 and F-12 and for F-18 to merge.

## Why
Signs use a hyphen, decimals vary, and 0.0% is painted red and announced as "Gain". A printed range can exclude its
own headline. Jargon such as "independent bet" and "avg return" confuses lay readers, and many read a range of the
average as the spread of single trades. This feature builds cycle 1's C5, the design system's DS-10 to DS-13 and DS-25,
and the market council's "What's this?" line (MRC2-5). Approved by the approval council
(`docs/ideas/approval-2026-11-01-cycle2.md`, K8: second-vote mean 3.73, final vote 15/15).

## Decisions
- 2026-11-01: First slice, `lib/` only: `lib/format.ts` becomes the single home of `pct()`, `winPct()` and `tone()`
  (with Flat). The old homes (`lib/trades.ts`, `lib/open-split.ts`, and `toneClass` in `app/open-rows.tsx`)
  re-export them. There is one implementation. Why: approved by the approval council (cycle 2). The red team showed
  new helpers beside the old ones would add the drift this feature removes.
- 2026-11-01: A property test asserts lo ≤ avg ≤ hi on every surface's printing function: profile, pane, feed card,
  trade, month, stock and images, not `cardEvidence` alone. Why: approved by the approval council (cycle 2). The red
  team showed a test on `cardEvidence` alone holds by construction once fix #7 lands.
- 2026-11-01: The What's-this line reads "the range is for the average, not one trade", and it matches the
  computation. Its text and test land with the first slice. It is placed on the stats row with the sweep, after F-18
  merges, because F-18 rewrites the same stats-row lines. Why: approved by the approval council (cycle 2); MRC2-5;
  most members sequenced the line after F-18 (TS and MR wanted it in the first slice).
- 2026-11-01: Share images and the append-only display log keep the ASCII hyphen sign. U+2212 is used there only after
  a render test shows the glyph is drawn in each share image font. If the sign changes, the display log gets a dated
  note on the switch day and no history row is rewritten. Why: approved by the approval council (cycle 2). The red
  team showed a missing glyph would make a loss read as a gain (POLICY F4, F3c; D14) (veto condition: LG, DK).
- 2026-11-01: The call-site sweep (signs, decimals, Flat on every surface, the chart line tone rule, the glossary
  sweep) runs after F-10..F-12 and F-18 merge, in the F-20, F-18, F-19 lane. Why: approved by the approval council
  (cycle 2); same files and stats-row lines.
- 2026-11-01: Gain and loss are never shown by colour alone: every signed number keeps its sign character, and Flat
  carries text. Why: approved by the approval council (cycle 2); POLICY A1 (UX, A11Y) (veto condition: LG).
- 2026-11-01: `confidence()`, `pace30`, ranking order, `RANK_MIN_BETS`, the D23 headline order and win rate, and D24
  stay untouched. "bet" stays the one word (D24). Profit factor stays. O-15, O-16 and O-17 stay with the owner. Why:
  approved by the approval council (cycle 2); DESIGN TR-9 (veto condition: DK, LG).
- 2026-11-01: F-6's combined-figure wording and F-4's trust-line tables stay verbatim. "Evidence: tier" stays. No font
  file is bundled. Why: approved by the approval council (cycle 2); F-4, F-6 owner decisions (veto condition: DK).
- 2026-11-01: The glossary and the What's-this line use no advice, signal, skill, edge or pick words. Losses keep equal
  prominence. Why: approved by the approval council (cycle 2); POLICY F1, F4 (veto condition: LG).
- 2026-11-01: Pinned test literals are updated, never deleted, and the test count does not drop. Why: approved by the
  approval council (cycle 2); CLAUDE.md (veto condition: DK).
- 2026-11-01: Sequencing: the first slice takes its own slot now. If F-10..F-12 and F-18 have not merged by the next
  approval council, the sweep part of this approval lapses to that council. Why: approved by the approval council
  (cycle 2); EN, PF, RT.

## Acceptance criteria
- [ ] `pct`, `winPct` and `tone` are defined only in `lib/format.ts`. The old names in `lib/trades.ts`,
      `lib/open-split.ts` and `app/open-rows.tsx` are the same function objects, and a grep test fails on a second
      implementation.
- [ ] `tone(0)` and a printed "0.0%" give Flat, never the loss colour, and never announce "Gain" (unit test).
- [ ] The lo ≤ avg ≤ hi property test runs over the printing function of every surface (profile, pane, feed card,
      trade, month, stock page and each share image).
- [ ] The What's-this text "the range is for the average, not one trade" exists as one constant, and a test ties it to
      the arithmetic range computation. After F-18 merges, it shows on the stats-row What's-this (e2e).
- [ ] Share images and the display log print the ASCII hyphen, unless a render test of `pct(-0.125)` in each share
      image shows U+2212 is drawn (pixel diff against an empty-box render). Any switch adds a dated display-log note
      and rewrites no row (test) (veto condition: LG, DK).
- [ ] Every signed number keeps its sign character in text, and Flat has a word (component test) (veto condition: LG).
- [ ] `rankTraders` output, `confidence()`, `RANK_MIN_BETS` and the D23 order are unchanged (pinned test) (veto
      condition: DK, LG).
- [ ] A banned-word test over the glossary and What's-this line finds no advice, signal, skill, edge or pick word.
      "bet" is used as decided in D24 (veto condition: LG).
- [ ] F-6's combined-figure wording and F-4's trust lines pass their existing tests unedited (veto condition: DK).
- [ ] Pinned sign literals are updated, never deleted, and the test count does not drop (veto condition: DK).
- [ ] Any limit the build leaves is marked in code with a `ponytail:` comment naming the limit and its next step, and
      the PR's hand-off note lists it.

## Out of scope
- `confidence()`, ranking, `RANK_MIN_BETS`, D23 order and D24 wording.
- O-15 ("Past results" clause), O-16, O-17 (owner).
- Moving the remaining surfaces onto the arithmetic range: fix #7.
- Flat tone on today's surfaces as a defect: fix #19 (this feature only makes it one helper).

## Open questions
- U+2212 in share images: decided by the render test, not by the council.

## Rework notes
