# F-4 · Plan round 1 · Business lead

Date: 2026-10-24. Opens the planning debate for F-4 (`docs/features/F-4-share-card.md`, Status rework).
Read: CLAUDE.md, POLICY (F1 to F6, A1, H), COMPLIANCE §1, §2, §5, §8, §9, §11, DESIGN Stage 5 (CH-1,
CH-2, TR-7, TR-9), IMPLEMENTATION (hard stops, conflicts 8 and 9), and the current code:
`app/u/[handle]/opengraph-image.tsx`, `app/u/[handle]/story/route.tsx`, `app/u/[handle]/share-card.tsx`,
`app/share-button.tsx`, `lib/trades.ts` (TR-9 block, lines 206 to 311), `lib/confidence.test.ts`,
`lib/share.ts`, `lib/chart-series.ts`, `lib/downsample.ts`, `lib/story-image.ts`, `lib/copy.ts`.
This plan decides how, never what. Where a decision in the F-4 file looks wrong, it goes to §11 as an
owner question; no decision is changed here. Nothing here is legal advice.

## 0. Position

**Build F-4 as one card model and one renderer, used by both images, in two PRs: first the confidence
model and trust copy, then the card.** Strongest reason: today the two images the product calls "the
share card" are two different cards built from two different models (the unfurl from `shareCardText`,
the Share button's picture from `storyModel`, with different demo detection and different muted colors),
so any rework applied to one leaves the other wrong. One model makes every acceptance criterion testable
once.

**Demo sentence (the bar):** "Every trader's link unfurls into their real percent line from 0%, how many
trades and how long it covers, and one number with an honest range, losses included."

## 1. What the card leads with

The owner chose the elements; the plan chooses their order. A viewer scrolling a chat or a feed answers
three questions in this order, and the card answers them in the same order:

1. **"Whose, and is it real?"** Name, @handle, and the record state (Verified from broker / Demo data /
   Importing / Import did not finish). Top row, read in under a second.
2. **"How did it go?"** The **chart is the hero**: the largest element on the card. A line is read before
   any number. Next to it, the **headline figure** is the largest text: "+1.3%" with "per trade" under it,
   in the up, down or neutral color.
3. **"Can I believe it?"** The range ("likely between -0.1% and +2.7%") sits directly under the headline,
   never elsewhere: it qualifies that number and only that number. Then the trade count with "losses
   included", the period, the evidence label and the plain trust line, then the disclaimer.

Why the headline outranks the trade count in size: one dominant number gives the card one idea; two
numbers of equal size make the eye pick. The trade count is the second-largest text and carries the
credibility ("214 trades · losses included"). It is never smaller than the range line.

## 2. Layout at each size

Both images render the same model (§6). Three canvases, two layouts:

| Canvas | Where it is used | Layout |
|---|---|---|
| 1200 × 630 | Link unfurl (`opengraph-image.tsx`) | **Wide**: text column left (~45%), chart right (~55%) |
| 1080 × 1080 | Share button picture (`/story?format=square`) | **Tall**: one column, chart full width |
| 1080 × 1920 | `/story?format=story` (no product link today; e2e only) | **Tall**, with the existing safe-area padding |

Wide (1200 × 630), top to bottom:

```
Display name  @handle                               Verified from broker
+1.3%                         ┌──────────── chart, ALL time ───────────┐
per trade, likely between     │ line from 0%, dashed 0% baseline, "0%" │
-0.1% and +2.7%               └────────────────────────────────────────┘
Evidence: thin                  Return if every trade were the same size
214 trades · losses included · Record since Mar 2025 · 19 months
Based on 30 separate bets over 61 days. Still early.
Not investment advice. Past performance does not guarantee future results.
```

Tall (1080 × 1080): name row, state, headline and range, evidence label, chart full width (~360 tall),
caption, count and period, trust line, the profile link (`host/u/handle`, because a posted picture
loses its URL), disclaimer. The wide card has no link line: it is the link.

**Readable at a 375 px preview, made testable.** A 1200-wide image shown 375 px wide is scaled by 0.31;
1080-wide by 0.35. Rules, as named constants in one type scale object the test reads:
- Primary text (name, headline figure, trade count): **≥ 16 CSS px at 375** (≥ 52 px wide, ≥ 46 px tall).
- Every other line, **including the disclaimer**: **≥ 10 CSS px at 375** (≥ 32 px wide, ≥ 29 px tall).
  The current disclaimer is 22 px on the unfurl (6.9 CSS px at 375): it fails POLICY F3's "plain view"
  today.
