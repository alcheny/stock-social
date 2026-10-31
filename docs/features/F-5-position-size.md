# F-5 · Position size: showing the risk behind each trade

Status: draft

## Why
Percent returns alone hide the risk a trader took: a +50% trade on a $1 bet and a +50% trade with the whole
account look the same. The owner wants records to show how much of the account each trade put at risk, without
publishing anyone's dollar amounts.

## Decisions
- 2026-10-31: Each trade on a record shows its position size: the share of the trader's account the trade
  used. Why: the owner's view that percentages without size are misleading ("how else are you supposed to know
  how much risk they took if they're taking 1 dollar size bets?").
- 2026-10-31: No real dollar amounts are published (POLICY P3 stays). Why: the owner chose sizing as a share of
  the account after reviewing the privacy and legal concerns of showing real dollars, even opt-in.
- 2026-10-31: Position size is shown as an exact percentage of the account (e.g. "23.4% of account"), not in
  bands. Why: the owner's choice after the legal review; the owner accepts the risk all three passes flagged,
  that an exact share plus one dollar figure the trader reveals elsewhere gives away the account's value, so
  the consent screen must explain that risk with an example.
- 2026-10-31: Size is shown on closed trades only. Open positions keep their symbol and unrealized percent,
  without size. Why: the owner's choice; a live size on an open position is the core tool in scalping and
  pump-and-dump cases, the strongest finding in all three legal passes.
- 2026-10-31: A trade's size is its share of all the trader's connected accounts, valued at the trade's entry,
  labelled "of connected accounts at entry". Why: the owner's choice; a small dedicated account can't make every
  trade look like 100%, and the label states exactly what is measured.

## Acceptance criteria
To be written once the open questions are settled.

## Out of scope
- Real dollar amounts, balances or account values on any public surface.
- Ranking or sorting traders by position size.

## Open questions
- Whether the record's headline and chart also become account-weighted return (each trade counted by its
  share of the account), replacing today's equal-weight per-trade view.
- How cash, margin (a share above 100%), deposits and withdrawals are counted in the connected-accounts base.
- Consent: a new line in the connect consent and a one-time re-consent of existing traders, or a separate
  opt-in.
- Legal review (2026-10-31, three independent passes: law by law, data lifecycle, misuse and enforcement; the
  full review is the owner's private document). Limits all three found, for the owner to confirm:
  - bands rather than exact percentages: decided otherwise (exact %, 2026-10-31);
  - size on closed trades only (decided 2026-10-31); never in alerts, feed ranking, discovery or a paid tier;
  - the data vendor's written permission (re-packaging and market-data clauses) before any build;
  - a separate opt-in from every trader, no backfill without it (current consent promises no amounts);
  - labelled an estimate of connected accounts at entry, outside "Verified"; unsizable trades excluded and
    counted;
  - store the band, never balances; an append-only display log of what was shown;
  - insider and registered-representative warnings; Terms ban adviser advertising and paid promotion; size
    hidden for thinly traded, OTC or halted securities;
  - owner rule changes: POLICY P3, DESIGN CH-1, and a size-only withdrawal exception to TR-1/TR-5.
- Found during the review, outside F-5: open-position percentages are computed from the vendor's prices, which
  its market-data clause may not allow publicly; and records can't show what they displayed on a past date.
- The share card's chart (F-4 question A) waits on this feature's answers.

## Rework notes
