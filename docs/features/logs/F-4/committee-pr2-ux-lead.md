# F-4 PR 2 · Committee · UX lead

Date: 2026-10-25. Build under review: `dab09f7..c7aee59` on `autopilot/feature-4-card-model` (worktree
`agent-af2a9d77f0b6999cf`): `lib/record-card.ts`, `lib/card-glyphs.ts`, the `SHARE_CARD` additions in `lib/copy.ts`,
and their tests. I judged the model as the source of everything PR 3 will draw. I checked it against:
- the owner's decisions in the main tree's `docs/features/F-4-share-card.md`, including the 2026-10-24 negative rows;
- `plan.md` PR-2 and its O1 amendment;
- my round 1 (U1 to U15, D1 to D6) and my sign-off (changes 1 to 7, D7);
- POLICY F2, F3, F3a, F3b, F4 and A1, and DESIGN CH-1.

Nothing here is legal advice.

## Method

- **Tests.** `node --test lib/record-card.test.ts lib/card-glyphs.test.ts lib/copy.test.ts`: 41 pass, 0 fail (Node 24).
- **Probe.** A throwaway script in the session scratchpad ran `recordCard` on edge fixtures:
  - every state;
  - K = 1 and K = 3;
  - a tiny negative average;
  - alternating high-spread records at K = 60, 98, 200 and 1,000;
  - an unverified connected record;
  - 12 hostile and accented names.
- **Widths.** A second throwaway script measured advance widths from next/og's bundled Geist Regular (`cmap` +
  `hmtx`). It reproduces my sign-off figures: the disclaimer at 1,114 px, and the wide period's longest form at
  653 to 658 px. Kerning is ignored.
- No repo file was touched other than this one. No server was run.

## Verdicts on the points I was asked to judge

| Point | Verdict | Evidence |
|---|---|---|
| **Tall count 47 px, not 46** | **Right** | 46 × 375 / 1080 = 15.97 CSS px, under the 16 px count floor that my sign-off raised from 13. 47 gives 16.3. It stays below the name (52) and above the range (38), so the order of sizes is kept. "123,456 trades · losses included" at 47 px is 694 of 952 px |
| Other scale entries | Right | Every entry clears its floor at 375: wide 33.8 / 16.3 / 16.3 / 11.3 / 11.3 / 10.6 / 10.0; tall 45.8 / 18.1 / 16.3 / 13.2 / 13.2 / 12.5 / 10.4. Trust is at the low end of its range and range/period at the high end, as the plan allows. Tested (U2) |
| **D7: headline in `pct()`** | Right (change 3) | Same number as the profile, U+2212, and "0.0%" in text colour. Widest realistic value: "+1234.5%" = 477 of 480 px at 108. **Note N1** covers five integer digits |
| D7: range bounds | Right | `cardPct` only on bounds. Widest pair: "≈−100.0% and +1234.5%" = 398 of 480 px (wide, second line). The tall one-liner is 717 of 952 px |
| **D7: period wraps at " · "** | Copy right; shape not yet (**demand U-2**) | The whole string "Record since Sep 2026 · under a month" is 658 of 620 px. Each piece fits: 396 px and 259 px. But the model returns one string, so PR 3 would have to split copy to make the wrap. The same applies to the wide range's two lines |
| Other single-line slots | Fit | Badge ≤ 315 px, pill ≤ 296 px, caption 602 of 620 px (wide) and 565 px (tall), count 52 px "123,456 trades" 359 of 480 px, disclaimer 1,114 of 1,120 px |
| **Down #fb7185** | Right | Contrast against up within 1.5, every token ≥ 4.5:1, line and "0%" over the 16% tint ≥ 4.5:1. All computed in the tests (U12, C6) |
| **True minus** | Right | `signed()` swaps pct's single hyphen-minus, including "≈−100.0%". It is used for the headline, every bound and the alt text's chart sentence. Tested: no hyphen-minus before a digit |
| **Nonzero bound never "0.0%"** | Right (U7) | "0.0%" only for an exact 0. −4e-7 prints "−0.0000%", so the side stays visible. Direction is read from exact values, so a bound printed with its sign can't disagree with the line |
| **Too early keeps the range's space empty** | Model right; the height is PR 3's (U9) | K < 5 gives `range: null` and keeps the headline, pill and line. When too early by width, the range is kept. The model has no layout height, so U9's equal-height test belongs in PR 3, as planned |
| **Empty: "No closed trades yet"** | Right | Exact string, plus "The record starts with the first closed trade.". No headline, chart, count, period, pill or trust line. Name, handle, badge and disclaimer are kept. Badges: connected "Broker connected" (up), `none` "No broker connected" (muted), failed "Import did not finish" (warn), demo "Demo data" |
| **"No broker connected"** | Right | Also covers `none` with closes, which is unreachable today, so "Verified" can't appear there by accident (F3a) |
| **NFC and the `@handle` fallback** | Right (change 5) | NFD "José" draws as "José". Cyrillic, Polish, Vietnamese, Spanish and Turkish names draw. Fall back to `@handle` with no repeated handle row: blank, a tab, a zero-width space, CJK, Arabic, emoji, "✓ Maya". A bidi override is also uncovered, so it falls back. The name is never partly drawn |
| **Alt text** | Complete; order and repeats need work (**demand U-3**) | It holds every visible string and the chart sentence (U14). As built it reads: "…on Stock Social: Verified from broker. Probe. @probe. Verified from broker. average return per trade. +4.7%. … 0%. Return if every …" |
| **Losses with the same weight** | Right in every case but one (**U-1**) | The mirrored losing record equals the winning one except for colours, signs and the table cell. The trust table matches the owner's 10 cells word for word. "Consistent" is symmetric |

