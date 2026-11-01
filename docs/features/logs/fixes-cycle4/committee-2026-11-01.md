# Fixes cycle 4: record-trust committee (C4-1, C4-2), 2026-11-01

Source: `docs/direction/cycle4-2026-11-01.md` → Fixes list, Priority 1 of the orchestrator's brief (C4-1 same-instant
order on date-only stamps, C4-2 a short's cover pricing a later long; section 6 ranks 1 and 2). Members, each a
fresh-context agent: UX lead, business lead, engineer, reliability reviewer. Five rounds: all four signed a first rule in
round 3; it was revised in rounds 4 and 5 after approval council 4 (F-28, F-30) and signed again (reliability with a recorded
dissent, below). The rule as built is the round-4 rule.
Every probe is a simulation on fictional rows (symbols FAKE, TEST, XYZ; accounts acc1 and similar).

## Binding rules
Long-only FIFO; exclusions are counted, never guessed (POLICY F3c); the corporate-actions committee's "when in doubt,
exclude and count"; `excluded` counts one per sell; sells shown earlier stay (TR-1). The brief asked to keep #79's F3-5
benefit where it can be told apart from a short, and to exclude and count where it cannot.

## Round 1: candidates (a) signed position, (b) count both rows at an ambiguous date-only instant, (c) owed lots + sells
first at a 00:00Z instant
- **UX lead: SIGN (c) with conditions.** (a) publishes a wrong figure under the earlier-history reading; (b) over-counts
  for no gain. Conditions: copy that stays true for the new causes (the count line said "earlier position … no matching
  entry"), a /how bullet for date-only brokers, probes as tests, a ponytail for a per-broker notice.
- **Business lead: OBJECT.** Owed lots fix only the first sell: the short reading holds k units fewer than the ledger, so
  the two readings stay k apart in FIFO order for good. Probe: SELL 100 @15 (nothing held), BUY 100 @10, @20, @30,
  SELL 100 @22, @33: (c) publishes +65% where the short reading gives +10%. Amendment A: every later sell counted (gap
  cleared only by a vendor position read). Amendment B: sells first at every exact tie, not only 00:00Z (a truncated
  stamp carries the same ambiguity; the midnight-only check misses broker-local midnight).
- **Engineer: OBJECT.** Same offset finding (+60% probe); proposes "unknown from here". Two more wrong-figure classes on
  main: rows on the same side at one instant (row order decides: +50% or +25%; four figures for two tied sells), and
  shares a rename or split names that the ledger lacks (a later round trip in the new symbol priced as if they didn't
  exist). Asked for a reference-model property test enumerating readings.
- **Reliability: OBJECT.** Same offset finding (+25% probe); mixed precision (an intraday sell and a 00:00Z buy the same
  day publishes +7.1%); broker-local midnight; a one-time rebuild of every record on deploy (cadence-gated syncs and
  frozen records would keep the old figures); theses kept aside and returned; option-pair accounting.

## Round 2: the amended rule (orchestrator)
1. **The gap.** An oversell of k units adds k to the pair's gap G; every reading of the past is the history reading's
   queue shifted by an offset in [0, G]. While G > 0 a sell of c units is shown only when the oldest c + G units sit in
   lots alike in price, fee, date, trust and taint, so every offset draws the same figure; else counted in `excluded`.
   This is Amendment A made exact: a pre-history resale followed by one large buy still publishes the sells that fit in
   it. Splits with a known ratio scale G, renames move it, a ratio read from held units or an unpriceable action while
   G > 0 makes the ledger unknown. Never cleared from the rows (owner item).
2. **Ties.** Sells before buys at an exact tie (F3-5 reversed there); a date-only day with other rows of the pair is tied.
3. **Same-side ties.** Tied sells decided together; tied buys that differ open tie-group lots.
4. **Shares an action names that the ledger lacks** arrive as a no-basis lot at the front of FIFO.
5. Copy, deploy rebuild, theses, option pairs.

- **Engineer: SIGN.** Reran all probes: no wrong figure; own reference fuzz (12 seeds × 400 cases) found none.
  Condition: on mixed-stamp days only the date-only rows should float (an intraday sell pushed to the day's start opened
  a permanent gap for nothing): adopted.
- **Business lead: OBJECT.** A date-only stamp names a local trading date that can spill into the next UTC day: a
  date-only BUY at 2026-10-01T00:00Z and an intraday SELL at 2026-10-02T00:30Z published +7.1%. Fix: the date covers
  D−14h..D+36h: adopted (two date-only stamps on different dates keep their order, so date-only swing trades still show).
- **UX lead: OBJECT.** One order filled in two pieces at one second, sold whole later, was counted though every order
  gives the same figure: a sell that takes every unit left of a tied group whose lots share one date (and that no sell
  split before) is now shown. Exact copy strings given; ponytails for a per-broker notice and for traders not told when
  the rebuild removes published closes.
- **Reliability: OBJECT.** Public filings (`lib/public-trades.ts#matchPublic`) pass date-only rows already in their
  true order: the tie rules changed public figures (probe A +12.5% and probe B +20% on main became counts under the
  wrong reason). Fix: `matchTrades(…, { orderKnown: true })` keeps the caller's order: adopted; public outputs unchanged.
  Accepted as a ponytail: a date-only value stamped at a broker-local midnight beside an intraday row (P4b, +7.1%).

The independent property test (`lib/fixes-cycle4.property.test.ts`, written from the semantics by a separate agent:
every allowed order of tied rows × every split of each shortfall between earlier history and an open short, with splits
and renames; 9,000 histories) found no shown figure that differs between readings, and was checked against five broken
copies of the matcher (each caught). It found one bucket inconsistency (tied sells over a tainted lot landing in
`excluded` or `excludedCorporate` by input order): fixed by deciding the group's bucket once.

## Round 3: SIGN (all four)
- UX lead: SIGN (P5 shown, strings in, ponytails in).
- Business lead: SIGN (the D−14h..D+36h probe counted in both orders; copy does not imply a short was made).
- Reliability: SIGN (public probes as on main; P4b must be in Known limits and the vendor question list).
- Engineer: SIGN (round 2).

## Decision (recorded rule)
The amended rule above, as built in `lib/trades.ts` (MATCHER_VERSION 2). It reverses part of the F3-5 committee ruling
(`docs/features/logs/fixes-cycle3/committee-2026-11-01.md` → F3-5: buys before sells at one instant) and amends the
orchestrator ruling "later buys start fresh lots" (`lib/trades.ts` header). F3-5's benefit kept: intraday stamps follow
the clock, and a tie where older lots cover the sell is unchanged. Cost on record: a date-only same-day round trip with
nothing older held is counted (indistinguishable from a short and its cover), and after one transfer in or pre-history
sale, later sells of that stock in that account are counted unless every reading gives the same figure.

**Owner Q1: not needed.** The decided rules settle correctness. Owner items (non-blocking): a vendor position read with
units to clear a gap (`lib/broker.ts` is protected; storing units is a privacy call).

## After sign-off: tester QA and independent code review (fresh context)
- **Code review, blocking 1:** a run moved a date-only buy past a split dated inside its span (corporate actions are not
  part of runs), so the lot was never scaled and a later sell showed -40% (truth +20%; main counted it). Fix: a run whose
  span holds a corporate action of its pair (or an account-wide one) keeps its stamps, its buys open tainted lots and its
  sells are counted as the action's. The probe is a test ("code review, blocking 1").
- **Code review, blocking 2:** the e2e vendor fake stamped buys at 00:00Z and sells at 12:00Z the same day, so its
  histories would be counted whole under the new tie rule. The fake's buys now carry 01:00Z.
- **QA, copy:** "read in the order that cannot overstate a record" was an absolute claim the accepted P4b ponytail
  contradicts; now "read in the cautious order".
- **Code review, F4-10:** the purchase links are one per filing, so they are numbered as filings ("filing 2 of 3").
- Non-blocking, listed in the PR's Known limits: moderation false positives on ticker exchange suffixes and a few
  phrasings (held for review, never dropped), a split row's vendor count that may be a total (a larger no-basis lot only
  over-counts or shifts FIFO toward counted lots), the excluded/excludedCorporate bucket of tied sells around a corporate
  action can still depend on input order (shown trades and the total counted never do; main has the same class).

