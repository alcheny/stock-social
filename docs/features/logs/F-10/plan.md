# F-10 + F-12 build plan: one RecordStrip (UX lead draft, 2026-11-01)

Covers F-10 (record line on every feed card) and F-12 (strip on the trade and month pages and on the trade, month and
stock images). The F-12 log links here. Binding: `docs/POLICY.md` (F1, F3, F3a, F3b, F4, A1, P3), DESIGN Stage 5
(TR-4, TR-7, TR-9), CLAUDE.md product rules. Wording uses existing copy only (`lib/copy.ts`, `lib/trades.ts`, PR #35's
`SHARE_CARD`). The design system council's short-record wording has not landed, so "Too early to tell" stays. It is held
in one constant, so a change later is a one-line edit.

## 1. Strip text, per case and surface

The average is `headline(trades).avgReturn`, the same number the profile prints. The range is `arithmeticRange(trades)`
(lib/bets.ts, PR #35), the same as `cardEvidence().perTrade`, which is what the profile prints once #35 merges. The
range string is the profile's `(${pct(low)} to ${pct(high)})`, byte for byte. `pct()` always prints the sign
(`+0.9%`, `-1.4%`, `0.0%`). Counts come from `counted(n, 'closed trade')`, so 1 reads "1 closed trade".

| Case | Feed card (replaces `held · closed`) | Trade and month pages | Images (lines in the band, top to bottom) |
|---|---|---|---|
| 5 or more bets | `40 closed trades · +0.9% average per trade (-0.1% to +2.1%)` | same, then ` · losses included` | `40 closed trades` / `+0.9% average per trade` / `(-0.1% to +2.1%)` / `losses included` |
| Under 5 bets (any n) | `3 closed trades · Too early to tell` | same, then ` · losses included` | `3 closed trades` / `Too early to tell` / `losses included` (no average line at all) |
| Negative average | same text, `-1.4%` in the down tone (`.down`) | same | average line in the down colour |
| Zero average | `0.0%`, no tone | same | text colour |
| Demo | same text. The card header's Demo badge stays, and the strip never says "verified" | first line `Demo data` (SHARE_CARD.demo) | first line `Demo data` |
| Verified | no trust word in the strip (the header badge carries it) | first line `Verified from broker` (imageLabel of SHARE_CARD.verified) | same |
| Failed import | same figures. The card's existing failed line above the hero stays, so it isn't repeated | first line `Import did not finish` (warn), then RECORD_BODY.failed, then the figures | label (warn) plus the note, up to 2 lines |
| Importing | never reaches the feed (feed rule) | `Import in progress. Stats appear when the import finishes.` (WHOLE_RECORD.importing), no figures and no "losses included" | `Import in progress` / `Stats appear when the import finishes.` |
| Open positions | **not repeated**: F-6's "Also open: …" line already sits on the card, and that is TR-4's line there | ` · 3 open, unrealized` after "losses included" (SHARE_CARD.openShort, #35) | `losses included · 3 open, unrealized` |
| No closed trades | n/a (a card is a closed trade) | n/a (the page needs one) | the helper returns `No closed trades yet` (SHARE_CARD.empty) for safety |

Decisions behind the table:
- **One wording everywhere: "N closed trades · X average per trade (range)".** The count names the unit (D24) and labels
  the average as closed trades (F-12's "Closed trades" reconciliation). With open positions we do **not** switch to
  #35's "average per closed trade": it breaks the 35 px image line (31 chars > 27 that fit in the band) and the feed's
  two-line budget, and two wordings would drift across surfaces, which is what the council vetoed. The open item says
  "unrealized", which keeps realized and unrealized apart.
- **No "1 of 40"** (the chair's example). It reads as a position or rank and costs width.
- **No "· 95% range" suffix in the strip.** The profile prints it beside the range. On the strip the parentheses follow
  "average per trade" in the same sentence, as in DESIGN TR-9's own display example. The AC test compares the range
  string itself.
- **A range only when the profile shows one** (`perTrade` non-null, i.e. at least 5 bets). A wide range is still shown,
  as on the profile: its width says how much the sample tells you. Under 5 bets the average is never printed.
- **Feed length:** the longest realistic line, `1,234 closed trades · -12.3% average per trade (-45.6% to +21.0%)`, is
  66 chars. At 320 px the card text column is about 256 px, about 36 chars at 14 px, so it takes two lines. The usual
  case takes one or two.
- **Pages:** the strip replaces the "Their whole record" section, and its heading becomes `@handle's record`. "Whole"
  and "full" are completeness wording (F3a, F-11). The New record badge (TR-7) moves into that heading. The record link
  is the existing `See their record, wins and losses →` to `/u/[handle]`. The back links `← @handle's full record`
  on both pages become `← @handle's record`. The disclaimer is the strip's last line (DISCLAIMER, `p.muted.small`).
- **Stock image:** no handle and no link. Its count line is `120 closed trades`, and the losses line reads
  `14 traders · losses included`. Label: `Verified from broker` / `Includes sample data` (existing) / `Demo data` for
  demo-only (was "Sample data"). The `evidenceLine` verdict is removed: "Past results: positive" on an image about one
  stock rates the stock (F3b).

## 2. Data contract: `lib/record-strip.ts` (pure, no DB or React)

```ts
type StripSurface = 'feed' | 'page' | 'figures' | 'image';   // 'figures' = count + average/range only (month block)
type StripInput = {
  trades: Pick<ConfidenceInput, 'symbol' | 'openedAt' | 'closedAt' | 'returnPct'>[]; // the whole closed record
  state: RecordState; demo: boolean; verified: boolean;    // as imageTrust takes them
  handle: string | null;                                   // null on the stock image
  traders?: number;                                        // stock image only
  open?: number[];                                         // F-6 unrealized percents; only the count is shown
  now: Date;                                               // isNewRecord
};
type StripPart = { role: 'label'|'note'|'importing'|'handle'|'new'|'count'|'average'|'range'|'early'|'losses'|'open'|'traders'|'link'|'disclaimer';
                   text: string; tone: 'up'|'down'|'warn'|'muted'|null };
type Strip = { parts: StripPart[]; text: string; alt: string; n: number; k: number; avg: number | null;
               range: { low: number; high: number } | null };
export function recordStrip(i: StripInput, surface: StripSurface): Strip;
export function stripImageLines(s: Strip, kind: 'trade' | 'month' | 'stock', hero: HeroLines): ImageLine[]; // §5 model
export const STRIP_BAND: { x: 309; width: 582; top: 24; bottom: 606; recordPx: 35; minPx: 26 };
```
- It calls `headline()` (lib/trades.ts) for the average, `arithmeticRange()` and `betClusters()` (lib/bets.ts) for the
  range and K, `shareCardText`/`imageLabel`/`wholeRecordView` (lib/copy.ts) for the label, note and importing state,
  `tone()` (lib/open-split.ts), `isNewRecord()`, `counted`, `pct`, DISCLAIMER, and the SHARE_CARD strings. A new
  `RECORD_STRIP = { early: 'Too early to tell', see: 'See their record, wins and losses →' }` goes in copy.ts and is
  added to its copy walker. It does **not** call `confidence()`: the strip needs no tier, and it keeps the feed cheap.
- `parts` are in reading order per surface, `text` joins the visible parts with ` · `, and `alt` is the image's words (§5).
- Demo and F-7: the label comes only from `shareCardText`/`imageTrust`. That is F-7's seam, so a public-trader source
  label replaces Verified there. The feed strip carries no trust word at all.
- **Feed, no new query:** `records()` in lib/feed.ts already reads every page trader's full closed record in one
  aggregate. Add `date_part('epoch', opened_at) * 1000` to its JSON (7 → 8 fields) and `openedAt` to `PaneRow`.
  The query count stays the same. We don't derive openedAt from holding_days: float rounding at an exact
  boundary can merge or split a bet, and then K and the range would differ from the profile's. `feedRowNodes` builds
  one Strip per trader (a `Map`, like `panes`) from `page.byUser`, `page.records` (state) and the trades' `verified`
  flags (demo = not all verified, the `paneTrust` rule). It does not read `page.open`. PR #30 doesn't touch `records()`.
- Trade and month pages: `loadTradeShare`/`loadRecap` already load the whole record with `opened_at`. Each adds one
  `open_positions` read (`unrealized_pct` only, when state ≠ 'none', as the profile does). `tradeSharePayload` and
  `wholeRecord` stop computing win rate, evidence and range, and return the inputs for `recordStrip`.

## 3. `app/record-strip.tsx`: one module, two exports

- `RecordStrip({ strip, surface })` renders HTML. Feed: `<p className="record-strip" data-strip>` inside `.hero`, in
  place of the `held · closed` div, so the card reads symbol, return, strip, then thesis and "Also open". Parts are
  spans with `data-role`; the average is `<b className={tone}>`; the separators are `<span aria-hidden="true"> · </span>`. Page:
  `<section className="trade-card" aria-labelledby="record-h"><h2 id="record-h">@handle's record {New record}</h2>`,
  then the label `<p>` (`role="status"` plus `.down.record-failed` when failed), the figures `<p className="record-strip"
  data-strip>`, the `<Link>` and the disclaimer `<p>`. Real text in DOM order, never aria-hidden. Tone is never the
  only signal (sign in text, POLICY A1). `TradeCard` gets `strip?: Strip`, and the `days()` helper goes.
- `RecordStripImage({ lines })` lives in the same file, with inline styles only (next/og) and no Link, and draws
  `stripImageLines()` output. HTML and images share one helper and one component module, so the two can't drift.
- CSS: `.record-strip { font-size: .875rem; color: var(--muted) }`. Existing `.up`/`.down` tokens already pass 4.5:1 in
  both schemes (extend `lib/badge-contrast.test.ts` to `.record-strip` on `--surface`).
- Month page "This month" uses `<RecordStrip surface="figures">` over the month's trades. That is one component, not a
  second strip.

## 4. Month page

- Remove the `m.evidence` line (the "Past results:" verdict), the win rate, and the `showHeadline` branch with "Too few
  trades for a win rate". Every month shows the same fields in the same order: the count, then the average per
  trade with its range or "Too early to tell" (figures surface), then Worst and Best (or "Only trade this month"),
  then the full trade list. Losing months look exactly like winning ones.
- `lib/recap.ts#monthRecap` drops `winRate`, `showHeadline`, `evidence` and `range` from its output (callers are the page,
  the image and the metadata only).
- `generateMetadata` on both pages: the description becomes `strip.text` (no win rate). The month description keeps
  `N closed trades this month` first.

## 5. Images (trade, month, stock; 1200×630)

- **Anti-crop band:** a 1:1 centre crop keeps x 285–915, and a 1.91:1 crop keeps y 1–629 (1200×630 is 1.905:1). The band
  is x 309–891 (582 px wide, 24 px inside the square) and y 24–606. Everything required stays inside it: the trust
  label, @handle, the strip, "losses included", the open count and the disclaimer, plus the trade's symbol and return
  and the month label. The brand word may sit outside it.
- **Type sizes (legibility floor):** record lines (count, average, range or Too early) at **35 px** (the creative
  council's target). Everything else in the band at **≥ 26 px** (twice the council's 13 px floor). The symbol and return
  use `fitSize(max 80, width 582)`, and the month label uses `fitSize(max 52, min 40)`. Widths are checked at 0.6 em per
  glyph (month-card's rule): 35 px fits 27 chars, so `-123.4% average per trade` (25) fits.
- **Disclaimer** in three lines at 26 px: `Not investment advice.` / `Past performance does not` / `guarantee future
  results.` The helper splits DISCLAIMER, and a test checks that the joined lines equal it.
- **Budget, worst case** (failed note, open positions, 20-char handle, 4-digit count, extreme percents): label 34 +
  handle and New record 34 + record 126 + losses/open 31 + note 62 + disclaimer 94, plus per-surface hero lines. Trade:
  symbol/return 88 + held·closed 31 + thesis 0–68. Month: label 57 + month figures at 30 px 108. Stock: symbol 106 +
  traders folded into the losses line. When space runs short, things give way in this order: the thesis first, then
  the month label down to 40 px, then gaps down to 4 px. `stripImageLines` returns `{ text, size, y, tone }` per
  line, and `stripBandFits()` asserts the fit.
- **Removed from images:** month best/worst (per-trade cherry-pick lines, and the band has no room), every win rate
  ("Overall record: N% win rate …", "Whole record: N% win rate …", the stock image's win-rate column), the
  "New record · short record, wide uncertainty" line (the New record word moves next to the handle), and the
  stock image's evidence verdict.
- **Contrast:** the image palette (text #f4f4f6, muted #8b8b98, up #22c55e, down #f43f5e, warn #f59e0b) on #0b0b0f is
  all ≥ 5.3:1. A test computes it from the route constants.
- **Alt text:** the static `alt` exports become neutral and claim nothing ("A closed trade on Stock Social" / "A month of
  closed trades …"; "full record" and "whole record" go). The real alt is `strip.alt`, set through the page's
  `generateMetadata` `openGraph.images[0].alt` (the F-4 pattern). Example: `Closed trade NVDA +12.3% by @maya_demo on
  Stock Social. Demo data. 40 closed trades, average per trade +0.9%, a gain, 95% range -0.1% to +2.1%. Losses
  included. 3 open positions, unrealized. Not investment advice. Past performance does not guarantee future results.`
- Fonts: next/og's bundled default, as today. No new dependency.

## 6. Acceptance tests (write first; each maps to an AC)

Unit (`lib/record-strip.test.ts`):
- F-10 AC1 and F-12 AC1: 5+ bets gives the count, average and range from the whole record, losses included (a fixture
  with losses: the average equals `headline()`, and dropping a loss changes it).
- F-10 AC2: K = 1..4 (including 12 trades in 4 overlapping bets) gives "Too early to tell" and no `%` in the
  figures; K = 5 gives the range.
- F-10 AC3: the range substring equals `(${pct(cardEvidence(t).perTrade.low)} to ${pct(…high)})`, the profile's
  expression after #35, over 200 random records.
- Negative average gives tone 'down' and a leading `-`; zero gives no tone. Under 5 bets, no `average` part exists.
- F-12 AC2: `open: [..3]` adds `3 open, unrealized` on page and image, nothing on the feed, and no open symbol in any output.
- F-10 AC11 and F-12 AC10: demo outputs contain "Demo" (page, image, alt) and `/verified/i` matches nothing; a failed or
  importing state never says Verified.
- Feed `PaneRow.openedAt` round-trip: K from records() rows equals K from the profile's rows (db test).

String and structure tests (`lib/record-strip.guard.test.ts`):
- F-12 AC9 and F-10 AC12: no file in app/** besides `app/record-strip.tsx` contains `record-strip`, `data-strip` or a
  `*Strip` component. "average per trade" appears only via SHARE_CARD (copy.ts) and in no other module. The trade, month
  and stock image routes and the two pages import `recordStrip`.
- F-12 AC5: the image routes' source, `strip.alt`, and the pages' metadata contain no `win rate`/`winRate`/`win-rate`.
- F-12 AC6: the month page source and its rendered HTML (e2e) contain no `Past results`.
- Orchestrator correction: no `full record` (case-insensitive) in app/**, lib/copy.ts, any strip output, alt or
  metadata, and none in the trade, month, feed or image surfaces.
- F-12 AC8: snapshot `recordCard()` and `cardAlt()` for the F-4 fixtures (all three sizes, all states) **before** any
  change, and assert byte-identical after.
- F-12 AC7: the strip and the images list closed trades only (open positions are a count, with no symbol and no figure).

Image (`lib/record-strip-image.test.ts` plus e2e):
- F-12 AC3 (model): for every route and the worst case above, every band line has x ≥ 309, x + width ≤ 891, top ≥ 24,
  bottom ≤ 606, record lines at 35 px and the rest at ≥ 26; `stripBandFits` passes.
- F-12 AC3 (pixels, e2e): fetch each PNG, draw it on a canvas, crop 630×630 at x 285 and 1200×628 at y 1. Each band
  line's row has text pixels inside the crop, and no non-background pixel in those rows falls outside x 291–909.
- Contrast ≥ 4.5:1 for each palette colour used by a band line (computed, as in badge-contrast.test.ts).
- F-12 AC4: `strip.alt` contains the count, the average with its range (or Too early), "losses included" and DISCLAIMER,
  and the page's `og:image:alt` equals it (e2e).
- F-12 AC11: no new package (package.json unchanged; the guardrail already checks it).

E2E (`e2e/record-strip.spec.ts`, seeded demo traders):
- F-10 AC1: every `.card` on `/` has one `[data-strip]` in `.hero` and no `held …d · closed`.
- F-10 AC6: a trader with open positions shows both `[data-strip]` and `[data-open]`.
- F-10 AC8: reflow at 320, 360×640 and 780×360: no clipping (scrollWidth ≤ clientWidth on the card), no horizontal page
  scroll, the strip ≤ 2 line-heights for the longest fixture, swipe opens the pane, and the card link works.
- F-10 AC9: the strip is in the accessibility tree, in order after the return (`aria-hidden` absent).
- F-10 AC10: the disclaimer is in view on the first screen at 360×640, with fix #3.
- F-12 AC1: trade and month pages show the strip with count, range or Too early, `@handle`, a link to `/u/[handle]`,
  "losses included" and the disclaimer.
- F-12 AC6: a losing month and a winning month show the same field set.
- F-10 AC4: `lib/feed.load.test.ts` asserts the same query count for 5 and 25 cards, and a render budget for 20
  traders with 4,700 closes (Strip built once per trader).
- F-10 AC5: F-2 ordering tests and RANK_MIN_BETS tests run unchanged (no edits to ranking files).

Existing e2e lines that change with the decided product, replaced 1:1 so the test count doesn't drop: app.spec.ts:400
and :454 (`Their whole record` becomes `@… 's record`), and :457 (`Too few trades for a win rate` becomes the month block
showing `Too early to tell` or a range). `lib/month-card.test.ts` moves to the band model and keeps its fit and state cases.

## 7. Order of work (#30 and #35 still open)

1. **Now, on this branch:** commit the failing guard tests that don't need #35 (no "full record", no win rate on images,
   no "Past results" on month, the single-strip check), the e2e skeleton, and the load-test case.
2. **When #35 merges:** rebase, then commit the F-4 snapshot test first (on #35's output). Then build `lib/record-strip.ts`
   with its unit tests, `app/record-strip.tsx`, and the F-12 pages and images (trade, month, stock image). This is
   **PR-1 (F-12 plus shared strip)**. It doesn't touch ui.tsx, feed-rows.tsx or lib/feed.ts, so it doesn't wait on #30.
   Do not copy `lib/bets.ts` to get ahead of #35: that would be a second range implementation.
3. **When #30 merges:** PR-2 (F-10 feed): `records()` openedAt, `feedRowNodes` Strip map, `TradeCard` strip prop, CSS,
   feed e2e, reflow and load tests.
4. **Then the smaller-ticker test:** an issue with `## Variants` and three PRs on top of PR-2 that change only `.symbol`
   size and placement. A: today's size (control). B: ticker at body size above the return. C: ticker inline before the
   return. The strip is identical in all three, and the choice is made by /choose or the Judge on open-pane rate.

Compliance (PR body, COMPLIANCE §1): shows performance → disclaimer on every strip page and image, no advice
words, losses ranked alike, percent only (Q1). No new personal data; open positions shown as a count (Q2). No money (Q3),
no messages (Q4), no user text added (Q5). No vendor, font or dependency (Q7). Real text, sign in text, 4.5:1 (Q8).
No completeness wording ("full" or "whole record" removed) (Q10).

## Open questions (recommended option first)

1. "Average per closed trade" when open positions exist (#35's card wording)? **Recommend no.** Use one wording, with
   the count carrying "closed trades" and the open item saying "unrealized" (reasons in §1). Alternative: use it on pages only.
2. Month page win rate (not only the images)? **Recommend removing it** so page and image match and every month has the
   same fields. Win rate stays on the profile, and Q13 stays the owner's.
3. Heading "Their whole record" → `@handle's record`? **Recommend yes** (F3a, consistent with removing "full record").
4. The stock image range will be the arithmetic one while `/t/[symbol]` (another session's page) still prints the geometric
   `rangeText`. **Recommend** the image follows the helper, plus a hand-off note to the /t owner to adopt `recordStrip`.
5. Month best/worst dropped from the month image only (kept on the page)? **Recommend yes** (band room, cherry-pick vector).
