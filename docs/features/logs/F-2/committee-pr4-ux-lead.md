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
