# F-6 committee review: UX lead

Build: branch `claude/f6-open-positions` (088aaa1), plan `docs/features/logs/F-6/plan.md` (round 2).
Method: `next start -p 3200` on the existing build, Playwright at 360×800 (touch for the feed), fixture traders in
Postgres (`f6ux_mixed`: 6 closes in the last day + 4 open, one symbol in two accounts, one at 0.0%; `f6ux_losing`: 4
winning closes + 3 losing open; `f6ux_openonly`: no closes, 2 open; `f6ux_none`: closes, no open), all deleted
afterwards. Screenshots: `docs/features/logs/F-6/screenshots/ux-*.png`.

Environment note: while I tested, a concurrent load-test fixture (`lib/feed.load.test.ts`, symbols `L0..L299`) twice
wrote 10,000 closed trades into `f6ux_mixed`. I re-seeded and repeated the walk; the figures below come from the clean
data. `ux-trader-view-mixed.png` shows the polluted record, so ignore its numbers. The F-6 nodes rendered correctly in
both cases (10,010 results combined).

## 1. Walkthrough: what confused or stopped me

### First-time trader (`/login/dev`, then my own profile, then other traders' profiles signed in)
- Sign-up landed on my own profile with "You're in. Next: connect your brokerage." and "No trades yet." There were
  zero `[data-open]` nodes and nothing about open positions. Nothing odd. (`ux-trader-signup.png`,
  `ux-trader-own-profile.png`)
- Signed in, `f6ux_losing` and `f6ux_mixed` render the same as signed out (6 `data-open` nodes on losing).
  (`ux-trader-view-losing.png`)

### First-time viewer arriving from a shared link, signed out
- **`/u/f6ux_losing`** (`ux-signedout-profile-losing.png`). This is the page that shows the point of F-6. "Realized ·
  closed trades: 100% / +8.8%" in green, then directly beneath at the same 36px "Unrealized · open positions at
  current value: 3 / −25.0%" in red, then "Including open positions at current value: −5.7% avg / result (7
  results)" in red. I understood it in one read: the closed trades look good, the open ones don't, and the combined
  figure is negative. Losses are not hidden or made smaller.
- **What confused me 1: "The range covers closed trades only" when there is no range.** On `f6ux_mixed` and
  `f6ux_losing` the evidence line reads "Too early to tell: 4 trades in 1 overlapping position (5 independent bets
  needed) The range covers closed trades only; open positions aren't in it." No range is shown anywhere on the page,
  so I went looking for one. The sentence also runs on with no full stop after "needed)".
- **What confused me 2: the unrealized tile says the count twice.** The big value is "4" and the caption under it is
  "4 open positions, 2 up, 1 down, 1 flat". At 360px the caption wraps to two lines, and a screen reader reads "4 4
  open positions…".
- **Some repetition.** The open-position summary appears four times on the profile: the grid, the combined line, the
  chart note ("Not plotted: 4 open positions · 2 up, 1 down, 1 flat · −2.0% avg unrealized") and the list sub-line.
  It is wordy, but each one is scoped and none contradicts another. I accept it.
- **`/u/f6ux_openonly`** (`ux-signedout-profile-openonly.png`). The unrealized grid, then "No closed trades, so
  there are no realized results.", then the list. Clear. Two things predate F-6 but now show up in a shareable state.
  First, further down the page a signed-out viewer reads "No closed trades yet. Your record starts with your first
  close.", and the unfurl text (`og:description`) starts with the same sentence: "No closed trades yet. Your record
  starts with your first close. · 2 open positions · …". That is the owner's voice shown to strangers. Second, the
  record shows open positions but no ✓ Verified badge and no "Connected" line, so a viewer can't tell where the
  positions came from.
- **`/u/f6ux_none`** has no row labels, no `data-open` nodes and no chart note. It looks like today's page. AC3 met.
- **Feed card** (`ux-feed-card.png`). "Also open: 4 positions · 2 up, 1 down, 1 flat · −2.0% avg unrealized" sits
  at body size under "No thesis posted." It is readable and isn't louder than the trade. The down color goes with the
  "−" sign and the word "down".
