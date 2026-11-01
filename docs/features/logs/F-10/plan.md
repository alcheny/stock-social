# F-10 + F-12 build plan: one RecordStrip (UX lead, round 2, 2026-11-01)

Covers F-10 (record line on every feed card) and F-12 (strip on the trade and month pages and on the trade and month
images, plus the stock image's changes). One PR for both. The F-12 log links here. Binding: `docs/POLICY.md` (F1, F3,
F3a, F3b, F4, A1, P3), DESIGN Stage 5 (TR-4, TR-7, TR-9), CLAUDE.md product rules. Wording comes from existing copy only.
The design system council's short-record wording has not landed, so "Too early to tell" stays, held in one constant.

## Round 3 amendments (orchestrator, adopting the round-2 reviews; these override the sections below)

Engineer (round 2, NOT YET with 3 demands, all adopted):
- R3-1 Feed cost: `stripEvidence` runs in `loadFeedPage` (so LOAD=1 measures it), not at render. `page.strips:
  Map<userId, StripEvidence>` built from `page.byUser` by `lib/record-strip.ts#feedStrips`, memoised in a bounded module
  cache keyed `${userId}|${rows}|${maxRowId}` (like `weightCache`; `cardEvidence` ignores `now`, so only the rows matter).
  Unit test: a hit equals a fresh `stripEvidence`; a rebuild (new max id) misses. `feedRowNodes` only formats.
  The call is one additive line at the end of `loadFeedPage` (F-10 block) to keep #30's merge clean.
- R3-2 Month `figures` surface = average with range, or Too early; never a count part (unit test). The month line
  keeps "N closed trades this month".
- R3-3 Completeness-word guard scoped to: trade and month `page.tsx`/`opengraph-image.tsx`, `app/t/[symbol]/opengraph-image.tsx`,
  the `RECORD_STRIP`, `WHOLE_RECORD` and `SHARE_CARD` string values, strip outputs and alt, the two pages' metadata, and
  the rendered HTML and `og:image:alt` in e2e. (F-1's chart caption is out of scope and not a completeness claim.)
- Smaller: trade and month `load()` wrapped in React `cache()` so metadata and page share one read.

Business lead (round 2, SIGN, with 4 build notes, all adopted):
- Alt in words, no middle dot or parentheses: "average per trade +0.9%, 95% range -0.1% to +2.1%" (test). The visible
  strip keeps the profile's exact string.
- Image range line ≥ 30 px, one line, no wrap and no ellipsis, worst case `(-100.0% to +123.4%) · 95% range`; drop "· "
  before shrinking (model test).
- Exactly one count in the month section (`[data-strip-scope="month"]`) — met by R3-2.
- PR body lists the stock-image cut and the deferred smaller-ticker variants under Known limits.

Open question (UX lead): remove the trade page's footer "See their record, wins and losses →" (duplicate of the strip's
link right above it); keep it on the month page. Business lead and engineer agree → decided.

## Round 2 changes (each demand and where it is met)

Orchestrator rulings (binding):
- Git: merge origin/main only, never rebase, never merge the #30/#35 branches. One PR → §8.
- `recordStrip()` takes `evidence` + `avg`; `stripEvidence()` is the only source → §2. Update: #35 and #44 are merged and in
  our branch, so `stripEvidence` calls `cardEvidence` directly and the range uses `evidenceRangeText`. There is no two-step.
