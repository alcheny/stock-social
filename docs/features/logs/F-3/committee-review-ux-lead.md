# F-3 · UX lead review of the build (2026-11-01)

Reviewer: UX lead. Tested against `plan.md` (with `plan-round2.md` taking precedence) and the committee's conditions
(`committee-2026-11-01.md`, K1 to K25) on the running production build (`ALLOW_DEV_AUTH=1`, test-mode billing against
the in-repo fake processor). Playwright, Chromium, 360x740, light and dark, reduced motion. Test users had the `ux_`
prefix and were deleted afterwards. Screenshots are in `/tmp/claude-0/ux/` (local only, not committed).

## Verdict

- **USABILITY: DO NOT PASS.** Seven demands (U1 to U7 below). The core works and reads clearly, but a viewer who
  arrives signed out gets lost at sign-in, and keyboard and screen-reader users lose their place after actions.
- **COMPLIANCE: PASS** on POLICY and K1 to K25 as far as the UI and responses can show. One item must be checked
  before live billing (C1). Nothing I saw breaks a condition.

## Journey 1: first-time trader (connected record)

Signed in at `/login/dev` and added a `connected` connection row. Then visited `/settings`, `/tools` and `/account`
(`j1_settings.png`, `j1_tools.png`, `j1_account.png`).
- No price, plan, "$", checkout, agreement box or Subscribe form on any of the three pages. `/account` shows only
  "Record tools is included with your connected record." and no test-mode label. The trader has no `billing_customers` row. (K14 met)
- Record tools works: I created a view, added `momentum_maya` and `dividend_dan` by exact handle, and the cards
  rendered (`j1_view2.png`). No note field on the trader's own card, which is correct.

## Journey 2: first-time viewer from a shared link

1. **Signed-out profile** `/u/momentum_maya` (`j2_01_profile_signedout.png`): no Record tools, price or Subscribe
   mention (AC1 met).
2. **Finding Record tools**: from the profile there is no route (by design). Once signed in, the path is own profile →
   Settings → Record tools. `/tools` signed out (`j2_02_tools_signedout.png`) shows the full disclosure block above
   the buttons, with no plan preselected and "Sign in to subscribe" and "Not now" at equal weight.
   - **Confusing:** "Sign in to subscribe" goes to `/login`. That page is headed "Publish your trades" and offers
     "Connect a brokerage instead" (`j2_03_login.png`). After signing in I landed on my own empty profile, which said
     "You're in. Next: connect your brokerage." (`j2_04_after_login.png`), and the Record tools page was gone. A
     viewer who only wanted to subscribe is told to become a trader. (U1)
3. **Subscribe screen, signed in**: submitting without ticking the box shows "Tick the box to agree to automatic
   renewal." in red, but focus stays on `<body>` (`j2_08_noagree.png`). (U2) After ticking the monthly box,
   "Subscribe: $9.99/month" opened the hosted checkout, which showed "Subscription: $9.99 plus tax $0.00. Total
   today: $9.99." and "Test mode, no real charge." (`j2_09_checkout.png`).
4. **Activation**: "Pay (test card)" returned to `/account?activating=1`, which showed the active state at once
   (`j2_11_account_active.png`). That state shows the plan with price plus tax, the renewal date, the receipt line,
   the cancel and refund lines, and "Manage subscription" and "Cancel subscription". No celebration, no upsell.
   **No billing contact line**, because `BILLING_CONTACT` is unset here (C1).
5. **Comparison**: I created "Three styles" and added `momentum_maya`, `dividend_dan` and `yolo_yuki` by handle.
   The status line read "Trader added in position 3 of 3."; an unknown handle gave "No trader has that exact
   handle.". Cards are identical in style, sit in added order and show no ranking or highlight; the lower end shows
   only inside the range row (`j2_14_view3.png`). The card values equal `/u/yolo_yuki` (50%, +0.9%, -3.4% to +4.3%,
   -48.3%, the same evidence line). No handle appears in any URL; view ids are UUIDs.
   - **Reorder at 360px:** "Move up" sends the page back to the status line at the top. The moved card is about
     1,400 px below and off-screen (`j2_15_moved.png`), so you cannot see the result. (U3)
