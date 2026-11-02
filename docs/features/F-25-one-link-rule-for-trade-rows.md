# F-25 · One link rule for trade rows

Status: built

## Why
The trade page (the note, the record strip, Share) can't be reached from the feed card, the pane or the stock page's
trade list, and each surface links a trade row somewhere different (C3-41, `docs/direction/cycle3-2026-11-01.md` §4.2,
§6 Rank 14). One rule, used everywhere, lets a reader go from any closed trade to that trade's own page, and lets a
screen-reader user know where each link goes before following it. Trade URLs today also carry the broker's activity id
(`closed_trades.sell_id`), which the consent copy and `lib/privacy-fields.ts` call "never shown"; putting that URL on
the signed-out feed would widen the mismatch, so the URL changes in the same feature.

## Decisions
- 2026-11-01: The rule. A trade row is any element that shows one closed trade (its symbol, or the page's symbol, and
  its signed return). Each trade row has exactly one link to that trade's page. Inside the row, the trader's name or
  handle links to `/u/<handle>` and the symbol to `/t/<SYMBOL>`, each only where the row has room for separate links
  and the surface is not already that profile or that stock. Nothing that holds a link is itself a link. Why: decided
  by the committee under the owner's instruction of 2026-11-01; one predictable destination per thing tapped (C3-41),
  and the trade page is the one place that shows the note, the strip and Share.
- 2026-11-01: Trade URLs move from the vendor id to the stored key: `/u/<handle>/trade/<trade_key>`. `trade_key` is
  the existing generated column `encode(sha256(sell_id with backslashes doubled), 'hex')` (`db/schema.sql:404`,
  indexed by `closed_trades_trade_key`). It depends only on `sell_id`, which `rebuildTrades` reproduces from the same
  activities, so it is stable across rebuilds (likes and rejects already rely on that, `lib/likes.ts:3`). The route
  looks up, in order: (1) `(handle, trade_key)`; (2) otherwise `(handle, sell_id)`, answered with `permanentRedirect`
  (308) to the `tradePageHref` URL; (3) otherwise `notFound()`. That covers any unknown segment, including another
  handle's `sell_id`, and it never redirects. Step (2) applies `loadTradeShare`'s visibility rule (a deleted user, a
  hidden or removed public filer) before it redirects, so a 308 never reveals the `trade_key` of a page that then
  404s. The 308 keeps the request's query string, so `?via=` on an old shared link survives the redirect. The lookup,
  legacy branch included, is a database read in the page body and in the `opengraph-image` route. It never happens in
  `proxy.ts` (hashing there would 308 junk segments to pages that then 404) and never in `generateMetadata` (a
  redirect thrown there can stream as a soft redirect). The `[sellId]` folder name stays; only the variable is
  renamed, so the six file-reading tests F-11's branch also edits are not churned. The share image, canonical URL and
  metadata use the `trade_key` URL. No rendered href, `data-*` attribute, form field, client prop, RSC payload or JSON
  response carries a `sell_id`. Why: decided by the committee under the owner's instruction of 2026-11-01; shared
  links are permanent and must keep working, F-25 puts trade URLs on the signed-out feed and the pane, and a 308 for a
  page that does not exist would be cached forever.
- 2026-11-01: F-15's view counting follows the URL: `lib/views.ts#viewedUserId` matches a trade view by `c.trade_key =
  detail` instead of `c.sell_id = detail`, under the same visibility rule. Neither the key nor the id is stored. Why:
  decided by the committee under the owner's instruction of 2026-11-01; every trade URL carries the key after F-25, so
  matching the old id would silently count no trade-page views.
- 2026-11-01: `lib/privacy-fields.ts` relabels `closed_trades.trade_key` from "key (hash of sell_id)" to "key (hash of
  sell_id; shown in trade-page URLs)". `closed_trades.sell_id` keeps "never shown", and the consent line (owner copy)
  is unchanged. Why: decided by the committee under the owner's instruction of 2026-11-01; the inventory must match the
  data flow (FTC Act §5, COMPLIANCE §3), and `trade_key` becomes public with this feature.
- 2026-11-01: `/me/record`'s reflection form posts the `trade_key` (hidden input `tradeKey`) instead of `sell_id`.
  `app/actions.ts` resolves it to the row with `user_id = me and trade_key = $1`; the stored `trade_reflections` rows
  stay keyed by `sell_id`, looked up server-side. Why: decided by the committee under the owner's instruction of
  2026-11-01; the page renders `sell_id` in a hidden input today, which the no-`sell_id` rule covers.
- 2026-11-01: One helper builds every trade URL: `tradePageHref({ handle, tradeKey })` in `lib/trade-href.ts`. It
  takes the row's fields, not a ready string, so any later change of key stays inside the helper. `TRADE_LINK` copy
  lives in `lib/copy.ts`. Why: decided by the committee under the owner's instruction of 2026-11-01; one place to
  change the route or the wording (not `lib/paging.ts#tradeHref`, which builds the profile-row anchor).
