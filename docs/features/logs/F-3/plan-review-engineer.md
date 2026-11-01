# F-3 · Engineer's review of the implementation plan (2026-11-01)

Reviewer: engineer (team/engineer.md). Inputs: `plan.md` (UX lead's draft), `F-3-viewer-subscriptions.md`,
`committee-2026-11-01.md`, and the billing core already written (`lib/billing.ts`, `e2e/fakes/billing.ts`,
`lib/billing.test.ts`, the F-3 block of `db/schema.sql`, the F-3 lines in `lib/delete.ts`). Fixed constraints: no new
dependency (fetch only), `package.json`, `playwright.config.ts`, `.github/**`, `lib/session.ts`, `lib/broker.ts` not
editable, CI's e2e job has no `STRIPE_*` env, follows tables are read only through `lib/follows.ts`.

## Verdict: DO NOT SIGN as written. I sign once demands D1 to D16 are taken into the plan.

The direction is right and the copy is good. It is buildable as one PR, but not at its current size, and the billing
core has one confirmed deadlock and three money bugs that must be fixed before any UI sits on top of it.

## Positions

### P1. Size
The billing core already written is about 1,150 lines (lib 470, fake 270, tests 416). The plan as drafted adds roughly
2,000 more: webhook route, checkout and portal actions, disclosure module, `lib/record-tools.ts`, `/tools` in four
states, `/account` in seven states with polling, export, copy, CSS, settings, the F-1 consent change, and about 25 e2e
cases. That is far past the 400-line rule for a reviewable change. With the cuts below the remaining build is about
1,300 to 1,500 lines. I would rather ship two PRs (A: billing + Subscribe + `/account` + export; B: Record tools), but
if the pipeline holds F-3 to one PR it is buildable with the cuts, as two commit stages in that order, A green first.

### P2. Section 0 (points to settle)
- 0.1 Frozen line: agree, as one `recordStateLine()` helper used by the profile and the cards (about 15 lines). K2
  requires the state where the profile shows it, and TR-5 makes the profile line a Must anyway.
- 0.2 Notes and U1: agree with the reasoning; it is the owner's call. Build K5 (no moderation) and record the question.
- 0.3 Period: agree, use the profile's line.
- 0.4 AC7 email: agree; the unit test is "lib/billing.ts and app/tools, app/account import no mail module".

### P3. Next.js specifics checked in `node_modules/next/dist/docs`
- Webhook route handler: `await req.text()` gives the raw body (route.md); the body can be read only once, so verify
  on that string and parse it yourself. `export const dynamic = 'force-dynamic'`, Node runtime.
- `redirect()` accepts absolute URLs and may send to an external site (redirect.md): checkout and portal actions can
  `redirect(url)` after the vendor call (call `redirect` outside any try/catch, it throws by design).
- `robots: { index: false, follow: false }` in each page's `metadata` emits the meta tag; `X-Robots-Tag` and
  `Referrer-Policy` go in `next.config.ts` `headers()` (editable; it already sets frame headers) for `/tools`,
  `/tools/:path*`, `/account`, `/account/:path*`.
- `Cache-Control`: Next sets its own value on dynamic pages (`private, no-cache, no-store, max-age=0,
  must-revalidate`) and may override a `headers()` entry. Do not fight it: the test asserts the header contains both
  `private` and `no-store`, not an exact string. The export route sets its own header and Next keeps it.

### P4. e2e under CI without `STRIPE_*`
Every spec that needs the fake processor (checkout redirect, portal, activating to confirmed) runs only when the server
has billing env and `test.skip`s otherwise, so in CI it never runs. Those behaviours must therefore be proven in unit
tests against the fake (they mostly are already). e2e in CI covers what a row inserted directly can prove: entitled,
past_due, cancel-scheduled, lapsed and trader states, the locked page, headers, 404s, disclaimer, Subscribe block
order and weights, export, and the public pages unchanged. The "subscribe" e2e may not fail when skipped.

## Demands (numbered; each must be in the plan before I sign)

Billing core (lib/billing.ts)
- **D1. Fix the webhook deadlock (confirmed bug).** `handleWebhook` holds a pool connection in `sql.begin` (with a row
  lock) while `applyEvent` runs its queries on the global `sql` and makes vendor calls of up to 20 s. postgres.js
  defaults to 10 connections: with 10 or more concurrent deliveries every connection is a waiting transaction and the
  inner queries queue forever. Probe (scratch, not committed): 8 concurrent distinct events finish, 12 hang past 15 s.
  The load test passes only because it uses 8 workers. Fix: no transaction across vendor calls. Insert the event
  (`on conflict do nothing`), apply (each apply is already idempotent: it fetches the object fresh and upserts), then
  `update ... set processed_at = now() where processed_at is null`. Concurrent duplicates may both apply, which is safe.
  Raise the load test to 32 workers so this cannot regress.
- **D2. A dispute must stop future charges.** `applyDispute` sets the row `unpaid` locally, but the processor
  subscription stays active and keeps renewing, so a person with access switched off is charged again next period.
  Cancel the subscription at the processor on `charge.dispute.created` (no refund; the dispute settles the money);
  `dispute_won` then needs nothing restored (condition 19: resuming goes through Subscribe again).
- **D3. Grace expiry must end the processor subscription.** When grace runs out (in `desiredRow` or in reconcile's
  bulk update) the row becomes `unpaid` locally while the processor may still be retrying. The person can then
  subscribe again (`startCheckout` only checks live statuses), and if the old invoice later succeeds the upsert hits
  `subscriptions_one_live`, the webhook returns 500 forever and the person pays twice. Fix: when the app moves a row to
  `unpaid` after grace, cancel at the processor (condition 19: "the subscription ends with no carried-over debt");
  `startCheckout` also refuses while any row for the user is not `canceled` and the processor still reports it live.
  Owner dashboard step (plan §13.5): retries end in "cancel", not "mark unpaid".
- **D4. Refund then cancel is not safely retryable.** `cancelWithRefund` refunds first, then deletes the subscription.
  If the delete fails and the retry comes after the processor's idempotency-key window (24 h), it refunds again or
  fails forever with "amount exceeds refundable". Cancel first, then refund only when the charge's `amount_refunded`
  is still 0.
- **D5. The 14-day yearly refund is measured at processing time.** `applyRefundPolicy` uses `now`, so a cancel request
  made on day 13 whose webhook is retried, or first seen by reconcile, on day 15 loses its refund. Use the processor
  subscription's `canceled_at` (set when cancel-at-period-end is requested) as the request time.
- **D6. Pin the processor API version.** `vendor()` sends no `Stripe-Version`, so object shapes follow the account
  default. The code reads both old and new shapes, but on newer versions `invoice.payments` is returned only when
  expanded, so `pi` is null and the trader and 14-day refunds silently do nothing. Send one pinned version header, read
  only that shape, add `expand[]` where needed, and make the fake return exactly that shape.
- **D7. Unknown customer or price: ignore and flag, not 500.** A subscription created outside the app (dashboard, a
  shared test account) gives `unknown_customer` / `unknown_price` and a 500 on every retry for days, which can get the
  endpoint disabled. Store the event, set `flagged`, return 200 `ignored`. Same in reconcile (count, do not fail).
- **D8. Reconcile lists every canceled subscription forever** (`status: 'all'`, then skips canceled ones). Drop
  `status: 'all'` (the default list excludes canceled). `tradersCanceled` counts any canceled row among the pre-listed
  ids; fine as a count, label it as such.
- **D9. Cancel a subscriber who connects a broker at once, not at the next reconcile** (condition 14 says "at once").
  Export `cancelIfTrader(userId)` from `lib/billing.ts` and call it from the consent step in `app/connect/**`, in
  try/catch, never blocking the connect flow; reconcile stays the backstop.
- **D10. Checkout inputs come from the server only.** The return URLs use the configured site URL (`siteUrl` in
  `lib/ticker.ts`), never the request's Host header (an injected Host would send people to another site after
  paying). The disclosure text hashed into the consent record is built on the server from `lib/billing-disclosure.ts`
  for the chosen plan, never posted by the form. `cancel_url` is `/tools#subscribe` as the plan says.

