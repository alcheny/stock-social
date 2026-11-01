## What changes

F-3 · Viewer subscriptions in the payment processor's **test mode only**, and **Record tools**, the first paid feature.
Traders never pay and never see a price.

- **Legal committee first.** A three-member committee (securities, consumer protection, privacy) reviewed Record tools'
  exact feature list over two rounds and cleared it with 25 conditions; nothing was barred. Record:
  `docs/features/logs/F-3/committee-2026-11-01.md`.
- **Billing core** (`lib/billing.ts`, the only file that talks to Stripe; REST with `fetch`, no SDK, no new dependency,
  API version pinned):
  - hosted checkout and customer portal;
  - a signature-verified, idempotent webhook inbox (`billing_events`: ids, type and status only, no payload, purged
    after 35 days);
  - entitlements read only from the app's own `subscriptions` row;
  - a 7-day grace period; disputes and full refunds end access and stop renewals;
  - the refund policy, applied automatically: no partial-month refunds on monthly; a full refund on a yearly plan
    canceled within 14 days; a pro-rata refund when a subscriber connects a broker;
  - a daily reconciliation (run once a day from the hourly sync tick, also `POST /api/billing/reconcile`);
  - account deletion cancels at the processor first and keeps only the renewal consent record (no name, email or IP)
    for 3 years.
  - A live key is refused unless `LIVE_BILLING=on`. Monthly $9.99, yearly $99.99, no trial.
- **Fake processor** in the repo (`e2e/fakes/billing.ts`): REST subset, hosted checkout and portal pages, signed
  webhooks, lifecycle controls and targeted failure injection, for unit and e2e tests.
- **Record tools** (`/tools`, `lib/record-tools.ts`):
  - compares 2 to 4 traders in the viewer's chosen order, with the profile's own figures from the same functions;
  - each record's 95% range, with its lower end shown inside the range row;
  - losses shown as signed text, like gains;
  - no sorting by any number, no highlight, no verdict, no open positions;
  - saved views (owner-only random ids, the same 404 for a missing and a foreign view) and private notes (2,000
    characters, folded on cards);
  - nothing shareable: noindex, no referrer, `private, no-store`, no share UI, no sitemap entry;
  - the disclaimer on every surface;
  - after a lapse, views and notes stay readable, editable and downloadable; only the comparison locks.
- **Account page** (`/account`): plan, renewal or end date, past-due grace date, "Manage subscription" and "Cancel
  subscription" (hosted portal), "Download my data" (`/account/export`, JSON), and the test-mode label. Traders see only
  "Record tools is included".
- **Shared files, additive only:**
  - `db/schema.sql`: an F-3 block, appended and idempotent;
  - `lib/copy.ts`: `RECORD_TOOLS` and `BILLING`;
  - `app/globals.css`: an F-3 block.
- **Small guarded hooks in files other sessions own.** Each is one call in a block named for F-3, flagged for the merge
  order:
  - `lib/delete.ts`: Record tools rows go in the first transaction; billing ends before the account;
  - `app/connect/actions.ts`: `cancelIfTrader` after consent;
  - `app/api/sync/route.ts`: `reconcileIfDue()` (owned by Sharded sync);
  - `next.config.ts`: private headers for `/tools` and `/account` (Security hardening owns the CSP);
  - `app/settings/page.tsx`: Record tools and Account links, plus the delete screen's billing line, shown only to
    accounts that have subscribed;
  - `lib/auth/landing.ts` and the dev `login` action: "Sign in to subscribe" returns to `/tools` through a fixed-value
    cookie (no open redirect).

## Decisions taken by the committee (also appended to the feature file)
- Record tools (R1 to R11) and the billing core are cleared for test mode with 25 conditions. Paid access is never
  fresher or richer than the free record.
- Traders (a consented broker connection, connected or frozen) get Record tools included and never see a price. A
  paying subscriber who connects a broker is canceled at once with a pro-rata refund.
- No event payloads and no charge rows are kept. Only the consent record survives deletion, for 3 years.
- The processor sends every billing email; the app sends none.
- Refund line, grace and disputes as above. After a lapse, views and notes stay; a deleted trader leaves views and
  notes, and one line (naming no one) says so until dismissed.
- Implementation plan:
  - the UX lead's plan, reviewed by the business lead and the engineer (both signed in round 2):
    `plan.md`, `plan-round2.md`, `plan-review-*.md`;
  - committee user tests: `committee-review-business-lead.md`, `committee-review-ux-lead.md`;
  - QA: `qa-tester.md`;
  - owner checklist before live billing: `live-billing-checklist.md`.