- 2026-11-01: Two shapes, one per kind of row. Shape C (figure link), for rows that already hold other links (the
  profile's closed-trades rows): the signed return figure is the trade link, with a hit box at least 44 × 44 px (a
  short figure such as "0.0%" is padded to that width), named `TRADE_LINK.name(symbol, returnPct)` = "‹SYMBOL›
  ‹Gain|Loss|Flat› ‹signed %›, open trade page" (sign word from `signWord`). Shape R (row link), for rows that hold
  nothing else to link (stock-page trades list, stock-page notes list, month list and month best/worst cards, the
  pane's last-trades list): the whole row is the one link, named by its visible text, with the sr-only sign word before
  each printed return (as the month page does) and a visually hidden suffix `TRADE_LINK.suffix(symbol)` = ", open
  ‹SYMBOL› trade page". Shape R links have no `aria-label`, so the name starts with the visible text and keeps the badge
  word inside the row ("Demo", "Verified", "Public filing"). Why: decided by the committee under the owner's
  instruction of 2026-11-01; WCAG 1.3.1 (a loss is announced as a loss, also once F-19 moves the sign to U+2212), 2.4.4,
  2.5.3 and 2.5.8, POLICY A1 and P2, and nested links are invalid HTML.
- 2026-11-01: The check glyph in the Verified badge (`app/ui.tsx` `Badge`) is `aria-hidden`, so a Shape R name reads
  "Verified", not "check mark Verified". Why: decided by the committee under the owner's instruction of 2026-11-01;
  the word carries the meaning and the glyph only adds noise to every row name.
- 2026-11-01: Feed card. The card stays as F-10 built it: name → `/u/<handle>`, symbol → `/t/<SYMBOL>`, no card-wide
  link, and the big return figure is not a link. The footer holds two text links, set at 0.875rem, in this order:
  "This trade →" (trade page; accessible name "This trade: ‹SYMBOL› ‹Gain|Loss|Flat› ‹signed %›", symbol and figure in
  a visually hidden span, the arrow `aria-hidden`) and "Record, wins and losses →" (profile; the arrow `aria-hidden`
  and a visually hidden handle after the visible text, so its accessible name is "Record, wins and losses:
  @‹handle›"). At 360 px the card's content box is 320 px and the footer is 16 px today; at 0.875rem the two links
  measure about 286 px in the e2e font (`e2e/fonts.conf`), about 11% spare. They share one line at 360 px and wider
  and stack below 360 px. Each has a hit box at least 44 px tall. The trade link never replaces the profile link. The
  card's href is built on the server from `page.cards` (which already holds the row), with no new query. Why: decided
  by the committee under the owner's instruction of 2026-11-01; F-2 reserves taps on the card body for the double-tap
  like, and a link on the largest element in the middle of the card would turn the first tap of a double tap into
  navigation. The measured widths leave room on one line only with the shorter text and size.
- 2026-11-01: The footer's profile link reads "Record, wins and losses →" on connected and F-7 public-record cards
  alike. This amends F-7 AC20 ("See their record, wins and losses →"); F-7's file is not edited, and the amendment
  lives here. One `lib/copy.ts` constant serves both `app/ui.tsx` (an inline string today) and `PUBLIC.cardFooter`, so
  the two footers cannot drift apart. Why: decided by the committee under the owner's instruction of 2026-11-01; both
  footer links fit on one line at 360 px only with the shorter text, and "wins and losses" (the trust cue) stays.
- 2026-11-01: The card's height budget is not relaxed. `e2e/record-strip.spec.ts` AC8 (15% headroom at 320×640,
  360×640 and 780×360 with a 280-character note and the open line), `e2e/fixes-cycle2-a11y.spec.ts` (need ≤ 0.85 of
  the room, every focusable ≥ 8 px above the sign-in bar) and `e2e/a11y-feed.spec.ts` (footer link in view) pass
  unchanged. This includes page 1's first card after the first-visit line is dismissed (`data-ss-seen~="line"`), where
  the swipe hint shares the footer line. If any of them would need loosening, the build stops and the feature returns
  to a committee. Why: decided by the committee under the owner's instruction of 2026-11-01; F-10's one-screen budget,
  and F-26's saving does not apply to cards that have a note.
- 2026-11-01: Gestures on the feed card are unchanged: a swipe toward the profile opens the pane (SW-1), the other
  way rejects (signed in), and a double tap on the card body likes (signed in) or shows the sign-in line (signed out).
  One tap on "This trade →" opens the trade page. A swipe that starts on either footer link scrolls or rejects as
  before and never follows it, and a pointer that leaves a link before release does not follow it. Why: decided by
  the committee under the owner's instruction of 2026-11-01; F-2's gestures are decided (links are already `NOT_TAP`,
  `lib/discovery/gestures.ts:10`), and WCAG 2.5.2.
- 2026-11-01: F-25 is one feature built as one PR (about 315 product lines against the pipeline's 800 product-line
  cap). It builds after F-26 merges, because the footer link uses the note slot F-26 frees. Why: decided by the
  committee under the owner's instruction of 2026-11-01; the pipeline builds one feature as one PR and checks every
  AC against it.
- 2026-11-01: Pane. Each of the "Last N trades" rows becomes a Shape R link to its trade page (symbol, date and signed %
  as today, with the sign word and suffix). The highlighted row's link carries `aria-current="true"`, moved from the
  `<li>`. "See full profile →" stays the pane's profile link. `lib/feed.ts#records1` adds one column to its existing
  statement: a correlated `limit 5` subquery over `closed_trades_user` in the list order (`closed_at desc, id desc`)
  that returns the five `trade_key`s. So the feed adds no SQL statement, `/u/<handle>/pane` gets the same five keys
  through `records()`, and `PaneTrade` gains an optional `tradeKey`. Why: decided by the committee under the owner's
  instruction of 2026-11-01; C3-41 (the pane list is plain text today), and the payload carries keys only for the rows
  it links.
- 2026-11-01: Stock page. The trades list (`app/t/[symbol]/page.tsx`, "Trades (newest first)") moves from the trader's
  profile to the trade page, as Shape R. The notes list (`Theses.tsx`) already links rows to the trade page and gains
  the sign word and the suffix. It keeps F-9's layout (the note and its Report control sit after the link, not inside
  it), so a notes-row name is handle, badge, sign word, figure, held time and date plus the suffix, not the note text.
  A reader reaches the profile from the trade page's "← ‹handle›'s record" link. This replaces F3-8's interim naming.
  Why: decided by the committee under the owner's instruction of 2026-11-01; two lists on one page linked to two
  places is the inconsistency C3-41 names, and one extra tap to the profile is accepted (business lead, round 1).
