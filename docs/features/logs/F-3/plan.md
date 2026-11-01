# F-3 · Record tools + billing (test mode only): UX lead's implementation plan

Author: UX lead, 2026-11-01. Builds on the engineer's skeleton (routes, actions). Sources: F-3 decisions and acceptance
criteria (AC1..AC17 below, in file order), the committee's 25 conditions (K1..K25), POLICY, CLAUDE.md product rules.
Copy below is verbatim; it goes in `lib/copy.ts` as two additive blocks, `RECORD_TOOLS` and `BILLING`, added to the
banned-claims walk in `lib/copy.test.ts`. `{date}` = `toLocaleDateString('en-US', {month:'short', day:'numeric',
year:'numeric', timeZone:'UTC'})` ("Dec 1, 2026"). Reuse tokens and classes: `.page`, `.muted`, `.small`, `.badge`
(`.verified`, `.demo`, `.new`), `.up`/`.down`, `.rows`, `.button`, `.secondary`, `.wide`, `.auth`-style forms, `.sr-only`.

## 0. Points I need settled (not planned around)
1. **Frozen state (K2).** The profile today shows no frozen/disconnected wording, and K2 says tools show only what the
   profile shows. Proposal: one helper `recordStateLine()` in `lib/copy.ts` used by both the profile and Record tools:
   `Disconnected {date}. This record is frozen and stays public.` (wording from `SETTINGS.freeze`). Adding it to the
   profile is a TR-5 addition, not a paid change. Engineer and business lead to agree; else Record tools omits it.
2. **POLICY U1 vs K5.** U1 says "any other user text is moderated"; K5 says private notes are never moderated. Notes are
   never shown to anyone but their writer, so U1's purpose does not reach them. Owner to confirm in writing (§10).
3. **"Period" (R2).** The profile shows "Record since {date}", not first entry to last exit. Record tools uses the
   profile's line (K2: same wording); the evidence line already carries the span in days.
4. **AC7 "emails the viewer".** Satisfied by the processor's dunning emails (K21); the app sends none (test asserts).

## 1. Entry points (no price on profiles, trade pages, the feed or share card)
- `/settings`: new section after "Following and hidden traders": `<h2>Record tools</h2>` with two `.tap` links:
  `Record tools` → `/tools`, `Account` → `/account`. Same for traders (no price on either link).
- `/me/following` (signed-in, private): one line under the heading: `Compare traders you follow in Record tools` → `/tools`.
- The top nav is unchanged (no width at 360px; keeps the feed and profiles byte-identical: AC1/AC8 snapshot).
- Nothing in the footer, profile, `/t/**`, feed, trade pages, share card, sitemap or `robots` allow-list.

## 2. Shared pieces
- **Disclaimer block (K8)**, first thing under every `<h1>` on `/tools`, `/tools?view=`, `/account`, and in the
  Subscribe block: `<p class="rt-disclaimer"><b>Not investment advice. Past performance does not guarantee future
  results.</b></p>` + `<nav aria-label="Legal" class="rt-legal">` links `Terms` (`/terms#billing`), `Privacy`,
  `How records are calculated` (FOOTER strings), each 44px tall. The export file carries the sentence as `disclaimer`.
- **Test-mode label (K23)** when the key is a test key: `<p class="badge test">Test mode, no real charge</p>` at the
  top of the Subscribe block and of `/account`. Grey like `.badge.demo`, never red.
