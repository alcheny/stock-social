# F-2 PR-4 likes and gestures: business lead verdict

2026-10-24. Commit 06b90b2 (diff `4741538..06b90b2`). I judged it against the owner decisions O1 (the reject swipe on
the trade card), O4 (unfollow is a slight negative) and the still-open O3 in the feature file, against plan PR-4, my
rulings in `committee-pr1b-business-lead.md` §5, POLICY and COMPLIANCE §1.

I used it as a user on the shared production server on port 3000, at 375 px with touch emulation (real touch events
through the browser's input pipeline), in light and dark. I created throwaway users `blpr4_viewer` and `blpr4_trader`
and a fixture of 12 verified traders (`blpr4_t0..11`, 5 closes each, gains and losses) so my rows would survive the
other members' fixtures, which were changing during my run. Afterwards I deleted all 14 users and their trades, likes
and rejects. I did not restart, rebuild or sync anything. Screenshots are in `screenshots/pr4-bl/`.

**Decision: ship once D1 to D4 are met.** The gestures do what the owner asked, the guards hold, and likes are truly
private. Three things are not done. The card now carries a loud "Hide this trade" button on every signed-in card. A
signed-out visitor from a shared link gets a heart that leads to a trader sign-up page with no way back. The new
"Liked records" list cuts the handle off at 375.

Demo sentence: "Double-tap a trade to keep it, and only you can see that. Swipe it the other way and it's gone, with
Undo."

## Preliminary user test (plain words)

**First-time viewer, from a shared link, signed out** (`so-01` to `so-04`)
- I opened a trader's profile link, then the feed. Each card now has a heart in the bottom-right corner. Nothing told
  me what it does, but a heart is obvious.
- I tapped it, and also tried a double tap on the card. Both showed one line: "Sign in to like records. Only you can see
  likes. Sign in". Nothing was written and no request other than GET was sent. That part is good.
- **Stopped me:** "Sign in" took me to `/login`, a page headed "Publish your trades" with "Connect a brokerage
  instead". I came to read records, not to publish mine. After signing in I would not come back to the card I wanted
  to like. PR-2's fix round 1 already removed Follow for signed-out visitors for exactly this reason. → D2.
- Swiping the card the reject way while signed out does nothing (correct). The opening swipe still opens the pane
  (scrollLeft 375). SW-1 is intact.

**First-time trader** (`tr-01`, `tr-03`)
- I signed up, landed on my profile and opened the feed. My own card has no heart, no "Hide this trade" and no tray
  (checked as `blpr4_t8`). The server also refuses a like of your own trade (engineer's test).
- My public profile HTML says nothing about likes. A trader is never told who liked or hid their trades. That is right
  under F6 and the owner's "likes are private" decision. Nothing about PR-4 confused me as a trader, because a trader
  sees nothing of it.

**Signed-in viewer** (`vw-01` to `vw-06`)
- A double tap on the card body filled the heart once (outline to filled, no motion, no count) and wrote one row. The
  second tap landed about 50 ms after the first; my 169 ms figure includes the 120 ms gap I put between the two taps.
  That meets the < 100 ms budget. A single tap does nothing: no navigation and no pane.
- After a reload the heart first shows as outline, then fills about 150 ms later (the `GET /me/liked` read, point 4).
  It is a barely visible flick, with no motion.
- Reject swipe: at 40% of the card it snaps back with no write. At 55% the grey tray "Hide trade" shows behind the card.
  On release the card drops, the next card takes its place, and the bar says "Hidden for 90 days." with Undo focused.
  Undo brings the card back and focus returns to "Hide this trade". Opening the pane, swiping straight back and then
  swiping the reject way at once rejected nothing. A diagonal drag rejected nothing. Verified as the owner's guards.
- **Confused me:** the bar reads "Hidden for 90 days.", the same words as hiding a whole trader, but this trader's other
  cards stay. I couldn't tell which one I had hidden. → D4.
- **Bothered me:** with the bordered "Hide this trade" button next to the heart, the card footer wraps to two lines on
  every card. That button is the most prominent control on the card after the return. A negative action should not
  out-shout "See their record". → D1.
- Settings → "Following and hidden traders" → "Liked records" lists my like with Unlike, which works without
  JavaScript. **Stopped me:** the row reads "ZBI3 · closed Oct 24, 2026 · @blp". The handle is clipped (link
  scrollWidth 296 px against 256 px), with no ellipsis. The section also repeats the page's privacy sentence word for
  word. → D3.
- No request to any event endpoint was sent (route watch). A failed save, which happened once when another member's
  fixture trader was deleted under me, showed "Couldn't save that. Try again." and the card came back. That is honest.

## Scorecard

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | A double tap to like and a swipe to dismiss are observed behaviour across mainstream feeds and matching apps (analogy tier). It is the owner's chosen vocabulary. There is no in-product data until PR-5 reads the signals. |
| Ease of adoption | 4 | It adds no steps, and the double tap needed no explanation. The hide gesture can't be discovered by sight, but it has a button. The signed-out heart is a dead end (D2). |
| Phase fit | 4 | It gives PR-5 explicit signals. Today it already works as a private "keep" list, which is value on its own. |
| Revenue impact | 3 | Indirect: likes and rejects become ranking inputs only in PR-5. Unproven until like rate and hide rate per 100 cards are measured. |
| Aesthetics & clarity | 3 | Two bordered buttons wrap the footer on every signed-in card. The footer is a different height signed in and signed out. The liked row clips. It rises to 4 with D1 and D3. |
| Trust & compliance | 5 | No counts anywhere. Nothing on the profile, share card or OG image. A like on a loss is the same as on a gain. No celebration. The trader-level negative is per viewer and never a hide. Rejects and likes are deleted with the account. |
| Simplicity | 4 | 640 product lines, under the 800 cap. One drag recognizer, one pure preference module, no dependency and no event table. Three strings name one action ("Hide trade", "Hide this trade", "Hidden for 90 days."). |
| Craft & taste | 3 | The guards are excellent. But a handle is clipped, the signed-out heart leads nowhere useful, and the tray gives no cue at the commit point. |

## Rulings on the engineer's seven points

1. **The card reject is a drag of the card, not a scroll-snap tray: accept.** A drag that starts at rest is a stronger
   snap stop than a tray, because momentum never counts and only the finger does. It also keeps the card's rest point
   at `scrollLeft = 0`, which SW-1, the keys and the pager rely on. I verified it live: 40% snaps back, 55% commits,
   a fling back from the pane never rejects, and a diagonal scrolls. O1 says "the same guards as the section swipe".
   That means the same behaviour, not the same mechanism, so this is delivered.
2. **The trader part of a reject is −1, not −4: accept, and I withdraw my §5 wording.** The owner's O1 text ("−4 to
   the trade and a slight negative preference to its trader") came after my "trader-level −4" and overrides it.
   Equal to unfollow is the right reading of "slight". Condition: PR-5's scoring reads the same
   `WEIGHTS.rejectTrader`, with no second constant.
3. **O3 stays at a 90-day default: accept as the placeholder. My recommendation to the owner is unchanged:** a
   rejected trade stays hidden permanently, and the trader part ends at 90 days. Flag for the owner: the
   2026-10-22 decision says "the card is not shown again", which reads as permanent. Today's "Hidden for 90 days."
   is the open-question default, not the decision. It is not a block, because O3 is explicitly open and the flip is
   one constant with its copy and its tested `until = 'infinity'` path.
4. **Like state read after first paint via `GET /me/liked`: accept.** Keeping the feed's own read the same for every
   viewer (the PR-2/PR-3 guard tests) is worth more than a filled heart on first paint. The cost I measured is a
   ~150 ms flick, with no motion, only on cards already liked. Privacy: the keys are the cards on screen. The list is
   the same for every viewer apart from their own rejects, so nothing personal is in the URL, and the response is
   `private, no-store`. No guard test is restated.
5. **−1 is slight in practice: accept, no tuning.** The owner asked for "slight". Comparing twins, not positions, is the
   right test. Do not move to −2 on intuition. Revisit only with PR-5 data (the hide rate of a trader after an
   unfollow or a reject).
6. **The exploration-pool fix in `shapeList`: accept, and it is the most valuable line in this PR.** Without it, every
   unfollow under O4 would silently remove PR-1b's outside traders from that viewer's feed. That is a reach
   regression against the supply gate. Reviewer: confirm the "keeps PR-1b's extra cards" case fails on 4741538.
7. **Known limits (a "Not interested" after an unfollow replaces the row; "Show again" ends the −1): accept.** No
   user can see either effect beyond a one-slot move at a page join, and both clear at the next page 1. "Show again"
   ending the negative is the honest meaning of the words.

Also accepted: the pinned tests were restated as I conditioned in §5 (criterion 4 now reads "applies the unfollow
weight … never removes the trader's cards or section rows"). The count went up, 623 → 643, and none was removed.

## Compliance review (POLICY, COMPLIANCE §1)

| Item | Result |
|---|---|
| §1.1 performance (F1 to F4) | No new performance number. The liked list shows symbol, date and handle only. Likes, rejects and preferences never read the sign or size of a return. Losses are treated as gains. Every feed card keeps the disclaimer footer. **Pass.** |
| §1.2 personal data (P3, P6) | Two viewer-private tables, `trade_likes` and `trade_rejects`. Each row holds a viewer id, a hashed trade key, a trader id and times only. Every read is keyed by the session's own id. Nothing is stored signed out. They are deleted at account deletion's first step, and ended rejects are purged after a day. Open, and not this PR's fault: the Privacy text (pre-authorization #10, H4) must list likes and hidden trades before real users. That is already a pre-launch gate. **Pass.** |
| §1.3 money, F5, F6 | No points or rewards, nothing convertible. No burst, sound or vibration on a like. Nothing is tied to trade frequency, and the trader is never told. **Pass.** |
| §1.4 tracking | No event table and no event endpoint called (verified). `/me/liked` is first-party and `no-store`. **Pass.** |
| §1.5 user text, §1.6 sign-up and age | No change. **Pass.** |
| §1.7 vendors and dependencies | None. **Pass.** |
| §1.8 accessibility (A1) | Every gesture has a button ("Like…" with `aria-pressed`, and "Hide this trade"). Both are 44 px, the state is carried by shape not colour, reduced motion is respected, and Undo is in the `role="status"` bar with focus managed. Names lack context (30 identical "Like" buttons), which is allowed in context. Follow-up F2. **Pass.** |
| §1.9 security | Session-bound actions. The key is checked against the pattern before any query, and own trades are refused. **Pass.** |
| §1.10 claims, scanner words | "Like", "Hide this trade", "Liked records". There is no buy, sell, pick, signal or advice, and `LIKES` is in `allCopy`. **Pass.** |
| Product rules | Signed-out feed works. No per-trade hiding on the trader's record (a reject hides a card from one viewer's feed only, never from the profile, so TR-1 holds). SW-1's opening direction is intact, and the reserved-gesture amendment matches O1. **Pass.** |

## Demands (builder, in priority order)

1. **D1 Put "Hide this trade" behind the card's "…".** Use the existing `more-menu` pattern from the pane's "Not
   interested in @x". The control stays the keyboard and screen-reader route of the swipe (A1). The footer keeps one
   line at 375 px whether signed in or out: link on the left, then the heart, then "…". Why: a bordered negative button
   on every card is the loudest control after the return, it wraps the footer, and it invites hiding. The gesture is
   the primary path, and the button only needs to exist. Verify: footer height at 375 is the same signed in and signed
   out. From the heart, Tab → "…" → Enter → "Hide this trade" → Enter hides the card, with focus on Undo and back on
   "…" after Undo. The e2e and screenshots are updated in light and dark.
2. **D2 No heart for signed-out visitors.** Double tap does nothing signed out, and `.like-signin` is removed. This is
   the same rule PR-2 fix round 1 set for Follow: sign-in cannot return to the card and lands on the trader page
   "Publish your trades". Why: shared links land signed out, and the first screen should be the record, not a control
   that leads somewhere else. Revisit when sign-in honours a return path (F-1). Verify: signed-out e2e finds no
   `[data-like]` and no `.like-signin`, no non-GET request, and the signed-out page 1 HTML shrinks.
3. **D3 "Liked records" fits at 375.** Let the row wrap: the symbol and date on one line, `@handle` under it or wrapped,
   and never clipped. Delete `LIKES.explain`, because the page's "Only you can see these lists. Traders are never told."
   already covers it. Verify: with a 20-character handle at 375, every link's `scrollWidth ≤ clientWidth`. The copy
   scan passes, and a screenshot is attached.
4. **D4 One name for one action.** The bar after a trade reject reads "Trade hidden for 90 days." ("Trade hidden." if
   O3 goes permanent), so it differs from the trader hide. The tray reads "Hide" or "Hide this trade", whichever the UX
   lead prefers, but the same words as the menu item. Verify: the copy test and the e2e text match.

Follow-ups (not blocking):
- **F1** A commit cue on the tray past half the card: a contrast or weight change on the label, with no motion and no
  new words.
- **F2** Accessible names with context: "Like ZBI3 by @x. Only you can see likes."
- **F3** Make the liked list findable: the Settings link and page title become "Following, likes and hidden traders"
  (or shorter). The like's value today is that list.
- **F4** Measure from PR-5: like rate and hide rate per 100 cards seen, and the hide rate by card position (a high
  first-card hide rate means accidental swipes).

Reviewer: confirm the exploration-pool regression test fails on 4741538 (point 6), and check that the footer is one line
at 375 after D1.

## What would change my mind

If PR-5 shows a hide rate above ~5 per 100 cards concentrated on the first two cards, accidental rejects are real.
In that case raise the commit point to 60% of the card, or ask the owner to drop the gesture to menu-only on the feed.
If the like rate is under 1 per 100 cards, the double tap is not being found: test a one-time hint on the first
session, which the owner would have to approve as onboarding text.

COMPLIANCE: PASS · USABILITY: DEMANDS (D1 move "Hide this trade" behind the card's "…", footer one line at 375; D2 no heart signed out, same rule as Follow, since sign-in lands on the trader page with no return; D3 "Liked records" clips the handle at 375, drop the repeated privacy line; D4 trade-reject bar "Trade hidden for 90 days.", one name for the action)

## Round 2

2026-10-24. Commit e4c989f (fix round 1, `git diff 06b90b2 e4c989f`; the engineer's table at the end of
`build-pr4-engineer.md`). I re-used the app on the shared production server on port 3000 at 375 px with real touch
events, signed out, signed in and without JavaScript, in light and dark. Fixture: 12 verified traders (`bl2p4_t1..11`
and the 20-character `bl2p4_long_handle_xx`, 5 fresh closes each) and the viewer `bl2p4_viewer`. All 13 users, their
trades, likes and rejects were deleted afterwards (no orphan rows). Nothing was rebuilt, restarted or synced.
Screenshots are in `screenshots/pr4-bl2/`.

| Demand | Verdict | Evidence |
|---|---|---|
| D1 "Hide this trade" behind the card's "…", footer one line at 375 | **Met** | Footer is 44 px tall on all 8 measured cards, both signed in and signed out. The link is on one line (one client rect, 19 px). Heart 45×44 and "…" 44×44 sit right of the link (`si-01-card-footer`). Keyboard: from the heart, Tab goes to "More for L1 by @…", then Enter, Tab, "Hide this trade", Enter. That card is hidden, the trader's other cards stay, the bar says "Trade hidden for 90 days.", Undo has focus, and there is 1 reject row. The bar is still open at 6.3 s (the keyboard pause). Undo brings the card back, 0 rejects, and focus is on "…" (`kb-01`). Esc closes the menu with focus on "…". The popover opens upward inside the screen, and its button is the top element at its centre (`si-02`). Without JavaScript, "…" and "Hide this trade" post. You land on `/` with the card gone and 1 reject (`nojs-01/02`). |
| D2 No heart signed out | **Met** | Signed-out page-1 HTML (306 KB) has 0 `data-like`, 0 `like-signin` and 0 `ctray`. The DOM has no heart, card "…" or tray. A double tap on the return and a 220 px drag the reject way did nothing: no transform, no navigation and 0 non-GET requests (`so-01/02`). The footer is the same 44 px as signed in. |
| D3 "Liked records" fits at 375 | **Met** | Three rows, including `@bl2p4_long_handle_xx`, read "SYMBOL · closed Oct 24, 2026", with the handle on its own line. Every link has scrollWidth 256 = clientWidth 256. "Only you can see likes." is gone, and the page's own line says it once (`list-01`). Unlike by keyboard moves focus to the next row's Unlike and the status says "Unliked QBH0 by @bl2p4_t7." (`list-02`). The public profile HTML has no like word or attribute. |
| D4 One name for one action | **Met** | Tray, menu item and copy all read "Hide this trade" (`LIKES.tray` deleted). The bar reads "Trade hidden for 90 days." after a swipe, a menu tap and the keyboard, so it differs from the trader hide. |
| Follow-ups F1, F2 (taken) | Done | The tray is not marked at 40% and is darker at 60% (`sw-01`, `sw-02`). Button names carry the trade: "Like L1 by @yolo_yuki. Only you can see likes." and "More for L1 by @yolo_yuki". |

Also re-verified: a 40% drag snaps back with no write, and 60% commits. After a swipe or a menu tap, Undo has focus
with no ring, the bar is open at 4.8 s and gone by 6.0 s, so the PR-4 High is fixed. The next card's heart is not under
the open bar. A double tap writes one like. No `/api/event*` request was made.

**New, introduced this round: the card on screen jumps when the bar closes.** `[data-hide-bar] .feed .row > .card
{ padding-bottom: 100px }` pads every feed card while any hide bar is open: trade hides, and PR-2/PR-3's "Not
interested" too. The card stays 799 px tall, so its contents move up. When the bar closes at 5 s, the card the viewer is
reading drops back with no input from them. Measured on the next card after a menu-tap hide, the return moved 318 → 354
(36 px) and the heart and footer moved 655 → 727 (72 px). It is the same after a swipe (`sw-03` against `sw-04`). The
headline number moving on its own reads as a glitch, every time someone hides anything. A tap aimed at the heart around
the 5 s mark lands 72 px above it. That is harmless today, because a single tap on the body does nothing, but it is
sloppy. The fix for the tester's Medium 1 was right to keep the controls clear of the bar. It should not move the card
being read.

### New demand

5. **D5 The card on screen never moves because the bar opens or closes.** Keep the controls clear of the bar, but by a
   means that does not reflow the visible card when the bar goes away. Options: keep the extra room until that card
   leaves the screen, place the bar where it covers no control, or reserve the room permanently if the UX lead prefers.
   The method is the builder's and UX lead's call. Verify (e2e, 375 px): after a swipe hide and after a "Not
   interested" hide, the next card's `.ret` and heart `top` are unchanged within 1 px from bar open, through 6 s, to
   after close, and `elementFromPoint` at its heart and "…" is still not the bar.

Follow-ups (not blocking):
- **F5** The footer link went from about 15 px to 13 px for everyone. That was needed only where the heart and "…" share
  the line. Signed out, where shared links land, nothing else is on the line. Keep the old size there (for example
  `.card footer:not(:has(.card-acts)) > a`).
- **F6** When the bar closes after a touch hide, focus goes to the next card's name with a visible ring (`sw-04`). That
  is right for the keyboard, but after a touch the ring is noise. The UX lead decides.
- Environment note, not PR-4: the seed user `yolo_yuki` has 10,030 closed trades in the shared DB from other fixtures,
  including −199.0%. That is impossible long-only, and it overflows the 375 px gutter on the first card. Clean the
  shared DB before the next demo.

Scorecard changes: Ease of adoption 4 → 5 (D2: no dead end from a shared link). Aesthetics & clarity 3 → 4 (one footer
line, the list fits). Craft & taste stays 3 until D5. Trust & compliance stays 5.

Compliance re-check of the round: no new data, table, vendor, number or claim. The new strings ("Trade hidden for 90
days.", "More for SYMBOL by @x", "Unliked SYMBOL by @x.", "Showing your 200 most recent likes.") contain no advice,
signal or completeness claim. The 200-row cap is stated honestly. Every new control is 44 px and reachable by keyboard,
and Unlike keeps focus (WCAG 2.4.3). **Pass.**

COMPLIANCE: PASS · USABILITY: DEMANDS (D5 the card being read jumps 36 to 72 px when the hide bar closes, because every feed card is padded while any bar is open; keep the controls clear of the bar without reflowing the visible card)

Ready to merge: no. D1 to D4 are met. Only D5 remains, a regression introduced this round on every hide.