- 2026-11-01: Profile and month page. The profile row is the Shape C reference and keeps its symbol link; the month
  list and best/worst cards are Shape R and gain the suffix. Likes, hidden trades, similar trades and the new-trades
  prompt keep their destinations and names and switch to `tradePageHref`. Why: decided by the committee under the
  owner's instruction of 2026-11-01; those links show no signed figure inside them, so the name pattern does not apply.
- 2026-11-01: The comment in `app/feed-rows.tsx`, "the close's vendor id stays on the server", becomes "no `data-*`
  attribute, client prop or payload carries the close's vendor id; trade hrefs carry the `trade_key`". Why: decided by
  the committee under the owner's instruction of 2026-11-01; the code comment states the rule the tests enforce.
- 2026-11-01: Out of this rule: chart points and the chart sheet (CH-1; their "Go to trade in list" goes to the
  profile row, named for that destination), open-position rows (no trade page exists for an open position), and F-7
  filing links. Why: decided by the committee under the owner's instruction of 2026-11-01; they are not closed-trade
  rows.
- 2026-11-01: `lib/share-actions.ts#pageExists` matches a trade share by `trade_key`, as `lib/views.ts` does for views. Why: decided by the committee under the owner's instruction of 2026-11-01; Share paths carry the key after F-25, so matching the old id would silently record no trade shares (the views decision's reason).
- 2026-11-01: Tests that break only because the URL or footer form changed, outside the AC's list (`lib/f15-share-action.test.ts`, `lib/f15-share-action.db.test.ts`, `lib/f15-views.db.test.ts`, `lib/user-note.test.ts`, `lib/a11y-fixes.test.ts` #22, `lib/likes.test.ts`, `lib/thesis-review.test.ts`, `lib/f10-feed-card.test.ts`, `e2e/f15-canonical.spec.ts`, `e2e/f15-share.spec.ts`, `e2e/f26-held-like-none.spec.ts`, `e2e/f7-public-profile.spec.ts`), are rewritten to the new form with the same intent. Why: decided by the committee under the owner's instruction of 2026-11-01; never weaken a test; each keeps what it proves.
- 2026-11-01: The pane's keys come from one column of `records1`'s statement as `id:key` pairs attached by row id; there is no loader filter for rows without a key (the column is generated from a non-null `sell_id`); a card given no key shows only the record link and a pane row without one stays text. Why: decided by the committee under the owner's instruction of 2026-11-01; a tie in `closed_at` can never move a key to the wrong row, and a filter could only hide trades (TR-1).
- 2026-11-01: React keys and the moderator page carry no vendor id (keys ride in the page payload); Similar trades' one-link rule is checked per row, its sheet excluded. Why: decided by the committee under the owner's instruction of 2026-11-01; the no-`sell_id` rule covers every payload, and the sheet is a dialog outside the row.
- 2026-11-01: The statement-count AC is proven on a one-trader page (the feed's per-trader cap shows 2 cards) and a 30-card page of more than 8 traders, each equal to main (17 and 13 statements). Why: decided by the committee under the owner's instruction of 2026-11-01; the feed never renders exactly one card for one trader.
- 2026-11-01: The Verified glyph is a nested `aria-hidden` span (the DOM text stays "✓ Verified"), and Shape R focus rings use F-20's 2 px `:focus-visible` ring. Why: decided by the committee under the owner's instruction of 2026-11-01; F-20's ring test allows no other offset, and the rows sit inside the pane's padding.
- 2026-11-01: The footer AC "no two footer profile links share an accessible name" is read per destination: two cards of one trader on a page both read "Record, wins and losses: @‹handle›" and go to the same profile, and no two different profiles share a name (e2e: each name maps to one href). Why: decided by the committee under the owner's instruction of 2026-11-01; WCAG 2.4.4 asks that links with the same name go to the same place, and the decided name pattern (the handle) gives one trader's cards one name.
- 2026-11-01: On page 1's first card the swipe hint keeps its own line above the two footer links, 14 px clear of their hit boxes, instead of sharing their line; the footer's 36 px row gap keeps wrapped or stacked link boxes 8 px apart (also when a larger text size wraps them at 360 px or wider). The height checks pass unchanged. Why: decided by the committee under the owner's instruction of 2026-11-01; both links leave no room for the hint beside them at 360 px, and a hit box over the hint or the other link would let a tap open the wrong page (QA round 1).
- 2026-11-01: Chromium joins a visually hidden span's text with a space ("This trade : TSLA Gain +5.0%"); the e2e name checks ignore spacing before punctuation, and the markup stays as decided. Why: decided by the committee under the owner's instruction of 2026-11-01; screen readers read the same words, and the visible words still begin the name (WCAG 2.5.3).
- 2026-11-01: The pane's "Last 5 trades" links and the card's footer links render through small client components (`app/f25-links.tsx`) with compact props, not server element trees; the HTML and names are unchanged. Why: decided by the committee under the owner's instruction of 2026-11-01; as element trees they were serialised twice per card (HTML and the page payload) and pushed the F-2 heavy feed page past its 500 KB budget (547 KB); with compact props (the key, symbol and printed date, figure and tone; no raw return) the pages weigh 447, 421 and 459 KB (main: 432, 402, 446), threshold unchanged.
- 2026-11-02: The swipe hint's words paint above the first footer link's overhang (as the disclaimer does) instead of keeping a 14 px gap; the hint line stays static (F-13). Why: decided by the committee under the owner's instruction of 2026-11-01; with a 280-character note and the open-positions line, page 1's first card needed 645 of 639 px at 320 with the gap; without it the F-10 budget holds unchanged, and a tap on the hint's words follows no link.
- 2026-11-02: Unblocked: F-9 (#65), F-11 (#85) and F-26 (#87) have merged. Built in #102 (9c3aed94). Under OD 2.63
  (accepted by the owner), the "never shown" wording for `sell_id` stays only once this feature makes it true. Why:
  the stale-blocker correction the owner accepted with OD 2.60 on 2026-11-02; OD 2.63.

## Acceptance criteria
- [x] On the feed, the pane, the profile, the month page, the stock page (trades and notes lists), similar trades,
      likes, hidden trades and the new-trades prompt, each closed-trade row has exactly one `<a>` whose href is
      `tradePageHref` of that row, ending `/trade/<trade_key>` (e2e on demo data, one assertion per surface).
- [x] On the feed, pane, profile, month page and stock page, each trade link's accessible name contains the row's
      symbol, its signed % as printed, and "trade page" or "This trade" (e2e accessibility tree).
- [x] Each trade link's accessible name contains the sign word (Gain, Loss or Flat) that matches `tone()` of its
      figure (e2e, one loss row per surface).
- [x] No trade row is nested inside another link, and no element that contains a trade link is itself a link (DOM
      test on each surface).
- [x] No rendered href, `data-*` attribute, form field, feed paging response, `/u/<handle>/pane` or
      `/u/<handle>/pane-chart` JSON, trade-page metadata, or `/me/record` HTML contains any row's `sell_id` (e2e with
      seeded sell ids carrying a unique marker).
- [x] `GET /u/<handle>/trade/<sell_id>` and `GET /u/<handle>/trade/<sell_id>/opengraph-image`, fetched with
      `maxRedirects: 0`, answer 308 with `Location` equal to the `tradePageHref` form. Following that, the page answers
      200 and the image renders (200, `image/png`). An unknown segment in either form, another handle's `sell_id`, and
      the `sell_id` of a hidden or removed public filer or a deleted user answer 404 with no redirect (e2e).
- [x] `GET /u/<handle>/trade/<sell_id>?via=trade` with `maxRedirects: 0` answers 308 with `Location` equal to
      `tradePageHref(...) + '?via=trade'`, and the landed page's view beacon records `via=trade` (e2e).
- [x] A view beacon for `/u/<handle>/trade/<trade_key>` counts one trade view for that trader, and one for
      `/u/<handle>/trade/<sell_id>` counts none (db test beside `lib/f15-views.db.test.ts`).
- [x] The legacy lookup and its redirect live in the trade page body and the `opengraph-image` route, and in neither
      `proxy.ts` nor `generateMetadata` (source test).
- [x] `lib/privacy-fields.ts` labels `closed_trades.trade_key` "key (hash of sell_id; shown in trade-page URLs)" and
      `closed_trades.sell_id` still "never shown"; the consent line is unchanged (`lib/privacy-fields.test.ts`).
- [x] On `/me/record`, the reflection form posts `tradeKey`, and saving and clearing a reflection still work for the
      user's own trade and fail for another user's `trade_key` (db test on the action, e2e on the page).
- [x] After `rebuildTrades` for a user, every trade-page URL captured before the rebuild still answers 200 with the
      same symbol and figure (db test).
- [x] Every trade-page URL in `app/` and `lib/`, including the trade page's own canonical and `opengraph-image` URLs,
      comes from `tradePageHref` (source test: no `/trade/${` template outside `lib/trade-href.ts`).
- [x] Feed card: the return figure (`.ret`) contains no link; the footer holds "This trade →" then "Record, wins and
      losses →", at 0.875rem; the name still links to `/u/<handle>` and the symbol to `/t/<SYMBOL>` (render test of
      `TradeCard`).
