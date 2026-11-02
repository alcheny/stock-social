# Fixes cycle 5, part 2: implementation plan, round 1 (UX lead)

Scope: the five items approval council 5 (#103) routed to the fixes lane (`docs/ideas/approval-2026-11-01-cycle5.md`
→ "Fixes lane", :283-293): MK-P6, C5-41, C5-34, C5-4's zero-width split and C5-5's strip wording. Built as a second PR
on `claude/fixes-cycle5` **after part 1 lands on the branch**. Part 1 owns `app/u/[handle]/page.tsx`,
`app/record-strip.tsx`, `app/pane.tsx`, `app/ui.tsx` and the `FC5` object. Part 2 adds no copy to `FC5` and does not
edit `allCopy()`. The one line part 2 needs in `page.tsx` (C5-34) is applied on top of part 1.

Binding input: the legal committee's findings of 2026-11-02 (`docs/features/logs/fixes-cycle5/legal-committee-2026-11-02.md`
§3, conditions C1-C16). They replace two council wordings: MK-P6's fragment becomes a full sentence, and C5-5 keeps
"per closed trade". Each condition is mapped to a test below.

Line numbers were read on a281ff04. Part 1 shifts some of them, so the builder re-reads each line before editing it.
Every edit is marked `FIXES-CYCLE5 part 2`.

A throwaway probe of this design was run outside the repo (an archive copy of `lib/`, `app/` and `scripts/`, with the
baseline run beside it). Every test-edit row in section 3 comes from that diff, not from a grep guess.

## 0. Open points decided (the committee's recommended option)

| # | Point | Decision | Why |
|---|---|---|---|
| D1 | C5-5 wording: "per closed trade" (council) or "average per closed trade" (legal finding's prose) | **Visible strip: "‹avg› per closed trade". Strip alt: "average per closed trade ‹avg›"** (`SHARE_CARD.perClosedTrade`) | The probe showed that "−1.5% average per closed trade" (30 glyphs) overflows the 582 px image band at 35 px (`lib/record-strip.ts:153`, :209). Shrinking it breaks F-12 AC3's pin "count, average, early at recordPx" (`lib/f12-strip.test.ts:198`, `lib/record-strip.test.ts:211`). Giving the label its own line breaks the band height (AC16, `lib/fixes-labels-month.test.ts:101`). "per closed trade" fits at 35 px in every worst case (−100.0%, +12345.0%). It is the council's literal wording, and it passes LC C14's test ("per closed trade" present, no bare "average per trade"). The alt has no width limit, so it keeps LC's full words. **LC re-sign of the shorter visible form, in the PR (section 6)** |
| D2 | "Zero-width" | Both ends print the same text through `pct()` (one decimal) | LC C9 |
| D3 | Where the card says "Too early to tell" | In its trust line ("Based on ‹n› trades. Too early to tell."); the range line is absent, as under 5 bets | No image layout change. The card still prints the words (LC C12) and its alt carries the trust line |
| D4 | Profile range slot | Stays empty; the evidence line says "Too early to tell (‹k› bets)" | PR-2b rule "said once" (`app/u/[handle]/page.tsx:339`); `e2e/connect.spec.ts:1167` counts one |
| D5 | Pane | `rangeLine` becomes "Too early to tell" for a zero-width record (today: empty) | "Never a blank range" (LC C12). Under 5 bets the pane stays as today; that is F-33's |
| D6 | Ranking | Untouched: `confidence()`, `confidenceFromSums`, `evidenceWeight` and `lib/feed.ts` are not edited | LC C13. Probe: ten +1% trades weigh 0.299 and ten −1% trades 0.302, before and after |
| D7 | C5-34 preview size | `width: 100%; max-width: 343px; aspect-ratio: 1 / 1` | 343 px is F-4 AC9's tested readable size (`e2e/share-card.spec.ts:102`) |
| D8 | Record tools pitch with billing on | Unchanged: `RECORD_TOOLS.what` still shows only while checkout is closed (`app/tools/page.tsx:73`). `BILLING.whatYouGet` keeps the mechanics | The item changes words only. Showing the pitch beside checkout is a placement decision, not in scope |

## 1. Items

### 1.1 MK-P6: the /how history sentence (with F5-6)

**Copy** (LC 3a, verbatim). One new item in `HOW.excluded` (`lib/copy.ts:402-419`), placed right after "Transfers in,
and sells with no recorded entry…" (`:408`), as LC C1 requires:
> Trades from before the earliest date the trader's broker provides: they are not imported, so a record can start later
> than the trader's first trade, and a sell of shares bought before that date is excluded and counted as a sell with no
> recorded entry.

**Behaviour.** /how prints it in "What is excluded, and counted". Nothing else changes: no figure, no profile line (the
vendor exposes no earliest-history field, `lib/broker.ts:89-94`). F5-6 (part 1) keeps the shared root "broker
provides" in the connect line.

**AC → `lib/fixes-cycle5-part2-copy.test.ts`:**
- `HOW.excluded[i + 1]` equals the sentence, where `i` is the index of the "Transfers in" item (C1).
- The sentence names no broker or vendor and states no length: it fails `/\d+\s*(day|month|year)s?/`, and it passes
  `scripts/compliance.ts`'s name list (C2).
- It does not match `/every trade|any broker|full history|complete/i`.

**AC → `e2e/fixes-cycle5-part2.spec.ts`:** signed out, /how shows the sentence inside the list that follows the "What is
excluded, and counted" heading.

**Record (C3).** One dated line in `docs/COMPLIANCE.md` §12 under the /how history bullet (`:177`): "2026-11-0x: /how
names trades from before the earliest date the trader's broker provides (excluded; such sells counted as having no
recorded entry)." The file is not protected.

