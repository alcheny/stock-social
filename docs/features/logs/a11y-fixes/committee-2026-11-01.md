# A11Y-FIXES committee, 2026-11-01

Fixes #5, #8, #9, #10, #11, #13–#23 (minus #24), #25 from the approval council's fixes table
(`docs/ideas/approval-2026-11-01.md`, "Fixes to build now"). Members (fresh-context subagents): UX lead and
accessibility specialist (plan: `plan-ux-a11y.md`), business lead and engineer (reviews).

## Open questions decided

| # | Question | Decision | Reason |
|---|---|---|---|
| 1 | "Their whole record" headings on the trade and month pages | (a) Left to F-4 #35, which owns those record blocks; they are on the copy guard's allow-list with a note naming #35 | Avoids a conflict with #35 |
| 2 | #16 sign-in bar | (a) Closes on Esc, on focus moving outside it, and on a row change | Smallest diff next to #30; focus is never covered |
| 3 | #17 focus after → | (a) The pane's Back button | A real control; the region name is read on entry |
| 4 | `lib/ticker.ts` compare copy | Reviewers split (business lead (a), engineer (b)). Ruling: change only the one "Pick" string in `lib/ticker.ts` and keep every `app/t/**` edit to the one-line minimum, marked `A11Y-FIXES`, listed in the PR for the labels session | Fix #11 and #25 are assigned here; the business lead's own condition (another session editing it) is handled by keeping each edit one line |
| 5 | Mixed demo/real profiles | (a) Treat `!allVerified` as demo | No mixed profiles exist |
| 6 | `--control-line` | (a) A new token used only by control borders | Separators keep their weight; the token council may replace it |
| 7 | Undo bar | (a) A note for #30 | #30's file and behaviour |

## Blocking demands accepted

- B1. Join CTA stops enumerating: "Verify your own record. Read-only broker connection. Public trades show percentages,
  never quantities, prices or balances. 18+." (no "only percentages").
- B2. The share prompt says "your closed trades", not "each closed trade", and an e2e checks its "Public:" list against
  what a signed-out profile renders (handle, name, symbols, dates, percent, open positions, theses).
- B3. The copy guard matches with word boundaries and includes "whole record" and "every record"; allow-listed
  entries pass whether present or absent (so another session's PR never turns red on this test).
- B4. #19: the card's `overflow-y: auto` only inside `@media (max-height: 480px)`; at 360×640 it stays `hidden` (e2e).
- B5. #17: a new `app/feed-inert.ts` hook with a one-line call in `app/feed-keys.tsx`; only direct children of
  `.feed > .row`; sheets and dialogs excluded; the pane is un-inerted before `scrollTo`; appended pages (`?after=`)
  start inert too (e2e).
- Contrast values are computed in `lib/a11y-contrast.test.ts` from `app/globals.css`, so the token council inherits the
  floor.

## Non-blocking, taken

- The badge title and the footer's Verified sentence share one constant.
- The 404 page's "Trades by stock" link uses the nav's constant.
- `signWord`/tone get pure unit tests (no seed has a 0.0% trade).
- The PR names who owns the fixes left out here (#2, #3, #4, #6, #7, #12, #24).
