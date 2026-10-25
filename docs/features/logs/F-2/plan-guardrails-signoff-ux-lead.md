# F-2 · Guardrails G1 to G6 · Plan sign-off (UX lead)

Date: 2026-10-25. Role: user-experience lead (`team/designer.md`). Reviewed: `plan-guardrails.md` (engineer, SIGNED),
from the viewer's side, against `F-2-personal-discovery.md` (Decisions 2026-10-25 "guardrails", acceptance criteria
G1 to G6), POLICY A1, F1 (as amended), F6 and P6, and my PR-4 record (`committee-pr4-ux-lead.md`). Tree read on the
same branch: `app/settings/page.tsx`, `app/me/following/page.tsx`, `app/suggest-section.tsx`, `app/u/[handle]/page.tsx`,
`app/t/[symbol]/Watch.tsx`, `lib/feed.ts#loadFeedPage`, `lib/copy.ts`. No product code changed, no server run.

Viewports below mean **320, 360 and 375 px**, light and dark. The plan tests 375 and 320 only. 360 is the width PR-4
was checked at and the most common Android width, so every e2e matrix in the plan (T1.5, T2.3, T5.2) adds it.

## 1. Findings that drive the verdict

- **F-A. Reset sits below up to 200 liked rows.** The plan puts "Reset my feed" at the bottom of `/me/following`. That
  page lists Following, then Not interested, then Liked records (a page of up to `LIKES_MAX` = 200 after G5). A viewer
  with many likes has to scroll past all of them to find Reset. The switch it belongs with lives on another page
  (`/settings`). Two controls for one concern ("how my feed is shaped") end up on two pages, and one of them is at the
  far end of a long list.
- **F-B. The switch is hard to find from where ordering happens.** Today `/settings` is reachable only from the viewer's
  own profile (the "Settings" link below the import banner and share prompts) and from `/connect`. Nothing on the feed,
  where the ordering acts, points to it. F1 says "A viewer can turn personal ordering off in Settings". That holds, but
  only for a viewer who already knows Settings is on their profile.
- **F-C. A followed trader in the section would show "Follow".** With the switch off, the plan correctly lets followed
  traders into the section ("the signed-out order minus their own hides"). But `app/suggest-section.tsx` passes
  `following={false}` to every row's `FollowButton`, and `loadFeedPage` reads `followingAmong` for the page's card
  traders only. So a trader the viewer follows would show **Follow** there, and the viewer would get a false state.
  This change becomes visible the moment the switch is off, so PR-7 has to handle it.
- **F-D. The section's line stops being the whole truth when the switch is on.** `SECTION.explain` says "Ordered by how
  much evidence each record has." With the switch on, `preferPool` lowers traders the viewer unfollowed or whose trades
  they hid, and `sectionSkips` leaves out followed traders. A signed-in viewer is told only half of why the rows are in
  that order.
- **F-E. The "On" explanation leaves out follows.** `orderOnExplain` says that only unfollows and hides move traders
  lower. It says nothing about followed traders being left out of suggestions while the switch is on. That is the one
  visible difference a viewer with no unfollows or hides will see when they switch off. If the copy doesn't say so,
  the change looks like a bug.
- **F-F. The section and pane no-JS confirmation only works for a viewer who spots it.** After G6, a no-JS Follow or
  "Not interested" from a section row or the pane lands on `/me/following`. The plan's only confirmation is that "the
  lists there confirm the change", so the viewer has to find one name in a list on a page they didn't ask for. There is
  also no way back to where they were.

## 2. Verdict per item

