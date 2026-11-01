# Round 2 changes (UX lead, 2026-11-01)

Chair rulings 1-5 are applied. All three files were revised in place. `trade_key` (`db/schema.sql:404`) is a generated
`sha256` of `sell_id`, and `sell_id` is reproduced by `rebuildTrades` from the same activities. So the key is stable
across rebuilds (`lib/likes.ts:3` already relies on that). F-25 keeps it as a decision and adds an AC that captured
trade URLs survive `rebuildTrades`.

## Business lead (r1-business.md)
1. Applied (chair ruling 1): `/u/<handle>/trade/<trade_key>`, 308 from `sell_id`, share image renders, no `sell_id` in any href or payload. This is in PR 1, which may split into 1a/1b above about 300 lines. It is not a separate F-28.
2. Applied in part. F-26 is named, for PR 2. F3-8 is not applied, per engineer 1: F-25 supersedes F3-8's stock-row naming, so waiting for F3-8 is waste.
3. Applied: AC1 lists every surface, checked by href through `tradePageHref`. The name-pattern AC covers only the five surfaces whose links show a signed figure (engineer 12). Likes, hidden, similar and the new-trades prompt were taken out of the "same name pattern" decision.
4. Applied.
5. Applied: the pane carries `trade_key` for 5 rows, and the AC says "a trade key for at most 5 rows".
6. Not applied as written, per chair ruling 2: F-26's Open questions holds the standing Q1 line instead of "None.".
7. Applied: the paging server-action responses are in the F-26 payload AC.
8. Applied: F-26 has a decision and an AC that `generateMetadata` and the image route read no session.
9. Applied: one `WarnNotice` component and one `.warn-notice` class, with the source test scoped to `.warn-notice` rules.
10. Applied: one warn notice per surface (decision and AC).
11. Applied in the engineer's form (chair ruling 4): there is a render test of every `--warn` use. The clause "F-20's test exempts only the named pair" is not applied, because no exemption exists.
12. Applied (Out of scope).