- Stock image: a static alt that claims no facts, plus a hand-off note to the /t owner. AC4 is scoped to trade and month → §5, §7.
- Smaller-ticker variants go to a follow-up issue (#44 moved them from an AC to a process note in F-10). This PR keeps
  today's ticker → §8.
- #44 wording: the record link text is `@‹handle›'s record`, and the new F-12 AC bans "full record", "whole record" and
  "every trade" on trade/month pages, images and alt → §1, §7.

Business lead:
- (1) Too early whenever tier = 'too-early' (K < 5 or half-width > 10 pts), with a 6-bet wide test on every surface → §1, §7.
- (2) Too early has the average's weight (`<b>`, text colour; 35 px on images) → §1, §3, §5.
- (3) `· 95% range` on pages, images and alt; the feed keeps bare parentheses (documented exception) → §1.
- (4) Stock image: no pooled average and no range; owner note in F-12 → §1, §5.
- (b) Month page win rate removed (decision 2026-11-01 citing D-24/F3b) → §4, Decisions.
- (c) `@handle's record` heading; back links `← @handle's record` → §1.
- (e) Best/worst off the month image, kept on the page → §4, §5.
- (7) Glance e2e at 360×640 → §7.
- (8) Decisions recorded; the guard bans full/whole record → Decisions, §7.

Engineer:
- (2) Query-count DB test runs by default, plus the LOAD=1 p95 in the log → §7.
- (3) Existing outputs are kept and only gain fields; `monthCard()` stays as an adapter; new tests go in new files → §2, §4, §5.
- (4) e2e hooks kept; three assertions replaced one-for-one → §3, §7.
- (5) Narrowed guards → §7.
- (6) Alt through `generateMetadata` → §5.
- (7) `lib/png.ts` pixel test → §7.
- (8) `opened_at` as the 8th field, a K-equality DB test, no open read while importing, `data-strip-scope` → §2, §3, §7.

## Decisions (dated; reasons)
- 2026-11-01: Strip average and range come from one function, `stripEvidence()` = `cardEvidence()`, with the range from
  `evidenceRangeText()`, exactly what the profile calls. Why: F-10 AC3 (wording equals the profile's). It also resolves the
  ponytail at lib/record-card.ts:205 for the trade and month pages; the note is narrowed to the compare page.
- 2026-11-01: Tier 'too-early' gives "Too early to tell" and no average on every surface. Why: TR-9 verdict, D22 "never a
  bare average". A 6-bet, ±15-point record must not read as a result on a card.
- 2026-11-01: Month page and month image show no win rate. Why: D-24 (plain, consistent stats) and F3b (labels describe
  the evidence; win rate alone reads as a verdict while the average can be negative). The same fields every month (F-12).
  Q13 (win rate on images) stays the owner's, and this doesn't decide it for the profile.
- 2026-11-01: The stock image shows no pooled average and no range. Why: F3b. A pooled figure about one stock reads as a
  rating of the stock. Owner note added to F-12.
- 2026-11-01: No "full record", "whole record", "full-record" or "every trade" in UI copy. Why: F3a (no completeness
  claims), F-11, F-12's #44 AC.
- 2026-11-01: One wording ("average per trade"), even with open positions. Why: the 35 px image line and the feed's
  two-line budget; two wordings would drift. The open item says "unrealized".
- 2026-11-01: The ticker keeps today's size in this PR. The smaller-ticker variants go to a follow-up issue. Why:
  orchestrator ruling; the record line ships unchanged in all variants.

## 1. Strip text, per case and surface

`pct()` always prints the sign. Counts use `counted(n, 'closed trade')`, which is F-12's "Closed trades" label. RANGE is
`evidenceRangeText(evidence)` = `(${pct(low)} to ${pct(high)})`, the profile's own call.

| Case | Feed card (replaces `held · closed`) | Trade and month pages | Trade and month images (band lines) |
|---|---|---|---|
| tier ≠ too-early | `40 closed trades · +0.9% average per trade (-0.1% to +2.1%)` | `40 closed trades · +0.9% average per trade (-0.1% to +2.1%) · 95% range · losses included` | `40 closed trades` / `+0.9% average per trade` / `(-0.1% to +2.1%) · 95% range` / `losses included` |
| tier = too-early (K < 5 or too wide) | `6 closed trades · Too early to tell` | `6 closed trades · Too early to tell · losses included` | `6 closed trades` / `Too early to tell` / `losses included` |
| negative average | `-1.4%` in `.down`, sign in text | same | down colour |
| zero average | `0.0%`, text colour | same | text colour |
| demo | the header Demo badge only; the strip never says "verified" | label line `Demo data` | label line `Demo data` |
| verified | no trust word in the strip | label `Verified from broker` | same |
| failed import | same figures; the card's existing `.record-failed` line stays | label `Import did not finish` (warn) + RECORD_BODY.failed (`.record-failed`) | label + note (≤ 2 lines) |
| importing | not in the feed | `.importing`: WHOLE_RECORD.importing, no figures, no "losses included" | `Import in progress` / `Stats appear when the import finishes.` |
| open positions | not repeated (F-6's "Also open" is on the card) | `· 3 open, unrealized` (literal `${n} open, unrealized`) | `losses included · 3 open, unrealized` |

- "Too early to tell" is `<b>` in the text colour, the same weight as the average (HTML), and 35 px in the text colour
  on images.
- **Feed exception (documented):** the feed omits `· 95% range` and `· losses included` to stay within two lines at 320 px.
  The longest line, `1,234 closed trades · -12.3% average per trade (-45.6% to +21.0%)`, is 66 chars, about 2 × 36 chars.
  The parentheses still match the profile byte for byte.
- No "1 of 40" (it reads as a rank). A range only when the tier is not too-early, and then `perTrade` always exists.
- **Pages:** the strip replaces the whole-record section's body. The heading text becomes `@handle's record`, keeping
  `id="whole-record"` and `.badge.new` (TR-7) in it. The record link reads `@‹handle›'s record` → `/u/[handle]` (F-12
  AC1), and it carries the strip's handle. The back links `← @handle's full record` become `← @handle's record`. The
  page's existing footer link `See their record, wins and losses →` stays outside the strip (open question 1). The disclaimer is the
  strip's last line.
- **Stock image** (not a strip; F3b): status (`Verified from broker` / `Includes sample data` / `Demo data` for
  demo-only), symbol, `120 closed trades`, `14 traders · losses included`, disclaimer. No average, range, win rate or
  verdict.

## 2. Data contract: `lib/record-strip.ts` (pure)

```ts
type StripEvidence = { n: number; k: number; tier: Tier; perTrade: { low: number; mid: number; high: number } | null };
export function stripEvidence(trades: ConfidenceInput[], now: Date): StripEvidence;  // the ONLY source switch
type StripInput = { avg: number; evidence: StripEvidence; state: RecordState; demo: boolean; verified: boolean;
  handle: string; open?: number[]; newRecord: boolean };
type StripSurface = 'feed' | 'page' | 'figures' | 'image';      // 'figures' = count + average/Too early (month block)
type StripPart = { role: 'label'|'note'|'importing'|'handle'|'new'|'count'|'average'|'range'|'early'|'losses'|'open'|'link'|'disclaimer';
  text: string; tone: 'up'|'down'|'warn'|'muted'|null };
type Strip = { parts: StripPart[]; text: string; alt: string; tooEarly: boolean };
export function recordStrip(i: StripInput, surface: StripSurface): Strip;
export function stripImageLines(s: Strip, kind: 'trade' | 'month', hero: HeroLine[]): ImageLine[];   // §5
export const STRIP_BAND = { x: 309, width: 582, top: 24, bottom: 606, recordPx: 35, minPx: 26 } as const;
```
- `stripEvidence` returns `cardEvidence(trades, now)` (n, k, tier, perTrade), the profile's call. RANGE =
  `evidenceRangeText()`. Narrow the ponytail at lib/record-card.ts:205 to the compare page.
- `avg` = `headline(trades).avgReturn` (the profile's `stats().avgReturn`). The open text = `SHARE_CARD.openShort(n)`.
- The label, note and importing state come from `shareCardText`/`imageLabel`/`wholeRecordView`, which is F-7's seam: a
  public-trader source label replaces Verified there. New copy: `RECORD_STRIP = { early: 'Too early to tell', range:
  '95% range', link: (h) => `@${h}'s record` }` in copy.ts, added to its copy walker.
- **Feed, no new query:** `records()` adds `date_part('epoch', opened_at) * 1000` as the 8th JSON field, and `PaneRow`
  gains `openedAt`. It is still one aggregate (two halves above 8 traders). `feedRowNodes` builds one Strip per trader
  (a Map, like `panes`) from `page.byUser`, `page.records` and the rows' `verified` flags (demo = not all verified, the
  `paneTrust` rule). `stripEvidence` runs once per trader per render; its cost is in the LOAD=1 numbers (§7).
- **Pages:** `tradeSharePayload`, `monthRecap` and `wholeRecord` keep every current field (existing tests untouched) and
  add `strip` inputs (`avg`, `evidence`, `newRecord`). The loaders add one `open_positions` read (`unrealized_pct` only)
  when the state is 'connected' or 'failed'. It is skipped while importing (no open count then) and for state 'none'.

## 3. `app/record-strip.tsx`: one module, two exports

- `RecordStrip({ strip, surface })` renders HTML.
  - Feed: `<p className="record-strip" data-strip>` inside `.hero`, in place of the `held · closed` div. The reading
    order is symbol, return, strip, thesis, Also open. Parts are spans with `data-role`. The average and "Too early to
    tell" are `<b>` (average with its tone class). Separators are `<span aria-hidden="true"> · </span>`. Never aria-hidden overall.
  - Page: inside the existing `section[aria-labelledby="whole-record"]`: the label `<p>` (`role="status"
    className="down record-failed"` when failed, `className="muted importing"` while importing), then the figures
    `<p className="record-strip" data-strip>`, the `<Link>` and the disclaimer `<p className="muted small">`.
  - Figures (month block): `<p className="record-strip" data-strip-scope="month">`. It is a different hook, so the strip
    and the month block never collide in strict-mode locators.
- `RecordStripImage({ lines })`, same file: inline styles (next/og), no Link, no `textOverflow: ellipsis`. It draws
  `stripImageLines()`.
- CSS: `.record-strip { font-size: .875rem; color: var(--muted) } .record-strip b { color: var(--text) }`, and
  `.up`/`.down` keep their tokens. `TradeCard` gets `strip?: Strip`, and `days()` goes.

## 4. Month page

- Removed: the "Past results:" evidence line, the win rate, and the `showHeadline` branch ("Too few trades for a win
  rate").
- "This month" always shows `N closed trades this month` (kept, existing hook), then `<RecordStrip
  surface="figures">` (average with its range or Too early, from `stripEvidence` over the month's trades), then
  Worst/Best or "Only trade this month", then the full trade list. Losing months look exactly like winning ones.
- `generateMetadata` (both pages) keeps the `wholeRecordPreview()` wrapper. Its stats argument becomes `strip.text`
  instead of the win-rate text, so the "so far · Import in progress" and failed prefixes stay.

## 5. Images (trade and month 1200×630; stock image changes)

- **Anti-crop band:** a 1:1 centre crop keeps x 285–915, and a 1.91:1 crop keeps y 1–629. The band is x 309–891,
  y 24–606. Everything is drawn inside it except a declared brand box (top-left `Stock Social`, x < 285): the label,
  `@handle` (+ ` · New record`), hero lines, strip lines, losses/open line and disclaimer.
- **Sizes:** record lines (count, average, range or Too early) at **35 px** in the text colour (average toned); all other
  band text at **≥ 26 px** (council floor 13 px). The trade symbol and return use `fitSize(max 80, width 582)`, the month
  label `fitSize(max 52, min 40)`, and month figures 30 px. Width rule: 0.6 em per glyph, so 35 px fits 27 chars
  (`-123.4% average per trade` = 25), and `(-45.6% to +21.0%) · 95% range` (30 chars) gets its own line at 31 px
  (`fitSize(max 35, min 30)`).
- **Disclaimer:** three lines at 26 px (`Not investment advice.` / `Past performance does not` / `guarantee future
  results.`). `disclaimerLines3()` checks that the joined lines equal DISCLAIMER.
- **Worst-case budget** (failed + open + 20-char handle + 4-digit count + extreme percents): label 34, handle 34,
  record 126, losses/open 31, note 62, disclaimer 94. Plus the trade hero (88 + held·closed 31 + thesis 0–68) or the month
  hero (label 57 + figures 108). Things give way in this order: thesis, then month label (to 40 px), then gaps (to 4 px).
  `stripBandFits()` asserts the fit.
- **Removed from images:** every win rate, the month best/worst (kept on the page), the "New record · short record, wide
  uncertainty" line (New record moves beside the handle), and the stock image's average, range and verdict.
- **Contrast:** text #f4f4f6, muted #8b8b98, up #22c55e, down #f43f5e and warn #f59e0b on #0b0b0f are all ≥ 5.3:1.
  Computed in a test.
- **Alt:** drop the static `alt` exports on the trade and month images. `generateMetadata` sets `openGraph.images[0] =
  { url, width: 1200, height: 630, type: 'image/png', alt: strip.alt }` (F-4 pattern, app/u/[handle]/page.tsx:84).
  Example: `Closed trade NVDA +12.3% by @maya_demo on Stock Social. Demo data. 40 closed trades, average per trade
  +0.9%, a gain, (-0.1% to +2.1%) · 95% range. Losses included. 3 open positions, unrealized. Not investment advice. Past
  performance does not guarantee future results.` The stock image keeps a static alt that states no figures and no
  "verified": `Closed trades in one stock on Stock Social`.
- **`monthCard()` stays as an adapter** for its existing tests. Same shape and roles; the `record` line text becomes
  `strip.text`; `disclaimer.text` is still the whole DISCLAIMER, and a new `disclaimer.lines` holds the three-line split.
  The route draws `stripImageLines`, built from the same strip.

## 6. Hand-off and owner notes
- F-12 feature file, owner note: the stock image drops its pooled average and range (F3b), so AC3/AC4 there are scoped
  to the trade and month images. The stock image gets the band and disclaimer rules only.
- Hand-off to the /t owner: the image no longer prints a pooled average. Whether `/t/[symbol]` keeps its pooled average
  and range is theirs to decide under F3b.

## 7. Acceptance tests (written first, in new files only)

Unit (`lib/record-strip.test.ts`):
- F-10 AC1 / F-12 AC1: count, average and RANGE from the whole record with losses (dropping a loss changes the average).
- F-10 AC2 and BL (1): K = 1..4 gives Too early; **6 bets with half-width > 10 pts gives Too early, no `%` in the
  figures, on feed, page, figures and image, and in the alt**; K = 5 narrow gives a range.
- F-10 AC3: the strip's RANGE equals `evidenceRangeText(cardEvidence(trades, now))` (the profile's call) over 200 random records; pages and alt
  contain `${RANGE} · 95% range`.
- Negative average gives 'down' and `-`; zero gives no tone; Too early is a `<b>` in the text colour (render test).
- F-12 AC2: `open` gives `3 open, unrealized` on page and image, nothing on the feed, no symbol anywhere.
- F-10 AC11 / F-12 AC10: demo outputs contain "Demo" (page, image, alt) and never `/verified/i`.
- `lib/png.test.ts` (committed, 5f6f4eb): `lib/png.ts` decodes `deflateSync`-built PNGs for all 5 filter types.

DB (default-running, hooked like lib/feed.signed-out.test.ts:12, in `lib/record-strip.db.test.ts`):
- F-10 AC4: `loadFeedPage` with about 10 and then about 30 traders (via `ids`) issues the same number of statements, and
  `records()` issues ≤ 2.
- K from `records()` rows equals K from the profile query's rows, including a touching-boundary fixture (close at T,
  same-symbol entry at T).
- No `open_positions` read for an importing trader on the trade or month page.
- LOAD=1 (`lib/feed.load.test.ts`): p95 before and after, recorded in docs/features/logs/F-10/.

Guards (`lib/record-strip.guard.test.ts`):
- F-12 AC9 / F-10 AC12: the strip surfaces (app/ui.tsx, app/feed-rows.tsx, the trade and month `page.tsx` and
  `opengraph-image.tsx`) import `recordStrip`/`RecordStrip` and contain none of `average per trade`, `Too early to tell`,
  `95% range` or `losses included`. No `*Strip` component in app/**/*.tsx besides app/record-strip.tsx. `data-strip`,
  `data-strip-scope` and `record-strip` appear in no other .tsx.
- F-12 AC5: no `win rate` in the trade, month or stock image routes, in `strip.alt`, or in the two pages' metadata.
- F-12 AC6: no `Past results` in the month page source or HTML (e2e).
- BL (8) and F-12's #44 AC: no `full record`, `whole record`, `full-record` or `every trade` (case-insensitive) in UI
  strings in app/**, lib/copy.ts, strip outputs, alt or metadata, plus the rendered trade and month HTML and
  `og:image:alt` (e2e). The scan covers strings and JSX text; ids like `whole-record` are exempt.
- F-12 AC8: a snapshot of `recordCard()`/`cardAlt()` on main's F-4 fixtures, committed first; byte-identical after.
- F-12 AC7: per-trade surfaces list closed trades only (open = count only).

Image:
- F-12 AC3 (model): every band line sits inside x 309–891 / y 24–606, record lines at 35 px (range line ≥ 30), the rest
  ≥ 26, and `stripBandFits` passes.
- F-12 AC3 (pixels, e2e): fetch the trade, month and stock PNGs and decode them with `lib/png.ts`. Every pixel outside
  x 285–915 is background, except the brand box. Each band line's y-range has text pixels. No `…` in strip lines (model).
- Contrast ≥ 4.5:1 per colour used (computed).
- F-12 AC4 (trade and month): `og:image:alt` equals `strip.alt` and contains the count, average with RANGE (or Too early),
  "losses included" and DISCLAIMER.

E2E (`e2e/record-strip.spec.ts`; edits to old specs only where the product changed):
- F-10 AC1: every `.card` has one `[data-strip]` in `.hero` and no `held … · closed`.
- F-10 AC6: open positions show both `[data-strip]` and `[data-open]`.
- F-10 AC8: reflow at 320, 360×640 and 780×360: no clipped text, no horizontal scroll, the strip ≤ 2 lines for the long
  fixture, swipe and card link work.
- BL (7) glance: at 360×640 signed out, the first card's `.ret` and its whole `[data-strip]` are in the first viewport.
- F-10 AC9: the strip is in the accessibility tree after the return. F-10 AC10: the disclaimer is on the first screen at 360.
- F-12 AC1: trade and month pages show label, figures, a link named `@‹handle›'s record` to `/u/[handle]`, "losses
  included" and the disclaimer.
- F-12 AC6: losing and winning months show the same field set.
- F-10 AC5: F-2 ordering and RANK_MIN_BETS tests run unchanged.
- Replaced one-for-one (the test count doesn't drop):
  - app.spec.ts:400/:454: heading `/Their whole record/` becomes `/'s record/`.
  - app.spec.ts:457: `Too few trades for a win rate` becomes the month `[data-strip-scope]` showing `Too early to tell`.
  - connect.spec.ts:570: `toContainText('win rate')` becomes `toContainText('closed trades')`.
  - connect.spec.ts:557 and app.spec.ts:415 keep passing via `wholeRecordPreview()`.
  - app.spec.ts:455 `1 closed trade ·` is kept, and the strip's own count is scoped.

## 8. Order of work (merge origin/main only; one PR)
1. Done: `lib/png.ts` with tests (5f6f4eb), and the merge of origin/main with #35 and #44 (2c35673).
2. Next, tests first: guards, the F-4 snapshot (on the merged `recordCard`, before any edit), the DB query-count test and
   the e2e skeleton.
3. Build: the helper (`stripEvidence` = `cardEvidence`), the component, then trade and month pages and images, the stock
   image, the month page, `records()` opened_at and the feed wiring. #30 (still open) doesn't touch ui.tsx,
   feed-rows.tsx or `records()`. When it merges: `git merge origin/main`, then re-run the e2e and load tests.
4. PR body: `## Compliance`, a link to the follow-up smaller-ticker issue (`## Variants`, F-10 process note), known limits.

Compliance (COMPLIANCE §1):
- Q1, performance: disclaimer on every page and image strip; no advice words; losses alike; percent only; Too early
  instead of thin averages.
- Q2, data: no new personal data; open positions shown as a count.
- Q3–Q6: none.
- Q7, vendors and assets: no font or dependency.
- Q8, accessibility: real text, sign in text, 4.5:1.
- Q10, claims: no completeness wording.

## Open questions (recommended option first)
1. Trade page: keep the existing footer link `See their record, wins and losses →` beside the strip's `@‹handle›'s
   record` link (two links to the same profile)? **Recommend removing the footer duplicate on the trade page**, where it
   sits right under the strip, and keeping it on the month page, where it ends a long list.
