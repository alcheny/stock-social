# F-34 · Implementation plan (UX lead, 2026-11-02, branch `claude/f34-open-positions-line` at fd1b6f1). Round 2

Input: `docs/features/F-34-one-open-positions-line.md`, including the owner's 2026-11-02 answer to OD 2.25: real users'
unrealized values keep showing, and every surface shows F-4's card line, lowest value first. Also F-4, F-6, F-12, F-20,
F-21, F-23 and F-29, the code cited below, and the round-1 feedback from the business lead (BL1–BL6) and the engineer
(EN1–EN7). This plan changes no decision. One AC detail needs the committee's sign-off: the image text, in Q11.

## Round 2 changes (each demand and how it is resolved)

| Demand | Resolution | Where |
|---|---|---|
| BL1: feed card in scope and required; TR-4 size and tone; same `withAsOf` bytes; e2e at 375 and 320 px | The feed card is now required, not droppable. It prints `withAsOf` with no "Also open:" label. Values use the card's body size and weight and `.up`/`.down`, and only the as-of words are muted. Delete the 0.875rem rule at `globals.css:850`. Each value and its word sit in a `white-space: nowrap` span, because `.open-also` keeps `overflow-wrap: anywhere` (`globals.css:551`) and could otherwise split "-15.0%" from "down". The line is already the minimum (title + split + spread + as-of), so the trim rule holds by construction and the line is never dropped. The e2e runs at 375 and 320 px | §1, §3, §8 |
| BL2: no reserved space in the pane | An absent F-21 or F-29 slot renders nothing. The 24 px headroom is an e2e assertion only. `PANE_LINES` and a DOM-order test own the order | §7 |
| BL3: the unfurl takes 2 rows in the typical case; chart share; the 15% rule | The 1200×630 images draw the image form (§2b). On the unfurl, 3 positions take 2 rows at 35 px, with the as-of on the spread row. A third row appears only when the split carries flats with two-digit counts or the values are long. Chart share: typical 21.3%. The worst 2-row case (failed + options + wide) is 12.5%, so the failed note moves to the label line (pre-approved), which brings it to 15.0%. The extreme 3-row case moves from 10.1% to 12.5%: an owner note, not a blocker | §3 |
| BL4: "losses included" stays at least 26 px, at least 4.5:1, inside the band | Asserted for every row of the fit matrix. The muted tone is `#8b8b98` on `#0b0b0f` (5.84:1) and the text tone is 17.88:1, both measured with `lib/colour-math.ts#contrast`. Every line stays inside x 309–891 (the `tooWide` check) | §3, §8 |
| BL5: merge risk; logic in new places; conflict hunks logged | New logic lives in `lib/open-split.ts` (facts, row packing, band transforms, step list), in the `openLine` block of `lib/copy.ts`, and in new test files. Other shared files get small call-site hunks only, listed in §8 with the expected conflicts. The build log lists each conflict hunk | §8 |
| BL6: ChartNote is a deletion; banned words | The plan deletes the `OPEN.line` tail. The bare prefix reads wrong, so it adds one plain string, with before and after shown in §3. The output scan bans "all positions", "every", "holdings" and "portfolio" | §3, §8 |
| EN1: the band fit was false | The image open block is redesigned (§2b, §3) and the matrix is re-run for trade and month (§3a). Result: **192 of 192 states fit with the disclaimer at 28 px or more**, and the open values are never smaller than the record rows or the losses words. 184 fit through ordinary steps. The 8 extreme month cases need a last step: a frozen line or a failed note gives way, and the alt and the page keep it (Q12). The States table now says frozen records do show positions | §3, §3a, §8 |
| EN2: alt text uses commas | `alt = withAsOf` with " · " turned into ", " and U+00A0 into a space, then ".". It contains no "·" and no parentheses. The equality AC compares the normalised form | §1, §2 |
| EN3: list every expectation change | All listed in §8 | §8 |
| EN4: merge note corrected | Neither PR touches `record-card-image.tsx`. The real conflicts are recorded in §8 | §8 |
| EN5: filter `display-log.ts:140` too | Added | §4 |
| EN6: the `allCopy` walker | The open-line words are plain strings (`OPEN_LINE`), and `openCopy()` lists the `openLine` outputs for the state fixtures explicitly | §1 |
| EN7: count statements; `asOf` is the MIN | The query AC counts statements. `openRead`'s `asOf` is `min(fetched_at)` from the same single statement | §5, §8 |
| EN (adopted): the pane JSON carries the server-built line | `model.openLine` carries `{ text, parts, withAsOf }`. There is no `openRange`. `PAYLOAD_V` goes from 2 to 3 | §6 |
| Settled | Q2: lower-case up/down/flat. Q3: keep the count tile, with the caption "open positions". Q5: stock pages get the filter only. Q6: ponytail. Q8: an owner note, not a blocker, since BL3's 15% rule holds for the worst 2-row case | §10 |

---

The rule in one line: **one pure function makes the open line. HTML surfaces and descriptions print its `text`
(`withAsOf` where dated) byte for byte. Alts print the comma form. The 1200×630 images print its image form, with the
same parts and the date with the year. Every `open_positions` reader uses one account filter, and the date is the
stored MIN(`fetched_at`) from the read the surface already makes.**

## 1. The one producer

**Where:** `lib/copy.ts`, in one new `openLine` block beside `SHARE_CARD` and `OPEN`. The numbers and the layout helpers
live in `lib/open-split.ts`, which is string-free and imports only `lib/format.ts`, plus `import type` for `ImageLine`,
which is erased at runtime, so there is no cycle. `record-strip.ts` already imports `record-card.ts`, so the producer
cannot live there without a cycle.

```ts
// lib/open-split.ts (string-free, additive)
export type OpenFacts = { n: number; up: number; down: number; flat: number; low: number; high: number };
export function openFacts(pcts: number[]): OpenFacts | null            // openSummary() + min/max of the finite values
export function packRows(items: { sep: string; text: string }[], size: number, width: number, glyph = 0.6): string[] | null
export const OPEN_BAND_STEPS: readonly OpenBandStep[]                     // §3, in order
export function openBandTransform(lines: ImageLine[], block: ImageLine[], step: OpenBandStep): ImageLine[] | null

// lib/copy.ts, the openLine block: the only producer of the open line.
export const OPEN_LINE = { lowest: 'lowest', highest: 'highest', at: 'at', up: 'up', down: 'down', flat: 'flat',
  asOfPrefix: 'unrealized as of', imageAsOfPrefix: 'as of', chartNoteTail: 'open positions.' } as const; // plain strings (EN6)
export type OpenLinePart = { role: 'title' | 'split' | 'at' | 'low' | 'high'; label: string; value: string | null; word: string | null; tone: Tone | null; sep: '' | ' · ' | ', ' };
export type OpenLine = {
  text: string;        // "Still open: 3 positions · 2 up, 1 down · lowest -15.0% down, highest +4.0% up"
  parts: OpenLinePart[];
  asOf: string;        // "unrealized as of Sep 30, 2026" (year always)
  withAsOf: string;    // `${text}, ${asOf}`: trade and month pages, feed card, all three descriptions
  alt: string;         // withAsOf with " · " → ", " and U+00A0 → " ", then "." (EN2: no "·", no parentheses)
  image: { title: string; asOf: string }; // "Still open: 3" and "as of Sep 30, 2026" (the image form, §2b)
};
export function openLine(f: OpenFacts | null, asOf: Date | null): OpenLine | null
```

- `text` is the parts joined with their separators, with the value and word joined by U+00A0. A unit test pins this as a
  property of the parts.
- `tone` is `lib/format.ts#tone` applied to the printed value (F-19).
- `asOf` uses `dateText(d, d, { year: 'always' })`.
- A null fact or a null date returns null. The function never prints an undated value, and each surface then renders
  exactly what it renders today with no open positions.
- `cardOpen` in `lib/record-card.ts` becomes a thin adapter. `CardOpen` gains `line`, and its existing fields are derived
  from `line.parts`.
- Retired: `SHARE_CARD.openShort`, `openNote`, `openAlt`, `OPEN.feedLabel`, `feedCounts`, `feedTail`, and the
  `role: 'open'` text in `recordStrip`.
