# F-20 · Design tokens and the contrast test: implementation plan (UX lead)

UX lead, 2026-11-01. Branch `claude/f20-design-tokens` (= main 06edbdf, which carries #55 and #71). Sources: the
feature file (every decision and AC), design system §5.1 and rows DS-1..DS-4, DS-6, DS-26, DS-27, POLICY A1/T3.
Numbers below were computed with the TS port of `a11ylib.py` in `lib/fixes-cycle2-a11y.test.ts` (quantised CVD).

**Scope in one line.** Move every CSS colour literal into one TOKENS block, move every image colour into one table,
switch every focus outline to `var(--focus)` at a 2 px offset, delete dead CSS, and add the tests that keep it so.
Nothing else that a sighted mouse user sees changes. No new screens, states, copy or data: the states list (empty,
loading, error, new trader, all losses, demo, signed out) is untouched, and the snapshot (§4.6) covers signed out and
signed in, gain and loss, Verified and Demo.

**Two hard stops for the owner** (role spec: say so, do not plan around them): today's image gain/loss fails the
ΔE00 ≥ 9 floor the feature applies to images (OQ-1), and the literal "Flat ≥ 9 vs gain/loss" reading fails on
light (OQ-2). Everything else below can be built now; those two tests land as `todo` until the owner rules.

## 1. Token layer (DS-1, DS-4 value-neutral)

**Where.** A delimited block at the very top of `app/globals.css`, replacing lines 1-19 in place:

```css
/* TOKENS (F-20, DS-1): the only CSS colour literals. Pinned per scheme in lib/a11y-contrast.test.ts. */
:root {
  --bg: #0b0b0f; --surface: #16161d; --text: #f4f4f6; --muted: #8b8b98; --line: #262631;
  --up: #3cc4b4; --down: #ff8a5b; --accent: #a78bfa; --on-accent: #0b0b0f;
  --control: #6f7682; --focus: #86a8ff;
  --verified: var(--text); --flat: var(--muted); --demo: var(--muted);
  color-scheme: dark;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #fafafa; --surface: #fff; --text: #111118; --muted: #6b6b78; --line: #e5e5ea;
    --up: #0b6b70; --down: #b2441b; --accent: #6d28d9; --on-accent: #fff;
    --control: #7c818b; --focus: #2152d9;
    color-scheme: light;
  }
}
/* end TOKENS */
```

- **Regex-safe.** `lib/badge-contrast.test.ts` and `lib/f7-trust.test.ts:170-171` read the *first* `:root\s*\{([^}]*)\}`
  and the first `@media (prefers-color-scheme: light)\s*\{\s*:root\s*\{([^}]*)\}` and keep only hex values. So: the
  block stays first in the file; dark `:root` before the light media query, written exactly that way; no `}` and no
  literal text `:root {` inside any comment in or above the block; every hex token (including `--control`, `--focus`)
  sits in those two rules, so both tests now also see them. The existing comments (`7.2:1 on the dark lilac`) stay.
- **Tokens.** Base (`--bg --surface --text --muted --line`), `--up --down`, `--accent --on-accent`, `--control`,
  `--focus`, `--verified` (alias, as #55). New names only as aliases of today's value: `--flat: var(--muted)` (§5.1
  defines it so; no consumer yet, DS-11 repoints `.flat` later) and `--demo: var(--muted)` (the Demo badge's text
  colour today; `.badge.demo` keeps `color: var(--muted)` because both regex tests resolve hex tokens only, and DS-5
  gives Demo its own hue later). See OQ-6. `--warn` enters TOKENS only with F-11's merged values (§6).
  Not added: `--surface-2`, `--demo-bg`, `--warn-bg`, `--scrim`, `--sp-*`, `--fs-*`, `--r-*` (new values or V-2).
- **A11Y-FIXES block.** Its two `:root` lines (`:617-618`) and the token comment above them move to TOKENS with the
  same values. The block keeps its opening and `/* end A11Y-FIXES */` markers, name and every other rule; in place of
  the lines goes one comment: `/* #13, #14 tokens (--control, --focus, --verified) live in the TOKENS block at the
  top (F-20); values unchanged. */`. Cascade check: no `:root` rule sits between them today, so moving them up changes
  no computed value (the snapshot proves it).
- **Base, accent, on-accent** are pinned as their own test (AC2, veto DK/CS); they change only through V-1.

## 2. Focus change (DS-27): every outline rule

| # | Line on main | Rule today | After F-20 |
|---|---|---|---|
| 1 | 144 | `:focus-visible` 2px `--accent`, offset 2 | 2px `var(--focus)`, offset 2 |
| 2 | 153 | `.chart-stack:focus-visible` accent/2 | `var(--focus)`/2 (kept: explicit) |
| 3 | 257 | `.rec-chips button:focus-visible` accent/2 | `var(--focus)`/2 |
| 4 | 273 | `.auth input[type=checkbox]:focus-visible { outline-offset: -4px }` | rule deleted: global ring at 2 px around the 44 px box (12 px from the drawn 24 px box; inside the 8 px label gap) |
| 5 | 295 | `.rows.closes li:focus` accent/2 (tabindex −1 target) | `var(--focus)`/2 (`:focus` kept: programmatic focus) |
| 6 | 300 | `footer.site:focus` accent/2 (skip-link target) | `var(--focus)`/2 |
| 7 | 395 | `.pane-sheet .sheet-note:focus` 2px `--text`/2 | `var(--focus)`/2 |
| 8 | 405 | `.pane-sheet .sheet-trade h3:focus` 2px `--text`/2 | `var(--focus)`/2 |
| 9 | 442 | `.switch-pair .switch:focus-visible` 3px accent/2 | 3px `var(--focus)`/2 (width kept, OQ-5) |
| 10 | 488 | `.rt-card:focus` accent/2 | `var(--focus)`/2 (breaks the #71 ANCHOR string: §5) |
| 11 | 409+494 | `.pane .rows .line.hl` 2px, offset 2, colour `--focus` via #12 | unchanged (OQ-4) |
| 12 | 441 | `.switch-pair .switch.current` 2px `--text`, offset 1: a *selected* cue | redrawn without `outline` (OQ-3) |
| 13 | 158 | `.chart a:focus { outline: none }` | unchanged; the point's ring is the `.hit` stroke (OQ-8) |

Rewrite each in place (no new block): reviewers see one-line diffs, and specificity stays as is. Ring contrast:
`--focus` 6.15/6.42 light, 8.47/7.76 dark on bg/surface (≥ 3); the 2 px offset is mandatory because without it the
ring is 1.11-2.79:1 against the accent button (§5.1).

## 3. Share-image colour table (DS-6 shape, today's values)

New `lib/palette.ts` (pure data, no imports; the scanner's one allowed TS home for colour literals):

```ts
// Share-image colours (F-20): next/og cannot read CSS variables, so images read this table. Values are today's,
// unchanged (image colour changes are the owner's: O-2, OQ-1). lib/a11y-contrast.test.ts holds them to the floors.
export const IMAGE_PALETTE = {
  card: { bg: '#0b0b0f', text: '#f4f4f6', muted: '#a1a1ad', up: '#22c55e', down: '#f43f5e', warn: '#f59e0b', demo: '#38bdf8', base: '#6b6b78' },
  strip: { bg: '#0b0b0f', text: '#f4f4f6', muted: '#8b8b98', up: '#22c55e', down: '#f43f5e', warn: '#f59e0b', ok: '#22c55e' },
} as const;
export const THEME_COLOR = '#0b0b0f'; // <meta name="theme-color">, dark only today (per-scheme is DS-6, later)
```

- Card muted `#a1a1ad` and strip muted `#8b8b98` differ today; both kept (one grey is DS-6, not approved here).
- `app/u/[handle]/record-card-image.tsx:13`: `const C = IMAGE_PALETTE.card;` (no other change; `opengraph-image.tsx`
  and `story/route.tsx` read `C` through it).
- `lib/record-strip.ts:142,146`: `IMAGE = { width: 1200, height: 630, bg: IMAGE_PALETTE.strip.bg }`;
  `const { bg: _bg, ...strip } = IMAGE_PALETTE.strip; export const IMAGE_COLOURS = strip;` so `ImageTone`,
  `app/record-strip.tsx` and `lib/record-strip.test.ts` (F-12 AC3) keep working untouched.
- `app/layout.tsx:16`: `themeColor: THEME_COLOR`.
- Measured on `#0b0b0f`: card text 17.88, muted 7.69, up 8.62, down 5.35, warn 9.15, demo 9.17, base (0 % dashed line,
  UI) 3.74; strip muted 5.84. All pass text 4.5 / UI 3. Gain vs loss: protan 29.5, **deutan 6.3**, tritan 73.0 (OQ-1).

## 4. Tests (one per AC; test count only rises)

Shared helpers move out of test files so tests can import without re-registering tests:
- **`lib/colour-math.ts`**: the port from `lib/fixes-cycle2-a11y.test.ts:76-135` verbatim (`hx`, `contrast`, `mix`,
  `sim`, `lab`, `de00Lab`, `cvd`, `cvdMin`, matrices, `QUANTISE`). `fixes-cycle2-a11y.test.ts` imports it and keeps
  its two self-check tests (CIEDE2000 pairs, spec fidelity). `a11y-contrast.test.ts` drops its own `lum`/`contrast`
  (0.03928 vs 0.04045 threshold: the pinned 2-decimal values do not move) so there is one set of contrast values.
- **`lib/css-cascade.ts`**: `parse` (with `splitSel`), `decls`, `tokensFor`, `last`, `paint`, `tokenOf`, the scheme
  predicates, plus `block(css, start, end)`. Both a11y tests import it. `badge-contrast.test.ts` is left byte-for-byte.
- **`lib/source-lex.ts`**: `lex` moved from `lib/a11y-copy.test.ts` (which re-imports it; its tests unchanged).

| AC | Test | File |
|---|---|---|
| 1 token values | `TOKENS_WANT.{light,dark}` = the 14 resolved values above (+`warn` once merged); every `:root` custom property with a literal sits inside TOKENS | `lib/a11y-contrast.test.ts` |
| 1 computed styles | snapshot, §4.6 | `e2e/f20-tokens.spec.ts` (committed in dd13f5d with its baseline) |
| 2 base/accent/on-accent | separate test pinning bg, surface, text, muted, line, accent, on-accent per scheme | `lib/a11y-contrast.test.ts` |
| 3 badge test kept | `lib/badge-contrast.test.ts` untouched; CI's test-count guard; a meta test asserts the file exists | `lib/a11y-contrast.test.ts` |
| 4, 11 pairs | `PAIRS` table below, per scheme, each at its `FLOORS` key | `lib/a11y-contrast.test.ts` |
| 5 CVD floor | up vs down, min over protan/deutan/tritan ≥ `FLOORS.cvd` (light 27.8, dark 20.1); Flat per OQ-2 | `lib/a11y-contrast.test.ts` |
| 6 image table | values equal today's (literal table in the test); `IMAGE_COLOURS`/`C` are the palette objects (identity); contrast per §3; up vs down CVD ≥ 9 as `todo: 'OQ-1'` until ruled | `lib/a11y-contrast.test.ts` |
| 7 literals | scanner, §4.5 | new `lib/colour-literals.test.ts` |
| 8 outlines | static: every `outline`/`outline-color` declaration is `none` or uses `var(--focus)`; every `outline-offset` is `2px`; no rule sets `outline` on a state selector without `:focus` except `.hl` (allow-list of one, OQ-4). e2e: the draft's DS-27 test (6 controls, both schemes) plus `.switch-pair .switch` on `/me/personalize` and `.pane-sheet .sheet-note` | both |
| 9 no external fonts/assets | static + e2e, §4.7 | `lib/colour-literals.test.ts`, `e2e/f20-tokens.spec.ts` |
| 10 ponytails | review: hand-off lists §7 | PR |
| 12 floors | `FLOORS = { text: 4.5, large: 3, ui: 3, focus: 3, cvd: 9 }` with a comment naming the cycle-2 values and OQ-7; a test fails if any key is below `CYCLE2` (same numbers, written separately); a source check fails if `a11y-contrast`, `fixes-cycle2-a11y` or `badge-contrast` compares a ratio or ΔE with a numeric literal below 3 | `lib/a11y-contrast.test.ts` |
| 13 snapshot | §4.6 | `e2e/f20-tokens.spec.ts` |

**4.4 `PAIRS`** (fg, bg, floor), each over `bg` and `surface` unless stated: text, muted (labels, disclaimer, Demo
badge), up, down, flat → `text`; `--verified` on its 18 % `--up` tint (existing #13 shape) → `text`; `--on-accent` on
`--accent`, `--bg` on `--up` and `--down` (pressed range tab) → `text`; `--accent` (selected chip fill), `--control`,
`--up`/`--down` (chart line), `--muted` (0 % axis) → `ui`; `--focus` → `focus`; `.badge.public` text on surface →
`text`. Large text is held to 4.5 (stricter; every text token passes it). `--line` is excluded by name: decorative
dividers only (§5.1), never a control boundary (#55's list guards that).

**4.5 Colour-literal scanner** (`lib/colour-literals.test.ts`). Scope: `app/**/*.{css,ts,tsx}`, `lib/**/*.ts`;
skipped: `*.test.ts`, `lib/palette.ts`, and in `app/globals.css` the TOKENS block. CSS comments and TS comments are
stripped (`lex` for TS, so a hex in a comment or in prose is not a colour). A literal is: a hex `#rgb #rgba #rrggbb
#rrggbbaa` not preceded by `[\w$}&/?=-]` and not inside `url(...)` (so `…}#add` in `app/tools/actions.ts:87` and
`url(#timeline-hatch)` pass); a colour function `rgb( rgba( hsl( hsla( hwb( lab( lch( oklab( oklch( color(`; a CSS
named or system colour (the 148 names + `Canvas`, `CanvasText`, …) as a CSS declaration value or as a TS/TSX string
literal assigned to `color|background*|border*|outline*|fill|stroke|stopColor|themeColor`. Allowed words:
`transparent`, `currentColor`/`currentcolor`, `inherit`, `initial`, `unset`, `revert`, `none`; `color-mix(in srgb, …)`
only with `var()` and `transparent` operands. Self-test fixtures (like `a11y-copy`'s): flags `'#22c55e'`,
`rgb(0 0 0)`, `fill="red"`, a hex in a `style={{}}`; passes `#add`, `url(#abc)`, `currentColor`, a hex in a comment.

**4.6 Computed-style snapshot** (`e2e/f20-tokens.spec.ts`, committed in dd13f5d; baseline captured on main 06edbdf). Feed, first row's
pane, a fixture profile (Verified, a gain and a loss); signed out and signed in; light and dark; 360×740. Every
element's computed colour tuple (color, background, 4 borders, outline colour/style/width/offset, box-shadow, fill,
stroke, decoration, caret, accent) grouped by a 3-level signature. **Baseline**: `F20_BASELINE=write` run on main
06edbdf *before* the token layer, committed as `e2e/fixtures/f20-style-baseline.json`, in the PR's first commit (so
review sees it was captured pre-change). **Allowed diffs: none** on these surfaces: no element is focused while
sampling, `.hl` is already `--focus`/2 px, and `.switch.current` is not on them; the focus change is proved by the
DS-27 test instead. `compared > 150` stops a vacuous pass. Add a Demo row (seeded demo trader's profile) so the Demo
badge's tuple is in the baseline.

**4.7 No external font or asset.** Static: no `next/font/google`, no `@import`, no `url(http`, no `<link` with an
`http(s)://` href, no `fetch('http` in `app/**/opengraph-image.tsx`, `story/route.tsx` (next/og uses its bundled
font). e2e: on feed, pane, profile and `/u/<handle>/opengraph-image`, every request's origin is the app's
(`data:`/`blob:` allowed). POLICY T3, P6 (no third-party transfer).

## 5. Dead CSS (DS-26) and the #71 nits

- `.sr-only`: keep line 130 (the full rule); delete the subsets at 193 and 258. `.import-finished.sr-only` overrides
  by specificity, unaffected. A test asserts exactly one `.sr-only {` rule.
- `.badge-embed`: already gone (`lib/fixes-cycle2-trust.test.ts:114`). Scan of every class selector against `app/`,
  `lib/`: no other dead class (`.rt-n2..4` are built as `` `rt-n${n}` ``, kept). Line 273 goes with §2 #4.
- `.nojs-done` padding `12px 16px` → `8px 16px`, set inside FIXES-CYCLE2-A11Y (that block's #14 claim): the bar is
  then ≤ 70 px like the other two, so the 94 px room keeps ≥ 8 px clear. Assert in `fixes-cycle2-a11y.test.ts` and
  extend `e2e/fixes-cycle2-a11y.spec.ts:427` with `height ≤ 70` at 320 and 360. A size, not a colour (OQ-10).
- Comment "six of them" → "five of them" (RANGES 1W 1M 3M 1Y ALL); "62/64 px" stays true after the padding fix.
- `fixes-cycle2-a11y.test.ts:233-239`: replace the exact ANCHOR string with effect and order: one START, one END,
  START < END; the rule immediately before START is `.rt-card:focus` (regex on the selector, any value); A11Y-FIXES
  starts after END; `last('.pane .rows .line.hl', outline-color)` is `--focus` and no rule after END sets it. Every
  colour floor and value pin in the file stays; the test keeps its name's intent and count.

## 6. Risks and merge order

- **F-11 (`claude/fix-truthful-labels`)** adds `:root { --warn: #fbbf24 }` / light `#92400e` in FIXES-LABELS. The
  feature says F-20 merges after F-10..F-13's `globals.css` edits, so F-20 rebases on F-11 once merged, moves the two
  `--warn` lines into TOKENS (same values, pointer comment left, block kept) and pins `--warn` (11.8/10.8, 6.8/7.1). If
  F-11 is still open when F-20 is green, F-20 waits (or the owner releases it): merging first would make the scanner
  fail F-11, and its hand-off note would have to say "put `--warn` in TOKENS".
- **Other blocks** (F-9 PR #65, CHORES-3, later features): the scanner fails any new literal; the fix is a token. No
  block is renamed or removed; block-anchored tests (`f10-followups`, `options-fix3`) are untouched.
- **First-`:root` regexes** (badge-contrast, f7-trust): §1 rules. A `}` in a TOKENS comment would silently shrink
  their token map; the AC1 test asserts the first `:root` body holds every hex token.
- **Focus on dark-filled buttons:** the blue ring next to a violet button is only legible because of the offset; any
  later `outline-offset: 0` fails AC8's static test.
- **Snapshot flake:** fonts (DejaVu via `e2e/fonts.conf`) and hover state; the snapshot moves the mouse to 0,0 first.

## 7. Ponytail limits (marked in code, listed in the hand-off)

- `lib/palette.ts`: dark-only images and dark-only `themeColor`; next step DS-6 (per scheme, one grey, ink up/down).
- `.chart a:focus .hit` and `.skip-link` border show focus in `--accent`, not `--focus`; next step a DS-27 follow-up.
- The scanner is a lexer heuristic, not a CSS/TSX parser; next step a real parser if the repo gains one.
- Floors live in a test file the same PR can edit; next step OQ-7.

## 8. Compliance (COMPLIANCE §1)

1 performance display: colours only, no wording, gain and loss treated alike (CVD floor). 2 personal data: none.
3 money: no. 4 tracking: no; §4.7 forbids third-party fonts/assets. 5 user content: no. 6 accounts: no. 7 vendor,
dependency, font, image: none added (no package, all assets self-hosted). 8 screen reader/keyboard: yes, improves the
ring (WCAG 1.4.11, 2.4.7, 2.4.11), §9 applies. 9 security: no. 10 claims: none. 11 checkout: no. Owner-only items: OQ-1,
OQ-2, OQ-7.

## 9. Open questions (each with a recommendation)

1. **Image gain/loss under deutan is ΔE00 6.3 (< 9); no image colour may change.** Recommend: the owner approves, as a
   fixes-list item, card and strip `up`/`down` → today's dark ink `#3cc4b4`/`#ff8a5b` (9.12/8.46:1 on `#0b0b0f`; CVD
   min 20.1), in F-20 as its own commit with the baseline note. Alternative: leave values; the test lands as
   `todo: 'OQ-1'` (floor stays 9) and F-20's AC6 is reported as not met. Not offered: a lower image floor.
2. **Flat (`--muted`) vs gain is light protan 2.8 / deutan 7.0** (dark 16.8/9.8/26.0; vs loss ≥ 23.7 everywhere).
   Recommend: the owner confirms the ΔE00 ≥ 9 floor is gain vs loss (AC5's wording); Flat is held at 4.5:1 text and
   is told apart by "Flat" and no sign (DS-11), and the numbers are logged. Alternatives: give `--flat` a new value
   (not value-neutral: fixes list); or land Flat-vs-gain as `todo: 'OQ-2'`.
3. **`.switch-pair .switch.current` (selected, not focus).** Recommend: draw it as
   `box-shadow: 0 0 0 1px var(--bg), 0 0 0 3px var(--text)` (same pixels on the page background, `outline` left to
   focus; the ✓ and `aria-pressed` still carry state, also in forced colours). Alternatives: `var(--focus)` outline
   (selected would look focused: rejected), or a named exception in AC8's test.
4. **`.pane .rows .line.hl` (current row).** Recommend: unchanged; it already uses `--focus`, 2 px, offset 2 and
   weight 600 (#12, pinned by AC12.1/12.2), and is AC8's one allow-listed non-focus outline. Alternative: the §5.1
   inset bar like `:target`: a visible change, so a later fix.
5. **`.switch:focus-visible` width 3 px.** Recommend keep 3 px (only colour and offset are the stated change).
   Alternative: 2 px like the rest.
6. **New aliases.** Recommend `--flat` and `--demo` as `var(--muted)` aliases with no consumer repointed; `--warn` only
   via F-11. Alternative: add none until DS-5/DS-11 (the feature file names them, so recommend adding).
7. **Floors in a protected file** (owner, council flag 7). Recommend the owner adds a `FLOORS ≥ cycle-2` check to
   `scripts/invariants.test.ts` after F-20 merges; until then §4 row 12.
8. **Accent focus cues that are not outlines** (`.chart a:focus .hit` stroke, `.skip-link` border). Recommend leave
   (visible change beyond the stated one), ponytail. Alternative: switch both to `--focus` now.
9. **`themeColor`.** Recommend keep `#0b0b0f` via `THEME_COLOR`; per-scheme is DS-6. Alternative: none in scope.
10. **`.nojs-done` padding 8px 16px** is a size change outside "the one stated focus change". Recommend treat it as
    completing fix #14 (fixes list, #71 review) and list it in the hand-off. Alternative: only correct the comment's
    numbers (72 px, 6 px clear).

## 10. Committee rulings (round 1, 2026-11-01): binding over §1-§9 where they differ

Business lead: SIGN with demands. Engineer: SIGN with conditions. Rulings (committee log has the reasons):

- R1 (OQ-1): image colours stay byte-for-byte. The image up-vs-down CVD check is written at `FLOORS.cvd` (9) as a
  `{ todo: 'OQ-1 …' }` test that runs the real assertion and prints the measured value; a `ponytail:` comment marks it.
  The recommended image change (#3cc4b4/#ff8a5b) is offered to the owner only; F-20 builds none of it.
- R2 (OQ-2): no reinterpretation. Flat-vs-up and Flat-vs-down are tested at `FLOORS.cvd` in both schemes; passing
  pairs are real tests, only failing pairs are `todo: 'OQ-2 …'`. The "Flat label, no sign" argument goes to the owner as
  context.
- R3 (OQ-10): no `.nojs-done` padding change. The FIXES-CYCLE2-A11Y comment is corrected to the measured numbers
  (no-JS bar 72 px; the 94 px room leaves 6 px clear above it) and the e2e asserts the room still covers every bar
  (bar height + 16 px ≤ 94). The padding question is filed for the fixes list. "six" → "five".
- R4 (ANCHOR): `ANCHOR` becomes the new exact line `.rt-card:focus { outline: 2px solid var(--focus); outline-offset: 2px; }`;
  every other assertion in `lib/fixes-cycle2-a11y.test.ts` stays as strict.
- R5 (OQ-3, `.switch.current`): redrawn as `box-shadow: 0 0 0 1px var(--bg), 0 0 0 3px var(--text)` (no outline) plus
  `@media (forced-colors: active) { … outline: 2px solid transparent; outline-offset: 1px }` (allow-listed by name).
  Proof of no visible change: a pixel comparison of `.switch-pair` on `/me/personalize`, light and dark, against
  screenshots taken on main (orchestrator holds them), and the snapshot gets ONE named allowed difference for that
  signature's outline/box-shadow properties only. If the pixels differ, fall back to a named outline exception
  (`--text`, allow-listed, `ponytail:`, owner question).
- R6: `.pane .rows .line.hl`'s base rule (`:409`) takes `var(--focus)` (computed value unchanged: `:494` already wins);
  the AC8 allow-list exempts it only for being a state, not focus.
- R7: `IMAGE_PALETTE.strip` has no bg; `IMAGE_PALETTE.stripBg` (or `IMAGE.bg` read from the palette) is separate, so
  `IMAGE_COLOURS = IMAGE_PALETTE.strip` keeps identity. Plus a source check: no hex in `record-strip.ts`,
  `record-card-image.tsx`, any `opengraph-image.tsx`, `story/route.tsx`, `layout.tsx`.
- R8: helper moves (`lib/colour-math.ts`, `lib/css-cascade.ts`, `lib/source-lex.ts`) are verbatim; no assertion or
  pinned decimal changes; no looped `test(` folded; guard test counts before/after go in the hand-off. These files count
  toward the product-line cap: said in the PR.
- R9: scanner scope = every tracked non-test `.ts/.tsx/.css` outside `docs/`, `e2e/`, `scripts/`; named colours match
  declaration values only; self-tests include `white-space: nowrap`, `'Trade #123'`, `` `${x}#add` `` and a regex literal.
- R10: the first-`:root` regexes keep working (no `}` or `:root` in the TOKENS header comment; light query written
  `@media (prefers-color-scheme: light) {`), with an assertion that the first `:root` body holds every hex token.
- R11: F-20 merges after F-11 (merge precondition, stated in the PR); after merging F-11, its `--warn` and its
  opengraph `#0b0b0f` literals move to TOKENS / `IMAGE_PALETTE`.
- R12: the PR and hand-off state AC5 (Flat part) and AC6 (image CVD part) as NOT MET while OQ-1/OQ-2 are open; the
  feature is not marked built with those boxes ticked. The orchestrator merges, never auto-merge.
- R13: the Demo surface is already in the baseline (the feed and pane render the seeded demo traders' Demo badges); no
  re-capture after the token layer, ever.
