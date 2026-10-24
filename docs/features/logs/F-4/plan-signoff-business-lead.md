# F-4 · Plan sign-off · Business lead

Date: 2026-10-24. Reviews `plan.md` (engineer-merged) and `plan-round1-engineer.md` against the F-4 file, POLICY,
COMPLIANCE §1, DESIGN CH-1 and TR-9, IMPLEMENTATION step 1 and my round 1 (`plan-round1-business-lead.md`).
Also read for the `lib/feed.reach.test.ts:41` ruling: `lib/discovery/section.ts:91-112`, `lib/discovery/section.test.ts:185-200`,
`lib/feed.ts:108,231,256`, `lib/trades.ts:257,305-311` (line numbers are from the working tree, which carries
uncommitted F-2 PR-4 edits; at HEAD the slot guard is `section.ts:104` and the score `feed.ts:106`). This decides how,
never what. Nothing here is legal advice.

**Decision: sign, with seven small changes (C1 to C7 below).** Strongest reason: the plan delivers every round-1 demand,
the 3-PR split is better than mine, and none of the changes needs another debate round.

**Demo sentence (unchanged):** "Every trader's link unfurls into their real percent line from 0%, how many trades and how
long it covers, and one number with an honest range, losses included."

What's exceptional, and why: the engineer found D1 by measuring it. Today a display name or thesis can be sent to a
third-party font service while the card renders (POLICY P6), and an emoji can crash the card. The fix adds no
dependency, and the cmap test fails on a Next upgrade instead of silently fetching again. The list of 7 changed tests
comes from running the suite, not from guessing. That is the standard.

## 1. My round-1 demands