- **Feed pane**, opened by swiping the row (`ux-feed-pane.png`, `ux-feed-pane-open.png`). Realized, then unrealized at
  the same size, then the combined line, matching the profile. Small issue: the chart note "Not plotted: 4 open
  positions…" comes before the reader has reached the unrealized row. Acceptable, because the note says what it is.
- **`/t/UXQ`** (`ux-t-UXQ.png`). "4 trades · 1 trader", then the heading "Open positions in UXQ", then "4 open
  positions · 2 up, 2 down · −6.8% avg unrealized, held by 3 traders. Not included in the figures above, which cover
  closed trades. This is what is open now, not a prediction or a rating of the stock." Then comes the existing
  sentence that belongs to the closed-trade figures: "Different traders, different sizes and timing. This is what
  happened, not a prediction or a rating of the stock." **What confused me 3:** the new section is placed between
  the closed-trade figures and their caveat. As a result I read two "not a prediction or a rating" sentences in a
  row, and "This is what happened" now seems to refer to the open positions. "1 trader" just above "held by 3
  traders" made sense once I read "Not included in the figures above".
- **`/t/UXZ`** (open positions only, no closes). "No verified closed trades in UXZ yet…", then "1 open position · 0
  up, 0 down, 1 flat · 0.0% unrealized, held by 1 trader". Clear. The 0.0% has no color, which is correct.
- **`/t/compare?a=UXQ&b=UXM1`** (`ux-t-compare.png`). One line per column: "Open positions: 4 open positions · 2 up,
  2 down · −6.8% avg unrealized (not in the figures above)." Clear, and no horizontal scroll.
- **`/how`** (`ux-how.png`). **What confused me 4: the page contradicts what I had just seen.** The last new item
  says "Open positions are listed on each trader's profile, not on stock pages." I had just read "Open positions in
  UXQ" on the stock page. The intended meaning is "stock pages show only a total, never who holds it", but the words
  say the opposite.

## 2. Compliance verdict: PASS with one demand (D1)

- **POLICY F3 / COMPLIANCE §2, disclaimer.** The site footer shows "Not investment advice. Past performance does not
  guarantee future results." on every page I visited: profile, feed, pane page, /t, compare, /how. This is the F-1
  precedent the plan relies on. Met.
- **F1, F3b (no advice; security pages never rate).** No buy, sell, hold, signal or "$" in the new copy. /t shows an
  aggregate with no handles or links (verified in the DOM) and says "not a prediction or a rating of the stock". Met.
  Note: with "held by 1 trader", the /t line equals that one trader's live position. The same figure is already
  public on that trader's profile, so nothing new is disclosed and it is not a roster. I record it but don't block
  on it.
- **F4 / TR-4 (open positions as prominent as gains; losses like gains).** The unrealized values use the same
  computed font-size as the realized ones (36px/36px). All-losing open positions show in red with "−" and "0 up, 3
  down". The combined figure is shown even when it reverses the sign of the headline (+8.8% → −5.7%). Met.
- **P3 (percent only).** The new nodes contain only counts, percents and the fetched date. No quantities, prices or
  amounts. Met.
- **F3a, COMPLIANCE §11 (true claims).** "At current value", "closed trades only" and "as of {date}" are all
  accurate. **Fails on /how** ("not on stock pages" is false, see D1). No completeness claims.
- **COMPLIANCE §3 (personal data).** No new field. Positions are shown only for connected or failed records. My
  fixtures have no data on importing or stray records, so I relied on the e2e spec for those states.
- **A1 (no information by color alone).** Every toned value has a sign, and the counts say "up" and "down". Met.

## 3. Usability verdict: PASS once D1–D5 are done (all are copy, order or markup; no layout rework)

- **States:** no positions (unchanged), open with no closes, all losing, mixed with a 0.0% flat position, one symbol
  in two accounts ("UXQ account 1 / account 2"), signed in, signed out, new trader with nothing, dark mode. Each one
  renders and reads correctly, apart from the confusions above.
- **Readability at 360px:** no horizontal scroll on any page (`scrollWidth` 360). Tiles wrap cleanly. The feed card
  line wraps to two lines and stays at body size.