**Old-wording tests.** None break. `lib/copy.test.ts:57`, `:299`, `lib/options-fix3.test.ts:39-40` and
`lib/fixes-cycle3.test.ts:30` use `join`/`includes`/`find`, never an index.

### 1.2 C5-41: the Record tools pitch

**Copy**, `RECORD_TOOLS.what` (`lib/copy.ts:841`), replaced whole (LC C4):
> Compare whole public records side by side: closed trades imported from connected accounts, losses and ranges
> included. Traders can't remove single trades.

**AC → `lib/fixes-cycle5-part2-copy.test.ts`:**
- `RECORD_TOOLS.what` equals the string exactly.
- Every other `RECORD_TOOLS` string fails `/\bwhole\b/` (C4).
- `RECORD_TOOLS` and `BILLING` fail `/every trade|all trades|nothing hidden|\bever\b|permanent|forever/i` (C4, C6).
- Source scan (C5): no file under `app/` holds `delete from closed_trades` or `update closed_trades`. The `lib/` deletes
  are system rebuilds only, an allow-list of exact files and lines: `lib/sync.ts:99`, `lib/public-trades.ts:123`,
  `lib/options-sync.ts:146`, `:235`. No trader-facing server action imports them except whole-profile deletion.

**AC → `lib/fixes-cycle5-part2-legal.db.test.ts` (C5):** a disconnected connection, through the path record-status
reads as frozen, leaves that user's `closed_trades` count unchanged after `syncUser`. The builder cites the existing
test instead if one already asserts exactly this.

**AC → e2e (C7):** signed out, `/tools` shows the pitch, the F3 disclaimer and the /how link. A Record tools card for
the zero-width fixture (1.4) prints "Too early to tell" in its evidence row and no "Past results:". A short record's
card keeps today's evidence row, never a blank. The range row is omitted, not blank (`app/tools/page.tsx:259`).

**Old-wording tests.** None pin the old string (grep: only `app/tools/page.tsx:73` reads it).

### 1.3 C5-34: the owner's preview is the image the Share button attaches

**One producer.** New `lib/share-image.ts`: `export const shareImagePath = (handle: string) => `/u/${handle}/story?format=square``.
It is byte-identical to today's literal, so `shareVia` still reads it as 'story' (`lib/f15-share.test.ts:10`).