- Kept: `SHARE_CARD.openFull`, read only by `openLine`, and `OPEN.line`, read only under `app/t/**` (Q5).
- `openCopy()` lists `openLine` outputs for the §2 state fixtures explicitly (EN6). The fixtures use the open-split
  test inputs, so the banned-word scan in `open-split.test.ts:83` checks the new outputs.

### How each surface uses it

| Surface | Code | Prints |
|---|---|---|
| Card image, square and story | `record-card-image.tsx`, drawing `m.open.line.parts` | `text` in F-4's block, then `asOf` (muted) |
| Card image, unfurl (1200×630) | the same file | image form, 2 rows typical (§3) |
| Card alt | `cardAlt` | `line.alt` |
| Profile link-preview description | `page.tsx#generateMetadata` → `cardDescription(card, card.open?.line.withAsOf)` | `withAsOf` |
| Profile page | `OpenGrid` gains a `line` prop: `<p class="open-line" data-open-line>` as the grid's last row | `text` (the date stays in the grid label) |
| Pane, feed and `/pane` JSON | `ProfilePane` prints `model.openLine` (server-built, §6) | `text` |
| Trade and month pages | `recordStrip(…, 'page')`: the `open` part, rendered as its own block by `Figures` | `withAsOf` |
| Trade and month images | `stripImageLines` → the open block (§3) | image form |
| Trade and month alts | `recordStrip(…).alt` | `line.alt` |
| Trade and month descriptions | `stripTextAfterCount(strip)` (it carries the `open` part) | `withAsOf` |
| **Feed card (required, BL1)** | `app/ui.tsx#TradeCard`: `<p class="open-also" data-open>` with the parts | `withAsOf`, no label |

## 2. The exact wording

### 2a. `text`, which every non-image surface prints (· = " · ", ⍽ = U+00A0)

Each value is followed by its tone word, so a negative value has a minus sign and "down" and never depends on colour
(POLICY A1). Positive and flat values get their word too. The minus is `pct()`'s hyphen-minus (F-19's U+2212 sweep is
pending). `≈-100.0%` reads `≈-100.0%⍽down`.

| State | `text` |
|---|---|
| Mixed (the AC fixture `[-0.15, 0.04, 0.012]`) | `Still open: 3 positions · 2⍽up, 1⍽down · lowest -15.0%⍽down, highest +4.0%⍽up` |
| All losing | `Still open: 3 positions · 0⍽up, 3⍽down · lowest -21.5%⍽down, highest -3.1%⍽down` |
| All winning | `Still open: 3 positions · 3⍽up, 0⍽down · lowest +2.0%⍽up, highest +40.0%⍽up` |
| One position | `Still open: 1 position · at -8.0%⍽down` |
| One, flat | `Still open: 1 position · at 0.0%⍽flat` |
| All flat | `Still open: 2 positions · 0⍽up, 0⍽down, 2⍽flat · at 0.0%⍽flat` |
| Printed alike | `Still open: 2 positions · 2⍽up, 0⍽down · at +5.0%⍽up` |
| 1,000+ | `Still open: 1,204 positions · …` (`count()` grouping) |

- `withAsOf`: `… highest +4.0%⍽up, unrealized as of Sep 30, 2026`
- `alt`: `Still open: 3 positions, 2 up, 1 down, lowest -15.0% down, highest +4.0% up, unrealized as of Sep 30, 2026.`
- Banned in any output (BL6, scanned): "all positions", "every", "holdings", "portfolio". Also no advice words and no
  amounts (P3).

### 2b. Image form, for the unfurl, trade and month images

The band is 582 px wide, and at the 26 px floor a row holds at most 37 characters. The full title plus the split is 38
characters, so the full `text` needs 4 or 5 rows. The engineer's measurements and mine (§3a) show that this cannot fit
every state. The 1200×630 images therefore draw the same parts with two substitutions, both produced by `openLine`:

- `Still open: 3 positions` → `line.image.title` = `Still open: 3`. The count stays and the noun drops.
- `unrealized as of …` → `line.image.asOf` = `as of Sep 30, 2026`. The date with its year stays. The alt keeps
  "unrealized".

The image text is `image.title` · split · low, high · `image.asOf`, packed into rows by `packRows`:
- A row never breaks inside a part, and a value never breaks from its word.
- The as-of comes after the values. It moves next to the title only when that saves a row (the "date-first" order).
- Example (3 positions, mixed): `Still open: 3 · 2 up, 1 down` / `lowest -15.0% down, highest +4.0% up` / `as of Sep 30, 2026`.

The square and story pictures have room for, and print, the full `text` plus `asOf`.

Equality (Q11): an image's rows, joined with their separators, equal `imageText(line)` or `imageTextDateFirst(line)`
exactly. Mapping `image.title` back to the title and `image.asOf` back to `asOf` gives `withAsOf`. That mapping is a
unit-tested property, and every fact is shown.

## 3. Prominence (TR-4), placement and fit

The line always sits in the headline figures' block. It is never in a caption, a chart note or a foot. On pages, values
take `.up` / `.down` (the `--up` / `--down` tokens; the feature file's `--loss` is `--down`). On images they take
`IMAGE_COLOURS[tone]` / `IMAGE_PALETTE.card[tone]`, never a literal hex. A loss is drawn at the size and weight of a gain,
and no value is ever muted. Only the as-of words may be muted.

- **Profile and pane:** the line sits inside `OpenGrid`, under its two tiles, full width, at body size. The count tile's
  caption becomes "open positions" (Q3).
- **ChartNote (BL6), a deletion:**
  - Delete `{OPEN.line(o, pct)}` at `app/open-rows.tsx:41`.
  - Before: `Chart: closed trades only. Not plotted: 6 open positions · 1 up, 5 down · -23.0% avg unrealized`
  - After the deletion alone: `Chart: closed trades only. Not plotted: `, which ends on a colon and reads wrong.
  - So the plan adds one plain string, `OPEN_LINE.chartNoteTail`: `Chart: closed trades only. Not plotted: open positions.`
- **Trade and month pages:** the strip's `open` part renders as `<span class="strip-open" data-open-line>`, its own block
  inside `p.record-strip`, right after "losses included", at the strip's size, with toned `<b>` values.
- **Feed card (BL1):** `<p class="open-also" data-open>` prints `withAsOf`.
  - Size and weight: the card's body (delete the `.feed .card .open-also { font-size: 0.875rem; }` rule at
    `globals.css:850`).
  - Values are `<b class="up|down"><span class="nw">-15.0% down</span></b>`, with a one-line rule
    `.open-also .nw { white-space: nowrap; }`.
  - The as-of words are in `<span class="muted">`. There is no "Also open:" label.
  - At 320 px the line may wrap to 3 lines with long values. It is never trimmed further and never dropped.
- **Card, square and story:** F-4's block. The title is at `f.line` size, the `asOf` words are muted on the title's row
  (where "unrealized, not sold yet" sat), and the split and spread row is at body size.
- **Card, unfurl (BL3):** the image form at 35 px (the 10 CSS px floor), packed into the full 1120 px width, at most 53
  characters a row at 0.6 em.
  - Typical (3 positions): 2 rows, `Still open: 3 · 2 up, 1 down · lowest -15.0% down` / `highest +4.0% up · as of Sep 30, 2026`.
  - One position: 2 rows.
  - 3 rows only when the split carries flats with two-digit counts, or the values are long (`-99.98%`, `+1088.7%`).
  - `openCut` = rows × 41 (today 1 × 41). The model counts rows with `packRows`, so the cut is deterministic.

### Unfurl chart share (plot box ÷ 1200×630; chart 556×372, `noteCut`/`openCut` 41 a row, wide shift 100)

| Case | Plot | Share |
|---|---|---|
| Today, with open positions (1 row) | 556×331 | 24.3% |
| Typical: 3 positions, 2 rows | 556×290 | **21.3%** |
| Typical + options line | 556×249 | 18.3% |
| Wide average, 2 rows | 456×290 | 17.5% |
| Worst 2-row: failed note + options + wide | 456×208 | 12.5% → under 15%: **the failed note moves to the label line** (BL3, pre-approved) → 456×249 = **15.0%** |
| Extreme 3-row (flats with two-digit counts or long values) + failed + options + wide | 456×167 | 10.1% → with the note moved, 456×208 = **12.5%**: an owner note (Q8), not a blocker |

