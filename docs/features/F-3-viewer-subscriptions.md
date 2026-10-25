# F-3 · Viewer subscriptions (traders never pay)

Status: draft

## Why
Traders supply the verified records and must be incentivized to connect and keep connections live.
The people who use that information, the viewers, carry the cost. Billing is a Phase 3 item
(DESIGN §3.3, "Monetize supply") and stays blocked on a securities-counsel opinion for anything that
sells access to a trader's positions or theses; this file designs the system so it is ready when that
opinion lands.

## Decisions
- 2026-10-22: Traders are never charged for connecting a brokerage, for any number of accounts, or
  for anything that is part of their public record. Why: the owner wants traders incentivized to
  provide information; the cost is passed to the people who use it.
- 2026-10-22: Revenue comes from viewers of trades, as a subscription. Why: the owner's direction;
  viewers are the demand side and the ones who benefit from the information.
- 2026-10-22: A paid tier never hides, delays or alters any part of a public record that is free
  today (headline stats, chart, full trade list, losses, open positions summary, share card). Why:
  POLICY (records are public and complete), TR-1..TR-8, Standing direction 2 ("Trust is the brand")
  and 4 (shared links must work signed out).
- 2026-10-25: The viewer subscription costs $9.99 a month. Why: the owner's decision, in line with
  comparable copy-trading and charting products ($10 to $15 a month). At this price the base-case
  projection still loses money until about 2.8% of monthly viewers pay or connected traders stay near
  5 per 100 viewers, because broker data costs about $1 a month per connected trader (projection
  dashboard, Oct 25).

## What viewers pay for (candidates; each needs the counsel opinion before build)
- Delayed "ride-along" view of a trader's open positions with entry percentages (DESIGN §3.3).
- Alerts when followed traders close a trade or publish a thesis.
- Deeper analytics across traders: compare, screens, exports; the free profile keeps its own numbers.
- An ad-free or higher-limit experience (watchlist size, follow count).
- A share of each viewer subscription paid out to the traders the viewer follows (creator payouts,
  DESIGN §3.3); payouts are revenue share for publishing a record, never tied to trade frequency or
  to viewers acting on a trade (POLICY, "Never" list).

## Acceptance criteria
Each one testable; the pipeline writes a test for every line.
- [ ] A signed-out viewer on any public profile, trade page or the feed sees everything that is free
      today; no paywall interstitial, no blurred numbers.
- [ ] A trader with and without connected accounts is never shown a price, a plan or a card form.
- [ ] A viewer can start, change, cancel and resume a subscription without contacting support; the
      card form and customer portal are hosted by the billing vendor, never by the app.
- [ ] Entitlements are read from the app's own `subscriptions` row, never from a live vendor call, on
      every page that gates a paid feature.
- [ ] Every billing webhook is signature-verified, stored once by its vendor event ID (duplicates are
      no-ops), and applied idempotently; out-of-order delivery converges to the same state.
- [ ] A nightly reconciliation compares every active row against the vendor and logs each mismatch.
- [ ] A failed renewal keeps access for the grace period, retries on the vendor's schedule, and emails
      the viewer; cancellation takes effect at period end and the date is shown.
- [ ] When a subscription lapses, the only change is that paid features switch off; no public record
      changes (tested by snapshot of a profile before and after).
- [ ] Every price and invoice shows tax handled by the billing vendor; the app stores no card data
      (no PAN, CVV or expiry fields anywhere in the codebase; scanner rule).
- [ ] Tests cover every lifecycle event with recorded payloads: created, trial ending, renewed, payment
      failed, past due, canceled, resumed, refunded, disputed; plus replay, out-of-order and malformed
      signature.
- [ ] Heavy use: 100,000 webhook events in an hour are processed without duplicates or lost events.

## Design outlook

### Principles
1. **One vendor, one file.** All billing calls go through `lib/billing.ts`, the same isolation rule as
   the broker vendor. Nothing else imports the billing SDK. Swapping vendors is one file plus a data
   migration.
2. **Hosted everything.** Checkout, card entry, the customer portal (update card, cancel, invoices)
   and tax are hosted by the vendor. The app never sees card numbers, which keeps it out of the heavy
   tiers of payment-card compliance (an annual self-assessment questionnaire instead of an audit).
3. **Your database is the source of truth for entitlements; the vendor is the source of truth for
   money.** Pages read your row. Webhooks and a nightly reconciliation keep the row correct.
4. **Idempotent by construction.** Every inbound event is stored by its vendor ID before processing;
   every outbound create call carries an idempotency key.
5. **Nothing paid touches the record.** Paid features are additive layers (alerts, analytics,
   ride-along). The record and the share card are untouched by plan state.

### Data model (additions to `db/schema.sql`, idempotent)
- `billing_customers(user_id pk, vendor_customer_id unique, created_at)`
- `subscriptions(id, user_id, vendor_subscription_id unique, plan text, status text
  check (status in ('trialing','active','past_due','canceled','unpaid','paused')),
  current_period_end timestamptz, cancel_at_period_end bool, grace_until timestamptz,
  created_at, updated_at)` with one active row per user enforced by a partial unique index.