6. **Note**: saved "Steady, small wins. `<b>escaped?</b>`"; it shows as literal text, the count reads "35 of 2,000
   characters", and the status is "Note saved." (`j2_16_note.png`).
7. **Export**: the file is `stock-social-my-data.json` and holds exactly the disclaimer, views (name, ordered handles,
   times), notes (handle, text, time) and subscription (plan, status, period end, cancel at period end). No figures.
   (K11 met)
8. **Cancel**: "Cancel subscription" opened the portal. There, Cancel changed the state to "cancels at period end",
   and Return came back to `/account` (`j2_20_account_cancelsched.png`), which showed "Your subscription ends on Dec
   1, 2026. You keep Record tools until then…" and "To keep it, open Manage subscription." `/tools` shows the
   end-date line.
   - **Contradiction:** the page still says "To cancel: Account → Cancel subscription", but that button is gone in
     this state. (U4)
9. **Resume**: Manage subscription → Resume → Return. The page went back to "Renews on Dec 1, 2026"
   (`j2_22_account_resumed.png`).
10. **Lapsed** (I set my own test row to `canceled`): views, notes, reorder, remove, rename, export and delete all
    still work. The cards show only position, handle and note, with no "%" anywhere (`l_view_lapsed.png`). The
    "Subscribe again" block shows in full (K10 met).
    - **Gap:** the add-trader form is silently missing, with no line saying why. A lapsed add is redirected with
      `e=locked`, which the page does not handle, so it shows no message. Plan §7 says add works when lapsed. (U5)

## Keyboard, screen reader, contrast, motion