### Strip images (trade and month): the open block and its fit rules

The open block is the image form at size `o`, with row 0 at weight 700. Roles are `open0..openN`, and the block is
tagged `block: 'open'`. It sits after the record's figures (and the options row) and before the frozen and note lines.
The values come from `IMAGE_COLOURS`. Size rules:

- With an open block, the record rows (count, average, range) are drawn at `r` ∈ {30, 28, 26}. The image form's first
  row is 28 characters and does not fit at 35 px.
- The open values are never smaller than the record rows (`o ≥ r`) or than the words "losses included" (TR-4; EN1's
  rule).
- The disclaimer is never below 28 px (D-09).
- Images with no open positions are unchanged byte for byte, because every rule below applies only when `strip.open` is
  set.

`tradeBand` / `monthBand` call one small hunk, `if (strip.open) return openBand(…)`. `openBand` runs the first-fit search
in `lib/open-split.ts`, in this order (the outer loop changes last):

1. **Size class** `r` = 30, then 28, then 26.
2. **Thesis kept, then given way** (trade). "One of N months" gives way first on the month image (it is already optional).
3. **Disclaimer** 35 → 32 → 30 → 28.
4. **Hero** (existing loops). Trade: symbol 80 → 40, held 30 → 26. Month: label 52 → **32** (new floor, from 36; it stays
   above `r` ≤ 30), figures 30 → 26.
5. **"losses included"** on its own row at size `o`, or else joined to the count row (`48 closed trades · losses
   included`) when that row stays at least 26 px and at most `o`.
6. **Failed note** in 2 rows, or else 1 row: `This record may be incomplete.`, the second clause of `RECORD_BODY.failed`,
   because the label row already says "Import did not finish". This is a new image-only string, `RECORD_BODY.failedShort`.
7. **Options qualifier** on its own row, or else joined to the count row (the existing fallback, now also tried when an
   open block is present).
8. **Frozen line:** `record frozen` rides the open block's last row when that row holds the as-of and fits
   (`as of Sep 30, 2026 · record frozen`). "Disconnected ‹date›" then stays as one row.
9. **Open size** `o` = 30, then 28, then 26, never below `r`.
10. **Gaps:** between blocks 4 → 3 → 2 px. Inside a wrapped block (open rows, note rows, frozen rows, disclaimer rows)
    there is no gap, because the 1.2 line height already spaces them. This applies only when an open block is present.
11. **Last step** (Q12; reached only by the 8 extreme month cases in §3a): a frozen line beside an open block, and a
    failed note, give way on the image. The label row keeps "Import did not finish", and the page and the alt keep both
    lines in full. This extends the existing rule that the frozen line gives way beside a failed note.

Never dropped: any open part, the as-of, the record count, average and range, "losses included", the label, and the
disclaimer. "losses included" is at least 26 px, at least 4.5:1 (muted `#8b8b98` on `#0b0b0f` is 5.84:1; on the count
row it is in the text tone, 17.88:1) and inside x 309–891 in every row of the matrix (BL4, asserted). The values are
`#ff8a5b` (8.46:1) and `#3cc4b4` (9.12:1).

### 3a. Fit matrix (run 2026-11-02, Node 24)

The matrix is the pure model above over today's `stripImageLines`, `tradeHero` and a copy of `monthHero` (which is not
exported). Fixture: a fictional 48-trade record, a 10-character symbol at −98.7%, a long thesis, September 2026.

Axes: kind (trade, month) × handle length 10 or 20 × state (connected, failed) × options × frozen × open positions
1 / 3 (`2 up, 1 down`) / 12 (`3 up, 8 down, 1 flat`) × long values (`-99.98%`, `+1088.7%`). That is 192 states.

The script, which the engineer turns into `lib/f34-open-band.test.ts`, is
`/tmp/claude-0/-home-user-stock-social/f8ed5835-8675-52ba-af3a-e662aa8c102e/scratchpad/f34-fit-matrix.ts`. Run it with
`STRICT=1 DATEFIRST=1 R26=1 INTRA=all` (add `LAST=1` for the last step).

**Result: 192/192 fit, all with the disclaimer at 28 px or more.**
- Disclaimer size: 35 px in 112 states, 32 in 24, 30 in 36, 28 in 20.
- Record and open size: 30 px in 104, 28 in 30, 26 in 58.
- 184 states fit through steps 1–10. The other 8 (month · options · frozen or failed · long values or 12 positions) need
  step 11.
- Smallest spare: 0.0 px. Every line is inside the band, and "losses included" is at least 26 px in every state.
- The full-text block, keeping the title "Still open: ‹n› positions", leaves 44 states with no fit, or 8 even with
  step 11. That is why §2b uses the image form.

<details><summary>All 192 states</summary>

