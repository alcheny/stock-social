# fixes-cycle2-a11y: UX plan (approval council cycle 2, rows #12, #13, #14, #17, #18, #26)
UX lead, 2026-11-01. Sources: `git show pr53:docs/ideas/approval-2026-11-01-cycle2.md` rows 12-26; design system
2026-11-01 §2.8, §5.1 (numbers from `python3 -I docs/direction/design-system-2026-11-01-scripts/tokens.py`); POLICY A1.
Overlap: branch `origin/claude/f13-a11y-fixes` (F-13 + A11Y-FIXES, unmerged) already fixes the light Verified text,
`:target` row, control borders (26 selectors, `--control`), `html` scroll-padding, Like name (#17), `h1`/`.who`
wrap and nav wrap. We skip those and reuse its token names and values (`--focus` #2152d9 / #86a8ff, `--control`
#7c818b / #6f7682), so a merge in either order only joins two blocks at the end of `app/globals.css`.
Contrast is WCAG 2.x; text needs ≥ 4.5, non-text ≥ 3. Measurements were taken in Chromium 1243 with DejaVu Sans
(scratch pages built from main's CSS and from F-13's CSS).
## Files
`app/globals.css`: tokens edited in place (lines 7-8, 16) plus one block `/* FIXES-CYCLE2-A11Y */ … /* end
FIXES-CYCLE2-A11Y */` at the end. New `lib/fixes-cycle2-a11y.test.ts` and `e2e/fixes-cycle2-a11y.spec.ts`. No
change to `app/card-menu.tsx` or `lib/copy.ts` (#17 is F-13's job).
## #26 Gain and loss colours (WCAG 1.4.1, POLICY A1)
- Change: `--up: #3cc4b4; --down: #ff8a5b` (dark `:root`, lines 7-8); light line 16 `--up: #0b6b70; --down: #b2441b`.
  Edit in place, not in the end block: a dark `:root` override placed after the light `@media` would beat the light
  values. bg, surface, text, muted, line, accent and on-accent stay as they are.
- Dark changes too (decision): today's dark minimum is 6.3 ΔE00 (deutan), under the spec's one threshold of 9. DS-4
  ships both schemes as one fix row.
- Knock-on rules checked: `.up`/`.down` text, the chart curve and dot (`--c`), and `.tabs button[aria-pressed=true]`
  (`--bg` text on a `--c` fill): the same pair as up/down on bg.
- AC26.1 (unit): parsed tokens equal the four hex values above; base tokens equal today's.
- AC26.2 (unit): text contrast (≥ 4.5) for up/down on bg and on surface: light 6.00/6.27 and 5.39/5.62; dark
  9.12/8.36 and 8.46/7.75. `--bg` on the `--c` fill gives the same values.
- AC26.3 (unit): gain vs loss CVD minimum ≥ 9 ΔE00 in each scheme (expected 27.8 light, 20.1 dark). See Q3.
- AC26.4 (e2e, both `colorScheme`s): computed `color` of a `.up` and a `.down` figure on a demo profile equals the
  new rgb values.
- Out of scope: dark share images hard-code #22c55e/#f43f5e (DS-6, another session). The `--line` 0% axis in
  `app/t/[symbol]/Spread.tsx:35` and `Timeline.tsx:54` (1.20-1.31:1, a graphical object; DS says `--control`)
  belongs to `app/t/**`, which we may not edit. We list it for the owner of that file.
## #12 Current-row cue `.hl` (WCAG 1.4.11)
- Change (end block): `.pane .rows .line.hl { outline-color: var(--focus); }`. It keeps the 2 px width, the 2 px
  offset and weight 600, so the row is not marked by colour alone. Token, identical to F-13:
  `:root { --focus: #86a8ff; --control: #6f7682; }` `@media (prefers-color-scheme: light) { :root { --focus:
  #2152d9; --control: #7c818b; } }`.
- AC12.1 (unit): `--focus` on bg and surface ≥ 3 (light 6.15/6.42, dark 8.47/7.76). Today `--line` gives 1.20/1.31.
- AC12.2 (e2e, both schemes): open a demo trader's pane from the feed. The `.line.hl` row has computed
  `outline-color` equal to `--focus`, `outline-offset` ≥ 2px, and `font-weight` ≥ 600. Contrast of the outline
  against the pane's computed background is ≥ 3.
- The Verified badge and `:target` parts of row 12 are F-13's: we add no rule for them.
## #14 Fixed bottom bars hide focus (WCAG 2.4.11)
Measured on main at 360×740: the sign-in line spans y 662-724 and fully covers the card's "See their record" link
(y 689-709). At 360×640 the bar is at 562-624 and the link at 589-609. Rows are fixed height and do not scroll, so
scroll-padding alone cannot help the card. Bar height is 62 px and its offset is 16 px, so it takes 78 px.
- Change (end block). Selector A is
  `body:has(.signin-line:not(:empty), .hide-bar > p, .nojs-done)`.
  - `A .feed .row > * { padding-bottom: 94px; }`: the card keeps the bar's 78 px plus 16 px clear.
  - `html:has(.signin-line:not(:empty), .hide-bar > p, .nojs-done) { scroll-padding-bottom: 94px; }`.
  - `A .feed > .row > .pane { scroll-padding-bottom: 94px; }`.
  - Nothing goes on `.feed`, because padding there moves its snap points (F-13 note). The rules apply only while a
    bar shows, so the layout does not change when no bar is up. Recommended option (Q1).
- AC14.1 (e2e, 360×740 and 360×640, signed out): double-tap a card. While `.signin-line` is non-empty, every
  focusable element inside the card (`a, button`) has `bottom ≤ bar.top − 8`. Tab through the card: each focused
  element is fully above the bar top and below the nav bottom.
- AC14.2 (e2e, signed in): hide a trade so `.hide-bar > p` shows, then repeat AC14.1 for the next card and for a
  pane opened with →. Then press Escape: `padding-bottom` returns to 28px.
- AC14.3 (e2e, no JS, `?done=trade-hidden`): `.nojs-done` is visible. The first card's links end above its top.
- AC14.4 (e2e): at 360×740 with a bar up, the card does not clip (`scrollHeight ≤ clientHeight + 1`). At 360×640 see Q2.
## #13 Control boundaries ≥ 3:1 (WCAG 1.4.11)
- Audit of every `button`, `input`, `select`, `textarea` and `summary` rule in `app/globals.css` against F-13's list:
  - F-13's list covers every control that has a surface or transparent fill and a `--line` border.
  - Plain `button`/`.button` gets the accent fill and `border: 0` (line 139). The fill against bg is 6.81/7.22, so it
    needs no border. The same holds for every `.secondary` that no surface rule matches.
  - Not controls, or not identified by a boundary: `.tabs button` unpressed (text only, muted 5.03); `.rt-check`
    (a label wrapper around a native checkbox); `.srow-wrap`, `.chart .tip rect` and `.chart .sheet` (containers);
    the three fixed bars (status, not controls; see Q4). `.auth` checkbox uses `--muted` (5.03/5.84), which is fine.
- Change: none if F-13 merges first. Merge-order guard: see Q5.
- AC13.1 (e2e, both schemes, after F-13 is on the base): for `input`, `.secondary` (pane, follow, more-menu) and
  `.more-menu summary`, the computed `border-color` against the parent background is ≥ 3 (expected 3.75/3.91 light,
  4.29/3.93 dark).
## #18 Reflow (WCAG 1.4.10, POLICY P2)
- Nav, measured with a 20-character handle `@abcdefghijklmnopqrst`:
  - Main at 320, 360 and 390: no overflow, nav 45 px.
  - F-13 alone (label "Trades by stock" plus its wrap rules): no overflow, but the signed-in nav is 71.5 px tall at
    360 ("Trades / by / stock" on 3 lines) and 66.9 px at 320. That is over F-13's own ≤ 56 px and covers about 8 px
    of the feed card (padding-top 64).
- Change (end block): `@media (max-width: 420px) { nav.top .me { max-width: 20vw; } }`.
  - With F-13 the nav becomes 55.7 px at 360/390/420 and 52.6 at 320, with 2-line links. The handle shows 64-84 px,
    with an ellipsis.
  - On main it has no visible effect, because the handle already flexes to about 68 px at 360.
- AC18.1 (e2e, signed in, 20-char handle, widths 320/360/390): `documentElement.scrollWidth ≤ innerWidth`. Headroom:
  the sum of the nav links' min-content widths plus gaps is ≤ 0.85 × the nav's content box (computed 0.68 at 360).
- AC18.2: nav height ≤ 61 px (72 × 0.85, the `scroll-padding-top`). Each link's bottom is ≤ the first card's content
  top, and the `.me` width is ≥ 48 px.
- h1, Demo badge and name row: F-13's `h1 { overflow-wrap: anywhere }`, `.card header .who` and the badge
  `flex-shrink: 0` fix them. The coordinator measured a 749 px page on main from a 20-char handle or a 40-char
  unbroken name. We copy these three lines identically (Q5).
- AC18.3 (e2e, 360 and 320, demo trader seeded with a 40-character unbroken display name): profile
  `scrollWidth ≤ innerWidth`, the `h1` right edge ≤ viewport − 16, and the Demo badge is fully inside the viewport
  and inside its card.
- Out of scope: the feed hero and card clipping at short heights (F-10).
## #17 Like button name
Done by F-13 (`aria-describedby`, visible text as the name). No change. No test here: F-13's `e2e/likes.spec.ts` holds it.
## Tests
- `lib/fixes-cycle2-a11y.test.ts` (node:test, no deps): it parses the tokens from `app/globals.css`, taking the last
  definition per scheme. It checks the WCAG contrast of AC26.1-3 and AC12.1, and that the end block exists and
  contains the `.hl`, `:has(` and `.me` rules.
- `e2e/fixes-cycle2-a11y.spec.ts`: AC12.2, 13.1, 14.1-4, 18.1-3 and 26.4, in both colour schemes where colour is
  asserted.
- Compliance (COMPLIANCE §1): no copy, data, vendor or dependency change. It is a CSS-only accessibility fix under
  POLICY A1, and nothing needs counsel.
## Open questions (each with a recommendation)
- Q1 #14: how should the card avoid the bar? Options: (a) conditional `padding-bottom` via `:has` (above); (b) render
  the bars inline (F-10's #15, not ours); (c) move the bar to the top. **Recommend (a).** It is CSS only, it does
  nothing when no bar shows, and `:has` is in every supported engine.
- Q2 #14: at 360×640 the extra 66 px can clip the card's last line. **Recommend:** accept it and assert only AC14.1
  at 640. Clipping at short heights is F-10's row #18 part, and F-13's `max-height: 480px` scroll rule covers ≤ 480.
- Q3 #26: how should the CVD ΔE00 be tested? Options: (a) port the 2009 matrices and CIEDE2000 into the unit test
  (about 60 lines); (b) pin the hex values and cite `tokens.py`. **Recommend (a).** A later retune cannot then pass
  without a re-run.
- Q4 #13: should the fixed bars' own border (`--line`, 1.04:1 surface fill over page content) move to `--control`?
  These are not controls, so 1.4.11 does not require it. **Recommend yes, as a one-line add.** It helps the bar read
  as separate from the content under it, and the cost is nil.
- Q5 merge order: should we copy F-13's identical lines (tokens, `h1`, `.who`, badge, the 26-selector `--control`
  rule)? **Recommend:** copy the tokens, `h1`, `.who` and badge lines byte-identical, so AC18.3 holds in either order.
  Do not copy the control list: gate AC13.1 with `test.skip` until `--control` is applied on the base.
- Q6 #12: the `.hl` row and the keyboard ring would both be solid `--focus`. **Recommend solid `--focus`**, as DS
  §5.1 gives the "you are here" role (`:target` bar) to `--focus`. Weight 600 tells the row apart. Fallback: dashed.
