# F-4 · Plan sign-off · UX lead

Date: 2026-10-24. Reviews `plan.md` (merged by the engineer) and `plan-round1-engineer.md` against
`docs/features/F-4-share-card.md`, POLICY (F1 to F6, P3, P6, T1 to T5, A1), DESIGN Stage 5 (CH-1, CH-2, TR-1 to
TR-9), IMPLEMENTATION step 1 (the plan decides how, never what), and my round 1 (U1 to U15, D1 to D6).
No decision in the feature file changes here. Nothing here is legal advice.

**Method.** The plan rests on the engineer's renders, which I take as measured. I added one check of my own: the
advance widths of every fixed-width, single-line slot's widest reachable string, read from the bundled font
(`node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf`, `cmap` + `hmtx`). I used a throwaway script in the
session scratchpad, with no repo file touched and no server run. It reproduces my round-1 disclaimer figure
(1,114 px at 32 px, −0.25 spacing), so it agrees with the renderer to within a few px. Kerning is ignored.
Three slots do not fit (finding F1). The rest of the plan holds.

## 1. My checks U1 to U15

| # | Verdict | Note |
|---|---|---|
| U1 | Accept | Dimensions, `image/png`, ≤ 300 KB: e2e on 4 profiles plus the render test on every state × both layouts |
| U2 | Accept | Scale floors (PR 2) plus the tree walk: every `fontSize` comes from the scale (PR 3). The count's floor is now 16 (see §3) |
| U3 | Accept with change | The band test only sees overflow at the canvas edge. It is blind to a no-wrap string running sideways across the column gap into the chart. Add D7 (§4) |
| U4 | Accept | |
| U5 | Accept with change | The headline is colored by the sign of the **printed** value. `pct()` prints a value that rounds to zero as "0.0%", unsigned, and that value is drawn in text color, never in up or down. Otherwise a down "0.0%" carries meaning by color alone (A1) |
| U6 | Accept | |
| U7 | Accept | The rule as the engineer wrote it (2, then 3, then 4 decimals). It applies to **range bounds only** (see change 3) |
| U8 | Accept | |
| U9 | Accept | Element-tree height test at K = 4 and K = 5 |
| U10 | Accept with change | Empty and importing bodies span the full content width on wide (change 2) |
| U11 | Accept | |
| U12 | Accept | |
| U13 | Accept with change | Add an NFD Latin name ("Jose" + U+0301) to the hostile names. It must draw "José", not fall back (change 5) |
| U14 | Accept | |
| U15 | Accept | Ellipsis was verified by the engineer. The glyph rule is in §3 |

## 2. My demands D1 to D6

| # | Verdict | Note |
|---|---|---|
| D1 | Accept with change | The mechanism is in §3. It also covers the host string on the tall card (change 4) |
| D2 | Accept | `flexShrink: 0` on every row is a good addition: overflow becomes visible to the test instead of rows silently overlapping |
| D3 | Accept | |
| D4 | Accept | The cmap equality test turns a Next upgrade that changes the font into a test failure. That is the right place for it to fail |
| D5 | Accept | |
| D6 | Accept | It does not need pre-authorization #9. The render test's PNGs (each state on both canvases at full size, plus a 375 px-wide downscale) are enough for a person to view and log. The running preview is for the committee's unfurl check |

## 3. The disputed points

| Point | Verdict | Reason |
|---|---|---|
| **Trade count 52 vs 44 px (wide)** | **Accept 52** | The engineer built my own layout with the longest content and it fits with about 40 px to spare, band clean. My overflow came from spacing, not the count. 52 meets the business lead's 16 CSS px primary floor with no exception. The fallback is right: move the count, never shrink it. **Change 6:** "losses included" always moves with the count, directly under it, in text color, because it qualifies the count |
| **Area tint kept** | **Accept** | I accept the engineer's correction: the built profile chart draws no tint. My argument (b), "it matches the profile", is withdrawn. Arguments (a) and (c) carry it: losing-record weight with no extra number, and CH-1 "Look". The business lead's thumbnail-noise concern is judged on the D6 downscales. If it reads as noise there, opacity goes down; the tint is not removed without the committee |
| **Period placement** (under the chart on wide; under the count on tall) | **Accept with change** | It labels the x-axis span. But its widest variant does not fit the 620 px column at 36 px: "Record since Oct 2026 · under a month" measures **653 px** (F1). "· 125 months" fits at 610. **Change 2:** on wide, the period is two inline pieces in a wrapping row ("Record since ‹Mon YYYY›" and "· ‹N› months"). It wraps to a second line at 36 px when it must, and is never shrunk. If the wrap then fails D2 on the longest fixture, the chart's plot height gives the room (176 → no less than 140), never a text size |
| **D1 fix: glyphs restricted to the bundled font, `@handle` for names outside it** | **Accept with change** | This is the only no-dependency route to zero requests, and it is predictable: a person's name is never altered or partly drawn. A name that partly falls back would be worse. Non-Latin names wait on P1 (owner). **Change 5:** coverage is checked on, and the name drawn as, `name.normalize('NFC')`. A decomposed "José" (e + U+0301) is the same text, and it must not lose the name because the combining mark alone is uncovered. **Change 4:** the tall card's link line takes its host from the configured public origin (`NEXT_PUBLIC_SITE_URL`, as `lib/auth/links.ts` and `siteUrl` already do), not from `url.host` as `story/route.tsx:28` does today. The printed URL is what a reader types, the image is publicly cached for 300 s, and a Host-header value is untrusted. Request host is the fallback only outside production. That makes the D4 "host" string a fixed, covered value |
| **3-PR split** | **Accept** | It separates the app-wide TR-9 change (needs no answer), the copy (the only part O1 gates) and the taste rounds. Each stays under the cap once deletions are counted. Between PR 1 and PR 3 the old card stays live with its old, compliant copy, and that is acceptable. PR 2 lands as unused code until PR 3, which is also fine |