## Demands

**U-1. Pin, as a test fixture, the card that praises a losing record, and flag it to the owner before PR 3.**
- **The fixture.** 1,000 bets alternating −30% and +35% over 400 days.
- **What the model prints:**
  - a headline "+2.5%" in **up** (green);
  - "average return per trade";
  - "likely between −4.8% and −0.8%";
  - "Based on 1,000 bets over 1 year. A long record, with consistent losses.";
  - a chart line in down that ends at "≈−100.0%".
- **What a reader sees.** The biggest, greenest thing on a losing record is a gain, and the sentence under it says
  the opposite.
- **Why it happens.** This is O2: the headline is the arithmetic average and the range is centred on the geometric
  one. Since the owner's O1 rows (2026-10-24), the words now name the loss outright. The old "no clear pattern" left
  the conflict implicit; "consistent losses" makes it explicit. Strong tier is where it lands. In the thin and
  moderate tiers the 10-point width cap almost always turns such a record into "too early".
- **When it happens.** Per-trade spread above about 2t/√K: roughly 40% at 100 bets, 12% at 1,000 bets and 4% at
  10,000. Those are heavy, volatile traders, who are the ones most likely to share.
- **What I am asking.** No change to any decision. The engineer adds the fixture above, with its exact strings, to the
  O2 tester fixtures (the existing O2 fixture only reaches "no clear pattern"). It goes to the owner with this
  question: O2 must be answered **before PR 3 merges**, not only "before real users". PR 3 is the first build that
  puts this card on public unfurls.
