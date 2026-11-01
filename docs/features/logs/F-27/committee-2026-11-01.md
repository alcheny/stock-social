# F-27 committee record, 2026-11-01

Under the owner's instruction of 2026-11-01 (develop autonomously; decide open questions with the committee's
recommended option). Plan: `docs/features/logs/F-27/plan.md` (UX lead).

## Round 1: plan review

- UX lead: plan drafted (WarnNotice, `.warn-notice` block, four call sites, baseline on `--control`, tests per AC).
  Open questions: OQ-A (share-image hues), OQ-B (status), OQ-C (icon alignment).
- Engineer: DEMANDS. (1) a tsc error in the test fixture; (2) the e2e spec missing; (3) remove the old `.record-failed`
  flex rule so one rule owns the box; weak assertions: keep the old-class absence checks in qa-round-1 finding 7, glob
  `app/t/[symbol]/` for `--line`. All fixed.
- Business lead: DEMANDS. (1) the e2e spec incl. the author's profile; (2) tsc; (3) the old flex rule; (4) AC12 must not
  copy F-20's image gain/loss hues (owner's OQ-1). All fixed. Compliance: pass. Rulings: OQ-A closed as moot for F-27
  (lives in F-20 OQ-1); OQ-C `align-items: flex-start`, `margin-top: 0.225em`.

## Decisions (appended to the feature file)

1. WarnNotice takes only `role` and `children`; always `.record-failed`; flex row with no wrap; the old `.record-failed`
   flex rule removed. Recommended by the engineer and the business lead; adopted.
2. OQ-A: not F-27's; F-27 neither decides nor pins the image gain/loss hues. Recommended by the business lead; adopted.
3. OQ-B: the feature moves from blocked to building (its prerequisites, F-20 #77 and F-11 #85, are on main).

## Tester QA (round 1): clean

No High or Medium findings at 360 and 320 px, light and dark, keyboard, screen reader, a long word, the author view and
200% zoom. Low, existing (not F-27): at 200% zoom the header nav and the stock page's sr-only table scroll sideways
(already a ponytail note in app/globals.css).

## User test at 360 px (business lead and UX lead): SIGN, SIGN

Compliance: words, disclaimer, loss/gain display and roles unchanged; the failed state is carried by icon, box and words.
Usability: reads as a warning, not a loss; the owner's "Try again" is obvious (44 px). Non-blocking notes for a later
feature: (1) the trade page's strip label "Import did not finish" sits above the notice, so the message reads twice;
(2) light --warn and --down are close in hue, carried by icon and box as decided.

## Independent code review: no blocking findings

Non-blocking, applied: the hand-made failed-line scan now covers every .tsx in app/; the --warn selector check no
longer accepts `.warn-notice-*`; the --line check covers baselines only (separators may keep --line); the profile's
source test asserts its pieces, not one exact string. Accepted: the icon sits at the top of a line that holds the 44 px
retry button (cosmetic).