- **Headers (K6)** on `/tools`, `/account`, `/account/export`: `X-Robots-Tag: noindex, nofollow`, metadata robots
  noindex/nofollow, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`; titles are generic
  (`Record tools · Stock Social`, `Account · Stock Social`), never a view name. No `opengraph-image`, no share button.
- **Past-due banner (K19)**, `/tools` and `/account`, `role="alert"` once per load, `.down` left border:
  `Your last payment did not go through. You keep Record tools until {grace_until}. Update your card in Manage subscription.`
  (on `/tools` "Manage subscription" links to `/account`).

## 3. `/tools` — locked (signed out, signed-in non-subscriber who is not a trader, lapsed with no data)
360px, top to bottom: `<h1>Record tools</h1>` · disclaimer block · one sentence (R9):
`Put 2 to 4 public trader records side by side in the order you choose, save the comparison, and keep private notes only you can see.`
· `Trader records stay free to view without a subscription.` · Subscribe block (§4) in full, never collapsed.
No handle, figure, chart, sample card or blurred table anywhere (K9). Signed out: the block shows everything except the
checkbox and Subscribe button; in their place a `.button.wide.choice` link `Sign in to subscribe` (`/login?next=/tools`)
and `Not now` (same class, → `/`). Traders never reach this state (§5).

## 4. Subscribe block (`<section id="subscribe" aria-labelledby="sub-h">`, K9, K15, K22, K23)
Order (all visible, no `<details>`):
1. `<h2 id="sub-h">Subscribe to Record tools</h2>` · test-mode label · disclaimer block.
2. `What you get: side-by-side comparison of 2 to 4 public records, up to 20 saved views, and one private note per trader. Trader records stay free to view without a subscription.`
3. `<fieldset><legend>Choose a plan</legend>` two radios, `name="plan"`, **neither checked**, each a 44px label:
   `Monthly: $9.99 per month plus applicable sales tax` / `Yearly: $99.99 per year plus applicable sales tax`.
4. `No free trial. You are charged today.`
5. Renewal lines, both always shown (no JS needed): `Monthly renews automatically every month at $9.99 plus tax. If you subscribe today, the next charge is on {today+1 month}.`
   `Yearly renews automatically every year at $99.99 plus tax. If you subscribe today, the next charge is on {today+1 year}.`
6. `To cancel: Account → Manage subscription → Cancel. Canceling takes effect at the end of the paid period: you keep access until that date and are not charged again.`
7. Refund (verbatim, K15/C6): `Monthly plans: no refunds for partial months. Yearly plans: full refund if you cancel within 14 days of purchase or of a renewal. Refunds required by law are always given.`
8. `You enter your card details on the payment processor's page. Stock Social never sees your card number.`
9. Agreement + buttons, one group per plan, shown by CSS `:has(input[value=monthly]:checked)` (no plan chosen: the
   line `Choose a plan to see the agreement and the Subscribe button.` in the same box, so nothing shifts). Monthly group:
   unchecked checkbox `name="agreed" value="monthly"` labelled `I agree my subscription renews automatically at $9.99 per month plus tax until I cancel.`
   and button `Subscribe: $9.99/month`; yearly group: `... at $99.99 per year plus tax until I cancel.` / `Subscribe: $99.99/year`.
   No `required` attribute on hidden groups; the server requires `agreed === plan`, else re-render with focus on the
   checkbox and `role="alert"` `Tick the box to agree to automatic renewal.`; no plan: `Choose a plan.`
10. `Not now` (link → `/`), **same class as Subscribe** (`.button.wide.choice`: surface background, line border, text
   colour, 700 weight, 48px): equal weight by construction (K9). No countdown, scarcity, badges, "most popular".
The consent record (K16) hashes the exact rendered text of items 1–9 for the chosen plan plus the disclaimer,
`DISCLOSURE_VERSION = '2026-11-01'`; text versions live in `lib/billing-disclosure.ts`. Checkout gets price id, return
URLs (`/account?activating=1`, cancel → `/tools#subscribe`) and an opaque reference only (K22). Errors from checkout
creation: `We could not open checkout. Nothing was charged. Try again.`

## 5. `/tools` — entitled (active, trialing, past_due in grace, cancel scheduled, trader)
360px: h1 · disclaimer block · past-due banner (if any) · cancel-scheduled line (if any):
`Your subscription ends on {period_end}. Record tools stays on until then.` · trader line (traders only, no price):
`Record tools is included with your connected record.` · deleted-trader line (if counter > 0, `role="status"`, shown
once then reset, K12): `A trader in your views or notes deleted their account; they and your note were removed.`
- `<h2>Your saved views</h2>`: `.rows` list in creation order (never by a number): link `{name}` + muted
  `{n} traders` (`1 trader`), 44px rows. Empty: `No saved views yet. Create one to compare 2 to 4 traders.`
