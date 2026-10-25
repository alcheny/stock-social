# F-4 · PR 2 committee · Business lead

Date: 2026-10-25. Reviews `autopilot/feature-4-card-model`, `dab09f7..c7aee59`: `lib/record-card.ts`, `lib/card-glyphs.ts`,
`lib/copy.ts`, `lib/story-image.ts`, the tests and snapshot, `build-pr2-engineer.md`, `pr2-body.md`. Judged against the main-tree
`docs/features/F-4-share-card.md` (including the 2026-10-24 O1 rows), `plan.md` PR-2, my sign-off C1–C7, POLICY and COMPLIANCE §1.
Read-only: I ran `node --test lib/record-card.test.ts lib/card-glyphs.test.ts lib/copy.test.ts` (41/41 pass),
`node scripts/compliance.ts diff origin/main` (ok), `npx tsc --noEmit` (clean), and printed the full string list for 11 fixtures
(winning, losing, K = 4, too early by width, strong losing, O2, 10,000 closes, failed, demo, empty `none`, importing).
Nothing here is legal advice.

**Decision: accept, with two small demands (B1, B2), both inside this PR and under 10 lines.** Strongest reason: every
owner decision is a field of one model and is tested cell by cell, and the losing card is word-for-word the winning card with
the sign and the cell changed. That is the trust story the card exists to tell.

## 1. Does the model carry what the owner decided?

| Owner decision | In the model | Verdict |
|---|---|---|
| The chart (ALL, from 0%, 0% on the axis) | `chart`: ALL series, ≤ 400 points, first point at the baseline, domain contains 0, both layouts' geometry | Yes |
| The trade count, "losses included" | `count` "12 trades" / "1 trade" / "10,000 trades"; `lossesIncluded` | Yes |
| The period | "Record since Mar 2025 · 19 months", UTC, "under a month", frozen end | Yes |
| One headline, its range in words, no win rate | "+2.0%" "average return per trade" "likely between +1.2% and +2.7%"; no `winRate` key (fixed key list, tested) | Yes |
| Evidence label | "Evidence: thin / moderate / strong / too early" on every record body | Yes |
| The plain trust line | the owner's 10 cells, verbatim, incl. both 2026-10-24 loss rows | Yes |
| Disclaimer on every state | a required field; present on all 21 fixtures, empty and importing included | Yes |
| Verified or Demo on every state | the badge is never blank: Verified only connected + all-verified + not demo; Demo data; Import did not finish; Importing record; No broker connected | Yes |

Order: the model's reading order (identity, headline and range, pill and trust line, chart, count, period, disclaimer) is the
layout both leads signed in plan §3 ("whose / is it real, then how did it go, then can I believe it"). The owner listed the
elements, not their order. Whether the chart reads as the hero beside a 108 px headline is a render question for PR 3's
375 px committee, not a model defect.

## 2. Trust copy: true, symmetric, no skill words

- **True.** Direction comes from the range printed beside it (`cardDirection`), so the line cannot contradict the range. "A
  long record" needs ≥ 365 days (Y ≥ 1) and "a fair sample" ≥ 90 days (M ≥ 2), so no "0 years" or "0 months" is reachable.
  Floors understate, never overstate.
- **Symmetric.** Printed: winning "+2.0% … likely between +1.2% and +2.7% … Still early." vs losing "−2.0% … likely between
  −2.7% and −1.2% … Still early, and so far the average trade is a loss." Same fields, same tones by sign, same prominence
  (the parity test proves it field by field). "Consistent" only for strong and one-sided, both signs tested.
- **No skill words.** Reader terms, PROMO and claim words scanned over every cell and every string of every fixture. The
  lines describe the sample ("bets", "record", "sample"), never the trader.
- **Owner note, not a demand (O3 family).** At K < 5 the card prints no range but the owner's too-early line says "The range
  is still too wide to say much." True in substance (no usable range yet), and the owner approved "Too early | any". I flag
  it so the owner sees it once on the PR 3 render.