| # | Item (plan ref) | Verdict | Change, and how to test it |
|---|---|---|---|
| 1 | G1 placement: "Your feed" on `/settings` (§1.1) | **Accept with change** | The order on `/settings` is: h1, Sign out, **h2 "Your feed"** (`id="your-feed"`, `tabIndex=-1`), then the switch row and its description, then the "Reset my feed" link (demand 1), then the "Following and hidden traders" link, then h2 "Delete my profile". *Test:* the DOM order is as listed. At 360×640, the switch's bounding box is inside the first viewport. |
| 2 | G1 findability (F-B, F-D) | **Accept with change** | When the viewer is signed in **and** the switch is on, the section shows a second line under `SECTION.explain`: `SECTION.personal` = "Traders you unfollowed, or whose trades you hid, are placed a little lower, and traders you follow are left out." It is followed by the link `SECTION.settings` = "Feed settings", which goes to `/settings#your-feed`. A fragment is not a query, so it meets G6. The line is not rendered when signed out or when the switch is off. *Test:* signed-out page-1 HTML is byte-identical with and without PR-7 (the existing guard). Switch on: the line and the link are present, and following the link leaves focus on `#your-feed`. Switch off: neither is present. From the feed, two taps reach the switch. |
| 3 | G1 control (§1.1, §9) | **Accept with change** | (a) **The status line speaks only what the server confirmed.** The switch flips at once, but the `role="status"` text is written only after `setOrder` resolves. On failure, `aria-checked` reverts and the status reads `FOLLOW.failed`, and the "saved" text never appears. *Test:* delay the action 700 ms and the status stays empty until the reply. Force a failure and no saved string is ever in the DOM. (b) **The status element is there before the first change.** It is in the server HTML, empty, so the first announcement is not lost. *Test:* `[role=status]` exists on load with empty text. (c) **The description is read with the switch.** The switch has `aria-describedby` pointing to the description (item 4). *Test:* the accessibility tree shows the switch with name "Order my feed by my activity", checked true or false, and the description. (d) **The row is the target.** The whole label-and-switch row is ≥ 44 px tall, and tapping the label toggles the switch (`<label for>` on the button). At 320 the label wraps and the switch keeps ≥ 44×44. *Test:* bounding boxes, plus a tap on the label flips `aria-checked`. (e) The plan's §9 items stand: Space and Enter toggle, a visible focus ring, "On"/"Off" as text, no knob motion under reduced motion, text ≥ 4.5:1 and track ≥ 3:1 **in both states and both themes**. *Test:* computed contrast of the off-state track against the page background is ≥ 3:1. |
| 4 | G1 copy (§6, F-E) | **Accept with change** | **Show both lines all the time**, not one that swaps with the state. A viewer deciding whether to switch off needs to read what Off does while the switch is still On. Text that changes under a control they just used is easy to miss. The words "On:" and "Off:" stay as the lines' own labels, and the current state is shown by the switch's "On"/"Off" text. Strings: `orderOnExplain` = "On: traders you unfollowed, or whose trades you hid, appear a little lower in your feed and suggestions, and suggestions leave out traders you follow." `orderOffExplain` = "Off: your feed and suggestions use the order everyone sees signed out, minus the traders and trades you hid. Nothing you follow, like or hide is deleted." `orderSavedOn` = "Saved. Your feed is ordered by your activity again." `orderSavedOff` = "Saved. Your feed now uses the order everyone sees signed out." None of the copy says that nothing is recorded while §8 Q1's default stands (watch stamps continue). *Test:* both explain strings are rendered in both states. `allCopy` scans pass. No string matches `/nothing (is )?(recorded\|stored)/`. |
| 5 | G1 visible change when off (F-C) | **Accept with change** | A section row for a trader the viewer follows shows **Following** (`aria-pressed="true"`), from the same `followingAmong` read extended to the section's rows, the same way as cards. *Test:* switch off, the viewer follows trader X, and X falls in the section. X's row button reads "Following" and is pressed. Tapping it unfollows, as on cards. T1.1(b)'s "a followed trader appears in the section" also asserts this button state. |
| 6 | G1 no-JS (§1.1, T1.5) | **Accept** | The POST goes to `/settings` and the page renders again at the same URL with the new "On"/"Off" text. *Test:* this is T1.5, plus at 360 the new state is in the first viewport (item 1). |
| 7 | G1 open tab after a change (§4 bound) | **Accept** | Repeats are dropped by the pager. *Test:* extend T2.3's "no duplicated card" assertion to a switch change made in a second tab. |
| 8 | G3 constant (§1.1) | **Accept** | There is no viewer surface. The copy rule in item 4 keeps the UI from claiming more than G3 and Q1 deliver. |
| 9 | G4 deletion copy (§6) | **Accept with change** | **List the items instead of one 50-word sentence**, and name them in the viewer's words, because "unfollow notes" is our term, not theirs. `deleteExplain` becomes a lead line and a list in `SETTINGS.deleteItems`: "Deleting removes:" · "your profile, record and sign-in details" · "the brokerage link at the vendor" · "your follows, likes and watchlist" · "the traders and trades you hid, and our note of who you unfollowed" · "any reading activity we stored". Then "Your handle is held for a year. Copies in our backups remain until those backups are replaced." That last sentence follows the owner's H4 decision, and it keeps the screen true at the moment the viewer decides. Markup: a `<ul>` in view 1, with nothing else changed. *Test:* T4.1's regexes become `/follows/`, `/likes/`, `/hid/`, `/unfollowed/`, `/watchlist/`, `/reading activity/`, `/backups/`, still read through `SETTINGS`. At 320 the list has no horizontal scroll. |
| 10 | G4 watchlist in the first step (§1.1, T4.2) | **Accept** | No visible change. |
| 11 | G2 placement (§2.1 UI, F-A) | **Reject** | Reset lives in **Settings → "Your feed"**, as a secondary-style link button "Reset my feed" right below the switch's description, leading to the confirmation page **`/settings/reset`** (a new file in PR-8). `/me/following` also gets one link "Reset my feed" to the same page, placed **directly after the "Not interested" list and before "Liked records"**, never after the liked list. *Files:* the Settings line is one line added to `app/settings/page.tsx`, which PR-7 owns. PR-8 adds it after rebasing on PR-7, as §0's "PR-7 goes first" rule already provides. *Test:* the Settings DOM order (item 1). On `/me/following`, the reset link comes before `#liked` in the DOM. With 200 likes, the link's top is above `#liked`'s top. |
| 12 | G2 confirmation page (§2.1, §9) | **Accept with change** | (a) **Wording.** The secondary action reads `RESET.keep` = "Don’t reset", not "Keep them": on a page whose primary deletes things, "Keep them" doesn't say what is kept. It and every back link go to the fixed path `/settings`. (b) **The done state renders at the same URL.** The POST is made to `/settings/reset`, which G6 allows as "the page the action was taken on". The page renders its done state there, with JS and without, from the action's returned state (`useActionState`), never from a query or a stored flag. The h1 "Reset my feed" stays. The explanation, the primary and "Don’t reset" are replaced by `role="status"` "Your feed is reset." (focused, `tabIndex=-1`), plus links "Back to Settings" (`/settings`) and "Go to the feed" (`/`). The Reset button is gone, so it can't be pressed twice. (c) **No double submit while pending.** The primary is `aria-disabled` while pending. (d) The plan's points stand: the h1 takes focus on load, "This cannot be undone." appears, there are no counts, and there is no celebration (text only, no motion). *Test:* in T2.3, with and without JS, the response after confirming is at `/settings/reset` with no query, its text includes `RESET.done`, and it has no Reset button. With JS, `activeElement` is the status line. A double click sends one POST. "Don’t reset" lands on `/settings` and the viewer's rows are unchanged. |
| 13 | G2 copy (§6) | **Accept with change** | `RESET.explain` = "Deletes the trades you hid and our note of who you unfollowed, so those trades can show again and those traders are no longer placed lower. Your follows, likes, “Not interested” list and watchlist stay." It names the effect a viewer can see, not only the rows that go. PR-5a's appended sentence stays as planned. `RESET.heading`, `RESET.action`, `RESET.confirm` and `RESET.done` are as planned, and `RESET.keep` is as in item 12. *Test:* `allCopy` scans. T2.3 asserts the strings on the rendered page through `RESET`. |
| 14 | G5 paging (§2.1, T5.1, T5.2) | **Accept with change** | (a) **Unlike keeps the viewer's page.** An Unlike on page *n* (JS or no-JS) leaves the viewer on page *n*. Without JS, the action re-renders `/me/following?likes=n` (the page it was taken on, which names no target, so G6 holds) and focus is handled by `#liked`. If page *n* becomes empty, show `LIKES.none`-style text "No older likes." with "Newer likes" kept, never a blank section. (b) **Arriving by paging.** After "Older likes" or "Newer likes", the `#liked` heading is in view and the next Tab reaches the first liked row's link. (c) The paging links are ≥ 44 px and sit at the end of the list, and "Newer likes" also sits at its start on pages > 1. *Test:* T5.2 at the three widths, with and without JS. Unlike the last row of page 3 and the URL path stays `/me/following?likes=3`. The Tab-order assertion from (b). |
| 15 | G5 removed record row (§2.1, §6) | **Accept with change** | "Record" means a trader's whole history elsewhere in the app (PR-4 follow-up 9), so "Record no longer available" reads as if the trader is gone. Strings: `LIKES.gone(h)` = "This trade is no longer in @h’s record." `LIKES.unlikeGone(h)` = "Unlike a trade no longer in @h’s record". The visible "Unlike" starts the name, so WCAG 2.5.3 is met. The row has **no link to a trade page**, and `@h` links to the public profile. *Test:* a gone row has no `a[href*="/trade/"]`, has one `a[href="/u/h"]`, and its button's accessible name equals `LIKES.unlikeGone(h)`. At 360 the line wraps and doesn't truncate the handle (`scrollWidth ≤ clientWidth`, the PR-4 finding 8 check). |
| 16 | G6 profile no-JS confirmations (§2.1) | **Accept** | The page renders again at `/u/<h>`, and the line "Following @h." comes from `recentAction`. *Test:* T6.3, and the §5 rewrite of `follow.spec.ts:133`/`:137`. |
| 17 | G6 section and pane no-JS landing on `/me/following` (§2.1, §8 note, F-F) | **Accept with change** | `/me/following` shows, in its existing `role="status"` line at the top, the confirmation for the viewer's most recent action from the last 60 s, read from stored state the same way as `recentAction`: `FOLLOW.followed(h)` / `FOLLOW.first(h)` / `FOLLOW.hiddenFrom(h)` / `FOLLOW.unfollowed(h)`. It replaces `?back=` there through `lastShownAgain`, as planned. Next to it is a link "Back to the feed" (`/`), which is new copy `FOLLOW.backToFeed`. *Test:* JS off, "Not interested" from a section row lands on `/me/following` with no query, the status reads `FOLLOW.hiddenFrom(h)`, and the trader is listed under Not interested with "Show again". A second viewer opening their own `/me/following` within 60 s sees no line (the T6.3 rule). |
| 18 | G6 watch-cap static line (§2.1, §9) | **Accept with change** | The cap line is plain text on load, with no `role="status"`. The Watch button has `aria-describedby` pointing to it, so a screen reader hears the cap on focus, before a tap. After a JS tap at the cap, the same text goes into a `role="status"` region. *Test:* at `WATCH_CAP` on an unwatched symbol, the line is visible on load, the button's description equals the cap message, and the URL has no `watch=`. |
| 19 | G6 `/me/liked` as POST (§2.1, T6.2) | **Accept** | PR-4 demand 4 must still hold over POST. *Test:* delay `POST /me/liked` by 700 ms and sample from navigation: a liked card never shows ♡ before ♥ (the round-2 check, re-run). |
| 20 | G6 session purge (§2.1, T6.4) | **Accept** | A purged session is an ended one. The viewer sees sign-in, as today. |
| 21 | F6 and P6 (§12, §11) | **Accept** | There is no celebration on the switch, on Reset or on likes, and no counts. *Test:* on `/settings` and `/settings/reset`, `getAnimations()` is empty under reduced motion and holds only the ≤ 120 ms knob change otherwise. The Privacy PR's text matches §7 and items 4, 9 and 13. |
| 22 | §9 accessibility, overall | **Accept with change** | §9 plus items 3, 12, 14, 15, 17 and 18, at the three widths. On every new or changed view: axe is clean, there is no horizontal scroll at 320/360/375 (`scrollWidth ≤ clientWidth`), and keyboard-only use gives a visible ring on each stop. |