- New view form: label `Name a new view`, input `maxlength=60`, button `Create view` (opens it). Errors: `Give the view a name.`;
  at 20: form replaced by `You have 20 saved views, the maximum. Delete one to create another.`
- `<h2>Your notes</h2>` (all notes, incl. traders in no view): per note `@handle`, muted `Updated {date}`, text
  (escaped, `white-space: pre-wrap`), `Edit note` / `Delete note` (§6 note controls). Empty: `No notes yet.`
- Footer link pair: `Account` · `Download my data`.

## 6. `/tools?view=<uuid>` — one view (owner only; missing or foreign → the same `notFound()` page, K4)
360px: back link `← All views` · `<h1>{view name}</h1>` (escaped) · disclaimer block · banners as §5 ·
`<details><summary>Rename view</summary>` label `View name`, `Save name` · add-trader area · comparison · `Delete view`.
- **Add trader (K1)**, a POST form: label `Add a trader by exact handle`, `@` prefix, input (`autocapitalize=none`,
  `spellcheck=false`, `autocomplete=off`), button `Add`. Below, when the viewer follows anyone: label
  `Or choose someone you follow`, `<select>` alphabetical by handle, first option `Choose…`, button `Add`.
  Messages (`role="alert"`, focus returns to the input): unknown `No trader has that exact handle.`; duplicate
  `@{h} is already in this view.`; full: the form is replaced by `This view has 4 traders, the maximum. Remove one to add another.`
  Added: `role="status"` `@{h} added in position {i} of {n}.`
