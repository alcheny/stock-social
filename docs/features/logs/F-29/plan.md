# F-29 · Build plan (UX lead, 2026-11-02, branch at 69143dc = main ca34767 + F-29 branch)

Input: `docs/features/F-29-gated-options-wording.md` (binding), cycle-5 conditions (LC: the signed words exactly; CO:
the last qualifier on a surface is never removed), owner news 2026-11-02 (OD 2.63 accepted: options stay gated until
the owner approves an amended scope line as a new consent version; the interim /how words apply meanwhile). No product
code here. Every finding below was checked against the code at 69143dc.

## Verified state at main
- `app/how/page.tsx:22` renders `OPTIONS.how` (the "consented" sentence) unconditionally. /how is static (no request API).
- `optionsPublic(fields = PUBLIC_FIELDS)` (`lib/options-gate.ts:16`) is false today and flips only with a code change
  (a deploy). Its `fields` argument lets a test flip it in process. `lib/options-fix4.test.ts:26` pins `OPTIONS.how`.
- Qualifier counts, seeded `yolo_yuki`: profile 1 (`.share-label` directly before the headline `section.stats`) plus the
  chart figcaption (excepted). Feed `.row`: the card strip 1 (`[data-role=options]` after the average and range,
  `lib/record-strip.ts:122`), the pane 1 (`.share-label` before its stats, `app/pane.tsx:76`) plus the figcaption. The
  pane count line is `PaneOptions`. The pane foot (`OPTIONS.paneNote`) does not use the qualifier phrase. Share images,
  alt, F4-4 and the trade strip keep theirs. So the "up to five" is already down to one per card and one per pane. F-29
  locks that with position tests.
- Panes are shared elements: `app/feed-rows.tsx:33-42` places one `ProfilePane` element in each of a trader's rows.
  So any `id` inside a pane is duplicated, which rules out `aria-describedby` there.
- `.stats + .open-stats` and `.stats:has(+ .open-stats)` (`globals.css:547,556`) need the realized and unrealized
  grids to be adjacent (F-6, TR-4). Nothing may go between them.
- Public caches keyed by URL: `/u/<h>/pane?v=2` (public, 60 s), `/u/<h>/story?format=…` (public, 300 s), the
  opengraph-image URLs declared in `generateMetadata` (profile `page.tsx:122`, month `:50`, trade `:50`). The
  `/pane-chart` body is share trades only and `/home-card` carries no options words: neither depends on the gate.
  Profile, feed, month and trade HTML are dynamic. No in-process body caches.
- The only "consented" in `allCopy()` is `OPTIONS.how`. No copy prints "not asked". "declined" exists only as an
  identifier (`RESULT.declined` reads "Import not started…").

## Decisions
**D1. Copy: one additive block.** Append `export const F29 = { howInterim: 'Option results are not shown on any record
at present. Where option trades or open options were imported, the record shows how many, and its headline figures
exclude options.' } as const;` to `lib/copy.ts`, and add `F29` to the `allCopy()` walk (one token), so the policy and
copy scans read it. `OPTIONS.how` stays byte for byte. Why: LC (words exactly), and the fix-4 pin stays green.

**D2. /how paragraph: a pure component.** New `app/how/options-paragraph.tsx`:
`HowOptionsParagraph({ open }: { open: boolean })` renders `<p data-options-how={open ? 'open' : 'interim'}>` with
`open ? OPTIONS.how : F29.howInterim`. `app/how/page.tsx:22` becomes `<HowOptionsParagraph open={optionsPublic()} />`
(a one-line swap). /how stays static: the gate flips only by a code change, and a deploy rebuilds the page. Why: one
process can render both states (ACs 1, 9), and the page needs no request-time read.