- `billing_events(vendor_event_id pk, type text, received_at, processed_at, payload jsonb,
  error text)`: the raw inbox; the dedupe key is the vendor's event ID.
- `payouts(id, trader_user_id, period, amount_cents, currency, status, vendor_transfer_id,
  created_at)`: only once creator payouts are approved by counsel.
- A `plans` table is unnecessary at launch: one or two plans live in code with the vendor's price IDs
  in environment variables.

### Flows
- **Start:** viewer taps Subscribe → server action creates or finds the vendor customer (idempotency
  key = user id) → creates a hosted checkout session with the price ID and a return URL → redirect.
  On return the page shows "Activating…" and polls the `subscriptions` row (the webhook is usually
  there within seconds). Never grant access from the return URL alone; the webhook is the proof.
- **Manage:** "Manage subscription" opens the vendor's hosted customer portal with a return URL.
  Every change comes back through webhooks.
- **Webhook endpoint (`/api/billing/webhook`):** verify the signature against the raw body; insert
  into `billing_events` (on conflict do nothing → return 200 immediately); then process in the same
  request: map event → desired row state → upsert `subscriptions`. Return 200 only after the row is
  written; on error return 500 so the vendor retries, and record `error`. Keep handlers small: fetch
  the subscription object from the vendor by ID inside the handler rather than trusting the event's
  embedded snapshot, so out-of-order events converge.
- **Reconciliation (cron, nightly):** list active subscriptions from the vendor, compare with rows,
  fix drift, log mismatches with counts. Also expire `grace_until` and flip `past_due` to `unpaid`.
- **Entitlement check:** `entitled(user, feature)` in `lib/billing.ts` reads the row and the grace
  window; used by server components and actions; never by client code.
- **Dunning:** the vendor's smart retry schedule plus its emails; the app adds an in-app banner for
  `past_due` and a grace window (recommended 7 days).
- **Cancel:** always at period end by default; the portal and the app both show the date. Immediate
  cancel with proration only via support.
- **Refunds and disputes:** webhook-driven; a dispute sets status to `unpaid` immediately and the
  event is flagged for a human.
- **Trials:** card-up-front trial if used; the `trialing` status is entitled; "trial ending" webhook
  triggers a reminder email three days before.

### Payouts to traders (when approved)
- Use the vendor's connected-accounts product so traders onboard with hosted identity and tax forms
  and the app never holds funds (POLICY: never hold customer funds).
- Pool = a fixed share of each viewer's subscription; split across the traders the viewer followed
  during the period, equal-weight by days followed. No weighting by trade count, return or activity
  (DESIGN §3.4: no rewards for frequency).
- Monthly statement page per trader; payout events stored in `payouts`.

### Integration points in the app
- Viewer side: a Subscribe button where the first paid feature appears (not on profiles); an account
  page with plan, renewal date, invoices link and "Manage subscription".
- Trader side: nothing changes; the record and the share card do not mention plans.
- Feature gating: one helper, server-side; paid features render a locked state with one sentence,
  never a blurred record.
- Emails: transactional only (receipt, failed payment, trial ending), sent by the billing vendor
  where possible to keep vendors at a minimum.
- Observability: counts of events by type and processing time; alert when the inbox has unprocessed
  events older than 10 minutes or reconciliation finds more than N mismatches.

### Security and compliance
- Webhook signature verification with a rotating secret in environment variables; reject skewed
  timestamps.
- Raw body preserved for verification (framework body parsing must be bypassed on that route).
- No card data fields anywhere; the scanner blocks `card_number`, `cvv`, `cvc` and similar.
- Audit trail: `billing_events` is append-only.
- Terms, refund policy and the disclaimer on every paid analytics surface ("Not investment advice.
  Past performance does not guarantee future results.").
- The paid tier must not become advice: no "top picks", no alerts phrased as prompts to act
  ("@x just bought" is a fact; "buy now" is not allowed; POLICY F1).

### Rollout order
1. Counsel opinion on the paid features list (DESIGN §3.3 gate).
2. Schema + `lib/billing.ts` + webhook inbox + reconciliation, behind a feature flag, with tests.
3. One plan, hosted checkout and portal, in the vendor's test mode end to end.
4. The first paid feature (recommended: alerts, lowest regulatory surface).
5. Creator payouts last, after a separate counsel review.

## Out of scope
- Charging traders for anything, ever.
- Points convertible to money, paid streak saves, loot boxes (POLICY "Never").
- Building any of this before Phase 1's supply gate passes.

## Open questions
- Annual price (if any), and whether there is a free trial. The monthly price is decided ($9.99).
- Which paid feature ships first (recommended: alerts).
- Revenue-share percentage for creator payouts, and whether payouts launch with the first plan.
- Which billing vendor (named in the private checklist; must offer hosted checkout, portal, tax and
  connected-account payouts).

## Rework notes
