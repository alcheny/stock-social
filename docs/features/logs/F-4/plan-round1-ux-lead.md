# F-4 · Plan round 1 · UX lead

Date: 2026-10-24. Responds to `plan-round1-business-lead.md` (same day) and opens the UX position for the
planning debate on `docs/features/F-4-share-card.md` (Status rework). Read: CLAUDE.md, POLICY (F1 to F6,
P3, P6, T1 to T5, A1), DESIGN Stage 5 (CH-1, CH-2, TR-1, TR-7, TR-9), IMPLEMENTATION (conflicts 8 and 9),
the F-4 file, the F-1 UX round 1 (format), and the code: `app/u/[handle]/opengraph-image.tsx`,
`app/u/[handle]/story/route.tsx`, `app/u/[handle]/share-card.tsx`, `app/u/[handle]/share-prompt.tsx`,
`app/share-button.tsx`, `lib/trades.ts` (TR-9 block; `lib/confidence.ts` does not exist), `lib/share.ts`,
`lib/chart-series.ts`, `lib/downsample.ts`, `lib/story-image.ts`, `lib/copy.ts` (SHARE_CARD), `app/globals.css`.
The plan decides how, never what. No decision in the F-4 file changes here. Nothing here is legal advice.

**Method.** I rendered today's two images from the dev server (`/u/momentum_maya/opengraph-image` and
`/story?format=square`). I then rendered throwaway prototypes of the layout below with the same renderer
(next/og, outside the repo) on the seeded demo record and on synthetic records: losing, 3 trades, empty,
4,800 trades, a 40-character name with a 20-character handle and 12,345 trades. I downscaled each to
375 px to check it. Every size and position below fitted in those renders, and none is a guess.

## 0. Position

I agree with the business lead's core: **one card model, one renderer, two layouts, two PRs.** Where we
differ, the difference is small and each point can be tested (§10). Two things the prototype found that
neither plan had yet, and that come first:

1. **The renderer fetches fonts from a third party when a glyph is missing.** next/og ships one font
   (Geist Regular). Any character outside it (the check mark, a non-Latin display name, an emoji) makes it
   download a font from a public font service *at render time*, sending those characters. I saw this
   happen ("Failed to download dynamic font" for the check mark). The business lead's compliance answer 7
   ("nothing is fetched from another company's servers") is therefore true only for the copy we write. A
   trader's display name can break it. Demand D1 (§9).
