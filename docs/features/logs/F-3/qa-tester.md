# F-3 · Tester QA log (2026-11-01)

Role: tester (`team/tester.md`). Branch `claude/f3-viewer-subscriptions`, against the running production build at
http://localhost:3000 (ALLOW_DEV_AUTH=1, billing in test mode against the in-repo fake processor on :4103). Viewport
360×740. Throwaway scripts under `/tmp/claude-0/qa/`. All `qa_%` users, their billing rows, events and handle
reservations were deleted afterwards.

Note: while this pass ran, uncommitted edits appeared in the working tree (`lib/billing.ts`, `lib/delete.ts`,
`app/tools/actions.ts`, `db/schema.sql`, `e2e/fakes/billing.ts`, `lib/billing.test.ts`; code-review fixes). The running
build does not include them. Results below are for the build that was running. H1 looks addressed by the working tree
but nobody has checked that yet.

## Checks run
- `node --test lib/billing.test.ts lib/record-tools.test.ts`: 26/26 pass (17 billing, 9 record tools).
- `LOAD=1 node --test --test-name-pattern="heavy use" lib/billing.test.ts`: 100,000 events pass in 215 s.
- `npx playwright test e2e/f3-billing.spec.ts`: 7 pass, 1 fails. The "with the fake processor" test fails with
  `EADDRINUSE 127.0.0.1:4103` because it starts its own fake on the port the running fake already holds (an
  environment problem, see L9). I ran the same flow by hand against the running fake (checkout, activation, portal
  cancel and resume) and it passed.

## Findings

### Blocker
None.

### High
**H1 · bug · A double submit or two tabs creates two paid subscriptions; the second is never canceled or refunded.**
Repro: sign in as a new viewer. Open `/tools` in two tabs. In each tab, tick the monthly box and press
"Subscribe: $9.99/month". Pay in both hosted checkouts. Result: the processor shows two `active` subscriptions for
the customer. The app keeps one row; the second subscription's events are stored with
`error_code = second_live_subscription, flagged = true`, and nothing cancels or refunds it. The viewer pays twice
every month. It gets worse: after the first subscription ends (here a dispute, which should end access),
`POST /api/billing/reconcile` adopts the orphan as `missing: 1`. The disputed viewer gets access again and is still
charged. Expected: the duplicate is canceled at once with a full refund (and checkout is refused while another
checkout session is open). The uncommitted `lib/billing.ts` change ("Code review blocking 2") cancels and refunds on
23505. It has not been tested against the running app.

### Medium
**M1 · usability · A long view name with no spaces breaks the 360 px layout.**
Repro: on `/tools`, create a view named with 60 × `a`. Then `/tools` has `scrollWidth` 617, and
`/tools?view=<id>` has 1131 (the `<h1>`). The same happens in the lapsed state. Fix: `overflow-wrap: anywhere` on
the view link and the view `<h1>`. Emoji, RTL-override, XSS and SQL-looking names render escaped and in bounds.

### Low
- **L1 · bug.** Some signed, well-formed events lack a required id: `customer.subscription.updated` with
  `data.object = {}`, or `charge.dispute.created` without `charge`. These get 500 (`vendor_404`), so the processor
  retries for days. Like D7, they should be stored, flagged and answered 200. (Only a correctly signed sender can
  trigger this.)
- **L2 · usability.** After a consent error ("Tick the box…"), `aria-invalid` lands on the right checkbox, but focus
  stays on the Subscribe button. Plan §4.9 says focus moves to the checkbox.
- **L3 · usability.** Signed out, "Sign in to subscribe" links to `/login` with no return to `/tools`. Plan §3 says
  `/login?next=/tools`.
- **L4 · spec.** Any account can be added as a card by exact handle: a viewer with no record, or the subscriber
  themself. The card shows "No closed trades yet." K1 and the AC speak of traders.
- **L5 · usability.** Several targets are under the plan's 44 px: "← All views" (20 px), the "Rename view" summary
  (23 px) and the card handle links (21 px).
- **L6 · spec.** The cancel line reads "Account → Cancel subscription", but K15 words it "Account → Manage
  subscription → Cancel". The path still works. With `BILLING_CONTACT` unset, the account page shows no billing
  contact (K17).
- **L7 · spec.** The AC9 "scanner rule" lives in `lib/billing.test.ts`, not `scripts/compliance.ts`. The 100k load
  test runs only with `LOAD=1` (it passed).