- **Tab order** follows the visual order on the Subscribe block (agreement box, its button, then the next plan, then
  Not now) and on the view page (handle link, Move up/down, Remove, note, Save, Delete note, Delete view).
  Accessible names are good ("Move @yolo_yuki up", "Remove @dividend_dan from this view", "Save note about
  @dividend_dan"). The focus ring is a 2px solid accent outline everywhere.
- **Focus after actions is inconsistent** (`FocusMessage` runs only on mount). The first Move focused `#rt-msg` at
  the top. A second Move on the same page left focus on `<body>`, scrolled to `#card-3`, so the next Tab jumps to
  "Rename view" at the top (`kb_after_move.png`). (U3)
- **Contrast**: computed for every text node on the locked, tools, view and account pages in light and dark. No pair
  is below 4.5:1, or 3:1 for large text. No horizontal scroll at 360px.
- **Motion**: no transition or animation in any `main` element; activation polling changes text only. Passes with
  reduced motion.
- **Tap targets under 44px** (measured, same in both schemes): "← All views" 87x20, "Rename view" summary 328x23,
  the card handle links (about 21px tall), the "Record tools" link on `/account` (95x20), and the "Create view" and
  "Add" buttons and one secondary button at 43px. (U6)

## USABILITY demands (each testable)

- **U1. Return a signed-out viewer to Record tools after sign-in.** "Sign in to subscribe" links to
  `/login?next=/tools` (plan §3), and every sign-in path, including `/login/dev`, redirects to
  `/tools#subscribe` after sign-in. Test: e2e, signed out on `/tools`, click "Sign in to subscribe", sign in, and the
  URL is `/tools` with the Subscribe heading visible. The sign-in page framing ("Publish your trades") is a separate
  F-1 matter and needs no change here once `next` works.
- **U2. Focus the error on the Subscribe screen.** After `e=agree`, focus moves to the chosen plan's checkbox, which
  has `aria-invalid` and `aria-describedby="sub-err"`; after `e=plan` or `e=checkout`, focus moves to `#sub-err`.
  Test: `document.activeElement` is the monthly checkbox after an unticked monthly submit.
- **U3. Keep a reordering user at the card.** After Move, Remove, Add, Save note or Delete note, every time (not
  only on the first action after a load): focus lands on the status line, which must sit inside or beside the
  affected card, or focus lands on the moved card's same button (the other arrow at an end) while the status line
  still announces "moved to position i of n". The moved card is visible in the viewport. Test: two Moves in a row
  at 360x740; after each, the focused element is inside `#card-{i}` (or is the status line rendered there) and that
  card's `getBoundingClientRect().top` is between 0 and 740.
- **U4. Account, cancel-scheduled state:** hide the "To cancel: Account → Cancel subscription…" line, which
  describes a button not shown there. Test: with `cancel_at_period_end = true`, `/account` contains neither
  "To cancel:" nor a "Cancel subscription" control.
- **U5. Lapsed view: tell the user why adding is off.** Show one muted line where the add form was ("Adding traders
  needs a subscription; your views and notes stay here."), or keep the form and handle `e=locked` with a
  `role="alert"` message. Pick one and record it, since plan §7 said add works. Test: in a lapsed view, the add area
  shows the line, or the add attempt shows the message; never silence.
- **U6. 44px targets** for "← All views", the "Rename view" summary, the card handle links (`display:inline-block;
  min-height:44px` or padding), the `/account` "Record tools" link, and every `.button` at least 44px (now 43px).
  Test: the e2e measures every `a, button, summary, input, select, textarea` in `main` on `/tools`, a view and
  `/account` at 360px and asserts `height >= 44`.
- **U7. Duplicate labels:** `/settings` and `/account` show an `<h2>Record tools</h2>` directly followed by a link
  also called "Record tools". Rename the link "Open Record tools" (and "Your account" under Settings), so a
  screen-reader link list is not ambiguous. Test: no link text equals the heading directly above it.

## COMPLIANCE verdict: PASS (with one pre-live check)

POLICY: no third-party script, font or embed on `/tools` or `/account`, and no tracker. The disclaimer and the Terms,
Privacy and How links are on every surface and in the export. No advice, signal, "best", "top", "winners" or
completeness claim on any Record tools page. Losses are styled like gains. No personal data appears in URLs.

Per condition, as observed:
- **K1** pass: handles added by POST, exact match, never in a URL.
- **K2** pass: figures equal the profile's; the lower end shows only beside the range; the exclusion lines are
  shown; no open positions.
- **K3** pass: no sort, highlight or cross-trader figure.
- **K4** pass: UUID ids; a missing view returns 404. A foreign view was not separately tested here; it is covered by
  the e2e suite.
- **K5** pass: notes are escaped and capped at 2,000 characters; the trader's own card has no note field.
- **K6** pass: `noindex, nofollow`, `private, no-store` and `no-referrer`; not in the sitemap; no share UI.
- **K7** not observable in the UI; no channel was seen.
- **K8** pass.
- **K9** pass: no handle or figure on the locked page; no preselected plan; "Not now" has the same class as
  Subscribe.
- **K10** pass: a lapsed account shows no figures and keeps all data. U5 is copy only.
- **K11** pass: export keys are exact.
- **K12** pass: the advance line shows on `/tools` and `/settings`.
- **K14** pass.
- **K15** pass: every item sits above the buttons, uncollapsed, with an unchecked box per plan and exact button
  labels. The cancel line reads "Account → Cancel subscription", matching the real one-step path, which is shorter
  than the K15 example.
- **K16** consent hashing was not observable from the UI.
- **K17** pass, except the billing contact: see C1.
- **K18** pass: an exact "Cancel subscription" label goes to the hosted portal; switch and resume are in the portal.
- **K20** pass: the delete screen shows the retention line once the user has subscribed.
- **K22** pass: the checkout URL carries no handle or email.
- **K23** pass: "Test mode, no real charge" appears on Subscribe, `/account` and checkout.
- K13, K19, K21, K24 and K25 have no UI to judge beyond what was seen; none was violated.

- **C1 (before live billing):** K17 requires the billing contact, a role address, on the account page. It is hidden
  when `BILLING_CONTACT` is unset. Add "BILLING_CONTACT set to a role address" to `live-billing-checklist.md`, or
  refuse live mode without it.
