# Fixes cycle 4, part 2: committee record (2026-11-01)

Branch `claude/fixes-cycle4-part2`. Items F4-4 (C4-9), F4-8 (C4-12), F4-14 (C4-15), F4-15 (C4-16), F4-16 (C4-17) of
`docs/direction/cycle4-2026-11-01.md` section 5 and its hand-off table. F4-17 is not built here (F-16/F-17 branch). PR #89
(`claude/fixes-cycle4`) carries the rest of the list. Shared-file edits are additive and marked `FIXES-CYCLE4-PART2`.

## Round 1: UX lead's plan

### F4-4: the month recap with option closes
- Data: `lib/recap-load.ts` counts `option_trades` rows with `closed_at` in the month (UTC bounds) and keeps the trader's
  options gate from the `optionHeadline` call it already makes. Excluded and dangling option closes are counted per user
  with no date, so a month cannot count them (ponytail). A month with option closes and no share close stays a 404
  (`monthRecap` returns null; ponytail).
- Only when that count is above 0:
  1. the "This month" figures end with " · Excluding options" (`OPTIONS.shareLabel`, unchanged), Too early months too;
  2. gate closed: under the month's count, `OPTIONS.gated(n, 0)` ("3 option trades imported. Option results aren't shown
     on this record.") and the "How options are counted" link, as the profile's options block draws them;
  3. the list heading is "Closed trades this month" (the F-7 form);
  4. the foot names closed share trades and keeps "none can be hidden" (TR-1): "Recaps list the month's closed share
     trades from connected accounts, and none can be hidden." / "Recaps list the month's Demo share trades, not from a
     real broker, and none can be hidden." (`FL.monthFoot` itself unchanged);
  5. the image alt and the link-preview description say "excluding options" after the month's figures and count; gate
     closed, the description adds the gated line before the disclaimer;
  6. the month image's figures end with " · Excluding options".
- A month with no option closes is unchanged.

### F4-8: the home preview names public-filing records
- Sentence: "Records built from public filings are marked Public filing." (mirrors "Demo records are marked Demo.",
  reuses the root description's "built from public filings"). Order: position line, this sentence, the Demo sentence, in
  the description, meta description and card text (also the image alt). Title and the K20 line unchanged.
- Predicate `publicShown()` in `lib/public-gate.ts`, memoised like `demoShown`: false with no query while
  `publicTradersOn()` is false; otherwise a visible filer (`filerVisibleSql`) has a feed-ready close (`feedReadySql`). On
  a database error: true while the switch is on, not memoised. It also reports whether a shown filer is a fictional demo
  fixture, so the Demo sentence appears for a feed whose only demo cards are demo filers. /how (rank 6, C4-27, not in this
  build) imports the same predicate when it is built.
- Card URL `/home-card?d=0|1&p=0|1`; any other `p` reads as 0.

### F4-14: a space between the badges
`{' '}` between the Demo and Public filing spans (two badges stay two badges); the text reads "Demo Public filing".

### F4-15: the @handle never shrinks on the share card
A pure function picks the unfurl's head layout: every pill on the head row; else "Excluding options" moves to a second
row; else every pill moves there. Second row under the who line, left-aligned, trust badge first, then "Excluding
options", then "New record". Square and story unchanged.

### F4-16: note dates in the chart sheet
A published note's written and edited UTC day numbers travel with the packed chart (profile points, the pane's eager
rows from `lib/feed.ts#records1`, the pane-chart route); `UserNote` prints the profile row's caption. Held or undated
notes carry nothing.

### Open questions (UX lead's recommendations)
- "on this record" on a month page: acceptable (the page shows and links the whole record); the signed words stay.
- Open-gate trader with option closes in the month: qualifier, heading, foot and the /how link only, no count sentence
  (a new sentence needs legal sign-off).
- Heading for traders without options: unchanged here (the cycle-4 record leaves it to the next design session).

## Round 2: business lead and engineer reviews, decisions

Business lead: DEMANDS (4). Engineer: DEMANDS (7). All taken; each decision below is "decided by the committee under the
owner's instruction of 2026-11-01".

