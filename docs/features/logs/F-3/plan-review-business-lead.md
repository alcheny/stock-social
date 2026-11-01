# F-3 · Business lead's review of the UX lead's plan (round 1, 2026-11-01)

Reviewed: `plan.md` against the F-3 decisions and acceptance criteria, the committee's 25 conditions, POLICY, and the
code as it stands (`lib/billing.ts`, `app/u/[handle]/page.tsx`, `app/layout.tsx`, `app/settings/page.tsx`).
Fixed by the orchestrator and not debated here: no new dependency (fetch from `lib/billing.ts`), test mode only,
condition 24 deferred to the live-billing checklist, private notes not moderated.

**Verdict: DO NOT SIGN.** The plan is close: the structure, the trader rule, the lapse design, the privacy headers and
the test table are right. Two items break K2/K3 (paid presentation that differs from the free profile), three
contradict the fixed constraints, and the Subscribe screen repeats itself and describes a cancel path a user cannot
follow. All are small edits; I expect to sign round 2.

## Positions

1. **Owner decisions.** Implemented: traders never charged and never shown a price (§1, §5, §8 trader state,
   `isTrader` in `lib/billing.ts`); viewers pay $9.99 / $99.99; no trial; processor sends every email; refunds,
   7-day grace, lapse keeps views and notes. Good.
2. **Conditions.** 1, 4 to 23 and 25 are covered with a test each. Gaps: K2/K3 (demands 1, 2), K16 (no test that the
   consent row's user is nulled at deletion and purged after 3 years), K18 (no test of the automatic 14-day yearly
   refund or of "no refund" on a monthly cancel). 24 is deferred by the orchestrator.
3. **§0.1 frozen line: agreed.** TR-5 already requires "Disconnected {date}" on the profile, so adding it there is a
   Must the profile is missing, not a paid change. One helper, used by both. Signed.
4. **§0.2, §9 K24 line, §12.7, §13.1, §13.6 (U1 half): withdrawn by the orchestrator.** Delete them (demand 3).
5. **Entry points: right, with one fix.** No price on profiles, trade pages, feed, share card or nav; the only price
   is on `/tools` and only for non-traders. `/me/following` is the highest-intent entry and should stay. But a viewer
   reaches `/tools` only via @handle → Settings → Record tools, and `/account` the same way, while the cancel line
   says "Account → Manage subscription → Cancel" as if Account were visible. Cancel must be as easy as subscribing
   and the path in the copy must be the real one (demand 4). I do not ask for a nav item or a profile link in a
   test-mode release; that is the first thing to test once billing is live.
6. **Subscribe screen: honest, too long by about a third, none of it the law's fault.** Everything condition 15 asks
   for is there. What is not required: the disclaimer and the three legal links twice on the locked page (§2 under the
   h1 and again in §4.1); "Trader records stay free to view without a subscription." twice (§3 and §4.2); two separate
   renewal sentences when each fits in its plan's radio label. At 360px that is roughly 80 words and one full scroll
   removed between the price and the button, with no disclosure lost (demand 5).
7. **Viewer adoption at 360px: the comparison is clear; getting to it is not.** Today a first comparison costs: type a
   name, Create, type a handle, Add, type a handle, Add: 4 submits and 3 typed fields before the aha. The minimum is
   one submit: pick 2 to 4 people you follow, see them side by side (demand 6). Traders, who get Record tools free,
   are most of the signed-in users today, so this is the test-mode adoption number that matters.
8. **Over-built for test mode: little.** The 100k webhook test and the trial-ending payload are acceptance criteria;
   keep them. Rename, Move up/down, the deleted-trader line and the past-due banner are each required by a condition.
   Nothing to cut beyond demands 1, 3 and 5.

## Demands (prioritized; each is how I verify round 2)

1. **Delete the "Lower end of range" row (§6).** The profile shows the low end only inside the range text
   (`{range} · 95% range`); a separate row is a paid-only presentation (K2) and invites ranking by lower bound across
   columns (K3). Verify: the card's labels are a subset of the profile's labels, in the profile's words.
2. **Exclusion lines exactly as the profile (§6).** The profile shows up to three lines, only when non-zero:
   `PROFILE.excludedPositions`, `PROFILE.excludedFuture`, `RECORD_BODY.paperExcluded`. The plan shows one, always.
   Reuse the same strings and conditions (K2: only what the profile shows). Verify: the unit test that compares card
   values with the profile covers all three and the zero case.