- At most 2 lines for any text block; the trust line and the disclaimer may take 2, everything else 1.
- Display names are up to 40 characters (`db/schema.sql:30`): the model truncates with an ellipsis at the
  width budget instead of letting the image clip silently.
- Word budget: the full card, disclaimer included, stays at or under 50 words for the longest cell.

The UX lead owns exact sizes, spacing and the column split inside these rules. If everything does not fit
at these minimums, the order of what shrinks is: chart caption, period, evidence label. Never the
disclaimer, the state, the range, or "losses included".

**Chart (CH-1 Musts, small version):** ALL-time series only (TR-7: the share card shows all-time
numbers), from `chartSeries(…, 'ALL', now, CARD_POINTS)`; y-domain from `curveDomain`, which always
includes 0; a dashed 0% baseline labeled "0%"; percent only; the CH-1 caption "Return if every trade were
the same size" (a Must: "the label states exactly what is plotted"). No dots, no area tint, no end-value
label: the end value would be a second headline figure, and the owner chose one. Line color by its own
end value: above 0 up, below 0 down, exactly 0 neutral (text color). The headline figure is colored by its
own sign the same way. They can disagree (an average gain with a compounded loss is real); each is true
and each carries its sign in text (A1).

## 3. Trust: the range, the label, the line

**The model (PR 1, in the TR-9 block of `lib/trades.ts`):**
- `MIN_BETS = 5` and `TOO_WIDE = 0.10` (half-width in simple-return points per trade) are exported
  constants next to `confidence()`. These are "the threshold recorded in the design record"
  (IMPLEMENTATION conflict 8). The file `lib/confidence.ts` does not exist; DESIGN TR-9 places
  `confidence()` in `lib/trades.ts`, so the constants go there and the test stays in
  `lib/confidence.test.ts`. Moving 110 lines into a new file buys no user value; not doing it.
- `K < MIN_BETS`: too early, no range (`perTrade` and `pace30` null), as today.
- `K ≥ MIN_BETS` and `(perTrade.high − perTrade.low) / 2 > TOO_WIDE`: tier too early, **range kept and
  shown**. The owner's too-early line says "The range is still too wide", so the range must be visible.
  Exactly 0.10 is not too early.
- Otherwise thin / moderate / strong by the existing K and span rules (unchanged).
- Ranking stays as it is for too-early records: `evidenceWeight` returns 0 when the tier is too early, so
  the F-2 feed only changes for records with 5 to 9 bets and a narrow range. The build log lists every
  existing test whose expectation changes because the floor moved from 10 to 5 (at least
  `lib/confidence.test.ts:24` and `:83`), with the decision it follows; the test count never drops.
- Item 9: no user-visible string says "edge". The type `Edge`, the field `edge` and `edgeText` are
  renamed (`Direction`, `direction`, `directionText`) so the word stops leaking from code into copy.

**Which interval decides the line's direction.** The card shows one interval: per trade. The trust line's
direction ("positive", "unclear or negative", and "consistent" in the strong tier) is read from **that
interval**, so the line can never contradict the range printed next to it. The pace interval keeps its
role in ranking and on the profile. Confirmation asked in §11 (Q2).

**The copy (PR 1, `lib/copy.ts`):** `trustLine(c)` returns exactly the owner's table, cell by cell.
Counts: too early uses N = closed trades, the other tiers N = K bets. Durations are floored, so the card
never overstates the sample: D = whole days, M = whole months (days / 30.44), Y = whole years
(days / 365.25). Singular and plural for every unit ("1 trade", "1 year"). `evidenceLabel(c)` returns
"Evidence: too early / thin / moderate / strong", the TR-9 label. Range wording: `likely between ‹low› and
‹high›` with `pct()` formatting, the same as every other percent in the product. No "95%", no "range",
no "confidence" on the card.

**Placement:** headline, then the range on the line(s) directly under it, then the evidence label next to
or under the headline block (TR-9: "next to the headline numbers"). The trust line sits below the count
and period, above the disclaimer, in the text color, not muted: it is the sentence that earns trust, not
fine print.

