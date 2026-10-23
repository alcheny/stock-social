# F-2 · PR-2 committee · UX lead

2026-10-23. Product code at `c477cab` (F-2 PR-2, follow and "not interested"). The existing `CI=1` build is newer than
every source file and already holds this PR's strings ("Hidden for 90 days.", "Only you can see this."), so I did not
rebuild. Setup:

- Port 3110, with the vendor fake on 4190. No sync tick was run.
- My own database, `ss_ux_pr2` (Postgres 16): the schema applied, then the seed (3 demo traders).
- Reduced motion. Keyboard only, at 375 × 667 and 1280 × 800, light and dark. One touch run at 375 (`hasTouch`).
- Viewers:
  - Signed out.
  - Signed in as fresh dev viewers. Each context got its own viewer, so every "first follow" really was the first.
  - Without JavaScript, signed in.
- Screen reader view: read from the DOM accessibility tree (ARIA snapshots), focus after each step, and the `role="status"`
  regions. I could not check a real screen reader.

Fixture: 12 test traders (`uxp2_t0`–`uxp2_t11`), each with 6 fresh closes, losses included. With the demo traders,
page 1 has 30 cards. The demo trader in the first card (`@dividend_dan`) also holds cards 11 and 21, which makes it a
good case for the in-place hide. Screenshots are in `screenshots/pr2-ux/`. Names are `<shot>-<width>-<scheme>-<in|out>`.

USABILITY: PROBLEMS (1 blocking, 13 follow-up)

## What works

- **Follow on the profile** (`profile-follow-*`, `profile-first-follow-*`; 4 contexts):
  - It sits right under the name and handle line, before the record facts, and it is not shown on your own profile.
  - It is the 6th Tab stop from the top, 79 × 44 as "Follow" and 105 × 45 as "Following".
  - Filled means "Follow" and outline means "Following", which is the familiar convention.
  - The toggle is optimistic. The status line came back in 53 to 71 ms, including the server round trip.
  - The first follow shows "Following @uxp2_t1. Only you can see this." The tree reads
    `button "Following" [pressed]` and `status: Following @uxp2_t1. Only you can see this.`
  - The line stays after 6 s. It is there for whoever looks for it, and it does not nag, because a second follow
    shows nothing.
  - The state survives a reload.
- **Follow in the pane** (`pane-header-*`, `pane-first-follow-*`):
  - The header reads Back → name link → Follow → "…". From a card's name link, Tab reaches them in the order symbol →
    "See their record…" → Back → name → Follow → "…". That is the order you see them in.
  - Both targets are at least 44 × 44.
  - The other copies of the same trader's pane on the page update with it: cards 1, 11 and 21 all went to
    `[pressed]`.
  - The pane header now reads "Dan @dividend_dan" with a space (the PR-1 item is fixed).
- **"Not interested", JavaScript on** (`pane-menu-*`, `not-interested-undo-*`, `not-interested-after-*`; 4 contexts
  plus touch). I hid `@dividend_dan` from card 1, which removes cards 1, 11 and 21:
  - 60 ms after Enter, 27 of 30 rows show and card 2 is at the top, on its trade side. Nothing animates and no other
    row moves.
  - The bar reads "Hidden for 90 days." with Undo, fixed at the bottom (62 px tall), and focus is on Undo (70 × 44).
  - The tree reads `status: paragraph: Hidden for 90 days. button "Undo"`. The bar is always in the DOM, so the live
    region is registered before it speaks.
  - At 5.3 s the bar is gone, and focus is on card 2's name link with a visible ring.
  - Undo at 1.8 s puts the 3 rows back where they were. After a reload, the hidden trader is gone and an undone one is
    back.
  - **TR-1 holds.** The hidden trader's profile still lists all 30 trades. The signed-out feed still opens with them.
- **Touch.** Tapping "…" and then the item hides the trader in the same way.
- **Placement of "Not interested"** (the deviation from the plan). The pane header is the right home until PR-3's
  section exists:
  - It is one per trader and sits next to Follow, the opposite choice.
  - It is never on the card itself, so the trade stays the subject.
  - "…" is the familiar overflow sign, and a screen reader hears "More for @x".
  - It takes two steps (swipe to the pane, open "…"), which suits a 90-day negative action.
  - The swipe gesture is planned for PR-4.
- **The signed-out path** (`profile-follow-*-out`, `pane-header-375-dark-out`):
  - "Follow" is a link named "Sign in to follow @x", 81 × 45, and goes to `/login`.
  - There is no "…" menu and no hide bar signed out.
  - `/me/following` signed out redirects to `/login`.