- **My recommendation to the owner (owner's choice):** headline the same quantity the range is built on, its centre,
  so the figure, its range, the trust line and the line's direction can't disagree. F4 and F2 ("misleading
  performance language") are the grounds.

**U-2. Make the model return the planned wraps as pieces, so the renderer never splits copy.**
- **Period.** Add `periodParts: [since, span]`, for example ["Record since Sep 2026", "· under a month"].
  - The wide card's full string is 658 of 620 px, so change 2 wraps it at " · ".
  - The pieces must come from `SHARE_CARD`, not from `period.split(' · ')` in the renderer.
- **Range.** Add `rangeParts: [lead, bounds]`, for example ["likely between", "−0.1% and +2.7%"], for the wide card's
  two lines (round 1 §3).
- **Keep.** `period` and `range` stay as the joined strings for `cardStrings`, the alt text and the scans.
- **Test.** Joining each pair gives the existing string exactly.
- It is a few lines, and it keeps the copy in `lib/copy.ts`, where the scans read it.

**U-3. Alt text: state the figure, not the label, first, and drop the repeats.**
1. Use `profileCardAlt` without the label, since the badge follows in the body. Today "Verified from broker" is read
   twice.
2. Read the headline as "+4.7% average return per trade", not "average return per trade. +4.7%".
3. Leave out the lone "0%". The chart sentence already says "Line from 0% to …".
4. Order:
   - name and handle, badge;
   - figure, range;
   - count and "losses included", period;
   - pill and trust line;
   - chart sentence and caption;
   - disclaimer;
   - the link on the tall image only.
   Some unfurl consumers cut image alt text at around 420 characters, and the probe's alt is 496. With this order a
   cut loses the least.
5. U14 still holds: every visible string is still in the alt text. The test needs to allow for the reordered headline.

**U-4. Draw the chart across the period it is labelled with.**
- **The problem.** The chart's x-axis runs from the first close to the last close (`chartSeries` 'ALL'). The period
  runs from the first entry to now, or to the disconnect. On wide, the period is printed under the chart because it
  labels the axis (round 1 §3).
- **Example.** The committed snapshot reads "Record since Mar 2025 · 19 months" under a line that covers 17 days, and
  "Based on 6 separate bets over 17 days" beside it. A viewer reads 19 months of trading. That overstates how much
  the record shows, and it is the opposite of TR-5's frozen-record honesty.
- **The fix, model only.**
  - Use the period's start and end as the geometry's x-domain.
  - Put the 0% point at the first entry.
  - Hold the last value flat to the period's end. CH-1 steps only at closes, so a flat stretch is "no closes", which
    is true.
- **Test.** For a record that stopped a year ago, the last x is the plot's right edge and the last segment is
  horizontal.
- **Alternative.** If the engineer prefers not to touch the geometry, the period moves off the axis in PR 3. That is a
  layout change the committee would have to agree. I prefer the fix.

## Notes (not blocking)

- **N1. Headline with five integer digits.** "+12345.6%" is 541 px against the 480 px column at 108 px. An average
  per trade of +10,000% or more is unlikely, since F3c excludes trades the importer can't price, but nothing caps it.
  PR 3's D7 should add it as a fixture and say what the row does (for example, the headline row spans the full width
  above the chart). Text never shrinks.
- **N2. "Broker connected" in up for a connected record with closes that aren't all verified.** It follows the plan
  and is unreachable today. If it ever becomes reachable, muted is safer: in green, the badge sits in the Verified slot
  and could be read as Verified.
- **N3, for the owner (wording is theirs).** At K < 5 the card shows no range, yet the owner's line says "The range is
  still too wide to say much." It is true (too wide to show) but refers to something the reader can't see. One option:
  "Based on N trades. Too few to show a range yet." Not a demand.
- **N4.** "losses included" also prints on a record with no losses. It means the count hides none. That is the
  standing phrase, so I leave it.

## Compliance (UX view)

- **F3.** The disclaimer is in every state's model and is typed to the literal.
- **F3a.** "Verified from broker" appears only for connected, all verified, non-demo, with closes. It is tested across
  every state, and `none` is guarded.
- **F3b, F2.** Every cell and string is scanned. "Edge", "skill", "signal", "95%" and "confidence" are absent.
  "Consistent" describes the evidence, for both signs.
- **F4.** Losing parity is tested, with the down colour at equal luminance and U+2212. The exception is U-1, which is
  an owner question (O2). It cannot reach a viewer until PR 3 draws the model, so it does not fail this PR. It must be
  answered or handled before PR 3 merges.
- **P6 / D1.** The glyph constant equals the font's cmap, and every model string is covered.
- **A1.** There is a sign in text on every number and contrast is computed. The alt text is complete (order: U-3).
- **Data.** No per-trade field, percentages only, no new data.

COMPLIANCE: PASS · USABILITY: DEMANDS (U-1 pin the green-headline "consistent losses" fixture and send O2 to the owner as blocking PR 3; U-2 period and range as model pieces for the planned wraps; U-3 alt text figure-first, no repeated badge or lone "0%"; U-4 chart x-domain equals the printed period, flat after the last close)
