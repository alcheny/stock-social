# F-6 · Open positions in every number: realized and unrealized

Status: built

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
- 2026-11-01: Realized (closed trades) leads the headline; the unrealized grid sits directly beneath it at the same size (profile and feed pane). Why: decided by the committee under the owner's instruction of 2026-11-01; TR-4 asks for open positions as prominent as the headline, TR-9 keeps its range on the headline average, and a record without open positions keeps today's page.
- 2026-11-01: One combined figure, a single line: "Including open positions at current value: X avg / result (N results)"; no combined win rate. Why: decided by the committee under the owner's instruction of 2026-11-01; one number counting every result answers the sell-winners, hold-losers problem; an open position has not "won".
- 2026-11-01: Unrealized aggregate: each position counted once (one symbol in two accounts is two), up / down / flat by the printed sign, equal-weight average; up and down always printed. Why: decided by the committee under the owner's instruction of 2026-11-01; no amounts are stored (P3), and both counts keep losses visible.
- 2026-11-01: The chart stays closed trades only (CH-1) with a note under it naming what is not plotted. Why: decided by the committee under the owner's instruction of 2026-11-01; CH-1 Must.
- 2026-11-01: The 95% range (TR-9) stays closed trades only and says so in words; including open positions is a follow-up (Open questions). Why: decided by the committee under the owner's instruction of 2026-11-01; open_positions has no opened date, and the change moves feed ranking.
- 2026-11-01: Stock pages show open positions as an aggregate only, never who holds the stock. Why: decided by the committee under the owner's instruction of 2026-11-01; a live roster is a cue to act (POLICY F1/F3b).
- 2026-11-01: Feed card: one line "Also open: …" with counts and the average unrealized percent, no symbols. Why: decided by the committee under the owner's instruction of 2026-11-01; a card is about one close; the line keeps the open record in view.
- 2026-11-01: Positions show only for connected or failed records; the profile list says "as of" the oldest read. Why: decided by the committee under the owner's instruction of 2026-11-01; TR-3 and the existing consent rule.
- 2026-11-01: The disclaimer is the site footer on every page. Why: decided by the committee under the owner's instruction of 2026-11-01; F-1 precedent; asserted by e2e.
- 2026-11-01: The feed pane leads with the figures (realized, unrealized, combined) when the trader has open positions, then the chart. Why: decided by the committee under the owner's instruction of 2026-11-01; the pane is where most viewers meet a record (SW-1).
- 2026-11-01: The evidence line is scoped first ("Closed trades: …"), and the unrealized row is dated ("as of" the oldest read). Why: decided by the committee under the owner's instruction of 2026-11-01; no contradiction under a negative combined figure, and a stale read never reads as current.
- 2026-11-01: The share card images reflect open positions in the F-4 build, which reuses lib/open-split.ts; the F-6 PR covers every other surface. Why: decided by the committee under the owner's instruction of 2026-11-01; the F-4 session owns the card.
- 2026-11-02: OD 2.25 is overridden by the owner: real users' unrealized values keep showing publicly on every surface
  this feature shows them today. There is no "Open positions exist and aren't shown yet" line, no market-data gate and
  no dated TR-4 exception. The owner accepts the market-data risk; the question goes into the vendor letter (Appendix
  A, OD 2.24). One "Open" line across surfaces is F-34; withholding symbols on thinly traded names is deferred. Why:
  the owner's decision of 2026-11-02 (OD 2.25).
- 2026-11-02: The owner accepted OD 2.31 (a disconnected account's last positions shown, labelled "Last known ‹date›";
  F-40) and OD 2.34 (open positions in the TR-9 range; F-45). These resolve the follow-up and idea-board questions
  below. Why: the owner's decisions of 2026-11-02 (accepted en bloc).

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
- Resolved by the committee during the build (owner's instruction of 2026-11-01); record: docs/features/logs/F-6/committee-2026-11-01.md.
- Follow-up (own feature): include open positions in the 95% range (TR-9) at days held so far: needs an additive
  `open_positions.opened_at` (the earliest unmatched FIFO lot) and changes feed ranking, so it needs its own plan.
- Idea board 2026-11-01 (idea 9): add the market-data gate: unrealized values reach real users only after the
  vendor's written answer or a separately licensed price source (its terms bar redistributing market data). Chart:
  realized-only line with a labeled unrealized marker (fits CH-1); "Open: N positions · X% unrealized" beside each
  headline; "prices as of ‹time›"; image URL changes with the figure; per-security pages show aggregate counts only.
- Idea board 2026-11-01 (idea 9): owner's call: withhold the symbol on thin names or delay new positions, and one
  "Open" line instead of splitting every stat. The range has three definitions (TR-9, F-4, F-6); one rule must
  govern.

## Rework notes

## Build log
- 2026-11-01: Merged to main in #33 (0d42f65) by the orchestrator session; Status set to built (the pipeline sets it in its own PRs; interactive builds did not), so the feature pipeline does not pick it up as ready again. Waiting for the owner to try it.