| Demand | Verdict | Evidence |
|---|---|---|
| Eng 1: SVG and glyphs render in next/og | Accept | engineer §2: pixel values for path, dasharray, gradient, clip, ellipsis; `·` `…` `−` covered, `✓` not |
| Eng 2: line estimates and the tests that change with 10 → 5 | Accept | engineer §6, §7: 7 tests, each tied to the owner's floor decision; none deleted or loosened |
| Eng 3: is the no-label state reachable; when a frozen record's period ends | Accept | reachable for an empty `none` record (engineer §5); badge "No broker connected" / "Broker connected", never Verified (F3a); period ends at the latest `disconnected_at` (TR-5) |
| Eng 4: render time and PNG size at 10,000 closes | Accept | 100–130 ms warm, 282 ms cold, 119–142 KB, against ≤ 1 s and ≤ 300 KB |
| UX 1–3: sizes, empty and none wording, label placement | Accept, with C2 for the tall label | UX round 1 §2, §3, §7 |
| Tester: §8 fixtures plus the extra five; screenshots at 375 | Accept | plan PR-2 tester fixtures; D6 |
| Reviewer: PR 1 fails on "edge" or "of 10" anywhere, or on a too-early-by-width record with no range; PR 2/3 fail on two models, a size below the floor, or a state with no disclaimer or badge; reading the diff is not enough | Accept | PR-1 banned-string scan; PR-3 "one model" source test, U2/D3, U10/U11 matrix, D6 |
| Cuts: win rate, worst trade, New record pill, "95%", wordmark, link line on the unfurl, dots, end label, ticks | Accept | plan §3 "Cut" row |
| One muted color (#a1a1ad, not my #8b8b98) | Accept | the correction is right; 7.69:1 leaves room for downscaling |
| "average return per trade" instead of my "per trade" | Accept | the criterion's own words; fits at 32 px |

## 2. Disputed points

| Point | Verdict | Reason |
|---|---|---|
| **3 PRs, not 2** | **Accept, with C7** | Better than my split: with my 2 PRs, O1 would have held back an app-wide TR-9 change, and my PR 2 estimate left out the deletions the Gate counts (700–850 lines, too close to the 800 cap). C7 makes sure the split doesn't add waiting time |
| **Trade count 52 px on wide** | **Accept** | Measured with the longest content: about 40 px to spare and a clean margin band. If the band test fails, the count moves under the chart and never shrinks. Keeps primary text ≥ 16 CSS px at 375 with no exception |
| **Area tint kept** | **Accept with change (C6)** | "CH-1 Look specifies it" carries no weight: the same Look line also asks for a neutral line, a dot per close and an end-value label, and the plan rightly drops all three. Nothing in a CH-1 Must requires the tint or forbids it, so it's a taste call. It must earn its place on the rendered 375 px winning and losing cards side by side in PR 3's committee; otherwise it's cut. The engineer has already agreed to re-sign if that happens. Symmetric by construction, so no compliance risk |
| **Period under the chart (wide), under the count (tall)** | **Accept** | It labels the x-axis span and frees the row the 52 px count needs |
| **Evidence label: a pill leading the trust line** | **Accept on wide; change on tall (C2)** | TR-9 Share card Must: "the evidence label next to the headline numbers". On wide, the pill starts the row directly under the headline column. On tall, the chart, caption, count and period sit between the headline and the pill, so cropping the square to its top half loses the label. The plan cites this Must as its reason and then doesn't meet it on tall |
| **The word "range" banned on the card** (plan PR-2, Range bullet) | **Reject (C1)** | It contradicts the owner's approved too-early line, "The range is still too wide to say much." A test written to that rule would either fail or push someone to edit the owner's copy. The error started in my round 1 §3; I'm correcting it here |

## 3. Ruling: `lib/feed.reach.test.ts:41` (PR-1b acceptance)

**Premise.** The test treats "newcomers with 5 or 6 closes" as records with no evidence weight. That was true only
while the floor was 10 bets. Under the owner's 5-bet floor, a newcomer whose 5 closes cluster narrowly can get a small
positive weight (engineer: 0.028). The slot then skips it (`section.ts:106`, `t.weight > 0`), and it is too weak to
win a row on weight. **This is a product regression, not a test artefact:** the newest records lose visibility exactly
when their first few trades agree. The slot's own comment says it exists for "the newest record". Weight 0 was only a
stand-in for "newest", and the owner's floor change broke it.

**Rejected: restoring the premise with too-early-by-width newcomers (±40% returns).** Card scores grow with return
size (`feed.ts:108`, `ln(1 + |r|·100)`), so that fixture tests a different feed. The failure moving to "seed 0 page 3"
is consistent with that. A fixture changed until it passes isn't evidence.

**Rejected: the slot reads "tier too early" instead of "weight 0".** It is narrower than today. The fixture's own
newcomers (5–6 closes, ±10%: half-width ≈ 7 points) are tier thin, not too early, so they would lose the slot too.

**Ruling (in PR 1, C3):** a record can take the slot when its weight is 0 **or its tier is thin**. Too early already
implies weight 0. Moderate and strong records with weight keep competing on weight alone. The selection order is
unchanged (no earlier section, then fewest closes, then pref, then id). So is the display order: `chooseRows` sorts by
evidence, so the section's "Ordered by how much evidence each record has" stays true. The reach test's fixture and
assertion stay byte-identical. Every existing `section.test.ts` slot test stays valid, because fixtures without a tier
behave as today.

## 4. Owner questions and defaults

| Item | Verdict | Note |
|---|---|---|
| **O1** (negative range beside "could go either way" / "no clear pattern") | **Accept: blocks PR 2's merge only; build default is the owner's table as written** | Hard stop 5 scoped to the PR that holds the copy. My recommendation stands (positive and negative share the plain line; the hedge stays for unclear only). Either answer changes one constant |
| **O2** (arithmetic headline vs geometric range center) | **Accept, with C4** | Default: arithmetic, matching the profile. A different number on the card than on the profile would be worse. It is not rare (spread ≳ 12% at 1,000 bets), so the owner has to see it as a picture, not just read about it |
| **O3** (too-early line counts trades, not bets) | **Accept** | Default: as written. My recommendation stands: "Based on N trades in K separate bets." |
| Engineering defaults: direction from the per-trade interval; "count alone" means the trade count; frozen period end; D ≥ 1; `@handle` fallback; constants in `lib/trades.ts` | **Accept, all** | Each matches my round-1 Q2/Q3 or a demand. None changes a decision |
| Owner doc fixes (IMPLEMENTATION conflict 8 path; TR-9 "Edge:" display line) | **Accept** | Not blocking; POLICY F3b wins in the meantime |
| **P1** (wider self-hosted font) | **Accept as optional; I recommend the owner declines for now** | No evidence either way that target traders use non-Latin display names (tier: none). It adds a font asset and bundle weight. The `@handle` fallback is honest and predictable |
| #9 (running preview) | Accept | Until then: `npm run start` plus screenshots at full size and at 375 px |
| §9 follow-up (trade and month cards fetch fonts) | **Accept, with C5** | It's a live POLICY P6 defect, not a backlog idea |

## 5. Changes the engineer applies as written

- **C1 (PR 2, Range bullet).** Replace `"95%", "range" and "confidence" never appear on the card.` with `"95%" and
  "confidence" never appear on the card; "range" appears only in the owner's too-early trust line.` Test: across all
  fixtures, no card string except that line contains the word "range".
- **C2 (PR 3, tall layout only).**
  - **Move:** on the tall card, the evidence pill moves from the trust row to the headline-label row, right after
    "average return per trade". Same row, 30 px, 24 px gap. The tall trust row becomes the sentence alone. Wide is
    unchanged.
  - **Fallback:** if the measured row doesn't fit 952 px, the pill takes its own row directly under the range,
    above the chart.
  - **Test (element tree):** on tall, the pill sits in the same row as the headline label (or, in the fallback, the
    row right after the range); on wide, the pill is the first child of the row right after the headline column. The
    D2 band test covers the fit.
  - **Plan §3:** the "Evidence label" row is updated to match.
- **C3 (PR 1).**
  - **Code:** `TraderFacts` gains `tier?: Tier`, set in `lib/feed.ts` `weights()` from the same `confidence()` call
    (no new query). In `newRecordSlot`, `t.weight > 0` becomes `t.weight > 0 && t.tier !== 'thin'`. The slot comment
    is updated to say "the newest record: weight 0 or tier thin".
  - **New test (`section.test.ts`):** a verified thin record with weight 0.03 and 5 closes takes the slot over a
    weight-0 record with 30 closes. A record without a tier and with weight > 0 never takes it.
  - **Reach test:** `lib/feed.reach.test.ts` is unchanged and passes. If it still fails, the engineer logs the root
    cause and brings it to PR 1's committee. No fixture or assertion edit without a ruling.
- **C4 (PR 3).** The QA log includes the O2 fixture (headline outside its own range) rendered on both canvases. PR 3's
  body lists it under known limits.
- **C5 (plan §9).** Replace "Follow-up outside F-4, for the owner's backlog" with "POLICY P6 defect live today (display
  names and thesis text can reach a font service; an emoji crashes the card). A fix, not a product change: the first
  fix after PR 2 merges, reusing `lib/card-glyphs.ts`."
