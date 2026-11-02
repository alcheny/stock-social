# F-29 · Legal sign-off record (plan D8)

Feature: `docs/features/F-29-gated-options-wording.md`. Plan: `docs/features/logs/F-29/plan.md` (D8, round 2 B2).
Recorded by the builder, 2026-11-02. This file records an existing signature; it does not sign anything itself.

## The signed words
The AI legal committee signed the interim /how sentence at approval council cycle 5 (round 1, recorded in the cycle-5
ballots, `docs/ideas/approval-2026-11-01-cycle5.md`: F-29 re-approved, final vote 15/15; legal committee member veto
line "F-29: the signed words are used exactly"; contrarian veto line "F-29: the last qualifier on a surface is never
removed"). The words, verbatim:

> Option results are not shown on any record at present. Where option trades or open options were imported, the record shows how many, and its headline figures exclude options.

In code: `lib/copy.ts#F29.howInterim`, these words exactly, shown by `app/how/options-paragraph.tsx` while
`optionsPublic()` is false. `lib/f29-gated-wording.test.ts` (AC 8) holds the constant to this text as a literal, and
`e2e/f29-gated-wording.spec.ts` checks it on the running /how page. When the gate opens, /how shows the existing
legal sentence `OPTIONS.how`, unchanged.

## Placement
The per-surface qualifier is the existing "Excluding options" (`OPTIONS.shareLabel`) and `OPTIONS.altQualifier`,
placed as decision (b) of the feature file, which the same cycle-5 signature covers:
- Feed card: the record strip's qualifier (unchanged) and the existing gated count line (`OPTIONS.gated`, no new copy)
  directly under the strip (D6, round 2 B1: decision (b) as written).
- Pane: the one qualifier, now directly after the figures block and before the count line (D5).
- Profile: unchanged, directly before the headline stats (D4).
- Share images, their alt text, F4-4 and F4-5: unchanged.

No new words were added, and none of the signed words were edited. Every placement follows the signed placement, so
**no placement re-sign is pending**. If a placement change ever needs a re-sign, a `Pending re-sign:` line goes here,
and the AC 7 test fails until a matching `Signed:` line is recorded.