## Engineer (r1-engineer.md)
1. Applied, with F-26 added for PR 2 (business 2).
2. Applied (chair ruling 3), with the PR 1a/1b split allowed above about 300 lines (chair ruling 1).
3. Applied: the three e2e budgets pass unchanged, or the build stops and the feature returns to a committee.
4. Applied as decided by the chair. The visible texts are "This trade →" and "Their record, wins and losses →" (shortened so both fit at 360 px, about 300 px of 328 px). They share one line at ≥ 360 px and stack below that. The trade link never replaces the profile link, and the F-10 reversal option is not taken.
5. Applied, merged with a11y 3 (44 px tall at 320/360/780, and 44 × 44 for Shape C figures).
6. Applied. The narrowed selectors keep their destination assertions. The only change is the expected profile-link text, which this feature changes by decision.
7. Applied, with `trade_key` in place of `sell_id` (chair ruling 1).
8. Applied.
9. Applied (`lib/trade-href.ts`, including the trade page's own canonical and image URLs).
10. Applied: `tradePageHref({ handle, tradeKey })` takes the row's fields.
11. Applied.
12. Applied.
13. Applied.
14. Applied (chair ruling 2), in both F-25 and F-26.
15. Applied as an owner note, not a choice (chair ruling 1): with F-25 the "never shown" label is true again.
16. Applied: the comment now says hrefs carry the `trade_key`.
17. Applied.
18. Applied.
19. Applied (chair ruling 5).
20. Applied.
21. Applied as a merge-order decision. The Blocked line still names F-9 only.
22. Applied, in the chair's wording (F-20 and F-11's branch).
23. Applied (Why section and the warn decision; F-27 replaces F-11's `.warn` rule and `::before` glyph).
24. Applied.
25. Applied.
26. Applied (chair ruling 4).
27. Applied.
28. Applied: the conditional AC is deleted, and the open question says a yes becomes a dated decision with its own criteria before build.
29. Applied.
30. Applied (320×640, 360×640 and 780×360).
31. Applied, in F-27's Why. draft-notes.md is superseded by this file.
32. Applied, in F-27's warn decision (the three sources and values are named, and the rule does not depend on which value wins).

## Accessibility and legal (r1-a11y-legal.md)
1. Applied: `signWord` is in the Shape C name.
2. Applied: the feed link name and Shape R carry the sign word, with an AC for the sign word.
3. Applied, merged with engineer 5.
4. Applied (WCAG 2.5.2 AC).
5. Applied: decision and AC.
6. Applied (focus-ring AC).
7. Superseded by chair ruling 1. The URLs move to `trade_key`, which resolves the P6 mismatch, and the remaining owner note concerns label wording only.
8. Applied.
9. Applied: paging responses and `/u/<handle>/pane-chart` are in the list, along with the `thesis_status`/dates clause.
10. Applied (decision and AC).
11. Applied in the testable form (chair ruling 5): `generateMetadata` and the image read no session or hold field (source test), and the `og:image` URL is identical before and after the hold. Byte-identical image output is not asserted, because rendering is not guaranteed byte-stable across runs.
12. Applied (decision and query-log AC; counts exclude held notes).
13. Applied. The decision fixes one confirmation string ("Reported. Thank you.", F-9's `lib/report-copy.ts`) and adds a unit-test AC.
14. Applied as an owner question beside the hue question (chair ruling 4).
15. Not applied as worded. Chair ruling 4 sets the Blocked line to name F-20 and F-11's branch. F-27 itself needs no hue answer to build, so the dependency is stated in the second open question ("blocks F-20's build").
16. Superseded by chair ruling 4: there is no exemption, warn is not added to F-20's floor, and the usage render test replaces it.

Advisories taken:
- The "✓" in the Verified badge is now `aria-hidden` (F-25 decision and AC).
- The warn icon has `pointer-events: none` (F-27, with a double-tap AC).
- `role="status"` noise is logged in F-27 Out of scope.

Advisories not taken:
- The sr-only "held 3d" expansion: optional, listed in F-25 Out of scope.
- A Shape C underline or chevron: out of scope for a link rule; it belongs with the profile row's visual design.

## Round 3

Chair rulings for F-25 and engineer item 8 for F-27 are applied. F-26 is unchanged (signed by all three).

### Business lead (r2-business.md)
1. Applied, in the footer text the chair ruled. One dated decision in F-25 amends F-7 AC20. The text is "Record, wins
   and losses →" (not "Their record…"). F-7's file is not edited, and `PUBLIC.cardFooter` and `lib/f7-trust.test.ts:96`
   change with it.
2. Applied: one `lib/copy.ts` constant serves `app/ui.tsx` and `PUBLIC.cardFooter`, as a decision and a source-test AC.
3. Applied: `e2e/f10-followups.spec.ts:79` and `e2e/record-strip.spec.ts:121` are in the test-update AC.
   `e2e/record-strip.spec.ts:168` asserts zero links matching the old or the new text.

### Engineer (r2-engineer.md)
1. Applied in the chair's form. There is no F-28 and no PR split; the PR 1 / PR 2 / 1a / 1b decision is deleted. F-25 is
   one PR (about 315 product lines against the 800 product-line cap). Its Blocked line names F-9 (PR #65), F-11
   (`claude/fix-truthful-labels`) and F-26.
2. Applied. Content box is 320 px, footer 16 px today. The links are set at 0.875rem as "This trade →" and "Record, wins
   and losses →" (about 286 px in the e2e font, about 11% spare). They share one line at ≥ 360 px and stack below.
3. Applied. The redirect AC checks with `maxRedirects: 0` for the page and the image; an unknown segment, including
   another handle's `sell_id`, gets a 404 with no redirect. The decision puts the legacy lookup in the page body and
   the image route, never in `proxy.ts` or `generateMetadata`, with a source-test AC.
4. Applied: the `/me/record` reflection form posts `tradeKey`, and `app/actions.ts` resolves it by user and
   `trade_key`. This is a decision, and the page is in the leak AC.
5. Applied: the full list of tests to update (`lib/f7-trust.test.ts:96`, `e2e/f7-public-feed.spec.ts:52`,
   `e2e/fixes-cycle2-a11y.spec.ts:288`, `e2e/f10-followups.spec.ts:79`, `e2e/record-strip.spec.ts:121`), plus the
   `:168` count-zero AC, which still fails if the duplicate comes back.
6. Applied: the budget decision and AC cover page 1's first card after the first-visit line is dismissed, when the
   swipe hint shares the footer line.
7. Applied: `e2e/app.spec.ts:519` uses the `trade_key` href form; `:413-418` are unchanged.
8. Applied (F-27): the `--warn` usage check is now an e2e computed-style scan of the card, pane, profile and trade page,
   in light and dark. The decision text is updated to match.
- Advisory taken: the `[sellId]` folder name stays (decision; the rename is listed under Out of scope).

### Accessibility and legal (r2-a11y-legal.md)
1. Applied: in F-25's privacy decision, `lib/privacy-fields.ts` relabels `closed_trades.trade_key` as "key (hash of
   sell_id; shown in trade-page URLs)". `sell_id` keeps "never shown", and the consent line is unchanged. There is an
   AC on `lib/privacy-fields.test.ts`.
- Advisory not taken: a salted key. Vendor ids are high-entropy and no non-demo user exists yet. To revisit if a vendor's
  ids are guessable.