**Period:** `Record since ‹Mon YYYY› · ‹N› months`, from the earliest entry (the profile's `first`,
`app/u/[handle]/page.tsx:136`) to now; N = whole calendar months. N = 0 reads "under a month", N = 1 "1
month" (UX lead confirms the 0 wording). Months always, as the criterion states; no switch to years.

## 4. States

| State | Card |
|---|---|
| Winning, losing, flat | Identical layout and sizes. Only color tokens and signs differ. Flat = neutral color, "0.0%" |
| Too early, K < 5 | Headline without a range; trust line "Based on N trades. The range is still too wide to say much." |
| Too early, wide | Headline with its range; the same too-early line |
| Thin, moderate, strong | Headline, range, label, the table's line |
| Empty ("No closed trades yet") | Name, handle, state, "No closed trades yet" in the headline slot, disclaimer. No chart, no zero line, no period, no "0 trades" |
| Importing | State "Importing record", "Import in progress", no stats (TR-3, as today) |
| Import did not finish | Stats as normal plus the incomplete line in the warn color; it takes the evidence label's line height budget, never the disclaimer's |
| Demo | State "Demo data" in the same slot, size and weight as "Verified from broker", muted tone |
| Heavy (10,000 closes) | Chart at ≤ `CARD_POINTS` points, count "10,000 trades" |

The state slot is never blank. Today a real trader with no consented connection and no trades gets no
label (`lib/copy.ts:143`). The engineer confirms whether that state is reachable after F-1; if it is, the
UX lead writes its label, which must not say "Verified" (F3a).

Losing-record parity, as a test: a losing fixture with the same K and span as a winning one produces a
model equal to the winner's in every field except colors, signed numbers and the table cell.

## 5. What I cut

| Cut | Why |
|---|---|
| Win rate | Owner decision |
| "Worst closed trade" (square image) | A per-trade return; owner decision keeps per-trade detail off. The chart's drawdowns show losses |
| " · New record" suffix and the "New record, wide uncertainty" pill | Says what the trust line already says ("Still early", "too wide to say much"). TR-7's badge is a profile rule |
| "Range (…) · 95%" and "95% range" wording on the card | The owner's wording is "likely between"; "95%" needs education the card must not require |
| Two card models (`shareCardText` stats path in the OG route, `storyModel`) and two demo checks | One model, one demo rule (`isDemoUser`), one muted color |
| "Stock Social" wordmark on the square image | The link line carries the name and the way back; one brand mark per card |
| The link line on the unfurl | The unfurl is the link |
| Dots, area tint, end-value label, axis ticks other than 0% | Noise at thumbnail size; the end value would be a second headline |
| Moving `confidence()` into a new `lib/confidence.ts` | No user value; DESIGN places it in `lib/trades.ts` |
| PNG pixel snapshots | Font rendering makes them brittle; the snapshot is of the model (§8) |

Said no to: tick labels, a per-range chart, a "view record" call to action on the image, a QR code, any
new font. All are additions with no evidence behind them yet.

Not in this feature, logged for the owner: the unfurl's text description (`page.tsx:76`) still leads with
win rate; aligning it with the card is a later decision. The profile headline paints 0.0% in the down
color (`page.tsx:214`); a fix outside F-4.

## 6. How it is built

- `lib/record-card.ts` (new, pure, replaces `lib/story-image.ts`): `recordCard(input) → CardModel` with
  every string, color token, size class, the chart path and the alt text. Input: closed trades, record
  state, demo flag, now, handle, display name, host.
- `lib/record-card-load.ts` (or a function in an existing loader): one SQL read and one state read, shared
  by both routes, so the two images can never disagree on demo or state.
- `app/u/[handle]/record-card.tsx`: one renderer for next/og, `layout: 'wide' | 'tall'`.
- `opengraph-image.tsx` and `story/route.tsx` shrink to: load, model, render. The page's `og:image` alt
  text comes from the same model (headline, range, trade count, state), so nothing is only in the image.
- Chart path: `chartSeries` and `pathD` (existing) plus one small pure scale function. `CARD_POINTS =
  400` (≤ 1 point per source pixel of the wide chart).
