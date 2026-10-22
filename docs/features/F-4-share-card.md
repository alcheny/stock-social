# F-4 · Share card: simple first, the eye-catching elements

Status: rework

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

## Current card (built, for reference)
Three big numbers (win rate, average return per trade, trade count with "losses included"), name and
handle, the evidence label, the disclaimer. No chart.

## Acceptance criteria
Each one testable; the pipeline writes a test for every line.
- [ ] The card shows: the record's percent chart (single line, 0% on the axis, CH-1), the total number
      of closed trades, and the period ("Record since ‹month year› · ‹N› months"), plus name and handle.
- [ ] The card shows one headline figure, the average return per trade, with its range in words
      ("likely between −0.1% and +2.7%") once K ≥ 10, and no win rate.
- [ ] The card carries the evidence label and one plain-language trust line whose wording is chosen
      from a fixed table by evidence tier (thin / moderate / strong) and sign, tested for every cell;
      the words never describe skill, only the sample ("still early", "a solid sample", "a long record").
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
- Exact wording of the plain-language trust lines per tier (draft table to be reviewed by the owner).
- Later depth: which per-trade elements, and whether they appear on the record card or only on
  per-trade cards.

## Rework notes
- 2026-10-22: Owner wants the card to lead with chart, trade count and period; detail later.
