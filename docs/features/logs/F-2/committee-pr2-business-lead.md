# F-2 · PR-2 committee · Business lead

2026-10-23. Build of `c477cab` (`.next` newer than every source file under `app/` and `lib/`), `next start` on 3109
with `ALLOW_DEV_AUTH=1`, vendor fake on 4189, Postgres 16, my own database (created from the shared credentials, schema
and demo seed applied, dropped afterwards). No sync tick. Fixture: the 3 demo traders plus 60 scratch traders (5
hyperactive, 55 ordinary) and one dev-signed-in viewer, all deleted (61 rows) before the drop. 375×667, light and dark.
Server and fake stopped. No product code changed.

**Decision: fix four things, then merge.** The private-follow core is right: nothing leaks, the "Only you can see this."
line is the best moment in the PR, and "Not interested" with Undo is fast and lands the reader exactly where they were.
But the only payoff of Follow and the only recovery after the 5 s Undo live on a page a viewer cannot reach, the "…" menu
runs off the screen at 375, unfollow does something no viewer expects, and signed-out Follow sends a shared-link reader
away from the trader they came to see.

## User test

- **Signed out, from a shared link (`/u/<trader>`).** The first control under the handle is now an outlined "Follow"
  (45 px, named "Sign in to follow @x"). Tapping it opens **"Publish your trades / Read-only. We can never place trades
  or move money."**, the trader sign-up page. After signing in, the reader lands on their own empty profile ("You're
  in. Next: connect your brokerage."). The trader they wanted to follow is gone from the journey, with no way back but
  the browser's history.
- **First follow (profile).** The button turns to "Following" on the tap, and one line appears: "Following @x. Only
  you can see this." It stays until the page changes, shows only on the first-ever follow (my second follow showed
  nothing), and is true. It sets the trust frame in seven words. Keep it exactly as is.
- **Unfollow (profile and pane).** "Unfollowed @x. Hidden from your feed for 90 days." with Undo, for 5 s.
  - On the profile the line wraps as "…for 90 / days. [Undo]" at 375 (`04-unfollow`).
  - In the pane, the line says "Hidden from your feed", yet the trader's card stays on screen. I counted the
    trader's visible rows: 1 before the unfollow, 1 after. The copy is false at the moment it is shown. Only
    "Not interested" removes cards in place (`app/feed-hides.tsx`); unfollow does not.
  - On `/me/following` the unfollowed trader is listed under **"Not interested"**, a choice the viewer never made.
- **"Not interested" (pane "…" menu).** Swipe to the pane, tap "…", tap "Not interested in @x":
  - The trader's 3 cards left the page (30 → 27 visible rows). The next trader's card was at the top with no motion.
    "Hidden for 90 days." appeared with Undo focused.
  - After 5 s the bar was gone and focus was on the next card.
  - Undo (second trader): 29 → 30 rows, and I was back on the pane I hid from (`scrollLeft` 375). That is exactly right.
  - The hidden trader's profile still lists every trade and still offers Follow (TR-1 holds).
- **The menu is clipped at 375.** The popover opens left-aligned under "…" and runs past the right edge: the item box
  spans x 106 to 391 on a 375 viewport, and "Not interested in @dividend_dan" loses its last letter (`06-menu`). A
  20-character handle (the maximum) is about 90 px worse.
- **`/me/following` is unreachable.** Its one link is on `/settings`. `/settings` is linked only from `/connect` (the
  trust notice). I checked the links on `/`, the viewer's own profile, `/me/record`, a trader profile and `/connect`:
  only `/connect` links to settings, and nothing links to `/me/following`. The e2e reaches both by typing the URL.
  - So for a real viewer, Follow saves to a list they can never open.
  - "Show again" is equally unreachable. After the 5 s Undo, a hide is effectively irreversible for 90 days.
- **Signed-in page layout, `/me/following`.** "until Jan 21, 2027" wraps under the name on one row and not on the next.
  "Show again" breaks onto two lines on one row and fits on one in the next (`08-me-following`). The page reads as two
  lists, which is right, and "Only you can see these lists. Traders are never told." is the right promise.
- **Privacy over HTTP.** Signed out, `/`, the followed trader's profile, their `/pane-chart` and a hidden trader's profile
  contain neither the viewer's handle nor "follower". `/me/following` signed out redirects to `/login`.