- Response size: PNG ≤ 300 KB at every state and the heavy fixture (a widely used messaging app is
  reported to drop previews above about 300 KB; undocumented, secondary sources). Server render ≤ 1 s
  locally at 10,000 closes.
- The Share button (`share-button.tsx`, `share-card.tsx`) does not change.

## 7. PR split (each ≤ 800 product lines; tests, e2e and docs not counted)

| PR | Content | Estimate | Waits on |
|---|---|---|---|
| **1. Confidence and trust copy** | `MIN_BETS`, `TOO_WIDE`, too early by width with the range kept, direction from the per-trade interval for the card line, renames (item 9), `trustLine`, `evidenceLabel`, the period text, every consumer of "of 10 bets" reading the constant (`evidenceLine`, `app/t/[symbol]/HoldTime.tsx:28`, `Concentration.tsx:27`, plus a width branch in `evidenceLine` so the profile never reads "12 of 5 bets") | 150 to 250 | Q1 for merge only |
| **2. The card** | §6 in full, both canvases, all §4 states | 350 to 500 | PR 1 |

Why two: PR 1 changes behavior on the profile, the ticker pages and the feed order (the floor moves from
10 to 5 app-wide, as TR-9 now says). That needs its own review, and it must not wait behind the card's
taste rounds, which F-1 and F-2 show take several committee passes. PR 2 is visual and stacks on PR 1.

## 8. Test plan, per acceptance criterion

| Criterion | Test |
|---|---|
| Chart, count, period, name, handle | Model test: ALL series, first point 0, domain includes 0, count formatted, period string, name and handle |
| One headline, range from K ≥ 5, no win rate, t multiplier | `tCrit95` at df 4, 9, 29, 99 against 2.776, 2.262, 2.045, 1.984 (±0.002); model has no win-rate field; range present at K = 5, absent at K = 4 |
| Too early: K < 5 or width; never a count alone | K = 4 → too early; K = 5 narrow → thin; K = 200 with half-width 0.11 → too early with range; 0.10 exactly → not; 2,000 trades in 3 bets → too early (the floor counts bets, never trades) |
| Evidence label and table line, every cell, "consistent" both signs | One assertion per table cell (8 cells) plus plural cells; "consistent" only when strong and the interval is entirely above or entirely below 0, tested for both signs; mirrored fixtures produce mirrored cells |
| Reader test | Every string `trustLine` and `evidenceLabel` can return, and the card's full text, against: confidence interval, standard error, p-value, alpha, Sharpe, edge, signal, skill (word-bounded, case-insensitive), plus the existing banned and PROMO lists |
| No per-trade detail | The model has no per-trade field; the rendered text contains no symbol, closing time or holding period (fixture symbols chosen so a leak is detectable) |
| Losing parity, down color | §4 parity test; line token down when the end value is negative, neutral at 0 |
| Disclaimer and state on every rendering | For every state in §4 × both layouts: disclaimer string present, state slot non-empty, Demo on demo |
| Both sizes, readable at 375 | e2e: both routes 200, `image/png`, exact dimensions, ≤ 300 KB, every state. Unit: every size in the type scale ≥ its §2 minimum per canvas. QA log: screenshots of each state at full size and scaled to 375 px |
| Snapshots and heavy | Model snapshots (JSON, not PNG) of winning, losing, empty; period at 0, 1, 19 months and singular/plural; 10,000 closes: ≤ `CARD_POINTS` points, the record's minimum and maximum kept, "10,000", model built in < 200 ms |

Fixtures the tester adds beyond the criteria: a 40-character display name; the longest trust line
(thin, unclear) with a five-digit trade count; a failed import; a high-volatility record where the
average return falls outside its own range (§11 Q5); a record whose trading stopped a year ago (period 19
months, trust line "over 61 days").

## 9. What to measure after launch (no new tracking)

The week-8 gate: 60% of connected traders share. Everything below reads columns and logs that exist
(`users.share_image_saved_at`, the share prompt action, `referred_surface`, the funnel's
`import_finished`), aggregated, no personal data.
1. **Share rate:** connected traders with a first share within 7 days of `import_finished`, cohorts
   before and after the PR 2 merge date.
2. **Share rate by tier and by sign** (too early / thin / moderate / strong; positive / unclear /
   negative). This is the main risk: an honest card may stop early and losing traders from sharing. If
   too-early records share at under half the rate of thin-or-better records after 4 weeks, that goes to
   the owner as a design question, never as a quiet copy change.