3. **Remove what the orchestrator withdrew:** §0.2 and §13.6's U1 half, the §9 connect-consent line and the §11 K24
   row (move the wording to `live-billing-checklist.md`), and §12.7 / §13.1's SDK (replace with "no new dependency;
   the processor is called with fetch from `lib/billing.ts`").
4. **Real cancel path, two taps from anywhere a subscriber lands.** Put an `Account` link at the top of `/tools` for
   subscribers (not only in the footer pair), and make the cancel line name the path the UI actually has, ending in
   the button's exact label: `To cancel: Settings → Account → Cancel subscription.` (or the shorter path if you add
   one). Verify: an e2e test follows the line's link texts from `/tools` and reaches the processor portal.
5. **One copy of everything on the Subscribe screen.** One disclaimer + legal links per page (the consent hash covers
   the page's copy); drop §3's second "Trader records stay free…" line; fold the renewal sentence into each radio:
   `Monthly: $9.99 per month plus applicable sales tax. Renews automatically each month; next charge {date}.` (yearly
   likewise). Verify: e2e counts exactly one disclaimer and one of each condition-15 line above the button.
6. **One-submit first comparison.** The new-view form: name optional (default `View {n}`), plus, when the user follows
   anyone, checkboxes of followed traders in alphabetical order (pick 2 to 4); submitting creates the view in the
   ticked order and opens the comparison. Exact-handle add stays inside the view. Verify: e2e from `/tools` to a
   2-trader comparison in one submit at 360×740.
7. **Billing-not-configured state.** `billingAvailable()` returns null without keys; the plan has no screen for it.
   Locked `/tools` then shows the description and `Subscriptions are not available yet.`, no plans, no button;
   `/account` hides Manage/Cancel. Verify: e2e with keys unset.
8. **Plan value `annual`, label "Yearly".** The form posts `value="annual"` (`isPlan` rejects `yearly`); the
   checkbox's `value` and the `:has()` selectors match. Verify: unit `subscribe accepts annual, rejects yearly`.
9. **Missing tests:** yearly cancel within 14 days refunds in full automatically, monthly cancel refunds nothing (K18,
   decision 2026-11-01); consent row user nulled at deletion and purged after 3 years (K16); `BILLING_CONTACT` unset
   → the line is omitted and the page still renders (never a personal address).
10. **`/terms#billing`:** link `/terms` until the billing section exists (no dead anchor). Notes on `/tools` list in
    alphabetical order by handle (never by a record number).
11. **AC2 matrix:** the "trader never sees a price" e2e covers connected, frozen, all accounts removed (records
    remain), and documents that a user with a connection still pending consent is a viewer.

## For the engineer (reviewing in parallel)
Hold the plan to demands 1, 2, 7 and 8 in code review: they are the ones a diff-only review will miss.

## What would change my mind
If the owner wants Record tools discoverable from profiles before live billing, a price-free "Compare" link for
signed-in users is the candidate; it changes the profile for signed-in viewers only and needs the committee's view
under condition 9. Not in this release.

---

# Round 2 (2026-11-01): SIGN

Read `plan-round2.md` and skimmed the built code (`app/tools/page.tsx`, `app/tools/parts.tsx`, `app/account/page.tsx`,
`RECORD_TOOLS` / `BILLING` in `lib/copy.ts`). Every round-1 demand is resolved in substance.

- BL1: accepted as resolved. AC13 does require the lower bound. It now sits inside the range row in small type,
  never alone and never as its own row (`app/tools/page.tsx:245`), so there is nothing to rank on that the range does
  not already show.
- Settled point 1: accepted. The cards show only what the profile shows. The profile is still missing TR-5's
  "Disconnected {date}" line; log it as a separate profile item, not in this PR.
- D12's cut of the `/me/following` link: accepted for test mode. It is the first entry point to re-test before live
  billing.

## Conditions on the build (checked at PR review, none reopens the plan)
1. `BILLING.cancelHow` still reads "Account → Manage subscription → Cancel" while `/account` has a direct button
   labeled "Cancel subscription". Make the copy match the real path:
   `To cancel: Account → Cancel subscription. Canceling takes effect at the end of the paid period: you keep access until that date and are not charged again.`
   Verify: e2e follows "Account" from `/tools`, then "Cancel subscription", and reaches the portal.
2. The name field is optional, so label it that way: `Name (optional)`. An empty name with 2 to 4 ticked follows
   creates `View {n}` and opens the comparison in one submit. Verify: e2e at 360×740.
3. `Sign in to subscribe` links to `/login?next=/tools`, so the viewer comes back to the screen they left.
4. Delete the dead `BILLING.choosePrompt` string. One form per plan made it unnecessary.