- **L8 · usability.** The note textarea has `maxlength=2000`, which counts UTF-16 units, while the server allows 2,000
  code points. A typist hits the limit at about 1,000 emoji. A stored 2,000-emoji note already exceeds the field's
  maxlength.
- **L9 · test infra.** The e2e fake-processor group always starts its own fake on :4103. It should reuse a running
  fake at `STRIPE_API_BASE` or pick a free port.

## Acceptance criteria
| AC | Result | Evidence |
|---|---|---|
| Signed-out free record, no paywall | PASS | `/`, `/u/momentum_maya` have no price or paywall words; e2e snapshot test passes |
| Trader never shown a price | PASS | Connected, frozen (`failed`) and converted traders: no price on `/tools`, `/account`, `/settings` |
| Start/change/cancel/resume, hosted | PASS | Fake checkout → activation → portal cancel → "ends on" → resume |
| Entitlement from own row | PASS | `access()` reads `subscriptions`; rows inserted directly grant access |
| Webhook verified, once, idempotent, out of order | PASS | Bad, missing or old signature and live event → 400; duplicates 200 no-op; unit tests (except L1) |
| Nightly reconciliation logs mismatches | PASS | `/api/billing/reconcile` returns counts; `reconcileIfDue` runs from `/api/sync` |
| Grace, retries, email, cancel date | PASS | `payment_failed` → `past_due`, banner "until Nov 8"; cancel shows "ends on Dec 1, 2026"; app sends no email |
| Lapse changes only paid features | PASS | Lapsed views and notes stay editable; no figures; profile snapshot test passes |
| Tax by vendor, no card data | PASS | "plus applicable sales tax"; checkout shows tax; column test (L7) |
| Lifecycle event tests | PASS | `lib/billing.test.ts` |
| 100k events/hour | PASS | 215 s |
| Test mode only | PASS | Unit test; "Test mode, no real charge" on Subscribe and `/account` |
| Comparison order, interval, lower bound, no sort, no positions | PASS | Cards keep saved order; Move first/last correct; range + "Lower end" together; no symbols; identical card classes |
| Views and notes private, export, delete, unshareable | PASS | Foreign, missing, uppercase and malformed ids → identical 404 signed in and out; headers `private, no-store`, `noindex, nofollow`, `no-referrer`; not in sitemap; no share UI |
| Disclaimer on every surface | PASS | `/tools` (all states), view, `/account`, export `disclaimer` |
| Nothing pushed | PASS | Static test; no email path |
| No symbol keying, no discovery writes, equal limits | PASS | Static test |

## Committee conditions
K1 PASS (adds go by POST; the URL carries only codes; exact match; follow list alphabetical; L4). K2 PASS (same
functions; exclusion lines; New-record label code path). K3 PASS. K4 PASS (UUID; same 404 everywhere; ownership
checked in every action). K5 PASS (2,001 refused server-side; escaped; keyed by id; no self note). K6 PASS. K7 PASS (no
profile-view counter exists). K8 PASS. K9 PASS (no handle or figure on the locked page; neither box checked; "Not now"
has the same class and 48 px height). K10 PASS. K11 PASS (keys exactly disclaimer, views, notes, subscription; no
figures). K12 PASS (when a trader deletes their account: their notes go and they leave every view; one line naming
no one stays until OK; a frozen trader's note stays). K13 PASS. K14 PASS (no customer row; converted subscriber
canceled with a 998¢ pro-rata refund; account line shown). K15 PASS except L6 wording. K16 PASS (consent row: plan,
version, 64-hex hash, livemode, no PII). K17 PASS except no contact without `BILLING_CONTACT` (L6). K18 PASS ("Cancel
subscription" button → portal; a yearly plan canceled within 14 days refunded 9,999¢ automatically). K19 PASS (a
dispute sets `unpaid`, then `canceled`, flagged; a full refund ends access), but H1 lets an orphan subscription bring
access back. K20 PASS (deletion: processor subscription canceled and refunded, customer deleted, app rows gone,
consent kept with `user_id` null and `retain_until` set). K21 PASS. K22 PASS (opaque `ss_` reference; e2e asserts no
handle or email sent). K23 PASS. K24 deferred to the live checklist (by design). K25 PASS (no link-outs).

Keyboard: every control on the locked, list and view pages is reachable in visual order. Accessible names are
present ("Move @h up", "Remove @h from this view", "Save note about @h"). Subscribe works with Space then Tab then
Enter. After an action, focus moves to the status line.
