# Round 1 review: accessibility and legal (2026-11-01)

Reviewer: accessibility/legal member of the design council (POLICY binding, COMPLIANCE §1, WCAG 2.2 AA).
Read against main 06edbdf, F-9 branch `claude/fix-user-text-safety` (heldLine wording checked), F-20 file.
No repo file was edited.

## Verdicts

| File | Verdict |
|---|---|
| F-25-one-link-rule-for-trade-rows.md | SIGN WITH CHANGES (1-7) |
| F-26-no-empty-note-line.md | SIGN WITH CHANGES (8-13) |
| F-27-colour-follow-ups.md | SIGN WITH CHANGES (14-16) |
| draft-notes.md | SIGN (working notes, not shipped; no blocking finding) |

## Scanner and wording check

I ran the drafts through `scripts/compliance.ts` exports (`MARKS`, `MINORS`, `PROMO`, plus the `LOCAL_PATH` rule).
None of the four files has a hit. A wider word check found "Every trade row" (F-25 l.14, 90, 99) and "advice"
(F-25 l.102, the copy-test AC). Both are spec wording about link structure. Neither claims completeness or gives
advice, so they need no change (docs are not PROMO-scanned). There are no third-party names, no real people and no
age cohorts. The heldLine wording quoted in F-26 matches F-9's branch (`lib/report-copy.ts:36-43`).

Verified figures: the dark image pair #3cc4b4 / #ff8a5b on #0b0b0f is 9.12:1 and 8.46:1 (correct). `--control` is
#6f7682 at 3.75-4.29:1 (correct, globals.css:615-617). Light warn #8a5a00 is 5.93:1 on #fff and 5.68:1 on #fafafa.

## F-25: one link rule

Good: there are no nested links, and Shape R has no `aria-label`, so the name starts with the visible text (2.5.3).
The badge word stays inside the name (P2). Links are already `NOT_TAP` (`lib/discovery/gestures.ts:10`), so F-2's
gestures are kept. No new `data-*` carrier for `sell_id`. The pane payload is capped at 5 rows. The 44 px height AC
is present.

Findings:
- **Losses must be announced as losses (A1, 1.3.1).** The month page and the trade page already put an sr-only
  `signWord()` ("Gain"/"Loss"/"Flat") before `pct()`. F-25's names ("‹SYMBOL› ‹signed %›, open trade page",
  "See this trade: ‹SYMBOL› ‹signed %›") rely on the printed sign alone. F-19 will move that sign to U+2212, which
  several screen readers skip, so a loss would then be read as a bare number. All three name patterns need the sign
  word.
- **Target width (2.5.8, design system 44 px).** Shape C's `.trade-link` has `min-height: 44px` but no minimum width.
  A short figure ("0.0%", "+1.2%") is about 35-45 px wide. The AC checks height only.
- **Pointer cancellation (2.5.2) and the swipe-on-link decision.** The decision says a swipe that starts on
  "See this trade →" never follows the link, but no AC tests it. The pane's Shape R rows sit inside the swipeable
  `.row` too.
- **`aria-current` placement.** It is on the `<li>` today (`app/pane.tsx:87`). Once the row is a link it must sit on
  the `<a>`, or screen readers won't announce it. "Keeps `aria-current`" is ambiguous.
- **Whole-row focus ring.** Shape R rows are block or flex links. The ring must be visible around the whole row and
  not clipped by the pane's overflow (2.4.7/2.4.11). There is no AC for this.
- **sell_id (privacy, P3/P6, FTC §5).** `lib/privacy-fields.ts` lists `closed_trades.sell_id` as "never shown", and
  the consent screen's scope line is held equal to that list (`lib/privacy-fields.test.ts`, owner copy). Every
  existing trade URL already publishes it. The ids F-25 adds to the feed card and the pane are already public in
  profile HTML, so F-25 adds no new exposure and need not block. But the open question is framed as an optional
  nice-to-have. It is really a mismatch between what traders are told at consent and what is public, so it is a P6
  gate before any non-demo user connects. Changing either the consent copy or the URL scheme is the owner's call.
