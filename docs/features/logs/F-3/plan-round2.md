# F-3 · Plan debate, round 2: how each demand was resolved (2026-11-01)

Round 1: the UX lead's draft (`plan.md`), the business lead's review (`plan-review-business-lead.md`, DO NOT SIGN,
11 demands) and the engineer's review (`plan-review-engineer.md`, DO NOT SIGN, 16 demands with 8 bugs in the billing
core). This file is the orchestrator's resolution of every demand, applied to `plan.md` by reference: where this
file and `plan.md` differ, this file wins. Open points the UX lead raised (§0) are settled here too.

## Settled points (plan §0)
1. Frozen or disconnected state: Record tools shows the profile's own state wording and nothing more (`Record since … ·
   Connected …` or `Demo data`, the importing line, the exclusion lines). The profile page is not changed in this PR;
   a TR-5 frozen line on the profile is a separate change for its owner. Committee K2 holds: the cards show only what the
   profile shows.
2. Notes and POLICY U1: settled by the legal committee (K5): U1 covers published text; private notes are never
   published and never moderated.
3. Period: the profile's "Record since {date}" line; the evidence line carries the span.
4. "Emails the viewer": the processor's emails (K21); the app sends none (test).

## Business lead demands
| # | Demand | Resolution |
|---|---|---|
| BL1 | Delete the separate "Lower end of range" row | Accepted in substance: no separate row. The acceptance criterion requires the lower bound, so it is shown inside the 95% range row, under the range ("Lower end of range: -2.1%"), never alone (K2). |
| BL2 | All three exclusion lines as the profile shows them | Accepted (`excludedPositions`, `excludedFuture`, `paperExcluded`, each only when non-zero). |
| BL3 | Remove withdrawn items (U1 note, connect-consent line, SDK) | Accepted. The connect-consent line (K24) goes to `live-billing-checklist.md`. |
| BL4 | A real cancel path | Accepted: an "Account" link at the top of `/tools`; `/account` has "Manage subscription" and "Cancel subscription" (exact label) opening the hosted portal; `/settings` lists Record tools and Account. |
| BL5 | Say everything once on the Subscribe screen | Accepted: one disclaimer and one set of legal links per page; the second "free" line dropped; each renewal sentence sits under its plan. |
| BL6 | First comparison in one submit | Accepted: the name is optional ("View n"), and the create form lists the viewer's follows as checkboxes (alphabetical). |
| BL7 | A screen when billing is not configured | Accepted: "Subscriptions are not available right now. Trader records stay free to view." with no plans or button. |
| BL8 | Post `annual`, not `yearly` | Accepted (labels say Yearly; the value is `annual`). |
| BL9 | Missing tests (14-day yearly refund, monthly no refund, consent kept and purged, no BILLING_CONTACT) | Accepted; in `lib/billing.test.ts` and the e2e spec. |
| BL10 | Link `/terms`; notes sorted by handle | Accepted. |
| BL11 | "Trader never sees a price" for every trader state | Accepted: connected, frozen (state after consent), all accounts removed; a pending (unconsented) connection is a viewer. |

## Engineer demands
| # | Demand | Resolution |
|---|---|---|
| D1 | Webhook deadlock (transaction across processor calls) | Fixed: no transaction; insert by event id, then a 2-minute claim lease, apply, mark processed; failures release the claim. Load test runs 32 workers. |
| D2 | Disputes keep renewing | Fixed: a dispute sets `unpaid`, flags the event and cancels at the processor. |
| D3 | Grace expiry and re-subscribe | Fixed: reconciliation cancels at the processor when grace ends; checkout first cancels any ended row the processor still holds. |
| D4 | Refund before cancel | Fixed: cancel first, then refund only if the charge carries no refund yet; one idempotency key per subscription. |
| D5 | 14-day refund measured at processing time | Fixed: measured at the subscription's `canceled_at`. |
| D6 | No pinned API version | Fixed: `Stripe-Version: 2024-06-20`; the fake refuses any other version and answers in that shape. |
| D7 | Unknown customer or price retried forever | Fixed: stored, flagged, answered 200. |
| D8 | Reconcile pages through canceled subscriptions | Fixed: the list call uses the processor's default (not canceled). |
| D9 | "At once" for a subscriber who connects | Accepted: `cancelIfTrader` runs right after consent (`app/connect/actions.ts`, one guarded call); reconciliation is the backstop. |
| D10 | Return URLs from the site URL; consent hash from server text | Accepted (`siteOrigin()`; `disclosureText()` built on the server). |
| D11 | One form per plan, no radios or `:has()` | Accepted (also meets BL5). |
| D12 | Cuts | Accepted: connect-consent line, `/me/following` link, subgrid, live counter, the clock-mocked 60 s e2e test (the 60 s cap is a constant in the client component). |
| D13 | Delete confirm in `<details>`; focus to the status line | Accepted. |
| D14 | Positions derived in order | Accepted (positions are rendered from the ordered list, gaps never shown). |
| D15 | Test fixes | Accepted: 404 bodies compared for the same viewer; card values unit-tested against the profile functions; follow list via `lib/follows.ts`. |
| D16 | Reconcile from the hourly sync tick | Accepted: `reconcileIfDue()` once a day from `/api/sync` (one guarded call); `/api/billing/reconcile` stays for manual runs. |

## Pre-authorization requests (owner)
1. Test-mode secrets in GitHub Actions (CI e2e) and the deploy platform: `STRIPE_SECRET_KEY` (test key), `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, optional `BILLING_CONTACT` (a role address). Until CI has them, the e2e
   specs that need the fake processor run only where `STRIPE_API_BASE` points at it (they skip in CI and say so); unit
   tests cover the same behaviour against the in-repo fake.
2. Processor dashboard (test mode): automatic tax on; the portal set to cancel at period end, plan switching with
   proration, retention offer off or price-only; its emails on (receipt, failed payment, 30-day yearly reminder,
   cancellation, price change) and checked against `live-billing-checklist.md`.
3. `LIVE_BILLING` stays unset until the checklist is complete.