- [x] The profile link's text is one `lib/copy.ts` constant, used by `app/ui.tsx` and `PUBLIC.cardFooter`, so
      connected and F-7 public-record cards show the same footer string (source test).
- [x] At 360 px and 780 px the two footer links sit on one line; at 320 px they stack (e2e bounding boxes, e2e font).
- [x] Every trade link and both footer links have a computed hit box at least 44 px tall at 320, 360 and 780 px widths,
      and every Shape C figure link is at least 44 × 44 px, including a "0.0%" figure (e2e), and the two footer links'
      hit boxes do not overlap, with at least 8 px between them side by side at 360 and 780 px and stacked at 320 px
      (e2e bounding boxes).
- [x] On a feed page with two or more traders, no two footer profile links share an accessible name, and each name
      starts with "Record, wins and losses" (e2e accessibility tree).
- [x] `e2e/record-strip.spec.ts` AC8, the room and sign-in-bar checks in `e2e/fixes-cycle2-a11y.spec.ts` and the
      footer check in `e2e/a11y-feed.spec.ts` pass with their thresholds unchanged, with a 280-character note. The
      same holds for page 1's first card after the first-visit line is dismissed (`data-ss-seen~="line"`), where the
      swipe hint shares the footer line.
- [x] Tests updated for the new footer text and the new URL form, each assertion otherwise unchanged:
      - `lib/f7-trust.test.ts:96` expects the new constant;
      - `e2e/f7-public-feed.spec.ts:52` expects the new string;
      - `e2e/fixes-cycle2-a11y.spec.ts:288`, `e2e/f10-followups.spec.ts:79` and `e2e/record-strip.spec.ts:121` match
        the new text;
      - the selectors that mean the card's profile link (`e2e/f7-public-feed.spec.ts:52-53`,
        `e2e/fixes-cycle2-a11y.spec.ts:282,288,294,330,359-361`, `e2e/a11y-feed.spec.ts:174`) are narrowed to
        `footer a[href="/u/<handle>"]`;
      - `e2e/connect.spec.ts:663` asserts `a.trow[href^="/u/<handle>/trade/"]` (destination changed by this feature);
      - `e2e/similar.spec.ts:105` expects the similar-trades href in the `trade_key` form;
      - `e2e/app.spec.ts:519` expects the new-trades link's href in the `trade_key` form; `e2e/app.spec.ts:413-418`
        are unchanged and now exercise the legacy redirect and the 404.
