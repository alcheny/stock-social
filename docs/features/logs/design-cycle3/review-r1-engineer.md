# Design council cycle 3, round 1: engineer review (2026-11-01)

Reviewed against main 06edbdf, `origin/claude/fix-user-text-safety` (F-9, PR #65) and `origin/claude/fix-truthful-labels`
(F-11, F3-8 slot). Docs-only. No repo file was edited.

| File | Verdict | Size if built as written / as amended |
|---|---|---|
| F-25 one link rule | SIGN WITH CHANGES | ~360 changed lines as one PR (too close to 400). Amended: two PRs, ~210 + ~150 |
| F-26 no empty-note line | SIGN WITH CHANGES | ~230 (code ~70, tests ~160) |
| F-27 colour follow-ups | SIGN WITH CHANGES | ~150 (code ~45, tests ~105) |
| draft-notes.md | SIGN (notes, not shipped), with two factual corrections | n/a |

## What I checked in the code

**Feed card (`app/ui.tsx`)**: the card is a server component. `feed-rows.tsx` builds `TradeRow` without `sell_id`, but
`page.cards` already holds `sell_id` from the page's row query (`lib/feed.ts` ~L396). So the server can build the
card's trade href with no new query. The draft's "href from the server, no `data-*`" is free.

**Gestures (`app/feed-gestures.tsx`, `lib/discovery/gestures.ts`)**:
- Double tap: `onDown` drops any press that starts inside `NOT_TAP` (`a`, …). A footer link can't start or finish a
  like.
- Reject swipe: `onTouchStart` arms on any target inside `.card`, links included, and `onTouchMove` calls
  `preventDefault`, so the browser fires no click. A swipe that starts on the link rejects and does not navigate.
- SW-1: native horizontal scroll. A pan never clicks.

The draft's gesture decision is correct and testable with the existing touch helpers. Pane rows are in the pane, outside
`.card`, so no card gesture applies to them.

**The real risk is the card's height budget, not gestures.**
- Today's footer link is inline text (`.card footer a` has no `min-height`). The swipe hint was deliberately put
  inline on that line "so it adds no height".
- Card 1's note is hidden while the first-visit line shows, to keep F-10's 15% headroom
  (`app/globals.css` ~L593-600).
- Three e2e checks enforce this and would catch a regression:
  - `e2e/record-strip.spec.ts` AC8: 15% headroom at 320×640, 360×640 and 780×360, using a 280-character note plus the
    open line;
  - `e2e/fixes-cycle2-a11y.spec.ts`: need ≤ 0.85 room, and every focusable ≥ 8 px above the sign-in bar;
  - `e2e/a11y-feed.spec.ts`: the footer link in view.

Adding a second footer link at 44 px, plus making the existing link 44 px tall as the AC requires, adds about 60-70 px
at 320-360 px wide. At 360 px the two links can't share a line: about 357 px of text at 14 px against 328 px of content
width. F-26's saving (one 18 px line) only applies to cards without a note, and the AC8 fixture has a note. **The draft
claims the space is paid for. It is not, for noted cards.** I would not stake my name on this passing without a
measured fallback that the committee decides now.

**Existing tests that a second footer link breaks in Playwright strict mode, or whose meaning changes.** These need
narrowing to the profile link, not weakening:
- `e2e/f7-public-feed.spec.ts:52-53` (`footer a` with an exact text and href);
- `e2e/fixes-cycle2-a11y.spec.ts:282` (`footer a` `.first()` would become the trade link), `:288`, `:294`, `:330`,
  `:359-361`;
- `e2e/a11y-feed.spec.ts:174`;
- `e2e/connect.spec.ts:663` (stock rows `a.trow[href="/u/${handle}"]` exact: the destination changes by decision).

The ACs must name these so the build is not flagged as weakening tests.

**Pane `sell_id` for 5 rows: query cost.**
- `records1` already reads every close of every page trader in one aggregate per half. `paneSummary.recent` is
  "first 5 in input order", and the input order is `closed_at desc, id desc`.
- Cheapest exact approach, with zero new statements: add a correlated subquery column to records1's existing statement:
  `(select array_agg(s.sell_id) from (select sell_id from closed_trades c where c.user_id = closed_trades.user_id order by closed_at desc, id desc limit 5) s) as s5`.
  It uses the `closed_trades_user (user_id, closed_at desc)` index. Same ordering, so the same 5 rows, attached to the
  first 5 parsed rows per user.
- `/u/<h>/pane` calls `records()`, so it gets the ids for free.
- Not `array_agg(...)[1:5]` over the whole record: that builds a 50k-element array per heavy trader.

**Trade URL builders that the "one helper" source test will hit** (all must move, or the test fails):
- `app/me/hidden/page.tsx:35`, `app/me/likes/page.tsx:31`, `app/t/[symbol]/Theses.tsx:26`;
- `app/u/[handle]/new-trades-prompt.tsx:32`, `app/u/[handle]/month/[ym]/page.tsx:52`,
  `app/u/[handle]/similar-section.tsx:33`, `app/u/[handle]/page.tsx:356`;
- the trade page's own canonical and image URLs, `app/u/[handle]/trade/[sellId]/page.tsx:39,52`.

**`sell_id` exposure.**
- `lib/privacy-fields.ts` labels `closed_trades.sell_id` "never shown". That label is already false: every profile row
  (50 per window), the likes, hidden, similar and month pages, and the trade page's canonical and image URLs carry it.
- F-25 adds it to the feed HTML (30 cards) and 5 pane rows per trader. It is the same kind of exposure, slightly
  easier to scrape.
- It is an opaque vendor activity id. It is useless without our client credentials and the user's encrypted secret.
  Its only risk is as a stable cross-service correlation key, and a wrong privacy label.
- `trade_key` (sha256 of `sell_id`, indexed) already exists, so a later move to it is a one-helper change plus a
  redirect route, provided every caller goes through `tradePageHref`. I agree with not blocking on it. The helper's
  signature should make the later swap local.

**F-26 feasibility.**
- Viewer-side it is cheap: `thesisLine` renders null, and `loadFeedPage`'s row query nulls the note and status unless
  published.
- Author-side:
  - the hold rule is read only when `t.user_id = opts.viewer`;
  - the trade page already reads the session (`me`);
  - "Edit it on your profile" needs the row's list index for `lib/paging.ts#tradeHref`: one `count(*)` on
    `(closed_at, id) >` for the author only.
- `lib/trade-share-load.ts` nulls held text in SQL. The author variant must be a separate call, never the one used by
  `generateMetadata` or the image.
- `feed.signed-out.test.ts` is unaffected: no viewer table is read.

**F-27 vs the F-11 branch.** `claude/fix-truthful-labels` already:
- moves all four failed-line sites from `down` to a `warn` class: `app/ui.tsx:65`, `app/pane.tsx:60`,
  `app/record-strip.tsx:31` and `app/u/[handle]/page.tsx:209`;
- defines `--warn` itself, as dark `#fbbf24` / light `#92400e`, which is **not** the design system's
  `#8a5a00` / `#f2b84b`;
- adds a `.record-failed::before` "⚠︎" glyph, with the text in the warn colour.

So:
1. F-27 must wait for that branch as well as F-20.
2. F-27 must say it replaces the branch's `.warn` rule and `::before` glyph.
3. The 3.2 ΔE00 figure belongs to `#8a5a00`. Which `--warn` value F-20 pins is unresolved between two sources.
   F-27's rule (icon, box, words) is value-independent, which is good, but the file should not quote one value as fact.

Also on F-27:
- The strip's line text is `strip.note`, not always `RECORD_BODY.failed`.
- `lib/a11y-contrast.test.ts` #14 already asserts `--control` ≥ 3:1 on bg and surface in both schemes, so that AC is
  redundant.
- F-20's colour-blind floor covers gain vs loss (and Flat) only. Warn is not in it, so no "exemption" is needed.
  Adding an exemption list creates exactly the mechanism F-20 forbids.

**`Blocked:` lines.**
- `scripts/features.ts#blockedOn` takes the first `^Blocked:\s*(.+)$` line. It is display-only, and nothing
  auto-unblocks.
- All three drafts are single-line and parse.
- F-25's line makes F-25 wait on F3-8 being built, and F-25 supersedes F3-8's stock-row naming. Waiting for work that
  will be overwritten is waste.

## Required changes (numbered, one sentence each)

### F-25
1. Replace the `Blocked:` line with: `Blocked: waits for F-9 (PR #65, \`claude/fix-user-text-safety\`), F-11 (branch \`claude/fix-truthful-labels\`, no open PR) and F-26 to merge into main; it does not wait for F3-8, which it supersedes for the stock-page rows`.
2. Add a decision: "F-25 ships as two PRs. PR 1 is `TRADE_LINK`, `tradePageHref` and every non-card surface: pane, stock page, notes list, month page, profile and the existing callers. PR 2 is the feed card's footer link. PR 2 builds after F-26 merges." Why: about 360 lines as one PR, and only PR 2 carries the height-budget risk.
3. Add to the feed-card decision: "The footer's two links share one line where they fit and wrap only where they don't. No fit threshold is relaxed: `e2e/record-strip.spec.ts` AC8 (15% headroom at 320×640, 360×640, 780×360), `e2e/fixes-cycle2-a11y.spec.ts` (need ≤ 0.85 room, every focusable ≥ 8 px above the sign-in bar) and `e2e/a11y-feed.spec.ts` (footer link in view) pass unchanged with a 280-character note. If any would need loosening, the build stops and returns to the committee."
4. Add the decided fallback for change 3, for the business lead to confirm: "If the budget fails, the visible profile link becomes 'Their record, wins and losses →' and the trade link 'This trade →' (accessible names unchanged in pattern), on one line at ≥ 360 px." The alternative fallback is that the trade link replaces the footer's profile link, since the header name already links to `/u/<handle>`. That reverses an F-10 decision and must be said so explicitly.
5. Replace the AC "Every trade link and the feed footer's two links are at least 44 px tall at 360 px" with: "Every trade link and the feed footer's two links have a computed hit box at least 44 px tall at 320, 360 and 780 px widths (e2e), and the card budget checks in change 3 pass unchanged."
6. Add an AC: "Existing e2e selectors that mean the card's profile link (`e2e/f7-public-feed.spec.ts:52-53`, `e2e/fixes-cycle2-a11y.spec.ts:282,288,294,330,359-361`, `e2e/a11y-feed.spec.ts:174`) are narrowed to `footer a[href="/u/<handle>"]` with their assertions unchanged, and `e2e/connect.spec.ts:663` asserts `a.trow[href^="/u/<handle>/trade/"]` (destination changed by this feature)."
7. Replace the second sentence of the pane `sell_id` decision with: "`lib/feed.ts#records1` adds one column to its existing statement, a correlated `limit 5` subquery over `closed_trades_user` in the list order (`closed_at desc, id desc`), so the feed adds no statement, `/u/<handle>/pane` gets the same five ids through `records()`, and `PaneTrade` gains an optional `sellId`."
8. Change the AC "The feed page's query count does not grow with the number of cards" to: "The feed page issues the same number of SQL statements as before this feature for 1 and 30 cards (statement-count test on `loadFeedPage`), and the F-10 load test passes."
9. Change the source-test AC to: "Every trade-page URL in `app/` and `lib/`, including the trade page's own canonical and `opengraph-image` URLs, comes from `tradePageHref` (source test: no `/trade/${` template outside `lib/trade-href.ts`)."
10. Add to the "Where the rule lives" decision: "`tradePageHref({ handle, sellId })` takes the row, not a string, so a later move to `trade_key` changes only the helper and adds a redirect."
11. In the pane decision, replace "the highlighted row keeps `aria-current`" with "the highlighted row's link carries `aria-current="true"`" (on the `<li>` it isn't announced with the link).
12. Replace "the others keep their destination and get the same name pattern where they show a symbol and figure" with "likes, hidden trades, similar trades and the new-trades prompt keep their destination and names and switch to `tradePageHref`". There is no AC for the renaming, and those links don't show a signed figure inside the link.
13. In the stock-page decision, add: "The notes list's row link keeps F-9's layout (the note and its Report control sit after the link, not inside it), so a Shape R notes-row name is handle, badge, figure and date plus the suffix, not the note text."
14. Add to Open questions: "Process (owner Q1): as F-26." Both are product changes, and they should carry the same three-version caveat or neither should.
15. In the `sell_id` open question, add: "`lib/privacy-fields.ts` labels `closed_trades.sell_id` 'never shown', which is already untrue for every profile row and trade URL; the owner's answer should also correct that label."
16. Rewrite the feed-rows comment "the close's vendor id stays on the server" as an AC: "the comment in `app/feed-rows.tsx` is updated to 'no `data-*` attribute or client prop carries the close's vendor id; only the trade href does'".

### F-26
17. Change the 360×640 first-screen AC to: "At 320×640, 360×640 and 780×360 the F-10 headroom and disclaimer checks pass unchanged for a card with no note, with a 280-character note, and for the author's held card (the held line is about 130-150 characters at 13 px, 3-4 lines at 320 px)."
18. Add to the "Where it lives" decision: "both `loadFeedPage` statements that select `thesis` (the candidate statement and the page row statement) return `thesis` and `thesis_status` as null unless published, and `thesis_hold_rule` only where `t.user_id` equals the signed-in viewer; `TradeCard` gets an `ownHeld?: string | null` prop rather than reading a status."
19. Replace the AC "The trade page for a viewer is byte-identical…" with: "For one seeded trade, the trade page's `<main>` HTML, `<title>`, meta description and `og:image` URL fetched by a viewer are identical before and after its thesis is set to held (e2e, same viewer, per-request tokens stripped)."
20. Add to the trade-page bullet: "the edit link's window comes from one `count(*)` of the author's closes ahead of this one in list order, run only for the author; `generateMetadata` and the image never call the author loader".
21. Keep the `Blocked:` line as is (F-9 only). Add one sentence under Decisions: "Built after F-11's branch merges if both are pending, since both edit `app/ui.tsx`, `lib/feed.ts`, `lib/trade-share-load.ts` and the trade page" (a merge-order note, not a block).

### F-27
22. Replace the `Blocked:` line with: `Blocked: waits for F-20 (build starting, no PR number yet: it pins \`--warn\` and the share-image colour table) and F-11 (branch \`claude/fix-truthful-labels\`, which moves the failed line to \`.warn\` and defines \`--warn\`) to merge into main`.
23. In Why and the warn decision, replace "Today the line is loss-coloured text" with: "On main the line is loss-coloured text; F-11's branch makes it warn-coloured text with a '⚠︎' CSS glyph (`.record-failed::before`), still told apart from a loss mainly by hue". Add: "F-27 replaces the branch's `.warn` rule and `::before` glyph."
24. Replace "warn #8a5a00 vs loss #b2441b is 3.2 ΔE00" with "warn (`#8a5a00` in the design system; F-11's branch uses `#92400e` / `#fbbf24`, F-20 pins one) sits within 3.2 ΔE00 of loss under deutan at the design-system value". The decision holds whichever value wins.
25. Replace the AC wording "the words `RECORD_BODY.failed`" with "its unchanged words (`RECORD_BODY.failed` on card, pane and profile; the strip's `note` on the record strip)".
26. Replace the F-20 exemption decision and its "test of the test fixture" AC with: "F-20's colour-blind floor stays gain vs loss (and Flat) only; warn is not added to it, and no exemption list exists; instead a render test asserts every element styled with `--warn` is a `.warn-notice` holding `[data-warn-icon]`."
27. Delete the AC "The contrast test asserts `--control` ≥ 3:1…": `lib/a11y-contrast.test.ts` #14 already asserts it. Replace it with "`lib/a11y-contrast.test.ts` #14 passes unchanged."
28. Delete the conditional AC "Only if the owner answers yes…" and add to the open question: "A yes becomes a dated decision with its own criteria (image table equals page tones, parity test, ≥ 4.5:1 on the image background) added to this file before build; a no or no answer changes nothing." A conditional checkbox can't be ticked or failed by the pipeline's tester.
29. Change the line-number references `Spread.tsx:35` and `Timeline.tsx:54` to "the bar baseline `<line>` (y = BASE) in `Spread.tsx` and `Timeline.tsx`", since F-11's branch shifts both files.
30. Add to the 360×640 AC: "and the F-10 15% headroom check passes unchanged for a failed record's card at 320×640, 360×640 and 780×360 (the box adds about 18 px)".

### draft-notes.md (corrections only)
31. "Today the failed line is `class="down"`" is true on main only; F-11's branch already uses `.warn` plus a glyph.
32. "`--warn` does not exist on main yet (F-20 adds it)" should read "F-20 and F-11's branch both define `--warn`, with different values".

## Answers to the UX lead's engineer questions
- **`sell_id` for 5 pane rows without a per-card query**: yes, via change 7. Zero new statements, index-backed, and
  exactly the rows `paneSummary` picks.
- **Can `records1` add it cheaply?** Yes, as a correlated `limit 5` column. Not as a ninth field in the per-row
  aggregate: that would ship every close's vendor id.
- **Trade page hold rule for the author only**: yes. Session-gated, separate loader call, plus one `count(*)` for the
  edit link.
- **Source test that `var(--warn)` appears only in warn-notice rules**: practical. Parse `app/globals.css` rules whose
  value contains `var(--warn)` and assert each selector matches `.warn-notice`. The token definition (`--warn:`) is not
  a use. It also needs a grep that no `.tsx` inline style uses `var(--warn)`.
- **Footer budget at 320 px with a 280-character note**: today's code and tests say it does not fit as drafted. Hence
  changes 2-5.

## Size estimates
- **F-25 PR 1, about 210 lines:**
  - copy and helper: 20;
  - nine caller swaps: 20;
  - pane rows, records1, route and type: 35;
  - stock page select and rows: 20;
  - notes and month suffixes: 10;
  - CSS: 15;
  - unit and e2e tests: 90.
- **F-25 PR 2, about 150 lines:** footer link, href prop, CSS 25; e2e (gestures, budget, names) 90; selector
  narrowing 15; copy test 20.
- **F-26, about 230 lines:** `thesisLine`, prop and feed SQL 25; trade page author line, count and link 30; loader
  split 15; render tests 70; e2e marker and identity tests 90.
- **F-27, about 150 lines:** baselines 2; warn-notice component at 4 sites 25; CSS 15 (minus the branch's `.warn` and
  `::before`); render, source and e2e tests 105.