```
trade h=10 connected opts=n frozen=n n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=4 spare=14.0
trade h=10 connected opts=n frozen=n n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=4 spare=14.0
trade h=10 connected opts=n frozen=n n= 3 long=n | disc=35 hero=80/30 record=30 losses=count open=30 gap=4 gave way: thesis spare=19.6
trade h=10 connected opts=n frozen=n n= 3 long=Y | disc=35 hero=80/30 record=30 losses=count open=30 gap=4 gave way: thesis spare=19.6
trade h=10 connected opts=n frozen=n n=12 long=n | disc=35 hero=40/30 record=30 losses=count open=30 gap=3 gave way: thesis spare=0.0
trade h=10 connected opts=n frozen=n n=12 long=Y | disc=35 hero=40/30 record=30 losses=count open=30 gap=3 gave way: thesis spare=0.0
trade h=10 connected opts=n frozen=Y n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=2.8
trade h=10 connected opts=n frozen=Y n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=2.8
trade h=10 connected opts=n frozen=Y n= 3 long=n | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 gave way: thesis spare=4.8
trade h=10 connected opts=n frozen=Y n= 3 long=Y | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 gave way: thesis spare=4.8
trade h=10 connected opts=n frozen=Y n=12 long=n | disc=32 hero=40/30 record=28 losses=count open=28 gap=2 frozen+as-of gave way: thesis spare=4.4
trade h=10 connected opts=n frozen=Y n=12 long=Y | disc=32 hero=40/30 record=28 losses=count open=28 gap=2 frozen+as-of gave way: thesis spare=4.4
trade h=10 connected opts=Y frozen=n n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=4 gave way: thesis spare=9.2
trade h=10 connected opts=Y frozen=n n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=4 gave way: thesis spare=9.2
trade h=10 connected opts=Y frozen=n n= 3 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 options→count gave way: thesis spare=0.0
trade h=10 connected opts=Y frozen=n n= 3 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 options→count gave way: thesis spare=0.0
trade h=10 connected opts=Y frozen=n n=12 long=n | disc=32 hero=40/30 record=28 losses=own open=28 gap=2 options→count gave way: thesis spare=2.4
trade h=10 connected opts=Y frozen=n n=12 long=Y | disc=32 hero=40/30 record=28 losses=own open=28 gap=2 options→count gave way: thesis spare=2.4
trade h=10 connected opts=Y frozen=Y n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 options→count gave way: thesis spare=7.6
trade h=10 connected opts=Y frozen=Y n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 options→count gave way: thesis spare=7.6
trade h=10 connected opts=Y frozen=Y n= 3 long=n | disc=32 hero=40/30 record=28 losses=own open=28 gap=2 options→count gave way: thesis spare=5.2
trade h=10 connected opts=Y frozen=Y n= 3 long=Y | disc=32 hero=40/30 record=28 losses=own open=28 gap=2 options→count gave way: thesis spare=5.2
trade h=10 connected opts=Y frozen=Y n=12 long=n | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 frozen+as-of gave way: thesis spare=0.4
trade h=10 connected opts=Y frozen=Y n=12 long=Y | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 options→count frozen+as-of gave way: thesis spare=2.4
trade h=10 failed opts=n frozen=n n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=2.8
trade h=10 failed opts=n frozen=n n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=2.8
trade h=10 failed opts=n frozen=n n= 3 long=n | disc=35 hero=80/30 record=30 losses=count open=30 gap=2 note 1 row gave way: thesis spare=2.4
trade h=10 failed opts=n frozen=n n= 3 long=Y | disc=35 hero=80/30 record=30 losses=count open=30 gap=2 note 1 row gave way: thesis spare=2.4
trade h=10 failed opts=n frozen=n n=12 long=n | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: thesis spare=0.0
trade h=10 failed opts=n frozen=n n=12 long=Y | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: thesis spare=0.0
trade h=10 failed opts=n frozen=Y n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: frozen1+frozen+thesis spare=2.8
trade h=10 failed opts=n frozen=Y n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: frozen1+frozen+thesis spare=2.8
trade h=10 failed opts=n frozen=Y n= 3 long=n | disc=35 hero=80/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+thesis spare=2.4
trade h=10 failed opts=n frozen=Y n= 3 long=Y | disc=35 hero=80/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+thesis spare=2.4
trade h=10 failed opts=n frozen=Y n=12 long=n | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+thesis spare=0.0
trade h=10 failed opts=n frozen=Y n=12 long=Y | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+thesis spare=0.0
trade h=10 failed opts=Y frozen=n n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=7.6
trade h=10 failed opts=Y frozen=n n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=7.6
trade h=10 failed opts=Y frozen=n n= 3 long=n | disc=28 hero=40/30 record=30 losses=own open=30 gap=2 note 1 row options→count gave way: thesis spare=0.4
trade h=10 failed opts=Y frozen=n n= 3 long=Y | disc=28 hero=40/30 record=30 losses=own open=30 gap=2 note 1 row options→count gave way: thesis spare=0.4
trade h=10 failed opts=Y frozen=n n=12 long=n | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 gave way: thesis spare=0.4
trade h=10 failed opts=Y frozen=n n=12 long=Y | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 note 1 row gave way: thesis spare=0.4
trade h=10 failed opts=Y frozen=Y n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: frozen1+frozen+thesis spare=7.6
trade h=10 failed opts=Y frozen=Y n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: frozen1+frozen+thesis spare=7.6
trade h=10 failed opts=Y frozen=Y n= 3 long=n | disc=28 hero=40/30 record=30 losses=own open=30 gap=2 note 1 row options→count gave way: frozen1+frozen+thesis spare=0.4
trade h=10 failed opts=Y frozen=Y n= 3 long=Y | disc=28 hero=40/30 record=30 losses=own open=30 gap=2 note 1 row options→count gave way: frozen1+frozen+thesis spare=0.4
trade h=10 failed opts=Y frozen=Y n=12 long=n | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 gave way: frozen1+frozen+thesis spare=0.4
trade h=10 failed opts=Y frozen=Y n=12 long=Y | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 note 1 row gave way: frozen1+frozen+thesis spare=0.4
trade h=20 connected opts=n frozen=n n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=4 spare=14.0
trade h=20 connected opts=n frozen=n n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=4 spare=14.0
trade h=20 connected opts=n frozen=n n= 3 long=n | disc=35 hero=80/30 record=30 losses=count open=30 gap=4 gave way: thesis spare=19.6
trade h=20 connected opts=n frozen=n n= 3 long=Y | disc=35 hero=80/30 record=30 losses=count open=30 gap=4 gave way: thesis spare=19.6
trade h=20 connected opts=n frozen=n n=12 long=n | disc=35 hero=40/30 record=30 losses=count open=30 gap=3 gave way: thesis spare=0.0
trade h=20 connected opts=n frozen=n n=12 long=Y | disc=35 hero=40/30 record=30 losses=count open=30 gap=3 gave way: thesis spare=0.0
trade h=20 connected opts=n frozen=Y n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=2.8
trade h=20 connected opts=n frozen=Y n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=2.8
trade h=20 connected opts=n frozen=Y n= 3 long=n | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 gave way: thesis spare=4.8
trade h=20 connected opts=n frozen=Y n= 3 long=Y | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 gave way: thesis spare=4.8
trade h=20 connected opts=n frozen=Y n=12 long=n | disc=32 hero=40/30 record=28 losses=count open=28 gap=2 frozen+as-of gave way: thesis spare=4.4
trade h=20 connected opts=n frozen=Y n=12 long=Y | disc=32 hero=40/30 record=28 losses=count open=28 gap=2 frozen+as-of gave way: thesis spare=4.4
trade h=20 connected opts=Y frozen=n n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=4 gave way: thesis spare=9.2
trade h=20 connected opts=Y frozen=n n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=4 gave way: thesis spare=9.2
trade h=20 connected opts=Y frozen=n n= 3 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 options→count gave way: thesis spare=0.0
trade h=20 connected opts=Y frozen=n n= 3 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 options→count gave way: thesis spare=0.0
trade h=20 connected opts=Y frozen=n n=12 long=n | disc=32 hero=40/30 record=28 losses=own open=28 gap=2 options→count gave way: thesis spare=2.4
trade h=20 connected opts=Y frozen=n n=12 long=Y | disc=32 hero=40/30 record=28 losses=own open=28 gap=2 options→count gave way: thesis spare=2.4
trade h=20 connected opts=Y frozen=Y n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 options→count gave way: thesis spare=7.6
trade h=20 connected opts=Y frozen=Y n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 options→count gave way: thesis spare=7.6
trade h=20 connected opts=Y frozen=Y n= 3 long=n | disc=32 hero=40/30 record=28 losses=own open=28 gap=2 options→count gave way: thesis spare=5.2
trade h=20 connected opts=Y frozen=Y n= 3 long=Y | disc=32 hero=40/30 record=28 losses=own open=28 gap=2 options→count gave way: thesis spare=5.2
trade h=20 connected opts=Y frozen=Y n=12 long=n | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 frozen+as-of gave way: thesis spare=0.4
trade h=20 connected opts=Y frozen=Y n=12 long=Y | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 options→count frozen+as-of gave way: thesis spare=2.4
trade h=20 failed opts=n frozen=n n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=2.8
trade h=20 failed opts=n frozen=n n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=2.8
trade h=20 failed opts=n frozen=n n= 3 long=n | disc=35 hero=80/30 record=30 losses=count open=30 gap=2 note 1 row gave way: thesis spare=2.4
trade h=20 failed opts=n frozen=n n= 3 long=Y | disc=35 hero=80/30 record=30 losses=count open=30 gap=2 note 1 row gave way: thesis spare=2.4
trade h=20 failed opts=n frozen=n n=12 long=n | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: thesis spare=0.0
trade h=20 failed opts=n frozen=n n=12 long=Y | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: thesis spare=0.0
trade h=20 failed opts=n frozen=Y n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: frozen1+frozen+thesis spare=2.8
trade h=20 failed opts=n frozen=Y n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: frozen1+frozen+thesis spare=2.8
trade h=20 failed opts=n frozen=Y n= 3 long=n | disc=35 hero=80/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+thesis spare=2.4
trade h=20 failed opts=n frozen=Y n= 3 long=Y | disc=35 hero=80/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+thesis spare=2.4
trade h=20 failed opts=n frozen=Y n=12 long=n | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+thesis spare=0.0
trade h=20 failed opts=n frozen=Y n=12 long=Y | disc=28 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+thesis spare=0.0
trade h=20 failed opts=Y frozen=n n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=7.6
trade h=20 failed opts=Y frozen=n n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: thesis spare=7.6
trade h=20 failed opts=Y frozen=n n= 3 long=n | disc=28 hero=40/30 record=30 losses=own open=30 gap=2 note 1 row options→count gave way: thesis spare=0.4
trade h=20 failed opts=Y frozen=n n= 3 long=Y | disc=28 hero=40/30 record=30 losses=own open=30 gap=2 note 1 row options→count gave way: thesis spare=0.4
trade h=20 failed opts=Y frozen=n n=12 long=n | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 gave way: thesis spare=0.4
trade h=20 failed opts=Y frozen=n n=12 long=Y | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 note 1 row gave way: thesis spare=0.4
trade h=20 failed opts=Y frozen=Y n= 1 long=n | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: frozen1+frozen+thesis spare=7.6
trade h=20 failed opts=Y frozen=Y n= 1 long=Y | disc=35 hero=80/30 record=30 losses=own open=30 gap=2 gave way: frozen1+frozen+thesis spare=7.6
trade h=20 failed opts=Y frozen=Y n= 3 long=n | disc=28 hero=40/30 record=30 losses=own open=30 gap=2 note 1 row options→count gave way: frozen1+frozen+thesis spare=0.4
trade h=20 failed opts=Y frozen=Y n= 3 long=Y | disc=28 hero=40/30 record=30 losses=own open=30 gap=2 note 1 row options→count gave way: frozen1+frozen+thesis spare=0.4
trade h=20 failed opts=Y frozen=Y n=12 long=n | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 gave way: frozen1+frozen+thesis spare=0.4
trade h=20 failed opts=Y frozen=Y n=12 long=Y | disc=35 hero=80/30 record=26 losses=own open=26 gap=2 note 1 row gave way: frozen1+frozen+thesis spare=0.4
month h=10 connected opts=n frozen=n n= 1 long=n | disc=35 hero=52/30 record=30 losses=count open=30 gap=4 gave way: monthOf spare=0.8
month h=10 connected opts=n frozen=n n= 1 long=Y | disc=35 hero=52/30 record=30 losses=count open=30 gap=4 gave way: monthOf spare=0.8
month h=10 connected opts=n frozen=n n= 3 long=n | disc=30 hero=36/26 record=30 losses=count open=30 gap=2 gave way: monthOf spare=0.4
month h=10 connected opts=n frozen=n n= 3 long=Y | disc=30 hero=36/26 record=30 losses=count open=30 gap=2 gave way: monthOf spare=0.4
month h=10 connected opts=n frozen=n n=12 long=n | disc=35 hero=52/30 record=26 losses=count open=26 gap=3 gave way: monthOf spare=1.2
month h=10 connected opts=n frozen=n n=12 long=Y | disc=35 hero=32/30 record=26 losses=count open=26 gap=2 gave way: monthOf spare=4.0
month h=10 connected opts=n frozen=Y n= 1 long=n | disc=32 hero=36/26 record=30 losses=count open=30 gap=2 gave way: monthOf spare=0.8
month h=10 connected opts=n frozen=Y n= 1 long=Y | disc=32 hero=36/26 record=30 losses=count open=30 gap=2 gave way: monthOf spare=0.8
month h=10 connected opts=n frozen=Y n= 3 long=n | disc=35 hero=32/30 record=26 losses=count open=26 gap=2 frozen+as-of gave way: monthOf spare=4.0
month h=10 connected opts=n frozen=Y n= 3 long=Y | disc=30 hero=32/26 record=26 losses=count open=26 gap=2 gave way: monthOf spare=3.2
month h=10 connected opts=n frozen=Y n=12 long=n | disc=35 hero=32/30 record=26 losses=count open=26 gap=2 frozen+as-of gave way: monthOf spare=4.0
month h=10 connected opts=n frozen=Y n=12 long=Y | disc=30 hero=36/26 record=26 losses=count open=26 gap=2 frozen+as-of gave way: monthOf spare=0.4
month h=10 connected opts=Y frozen=n n= 1 long=n | disc=35 hero=40/30 record=30 losses=own open=30 gap=2 gave way: monthOf spare=3.2
month h=10 connected opts=Y frozen=n n= 1 long=Y | disc=35 hero=40/30 record=30 losses=own open=30 gap=2 gave way: monthOf spare=3.2
month h=10 connected opts=Y frozen=n n= 3 long=n | disc=35 hero=32/26 record=28 losses=own open=28 gap=2 options→count gave way: monthOf spare=2.0
month h=10 connected opts=Y frozen=n n= 3 long=Y | disc=35 hero=32/26 record=28 losses=own open=28 gap=2 options→count gave way: monthOf spare=2.0
month h=10 connected opts=Y frozen=n n=12 long=n | disc=35 hero=36/30 record=26 losses=own open=26 gap=2 gave way: monthOf spare=0.8
month h=10 connected opts=Y frozen=n n=12 long=Y | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 options→count gave way: monthOf spare=3.2
month h=10 connected opts=Y frozen=Y n= 1 long=n | disc=35 hero=32/26 record=28 losses=own open=28 gap=2 options→count frozen+as-of gave way: monthOf spare=4.4
month h=10 connected opts=Y frozen=Y n= 1 long=Y | disc=35 hero=32/26 record=28 losses=own open=28 gap=2 options→count frozen+as-of gave way: monthOf spare=4.4
month h=10 connected opts=Y frozen=Y n= 3 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 options→count frozen+as-of gave way: monthOf spare=3.2
month h=10 connected opts=Y frozen=Y n= 3 long=Y | LAST STEP · disc=35 hero=32/26 record=28 losses=own open=28 gap=2 options→count gave way: frozen1+frozen+monthOf spare=2.0
month h=10 connected opts=Y frozen=Y n=12 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 options→count frozen+as-of gave way: monthOf spare=3.2
month h=10 connected opts=Y frozen=Y n=12 long=Y | LAST STEP · disc=30 hero=32/26 record=26 losses=own open=26 gap=2 options→count gave way: frozen1+frozen+monthOf spare=3.2
month h=10 failed opts=n frozen=n n= 1 long=n | disc=35 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: monthOf spare=2.0
month h=10 failed opts=n frozen=n n= 1 long=Y | disc=35 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: monthOf spare=2.0
month h=10 failed opts=n frozen=n n= 3 long=n | disc=35 hero=32/26 record=28 losses=count open=28 gap=2 note 1 row gave way: monthOf spare=2.0
month h=10 failed opts=n frozen=n n= 3 long=Y | disc=35 hero=32/26 record=28 losses=count open=28 gap=2 note 1 row gave way: monthOf spare=2.0
month h=10 failed opts=n frozen=n n=12 long=n | disc=35 hero=32/30 record=26 losses=count open=26 gap=2 note 1 row gave way: monthOf spare=2.0
month h=10 failed opts=n frozen=n n=12 long=Y | disc=30 hero=32/26 record=26 losses=count open=26 gap=2 note 1 row gave way: monthOf spare=3.2
month h=10 failed opts=n frozen=Y n= 1 long=n | disc=35 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=2.0
month h=10 failed opts=n frozen=Y n= 1 long=Y | disc=35 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=2.0
month h=10 failed opts=n frozen=Y n= 3 long=n | disc=35 hero=32/26 record=28 losses=count open=28 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=2.0
month h=10 failed opts=n frozen=Y n= 3 long=Y | disc=35 hero=32/26 record=28 losses=count open=28 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=2.0
month h=10 failed opts=n frozen=Y n=12 long=n | disc=35 hero=32/30 record=26 losses=count open=26 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=2.0
month h=10 failed opts=n frozen=Y n=12 long=Y | disc=30 hero=32/26 record=26 losses=count open=26 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=3.2
month h=10 failed opts=Y frozen=n n= 1 long=n | disc=32 hero=32/26 record=30 losses=own open=30 gap=2 note 1 row gave way: monthOf spare=1.2
month h=10 failed opts=Y frozen=n n= 1 long=Y | disc=32 hero=32/26 record=30 losses=own open=30 gap=2 note 1 row gave way: monthOf spare=1.2
month h=10 failed opts=Y frozen=n n= 3 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: monthOf spare=1.2
month h=10 failed opts=Y frozen=n n= 3 long=Y | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: monthOf spare=1.2
month h=10 failed opts=Y frozen=n n=12 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: monthOf spare=1.2
month h=10 failed opts=Y frozen=n n=12 long=Y | LAST STEP · disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: note0+monthOf spare=3.2
month h=10 failed opts=Y frozen=Y n= 1 long=n | disc=32 hero=32/26 record=30 losses=own open=30 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=1.2
month h=10 failed opts=Y frozen=Y n= 1 long=Y | disc=32 hero=32/26 record=30 losses=own open=30 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=1.2
month h=10 failed opts=Y frozen=Y n= 3 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=1.2
month h=10 failed opts=Y frozen=Y n= 3 long=Y | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=1.2
month h=10 failed opts=Y frozen=Y n=12 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=1.2
month h=10 failed opts=Y frozen=Y n=12 long=Y | LAST STEP · disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: note0+frozen1+frozen+monthOf spare=3.2
month h=20 connected opts=n frozen=n n= 1 long=n | disc=35 hero=52/30 record=30 losses=count open=30 gap=4 gave way: monthOf spare=0.8
month h=20 connected opts=n frozen=n n= 1 long=Y | disc=35 hero=52/30 record=30 losses=count open=30 gap=4 gave way: monthOf spare=0.8
month h=20 connected opts=n frozen=n n= 3 long=n | disc=30 hero=36/26 record=30 losses=count open=30 gap=2 gave way: monthOf spare=0.4
month h=20 connected opts=n frozen=n n= 3 long=Y | disc=30 hero=36/26 record=30 losses=count open=30 gap=2 gave way: monthOf spare=0.4
month h=20 connected opts=n frozen=n n=12 long=n | disc=35 hero=52/30 record=26 losses=count open=26 gap=3 gave way: monthOf spare=1.2
month h=20 connected opts=n frozen=n n=12 long=Y | disc=35 hero=32/30 record=26 losses=count open=26 gap=2 gave way: monthOf spare=4.0
month h=20 connected opts=n frozen=Y n= 1 long=n | disc=32 hero=36/26 record=30 losses=count open=30 gap=2 gave way: monthOf spare=0.8
month h=20 connected opts=n frozen=Y n= 1 long=Y | disc=32 hero=36/26 record=30 losses=count open=30 gap=2 gave way: monthOf spare=0.8
month h=20 connected opts=n frozen=Y n= 3 long=n | disc=35 hero=32/30 record=26 losses=count open=26 gap=2 frozen+as-of gave way: monthOf spare=4.0
month h=20 connected opts=n frozen=Y n= 3 long=Y | disc=30 hero=32/26 record=26 losses=count open=26 gap=2 gave way: monthOf spare=3.2
month h=20 connected opts=n frozen=Y n=12 long=n | disc=35 hero=32/30 record=26 losses=count open=26 gap=2 frozen+as-of gave way: monthOf spare=4.0
month h=20 connected opts=n frozen=Y n=12 long=Y | disc=30 hero=36/26 record=26 losses=count open=26 gap=2 frozen+as-of gave way: monthOf spare=0.4
month h=20 connected opts=Y frozen=n n= 1 long=n | disc=35 hero=40/30 record=30 losses=own open=30 gap=2 gave way: monthOf spare=3.2
month h=20 connected opts=Y frozen=n n= 1 long=Y | disc=35 hero=40/30 record=30 losses=own open=30 gap=2 gave way: monthOf spare=3.2
month h=20 connected opts=Y frozen=n n= 3 long=n | disc=35 hero=32/26 record=28 losses=own open=28 gap=2 options→count gave way: monthOf spare=2.0
month h=20 connected opts=Y frozen=n n= 3 long=Y | disc=35 hero=32/26 record=28 losses=own open=28 gap=2 options→count gave way: monthOf spare=2.0
month h=20 connected opts=Y frozen=n n=12 long=n | disc=35 hero=36/30 record=26 losses=own open=26 gap=2 gave way: monthOf spare=0.8
month h=20 connected opts=Y frozen=n n=12 long=Y | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 options→count gave way: monthOf spare=3.2
month h=20 connected opts=Y frozen=Y n= 1 long=n | disc=35 hero=32/26 record=28 losses=own open=28 gap=2 options→count frozen+as-of gave way: monthOf spare=4.4
month h=20 connected opts=Y frozen=Y n= 1 long=Y | disc=35 hero=32/26 record=28 losses=own open=28 gap=2 options→count frozen+as-of gave way: monthOf spare=4.4
month h=20 connected opts=Y frozen=Y n= 3 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 options→count frozen+as-of gave way: monthOf spare=3.2
month h=20 connected opts=Y frozen=Y n= 3 long=Y | LAST STEP · disc=35 hero=32/26 record=28 losses=own open=28 gap=2 options→count gave way: frozen1+frozen+monthOf spare=2.0
month h=20 connected opts=Y frozen=Y n=12 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 options→count frozen+as-of gave way: monthOf spare=3.2
month h=20 connected opts=Y frozen=Y n=12 long=Y | LAST STEP · disc=30 hero=32/26 record=26 losses=own open=26 gap=2 options→count gave way: frozen1+frozen+monthOf spare=3.2
month h=20 failed opts=n frozen=n n= 1 long=n | disc=35 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: monthOf spare=2.0
month h=20 failed opts=n frozen=n n= 1 long=Y | disc=35 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: monthOf spare=2.0
month h=20 failed opts=n frozen=n n= 3 long=n | disc=35 hero=32/26 record=28 losses=count open=28 gap=2 note 1 row gave way: monthOf spare=2.0
month h=20 failed opts=n frozen=n n= 3 long=Y | disc=35 hero=32/26 record=28 losses=count open=28 gap=2 note 1 row gave way: monthOf spare=2.0
month h=20 failed opts=n frozen=n n=12 long=n | disc=35 hero=32/30 record=26 losses=count open=26 gap=2 note 1 row gave way: monthOf spare=2.0
month h=20 failed opts=n frozen=n n=12 long=Y | disc=30 hero=32/26 record=26 losses=count open=26 gap=2 note 1 row gave way: monthOf spare=3.2
month h=20 failed opts=n frozen=Y n= 1 long=n | disc=35 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=2.0
month h=20 failed opts=n frozen=Y n= 1 long=Y | disc=35 hero=40/30 record=30 losses=count open=30 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=2.0
month h=20 failed opts=n frozen=Y n= 3 long=n | disc=35 hero=32/26 record=28 losses=count open=28 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=2.0
month h=20 failed opts=n frozen=Y n= 3 long=Y | disc=35 hero=32/26 record=28 losses=count open=28 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=2.0
month h=20 failed opts=n frozen=Y n=12 long=n | disc=35 hero=32/30 record=26 losses=count open=26 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=2.0
month h=20 failed opts=n frozen=Y n=12 long=Y | disc=30 hero=32/26 record=26 losses=count open=26 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=3.2
month h=20 failed opts=Y frozen=n n= 1 long=n | disc=32 hero=32/26 record=30 losses=own open=30 gap=2 note 1 row gave way: monthOf spare=1.2
month h=20 failed opts=Y frozen=n n= 1 long=Y | disc=32 hero=32/26 record=30 losses=own open=30 gap=2 note 1 row gave way: monthOf spare=1.2
month h=20 failed opts=Y frozen=n n= 3 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: monthOf spare=1.2
month h=20 failed opts=Y frozen=n n= 3 long=Y | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: monthOf spare=1.2
month h=20 failed opts=Y frozen=n n=12 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: monthOf spare=1.2
month h=20 failed opts=Y frozen=n n=12 long=Y | LAST STEP · disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: note0+monthOf spare=3.2
month h=20 failed opts=Y frozen=Y n= 1 long=n | disc=32 hero=32/26 record=30 losses=own open=30 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=1.2
month h=20 failed opts=Y frozen=Y n= 1 long=Y | disc=32 hero=32/26 record=30 losses=own open=30 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=1.2
month h=20 failed opts=Y frozen=Y n= 3 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=1.2
month h=20 failed opts=Y frozen=Y n= 3 long=Y | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=1.2
month h=20 failed opts=Y frozen=Y n=12 long=n | disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: frozen1+frozen+monthOf spare=1.2
month h=20 failed opts=Y frozen=Y n=12 long=Y | LAST STEP · disc=30 hero=32/26 record=26 losses=own open=26 gap=2 note 1 row gave way: note0+frozen1+frozen+monthOf spare=3.2
```
</details>