## Questions asked of me

- **Does Follow feel worth doing when nothing public happens?**
  - Today it buys a private bookmark and nothing else. Ranking is PR-5, and notifications are out of scope.
  - That is enough, *if* the bookmark can be opened. Today it cannot (above), so Follow is a button with no payoff.
  - The fix is reachability, not more features. Do not add a feed effect or a nudge to make Follow "do something"
    before PR-5.
  - The copy promises nothing it does not deliver. No line says "see more from @x". Keep it that way until PR-5 makes it
    true.
- **The "Only you can see this." moment.** Delivered, and the best detail in the PR. One line, once, true. No change.
- **Is the pane the right home for "Not interested" until PR-3's rows exist?**
  - Yes, and I would keep it there after PR-3.
  - The pane is where a viewer has seen enough of a trader to judge them. A card is not ("never on feed cards" holds).
  - It costs three taps (swipe, "…", item), which is right for a 90-day decision.
  - Accept deviation 1.
- **The Undo window.** 5 s works: focus goes to Undo, then to the next card. Undo returns the reader to where they
  were. With `/me/following` reachable, 5 s is fine. Today it is the only recovery, which is why demand 2 is a
  blocker.
  - Not blocking: pause the timer while the bar has focus or hover (WCAG 2.2.1, timing adjustable).
- **Deviation 2, unfollow also hides for 90 days.** My recommendation for the owner is below (demand 3): **no.**
  - Criterion 4 says unfollow removes the trader "from the viewer's **suggestions**". The plan widened that to the feed.
  - In the familiar social pattern, unfollow and mute are separate actions, and unfollow does not mute. Evidence tier:
    analogy.
  - My walk shows what the widening costs: copy that is false on screen, a mislabeled list, and a two-line status with a
    timer.
- **Deviation 3, signed-out Follow → `/login` without return.** The engineer's reason is sound: `/login` cannot return
  today. The fix is to delete the control signed out (demand 4), not to ship a dead end.