## 3. Notes for the build (not demands)

- PR-4's follow-up 9 ("Liked records" → "Liked trades", likes in the page title and nav label) is still open. Item 15
  uses "trade" in the new strings so that a later rename stays consistent. The pinned h1 is out of scope here.
- PR-4's N3 (a no-JS "Hide this trade" gives no confirmation) could use the same stored-state status line as item 17,
  read from the reject's `created_at`. That belongs with O3, not with these PRs.

## Sign-off

REVISE:
1. Put "Reset my feed" in Settings → "Your feed", below the switch, with its confirmation at `/settings/reset`. On
   `/me/following`, link to it right after "Not interested", never after the liked list (item 11). PR-8 adds the one
   Settings line after rebasing on PR-7.
2. Make the confirmation page's secondary "Don’t reset", going to `/settings`. Show the done state at `/settings/reset`
   with and without JS, from the action's returned state: a focused `role="status"` "Your feed is reset.", "Back to
   Settings", "Go to the feed", no Reset button, and one POST on a double click (item 12).
3. Make a section row for a followed trader show "Following", pressed, when the switch is off (item 5, F-C).
4. When signed in with the switch on, show the section line `SECTION.personal` with the link "Feed settings" to
   `/settings#your-feed`. Render nothing new signed out or when the switch is off (item 2).
5. On the switch, show both explanation lines all the time, using the strings in item 4, linked by `aria-describedby`.
   Write the status text only after the server confirms, with the empty status element present on load (items 3 and 4).
6. Write the deletion copy as the list in item 9, in the viewer's words, with the backups sentence, and update T4.1's
   regexes to match.
7. Use the copy in items 13 and 15: `RESET.explain`, `LIKES.gone(h)` and `LIKES.unlikeGone(h)`, with no trade link on
   a gone row.
8. Keep the viewer on page *n* when they Unlike there, with and without JS, and show "No older likes." when the page
   empties (item 14).
9. On `/me/following`, give a no-JS section or pane action a stored-state status line from the last 60 s, plus "Back to
   the feed" (item 17).
10. Show the watch-cap line as static text the Watch button describes (`aria-describedby`), and make it `role="status"`
    only after a tap (item 18).
11. Add 360 px to every e2e matrix (T1.5, T2.3, T5.2), plus the no-horizontal-scroll and animation checks in items 21
    and 22. Re-run the PR-4 heart check over `POST /me/liked` (item 19).
