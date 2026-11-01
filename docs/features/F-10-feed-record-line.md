# F-10 · One record line on every feed card, and the shared RecordStrip

Status: ready

## Why
A feed card shows one closed trade with "held · closed" and no record around it, so one lucky trade reads as a
skilled trader. The idea board decided D22 (`docs/IDEAS.md`, 2026-11-01). This feature builds it, together with the
shared `RecordStrip` component that F-12 reuses on trade and month pages and images. Approved by the approval
council (`docs/ideas/approval-2026-11-01.md`, C3: second-vote mean 4.13, final vote 15/15).

## Decisions
- 2026-11-01: D22, verbatim: "every feed card carries one record line (closed-trade count, average per trade with its
  range) in place of the 'held · closed' line, in D24's wording, and 'Too early to tell' under 5 bets, never a bare
  average; the smaller ticker is built as three versions and tested on open-pane rate; ranking is unchanged." Why:
  decided by the idea board; approved for build by the approval council.
- 2026-11-01: One `RecordStrip` component and one pure data helper build the line. F-12 reuses both, and there is
  never a second strip. Why: approved by the approval council; a second strip triggers common sense's veto (wording
  drifts between surfaces).
- 2026-11-01: All of a page's card records come from one aggregate query: the query count is constant in the number of
  cards. Why: approved by the approval council (reliability and engineer). The feed is the hottest route.
- 2026-11-01: Built after F-2's PR #30 merges, on its card markup. Ranking stays as decided (RANK_MIN_BETS 10, F-4
  2026-11-01). The line coexists with F-6's "Also open: …" line. Why: approved by the approval council; F-2 owns the
  card markup.
- 2026-11-01: The range uses the same TR-9 wording as the profile (`lib/confidence.ts`). A negative average uses the
  down tone, and sign is always carried in text. The short-record wording uses the design system's settled wording.
  Why: approved by the approval council; the design system council is settling the short-record wording now.
- 2026-11-01: On F-7 public-trader cards the strip shows F-7's source label, never "Verified". Why: approved by the
  approval council (the decisions keeper's F-7 interface condition; F-7 standing rule).
- 2026-11-01 (build committee, `logs/F-10/committee-2026-11-01.md`): "Too early to tell" (no average) whenever the
  profile's evidence tier is too early: under 5 bets or a range wider than ±10 points (TR-9). It has the average's weight.
  Why: business lead; a lucky short record must not read as a result.
- 2026-11-01 (build committee): the card's average and range come from `cardEvidence()`/`evidenceRangeText()`, the
  profile's own calls. The feed card keeps the bare "(low to high)" without "· 95% range" or "losses included" to stay
  within two lines at 320 px (documented exception); open positions stay in F-6's "Also open" line, not repeated.
  Why: AC3; the committee's two-line budget.
- 2026-11-01 (build committee): the strip's figures are computed once per trader in `loadFeedPage` from the records the
  page already reads (`records()` gains `opened_at`), cached by row count and newest row id. Why: engineer (feed budget).
- 2026-11-01 (build committee): the smaller-ticker variants are deferred to a follow-up issue with `## Variants`; this
  build keeps today's ticker. The process note stays open. Why: orchestrator ruling (one PR); no open-pane measurement
  exists yet to judge them.

## Acceptance criteria
- [ ] Every feed card shows one record line in place of "held · closed". It gives the closed-trade count and the
      average per trade with its range, built from the trader's full closed record with losses included (unit test
      over the helper; e2e on `/`).
- [ ] Under 5 bets the line says "Too early to tell" (or the design system's settled short-record wording) and never
      a bare average (unit test).
- [ ] The range wording on the card equals the profile's for the same record (test).
- [ ] The feed's query count does not grow with the number of cards on a page (load test like `lib/feed.load.test.ts`).
- [ ] Feed ranking is unchanged: the ordering tests for F-2 and RANK_MIN_BETS still pass.
- [ ] F-6's "Also open: …" line still renders beside the record line when the trader has open positions (e2e).
- [ ] Reflow e2e at 320 px, 360×640 and 780×360 landscape shows no clipped card text, no horizontal page scroll,
      and a working swipe and card link.
- [ ] The strip is real text in the card's reading order (not aria-hidden). Nothing is conveyed by colour alone.
- [ ] The F3 disclaimer stays in view on the feed's first screen at 360 px (e2e, with fix #3).
- [ ] A demo record's line never contains "verified" (string test). On F-7 public-trader cards the source label
      replaces any Verified wording.
- [ ] `RecordStrip` and its helper are exported for F-12 and documented in the feature log.

Notes (process, not tests):
- The smaller-ticker variant is built as three versions, each its own PR, chosen by /choose or the Judge on open-pane
  rate (CLAUDE.md three-versions rule). The record line ships in all three.

## Out of scope
- Trade and month pages and images (F-12), and the profile headline order (D23, waiting).
- Any change to ranking or to the F-4 record card.

## Open questions
- None from the council. The build's plan debate decides layout within the D22 wording.

## Rework notes
