# F-3 · Committee user test, business lead (2026-11-01)

Branch `claude/f3-viewer-subscriptions` (head 8e920d8). I walked both journeys at 360px from the source
(`app/tools/page.tsx`, `app/tools/parts.tsx`, `app/tools/actions.ts`, `app/account/page.tsx`, `app/settings/page.tsx`,
`lib/copy.ts` RECORD_TOOLS/BILLING, `lib/record-tools.ts`, `next.config.ts`) and against `e2e/f3-billing.spec.ts`
(8/8 with the fake processor). I could not drive a browser, so every finding below is cited to code.

## Verdict 1: COMPLIANCE: PASS

POLICY and the 25 committee conditions (`committee-2026-11-01.md`) hold. Notes:
- K1, K3: handles go in by server action only (`page.tsx:189-207`); follows alphabetical (`lib/record-tools.ts:128`);
  Move up / Move down carry accessible names (`page.tsx:221-223`); no sort, highlight or cross-trader figure; gain/loss
  class on the average uses the profile's own rule (`lib/record-tools.ts:214`, `app/u/[handle]/page.tsx:218`).
- K2, E5: cards come from `stats`, `confidence`, `rangeText`, `evidenceLine` read live (`lib/record-tools.ts:192-218`);
  the lower end sits only under the range (`page.tsx:245`); "New record" and the profile's state line shown; no open
  positions.
- K6: noindex/nofollow and no-referrer metadata (`page.tsx:16`, `account/page.tsx:15`); `private, no-store` and
  `Referrer-Policy` headers (`next.config.ts:17-22`); no share UI; generic title.
- K8: the disclaimer and the three legal links head every surface (`parts.tsx:9-20`).
- K9, K15: the full disclosure block is above both buttons, never collapsed; one form per plan, each with its own
  unchecked box, so nothing is preselected; the server refuses an unticked box (`actions.ts:36`); "Not now" carries
  the same `button wide choice` class as Subscribe (`parts.tsx:42-58`); no handle, figure or example record on the
  locked page; "Trader records stay free to view without a subscription." per C8.
- K10: lapsed shows names, handles and notes, editable and exportable; cards compute nothing when not entitled
  (`page.tsx:179`).
- K14: a trader never reaches `SubscribeBlock` (`page.tsx:63`, `lapsed` requires `a.kind === 'none'`), never sees the
  test-mode label, plan or price on `/account` (`account/page.tsx:28-34`), and `/settings` names no price.
- K17, K18, K23: account page has plan, renewal date and price plus tax, the cancel path, refund line, receipt line,
  test-mode label; "Cancel subscription" opens the hosted portal (`account/actions.ts`).
- K22: the e2e asserts the processor saw no handle, user id or email.

Recorded deviation, not a failure: K15's literal cancel line reads "Account → Manage subscription → Cancel"; the build
says "Account → Cancel subscription" (`lib/copy.ts` BILLING.cancelHow), at my plan-review request, because that is the
path the UI actually has. Before live billing the Terms' cancel section must use the same words (add to
`live-billing-checklist.md`). Also on that checklist: `BILLING_CONTACT` must be set, because K17 requires the contact
and the page omits it when the variable is empty (`account/page.tsx:22,46`).

## Verdict 2: USABILITY: NOT YET (6 demands, in priority order)

Journey (a), trader: passes. Sign in → Settings → Record tools shows "Record tools is included with your connected
record." and the tool; Account shows the same line and Download. No price anywhere. Clean.

Journey (b), viewer from a shared profile: breaks at sign-in and at the comparison itself.

1. **Sign-in must return to the Subscribe screen.** `Sign in to subscribe` links to bare `/login`
   (`parts.tsx:57`), and `/account` signed out redirects to bare `/login` (`account/page.tsx:20`). A new viewer then
   lands on `/connect` (`lib/auth/landing.ts:8`), the broker-connect screen, which is the wrong product for a viewer,
   with no way back to `/tools` but @handle → Settings. This was my build condition 3 in `plan-round2` review and it
   was not delivered. Demand: link to `/login?next=/tools%23subscribe` (and `/login?next=/account`); every sign-in path
   (dev, email link, provider callback) honors `next` only when it starts with `/` and not `//`, and it overrides the
   default landing. Verify: e2e at 360px, signed out → `/tools` → Sign in to subscribe → dev sign-in as a new handle →
   URL is `/tools`, both plan checkboxes visible; the same with `next=//evil.example` lands on the default.
2. **The comparison must be comparable at 360px.** Each card stacks position, heading, state line, six figure rows,
   up to three 44px buttons and a full note form (label, 4-row textarea, counter, Save, Delete) (`page.tsx:211-229`).
   Two cards are roughly two screens apart, so the user cannot see the two average returns together; that is the
   whole product. Demand: on the view page put each note in a collapsed `<details>` under the card (summary
   "Private note" or "Private note · saved"; open it after a save so focus is kept), and keep notes in full on the
   `/tools` index where they already live. Verify: e2e at 360×740 with two traders that have full figures, the
   "Avg return / trade" rows of cards 1 and 2 are both within 1.5 viewport heights of card 1's top.
3. **After paying, the next tap is the tool.** Activation ends on `/account`, where Record tools is a plain text link
   under a heading, placed after nothing and outranked by the `Download my data` button (`account/page.tsx:55-57`).
   Demand: in the subscriber state, one primary `Open Record tools` button (`/tools`) directly after the plan and
   renewal lines; Manage and Cancel keep their equal-weight buttons below. Verify: e2e after "Pay (test card)", the
   first button on the page after activation is `Open Record tools`.
4. **Say it once on the locked page.** `RECORD_TOOLS.what` (`page.tsx:68`) and `BILLING.whatYouGet` (`parts.tsx:42`)
   both explain the tool, 30px apart. Demand: render `RECORD_TOOLS.what` only in the billing-unavailable branch;
   `whatYouGet` already satisfies K15. Verify: the locked page with billing on contains "2 to 4" exactly once.
5. **One road to the tool from Account.** For a never-subscribed or lapsed viewer `/account` offers "See Record tools"
   or "Subscribe again" as a button, then an h2 "Record tools" and a "Record tools" link to the same place
   (`account/page.tsx:51-56`). Demand: delete the h2 and the plain link in every state that already has a button to
   `/tools` (keep Download my data and its help line under a `Your data` heading). Verify: each `/account` state has
   exactly one link to `/tools`.
6. **Delete dead copy.** `BILLING.choosePlan`, `BILLING.subscribed` and `RECORD_TOOLS.editNote` are unused (grep of
   `app/` and `lib/`). Delete them. Verify: grep returns no definition without a use.

Not demanded (correctly out of scope for test mode, per my plan review): a nav, footer or profile entry to
`/tools`, and the `/me/following` line. Today a signed-out viewer can reach `/tools` only by typed URL or after
signing in via Settings; this is the first thing to test before live billing, not now.

## Demo sentence
"Put two to four public trading records side by side in your own order, losses included, with a private note on
each, and nothing ranks them for you."

## What would change my mind
If the 360px e2e for demand 2 already shows both averages within 1.5 screens, drop demand 2. The fastest test for the
first-comparison path: at 360×740, count submits from a fresh subscriber with zero follows to two cards on screen
(today: create, add, add = 3); if test users stall there before live billing, the create form should take one exact
handle.
