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

## Round 2

Date: 2026-10-25. Re-sat on `plan-guardrails.md` round 2 (its "Round 2 changes" table), from the viewer's side. Also
read: `app/t/page.tsx` (the per-row marker), `app/me/record/page.tsx`, `app/u/[handle]/new-trades-prompt.tsx`,
`db/schema.sql` (stamp nullability), `lib/copy.test.ts` (`BANNED`, `SUGGESTION_WORDS`). No product code changed.

### R2.1 My 11 demands, checked against the plan

| Demand | Landed as written? | Where |
|---|---|---|
| 1 Reset in Settings, `/settings/reset`, link before `#liked` | Yes | §1.1 order item 5, §2.1, T2.5 |
| 2 "Don’t reset" → `/settings`, done state at the same URL, focus, one POST | Yes | §2.1, T2.3 |
| 3 Followed section row shows "Following", pressed | Yes | §1.1, T1.1(b) |
| 4 `SECTION.personal` + "Feed settings" → `/settings#your-feed`, nothing signed out or off | Yes, strings verbatim | §1.1, §6, T1.9 |
| 5 Both explain lines always, `aria-describedby`, status after the server, empty status on load | Yes, strings verbatim | §1.1, T1.5. Copy change in R2.3 because of the Q1 reversal |
| 6 Deletion list with backups sentence, T4.1 regexes | Yes, verbatim | §1.1 G4, §6, T4.1 |
| 7 `RESET.explain`, `LIKES.gone`, `LIKES.unlikeGone`, no trade link on a gone row | Yes, verbatim | §6, T5.2 |
| 8 Unlike keeps page *n*; "No older likes." | Written, **but T6.1 as written fails it** (R2.2 (a)) | §2.1, T5.2 vs T6.1 |
| 9 `/me/following` status from stored state + "Back to the feed" | Yes | §2.1, T6.3 |
| 10 Watch cap static + `aria-describedby`, `role="status"` only after a tap | Yes | §2.1, T6.5 |
| 11 360 px everywhere, no horizontal scroll, animations, heart check over POST | Yes | §0 matrix, T6.2 |