- [x] `e2e/record-strip.spec.ts:168` asserts zero links matching `/(See t|T)heir record, wins and losses|Record, wins
      and losses/` on the trade page, so it still fails if the duplicate profile link comes back.
- [x] Feed card gestures: F-2's SW-1, reject-swipe and double-tap e2e pass unchanged. A double tap on the card body
      still likes (signed in) or shows the sign-in line (signed out) and never navigates. One tap on "This trade →"
      opens the trade page (e2e).
- [x] A swipe that starts on "This trade →" or on a pane row link opens the pane, rejects, or scrolls as before and
      never navigates. A pointer that moves off a link before release does not follow it (WCAG 2.5.2, e2e).
- [x] Shape R links carry no `aria-label`. Each accessible name starts with the row's visible text and contains the
      row's badge word when a badge sits inside the link ("Demo" on demo rows, "Verified" without "check mark") (e2e
      on the stock page, notes list, month page and pane).
- [x] Shape C and the feed's trade link: the visible text of the link is a substring of its accessible name (WCAG 2.5.3).
- [x] The pane's highlighted row has `aria-current="true"` on its `<a>`, not on the `<li>` (render test).
- [x] Each Shape R link shows its focus ring around the whole row, not clipped by its container, in light and dark
      (e2e screenshot on the stock page and the pane).
