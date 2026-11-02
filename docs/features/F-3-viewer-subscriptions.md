# F-3 · Viewer subscriptions (traders never pay)

Status: built

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
- 2026-10-26: An annual plan at $99.99 a year sits beside the monthly one. Why: the owner's decision; it is
  about ten months' price for twelve, in line with comparable annual plans ($90 to $100).
- 2026-10-26: No creator payouts for now: traders are neither charged nor paid. Why: the owner's decision;
  payouts also need counsel first (POLICY F5). The connected-accounts design below stays as the future
  shape, and the billing vendor chosen must not rule it out.
- 2026-11-01: The first paid feature is "Record tools": viewers compare traders side by side, save views and keep
  private notes, all pull-only (nothing is ever pushed to them). No free trial at launch. It is built only after
  the legal committee reviews its exact feature list (in place of a written securities opinion, POLICY owner
  decision 2026-11-01). Why: the owner adopted the legal committee's recommendation; event alerts are barred by
  POLICY F3b.
- 2026-11-01: The billing vendor is the payment processor recommended in the owner's private billing proposal:
  hosted checkout and customer portal, sales-tax handling, and a connected-accounts product for creator payouts
  later. It is named in the repo once the integration is built (POLICY T1). Why: the owner's choice.
- 2026-11-01: F-3 is ready: the pipeline builds billing and Record tools in the vendor's test mode only. Charging
  real money waits for the Privacy Policy and Terms (POLICY P6) and the data vendor's market-data answer for
  Record tools' open-position values; the owner switches it on. Why: the owner's decision.
- 2026-11-01: The legal committee cleared Record tools (R1 to R11) and the billing core for the processor's test mode,
  with the 25 conditions in `docs/features/logs/F-3/committee-2026-11-01.md`; nothing is barred. Why: decided by the committee under the owner's instruction of 2026-11-01; Record tools stays
  within the publisher's exclusion so long as paid access is never fresher or richer than the free record.
- 2026-11-01: Traders (a consented broker connection, connected or frozen) get Record tools included and never see a
  price; a paying subscriber who connects a broker is canceled at once with an automatic pro-rata refund. Why: decided by the committee under the owner's instruction of 2026-11-01; traders
  are never charged (F5), and it depends on nothing but the bare connection.
- 2026-11-01: The app keeps no event payloads and no charge rows: `billing_events` holds ids, type and status and is
  purged after 35 days; only the renewal consent record (no IP, email or name) survives account deletion, for 3 years,
  under the processor customer id. Why: decided by the committee under the owner's instruction of 2026-11-01; minimization; the processor is the record holder for charges and tax.
- 2026-11-01: The processor sends every billing email; the app sends none. Why: decided by the committee under the owner's instruction of 2026-11-01; it keeps the app free of any email
  channel trader content could reach (F3b); the owner checks the processor's emails before live billing.
- 2026-11-01: Refunds: no refunds for partial months on monthly plans; a full refund on a yearly plan canceled within 14
  days of purchase or renewal (applied automatically); refunds required by law are always given. Grace after a failed
  renewal is 7 days; a dispute or a full refund ends access at once. Why: decided by the committee under the owner's instruction of 2026-11-01; the consumer-protection member's recommendation.
- 2026-11-01: After a lapse, saved views and notes stay readable, editable, exportable and deletable; only the
  comparison locks. When a trader deletes their account, notes about them go and they leave every view; the subscriber
  sees one line naming no one on the next visit. Why: decided by the committee under the owner's instruction of 2026-11-01; a person's own data is never held behind the paywall, and
  nothing is pushed (F3b).
- 2026-11-01: Refunds (Terms draft option; the owner approves the final text, POLICY H): cancel any time,
  self-serve, effective at period end. A full refund on request within 14 days of the first charge (monthly or
  annual) and of each annual renewal. Otherwise no partial refunds, except pro-rata when a paid feature or the
  service is discontinued, for billing errors, for a charge after a cancellation the app failed to apply, and where
  law requires. Stated at checkout; never called "risk-free". Why: decided by the idea board under the owner's
  instruction of 2026-11-01.
