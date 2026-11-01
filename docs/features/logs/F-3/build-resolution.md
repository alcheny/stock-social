# F-3 · Build round 1: how every finding was resolved (2026-11-01)

Inputs: the business lead's and the UX lead's committee user tests (`committee-review-business-lead.md`,
`committee-review-ux-lead.md`: compliance PASS from both, usability demands), the tester's QA pass (`qa-tester.md`:
no Blocker, 1 High, 1 Medium, 9 Low; tested a build without the fixes below), and the independent code review
(2 blocking, 1 should-fix, 5 nits). Every item was fixed with a test, or recorded with its reason.

| Source | Finding | Resolution |
|---|---|---|
| Code review 1 (blocking) | A refund lost when a call fails between the cancel and the refund | The refund comes first while the subscription is live; every retry path runs again; the app's own refund is tagged and never repeated. Test: a failure injected at the refund and at the cancel, then retries: exactly one refund. |
| Code review 2 (blocking), QA H1 | A double submit leaves a second paid subscription with no access | The duplicate is canceled at once with a full refund and flagged; a full refund now cancels only the subscription that charge paid for (a bug the new test found). Test: two checkouts paid. |
| Code review 3 | Billing could block deletion | With billing switched off the local rows go and a counted alert asks for processor cleanup. Test. |
| Code review 4 | An incomplete first payment could be canceled | Its own `incomplete` status: no access, never canceled by the app, blocks a second checkout. Test. |
| Code review 5, 6 | Comments out of step | Fixed. |
| Code review 7 | A live key could go to an overridden base | Refused. Test. |
| Code review 8 | No failure-injection test | Added (`failOn` in the fake). |
| BL 1, UX U1, QA L3 | "Sign in to subscribe" lands on broker connect | `/tools/signin` sets a fixed-value cookie the sign-in landing reads once and returns to `/tools` (no open redirect). e2e test. |
| BL 2 | Notes push cards apart at 360 px | Notes fold into a `<details>` per card. |
| BL 3, BL 5, UX U7 | No clear next step after paying; repeated links | One primary "Open Record tools" on `/account`; the duplicate heading and link are gone. |
| BL 4 | The locked page explains the tool twice | Only the Subscribe block's line remains when billing is on. |
| BL 6 | Unused strings | Removed. |
| UX U2, QA L2 | Focus after a Subscribe error | Focus moves to the plan's agreement box. e2e test. |
| UX U3 | The moved card is off screen; focus moves only once | Focus and scroll go to the moved card after every action. e2e test (two moves). |
| UX U4 | The cancel line shows when a cancel is already scheduled | Hidden then. |
| UX U5 | The add form disappears after a lapse without a word | "Adding and comparing traders needs a subscription. Your views and notes stay yours." e2e test. |
| UX U6, QA L5 | Targets under 44 px | 44 px minimum on the back link, summaries, card links and buttons. |
| UX C1, BL, QA L6 | Billing contact unset; cancel wording | On `live-billing-checklist.md`: `BILLING_CONTACT` set before live, and the Terms use the app's cancel path. |
| QA M1 | A 60-character view name overflows 360 px | `overflow-wrap: anywhere` on view names. |
| QA L1 | A signed event with no object id is retried for days | Stored, flagged, answered 200. Test. |
| QA L4 | Any account can be added by exact handle | Kept: the card shows the profile's own state ("No closed trades yet."), as the public profile does. |
| QA L7 | No-card-data check lives in a unit test | Kept there: `scripts/compliance.ts` is owner-only; the test runs in CI with `npm test`. |
| QA L8 | The browser's note limit counts emoji twice | The client cap is removed; the server's 2,000-character rule answers. |
| QA L9 | The e2e fake clashes with a running fake | Run the spec without a standing fake (CI never has one). |
| Found while fixing | The 20-view limit could be passed by concurrent creates | One create at a time per owner. Test. |