- **PR 3 watch.** A record that went quiet shows "Record since Mar 2025 · 19 months" beside "over 35 days" (or "over 1
  year"). Both are true (the period is coverage, the trust line is the trading span) and the plan's tester fixture expects
  it. If PR 3's 375 px render makes the two read as a contradiction, it comes back to me.

## 3. The engineer's deviations

| Deviation | Verdict | Reason |
|---|---|---|
| Tall count 47 px, not 46 | **Accept** | 46 × 375 / 1080 = 15.97 misses the plan's own 16 px floor; the floor is the requirement, the number was arithmetic. +1 px is covered by PR 3's D2 band test. Plan §3 table should read 47 in the next plan touch (non-blocking) |
| Plot boxes: first values here (620 × 176 wide, 952 × 180 tall), tuned in PR 3 | **Accept, with one condition** | The values are the UX lead's measured column, so nothing is really deferred: PR 3 only tunes heights. Condition: any change lands in this model's `CHART` constant (one model, the reviewer's PR 3 rule), and no text size shrinks to make room |
| Badge maps an unreachable `none`-with-closes to "No broker connected" | **Accept** | Makes F3a independent of reachability; costs one line |

## 4. O2 (my C4)

Pinned: the 200-bet fixture asserts "+15.0%", a range entirely below it, "Evidence: strong" and "A long record, with no clear
pattern." Explained in the test comment, the log and the PR body's Known limits. Accepted as the logged default (arithmetic,
matching the profile). The rendered picture on both canvases is C4's PR 3 half, unchanged.

What the owner actually reads is the problem, so it must be in front of them verbatim (**B2**): the card prints "+15.0%
average return per trade" over "likely between −13.3% and +3.8%", a headline 11 points above the top of its own range. The
log's 10,000-close example is the other face: a 0.0% average next to "consistent losses". The PR body currently says only
"The tests pin a 200-bet example".

## 5. POLICY and COMPLIANCE §1

- **F3:** the disclaimer is a required field on every model, tested on every state. **Pass.**
- **F3a:** "Verified from broker" only for connected, all-verified, non-demo with closes; failed, importing, demo and `none`
  each carry their own badge; the caption "Return if every trade were the same size" is the profile's hypothetical, not a
  completeness claim. **Pass.**
- **F3b, F2:** evidence-only labels, scanned. **Pass.**
- **F4 / TR-9:** range from K = 5, losses mirrored, U+2212. **Pass.**
- **P3, P6:** percentages only; no symbol, time or holding period in the model (tested); the glyph guard keeps names off a
  font service. **Pass.**
- **T1:** the only names are integrated vendors used to locate a bundled file (Next.js's next/og, Vercel's bundled font path).
  Copy and comments describe the font service generically. **Pass.**
- **COMPLIANCE §1:** the PR body answers all 11 items under `## Compliance`, accurately. **Pass.**

## 6. Demands

- **B1 (alt text reads as one clean description; `recordCard`, about 4 lines).** Today: "Trading record card for @h on
  Stock Social: Verified from broker. Card Tester. @h. Verified from broker. average return per trade. +2.0%. … 0%. …".
  The badge and the handle are read twice, the label comes before its number, and "0%." is read alone. Change: skip the
  badge when the prefix already names it; read "+2.0% average return per trade"; drop the standalone "0%" (the chart
  sentence already says "Line from 0% to …"). The U14 test (every visible string contained) still passes; add one
  assertion that no sentence repeats.
- **B2 (O2 in the owner's words; test and PR body, about 3 lines).** Pin `vol.range` to its exact string
  ("likely between −13.3% and +3.8%") and quote the printed headline, range and trust line in `pr2-body.md` Known limits,
  plus the 10,000-close "0.0% … consistent losses" case if it reproduces.

## 7. Scorecard

| Dimension | Score | Evidence |
|---|---|---|
| Owner fidelity | 5 | every decision a tested field; the 10 cells verbatim |
| Trust and compliance | 5 | symmetric by test; badge never blank, Verified earned; disclaimer everywhere |
| Simplicity | 5 | +241 product lines against a 280–330 estimate; one model; no dependency |
| Craft (parts nobody sees) | 4 | the alt text (B1); 5 once fixed |
| Aesthetics | n/a | nothing rendered; PR 3 |

COMPLIANCE: PASS · USABILITY: DEMANDS (B1 alt text without repeats, number before label, no orphan "0%"; B2 pin the O2 range string and quote the printed O2 and 10,000-close strings in the PR body)

## Round 2

Date: 2026-10-25. Reviews the fix round `bcccf37..0921504` (`lib/record-card.ts`, `lib/copy.ts`, `lib/record-card.test.ts`
and its snapshot, the build log's "Fix round 1" table, `pr2-body.md`). Read-only: `node --test lib/record-card.test.ts
lib/card-glyphs.test.ts lib/copy.test.ts` 45/45 pass (the 4 new tests included), `npx tsc --noEmit` clean,
`node scripts/compliance.ts diff origin/main` ok. I printed the tall alt and the headline, range and trust strings for 7
fixtures (winning, losing, `none` with closes, demo, empty, a name outside the font, the 200-bet O2 record) and re-ran the
10,000-close fixture by hand. Nothing here is legal advice.

**Decision: accept. Both demands landed as written, and so did the tester's M1, M2, L1 and L2.**

| Item | Landed | Evidence |
|---|---|---|
| **B1** alt text | Yes | Printed: "Trading record card for @h on Stock Social. Card Tester. Verified from broker. +1.9% average return per trade. likely between +0.6% and +3.2%. 12 trades, losses included. …". The badge and the handle are each read once, the number comes before its label, and there is no lone "0%" (the chart sentence carries it). The display name is skipped when the name slot already shows `@handle`. U14 now asserts all of these per layout over 23 fixtures, plus no repeated sentence. The link is read only on the tall alt, which matches what that image draws |
| **B2** O2 in the owner's words | Yes | `vol.range` is pinned to "likely between −13.3% and +3.8%", and the trust line to "Based on 200 bets over 1 year. A long record, with no clear pattern." The UX lead's 1,000-bet case ("+2.5%" in up over "likely between −4.8% and −0.8%" and "…consistent losses") is also pinned. The PR body's Known limits quotes all three verbatim, the 10,000-close case included. The headline method is unchanged, so O2 stays the owner's decision, and I don't rule on it |
| **M2** alt follows the badge | Yes | The alt now uses the model's `badge.text`. The prefix carries no label. `none` with closes reads "No broker connected" in the image and in both alts, and the test asserts no "Verified" |
| **M1** "over 0 years" | Yes | Y = max(1, ⌊days / 365.25⌋). Tests at 365 and 365.1 days, and the tester's repro runs through `recordCard` |
| **L1 / L2** | Yes | Both bounds share the larger decimal count ("−0.10% and +0.04%"). An all −100% record reads "likely about −100.0%". The U7 single-bound rules are unchanged |
| L3, L4 | Not changed, per spec | Noted for the owner, as the tester asked |

The model stays one model. U-2's pieces are built from `SHARE_CARD` and join to the printed strings, and U-4's axis is the
printed period. Neither changes any owner wording. No test was deleted or loosened (662 → 666). Product lines are +284 / −3 (cap 800).

**One accuracy note (non-blocking; fold in before merge, no re-review needed).** The Known limits table says "each pinned by a
test", but the 10,000-trade row ("0.0%", "likely between −0.13% and −0.02%", "…with consistent losses.") is not asserted:
criterion 10 checks only points, count and time. I reproduced those exact strings with the test's seed, so the quote is
true. Either add the three `assert.equal`s to criterion 10 or change the wording to "the first two pinned by tests, the third reproduced".

**Carried to PR 3 (unchanged from round 1):** the C4 render of O2 on both canvases; the "19 months" vs "over 35 days"
read at 375 px; the K < 5 "range is still too wide" line on the render; N1's five-digit headline in D7.

| Dimension | Score | Evidence |
|---|---|---|
| Owner fidelity | 5 | no owner string changed; O2 in front of the owner verbatim |
| Trust and compliance | 5 | the alt can no longer say Verified when the badge doesn't (F3a); no "0 years" |
| Simplicity | 5 | +43 product lines for 9 fixes; one model |
| Craft (parts nobody sees) | 5 | the alt reads once, figure first |
| Aesthetics | n/a | nothing rendered; PR 3 |

COMPLIANCE: PASS · USABILITY: PASS

Ready to merge: yes