**D3. Gate key for URL-keyed caches (round 2: E1, E2, E3).** A new pure module `lib/gate-key.ts`. Its only import is
`./privacy-fields.ts` (which imports nothing); it does not import `options-gate.ts`, whose `consent-versions.ts` pulls
`node:crypto` into client bundles. It re-derives the global half from the column list:
- `OPTION_PUBLIC_COLUMNS` moves here, and `options-gate.ts` re-exports it, so there is one list
- `gateKey(fields = PUBLIC_FIELDS): 'o0' | 'o1'`
- `withGate(url, fields?)` appends `g=<key>` with `?` or `&`
- `gateCacheControl(g: string | null, cacheable: string, fields?)` returns `cacheable` when `g === gateKey(fields)`,
  else `'no-store'`

`optionsPublic()` calls the same column check, and a unit test asserts `optionsPublic(f) === (gateKey(f) === 'o1')` for
both field sets.

Where `withGate` is applied:
- `paneSrc` (`app/lazy-pane.tsx:17`) becomes ``withGate(`/u/${encodeURIComponent(handle)}/pane?v=${PAYLOAD_V}`)``, keeping
  the template literal that `lib/pane-model.test.ts:71` matches (`/\/pane\?v=\$\{PAYLOAD_V\}/`).
- The two story URLs (`share-card.tsx:16`, `share-prompt.tsx:50`).
- The three opengraph-image URLs (profile, month, trade, server side).

Routes: `/pane` and `/story` keep their existing checks. After the handle-pattern 404, the F-23 `v` 404 and the
not-found 404, the header becomes `isFilerHandle(handle) ? 'no-store' : gateCacheControl(q.get('g'), <today's value>)`.
The filer `no-store` (`f7-public-profile.spec.ts:225-226`) keeps priority. The pane's
`NextResponse.json({ v: PAYLOAD_V, state, model, chart, status,` prefix stays, because `pane-model.test.ts:70` pins it.
A missing or stale `g` gets the current body with `no-store`, not a 404, so a page open since before the flip still
works. The opengraph-image file routes receive only `params`, so for them the new URL is the cache bust and the body is
always live. `/pane-chart` and `/home-card` are left alone because their bodies do not depend on the gate.

Why: after a flip, pages only reference URLs no cache saw before it. A deploy already clears Next's own caches, so the
key covers CDN, browser and unfurl caches.

**D4. Profile: the qualifier stays where it is.** It is directly before the headline `section.stats`, 2 px above it,
muted at small size, and read first in reading order. Nothing changes there. Why: it already meets decision (b). The
line-order decision binds the pane only, and `e2e/options.spec.ts:354` pins this layout.

**D5. Pane: the qualifier moves to the end of the figures block.** In `app/pane.tsx`'s `figures` fragment,
`<ShareTradesLabel>` moves from before the stats to just before `<PaneOptions>`. That is directly after the stats, or,
with open positions, after `OpenGrid`/`CombinedLine`, since nothing may separate the two grids. At that point add
`// ponytail: F-21's exclusions line, then F-34's open line, go here (before the qualifier) — the pane/strip builder
owns the order; extend e2e/f29-gated-wording.spec.ts's 360/320 test`.

Add one CSS rule: `.pane .stats + .share-label, .pane .open-stats + .share-label, .pane .open-combined + .share-label
{ margin-top: 0; }`. The 16 px stats margin then gives the gap, so the qualifier sits as tight to the figures as the
grids sit to each other. The existing `.pane .share-label { margin-top: 8px }` (pinned by `options-fix3.test.ts:45`)
still applies anywhere else.

Why: the cycle-5 order (exclusions, then open, then qualifier, each under the headline per F-21 and F-34) fixes the
qualifier's place below the figures. Placing it now gives F-21 and F-34 a stable slot to insert into, and the
qualifier is read right after the figures it qualifies. `aria-describedby` cannot be used because pane ids repeat
(see Verified state).

**Stop condition (round 2, B4).** The test is `e2e/f29-gated-wording.spec.ts` "D5 stop: disclaimer in view, pane with
open positions": mount `ProfilePane` with open positions, combined line, label and count line at 360x740. It asserts
that `.disclaimer`'s bounding box satisfies `top >= 0` and `bottom <= 740`. It runs first in the build. If it fails,
fall back: the label stays above the stats, the move is handed to the F-34 builder, and the fallback is logged in the
feature's Build log.