## 4. Account set: one filter

In `lib/shared-accounts.ts` (additive, beside `notShared`):

```ts
// The record's account set for open positions: never a simulated account, never one marked as another profile's (the
// set lib/sync.ts#rebuildTrades uses for closed trades). Correlated on p.user_id, so it works over many users.
export const positionInRecord = (db: Db) => db`not exists (select 1 from broker_accounts b where b.account_id = p.account_id and b.user_id = p.user_id and b.is_paper)
  and not exists (select 1 from shared_account_marks m where m.user_id = p.user_id and m.account_id = p.account_id)`;
```

Every reader aliases `open_positions p` and adds `and ${positionInRecord(sql)}`. If #100 has merged, this goes after its
`visibleId` condition, joined with AND (§8).

| Reader | Note |
|---|---|
| `app/u/[handle]/load.ts:22` `positions` | also covers the card data and the profile list |
| `app/u/[handle]/pane/route.ts:30` | |
| `lib/feed.ts:608` | needs the `p` alias (EN4) |
| `lib/trade-share-load.ts:48`, which becomes `openRead` | serves trade and month |
| `lib/display-log.ts:82` | needs the `p` alias |
| `lib/display-log.ts:140` `exists (select 1 from open_positions p …)` | EN5 |
| `app/t/open-positions.ts:18` | the stock pages' "held by N traders" |

