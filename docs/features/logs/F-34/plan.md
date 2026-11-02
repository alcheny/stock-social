# F-34 · Implementation plan (UX lead, 2026-11-02, branch `claude/f34-open-positions-line` at fd1b6f1)

Input: `docs/features/F-34-one-open-positions-line.md`, including the owner's 2026-11-02 answer to OD 2.25: real users'
unrealized values keep showing, and every surface shows F-4's card line, lowest value first. Also F-4, F-6, F-12, F-20,
F-21, F-23 and F-29, and the code cited below. This plan changes no decision. It decides how, not what. Where I would
change a decision, I say so under Open questions.

The rule in one line: **one pure function makes the open line. Every surface prints its `text` byte for byte. Images,
alts and link-preview descriptions add its `asOf` words, which always carry the year. Every reader of `open_positions`
uses one account filter, and the date comes from the stored `fetched_at` in the read the surface already makes.**

---

## 1. The one producer

**Where:** `lib/copy.ts`, beside `SHARE_CARD` and `OPEN`. The feature file allows `lib/copy.ts` or
`lib/record-strip.ts`. Putting it in `lib/record-strip.ts` would create an import cycle, because `record-strip.ts`
imports `record-card.ts` and the card needs the line. `copy.ts` already imports `lib/format.ts`. It also imports
`lib/open-split.ts`, which is string-free and imports only `format.ts`, so no cycle forms.

```ts
// lib/open-split.ts (string-free, additive): the numbers the line needs.
export type OpenFacts = { n: number; up: number; down: number; flat: number; low: number; high: number };
export function openFacts(pcts: number[]): OpenFacts | null   // openSummary() + min/max of the finite values

// lib/copy.ts: the only producer of the open line.
export type OpenLinePart = { role: 'title' | 'split' | 'at' | 'low' | 'high'; label: string; value: string | null; word: string | null; tone: Tone | null; sep: '' | ' · ' | ', ' };
export type OpenLine = {
  text: string;      // the line, byte-identical on every surface
  parts: OpenLinePart[];
  asOf: string;      // "unrealized as of Nov 1, 2026" (year always)
  withAsOf: string;  // `${text}, ${asOf}`, used by strip pages, descriptions and the feed card
  alt: string;       // `${withAsOf}.`, used by every image's alt text
};
export function openLine(f: OpenFacts | null, asOf: Date | null): OpenLine | null
```

- `text = parts.map(p => p.sep + p.label + (p.value ? p.value + ' ' + p.word : '')).join('')`. A unit test pins
  this as a property of the parts, so a surface that draws parts can rebuild the same bytes.
- `tone` comes from `lib/format.ts#tone` applied to the printed value, the same rule the profile uses (F-19).
- `asOf` uses `dateText(d, d, { year: 'always' })` from `lib/date-text.ts`. This is the formatter `closedDay` already
  uses for images. If no date is stored (`fetched_at` is `not null default now()`, so this should not happen), the
  function returns null. It never prints an undated value.
- `openLine(null, …)` returns null, and every surface then renders exactly what it renders today with no open
  positions.
- `cardOpen` in `lib/record-card.ts` becomes a thin adapter. `CardOpen` gains `line: OpenLine`. The fields `full`,
  `short`, `split`, `spread`, `low`, `high`, `lowTone` and `highTone` are derived from `line.parts`. They are no longer
  built inside `cardOpen`, so existing callers and tests keep their field names.
- The old producers are retired: `SHARE_CARD.openShort`, `SHARE_CARD.openNote`, `SHARE_CARD.openAlt`,
  `OPEN.feedLabel`, `OPEN.feedCounts`, `OPEN.feedTail` and the `role: 'open'` text in `recordStrip`. `SHARE_CARD.openFull`
  stays, as the title words, and only `openLine` reads it. `OPEN.line` stays for the stock and compare pages (`app/t/**`).
  Those pages show an aggregate over many traders, which is not a trader's open line (Open question Q5).

### How each surface uses it

