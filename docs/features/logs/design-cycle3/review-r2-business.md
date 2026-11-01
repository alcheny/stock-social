# Business lead review, round 2: F-25, F-26, F-27 (2026-11-01)

Re-read all three files and round2-changes.md against main 06edbdf. Chair rulings 1-5 accepted, including the standing-Q1
line instead of "None.".

## Verdicts
- F-25: NO. Three small fixes remain, and I will sign on sight once they are made. Everything else from round 1 landed well:
  `trade_key` with the 308, the rebuild-stability AC, the PR 1/PR 2 split, and the budget held fixed with a stop rule.
- F-26: SIGN. The payload, cache, metadata and report-string decisions close every leak path I could find.
- F-27: SIGN. One component, one notice per surface, no exemption list. The second owner question (if the owner says no,
  F-20 cannot pass as decided) is a real finding and the right question to ask.

## The new choice: "Their record, wins and losses →"
The copy is fine. It keeps "wins and losses" (the trust cue), drops a verb that adds nothing, and it fits on one line beside
"This trade →". But earlier work fixes the old text, so the change must be recorded as an amendment:
- F-7 AC20 (`docs/features/F-7-public-traders.md:80-81`, Status: built) fixes the public-filer card footer as
  "See their record, wins and losses →".
- `lib/copy.ts:852` `PUBLIC.cardFooter` holds that string.
- `lib/f7-trust.test.ts:96` asserts it.

F-10, F-2 and F-13 mention the text only in logs and plans, not in decisions or ACs. The e2e specs that assert the old text
include three that F-25's narrowing AC does not list:
- `e2e/f10-followups.spec.ts:79` and `e2e/record-strip.spec.ts:121` match `/See their record/`, so they would fail.
- `e2e/record-strip.spec.ts:168` asserts a count of 0 for `/See their record, wins and losses/` on the trade page. With the
  new text, that check would always pass, which quietly weakens a test (CLAUDE.md: never weaken tests).

## Required changes (F-25)
1. Add the decision "2026-11-01: The card footer's profile link reads 'Their record, wins and losses →' on connected and F-7 public-record cards alike; this amends F-7 AC20 ('See their record, wins and losses →'), and `PUBLIC.cardFooter` and `lib/f7-trust.test.ts:96` change with it. Why: decided by the committee under the owner's instruction of 2026-11-01; both footer links fit on one line at 360 px, and a public card's footer must match a connected card's.", and append a dated amendment note under F-7 AC20 that points to F-25.
2. One constant: the connected card (`app/ui.tsx:94`, inline today) and the public card both read the profile-link text from one `lib/copy.ts` string, so the two footers cannot drift apart again.
3. Add `e2e/f10-followups.spec.ts:79` and `e2e/record-strip.spec.ts:121` to the selector-narrowing AC, and add the AC "`e2e/record-strip.spec.ts:168` asserts zero links matching `/(See t|T)heir record, wins and losses/` on the trade page, so the no-duplicate check still bites."

## Note for the record (no change required)
F-25's Blocked line no longer names F3-8, and its Decisions say F-25 supersedes F3-8's naming of the stock-page rows. I accept
the engineer's reasoning that waiting for F3-8 would be wasted time.

# Business lead review, round 3: F-25 (2026-11-01)

## Verdict
- F-25: SIGN. No changes remain.

All three of my round 2 items are applied:
- The F-7 AC20 amendment is recorded as a dated decision in F-25, with `PUBLIC.cardFooter` and `lib/f7-trust.test.ts:96`
  changing with it.
- One `lib/copy.ts` constant serves both card kinds, enforced by a source-test AC.
- `e2e/f10-followups.spec.ts:79` and `e2e/record-strip.spec.ts:121` are on the update list, and the `:168` count-zero
  check now matches the old and the new text, so it still fails if the duplicate link comes back.

I accept the chair's rulings: one PR blocked on F-9, F-11 and F-26, and no F-28.

The new copy, "Record, wins and losses →", keeps the trust cue and loses nothing a reader needs, because the card already
names its trader. At 0.875rem it matches the record strip and the card disclaimer (`app/globals.css:661,667`), so the
footer adds no new type size. About 11% spare width at 360 px is enough, and below 360 px the links stack, which the AC
checks.

Non-blocking, for the build's accessibility pass: the profile link's name does not say whose record it is. That passes
WCAG 2.4.4 in the card's context, and no change is required.