## 4. New check from this review

- **D7 (PR 3, unit test; fixes U3's blind spot).**
  - What it checks: every single-line slot of fixed width must fit its slot at its size, using the widest string
    the model can produce for that slot.
  - Which slots: headline, the range lines, count, "losses included", the period piece, caption, pill, badge, and
    the disclaimer on wide.
  - How: measure with the font's advance widths. The D4 cmap reader plus `hmtx` is about 10 more lines of test
    code.
  - **F1, what fails today:**
    - Wide period: "under a month" is 653 px against a 620 px column. Fixed by change 2.
    - Headline: printed with `cardPct`'s 4-decimal step, it reaches 517 px ("−0.0004%") against the 480 px
      column. Fixed by change 3: the profile's `pct()` format peaks at 477 px ("+1234.5%", "≈−100.0%").
    - Empty headline: "No closed trades yet" at 72 px is 692 px against the 480 px headline slot. Fixed by the
      full-width empty body in change 2.
  - Lines allowed to wrap (range on tall, trust line, failed line, disclaimer on tall) stay covered by D2.

## 5. Other plan points

- **Accepted as written:** headline label "average return per trade"; the evidence pill (tier only, leading the
  trust line); link line on tall only, no wordmark; the palette and contrast figures; the type scale; the states
  table (with change 2); the budgets; the measures.
- **Engineering defaults accepted:**
  - direction for the trust line comes from the per-trade interval on the card;
  - "never by a count alone" means never by the trade count;
  - D ≥ 1;
  - `confidence()` stays in `lib/trades.ts`;
  - the frozen-record period ends at disconnect.
- **Why the per-trade direction is right:** DESIGN TR-9's verdict reads the pace interval. On the card, the words
  must never contradict the range printed beside them, and the plan lists this for the owner. That is enough.
- **"range" in the wording ban:** `plan.md` PR 2 says "95%", "range" and "confidence" never appear on the card.
  But the owner's approved too-early line reads "The range is still too wide to say much." **Change 1:** drop
  "range" from that list. Keep "95%" and "confidence". The owner's table wording governs, and the criterion-5
  reader list does not ban "range".
- **O1 to O3:** I support all three recommendations. If the owner takes O3 ("Based on N trades in K separate
  bets."), D2 and D7 re-run on the new longest cell. At 34 px, "Based on 2,828 trades in 4 separate bets. The range
  is still too wide to say much." is 1,273 px: still 2 lines beside the pill.
- **`tooEarlyText` (PR 1)** wording "Too early to tell: the range is still too wide (‹K› bets, ‹D› days)": accepted.
- **For later, not F-4:**
  - TR-4 open positions are deferred in code (`lib/trades.ts:207`). When they land, the card needs a slot as
    prominent as the headline (F4).
  - Whether a frozen record's card should name its disconnect date (TR-5) goes with the later-depth decision.

## 6. Changes I sign with (precise; none changes a decision or needs another round)

1. PR 2: remove "range" from the plan's "never appear on the card" list. "95%" and "confidence" stay banned, and
   the owner's too-early line is allowed verbatim.
2. PR 3, wide layout:
   - Empty and importing: the body spans the full 1,120 px content width. There is no chart column in those
     states.
   - The period: two inline pieces in a wrapping row, both at 36 px, as described in §3. If the wrap fails D2,
     the plot height shrinks (floor 140 px). No text shrinks.
3. PR 2:
   - The headline is printed in `pct()`'s format (the profile's: 1 decimal, zero reads "0.0%"), with U+2212 for
     the minus, so the card and the profile show the same number.
   - `cardPct`'s extra decimals apply to range bounds only (U7).
   - The headline color follows the printed sign: text color for "0.0%".
4. PR 3: the tall link line's host comes from `NEXT_PUBLIC_SITE_URL` (the existing site-origin helper). It falls
   back to the request host outside production only.
5. PR 2: glyph coverage is checked on `displayName.normalize('NFC')` and the NFC form is drawn. The U13 hostile
   names gain "Jose" + U+0301, which must render "José".
6. PR 3: "losses included" stays directly under the count, in text color, wherever the count is placed
   (including the under-the-chart fallback).
7. PR 3: add D7 (§4) to the render tests, with F1's three strings as fixtures.

SIGNED
