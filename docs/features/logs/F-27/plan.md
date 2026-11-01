# F-27 plan (UX lead, round 1, 2026-11-01)

Base: main at 63f48f4 (F-20 merged; F-11's `--warn` and `.warn record-failed` are on main). Branch `feature/f-27`. No token
added or changed, no new dependency, no copy change. Decisions in the feature file are not reopened.

## 1. `WarnNotice` (new file `app/warn-notice.tsx`, server-safe, no state)
Props: `{ role: 'status' | 'alert'; className?: string; children: ReactNode /* the words */; extra?: ReactNode /* e.g. retry */ }`.
```
<p role={role} className={`warn-notice${className ? ` ${className}` : ''}`}>
  <svg data-warn-icon aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="1em" height="1em">
    <path d="M12 3 2 21h20Z"/><path d="M12 10v5"/><path d="M12 18h.01"/></svg>
  <span>{children}</span>{extra && <>{' '}{extra}</>}
</p>
```
No inline style, no colour attribute on the SVG (stroke/fill come from CSS; keeps the colour-literal scanner and the
"no `.tsx` uses var(--warn)" criterion green). Words in one `<span>` so they wrap as one flex item.

## 2. CSS (`app/globals.css`, replaces the FIXES-LABELS block near 559-564; adds 18 px: border 2 + padding 16)
Delete `.warn { color: var(--warn); }` and `.record-failed::before {...}`; move the flex layout of line 76 into the new block
(keep `.record-failed .button` 44 px rule, or rename it `.warn-notice .button`; recommend keep, it is the profile hook).
```
/* F-27: the warn notice (DS-17): icon, box and words, never hue alone. --warn is used only in these rules. */
.warn-notice { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px 12px; padding: 8px 12px;
  border: 1px solid var(--warn); border-radius: 8px; background: var(--surface); color: var(--text); }
.warn-notice [data-warn-icon] { flex: none; width: 1em; height: 1em; margin-top: .22em; fill: none; stroke: var(--warn);
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
.warn-notice > span { flex: 1 1 12ch; }
```

## 3. Call sites (all keep `record-failed`, role unchanged, words unchanged)
- `app/ui.tsx:102` `<WarnNotice role="status" className="record-failed">{RECORD_BODY.failed}</WarnNotice>`
- `app/pane.tsx:69` same.
- `app/record-strip.tsx:31` `<WarnNotice role="status" className="record-failed">{strip.note}</WarnNotice>`
- `app/u/[handle]/page.tsx:278` `role={isMe ? 'alert' : 'status'}`, words `RECORD_BODY.failed`, `extra={isMe && <Link className="button secondary" href="/connect">{RECORD_BODY.retry}</Link>}`.
One notice per surface already holds (card: feed strip has no note; trade page: strip block only; pane: one line); tests pin it.

## 4. Chart baseline
`Spread.tsx:36` and `Timeline.tsx:55`: `stroke="var(--line)"` -> `stroke="var(--control)"`. Nothing else in the charts changes.

## 5. Tests (written first)
`lib/f27-warn-notice.test.ts` (source + SWC render, same harness as `lib/f10-feed-card.test.ts`):
- AC1 source: both baselines `<line ... y1={BASE} ... y2={BASE} stroke="var(--control)"`; no `var(--line)` in `app/t/[symbol]/*.tsx`.
- AC3 render: `WarnNotice` markup: one `[data-warn-icon][aria-hidden="true"][focusable="false"]`, class `warn-notice`, words
  in the span; `TradeCard` failed, pane failed, `RecordStrip` with a note: exactly one `.warn-notice.record-failed`, no
  `down`/`warn` class token; source of the four files holds `<WarnNotice` and no `"warn record-failed"`/`"down record-failed"`.
- AC3 CSS: no `.record-failed::before` / `::before` on `.warn-notice`; no `.warn {` rule; icon rule has `pointer-events: none`.
- AC5: every `var(--warn)` in globals.css outside TOKENS sits in a rule whose selector starts `.warn-notice`; no `.tsx` under
  `app/` contains `var(--warn)`.
- AC6: render `HeldNote` (`.thesis-held`) and a held card: no `down`, no `warn-notice`.
- AC7: source test on `lib/a11y-contrast.test.ts`: the CVD block names up/down/flat only, no `warn` in it, no exempt/skip list.
- AC8: card, pane, trade-page strip each render exactly one `.warn-notice` (trade page via `RecordStrip` with surface 'trade').
- AC9: `--warn` vs `--surface` >= FLOORS.ui (3) and `--text` vs `--surface` >= FLOORS.text, both schemes (parse TOKENS as
  a11y-contrast does; extra rows could also go in its PAIRS list; recommend the new file, leaves the F-20 file untouched).
- AC2/AC12: run unchanged (`a11y-contrast` #14 and the F-20 AC6 image-table pin); no edit to either.
`e2e/f27-warn-notice.spec.ts` (fixture seeded by SQL like `e2e/share-card.spec.ts:81-90`: a user with closed trades and a
`connections` row `state='failed'`; deleted in `finally`; holds `feedLock('shared')`; a signed-in second trader for likes):
- AC1 e2e: `/t/NVDA` (seeded demo) light and dark via `page.emulateMedia({ colorScheme })`: computed stroke of the baseline
  line equals the resolved `--control` (resolve a token by setting it on a probe element and reading `getComputedStyle`).
- AC3/AC4 e2e: feed card, pane, profile (signed out and as author), trade page, light and dark: the notice's border colour =
  `--warn`, words colour = `--text`, icon `pointer-events: none`, `::before` content `none`; then a scan of every element
  for `color`, `border-*-color`, `outline-color`, `background-color`, `fill`, `stroke` equal to `--warn`: each match has
  `closest('.warn-notice')` with `[data-warn-icon]` and non-empty `innerText`.
- AC10: signed in, touch context, reuse `doubleTap` from `e2e/likes.spec.ts` (CDP touch events) aimed at the icon's box
  centre: one `trade_likes` row, `.like-mark` visible.
- AC11: at 320×640, 360×640, 780×360 reuse the fit block of `e2e/record-strip.spec.ts:84-120` (strip lines, disclaimer
  in row, 15% headroom `need <= row`) on the failed fixture card. `connect.spec.ts:453` keeps passing unchanged.

## 6. `lib/qa-round-1.test.ts` finding 7 (update, not weaken)
Same test, same 4 files, same assertion count: per file `<WarnNotice` with `className="record-failed"` and no
`"down record-failed"`/`"warn record-failed"`; CSS: the two `--warn:` token asserts stay; `.warn {` and
`.record-failed::before` asserted absent; `.warn-notice` rule asserted with `border: 1px solid var(--warn)` and the icon
rule with `stroke: var(--warn)`. Test count rises (new files), never drops.

## 7. Compliance (COMPLIANCE.md §1): no copy, data, vendor, dependency, advice or personal data change; a11y improves (WCAG 1.4.1, 1.4.11). Nothing for counsel.

## Open questions
- OQ-A (feature OQ on dark image hues): already settled on main by F-20 (`lib/palette.ts` and the a11y test pin
  #3cc4b4 / #ff8a5b). Recommend the feature file's open question be closed by the pipeline; no action here.
- OQ-B: Status still says `blocked`; both prerequisites are on main. Recommend `ready` (owner/pipeline flips it).
- OQ-C: icon alignment with multi-line words: recommend `flex-start` + `.22em` top margin (first line), confirmed in user test.