- Advisory, not required: the "✓" in "✓ Verified" (`app/ui.tsx:20`) should be `aria-hidden` so Shape R names don't
  read "check mark". Symbols don't count toward 2.5.3. "held 3d" in Shape R names now reads raw, where today's
  stock-page `aria-label` said "held 3 days". An sr-only expansion is optional. Shape C's figure has no visible link
  affordance (colour inherit, no underline), so a chevron or underline would help discoverability. The notes list's
  Shape R name includes up to 280 characters of user text before the suffix. That is acceptable (same as main), but
  the name is long.

## F-26: no empty-note line

Good: removal is the only option that is true for both held and none. It treats viewers identically in payloads,
not only in rendering. The author is told wherever there is a slot (U1 "never silently dropped"). The held line is
neutral, not loss/warn. "No thesis posted." exists in no test file, so removing it weakens no test. The open
question on the three-version rule is correctly left to the owner (Q1).

F-9 semantics gaps (viewers must not learn a note was held):
- **Other note fields.** The decision bans "held note text and its hold rule", but F-9 also adds `thesis_written_at`
  and `thesis_edited_at`, a report control, and `thesis_status` itself. The feed passes raw `thesis_status`
  (`app/feed-rows.tsx:55`). Any of these reaching a viewer leaks the hold.
- **Appended pages and JSON routes.** The payload AC lists the feed HTML, `/u/<handle>/pane`, profile and trade page.
  It omits the feed's paging server-action responses (`app/feed-actions.tsx`) and `/u/<handle>/pane-chart`, which
  is publicly cached for 60 s.
- **Caching.** An author-only held line must never land in a shared cache. The pane routes are
  `public, max-age=60`. Any response containing `heldLine` must be per-user and uncacheable.
- **Share image and metadata.** `lib/trade-share-load.ts` is "the only query behind the trade page and card". The
  decision gives it an author branch. The OG image and `generateMetadata` must never take that branch, and the image
  must be byte-identical for held and none. The current AC checks only that the marker string is absent.
- **Timing and counts.** For a viewer request, the queries must be the same for held and none: one SQL
  `case when thesis_status='published'` with no extra hold-rule lookup. No count on any surface (theses count,
  "Showing N", hidden/likes counts) may include held notes.
- **Report path.** F-9's report confirmation must be the same text whether or not that report reached the hold
  threshold. A held note then looks to every viewer, the reporter included, like a note its author removed.
- Advisory: the "Edit it on your profile" link on the trade page is fine for every rule. For `KEPT_RULE`, heldLine
  already says an edit does not publish, so the link text needs no change.

## F-27: colour follow-ups