**D6. Feed card: the existing count line under the strip (round 2 B1, round 3 engineer 1-3).** Decision (b) is applied
as written: one qualifier and one count line per card. `TradeCard` (`app/ui.tsx:87`) gets one optional prop,
`optionsLine?: string`. Only `feed-rows.tsx` sets it, from `page.options`, and only when
`v.line && !isOptionsLine(v.line)`: the card carries the gated count text, never option figures. Once the gate opens,
the card has no count line. Its words are `v.line`, the existing `OPTIONS.gated(...)` text (no new copy).

The line renders under the record strip as `<p className="muted small card-options-count" data-options="card-count">`,
with its own class. It does not use `.options-gated` or the `.pane-options` wrapper, so the strict locators at
`e2e/options.spec.ts:50-52` still match one element and no pane CSS reaches it. One additive CSS rule:
`.card-options-count { margin: 4px 0 0; }`, using token colours through `.muted` only.

**Stop condition.** The build re-runs these, unchanged:
- `e2e/fixes-labels.spec.ts:119` (F3 line in plain view at 360x740 and 320x740)
- `e2e/fixes-labels.spec.ts:167` (feed card and open pane F3 in view)
- `e2e/record-strip.spec.ts:84` (F-10 AC8 reflow at 320 and 360)
- `e2e/record-strip.spec.ts:125` (first card's return and whole strip on the first screen, 360x640)
- `e2e/f13-first-visit.spec.ts:116` (F-13 hint in view on the card)
- `e2e/f10-followups.spec.ts:148` (320 px containment)

It also adds a new F-29 case on `yolo_yuki`'s card at 360x740 and 320x740. The card's `.disclaimer`,
`[data-role=options]` and `.card-options-count` must each have a bounding box inside the viewport (top >= 0,
bottom <= height), with no horizontal scroll. If any fails, the build stops, nothing ships, and the builder adds the
Open question to the feature file for the owner or council ("the card's count line pushes the F3 line or the strip
off the first screen: drop the card's count line, or shorten it?"). No ship-then-sign.

**D7. No copy for "not asked" or "declined".** F-29 adds none. A source scan guards it (AC 5).

**D8. Sign-off record (round 2, B2).** The words were signed at cycle 5 and need no re-sign; F-29 uses them exactly.
With B1 adopted, every placement follows the signed placement (decision (b) as written, and the existing qualifier
and count line), so no placement re-sign is needed. The build adds `docs/features/logs/F-29/legal-signoff.md`, quoting
the words and the cycle-5 ballot reference, and links it in the PR's `## Compliance`. If any placement change ever
needs a re-sign (for example after a B1 stop), the file gets a `Pending re-sign:` line, and the AC 7 test fails while
that line exists without a matching `Signed:` line.

**D9. Rollout.** For viewers, three things change: the /how sentence, the pane qualifier moving below the figures, and the count line on a feed card that shows options (D6).
No migration, no flag. Gate states: closed is today. Open is reachable only by changing `PUBLIC_FIELDS` (owner, OD 2.63
consent version), and the D2 and D3 behaviour switches with it.

**States.** Signed out and signed in are the same; the trader with no options gets no qualifier, count line or g-cache
change in content. Demo (`yolo_yuki`) keeps the Demo badge, qualifier and count line. Losses-only and new records are
unaffected (no figures change). An importing record has no pane (404, unchanged). A public filer stays `no-store`.

## Test plan
New unit file: `lib/f29-gated-wording.test.ts` (node:test). New e2e file: `e2e/f29-gated-wording.spec.ts`, which mounts
components the way `options.spec.ts` does, in light and dark, and runs real-app checks against the seed.

| AC | Test | Assertion |
|---|---|---|
| 1 /how both states | e2e mount `HowOptionsParagraph` `{open:false}` and `{open:true}`; unit source check of `app/how/page.tsx` | closed: no `/consented/i`; open: text `=== OPTIONS.how`. The page renders `<HowOptionsParagraph open={optionsPublic()}` and no longer `{OPTIONS.how}`. Real app: the `/how` HTML has no "consented" |
| 2 one qualifier per card/pane, position | e2e real feed (row of `yolo_yuki`) and profile; e2e mount of `ProfilePane` with and without open positions | Scope (E5): the card is the `.row`'s TradeCard subtree with `.pane` removed from the count; the pane is `.pane` with `figcaption` removed from the count. Per card: `/Excluding options/g` matches 1 and the match is the strip's `[data-role=options]`, inside the same strip element as `[data-role=average]` or `[data-role=early]`, after it in DOM order. Per pane (figcaption removed from the count): exactly 1, `.share-label` whose previous element is the headline `section.stats` (contains "win rate"), or `.open-stats`/`.open-combined` that follows it. Vertical gap from the figures to the label is ≤ 17 px. Exactly 1 `.options-gated` per pane, and exactly 1 `.card-options-count` per card (none of the card's `.options-gated` or `.pane-options`), whose previous element is the card's record strip. Unit (`lib/f29-gated-wording.test.ts`): the feed-rows selector (a pure `cardOptionsLine(v)` helper) returns the gated text for `paneView({gate:'closed', counts})` and `undefined` for `paneView({gate:'open', ...})` (an options line), for a zero-count record and for `undefined`. A source check confirms `.pane-options`/`.pane` CSS selectors do not match `.card-options-count`. Profile: `.share-label` next element is the headline stats. Never 0 where `section.stats` with "win rate" exists and `options.label` is true |
| 2 not in caption/foot/title | same e2e | The kept qualifier has no `figcaption`, `footer`, `[aria-hidden=true]` or `title` ancestor; computed color equals `--muted`; font-size is below body; it has no warn class |
| 3 shares/alt/F4-4/F4-5 unchanged | existing `record-card.options.test.ts`, `fixes-cycle4-part2*.test.ts`, `f4-options-unfurl.spec.ts`, `options.spec.ts:378` stay green; new unit test | Unit: `recordStrip(..., 'figures')` with `monthExcludingOptions` still ends in `OPTIONS.shareLabel`, and `cardAlt` for an options record still contains `OPTIONS.altQualifier` (re-asserts, no edits to old tests) |
| 4 announced with headline | e2e a11y in the real app (profile and swiped-open pane), with `locator.ariaSnapshot()` (Playwright 1.64.1; E4) | Profile: in `main`'s snapshot, the entry for "Excluding options" comes right before the headline stats entries ("win rate", average). Pane: the figures block is the headline `section.stats`, then `.open-stats`, then `.open-combined` when present. In the `.pane` snapshot, "Excluding options" is the first entry after the last entry of that block, with nothing between. Card: in the strip's snapshot it comes after the average |
| 5 no "not asked"/"declined" | unit | `allCopy()` (including `F29`) has no `/\bnot asked\b\|\bdeclined\b/i` in any string. The e2e text of `/`, `/u/yolo_yuki`, `/how`, the pane JSON, the month page and the trade page has neither phrase |
| 6 no pre-flip body after flip | unit | `gateKey()` is `'o0'`; `gateKey(OPEN_FIELDS)` is `'o1'` (`OPEN_FIELDS` = `PUBLIC_FIELDS` plus a field naming every `OPTION_PUBLIC_COLUMNS`). `withGate` URLs differ across states for pane, story and all three OG URLs. A source scan shows `paneSrc`, `share-card.tsx`, `share-prompt.tsx` and the three `generateMetadata` URLs use `withGate`. `gateCacheControl('o0', X)` is `X`; `gateCacheControl('o0', X, OPEN_FIELDS)`, `gateCacheControl(null, X)` and `gateCacheControl('zz', X)` are `'no-store'`. The pane and story route sources contain `isFilerHandle(handle) ? 'no-store' : gateCacheControl(`, after the 404 checks. Bundling (E1): no file starting with `'use client'` imports `options-gate.ts`, `consent-versions.ts` or `node:crypto`, and `lib/gate-key.ts` imports only `./privacy-fields.ts`. Static /how (E6): `app/how/page.tsx` exports no `revalidate` or `dynamic` and imports none of `cookies`, `headers`, `searchParams` or `connection` |
| 6 real routes | e2e request | `/u/yolo_yuki/pane?v=2&g=o0` is `public, max-age=60`; `?v=2&g=o1`, `?v=2` and `?v=2&g=x` are `no-store` with 200; `?g=o0` without v is still 404 (F-23). `/story?format=square&g=o1` is `no-store`. The profile HTML cache-control has no `public` |
| 7 sign-off in PR | unit | `legal-signoff.md` exists and contains `F29.howInterim` verbatim; the feature file contains it after whitespace is normalised (its quote wraps lines). The test fails if the file has a `Pending re-sign:` line without a matching `Signed:` line (B2). The reviewer checks the PR body |
| 8 words verbatim on /how (closed) | unit and e2e | `F29.howInterim ===` the signed string (literal in the test). Real app: `#options + p` text `=== F29.howInterim` |
| 9 flip in one process, bodies differ | e2e mount (one process) | With the closed and open states from `optionsPublic(PUBLIC_FIELDS)` and `optionsPublic(OPEN_FIELDS)`: `HowOptionsParagraph` markup differs, and `ProfilePane` with `paneView({gate})` of one record differs (count line or options line, foot note). **Share part: not applicable by design (B3, E7).** The share image and its alt carry the qualifier in both states, because the headline excludes options either way, so a pre-flip and a post-flip share body are rightly identical. It is covered by the URL key only: the AC 6 tests show the URLs differ and are never cached across a flip. The PR leaves this box unticked, asks the business lead to accept it, and routes the AC wording back to the design session ("share URLs differ" instead of "share bodies differ") |
| D6 stop: card first screen | re-run the six tests named in D6, plus a new e2e in `e2e/f29-gated-wording.spec.ts` (real feed, `yolo_yuki`, 360x740 and 320x740) | `.disclaimer`, `[data-role=options]` and `.card-options-count` of that card are each inside the viewport, with no horizontal scroll |
| 10 360/320 with F-21/F-34 lines | e2e mount of `ProfilePane` (fictional record: open positions, combined line, options label and count line, demo off) at 360x740 and 320x740 | The headline stats and `.disclaimer` sit inside the viewport when the pane opens; at 320 there is no horizontal scroll and every line wraps (no clipped text). The F-21 and F-34 lines are added under the ponytail when they are built; the test title says "(F-21/F-34 lines pending)" |

All existing tests stay unchanged and green (the test count only grows). No "‹"/"›" in titles.

## Compliance (Section 1)
1. Yes, it labels performance: the qualifier stays with the headline, the disclaimer stays in view (AC 10), and no
   advice words are added. 2. No new data; counts only, as today. 3-7. No. 8. Yes: reading order is tested (AC 4), with
   muted contrast through the existing token and no new colours. 9. Yes, public endpoints change cache headers only to
   `no-store`, which is stricter. 10. Yes, a claim: the interim words are legal-signed and used exactly (LC). 11. No.
No new dependency, vendor or token. Protected files are untouched.

## Risks
- **The words drift.** Any edit to `F29.howInterim` needs the committee's re-sign. The test literal and the
  sign-off-file check catch drift.
- **D5 moves a shared line in `app/pane.tsx`.** F-6 first-screen e2e tests (`f6-open-positions.spec.ts`,
  `fixes-labels.spec.ts`) must stay green, because with open positions the qualifier and count line now sit after the
  grids, before the F3 line. Measure at 360x740 first. If the disclaimer leaves view, the fallback is to keep the
  label above the stats and hand the move to the F-34 builder (log it).
- **D6 adds a line to the feed card's first screen.** If the F-10 check fails, the build stops and the question goes
  to the owner or council (no ship-then-sign).
- **CDN window (E6).** Pages opened before a flip still reference `g=o0` URLs. Shared caches can serve those
  stale copies for up to 60 s (pane) and 300 s (story) after the flip, but only to those pre-flip pages, which show
  the pre-flip state anyway. Pages rendered after the flip reference only `g=o1`, and a stale `g` is never stored
  again (`no-store`).
- **Share images do not differ by gate.** AC 9's share part is not applicable by design (see the test table) and stays
  unticked until the business lead accepts it or the design session rewords it.
- **Next caching of opengraph-image routes** (docs: cached by default unless they use request-time APIs or uncached
  data). The builder checks the `npm run build` route table and the response header. A flip is always a deploy, which
  drops that cache, and the `g` URL covers external caches.
- **`allCopy()` now includes `F29`.** If any banned-word scan trips on "at present"/"headline", that is a copy issue
  for the committee, not a reason to drop it from the scan.

## Owner-only
- Q3 (trader-only "not asked yet" view) and the gate-opening checklist line: still open, not built.
- The amended consent scope line, a new consent version (OD 2.63): this is what flips `optionsPublic()`. F-29 only
  makes that flip safe.

## § Round 2 answers
- **B1 adopted.** D6 now follows decision (b) as written: the card gets the existing count line under its strip. The
  F-10 first-screen e2e is the stop condition, and if it fails the question goes to the owner or council in the feature
  file. No ship-then-sign.
- **B2 adopted.** D8 now says the words are signed (cycle 5) and only a placement change needs a re-sign. With B1 none
  does. The AC 7 test fails on any `Pending re-sign:` line that has no matching `Signed:` line.
- **B3 adopted.** AC 9's share part is marked not applicable by design, with the reason, left unticked, and its wording
  routed to the design session.
- **B4 adopted.** D5's stop is a named e2e: at 360x740 with open positions, `.disclaimer`'s bounding box is inside the
  viewport, or the build falls back.
- **E1 adopted (checked).** The three files are `'use client'`, and `consent-versions.ts:6` imports `node:crypto`. The
  helpers move to a new `lib/gate-key.ts` whose only import is `privacy-fields.ts` (which has no imports). A unit test
  checks that no client file imports `options-gate.ts` or `consent-versions.ts`.
- **E2 adopted.** The pin is at `pane-model.test.ts:71` (line 73 is `PAYLOAD_V === 2`). D3 keeps the template literal
  inside `withGate(...)`.
- **E3 adopted.** The filer check comes first, after all 404 checks. D3 also keeps the `pane-model.test.ts:70` prefix.
- **E4 adopted.** Playwright is 1.64.1, so the test uses `ariaSnapshot()`, as `f23-payload-scan.spec.ts:379` does. The
  pane's figures block is defined in the AC 4 row.
- **E5 adopted.** The card and pane scopes are set in the AC 2 row.
- **E6 adopted.** The CDN window is stated in Risks, and a source check covers static /how.
- **E7 adopted.** Merged with B3.

## § Round 3 answers
- **Engineer 1 adopted.** The card line renders only when `v.line && !isOptionsLine(v.line)`, through a pure
  `cardOptionsLine(v)`. A unit test covers both gate states, zero counts and an absent view.
- **Engineer 2 adopted.** The card line has its own class, `card-options-count`, with no `.options-gated` and no
  `.pane-options` wrapper, so the strict locators at `e2e/options.spec.ts:50-52` stay single-match. A source check
  confirms the pane CSS does not reach it.
- **Engineer 3 adopted.** D6 names the first-screen tests it re-runs: `fixes-labels.spec.ts:119`, `:167`;
  `record-strip.spec.ts:84`, `:125`; `f13-first-visit.spec.ts:116`; `f10-followups.spec.ts:148`. A new check keeps the
  strip qualifier, the card count line and the disclaimer in view at 360x740 and 320x740.
