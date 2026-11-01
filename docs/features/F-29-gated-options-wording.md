# F-29 · Gated options wording that is true for every record

Status: blocked
Blocked: waits for `claude/fix-truthful-labels` to merge (it edits the pane, chart, record strip and /how lines this feature changes), PR #77 (F-20, `lib/record-strip.ts`) to merge, and the AI legal committee's signed words for the interim /how sentence and the per-surface qualifier
Start conditions: the three prerequisites above. It is its own build slot (the /how and options copy slot). C4-27 (/how
describes public-filing records only when they exist; 3.33, not approved) could ride the same slot if a later council
approves it.

## Why
/how says option results show "only on records whose trader has consented to publishing them" (`lib/copy.ts:466-467` at
e6731d5). But every trader is gated until the owner amends the consent line (`lib/options-gate.ts:1-5`;
`CONSENT_SCOPE_LINE`, `lib/copy.ts:82`, names no option column). So a trader who consented to everything offered reads
as withholding. The pane also repeats "Excluding options" up to five times (`app/pane.tsx:58`, `:65`, `:95`;
`app/u/[handle]/chart.tsx:138`; `lib/record-strip.ts:117`), which buries the headline it qualifies. Council cycle 4
brief C4-26, parts (a) and (b). Approved by the approval council (`docs/ideas/approval-2026-11-01-cycle4.md`:
second-vote mean 3.87, final vote 15/15, all with conditions). Part (c) is with the owner (Q3).

## Decisions
- 2026-11-01: (a) While `optionsPublic()` is false, /how carries an interim sentence that is true for every record.
  Its gist: option results are not shown on any record yet, counts are shown, and headlines exclude options. When the
  gate opens, it switches back to the legal sentence. While the gate is closed, /how never says "consented". Why:
  approved by the approval council (cycle 4); brief C4-26 (veto condition: CS).
- 2026-11-01: The AI legal committee signs both the interim words and the per-surface placement, amending its fix
  round 4 re-sign (`docs/features/logs/options/committee-2026-11-01.md:64`). The sign-off is recorded with the words in
  the PR. Why: approved by the approval council (cycle 4); POLICY; owner decision 2026-11-01 (veto condition: LG, DK).
- 2026-11-01: (b) Each card and each pane shows exactly one options qualifier and one count line while a qualifier
  is on screen. The kept qualifier sits in the same visual block as the headline figures (win rate and average),
  muted at caption size with no warning tone, in reading order or tied by `aria-describedby`. It is never only in a
  caption, foot or title. The chart caption keeps its own qualifier, because charts get cropped. A test checks
  position, not only count. Why: approved by the approval council (cycle 4); red team, PD, A11Y, DV (veto condition: LG).
- 2026-11-01: The last qualifier on a surface with a headline figure is never removed. Share images and their alt
  keep theirs (`OPTIONS.altQualifier`), and fixes F4-4 (month recap) and F4-5 (profile unfurl) keep theirs, counted
  as that surface's one instance. Why: approved by the approval council (cycle 4); CS V3, DK (veto condition: CS).
- 2026-11-01: No public surface tells "not asked yet" apart from "declined". Part (c) stays with the owner (Q3). The
  council recommends a trader-only view. Why: approved by the approval council (cycle 4); LG (veto condition: LG, P3, a
  public difference would publish a privacy choice).
- 2026-11-01: Cached /how, profile and share surfaces include the gate state in their cache key, so a gate flip
  never serves a pre-flip body. Tests cover both `optionsPublic()` states. Why: approved by the approval council
  (cycle 4); red team, RE.
- 2026-11-01: The council recommends to the owner a line on the gate-opening checklist: `optionsPublic()` does not
  open publicly until a trader-only "not asked yet" view (Q3) or a wording true for both cases exists. The red team
  showed that on opening day "consented" returns while traders who have not been asked again would read as
  withholding. This is the owner's call. Options committee decision 8 is not amended here. Why: approved by the approval
  council (cycle 4); red team, DK.
- 2026-11-01: Sequencing and lapse: blocked until `claude/fix-truthful-labels` and PR #77 merge and the legal words
  exist. If they have not by the next approval council (cycle 5), this approval lapses to that council. Why: approved by
  the approval council (cycle 4); lapse rule.

## Acceptance criteria
- [ ] With the gate closed, the /how options paragraph never contains "consented". With it open, it shows the legal
      sentence (render test in both states).
- [ ] A render test counts "Excluding options" at most once per card and once per pane (chart caption excepted). It
      checks that the kept one sits in the headline figures' block, and that it never drops to zero on a surface with a
      headline figure.
- [ ] Share images and alt still carry the qualifier, and the F4-4 and F4-5 qualifiers are unchanged.
- [ ] The kept qualifier is announced with the headline figures (reading order or `aria-describedby`; a11y test).
- [ ] No public surface prints "not asked" or "declined" (source scan).
- [ ] After a gate flip in a test, no cached /how, profile or share body from before the flip is served.
- [ ] The legal committee's sign-off is recorded with the words in the PR.

## Out of scope
- Part (c), the not-asked or declined fact (owner Q3).
- The consent-line amendment and the re-consent prompt (options committee owner items K9/K10).
- The count line's unit (C4-8, routed to the options and legal committees).

## Open questions
- Owner Q3: once the re-consent prompt exists, should a gated record show the trader, privately, whether they have
  been asked? The council recommends yes, on the trader's own view only.
- Owner: adopt the gate-opening checklist line above?

## Rework notes

## Build log