Why the filter is needed: a sync after `--mark` writes a marked account's positions again (`real` ignores marks), and an
account flagged paper later keeps its rows until the next read. The writers stay unchanged.

## 5. The as-of date

- The date is the stored `min(fetched_at)` of the shown positions only. There is no vendor call.
- `openPercents` becomes `openRead(userId, state)`, which returns `{ pcts, asOf }` from its one existing statement
  (`select unrealized_pct, fetched_at …`, `asOf` = min). `TradeView`, `RecapView` and `StripInput` gain
  `openAsOf?: Date`. `open?: number[]` keeps its type.
- The card takes the min from the `positions` rows `record-card-data.ts` already loads, through `CardInput.openAsOf`.
- The image routes change by zero lines.
- **Owner flag (OD 2.7):** `lib/privacy-fields.ts:41` labels `fetched_at` "freshness, internal". The profile already
  prints the same UTC day (`page.tsx:103`, `:403`). The build does not change the label, and the PR body asks the owner.

## 6. Public payloads (F-23; EN option adopted)

- The pane JSON carries `model.openLine: { text, parts, withAsOf } | null`, built on the server by `openLine`. The pane
  prints it as received, so it equals the other surfaces by construction.
- The parts hold only printed strings and tones. There is no `openRange` and no extra number.
- `model.open` (n, up, down, flat, avg, for the tiles) and `openAsOf` (ISO day) keep their shape (`pane-model.test.ts`
  pins them).