Good: the baseline on `--control` meets 1.4.11. The failed-import line no longer uses the loss colour, and it carries
icon, box and words with the text in `--text` (1.4.1). `--warn` has one meaning. The image hues are correctly left to
the owner (F-20's "No image colour value changes", O-2). A 1 px `--warn` border at ≥ 3:1 is enough of a box, because
the words carry the meaning and the icon is decorative. A tint is not needed.

Findings:
- **F-20 cannot pass as decided if the owner says no.** F-20 decides "Images are not exempt" from the colour-blind
  floor (ΔE00 ≥ 9 under protan, deutan and tritan, never lowered). It also requires that the image table "equal
  today's image colours". The old dark image pair is 6.3 ΔE00 under deutan, so those two F-20 ACs contradict each
  other. F-27's fallback ("If the owner says no or does not answer, images keep today's values") leaves F-20 unable
  to go green. A builder must not resolve that by lowering the floor or exempting images. Only the owner can make
  that call. The open question has to say so, and it blocks F-20's build too, not only F-27's conditional AC.
- **Warn vs loss is not a pair in F-20's floor.** F-20's floor is gain-versus-loss only. "Lists warn vs loss as the
  one pair below ≥ 9 … exempt" reads as if F-20's floor covered every pair and F-27 carved out an exemption. It
  should be phrased as an added check with its own redundancy condition.
- Advisory: the warn icon is an `<svg>`, and `svg` is in `NOT_TAP`. A double tap that lands on the icon will not
  like the card. `pointer-events: none` on the icon keeps F-2's gesture area whole. The existing `role="status"` on
  every failed card is out of scope but noisy on appended pages, so log it for F-20/F-11.

## Required changes

1. F-25, Shape C decision: replace the name with `TRADE_LINK.name(symbol, pct)` = "‹SYMBOL› ‹Gain|Loss|Flat› ‹signed %›, open trade page" (sign word from `signWord`, as on the month and trade pages).
2. F-25, feed-card decision: replace the accessible name with "See this trade: ‹SYMBOL› ‹Gain|Loss|Flat› ‹signed %›". For Shape R, add "rows that print a return carry the sr-only `signWord` before it, as the month page does". Add the AC "- [ ] Every trade link's accessible name contains the sign word (Gain, Loss or Flat) matching `tone()` of its figure (e2e, one loss row per surface)."
3. F-25, ACs: change "at least 44 px tall" to "at least 44 × 44 px (computed box) at 360 px, including a Shape C figure of '0.0%'".
4. F-25, ACs: add "- [ ] A swipe that starts on 'See this trade →' or on a pane row link opens the pane or rejects as before and never navigates; a pointer that moves off a link before release does not follow it (WCAG 2.5.2, e2e)."
5. F-25, Pane decision: replace "the highlighted row keeps `aria-current`" with "the highlighted row's link carries `aria-current=\"true\"` (moved from the `<li>`)", and add a matching AC.
6. F-25, ACs: add "- [ ] Each Shape R link shows a focus ring around the whole row, not clipped by its container, in light and dark (e2e screenshot on stock page and pane)."
7. F-25, Open questions: replace the sell_id question with: "Owner (P6, before any non-demo user connects): `lib/privacy-fields.ts` and the consent screen's scope line call `closed_trades.sell_id` 'never shown', yet every trade-page URL has carried it since before F-25. Either the URLs move to `trade_key` (with a redirect from the old form) or the consent copy names it. The consent copy is the owner's. F-25 adds no id that is not already public in profile HTML and does not wait."
8. F-26, the Viewers decision: replace "Held note text and its hold rule are never sent to a viewer" with "Held note text, its hold rule, its written/edited dates, its report state and any `thesis_status` other than 'published' or null are never sent to a viewer, in HTML, RSC payload, JSON or metadata".
9. F-26, payload AC: extend the list to "the feed page HTML and its paging server-action responses, `/u/<handle>/pane` and `/u/<handle>/pane-chart` JSON, …", and add "and no viewer payload carries `thesis_status: 'held'` or F-9's note dates for a held note".
10. F-26, ACs: add "- [ ] Any response that contains `heldLine` text is sent with `Cache-Control: private, no-store`; the publicly cached pane routes and every OG image never contain it (e2e header check)."
11. F-26, ACs: add "- [ ] The trade page's OG image and `generateMetadata` never read the session or the hold rule; the image bytes are identical for a held note and no note (test)."
12. F-26, ACs: add "- [ ] For a viewer, the feed, pane, profile and trade page run the same queries for a held note as for no note (query-log test), and no count shown to viewers includes held notes."
13. F-26, decisions: add "F-9's report confirmation is the same whether or not that report reached the hold threshold, so a held note looks to every viewer, the reporter included, like a note its author removed", with an AC that tests it.
14. F-27, Open questions: add "If the owner says no, F-20 as decided cannot pass: its colour-blind floor covers images ('Images are not exempt') and the old dark image pair is 6.3 ΔE00 under deutan, while its table must equal today's values. The owner must then choose between a named image exemption recorded in F-20 and the hue change; no builder lowers the floor or exempts images."
15. F-27, Blocked line: add the dependency on the owner's answer: "Blocked: waits for F-20 (design tokens and contrast test), whose build in turn needs the owner's answer to the share-image hue question below."
16. F-27, colour-blind decision: replace "F-20's colour-blind test lists warn vs loss as the one pair below ≥ 9 ΔE00, exempt only because…" with "F-27 adds a warn-versus-loss check to F-20's colour-blind test: below ΔE00 9 under deutan, so it passes only while every warn use carries the icon, box and words (proved by the usage test below); the gain-versus-loss floor is untouched."