3. **Unfurl reach:** aggregate request count of `/u/*/opengraph-image` per shared profile from the deploy
   logs.
4. **Return trip:** signups with `referred_surface = 'profile'` per share.

## 10. Compliance (COMPLIANCE §1)

1. **Shows performance: yes → §2.** Disclaimer on every rendering, every state, both canvases, at a size
   that is plain view at 375 px (§2). Evidence label present (TR-9). Losses as prominent as gains (§4
   test). "Consistent" describes the evidence and is symmetric (F3b). Watched: "likely between" must stay
   attached to "per trade" so it reads as the past average's range, not a forecast; the disclaimer is on
   the same card. No advice, no signal, no ranking on the card.
2. **Personal data: no new data.** Display name and handle are already public on the profile; nothing is
   stored or sent that is not already shown.
3. **Money: no.** Percentages only; no prices, sizes or balances (`closed_trades` holds none).
4. **Email, push, tracking: no.** §9 uses existing columns and logs.
5. **User text: the display name**, already shown and already subject to existing rules; no thesis on the
   card.
6. **Sign-up, age, identity: no.**
7. **Vendor, dependency, font, image: none.** `next/og` is part of Next; its bundled default font is used,
   so nothing is fetched from another company's servers.
8. **Screen reader, no mouse: yes → §9.** The `og:image` alt text carries the card's words; signs in text
   on every number; contrast on the card background ≥ 4.5:1 for every color used (muted 5.8:1, down
   5.4:1, up 8.6:1 on `#0b0b0f`, computed). The image itself has no controls.
9. **Security posture: no change.** Public endpoints already exist; render cost is bounded by
   downsampling and the existing cache header.
10. **Claims: yes → §11.** "Verified from broker" means broker-sourced only (F3a); "214 trades" and
    "losses included", never "every trade" or "all trades".
11. **Checkout: no.**

## 11. Owner questions (for the F-4 file's Open questions)

| # | Question | Blocks | My recommendation |
|---|---|---|---|
| Q1 | The table's thin and moderate rows give "unclear or negative" one line. For a record whose range lies entirely below 0 the card would print "likely between -6.0% and -1.0%" and, under it, "results could go either way" / "no clear pattern yet": the line contradicts the range next to it and softens losses relative to gains (TR-9: negative shown with the same prominence) | **Merge of PR 1 only** (hard stop 5); building continues | Positive and negative share the plain line ("Still early." / "A fair sample."); the "either way" / "no clear pattern" wording is kept for unclear only. The number and its range carry the sign |
| Q2 | Which interval decides "positive" and "consistent": the plan uses the per-trade interval shown on the card; DESIGN TR-9's verdict uses the pace interval | No | Per trade on the card, so card text never contradicts itself; pace stays for ranking |
| Q3 | Criterion 3 says too early is "never triggered by a count alone" and also "when K < 5" | No | Read as "never by the trade count"; the 5-bet floor is the only count rule; tested as in §8 |
| Q4 | DESIGN TR-9's Display Must still prints "Edge: unclear · Evidence: thin (30 bets, 60 days)"; POLICY F3b bans "edge". IMPLEMENTATION conflict 8 names `lib/confidence.ts`; DESIGN names `lib/trades.ts` | No (POLICY wins; the plan uses `lib/trades.ts`) | Owner edits the DESIGN line to "Evidence: thin (30 bets, 60 days)" and conflict 8 to `lib/trades.ts` |
| Q5 | The headline is the arithmetic average (`headline()`); the range is built around the geometric center (TR-9). For high-volatility records with many bets (per-trade spread around 40% at 100 bets) the headline can sit outside its own "likely between" range | No | Wherever a range is shown, the headline is the range's own center (`perTrade.mid`), profile included, in a later change. Until the owner answers, the card matches the profile and the tester logs the fixture |
| Q6 | The too-early line counts trades ("Based on 2,828 trades.") when the record may hold 3 independent bets | No | "Based on N trades in K separate bets." when trades outnumber bets |

## 12. Pre-authorization requests