- **`/me/following`** (`me-following-*`):
  - It is reached from `/settings` ("Following and hidden traders", the 7th Tab stop). It has `noindex, nofollow` and
    the title "Following · Stock Social".
  - The privacy line "Only you can see these lists. Traders are never told." comes first.
  - It has two lists: "Following" (h1) and "Not interested" (h2), with the explanation "Hidden from your feed. Their
    profiles stay public."
  - Each hidden trader shows "until Jan 21, 2027" and a "Show again" button.
  - Empty states: "You don't follow anyone yet." and "No one is hidden." Both are plain.
- **No JavaScript** (`nojs-*`):
  - Profile Follow posts, and the page comes back as `[pressed]` "Following".
  - The "…" menu opens (it is a `<details>`). "Not interested" posts, and the feed comes back without the trader's 3
    cards.
  - Pane Follow posts. "Show again" posts, and the list empties.
- **Privacy.**
  - I searched the visible text of `/`, the profile and `/me/following` for the word "follower", and for a number
    next to "follow". There were no matches, signed in or signed out.
  - The signed-out profile's RSC payload carries only `FollowButton {handle, following: false, signedIn: false}`.
  - The share image has no follow data.
- **DESIGN Stage 5.**
  - Percent-only charts, with 0% on the axis, in the pane and on the profile.
  - ✓ Verified and Demo badges on cards and panes.
  - Losses in the loss colour.
  - SW-1: → opens the pane, ← returns to the card.
  - TR-1: above. The hide is per viewer and never touches a profile.
  - No celebration: following shows one plain line.

## Problems