## Round 4: revision after approval council 4 (F-28, F-30 on main, #86)
The orchestrator relayed that approval council 4 approved F-28 (a short's cover never prices a later trade) and F-30
(same-instant order on date-only stamps), both blocked on owner Q1, and asked this fix to be the minimal safe fix
compatible with them, respecting F-30's red-team constraint: no exclusion the trader can steer by choosing when or how
much to close (a trader on a date-only broker could close losers the same day, counted, and hold winners overnight,
shown). The round-3 rule failed it twice: counting every date-only same-day round trip (F-30 probe C), and showing a
sell after a gap when it fit inside one lot (steerable by sale size).

**Revised rule (as built):**
1. Same instant: F3-5 restored (buys before sells), then the vendor id as a canonical tie-break (the result never depends
   on the input order). No date-only float, runs or tie groups. With evidence on the pair (an earlier oversell, an F3-1
   unknown ledger) every sell is counted anyway, so no same-instant short is shown there (F-30's evidence rule, minus the
   broker-position part, which needs `lib/broker.ts`). Without evidence a date-only same-day short is still shown: F-30's
   accepted residual, disclosed on /how (UX lead) and named in a ponytail.
2. Gap: blanket. After an oversell every later sell of the pair is counted in `excluded`, whatever its size or outcome;
   the mark moves with a rename (F-28 probe B).
3. Kept: no-basis lots for shares an action names that the ledger lacks; the deploy rebuild; theses set aside and
   returned; option-pair accounting. Public filings need no option (their order is F3-5's).
4. Copy (F-28's true-cause wording): "N sells excluded: a short sale or earlier history means no buy in the imported
   history can be matched to them for certain."

**Contradiction with F-28 recorded for its build:** F-28 decides "the next k units bought are tainted … later lots stay
fresh", with the criterion "a pre-history oversell followed by two later round trips prices the second". The round-1
probes (+65%, +60%, +25%) show that rule publishing wrong figures under the short reading, so this fix counts those sells
(POLICY F3c, "never guess"). F-28's build should start from this rule.

- **UX lead:** OBJECT on copy, then SIGN. /how's "Short options and short sales … excluded" became untrue for the
  residual; a bullet now discloses it ("… a same-day short sale with no earlier sign of one can appear as a long trade (a
  known limit)."), pinned in `lib/copy.test.ts`.
- **Business lead:** SIGN. Its round-2 window condition is withdrawn (F-30 overrides it). Follow-up for the owner: a trader
  with margin can hide a loser by overselling it by one share (an oversell is excluded whole); on main already.
- **Engineer:** SIGN. Vendor-id order makes shuffles invariant (10 seeds × 400 cases × 4 shuffles); reference model with
  F3-5 tie readings: 0 failures in about 4,300 shown sells. Residual for a ponytail: same-side tied rows at different
  prices are matched in vendor-id order (deterministic, not steerable; fix: pool tied costs).
- **Reliability:** OBJECT: probe S1 (BUY 100 @10, SELL 101 @5: the -50% is counted, not shown; selling 100 shows it), a
  steering path by sale size. Proposed: publish the oversell's matched part.

The adapted property test (`lib/fixes-cycle4.property.test.ts`, 9,000 histories, F3-5 tie readings, every split of each
shortfall) passes, with a new assertion that no sell after a pair's first oversell is shown; sensitivity-checked against
three broken copies (gap check off, vendor-id tie-break removed, gap not moved on a rename).

## Round 5: chair's ruling on S1
Not adopted. The corporate-actions committee ruled (pinned by `lib/trades.test.ts` "partial unmatched sell is excluded
whole") that an oversell proves a missing inflow, which may be an unrecorded split: BUY 100 @10, an unreported 2:1
split, SELL 101 @5 is truly +0%, and publishing the 100 matched units at @10 shows -50%, a guessed Verified figure. S1
exists on main, is outside C4-1/C4-2, and the business lead and engineer rate it no new lever (it costs every later sell
of the stock and shows as a count). It goes to the owner with the vendor position read as its fix.
- **Reliability:** SIGN with the S1 dissent recorded (no fix from the rows alone avoids a guess under the unrecorded-split
  reading; S1 stays an owner item, fixed by reading the vendor position).

All four signed the round-4 rule.

## Final fresh-context review of the round-4 rule
- Blocking (fixed): a split or stock-dividend row with a vendor count on an empty ledger added a no-basis lot of that size;
  a stock dividend's count is the new shares only, so the lot could be smaller than the real holding and hide the
  oversell the gap needs (+10% shown, true FIFO +120%). Such a row now marks the gap. Test: "final review: …".
- Non-blocking (fixed): a stale "this sell only" comment; one failing record no longer stops the deploy rebuild (counted,
  version left open). Ponytail: an old-code sync between the rebuild and the cutover can rebuild one active record with the
  old matcher until its next sync.

## Round 6: decisions from the orchestrator's independent review of #89
The review found no blocker on surfaces live today, and seven findings, each now with a regression test that fails on the
earlier head:
1. Public filings: the vendor-id tie-break compared filing rows as strings ("10" before "9"); `matchTrades(…, {
   orderKnown: true })` from `matchPublic` keeps filing order (public outputs equal main's again).
2. Options (F4-2 hole): the trader picks the exercise day, so a same-day exercise hid a loss. A same-day exercise or
   assignment now counts a close under `contradict` only when the two readings (exercise before vs after the closes)
   give different figures or a reading goes flat or short; otherwise the close is shown. Ponytail (reliability): with
   two lots at different costs a trader willing to spend an exercise can still have a loss counted; fix needs an
   exercise-order field or per-contract lot ids from the vendor (owner item).
3. A split, stock-dividend or pair-scoped unpriceable row (not shares it hands over) on a pair the ledger holds none of
   marks the gap, whatever its count (ratio-only and reverse splits published a guessed basis).
4. A rename's no-basis lot is dated before all history, so a later rename's date merge keeps it first.
5. Any gap counts every later sell at whatever size (it was tested at the later sell's scale); a residual is an oversell
   when it isn't tiny at the oversell's own scale (relative, as today; no absolute threshold: fractional units are real).
6. The deploy rebuild keeps per-record progress (`matcher_rebuilt`) and a time budget, so one failing record never
   restarts the rest.
7. Moderation v4 false positives (hyphenated tickers, "the bio of the CEO", "investing club", exchange suffixes) publish.
Copy: the /how gap bullet now names every cause and the rename case.

All four signed (UX lead, engineer, business lead on the options suite going green, reliability with the item-2
ponytail).