**None.** No protected path (`lib/trades.ts`, `lib/copy.ts`, `app/**` and the tests are not in CODEOWNERS;
`playwright.config.ts` is not needed), no dependency, no font, no vendor, no secret, no deploy setting.
F-4 relies on two items already requested: #2 (the 800-line cap counts product lines only, answered) and
#9 (a running preview for the committee; until answered, `npm run start` plus screenshots at 1200 px and
375 px in the QA log).

## 13. Scorecard (the plan; F-4's demand was settled by the owner, so demand scores the how)

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Single-broker social features, broker P&L pages and funded-trader programs ship shareable performance cards and broker-hosted "verified P&L" links, several warning that screenshots can be edited (competitor behavior, launch disclosures; no usage numbers found). One investor-social platform closed its social features in 2025 (found). Most of these let the user pick the date range or the trades; a whole record with losses has no direct equivalent found (inferred) |
| Ease of adoption | 5 | Zero new steps: the same Share button and the same link; a line from 0% is a familiar pattern |
| Phase fit | 5 | The card is the share loop behind the week-8 "60% share" gate |
| Revenue impact | 3 | Indirect: reach that brings traders (supply) and viewers; §14 |
| Aesthetics and clarity | 4 | One hero, one number, fixed reading order; 5 only on screenshots at 375 px |
| Trust and compliance | 5 (with Q1 answered) | Disclaimer readable at 375 for the first time, range under the number, symmetric labels, no per-trade cherry-picking possible. 4 if Q1 ships as written |
| Simplicity | 4 | Two models become one and two demo checks one, with no new dependency; the type-scale test forces deletions |
| Craft and taste | n/a | Nothing built yet |

## 14. Revenue chain

F-4 earns nothing directly. Chain: connected traders × share rate × unfurl views per share × viewers who
open the profile × share of those who are traders and connect. Low / base / high cannot be given with
numbers: there are no real traders yet, and I won't invent them. The assumption the result is most
sensitive to is **the share rate of traders whose record is too early, unclear or negative**, because
honest copy is aimed at exactly them and they are most traders early on. Cheapest test inside two weeks:
show the three model snapshots (winning, losing, too early) as rendered images to 5 to 10 traders from the
demo pool or the waitlist and ask one question, "would you post this one?"; then §9 metric 2 on the first
real cohort.

## 15. Demands

**UX lead (round 1 reply), prioritized:**
1. Exact sizes and spacing for both layouts inside §2's minimums, with the longest content (40-character
   name, thin-unclear line, "10,000 trades", failed import) shown fitting. Verify: annotated wireframe in
   the round log.
2. The "under a month" wording, the empty card, and the label for a state slot that would otherwise be
   blank. Verify: strings in the log, scanned against the banned lists.
3. Where the evidence label sits relative to the headline at both sizes. Verify: wireframe.

**Engineer (feasibility reply), prioritized:**
1. Confirm next/og renders the inline SVG chart and the bundled font has every glyph the card uses
   (middle dot, ellipsis); the check mark was already dropped for a missing glyph. Verify: one rendered
   PNG per layout in the log.
2. Line estimates for PR 1 and PR 2 against §7, and the list of existing tests whose expectations change
   with the 10 → 5 floor, each with its reason. Verify: the list in the plan reply; no test removed.
3. Whether the "no label" state is reachable after F-1, and how the period's end is defined for a frozen
   (disconnected) record. Verify: a code reference.
4. Render time and PNG size at 10,000 closes. Verify: numbers in the log, against §6.

**Tester:** the §8 fixtures, including the extra five; screenshots of every §4 state at full size and at
375 px.

**Reviewer:** fail PR 1 if any user-visible string contains "edge" or "of 10 bets", or if a too-early
record by width shows no range. Fail PR 2 if the two routes do not share one model, if any text size is
below the §2 minimum, or if any state renders without the disclaimer or a state label. Diff reading alone
is not a pass: open both images for the winning, losing and empty fixtures.

## 16. What would change my mind

- The engineer shows the minimum sizes cannot fit the wide card with the chart: then the wide card drops
  the evidence label's own line (it moves into the trust line, "Evidence: thin. Based on …"), never the
  disclaimer.
- The "would you post this?" test shows losing or too-early traders refuse in most cases: that goes to the
  owner as data for the later-depth decision, with the card unchanged meanwhile.
- The owner answers Q5 as "keep the arithmetic average": the range test then asserts containment is not
  required, and the card stays as built.
