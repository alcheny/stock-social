# F-27 · Colour follow-ups: chart baseline, warn notice, share-image hues

Status: blocked
Blocked: waits for F-20 (design tokens and contrast test; its build session owns the `app/globals.css` tokens, including `--warn`, and the share-image colour table) and F-11 (branch `claude/fix-truthful-labels`, which moves the failed line to `.warn` and defines `--warn`) to merge into main

## Why
PR #71 (merged as 06edbdf) retuned gain and loss for colour blindness (light #0b6b70 / #b2441b, dark #3cc4b4 /
#ff8a5b) and left three follow-ups (`docs/features/logs/fixes-cycle2-a11y/committee-2026-11-01.md`, "Follow-ups owned
elsewhere"). First, the stock-page charts draw their bar baseline in `--line` (1.20-1.31:1). Second, the warn colour
sits close to the new loss colour under deutan. Third, the dark share images still use the old gain/loss hues, so a
share card and the page it opens show different colours for the same meaning. On main, the failed-import line is
loss-coloured text. F-11's branch makes it warn-coloured text with a "⚠︎" CSS glyph (`.record-failed::before`), which
is still told apart from a loss mainly by hue.

## Decisions
- 2026-11-01: The bar baseline `<line>` (y = BASE) in `app/t/[symbol]/Spread.tsx` and `app/t/[symbol]/Timeline.tsx` is
  drawn in `var(--control)` (3.75-4.29:1 against bg and surface on main), not `var(--line)`. The following keep their
  colours:
  - separators, card borders and tile borders: `--line`;
  - Spread's vertical 0% line: `var(--text)`;
  - empty-bin and flat ticks: `--muted`.

  Why: decided by the committee under the owner's instruction of 2026-11-01; A reader needs the baseline to read bar
  height and the up/down split, so it needs 3:1 (WCAG 1.4.11), and DS-2 puts such lines on `--control`.
- 2026-11-01: The failed-import line is never told apart from a loss by colour. It is one component, `WarnNotice` in
  `app/`, with one class, `.warn-notice`, used at all four sites: the feed card (`app/ui.tsx`), the pane
  (`app/pane.tsx`), the record strip (`app/record-strip.tsx`) and the profile (`app/u/[handle]/page.tsx`). It has:
  - an icon: an inline SVG warning triangle with an exclamation mark, `aria-hidden`, `pointer-events: none`, stroked
    in `--warn`;
  - a box: a 1 px `--warn` border on `--surface`, small radius, 8 × 12 px padding;
  - its unchanged words in `--text`: `RECORD_BODY.failed` on the card, pane and profile, the strip's `note` on the
    record strip, and the profile's retry button for the author.

  The `.record-failed` class stays (for `e2e/connect.spec.ts`). The `down` class (main) and F-11's `.warn` rule and
  `::before` glyph on it are replaced by the notice. `role` stays as today. Why: decided by the committee under the
  owner's instruction of 2026-11-01; Warn (#8a5a00 in the design system; F-11's branch uses #92400e / #fbbf24, and F-20
  pins one) sits 3.2 ΔE00 from loss under deutan at the design-system value. The design system's rule (§2.7, DS-17) is
  that warn is carried by icon, box and words, never by hue alone. This rule holds whichever warn value F-20 pins. The
  icon ignores pointer events, so a double tap on it still likes the card (F-2).
- 2026-11-01: A failed record shows exactly one warn notice per surface. The feed card's line and the record strip's
  note never both render on one card, pane or trade page. Why: decided by the committee under the owner's instruction
  of 2026-11-01; a duplicated box doubles its height cost and repeats the message.
- 2026-11-01: `--warn` is used only inside `.warn-notice` rules. F-9's held-note line stays neutral and never uses
  `--warn` or `--down`. Why: decided by the committee under the owner's instruction of 2026-11-01; This follows F-9's
  decision ("neutral tone, never the loss colour") and keeps one meaning per colour; DS-17's later sites reuse the
  class.
- 2026-11-01: No colour-blind exemption is added. F-20's colour-blind floor stays gain versus loss (and Flat) only;
  warn is not added to it and no exemption list exists. Instead, an e2e computed-style scan (card, pane, profile,
  trade page; light and dark) asserts that every element drawn in `--warn` sits in a `.warn-notice` holding
  `[data-warn-icon]` and visible words. Why: decided by the committee under the
  owner's instruction of 2026-11-01; An exemption list is the mechanism F-20 forbids, and the usage test proves the
  redundancy directly.
- 2026-11-01: This feature changes no share-image colour. The move of the dark images' gain/loss hues is recommended
  to the owner (open questions), not decided here. F-20 decided "No image colour value changes (card Demo hue O-2 is
  the owner's)", and that covers every image colour value, gain and loss included. Why: decided by the committee
  under the owner's instruction of 2026-11-01; the committee may not reverse a decided rule (F-20, approval councils
  cycles 2 and 3).
