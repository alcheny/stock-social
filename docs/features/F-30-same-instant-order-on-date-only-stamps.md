# F-30 · Same-instant order on date-only stamps: count, never invent a trade

Status: draft
Blocked: lapsed at approval council cycle 5 (draft); see the dated lapse decision
Start conditions: the owner answers Q1(a) yes (`docs/direction/cycle4-2026-11-01.md` §7). It shares the matcher slot
and builder with F-28 (same function, `lib/trades.ts` replay). The rule here reads F-28's pending-cover count as
evidence, so build it with F-28 or after it.

## Why
F3-5 sorts buys before sells at the same instant (`lib/trades.ts:84`, `:88` at e6731d5), reasoning that a long-only
ledger fills a sell from shares held (`:55-58`). The vendor's SDK says some brokerages send only the date. On those,
a fictional same-day short (SELL @15, BUY @14) is published as +7.1% Verified over 0 days. Selling pre-history shares and
rebuying them the same day publishes a day trade that never happened. Council cycle 4 brief C4-1 (rank 2). Approved
by the approval council (`docs/ideas/approval-2026-11-01-cycle4.md`: second-vote mean 3.87, final vote 15/15, all
with conditions, narrowed by the red team's probe C).

## Decisions
- 2026-11-01: A same-day long round trip with no older lots stays published under F3-5. Only when the pair shows
  evidence that the sell may not be a long close is the sell counted and the same-instant lot tainted. Evidence means an
  earlier oversell or F-28's pending cover, an `unknownFrom` pair (F3-1), or a broker position above the ledger. Why:
  approved by the approval council (cycle 4); red team probe C showed that counting every same-day round trip lets a
  trader on a date-only broker close losers the same day (counted) and hold winners overnight (published): a 50% win
  rate and 0% average become 100% and +3% (veto condition: CS, LG, DK; no rule the trader can steer by choosing when to
  close).
- 2026-11-01: Scope: only rows whose stamp is exactly 00:00:00Z (the option matcher's date-only convention,
  `lib/options.ts:103`). The rule widens per broker only on the vendor's written per-brokerage answer. Intraday rows keep
  F3-5 unchanged. Offset-midnight rows and mixed date-only and intraday pairs on one day are named in a ponytail as
  known limits. Why: approved by the approval council (cycle 4); XR-A's scope in the cycle-4 audit; RE (veto condition:
  LG, widening only on the written answer).
- 2026-11-01: F3-5's pinned test (`lib/trades.test.ts:211`) is rewritten for the date-only case only after the owner's
  yes. An intraday twin keeps the F3-5 expectation, no test is removed and the test count does not drop. The PR records
  this as a partial reversal of the F3-5 committee ruling. Why: approved by the approval council (cycle 4) (veto
  condition: DK).
- 2026-11-01: The readout gains a counts-only class count, with no ids, of same-instant open-and-close events by stamp
  pattern (00:00:00Z, other whole hours, intraday). It sits under F-31's limits block and is suppressed under 5. The
  owner can then see whether date-only stamps also arrive at local midnight. Why: approved by the approval council
  (cycle 4); RT, EN, RE, GR.
- 2026-11-01: The PR states plainly that a same-day short with no evidence still publishes (the residual case), and
  that counted sells reach the profile's existing exclusion line with the /how reason one tap away. Why: approved by the
  approval council (cycle 4); CS, UX.
- 2026-11-01: Sequencing and lapse: blocked until the owner answers Q1(a). It builds with F-28. If the owner has not
  answered by the next approval council (cycle 5), this approval lapses to that council. Why: approved by the approval
  council (cycle 4); lapse rule.

- 2026-11-01: Lapsed at approval council cycle 5: the owner had not answered OD 2.26 (cycle-4 Q1(a)). It was voted
  again and not re-approved: round-3 mean 2.07 (`docs/ideas/approval-2026-11-01-cycle5.md`). Most of it is on main
  through #89: with evidence of an earlier oversell, every later sell of the pair is counted (RT's probes). What
  remains is (1) broker-position evidence, which needs the protected `lib/broker.ts` and stored units, so it goes to the
  owner; and (2) a counts-only readout row of stamp patterns (suppressed under 5), which goes to the chore lane. A
  same-day short with no evidence still publishes, as this file accepted. The file and every decision above are kept
  word for word. Why: approval council cycle 5; lapse rule; RT, TE, EN, VW.
- 2026-11-02: The owner accepted OD 2.26 as recommended. Council cycle 5 found it mostly on main through #89, so this
  feature stays `draft`. The counts-only readout row of stamp patterns is in the chore lane (`claude/chores-cycle5`);
  broker-position evidence (protected `lib/broker.ts`) is not decided. Why: the owner's decision of 2026-11-02 (OD
  2.26, accepted en bloc); council cycle 5 lapse record.

## Acceptance criteria
- [ ] Probe C: on 00:00:00Z stamps, a losing long bought and sold the same day with no other evidence stays published
      (it never becomes a count).
- [ ] With evidence (an earlier oversell, a pending cover, `unknownFrom`, or a broker position above the ledger), the
      same-day short (SELL @15, BUY @14) is counted and publishes nothing.
- [ ] A sale of pre-history shares rebought the same day, where the evidence holds, publishes no phantom day trade.
- [ ] The same rows with intraday stamps give the same results as today (intraday twin test).
- [ ] The F3-5 test is rewritten, not removed, and the test count does not drop.
- [ ] The shuffle property (`lib/fixes-cycle3.test.ts:39`) still holds.
- [ ] The readout prints the stamp-pattern class count, suppressed under 5, with no id, handle or symbol.

## Out of scope
- Option same-instant ordering (fix F4-2).
- Brokers that stamp a date-only value at a local midnight. Those wait for the vendor's answer (MRC2-10).

## Open questions
- Owner Q1(a): may the matcher count, not publish, a same-instant sell that the evidence says may not be a long close,
  on 00:00:00Z stamps? This reverses F3-5 for those rows. The council recommends yes, as narrowed here. It accepts that a
  same-day short with no evidence still publishes, because counting every same-day round trip would let traders hide
  losses (Flags 1).

## Rework notes

## Build log
