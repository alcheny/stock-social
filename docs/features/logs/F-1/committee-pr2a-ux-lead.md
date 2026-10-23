COMPLIANCE: PASS · USABILITY: DEMANDS

# F-1 · PR-2a committee review · UX lead

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys` at `ae9fb30`. I used the production build on port 3102
(`ALLOW_DEV_AUTH=1`) with the in-repo vendor fake on its own port, and drove it with my own Playwright script. I
checked 375 and 360 px, light and dark, keyboard only, contrast and tap targets. No product code changed. Screenshots are in `screenshots/pr2a/committee-ux/`.

## Copy against the plan

- **Trust notice:** the four lines, both link rows and "Connect brokerage (read-only)" are verbatim.
- **Consent:** verbatim, with the account line split as §2 allows ("3 accounts found (1 simulated, not imported)").
- **S6, S6c and S9:** verbatim.
- **Agreed changes:** the banner says "closed trades so far" (fix round 4), and S7b was reworded for truth (D8).
- **S7a:** its second action is still "Not now". "Continue in a new page" comes with the portal in PR-2b.

## The path

- **Keyboard:** the notice primary takes 7 Tabs, then the portal, then 5 Tabs to "Import my record", which lands on
  the profile. "Don't import" works the same way.
- **/settings:** the first Enter only opens "This cannot be undone." (the user row stays). The second Enter deletes.
- **Focus:** the 2 px ring shows on every control. The failed and abandoned results put focus on an alert heading.
- **Every page:** no horizontal scroll, no animations, no third-party request from the browser, and the footer
  disclaimer with Terms, Privacy and How; every share image carries it too.
- **Contrast:** the lowest on F-1 screens is 4.81:1.
- **Importing record, signed out:** banner, no badge, no stats, not in the feed. The card says "Import in progress".
- **Failed record:** no Verified on the profile, feed card, pane or any image, and the incomplete line shows everywhere.

## What confused or stopped me

1. On my failed profile, "The import did not finish… Try again" sits directly above "Your record is live." and
   "Share my record". I'm told to retry and to share an incomplete record in the same view
  .
2. The banner stayed at "0 closed trades so far" through every step of the first pass, while 16 activities were read.
   It jumped to 8 only at the rebuild. It looks frozen.
3. "Decide by Oct 24, 1:30 AM UTC": I had to convert the time zone.
4. The expired heading is two sentences, four lines tall at 375 px (`expired-375-light.png`).
5. The owner's "Try again" is 43.2 px tall.

## Step 5

**(1) Compliance: PASS.**

- **§3:** consent names depth, publication, persistence and deletion before anything is read, and nothing is imported
  before the tap (tester D1, still holding).
- **§7:** every path starts from an attested sign-in, and the user row follows the attestation.
- **Nothing partial shown as Verified:** importing and failed records carry no Verified label anywhere, images included.
- **§9:** live regions, alert focus, the focus ring, motion and contrast all pass.
- **No third-party loads** from the browser.

Outside this diff (already on `main`): the Demo badge is 4.18:1 in light mode and 4.45:1 in dark at 12 px, below
4.5:1.

**(2) Usability: DEMANDS** (PR-2a):

1. **No share invitation on a failed record.** When the owner's state is `failed`, the profile shows neither "Your
   record is live." nor "Share my record". The incomplete line and "Try again" stay. Test: an e2e for a failed owner
   asserts both strings are absent, and present again once a retry reaches `connected`.
2. **The owner's "Try again" is at least 44 px tall.** Test: the bounding box of `.record-failed a` is ≥ 44 at 375 px.

Carried to PR-2b (not blocking):

- **(a)** The banner moves during a pass: it uses the step endpoint's `imported` count, or rebuilds per account, and
  its text changes after each step of a 3-page import.
- **(b)** The consent deadline is shown in local time, or as "within 24 hours (by …)".
- **(c)** S7a's second action is "Continue in a new page".
- **(d)** The expired result uses the heading "The time to decide ran out." with "Import not started. Nothing is
  connected." as body text, as S6b does.

Test users deleted; server and fake stopped.