2. **Bold does not exist on the card.** Only the Regular weight ships, so today's `fontWeight: 800` renders
   regular (visible in today's card). The hierarchy must come from size and color alone. No new font
   (agreed with the business lead), and no `fontWeight` in the card code, because it would claim a style
   that does not render.

## 1. Canvas sizes, and why

| Canvas | Use | Why this size |
|---|---|---|
| **1200 × 630** (wide) | Link unfurl (`opengraph-image.tsx`, `og:image`) and the profile's share preview (`share-prompt.tsx`) | The large-preview ratio (1.91:1) that link unfurls crop to. At 375 px it is shown ≈ 375 wide, and 1200 is ≈ native on a 3× phone screen (1125 device px), so 2× would add bytes and no sharpness |
| **1080 × 1080** (tall) | The Share button's picture (`/story?format=square`, sent through the share sheet) | A posted picture shows at full chat width. A square is 375 × 375 at 375 px, about twice the area of the wide card, so it carries the same content larger |
| 1080 × 1920 | `/story?format=story` (no product link today) | Same model and the tall layout with the existing safe-area padding. Kept only so the route does not show the old model |

Both images are built from the same model, so the criterion "renders at the share-image size used by the
Share button and as the link unfurl image" holds for both.

## 2. Legibility at a 375 px preview: the type scale

Scale factor at 375 px: wide 0.3125, tall 0.347. Floors in CSS px at 375, and the source px that meet them:

| Role | Floor at 375 | Wide (1200) | Tall (1080) |
|---|---|---|---|
| Headline figure | ≥ 32 CSS px | **108** (33.8) | **132** (45.8) |
| Name | ≥ 16 | **52** (16.3) | **52** (18.0) |
| Trade count | ≥ 13 | **44** (13.8) | **46** (16.0) |
| Range line, period, trust line | ≥ 10.5 | **34–36** (10.6–11.3) | **36–38** (12.5–13.2) |
| Everything else: handle, state badge, "average return per trade", "losses included", chart caption, "0%" label, evidence label, **disclaimer** | ≥ 10 | **32** (10.0) | **30** (10.4) |

Where I differ from the business lead (§2: "primary ≥ 16 CSS px" includes the trade count): on the wide
card the count is **44 px (13.8 CSS px)**, not 52. The left column is the binding constraint. At 52 the
count and "losses included" no longer fit beside the chart with every other line at its floor. I tried
it: the disclaimer was pushed into the bottom margin. The count is still the second-largest text and
larger than the range (the business lead's rule), and on the tall card it is 16 CSS px. The headline and
the name meet 16 everywhere.

**Disclaimer on one line, at the floor, wide card:** 32 px with letter-spacing −0.25 px and 40 px side
padding. That is 1,114 px of a 1,120 px line, so it does not wrap. On the tall card it is 30 px and wraps
to two lines, with room to spare. It is never shrunk to fit, and it is always the last row (POLICY F3:
plain view, on every rendering).

## 3. Layout and visual hierarchy

Reading order, as the business lead set it: **whose / is it real → how did it go → can I believe it.**
Losses get the same treatment in every row (§6).

### Wide, 1200 × 630 (padding 30 top and bottom, 40 sides; content 1120 × 570)

```
y≈30   Maya  @momentum_maya ......................................... ( Demo data )      row h 64
       name 52 · handle 32 muted · badge 32 in a pill, right-aligned
y≈100  ┌ left column, 480 wide ──────┐  20  ┌ right column, 620 wide ───────────────────┐
       +1.4%                (108, up/down)     chart 620 × 176: line, tint, dashed 0%, "0%"
       average return per trade (32 muted)     Return if every trade were the same size (32 muted)
       likely between              (36)        Record since Aug 2026 · 2 months         (36)
       −0.1% and +2.7%             (36)
       30 trades                   (44)
       losses included             (32, text color, not muted)
       └─────────────────────────────┘        └───────────────────────────────────────────┘
y≈455  ( Evidence: thin )  Based on 30 separate bets over 60 days. Still early,          (32 pill + 34, ≤ 2 lines)
                           and results could go either way.
y≈560  Not investment advice. Past performance does not guarantee future results.        (32 muted, 1 line)
```

- The **period sits under the chart** because the chart's x-axis spans exactly that period: the line
  labels the axis. The business lead put it in a full-width row, which costs 40 px the wide card does not
  have.
- **The range is on two lines** ("likely between" / "−0.1% and +2.7%") so that it stays at 36 px in a
  480 px column. It is directly under the headline and qualifies only that figure (agreed).
- **No wordmark and no link line on the wide card** (agreed: it is the link, and the unfurl shows the domain).
- Name row: the name shrinks with an ellipsis; the handle and the badge never shrink. Worst case
  (40-character name, 20-character handle, "Verified from broker") still shows ≥ 8 characters of the name.
  I chose this because the handle is the identity a reader can check against the URL.

### Tall, 1080 × 1080 (padding 64; one column, 952 wide)

```
Maya  @momentum_maya ..................................... ( Demo data )
+1.4%                                  (132)
average return per trade               (30 muted)
likely between −0.1% and +2.7%         (38, one line)
[chart 952 × 180, full width]
Return if every trade were the same size   (30 muted)
30 trades · losses included            (46)
Record since Aug 2026 · 2 months       (36)
( Evidence: thin ) Based on 30 separate bets over 60 days. Still early, and results could go either way.   (≤ 2 lines)
‹host›/u/momentum_maya                 (30 muted)
Not investment advice. Past performance does not guarantee future results.   (30 muted, ≤ 2 lines)
```

The link line replaces the "Stock Social" wordmark, because a posted picture loses its URL (agreed).
Cut from today's square image (agreed with the business lead): win rate, "Worst closed trade", the
"95%" range wording, and the "New record, wide uncertainty" pill.

## 4. The chart (CH-1 small version)

- **Series:** the ALL-time compounded equal-weight series (`chartSeries(…, 'ALL', now, CARD_POINTS)`),
  starting at 0%. The y domain comes from `curveDomain`, which always contains 0 and every point and
  never crops.
- **Single line**, stroke 6 px (1.9 CSS px at 375), round joins. Color comes from the **line's own end
  value**: up above 0, down below 0, text color at exactly 0. The headline is colored by its own sign. The
  two can disagree, and the business lead's reasoning holds: each is true and each carries its sign in
  text.
- **0% axis:** a dashed baseline (3 px, muted, dash 10/8) across the plot, labeled "0%" at 32 px in a
  70 px left gutter, vertically centered on the line. It is always drawn, including when the whole line
  is above or below it.
- **Area tint: I keep it, against the business lead's cut.** The area between the line and 0% is filled
  with up at 16% opacity above 0 and down at 16% below 0, clipped at the baseline. Why: (a) it is what
  makes a losing record carry the same visual weight as a winning one, because a line alone near the
  top or bottom edge reads as "small" at 375 px; (b) it is CH-1's specified look, so the card matches
  the chart the viewer lands on in the profile; (c) it costs no text and no number. Contrast: the line on
  its own tint is 6.8:1 (up) and 6.0:1 (down), and the "0%" label on the down tint is 6.3:1.
- **No dots, no end-value label, no ticks other than 0%** (agreed). The owner chose one figure, and the
  end value is in the alt text (§8).
- **Thousands of trades:** downsample with the existing min/max bucketing (`downsampleIndices`) to
  `CARD_POINTS = 400` (about 0.65 points per source px on the wide chart). The first point, the last
  point and the record's low and high are always kept, so the worst drawdown and the peak survive.
  In the prototype, 4,800 trades drew in the same time as 30, and every PNG was ≈ 110 KB.
- **Caption (CH-1 Must):** "Return if every trade were the same size", always under the chart.
- **Observation for the owner, not blocking:** on a long, positive record, a compounded linear-scale
  line turns into a flat start and a steep tail. My synthetic 4,800-trade record ended at a seven-digit
  percent, and its first two years drew as a flat line on 0%. That is CH-1's rule and the profile draws
  the same series, so F-4 does not change it. I am noting it for the later-depth decision.

## 5. Trust: average, range, evidence label, trust line

- **Headline:** the average return per trade, at 108/132 px, in up/down/text color by sign, with
  "average return per trade" under it. The label is longer than the business lead's "per trade" because
  the full phrase reads without context at 375 px.
- **Range:** "likely between ‹low› and ‹high›", directly under the headline, whenever K ≥ 5, including
  the too-early-by-width case (agreed: the owner's line says the range is too wide, so the range must be
  visible).
  - **Negatives use the true minus sign U+2212 on the images.** Geist has it (checked in a render). It is
    the width of "+", so "+1.4%" and "−1.4%" are the same width and weight, while a hyphen is about half
    as wide and becomes a speck at 10 CSS px. That is losing-record parity at the glyph level. Images only
    (one display helper), so `pct()` and the profile do not change.
  - **A bound never prints "0.0%" unless it is exactly zero to 4 decimals.** A nonzero bound that rounds
    to 0.0 prints with 2 decimals ("−0.04%"). The prototype's losing record printed "likely between −2.6%
    and 0.0%". If the strong tier then says "consistent losses", the reader sees a range that seems to
    touch zero beside a line that says it does not. The classification uses exact values, and the printed
    text must show the same side.
- **Evidence label:** a pill, "Evidence: thin / moderate / strong / too early", leading the trust line,
  in the row right under the headline column. It carries the tier only, because the sample size is in
  the sentence beside it. Saying "30 bets" twice in 50 words is noise. It never says "Edge" or "Past
  results" (IMPLEMENTATION conflict 9).
- **Trust line:** the owner's table, cell by cell, in the **text color** (not muted), at 34/36 px, at
  most 2 lines. Its direction is read from the per-trade interval printed on the card (the business
  lead's Q2, which I support: the words never contradict the visible range).
- I support the business lead's **Q1** (a fully negative range next to "results could go either way"
  softens losses) and **Q6** (the too-early count of trades vs bets) as owner questions. Neither blocks
  the layout: the longest cell is already budgeted at 2 lines.

## 6. A losing record keeps the same prominence

1. Same layout, sizes, positions and row count for winning, losing and flat records. Only color tokens,
   signs and the table cell differ.
2. **Equal luminance for up and down on the image.** The site's dark `--down` (#f43f5e) is 5.35:1 on
   the card background against `--up` at 8.62:1, so a losing headline would be visibly dimmer. The image
   palette uses **#fb7185 for down (7.30:1)**. The gap to up is 1.3, against 3.3 today.
3. The tint below 0 matches the tint above it (16%).
4. U+2212 gives the same glyph width as "+" (§5).
5. "Consistent" and the strong-tier lines are symmetric. The direction comes from the interval the reader
   sees.

## 7. States

| State | Badge slot | Body |
|---|---|---|
| Winning / losing / flat | Verified from broker (up) or Demo data (muted) | Full layout §3 |
| Too early, K < 5 | as above | Headline shown; the range slot keeps its height but is empty (no layout jump); pill "Evidence: too early"; "Based on N trades. The range is still too wide to say much." |
| Too early, wide (K ≥ 5, half-width > 10 points) | as above | Headline **with** its range; same pill and line |
| Empty | Verified from broker never; "Broker connected" (up) or Demo data | "No closed trades yet" at 72/80 px in the headline slot, then (36, muted) "The record starts with the first closed trade." No chart, no 0% line, no count, no period, no pill, no trust line. Name, handle, badge and disclaimer stay |
| Importing | "Importing record" (muted) | "Import in progress" in the headline slot plus `SHARE_CARD.importingNote` (as today, TR-3) |
| Import did not finish | "Import did not finish" (warn #f59e0b, 9.15:1) | Full layout. The incomplete line (`RECORD_BODY.failed`) takes the trust row's place and is shown in warn color, with the pill kept. Never takes the disclaimer's place |
| No connection, no demo, no trades (the blank slot the business lead found) | **"No broker connected"** (muted) | Empty body. Never "Verified" (F3a). The engineer confirms whether it is reachable |

New strings this plan proposes, all to be scanned against the banned and PROMO lists: "average return
per trade", "likely between", "losses included", "The record starts with the first closed trade.", "No
broker connected", "Evidence: ‹tier›", and "under a month". I accept the business lead's "Record since
‹Mon YYYY› · under a month" for N = 0 (and "1 month", "N months").

## 8. Palette, light/dark, contrast, alt text

**A fixed dark palette for every image.** A PNG cannot follow `prefers-color-scheme`. The same file
appears in light and dark chat apps, and the dark card stands out in both. Values (contrast on #0b0b0f,
computed with the WCAG formula):

| Token | Value | Contrast |
|---|---|---|
| background | #0b0b0f | n/a |
| text | #f4f4f6 | 17.88:1 |
| muted (one muted color, both canvases) | **#a1a1ad** | 7.69:1 |
| up | #22c55e | 8.62:1 |
| down | **#fb7185** | 7.30:1 |
| warn | #f59e0b | 9.15:1 |

I chose muted #a1a1ad over #8b8b98 (5.84:1) because the image is downscaled: anti-aliasing at 10 CSS px
lowers the effective contrast, so the floor needs headroom. The story route already uses it. All tokens
live in one exported constant beside the model, and a test computes every ratio as ≥ 4.5:1. The site's
light theme is unaffected.

**Alt text (A1):** the profile's `og:image` alt comes from the same model and contains every word on the
card, plus the chart in words: "Line from 0% to ‹end› total, lowest ‹min›". That puts the end value in
text for screen readers without making it a second figure on the image.

## 9. Demands on the engineer (held at committee)

- **D1. No network request during a render.** Rendering any fixture, including a display name with
  characters outside the bundled font (non-Latin, emoji, the check mark), makes zero outbound requests.
  A character the font lacks degrades visibly in a predictable way (for example the card shows the
  handle as the name), never by fetching a font. Verify: a test that stubs `fetch` to record calls and
  asserts none across all fixtures. This also covers POLICY P6 (no third parties receiving user text)
  and makes render time independent of the network.
- **D2. Fit test, no pixel snapshots.** For every state × both canvases, plus the longest-content fixture
  (40-character name, 20-character handle, 12,345 trades, the longest trust cell, a failed import), the
  rendered PNG has **zero non-background pixels in its outer 16 px band**. Overflow in this renderer
  pushes the last rows into the margin, which is how my first two prototypes failed. This checks a
  property, not appearance, so it is not brittle the way snapshots are. The model snapshots stay JSON
  (agreed).
- **D3. Type-scale test.** Every font size in the card's scale object, times the canvas's 375 scale, is
  ≥ its §2 floor, and no element in the renderer sets a literal font size outside that object.
- **D4. Glyph whitelist.** Every string the model can produce (excluding the display name, covered by D1)
  uses only characters in the bundled font. Verify: the test reads the font's character map.
- **D5. No `fontWeight`** in the card renderer (it does not render, §0).
- **D6.** QA log: each §7 state on both canvases at full size and at 375 px, and the long-content
  fixture, viewed by a person, not just generated.

## 10. Acceptance checks (UX additions to the business lead's §8)

| # | Check | How |
|---|---|---|
| U1 | Wide is 1200 × 630, tall is 1080 × 1080, both `image/png`, ≤ 300 KB at every state and at 10,000 closes | e2e on both routes |
| U2 | Type floors (§2) hold on both canvases | D3 unit test |
| U3 | Nothing overflows or clips at the longest content | D2 margin-band test |
| U4 | Chart: first point 0%; domain contains 0 and every point; baseline and "0%" label present in every non-empty state; ≤ 400 points; low and high of a 10,000-trade record kept | Model test on the chart path and points |
| U5 | Line color: up if end > 0, down if end < 0, text if end = 0; the headline is colored by its own sign; a fixture with an average gain and a compounded loss renders one up and one down | Model test |
| U6 | Losing parity: mirrored fixture gives an identical model except colors, signs and the table cell; `contrast(up) − contrast(down)` ≤ 1.5; negative numbers use U+2212 | Model test plus contrast test |
| U7 | A nonzero bound never prints "0.0%"; a strong record with its high bound at −0.0004 prints "−0.04%" and the losses line | Unit test |
| U8 | Evidence pill: tier only, never "Edge" or "Past results"; present in every non-empty state | Model test plus banned-word scan |
| U9 | Range slot keeps its height when K < 5 (the chart's y position is the same as at K = 5) | Model layout test |
| U10 | Empty card: exact string "No closed trades yet", no chart, count, period or pill; the disclaimer and the state are present | Model test, both canvases |
| U11 | Every state has a non-empty badge, and "Verified" appears only when every closed trade is verified and the record is not demo | Model test across §7 |
| U12 | Every palette token is ≥ 4.5:1 on the card background | Contrast test |
| U13 | Zero outbound requests during render, any fixture | D1 |
| U14 | The alt text contains every visible string plus the chart sentence | Model test |
| U15 | The display name is cut with an ellipsis and the handle and badge stay whole at 40/20 characters | D2 fixture plus model test |

## 11. Compliance notes (COMPLIANCE §1, UX view)

- **§2 performance (F3, F4, TR-9):** the disclaimer is on every rendering and readable at 375 for the
  first time (32 px wide, one line). Losses have equal prominence by luminance, glyph width and tint (§6).
  The range is attached to "per trade". The evidence label is present, with no "edge" (F3b).
- **§3 privacy (P3, P6):** D1 is required. Without it, the display name can be sent to a font service
  during render. Nothing new is stored.
- **§9 accessibility (A1):** sign in text on every number, contrast table §8, and the alt text carries
  everything on the image.
- **T1 to T5:** no third-party names or marks on the card, the share stays the system share sheet, and
  no platform buttons.

## 12. Pre-authorization requests

None from the UX side. No new font, no dependency, no protected path.

## Disagreements for the owner

None of mine. I support the business lead's Q1, Q2 and Q6. My three differences from the business lead
are about how, not what, and are for this debate to settle: (1) the trade count is 44 px rather than 52 on
the wide card; (2) the area tint stays; (3) the period sits under the chart. Each has a test above, so
the committee can judge it on the rendered preview.