1. **The month heading is "Closed trades this month" on every record** (business lead 1). *Why: decided by the
   committee under the owner's instruction of 2026-11-01; POLICY F3a bans "all of their trades" outright, a connected
   month also leaves out short sales, transfers in, sells with no recorded entry and unconnected brokers, and POLICY
   outranks the cycle-4 record's deferral; the words are F-7's own (no new wording), and the change deletes a condition.*
   The UX lead's deferral (open question 3) is overruled. Owner item: the owner may revert it in a design session.
2. **The month's qualifier, the /how link and the share-trades foot key on the trader** (any option closes, shown or
   excluded: `paneView(...).label`), not on the month's count (business lead 2). The gated count line still needs a
   closed gate and at least one shown option close in the month. *Why: decided by the committee under the owner's
   instruction of 2026-11-01; "Excluding options" is true of every month of an options trader, excluded option closes
   carry no date, and over-qualifying is safe where under-qualifying breaks F3a.*
3. **The disclaimer stays whole** on the month image with the qualifier line and on the unfurl with a second pill row
   (business lead 3): tests assert the month band fits with all three disclaimer lines; the new foot strings live in
   `lib/copy.ts` with a test that both keep "none can be hidden". *Why: decided by the committee under the owner's
   instruction of 2026-11-01; POLICY F3.*
4. **F4-15 measures, not estimates** (business lead 4, engineer 3). Widths come from the bundled next/og font's own
   advance widths (Geist Regular, the only font next/og draws with), re-read from the font file by a test, with 15%
   headroom; tests cover the longest pill set (Demo image label, "Excluding options", New record) with 20-character
   handles of the widest letters, and every trust label × handle length 3-20 × pill set, asserting the kept head row
   holds the full handle and no pill is dropped. The layout lives in a new `lib/card-head.ts` (not `lib/record-card.ts`,
   which PR #77 and PR #89 edit). *Why: decided by the committee under the owner's instruction of 2026-11-01; a
   measured table cannot under-estimate a glyph the way a per-character average can.*
5. **JSON-safe note dates** (engineer 1). The lazy pane's `/u/‹handle›/pane` payload carries a published note's dates as
   epoch ms, `app/lazy-pane.tsx` turns them back into Dates, and `toNoteDay` accepts a Date, an ISO string or epoch ms.
   *Why: decided by the committee under the owner's instruction of 2026-11-01; a fetched payload turns Dates into
   strings.*
6. **F-23 collision** (engineer 2). F4-16 edits `PackedTrade` (two optional trailing fields), `records1` (8 → 10 fields
   per close, `PANE_ROW_FIELDS`) and the pane-chart route. Hand-off note for F-23 (below). DB tests cover the pane rows
   (published dates; held: none) and the JSON round trip. *Why: decided by the committee under the owner's instruction
   of 2026-11-01; additive fields keep old payloads readable.*
7. **Copy in one appended block** (engineer 4): `FIXES_CYCLE4_PART2` at the end of `lib/copy.ts`; no existing constant
   changes. The shared "built from public filings" words are the root description's (`app/layout.tsx`, merged in #85);
   this branch does not move them.
8. **Month bounds** (engineer 5): the month's option count uses `parseYm`'s bounds (the ones `monthRecap` uses), and the
   count query lives in `lib/options-load.ts` (`monthOptionCloseCount`; AC23 keeps every display read of the option
   tables there). A test puts a close at 00:00 UTC on the 1st (counted) and one millisecond before (not).
9. **publicShown tests** (engineer 6): switch off (no query), a visible demo filer (shown, demo), a visible real filer
   (shown), a hidden filer and a filer before its feed floor (not shown), scoped to the test's own users (`only`), so
   other fixtures on the shared database never change the answer. The demo-filer → Demo sentence rule has its own
   assertion on the page code. The card route reads only `p=1` as on.
10. **F4-14** (engineer 7): the `textContent` test renders `Badge kind="public_demo"`.

### Hand-off note for F-23 (pane and payload)
`lib/feed.ts#records1` now emits 10 fields per close (`PANE_ROW_FIELDS`): the 9th and 10th are a published note's
written and edited epoch ms (null otherwise). `PackedTrade` and `PackedPoint` may end with two more fields, a note's
written and edited UTC day numbers (`lib/paging.ts#noteDays`), present only for a published note with a recorded date.
Rounding in F-23 must keep them integers.

## Round 3: tester QA, fixes

Tester: not clean (1 High, 1 Medium, 3 Low). All taken.

- **High: the month image's options line added a row** that pushed frozen or failed options traders under the 28 px
  disclaimer floor. Fix: the qualifier joins the month's count line ("8 closed trades · Excluding options"; the label
  above names the month, so "this month" drops to keep one line), adding no row. A probe over every record state × demo
  × 1 or 8 closes now gives the same layout as main. Main itself already falls under 28 px for a frozen options trader
  with 8+ closes, from the record strip's own options line (OPTIONS merge), with or without this qualifier: left as is
  with a `ponytail:` in `lib/month-card.ts`. *Why: decided by the committee under the owner's instruction of
  2026-11-01; a qualifier must never cost the disclaimer (POLICY F3), and the pre-existing case is not this fix's.*
