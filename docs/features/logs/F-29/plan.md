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

**D3. Gate key for URL-keyed caches.** Additive in `lib/options-gate.ts`:
- `gateKey(fields = PUBLIC_FIELDS): 'o0' | 'o1'`
- `withGate(url, fields?)` appends `g=<key>` with `?` or `&`
- `gateCacheControl(g: string | null, cacheable: string, fields?)` returns `cacheable` when `g === gateKey(fields)`,
  else `'no-store'`.

`withGate` is applied to `paneSrc` (`app/lazy-pane.tsx:17`, giving `?v=2&g=o0`), the two story URLs
(`share-card.tsx:16`, `share-prompt.tsx:50`) and the three opengraph-image URLs (profile, month, trade).

The `/pane` and `/story` routes keep their existing checks and replace the public header with
`gateCacheControl(q.get('g'), <today's value>)`. Filer handles stay `no-store`, the F-23 `v` 404 runs first, and a
missing or stale `g` gets the current body with `no-store`, not a 404, so a page open since before the flip still
works. The opengraph-image file routes receive only `params`, so for them the new URL is the cache bust and the body is
always computed live. `/pane-chart` and `/home-card` are left alone because their bodies do not depend on the gate (the
chart caption is drawn from the pane JSON's `options.label`).

Why: after a flip, pages only reference URLs no cache saw before the flip. A deploy already clears Next's own caches,
so the key covers CDN, browser and unfurl caches. Every edit is additive or a single-expression swap.

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

**D6. Feed card: qualifier only, no count line (open question resolved).** Recommended reading: "one count line"
means at most one per card or pane, never repeated. The card's strip keeps its single "· Excluding options", in the
same element as the average and in reading order right after it. The count line is in the card's own pane, one swipe
away (SW-1), and on the profile.

Why:
- F-10 and F-13 hold the first screen to the strip plus the F3 line, and a second line there would push the disclaimer.
- A trader with N cards on a page would repeat the same count N times, which is the clutter F-29 removes.
- The ACs count only qualifiers.
- The signed per-surface placement names only the qualifier.

The PR asks the legal committee to confirm this reading in the same sign-off as the words (decision 2 has them sign
the per-surface placement). If they refuse, the fallback is the existing `PaneOptions` line under the strip, with the
F-10 first-screen e2e re-run.

**D7. No copy for "not asked" or "declined".** F-29 adds none. A source scan guards it (AC 5).

**D8. Sign-off record.** The build adds `docs/features/logs/F-29/legal-signoff.md`. It quotes the words, the cycle-5
ballot reference and D6's placement reading, and the PR body links it under `## Compliance`. The words, placement and
reading wait on the committee's re-sign: they are not cleared until it is in the PR.

**D9. Rollout.** Nothing changes for any viewer except the /how sentence and a slightly lower qualifier in the pane.
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
| 2 one qualifier per card/pane, position | e2e real feed (row of `yolo_yuki`) and profile; e2e mount of `ProfilePane` with and without open positions | Per card: `/Excluding options/g` matches 1 and the match is the strip's `[data-role=options]`, inside the same strip element as `[data-role=average]` or `[data-role=early]`, after it in DOM order. Per pane (figcaption removed from the count): exactly 1, `.share-label` whose previous element is the headline `section.stats` (contains "win rate"), or `.open-stats`/`.open-combined` that follows it. Vertical gap from the figures to the label is ≤ 17 px. Exactly 1 `.options-gated` per pane. Profile: `.share-label` next element is the headline stats. Never 0 where `section.stats` with "win rate" exists and `options.label` is true |
| 2 not in caption/foot/title | same e2e | The kept qualifier has no `figcaption`, `footer`, `[aria-hidden=true]` or `title` ancestor; computed color equals `--muted`; font-size is below body; it has no warn class |
| 3 shares/alt/F4-4/F4-5 unchanged | existing `record-card.options.test.ts`, `fixes-cycle4-part2*.test.ts`, `f4-options-unfurl.spec.ts`, `options.spec.ts:378` stay green; new unit test | Unit: `recordStrip(..., 'figures')` with `monthExcludingOptions` still ends in `OPTIONS.shareLabel`, and `cardAlt` for an options record still contains `OPTIONS.altQualifier` (re-asserts, no edits to old tests) |
| 4 announced with headline | e2e a11y in the real app (profile and swiped-open pane) | `page.accessibility.snapshot()` (or the aria snapshot) lists the "win rate"/average nodes and "Excluding options" consecutively, with no other text node between them. Profile: the label comes right before; pane: right after the figures block |
| 5 no "not asked"/"declined" | unit | `allCopy()` (including `F29`) has no `/\bnot asked\b\|\bdeclined\b/i` in any string. The e2e text of `/`, `/u/yolo_yuki`, `/how`, the pane JSON, the month page and the trade page has neither phrase |
| 6 no pre-flip body after flip | unit | `gateKey()` is `'o0'`; `gateKey(OPEN_FIELDS)` is `'o1'` (`OPEN_FIELDS` = `PUBLIC_FIELDS` plus a field naming every `OPTION_PUBLIC_COLUMNS`). `withGate` URLs differ across states for pane, story and all three OG URLs. A source scan shows `paneSrc`, `share-card.tsx`, `share-prompt.tsx` and the three `generateMetadata` URLs use `withGate`. `gateCacheControl('o0', X)` is `X`; `gateCacheControl('o0', X, OPEN_FIELDS)`, `gateCacheControl(null, X)` and `gateCacheControl('zz', X)` are `'no-store'`. The pane and story route sources call `gateCacheControl` |
| 6 real routes | e2e request | `/u/yolo_yuki/pane?v=2&g=o0` is `public, max-age=60`; `?v=2&g=o1`, `?v=2` and `?v=2&g=x` are `no-store` with 200; `?g=o0` without v is still 404 (F-23). `/story?format=square&g=o1` is `no-store`. The profile HTML cache-control has no `public` |
| 7 sign-off in PR | unit | `legal-signoff.md` exists and contains `F29.howInterim` verbatim; the feature file contains it after whitespace is normalised (its quote wraps lines). The PR body check is done by the reviewer |
| 8 words verbatim on /how (closed) | unit and e2e | `F29.howInterim ===` the signed string (literal in the test). Real app: `#options + p` text `=== F29.howInterim` |
| 9 flip in one process, bodies differ | e2e mount (one process) | With the closed and open states from `optionsPublic(PUBLIC_FIELDS)`/`optionsPublic(OPEN_FIELDS)`: `HowOptionsParagraph` markup differs; `ProfilePane` with `paneView({gate})` of one record differs (count line or options line, foot note); the share URLs differ by `g`. Share pixels do not depend on the gate (the qualifier stays either way), so for share the assertion is on the key and on the live render, not a pixel diff (see Risks) |
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
- **D6 is a reading of decision (b).** If the committee rejects it, the card gets a count line and the F-10 first
  screen must be re-proved.
- **Share images do not differ by gate.** AC 9's "share bodies differ" is met through the URL key and the live render.
  If the business lead wants a body difference, that would need new share copy, which is out of scope (words signed).
- **Next caching of opengraph-image routes** (docs: cached by default unless they use request-time APIs or uncached
  data). The builder checks the `npm run build` route table and the response header. A flip is always a deploy, which
  drops that cache, and the `g` URL covers external caches.
- **`allCopy()` now includes `F29`.** If any banned-word scan trips on "at present"/"headline", that is a copy issue
  for the committee, not a reason to drop it from the scan.

## Owner-only
- Q3 (trader-only "not asked yet" view) and the gate-opening checklist line: still open, not built.
- The amended consent scope line, a new consent version (OD 2.63): this is what flips `optionsPublic()`. F-29 only
  makes that flip safe.