- `PAYLOAD_V` in `lib/chart-series.ts:51` goes from 2 to 3, so caches re-key.
- No symbols are sent.
- The feed card, profile and pages are server components, so the HTML prints only the line.
- `e2e/f23-payload-scan.spec.ts` gains the −15% fixture.

## 7. Pane order and the 360 / 320 checks

- `lib/pane-model.ts` exports `PANE_LINES = ['exclusions', 'open', 'options'] as const`. `app/pane.tsx` renders them in
  that order after the realized stats.
- **An absent slot renders nothing (BL2).**
  - `exclusions` is F-21's slot (nothing until F-21 is built).
  - `open` is `OpenGrid` with the line.
  - `options` is F-29's slot. Today's `ShareTradesLabel` stays where it is until F-29 moves it.
- `CombinedLine`, `PaneOptions` and the F3 line follow, as today.
- Tests: a unit test pins the array, and an e2e asserts the DOM order of `[data-pane-line]`.
- 360×740, with the −15% fixture, the options label and a failed note: the realized headline and the disclaimer are in
  the first viewport. **e2e assertion only:** at least 24 px between the disclaimer's bottom and the viewport's (one muted
  line, for F-21). No blank space is rendered. F-21's builder swaps the assertion for its real line.
- At 320 px: no horizontal scroll, and "-15.0%" never separates from "down".
- The same checks run on the profile at 360 and 320 px, the trade and month pages at 360 and 320 px, and the **feed card
  at 375 and 320 px** (BL1).

## 8. ACs to tests, states, files, expectation changes, merge

| AC | Test |
|---|---|
| Render-equality (replaces the OD 2.25 guard) | New `lib/f34-open-line.test.ts`, with the `[-0.15, 0.04, 0.012]` fixture. **`text` byte-identical** in the profile `OpenGrid` HTML, `ProfilePane` HTML from a JSON round-tripped `paneModel`, and the square and story rows. **`withAsOf` byte-identical** in the trade and month page strip, the feed card HTML, `cardDescription`, `tradeDescription` and `monthDescription`. **`alt`** (normalised, EN2) in `cardAlt`, `tradeAlt` and `monthAlt`. **The image form** (§2b) in the unfurl, trade and month rows. The e2e `e2e/f34-open-line.spec.ts` repeats this on the running app, including the `og:description` and `og:image:alt` meta |
| Image snapshots change only on the open line | New `lib/f34-open-line.image.test.ts`: sha256 snapshots (the `fixes-cycle4-part2.image.test.ts` pattern) of the unfurl, square, trade and month with the fixture. A structural half: the same fixture with no open positions is byte-identical to main, and with open positions only the `open*` roles and the §3 steps differ. In `record-card.snapshot.test.ts` only the `|open` keys change |
| Paper and notShared left out | New `lib/f34-open-line.db.test.ts`: real, paper and marked accounts with one position each. Every reader in §4 returns only the real one, and the line reads "1 position" |
| As-of with the year on images | Unit: every image row set and alt that has a value also has `/as of [A-Z][a-z]{2} \d{1,2}, \d{4}/`, both in the current year and in a prior one |
| No vendor call, no extra query | Db test with the `profile-load.test.ts` `debug` hook: each image's loader runs **the same number of statements** as on main (EN7). The vendor fake (`e2e/fakes/vendor.ts`) logs zero requests while the e2e fetches the three images |
| Down colour from the F-20 table | Unit: the down span's colour is `IMAGE_PALETTE.strip.down` / `.card.down`. `colour-literals.test.ts` stays green with no new allowlist entry |
| Pane at 360 and 320 | e2e, §7 |
| One producer | Source scan in `f34-open-line.test.ts`: outside the `openLine` block, no `app/` or `lib/` source contains "Still open", "open, unrealized" or "avg unrealized" (apart from `OPEN.line` under `app/t/**`), and `SHARE_CARD.openFull` is read only by `openLine`. The retired keys are gone. **Banned words** (BL6): no `openLine` output for any §2 state contains "all positions", "every", "holdings" or "portfolio" |
| Fit (BL4, EN1) | New `lib/f34-open-band.test.ts`: the §3a matrix of 192 states. Each fits with the disclaimer at 28 px or more and `o ≥ r`. "losses included" is at least 26 px, at least 4.5:1 and inside x 309–891. Every open part and the as-of are present. Only step 11 drops a frozen line or a failed note |

### States

| State | Behaviour |
|---|---|
| No open positions | No line, no `openLine` in the payload, today's HTML and images (byte-identical) |
| 1 position / all flat / all losing / all winning / mixed / printed alike / 12 / near −100% / 1,000+ | §2 |
| Open positions, no closes | Profile, pane and card show the line in the empty-record block, as F-6 does. Trade and month need a close |
| Importing; none or not consented | No line on any surface (TR-3) |
| Failed import | The line, plus the warn note (2 rows, or 1, or step 11 on the image) |
| **Frozen** | **Frozen records show positions (state connected), EN1.** Line as usual, with the frozen line on the image (step 8 merge, or step 11). The page and alt keep it. The OD-9 ponytail is unchanged |
| Public filer / public demo | No `open_positions`, so no line (asserted) |
| Demo | Line with the Demo badge. Images say "Demo", never "verified" |
| Signed out | Same line everywhere. The e2e runs signed out |
| Options gate open | A ponytail (Q6): today only the profile adds option positions |

### Files and hunks (BL5: logic in new places, small hunks elsewhere)

