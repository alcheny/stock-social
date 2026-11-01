# F-25 committee log, 2026-11-01

Build session for F-25 (`docs/features/F-25-one-link-rule-for-trade-rows.md`), branch `claude/f25-one-link-rule`, under
the owner's instruction of 2026-11-01 (develop autonomously; open questions decided by the committee's recommended
option after debate). The orchestrator's brief set Status to building on this branch.

## Prerequisites
F-9 (#65, ff25ad5), F-11 (#85, 8e3e9a5) and F-26 (#87, 67825e8) are on main (`git log origin/main` at build start,
main at 63f48f4), so the `Blocked:` line was lifted and Status set to building, per the orchestrator's brief.

## Round 1: UX lead's plan (summary)
The UX lead mapped every acceptance criterion to files and tests:
- The helper and copy: `lib/trade-href.ts`, `TRADE_LINK`, `RECORD_LINK` and `RECORD_LINK_ARROW`.
- The loaders that select `trade_key`: the feed's page rows, `records1`, profile, recap, ticker, theses, similar, likes
  and hidden, and `/me/record`.
- Every place a `sell_id` reached the client: hrefs, the new-trades prompt's client prop, the `/me/record` hidden
  input, and React keys.
- The trade page and image lookup order, and the views matcher.
- The conflicts with current code: moved line numbers, `lib/share-actions.ts#pageExists`, tests outside the AC list,
  and the two trade links in Similar trades.

Reviews:
- **Business lead: signed with conditions.** Rulings:
  - (a) share actions match `trade_key`;
  - (b) tests that break only on the URL form are rewritten to the key form, each logged;
  - (c) Similar trades' "exactly one" check is scoped to the row, excluding its sheet;
  - (d) the moderator page's React key drops the sell id as well;
  - (e) React keys use the key.

  Conditions: no "rows with no key" filter (`trade_key` is never null); the marker scan covers RSC payloads; a
  `## Compliance` section in the PR. It also raised one item for the owner: the key is an unsalted hash of the vendor
  id.
- **Engineer: six demands.**
  1. The keys come back as `(id, key)` pairs attached by row id, with a tie test at the 5th and 6th row, and a statement
     count that covers more than 8 traders.
  2. A source test that fails if a `loading.tsx` appears (it would turn the 308 into a meta refresh), and the e2e
     asserts no `http-equiv="refresh"`.
  3. Select `t.trade_key` for the feed card instead of hashing in JS, with a db test that the JS hash equals the
     column.
  4. Gesture tests use touch events, not mouse drags.
  5. No key filter.
  6. Record the `pageExists` change.

## Round 2
Every demand and condition was accepted into the plan, and both reviewers' points are built; no point was left in
dispute. On condition 5 ("leave Status alone"), the orchestrator's brief for this build sets Status to building and,
at the end, built, so the brief governs.

## Decisions (each appended to the feature file's Decisions)
1. `lib/share-actions.ts#pageExists` matches a trade share by `trade_key`, as `lib/views.ts` matches views. Without it,
   every trade share would silently go unrecorded once Share paths carry the key.
2. Tests that break only because the URL or footer form changed, outside the AC's list, are rewritten to the new form
   with the same intent:
   - `lib/f15-share-action.test.ts` (tradePath → tradePageHref, still counted twice in the page);
   - `lib/f15-share-action.db.test.ts:35` (the share path in the key form);
   - `lib/f15-views.db.test.ts` (adds the key case);
   - `lib/user-note.test.ts` (Theses link string);
   - `lib/a11y-fixes.test.ts` #22 (Theses row key and href);
   - `lib/likes.test.ts` (feed row `data-key={t.trade_key}`);
   - `lib/thesis-review.test.ts` (the moderator page now has no sell-id use at all; stricter);
   - `lib/f12-followups.test.ts` (unchanged, kept passing: the image route keeps `if (!t) notFound();`);
   - `lib/f10-feed-card.test.ts` (the Verified glyph's aria-hidden span);
   - `e2e/f15-canonical.spec.ts` (canonical in the key form; the over-encoded legacy URL answers 308).
3. The pane's "Last 5 trades" keys come from one column of `records1`'s existing statement as `id:key` pairs,
   attached by row id, so a `closed_at` tie can never shift a key onto the wrong row.
4. There is no "rows with no key" filter, because `trade_key` is a generated column of a non-null `sell_id`. A card
   rendered by a caller that passes no key shows only the record link, and a pane row without one stays plain text.
   Neither ever builds a guessed URL.
5. The moderator page (`app/review/theses`) keys its rows by index, so no vendor id rides in its payload. It has no
   forms (read-only), so nothing else changes there.
6. Similar trades: the row and its sheet each link to the trade; the "exactly one" rule is checked per row element,
   and the sheet (a dialog outside the row) is excluded.
7. The reflection lookup is `lib/reflection-target.ts#ownSellIdForKey`, a db-testable function called by
   `app/actions.ts#setReflection`.
8. The Verified glyph is a nested `aria-hidden` span. The DOM text stays "✓ Verified", so `e2e/record-strip.spec.ts`
   is unchanged; `lib/f10-feed-card.test.ts`'s badge regex allows the nested span.
9. The footer links reach a 44 px hit box through a negative block margin, so the card's footer line keeps its height
   (F-10's budget); stacked below 360 px, only the outer edges are pulled in, and the 8 px row gap separates the
   boxes.
10. Shape R focus rings use F-20's `:focus-visible` ring (2 px offset). `lib/a11y-contrast.test.ts` AC8 allows no
    other offset, and the rows sit inside the pane's padding, so the ring is not clipped.
11. Statement count: the feed never shows a single card for one trader (the per-trader cap gives that trader's page 2
    cards, and fewer than 5 closes give none). The test therefore counts a one-trader page and a 30-card page (more
    than 8 traders), each equal to origin/main measured with the same fixture: 17 and 13 statements.
12. `lib/similar.ts#SimilarRow` keeps `sellId` server-side, because `lib/similar.test.ts` asserts it; it is never
    rendered, and the row's link uses `tradeKey`.

## QA round 1 (tester) and the e2e build
The tester found no blockers.

Should-fix items, all fixed:
- The swipe hint lost its shared line.
- Wrapped footer boxes overlapped at 360 px with a larger text size.
- The hit boxes covered the hint.
- e2e gaps.

The e2e engineer found one app bug: the pane rows' sr-only spans widened the page, because `.f25-row` had no
`position: relative`. It is fixed for every Shape R row and both footer links.

Decisions:
13. Footer profile-link names are unique per destination, not per card: one trader's two cards share the handle's name.
14. The hint keeps its own line above the links, 14 px clear, and the links' row gap is 36 px. This keeps 8 px between
    hit boxes whenever they wrap.
15. Chromium's space before a hidden span is accepted, because the words are unchanged.

Known limit, with a ponytail note in app/globals.css: a footer link's hit box reaches 14 px over the card disclaimer's
top edge, which is non-interactive text.
