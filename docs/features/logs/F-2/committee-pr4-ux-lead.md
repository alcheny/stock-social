# F-2 PR-4 likes and gestures: UX lead verdict

2026-10-24, HEAD 06b90b2, against the shared production server on :3000. I did not rebuild or stop it. Database: the
shared one. Fixture: 14 throwaway traders (`uxp4_t0..13`, 4 closes each, losses included) and one viewer `uxp4_viewer`.
Another tester's 500-trader fixture filled page 1 while I worked, so most cards I touched were demo cards or that tester's.
Every like and reject I made was undone or deleted. My users were deleted at the end (cascade). Their `signup_attempts`
rows stay because `funnel_events` references them, the same as the e2e fixtures. Tools: Playwright Chromium with real CDP
touch input at 360 and 375 (mobile, touch), light and dark, `prefers-reduced-motion: reduce`, keyboard only (375 without
touch), JavaScript off, and an accessibility-tree pass (`ariaSnapshot`). Screenshots: `screenshots/pr4-ux/`. No product
code changed.

## User-test notes (plain words)

**As a first-time viewer from a shared link (signed out, 360).** I land on a profile, then go to the feed. Each card now
ends with a heart under "See their record, wins and losses →". Nothing tells me what the heart does or that a double tap
exists. When I tap the heart, a line appears: "Sign in to like records. Only you can see likes. Sign in". The card's
centre content moves up about 35 px to make room. I could not tell that "Sign in" is a link: it has the same colour and
weight as the sentence and no underline (`out-dbltap-360-light.png`, `out-heart-signin-375-*`). A right swipe does
nothing signed out, which is correct: no tray and no write.

**As a first-time signed-in viewer (375, touch).** The card footer reads: link, heart, then "Hide this trade". The hide
button is the boldest and widest control on the card (`in-feed-first-375-light.png`). I double-tapped the big return
number. The only feedback was the heart in the bottom corner turning filled, about 370 px from my thumb, 174 ms later.
Without knowing to look there, I would not have known anything happened. Nothing on the feed teaches the double tap; the
only mention is the empty "Liked records" text on `/me/following`. On a reload, a liked card first shows an empty heart,
which then fills (details below). Dragging the card right shows a grey "Hide trade" tray. The tray looks the same at 30%,
49% and 55% (`in-drag-30/49/55-*`), so I can't tell when letting go will hide the trade. At 55% the card disappears with
no motion, the next card sits in its place at the top (no jump), and "Hidden for 90 days. Undo" appears with a focus ring
on Undo. **That bar never went away**: it was still there after 12 s and after I scrolled the feed. It covers the next
card's heart and "Hide this trade" (`in-after-reject-375-light.png`, `in-reject-bar-375-*`).

**As a first-time trader (signed in as a fixture trader whose trades two other viewers had liked).** I could not find
anything about likes on my own profile, my trade page, my share image or my "Liked records" list. That matches what the
owner chose.

## What works

- **Double tap.** Two taps within 300 ms on the card body like the trade once. A second double tap never unlikes. Two
  taps 400 ms apart do nothing. No text gets selected, no zoom (`touch-action: manipulation`), and links keep their
  single-tap behaviour. Signed out, a double tap shows the same sign-in line and writes nothing.
- **Heart.** 45×44 px, outline ♡ to filled ♥: the shape carries the state, not colour. There is no count, burst,
  transition or vibration. The accessible name is "Like. Only you can see likes." and the button reports pressed/not
  pressed. Space and Enter toggle it, and the focus ring shows in light and dark (`kb-heart-focus-375-*`).
- **Reject swipe guards.** Checked at 360 and 375, with and without reduced motion:
  - (a) The opening swipe still opens the pane (scrollLeft = card width) and writes nothing.
  - (b) Swiping back from the pane and at once dragging 60% the reject way: nothing hides. The row stays at rest and the
    card is not moved.
  - (c) Toward the reject, then reversing toward the pane: the card returns and the pane opens. No write.
  - (d) A diagonal drag (216 px across, 70 px down) locks horizontal and hides. The feed does not scroll.
  - (e) A near-vertical swipe (45 px across, 260 px down) never hides.
  - (f) Under 50% it snaps back: with a 0.2 s ease-out normally, instantly under reduced motion.
  So the collision with SW-1 is handled. Only the card that was rejected goes; the trader's other cards stay.