- **Medium: the row under the head pushed the unfurl's text column past 630 px** (clipping "Record since"). Fix: moved
  pills go to the top of the chart column, and the model's chart gives up one pill row (51 px) per row
  (`lib/record-card.ts`), so the card's height never changes. Stages: every pill on the head row; else "Excluding
  options" to the column; else it and New record; else every pill (the badge too, when it fits the column). Only the
  Demo image label (wider than the chart column) beside a very long handle falls back to the row under the head
  (`ponytail:` in `lib/card-head.ts`; no seeded Demo handle is that long). The F-4 snapshot
  (`lib/snapshots/f4-record-card.json`) was regenerated for this deliberate change: 24 of 432 entries changed, all
  demo unfurls. Evidence: `screenshots-part2/f4-15-unfurl-demo-options.png` (the demo options trader, nothing clipped)
  and `screenshots-part2/f4-15-unfurl-fallback-20w-demo.png` (the fallback). *Why: decided by the committee under the
  owner's instruction of 2026-11-01; the head fix must not clip anything else.*
- Low: the header comment now names the test file that re-reads the font; the month-bounds DB test also puts a close at
  00:00 UTC on the next month's 1st (not counted); the home card with both sentences was checked by eye
  (`/home-card?d=1&p=1`, in the user test).

## Round 4: user test (business lead and UX lead at 360 px) and independent code review

User test: compliance PASS, usability FAIL on one point; code review: no blocking finding, five non-blocking.

- **Taken (user test):** the moved pills right-align in the chart column (on the demo options trader the
  "Excluding options" pill touched the end of "average per trade", which overruns the text column). The e2e note is now
  written and edited after its trade closed, as its caption says. The month image's two shapes (qualifier on the count
  line, or on the record strip's own line in a month with no figures) stay: both say it, neither adds a row.
- **Taken (code review):** the home card with both sentences is drawn at 52 px (60 px otherwise; it was 6 lines in
  470 px, measured), with a test that measures the wrap in the drawn font with 15% headroom; `publicShown` and
  `demoShown` run side by side; the remembered answer is only the process environment's.
- **Kept (code review 5):** the second import line from a module a file already imports. *Why: decided by the
  committee under the owner's instruction of 2026-11-01; the build rules ask shared-file edits to be additive and marked
  for this fix set, so parallel branches (F-23, F-25, F-27) merge without touching each other's import lines.*
- **Owner item (code review 4):** on a database error the home preview names public filings (as `demoShown` names
  Demo), not remembered. *Why: decided by the committee under the owner's instruction of 2026-11-01; naming the source
  when unsure is the cautious side of POLICY's trust rules.*

## Verdict
Business lead and UX lead: compliance PASS; usability PASS after the right-alignment (re-checked on the rebuilt image,
`screenshots-part2/f4-15-unfurl-demo-options.png`). Engineer: tests for every acceptance criterion, all green.
