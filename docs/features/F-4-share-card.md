# F-4 · Share card: simple first, the eye-catching elements

Status: built

## Why
The share card (the image a profile link unfurls into, also used by the one-click Share button) is
the growth loop: 60% of connected traders sharing it is a week-8 gate. It should lead with the few
elements that catch the eye and travel, and leave detail for the profile.

## Decisions
- 2026-10-22: The card starts rudimentary: the overall chart, the total number of trades and the period
  of time the record covers. Why: the owner judges these the most eye-catching elements for virality.
- 2026-10-22: Per-trade detail (closing time, per-trade returns, holding period) is not on the card
  for now; how much of it to show is decided later, after seeing the simple card travel. Why: the
  owner wants to start simple and decide depth later.
- 2026-10-22: What stays regardless of layout: losses included, the "Verified"/"Demo" state, and the
  disclaimer "Not investment advice. Past performance does not guarantee future results." Why: POLICY
  F3, TR-1, Standing direction 2. (Not an owner choice; a standing rule, listed so the card can't lose it.)

- 2026-10-22: The simple card shows the chart, the trade count, the period and one headline figure, the
  average return per trade; win rate comes off. Why: the owner took the recommendation; the chart's
  end point already implies the return, so one number is enough.
- 2026-10-22: The evidence label stays on the card, and the card carries trust statistics that a
  person with no finance or statistics background can read. Why: the owner wants the share card to
  establish trust; TR-9 makes the evidence label a Must.
- 2026-10-22: Trust is shown two ways: the confidence range next to the average ("+1.3% per trade,
  likely between −0.1% and +2.7%") and one plain-language line that needs no education to read, for
  example "Based on 30 separate bets over 61 days. Still early." / "Based on 140 bets over 2 years.
  A solid sample." Why: the owner wants both the interval and something an average user understands.

- 2026-10-22: The confidence range is always shown, from the first closed trade, and widens as the
  sample thins; there is no flat count below which it is hidden. "Too early" is a model state, not a
  number: there are fewer than 5 independent bets, or the interval is wider than a width threshold
  recorded in the design record. At small samples the interval uses a t multiplier (K − 1 degrees of
  freedom) instead of a fixed 2 standard errors, so it widens on its own; a population-shrunk
  (Bayesian) estimate is the later upgrade, consistent with F-2. Why: the owner wants the display to
  follow the statistics rather than a hand-set cutoff; the width is the honest statement of how little
  is known. Note: this amends TR-9 in DESIGN §5.2 ("once K ≥ 10"), which the owner edits to match.

- 2026-10-22: The "too early" width threshold is a half-width of 10 percentage points per trade: while
  the range around the average is wider than ±10 points, the card says the range is too wide to say
  much. Why: the owner accepted the proposal; the threshold follows the trader's actual variance.
- 2026-10-22: Plain-language trust lines, approved by the owner:
  | Tier | Edge | Line |
  |---|---|---|
  | Too early | any | "Based on N trades. The range is still too wide to say much." |
  | Thin | positive | "Based on N separate bets over D days. Still early." |
  | Thin | unclear or negative | "Based on N separate bets over D days. Still early, and results could go either way." |
  | Moderate | positive | "Based on N bets over M months. A fair sample." |
  | Moderate | unclear or negative | "Based on N bets over M months. A fair sample, with no clear pattern yet." |
  | Strong | positive, interval entirely above 0 | "Based on N bets over Y years. A long, consistent record." |
  | Strong | unclear | "Based on N bets over Y years. A long record, with no clear pattern." |
  | Strong | negative, interval entirely below 0 | "Based on N bets over Y years. A long record, with consistent losses." |
  "Consistent" is used only in the strong tier and only when the interval lies entirely on one side of
  zero, and it is applied to losses exactly as to gains. It describes the pattern in the evidence, not
  the trader, which keeps it inside POLICY F3b (labels describe evidence, never skill or a future
  outcome) and outside the F2 banned list. Why: the owner wants "consistent" for strong performers and
  "a fair sample" for the moderate tier; symmetry and the evidence-only wording keep it compliant.
- 2026-10-22: The minimum for showing the range is 5 independent bets (the t multiplier at K = 5 is
  about 2.8). Why: the owner set the floor at five; below that the variance estimate is too unstable
  to mean anything even with the t correction.
- 2026-10-22: The owner confirmed F-4 is decided; it stays Status: rework (the card is built and is
  rebuilt to these decisions by the pipeline).

## Current card (built, for reference)
Three big numbers (win rate, average return per trade, trade count with "losses included"), name and
handle, the evidence label, the disclaimer. No chart.

## Acceptance criteria
Each one testable; the pipeline writes a test for every line.
- [ ] The card shows: the record's percent chart (single line, 0% on the axis, CH-1), the total number
      of closed trades, and the period ("Record since ‹month year› · ‹N› months"), plus name and handle.
- [ ] The card shows one headline figure, the average return per trade, with its range in words
      ("likely between −0.1% and +2.7%") whenever at least 5 independent bets exist, and no win rate;
      the multiplier is Student's t with K − 1 degrees of freedom (tested against a table at K = 5,
      10, 30, 100).
- [ ] "Too early" is shown when K < 5 or the interval's half-width exceeds the threshold in the design
      record; a test proves it is never triggered by a count alone.
- [ ] The card carries the evidence label and one plain-language trust line whose wording is chosen
      from a fixed table by evidence tier (thin / moderate / strong) and sign, tested for every cell;
      the words never describe skill, only the sample; "consistent" appears only in the strong tier with
      the interval entirely on one side of zero, for losses as for gains (tested for both signs).
- [ ] A reader test: the plain-language line uses no term from a banned list (confidence interval,
      standard error, p-value, alpha, Sharpe, edge, signal, skill).
- [ ] The card shows no per-trade rows, closing times or holding periods.
- [ ] A losing record renders with the same layout and prominence as a winning one; the line is in the
      down color when the record is negative.
- [ ] The disclaimer and the Verified or Demo state are present on every rendering, including the
      empty record ("No closed trades yet").
- [ ] The card renders at the share-image size used by the Share button and as the link unfurl image,
      and is readable at a 375px-wide preview.
- [ ] Tests: snapshot of the three states (winning, losing, empty), the period text at 0, 1 and many
      months, and a record with thousands of trades (chart downsampled, number formatted).

## Out of scope
- Per-trade cards (`/u/[handle]/trade`) keep their own design; this file is the record card.

## Open questions
- From committee round 1 (2026-10-26, `docs/features/logs/F-4/committee-round-1.md`), for the owner:
  - A. The chart series: compounded growth of equal stakes, or the running sum of per-trade returns; and the
    caption's wording either way. 2026-10-31: the owner finds equal-stake views misleading because they hide
    position size, and real dollars were set aside for privacy; this waits on F-5 (position size per trade),
    which may make the chart account-weighted.
  - B. Whether the range is built for the arithmetic mean, so the headline average always sits inside it (the
    4,200-trade fixture reads "+0.3%, likely between +0.1% and +0.3%").
  - C. The trust-line table: negative rows worded symmetrically with the positive ones, and the under-5-bets
    wording ("Too few to say much yet").
  - The link unfurl's chart is 23.7% of the card against the committee's 30%: reaching it needs one more element
    removed (for example the chart caption, or the handle that AC1 requires).
  - Win rate in the link-preview text under the card: keep or drop.
  - Ranking floor: stays at 10 bets unless changed.
  - A bundled font file (OFL) would need license sign-off; none is added now.
  - The period line's unit follows the trust line's tier (days when thin, years when strong) where AC1's example
    reads months.
- Later depth: which per-trade elements, and whether they appear on the record card or only on
  per-trade cards.

## Rework notes
- 2026-10-22: Owner wants the card to lead with chart, trade count and period; detail later.

## Build log
- 2026-10-26: Built to these decisions (record card for the unfurl and the Share button picture, 5-bet floor, ±10-point threshold, trust-line table); details, test results and open items in `docs/features/logs/F-4/build-engineer.md`.