**One component.** New `app/u/[handle]/share-preview.tsx` (client), `SharePreview({ handle, alt, lazy })`:
- `<img className="preview" src={shareImagePath(handle)} width={1080} height={1080} alt={alt}>`;
- `loading={lazy ? 'lazy' : 'eager'}` and `decoding="async"`;
- `onError` → "Preview unavailable. Your link still works." (today's words, moved from `share-prompt.tsx:35`).

**Call sites:**
- `share-prompt.tsx:34-40` → `<SharePreview handle={handle} alt={previewAlt} lazy={false} />`; `:50`
  `image={shareImagePath(handle)}`.
- `share-card.tsx`: new prop `previewAlt: string`; `<SharePreview … lazy />` between the "Percentages only…" line and
  `.actions`; `:16` `image={shareImagePath(handle)}`.
- `app/u/[handle]/page.tsx:223` (after part 1): the card loads as `'square'` (the image shown), under
  `isMe && !claimed && shareable && (sharePromptShowing || trades.length > 0)`. The two boxes never show together, so
  one model serves both. Its reads are the request-cached profile reads (`load.ts:38`, `reads = profileReads(cache)`),
  so it adds no query. `:249` is unchanged. `:257` passes
  `previewAlt={promptCard ? `Preview of your share card. ${cardAlt(promptCard)}` : ''}` on the existing line.
- `app/globals.css:196`: `.share-prompt .preview { width: 100%; max-width: 343px; height: auto; aspect-ratio: 1 / 1; … }`
  (border and radius kept). `.share-card` carries `.share-prompt`, so one rule covers both.

**States.** Signed out or another trader's profile: neither box renders, so there is no `<img>` and no request.
Importing or failed: the prompt is hidden, as today. Zero trades: the Share box is hidden, as today; the prompt shows
the empty card. Demo: same rules. The image fails: the fallback line shows and the Share button keeps working.

**AC → `lib/fixes-cycle5-part2-share.test.ts` (source):**
- `share-card.tsx` and `share-prompt.tsx` hold no `story?format=` and no `opengraph-image`.
- Each calls `shareImagePath(handle)` exactly twice: once for the button, once through `SharePreview` (by prop).
- `share-preview.tsx` is the only `<img className="preview"` in `app/`.
- The F-15 pins (`lib/f15-share-action.test.ts:66-68`) still pass unchanged.

**AC → `e2e/fixes-cycle5-part2.spec.ts`:**
- *Owner, Share box (the prompt was seen):* inside the region "Share your record", the `img` has the `src`
  `/u/<h>/story?format=square`, `loading="lazy"`, width and height 1080, and an alt that starts "Preview of your share
  card." and contains the card's label. With `navigator.canShare`/`share` stubbed by `addInitScript`, the URL the Share
  button prefetches equals the img's `src` (`page.on('request')`).
- *Owner, post-connect prompt* (`share_prompt_seen_at = null`, as `e2e/a11y-fixes.spec.ts:39`): the `img` has the same
  `src`, `loading="eager"`, and the same request equality.
- *Signed out:* no `img.preview` on the profile, and no request to `/story` during the load.
- *First paint:* the img has width/height attributes. Before the img is scrolled into view, the Share box's height is
  the same as after it loads (no layout shift).
- *360 px and 320 px:* the preview is at most 343 px wide, inside its box, with no horizontal page scroll. Tabbing
  reaches "Share my record" with focus visible, and the img is not focusable.
- *Fallback:* with `/story` routed to a 500, the box shows "Preview unavailable. Your link still works." and the button
  stays enabled.

**Old-wording tests.** None pin the prompt's `opengraph-image` src (grep).

### 1.4 C5-4: a zero-width range prints "Too early to tell" and drops the verdict

**One helper.** New `lib/zero-width.ts` (imports `pct` from `format.ts`, `MIN_BETS` from `confidence.ts`,
`RECORD_STRIP` from `copy.ts`, and types only from `trades.ts`; none of them imports `trades.ts`, so there is no cycle):
```ts
export const zeroWidth = (iv: { low: number; high: number } | null | undefined): boolean => !!iv && pct(iv.low) === pct(iv.high);
// Display only (LC C13): never called by ranking. Idempotent.
export function shownEvidence<C extends Pick<Confidence, 'perTrade' | 'edge' | 'tier'>>(c: C): C & { zeroWidth?: true } {
  return zeroWidth(c.perTrade) ? { ...c, perTrade: null, edge: null, tier: 'too-early', zeroWidth: true } : c;
}
export const earlyText = (k: number) => (k < MIN_BETS ? `${RECORD_STRIP.early} (${k} of ${MIN_BETS} bets)` : RECORD_STRIP.early);
```

**One-line call sites** (every surface that prints a range or a verdict, LC C11):

| Surface | Path | Edit |
|---|---|---|
| Profile card, square, story, unfurl images and their alt; profile evidence and range; strips (feed card, trade, month, their images and previews); pane; display log | `lib/record-card.ts#cardEvidence` (`:219`) | `return shownEvidence({ … })` |
| /t, /t/compare, Record tools, month recap lines, trade share payload, /t baselines | `lib/trades.ts#evidenceLine` (`:590`), `#rangeText` (`:601`) | first statement `const c = shownEvidence(c0)`; `rangeText` reads `shownEvidence(c).perTrade` |
| Evidence line after the flattening (k ≥ 5, no range) | `lib/trades.ts:592` | new first branch inside the too-early block: `if (!c.perTrade && c.k >= MIN_BETS) return `${RECORD_STRIP.early} (${plural(c.k, 'bet')}${grouped ? ` from ${counted(c.n, 'trade')}` : ''})`` (today such a record would print "(10 of 5 bets)") |
| Card trust line | `lib/confidence.ts:82` | before the "too wide" line: `if (c.tier === 'too-early' && !c.perTrade) return `Based on ${counted(c.n, 'trade')}. Too early to tell.`` |
| Pane | `lib/pane-evidence.ts:16-17` | keep the card evidence `ev`; `rangeLine: range ? … : ev.zeroWidth ? RECORD_STRIP.early : null` |
| Record tools low end | `lib/record-tools.ts:229` | `low: shownEvidence(c).perTrade ? …` |
| /t meta description | `lib/ticker.ts:392` | `const t = shownEvidence(s.conf!).tier` |
| /t range fallbacks | `app/t/[symbol]/page.tsx:128`, `HoldTime.tsx:31`, `Concentration.tsx:30`, `app/t/compare/page.tsx:85` | the literal `Too early to tell (${…k} of ${MIN_BETS} bets)` → `earlyText(…k)` |

**Results (probe, 10 trades of +1.0%, −1.0%, and 1.00/1.01/0.99%; all three identical):**
- /t and profile evidence: "Too early to tell (10 bets)"; range: none.
- Card: no range; trust "Based on 10 trades. Too early to tell."; "Evidence: too early".
- Strip: "10 closed trades · Too early to tell · losses included".
- Weight: 0.299 / 0.302 / 0.297, unchanged.

**AC → `lib/fixes-cycle5-part2-range.test.ts`:**
- *C9:* `zeroWidth` is true for the three fixtures above and false for ±0.05 points around 1% that print "+0.9% to
  +1.1%".
- *C10:* the gain and loss fixtures give string-identical outputs once the sign is masked, on every surface below.
- *C11, every output for the zero-width fixtures:*
  - surfaces: `recordCard` for all four kinds and `cardAlt`, `cardDescription`, `recordStrip` on every surface (text
    and alt), `stripImageLines`, `paneEvidence`, `evidenceLine(cardEvidence)`, `evidenceLine(confidence)`,
    `compareEvidenceText`, `tickerDescription`, `baselineLines`, the recap and trade-share payloads, the
    `display-log` snapshot and the pane JSON (F-23 wire);
  - each contains "Too early to tell" where it printed a range or verdict, and none contains "Past results:",
    "above zero", "below zero" or "unclear".
- *C12:* no output holds an empty range: no `()`, no "to " without numbers, no ` · 95% range` without a range before
  it. The F3 disclaimer is unchanged on each.
- *C13:* `evidenceWeight(confidence(fixture))` equals 0.299 / 0.302 to three decimals, and `lib/feed.ts`, `lib/discovery/`
  and `confidenceFromSums` are byte-unchanged in the diff (a `git diff --stat` check in the PR body).
- A non-zero-width record (`R.winning`) gives byte-identical outputs before and after (a snapshot of the same list).

**AC → `e2e/fixes-cycle5-part2.spec.ts`:** two fictional traders, seeded by SQL as `e2e/a11y-fixes.spec.ts:38` does,
with fictional handles and the tickers `ZWGN` and `ZWLS`: ten non-overlapping closes of +1.0% and of −1.0%. The test
takes its own lock key (`e2e/feed-lock.ts` convention). For each trader:
- the profile shows "Too early to tell" once and no "Past results:";
- the pane JSON `rangeLine` is "Too early to tell";
- the trade page and the month page strips show "Too early to tell", and their `og:description` has no verdict;
- `/t/ZWGN` and `/t/compare?a=ZWGN&b=ZWLS` show "Too early to tell" in the range slot and never "of 5 bets";
- the `opengraph-image`, `story?format=square` and trade/month `opengraph-image` routes return 200 PNGs.

**F-33 hand-off.** F-33 later owns the printed range (`docs/features/F-33-ranking-weight-needs-evidence.md:32`). It
builds on `lib/zero-width.ts` instead of adding a second producer.

### 1.5 C5-5: "per closed trade" on the strips

**Copy.**
- New `RECORD_STRIP.perClosedTrade: 'per closed trade'` (`lib/copy.ts:232-236`).
- `lib/record-strip.ts:108`: `${pct(i.avg)} ${RECORD_STRIP.perClosedTrade}`.
- `:113`: `${SHARE_CARD.perClosedTrade} ${pct(i.avg)}` (alt: "average per closed trade +0.9%").
- `SHARE_CARD.perTrade` stays: the card's own label is not this item's (LC C14/C15; 2.32 below).

**Surfaces.** Everything built by `recordStrip()` follows: the feed card strip, the trade and month strips, the month
figures, their link previews (`stripTextAfterCount`) and both images. The image average line stays at 35 px (D1).

**AC → `lib/fixes-cycle5-part2-strip.test.ts`:**
- *C14:* for `R.winning`, `R.losing` and `R.under5` on every `StripSurface`, `text` matches `per closed trade` when an
  average prints. Neither `text` nor `alt` contains "average per trade". `alt` contains "average per closed trade".
- *C15:* the strip text for a record with open positions is identical to today's apart from that label: no
  unrealized value added.
- The image band for worst-case averages (−100.0%, +12345.0%, `≈-100.0%`) keeps the average at `STRIP_BAND.recordPx`,
  with `tooWide` empty.
- `lib/record-strip.guard.test.ts:19`'s list gains `RECORD_STRIP.perClosedTrade` (stronger, since no surface may spell
  it); "average per trade" stays in the list.