- 2026-11-01: Price-change notice (Terms draft option; the owner approves the final text, POLICY H): an email sent
  25 to 30 days before the change takes effect, never more than 30 or fewer than 7 (California's window), applied
  only from the next renewal, with old and new price, effective date and a cancel link, and no record fields
  (F3b). Annual renewal reminders are a separate email 30-40 days before renewal. Why: decided by the idea board
  under the owner's instruction of 2026-11-01.
- 2026-11-01: Failed-payment grace (Terms draft option; the owner approves the final text, POLICY H): 7 days of
  access with an in-app banner while the vendor retries for up to about 14 days in all; then paid features switch
  off and the subscription becomes `unpaid`. No late fees, no back-billing, no charge for grace days on cancel; a
  lapse never touches the record; a new subscription goes through checkout again. Why: decided by the idea board
  under the owner's instruction of 2026-11-01.
- 2026-11-01: Creator payouts start only when all of these hold: the week-8 gates passed and measured retention
  shows supply is the bottleneck; 3 months of positive contribution margin after all costs; at least 500 paying
  viewers; an AI legal finding on the exact formula, then the attorney review; a formula never based on returns,
  trade count, views or activity; payee MFA, identity and tax checks through the processor, no funds held;
  anti-sybil rules and clawback; a working report and appeal process; amount-only statements with no per-viewer
  data; Terms banning paid promotion and trading against one's record; a share that keeps break-even below measured
  conversion. The owner starts them. Why: decided by the idea board under the owner's instruction of 2026-11-01.
- 2026-11-01: The Subscribe screen's refund line and the automatic refunds follow the idea board's refund decision above
  (a full refund within 14 days of the first charge, monthly or yearly, and of each yearly renewal; canceling in that
  window is the request), replacing the narrower line the legal committee first recorded. Why: decided by the
  committee under the owner's instruction of 2026-11-01; the screen, the Terms and the acknowledgment must state one
  policy (committee condition 15), and the idea board's is the more protective of the two.
- 2026-11-02: The owner accepted OD 2.47 en bloc: `LIVE_BILLING` stays off until the week-8 gates pass and the
  checklist plus the C4-41 line hold; the checkout conditions (unchecked box, no preselected plan, reminder 30-40 days
  before renewal, no trial); a connected trader never sees a price, with one plain line; no pricing tests now; the
  priced notify-me test runs with "nothing is charged now"; no creator payouts for now. OD 2.62: the Terms ban selling
  signals or paid access through a profile, thesis or card, and the licensed-user question is asked at connect (F-38).
  Why: the owner's decisions of 2026-11-02 (accepted en bloc).

## What viewers pay for (candidates; each needs the legal committee's review before build)
Decided 2026-11-01: Record tools ships first. Alerts are barred by POLICY F3b, and paid follow or watchlist
limits are ruled out (legal committee); the list below is kept as the original brainstorm.

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
- [ ] Billing runs in the vendor's test mode only: the app refuses a live key unless the owner's switch
      `LIVE_BILLING=on` is set (test).
- [ ] Record tools compares traders in the viewer's chosen order with each record's interval and lower
      bound, losses shown like gains; no sorting by return or lower bound, no highlight, verdict or "who to
      follow"; identical for every subscriber; no list of open positions.
- [ ] Record tools' saved views and private notes are visible only to their owner, included in export and
      deleted with the account; nothing in Record tools is shareable (no permalink, share image or button;
      noindex).
- [ ] Every Record tools surface carries "Not investment advice. Past performance does not guarantee
      future results."
- [ ] No message whose content or timing comes from trader content is sent by any channel (POLICY F3b);
      billing emails carry no handle, symbol, return or record field (test).
- [ ] No entitlement check is keyed by a symbol or sits under `app/t/**`; no Record tools action writes
      `discovery_events`; follow and watchlist limits are the same for every viewer (tests).

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
5. **Nothing paid touches the record.** Paid features are additive layers (Record tools first). The
   record and the share card are untouched by plan state.

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
- The paid tier must not become advice: no "top picks", no verdicts, nothing pushed (POLICY F1, F3b).

### Rollout order
1. The legal committee's review of Record tools' exact feature list (in place of counsel, POLICY owner
   decision 2026-11-01).
2. Schema + `lib/billing.ts` + webhook inbox + reconciliation, behind a feature flag, with tests.
3. Monthly and annual plans, hosted checkout and portal, in the vendor's test mode end to end.
4. Record tools, the first paid feature (decided 2026-11-01).
5. Creator payouts last, after a separate counsel review.

## Out of scope
- Charging traders for anything, ever.
- Points convertible to money, paid streak saves, loot boxes (POLICY "Never").
- Building any of this before Phase 1's supply gate passes.

## Open questions
- When creator payouts start, and their share (none for now, decided 2026-10-26; needs counsel first).
- Idea board 2026-11-01 (idea 1): Out of scope still says "Building any of this before Phase 1's supply gate
  passes" and Why still says billing waits on a counsel opinion, against "F-3 is ready". Proposed: build in test
  mode; LIVE_BILLING only after the week-8 gates pass and 30 traders have a Moderate record; reword both lines.
- Idea board 2026-11-01 (idea 1): checkout conditions proposed: price, interval, auto-renew, next charge date,
  cancel method and tax beside an unchecked box, no plan preselected; acknowledgment email; annual reminder 30-40
  days before renewal; monthly plans get the annual notice and a notice 25-40 days before months 12, 24 and 36;
  savings copy "about 17%"; no trial flow; no price on profiles or outside-link landings; a Demo-trader preview.
- Idea board 2026-11-01 (idea 1): a connected trader can never be shown a price, so can't buy Record tools.
  Confirm, or change; if kept, one plain line tells the trader. Finance would test a trial after launch.
- Idea board 2026-11-01 (idea 2): Terms say traders are not paid and ban selling signals or paid access through a
  profile, thesis or card; moderation covers handles and display names; track the win/loss mix of supply.
- Idea board 2026-11-01 (idea 3): run an in-app priced notify-me control ("nothing is charged now") before building
  beyond two records side by side; saved views store only the viewer's own list and order; unrealized values only
  as an aggregate; no benchmark, no paid "similar traders", no return-sorted or bulk export; rate limits.
- Idea board 2026-11-01 (idea 4): full-page redirect only, no vendor script on app pages; the processor's written
  confirmation that the business is allowed before the integration build; data-processing terms; one-click cancel;
  dispute alarm at 0.75%; descriptor after name clearance; run the 100,000-event load test only before live billing.

## Rework notes

## Build log
- 2026-11-01: Merged to main in #36 (bfed56c) by the orchestrator session; Status set to built (the pipeline sets it in its own PRs; interactive builds did not), so the feature pipeline does not pick it up as ready again. Waiting for the owner to try it.
