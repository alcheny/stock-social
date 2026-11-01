# F-18 · One trust language: one Verified, one Demo, no completeness words

Status: blocked
Blocked: waits for F-20, F-10, F-11, F-12, F-13 and fixes #1, #2, #8, #9, #10 (approval council cycle 2 fixes list)
Start conditions: F-20 (design tokens and contrast test) lands first in the shared `app/globals.css` slot. F-10, F-11,
F-12 and F-13 merge, and fixes #1, #2, #8, #9 and #10 merge.

## Why
Three Verified wordings and three Demo names ship today. The badge tooltip "Cannot be edited" is false. Completeness
words ("full record", "every stock") remain, demo pages call trades verified, and the footer repeats literals. A
first-time viewer can't tell what Verified means. This feature builds cycle 1's C10 and the design system's DS-5,
DS-7, DS-8, DS-9, DS-18, DS-20 and DS-24. Approved by the approval council
(`docs/ideas/approval-2026-11-01-cycle2.md`, K7: second-vote mean 3.80, final vote 14/15). The business lead voted
against: it has about zero effect on the week-8 gates, its false parts are already fixes #1, #8 and #10, and it waits
on four features and five fixes, so its slot may sit idle all cycle. The business lead asked that it come back after
the idea board rules on D25 and D27.

## Decisions
- 2026-11-01: One `TRUST_LOOK` table (new `lib/trust-look.ts`) is the only source of the Verified and Demo label and
  icon, and it names their colours by token (`--verified`, `--demo`); the colour values live in F-20's tokens and
  image colour table. The label strings live in `lib/copy.ts`. `Badge` gets `linked` and `plain` forms. Why: approved by the
  approval council (cycle 2); DS-7; PD, UX.
- 2026-11-01: "Verified" is one bare word that links to `/how#verified`. That definition says "imported read-only from
  the trader's broker" and nothing more: no identity, audit, completeness or endorsement. `/how` gets the anchors the
  design system lists. Why: approved by the approval council (cycle 2); POLICY F3a (veto condition: LG).
- 2026-11-01: The meaning of Verified and Demo is reachable without hover, as a link or visible text. Badges always
  carry a text label, never colour or a glyph alone. Why: approved by the approval council (cycle 2); A11Y; WCAG
  1.3.1, 1.4.1, 1.4.13.
- 2026-11-01: The false "Cannot be edited" tooltip is removed. Completeness-word and "sample data" bans are added as
  tests and never loosened. Why: approved by the approval council (cycle 2); DS-18, DS-20; POLICY F3a (veto
  condition: LG).
- 2026-11-01: Demo pages never say "verified", and the Demo badge shows on every demo surface. Demo uses the design
  system's Demo look (DS-5) on pages; the Demo look never reads as Verified. Why: approved by the approval council
  (cycle 2); POLICY P2, F3a (veto condition: LG, CS).
- 2026-11-01: The badge moves off the h1 line onto the stats row, with the definition visible, on the profile and the
  pane alike. Why: approved by the approval council (cycle 2); DS-8; DECISIONS #11 (click and swipe profiles match)
  (veto condition: DK).
- 2026-11-01: The footer renders `DISCLAIMER` and the Verified definition from constants. The Terms, Privacy and How
  links stay on every page. Why: approved by the approval council (cycle 2); DS-9 (LG).
- 2026-11-01: A pin test covers only decided lines that no fix and no pending idea-board item contests. Why: approved
  by the approval council (cycle 2). The red team showed a verbatim pin of a contested line would freeze an F3a
  problem or force a weakened test later (veto condition: LG, CS).