Scope cuts and simplifications
- **D11. Subscribe block: two forms, no radios, no `:has()`.** One form per plan, each with its plan line, renewal
  line, its own unchecked `agreed` checkbox and its button; the shared lines (what you get, no trial, cancel, refund,
  card line, disclaimer) sit above both. Nothing is preselected by construction, nothing depends on CSS state, and
  the server checks `agreed === 'on'` for the plan named by the submitted form. The disclosure hash covers the shared
  lines plus that plan's form text. Same weight rule: `Not now` uses the Subscribe button's class.
- **D12. Cut from this PR:** the F-1 consent line (K24 gates live billing, not test mode; it goes on
  `live-billing-checklist.md`), the `/me/following` entry link (one entry point in `/settings` is enough), subgrid
  column alignment at 720 px (stacked cards at every width, or a plain equal-width grid), the live character counter
  (static "Up to 2,000 characters" plus `maxlength` and the server check), the clock-mocked 60 s e2e (unit-test the
  timeout decision; the activating poller is one small client component that calls `router.refresh()` every 2 s and
  stops at 60 s).
- **D13. Delete-view confirm uses `<details>`,** not `&confirm=1` in the URL. Move up / down and Remove are plain
  server-action forms; after each, focus goes to the status line (`tabIndex=-1`, focused on render) that names the
  change. That is one rule for every action and needs no per-button focus tracking; I accept it as meeting 2.4.3.