- **Contrast (measured):** muted labels are rgb(107,107,120) on #fafafa (about 5.1:1). Down is rgb(190,18,60)
  (about 6.3:1) and up is rgb(21,128,61) (about 5.0:1). In dark mode, muted is rgb(139,139,152) on rgb(11,11,15)
  (about 6:1) and down is rgb(244,63,94) (about 5.3:1). All pass AA.
- **Tap targets:** F-6 adds no controls. Each symbol link in the open list is 44px tall. Some pre-existing targets are
  under 44px, and F-6 did not cause them: the feed card's name link (23px), the "See their record" link (20px) and
  the closed-trade symbol links (20px).
- **Gestures:** swiping the feed row opens the pane, which shows the same F-6 rows as the profile. No new gesture.
- **Keyboard:** no new focus stops. Tab order on the profile is unchanged (skip link → nav → Follow → "What's this?"
  → chart → range buttons).
- **Screen reader:** the unrealized grid is a named region ("Unrealized · open positions at current value") whose
  name is also its first paragraph, so the label is read twice. The realized grid is not a region at all, so the two
  rows are announced differently (D3). The big "4" followed by "4 open positions…" is read as "4 4" (D2).
- **Plan deviation:** plan §7 lists "axe pass", but `e2e/f6-open-positions.spec.ts` has no axe step and
  `@axe-core/playwright` is not installed. Adding it would be a new dependency, which only the owner can approve. The
  PR has to say this. D3's test covers the screen-reader gap I found.

## 4. Demands (each one testable)

- **D1 (compliance, /how claim).** Replace "Open positions are listed on each trader's profile, not on stock pages."
  with "Stock pages show only a total of open positions in that stock, never who holds them; each trader's open
  positions are on their profile." Test: the `/how` text does not contain "not on stock pages" and does contain
  "never who holds them".
- **D2 (unrealized tile).** Don't repeat the count. Keep `<b>4</b>` and change the caption to "open positions · 2
  up, 1 down, 1 flat" (n=1: "open position · …"). Apply this on the profile and in the pane. Test: on `f6_mixed`,
  the first `.open-stats .stat small` text does not start with a digit, and the `.open-stats` innerText contains the
  count exactly once.
- **D3 (screen reader parity).** Make both grids regions named by their visible label: `aria-labelledby` pointing to
  the `.row-label` id, not a duplicate `aria-label`. Apply this to the realized grid when open positions exist, and
  to the unrealized grid always. Test: `getByRole('region', { name: 'Realized · closed trades' })` and `getByRole(
  'region', { name: 'Unrealized · open positions at current value' })` each resolve to one element on `f6_mixed`, and
  neither section has an `aria-label` attribute. Ensure `f6_none` still has zero `[data-open]` and an unchanged
  `section.stats` (AC3).
- **D4 (evidence scope sentence).** Show "The range covers closed trades only; open positions aren't in it." only
  when a range is rendered. In the "Too early to tell" state, say "This covers closed trades only; open positions
  aren't in it." instead. In both cases there must be a full stop before the added sentence. Test: on a record with
  fewer than 5 independent bets and open positions, `.evidence` does not contain "The range" and does contain "This
  covers closed trades only". On a record with a range, the existing string is kept. In both, `.evidence` text has no
  ") T" sequence.
- **D5 (/t order).** Render the "Open positions in {symbol}" section after the existing "Different traders,
  different sizes and timing…" paragraph, so the closed-trade caveat stays next to the closed-trade figures. Test: on
  `/t/<sym>` with closes and open positions, `section.open-ticker` comes after the paragraph containing "Different
  traders, different sizes and timing" in document order. In the no-closes branch it stays where it is.

Not blocking. These predate F-6 and should become a follow-up issue, not this PR: (a) a viewer-neutral empty state
and `og:description` for a record with no closes ("No closed trades yet. Your record starts…" is shown to strangers);
(b) open positions shown on a record with no Verified badge or connection line; (c) tap targets under 44px on the feed
card links and the closed-trade symbol links; (d) the hyphen-minus "-" in `pct()` instead of "−".

**Verdict: compliance PASS once D1 is done; usability PASS once D1–D5 are done.** None of the demands changes the
owner's decisions or the committee's layout. They are copy, DOM order and ARIA changes that each have the assertion
named above.