- **Deviation 4, the `users_referred_by` index.** Accept.
  - It is additive and partial, and it uses `schema_add_index`.
  - It fixes a real cost the heavy check measured: every account deletion scanned `users`. Deletion of a trader followed
    by 100,000 viewers now takes 86 to 119 ms (engineer's log).
  - Zero product risk.
- **Deviation 5, a follow ends a running exclusion.** Accept. It is the obvious reading.
- **`/me/following` as a settings page.** Right in kind: private, `noindex`, the viewer's own state, two short lists.
  Wrong in reach (demand 2).
- **Copy against the no-advice rule.** Pass.
  - "Follow", "Following", "Not interested in @x", "Hidden for 90 days.", "Show again", "Only you can see this." carry
    no advice, signal, completeness or performance claim.
  - `FOLLOW` is in the banned-claims walk (`lib/copy.ts`).
  - One standing rule for later PRs: never pair "follow" with trades ("follow their trades"). In a trading product
    that reads as copy trading (POLICY F5).

## Scorecard

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Following and "not interested" are standard explicit signals in feed products (analogy). The owner set both in F-2 criteria 1 and 4. |
| Ease of adoption | 2 | Follow is one tap (good), but its list is unreachable, the menu is clipped at 375, and signed-out Follow dead-ends. Becomes 4 with demands 1, 2 and 4. |
| Phase fit | 4 | Stores the explicit signals PR-5 needs, with no event table (plan demand C). Moves no kill gate by itself. |
| Revenue impact | 3 | Indirect: PR-5 ranking input. Signed-out Follow today leaks shared-link readers off the trader's page. |
| Aesthetics & clarity | 3 | Status lines and the hide bar are clean in light and dark. Clipped popover; ragged `/me/following` rows; Follow is filled primary on every pane. |
| Trust & compliance | 5 | Private (no count, list or name anywhere public, verified over HTTP). Deletion first step and cascade. No events. TR-1 holds. No advice. |
| Simplicity | 3 | Unfollow adds a second hide path, a timer and a status line that the plan's own criterion does not require. |
| Craft & taste | 3 | Undo focus and return-to-pane are exceptional. Off-screen text and a false "Hidden" claim are not. |

Below the bar (Ease 2), so: fix, then merge. The fixes are small.

## Deleted, and what I said no to

- **Delete:** the signed-out Follow control (demand 4); unfollow's feed hide, its status line, its Undo timer and its
  "Not interested" listing (demand 3, owner decision).
- **No** to giving Follow a visible effect before PR-5 just to make it feel useful.
- **No** to a nav item for "Following". The 375 nav is full ("Stocks · My record · @handle"). A link on the viewer's own
  profile is enough.
- **No** to `/login?next=…` in this PR. A return path through an email link is an auth change with open-redirect
  risk. It belongs in its own PR if the owner wants signed-out Follow back.

## Evidence

- Observed in my walk (tier: observed behavior, this build): all numbers and copy above. Screenshots and scripts are in
  the scratchpad `bl/f2pr2` (not committed).
- Engineer's log `build-pr2-engineer.md` §3 (deviations), §4 (checks: 574 unit, 102 e2e, purge and deletion timings).
- Unfollow ≠ mute: analogy (the common pattern in social feed products); no user data of our own.
- `node scripts/compliance.ts diff af586a7`: only the pre-existing `@img/sharp-wasm32` licence line from local
  `node_modules`.

## Revenue chain

- Shared-link readers × share who tap the first button they see (Follow) × share lost at the trader sign-up page with no
  way back = readers removed from the trader's page. Phase value is shared-link reach, so each one is reach the trader
  earned and lost.
- I do not know the tap rate. There is no event table before PR-5, by design.
- Deleting the control costs nothing measurable. If the owner wants the hook, the cheapest test is to link to
  `/login?ref=<handle>&via=<surface>`. The referral surface column already exists, so signed-out-Follow sign-ups can be
  counted within two weeks of launch. Add a return path only if that count is material.

## Demands

1. **Blocker, builder: the "…" menu must stay on screen.**
   - Anchor the popover to the right edge of the summary (`right: 0`), and cap it at `max-width: calc(100vw - 32px)`
     with wrapping.
   - Verify (e2e, 320 and 375, light and dark, a 20-character handle): the item's box is inside the viewport, and its
     text is not cut off.
   - Fails today: x 106 to 391 on 375.
2. **Blocker, builder: `/me/following` must be reachable by navigation.**
   - On the viewer's own profile (rendered only when `isMe`), add one "Settings" link. `/settings` already links
     "Following and hidden traders".
   - This also fixes a pre-existing gap: Sign out and Delete my profile are today reachable only through `/connect`.
     The deletion right must be findable (COMPLIANCE §3).
   - Optional, same PR: make "Only you can see this." end with a link to the list.
   - Verify (e2e, keyboard only, signed in, starting at `/`): reach `/me/following` by following links only, in at most
     3 activations (@handle → Settings → Following). No `goto` of `/settings` or `/me/following` in that test.
3. **Owner decision, then builder: unfollow does not hide from the feed.** My recommendation:
   - The feed honors only `not_interested`.
   - Keep writing the `unfollow` row: criterion 4 applies it to *suggestions*, and PR-3's section will honor it.
   - `/me/following` lists only `not_interested` rows under "Not interested".
   - Delete the unfollow status line and its Undo. Tapping Follow again is the undo; "Following" → "Follow" is the
     feedback.
   - The engineer puts this at one line in `splitExclusions`'s caller, plus the read of `reason`.
   - If the owner keeps the plan: the trader's cards must drop in place exactly like "Not interested" (the copy is false
     today), and the list must label those rows "Unfollowed", not "Not interested".
   - Verify: unfollow in the pane → the trader's cards stay; `/me/following` shows them in neither list; PR-3 later
     excludes them from the section.
4. **Builder: no Follow control signed out** (profile and pane), until sign-in can return to the trader.
   - Update PR-2's own e2e assertion (it is not a PR-1 assertion).
   - Verify: signed out, `/u/<trader>` and the feed panes contain no follow control. The stat cards move up by the
     button's height.