- **D14. Positions are derived, not trusted.** Account deletion removes `record_view_traders` rows and leaves gaps
  (1, 3, 4). Cards render `{i} of {n}` from `order by position`, and every reorder rewrites positions 1..n in one
  statement. Unit test with a gap.

Tests
- **D15. Test fixes.** (a) The 404 test compares a missing view with someone else's view for the same viewer (signed
  in) and again signed out; it does not compare signed-in with signed-out pages, whose nav differs. (b) The public-page
  "unchanged" test compares HTML of `/u/<demo>`, a `/t/` page and `/` for signed-out vs. subscriber vs. lapsed, with
  the viewer-specific nav stripped; drop the OG-bytes comparison (the share card never reads the viewer). (c) "Card
  values equal the profile's" is a unit test that calls `stats`, `confidence`, `evidenceLine`, `rangeText` on the same
  rows and compares with `lib/record-tools.ts` output. (d) Follow-list options come from `lib/follows.ts`
  (`ownLists(viewer).following`, sorted by handle in `lib/record-tools.ts`), so `lib/follows.test.ts` keeps passing.
- **D16. Wire the nightly job into the existing hourly `POST /api/sync`,** not a new cron (the workflows are not
  editable and `vercel.json` has none): `reconcile()` runs inside its own try/catch when billing is configured, at
  most once per UTC day (skip unless the hour is 03), and never fails the sync response. Plan §13.3 becomes "no
  owner action needed".

## Concrete file list
New
- `app/api/billing/webhook/route.ts`: raw body, `handleWebhook`, 503 when billing is not configured.
- `app/tools/page.tsx`: locked, entitled, lapsed, one view (`?view=<uuid>`), metadata robots.
- `app/tools/actions.ts`: create, rename, delete view; add (exact handle or follow list), move, remove trader; save and
  delete note; subscribe (checkout redirect). Every action checks ownership on the server.
- `app/tools/activating.tsx`: the only client component (poller).
- `app/account/page.tsx`, `app/account/actions.ts` (portal redirect), `app/account/export/route.ts`.
- `lib/record-tools.ts`: views, notes, ordering, card figures through the profile's functions, follow list through
  `lib/follows.ts`, notice counter read-and-reset.
- `lib/billing-disclosure.ts`: versioned disclosure text and its builder.
- `lib/record-tools.test.ts`, `e2e/tools.spec.ts`, `e2e/billing.spec.ts` (the latter skips without billing env).