**C16.** The /t baselines ("95% range of the average per trade") are untouched. `lib/qa-round-2.test.ts:174` stays.

## 2. Files

New:
- `lib/zero-width.ts`, `lib/share-image.ts`, `app/u/[handle]/share-preview.tsx`;
- tests `lib/fixes-cycle5-part2-{copy,range,strip,share}.test.ts`, `lib/fixes-cycle5-part2-legal.db.test.ts` and
  `e2e/fixes-cycle5-part2.spec.ts`.

Edited:
- `lib/copy.ts`: `HOW.excluded` (+1 item), `RECORD_TOOLS.what`, `RECORD_STRIP` (+1 key);
- `lib/trades.ts` (`evidenceLine`, `rangeText`, +1 import); `lib/confidence.ts` (`trustLine`, +1 line);
  `lib/record-card.ts` (`cardEvidence` return, +1 import); `lib/record-strip.ts:108`, `:113`;
  `lib/pane-evidence.ts`; `lib/record-tools.ts:229`; `lib/ticker.ts:392`;
- `app/t/[symbol]/page.tsx:128`, `HoldTime.tsx:31`, `Concentration.tsx:30`, `app/t/compare/page.tsx:85`;
- `app/u/[handle]/share-card.tsx`, `share-prompt.tsx`, `page.tsx:223`, `:257`; `app/globals.css:196`;
- `docs/COMPLIANCE.md` §12 (+1 line); `docs/process/coordination.md` (this item's own row only).

Protected paths: none touched (`.github/CODEOWNERS`; `docs/DESIGN.md` and `docs/DECISIONS.md` are not edited).

## 3. Existing tests that change (probe-verified; all others pass unchanged)

| Test | Today | Replacement | Strength |
|---|---|---|---|
| `lib/record-strip.test.ts:39` | `/^\+0\.9% average per trade$/` | `/^\+0\.9% per closed trade$/` | equal |
| `lib/record-strip.test.ts:157` | alt "…average per trade +0.9%…" | "…average per closed trade +0.9%…" | equal |
| `lib/record-strip.test.ts:123` | `!/closed trade/.test(s.text)` ("no count part") | `!/\b\d[\d,]* closed trades?\b/.test(s.text)`; the role check at `:122` stays | equal: the guard is the count, and the label now contains "closed trade" |
| `lib/f10-feed-card.test.ts:66` | `… average per trade (…) · 95% range$` | `… per closed trade (…) · 95% range$` | equal |
| `lib/f12-strip.test.ts:100` | alt `average per trade` | alt `average per closed trade` | equal |
| `e2e/record-strip.spec.ts:69`, `:162` | visible `average per trade` | `per closed trade` | equal |
| `e2e/record-strip.spec.ts:170` | alt `average per trade` | `average per closed trade` | equal |
| `e2e/fixes-labels.spec.ts:315` | both alternatives `average per trade` | `per closed trade` | equal |
| `lib/confidence.test.ts:139` | `^Past results: .* · Evidence: thin \(13 bets from 4,731 trades, …\)$` | `assert.equal(…, 'Too early to tell (13 bets from 4,731 trades)')` | equal (exact). The fixture's 4,731 trades in one cluster print a zero-width range; the grouping explanation it pins survives. This is C9 working on a realistic scalper pattern, so the change is deliberate |
| `lib/qa-round-1.test.ts:71` | fixture `0.03 + (i % 5) / 1000` (120 bets, prints "+3.2% to +3.2%") | `/ 100`; assertions unchanged | equal: it keeps the non-too-early branch exercised |
| `lib/record-card.test.ts:214` (`spanRecord`) | wobble ±0.001 (zero-width at 40-600 bets; R1 compared drops below 9) | ±0.01; all 8 callers' assertions unchanged (probe: green) | equal |

**Unverified by the probe:** e2e and `.db` suites (no database in the probe). The builder runs them. Any further
fixture that hits zero-width is fixed the way the table does: widen the fixture, keep the assertion. Each one is added
to this table in the PR.

## 4. Overlaps (checked 2026-11-02, `git diff origin/main...origin/claude/<b>`)

| Branch | Touches | Ours | Resolution |
|---|---|---|---|
| `f16-f17-trust-safety` (#100) | `lib/copy.ts:825` (`allCopy`) and an appended block at `:1046+`; `page.tsx` hunks at `:18`, `:62`, `:107`, `:228-234`, `:272`, `:311-323`, `:419`, `:438`; `lib/display-log.ts`; `app/globals.css:856+` (append); `app/t/[symbol]/opengraph-image.tsx` | copy edits at `:174-236`, `:408`, `:841` (not `allCopy`); `page.tsx:223`, `:257`; `globals.css:196` | Not adjacent (`:223` is 5 lines before `:228`). We do not edit `display-log.ts` or the stock image |
| `f25-one-link-rule` (#102) | `app/t/[symbol]/page.tsx:21-41`, `:97-115`, `:170-183`; `page.tsx:249-255` (`NewTradesPrompt` at `:252`); `lib/ticker.ts:220`; `lib/recap.ts:7`; `copy.ts:940+`, `:953+` | `/t` page `:128`; `page.tsx:257`; `lib/ticker.ts:392` | `/t` and ticker lines are 13+ lines apart. `page.tsx:257` is one unchanged line after f25's `:255`, so the merge is clean but tight. If git conflicts, take f25's hunk and re-apply our one-line prop |
| `f34-open-positions-line` (F-34, Status building since 2026-11-02, docs only so far) | will edit `lib/record-strip.ts:119`/`:133` (open line), `SHARE_CARD.openShort`, the images and the pane | `record-strip.ts:108`, `:113` | F-34 lists our wording as out of scope (`F-34:74`). Whichever merges second rebases; `:113` is 3 lines from the alt's open-line join at `:133`, so no textual conflict |
| `f31-readout-limits`, `f23`, `f24-followup` | merged (#98, #97, #104) | — | — |
| `f35-publish-after-date`, `f32-transfers-part-a`, `chores-cycle5-matcher-catchup`, `f29-gated-options-wording` | docs only | — | none |
| Part 1 (this branch) | `FC5`, the four owned app files, `lib/format.ts` (`cut2`), `lib/recap.ts`, `/t` page `:55-56` | none of those lines | Part 2 is built after part 1 lands |

**The 2026-11-02 owner-decisions session** (no branch pushed yet; `git branch -r` shows none). Part 2 applies a new
decision only where its own five items edit the same string, and flags the rest:
- **OD 2.32 "Too early to tell" for a zero-width range:** this PR builds it. The session should reuse
  `lib/zero-width.ts` and not add a second rule.
- **OD 2.32 "average per trade so far, likely between X and Y":** that is the card's `SHARE_CARD.perTrade`/`.likely`,
  which part 2 does not edit. **Collision risk:** if the session puts "so far" on strips, "−100.0% per closed trade so
  far" (31 glyphs) no longer fits the image band at 35 px (D1). It needs that same layout decision first.
- **OD 2.40 "independent trades" for "bets":** part 2's new evidence branch reuses `plural(c.k, 'bet')` like its
  neighbours, so one swap there covers it. The new trust-line branch says no "bet".
- **OD 2.25 (changed: values keep showing):** part 2 adds no unrealized value (LC C15). F-34 builds 2.25.
- **OD 2.37 first-visit line, 2.39 A "Last close ‹date›":** no overlap.

## 5. Compliance (COMPLIANCE §1)

1. **Performance shown or labelled: yes.** The disclaimer is unchanged on every surface. No advice words. Losses are
   treated like gains (C10 test). The evidence label stays, and a verdict is removed where the range is an artefact
   (§2 anti-fraud spirit). Ranking is untouched (C13).
2. **Personal data: no new field.** The preview shows the owner's own public card to the owner only. No new request
   goes to another origin.
3. Money: no. 4. Messages or tracking: no (the preview is not a share action, and `recordShareAction` is unchanged).
5. User text: no. 6. Accounts or age: no. 7. New dependency or asset: no.
8. **Accessibility:** the preview alt is the card in words. Width and height are set, so nothing shifts. The img is
   not focusable. "Too early to tell" is visible text, never colour or an icon alone. Checked at 320 and 360 px.
9. Security: no. 10. **Claims: yes.** The C5-41 pitch is LC 3b's verbatim, with C4-C7 tested. The /how sentence is LC
   3a's (C1-C3). 11. Checkout: no.

## 6. For the owner and the legal committee (not cleared by this plan)

- **LC re-sign of D1:** the visible strip prints "‹avg› per closed trade". The alt and LC's test keep "average per
  closed trade". The shorter form is the council's literal wording, chosen because the long one overflows the image
  band. The PR quotes LC 3a-3d under `## Compliance` (LC C8).
- **OD 2.32 "so far" on strips** needs the image-band decision above before anyone applies it.
- **Owner:** the zero-width rule flags any record whose range rounds to one value, including large-sample ones. In the
  probe, a fixture of 4,731 trades in 13 bets prints "Too early to tell". F-33's spread floor (Q3, OD 2.32) is the
  principled fix and takes over.

## 7. Rollout

One PR after part 1 lands, labelled `fix`. No schema change, no rebuild and no `MATCHER_VERSION` bump: the change is
read-side wording. The feed's weight cache is unaffected because weights do not change. The build order is 1.4 (the
helper), 1.5, 1.1, 1.2, then 1.3. Then the 360 px user test as a first-time trader (owner Share box and prompt) and as
a first-time viewer (the zero-width profile from a shared link), then the independent review.