- 2026-11-01: Sequencing: built after F-20 and F-11's branch merge, as one PR on F-20's token layer. It adds no token
  and changes no token value. Why: decided by the committee under the owner's instruction of 2026-11-01; F-20 owns the
  tokens and the image table, and F-11's branch rewrites the same four failed-line sites and both chart files.

## Acceptance criteria
- [ ] The bar baseline `<line>` in `Spread.tsx` and `Timeline.tsx` has `stroke="var(--control)"`, and no chart
      baseline in `app/t/[symbol]/` uses `var(--line)` (source test). Its computed stroke equals `--control` in light
      and dark (e2e on a demo stock page).
- [ ] `lib/a11y-contrast.test.ts` #14 (`--control` ≥ 3:1 on bg and surface, both schemes) passes unchanged.
- [ ] At each of the four failed-import sites, the rendered line is one `WarnNotice` with:
      - an `aria-hidden` icon (`[data-warn-icon]`) with `pointer-events: none`;
      - a box whose computed border colour is `--warn`;
      - its unchanged words (`RECORD_BODY.failed` on card, pane and profile, the strip's `note` on the strip) in
        `--text`;
      - no `down` or `.warn` class and no `::before` glyph.

      Render tests, plus e2e with a seeded failed record in light and dark.
- [ ] An e2e computed-style scan of a failed record's feed card, pane, profile and trade page, in light and dark, finds
      every element whose computed `color`, `border-*-color`, `outline-color`, `background-color`, `fill` or `stroke`
      equals `--warn` inside a `.warn-notice` that holds
      `[data-warn-icon]` and visible words.
- [ ] In `app/globals.css`, `var(--warn)` appears only inside `.warn-notice` rules (the `--warn:` definition is not a
      use), and no `.tsx` inline style uses `var(--warn)` (source test).
- [ ] No element with the held-note class carries the `down` class or `.warn-notice` (render test).
- [ ] F-20's colour-blind test still covers gain, loss and Flat only, with no exemption list (source test on the test
      file).
- [ ] A failed record's feed card, pane and trade page each render exactly one `.warn-notice` (render tests).
- [ ] The warn border is ≥ 3:1 against `--surface` and the notice text ≥ 4.5:1, in both schemes (contrast test).
- [ ] A double tap that lands on the warn icon on a failed record's card still likes it (signed in) (e2e).
- [ ] At 320×640, 360×640 and 780×360, the F-10 15% headroom check and the disclaimer check pass unchanged for a
      failed record's card (the box adds about 18 px) (e2e).
- [ ] No share-image colour value changes in this feature: F-20's image-table pin still passes.

## Out of scope
- Any token value change (F-20, V-1), the Demo hue on images (O-2), a light share-image palette (DS-6's light half).
- The share image's own `warn` tone (`lib/record-strip.ts` note lines) and every other image colour (owner question
  below).
- The warn notice on sign-in and form errors (DS-17's other sites; they reuse `.warn-notice` later).
- The image's own failed state: it already carries the words "Import did not finish" (`lib/copy.ts`
  `SHARE_CARD.failed`).
- `role="status"` on every failed card announcing on appended pages (logged for F-20 and F-11).

## Open questions
- Owner (the same question as F-20's OQ-1 on `claude/f20-design-tokens`; one answer settles both): may the dark
  share images move gain/loss from #22c55e / #f43f5e to the page's #3cc4b4 / #ff8a5b? The values
  live in `lib/record-strip.ts` `IMAGE_COLOURS` and `app/u/[handle]/record-card-image.tsx` `C`, or in F-20's single
  table once built. **The committee recommends yes:**
  - the share card and the page it opens then use one colour per meaning;
  - the new pair is 20.1 ΔE00 apart at the worst deficiency, where the old dark pair is 6.3 under deutan;
  - on today's card background #0b0b0f the new pair measures 9.12:1 and 8.46:1.

  The table's `ok` key (also #22c55e, the Verified tone) would stay unless the owner says otherwise. A yes becomes a
  dated decision with its own criteria, added to this file before build: the image table equals the page tones, a
  parity test, and ≥ 4.5:1 on the image background. A no or no answer changes nothing in this feature.
- Owner (blocks F-20's image criterion, not F-20's whole build; F-20's branch carries it as a `todo` test under
  OQ-1): if the owner says no to the hue change, F-20 as decided cannot
  pass. Its colour-blind floor covers images ("Images are not exempt", ΔE00 ≥ 9, never lowered). The old dark image
  pair is 6.3 ΔE00 under deutan, while F-20's table must equal today's values. The owner must then choose between:
  - a named image exemption recorded in F-20;
  - the hue change above.

  No builder lowers the floor or exempts images.

## Rework notes

## Build log
