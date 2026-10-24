# F-2 PR-4 · Likes and gestures · UX lead verdict

Date: 2026-10-24. Build: `8bb09bf`. Reviewer: UX lead (designer role, `team/designer.md`).

I tested on `next start` (port 3124), with the in-repo vendor fake on 4204 and my own database. The data was 42 fixture
traders plus the demo seed. I walked it signed out and signed in at 320 and 375 with touch (real touch events through
the browser's input pipeline), and at 1280 with keyboard and mouse, in light and dark. Screenshots are in
`screenshots/pr4-ux/`. Test users were deleted, the database was dropped, and the server and fake were stopped.

## What works

- **Double tap.** A double tap on the card body likes the trade. Gaps of 100, 150 and 200 ms like. A 400 ms gap does
  not. A second tap 30 px away does not like. A vertical swipe or flick across a card scrolls and never likes. A double
  tap on the trader link just follows the link (it never likes). A double tap again unlikes. Cards carry no chart, so
  nothing on a card can be scrubbed. The pane chart is outside the card's gesture scope.
- **Feedback is quiet and private.** After a like, a small muted ♥ appears between the badge and "…". Its contrast is
  5.03:1 in light and 5.84:1 in dark, which passes AA for text in both. There is no animation, no transition and no
  count. The polite status line reads "Liked. Only you can see likes."
  (`liked-header-*`, `liked-*`). I find the visibility right for a private, quiet state: you can find it if you look,
  and it never celebrates.
- **"…" menu.** At 320 the menu is 144×94, right-aligned, inside the viewport, and the page does not scroll
  sideways (`menu-320-*`). Both items are at least 44 px tall. The menu closes on an outside tap, and on Esc with focus
  back on "…". Its accessible structure is group → button "Like. Only you can see likes." (pressed) and button "Hide
  this trade", followed by a status region.
- **Keyboard (1280).** The Tab order is: name link, then "More for this QOB9 trade" (44×44), then the symbol. Enter
  opens the menu, and Tab reaches Like. Enter likes: the status is announced, focus stays on the button, and
  `aria-pressed` turns true. "Hide this trade" hides the trade, with focus on Undo (ring visible). The bar waits while
  Undo has keyboard focus (6 s+).
- **Reject swipe.** When dragged, the card follows the finger. A muted "Hide trade" label shows in the space the card
  uncovers, so you can see the direction and the consequence (`reject-middrag-*`). Drags at 35% and 45%, and a fast
  40% flick, snap back and write nothing. At 70% the trade is hidden, with "Trade hidden." and Undo. A flick the other
  way snaps to the pane (scrollLeft = width) and writes nothing. The snap stop is unchanged. Signed out, a right swipe
  does nothing.
- **Signed out.** No card has a menu. A double tap shows one bottom line, "Sign in to like trades. Sign in ×", with a
  44 px close button, at 320 and 375 in both themes (`signedout-line-*`).
- **/me/likes.** The page is linked from `/me/following`. Its empty state, "You haven’t liked a trade yet. Double-tap a
  trade in the feed to like it.", teaches the gesture. It shows 50 rows a page. "Older likes" goes to page 2 (5 rows),
  and Remove on page 2 stays on page 2. Remove is 93×45. Returns use gain and loss colours, and no count appears
  anywhere.
- **No JavaScript.** The menu is a working `<details>`. Like posts and lands on `/me/likes` with the like stored. "Hide
  this trade" posts and lands on the feed with that trade gone (`nojs-*`).
- **Earlier follow-ups now closed.**
  - From PR-3b round 2: the sheet's dialog is now named after the trade ("QAA0 · closed Oct 24, 2026"), which matches
    its heading. The profile row text starts at x=16, aligned with the heading and closes. "← Feed" is now 44 px tall.
  - From PR-2: after a mouse hide, the bar times out after 5 s while the pointer is away. It stays while the pointer is
    on it, then times out 5 s after the pointer leaves.

## Problems

1. **follow-up: the date in a likes-list link is cut off at 320.** The link reads "QAA0, closed Oct 24, 20", with
   "26" clipped and no ellipsis (`likes-320-*`; 375 is fine). Cause: the `.people .who-col a` rule from the following
   list makes the link a nowrap flex box with overflow hidden, so `text-overflow` never applies. Give `.likes .who-col a`
   `white-space: normal` (or a shorter date at narrow widths).
2. **follow-up: the Like button's visible text never changes.** When liked, it shows "♥ Like". Pressing it again unlikes,
   but the visible text doesn't say so. Only `aria-pressed` and the filled icon carry the state, and the code comment
   says the button reads "Liked". Show "Liked" (or "Unlike") when it is pressed, and keep the accessible name stable.
3. **follow-up: on touch, the Undo bar never times out.** After a touch swipe or a tap on "Hide this trade", focus moves
   to Undo and counts as `:focus-visible`, so the pause rule holds the bar. It was still there after 15 s, and 5.6 s
   after a scroll. The bar covers the bottom 62 px of the card. On touch, pause only while the finger is on the bar.
4. **follow-up: the Undo copy doesn't say the hide is permanent.** "Trade hidden." is true. But this hide never expires
   and has no management screen, while "Not interested" names its 90 days. Consider "Trade hidden for good." or
   "Trade hidden. You won’t see it again." so the 5 s Undo is the informed last chance.
5. **follow-up: the no-JS hide gives no confirmation.** The page reloads with the trade gone and no message. It is
   acceptable, but a one-line "Trade hidden." notice on the redirected page would match the JS path.
6. **follow-up, for the owner: discoverability of the double tap.** In the feed, nothing teaches the gesture. Only
   the menu's "Like" and the likes list's empty state mention it. The quiet design is deliberate, and the menu is a
   full alternative, so I would leave this as it is unless PR-5 data shows likes are too rare.
7. **follow-up (cosmetic): the signed-out line at 320.** "Sign in" wraps onto two lines, and the × is a filled
   primary-colour button that outweighs the link. A `secondary` close would sit more quietly.

None of these blocks the PR. The gestures have no false positives in my tests, both new gestures have keyboard and
no-JS routes, announcements work, and no layout breaks except the clipped date in problem 1.

USABILITY: PASS
