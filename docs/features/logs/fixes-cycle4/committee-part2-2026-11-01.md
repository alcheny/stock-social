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