- 2026-11-01: D25's Stocks line is chosen by `demoOnly` / `mixed`: D25's decided wording for real-only data, Demo
  wording when any demo data is shown (fix #1). The test asserts each state. The decided line itself is not reworded.
  Why: approved by the approval council (cycle 2); POLICY F3a, P2 (veto condition: DK, LG, CS).
- 2026-11-01: D27's first-visit line is not pinned until the idea board rules on it against F3a (DSP-2). Any change to
  D25 or D27 wording (DSP-2, DSP-3) waits for the idea board. Meta descriptions (DS-24) take no DSP-3 description.
  Why: approved by the approval council (cycle 2); the council may not reword a decided line (veto condition: DK,
  LG).
- 2026-11-01: F-4's owner trust lines and chart caption, F-1's trust notice and the owner's consent copy are not
  changed. Why: approved by the approval council (cycle 2); owner decisions (veto condition: DK).
- 2026-11-01: F-7's source label stays with F-7's committee. This feature does not set it. Whatever F-7 uses never
  shows the word Verified. Why: approved by the approval council (cycle 2); F-7 standing rule (veto condition: DK,
  LG).
- 2026-11-01: The card Demo hue (O-2) stays with the owner. The share-card palette is not changed here. Why: approved
  by the approval council (cycle 2) (veto condition: CS).
- 2026-11-01: Demo stays visible at equal weight wherever F-13 requires it. Why: approved by the approval council
  (cycle 2); F-13 2026-11-01 (veto condition: DK).
- 2026-11-01: Additions to `scripts/compliance.ts` (O-8) stay the owner's. Why: approved by the approval council
  (cycle 2) (veto condition: DK).
- 2026-11-01: Sequencing: F-18 shares one build slot with F-20 because both edit `app/globals.css`. F-20 lands first,
  so the restyled badges pass its contrast and colour-blind tests. F-18 starts after F-10..F-13 and fixes #1, #2, #8,
  #9 and #10 merge, and duplicates none of those fixes. If F-10..F-13 and those fixes have not merged by the next
  approval council, this approval lapses to that council. Why: approved by the approval council (cycle 2); RT, DK,
  CS, EN (veto condition: DK, LG, CS).

## Acceptance criteria
- [ ] A test fails on any Verified or Demo label, icon or colour defined outside `TRUST_LOOK` / `lib/copy.ts` in `app/`
      or `lib/` (grep test).
- [ ] Every Verified label on page, pane and share card uses one string; on pages and the pane it links to
      `/how#verified` (a share image can't link: the page around the card links, and the card prints no other
      wording); `/how#verified`
      reads "imported read-only from the trader's broker" and nothing more (e2e) (veto condition: LG).
- [ ] A keyboard-only e2e reaches the Verified and Demo meaning without hover. No badge is colour or glyph only
      (component test).
- [ ] "Cannot be edited" appears nowhere (test). A completeness-word ban and a "sample data" ban run over user copy in
      `app/` and `lib/` (tests; F-1 strings exempt by name only) (veto condition: LG).
- [ ] No demo-only surface says "verified" (e2e over profile, pane, `/t`, `/t/<SYM>` and their images) (veto
      condition: LG, CS).
- [ ] The badge is not a sibling of the name, handle or avatar on the profile and pane; the definition is visible text
      on the profile (e2e) (veto condition: DK).
- [ ] The footer's disclaimer and Verified definition come from constants; Terms, Privacy and How links render on every
      page (test).
- [ ] The pin test asserts D25's Stocks line for real-only data and Demo wording for demo-only and mixed data (three
      states) (veto condition: DK, LG, CS).
- [ ] The pin test does not pin D27's line, and pins no line a fix or pending idea-board item contests (review
      checklist in the PR) (veto condition: LG, CS).
- [ ] F-4 owner trust lines and caption, F-1's trust notice and the consent copy are unchanged (existing tests pass
      unedited) (veto condition: DK).
- [ ] No F-7 surface shows the word Verified (test) (veto condition: LG).
- [ ] Share-card colour values are unchanged (image colour table diff is empty) (veto condition: CS).
- [ ] Restyled badges pass F-20's contrast and colour-blind tests in both schemes.
- [ ] Every existing disclaimer and trust assertion passes; tests are updated, never deleted, and the test count does
      not drop.
- [ ] Any limit the build leaves is marked in code with a `ponytail:` comment naming the limit and its next step, and
      the PR's hand-off note lists it.

## Out of scope
- Rewording D25 or D27 (DSP-2, DSP-3): idea board.
- F-7's source label: F-7's committee.
- Card Demo hue (O-2) and "Disconnected" on cards (O-4): owner.
- Compliance scanner additions (O-8): owner.
- The defects already on the fixes list (#1, #2, #8, #9, #10).

## Open questions
- Idea board: rule on D25 and D27 against F3a (DSP-2, DSP-3). The pin test extends to them after that ruling.
- The business lead's dissent: if F-10..F-13 and the five fixes are still open at the next council, this approval
  lapses, as the business lead predicted.

## Rework notes
