# Stock Social design system: 2026-11-01

Date: 2026-11-01 · Status: **Draft for the approval council** · Council: design system council (ten members, chair, drafting secretary)

**Summary.** This is the design system that build sessions implement without reopening the debate. It settles the
conflicts between the creative direction council, the design direction council and the idea board (D20 to D29). It
keeps every owner decision (POLICY, DESIGN Stage 5, F-1 to F-6) and changes none of them. Five rulings are fixes and
ship now: the light Verified badge is 3.77:1 today, light gain and loss are ΔE00 2.8 apart under deutan simulation,
the profile range can exclude its own headline, the feed hero overflows at 360 px, and failed imports are drawn in
loss red. The trust language becomes one table, `TRUST_LOOK`, with the bare word "Verified", a tuned plum Demo
(dashed border, ring glyph), "New record" until the owner amends TR-7, and D29's "Last close · updated" for
freshness. Numbers become one `pct()` with U+2212, one tone rule and one range wording. The base for colour tokens
is the ink palette, which keeps the nine existing CSS variable names. Two items are visual-direction changes and go
through the three-variant process: the ink accent replacing violet, and the type, spacing and radius collapse.
Wording that amends idea-board decisions (D25, D27, D22) is listed as proposals for the approval council. Items that
touch owner decisions are listed as owner flags, each with a recommendation.

POLICY T1 note: the creative council's palette codename is not used anywhere in this document or in code. It is
"the ink palette". Tokens are named by role.

## Settled conflicts

| # | Conflict | Ruling | One-line reason | Evidence |
|---|---|---|---|---|
| 1 | Badge text: "Verified" vs "Verified from broker" | Bare **"Verified"**: no check glyph, ink outline, links to `/how#verified` | "from broker" reads as broker endorsement (F3a); 68 vs 153 px in DejaVu | §2.1; `lib/copy.ts:125`; F-4 2026-10-22 (`docs/features/F-4-share-card.md:16`) |
| 2 | Demo colour: plum vs sky | **Tuned plum** #6e1f66 / #f0b8e8, dashed border, "○" | Only candidate ≥ 9 ΔE00 from every other meaning colour under every simulated deficiency | §2.2 tables |
| 3 | "as of" date stamp | **"as of" only beside open-position values**; records use D29 "Last close · updated"; images use the absolute "Last close ‹Mon D, YYYY›" | "as of" beside a closed return reads as a live valuation | §2.3; F-6 2026-11-01 lines 33, 36 |
| 4 | Short-record label | Ship TR-7's **"New record"**; recommend that the owner amend it to "Early record" | "Record under 30 days" is false (the trigger is < 30 days **or** < 10 trades); "Short record" reads as short selling | §2.4; `lib/trades.ts:303-306` |
| 5 | Positioning line | **"Closed trades imported read-only from connected broker accounts. Losses included."** | States scope (closed, connected) and method; D27's wording calls demo cards verified | §2.5; proposal A-1 |
| 6 | Number format | One `pct()`: U+2212, 1 decimal below 1,000%, "Flat" at 0.0%, "≈" only near −100%; range "likely between" always contains the headline | The minus is the same width as "+"; the range bug is reproduced | §2.6, §3 |
| 7 | One trust language and record context | One `TRUST_LOOK` table; StatusLine on record surfaces; one record line on the feed card; crop band on images | Today three Verified wordings and three Demo names ship | §2.7, §4 |
| 8 | Tokens | Keep the 9 variable names; ink-palette values; new `--control --focus --flat --verified --demo --demo-bg --warn --warn-bg --surface-2`; rem type scale with content-fit figures; 4-pt spacing; radius 6/10/999 | Renames would break PRs #30 and #36; the measured fit failures are by content length | §2.8, §5 |
| 9 | Palette (ink accent and blue focus vs violet) | Ink-palette **values for meaning colours ship as fixes**; **ink accent and blue focus go to three variants** | CVD fixes are fixes; the accent is a visual direction (CLAUDE.md three versions) | §2.8; proposal V-1 |
| 10 | Type scale (1.25 ratio vs clamp) and radius (6/10/12 vs 6/10/999) | rem steps at the creative step values, clamp only on h1, h2 and display; radius 6/10/999; the **collapse is three variants** | The binding constraint is figure width, not the ratio | §5.2; proposal V-2 |

---

## 1. How the council worked

| Pass | What happened | Output |
|---|---|---|
| 1 | Independent positions from ten members: product designer, UX lead, data-visualization designer, accessibility specialist, content designer, trust and safety, legal and compliance, engineer, common sense, red team. Each member measured independently: contrast (WCAG 2.x), CIEDE2000 after full-severity protan, deutan and tritan simulation (published 2009 dichromat matrices), and DejaVu Sans and DejaVu Sans Bold advance widths. | Ten position papers and the accessibility worksheet (pass-1 tables A to J) |
| 2 | Chair rulings R1 to R8 (binding for the draft); the chair re-ran the Demo candidates against the ink palette. The secretary drafted this spec and re-ran the token contrast table, string widths, hero sizing and the range reproductions. | This draft |
| 3 | Full-council review of the draft | (filled after pass 3) |
| 4 | Revision with re-verified numbers | (filled after pass 4) |
| 5 | Sign-off | (filled after pass 5) |

