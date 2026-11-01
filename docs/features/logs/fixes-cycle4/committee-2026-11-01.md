# Fixes cycle 4: record-trust committee (C4-1, C4-2), 2026-11-01

Source: `docs/direction/cycle4-2026-11-01.md` → Fixes list, Priority 1 of the orchestrator's brief (C4-1 same-instant
order on date-only stamps, C4-2 a short's cover pricing a later long; section 6 ranks 1 and 2). Members, each a
fresh-context agent: UX lead, business lead, engineer, reliability reviewer. Three rounds; all four signed in round 3.
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