- [x] The pane's last-5 rows link to their trade pages both in the feed (server pane) and in the lazy pane.
      `/u/<handle>/pane` carries a trade key for at most 5 rows (unit test on the route payload).
- [x] The feed page issues the same number of SQL statements as before this feature, for 1 card and for 30
      (statement-count test on `loadFeedPage`), and the F-10 load test passes.
- [x] Signed out, each trade link returns 200, and the page shows the row's symbol and signed % exactly as printed on
      the row (e2e).
- [x] `TRADE_LINK` strings contain none of the scanner's advice, promotion or completeness words (copy test).

## Out of scope
- Chart points, the chart sheet and its "Go to trade in list" link (CH-1).
- Open positions (no trade page), F-7 filing links, the trade page's own layout.
- The note's slot on the card (F-26).
- An sr-only expansion of "held 3d" in Shape R names (advisory, not required).
- Renaming the `[sellId]` route folder (a later chore, after F-11's branch merges).

## Open questions
- Standing owner Q1 (docs/process/decisions-and-authority.md) applies; not re-asked here.
- Owner note (not a choice): the consent screen's scope line and `lib/privacy-fields.ts` call `closed_trades.sell_id`
  "never shown". Until F-25, every trade URL published it. With F-25 the statement is true again, and the label's
  wording stays the owner's copy.

## Rework notes

## Build log
- 2026-11-01: built on `claude/f25-one-link-rule` through the committee cycle (plan with two review rounds, tests first, tester QA, UX lead and business lead user tests at 360 and 320 px: PASS, independent code review: no blocking findings); every acceptance criterion has a unit, db or e2e test (`lib/f25-*.test.ts`, `e2e/f25-*.spec.ts`). Record: `docs/features/logs/F-25/committee-2026-11-01.md`.