| Surface | Code | What it prints |
|---|---|---|
| Profile card image: unfurl, square and story | `record-card-image.tsx` draws `m.open.line.parts` and `line.asOf` | `text` plus the `asOf` row (§3) |
| Profile card alt | `cardAlt`: replaces `${SHARE_CARD.openAlt} …` | `line.alt` |
| Profile link-preview description | `page.tsx#generateMetadata`: `cardDescription(card, card.open?.line.withAsOf)` (today `OPEN.line(...)`, the average) | `withAsOf` |
| Profile page | `OpenGrid` gains a `line` prop and renders `<p class="open-line" data-open-line>` as its last row (§3). The date stays in the grid label (`OPEN.asOfLabel`, today's page format) | `text` |
| Pane: feed and `/pane` JSON | `ProfilePane` calls `openLine(facts(model), new Date(model.openAsOf))`. The facts come from `model.open` and the new `model.openRange` (§6) | `text` |
| Trade and month pages | `recordStrip(…, 'page')`: the `open` figure part is `withAsOf` with its parts. `app/record-strip.tsx#Figures` renders it as its own block (§3) | `withAsOf` |
| Trade and month images | `stripImageLines` turns `strip.open` into the open block (§3) | `text` in rows, plus the `asOf` row |
| Trade and month alts | `recordStrip(…).alt`: replaces `"‹n› open positions, unrealized"` | `line.alt` |
| Trade and month descriptions | `stripTextAfterCount(strip)` already carries the `open` part | `withAsOf` |
| Feed card ("Also open") | `app/ui.tsx#TradeCard`: `<p class="open-also" data-open>` prints the line's parts (Q1: in scope) | `withAsOf` |

**Feed card: in scope.** The owner's 2026-11-02 wording is "on every surface". A viewer who reads "−5.0% avg
unrealized" on a card and then "lowest −15.0% down" in the pane one swipe later meets exactly the drift F-34 removes. F-6
gave the card one open line, and it stays one line, so D22 and F-21's one-record-line rule are unaffected. This amends
F-6's 2026-11-01 feed-card decision (counts plus average), so it is listed as Q1 for the business lead to confirm. It
lands as the last commit, so it can be dropped without touching anything else.

## 2. The exact wording

F-4's card line, lowest first. Two changes, both required by the feature file:

1. Each value is followed by its tone word, joined by a no-break space. A negative value then has a minus sign and a
   word ("down"), so meaning never depends on colour (POLICY A1). The word comes from the line's own count vocabulary
   (up, down, flat), and positive and flat values get one too.
2. The number and its word never wrap apart (U+00A0), as in `OPEN`'s `upDown` (F-6 D4). The split uses the same
   no-break spaces.

The minus sign is `pct()`'s hyphen-minus. F-19's U+2212 sweep is pending, and images keep the hyphen until a render test
passes. The `≈-100.0%` band reads `≈-100.0% down`.

| State | `text` (· = " · ", ⍽ = U+00A0) |
|---|---|
| Mixed, the AC fixture | `Still open: 3 positions · 2⍽up, 1⍽down · lowest -15.0%⍽down, highest +4.0%⍽up` |
| All losing | `Still open: 3 positions · 0⍽up, 3⍽down · lowest -21.5%⍽down, highest -3.1%⍽down` |
| All winning | `Still open: 3 positions · 3⍽up, 0⍽down · lowest +2.0%⍽up, highest +40.0%⍽up` |
| One position | `Still open: 1 position · at -8.0%⍽down` (no split, as on the card today) |
| One position, flat | `Still open: 1 position · at 0.0%⍽flat` |
| All flat | `Still open: 2 positions · 0⍽up, 0⍽down, 2⍽flat · at 0.0%⍽flat` |
| Printed alike | `Still open: 2 positions · 2⍽up, 0⍽down · at +5.0%⍽up` |
| With flats | `Still open: 4 positions · 1⍽up, 2⍽down, 1⍽flat · lowest -9.0%⍽down, highest +3.0%⍽up` |
| 1,000+ | `Still open: 1,204 positions · …` (`count()` grouping; today's `${n}` is ungrouped) |

- `asOf`: `unrealized as of Nov 1, 2026`. The image row and the alt add the word "unrealized", which "Still open" leaves
  implicit, and replace the alt's old "as of the last sync" with the real date.
- `alt`: `Still open: 3 positions · 2 up, 1 down · lowest -15.0% down, highest +4.0% up, unrealized as of Nov 1, 2026.`
  The alt keeps the "·" so it is byte-identical (Q4).
- No completeness words ("all positions", "every holding"), no advice words, percent only (P3).

## 3. Prominence (TR-4) and placement

The line always sits in the block with the headline figures. It is never put in a caption, a chart note or a foot.
Values take their tone colour: `.up` / `.down`, which are `var(--up)` / `var(--down)` on pages (the feature file's
`--loss` is the `--down` token in `app/globals.css`), and `IMAGE_COLOURS[tone]` / `IMAGE_PALETTE.card.down` on images.
There is no literal hex. A loss is drawn at the same size and weight as a gain.

- **Profile and pane:** the line goes inside `OpenGrid`, directly under its two tiles, full width, at body size (not
  `.small`, not `.muted`). The count tile's caption becomes the bare noun "open positions", because the line now
  carries up and down (no repeats). `ChartNote` (CH-1) becomes `Chart: closed trades only. Not plotted: open positions.`,
  so the open line is no longer repeated in a caption.
- **Trade and month pages:** the strip's `open` part renders as its own `<span class="strip-open" data-open-line>`
  block inside `p.record-strip`, right after "losses included", at the strip's size. The values are toned `<b>`.
- **Card images:** square and story keep F-4's block: the title at `f.line` size, then the `asOf` words, muted, where the
  old "unrealized, not sold yet" note sat, then the split and spread row at body size. The unfurl draws three rows at
  35 px: title · split, then spread, then `asOf`. The 35 px floor (10 CSS px at 343) cannot shrink, so the chart gives
  up height instead: `openCut` = rows × 41 (today 1 × 41). This follows the rule F-4 already uses: one row of text is
  worth more than a sliver of chart. With open positions, a typical unfurl chart drops from about 24% to about 21% of
  the card. The worst case, with a failed note, options and a wide average, drops to about 10%. That goes to the owner
  (Q8).
- **Strip images:** the line leaves the muted `losses` tail and becomes the open block, roles `open0..openN` plus
  `openAsOf`.
  - Row 1 is the title at record size (35 px, weight 700). It fits at 24 characters: "Still open: 12 positions" is
    504 px.
  - The remaining parts pack greedily into rows at the largest size up to 30 px where each row fits the 582 px band. A
    row never breaks inside a part, and a value never breaks from its word.
  - The last row is `asOf`: 28 px, muted, with the year.
  - Each row carries `spans` (new optional field `ImageLine.spans?: { text; tone }[]`), and `RecordStripImage` colours
    each value span from `IMAGE_COLOURS`.
  - A typical block is 4 rows (about 150 px).

### Image fit rules, in order (`tradeBand` / `monthBand` try each step before the next)

I measured today's bands on the F-12 model with a fictional 40-trade record. A connected record with a thesis has
36 px spare. With options it has 7 px, and with options and a frozen line it has 1 px. The open block needs about
143 px, so the steps below free the space, in this order:

1. The thesis gives way (existing first step). "One of N months" gives way on the month image (existing).
2. The hero shrinks: symbol 80 → 40 px and held line 30 → 26 px on trades, month label 52 → 36 px and month figures
   30 → 26 px (existing loops).
3. The disclaimer steps down from 35 to 28 px (existing `DISCLAIMER_STEPS`).
4. **New:** "losses included" joins the handle row (`@x's record · losses included`) when that fits at 26 px or more.
   Otherwise it joins the count row, unless the options qualifier is already there. The words always stay.
5. The options qualifier joins the count row (existing rule).
6. **New:** the open rows step from 30 to 28 to 26 px, and the title from 35 to 30 to 28 px.
7. The gaps shrink from 14 to 4 px (`layoutBand`), then the disclaimer goes to 27 and then 26 px (existing floor).
8. A frozen line gives way only beside a failed note (existing rule, unchanged).

Nothing in the open block, and no record count, average, range, "losses included" or disclaimer, is ever dropped. The fit
test runs the full matrix: state (connected, failed, public) × options on or off × thesis on or off × frozen on or off ×
open positions 1, 3 or 12 × long values (`-99.98%`, `+1088.7%`) × long handle. If any combination fails at step 8, the
build stops and comes back to the committee rather than dropping a line. My recommended fix in that case is the existing
ponytail: move the failed note onto the label line. The engineer records the matrix output in the build log.

## 4. Account set: one filter

`lib/shared-accounts.ts` (additive, beside `notShared`):

```ts
// Open positions of the record's account set: never a simulated account, never an account marked as another profile's
// (the same set lib/sync.ts#rebuildTrades uses for closed trades). Correlated on p.user_id, so it works for many users.
export const positionInRecord = (db: Db) => db`not exists (select 1 from broker_accounts b where b.account_id = p.account_id and b.user_id = p.user_id and b.is_paper)
  and not exists (select 1 from shared_account_marks m where m.user_id = p.user_id and m.account_id = p.account_id)`;
```

Every reader aliases `open_positions p` and adds `and ${positionInRecord(sql)}`:
- `app/u/[handle]/load.ts` (`positions`). This also covers the card's data and the profile's list.
- `app/u/[handle]/pane/route.ts`.
- `lib/feed.ts#openPositions`.
- `lib/trade-share-load.ts#openPercents`, which serves both trade and month.
- `lib/display-log.ts`.
- `app/t/open-positions.ts`, so the stock pages' "held by N traders" never counts a paper or shared account.

Why it is needed: the sync already skips paper accounts. However, a sync after `--mark` writes a marked account's
positions again (`real` does not exclude marks), and an account flagged paper later keeps its rows until the next read.
A db test proves both cases. Writers stay unchanged.

## 5. The as-of date

- It comes only from the stored `fetched_at`: the oldest read of the shown positions, as F-6 shows it. There is no vendor
  call and no new statement.
- `openPercents` becomes `openRead(userId, state)`, which returns `{ pcts, asOf }` from the same single statement
  (`select unrealized_pct, fetched_at …`). `TradeView` and `RecapView` gain `openAsOf?: Date`, and `StripInput` gains
  `openAsOf?: Date` (additive; `open?: number[]` keeps its type).
- The card reads `asOf` from the `positions` rows `record-card-data.ts` already loads, which already include
  `fetched_at`. `CardInput` gains `openAsOf?: Date`.
- The image routes change by zero lines. Everything flows through `loadTradeShare`, `loadRecap` and `loadRecordCard`.
- **Owner flag (OD 2.7):** `lib/privacy-fields.ts:41` labels `open_positions.fetched_at` "freshness, internal". The
  profile already prints it (`page.tsx:103`, `:403`), and after this build the images, alts, descriptions and strip pages
  print the same UTC day. They show nothing the profile does not. The build does not change the label. The PR body asks
  the owner whether to move it into OD 2.7's record-state fields.

## 6. Public payloads (F-23)

- The pane JSON adds `model.openRange: { low, high } | null`, both run through `wirePct`, which F-23 already uses for
  printed percents. That keeps `pct()` and `tone()` of the wire value equal to the stored value's. `model.open` keeps its
  shape (`lib/pane-model.test.ts` pins it). `openAsOf` stays an ISO day.
- `PAYLOAD_V` (`lib/chart-series.ts`) goes from 2 to 3, so no cached pane without `openRange` is served alongside the new
  client.
- Nothing else is sent. There are no symbols, the as-of time stays a day, and each position's percent stays out of the
  pane JSON: only the low and the high are sent, and both are printed.
- The feed card, profile and trade or month pages are server components. Their props are not serialised, and the HTML
  prints only the line. `e2e/f23-payload-scan.spec.ts` gets the fixture's −15% loser and must find no digits beyond the
  printed precision.

## 7. Pane order and the 360 / 320 checks

- Order, fixed in one place: `lib/pane-model.ts` exports
  `PANE_LINES = ['exclusions', 'open', 'options'] as const`, and `app/pane.tsx` renders the lines in that order after the
  realized stats, with an empty slot when a line is absent.
  - `exclusions` is F-21's slot. Nothing renders there until F-21 is built.
  - `open` is `OpenGrid` with the line.
  - `options` is F-29's slot. Today's `ShareTradesLabel` stays where it is, and F-29 moves it into this slot. F-34
    neither builds nor moves it.
  - `CombinedLine`, `PaneOptions` and the F3 line follow, as today.
- The F-21 builder and the F-29 builder only fill their slots. A unit test asserts the order array, and an e2e test
  asserts the DOM order of `[data-pane-line]`.
- 360×740, fictional record with the −15% loser, the options label on and a failed note: the realized headline and the
  disclaimer are both inside the first viewport, with at least 24 px of headroom under the disclaimer. That headroom is
  one muted line, reserved for F-21's exclusions line, so F-21 cannot push the disclaimer out. The F-21 builder replaces
  the headroom check with the real line.
- At 320 px there is no horizontal scroll (`scrollWidth <= clientWidth`), the line wraps only at normal spaces, and no
  "-15.0%" is split from "down".
- The same checks run on the profile at 360 px, on the trade and month pages, and on the feed card.

## 8. AC to test map, states and files

| AC | Test (new file unless marked) |
|---|---|
| Render-equality, which replaces the OD 2.25 guard | `lib/f34-open-line.test.ts`: one fictional record with open `[-0.15, 0.04, 0.012]`. `line.text` appears byte-identical in the card model's image rows (joined by part seps), in `cardAlt`, `cardDescription`, `recordStrip` page and image for trade and month, `stripImageLines` rows, `tradeAlt`, `monthAlt`, `tradeDescription`, `monthDescription`, `ProfilePane` HTML from a JSON round-tripped `paneModel`, and the profile and feed HTML (`renderToStaticMarkup`). E2e `e2e/f34-open-line.spec.ts` repeats this on the running app: profile, pane, trade page, month page, and `og:description` / `og:image:alt` meta |
| Image snapshots, changing only on the open line | `lib/f34-open-line.image.test.ts`: sha256 snapshots (the `fixes-cycle4-part2.image.test.ts` pattern) of the profile unfurl, square, trade image and month image with the fixture. A structural half asserts that the rows differ from the same fixture without open positions only in `open*` roles and the step-4/5 merges. The existing `record-card.snapshot.test.ts` hash is regenerated deliberately, and the PR names it |
| Paper and notShared are left out | `lib/f34-open-line.db.test.ts`: a trader with a real account, a paper account (`is_paper`) and a marked account (`shared_account_marks`), each holding one position. Every loader (load.ts, pane route handler, feed, `openRead`, display-log, `symbolOpen`) returns only the real account's position, and the line reads "1 position" |
| As-of date with the year on images | Unit: every image row set and alt containing a value also contains `asOf`, matching `/as of [A-Z][a-z]{2} \d{1,2}, \d{4}/`. This holds in the current year, and in a prior year with `now` in January |
| No vendor call and no extra query | Db test with a query log (the `profile-load.test.ts` `debug` hook): loading each image's data runs the same number of `open_positions` statements as on main (1), and none on any other new table. The vendor fake (`e2e/fakes/vendor.ts`) records zero requests while the e2e fetches the three image URLs |
| Down colour from the F-20 table | Unit: the rendered strip and card image elements give the down span the colour `IMAGE_PALETTE.strip.down` / `.card.down`. The existing `lib/colour-literals.test.ts` must stay green with no new allowlist entry |
| Pane at 360 and 320 | E2e, §7 |
| One producer | Source scan in `f34-open-line.test.ts`: outside `lib/copy.ts`, no file under `app/` or `lib/` (tests excluded) contains `Still open`, `open, unrealized`, `avg unrealized` (except `app/t/**` via `OPEN.line`) or calls `SHARE_CARD.openFull`. The retired keys no longer exist. `openLine(` is called only from the call sites listed in §1 |

### States (each one gets a unit case and the e2e cases named)

| State | Behaviour |
|---|---|
| No open positions | No line, no `openRange`, today's HTML and image (existing "renders exactly as before" tests stay) |
| One position; all flat; all losing; all winning; mixed; printed alike; 12 positions; values near −100% | The wording in §2 |
| Open positions and no closes | Profile, pane and card show the line in the empty-record block (as F-6 does today). Trade and month need a close, so this does not apply to them |
| Importing | No line on any surface (TR-3; existing gates). |
| None / not consented | No line. |
| Failed import | The line plus the warn note (fit matrix). |
| Public filer and public demo | No `open_positions` (F-7). Asserted: no line. |
| Demo | Demo traders' positions show with the Demo badge, as today. The test checks the image says "Demo" and never "verified". |
| Signed out | All surfaces render the same line, since the feed and profile work signed out. The e2e runs signed out. |
| Frozen | Unchanged, per F-6's OD-9 ponytail. The fit matrix covers a frozen line. |
| Options gate open | Today only the profile adds option positions to its summary. Recorded as ponytail Q6. Gate is closed now |

### Files to touch (additive, logic in lib)

- `lib/copy.ts`: `openLine`, `OpenLine*` types and the line words. Retire `SHARE_CARD.openShort/openNote/openAlt` and
  `OPEN.feed*`.
- `lib/open-split.ts`: `openFacts`.
- `lib/record-card.ts`: `cardOpen` adapter, `CardInput.openAsOf`, `cardAlt`, unfurl `openCut` by rows.
- `lib/record-strip.ts`: `StripInput.openAsOf`, `Strip.open`, the `open` part from the producer, the alt, the open block
  in `stripImageLines`, merge steps 4 and 6, `ImageLine.spans`.
- `lib/trade-share.ts`: `tradeStripInput` passes `openAsOf`. `tradeBand` gets the new steps.
- `lib/month-card.ts`: `monthBand` steps.
- `lib/trade-share-load.ts`: `openRead`.
- `lib/recap.ts` and `lib/recap-load.ts`: `openAsOf`.
- `lib/pane-model.ts`: `openRange`, `PANE_LINES`.
- `lib/chart-series.ts`: `PAYLOAD_V` 3.
- `lib/shared-accounts.ts`: `positionInRecord`.
- `lib/feed.ts` and `lib/display-log.ts`: the filter.
- `app/u/[handle]/load.ts`, `app/u/[handle]/pane/route.ts` and `app/t/open-positions.ts`: the filter only.
- `app/u/[handle]/record-card-data.ts`: `openAsOf`.
- `app/u/[handle]/record-card-image.tsx`: parts, tones and the `asOf` row.
- `app/record-strip.tsx`: the `Figures` open block and `RecordStripImage` spans.
- `app/open-rows.tsx`: `OpenGrid` line, count caption, `ChartNote`.
- `app/pane.tsx`: line order.
- `app/u/[handle]/page.tsx`: line to `OpenGrid`, `cardDescription`.
- `app/ui.tsx`: feed card.
- `app/globals.css`: `.open-line` and `.strip-open` with tokens only.
- **Image routes:** no edits to `app/u/[handle]/opengraph-image.tsx`, `story/`, `trade/[sellId]/opengraph-image.tsx` or
  `month/[ym]/opengraph-image.tsx`, which keeps clear of #100 and #102. Expect a merge in `record-card-image.tsx` with
  #102 (card footers). Take #102's footer and this branch's open block.
- **Updated expectations, not weakened.** Each one asserts the new decided strings, and the test count does not drop:
  - `lib/record-card.rework.test.ts:189-230` (words after values, NBSP, alt with date).
  - `lib/f12-strip.test.ts:53,103` and `lib/record-strip.test.ts:111-112` (`withAsOf` in place of "‹n› open, unrealized").
  - `e2e/record-strip.spec.ts:162`.
  - `e2e/f6-open-positions.spec.ts:185` (feed card).
  - `lib/record-card.snapshot.test.ts` hash.
- **Protected, not touched:** `scripts/*` (autopilot, team, features, doctor, plan, invariants, compliance*),
  `policy.test.ts`, `workflow-security.test.ts`, `.github/**`, `docs/POLICY.md`, `CLAUDE.md`, `team/**`,
  `playwright.config.ts`, `lib/session.ts`, `lib/broker.ts`, `lib/privacy-fields.ts` (the owner decides the label,
  §5). No schema change, no dependency, no font.

### Rollout

One PR on this branch, in commits that each pass on their own:
1. Filter and db test.
2. Producer, card and strip text, with the unit and equality tests.
3. Images, fit and snapshots.
4. Profile and pane order, payload, e2e.
5. Feed card (droppable, Q1).

Main is merged in as #100 and #102 land (owner, 2026-11-02).

## 9. Compliance (COMPLIANCE §1)

1. **Performance:** yes. Every surface already carries the F3 disclaimer. The images keep it inside the band, and it is
   never dropped (§3). There are no advice words, losses come first, and a loss has the same size, a word and the down
   token. The evidence labels are unchanged, as is "Verified" (F3a). The line makes no completeness claim.
2. **Personal data:** these fields are already public under consent: the unrealized percent (`CONSENT_SCOPE_LINE`).
   The new exposure is `fetched_at` as a UTC day on images, alts, descriptions, strip pages and the pane, the same day
   the profile already prints. It is flagged to the owner (OD 2.7, §5). Nothing new is stored, and deletion is
   unchanged (the `open_positions` cascade). The account filter shrinks what is public, never grows it.
3. **Money:** no.
4. **Messages and tracking:** no.
5. **User content:** no.
6. **Accounts and age:** no.
7. **Vendor, dependency or asset:** none new. No vendor call at render. The vendor's market-data permission stays a
   launch gate (feature file, 2026-11-01), unchanged by OD 2.25.
8. **Accessibility:** a word beside every value, NBSP so a value and its word never separate, alts carry the same facts,
   reflow at 320 px, and contrast comes from the F-20 tokens (AA pinned by `a11y-contrast.test.ts`).
9. **Security:** the public pane JSON gains two printed figures. The payload version is bumped so caches re-key, and auth
   is unchanged.
10. **Claims:** "Still open" and "as of ‹date›" are factual and dated. There is no "every" or "all".
11. **Checkout:** no.

**Only the owner can clear:**
- OD 2.7: the `fetched_at` label.
- The unfurl chart share below "about 24%" with open positions (Q8).
- The market-data launch gate, which stays as it is.

## 10. Open questions (each with my recommendation)

- **Q1 (business lead): is the feed card in scope?** Yes, as the last commit. "Every surface" (owner, 2026-11-02), plus
  the swipe drift explained in §1. This amends F-6's feed-card decision.
- **Q2: which word goes after a value: up/down/flat, or Gain/Loss/Flat (`TONE_WORD`)?** Lower-case up, down and flat, the
  vocabulary the same line uses for its counts. Mixing "1 down" with "-8.0% loss" reads as two scales.
- **Q3: keep the count tile with the line under it?** Keep it, with its caption cut to "open positions". The big count is
  F-6's TR-4 tile, and the line carries up and down, so nothing repeats except the number.
- **Q4: alt texts with "·" (byte-identical) or with commas (as `cardAlt` reads today)?** Byte-identical, as the AC
  requires. The review's screen-reader pass checks that "·" is not read aloud. If it is, the committee amends the AC to
  "identical after · → , ".
- **Q5: stock and compare pages (`OPEN.line`, an aggregate over traders).** Out of scope. They get the account filter
  only. They are not one trader's record.
- **Q6: options gate open.** Today only the profile adds open option positions. Recommend a ponytail now, and when the
  gate opens, one shared loader adds them to every surface, with a gate-open case added to the render-equality test.
- **Q7 (owner, OD 2.7):** move `fetched_at` into the named record-state fields. Recommend yes. It is already printed
  publicly.
- **Q8 (owner, F-4): the unfurl chart share drops from about 24% to about 21% (typical) and about 10% (worst) with open
  positions.** Accept it, under F-4's own rule that a row of text outranks a sliver of chart. The alternative, a smaller
  open row, breaks the 35 px legibility floor.
- **Q9: the pane AC needs F-21's line, which is not built.** Reserve the headroom (§7). The F-21 builder replaces the
  check with the real line.
- **Q10: a worst-case image that does not fit after step 8.** Stop and return to the committee. Recommended fix: the
  existing ponytail, the failed note on the label line.
