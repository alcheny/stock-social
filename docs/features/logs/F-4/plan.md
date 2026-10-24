# F-4 · Share card · Implementation plan

Date: 2026-10-24. Feature: `docs/features/F-4-share-card.md` (Status rework; decided by the owner 2026-10-22).
Inputs: `plan-round1-business-lead.md`, `plan-round1-ux-lead.md`, `plan-round1-engineer.md` (measurements and the
test-change list are there). This plan merges the three. It decides how, never what: no decision in the feature
file changes, and owner questions O1 to O3 are the owner's. Nothing here is legal advice.

Criteria are numbered 1 to 10 in the order of the feature file's acceptance criteria. U1 to U15 are the UX lead's
checks (all accepted).

Demo sentence (the bar): "Every trader's link unfurls into their real percent line from 0%, how many trades and how
long it covers, and one number with an honest range, losses included."

## 1. The PRs, in build order

Every PR, the same rules as F-2's:
- **Size:** ≤ 800 changed product lines (additions + deletions; tests, e2e and docs not counted, item #2).
- **Tests first:** written and failing before the code.
- **Docs:** reads `node_modules/next/dist/docs/` for the APIs it uses (`image-response.md`, `opengraph-image.md`)
  before coding (AGENTS.md).
- **Limits:** no protected path, no dependency, no font file, no vendor, no schema change.

| # | PR | Criteria and checks | Product lines | Waits on |
|---|---|---|---|---|
| 1 | TR-9 floor and width | 2 (t multiplier, range from 5 bets), 3 | 70–110 | nothing |
| 2 | Card model and trust copy | 1, 2 (card), 4, 5, 6, 7, 10 (model); U4–U8, U10–U12, U14, U15 (model half), D4 | 280–330 | PR 1; **merge waits on O1** |
| 3 | Render both images from the model | 8, 9, 10 (images); U1–U3, U9, U13, U15 (render half), D1–D3, D5, D6 | 430–520 (≈190 of it deletions) | PR 2 |

Why three PRs:
- **PR 1** changes behavior app-wide (feed order, profile, ticker pages) and needs no owner answer, so it merges first.
- **PR 2** holds every card string, so the one owner question that touches copy (O1) gates only that merge. The
  compliance-heavy review happens before any taste round.
- **PR 3** is visual and gets the taste rounds.

### PR-1 · TR-9 floor and width · `autopilot/feature-4-tr9` · ~70–110 lines · waits on nothing

- **Scope.**
  - **`lib/trades.ts`, TR-9 block:**
    - `export const MIN_BETS = 5` and `export const TOO_WIDE = 0.10` (half-width in simple-return points per trade).
      These are "the threshold recorded in the design record" (IMPLEMENTATION conflict 8). `confidence()` stays in
      `lib/trades.ts`, where DESIGN TR-9 places it, and its test stays in `lib/confidence.test.ts`.
    - `export const tooWide = (iv: Interval) => (iv.high - iv.low) / 2 > TOO_WIDE`. Exactly 0.10 is not too early.
    - `K < MIN_BETS`: too early, no intervals (as today).
    - `K ≥ MIN_BETS` and `tooWide(perTrade)`: tier `too-early` with **`perTrade` and `pace30` kept**, direction
      `null`.
    - Otherwise thin, moderate or strong by the existing K and span rules (unchanged).
  - **`evidenceWeight`** returns 0 for any too-early tier. Ranking changes only for records with 5 to 9 bets and a
    narrow range.
  - **Rename (IMPLEMENTATION conflict 9, BL item 9):** `Edge` → `Direction`, `edge` → `direction`, `edgeText` →
    `directionText`. Identifier-only, in its own commit. No user-visible string says "edge" (none does today).
  - **`tooEarlyText(c)`**, one helper, used by `evidenceLine` and by every page that printed "of 10 bets":
    - `app/t/[symbol]/page.tsx` (lines 137, 154; line 154's `c.k < 10` becomes `c.tier === 'too-early'`);
    - `app/t/[symbol]/HoldTime.tsx:28`, `app/t/[symbol]/Concentration.tsx:27`, `app/t/compare/page.tsx:74`.
    - It says "of 5 bets" / "5 independent bets needed" from `MIN_BETS`.
    - For too early by width: "Too early to tell: the range is still too wide (‹K› bets, ‹D› days)", so no page
      reads "12 of 5 bets". The UX lead may reword it within the same facts.
  - **Not changed:** `isNewRecord`'s 10 closed trades is TR-7, decided 2026-10-13, not the TR-9 floor. A comment
    says so.
- **Schema.** None.
- **Tests first.**
  - `tCrit95` at df 4, 9, 29, 99 against 2.776, 2.262, 2.045, 1.984 (±0.002). A hand-computed interval at K = 5
    using t(4) (criterion 2).
  - Range present at K = 5, absent at K = 4 (criterion 2).
  - `tooWide` at a half-width of exactly 0.10 → false; 0.10 + 1e-9 → true. `confidence()` with K = 200 and
    half-width 0.11 → too early with both intervals kept and weight 0 (criterion 3).
  - **"Never by a count alone"** (criterion 3):
    - 2,000 trades in 3 bets → too early;
    - K = 5 narrow with n = 5 → thin;
    - the same 5 bets with n = 5,000 overlapping trades → thin (the trade count never decides);
    - K = 4 with any n → too early.
  - Banned strings: no string `evidenceLine`/`tooEarlyText` can return contains "edge" or "of 10" (scan over
    generated `Confidence` values).
  - The 7 existing tests in `plan-round1-engineer.md` §7 have their expectations moved to the owner's floor; none is
    deleted or loosened. **`lib/feed.reach.test.ts` (PR-1b acceptance)** gets its premise restored from
    `MIN_BETS`/`TOO_WIDE` (newcomers are records with no evidence weight). If its slot assertion still fails, the
    business lead decides in PR 1's committee whether the F-2 new-record slot reads "tier too early" instead of
    "weight 0". The assertion is never loosened.
  - e2e (tester): a 6-bet record's profile shows a range and no "of 10"; the existing "Too early to tell" e2e checks
    still pass.
- **Acceptance (F-4):** 2 (the multiplier and the 5-bet floor), 3.
- **Policy checks:** TR-9 copy describes evidence only; ranking stays on the lower bound and is symmetric (existing
  sign tests unchanged).

### PR-2 · Card model and trust copy · `autopilot/feature-4-card-model` · ~280–330 lines · waits on PR 1; merge waits on O1

- **Scope.** Pure modules only; no route changes yet.
  - **`lib/record-card.ts`:** `recordCard(input) → CardModel`. Input: closed trades, record state, demo flag, frozen
    end (or null), now, handle, display name, host. Output: every string, color token, size role, the chart path
    per layout, and the alt text. No DB, no React.
    - **Headline:** the average return per trade (`headline().avgReturn`, as the profile shows, O2), labeled
      "average return per trade", colored by its own sign (up > 0, down < 0, text = 0). **No win-rate field.**
    - **Range:** "likely between ‹low› and ‹high›" whenever `perTrade` exists (K ≥ 5, including too early by width).
      Printed with `cardPct`: U+2212 for minus; a nonzero bound never prints "0.0%" (2, then 3, then 4 decimals,
      sign kept) (U7). "95%", "range" and "confidence" never appear on the card.
    - **Direction for the trust line:** from the per-trade interval on the card (positive if low > 0, negative if
      high < 0, else unclear). The line can never contradict the range beside it. Pace stays for ranking.
    - **`trustLine(c, closes)`:** the owner's table cell by cell, one constant table.
      - N: closed trades for too early, K bets otherwise.
      - Durations: D = max(1, floor(days)); M = floor(days / 30.44); Y = floor(days / 365.25). Singular and plural.
      - "Consistent" only in the strong tier, with the interval entirely on one side of 0, for losses exactly as for
        gains.
    - **`evidenceLabel(c)`:** "Evidence: too early / thin / moderate / strong" (tier only; never "Edge" or "Past
      results").
    - **Period:** "Record since ‹Mon YYYY› · ‹N› months".
      - Start: the earliest entry. End: now, or the latest `disconnected_at` when every consented connection is
        disconnected (a frozen record, TR-5).
      - N: whole calendar months, UTC. N = 0 reads "under a month", 1 reads "1 month".
      - Format pinned to `en-US` `{ month: 'short', year: 'numeric', timeZone: 'UTC' }`.
    - **Count:** "‹N› trades" with `count()` ("10,000 trades"; "1 trade"), plus "losses included".
    - **Chart:**
      - Series: `chartSeries(trades, 'ALL', now, CARD_POINTS = 400)` (TR-7: all-time only). The first point is 0,
        and the y domain is `curveDomain` (contains 0).
      - Geometry per layout: plot box, a 70 px gutter for "0%", the dashed baseline, `pathD`.
      - Color by its own end value. Area tint at 16% above (up) and below (down), one gradient with a hard stop
        at 0.
      - No dots, no end label, no ticks other than 0%. Caption "Return if every trade were the same size".
    - **State badge, never blank:** from `shareCardText`, with the check mark removed. When that label is null:
      "No broker connected" for state `none`, else "Broker connected". "Verified from broker" only for a connected,
      all-verified, non-demo record with closes. Demo reads "Demo data" in the same slot.
    - **Display name:** drawn only when every code point is in `CARD_GLYPHS`; otherwise the name slot shows
      `@handle` and the handle row is not repeated (D1, U15). Truncation with an ellipsis is the renderer's.
    - **Palette (images only):** bg #0b0b0f, text #f4f4f6, muted #a1a1ad, up #22c55e, down #fb7185, warn #f59e0b.
      **Type scale:** one exported object per layout (§3).
    - **Alt text:** `profileCardAlt(handle, card)` followed by every visible string and the chart sentence ("Line
      from 0% to ‹end› total, lowest ‹min›") (U14, A1).
    - `FORMATS`/`parseFormat` move here from `lib/story-image.ts` (removed in PR 3).
  - **`lib/card-glyphs.ts`:** Geist Regular's coverage as a ranges constant (112 ranges) plus `covered(s)`.
  - **`lib/copy.ts`:** `SHARE_CARD` gains `noBroker`, the trust-line table and the card labels. `shareCardText` is
    unchanged.
- **Schema.** None.
- **Tests first** (`lib/record-card.test.ts`, `lib/card-glyphs.test.ts`):
  - **Criterion 1:** ALL series, first point 0, domain contains 0; the count, period, name and handle strings.
  - **Criterion 2:** no win-rate field or string; headline with range at K = 5, without at K = 4; the range kept
    when too early by width.
  - **Criterion 4:** one assertion per table cell (8), plus plurals and singulars and the D/M/Y floors.
    - "Consistent" only for strong with the interval entirely above or below 0, tested for both signs.
    - Mirrored fixtures give mirrored cells.
  - **Criterion 5 (reader test):** every `trustLine`/`evidenceLabel` output and the full card text, scanned
    word-bounded and case-insensitive against: confidence interval, standard error, p-value, alpha, Sharpe, edge,
    signal, skill. Also scanned against the existing banned and PROMO lists. Longest cell ≤ 50 words with the
    disclaimer.
  - **Criterion 6:** the model has no per-trade field. Fixture symbols, closing times and holding periods appear in
    no string.
  - **Criterion 7 and U6 (parity):**
    - a losing fixture with the same K and span as a winning one gives a model equal in every field except color
      tokens, signed numbers and the table cell;
    - the line is down when its end < 0 and text color at exactly 0;
    - negatives use U+2212.
  - **U5:** an average gain with a compounded loss gives a headline in up and a line in down.
  - **U7:** a strong record with high bound −0.0004 prints "−0.04%" and the consistent-losses line.
  - **U10 and U11:** every state (winning, losing, flat, too early K < 5, too early by width, thin, moderate,
    strong, empty, importing, failed, demo, `none`):
    - the disclaimer string is present;
    - the badge is non-empty;
    - "Verified" only for connected + all verified + not demo;
    - empty is exactly "No closed trades yet" with no chart, count, period or pill.
  - **U12:** every palette token ≥ 4.5:1 on the background, computed; contrast(up) − contrast(down) ≤ 1.5.
  - **U2 (scale half):** every scale entry × (375 / canvas width) ≥ its floor.
  - **U14:** the alt text contains every visible string plus the chart sentence.
  - **D4:**
    - `CARD_GLYPHS` equals the cmap of `node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf` (a test-only
      cmap reader, formats 4 and 12);
    - every string the model can produce, over all fixtures, is covered;
    - a name in CJK, Arabic, emoji, "✓ Maya" or with a zero-width joiner falls back to `@handle`.
  - **Criterion 10 (model):**
    - JSON model snapshots of winning, losing and empty;
    - period at 0, 1 and 19 months plus a day-of-month boundary;
    - a frozen record ends at its disconnect;
    - 10,000 closes: ≤ 400 chart points, the record's minimum and maximum kept, "10,000 trades", model built in
      < 200 ms.
  - **Tester fixtures:**
    - a 40-character name;
    - a five-digit count with the longest cell;
    - a failed import;
    - a high-volatility record whose average sits outside its own range (O2, logged);
    - a record that stopped trading a year ago (period long, trust line short).
- **Acceptance (F-4):** 1, 2, 4, 5, 6, 7 and 10 (model level).
- **Policy checks:**
  - **F3b:** labels describe the sample, never skill or a future outcome.
  - **F2:** the scans above.
  - **F4/TR-9:** losses with the same prominence, by test.
  - **F3a:** Verified means broker-sourced only.
  - **Claims:** no "every trade" or "all trades".

### PR-3 · Render both images from the model · `autopilot/feature-4-card-render` · ~430–520 lines · waits on PR 2

- **Scope.**
  - **`lib/record-card-view.ts`:** `RecordCard({ model, layout, disclaimer })`, a function component built with
    `React.createElement`. It is a `.ts` module, so node can run the render tests.
    - Two layouts (§3).
    - Every row `flexShrink: 0`, so an overflow pushes the last row into the margin, where the band test sees it.
    - Every `fontSize` read from the scale object; no `fontWeight` anywhere (D5).
    - The range slot keeps a fixed height when empty (U9).
    - `disclaimer` is typed `typeof DISCLAIMER` (the literal), so it cannot be anything else.
  - **`lib/record-card-load.ts`:** one closed-trades read, `publicRecord`, `isDemoUser` and the frozen-end query,
    shared by both routes. That gives one demo rule (`isDemoUser`) and drops the story route's own check.
  - **`app/u/[handle]/opengraph-image.tsx`** (1200 × 630, wide) and **`app/u/[handle]/story/route.tsx`**
    (`square` 1080 × 1080 tall; `story` 1080 × 1920 tall with the existing safe-area padding) shrink to load → model
    → `new ImageResponse(<RecordCard model={m} layout=… disclaimer={DISCLAIMER} />, …)`. The story route keeps
    `Cache-Control: public, max-age=300`.
  - `lib/story-image.ts` is removed; its tests move (below).
  - **`app/u/[handle]/page.tsx`:** the `og:image` alt comes from the model (U14).
  - **`app/u/[handle]/share-prompt.tsx`:**
    - the sentence "the card is labelled New record" becomes false once the pill is cut (COMPLIANCE §11), so it is
      replaced by the model's trust line;
    - the preview alt comes from the model, not "N verified trade".
  - The Share button (`share-button.tsx`, `share-card.tsx`) is unchanged.
- **Schema.** None.
- **Tests first.**
  - **U13 (D1), `lib/record-card-render.test.ts`, node:test through the real `next/og`
    (`createRequire(import.meta.url)('next/og')`):**
    - stub `globalThis.fetch`, pass `data:` URLs through (the layout wasm loads from one), record every other URL;
    - render every state × both layouts plus the hostile names;
    - assert zero recorded calls and a valid PNG.
  - **U3 (D2):** decode each PNG with a test-only decoder on `node:zlib`. Assert zero pixels differing from the
    background by more than 2 per channel in the outer 16 px band, for every state × both layouts and the
    longest-content fixture. No pixel snapshots.
  - **U2 (D3):** walk the element tree; every `fontSize` is a scale value. **D5:** no `fontWeight` prop.
    **U9:** the range slot's height is equal at K = 4 and K = 5.
  - **One model (BL reviewer rule):** both route sources import `recordCard` and `RecordCard` and no other card
    code.
  - **Existing tests:**
    - `lib/story-image.test.ts` keeps all 7 tests with imports moved; 4 expectations follow owner decisions
      (`plan-round1-engineer.md` §7), properties kept;
    - `lib/share.test.ts` passes unchanged (`{DISCLAIMER}` stays in both route sources);
    - `lib/copy.test.ts` passes unchanged.
  - **e2e (U1, criterion 9):**
    - both routes answer 200 `image/png` with exact dimensions and ≤ 300 KB for a demo trader, an empty profile, a
      `none` profile and the heavy fixture;
    - the `og:image` alt equals the model's;
    - adding a close changes the image bytes (no stale cached card);
    - the existing image e2e checks pass unchanged.
  - **D6 (QA log):** each state on both canvases at full size and scaled to 375 px wide, plus the longest-content
    fixture, viewed by a person.
- **Acceptance (F-4):** 8, 9, 10 (images); U1–U3, U9, U13, U15.
- **Budgets:** §4.
- **Policy checks:** the disclaimer on every rendering, plain view at 375 (32 px wide, 30 px tall); no third-party
  request (P6, COMPLIANCE §1 item 7); no platform names (T5).

## 2. Acceptance criteria → PR → test

| # | F-4 criterion | PR | Test |
|---|---|---|---|
| 1 | Chart (single line, 0% on axis), trade count, period, name, handle | 2, 3 | model: series, domain, strings (U4); render: baseline and "0%" present (U13 run) |
| 2 | One headline with "likely between" from 5 bets; no win rate; Student's t, K − 1 | 1, 2 | `tCrit95` table at 4/9/29/99; K = 4/5; no win-rate field or string |
| 3 | Too early when K < 5 or half-width > threshold; never by a count alone | 1 | `tooWide` boundary; K = 200 wide; 2,000 trades in 3 bets; K = 5 with n = 5 and 5,000 |
| 4 | Evidence label plus a trust line from the fixed table; "consistent" only strong, one side of 0, both signs | 2 | 8 cells, plurals, mirrored signs |
| 5 | Reader test: no banned term | 2 | scan of every reachable string |
| 6 | No per-trade rows, closing times, holding periods | 2 | no field; fixture symbols absent |
| 7 | Losing record: same layout and prominence; line in down | 2, 3 | parity model test (U6); contrast gap ≤ 1.5; band test on the losing render |
| 8 | Disclaimer and Verified/Demo on every rendering, including empty | 2, 3 | state matrix (U10, U11); render matrix |
| 9 | Both share sizes; readable at 375 px | 2, 3 | scale floors (U2); e2e dimensions (U1); QA screenshots at 375 (D6) |
| 10 | Snapshots (winning, losing, empty); period 0/1/many; thousands of trades | 2, 3 | JSON model snapshots; period cases; 10,000-close model and render |

## 3. The card (layout decisions)

The UX lead's round-1 layout (§3 there) with these amendments, each settled in this debate:

| Point | Decision | Why |
|---|---|---|
| Trade count, wide | **52 px** (16.3 CSS px at 375), left column under the range | Measured fit with the longest content, about 40 px to spare, band clean. Keeps the business lead's primary floor without an exception. If a build fails D2, the count moves under the chart (also measured clean), never shrinks |
| Area tint | **Kept**, 16%, symmetric, one gradient | CH-1 "Look"; adds weight to a losing line without a number. The profile chart doesn't draw it yet (logged for later) |
| Period | Under the chart on wide; under the count on tall | Labels the x-axis span; frees the row the 52 px count uses |
| Headline label | "average return per trade" | The criterion's words; fits at 32 px |
| Evidence label | A pill leading the trust line, tier only | TR-9 "next to the headline numbers"; the sample size is in the sentence |
| Link line | Tall only (`host/u/handle`); no wordmark on either | A posted picture loses its URL; the unfurl is the link |
| Cut | Win rate, worst trade, "New record" pill, "95%" wording, dots, end label, ticks other than 0% | Owner decisions and both leads |

Type scale (source px; floors in CSS px at 375):

| Role | Wide 1200 | Tall 1080 | Floor |
|---|---|---|---|
| Headline | 108 | 132 | ≥ 32 |
| Name | 52 | 52 | ≥ 16 |
| Trade count | 52 | 46 | ≥ 16 |
| Range, period, trust line | 34–36 | 36–38 | ≥ 10.5 |
| Handle, badge, labels, caption, "0%", evidence pill, disclaimer | 32 | 30 | ≥ 10 |

The disclaimer is always the last row, never shrunk: one line on wide (32 px, letter-spacing −0.25), up to two on
tall.

## 4. Performance budgets

| Budget | Value | Measured (round 1) | Where checked |
|---|---|---|---|
| Image render at 10,000 closes | ≤ 1 s server time | 100–130 ms warm; 282 ms first in a process | PR 3 render test; e2e |
| PNG size, every state | ≤ 300 KB | 115–142 KB with tint and 400 points | PR 3 render test; e2e (U1) |
| Model build at 10,000 closes | < 200 ms | ≈ 27 ms (series, confidence, stats) | PR 2 |
| Chart points | ≤ `CARD_POINTS` = 400 | 400 | PR 2 |
| Outbound requests per render | 0 | 0 once glyphs are guarded; 1–2 (or a crash, for emoji) today | PR 3 (U13) |

## 5. States

| State | Badge | Body |
|---|---|---|
| Winning / losing / flat | Verified from broker (up) or Demo data (muted) | Full layout. Only color tokens, signs and the table cell differ |
| Too early, K < 5 | as above | Headline; empty range slot at full height; pill "Evidence: too early"; "Based on N trades. The range is still too wide to say much." |
| Too early, wide | as above | Headline **with** range; same pill and line |
| Thin / moderate / strong | as above | Headline, range, pill, the table's line |
| Empty | Broker connected (up), No broker connected (muted, state `none`), or Demo data | "No closed trades yet", then "The record starts with the first closed trade."; no chart, count, period, pill or trust line |
| Importing | Importing record (muted) | "Import in progress" + `SHARE_CARD.importingNote`; no stats (TR-3) |
| Import did not finish | Import did not finish (warn) | Full layout; `RECORD_BODY.failed` in warn takes the trust line's row; the pill is kept |
| Heavy | as above | Chart at ≤ 400 points; "10,000 trades" |

## 6. Policy checks (every PR)

- **Disclaimer (F3):** on every rendering, every state, both canvases, readable at 375 px, never shrunk; tested on
  the model (PR 2) and the pixels (PR 3).
- **No advice, no signal (F1, F3b):** one past average with its range, attached to "per trade". The trust line
  describes the sample; "consistent" describes the evidence, both signs. No ranking or call to action on the card.
- **No promissory language (F2):** the reader and PROMO scans.
- **Losses (F4, TR-1, TR-9):**
  - same layout, sizes and weight for wins and losses;
  - equal-luminance down color;
  - U+2212;
  - symmetric tint and cells.
- **Verified (F3a):** broker-sourced only; never for demo, importing, failed or `none`. No "every trade" or "all
  trades".
- **Privacy (P3, P6):**
  - percentages only;
  - no new data;
  - **zero third-party requests during render** (U13). Today a display name can leak to a font service: PR 3
    closes this for the record card.
- **Accessibility (A1):** signs in text on every number; every token ≥ 4.5:1; the alt text carries every word on
  the card.
- **Trademarks (T1, T5):** no platform names; the system share sheet only (unchanged).
- **No celebration (F6):** none on any state.

## 7. Compliance checklist (COMPLIANCE §1)

1. **Performance: yes → §2.**
   - Disclaimer and evidence label on every rendering.
   - Losses with equal prominence (tested).
   - The range is the documented TR-9 interval.
   - The trust copy is the owner's table, with one open question (O1).
   - No advice words, by scan.
2. **Personal data: no new data.**
   - The display name and handle are already public.
   - The render sends nothing to a third party (U13). That is a fix: today it can.
3. **Money: no.** Percentages only; `closed_trades` stores no quantities or prices.
4. **Email, push, SMS, tracking: no.** The §9 measures read existing columns and logs.
5. **User text: the display name, already shown.** Drawn only in covered glyphs, otherwise replaced by `@handle`;
   never altered.
6. **Sign-up, age, identity: no.**
7. **Vendor, dependency, font, image: none.**
   - `next/og` and its bundled Geist font are part of Next.
   - The glyph guard ensures nothing is fetched from another company's servers.
   - A wider font would be a new asset (P1, optional).
8. **Screen reader, no mouse: yes → §9.** Alt text with every word and the chart sentence; contrast tested; the
   image has no controls.
9. **Security posture: no change.** The same public routes; render cost bounded by downsampling and the existing
   cache header.
10. **Claims: yes → §11.**
    - "Verified from broker" is broker-sourced only.
    - "‹N› trades · losses included", never "every" or "all".
    - The share prompt's false "labelled New record" sentence is replaced (PR 3).
11. **Checkout: no.**

## 8. Owner questions (each blocks at most one merge; the build proceeds with the default)

| # | Question | Blocks | Default |
|---|---|---|---|
| O1 | The thin and moderate rows give "unclear or negative" one line. A record whose range lies entirely below 0 gets "results could go either way" / "no clear pattern yet" beside a range that says otherwise, while a positive record gets the plain line (business lead Q1; UX lead and engineer support the change) | **PR 2 merge** (hard stop 5) | The owner's table as written. The recommendation (positive and negative share the plain line; the hedge stays for unclear only) is a one-line change to one constant |
| O2 | The headline is the arithmetic average; the range is centered on the geometric average (TR-9). The headline can sit outside its own range: per-trade spread ≳ 75% at 30 bets, ≳ 40% at 100, **≳ 12% at 1,000**, so heavy, volatile traders are affected. The profile has the same issue today | nothing | Arithmetic, as the profile. The tester logs the fixture. Answer before real users |
| O3 | The too-early line counts trades ("Based on 2,828 trades.") when the record holds 3 bets | nothing | As written. Recommendation: "Based on N trades in K separate bets." when trades outnumber bets |

Engineering defaults (no owner decision changes; listed so the owner can see them):
- direction from the per-trade interval shown on the card;
- "never by a count alone" means never by the trade count;
- a frozen record's period ends at its disconnect;
- D ≥ 1 day;
- a display name outside the bundled font shows as `@handle`;
- `confidence()` and its constants stay in `lib/trades.ts`.

The owner's documents to bring in step (not blocking):
- IMPLEMENTATION conflict 8 names `lib/confidence.ts` (it is `lib/trades.ts`);
- DESIGN TR-9's Display line still prints "Edge: unclear · Evidence: thin (30 bets, 60 days)" (POLICY F3b bans
  "edge"; suggested "Evidence: thin (30 bets, 60 days)").

## 9. Pre-authorization requests

None is required for the build: no protected path, dependency, font, vendor, secret or deploy setting.

| # | Request | Needed before | Why |
|---|---|---|---|
| P1 (optional) | A self-hosted OFL font with wider script coverage (and its size), if the owner wants non-Latin display names on cards | nothing in F-4 | COMPLIANCE §8/C3: a font asset is the owner's; without it such names show as `@handle` |
| #9 (existing) | A running preview, or in-job `npm run start` plus screenshots at full size and 375 px | PR 3 committee | The committee judges the rendered images |

Follow-up outside F-4, for the owner's backlog:
- `app/u/[handle]/trade/[sellId]/opengraph-image.tsx` draws the display name and the **thesis text**, and the month
  image draws the name.
- Both have the same remote-font fetch and emoji crash as today's record card.
- Fix: apply `lib/card-glyphs.ts` after PR 2.
- I tried to queue this as a suggested task; the tool timed out.

## 10. What to measure after launch (no new tracking; the business lead's §9)

1. **Share rate:** connected traders who share within 7 days of `import_finished`, cohorts before and after PR 3.
2. **Share rate by tier and sign.** If too-early records share at under half the rate of thin-or-better records
   after 4 weeks, the owner gets it as a design question, never as a quiet copy change.
3. **Unfurl reach:** `/u/*/opengraph-image` requests per shared profile.
4. **Return trip:** signups with `referred_surface = 'profile'` per share.

## Sign-off

Business lead: SIGNED 2026-10-24 with changes C1–C7 (`plan-signoff-business-lead.md`), applied by the builder as written.

UX lead: SIGNED 2026-10-24 with 7 changes and check D7 (`plan-signoff-ux-lead.md`), applied by the builder as written.

Engineer: SIGNED 2026-10-24. I would stake my name on building every PR as written. My positions on the three
disputed points (52 px count, tint kept, period under the chart) are measured in `plan-round1-engineer.md` §4. I
re-sign without another round if a lead changes one of them on the rendered preview.

Plan signed 2026-10-24 by all three members. Where a business-lead change (C1–C7) and a UX-lead change overlap
(both drop "range" from the never-on-card list), they agree. Build starts with PR 1.

## Amendment: O1 answered (2026-10-24)

The owner answered O1: a range entirely below 0 gets its own line in the thin and moderate tiers (F-4 file,
Decisions 2026-10-24; wording in its Open questions, used by the build until the owner rewrites it). PR 2's merge
no longer waits on O1. The trust-line table grows from 8 to 10 cells; "tested for every cell" covers both new rows,
for losses as for gains. Direction stays as planned: from the per-trade interval on the card.