## Testing
All gates were run locally on the merged branch (main at the sharded-CI merge):
- `npx tsc --noEmit`: clean.
- `npm test`: 737 tests, 725 pass, 0 fail, 12 skipped (all pre-existing skips). New: `lib/billing.test.ts` (24) and
  `lib/record-tools.test.ts` (10). They cover:
  - every lifecycle event (created, trial ending, renewed, payment failed, past due with grace, canceled at period end,
    resumed, refunded partial and full, disputed and won);
  - replay, out-of-order delivery, malformed signature, live events in test mode;
  - traders, the 14-day yearly refund, reconciliation, deletion;
  - failure injection between the refund and the cancel, duplicate subscriptions;
  - no card or personal fields in the billing tables;
  - heavy use: 32 workers with every event delivered twice. 3,000 events by default; `LOAD=1` runs 100,000 (215 s,
    no duplicates, none lost).
- `BASE_REF=main node scripts/compliance.ts auto`: no violation in the diff. The one hit is
  `node_modules/@img/sharp-wasm32`, which this container's `npm ci` installs; no package file changed.
- `node scripts/autopilot.ts guard origin/main`: ok.
- `npm run build`: ok.
- `npx playwright test` (the whole suite, server with the fake-processor env): 132 passed, 3 skipped (pre-existing).
  `e2e/f3-billing.spec.ts`: 9 tests, all pass with the fake processor. Without billing env (as CI runs it): 6 pass,
  3 skip and say why.
- The cycle:
  - committee user tests: compliance PASS from the business lead and the UX lead;
  - QA by the tester: no blocker;
  - independent code review: 2 blocking, both fixed with tests.
  - Every finding's resolution is in `docs/features/logs/F-3/build-resolution.md`.

## Compliance
1. **Performance:** yes. Record tools re-presents the profile's figures from the same functions (unit test), with the
   disclaimer on every surface and on the export file. Losses read like gains, and nothing ranks, sorts or highlights
   (tests). The legal committee's review stands in for counsel (POLICY owner decision 2026-11-01).
2. **Personal data:** yes.
   - New data: view names, ordered trader ids and private notes (owner-only; in the export; deleted with the account
     and when the noted trader deletes theirs); subscription rows (ids, plan, status, dates); a consent record (no IP,
     user agent, email or name; kept 3 years after deletion under the processor customer id only).
   - The processor receives an opaque HMAC reference only (test).
   - Logs hold counts and event ids only.
3. **Money:** yes, test mode only. The owner decided the prices and the vendor, and the committee cleared the build.
   Real charges stay off until the owner sets `LIVE_BILLING=on` after `live-billing-checklist.md` (Terms and Privacy
   sections, connect-consent line, processor emails, `BILLING_CONTACT`). A live key is refused without it (test).
4. **Email, push, tracking:** none added. The app sends no email (test); the processor's emails are on the owner's
   checklist. No third-party script, font or embed; the only contacts with the processor are the redirect and
   server-side calls.
5. **User text:** private notes are never published (POLICY U1 covers published text; committee K5). Stored as text and
   escaped by React (test).
6. **Accounts:** deletion cancels billing first, never blocks deletion, cascades notes and views, and the delete screen
   discloses what is kept (tests).
7. **Vendor or dependency:** the payment processor (the owner's choice), integrated in one file with `fetch`. No new
   dependency, font or asset.
8. **Accessibility:**
   - named controls ("Move @x up", "Save note about @x");
   - focus moves to the result after each action (the moved card, the error field);
   - 44 px targets; no animation; 360 px with no horizontal scroll;
   - checked by the UX lead in light and dark.
9. **Security:**
   - webhook signature verified on the raw body with timestamp tolerance, a livemode check and a claim lease;
   - bearer `CRON_SECRET` on the reconcile route;
   - owner checks on every view and note action; random view ids;
   - return URLs from the site URL only; no open redirect.
10. **Claims:** copy scanned against the promo list, the marks list and banned words (best, top, winners, beat the
    market, advice and others; test).
11. **Checkout:** price, interval, "plus applicable sales tax", next charge date, no trial, the cancel method and the
    refund line appear on the app's Subscribe screen above the button. There is a required, unchecked agreement box
    per plan. The acknowledgment is on the account page.

Committee record: `docs/features/logs/F-3/committee-2026-11-01.md`.

**For the orchestrator and owner:**
- CI has no billing env, so the fake-processor e2e tests skip there, and the unit tests cover the same behaviour. To
  run them in CI, add these to the e2e job's env (test values only):
  ```
  STRIPE_API_BASE=http://127.0.0.1:4103
  STRIPE_SECRET_KEY=sk_test_e2e
  STRIPE_WEBHOOK_SECRET=whsec_e2e
  STRIPE_PRICE_MONTHLY=price_e2e_monthly
  STRIPE_PRICE_ANNUAL=price_e2e_annual
  ```
- Pre-authorization requests are in `plan-round2.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8pHyCzwz3bBbKY2yDz