5. **UX lead (taste, not blocking):**
   - Follow is filled primary purple on every pane and profile: the loudest thing on a pane whose job is the record.
     It is also outline signed out and filled signed in. Use the secondary (outline) style everywhere, and keep the fill
     for the page's one primary action.
   - `/me/following`: put "until <date>" on its own line under the name, and keep "Show again" to one line
     (`white-space: nowrap`), so every row has the same shape.
   - Hide bar: pause the 5 s timer while it has focus or hover.
6. **Reviewer, add to the checklist:**
   - Popover and menu bounds at 320 and 375 with a 20-character handle.
   - Reachability of every new page by navigation, never by typed URL.
   - Every status line must be true on screen at the moment it shows. Compare the claim with the DOM.

## What would change my mind

- **Demand 3:** if the owner wants unfollow to mean "less of this person everywhere", keep the hide. The cards must then
  drop in place and the list must say "Unfollowed". The fastest evidence is five viewers asked, after an unfollow,
  "do you expect to still see this trader in your feed?"
- **Demand 4:** a sign-up count from a `via`-attributed signed-out Follow that is material within two weeks of launch.
  Then build the return path properly and bring the control back.

## Demo sentence

"Follow a trader and only you know; not interested, and they're gone for 90 days, with Undo."

COMPLIANCE: PASS · USABILITY: DEMANDS
1. Blocker: the pane's "…" menu runs off the 375 screen ("Not interested in @dividend_dan" spans x 106 to 391). Anchor
   it right, cap its width; verify at 320 and 375 with a 20-character handle.
2. Blocker: `/me/following` (the only payoff of Follow and the only "Show again") is unreachable: `/settings` is linked
   only from `/connect`. Add a Settings link on the viewer's own profile; e2e reaches the list by links only, ≤ 3 steps.
3. Owner, recommended: unfollow should not hide from the feed. Today it claims "Hidden from your feed" while the card
   stays, and it lists the trader under "Not interested". Honor only `not_interested` on the feed; keep the `unfollow`
   row for PR-3's section; drop the unfollow status line and Undo.
4. Builder: remove signed-out Follow. It sends a shared-link reader to the trader sign-up page and then to their own empty
   profile, losing the trader. A return path, if wanted, is its own PR.
5. UX lead (not blocking): Follow outline everywhere; one row shape on `/me/following`; pause the hide bar on focus.
6. Reviewer: menu bounds at 320/375, reachability by navigation, status copy true on screen.
7. Accepted: "Not interested" in the pane (keep it there after PR-3); the `users_referred_by` index; follow ends an
   exclusion; the "Only you can see this." line unchanged.

## Round 2

2026-10-23. Build of `6fb8952` (`.next` newer than every file under `app/`, `lib/` and `db/`), `next start` on 3111
with `ALLOW_DEV_AUTH=1`, vendor fake on 4191, Postgres 16, my own database (schema and demo seed applied, dropped
afterwards). No sync tick. Fixture: the 3 demo traders, 60 scratch traders, one trader with a 20-character handle, and one
dev-signed-in viewer. All 62 scratch rows were deleted before the drop. Tested at 375×667 and 320×667, light and dark.
Server and fake stopped. No product code changed.

**Decision: merge.** Both blockers are fixed, and so are demands 3 and 4 and the cheap taste items. I verified each one
by using the build, not by reading the log.

### Round 1 demands, verified

| # | Demand | Result | What I observed |
|---|---|---|---|
| 1 | Menu stays on screen | **Delivered** | 20-character handle. At 375 the item spans x 20 to 355 (viewport 375); at 320 it spans 20 to 300. The text wraps to two lines and nothing is cut off (`scrollWidth` = `clientWidth`). Checked in light and dark. Esc closes it and returns focus to "…". A tap outside closes it. |
| 2 | `/me/following` reachable | **Delivered** | Starting at `/`, I reached the list in 3 taps, typing no URL: nav @handle → "Settings" (own profile only) → "Following and hidden traders". Sign out and Delete my profile are now one tap from the viewer's own profile too. |
| 3 | Unfollow does not hide | **Delivered** | Unfollow in the pane: the button returns to "Follow", no status line, no Undo, and the trader's cards stay (1 → 1). Unfollow on the profile: same. The unfollowed trader stays in the feed, and `/me/following` lists them in neither list ("No one is hidden."). Recorded as an owner-reversible deviation (`FEED_HIDES_UNFOLLOWED`). |
| 4 | No signed-out Follow | **Delivered** | Signed out: 0 follow controls, 0 `.pane-actions` and 0 "…" menus on `/u/<trader>` and across 30 feed rows. The pane header is "← Back · name · @handle · badge". The stat cards sit directly under the badge. |
| 5 | Taste: outline Follow, row shape, timer pause | **Delivered** | Follow is outline in both states (surface `#fff`, `--line` border) and 112 × 45 in both, so "…" does not move. "Following" uses muted text. On `/me/following` the date sits on its own line and "Show again" stays on one line. Rows are 78 px (following) and 89 px (hidden). The engineer's e2e covers the keyboard pause. |
| — | Privacy line once | **Delivered** | First follow: "Following @x. Only you can see this." Second follow: nothing. After unfollowing everyone and following someone new: still nothing. Once per viewer, ever. |
| — | Show again | **Delivered** | Lands on `/me/following?back=x` with "@x is back in your feed.", and the trader is back in the feed. |

