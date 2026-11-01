# F-4 · Share card rework · Implementation plan

Date: 2026-10-26. Feature: `docs/features/F-4-share-card.md` (Status rework, owner-confirmed decisions of
2026-10-22). Process: `docs/IMPLEMENTATION.md` → "The cycle", engineer's plan; the committee reviews the
build afterwards. The plan decides how, not what: no decision in the feature file changes. Nothing here is
legal advice.

Demo sentence: "The link a trader shares unfurls into their whole record at a glance: the line of every
closed trade, how many there are, how long the record runs, one average with its likely range, and one
plain sentence about how much that sample says."

Criteria are numbered AC1 to AC10 in the order of the feature file's acceptance criteria.

## 1. One PR, one branch

Size: about 350 to 450 product lines (the Gate's cap counts product lines only, 800). No schema change, no
dependency, no vendor, no protected path (`lib/session.ts`, `lib/broker.ts`, `package.json` untouched).
Branch: the worktree branch (the build is committed there; no push).

## 2. What changes, file by file

### 2.1 The statistics: `lib/confidence.ts` (new) and `lib/trades.ts#confidence`

DESIGN §5.2 TR-9 already reads the owner's F-4 rule (K < 5 or half-width > 10 points → too early, the range
shown once K ≥ 5 with Student's t at K − 1 degrees of freedom). IMPLEMENTATION "Conflicts and gaps" item 8 puts
the threshold constant in `lib/confidence.ts` with its test. So:

- `lib/confidence.ts` (pure, no I/O, imports only types from `trades.ts` and `counted`/`count` from
  `format.ts`):
  - `MIN_BETS = 5` and `TOO_WIDE_HALF_WIDTH = 0.10` (the design-record threshold: ±10 percentage points per
    trade, on the per-trade interval in simple-return terms, half-width = (high − low) / 2; exactly 0.10 is
    not too wide).
  - `halfWidth(iv)`, `tooWide(iv)`.
  - `trustSign(c)`: the sign the trust line uses. `positive` only when the per-trade range shown on the card
    lies entirely above 0 **and** the TR-9 pace verdict (`edge`) is positive; `negative` mirrors it below 0;
    everything else `unclear`. Requiring both means the card can never say "consistent" beside a range that
    crosses zero, and never contradicts the profile's "Past results" verdict. Symmetric by construction.
  - `trustLine(c)`: the owner's fixed table (8 rows), chosen by tier and `trustSign`. N, D, M, Y:
    too early N = closed trades (the owner's row says "trades"); otherwise N = independent bets (K).
    D = span in days (first entry to last exit, rounded, at least 1); M = whole 30-day months of span
    (floor); Y = whole 365-day years (floor). Floors never overstate the sample. Counts grouped by thousands
    (`count`), singular/plural by `counted`. `null` for an empty record (it says "No closed trades yet").
  - `TRUST_BANNED`: the reader-test list from AC5 (confidence interval, standard error, p-value, alpha,
    Sharpe, edge, signal, skill).
- `lib/trades.ts#confidence` (same signature, same clustering and formulas):
  - Floor `k < 10` → `k < MIN_BETS` (no interval below 5 bets: the owner's floor).
  - From K ≥ 5 the per-trade and pace intervals are always computed with `tCrit95(K − 1)` (unchanged
    function: exact table df 1..30, then 1.96 + 2.4/df).
  - New: when `tooWide(perTrade)`, `tier = 'too-early'` and `edge = null`, but `perTrade` and `pace30` stay
    (the range is always shown from K ≥ 5, widening as the sample thins; F-4 decision 4).
  - `evidenceWeight` returns 0 for a too-early record (it now can carry `pace30`), so ranking (TR-9 Must:
    lower bound) never lifts a too-wide record.
  - `evidenceLine`: "of 10 bets" / "10 independent bets needed" → `MIN_BETS`; a too-wide record reads
    "Too early to tell: the range is still too wide to say much (12 bets)" (with "from N trades" when grouped).
- Callers that hard-code "of 10 bets" (`app/t/[symbol]/page.tsx`, `HoldTime.tsx`, `Concentration.tsx`,
  `app/t/compare/page.tsx`) read `MIN_BETS`. Their logic is unchanged: they already show the range whenever
  one exists.
- `isNewRecord` (TR-7: 30 days or 10 closed trades) is a different rule and does not change.

### 2.2 The card model: `lib/record-card.ts` (new, pure)

`recordCard(input)` → everything the image draws, as data, so every AC is a unit test:

| Field | Reads | Rule |
|---|---|---|
| `name`, `handle` | `users.display_name`, `handle` | name falls back to `@handle` |
| `label`, `tone` | record state (`publicRecord`), demo flag, all-verified | the existing `shareCardText` / `imageTrust` rule (POLICY F3a); never null: a record that is not wholly broker-sourced and not demo reads "Not verified" |
| `note` | record state | the failed-import line, the importing note (unchanged rule) |
| `body` | state, trade count | "No closed trades yet" / "Import in progress"; when set, no stats or chart |
| `headline` | `stats().avgReturn` (same number as the profile) | `pct()`, tone up / down / flat by sign |
| `range` | `confidence().perTrade` | "likely between −x% and +y%", whenever K ≥ 5; null otherwise |
| `count` | closed trade rows | "4,731 closed trades · losses included" |
| `period` | min `opened_at`, now | "Record since Mar 2024 · 31 months" ("1 month", "under 1 month"); whole calendar months, UTC |
| `evidence` | `confidence().tier` | "Evidence: thin" (too early / thin / moderate / strong) |
| `newRecord` | `isNewRecord` | TR-7 "New record" chip, as today (the share prompt promises it) |
| `trust` | `trustLine(confidence())` | §2.1 |
| `chart` | `equityCurve` (CH-1 series) | §2.3 |
| `disclaimer` | `DISCLAIMER` | always, every state |

No per-trade field (symbol, closing time, holding period, per-trade return, worst or best trade) exists in
the model, so the image cannot draw one (AC6; a key-name test enforces it). No win rate (AC2).

### 2.3 The chart: `cardChart()` in `lib/record-card.ts`

The CH-1 series (`equityCurve`, compounded equal weight, a 0% start before the first close), x by close
time, y range from `curveDomain` (always contains 0%, never cropped), downsampled with the existing
`downsampleIndices` (min/max per slice: first, last, the record's low and high survive) to
`CARD_CHART_POINTS` = 240, drawn with the existing `pathD`. One line; a dashed 0% baseline labelled "0%"
(CH-1: 0% on the axis); caption "If every trade were the same size" (CH-1 Must: the label says what is
plotted). Line in the up color when the record ends at or above 0%, the down color below (AC7; the profile
chart's rule). No dots on the card (thousands of trades).

### 2.4 Rendering: one card, every size

- `app/u/[handle]/record-card-image.tsx` (new): `RecordCardImage({ model, layout })`, the only JSX of the
  card (next/og / Satori: flexbox only, inline SVG for the line; read
  `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md` first).
- `lib/record-card.ts#CARD_LAYOUT`: sizes and font sizes per format: `unfurl` 1200×630 (the link
  preview), `square` 1080×1080 (the Share button's image), `story` 1080×1920. A unit test checks every
  text size is readable at a 375 px-wide preview (≥ 10 CSS px at 375, the headline ≥ 28 CSS px).
- `app/u/[handle]/opengraph-image.tsx`: loads rows + state + demo flag, builds the model, renders it at
  1200×630. Unknown handle → 404 (unchanged).
- `app/u/[handle]/story/route.tsx`: same model and component at the square / story size (+ the profile
  link line, since a saved picture has no unfurl). The story keeps its own words for the verified label
  ("Imported read-only from the broker") and the demo sub-line (fix round 6 decisions).
- `lib/story-image.ts`: keeps `FORMATS` / `parseFormat`; `storyModel` (win rate, worst trade, the old
  uncertainty pill) is replaced by `recordCard`, because F-4 takes win rate and per-trade detail off the
  card. Its tests are rewritten against the new model, one for one (§4).
- `share-card.tsx`, `share-prompt.tsx`: unchanged URLs (`/u/<h>/story?format=square`,
  `/u/<h>/opengraph-image`); the prompt's "the card is labelled New record" stays true.

## 3. Tests per acceptance criterion (written first)

| AC | Test | File |
|---|---|---|
| AC1 chart, count, period, name/handle | model has `chart` (single path, `zeroY` inside the box, domain contains 0), `count`, `period`, `name`, `handle` | `lib/record-card.test.ts` |
| AC2 one headline + range, no win rate, t table | `tCrit95` at K = 5, 10, 30, 100 (df 4, 9, 29, 99) against 2.776, 2.262, 2.045, 1.984 (±0.001); a K = 5 hand-computed interval uses 2.776; range text "likely between …" iff K ≥ 5; no `winRate`/"win rate" anywhere in the model | `lib/confidence.test.ts` (new tests), `lib/record-card.test.ts` |
| AC3 too early by model, not count | K = 4 → too early; K = 5 tight → thin; the same K = 12 too early with a wide spread and thin with a narrow one; K = 200 with ±10.1-point half-width too early; boundary exactly 0.10 not too early | `lib/confidence.test.ts` |
| AC4 trust table | every one of the 8 cells, positive and negative mirrors; "consistent" only in strong with the interval entirely on one side (gains and losses); a strong record whose range crosses 0 says "no clear pattern" | `lib/confidence.test.ts` |
| AC5 reader test | every trust line produced (all tiers × signs, many N/D/M/Y) contains no banned term (whole word, any case) | `lib/confidence.test.ts` |
| AC6 no per-trade detail | model keys contain no symbol/closed/held/holding/worst/best/trade-row field; no string value names a symbol from the input or a closing date | `lib/record-card.test.ts` |
| AC7 losing = winning layout | mirrored records: same model keys, same layout, only the sign and tone differ; chart `down` true for a negative record | `lib/record-card.test.ts` |
| AC8 disclaimer + state always | every state (connected, none, importing, failed) × demo × empty/non-empty has the disclaimer and a non-null label; empty reads "No closed trades yet" | `lib/record-card.test.ts` |
| AC9 sizes + 375 px | `CARD_LAYOUT` sizes match the unfurl (1200×630) and the Share button image (1080×1080); readability at 375; e2e: the OG route and the square / story routes return PNGs of those exact sizes for a winning, a losing and an empty record | `lib/record-card.test.ts`, `e2e/share-card.spec.ts` (new) |
| AC10 snapshots | model snapshots (deepEqual) of winning, losing, empty; period text at 0, 1, many months; 5,000 trades → chart ≤ 240 points with the record's min and max kept, "5,000 closed trades" | `lib/record-card.test.ts` |

Existing tests changed only where F-4 changes the rule (each listed in the build log): the K < 10 floor tests
in `lib/confidence.test.ts`, the "of 10 bets" copy, and `lib/story-image.test.ts` (win rate, worst trade and
the old pill come off the card).

## 4. QA

`npx tsc --noEmit`; `npm test` (with the worktree `.env`); `BASE_REF=main node scripts/compliance.ts auto`;
`node scripts/autopilot.ts guard main`; `npm run build`; `npx playwright test e2e/app.spec.ts -g
"card|share|opengraph|story"` and `e2e/share-card.spec.ts`. Renders saved to
`docs/features/logs/F-4/screenshots/`: unfurl and square at full size and in a 375 px-wide preview, for a
winning, a losing, an empty and a thousands-of-trades record.

## 5. Compliance checklist (COMPLIANCE.md §1)

1. Shows / labels performance: **yes** → §2. The disclaimer is on every rendering (AC8 test). No advice
   words; the trust lines are the owner's fixed table, describe the sample only (POLICY F3b), and the
   reader test bans "edge", "signal", "skill" and the statistics jargon; the scanner's F2 list runs on the
   new files. Losses: same layout, same font sizes, "consistent losses" mirrors "consistent" (AC4, AC7);
   "losses included" stays beside the count. Evidence label kept (TR-9). "Verified" only for a whole
   broker-sourced record (F3a, existing rule); Demo always labelled.
2. Personal data: the card shows display name and handle, already public on the profile and the current
   card. No new field, no new storage. Percentages only; no quantities, prices or balances (CLAUDE.md).
3. Money: no.
4. Email / push / SMS / tracking: no.
5. User-written text: the display name only, as today (no thesis on the card).
6. Sign-up, age, identity: no.
7. Vendor, dependency, font, image, copied copy: no. Next's bundled default font is used (no external
   fetch).
8. Screen reader / keyboard: the image keeps its alt text from the record state (`profileCardAlt`,
   unchanged); the image adds no interaction.
9. Security posture: no; the routes stay public and read-only, as today.
10. Claims: no completeness claim ("losses included" and counts only; no "every trade").
11. Checkout: no.

## 6. Owner-only items

- None blocking. DESIGN.md §5.2 already states K ≥ 5 and the 10-point threshold.
- Pre-authorization requests: none (no protected path, secret, dependency, vendor or deploy setting).