Precedence used throughout: POLICY > owner decisions (F-*.md, DESIGN Stage 5 Musts) > idea-board decisions D20 to
D29 (adopted under the owner's instruction; the approval council can amend their wording) > either council's
proposals. Where a member disagreed with a ruling, the disagreement is recorded beside the ruling.

### 1.1 Pass 3 review
(filled after pass 3)

### 1.2 Pass 4 revision
(filled after pass 4)

### 1.3 Pass 5 sign-off
(filled after pass 5)

---

## 2. Decisions with reasons and evidence

### 2.1 R1: Badge text is the bare word "Verified"

**Decision.** "Verified", no check glyph (check glyphs are reserved and refused in names, O-9); outline badge, 1 px
solid `--verified` (ink), never the gain colour, no tint; links to `/how#verified`, with a non-link `plain` form
inside row links (no nested `<a>`); never touching name, handle or avatar, beside the record stats; one
`VERIFIED_DEFINITION` shown as visible text in the profile and pane StatusLine. Replaces "✓ Verified from broker"
(`lib/copy.ts:125`), which came from an F-4 committee round; the owner's F-4 2026-10-22 names the state
"Verified"/"Demo" (`docs/features/F-4-share-card.md:16`).

| Measure | "Verified" | "Verified from broker" | Source |
|---|---|---|---|
| Width, 12 px bold + 16 px padding, DejaVu Sans Bold | 68.4 px | 153.1 px | content; re-measured |
| Room for name + handle in the 360 px feed header (badge, 44 px menu) | 198 px | 113 px | UX (a 20-char handle needs about 184 px) |
| 200% text, badge `nowrap` (`app/globals.css:109`) | 130 px | 313 px; 339 px with an icon (> 328) | accessibility |
| Literal reading | provenance | "the broker verified this" = endorsement (F3a) | legal, red team, T&S, common sense |

- Accessible name: "Verified: imported read-only from the trader's broker" (2.4.4). Today's tooltip ("Cannot be
  edited.", `app/ui.tsx:11`) is unreachable by touch or keyboard and goes.
- Today light Verified = `--up` on an 18% `--up` tint = **3.77:1** (fails 1.4.3, `app/globals.css:110`); dark is the
  gain colour itself (ΔE00 0.0). Ink: 16.56 / 17.93 light, 16.27 / 14.85 dark.
- Engineer's note: "Verified from broker" matches today's images and tests; cost is about 12 assertions either way,
  so the policy reading decides. Pinned tests are updated, never deleted.

### 2.2 R2: Demo colour is tuned plum

**Decision.** `--demo` **#6e1f66** light / **#f0b8e8** dark; 1 px **dashed** border, "○", the word "Demo"; same
size, weight and box as Verified (Demo is never the quieter mark); never on a figure, chart line or area. The F-4
record card ships sky #38bdf8 (`app/u/[handle]/record-card-image.tsx:10`): owner flag O-2, recommending the same plum.

Ink palette (up #0b6b70 / #3cc4b4, down #b2441b / #ff8a5b, focus #2152d9 / #86a8ff, warn #8a5a00 / #f2b84b). Cells:
normal ΔE00 / minimum over protan, deutan, tritan (`chair_demo.py`, re-run). < 10 = close at badge size; < 5 =
near-confusable.

| Candidate | Scheme | on bg | on surface | vs up | vs down | vs focus | vs warn | Verdict |
|---|---|---|---|---|---|---|---|---|
| **tuned plum #6e1f66** | light | 9.46 | 10.24 | 38.8 / **9.2** | 37.2 / 18.8 | 26.2 / 16.2 | 48.9 / 14.6 | **adopted** |
| **tuned plum #f0b8e8** | dark | 11.46 | 10.46 | 44.9 / **10.3** | 33.0 / 18.0 | 26.0 / 11.1 | 46.5 / 10.1 | **adopted** |
| plum #8a2b7f | light | 7.10 | 7.68 | 37.6 / **6.1** (deutan) | 36.5 / 14.2 | 24.7 / 12.7 | 49.6 / 10.9 | fails < 10 |
| plum #e79ddd | dark | 9.24 | 8.44 | 45.7 / 9.0 | 34.1 / 13.1 | 26.2 / **6.6** | 50.7 / 9.6 | weak |
| sky #0369a1 | light | 5.48 | 5.93 | 18.5 / **5.1** (tritan) | 45.9 / 44.6 | 12.8 / 6.9 | 45.1 / 43.6 | rejected |
| sky #38bdf8 | dark | 8.83 | 8.06 | 24.0 / **4.7** (tritan) | 51.7 / 45.3 | 16.2 / **1.9** (deutan) | 53.0 / 50.1 | rejected |
| violet #6d28d9 | light | 6.56 | 7.10 | 31.5 / 17.7 | 46.0 / 37.2 | 13.1 / **0.3** | 58.4 / 30.2 | rejected (today's accent) |
| violet #a78bfa | dark | 6.95 | 6.34 | 39.7 / 19.5 | 42.7 / 32.2 | 13.5 / **3.2** | 58.0 / 29.4 | rejected |

Against today's green/rose (accessibility table B, the interim before DS-4), minimum CVD ΔE00 vs up / vs down:
plum 35.0 / 18.7 light, 36.2 / 24.7 dark; sky 8.7 / 31.1 light, 9.0 / 39.0 dark.

Derived (secretary): tuned plum on `--demo-bg` #f8eef6 / #2a1a28 = **9.05 / 9.97**; vs Verified ink 25.9 / 22.1
(CVD min 18.3 / 12.1); on card bg #0f1114 11.46, on today's card #0b0b0f 11.91; CVD min vs card up / down: today's
card 34.4 / 29.8, ink card 10.3 / 18.0. Luminance ratios of every candidate vs gain/loss are 1.05 to 1.79, so word,
dashed border and ring carry Demo; colour only adds. Product designer's dissent (violet Demo, ink focus) is
rejected: violet is 0.3 from blue focus and stays today's accent until V-1.

### 2.3 R3: Dates

| Context | Form | Rule |
|---|---|---|
| Open-position value | "as of ‹Mon D[, YYYY]›" (`lib/copy.ts:448-461`) | only beside a valuation, same element (F-6 2026-11-01) |
| Record freshness, web | "Last close ‹Mon D[, YYYY]› · updated ‹relative›"; "updated just now" under 1 min | D29; `Intl.RelativeTimeFormat('en', {numeric: 'always'})`; profile and pane |
| Idle (no sync 30 days) | "Last close ‹date› · not updated since ‹Mon D, YYYY›" | D29, facts only |
| Frozen | "Disconnected ‹Mon D, YYYY› · record frozen"; "updated" dropped | TR-5; outranks every freshness date |
| Account removed | "Account removed ‹Mon D, YYYY›" on its rows | TR-5 |
| Trade, month, stock images | "Last close ‹Mon D, YYYY›", year always | never relative, never "as of" |
| Record card | owner flag O-3 (OD-14) | recommend "Last close ‹Mon D, YYYY›" |
| Web year rule | year only when not the current year | one `dateText()`, UTC |

Reasons: "as of" beside a closed return reads as a live valuation (legal, common sense, red team); a printed date is
not tamper evidence, the printed link is; relative time on an image freezes at render. Today: 21 date sites, 6
shapes, mostly server-local time; the feed card never prints a year (engineer). Dissent: product designer and legal
preferred "Imported ‹date›" on cards; rejected, it collides with the import banner and is not a fact of the record.

### 2.4 R4: Short-record label

| Candidate | Width | Problem |
|---|---|---|
| "Record under 30 days" | 163.5 px | **false**: `isNewRecord` is < 30 days **or** < 10 closed trades (`lib/trades.ts:303-306`); a 60-day, 9-trade record carries it (`lib/story-image.test.ts:13-21`) |
| "Short record" | 101.2 px | reads as a record of short sales, which `/how` lists as excluded |
| **"New record"** (TR-7) | 93.4 px | can read as an all-time high; mitigated by placement |
| "Early record" (recommended) | 98.2 px | true under both triggers; matches "Still early" / "Too early to tell" |

**Decision.** Ship "New record" verbatim (TR-7 Must); O-1 recommends "Early record". Never on the figure's line or in
a sign colour: muted text, 1 px `--control` outline, links to `/how#new-record` ("Under 30 days of history or under
10 closed trades."). One maturity signal per surface (common sense): the profile always shows the badge (TR-7);
elsewhere only when the record line does not already say "Too early to tell". Sub-line "short record, wide
uncertainty" (`lib/month-card.ts:39`, trade image `:59`, trade page `:64`, month page `:82`) becomes "under 30 days
or under 10 closed trades".

### 2.5 R5: Positioning line and first-visit line

| Candidate | Finding |
|---|---|
| D27 "Verified trades, straight from the broker. Losses included." (meta today, `app/layout.tsx:11`) | calls demo cards verified (the seed is all demo); "straight from" hides that Stock Social calculates the returns (F3a) |
| Design P-3.7 "Trading records imported read-only from traders' brokers. …" | "traders' brokers" reads as all their brokers (TR-8) |
| **"Closed trades imported read-only from connected broker accounts. Losses included."** | **adopted**: scope and method; 590.8 px at 14 px (2 lines) |

**Decision.** The line is the meta description, `/` image text and `/how` intro. First-visit: D27's mechanism
(signed out, one dismissible line, never modal, shares the SW-1 slot) with the line, then "Demo records are marked
Demo." while page 1 holds a demo card, then "How it works →" to the "How records are calculated" page: 701 / 938 px,
3 lines at 14 px either way. Wording change = proposal **A-1**. D25's Stocks line becomes "Browse stocks that have
closed trades on Stock Social." (demo-only stocks are listed, `lib/ticker.ts`): proposal **A-2**. "Check the record,
not the screenshot." stays off every surface until the name is cleared (T5a). Dissent: content kept D27 verbatim
plus the demo sentence; common sense would drop "read-only" for viewers; the chair kept it as F3a's method statement.

### 2.6 R6: Number format

Table in §3. Evidence:
- **Widths, DejaVu Sans Bold (em):** digit 0.696, "+" 0.838, U+2212 0.838, "-" 0.415, "%" 1.002, "." "," 0.380,
  "≈" 0.838. U+2212 aligns gains and losses; it costs 0.423 em per sign, which R8's hero sizing counts. `pct()`
  (`lib/trades.ts:162`) prints the hyphen; 21 assertions pin it (rewritten, not deleted).
- **"≈":** today `pct(-0.99999)` = "-99.999%" and `pct(-0.9999999)` = "-99.99999%" (up to 4 extra decimals,
  `:166-168`, reproduced). Ruling: ≤ 2 extra decimals, then "≈−100.0%"; never on an average, range or chart value;
  range low clamped at −100.0% (exact).
- **Zero:** 15 inline tone decisions; 12 use `> 0 ? up : down` (0.0% red: feed hero `app/ui.tsx:55`,
  `app/pane.tsx:45,55,78`), `chart.tsx:135` uses `>= 0` (0.0% green). One `tone()` (`lib/open-split.ts:10`, moved to
  `lib/format.ts`) from the printed string; 0.0% unsigned, `--flat`, "Flat", "about even" for screen readers.
- **Win rate:** 12 inline `(x*100).toFixed(0)`, so 199/200 prints "100%". One `winPct()`: never 100% with a loss and
  (secretary, symmetry) never 0% with a win.
- **BUILD GAP, range vs headline:** `confidence()` centres `perTrade` on the mean of log returns (`expm1(m ± t·SE)`,
  `lib/trades.ts:270`); the headline is arithmetic; F-4 2026-10-31 (owner) requires the arithmetic centre "so the
  headline always sits inside its range". Reproduced with shipped functions (`range.ts`, `rng.ts`, re-run):

| Record | Headline | Shipped range | Inside? | Arithmetic (fix) |
|---|---|---|---|---|
| 1 × +900%, 29 × −5% | +25.2% | −12.5% to +20.6% | **no** | −36.5% to +86.9% |
| 100 × alternating +80% / −40% | +20.0% | −6.9% to +16.0% | **no** | +8.0% to +32.0% |
| 200 × alternating +60% / −35% | +12.5% | −4.2% to +8.6% | **no** | contains |
| 6 × +1% | +1.0% | +1.0% to +1.0% | false in floats | +1.0% to +1.0% |
| 6 near −100% | −68.8% | −99.0% to −45.7% | yes | −100.0% (clamped) to −7.3% |

Fix: `perTrade = Σr/n ± t(K−1)·SE`, cluster-robust SE on raw returns, low clamped at −1; `pace30` (ranking)
untouched. PR #35's `lib/bets.ts#arithmeticRange` is card-only, so profile and `/t` adopt it (DS-13) or card and
profile disagree. **O-5:** the trust line's pattern clause still comes from `pace30` (40 alternating +60% / −30%
trades: "likely between +0.4% and +29.6%" beside "no clear pattern"); recommend a pattern only when both intervals
sit on the same side of 0.

### 2.7 R7: One trust language and record context

- One `TRUST_LOOK` table (`lib/trust-look.ts`, §4.2) drives `Badge`, `Notice` and every image renderer. Today three
  Verified wordings and three Demo names ship ("Demo", "Demo data", "Sample data"; engineer, content).
- **Failed import never uses `--down`** (today `className="down"` at `app/ui.tsx:52`, `app/u/[handle]/page.tsx:184`,
  `month/[ym]/page.tsx:77`; account claimed `page.tsx:195`). Ink warn vs ink down is protan 3.4 / deutan 3.2 in light
  (accessibility table H), so warn always has icon, box and words, never beside a figure or in a chart.
- **Feed card:** badge + D22's one record line only; design's 7-part strip is rejected (common sense). **Pane,
  profile, trade, month, `/t`:** StatusLine + `VERIFIED_DEFINITION` + D20 in-view disclaimer. **Images:** one crop
  band (handle, trust word, record line, "Last close" with year, printed link, disclaimer). Placement: §4.3.
- Image disclaimer ≥ 35 px at 1200 wide / ≥ 32 px at 1080. Trade and month images use 22 px today
  (`trade/[sellId]/opengraph-image.tsx:61`, `lib/month-card.ts:40`); the record card complies
  (`lib/record-card.ts:31-35`). At 35 px the sentence is 1,337 px, so 2 lines.
- "Demo data, not a real broker record" stays on square and story images.
- The verdict "Past results: positive · Evidence: strong" (`lib/trades.ts:296`) reads as a rating of the trader
  (red team, F3b): its user string becomes the owner's F-4 2026-10-31 trust line; the tier name stays internal.
- Completeness words still shipped are removed (§4.1, DS-18): `month/[ym]/opengraph-image.tsx:12`,
  `month/[ym]/page.tsx:29,53,75`, `lib/month-card.ts:35`, `trade/[sellId]/opengraph-image.tsx:11`.

### 2.8 R8: Tokens

Full table in §5. Reasons:
- **Keep the nine variable names**, change values: PRs #30 and #36 append about 55 rules reading them; a rename
  breaks them at merge (engineer).
- **`--control`** #7c818b / #6f7682 (3.61 to 4.13), not design's `--line-strong` #8e8e9a (2.99 on ink bg, 2.72 over
  the down tint). **`--focus`** #2152d9 / #86a8ff, 2 px with a **mandatory** 2 px offset; without it the ring against
  a button is 1.00 to 2.79 (accessibility table F).
- **Gain/loss values:** current light green/rose is ΔE00 **2.8** under deutan (dark 6.3); the ink pair's CVD minimum
  is 27.8 light / 20.1 dark. **Accent = ink** only via variant V-1; links stay underlined (no accent reaches 3:1
  against body text: ink 1.00, violet 2.65; WCAG F73).
- **Type:** 13 px floor (today `.chart .zero-label` is 11 px, `app/globals.css:172`). Tiles at `minmax(min(100%,
  8.5rem), 1fr)` with figures `min(token, 17cqi)`: today's `minmax(130px, 1fr)` (`:115`) keeps two columns at 200%
  and every figure overflows. h1 `overflow-wrap: anywhere`; ranges joined with breakable spaces.
- **Feed hero:** `font-size: min(120px, 22cqi, calc(96cqi / var(--fig-em)))`, `--fig-em` set server-side. Today's
  `clamp(64px, 22vw, 120px)` (`:103`) is 79 px at 360, so "−100.0%" (5.003 em) is 395 px against 328 usable.
- **Nav** overflows at 360 today (331 > 328 px, UX): fixed with the D21/D27 labels (DS-16).
- **DejaVu pin is PR #41** (owner merge, CODEOWNERS): type e2e runs once it lands; until then a unit test checks fit
  against the advance table.

Hero sizing with the formula (secretary; −0.04 em tracking ignored, so real widths are smaller):

| Figure | em | 328 px box (360) | 288 px box (320) | 520 px box (desktop) |
|---|---|---|---|---|
| "+12.3%" | 4.308 | 72.2 px → 311 px | 63.4 → 273 | 114.4 → 493 |
| "−4.5%" | 3.612 | 72.2 → 261 | 63.4 → 229 | 114.4 → 413 |
| "−100.0%" / "+999.9%" / "+1,235%" | 5.004 | 62.9 → 315 | 55.3 → 276 | 99.8 → 499 |
| "≈−100.0%" | 5.842 | 53.9 → 315 | 47.3 → 276 | 85.5 → 499 |
| "+12,346%" | 5.700 | 55.2 → 315 | 48.5 → 276 | 87.6 → 499 |
| "+123,457%" | 6.396 | 49.2 → 315 | 43.2 → 276 | 78.0 → 499 |

Today at 360: "+123.4%" 374 px, "+1234.5%" 426 px, "≈−100.0%" 437 px, all over 328 (accessibility table J).

**Process rule (CLAUDE.md three versions):** AA/CVD values, the range bug, the minus glyph, overflow, badge text,
completeness words and the warn token are fixes. The ink accent (with blue focus) and the type, spacing and radius
collapse are three-variant proposals (V-1, V-2).

---

## 3. Number format

All formatting lives in `lib/format.ts`: `pct()` (moved from `lib/trades.ts:162` and re-exported there so the about
75 call sites keep compiling), `winPct()`, `tone()`, `figureEms()`, `rangeLine()`, `dateText()`, `imageDate()`,
`count()` (exists). No surface formats its own figures.

| Case | Format | Example | Where |
|---|---|---|---|
| Gain | "+" then 1 decimal | +12.3% | every surface, web and images |
| Loss | U+2212 then 1 decimal | −12.3% | every surface, alt text, metadata, axis labels |
| Prints as zero | no sign, `--flat`, the word "Flat" visible; "about even" in accessible text | 0.0% Flat | rows, headline, hero |
| ≥ 1,000% (rounded absolute value) | whole number, thousands comma | +1,235% · −1,235% (a short loss cannot be below −100%) | everywhere |
| Near-total loss short of −100% | up to 2 extra decimals | −99.95% · −99.99% | `pct()` only |
| Loss worse than −99.995%, not total | "≈" before the sign | ≈−100.0% | `pct()` only; never on an average, range or chart value |
| Total loss | exact | −100.0% | everywhere |
| Average with range | "‹avg› per trade, likely between ‹lo› and ‹hi›"; lo/hi at the same precision as avg; lo clamped at −100.0% | +1.4% per trade, likely between −0.1% and +2.7% | profile, pane, card, `/t`, compare, month, trade |
| Range under 5 bets | "Too early to tell" in place of the range | Too early to tell (3 of 5 bets) | D22 record line, profile |
| Win rate | whole percent; never 100% with a loss, never 0% with a win | 99% win rate | beside average and range only (F-4) |
| Counts | grouped, unit named | 2,828 closed trades · 9 bets | `count()` / `counted()` |
| Chart axis | "0%" plus the end value from `pct()`; later ticks whole percents | 0% · −100% | `chart.tsx`, images |
| Chart header value | one step below the headline, tone of the printed end value | +47.2% | pane, profile |
| Unrealized | as gain/loss, then "as of ‹date›" in the same element | −3.1% as of Nov 1 | F-6 surfaces only |
| Rates | "~" allowed only on rates (TR-9) | ~15 trades/month | TR-9 |
| Marks | ▲/▼ at 0.6 em on rows and stat tiles; not on the hero at 360 | ▼ −4.5% | web lists |

Invariants (tests):
- Printed lo ≤ printed avg ≤ printed hi, on every surface.
- Every negative string starts with U+2212 or "≈U+2212".
- No "≈" outside `pct()` (grep over `lib/copy.ts`, `app/**` and the image files).
- No `> 0 ? 'up' : 'down'` or `>= 0 ?` tone decisions in `app/` (grep).
- Each image's bundled font has glyphs for every character used (U+2212, ○); assert through the cmap.

---

## 4. Trust language

### 4.1 String table

Content designer's table with the rulings applied. "Gov." is the governing decision.

| Key | Current (file:line) | Final | Gov. |
|---|---|---|---|
| `Badge` verified | "✓ Verified" + tooltip (`app/ui.tsx:11`) | "Verified" (no glyph); link `/how#verified`; `plain` form inside row links | R1, F-4 10-22, F3a |
| `Badge` demo | "Demo" + tooltip "Sample data, not from a real broker." (`app/ui.tsx:12`); hand-rolled spans (`month/[ym]/page.tsx:54`, `trade/[sellId]/page.tsx:45`) | "Demo", with ○, link `/how#demo`; definition "Demo data, not from a real broker." | R2, P2 |
| `SHARE_CARD.verified` | "✓ Verified from broker" (`lib/copy.ts:125`) | "Verified" | R1 |
| `SHARE_CARD.connected` | "✓ Broker connected" (`lib/copy.ts:126`) | "Broker connected" | R1 (reserved glyph) |
| `SHARE_CARD.demo` | "Demo data" (`lib/copy.ts:131`) | "Demo" (pill) | R2 |
| `SHARE_CARD.demoImage` | "Demo data, not a real broker record" (`lib/copy.ts:138`) | unchanged (square and story images) | R7 |
| `STORY_VERIFIED` | replaces the label (`lib/copy.ts:170`) | pill "Verified" + sub-line "Imported read-only from the broker" | R1, F3a |
| stock image status | "Sample data" / "Includes sample data" / "Verified from broker" (`app/t/[symbol]/opengraph-image.tsx:41`) | "Demo data" / "Includes demo data" / no Verified pill for a security (F3b) | R2, F3b |
| `/t` notes | "Sample data, not from a real broker." / "Includes sample data marked Demo." (`Spread.tsx:23-24`, `Timeline.tsx:36-37`, `HoldTime.tsx:13-14`, `Baseline.tsx:19,40`) | "Demo data, not from a real broker." / "Includes demo records, marked Demo." | R2 |
| `/t/[symbol]` description | "… verified closed trades … · Evidence: ‹tier› … Sample data." (`app/t/[symbol]/page.tsx:58`) | "‹N› closed trades in ‹SYM› on Stock Social, losses included." + "Includes demo records." when mixed; no win rate or average for a security | F3b, R2 |
| new `VERIFIED_DEFINITION` | two paraphrases (`app/layout.tsx:34-35`, `HOW.verified`) | "Imported read-only from the trader's broker. Returns are calculated by Stock Social from those trades. Verified does not confirm who the trader is, does not show accounts at other brokers, and is not an audit or an endorsement by the broker, SnapTrade or anyone else." | R1, F3a |
| `DISCLAIMER` (footer) | hard-coded (`app/layout.tsx:34`) | `DISCLAIMER` from `lib/share.ts:16`: "Not investment advice. Past performance does not guarantee future results." | F3, D20 |
| `metadata.description` | D27 line (`app/layout.tsx:11`) | "Closed trades imported read-only from connected broker accounts. Losses included." | R5 |
| new `FIRST_VISIT.line` | none | "Closed trades imported read-only from connected broker accounts. Losses included." | R5, A-1 |
| new `FIRST_VISIT.demo` | none | "Demo records are marked Demo." (only while page 1 holds a demo card) | R5 |
| new `FIRST_VISIT.link` | none | "How it works →" (to `/how`, "How records are calculated") | R5, D27 |
| new `FIRST_VISIT.dismiss` | none | "Dismiss" (aria-label "Dismiss this note") | D27 |
| nav `/t` | "Stocks" (`app/layout.tsx:27`) | "Trades by stock"; `/t` h1 matches | D27 |
| `/t` title | "Stocks with verified trades · Stock Social" (`app/t/page.tsx`) | "Trades by stock · Stock Social" | D27, F3a |
| `/t` description | "Browse every stock with verified closed trades: …" (`app/t/page.tsx:17`) | "Browse stocks that have closed trades on Stock Social." | R5, A-2, D25 |
| `/t` intro | "Stocks with at least one verified closed trade from connected accounts. …" (`app/t/page.tsx:103`) | "Stocks with at least one closed trade from connected accounts or demo records. Open a stock to see its trades, losses included. Percentages only." | F3a |
| nav signed out | "Publish your trades" (`app/layout.tsx:29`) | "Sign in" | D21 |
| `SIGNIN.title` | "Publish your trades" | "Sign in" | D21 |
| `SIGNIN.publishPath` / `followPath` | none | "Publish my record" (first) / "Follow and save records" | D21 |
| `FEED.publish`, join CTA | "Publish your trades" / "Verify your record" | "Publish your record" | D21, F3a |
| `TRUST_NOTICE.primary` | "Connect brokerage (read-only)" | "Connect your broker (read-only)" | glossary |
| StatusLine, real record | "Record since ‹date› · ‹connected›. Only trades from connected accounts are shown." (`app/u/[handle]/page.tsx:188`) | "Record since ‹Mon D, YYYY› · Connected: ‹N› account(s) at ‹N› broker(s) · Last close ‹date› · updated ‹relative›" + the definition line | TR-8, D29 |
| StatusLine, demo record | same string (implies real accounts) | "Record since ‹date› · Demo" | P2 |
| StatusLine, idle | none | "· not updated since ‹Mon D, YYYY›" | D29 |
| StatusLine, frozen | "Connected: …" after disconnect (`connectedLine`) | "Disconnected ‹Mon D, YYYY› · record frozen · Last close ‹date›" | TR-5, R3 |
| `STATUS.accountRemoved` | none | "Account removed ‹Mon D, YYYY›" | TR-5 |
| `STATUS.account` | "account N" (`lib/positions.ts`) | "Account N of M" | D29 |
| `OPEN.*` "as of" | "as of ‹day›" (`lib/copy.ts:448-461`) | unchanged; only beside valuations | F-6, R3 |
| `.badge.new` | "New record" (`app/u/[handle]/page.tsx:176`, `record-card-image.tsx`, `month/[ym]/page.tsx:75`, `trade/[sellId]/page.tsx:56`) | "New record" + link `/how#new-record` (recommend "Early record", O-1) | TR-7, R4 |
| New-record sub-line | "New record · short record, wide uncertainty" (`lib/month-card.ts:39`, trade image `:59`); "short record" (`trade/[sellId]/page.tsx:64`, `month/[ym]/page.tsx:82`) | "New record · under 30 days or under 10 closed trades" | R4 |
| `share-prompt.tsx:45` | "…the card is labelled New record." | unchanged until O-1 | TR-7 |
| new `HOW.newRecord` | none | "New record: under 30 days of history or under 10 closed trades. A new record has a wide range." | D24, TR-7 |
| incomplete badge | `.badge.new` reused for `SECTION.incomplete` (`app/suggest-section.tsx:34`) | `TRUST_LOOK.incomplete` (warn look) | R7 |
| evidence verdict | "Past results: ‹edge› · Evidence: ‹tier› (…)" (`lib/trades.ts:296`) | the owner's F-4 2026-10-31 trust line for that tier and edge | F-4, R7 |
| too-early, grouped | "Too early to tell: N trades in K overlapping positions (5 independent bets needed)" (`lib/trades.ts:293`) | "Too early to tell: N trades, counted as K separate bets because some overlapped (5 bets needed)" | D24 |
| `Baseline.tsx:39` | "Not enough independent bets…" | "Not enough bets…" | D24 |
| range caption | "‹lo› to ‹hi› · 95% range" (`app/u/[handle]/page.tsx:234`; `HoldTime.tsx`, `Concentration.tsx`, `compare/page.tsx`) | "likely between ‹lo› and ‹hi›" | F-4, R6 |
| range note | "95% range from independent bets (…)" (`page.tsx:248`) | "Range from bets: same-stock trades that overlap count as one bet. A wider range means less evidence." ("95%" on `/how` only) | D24 |
| `rangeText` | "(‹lo› to ‹hi›)" (`lib/trades.ts:299-300`) | `rangeLine()`: "likely between ‹lo› and ‹hi›" | R6 |
| avg label | "avg return / trade" (`app/pane.tsx:55`, profile) | "average per trade" | D24, F-4 |
| profit factor | "profit factor" | "Profit factor"; What's this: "Total gains divided by total losses, in percent per trade." | D24 |
| month completeness | "Their whole record" (`month/[ym]/page.tsx:75`), "whole record:" (`:29`), "@h's full record" (`:53`), "Whole record:" (`lib/month-card.ts:35`) | "Their record", "record:", "@h's record", "Record:" | R7, F3a |
| image alt completeness | "…, with the whole record" (`month/[ym]/opengraph-image.tsx:12`); "…, with the full record" (`trade/[sellId]/opengraph-image.tsx:11`) | "…, with the trader's record line" + both disclaimer sentences | R7 |
| empty feed | dev command (`app/page.tsx`) | "No public records yet." + "Connect your broker to publish the first record." | D25 |
| `FEED.retry` | "Retry" | "Try again" | glossary |
| `SECTION.skip` | "Skip to the disclaimer" | "Skip to disclaimer and legal links" (= `FOOTER.skip`) | — |

**Banned in UI copy** (string test): "Verified from broker", "Verified by", "straight from", "Sample data",
"independent bets", "overlapping position", "95% range" (outside `/how`), "every stock", "whole record", "full
record", "Record under 30 days", "short record", "Imported ‹date›" as a freshness stamp, "Retry", "Verify your
record", and any check glyph (U+2611, U+2705, U+2713, U+2714, U+1F5F8).

**Glossary:** record · closed trade · open position · bet · broker (never "brokerage") · SnapTrade (the only vendor
name) · Verified · Demo · average per trade · likely between ‹lo› and ‹hi› · Too early to tell · Last close ‹date› ·
updated ‹relative› · Disconnected ‹date› · record frozen · Account removed ‹date› · Account N of M · as of ‹date›
(valuations only) · New record · Publish my record (choice button) / Publish your record (prompts) · Follow and save
records · Sign in · Try again · Trades by stock · Held ‹N› days.

### 4.2 TRUST_LOOK

One table in `lib/trust-look.ts`. `Badge`, `Notice`, `lib/record-card.ts`, `lib/month-card.ts`, `lib/story-image*`
and all four image files read it. Image hexes come from `lib/palette.ts` (DS-6).

| State | Word | Colour token | Border | Glyph | Link | Notes |
|---|---|---|---|---|---|---|
| Verified | "Verified" | `--verified` (= `--text`) | 1 px solid `--verified`, no fill | none | `/how#verified` | every activity `source='snaptrade'`; no "not verified" fallback (`lib/pane.ts:47`) |
| Demo | "Demo" | `--demo` on `--demo-bg` | 1 px dashed `--demo` | ○ (`aria-hidden`) | `/how#demo` | same box and weight as Verified; images add "Demo data, not a real broker record" |
| Importing | "Importing record" | `--muted` | 1 px solid `--control` | "…" static, no animation | `/how#verified` | stats hidden (`SHARE_CARD.importingNote`) |
| Broker connected (no closes) | "Broker connected" | `--muted` | 1 px solid `--control` | none | none | no check glyph |
| Record incomplete / failed import | "Import did not finish" | `--warn` text on `--warn-bg` box | 1 px solid `--warn` | warning triangle with "!", SVG, `aria-hidden` | `/how#incomplete` | `role="status"`; never `--down`; never beside a figure |
| New record | "New record" (owner may amend, O-1) | `--muted` | 1 px solid `--control` | none | `/how#new-record` | never on the figure's line |
| Not verified / no broker | "Not verified" / "No broker connected" | `--muted` | none (text) | none | `/how#verified` | card-only states (`SHARE_CARD.notVerified/noBroker`) |
| Disconnected | "Disconnected ‹Mon D, YYYY›" | `--muted` | none (StatusLine segment) | none | `/how#disconnect` | badge stays Verified; card pill is owner flag O-4 |

Badge box: `--fs-caption` 13 px / 700, padding 3 px 8 px, radius 999. The badge is 24 px tall inside a 44 px row.
`white-space: normal; max-width: 100%`, so a long state wraps at 200% rather than overflowing. Borders use `border`,
never `box-shadow`.

### 4.3 Per-surface placement

Record context on every surface. The "Disclaimer" column means D20's in-view line; the footer copy stays everywhere.

| Surface | File | Trust mark | Record context | Dates | Disclaimer |
|---|---|---|---|---|---|
| Feed card | `app/ui.tsx` (`TradeCard`), `app/page.tsx` | badge in the header row, after a gap from the handle (never touching it) | D22 record line: "‹N› closed trades · ‹avg› average per trade, likely between ‹lo› and ‹hi›" or "Too early to tell" (552 px at 14 px, 2 lines); "Disconnected ‹date›" on its own muted line when frozen | "Held ‹N› days · closed ‹date›" with the web year rule (proposal A-3) | first screen at 360 and each appended page (D20) |
| Swipe pane | `app/pane.tsx` | badge beside the headline stats | StatusLine + `VERIFIED_DEFINITION`; headline average + range; F-6 open line | D29 StatusLine | **under the headline**, not at the pane foot (D20; at 360×740 the foot is below the fold) |
| Profile | `app/u/[handle]/page.tsx` | badge on its own platform row beside the stats (today it follows `@handle`, `:176`) | StatusLine, definition, New record badge (TR-7), headline, open positions (TR-4) | D29; Disconnected outranks | under the headline stats |
| Trade page | `app/u/[handle]/trade/[sellId]/page.tsx` | badge beside the record line | one box: "‹SYM› ‹pct› · closed ‹date›" + "Record: ‹record line›" + StatusLine | closed date with year rule | in that box |
| Month page | `app/u/[handle]/month/[ym]/page.tsx` | badge beside "Their record" | record line + StatusLine | month + Last close | in view |
| `/t/[symbol]` | `app/t/[symbol]/page.tsx` | per-row badge, `plain` form (rows are links) | intro "Closed trades on Stock Social, shown as percentages, losses included. Records of trades, not a rating of the stock."; no security-level win rate, average or Verified pill (F3b) | "closed ‹date›" per row | under the stats block |
| Stocks index | `app/t/page.tsx` | none per stock | A-2 line + corrected intro | none | footer |
| Record card image | `app/u/[handle]/record-card-image.tsx`, `lib/record-card.ts` | trust word pill from `TRUST_LOOK` | as F-4 decided (chart, count, period, headline, range, trust line) | O-3 (recommend "Last close ‹Mon D, YYYY›"); Disconnected pill O-4 | ≥ 35 px (complies) |
| Trade image | `app/u/[handle]/trade/[sellId]/opengraph-image.tsx` | trust word in the figure's band | crop band: handle, trust word, record line at ≥ 50% of figure size, "Last close ‹Mon D, YYYY›", printed link; no thesis | year always | ≥ 35 px (today 22) |
| Month image | `app/u/[handle]/month/[ym]/opengraph-image.tsx`, `lib/month-card.ts` | same band | same band | year always | ≥ 35 px (today 22) |
| Stock image | `app/t/[symbol]/opengraph-image.tsx` | "Demo data" / "Includes demo data" only | no numbers for the security (F3b) | none | ≥ 35 px (today 30 px footer) |
| Story / square | `app/u/[handle]/story/route.tsx` | "Verified" pill + "Imported read-only from the broker" sub-line, or "Demo data, not a real broker record" | as F-4 | as F-4 | ≥ 32 px at 1080 |
| Link preview text | `generateMetadata` in profile, trade, month and `/t` pages | og:title leads with "@handle"; "Demo" in og:title for demo records | record line; no "verified" for demo or a security | none | both sentences end every description that carries a return (O-11) |

**Height budget, first feed card at 360×740** (UX, DejaVu): about 663 px including the first-visit slot, leaving
77 px. While an Undo or sign-in bar (about 56 px) shows, bottom padding grows by the bar's height, and the
disclaimer's rect never intersects a bar (WCAG 2.4.11).

---

## 5. Design tokens

### 5.1 Colour tokens

Dark stays the default `:root`; light lives under `@media (prefers-color-scheme: light)` (as today). Contrast is
computed by the secretary (WCAG 2.x): light bg / surface, then dark bg / surface.

| Token | Maps to | Light | Dark | Contrast L (bg / sf) | Contrast D (bg / sf) | Role |
|---|---|---|---|---|---|---|
| `--bg` | `--bg` (#fafafa / #0b0b0f) | #f6f6f3 | #0f1114 | — | — | page |
| `--surface` | `--surface` (#fff / #16161d) | #ffffff | #181b20 | — | — | cards, inputs, sheets |
| `--surface-2` | new | #ededea | #21252b | — | — | pressed toggle, hover, sheet header; muted on it 5.56 / 5.91, control 3.33 / 3.36 |
| `--text` | `--text` | #15171c | #eceef1 | 16.56 / 17.93 | 16.27 / 14.85 | body, figures |
| `--muted` | `--muted` | #585e69 | #9aa1ac | 6.02 / 6.52 | 7.26 / 6.63 | labels, captions, flat figures |
| `--line` | `--line` | #dedfda | #2a2e35 | 1.24 / 1.34 | 1.39 / 1.27 | decorative dividers only; never a control boundary |
| `--control` | new (replaces design's `--line-strong`) | #7c818b | #6f7682 | 3.61 / 3.91 | 4.13 / 3.77 | input, checkbox, secondary-button and summary borders; dashed 0% axis (3.13 / 3.59 over a 10% down tint) |
| `--up` | `--up` | #0b6b70 | #3cc4b4 | 5.79 / 6.27 | 8.78 / 8.01 | gain text and line; 5.25 / 6.49 on a 12% up tint |
| `--down` | `--down` | #b2441b | #ff8a5b | 5.19 / 5.62 | 8.14 / 7.43 | loss text and line; 4.74 / 6.11 on a 12% down tint (thinnest text pair) |
| `--flat` | new = `var(--muted)` | #585e69 | #9aa1ac | 6.02 / 6.52 | 7.26 / 6.63 | a value that prints 0.0% |
| `--accent` | `--accent` (violet #6d28d9 / #a78bfa) | V-1: #15171c (ink) | V-1: #eceef1 | 16.56 / 17.93 | 16.27 / 14.85 | primary fill, selected chip, pressed tab; violet stays until V-1 is chosen |
| `--on-accent` | `--on-accent` | V-1: #ffffff | V-1: #0f1114 | 17.93 on accent | 16.27 on accent | text on accent (`.rec-chips .on` and pressed tabs move off `var(--bg)`) |
| `--focus` | new; interim `var(--accent)` | V-1: #2152d9 | V-1: #86a8ff | 5.92 / 6.42 | 8.16 / 7.45 | focus ring only |
| `--verified` | new = `var(--text)` | #15171c | #eceef1 | 16.56 / 17.93 | 16.27 / 14.85 | Verified text and border |
| `--demo` | new | #6e1f66 | #f0b8e8 | 9.46 / 10.24 | 11.46 / 10.46 | Demo text and dashed border; never on figures or charts |
| `--demo-bg` | new | #f8eef6 | #2a1a28 | demo on it 9.05 | demo on it 9.97 | Demo badge fill (not relied on) |
| `--warn` | new | #8a5a00 | #f2b84b | 5.47 / 5.93 | 10.56 / 9.65 | failed or incomplete import, held thesis; never bare text |
| `--warn-bg` | new | #fdf3df | #2a2213 | warn on it 5.38 | warn on it 8.78 | warn box fill |
| `--scrim` | new | `color-mix(in srgb, var(--bg) 70%, transparent)` | same | — | — | replaces the 3 inline scrim mixes |

- Gain vs loss, CVD minimum ΔE00: 27.8 light / 20.1 dark. Today: 2.8 light deutan / 6.3 dark.
- Every gain/loss pair has a luminance ratio of 1.08 to 1.61, so the sign, mark and words stay required (A1).
- Images (dark only): one muted grey #a3aab5 (8.08 on #0f1114), replacing today's three (#a1a1ad, #8b8b98, #6b6b78).
  Base 0% line #6f7682 (4.13). Demo per O-2.
- `themeColor` follows the scheme (`app/layout.tsx:13` is dark-only today).

### 5.2 Type scale

Font stack: `system-ui, ui-sans-serif, sans-serif` (generic keywords only). The e2e font is DejaVu Sans once #41
lands. Every step is in rem (px does not follow the text-size setting; 1.4.4). Clamp is used only on h1, h2 and
display. Weights are 400 / 600 / 700, with 800 on display only. "Headroom" is measured in DejaVu at 360 px (328 px
content box).

| Token | rem | px at 360 | Line height | Weight | Use | DejaVu headroom note |
|---|---|---|---|---|---|---|
| `--fs-caption` | 0.8125 | 13 | 1.4 | 400 / 700 | badges, chart axis labels (today 11 px), footer disclaimer floor | badge "Verified" 72.8 px; the axis column is ≥ 4 em ("−100%" at 13 px = 48 px) |
| `--fs-small` | 0.875 | 14 | 1.45 | 400 / 600 | StatusLine, record line, in-view disclaimer, first-visit line | disclaimer 535 px → 2 lines; StatusLine with year 318.5 px, wraps at "·" (no-break space inside each part) |
| `--fs-body` | 1 | 16 | 1.5 | 400 | body, rows, inputs, UserNote | longest word "performance" fits at 200% |
| `--fs-lead` | 1.125 | 18 | 1.45 | 400 | lead text; a thesis is never larger than the figure | — |
| `--fs-h2` | clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem) | 20 | 1.2 | 700 | section titles | — |
| `--fs-h1` | clamp(1.5625rem, 1.3rem + 1.2vw, 2rem) | 25 | 1.15 | 700 | page title, `overflow-wrap: anywhere` | 20-char handle 307 px (21 px spare); 615 px at 200%, so it must wrap |
| `--fs-num-m` | 1.5 | 24 → `min(24px, 17cqi)` | 1.1 | 700 tabular | stat tiles | 134 px tile: 17cqi = 22.8 px; "+1,235%" 114 px fits; today's 24 px overflows by 2 to 8 px |
| `--fs-num-l` | clamp(2rem, 1.6rem + 1.6vw, 2.5rem) → `min(token, 17cqi)` | 32 (full-width tile) | 1.05 | 700 tabular | headline stat, trade figure, chart value | full-width tile 302 px: "−100.0%" at 32 px = 160 px; in a 2-column tile it falls to 22.8 px |
| `--fs-display` | `min(120px, 22cqi, calc(96cqi / var(--fig-em)))` | 49 to 72 by content | 1 | 800 tabular, −0.04 em | feed hero only | always ≤ 96% of the box (§2.8 table); `--fig-em` comes from `figureEms()` |

- Today there are 32 `font-size` declarations with 24 distinct values (engineer).
- The ratchet rule (literal font-size and radius counts may only fall) starts with V-2.
- The overflow fixes above (display formula, `min(…, 17cqi)`, tile `minmax`, h1 wrap, the 13 px floor) are fixes,
  and they ship before V-2.

### 5.3 Spacing, radius, tap, focus

| Rule | Value |
|---|---|
| Spacing | `--sp-1..8` = 4, 8, 12, 16, 24, 32, 48, 64 px; strays snap to the nearest (V-2) |
| Gutter | 16 px on the feed card and pane (328 px at 360) |
| Tap | `--tap` 44 px: every button, summary, row link, tab and nav link |
| Radius | `--r-control` 6 (inputs, buttons, chips, checkbox) · `--r-box` 10 (tiles, cards, sheets, dialogs, bars) · `--r-pill` 999 (badges and the range Segmented control only); chips leave the pill (`.rec-chips`) so a badge never looks tappable |
| Elevation | none: surface step + `--line`; `--scrim` for sheets and dialogs |
| Focus | `outline: 2px solid var(--focus); outline-offset: 2px` on every focusable element (today 5 accent, 2 text, 1 `--line` at 1.31 / 1.20:1 on `.hl`); the offset is mandatory (without it the ring against a button is 1.00 to 2.79); a focused chart point gets a 2 px bg gap **under** the ring (the ring is 1.00 to 1.58 against gain/loss lines) |
| Scroll padding | `html { scroll-padding-top: 72px; scroll-padding-bottom: 88px }` (2.4.11) |

### 5.4 Motion

No celebration of any kind. Gains and losses are motion-identical. Only transform and opacity, at ≤ 160 ms (240 ms
cap for a programmatic pane open), for finger-following, sheets entering and the SW-1 peek. One global
`prefers-reduced-motion: reduce` block zeroes transforms, animations and smooth scroll, and nothing informational
disappears with the motion.

---

## 6. Per-screen and per-component change list

Order key (engineer): **Now** = no overlap with open PRs. **#35** = after the F-4 rework merges (it touches
`record-card-image.tsx`, `record-card.ts`, `confidence.ts`, profile `page.tsx`, `copy.ts`, `share-prompt.tsx`, new
`bets.ts`). **#30/#36** = after the PRs that append CSS to the tail of `globals.css`. **#41** = after the DejaVu pin
(owner merge). #40 and #42 overlap only 2 to 4 lines of the profile `page.tsx`. Type: **fix** or **3V** (three
variants). Pinned-string tests are updated, never deleted (count kept).

**Standing rule for builders.** Any limit a build leaves is marked in code with a `ponytail:` comment (CLAUDE.md
"Known limits" convention) naming the limit and its next step, and the PR's hand-off note lists it. The expected
limits per change are in the table after this one; a build that leaves one of them must carry its `ponytail:` marker.

| ID | What | Files | Type · effort · order | Acceptance criteria |
|---|---|---|---|---|
| DS-1 | Token layer, value-neutral: every §5.1 token at today's value or alias (`--focus: var(--accent)`), `--sp-*`, `--tap`, `--r-*`, `--fs-*`; dedupe `.sr-only` (3×: `globals.css:130,193,261`); edits only in the token blocks | `app/globals.css` | fix · S · Now | screenshot diff 0 on every e2e screen; one `.sr-only` |
| DS-2 | Contrast-pair test: generalise `lib/badge-contrast.test.ts` (kept) into `lib/tokens.test.ts` with a `PAIRS` table; parser resolves `var()` and `color-mix` (today's regex skips aliases) | new `lib/tokens.test.ts` | fix · S-M · Now | text tokens ≥ 4.5 on bg, surface, surface-2, both schemes; `--control`, `--focus` ≥ 3; each badge ≥ 4.5 on its computed bg; `--demo` ΔE00 ≥ 9 (protan, deutan, tritan) vs up, down, focus, warn, accent; **fails on today's light Verified (3.77) until DS-3** |
| DS-3 | AA fixes: Verified badge to ink outline (`globals.css:110`, 3.77 → 16.56); control borders (inputs, `button.secondary`, summary, switch; about 15 rules) to `--control`; `.hl` outline to `--focus`; scroll padding; `.chart .zero-label` 11 px → 13 px in an em-sized axis column | `app/globals.css` | fix · S · Now | DS-2 green; e2e computed colour and border of `.badge.verified`; zero-label `fontSize` 13 px |
| DS-4 | Meaning-colour values from the ink palette: `--bg --surface --text --muted --line --up --down` + `--control --warn* --demo* --surface-2`; bg/surface/text shift with the gain/loss swap because every measured pair used them; `--accent`/`--focus` unchanged (V-1) | `app/globals.css` (about 20 lines) | fix (CVD 2.8 → 27.8) · S · Now, after DS-3 | DS-2 green; gain/loss CVD ΔE00 ≥ 20 assertion; `e2e/app.spec.ts:1475` still holds |
| DS-5 | Demo look: dashed `--demo` border, ○, `--demo-bg`, same box as Verified (today muted grey, quieter, `globals.css:112`); hand-rolled spans (`month/[ym]/page.tsx:54`, `trade/[sellId]/page.tsx:45`) become `Badge` | `app/globals.css`, `app/ui.tsx`, those pages | fix · S · Now | snapshot: dashed border, glyph, word, height = Verified ± 1 px; `e2e/app.spec.ts` `'Demo'` ×6 pass |
| DS-6 | One palette source for images: new `lib/palette.ts` `{dark, light}`; four image files import it (ends three muted greys); `themeColor` per scheme | new `lib/palette.ts`; `app/u/[handle]/record-card-image.tsx` (`C`), `app/u/[handle]/opengraph-image.tsx`, `app/u/[handle]/story/route.tsx`, `trade/[sellId]/opengraph-image.tsx`, `month/[ym]/opengraph-image.tsx`, `app/t/[symbol]/opengraph-image.tsx`, `app/layout.tsx:13` | fix · M · #35 | parity test: every key = CSS value per scheme; grep: no `#rrggbb` in `app/**/*.tsx` outside it; card Demo stays as shipped (`cardDemo`) until O-2 |
| DS-7 | `TRUST_LOOK` (§4.2); `Badge` `linked`/`plain`; `plain` inside row links (`app/t/[symbol]/page.tsx`, `Theses.tsx`, `app/suggest-section.tsx:34`, `app/u/[handle]/similar-section.tsx`); tooltip removed; `/how` anchors `#verified #demo #new-record #incomplete #disconnect` (none exist) | new `lib/trust-look.ts`; `app/ui.tsx`, `lib/copy.ts`, `lib/record-card.ts`, `lib/month-card.ts`, `app/how/page.tsx`, `app/globals.css` | fix · M · #35 (retarget #36's `.badge.test-mode` after #36) | one word per state across Badge and every image model; no nested `a`; Verified href `/how#verified`; §4.1 banned-string test; `copy`, `record-card` (+ #35 rework), `story-image`, `month-card`, `pane`, `e2e/connect` tests updated |
| DS-8 | Badge off the h1 line onto the stats row (`app/u/[handle]/page.tsx:176`); `VERIFIED_DEFINITION` visible in profile and pane StatusLine; titles lead "@handle (Name)" | `app/u/[handle]/page.tsx`, `app/pane.tsx`, `lib/copy.ts` | fix · S · #35 | DOM: badge not sibling of name, handle, avatar; definition visible (not `title`); og:title starts "@" |
| DS-9 | Footer renders `DISCLAIMER` (`lib/share.ts:16`) and `VERIFIED_DEFINITION`, not literals (`app/layout.tsx:34-35`) | `app/layout.tsx`, `lib/copy.ts` | fix · S · Now | sentence literal only in `lib/share.ts`; 9 e2e disclaimer assertions pass |
| DS-10 | `lib/format.ts`: `pct()` with U+2212, ≤ 2 extra decimals, "≈" rule, ≥ 1,000% whole with comma (re-exported from `lib/trades.ts`); `winPct()` clamps; `figureEms()` | `lib/format.ts`, `lib/trades.ts`, about 12 win-rate sites | fix · S code / M tests (21 hyphen asserts in `lib/trades.test.ts`, `record-card.test.ts`, `month-card.test.ts`, `confidence.test.ts`, `insights.test.ts`, `e2e/app.spec.ts`, `e2e/f6-open-positions.spec.ts`) · #35 | `pct(-0.99999)` "≈−100.0%"; `pct(-0.9995)` "−99.95%"; `pct(12.3456)` "+1,235%"; `pct(-0.0004)` "0.0%"; `winPct` 199/200 → 99, 1/200 → 1; no "≈" outside `pct()`; image fonts have U+2212 (cmap) |
| DS-11 | One `tone()` from the printed string, in `lib/format.ts`; `.flat` + "Flat" + "about even"; replace 15 inline decisions; chart line by printed end value, flat in `--text` | `lib/format.ts`, `lib/open-split.ts`, `app/ui.tsx`, `app/pane.tsx`, `app/me/likes/page.tsx`, `app/me/record/page.tsx`, `app/t/[symbol]/page.tsx`, `HoldTime.tsx`, `Theses.tsx`, `Concentration.tsx`, `app/t/compare/page.tsx`, `app/t/[symbol]/opengraph-image.tsx`, `app/u/[handle]/page.tsx`, `chart.tsx`, `similar-section.tsx`, `lib/record-card.ts` | fix · M · #35 | grep bans `> 0 ? 'up'` and `>= 0 ?` tone decisions in `app/`; 0.0% fixture renders `.flat` on hero, pane, profile, chart; accessible names contain "a gain", "a loss" or "about even" |
| DS-12 | Headline and chart line from the same `tone()` input, or a visible series caption, until OD-2 (a screenshot shows "+1.3%" green over a red line ending below 0%) | `lib/record-card.ts`, `app/u/[handle]/chart.tsx` | fix · S · #35 | positive-average, negative-end fixture: matching tones or caption |
| DS-13 | Range contains the headline: arithmetic `perTrade`, cluster-robust SE on raw returns, low clamped at −1; profile and `/t` adopt `lib/bets.ts#arithmeticRange`; `rangeLine()` "likely between"; drop "· 95% range" and parentheses | `lib/trades.ts:270,299`, `lib/bets.ts`, `lib/confidence.ts`, `lib/recap.ts`, `app/u/[handle]/page.tsx:234,248`, `app/t/[symbol]/page.tsx`, `HoldTime.tsx`, `Concentration.tsx`, `app/t/compare/page.tsx` | fix (build gap vs F-4 10-31) · M · #35 | property test (skewed, K = 5, one huge winner, identical, mean −95%): printed lo ≤ avg ≤ hi, lo ≥ "−100.0%", same decimals; §2.6 cases as fixtures; `pace30` snapshot unchanged |
| DS-14 | Feed hero: `.ret` `min(120px, 22cqi, calc(96cqi / var(--fig-em)))`, `--fig-em` from `figureEms()`, card body `container-type: inline-size`; no ▲/▼ on the hero | `app/globals.css:103`, `app/ui.tsx` | fix · S · Now (e2e #41) | unit: em × size ≤ 96% of box for §2.8 fixtures at 288/328/520; e2e 360×740 and 320×640: `scrollWidth ≤ clientWidth` for −12.3%, −100.0%, ≈−100.0%, +123.4%, +1,235% |
| DS-15 | Reflow: `.stats` `minmax(min(100%, 8.5rem), 1fr)`; figures `min(var(--fs-num-*), 17cqi)`; `h1, .who` `overflow-wrap: anywhere`; ranges joined with U+0020/U+2009 only; badges `white-space: normal; max-width: 100%`; retire `.stats[data-long]` (`globals.css:449`) | `app/globals.css`, `app/u/[handle]/page.tsx`, `app/pane.tsx` | fix · S · Now (e2e #41) | 360 px at 200% text: no horizontal scroll with "+1,235%" and a 20-char handle; F-6 80% headroom asserts (`e2e/f6-open-positions.spec.ts:250-253`) pass |
| DS-16 | Nav fits: signed out "Stock Social · Trades by stock · Sign in" (98.7 + 112.0 + 49.1 + gaps ≈ 288 px; about 302 bold) | `app/layout.tsx:25-29`, `app/globals.css` (`nav.top`), `lib/copy.ts` | fix (D21, D27) · S · Now | `nav.top` `scrollWidth ≤ clientWidth` at 360, signed out and signed in with a 30-char handle (handle ellipsis) |
| DS-17 | Warn for failures: failed import, account claimed, form errors use the warn Notice (icon, box, words), never `--down` | `app/ui.tsx:52`, `app/u/[handle]/page.tsx:184,195`, `month/[ym]/page.tsx:77`, `app/login/page.tsx`, `app/login/sent`, handle error, `app/globals.css` | fix · S · Now | no `className="down record-failed"`; warn box has icon + words; warn on warn-bg 5.38 / 8.78 in DS-2 |
| DS-18 | Completeness words (§4.1 month and image rows) | `month/[ym]/page.tsx:29,53,75`, `month/[ym]/opengraph-image.tsx:12`, `trade/[sellId]/opengraph-image.tsx:11`, `lib/month-card.ts:35` | fix (F3a) · S · Now (`month-card` tests #35) | string test bans `whole record\|full record\|every stock`; `lib/month-card.test.ts:42` updated |
| DS-19 | Image disclaimer 22 → ≥ 35 px (trade, month), stock footer 30 → ≥ 35; crop band (handle, trust word, record line ≥ 50% of figure size, "Last close ‹Mon D, YYYY›", link); no thesis on images; trade figure steps down by `figureEms()` (bundled-font table) | `trade/[sellId]/opengraph-image.tsx:46-61`, `month/[ym]/opengraph-image.tsx:47`, `lib/month-card.ts:40`, `app/t/[symbol]/opengraph-image.tsx:23` | fix (F3, idea 16) · M · #35 | model tests: disclaimer ≥ 35 at 1200; crop test: figure band holds trust word, record line, link; renders of "−100.0%", "≈−100.0%", "+12,346%" with no missing glyphs |
| DS-20 | One Demo name: "Sample data" → Demo wording (§4.1); demo StatusLine "Record since ‹date› · Demo" | `app/t/[symbol]/opengraph-image.tsx:41`, `app/t/[symbol]/page.tsx:58`, `Spread.tsx`, `Timeline.tsx`, `HoldTime.tsx`, `Baseline.tsx`, `app/u/[handle]/page.tsx:188` | fix (P2) · S · Now | grep: no `[Ss]ample data` in `app/`, `lib/`; no "verified" on demo-only `/t` pages and images |
| DS-21 | `StatusLine` (profile, pane): Record since, connection, D29 Last close · updated, idle, Disconnected · record frozen, Account N of M; `dateText()` (UTC, year rule) and `imageDate()` (year always) replace 21 date sites | `app/ui.tsx`, `lib/format.ts`, `lib/copy.ts` (`connectedLine`), `lib/positions.ts`, `app/u/[handle]/page.tsx`, `app/pane.tsx`, `chart.tsx`, date sites | fix (D29, TR-5, TR-8) · M · #35 | disconnected fixture: "Disconnected ‹date›", no "updated", no date after last read; idle fixture: "not updated since"; "as of" only in an element with an unrealized value; image dates carry the year |
| DS-22 | Feed card: D22 record line, "Held · closed" kept pending A-3, "Disconnected ‹date›" line; pane disclaimer under the headline | `app/ui.tsx`, `app/page.tsx`, `app/pane.tsx`, `lib/pane.ts` | fix (D20, D22) · M · #35, coordinated with #30 | e2e 360×740: disclaimer in viewport on card 1 and pane, never intersecting an Undo or sign-in bar; "Too early to tell" fixture under 5 bets |
| DS-23 | First-visit `Notice` in the SW-1 slot (signed out, dismissible, never modal, storage in try/catch), §4.1 `FIRST_VISIT` strings; if A-1 is rejected, D27's line + `FIRST_VISIT.demo` | `app/page.tsx`, `app/ui.tsx`, `lib/copy.ts`, `app/globals.css` | fix (D27 mechanism) · S · #30 | renders with storage throwing; link and line in one element; demo sentence only with a demo card on page 1; D27 counters fire |
| DS-24 | Meta description, `/t` title, description, intro (§4.1) | `app/layout.tsx:11`, `app/t/page.tsx:16-17,103` | fix (intro false today); description per A-2 · S · Now | no "verified" or "every" in `/t` metadata; meta description = positioning constant |
| DS-25 | Glossary sweep: D24 bet wording, "average per trade", "Profit factor" + What's this, "Try again", skip string, verdict → F-4 trust line | `lib/copy.ts`, `lib/trades.ts:291-296`, `lib/confidence.ts`, `app/t/[symbol]/Baseline.tsx:39`, `app/pane.tsx:55`, `app/u/[handle]/page.tsx` | fix (D24, F-4) · S · #35 | grep bans `independent bet\|overlapping position\|avg return\|Evidence: (thin\|moderate\|strong)` in user copy |
| DS-26 | Delete dead `.badge-embed` CSS (`globals.css:209-211`; no off-origin badge); attribute the chart-sheet thesis (`chart.tsx:199`) "@h's note · written after the trade closed · ‹date›" | `app/globals.css`, `app/u/[handle]/chart.tsx` | fix (U2, F3a) · S · Now | no `badge-embed`; sheet thesis has attribution |
| DS-27 | Every outline `var(--focus)` + 2 px offset, incl. `.switch-pair` (#30) and `.rt-card` (#36) | `app/globals.css` | fix · S · #30/#36 | grep: outlines only `var(--focus)`; computed `outline-offset` 2 px on 5 sampled controls |
| DS-28 | **V-1** ink accent, `--on-accent`, blue `--focus` #2152d9 / #86a8ff, pressed tabs fill ink | `app/globals.css`, `lib/palette.ts` | 3V · S each · after DS-27 | DS-2 green; ring ≥ 3:1 vs bg and surface; `--demo` vs `--focus` ΔE00 ≥ 9 |
| DS-29 | **V-2** type, spacing, radius collapse: 24 font sizes → §5.2, 428 px literals → `--sp-*`, 8 radii → 6/10/999; inline styles in `app/me/record/page.tsx` and the month page | `app/globals.css`, those pages | 3V · L · #41 | ratchet (literal font-size, radius, `style={{` counts only fall); 126 e2e fit asserts pass under DejaVu |
| DS-30 | **V-3** signed-in nav labels ("Account" holding handle and own record, or "My habits"; "My record" collides with "Publish my record") | `app/layout.tsx`, `lib/copy.ts` | 3V · S · after DS-16 | nav ≤ 328 px signed in |

---

**Expected `ponytail:` limits** (where known; a build may close them instead):

| DS | Expected limit to mark |
|---|---|
| DS-2 | contrast and ΔE00 computed from token math (sRGB, WCAG 2.x, simulated CVD), not measured on devices; `color-mix` resolved in sRGB only |
| DS-4, DS-6 | images stay dark-only; `themeColor` covers light and dark, not forced colours |
| DS-10 | U+2212 voicing by screen readers unverified; `figureEms()` uses the DejaVu Bold table, not the viewer's system font |
| DS-11 | "about even" is in accessible text only; the chart tint split at 0% is not announced |
| DS-13 | cluster-robust SE with few clusters (K close to 5) is unstable; ranges stay wide by design; `pace30` still log-based until O-5 |
| DS-14, DS-15 | sizes fit DejaVu worst case; a wider system font is not measured; container units need a supporting browser (fallback: today's clamp) |
| DS-16 | signed-in nav relies on handle ellipsis until V-3 |
| DS-19 | the image renderer's bundled-font width table is estimated until the render snapshot measures it; renderer glyph coverage checked by cmap test only |
| DS-21 | relative "updated" time is computed at render; cached pages can show an older relative time |
| DS-22 | the 360×740 height budget is measured with DejaVu at one viewport; shorter viewports rely on the in-view rule's e2e |
| DS-23 | dismissal is per device (browser storage); a private window shows the line again |

---

## 7. Owner flags (each with a recommendation; no owner decision is reopened)

| ID | Question | Recommendation | Reason |
|---|---|---|---|
| O-1 | TR-7 wording "New record" (DESIGN, owner-only) | Amend to **"Early record"**; until then ship "New record" with its link | "New record" beside a large +% can read as an all-time high (F6 spirit); "Short record" reads as short selling; "Early" is true under both triggers. Content, UX, legal and common sense preferred "Short record"; T&S and red team "Early record" |
| O-2 | Demo hue on the F-4 record card, and the card palette | Adopt **tuned plum #f0b8e8** on the card (11.46 on #0f1114; CVD minimum 34.4 / 29.8 vs today's card gain/loss); move the card to the ink card palette when V-1 or DS-4 lands on the web | Sky on the card collides with a teal gain (4.7 tritan) and a blue focus; one Demo look across web and images |
| O-3 | Record-card date line (OD-14) | If a date is added: **"Last close ‹Mon D, YYYY›"**, never "as of" or the render time | A fact of the record that cannot go stale; F-4 2026-11-01 already ends the period at the last close |
| O-4 | "Disconnected" on cards (creative §7 Q1; TR-5) | **"Verified · Disconnected ‹Mon D, YYYY›"** in the existing pill (258 px at card size, fits) | Images have no StatusLine; a Verified card for a frozen record that does not say so is the likelier deceptive-practice finding (legal). Common sense preferred the pill without the date |
| O-5 | Source of the trust line's pattern clause | Say a pattern ("consistent …") only when both the shown arithmetic range and the `pace30` interval are on the same side of 0 | Prevents "likely between +0.4% and +29.6%" beside "no clear pattern"; conservative and symmetric |
| O-6 | Merge PR #41 (DejaVu pin; `playwright.config.ts` in CODEOWNERS) | **Merge before DS-14, DS-15 and DS-29 e2e land** | Without it, fit results differ per machine by about 13%; CI falls back to DejaVu anyway |
| O-7 | "bet" vs F6 wagering vocabulary | Keep "bet" | The owner wrote it in F-4 and D24; a third noun would undo D24 |
| O-8 | `scripts/compliance.ts` patterns (protected path) | Add "Verified from broker", "Verified by", "straight from", "every stock", "whole record", "full record", check glyphs | Enforces §4.1 bans in CI; human-only change |
| O-9 | Reserved words and glyphs in display names (OD-12 neighbour) | Apply NFKC, strip bidi characters, run the skeleton test against verified, demo, official, support, admin, the product name and the vendor name; refuse check and seal glyphs; retire handles that ever had a connected record (OD-12 b) | A display name ending "✓ Verified" merges with the real badge; P-2.3 covers handles only |
| O-10 | Name clearance before the first public card; the internal phrase | Keep the text-only wordmark; the internal phrase stays off all surfaces until cleared | T1, T5a; the record card prints "Stock Social" |
| O-11 | Disclaimer in link-preview descriptions (creative Q11 default) | Both sentences end every description that carries a return | Unfurls travel without the page |
| O-12 | OD-2 (one chart series or two) | Unchanged; interim DS-12 | One picture currently gives two signs |
| O-13 | F3b on stock pages: compare page, Baseline, F-6 per-security unrealized figure (creative Q12/Q16, design OD-8) | No return attached to a security | F3b |
| O-14 | `docs/features/F-6-open-positions.md` reads `Status: ready` after merge (#33) | Owner or pipeline sets the post-merge status | The pipeline may pick it up again (engineer) |

---

## 8. Proposals for the approval council

| ID | Proposal | Type | Reason | Measure |
|---|---|---|---|---|
| F-1 | DS-1 to DS-27 as one ordered fix programme (§6 order) | fix | AA, CVD, range, overflow and F3a defects with computed evidence | DS-2 contrast suite green; range property test; overflow e2e green at 320 and 360 |
| A-1 | Amend D27's first-visit wording to the positioning line + "Demo records are marked Demo." (conditional) + "How it works →"; mechanism unchanged | amend-idea-board-decision | D27's line calls demo cards verified and hides that returns are calculated (F3a, P2) | D27's own: bounce and pane-open rate before and after; a five-person 360 px read test for "every trade" misreadings |
| A-2 | Amend D25's Stocks line to "Browse stocks that have closed trades on Stock Social." | amend-idea-board-decision | The index lists demo-only stocks | none needed (correctness) |
| A-3 | Read D22 as adding the record line while keeping "Held ‹N› days · closed ‹date›" (with the year rule) | amend-idea-board-decision | Without the date a 2020 trade looks current (UX) | card height within the 360×740 budget; open-pane rate unchanged |
| V-1 | Ink accent and blue focus replace violet | variant (three versions) | One hue fewer to collide with; frees blue for focus; trade-dress distance | pane-open rate, sign-in starts, focus-visible audit |
| V-2 | Type, spacing and radius collapse to §5.2 and §5.3 | variant (three versions) | 24 font sizes, 8 radii and 428 px literals today | ratchet counts; e2e fit; no regression in time to first pane open |
| V-3 | Signed-in nav labels | variant (three versions) | "My record" collides with "Publish my record"; handle truncation | nav fit; taps on own record |
| A-4 | Add "Verified" placement and the "one record-maturity signal per surface" rule to the idea board's register | amend-idea-board-decision | Keeps future features from re-adding the badge beside "Too early to tell" | string and DOM tests |

---

## 9. Not decided here / out of scope

- **Owner decisions and owner questions:** OD-1 (visible pane opener), OD-2 (chart series), OD-3 (ranking method),
  OD-4 (TR-9 "Edge" string), OD-6, OD-7, OD-8, OD-9, OD-10 (rule-engine dependency), OD-11 (desktop layout) and
  OD-12 (handle rename rules) stay with the owner. This spec only notes where they touch tokens.
- **D23** (profile headline order) is its own three-version test. **D22's** smaller ticker is D22's own three
  versions.
- **CH-2** stays blocked on decision 5.4.1. No placeholder.
- **F-5** (position size) is blocked; not covered.
- **Logo, glyph, favicon art, any font file and the product name**: none until the owner clears the name (T5a).
- **The F-6 80% headroom rule** for the hero vs R8's 96% fill: R8 stands for the hero; whether a headroom margin
  should apply is for the pass 3 review.
- **Motion** beyond §5.4 follows the creative council's motion rules (§6.6 of its record) unchanged.
- **Policy text:** this spec changes no policy, DESIGN or F-*.md text. O-1 and O-8 are owner and human edits.

---

## 10. Known limits

What this design system does not yet cover. Builds mark the matching code with `ponytail:` (§6).

| Limit | Why it matters | Next step |
|---|---|---|
| Contrast and CVD values are computed from token math (WCAG 2.x luminance, simulated full-severity protan/deutan/tritan, CIEDE2000), not measured on real devices or screens | panel gamma, brightness, night modes and anomalous (partial) colour vision differ from the simulation; ΔE00 < 10 cells (plum vs up 9.2 light) have little margin | a device check of Demo, gain, loss and warn badges on a low-end phone in both schemes before the first public card |
| Widths use the DejaVu Sans / Bold advance table, not the system fonts real viewers have; kerning ignored | real fonts are usually narrower (headroom is conservative) but some wider fallbacks exist; all e2e fit results depend on PR #41 | merge #41 (O-6); spot-check on the two most common phone system fonts |
| No print, Windows high-contrast or `forced-colors` mode | in forced colours the dashed/solid border and the ○ glyph survive, but tints, the 0% area tint and the Demo hue vanish | a `@media (forced-colors: active)` pass: keep borders, glyphs and words; `ponytail:` until then |
| Images are dark-only | a light-scheme viewer sees a dark card; contrast is checked only on the dark card bg | none planned; F-4 owner decision governs the card look |
| Screen-reader voicing of U+2212 unverified | some readers may skip the sign | test on the two most common desktop and mobile readers; the "a gain" / "a loss" accessible words are required meanwhile |
| Image renderer glyph coverage and widths not verified by every member | a missing U+2212 or ○ renders a loss unsigned | DS-10 / DS-19 cmap test and render snapshots |
| 200% text-resize checks are by arithmetic, not by an automated rule engine | the engine is a dependency question (OD-10) | owner decision; e2e reflow tests meanwhile |
| Hero fills up to 96% of its box (R8) vs F-6's 80% headroom rule | a font wider than DejaVu by > 4% would clip | pass 3 review; e2e under DejaVu |
| Reduced motion and dark mode are covered; user font-weight and letter-spacing overrides (1.4.12) are not tested | text-spacing overrides can push badges and figures over their boxes | add a 1.4.12 e2e with the standard spacing overrides |
| Ranges with few clusters (K near 5) are wide and unstable by design | the arithmetic fix guarantees containment, not precision | F-4's own floor (5 bets) and "Too early to tell" stay |
| Relative "updated" time on cached pages | can read older than the truth | render-time computation; revisit if pages are cached longer than the sync interval |
| Desktop layout, CH-2 and F-5 are out of scope | tokens are specified at 320 to 1,280 px only | see §9 |