Not interested is unchanged and still right. Row count 60 → 59; Undo is focused, and Undo restores the row
(back to 60) with focus on that pane's "…" (`scrollLeft` 375). When the bar expires, focus moves to the next card, never
to `<body>`. Privacy over HTTP, signed out: `/`, two trader profiles and a `/pane-chart` contain neither the viewer's
handle nor "follower". `/me/following` returns 307 to `/login`.

### Scorecard (round 2)

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Unchanged: follow and "not interested" are standard explicit feed signals (analogy). The owner set both in criteria 1 and 4. |
| Ease of adoption | 4 | Follow takes one tap. Its list is 3 taps from anywhere. The menu fits at 320. Signed out there is nothing to trip on. |
| Phase fit | 4 | Stores PR-5's explicit signals with no event table. |
| Revenue impact | 4 | The signed-out leak off a shared trader page is gone. Shared-link reach stays on the trader. |
| Aesthetics & clarity | 4 | Outline Follow lets the record lead. Rows have one shape. The menu stays inside the gutters. |
| Trust & compliance | 5 | Private everywhere, verified over HTTP. No status line makes a false claim. No advice. TR-1 holds. |
| Simplicity | 4 | The unfollow status, its timer and its Undo were deleted. Unfollow is now a plain toggle. |
| Craft & taste | 4 | Focus is handled at every step (Esc, expiry, Undo). The items below keep this from a 5. |

Clears the bar.

### Not blocking (follow-ups, in priority order)

1. **The "Settings" link on the viewer's own profile is 20 px tall.** `.tap`'s 44 px rule applies only under `.auth`.
   It is also placed between the primary "Connect" button and "Change handle", where it reads as a second call to
   action. Give it a 44 px target and move it under "Change handle" (or into the page's foot, next to "← Feed").
   Verify: the box height is ≥ 44, and it is the last control before "Closed trades" or after it.
2. **The open menu has no shadow.** At 375 the top of the "+19.3%" headline shows under its bottom edge, and the menu
   reads as if it is sitting on the number. Give the popover the surface token plus a 1-step elevation, the same as the hide
   bar, or open it with enough offset that it covers the headline cleanly.
3. The engineer's own follow-ups list stands (UX 4, 10, 12, 13; tester N1, N2). None of them blocks this PR.
4. Reviewer: keep round 1 demand 6 on the checklist: menu bounds at 320/375, reachability by navigation, and status
   copy that is true on screen.

### Ready to merge

PR-2 is ready to merge. Follow is a private one-tap bookmark whose list a viewer can now reach in three taps. Its first
use says, once and truthfully, "Only you can see this." "Not interested" is a three-tap, 90-day decision that removes the
trader in place, offers Undo for 5 s that returns the reader to where they were, and can be reversed later from a
reachable list. Unfollow no longer makes a claim the screen contradicts. A shared-link reader who is signed out sees the
trader's record and nothing that leads them away from it. Nothing about who follows whom is visible publicly, there is no
advice or signal copy, and TR-1 holds. The two remaining items are a tap-target size and a shadow, and they belong in the
next round.

Demo sentence: "Follow a trader and only you know; not interested, and they're gone for 90 days, with Undo."

COMPLIANCE: PASS · USABILITY: PASS