Changed
- `lib/billing.ts` (D1 to D10), `lib/billing.test.ts` (tests for D1 to D9; load test at 32 workers),
  `e2e/fakes/billing.ts` (pinned shape, `canceled_at`, dispute cancels).
- `lib/copy.ts` + `lib/copy.test.ts` (`RECORD_TOOLS`, `BILLING`, banned words), `app/globals.css` (cards, disclaimer,
  test badge; existing tokens only).
- `app/settings/**` (entry links; two delete-screen lines), `app/u/[handle]/page.tsx` (`recordStateLine` only),
  `app/connect/**` (D9 call), `app/api/sync/route.ts` (D16), `next.config.ts` (headers), `lib/delete.ts` (done).
- `scripts/compliance.ts` is protected: the card/PII column scan stays in `lib/billing.test.ts` (already there).
- `db/schema.sql`: no change beyond the block already written.

Not touched: `package.json`, `playwright.config.ts`, `.github/**`, `lib/session.ts`, `lib/broker.ts`, `app/sitemap.ts`
(it lists symbols only, so `/tools` and `/account` are already absent; a unit test asserts it).

## Round 2 (2026-11-01): SIGN

I re-read `plan-round2.md`, `lib/billing.ts` (547 lines), `lib/record-tools.ts`, `app/connect/actions.ts` and
`app/api/sync/route.ts`, and ran `lib/billing.test.ts`, `lib/record-tools.test.ts` and `lib/follows.test.ts`.

All 16 demands are resolved in the plan. In the code:
- D1: the claim lease replaces the transaction. My scratch probe, which hung at 12 concurrent deliveries in round 1,
  now finishes with 40.
- D2 to D8: fixed as described. Disputes cancel at the processor. Grace expiry cancels in reconcile, and checkout
  cancels stale processor subscriptions first. `cancelWithRefund` cancels before it refunds and checks
  `amount_refunded`. The 14-day refund uses `canceled_at`. The API version is pinned to `2024-06-20`. PERMANENT errors
  are stored, flagged and answered 200. The subscription list no longer pages through canceled ones.
- D9 and D16: each is one guarded call in the files named, and neither can block its caller.

I sign the plan. Two fixes are required in the build before the PR opens; they need no plan change:
- **E1. A test fails now.** `billing.test.ts` › "the app stores no card data…" expects the billing table list without
  `billing_runs`, which was added for D16. Add `billing_runs` to the expected list and keep the column scan over it. Do
  not loosen the test. Current run: 23 tests, 22 pass, 1 fails.
- **E2. A processor `unpaid` status is never canceled.** `desiredRow` sets `grace_until` only while the status is
  `past_due`. When the processor itself moves a subscription to `unpaid` (retries exhausted), the row has
  `grace_until = null`, so reconcile's `grace_until <= now()` query never selects it and the processor subscription is
  left open. Make reconcile cancel every `unpaid` row that is not canceled, whatever its `grace_until`. Add a unit test.

Low, fix if cheap:
- E3. `cancelWithRefund` skips the whole refund when the charge already has any refund, so an earlier partial goodwill
  refund cancels a later trader pro-rata or 14-day refund. Better: refund `min(share × paid, amount − amount_refunded)`
  under the same idempotency key.
- E4. `reconcileIfDue` records the run before it starts, so a throw skips the whole day. Acceptable, since failures
  are counted per row; log it.
- E5. The consent hash is built when the form is submitted, so a page shown before UTC midnight and submitted after
  hashes a next-charge date one day later than the one shown. Accept and record it, or carry the render date signed.
- E6. `cancel_url` is still `/tools`; the plan says `/tools#subscribe`.
- E7. In `lib/record-tools.ts`, `addTrader` checks the 4-trader cap in its insert, but two concurrent adds can both
  pass the count and make 5. Take a row lock on the view (`select … for update`) in one transaction.
  `saveNote` accepts any existing user id. Limit it to users with a public profile, or to traders in one of the owner's
  views, so notes cannot be attached to private accounts by guessing ids.
