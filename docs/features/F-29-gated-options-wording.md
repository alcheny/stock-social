# F-29 · Gated options wording that is true for every record

Status: ready
Start conditions: met. `claude/fix-truthful-labels` merged in #85, F-20 merged in #77, and the AI legal committee
signed the interim words at approval council cycle 5 (Decisions, 2026-11-01, re-approval). It rides the pane/strip
build slot with F-21 and F-34 (one builder owns the pane's line order); its first commit rebases on F-23 (#97) if #97
merges first, since both edit `app/pane.tsx`, `app/u/[handle]/chart.tsx` and `lib/copy.ts`. C4-27 (/how describes
public-filing records only when they exist; 3.33, not approved) could ride the same slot if a later council approves
it.

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

- 2026-11-01: Lapsed to approval council cycle 5 (the legal words did not yet exist) and re-approved there
  (`docs/ideas/approval-2026-11-01-cycle5.md`: second-vote mean 4.33, final vote 15/15, all approving, 9 of them with
  conditions). Every decision above is kept word for word. Why: approval council cycle 5; lapse rule.
- 2026-11-01: The AI legal committee's signed interim /how words, while the gate is closed: "Option results are not
  shown on any record at present. Where option trades or open options were imported, the record shows how many, and
  its headline figures exclude options." The per-surface qualifier is the existing "Excluding options" and
  `OPTIONS.altQualifier`, placed as decision (b) above. The builder uses these words exactly. Any change needs the
  committee's re-sign in the PR. Why: approval council cycle 5; signed by the legal committee member (round 1, recorded
  in the cycle-5 ballots) (veto condition: LC).
- 2026-11-01: The pane/strip slot's shared criterion binds this feature: with the exclusions line (F-21), the open
  line (F-34) and the options qualifier all present on a fictional record, the headline and the disclaimer stay in view
  at 360 px and the layout reflows at 320 px. In the pane the order is exclusions, then open, then options qualifier,
  one line each. Why: approval council cycle 5; UX, RT round 4, CO.
- 2026-11-01: Status ready: the code prerequisites merged (#85, #77) and the words are signed. If #97 (F-23) merges
  first, the first commit rebases on it. Why: approval council cycle 5; EN.
- 2026-11-02: The owner accepted OD 2.63 en bloc: options stay gated until the owner approves an amended scope line
  (plan D5 wording) as a new consent version with a re-consent prompt; a private "not asked yet" vs "declined" fact on
  the trader's own view, worded by the legal committee; `optionsPublic()` stays closed until that exists; a size
  caveat only if the fee probe shows leakage; "never shown" for `sell_id` only once F-25 makes it true. Whether strike
  inference goes in the consent text or the Privacy Policy stays open. Why: the owner's decision of 2026-11-02 (OD
  2.63).

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
- [ ] A test asserts the signed interim words verbatim on /how while the gate is closed.
- [ ] The gate flips within one process in a test, and the next /how, profile and share bodies differ from the
      pre-flip ones.
- [ ] With F-21's and F-34's lines present (once built), the pane keeps the headline and disclaimer in view at 360 px
      and reflows at 320 px (e2e).

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
