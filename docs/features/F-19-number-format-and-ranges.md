# F-19 · Number format, tone and ranges: one sign, one Flat, ranges that hold their average

Status: built
Start conditions: this build is the first slice (`lib/` only) and may start now. The call-site sweep, the
every-surface range test and the placement of the What's-this line are a later rework of this feature (`Status:
rework`), opened after F-10, F-11, F-12, F-18 and fix #7 merge (see Out of scope).

## Why
Signs use a hyphen, decimals vary, and 0.0% is painted red and announced as "Gain". A printed range can exclude its
own headline. Jargon such as "independent bet" and "avg return" confuses lay readers, and many read a range of the
average as the spread of single trades. This feature builds cycle 1's C5, the design system's DS-10 to DS-13 and DS-25,
and the market council's "What's this?" line (MRC2-5). Approved by the approval council
(`docs/ideas/approval-2026-11-01-cycle2.md`, K8: second-vote mean 3.73, final vote 15/15).

## Decisions
- 2026-11-01: First slice, `lib/` only: `lib/format.ts` becomes the single home of `pct()`, `winPct()` and `tone()`
  (with Flat). The old homes (`lib/trades.ts`, `lib/open-split.ts`, and `toneClass` in `app/open-rows.tsx`)
  re-export or delegate to them. There is one implementation. Why: approved by the approval council (cycle 2). The red team showed
  new helpers beside the old ones would add the drift this feature removes.
- 2026-11-01: A property test asserts lo ≤ avg ≤ hi on every surface's printing function: profile, pane, feed card,
  trade, month, stock and images, not `cardEvidence` alone. It runs in the sweep rework, after fix #7 moves the
  remaining surfaces onto the arithmetic range; before that it would fail on today's stock, compare and recap
  surfaces. Why: approved by the approval council (cycle 2). The red team showed a test on `cardEvidence` alone holds
  by construction once fix #7 lands; the orchestrator's review placed it after fix #7.
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
- 2026-11-01: First slice: `pct()` moves to `lib/format.ts` byte for byte, with no second style; a `ponytail:` at it names the limit (ASCII hyphen, up to `digits + 4` decimals near −100%, no comma) and the sweep rework replaces the algorithm with the design system §3 form. Why: decided by the committee under the owner's instruction of 2026-11-01; share images and the display log import `pct` through `lib/trades.ts` and must keep the hyphen without call-site edits, about 45 pinned sign assertions stay green while other sessions edit them, and a second style would be a second rounding path (engineer, round 1).
- 2026-11-01: `tone(x, digits = 1)` rounds the way `pct(x, digits)` prints: Flat exactly when the printed number has no sign, at digits 0, 1 and 2. Why: decided by the committee under the owner's instruction of 2026-11-01; the chart prints `pct(x, 0)`, and colour and word must never contradict the number shown.
- 2026-11-01: `toneWord()` gives "Gain" / "Loss" / "Flat" beside `tone()`, wired into no screen in this slice; "about even" in accessible text is the sweep's. Why: decided by the committee under the owner's instruction of 2026-11-01; Flat needs a word (POLICY A1) that cannot drift from the decision.
- 2026-11-01: `winPct(wins, n)` takes whole-number counts (null otherwise), rounds half up in integers, never prints 100% with a loss or 0% with a win, and is null for no trades; it is not wired into `winRateText` or the display log. Why: decided by the committee under the owner's instruction of 2026-11-01; D23 keeps win rate output untouched and the display log is append-only.
- 2026-11-01: The property test in this slice is that `pct()` is monotonic over 10,000 seeded values and rounding boundaries ("≈-100.0%" parses just above −100), so any numerically ordered lo ≤ avg ≤ hi prints in order; the every-surface test stays with the sweep rework. Why: decided by the committee under the owner's instruction of 2026-11-01; it is the part that holds before fix #7.
- 2026-11-01: `RANGE_NOTE` is one constant at the end of `lib/copy.ts`, tested against `cardEvidence` (centre equals the average, a single trade lies outside the range) and whole-word banned terms (adding guarantee, expect, will); it is not added to `allCopy()` yet. Why: decided by the committee under the owner's instruction of 2026-11-01; other sessions edit that line.
- 2026-11-01: Call sites left for the sweep are listed in `F19_SWEEP_SITES` (`lib/format.ts`) rather than commented in place, and a test checks each file exists; the zero-count grep for inline tone decisions and "Gain " labels is a sweep-rework acceptance item. Why: decided by the committee under the owner's instruction of 2026-11-01; per-site comments would conflict with F-18's stats-row rewrite and the open card, pane, trade, month and stock sessions, and a count ratchet now would fail their in-flight PRs.
- 2026-11-01: Ranking is pinned in a new file (`lib/ranking.f19.test.ts`) with values computed on main before the slice. Why: decided by the committee under the owner's instruction of 2026-11-01; veto condition DK, LG; the only existing test edited is F-6's source scan in `lib/open-split.test.ts`, updated to follow the move and still exact.

- 2026-11-01: The call-site sweep, the every-surface range test and the What's-this placement lapsed at approval
  council cycle 3 (F-18 had not merged) and were not re-approved (after-debate mean 2.80; `docs/ideas/approval-2026-11-01-cycle3.md`). The first slice
  (#57) stays built. The sweep returns to a council after F-18 is re-approved. The data-visualization designer's
  recommendation, to run the lo ≤ avg ≤ hi range property test as soon as fix #7 merges, is recorded for that
  council. Why: approval council cycle 3; lapse rule.

## Acceptance criteria
- [ ] `pct`, `winPct` and `tone` are defined only in `lib/format.ts`. The old names in `lib/trades.ts` and
      `lib/open-split.ts` re-export them, and `toneClass` in `app/open-rows.tsx` delegates to `lib/format.ts#tone`
      (asserted by equal outputs over a fixture set). A grep test fails on a second implementation.
- [ ] `tone(0)` and a printed "0.0%" give Flat, never the loss colour, and never announce "Gain" (unit test).
- [ ] (Sweep rework, after fix #7.) The lo ≤ avg ≤ hi property test runs over the printing function of every surface
      (profile, pane, feed card, trade, month, stock page and each share image).
- [ ] The What's-this text "the range is for the average, not one trade" exists as one constant, and a test ties it to
      the arithmetic range computation. (Sweep rework, after F-18.) It shows on the stats-row What's-this (e2e).
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
- The call-site sweep (signs, decimals, Flat on every surface, chart line tone, glossary), the every-surface range test
  and the What's-this placement: a rework of this feature, opened (`Status: rework`) by the orchestrator after F-10,
  F-11, F-12, F-18 and fix #7 merge. Criteria marked "(Sweep rework …)" belong to it.
- `confidence()`, ranking, `RANK_MIN_BETS`, D23 order and D24 wording.
- O-15 ("Past results" clause), O-16, O-17 (owner).
- Moving the remaining surfaces onto the arithmetic range: fix #7.
- Flat tone on today's surfaces as a defect: fix #19 (this feature only makes it one helper).

## Open questions
- U+2212 in share images: decided by the render test, not by the council.

## Rework notes
- 2026-11-01 (first slice built; committee record `docs/features/logs/F-19/committee-2026-11-01.md`): the sweep
  rework takes the §3 form in `pct()` (replacing the algorithm), `imagePct()` for images and the display log, the
  every-surface lo ≤ avg ≤ hi test, the What's-this placement, `RANGE_NOTE` in `allCopy()`, wiring `winPct()` and
  `toneWord()`, and a zero-count grep for `>= 0 ?` / `> 0 ? 'up'` / "Gain " labels over the `F19_SWEEP_SITES` files.
