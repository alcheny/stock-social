# F-6 · Open positions in every number: realized and unrealized

Status: ready

## Why
A record that counts only closed trades lets a trader sell winners and hold losers, so realized numbers look
better than the account is doing. The owner wants every number to include outstanding positions, with the
account divided between realized and unrealized gains and losses.

## Decisions
- 2026-11-01: Records include outstanding (open) trades: the account is divided between realized gains and
  losses (closed trades) and unrealized gains and losses (open positions at their current value). Why: the
  owner's direction ("should include outstanding trades: divided account between realized and unrealized gains
  and losses").
- 2026-11-01: If a trader has open positions, all other information reflects them: the headline, the range,
  the chart, the evidence line, the share card, the feed card and the per-security pages show realized and
  unrealized side by side, and any combined figure says it includes open positions. Why: the owner's direction
  ("if there are outstanding positions, all other information should reflect them").
- 2026-11-01: Percent only, as everywhere: no quantities, prices or dollar amounts (POLICY P3). Unrealized
  values follow the existing open-positions data (symbol and unrealized percent). Position size stays with F-5.
  Why: the standing rules; the owner did not change them.
- 2026-11-01: How each surface shows the split (layout, wording, which combined figure is the headline) is
  decided by the committee in the build's plan debate, with losses shown like gains and the disclaimer on every
  performance surface. Why: the owner asked the committee to decide open questions with its recommended
  option.

## Acceptance criteria
- [ ] Every surface that shows a trader's performance (profile headline and stats, chart, feed card and pane,
      share card at every size, per-security pages) shows realized and unrealized results separately when the
      trader has open positions, and says so in words, not color alone.
- [ ] A combined figure, where one is shown, is labelled as including open positions at current value.
- [ ] A trader with no open positions sees exactly today's realized-only numbers.
- [ ] Unrealized losses are shown as prominently as unrealized gains (TR-4); a record whose open positions are
      all losing shows them in the down color with their percent.
- [ ] Open positions keep symbol and unrealized percent only; no quantities, prices, amounts or sizes.
- [ ] Unit tests for the split on: no open positions, all winning, all losing, mixed, a record with open
      positions and no closes; e2e covers the profile, a feed card and the share card.
- [ ] Every performance surface carries "Not investment advice. Past performance does not guarantee future
      results."

## Out of scope
- Position size (F-5) and dollar amounts.

## Open questions
- Resolved by the committee during the build (owner's instruction of 2026-11-01).

## Rework notes