- **C6 (PR 2 U12 and PR 3 committee).**
  - **Contrast (U12):** add computed contrast ≥ 4.5:1 for the up line over the up tint, the down line over the down
    tint, and the "0%" label over each tint. Tints are composited at 16% on #0b0b0f.
  - **Committee:** PR 3's committee keeps or cuts the tint on the side-by-side 375 px winning and losing renders.
- **C7 (§1 table).** "Waits on PR 1" / "Waits on PR 2" means the next PR is built on the previous branch once its tests
  pass, not after its merge. Only merges are sequential, and PR 2's merge also waits on O1.

## 6. Scorecard (the plan with C1–C7)

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Unchanged from round 1 §13: shareable performance cards are common (competitor behavior); a whole record with losses has no direct equivalent found (inferred) |
| Ease of adoption | 5 | Zero new steps: same Share button, same link |
| Phase fit | 5 | The share loop behind the week-8 "60% share" gate |
| Revenue impact | 3 | Indirect (reach that brings in supply); unchanged |
| Aesthetics and clarity | 4 | One hero, one figure, a measured type scale; 5 only on the 375 px renders |
| Trust and compliance | 5 | Disclaimer in plain view at 375 for the first time; label next to the headline (C2); zero third-party requests (D1); symmetric losses, by test |
| Simplicity | 4 | Two card models become one; about 190 lines deleted; no dependency; C3 adds about 5 lines instead of a fixture rewrite |
| Craft and taste | n/a | Nothing rendered yet; judged at PR 3 |

## 7. What would change my mind

- PR 3's 375 px renders show the tall headline row crowded by the pill: then the C2 fallback (its own row under the
  range) applies, never a position below the chart.
- C3 makes the slot pick an ordinary thin trader ahead of an unseen newcomer in the reach run: then the slot's order
  is the problem, not its eligibility, and it comes back to me with the root cause.
- The "would you post this?" test (round 1 §14) shows too-early or losing traders refusing: data for the owner, card
  unchanged meanwhile.

SIGNED