- **0 traders:** `Add 2 to 4 traders to compare.` **1 trader:** the card shows, plus `Add one more trader to compare.`
- **Comparison (K2, K3) at 360px: stacked cards**, `<ol class="rt-cards">` in the saved order, no horizontal scroll.
  ≥720px the same cards sit in equal-width columns (`grid-template-columns: repeat(n, 1fr)`, rows aligned with
  `subgrid`), still in saved order. Every card is identical in size, border (`--line`), background (`--surface`) and
  type; nothing is first-place styled, no colour scale, no difference or combined figure, no summary sentence.
  Card, top to bottom: muted `{i} of {n}` · `<h2>` link `@handle` (→ profile) + the profile's badges (Verified / Demo /
  `New record`) · state line exactly as the profile (`Record since {date} · {connectedLine or Demo data}`; importing →
  `RECORD_BODY.banner(n,false)` and no figures; failed → `RECORD_BODY.failed`; no trades → `recordBodyCopy`; frozen →
  §0.1) · `<dl>` rows in this fixed order, value right-aligned, tabular figures:
  `Closed trades` {count} · `Win rate` {n%} · `Avg return / trade` {pct, `.up`/`.down` as profile} ·
  `95% range` {rangeText} · `Lower end of range` {pct(perTrade.low)} (only when the range row exists; never alone) ·
  `Evidence` {evidenceLine} · `Max drawdown (per-trade, equal-weight)` {pct(-maxDrawdown), `.down`} ·
  `Positions excluded (no matching entry)` {count}. With no range yet both range rows are
  omitted, as on the profile, and the Evidence row says "Too early to tell". No open positions, no symbols (K2/E5).
  Signs carry the meaning (pct's `-`), colour only repeats it. Then controls: `Move up`, `Move down`, `Remove`
  (`.secondary`, 44px; first card has no Move up, last no Move down), then the note (below).
- **Note per trader (K5):** `<label>Private note about @{h} (only you can see it)</label>`, `<textarea maxlength=2000 rows=4>`,
  counter `{n} of 2,000 characters` (`aria-describedby`, not live), `Save note` → status `Note saved.`; over the
  server limit `Notes can be up to 2,000 characters.`; `Delete note` → inline confirm `Delete this note? This cannot be undone.`
  with `Delete note` / `Keep it`; done → `Note deleted.`
- **Remove / Delete view:** Remove is one tap, status `@{h} removed from this view. Your note stays.` `Delete view` →
  inline confirm `Delete "{name}"? Your notes stay.` + `Delete view` / `Keep it` (no-JS: `&confirm=1`, no names in URL).
- Record tools loads never call the profile-view counter or `discovery_events` (K7, K13).

## 7. `/tools` — lapsed (canceled, unpaid, disputed, fully refunded; K10)
Same as §5/§6 but: line `Your subscription has ended. The comparison is off; your saved views and notes stay here to read, edit, download or delete.`
Views list, rename, reorder, add/remove, delete and notes all work; each card shows only `{i} of {n}`, `@handle` link
and the note: no badge figures, no `<dl>`, no state line. Under the views: `Subscribe again` → §4 block (fresh consent).
Never shown to traders (traders are entitled). No data is removed or hidden to prompt renewal.

## 8. `/account` (signed out → `/login?next=/account`)
360px: `<h1>Account</h1>` · test-mode label · disclaimer block · banners · state body · `Download my data`
(`<a download>` → `/account/export`, help `A JSON file with your saved views, notes and subscription status.`) ·
`Record tools` link.
- **activating** (`?activating=1`, row not yet active): `role="status"` `Activating your subscription…`; polls the row
  every 2 s (text only, no spinner), up to 60 s. Timeout: `Activation is taking longer than usual. You do not need to pay again; refresh this page in a minute.`
  + `Check again` (reload). Never a Subscribe button in this state (K17). Access is granted only by the webhook row.
- **active / trialing** (K17): `Plan: Monthly, $9.99 per month plus tax` (or `Yearly, $99.99 per year plus tax`) ·
  `Renews on {period_end} at $9.99 plus tax.` · `Your receipt from the payment processor shows the total charged, including tax.`
  · cancel line (§4.6) · refund line (§4.7) · `Billing questions: {BILLING_CONTACT}` (role address from env) ·
  buttons `Manage subscription` and `Cancel subscription` (exact label, K18), both POST → hosted portal. No celebration, no upsell.
- **cancel scheduled:** `Your subscription ends on {period_end}. You keep Record tools until then and will not be charged again.`
  · `To keep it, open Manage subscription.` · `Manage subscription` only.
- **past_due in grace:** banner + active body.
- **lapsed:** `You have no active subscription. Your saved views and notes stay available to read, edit, download or delete.` · `Subscribe again` → `/tools#subscribe`.
- **never subscribed (non-trader):** `You have no subscription.` · `See Record tools` → `/tools`.
- **trader (K14):** `Record tools is included with your connected record.` No plan, price, portal or Subscribe.
  If the trader's paid plan was canceled on connect: `Your subscription was canceled when you connected a brokerage. The unused part is refunded automatically; the payment processor emails you the details.`
- Portal error: `We could not open the billing page. Nothing changed. Try again.`

## 9. Export, deletion, connect consent
- `/account/export`: `Content-Disposition: attachment; filename="stock-social-my-data.json"`, no-store. Exactly
  `{disclaimer, views:[{name, traders:[handles in order], createdAt, updatedAt}], notes:[{trader, text, updatedAt}],
  subscription:{plan, status, currentPeriodEnd, cancelAtPeriodEnd}|null}`; no figures; never others' notes (K11).
- `/settings` delete view 1 gains two lines (K12, K20) under `deleteExplain`: `If you subscribe to Record tools, deleting cancels it first; you are not charged again. We keep only the record of what you agreed to at checkout, for 3 years, without your name or email.`
  and `If you publish a record, other subscribers' private notes about you are deleted and you are removed from their saved views.`
- F-1 consent screen (K24), one added line, built now: `Your record may also appear in other viewers' private comparison tools; they cannot change it, and you are not told who views it.` (re-run the 375×667 fit test).

## 10. Accessibility (WCAG 2.2 AA)
- Names: `Move @{h} up`, `Move @{h} down`, `Remove @{h} from this view`, `Save note about @{h}`, `Delete note about @{h}`
  (visible text + `aria-label` containing it). Cards are `<li aria-labelledby="card-h-{i}">`; position text is real text.
- Focus: after Move, focus stays on the same button of the moved card (or the other arrow at an end) and a status line
  says `@{h} moved to position {i} of {n}.`; after Remove/Delete, focus goes to the view `<h1>`; after an error, to the
  field (`aria-invalid`, `aria-describedby`). All controls are native links/buttons/inputs; Tab order = visual order.
- Targets ≥44×44 (rows, radios, checkbox labels, legal links). Contrast: existing tokens only (`--muted` on `--surface` ≥4.5:1, focus ring `--accent`).
- No animation anywhere in these screens; polling changes text only (`prefers-reduced-motion` needs nothing extra).
- Reflow at 320 CSS px and 200% zoom with no horizontal scroll; `<dl>` rows wrap label over value under 340px.
- One live region per page; status text not repeated on every poll.

## 11. Test plan (unit: `node --test`; e2e: Playwright at 360×740)
| Requirement | Test |
|---|---|
| AC1, AC8, K10 public record untouched | e2e `billing.spec.ts › profile, trade page, feed, share card identical for signed-out, subscriber, lapsed` (HTML snapshot of `/u/demo`, `/t/X`, `/`, OG image bytes before/after lapse) |
| AC2, K14 trader never sees a price | e2e `tools.spec.ts › trader sees no price on /tools, /account, /settings`; unit `billing.test.ts › trader entitled, no billing_customers row`; unit `connect cancels paying subscriber with prorated refund` |
| AC3, K18 start/change/cancel/resume hosted | e2e `subscribe flow redirects to hosted checkout (mock)`; `Manage and Cancel subscription POST to portal`; unit `portal and checkout URLs come from lib/billing.ts only` |
| AC4 entitlement from own row | unit `entitled() makes no vendor call` (vendor stub throws) |
| AC5, AC10 webhook | unit `webhook.test.ts › signature, duplicate no-op, out-of-order converges, malformed signature 400, replay` + one test per recorded event: created, trial ending, renewed, payment failed, past due, canceled, resumed, refunded (full/partial), disputed |
| AC6 reconciliation | unit `reconcile logs each mismatch and fixes drift; expires grace` |
| AC7, K19 grace/cancel date | unit `past_due keeps access 7 days then unpaid`; e2e `past-due banner shows grace date`; `cancel scheduled shows end date` |
| AC9, K20 tax + no card/PII fields | unit `copy: every price says plus tax`; scanner rule `no card_number/cvv/cvc/expiry/email/address columns in schema or code` (`compliance.test.ts`) |
| AC11 100k events/hour | unit `webhook.load.test.ts › 100,000 events, 10% duplicates, shuffled: no dupes, none lost` |
| AC12, K23 test mode | unit `live key refused unless LIVE_BILLING=on`; e2e `test-mode label on Subscribe and /account` |
| AC13, K2, K3 comparison | unit `record-tools.test.ts › card values equal profile functions for same user`; `order = saved order, never sorted`; e2e snapshot `cards identical classes; no highlight; no open positions`; `lower end only beside range` |
| AC14, K4, K6 private, unshareable | e2e `foreign and missing view give byte-identical 404, signed in and out`; `headers noindex/no-store/no-referrer`; unit `sitemap excludes /tools,/account`; `view id is UUID v4`; `no share UI in /tools DOM` |
| AC15, K8 disclaimer | e2e `disclaimer + 3 links on /tools, view, /account, Subscribe block`; unit `export has disclaimer` |
| AC16, K7, K21 nothing pushed | unit `no mail/notify import under app/tools, app/account, lib/record-tools`; `billing code sends no email` |
| AC17, K13 symbols/discovery/limits | unit `no entitled() call under app/t/**` (grep test); `tools actions write no discovery_events`; `WATCH_CAP and follow limit identical for subscriber` |
| K1 add by POST, exact, follow list alphabetical | unit `addTrader exact match only`; `follow list options alphabetical`; e2e `handle never in URL`; unit `logs contain no handle/view id` |
| K5 notes | unit `2,000 limit server-side`; `rendered escaped`; `keyed by trader id; reissued handle has no note`; `ranking/discovery modules never import notes` |
| K9 locked/Subscribe copy | unit `copy.test.ts banned words incl. best/top/winners/beat the market`; e2e `no plan preselected; Not now same class as Subscribe; no handle/figure on locked page` |
| K11 export | unit `export keys exactly; trader export excludes others' notes`; e2e `lapsed user downloads` |
| K12 deleted trader | unit `deleteProfile cascades notes and view rows; counter increments`; e2e `notice line once, names no one`; `frozen trader's note stays` |
| K15, K16 disclosures + consent | e2e `all 10 Subscribe items visible above button`; unit `subscribe rejects agreed!=plan`; `consent row: no ip/ua/email/name; hash resolves to repo text` |
| K17 activating | e2e `activating then confirmation`; `after 60 s timeout text, no Subscribe button` (clock mocked) |
| K19 dispute/refund | unit `dispute → unpaid at once, flagged`; `full refund ends access; partial changes nothing` |
| K20 data kept + deletion | unit `billing_events has no payload column; purge after 35 days`; `deletion cancels at processor first; failure marks and hourly retry; deletion not blocked` |
| K22 checkout privacy | unit `checkout params = price, URLs, opaque ref only`; scanner `no third-party script/font/embed` |
| K24 consent line | e2e `connect consent shows the line; fits 375×667` |
| K25 no link-outs | unit `no account-opening/order/referral links in tools` (DOM grep); support copy review in PR |

## 12. Compliance (COMPLIANCE §1)
1. Performance: yes. Re-presents profile figures via the same functions; disclaimer on every surface; losses read like gains; no ranking (§2).
2. Personal data: yes. View names, ordered trader ids, notes (owner-only, export, cascade delete); subscription row; consent record (no IP/UA/email/name, 3 years); processor ids. Logs: counts and event ids only (§3).
3. Money: yes. Owner decided prices; committee cleared; test mode only; live waits for the owner's `LIVE_BILLING=on`, Terms and Privacy (P6) (§4).
4. Email/tracking: the app sends none; processor emails checked by the owner before live; no trackers (§5).
5. User text: private notes, never published; U1 conflict raised in §0.2 (§6).
6. Accounts: deletion now cancels billing first and cascades notes/views; delete screen discloses retention (§7).
7. Vendor/dependency: the payment processor SDK, owner-only (§8). No fonts, scripts or images from elsewhere.
8. Accessibility: §10 (§9). 9. Security: signed webhook on raw body, cron bearer secret, owner-only UUID views (§10).
10. Claims: none; copy scanned (§11). 11. Checkout: price, interval, next charge date, cancel method and acknowledgment on our pages (§4).

## 13. Pre-authorization requests (owner only)
1. Add the processor SDK dependency (package files are protected) and its license entry if needed.
2. Test-mode secrets in GitHub Actions and the deploy platform (processor secret key, webhook signing secret, monthly
   and yearly price ids, e.g. `STRIPE_*` once the integration names it), plus `BILLING_CONTACT` role address. Live keys never.
3. The nightly `/api/billing/reconcile` cron (and the 35-day purge in it) in the deploy cron config / workflow, bearer `CRON_SECRET`.
4. `db/schema.sql` additions (billing_customers, subscriptions, billing_events, billing_consents, tool_views,
   tool_view_traders, tool_notes, users.removed_trader_notice) if schema is a protected path.
5. Processor dashboard (test mode): tax on, portal cancel at period end, plan switching with proration, retention offer off or price-only, dunning emails on.
6. Confirm §0.1 (frozen line on the profile) and §0.2 (notes exempt from U1).
7. `LIVE_BILLING` stays unset; live billing waits for Terms/Privacy sections, `live-billing-checklist.md`, and the data vendor's market-data answer.