Copy scan of every new or changed string in §6 against `BANNED`, `SUGGESTION_WORDS` (`buy|sell|hold|pick|signal|
advice|price target`) and `PROMO`: clean. "held" (deletion) does not match `\bhold\b`. No string claims that nothing
is recorded (item 4's regex still holds, and I agree it should: request logs make a blanket claim untrue). A1: the
switch, section link, reset page, likes paging and watch cap meet §9 as written.

### R2.2 Findings

- **(a) T6.1 contradicts demand 8.** §2.1 says Unlike on page *n* re-renders `/me/following?likes=n`, and T6.1 lists
  "Unlike on page 2" among its actions. But T6.1's rule allows no query key except `_rsc`, and `/me/following` is not
  in the "public page by its own path" list. As written, either T6.1 fails or the build drops page *n*. `likes=<n>`
  names no target and no handle, so it belongs in the allowed set.
- **(b) "since you last looked" turns false after the switch goes back on.** §1.1: "Switching off clears no existing
  stamp. The markers resume from the old stamps." While off, the viewer keeps opening symbol pages, their record and
  their profile, and none of it is stamped (T1.3a). When they turn the switch on, `/t` counts trades "since you last
  looked" from a stamp older than their real last look, so it counts trades they have already seen. The same holds for
  "Since your last visit" on `/me/record` and "New closed trades since your last visit" on the profile. Every one of
  those markers states a fact about the viewer's last visit, and after an off period we don't know it. Hidden rather
  than guessed has to hold after the switch comes back on, not only while it is off.
- **(c) `WATCH.markerOff` isn't in the viewer's words, and its placement is unclear.** "New-trade counts" is our name.
  The viewer saw "2 new verified closed trades since you last looked". The plan says the marker "is replaced by"
  `WATCH.markerOff` but the marker is per row. Repeating the line on each of 25 rows is noise, and leaving each row's
  fallback in place would show "No new trades", which is a guess and may be false. The "Feed settings" link on `/t`
  has no stated target.
- **(d) Two of the three hidden markers go unexplained.** `/t` gets a line. The record page's "Since your last visit"
  section just disappears, and nothing at the switch says it will. That is F-E again: a visible change with no reason
  looks like a bug. The profile's new-trades prompt is a prompt that comes and goes, so it needs no line of its own,
  but the switch's Off line has to cover it.
- **(e) The other "while the switch is off" lines are plain and true:** the §1.1 rule and its list of deliberate
  actions, "Watching a symbol while off stores the watch row" (it is the action's own row), the exempt pre-sign-in
  events, the share prompt that keeps showing, and the §12 "Opting out is complete" line. Privacy §7 is for that PR's
  reviewer, but items 3, 6 and 7 read correctly next to item 1 (request logs).

### R2.3 Copy (exact)

- `SETTINGS.orderOffExplain` = "Off: your feed and suggestions use the order everyone sees signed out, minus the traders
  and trades you hid. Your watchlist and record don’t show what’s new since your last visit. Nothing you follow, like
  or hide is deleted."
- `WATCH.markerOff` = "New closed trades since you last looked aren’t shown while “Order my feed by my activity” is off."
- `RECORD.markerOff` (new, in `allCopy`) = "“Since your last visit” isn’t shown while “Order my feed by my activity”
  is off."
- `WATCH.settings` and `RECORD.settings` = "Feed settings", both to `/settings#your-feed`.
- Unchanged: `orderLabel`, `orderOnExplain`, `orderSavedOn`, `orderSavedOff`, `SECTION.*`, `RESET.*`, `LIKES.*`,
  `FOLLOW.backToFeed`, `deleteLead`, `deleteItems`, `deleteAfter`.

### R2.4 Notes (not demands)

- With the switch off, the feed has no link back to Settings (demand 4 renders nothing when off, and C9 keeps the
  signed-out section). The way back is the profile's Settings link, plus the new "Feed settings" links on `/t` and
  `/me/record`. That's acceptable for PR-7. PR-5b's plan round should decide whether a switched-off viewer also gets
  a bare "Feed settings" link under the section, which is not a reason line, so it fits C9.
- Making stamps unknown (R2.2 (b)) also changes `trades_prompt_seen_at`, which the business lead's new-trades-prompt
  measure reads. The business lead should confirm the measure can live with it.

### Sign-off

REVISE:
1. **Let T6.1 allow `likes=<n>`.** Allow `likes` with digits only, on `/me/following`, when it equals the page the
   action was taken on, or when it comes from the "Older likes" and "Newer likes" links. Allow the fragments `#liked`
   and `#your-feed`. Everything else in C4b stays. *Test:* T6.1 passes on Unlike on page 2 and still fails when
   `?done=` is reintroduced or `likes=abc` appears.
2. **No marker may count from a visit we didn't record.** After the switch goes back on, no "since you last looked"
   or "since your last visit" marker or prompt counts from a stamp written before or during the off period. Each comes
   back only after a visit recorded with the switch on. The mechanism is the engineer's choice. One way within the
   schema rules: `setOrder(on)`, in its own write, sets `ticker_watches.last_seen_at` to `'infinity'` (the column is
   `not null`; the tree already uses `'infinity'` for rejects) and nulls `record_last_viewed_at`,
   `record_prev_viewed_at` and `trades_prompt_seen_at`. Markers treat those values as "no marker", the way they treat
   a first visit, and the next recorded visit writes a real stamp. Replace §1.1's "Switching off clears no existing
   stamp" line to match. *Test:* T1.4 extended. A trade closes, the viewer turns the switch off, opens `/t/<sym>`,
   turns it on, then opens `/t`. No count appears on that row. Then a new trade closes and the viewer opens
   `/t/<sym>`, then `/t`, and the count is 1. The same applies to `/me/record` and the profile prompt.
3. **`/t` while off.** Use `WATCH.markerOff` from R2.3, once, directly under the h2 "Your watched stocks", followed by
   "Feed settings" → `/settings#your-feed`. Each row shows no count line at all, so neither the count nor "No new
   trades" appears. Render it only when the viewer is signed in, the switch is off and they have at least one watch.
   *Test:* T1.4 asserts exactly one `WATCH.markerOff`, no "No new trades" and no "since you last looked", at 320, 360
   and 375 with no horizontal scroll.
4. **Explain the other hidden markers.** `/me/record` shows `RECORD.markerOff` + "Feed settings" where the "Since your
   last visit" section would sit, and `SETTINGS.orderOffExplain` becomes the R2.3 string. *Test:* T1.4 and T1.5 import
   both strings, and `allCopy` scans them.

Everything else in round 2 I accept as written. A round 3 that applies these four can be confirmed without a full
re-sit.