**New logic (no conflict expected):**
- `lib/open-split.ts`: `openFacts`, `packRows`, `OPEN_BAND_STEPS`, `openBandTransform`, `openBand`.
- `lib/copy.ts`: the new `openLine` block and `OPEN_LINE`. It is placed after `OPEN`, away from `allCopy`.
- The new test files above.

**Small call-site hunks:**
- `lib/copy.ts`: `openCopy()` gains the outputs (near `allCopy`, which #100 edits too). Remove the retired keys. Add
  `RECORD_BODY.failedShort`.
- `lib/record-card.ts`: `cardOpen` adapter, `CardInput.openAsOf`, the `cardAlt` line, `openCut`.
- `lib/record-strip.ts`: `StripInput.openAsOf`, `Strip.open`, the open part and alt, a call into `openBand` from
  `stripImageLines`, `ImageLine.spans?` and `block?`, and `layoutBand` skipping the gap inside a block.
- `lib/trade-share.ts` and `lib/month-card.ts`: `if (strip.open) return openBand(…)`. `tradeStripInput` passes
  `openAsOf`.
- `lib/trade-share-load.ts`: `openRead`.
- `lib/recap.ts` and `lib/recap-load.ts`: `openAsOf`.
- `lib/pane-model.ts`: `openLine`, `PANE_LINES`.
- `lib/chart-series.ts:51`: 3.
- `lib/shared-accounts.ts`: `positionInRecord`.
- `lib/feed.ts`, `lib/display-log.ts`, `app/u/[handle]/load.ts`, `pane/route.ts` and `app/t/open-positions.ts`: the
  filter.
- `app/u/[handle]/record-card-data.ts`: `openAsOf`.
- `app/u/[handle]/record-card-image.tsx`: the open block.
- `app/record-strip.tsx`: `Figures` open block, spans.
- `app/open-rows.tsx`: line, caption, ChartNote.
- `app/pane.tsx`: order.
- `app/u/[handle]/page.tsx`: two call sites.
- `app/ui.tsx:113`: the feed line.
- `app/globals.css`: delete line 850's rule, add `.open-line`, `.strip-open` and `.open-also .nw` (tokens only).

**Untouched:**
- The four image routes.
- The protected files: `scripts/*` (autopilot, team, features, doctor, plan, invariants, compliance*), `policy.test.ts`,
  `workflow-security.test.ts`, `.github/**`, `docs/POLICY.md`, `CLAUDE.md`, `team/**`, `playwright.config.ts`,
  `lib/session.ts`, `lib/broker.ts`.
- `lib/privacy-fields.ts` (§5).
- No schema change, no dependency, no font.

**Expected conflicts (EN4). The build log lists each hunk as it is resolved:**
- **#100** edits the `open_positions` statements at `load.ts:20`, `pane/route.ts:30`, `feed.ts:608`, `display-log.ts:82`
  and `trade-share-load.ts:48`, adding `visibleId`. Keep both conditions, joined with AND, with the `p` alias in feed
  and display-log. #100 also edits `copy.ts` near `allCopy`: keep both.
- **#102** rewrites `trade-share-load.ts`'s return line (`sellId` → `tradeKey`). Take #102's key and add `openAsOf`.
  #102 uses `ui.tsx:113` as context, touches `e2e/record-strip.spec.ts:165` and edits `f23-payload-scan`. Re-apply this
  branch's expectations on top.
- Neither PR touches `record-card-image.tsx`.

**Expectation changes (updated to the decided strings, never weakened; the test count does not drop; EN3):**

| File:line | Change |
|---|---|
| `lib/record-card.rework.test.ts:189-230` | words after values, U+00A0, the dated comma alt |
| `lib/f12-strip.test.ts:53`, `:103` | `withAsOf` / `alt` in place of "‹n› open, unrealized". The `:105` / `:112` pins of `!/[·()]/` still hold |
| `lib/record-strip.test.ts:111-112`, `:157` | the same |
| `lib/open-split.test.ts:83` | `openLine` outputs replace the `feedCounts` / `feedTail` calls in the banned-word scan |
| `lib/pane-model.test.ts:73` | `openLine` in the model |
| `e2e/record-strip.spec.ts:162` | `withAsOf` |
| `e2e/f6-open-positions.spec.ts:113`, `:122`, `:185`, `:196` | ChartNote tail, count caption, feed card line |
| `e2e/share-card.spec.ts:160` | card open row |
| `e2e/f23-display.spec.ts:220`, `e2e/f23-payload-scan.spec.ts:250`, `:268`, `:326-334`, `e2e/f26-held-like-none.spec.ts:177` | `v=2` → `v=3` |
| `lib/copy.ts#openCopy` keys | retired keys out, `openLine` outputs in |
| `lib/record-card.snapshot.test.ts` | only the `\|open` keys |

### Rollout

One PR on this branch, in commits that each pass on their own:
1. Filter and db test.
2. Producer, card text, strip text and equality tests.
3. Image form, band steps, the fit-matrix test and snapshots.
4. Profile, pane order, payload and e2e.
5. Feed card (required).

Main is merged in as #100 and #102 land.

## 9. Compliance (COMPLIANCE §1)

1. **Performance:** yes. The disclaimer is on every surface and is never dropped: the images keep it at 28 px or more.
   There are no advice words. Losses come first, a loss is shown with a word and the down token and is never muted, and
   the evidence labels and "Verified" are unchanged. There are no completeness words (banned by the scan).
2. **Personal data:** the unrealized percent is already public under consent. New exposure: the UTC day of `fetched_at`
   on images, alts, descriptions, strip pages, the pane and the feed card. It is the same day the profile prints. Flagged
   to the owner (OD 2.7). Nothing new is stored and deletion is unchanged. The filter only shrinks what is public.
3–6. **Money, messages, user content, accounts:** no.
7. **Vendors and assets:** none new. No vendor call at render. The market-data permission stays a launch gate.
8. **Accessibility:** a word beside each value, held together by U+00A0 and nowrap. Alts are in comma form. Reflow at 320
   px. F-20 contrast (values 8.46:1 and 9.12:1, muted 5.84:1 on the image background).
9. **Security:** the public pane JSON gains printed strings only. `PAYLOAD_V` goes to 3.
10. **Claims:** "Still open" and "as of ‹date›" are factual and dated.
11. **Checkout:** no.

**Only the owner can clear:**
- OD 2.7 (the `fetched_at` label).
- The extreme unfurl chart share of 12.5% (Q8, a note).
- The market-data launch gate (unchanged).

## 10. Open questions

**Settled in round 1** (both reviewers):
- Q1: feed card in scope (required, BL1).
- Q2: lower-case up/down/flat.
- Q3: keep the count tile, captioned "open positions".
- Q4: alts in comma form (EN2).
- Q5: stock and compare pages get the filter only.
- Q6: options gate is a ponytail.
- Q9: pane headroom is an e2e assertion only (BL2).
- Q10: replaced by the §3a matrix, which fits.

**Still open:**
- **Q7 (owner, OD 2.7):** move `fetched_at` into the record-state fields? Recommend yes. It is already printed publicly.
- **Q8 (owner, a note, not a blocker):** with the failed note moved, the worst 2-row unfurl is at 15.0%. The extreme
  3-row case (flats with two-digit counts or long values, with failed, options and wide) is at 12.5%. Recommend accept:
  the 35 px floor cannot shrink, and F-4's rule puts a row of text ahead of a sliver of chart.
- **Q11 (committee): the image form.** Do the AC's words "the three images' text" accept `Still open: ‹n›` and
  `as of ‹date›` on the 1200×630 images? Recommend yes. The full title cannot fit 44 of the 192 states (§3a). Every fact
  and the dated year stay, the same producer makes it, a unit-tested mapping relates it to `withAsOf`, and the alt
  carries the full words.
- **Q12 (business lead): step 11.** In 8 extreme month states, may a frozen line or a failed note give way on the image,
  while the label row ("Import did not finish"), the page and the alt keep it? Recommend yes. It extends today's rule
  that the frozen line gives way beside a failed note, and it never drops a figure, the open line or the disclaimer.
- **Q13 (business lead): the 1-row failed note on images** (`This record may be incomplete.`, step 6). It is the second
  clause of the existing sentence, under the label "Import did not finish". Recommend yes.