1. **blocking: at 375 the "Not interested in @x" item runs off the right edge of the screen.**
   - **What happens.** The popover opens at the left edge of the "…" button (`position: absolute`, no right anchor).
     With "Following" beside it, that edge is at x = 133. For `@dividend_dan` the item is 285 px wide and ends at
     x = 418, which is 43 px past a 375 px screen. The row clips it, so the label reads "Not interested in @dividend_d"
     (`pane-menu-375-light-in`, `pane-menu-375-dark-in`).
   - **How it gets worse.** Handles can be 20 characters, which would cut about 100 px, most of the handle. That is the
     part that tells the reader who they are hiding for 90 days. Part of the tap target is off-screen too.
   - **Where it is fine.** At 1280 the item fits. For an 8-character handle it ended at 346, which also fits.
   - **Why it blocks.** This is the PR's headline control, on the primary device width. It is a visible defect on a
     negative action whose label must be readable before the tap.
   - **Fix direction** (the engineer's call): anchor the popover to the right edge of the button (`right: 0`), or cap
     its width to the viewport and let it wrap.
   - **Test to add.** At 375, with "Following" on and a 20-character handle, the item's right edge is at most 375 − 16.
2. **follow-up: unfollow says "Hidden from your feed for 90 days." but the cards stay.**
   - In the pane, the trader's other cards (11 and 21) stay in place and visible after an unfollow
     (`pane-unfollowed-*`). "Not interested" removes them at once. So the copy contradicts the screen until the next
     page or a reload.
   - Either collapse them as "Not interested" does, or change the line, if the owner keeps unfollow-hides (item 3).
3. **follow-up, for the owner: unfollow also hides.** I find it unexpected.
   - **Why.** Unfollowing means "I don't need updates from this person". It does not mean "I don't want to see them".
     A reader who follows and then unfollows to tidy their list loses that trader from the feed for 90 days.
   - **Hard to see.** The trader then appears under "Not interested" on `/me/following`, which is a choice the reader
     never made (`me-following-*`: `@uxp2_t5` was only unfollowed).
   - **What makes it acceptable for now.** The copy is honest and Undo is offered. That is why this is not blocking.
   - **Suggestion.** Unfollow returns the trader to neutral (the engineer's one-line option in deviation 2). At the
     least, name the list "Hidden" and show the reason ("unfollowed" or "not interested").
4. **follow-up: Follow and "Not interested" can both be true.**
   - "Not interested" leaves a follow in place (deviation 5). So `@dividend_dan` shows "Following" in the pane and on
     the profile while hidden from the feed. On `/me/following` they are in both lists.
   - A hidden trader whose button says "Following" reads as a contradiction.
   - **Suggestion.** "Not interested" should also end the follow (with Undo restoring both). Otherwise, the line could
     say "Hidden for 90 days. You still follow @x."
5. **follow-up: Undo of an unfollow drops focus.**
   - On the profile and in the pane, Undo sets the follow again, and then the Undo button unmounts. Focus falls to the
     page body (4 of 4 contexts).
   - The same happens when the 5 s run out while focus is on Undo.
   - On the feed, the next Tab then starts from the top of the page. Return focus to the Follow button.
6. **follow-up: Undo of "Not interested" puts focus somewhere you cannot see.**
   - The restored row is shown on its pane side (`scrollLeft` = width), which is right: that is where the reader was.
   - Focus goes to the card's name link, which is off-screen to the left, with `preventScroll` (3 of 4 contexts). In
     the 4th context (375 light), focus went to the body instead.
   - **Suggestion.** Focus the pane's "…" button or its Follow button, the control the reader came from.
7. **follow-up: the Undo bar times out even while focused.**
   - Focus moves to Undo, and the 5 s timer keeps running. When it runs out, focus is moved for the reader, to the
     next card.
   - A screen reader user who is still listening to "Undo, button. Hidden for 90 days." loses the button mid-thought.
     The hide can be reversed on `/me/following`, so nothing is lost for good, and this is a follow-up.
   - **Suggestion.** Pause the timer while focus or the pointer is in the bar.
8. **follow-up: the follow status line may not be announced.**
   - `.follow-status:empty { display: none }` keeps the `role="status"` paragraph out of the accessibility tree until
     text arrives. A live region that appears together with its text is often not spoken.
   - That line carries the privacy promise, "Only you can see this." It also carries the unfollow line with Undo.
   - The hide bar does it the right way: always rendered, and empty when quiet.
   - **Suggestion.** Keep the paragraph rendered and collapse it with zero height or margin, not `display: none`.
     I could not check this with a real screen reader.
9. **follow-up: the "…" menu does not close on Esc, on a click outside, or on Tab away.**
   - After Tab × 2 past it, the popover is still open over the "Following @x…" line and the chart label.
   - Esc closing the menu is the expected keyboard behaviour.
   - **Suggestion.** Close on Esc (and return focus to "…"), on an outside click, and when focus leaves.
10. **follow-up: the signed-out "Follow" lands on "Publish your trades", and the follow is lost.**
    - `/login`'s heading is for publishers (`login-from-follow-*`). After signing in, the viewer goes to their own
      profile, not back to the trader, and nothing is followed.
    - The deviation is documented, and "Sign in to watch" works the same way, so this is a follow-up. It is the main
      conversion path from a shared profile link, though.
    - **Suggestion.** A return path on `/login` (the plan's `next`), and a sign-in heading that fits a follower.
11. **follow-up: no-JS paths lose the reader's place and say nothing.**
    - Without JavaScript, "Not interested" and pane Follow both reload the feed at card 1, with no message (no "Hidden
      for 90 days.", no Undo). Focus starts on the body.
    - The first no-JS follow on a profile does not show the privacy line "Only you can see this." (it is client-only).
      `/me/following` still states it.
12. **follow-up: `/me/following` details.**
    - **"Show again" gives no feedback.** It reloads with focus on the body and no line saying who is back. Add a
      status line, such as "@x is back in your feed.", and focus the list.
    - **Cramped at 375.** "Show again" wraps to two lines (97 × 68) and "until Jan 21, 2027" breaks mid-date
      (`me-following-375-*`). Keep the date on one line, and stack the button under the name, or shorten it to
      "Show".
    - **The name.** The h1 "Following" is also the name of the first list, so the page title undersells the second
      list. "Following and hidden" would match the `/settings` link.
    - **Hard to find.** The page is reachable only from `/settings`, and the empty state offers no way back to the
      feed. A link from the pane's "…" menu ("Manage hidden traders") would help people find it.
    - **Unfollowing here.** It keeps the row, with "Follow" and the Undo line. The trader moves to "Not interested"
      only after a reload.
13. **follow-up: the toggle changes both its label and its `aria-pressed`.**
    - A screen reader hears "Following, toggle button, pressed": the state is said twice.
    - The button's name also lacks the handle in the pane ("Follow"), although the name link just before it gives the
      context.
    - **Suggestion.** Either keep the label "Follow" with `aria-pressed`, or drop `aria-pressed` and name it "Follow
      @x" or "Following @x".
14. **follow-up: two small visual notes.**
    - **Signed-out "Follow".** It is the outline (secondary) style, which is the same look as signed-in "Following". It
      reads as "already following". Use the filled style.
    - **Width change.** The button grows from 79 to 105 px when it flips, which shifts "…" sideways under the finger.
      A fixed minimum width (about 105 px) avoids it.

## Older issues seen again (not this PR)

- At 375, a long name plus handle plus badge clips the handle in the pane header ("Ux Trader 1 @uxp2_t…").
- Following a Demo trader is allowed. That is harmless, but noted for the business lead.

## Environment

- The database was my own, `ss_ux_pr2`. No other member's fixture was in the feed.
- Build check: no file under `app`, `lib` or `db` is newer than `.next/BUILD_ID`. No rebuild was
  needed, and no advisory was hit.

The server and the fake are stopped. Test users (`uxp2_*`, 28 rows; their follows and exclusions went with them through the
cascade) are deleted. The database `ss_ux_pr2` is dropped. No product code was changed. Launcher and scripts are in the
scratchpad (`ux/f2pr2`).

USABILITY: PROBLEMS

## Round 2

2026-10-23. Product code at `6fb8952` (fix round 1). The existing `CI=1` build is newer than every file under `app`,
`lib` and `db` and already holds the new strings ("is back in your feed."), so I did not rebuild and no advisory was
hit. Setup:

- Port 3112, with the vendor fake on 4192. No sync tick was run.
- My own database, `ss_ux_pr2r2` (Postgres 16, created as the superuser and owned by the shared role): the schema, the
  seed (3 demo traders), and 12 test traders with 6 closes each. One of them has a 20-character handle,
  `uxp2_longhandle_2026`, and a long display name ("Ux Trader With Long Name"), to test the worst case.
- Reduced motion. Keyboard only, at 320, 375 and 1280, light and dark. A fresh signed-in viewer for each context.
  Separate runs: signed out, and signed in without JavaScript.
- Screen reader view: ARIA snapshots, focus after each step, and the live regions. No real screen reader.

Screenshots are in `screenshots/pr2-ux2/`, named `<shot>-<width>-<scheme>`. The launcher and scripts are in the scratchpad (`ux/f2pr2r2`).

### Round 1 items, checked again

| # | Round 1 | Now | Evidence |
|---|---|---|---|
| 1 | **blocking**: the "…" item ran off screen at 375 | **Fixed.** "…" sits at the header's right edge and the popover opens leftward. With "Following" on and the 20-character handle, the item spans x 20–300 at 320 (280 × 68, two lines), 20–355 at 375 (335 × 68), and 557–920 at 1280. The full label "Not interested in @uxp2_longhandle_2026" is readable in all 6 contexts, and the page width stays equal to the screen | `pane-menu-20char-*` |
| 2, 3 | Unfollow claimed to hide, and hid | **Fixed** (the owner can reverse it with `FEED_HIDES_UNFOLLOWED`). After an unfollow, all 3 of the trader's cards stay, there is no line, and the button reads "Follow" again. Nothing appears under "Not interested" | `pane-unfollowed-*` |
| 4 | Follow and "Not interested" can both be true | Open, and recorded as a follow-up. `@uxp2_longhandle_2026` is listed under both "Following" and "Not interested" | `me-following-hidden-*` |
| 5 | Undo of an unfollow dropped focus | **Gone.** The unfollow has no Undo now, and focus stays on the button (`Follow`, not pressed) | — |
| 6 | Undo of a hide put focus off screen | **Fixed.** After Undo, the 3 rows come back, the row is on its pane side, and focus is on that pane's "More for @x" (44 × 44), inside the viewport in 6 of 6 contexts | `not-interested-undone-*` |
| 7 | The bar timed out under focus | **Fixed for the keyboard.** After a keyboard hide, focus is on Undo (`:focus-visible`), and at 7 s the bar and its 3 hidden rows are still there. Esc closes the bar, and focus goes to the next card's name link, on screen | `not-interested-bar-*` |
| 8 | Live region with `display: none` | **Fixed.** The paragraph is always rendered as `aria-live="polite"` with a height of 0 when empty. The first follow fills it with "Following @x. Only you can see this." A second follow (another trader) says nothing, so the privacy line comes once | — |
| 9 | Menu did not close | **Fixed.** Esc closes it and puts focus back on "…". Tab moves to the item, and the next Tab closes it. A click outside closes it. All 6 contexts | — |
| 10 | Signed-out Follow lost the follow | **Removed.** Signed out, there is no Follow and no "…" on the profile or in the pane. The return path is recorded as a follow-up | `profile-out-*`, `pane-out-*` |
| 11 | No-JS posts said nothing | **Fixed.** Each form lands on the trader's profile with one line: "Following @x. Only you can see this." (first follow), "Following @x.", "Unfollowed @x.", or "@x is hidden from your feed for 90 days. Their profile stays public." A crafted `?done=hidden` for a trader who is not hidden shows nothing | `nojs-*` |
| 12 | `/me/following` details | **Mostly fixed.** It is reachable by keyboard from your own profile: Settings is the 7th Tab stop, and "Following and hidden traders" is the 2nd stop on `/settings`. The h1 is "Following and hidden traders", with h2s "Following" and "Not interested". Buttons stay on one line (121 × 45), and "until Jan 21, 2027" has its own line. "Show @x again" gives "@x is back in your feed.", and a crafted `back=` for someone still hidden shows nothing. Open: focus after "Show again", and the menu link (both recorded) | `me-following-*` |
| 13 | The state is said twice | Open, recorded: `button "Following" [pressed]` | — |
| 14 | Follow style and width | **Fixed.** Outline in both states, 112 px in both, so neither Follow nor "…" moves when the button flips | `pane-following-*`, `profile-follow-*` |

### What works (new in this round)

- The Undo bar fits at 320, with Undo at 70 × 44 inside the screen.
- The hide still removes all 3 cards in about 100 ms, without motion.
- The profile Follow is still the 6th Tab stop.
- Following text contrast is 5.25:1 (light) and 5.35:1 (dark).
- The new copy is plain, makes no claim, and names no count. No follower numbers appear anywhere.

### Problems (round 2)

No blocking problems. These follow-ups are new or still open:

1. **follow-up: on `/me/following`, a long name hides the handle at 320 and 375.**
   - "Ux Trader With Long Name" fills the name column, and the handle is cut off or gone. At 320 the name itself reads
     "Ux Trader With Long" (`me-following-show-again-320-light`, `me-following-hidden-375-dark`).
   - On a page whose purpose is to tell people apart before un-hiding them, the handle is the one unique part.
   - The accessible names are complete ("Show @uxp2_longhandle_2026 again").
   - **Suggestion.** Wrap the name, or put the handle on its own line, the way the date already is.
2. **follow-up: focus after "Show again" is on the page body.**
   - The `role="status"` line "@x is back in your feed." is present when the page loads. A status region that arrives
     with the page is often not read.
   - The engineer has already recorded this. Focus the line or the list.
3. **follow-up: the bar's pause depends on `:focus-visible`.**
   - A hide made with a click (or the activation a screen reader's browse mode sends, which may count as a click) puts
     focus on Undo, but the 5 s timer still runs. The keyboard case is fixed.
   - The hide can be undone on `/me/following`, so nothing is lost.
   - **Suggestion.** Pause whenever focus is inside the bar, whatever moved it there. I could not check this with a real
     screen reader.
4. **follow-up: Tab on Undo closes the bar.** A keyboard user who presses Tab just to move on also dismisses Undo. Esc
   closing it is enough. Tab could move focus on and let the timer resume.
5. **follow-up: the "Settings" link on your own profile measures 61 × 20.** Its padding or spacing may already meet the
   24 px minimum. A 44 px tap area would match the other controls.
6. **follow-up: the outline Follow has a faint border.** It is 1.26:1 (light) and 1.20:1 (dark). The label carries the
   meaning, so this is not a contrast failure. The muted "Following" in dark reads close to disabled
   (`pane-following-375-dark`). Taste, for the designer.
7. **follow-up: the no-JS hide line offers no way back.** "@x is hidden from your feed for 90 days." could link to
   `/me/following`, the only place to undo it without JavaScript.
8. **Still open from round 1** (all recorded by the engineer): item 4 (Follow plus "Not interested"), the sign-in return
   path, the "Manage hidden traders" link, and item 13 (the state said twice).

### Older issues seen again (not this PR)

- At 320 and 375, the pane header still cuts the name and hides the handle ("Ux Trader Wi", `pane-menu-20char-320-*`).
- At 320, the "+11.5%" avg-return stat runs past its tile's right edge on the profile and in the pane
  (`profile-follow-320-light`).

### Environment

The database was my own, `ss_ux_pr2r2`. No product code was changed. The server and the fake are stopped. Test users
(`uxp2_*`) are deleted, and their follows and exclusions went with them through the cascade. `ss_ux_pr2r2` is dropped.

USABILITY: PASS
