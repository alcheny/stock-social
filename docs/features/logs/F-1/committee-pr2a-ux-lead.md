COMPLIANCE: PASS · USABILITY: DEMANDS

# F-1 · PR-2a committee review · UX lead

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys` at `ae9fb30` (fix round 6). I used the current production build on
port 3102 with `ALLOW_DEV_AUTH=1` and the in-repo vendor fake on its own port. I drove it with my own Playwright script
at 375 and 360 px, light and dark, and did a keyboard-only pass. I checked contrast with the WCAG formula and measured
tap targets. No product code changed. Screenshots are in `screenshots/pr2a/committee-ux/`.

## Copy against the plan

- **Trust notice:** the four lines, both link rows and the primary "Connect brokerage (read-only)" match §2.
- **Consent:** matches. The account line is split as §2 allows: "Every account under this login" is followed by
  "3 accounts found (1 simulated, not imported)".
- **S6, S6c and S9:** verbatim. Expired reads "The time to decide ran out. Import not started. Nothing is connected."
- **Agreed changes:** the banner reads "closed trades so far" (fix round 4), and the S7b and stale lines were reworded
  in D8 so they are true.
- **S7a:** its second action is still "Not now". "Continue in a new page" comes with the portal in PR-2b.

## The trader's path

- **Keyboard:** 7 Tabs reach the primary on the notice. Enter, then the portal, then 5 Tabs to "Import my record" and
  Enter lands on the profile. "Don't import" works the same way.
- **/settings by keyboard:** the first Enter only opens the "This cannot be undone." view, and the user row still
  exists. The second Enter deletes the profile and goes to the feed.
- **Focus:** the 2 px ring was visible on every control in both schemes.
- **Error results:** the failed and abandoned results move focus to the heading and use `role="alert"`.
- **Every page:** no horizontal scroll, no animations (with or without reduced motion), and no third-party request from
  the browser on any page I opened. The footer disclaimer and the Terms, Privacy and How links are on every page.
- **Share images:** the profile card, trade card, month card and story image all carry the full disclaimer.
- **Importing record:** signed out, it shows the banner, "Your trades appear here as they import.", no badge, no stats
  and no feed entry. The card says "Import in progress".
- **Connected record:** Verified, with stats, chart, open positions and "1 simulated account excluded". It appears in
  the feed with Verified.
- **Failed record:** no Verified badge on the profile, feed card, pane or any of the four images. "The import did not
  finish, so this record may be incomplete." shows in every place.
- **Contrast:** the lowest ratio in F-1 screens was 4.81:1.

## What confused or stopped me

1. On my failed profile, the line "The import did not finish…" and "Try again" are directly above the card that says
   "Your record is live." and offers "Share my record". The page tells me to retry and to share an incomplete record
   in the same view (`failed-owner-share-prompt-375-light.png`).
2. The banner stayed at "0 closed trades so far" for every step of the first pass, while 12 and then 16 activities
   were read. It jumped to 8 only at the rebuild. On a large history it would look frozen for minutes.
3. The consent deadline reads "Decide by Oct 24, 1:30 AM UTC". I had to convert it to my own time.
4. The expired heading is two sentences and four lines tall at 375 px (`expired-375-light.png`).
5. The owner's "Try again" link measures 101 × 43.2 px.

## Step 5

**(1) Compliance: PASS.**

- **Consent at collection (§3):** the consent screen names depth, publication, persistence and deletion before anything
  is read. Nothing is imported before the tap (tester D1, still holding).
- **Age gate (§7):** every path here starts from an attested sign-in, and the user row follows the attestation.
- **Nothing partial shown as Verified:** importing and failed records carry no Verified label on any surface, image
  included.
- **Accessibility (§9):** live regions, alert focus, the focus ring, motion and contrast all pass for the F-1 screens.
- **No third-party loads from the client.**

Outside this diff, already on `main` and not caused by PR-2a: the Demo badge text is 4.18:1 (light) and 4.45:1 (dark)
at 12 px, below 4.5:1. It needs a separate fix.

**(2) Usability: DEMANDS** (PR-2a, each one testable):

1. **No share invitation on a failed record.** When the owner's record state is `failed`, the profile shows neither
   "Your record is live." nor "Share my record". The incomplete line and "Try again" stay. Test: a profile e2e for a
   failed owner asserts both strings are absent, and that they are present again after a retry reaches `connected`.
2. **The owner's "Try again" is at least 44 px tall.** Test: assert the bounding box of `.record-failed a` is ≥ 44 at
   375 px.

Carried to PR-2b (not blocking 2a):

- **(a) The banner must visibly move during a pass.** Use the step endpoint's `imported` count (for example "N
  activities read"), or rebuild per account. A 3-page import should change the banner text after each step.
- **(b) Show the consent deadline in the trader's local time,** formatted on the client, or as "within 24 hours (by …)".
- **(c) S7a's second action is "Continue in a new page".**
- **(d) Split the expired result** into the heading "The time to decide ran out." and the body "Import not started.
  Nothing is connected.", as was done for S6b.

The test users I created were deleted, and the server and the fake were stopped.