- **"Hide this trade" by tap.** Undo takes focus without a ring. The bar closes at 5.15 s, and focus goes to the next
  card's name without a ring. Undo by tap brings the card back at the same place, and focus returns to its
  "Hide this trade".
- **Keyboard only.** The Tab order on a card is name, ticker, "See their record…", heart, "Hide this trade". Enter on
  hide puts focus on Undo, and the bar stays while focused (timing adjustable, WCAG 2.2.1). Esc moves focus to the next
  card's name with a visible ring (`kb-undo-*`, `kb-after-esc-*`). → and ← still open and close the pane from the heart.
- **Screen reader.** The bar is `status` › "Hidden for 90 days." › button "Undo". The tray is `aria-hidden`. In the
  Liked list, "Unlike" is named "Unlike JNJ by @dividend_dan": the visible label is part of the name (2.5.3).
- **Tray contrast.** About 13:1 in both themes (light #111118 on ≈ #dbdbdd; dark #f4f4f6 on ≈ #27272d).
- **Liked records.** It lists symbol, date and handle with no return. Each link opens the trade page (200, symbol
  heading). Unlike works with JavaScript and without it.
- No page errors in any run.

## Findings

1. **Undo after a swipe never times out (blocking).** After a touch swipe, the script focuses Undo. Chromium then gives
   Undo `:focus-visible` (measured `{focused: true, fv: true}`), because the swipe focused nothing first. `FeedHides`'
   `paused()` reads `:focus-visible` as "a keyboard user is here" and clears the 5 s timer. As a result:
   - the owner's O1 "5-second Undo" does not hold on the gesture it was decided for;
   - a keyboard focus ring shows after a touch;
   - the bar stays over the next card's actions until the user taps Undo.
   Tapping the button gives 5.15 s, which shows that the gesture is the trigger. The same `paused()` serves the PR-3
   section-row swipe, so it likely has the same problem. The feed had no section rows during my run, so I could not
   check it.
2. **Focus is lost after Unlike (blocking, A1, WCAG 2.4.3).** On `/me/following`, Enter on "Unlike" removes the row and
   focus falls to `body`. A keyboard user starts again from "Skip to disclaimer". Nothing is announced either. "Show
   again" on the same page announces through its status region.
3. **The signed-out "Sign in" link is not visibly a link (blocking, A1, WCAG 1.4.1 / F73).** Computed: same colour as
   the sentence (#111118 light, #f4f4f6 dark), weight 400, `text-decoration: none`. The cause is `.card footer a`
   inheritance.
4. **The heart's filled state comes after first paint (should fix).** A liked card first paints an empty heart. It
   fills 110–340 ms after first contentful paint on loopback, and about 750 ms after with 700 ms of added latency.
   Appended pages do the same. It is not a celebration, but it shows the wrong state for a moment, and a screen reader
   that reaches it first hears "not pressed". The engineer's decision 4 explains why (the guard tests pin the feed read).
5. **Double tap: no hint and feedback far from the thumb (follow-up).** The only feedback is in the corner. There is no
   hint on the feed.
6. **No cue when the drag passes the threshold, and the card vanishes on release (follow-up).**
7. **Reversal (follow-up).** Drag toward the reject, then back to the start: the card returns *and* the row slides
   150 px toward the pane at the same time (`in-cancel-back-at-start-375-light.png`). Lifting there snaps back and
   writes nothing, so it is safe but feels doubled.
8. **Liked list at 360 (follow-up).** The line truncates the handle: "PLTR · closed Oct 24, 2026 · @y…". The handle is
   the part that says whose trade it is (`liked-list-360-*`).
9. **Wording (follow-up).** You like a *trade*, yet the copy says "Liked records" / "Sign in to like records".
   Elsewhere in the app, "record" means a trader's whole history. The page h1 "Following and hidden traders" and its
   nav label don't mention likes either, so the list is hard to find.
10. **Every card's buttons have the same names (follow-up).** A screen reader's button list has 30 × "Like. Only you can
    see likes." and 30 × "Hide this trade", with no trade in the name.
11. **Without JavaScript (follow-up).** The feed renders 30 hearts and 30 "Hide this trade" buttons that do nothing.
12. **Visual weight (taste).** "Hide this trade" (143×45, bold, bordered) outweighs both the heart and the record link.

## Compliance review

- **POLICY A1 (WCAG 2.2 AA): FAIL on two items**, findings 2 (focus loss, 2.4.3) and 3 (link not visible, 1.4.1).
  Everything else passes:
  - every new control has a name, is 44 px tall or more, and shows a visible focus ring;
  - state is carried by shape, not colour;
  - `aria-pressed` is set;
  - reduced motion snaps instantly;
  - each gesture has a single-pointer button (2.5.1 / 2.5.7);
  - the bar is a `status`;
  - the tray is `aria-hidden`, and its contrast is about 13:1.
- **POLICY F6: PASS.** There is no like count anywhere, no burst, animation or vibration (a glyph swap only), and no
  reward. A like or reject on a loss is the same as on a gain.
- **Privacy: PASS.** I checked as the trader whose trades were liked: own profile, trade page and liked list, the share
  image (200, no like data), the signed-out profile HTML (no "like"/`data-like`), and `GET /me/liked` for those keys (`[]`).
  Likes are visible only on the viewer's own `/me/following`. Nothing is written signed out.
- **SW-1 as amended by O1: PASS.** The opening direction stays reserved for the pane, and vertical swipes are unaffected.

## Demands, in priority order

1. **Blocking: a swipe reject's Undo ends at 5 s.** Base the pause on how the hide was made, not on `:focus-visible`:
   - from a touch or pointer, the 5 s timer runs and focus lands without a ring;
   - from the keyboard, it stays paused while focused (as today).
   Apply it to the section-row swipe too.
   *Verify:* CDP touch swipe past half: the bar is gone between 5.0 and 5.6 s, no ring on Undo, focus ends on the next
   card's name. Keyboard Enter on "Hide this trade": the bar still stays while focused. Add an e2e assertion for the
   swipe case on the card and the section row.
2. **Blocking: focus after Unlike.** Move focus to the next row's "Unlike", else the previous one, else the "Liked
   records" heading (`tabIndex=-1`). Announce "Unliked SYMBOL by @handle." in the page's status region.
   *Verify:* keyboard Enter on the first and last of two Unlikes: `document.activeElement` is never `body`, and the
   status text is present.
3. **Blocking: make "Sign in" in the card's sign-in line look like a link**, for example
   `.card .like-signin a { text-decoration: underline; font-weight: 600 }`.
   *Verify:* computed `text-decoration-line: underline` in light and dark at 360.
4. **Should fix: no empty-then-filled heart.** Signed in, keep the heart glyph hidden (space reserved, button still
   focusable) until `/me/liked` answers for that card, falling back to the outline after 1 s. Server rendering is the
   other option, but it needs the owner's restatement of the guard tests.
   *Verify:* with `/me/liked` delayed 700 ms, a liked card never shows ♡ before ♥ (log the glyph from first paint).
5. **Follow-ups (designer's call, not blocking):**
   - 5: a static, non-animated "Liked. Only you can see likes." text beside the heart for about 2 s, announced politely;
   - 6: the tray label changes at 50% (for example "Release to hide"), and the card slides off on release (instant
     under reduced motion);
   - 7: don't let the row scroll toward the pane while the card is still returning from a reject drag;
   - 8: let the liked line wrap instead of truncating the handle;
   - 9: "Liked trades" / "Sign in to like trades", and mention likes in the page title and nav label;
   - 10: put the trade in the buttons' names, for example "Like JNJ by @dividend_dan. Only you can see likes.";
   - 11: render the heart and hide buttons only after hydration, or as forms;
   - 12: a lighter "Hide this trade".

COMPLIANCE: FAIL (A1: focus loss after Unlike; "Sign in" link not visible) · USABILITY: DEMANDS (1 swipe Undo never times out, 2 Unlike focus, 3 sign-in link, 4 heart state after first paint)

## Round 2

2026-10-24, against the production server on :3000 built from e4c989f (round diff `06b90b2..e4c989f`). I did not rebuild
or stop it. Fixture: 40 throwaway verified traders `ux2p4_*` (5 closes each, losses included, one 20-character handle),
which brought a section onto page 1, and a viewer `ux2p4_viewer`. All 41 users were deleted afterwards (cascade), along
with 40 of their 41 `signup_attempts`; the one left is referenced by `funnel_events`. Tools: Playwright Chromium with
real CDP touch at 360 and 375, light and dark, `prefers-reduced-motion: reduce`, keyboard only (no touch), JavaScript
off, `ariaSnapshot` plus Chromium's own accessibility tree (`Accessibility.getFullAXTree`). Screenshots:
`screenshots/pr4-ux2/`. No product code changed.

| Round-1 demand | Verdict | Evidence |
|---|---|---|
| 1 Swipe Undo ends at 5 s: card | **PASS** | I ran four touch swipes past half (360 light, 375 dark, 375 light reduced motion, 360 dark reduced motion). The bar opened 41 to 51 ms after the lift and closed at 5.06, 5.10, 5.06 and 5.07 s. Undo was focused with `:focus-visible` false and `outline: none`. Focus then went to the next card's name. The text reads "Trade hidden for 90 days." (`card-bar-open-*`, `card-bar-closed-*`). A tap on "…" followed by a tap on "Hide this trade" also closed at 5.04 s, with no ring on Undo or on the name. A swipe followed by a tap on Undo at 1.5 s brought the card back in place, with focus on its "…" and no ring. |
| 1 … section row | **PASS** | I swiped 58% of the row card at 375 light and at 360 dark with reduced motion. "Hidden for 90 days." appeared and closed 5.04 s after it opened. Undo had no ring, and focus moved to the next row (`section-bar-*`). |
| 1 … keyboard still pauses | **PASS** | At 375 light and 360 dark I went Tab to "…", Enter, Tab, Enter. Undo was focused with a ring and **was still open after 7 s**. Enter on Undo brought the card back with focus on its "…" (ring). Esc moved focus to the next card's name (ring) (`kb-undo-*`, `kb-after-esc-*`). |
| 2 Focus and announcement after Unlike (A1, 2.4.3) | **PASS** | Keyboard at 360 with 2 likes. Enter on the **last** Unlike moved focus to the previous row's Unlike (ring), and the status read "Unliked UAA0 by @ux2p4_long_handle_xx.". Enter again focused the "Liked records" heading (ring), "No liked records yet…" appeared, and the status read "Unliked UHJ0 by @ux2p4_t7.". `activeElement` was never `body` (`liked-after-unlike-all-360-light.png`). Without JavaScript, Unlike posts and the row goes. |
| 3 "Sign in" link not visible (A1, 1.4.1) | **PASS (removed)** | Signed out at 360, light and dark: 0 `[data-like]`, 0 `.like-signin`, 0 card "…", 0 `.ctray`, and the page-1 HTML has no like markup. A double tap and a 60% swipe produced no non-GET request and no `/me/liked` call, and the row did not move. The footer is 44 px with the link on one line (`signed-out-card-360-*`). |
| 4 No empty-then-filled heart | **PASS** | I delayed `/me/liked` by 700 ms and sampled every 50 ms from navigation. A liked card read "hidden" 15 times, then "♥ pressed" 29 times, and never ♡ (the very first sample was before the CSS applied). With a 1.5 s delay, the designed 1 s fallback shows ♡ for about 0.5 s and then ♥, which is accepted. The space stays reserved and the heart can't be focused while it's hidden. All 60 hearts on an appended page became ready. |
| 5 Double-tap hint and feedback near the thumb | Not done (follow-up stands) | No change. |
| 6 Commit cue past half | **PASS** | The tray darkens at 60% and not at 40%, with no motion and the same words. Light ≈ #dbdbdd → #babac0, dark ≈ #27272d → #454550. The label "Hide this trade" stays at ≥ 8.7:1 (`card-drag-40-*` vs `card-drag-60-*`). The card still vanishes on release (no slide-off); that half of the follow-up stands. |
| 7 Reversal also scrolls toward the pane | Not done (follow-up stands) | No change. |
| 8 Liked list truncates the handle | **PASS** | At 360, light and dark, each link reads "SYMBOL · closed DATE" with "@handle" on its own line. The 20-character handle is whole and `scrollWidth ≤ clientWidth` (`liked-list-360-*`). |
| 9 "Liked records" wording, title and nav | Not done (follow-up stands) | The h1 is pinned by `follow.spec.ts`. That needs another PR, not this one. |
| 10 Trade in the button names | **PASS** | The accessibility tree shows: button "Like UHJ0 by @ux2p4_t7. Only you can see likes." [pressed]. The card's "…" is DisclosureTriangle "More for UHJ0 by @ux2p4_t7" with expanded false/true, which is distinct from the pane's "More for @ux2p4_t7". "Hide this trade" is exposed only while its menu is open, so the screen reader's button list no longer has 30 identical controls. The bar is `status` (polite) › "Trade hidden for 90 days." › button "Undo". |
| 11 Inert controls without JavaScript | **PASS** | Signed in with JavaScript off, the heart is `visibility: hidden` (skipped by Tab, with an empty 44 px slot). The Tab order is name, ticker, link, "…". "…" opens natively, and "Hide this trade" posts: the reject is written, the page lands on `/`, and the card is gone (`nojs-*`). |
| 12 Lighter "Hide this trade" | **PASS** | It sits behind "…" (BL D1). The footer is one 44 px line: link, heart, "…". |

**Regression checks**
- **Card "…" by keyboard.** It passes:
  - Enter or Space opens it, and focus can Tab into "Hide this trade";
  - Esc closes it with focus back on "…" (ring);
  - Shift+Tab out of it closes it;
  - → and ← from "…" still open and close the pane (SW-1 keys).
- **Card "…" by touch.** The popover opens upward and stays fully on screen at 375, from x 227 to 370 (`menu-touch-open-*`, `kb-menu-open-*`).
- **Card "…" for screen readers.** It passes (row 10 above).
- **Card "…" without JavaScript.** It passes (row 11 above).
- **Next card's controls above the bar.** It passes. With the bar open, `elementFromPoint` at the next card's heart, "…" and link hits the control itself at 360 and 375. The footer bottom sits 23 px above the bar top (639 vs 662 at 360, 711 vs 734 at 375).
- **Tray darkening past half.** It passes (row 6 above).
- No page errors in any run.

**New findings**
- **N1. The card jumps when the bar closes (should fix; this round introduced it).** `[data-hide-bar] .feed .row > .card { padding-bottom: 100px }` is added while the bar is open and removed when it closes.
  - Because `.hero` is `flex: 1`, the card the reader is now looking at shifts when the bar goes, 5 s after the swipe: its return moves down 36 px and its footer 72 px. This happens at 360 and 375, with and without reduced motion, so it is an instant jump (`card-bar-open-375-dark.png` vs `card-bar-closed-375-dark.png`).
  - It happens on every hide. The heart and "…" are moving targets at the moment the bar closes.
  - Fix: reserve the space all the time for signed-in feed cards (the hero has room to spare), or keep the padding until the next scroll.
  - *Verify:* `.ret` top and footer bottom are equal with the bar open, at 5.1 s and after Undo.
- **N2. A ring appears on the next card's name after a touch swipe (should fix, small).**
  - When the bar closes after a **swipe**, `toCard()` focuses the next card's name. That name matches `:focus-visible` with a solid outline, because the swipe never moved focus by pointer.
  - After a **tap** hide, the same step shows no ring. The section-row swipe has the same issue: the ring lands on the next row.
  - Fix: pass `focusVisible: via.current === 'key'` to that `focus()` (and to the section path).
  - *Verify:* after a CDP swipe, the focused name has `:focus-visible` false; after keyboard Esc, it is still true.
- **N3. Hiding a trade without JavaScript gives no confirmation (follow-up).** The form lands on `/` (card 1, not where the reader was), with no "Trade hidden for 90 days." and no way to undo. `/me/following` lists no hidden trades. JavaScript-off readers are rare and Undo exists with JavaScript, so this is not blocking. It should travel with O3.
- **Note (not this PR).** At 360 one demo card ("−199…%") is 376 px wide, wider than its 360 px row, because of the return's min-content width. The footer's right gutter on that card is 4 px. The data causes it, not PR-4.

**Compliance (round 2).** POLICY A1 (WCAG 2.2 AA): **PASS**. Both round-1 failures are fixed (2.4.3 focus after Unlike; the 1.4.1 link is removed). Every new or moved control:
- has a name with context and is at least 44 px;
- shows a visible keyboard focus ring;
- carries state by shape (♡/♥) and by `aria-pressed`/`aria-expanded`;
- under keyboard, the timed Undo stays paused while focused (2.2.1);
- the tray is `aria-hidden`, and its label stays at ≥ 8.7:1 in both of its states.

F6 and privacy: **PASS** (unchanged: no count, no motion or reward, nothing signed out).

COMPLIANCE: PASS · USABILITY: DEMANDS (N1 the card jumps 36/72 px when the Undo bar closes; reserve the space for good; N2 no focus ring on the next card's or row's name after a touch swipe)

Ready to merge: no. It becomes yes once N1 and N2 land with their e2e assertions; I don't need another round of review for those.
