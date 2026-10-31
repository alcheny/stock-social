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

## Acceptance criteria
To be written once the open questions are settled.

## Out of scope
- Real dollar amounts, balances or account values on any public surface.
- Ranking or sorting traders by position size.

## Open questions
- Precision: exact percentage of the account per trade, or bands (under 5% · 5–15% · 15–30% · over 30%).
- Whether the record's headline and chart also become account-weighted return (each trade counted by its
  share of the account), replacing today's equal-weight per-trade view.
- What "account" means: one account or all connected accounts, and how cash, margin, deposits and withdrawals
  are counted.
- Consent: a new line in the connect consent and a one-time re-consent of existing traders, or a separate
  opt-in.
- Legal review: the statutes and limits in the owner's review of 2026-10-31 (three independent passes), the
  data vendor's written permission to use balances, and counsel's sign-off before real users.
- The share card's chart (F-4 question A) waits on this feature's answers.

## Rework notes
