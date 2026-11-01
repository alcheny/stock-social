# F-5 · Position size: showing the risk behind each trade

Status: blocked
Blocked: the data vendor's written permission for public position sizes, and counsel's sign-off (legal review of 2026-10-31).

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
- 2026-11-01: The record's headline and chart become account-weighted: each closed trade counts by its share of
  the connected accounts, so a 1%-of-account trade barely moves the line and a 40% trade moves it a lot. It is
  never called "account return" (only connected accounts count), and F-4's chart follows it. Why: the owner's
  choice; an equal-weight average hides the risk taken.
- 2026-11-01: The connected-accounts base counts cash; deposits and withdrawals are neutralised (time-weighted, as
  funds report returns); margin can push a share above 100% and is shown as is (e.g. "130% of connected
  accounts"); trades the vendor can't value are marked "not sized" and counted, never estimated. Why: the
  owner's choice of the standard method.
- 2026-11-01: Showing position size is a separate opt-in, off by default, with plain wording and an example of
  how one dollar figure posted elsewhere reveals the account's value. Existing traders keep percent-only until
  they turn it on; past trades are sized only after they opt in. A trader who hasn't opted in keeps today's
  equal-weight headline and chart. Why: the owner's choice; today's consent promises no amounts, and all three
  legal passes flagged a silent change as deceptive.
- 2026-11-01: Safeguards from the legal review, all required (the owner accepted each one):
  - nothing is built until the data vendor gives written permission for public position sizes (and for the
    open-position percentages already shown);
  - sizes are labelled "estimated" and sit outside "Verified"; an append-only log records what each record
    showed and when;
  - opt-in warnings for company insiders and registered representatives; the Terms ban adviser advertising,
    paid promotion and trading against one's displayed record; size is hidden for thinly traded, OTC or halted
    securities;
  - a trader can turn size off without deleting the record (an exception to the record-freeze rules TR-1 and
    TR-5); share cards already posted elsewhere can't be recalled, and the opt-in says so.
  Why: the owner's answer to the legal review of 2026-10-31.
- 2026-11-01: The owner confirmed F-5 is decided; it stays blocked until the data vendor's written permission
  and counsel's sign-off. Why: the owner's choice; the vendor permission is a hard gate the owner accepted.

## Acceptance criteria
To be written once the open questions are settled.

## Out of scope
- Real dollar amounts, balances or account values on any public surface.
- Ranking or sorting traders by position size.

## Open questions
- Owner rule changes these decisions need: POLICY P3 (a public share-of-account field) and DESIGN CH-1 (charts
  "never ... position size"); the owner amends both before the build.
- Counsel's sign-off before real users (the full legal review is the owner's private document of 2026-10-31).
- Found during the review, outside F-5: open-position percentages are computed from the vendor's prices, which
  its market-data clause may not allow publicly; and records can't show what they displayed on a past date.

## Rework notes
