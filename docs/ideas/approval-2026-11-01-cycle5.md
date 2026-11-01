# Approval council, cycle 5: 2026-11-01

The approval council (`team/approval-council.md`) met for its fifth cycle on 2026-11-01. The owner's orchestrating
session started it under the owner's delegation (POLICY H; owner decision 2026-11-01: decide through councils
everything that is not explicitly the owner's call; anything POLICY or COMPLIANCE reserves for the owner or counsel uses
the AI legal committee's findings and still goes to the owner as a flag).

Fifteen members voted, each a separate agent with fresh context, in parallel within each round. The orchestrator set
this cycle's roster of lenses (below). The chair ran the rounds and counted the votes and did not vote. Base for every
round: `origin/main` **e16d6aa** (#101, the council cycle 5 audit). Main did not move during the council (re-checked
with `git fetch` before the record was written). Every probe trade named here is fictional. Not legal advice.

## Result

| Rank | Candidate | Second-vote mean | Final vote | Outcome | Can start / blocked on |
|---|---|---|---|---|---|
| 1 | C5-1 Transfers are named, and never remove a trade after it closes | 4.93 | 15/15 (all AC) | **Approved: F-32** | Blocked: Part A on F-24 (#84) and chore C5-43(b); Part B also on OD 2.28 and the vendor's MRC2-10 answer |
| 2 | C5-4 Ranking weight needs evidence | 4.00 | 15/15 | **Approved: F-33** | Blocked: owner (cycle-5 Q3, with OD 2.32, 2.33, 2.34); after #100 and #102 |
| 3 | C5-5 One open-positions line on every surface | 3.87 | 15/15 (all AC) | **Approved: F-34** | Blocked: owner (OD 2.25); after #100, #102 and #97 |
| 4 | C5-30 A trade is published once its date has passed | 3.87 | 15/15 | **Approved: F-35** | Blocked: F-24 (#84) |
| 5 | C5-31 Fees in the return's denominator | 3.80 | 15/15 | **Approved: F-36** | Blocked: owner (cycle-5 Q1); after #84 and chore C5-43(b) |
| — | L-29 F-29 gated options wording (lapsed, re-voted) | 4.33 | 15/15 | **Re-approved: F-29** | **Ready** (the legal committee signed the words this cycle; rebase on #97 if it merges first) |
| — | L-21 F-21 exclusion counts beside the headline (returned) | 4.13 | 15/15 | **Re-approved: F-21** | Blocked: F-23 (#97) and F-24 (#84) |

C5-5 and C5-30 tied at 3.87 in round 3. They were numbered by round-1 mean (C5-5 4.00, C5-30 3.87).

No veto applied to any approved item as conditioned. The legal committee member (POLICY veto) and the contrarian
(common-sense veto) stated "veto: none" for all seven, and named the conditions whose removal would trigger a veto. The
chair's decisions-keeper check found two items that replace or amend owner decisions or protected text (F-33 replaces
the owner's 10-bet ranking floor and amends TR-9; F-36 amends DESIGN §2.5). Both are therefore approved only as
"waits on the owner". The feature files mark veto conditions "(veto condition: …)".

**Can start now:** F-29 (ready). After #84 merges: F-32 Part A and F-35. After #97 and #84: F-21. That is three active
slots (pane/strip, matcher and sync), within the contrarian's cap of three. F-33, F-34 and F-36 wait on owner answers.

**Slots: four of six new.** Five new features in four build slots, counted as cycles 3 and 4 did (re-approvals are not
new; features that touch the same files are one slot):
- **Matcher slot:** F-32 + F-36 (`lib/trades.ts`). One builder, separate MATCHER_VERSION bumps that never ship in the
  same deploy, each after chore C5-43(b).
- **Ranking slot:** F-33 (`lib/confidence.ts`, `lib/feed.ts`, `lib/bets.ts`).
- **Pane/strip slot:** F-34, with F-29 and F-21 riding as re-approvals. One builder owns the pane's line order:
  exclusions, then open, then options qualifier.
- **Sync slot:** F-35 (`lib/sync.ts`, the future-count query).

**Numbering.** F-32 to F-36 by round-3 mean (ties by round-1 mean). F-29 and F-21 keep their numbers and files, with
dated decisions appended. No earlier dated line was edited.

**Lapsed and not re-approved.** F-28 (round-3 mean 0.47) and F-30 (2.07) go to `Status: draft` with a dated lapse
decision; each file and its decisions are kept word for word.
- **F-28 is overtaken by #89.** Main already counts every later sell after an oversell, and a rename moves the mark
  (`lib/trades.ts:48-53`). F-28's "taint the next k units, later lots stay fresh" rule would publish sells that main
  now counts. The legal committee holds an F3c veto against re-approving it as written, and the contrarian a
  common-sense veto.
- **F-30 is mostly on main through #89.** Its residual readout row goes to the chore lane, and broker-position evidence
  goes to the owner.

## Members

| Code | Member (lens) |
|---|---|
| TR | trader |
| VW | viewer (signed out) |
| BL | business lead |
| UX | UX lead |
| EN | engineer |
| TE | tester |
| RT | record-trust red team |
| LC | legal committee member (POLICY veto) |
| PR | privacy |
| A11Y | accessibility |
| GR | growth |
| MA | market analyst |
| DS | design-system owner |
| RE | reliability |
| CO | contrarian (common-sense veto) |

## Process

- **Round 0 (ballot).** The chair drafted a 26-item ballot (Appendix A):
  - the 22 briefs of `docs/direction/cycle5-2026-11-01.md` §6, with each brief's dependencies on owner questions and
    in-flight branches;
  - the three cycle-4 approvals whose lapse clauses send them here (F-28, F-29, F-30);
  - F-21, whose bring-back condition (F3-2 merged, #85) is met.

  F-23 and F-31 are in flight (#97, #98), so they do not lapse.
- **Round 1 (independent ballots).** Each item scored 0-5 with a reason and conditions.
- **Round 2 (debate).** On each split item (scores at least 2 apart), up to three of the highest scorers above the
  item's mean and three of the lowest below it stated their strongest argument, with ties broken by roster order. The
  chair added 11 verified notes. The main ones:
  - #89 has overtaken F-28 (`lib/trades.ts:48-53`; fixes-cycle-4 committee `:119-122`).
  - The vendor client has no earliest-history field (`lib/broker.ts:89-94`), so MK-P6 reduces to one /how sentence.
  - The legal committee's POLICY objections and reshapes.
  - The contrarian's MK-P3 veto.
  - The engineer's slot map.
- **Round 3 (revised ballots).** Every member re-scored all 26 items after reading every statement, naming the
  argument behind each change. They could also route an item to the chore or fixes lane. This round is the "second
  vote" for the 3.5 floor.
- **Round 4 (red team).** The chair wrote the leading set's proposed shapes. The record-trust red team wrote the case
  against each, with new fictional probes. Its main finding: a transfer dated *before* the sell still removes an open
  loser, so F-32's original title and its "any date" property test were false. The chair adopted every fix it named
  (Appendix A, round-4 amendments).
- **Round 5 (final ballots).** A / AC / R on the seven, with veto lines from the legal committee member and the
  contrarian.

Every mean below was recomputed by script from the members' `SCORES:`/`VOTES:` lines. Every ballot is in
[Appendix B](approval-2026-11-01-cycle5-ballots.md).

## Votes

### Round 1: first vote (0-5)

| Item | TR | VW | BL | UX | EN | TE | RT | LC | PR | A11Y | GR | MA | DS | RE | CO | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C5-1 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 4.93 |
| L-29 | 5 | 5 | 4 | 5 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4.33 |
| L-21 | 4 | 5 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4.13 |
| L-28 | 5 | 5 | 5 | 4 | 4 | 5 | 0 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 4.07 |
| C5-4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4.00 |
| C5-5 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 4.00 |
| C5-30 | 3 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3.87 |
| L-30 | 4 | 4 | 4 | 4 | 4 | 4 | 2 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3.87 |
| C5-31 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 4 | 4 | 3.80 |
| C5-32 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 3 | 3 | 2 | 3.53 |
| MK-P6 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 4 | 3 | 4 | 3 | 3 | 3 | 3.40 |
| C5-34 | 5 | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 5 | 3 | 3 | 3 | 4 | 3.40 |
| C5-35 | 4 | 3 | 3 | 4 | 3 | 3 | 2 | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | 3.40 |
| C5-33 | 3 | 4 | 3 | 4 | 3 | 4 | 3 | 4 | 3 | 3 | 3 | 3 | 4 | 3 | 4 | 3.40 |
| C5-10 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 4 | 4 | 3 | 3 | 3 | 3.33 |
| C5-43 | 3 | 3 | 2 | 3 | 4 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 3 | 5 | 3 | 3.27 |
| MK-P5 | 3 | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 2 | 2.93 |
| C5-39 | 3 | 3 | 2 | 3 | 3 | 4 | 3 | 3 | 2 | 3 | 2 | 2 | 3 | 3 | 3 | 2.80 |
| C5-42 | 3 | 2 | 2 | 2 | 3 | 4 | 3 | 3 | 3 | 3 | 2 | 2 | 3 | 4 | 2 | 2.73 |
| C5-38 | 2 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 2 | 2 | 3 | 3 | 3 | 2.67 |
| C5-36 | 3 | 2 | 2 | 4 | 2 | 3 | 2 | 3 | 2 | 3 | 3 | 2 | 3 | 2 | 3 | 2.60 |
| MK-P3 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 4 | 3 | 2 | 2 | 1 | 2.27 |
| C5-40 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 4 | 2 | 2.20 |
| C5-41 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 2 | 2 | 2 | 2.07 |
| C5-37 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 3 | 2 | 2 | 2.07 |
| MK-P4 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1.47 |

### Round 3: revised ballots (the second vote)

| Item | TR | VW | BL | UX | EN | TE | RT | LC | PR | A11Y | GR | MA | DS | RE | CO | Mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C5-1 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 4.93 |
| L-29 | 5 | 5 | 4 | 5 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4.33 |
| L-21 | 4 | 5 | 4 | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4.13 |
| C5-4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4.00 |
| C5-5 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3.87 |
| C5-30 | 3 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3.87 |
| C5-31 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 4 | 4 | 3.80 |
| C5-43 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3 | 4 | 5 | 3 | 3.73 |
| C5-34 | 4 | 3 | 4 | 3 | 3 | 4 | 3 | 3 | 4 | 3 | 5 | 4 | 4 | 3 | 3 | 3.53 |
| C5-32 | 4 | 3 | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 3 | 4 | 4 | 3 | 3 | 3 | 3.47 |
| C5-35 | 4 | 3 | 3 | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | 3.47 |
| C5-33 | 3 | 4 | 3 | 4 | 3 | 4 | 3 | 4 | 3 | 3 | 3 | 3 | 4 | 3 | 4 | 3.40 |
| C5-10 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 4 | 4 | 3 | 3 | 3 | 3.33 |
| C5-42 | 3 | 3 | 3 | 2 | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 4 | 3 | 3.00 |
| C5-39 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | 3 | 2 | 3 | 3 | 2 | 3 | 3 | 3 | 2.93 |
| C5-38 | 2 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 2 | 2 | 3 | 3 | 3 | 2.67 |
| MK-P6 | 3 | 3 | 2 | 2 | 3 | 2 | 3 | 4 | 2 | 3 | 2 | 3 | 2 | 2 | 2 | 2.53 |
| MK-P5 | 2 | 2 | 2 | 2 | 3 | 3 | 2 | 2 | 3 | 3 | 3 | 3 | 2 | 2 | 2 | 2.40 |
| C5-36 | 3 | 2 | 2 | 3 | 2 | 3 | 2 | 3 | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2.33 |
| C5-40 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2.13 |
| C5-41 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2 | 2.07 |
| L-30 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2 | 2 | 2.07 |
| MK-P3 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 3 | 2 | 3 | 2 | 2 | 2 | 1 | 2.00 |
| C5-37 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 1 | 1.80 |
| MK-P4 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 1 | 2 | 2 | 1 | 1 | 1.33 |
| L-28 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 1 | 1 | 1 | 0 | 0 | 0.47 |


Main movements (round 1 → round 3):
- **L-28 fell (4.07 → 0.47).** RT, the chair and then every member found it overtaken by #89, which is stricter than
  F-28's rule (`lib/trades.ts:48-53`; the fixes-cycle-4 committee's probes +65%/+60%/+25% at `:119-122`). TR, VW and
  BL withdrew their 5s.
- **L-30 fell (3.87 → 2.07).** RT's probes showed #89 counts every later sell once there is evidence. What remains is
  owner-only (broker evidence) or a chore (the readout row).
- **MK-P6 fell (3.40 → 2.53).** EN showed the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so
  by its own fallback it is one /how sentence: fixes-lane size.
- **C5-43 rose (3.27 → 3.73), then was routed to the chore lane.** RE and EN showed part (b) gates every matcher bump on
  this ballot, because today old figures stay up for about three deploys (`lib/matcher-rebuild.ts:10-12`).
- **C5-5 fell (4.00 → 3.87).** CO and EN argued its helper is OD 2.25's build either way, and its wording part moved to
  the fixes lane.

### Round 3: routing (members marking ROUTE)

| Item | Route | Members |
|---|---|---|
| C5-43 | chore (part b before any MATCHER_VERSION bump) | 15/15 |
| C5-39 | chore | 15/15 |
| C5-38 | chore | 15/15 |
| C5-40 | chore | 15/15 |
| C5-42 | chore | 15/15 |
| C5-36 | chore | 14/15 (EN: fixes) |
| C5-37 | chore | 14/15 (EN: fixes) |
| MK-P6 | fixes | 15/15 |
| C5-41 | fixes | 13/15 (DS, A11Y: chore) |
| C5-34 | fixes | 14/15 |

A routed item leaves the feature ballot and gets no feature file. Its conditions are under "Routed" below.

### Round 5: final vote (A approve, AC approve with conditions, R reject)

| Item | TR | VW | BL | UX | EN | TE | RT | LC | PR | A11Y | GR | MA | DS | RE | CO | Approve |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-32 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 |
| F-33 | AC | AC | AC | AC | AC | AC | AC | AC | A | AC | AC | AC | AC | AC | AC | 15/15 |
| F-34 | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | AC | 15/15 |
| F-35 | AC | AC | A | AC | AC | AC | AC | A | A | A | A | A | A | AC | A | 15/15 |
| F-36 | AC | AC | AC | AC | AC | AC | AC | AC | A | AC | AC | AC | A | AC | AC | 15/15 |
| F-29 | A | AC | A | AC | AC | AC | AC | AC | A | AC | AC | A | A | A | AC | 15/15 |
| F-21 | AC | AC | AC | AC | AC | AC | AC | AC | A | AC | AC | AC | AC | AC | AC | 15/15 |

Round 5 had 15 ballots × 7 items = 105 approvals (87 with conditions, 18 without) and 0 rejections.

Veto lines:
- **LC:** "veto: none" on all seven as amended. Its veto conditions:
  - F-32: no transfer units, date or account; the title is never product copy.
  - F-34: no unrealized value on a new surface before OD 2.25.
  - F-29: the signed words are used exactly.
  The F3c veto stands against re-approving F-28 as written.
- **CO:** "veto: none" on all seven. Its veto conditions:
  - F-32: no copy claims a loss can never be removed.
  - F-21: one number never mixes buys and sells under "trades".
  - F-29: the last qualifier on a surface is never removed.
  Off-ballot, its MK-P3 veto stands unless MK-P3 is reshaped figure-free, and any re-approval of F-28 as written is
  vetoed.

**Chair's notes on placing conditions in the feature files.** Every condition an approving member attached is an
acceptance criterion or a dated decision. Duplicates were merged and the strictest kept. Where ballots differed:
1. **F-32's scope (red team, round 4).** The forward path (a transfer dated before the sell, probe p4) survives even
   Part B, and closing it is F-22's rule (OD 2.28). The file is retitled, and Part A names every transfer exclusion
   under "transfer", with a split taking precedence. Part B's property test is scoped to transfers after the sell, and
   a pinned test records the forward case. RT asked that no new public transfer field appear before OD 2.7's consent
   version. The council kept the count public, because it splits an already-public exclusion count into reasons and
   adds no new value, and it carries no units, date or account (PR, LC). The OD 2.7 naming is an owner flag.
2. **F-33 below the tier.** The brief said "recency alone". RT showed that pure recency rewards whoever closes most
   often, close to POLICY's frequency rule, so the file keeps today's score order (weight 0) below the tier. The
   hold-losers-open path is not closed without OD 2.34. The file says so, and the AC becomes a `todo` test naming
   OD 2.34 if it cannot pass.
3. **F-34's equality test** cannot pass before OD 2.25 (card and pane show values that strips may not gain). A guard
   test pins "no unrealized value on strips" until then. The positions' as-of date is labelled "freshness, internal",
   yet the profile prints it (PR). Images show only what the profile already shows, and the label goes to the owner.
4. **F-21's unit.** `excluded_future` also counts buys. Members preferred "sells and option closes only" over "items",
   which needs #84's future-count query, so F-21 now also waits on #84.
5. **Version bumps.** F-32 and F-36 were briefed with one shared bump, but F-36 waits on the owner. Each gets its own
   bump, never in the same deploy, each after chore C5-43(b).

## Not approved (waiting for the next cycle, with the council's reasons)

| Candidate | Last mean | Why it waits | What would bring it back |
|---|---|---|---|
| C5-32 A check code on every share picture | 3.47 (R3) | Real value against forged profit pictures, but it adds a public route and a server key before any outreach. CO and UX doubt its proportion before users, and EN wants it after the matcher bumps and the image-route branches. | The next council, before outreach and after F-32/F-36's bumps and #100/#102 merge. LC's conditions: /check claims only that the picture's figures match the stored record (never "authentic" or "genuine", never "forged"; after key rotation "can't be checked"); key HKDF-derived under a purpose label or an owner-set env value, never raw reuse, never logged; a key-version byte (RE); identical responses for wrong, unknown and deleted codes; no viewer data logged; its own `via` code (GR). |
| C5-35 Deletion that looks and reads like what it does | 3.47 (R3) | Mostly covered by the fixes list (F5-23 focus). BL, RT and EN would put the rest in the fixes lane. | Fixes lane or the next council. LC: the confirmation page states what remains, that vendor-side steps may finish later, and that reconnecting the same accounts brings back their history; no "permanently" until OD 2.9; a danger token that passes F-20's contrast test and does not reuse `--loss` (DS). |
| C5-33 No check mark beside a security | 3.40 (R3) | DS: a slice of F-18 (design-system ruling 1). A11Y: the glyph is read aloud, so a chore with C5-39. | With F-18's re-approval or the a11y chore lane. VW: a demo-only stock page keeps a visible Demo label once the glyph leaves the heading. DS also flags that /t still shows a win rate and average for the security itself (`app/t/[symbol]/page.tsx:124-127`), for OD 2.38. |
| C5-10 Forward record (trades opened after connecting) | 3.33 (R3) | Waits on OD 2.7, which must be amended to name the first-connection date on every record (PR, LC). | Once OD 2.7 is answered with that date named. Forward figures only on records whose consent version names it (LC). |
| MK-P5 "How to read a trading claim" page | 2.40 (R3) | Useful outreach material with no gate it moves now. | Before outreach, with the legal committee's read and a `via` code. |
| MK-P3 Live record badge | 2.00 (R3) | CO veto as briefed (figures and two disclaimers cannot be legible at bio size); LC: F6 forbids a "badge". | Reshaped figure-free ("record image": handle, trust state in words, "see full record"), explicit cache headers, nothing logged per load, after OD 2.62. |
| MK-P4 Evidence filters (paid tier) | 1.33 (R3) | LC POLICY block (F1, COMPLIANCE §2) unless reshaped; OD 2.47. | No filter on any return, win rate, range or rank; the free documented order; no alerts and no symbol; LC review under F-3; OD 2.47. |
| L-30 F-30 (lapsed) | 2.07 (R3) | Mostly on main through #89. | Residual readout row: chore. Broker evidence: owner. File kept at `Status: draft`. |
| L-28 F-28 (lapsed) | 0.47 (R3) | Overtaken by #89; as written it would loosen main (LC and CO vetoes). | Never as written. Any release rule must never publish a close main counts and needs vendor position evidence (owner). File kept at `Status: draft`. |

## Routed (no vote; no feature file)

**Chore lane** (each entry names its test, because the test-count guard does not require new tests; TE, A11Y):
- **C5-43 Known limits 3.** Part (b), the matcher catch-up in the sync tick, lands before any MATCHER_VERSION bump
  (F-32, F-36), tested by bumping the version over 50 fictional records and draining them with no deploy. Parts (a),
  (c) and (d) as briefed; (a) rebases on #100; (d) can ride with F-35.
- **C5-39** Arrow glyphs out of accessible names, with C4-34(c), after #102. Test: an accessibility-tree scan finds no
  "←" or "→" in any link or button name.
- **C5-38** Forced-colours border on the pressed range tab. Test: an e2e run with forced colours emulated.
- **C5-40** JIT off for the app role (ops doc and coverage flag). Applying it in production is the owner's deploy
  setting.
- **C5-42** Behavioural tests beside the text-presence assertions. The old assertions stay.
- **C5-36** Only the duplicate "Record tools" and the delete text's "if you publish" are dropped. "Thesis held" stays,
  pinned by a design-system ruling (`lib/f26-held-like-none.test.ts:99`). The nav label goes to the owner through F-18.
- **C5-37** /account keeps the disclaimer sentence and its links, muted, as a variant of the one Disclaimer component
  (F-3 legal condition R8, `docs/features/logs/F-3/committee-2026-11-01.md:41`). Only the duplicate "Legal" landmark
  (`app/tools/parts.tsx:15`) is dropped. Test: a check that only one "Legal" nav exists.
- **The L-30 residual.** A counts-only readout row of stamp patterns, suppressed under 5.

**Fixes lane:**
- **MK-P6.** One /how sentence ("History before the earliest date your broker provides"), with F5-6.
- **C5-41.** The legal committee's words exactly: "Compare whole public records side by side: closed trades imported
  from connected accounts, losses and ranges included. Traders can't remove single trades." LC re-signs in the PR.
- **C5-34.** The owner's preview `src` equals the image the Share button attaches (`/story?format=square`,
  `app/u/[handle]/share-card.tsx:15-16`), both in the Share box (lazy) and in the post-connect prompt
  (`app/u/[handle]/share-prompt.tsx:39-40`).
- **C5-4's zero-width split.** A zero-width range prints the existing "Too early to tell" and drops "Past results:
  above zero" on every surface that prints a range: card, pane, profile, strip and /t. Never a blank range. F-33
  later takes over the printed range.
- **C5-5's wording.** "average per trade" becomes "per closed trade" on the strips.

## Flags for the owner (the council's recommendation; not decided)

1. **Matcher and ranking questions in one sitting.** Cycle-5 Q1 (fees, F-36), cycle-5 Q3 (evidence floor, F-33), OD
   2.32, 2.33 and 2.34. **Recommendation: yes to Q1 and Q3.** Include OD 2.34: without open positions in the range, the
   hold-losers-open path survives F-33.
2. **OD 2.27 is overtaken by #89.** It needs no answer, and F-28 is draft. The remaining trader cost is that the
   oversell mark never clears (`lib/trades.ts:54-57`). Clearing it needs vendor position units (protected
   `lib/broker.ts`), which is your call.
3. **OD 2.28 (F-22) before Beta wave 0.** The forward transfer path (probe p4) still removes an open loser after F-32.
   **Recommendation: put 2.28 on the launch-relevant list.**
4. **OD 2.7's consent version.** It should also name the public exclusion counts (F-32, F-21), the first-connection
   date if C5-10 returns, and possibly the positions' as-of date (F-34).
5. **OD 2.26 residual.** Broker-position evidence for date-only stamps needs the protected `lib/broker.ts` and stored
   units.
6. **F-29's gate-opening checklist line** (cycle 4) still stands.

## Known limits of this record

- Members read the code and the records, and RT ran pure probes on `lib/trades.ts` with fictional trades. No app was
  run for this vote. Vendor behaviour is unverified, as in the cycle-5 audit (§10).
- `claude/fixes-cycle5` was not on the remote during the council, so overlaps with the F5 fixes were checked against
  the audit's §5 descriptions, not their code.
- Round 2's speaker rule broke ties at the cut by roster order. Every member read every statement before re-scoring.
- The roster differs from cycle 4's, which had a separate decisions keeper. The chair ran the decisions-keeper check,
  and owner-dependent items were approved only as "waits on the owner".
- `team/approval-council.md` asks for the 3.5 floor on the second vote. This record uses round 3 (the revised ballots
  after debate) as that vote, and the red team and final ballot follow it, as the orchestrator's five-round method set.
- Each member kept its own context across rounds (one agent per member, continued by message).

## Appendix A: the ballot and round-0 rulings

The ballot as given to members, the chair's round-2 notes, the leading set and the round-4 amendments are reproduced
verbatim at the top of [Appendix B](approval-2026-11-01-cycle5-ballots.md). Round-0 rulings:
- F-28, F-29 and F-30 lapse to this council under their cycle-4 clauses and are re-voted. F-23 (#97) and F-31 (#98)
  are in flight and do not lapse.
- F-21 returns: its bring-back condition (F3-2 merged, #85) is met. F-22 stays draft (OD 2.28 unanswered).
- Owner-dependent briefs may be approved only as "waits on OD/C5 Q n". The chair recorded each brief's dependency
  (C5-1: OD 2.28 + MRC2-10; C5-4: C5 Q3, OD 2.32; C5-5: OD 2.25; C5-10: OD 2.7; C5-31: C5 Q1; MK-P4: OD 2.47 + legal
  review).
- Defects stay on the cycle-5 fixes list (F5-2..F5-27) and are not on this ballot.

## Appendix B: every ballot

All 15 members' files, by round, verbatim (round 1 ballots, round 2 statements, round 3 revised ballots, the red team's
round-4 case, round 5 ballots): [approval-2026-11-01-cycle5-ballots.md](approval-2026-11-01-cycle5-ballots.md).
