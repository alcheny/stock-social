# F-12 · Record strip on trade and month pages and their images

Status: ready

## Why
A shared trade or month page or image shows one result without the record behind it. That is the cherry-picked
screenshot the product exists to replace, and image posts are how most links travel (market research council). The
idea board decided idea 16 (`docs/IDEAS.md`, 2026-11-01). This feature builds it on the trade and month surfaces and
the stock image, reusing F-10's `RecordStrip`. Approved by the approval council
(`docs/ideas/approval-2026-11-01.md`, C15: second-vote mean 4.07, final vote 15/15).

## Decisions
- 2026-11-01: Idea 16, verbatim: "per-trade detail stays on per-trade cards; the record card stays record-level. Every
  per-trade card carries a record strip (closed-trade count, the record's average with its range, handle and
  full-record link, 'losses included') and the disclaimer, and shows closed trades only." Why: decided by the idea
  board; approved for build by the approval council.
- 2026-11-01: The strip labels its average "Closed trades" and, when the trader has open positions, adds the open count
  (F-6 2026-11-01: every surface reflects open positions). Why: the decisions keeper's reconciliation of idea 16 with
  F-6.
- 2026-11-01: Same `RecordStrip` component and helper as F-10, never a second strip. Built after F-4's PR #35 merges.
  The F-4 record card is untouched. Why: approved by the approval council (common sense's veto condition; F-4 owns the
  record card).
- 2026-11-01: No win rate on images. Win rate on trade and month images is owner question Q13. Why: approved by the
  approval council (the decisions keeper's veto condition).
- 2026-11-01: The month page's "Past results:" verdict is removed. Months show numbers and range only. Why: approved by
  the approval council (legal: POLICY F3b; design council D-24).
- 2026-11-01: An anti-crop band keeps the strip, "losses included" and the disclaimer inside the centred safe area that
  survives a square and a 1.91:1 crop, at the legibility floor. Image alt text carries the same facts. Why: approved by
  the approval council; the red team's crop case.
- 2026-11-01: The full-record link goes to the profile, not the feed. Why: approved by the approval council (UX lead).

## Acceptance criteria
- [ ] Trade and month pages show the shared `RecordStrip` with closed-trade count, average per trade with its range
      ("Closed trades"), handle, a full-record link to `/u/[handle]`, "losses included" and the F3 disclaimer (e2e).
- [ ] When the trader has open positions, the strip adds the open count (unit test on the helper).
- [ ] The trade image, the month image and the stock image render the strip and the disclaimer inside the centred
      safe area. An image test crops each to 1:1 and 1.91:1 and finds the strip text, at the legibility floor and at
      4.5:1 contrast or better.
- [ ] Image alt text states the strip's facts: count, average with range, "losses included" and the disclaimer (test).
- [ ] No image or image description contains a win rate (string test).
- [ ] Month pages contain no "Past results:" verdict (string test) and show the same fields for every month, losing
      months included.
- [ ] Only closed trades appear on per-trade cards (test).
- [ ] The F-4 record card's output is byte-identical before and after this feature (snapshot test).
- [ ] The strip comes from F-10's component. A test fails if a second strip component exists.
- [ ] A demo record's strip and image say "Demo" and never "verified" (string test).
- [ ] Fonts on images are the ones already bundled (F-4 2026-11-01). No new dependency.

## Out of scope
- The F-4 record card, win rate on images (owner Q13) and the story size.

## Open questions
- The legibility floor in px: set in the build's plan debate. The council noted ≥13 px at 1200 wide, with the creative
  council's ≥35 px at 1200 for the record line as the target.

## Rework notes
