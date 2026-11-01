# F-3 · Legal committee review of Record tools and billing (2026-11-01)

The legal committee's review of Record tools' exact feature list, in place of a written securities opinion (POLICY,
owner decision 2026-11-01; F-3 decision 2026-11-01). Three members, each a subagent with fresh context: securities,
consumer protection, privacy. Input: `record-tools-proposal.md` (R1 to R11, Q1 to Q8). Two rounds: independent
positions, then each member read the other two and voted on the conflicts (C1 to C8). Where the members differed, the
verdict takes the majority or the merged option all three accepted. This is AI analysis, not legal advice; the owner
carries the risk of having no licensed attorney's written opinion.

## Verdict

**Cleared to build, with the conditions below: R1 to R11 and the billing core, in the processor's test mode only.
Nothing is DO NOT BUILD.** Overall securities finding: Record tools stays within the publisher's exclusion (impersonal,
bona fide, general and regular circulation); charging for it does not change that so long as paid access is never
fresher or richer than the free record and the product is never marketed with performance figures.

### Conditions (rules for the build; each has a test or a check)
Record tools
1. **Compare (R1).** 2 to 4 traders in the subscriber's chosen order (added order; Move up / Move down, keyboard
   operable with accessible names). Handles are added by POST or server action, never in a URL query, never logged.
   Exact handle, or the subscriber's own follow list; any suggestion list is alphabetical only, never ordered or
   filtered by a record number.
2. **Numbers (R2).** Only what the public profile shows, from the same functions (`stats`, `confidence`,
   `evidenceLine`, `rangeText`), read from the same tables at the same time; no paid-only metric, no fresher cache.
   The lower bound is shown only next to the full range. Add the profile's record state (frozen, disconnected) and
   the TR-7 "new record" label. No open positions (E5).
3. **No ranking (R3).** No sort by any number, no highlight, color scale, "best", verdict, winner, "who to follow" or
   summary sentence; no cross-trader computed figure (no difference column, no combined portfolio, no "changes since
   your last visit"). Per-cell gain/loss styling as on the profile; nothing emphasizes one column over another.
4. **Saved views (R4).** Name, ordered traders and times only; never a snapshot of numbers (reopening recomputes).
   Up to 20 views of 4 traders. Owner-only id in the URL: random (UUID), never sequential; a missing view and someone
   else's view give the same 404, signed in or out; names and handles never in the URL; every action checks
   ownership on the server; the id is never logged next to a user id.
5. **Private notes (R5).** One note per trader per subscriber, 2,000 characters (server-enforced), rendered escaped.
   Never published, summarized, analyzed, tagged, scored, moderated or read by ranking or discovery code; never in
   logs, errors, analytics or `discovery_events`. Keyed by trader id, never by handle.
6. **Nothing shareable (R6).** No share button, image or working permalink; `noindex, nofollow`; not in the sitemap;
   `Cache-Control: private, no-store`; `Referrer-Policy: no-referrer`; no share-card images.
7. **Nothing pushed (R7).** Record tools sends nothing by any channel (F3b). Record tools loads never count as
   profile views or reach any trader-facing number.
8. **Disclaimer (R8)** on every Record tools surface, the locked page, the Subscribe screen, the account page and the
   export file, with links to Terms, Privacy and How records are calculated.
9. **Locked page and Subscribe screen (R9).** They describe a tool for viewing public records: no handle, return,
   chart or example record, never "best", "top", "winners", "beat the market" or a promised result. No countdown,
   scarcity or confirm-shaming; "Not now" has the same visual weight as Subscribe; no plan preselected. The disclosure
   block (below) is shown in full above the button, never collapsed.
10. **Lapse (C5).** After a lapse view names, handles and note text stay readable, editable, exportable and
    deletable; only the comparison table locks, and the lapsed state shows no performance figures. Resubscribing
    restores everything. Data is never held to pressure a renewal.
11. **Export and deletion (R10).** "Download my data" works for every signed-in user, paid or not. The file holds
    exactly: views (name, ordered handles, created and updated times), notes (trader handle, text, updated time),
    subscription (plan, status, period end, cancel at period end) and the disclaimer; no performance figures. A
    trader's own export never includes other users' notes about them.
12. **A trader deletes their account (Q3, C4).** Notes naming them are deleted and they leave every view (cascade,
    in `deleteProfile`'s first transaction). Nothing is sent. The page says so in advance, and the subscriber sees one
    line the next time they open Record tools, naming no one: "A trader in your views or notes deleted their
    account; they and your note were removed." (a counter, no trader id kept). A frozen trader's notes stay.
13. **Symbols and discovery (R11).** No entitlement check keyed by a symbol or under `app/t/**`; no Record tools
    action writes `discovery_events`; follow and watchlist limits are the same for every viewer.

Traders (Q1, C3)
14. **Option (a).** A user with a consented broker connection, connected or frozen, has Record tools included at no
    charge and never sees a price, plan, checkout or card form. It depends on nothing but the bare connection (never
    trade count, returns or activity). Traders never become processor customers through it (no `billing_customers`
    row). A paying subscriber who later connects a broker is canceled at once with an automatic pro-rata refund; the
    processor's cancellation and refund emails are the notice, plus an in-app line on the account page.

Billing
15. **Disclosures (Q5, C6, C7).** On the app's Subscribe screen, above the button: what Record tools does and that
    trader records stay free to view without a subscription; the two plans, neither preselected, each "plus
    applicable sales tax"; "No free trial. You are charged today."; the renewal line with the interval, price and
    next charge date; the cancel line (Account → Manage subscription → Cancel; takes effect at the end of the paid
    period; access until that date, no further charge); the refund line "Monthly plans: no refunds for partial months.
    Yearly plans: full refund if you cancel within 14 days of purchase or of a renewal. Refunds required by law are
    always given."; that card details are entered on the processor's page and Stock Social never sees the card number;
    the disclaimer and links; a required, unchecked checkbox "I agree my subscription renews automatically at [$X] per
    [interval] plus tax until I cancel."; the button "Subscribe: $9.99/month" or "$99.99/year". The hosted checkout
    shows the total with tax before payment.
16. **Consent record (C7).** Per checkout: user (nulled at deletion), processor customer id, plan, disclosure version
    and the hash of the full text shown, livemode, time; no IP, user agent, email or name. Disclosure text versions
    live in the repo so the hash resolves. Kept 3 years after deletion under the processor customer id only.
17. **After purchase.** The account page confirms the plan, the renewal date and price plus tax, the cancel path and
    when it takes effect, the refund line and the billing contact (a role address only); no celebration, no upsell.
    "Activating…" polls the row; after 60 s it says activation is taking longer and never asks for payment again.
18. **Cancel (consumer extra 1, 2).** A link labeled exactly "Cancel subscription" on the account page opens the
    processor's portal; no call or chat needed; any retention offer mentions price and plan only. Plan switches go
    through the portal, which shows the new price, date and proration. The yearly 14-day refund is applied
    automatically when a yearly plan is canceled within 14 days of purchase or renewal.
19. **Grace, disputes, refunds (Q6).** Failed renewal: access kept 7 days (grace), no extra charge; when retries run
    out the subscription ends with no carried-over debt. A dispute sets `unpaid` at once and is flagged for a human;
    only paid features switch off. A full refund ends access at once; a partial refund changes nothing. Resuming after
    a lapse goes through the Subscribe screen again.
20. **Data the app keeps (Q7, C1).** `billing_events`: event id, type, object id, customer id, livemode, received,
    processed, an app error code, a flag; no payload; purged 35 days after receipt. `subscriptions`: the feature
    file's columns (plan, status, period start and end, cancel at period end, grace, dispute time); no card, name,
    email, address or tax-location field anywhere (scanner-style test). At account deletion the subscription is
    canceled at the processor first (no charge after the request; a failed call marks the account and the hourly
    retry finishes it; billing never blocks deletion), the processor customer is deleted, and every billing row goes
    except the consent records (16). The delete screen discloses what is kept.
21. **Emails (C2).** The processor sends every billing notice (receipt and acknowledgment, failed payment with the
    grace end, the yearly reminder 30 days ahead, cancellation confirmation, price change 30 days ahead). The app sends
    no billing email; before live billing the owner checks each processor email against these lines
    (`live-billing-checklist.md`). A fallback app email, if ever needed, is fixed text on account or billing events
    only, with no handle, symbol, return or record field.
22. **Checkout privacy.** The processor gets only the price id, return URLs and an opaque reference: no handle, user id,
    email or name prefill. Logs hold counts and event ids only. No third-party script, font or embed on any page.
23. **Test mode.** A live key is refused unless `LIVE_BILLING=on`; test mode shows "Test mode, no real charge". Live
    billing also waits for Terms with billing, renewal and refund sections and a Privacy Policy covering billing,
    notes and views (POLICY P6), and for the connect-consent line on paid tools (24).
24. **Before live billing (E7).** The connect consent says: "Your record may also appear in other viewers' private
    comparison tools; they cannot change it, and you are not told who views it." (F-1's screen; on the checklist.)
25. **Support and re-review (E1 to E6).** No link-outs to opening an account, an order ticket or a per-account or
    per-trade referral; nobody pays or is paid to appear; support covers billing and calculations only; no house
    account without disclosure; adding open positions, a sort, filter, screen, alert, figure export, model text about
    a trader or a per-symbol view to Record tools returns to the committee first.

## Round 1 (independent positions)
### Securities member, round 1
Overall: within the publisher's exclusion as proposed (impersonal: same output for same inputs; bona fide: disinterested, no paid placement; general and regular: re-presents records already free, not timed to market events). Price does not change the analysis; it raises two stakes: paid access must never be fresher or richer than the free record (else paid early access works like a signal), and the paid product is never marketed with performance figures (touting). No broker-dealer concern.
- R1 CLEAR WITH CONDITIONS: handle entry exact, or prefix autocomplete sorted alphabetically only; no suggestion ordered or filtered by any record number (test).
- R2 CLEAR WITH CONDITIONS: same functions as the profile (stats, confidence, evidenceLine, rangeText), same data at the same time, no fresher cache (test); the lower bound always next to the full range, never alone; add the frozen/disconnected status and the TR-7 "new record" label where the profile shows them.
- R3 CLEAR WITH CONDITIONS: also no computed cross-trader figures (no delta column, no combined "portfolio", no "changes since your last visit"); per-cell styling as the profile; nothing emphasizes one column over another (snapshot test).
- R4 CLEAR WITH CONDITIONS: a saved view stores handles, order and name only, never a snapshot of numbers; reopening recomputes.
- R5 CLEAR WITH CONDITIONS: notes never summarized, analyzed, tagged or scored, never read by ranking code (test).
- R6 CLEAR. R7 CLEAR. R11 CLEAR.
- R8 CLEAR WITH CONDITIONS: disclaimer also on the locked page, the Subscribe screen and the export file.
- R9 CLEAR WITH CONDITIONS: locked page and Subscribe screen describe a tool for viewing public records; no handle, return, chart or example record; never "find the best", "top", or promised results.
- R10 CLEAR WITH CONDITIONS: export holds view names, handles, order, notes and subscription status only, no performance figures.
- Q1 (a): included for anyone with a connection (connected or frozen); never dependent on trade count, returns, activity. Q2 keep all, add frozen status, new record, How link. Q3 no securities issue; lean no moderation. Q4 either; if an id is in the URL it is random (UUID), never sequential. Q5/Q6 defer to consumer protection. Q7 lean ids, type, status only.
- Extra: E1 no investment link-outs (account opening, order ticket, per-account or per-trade referral); E2 nobody pays to appear, and future payouts never weighted by appearances in views; E3 support copy covers billing and calculation only, no opinions on traders; E4 no house accounts without disclosure; E5 open positions stay out of Record tools (adding them returns to the committee); E6 any later sort, filter, screen, alert, figure export, model text about a trader or per-symbol view returns to the committee; E7 connect-time consent should say the record may appear in viewers' paid tools (wording to privacy and consumer protection).

### Consumer protection member, round 1
Scope: FTC Act §5, ROSCA, the negative-option rule as it now stands, state automatic-renewal laws, CAN-SPAM, refunds and disputes, A1.
- R1 CLEAR WITH CONDITIONS: Move up / Move down keyboard operable with accessible names; no copy implies Record tools finds better traders.
- R2 CLEAR WITH CONDITIONS: a test asserts every value and label equals the public profile's; no paid-only metric.
- R3 CLEAR. R6 CLEAR. R11 CLEAR.
- R4/R5 CLEAR WITH CONDITIONS: on lapse views and notes are kept (never deleted to pressure a renewal), exportable free, restored on resubscribe; notes never used in billing or marketing.
- R7 CLEAR WITH CONDITIONS: billing emails transactional only, no upsell, no handle, symbol, return or record field.
- R8 CLEAR WITH CONDITIONS: also on the Subscribe screen, with a link to the Terms' billing and refund section.
- R9 CLEAR WITH CONDITIONS: full Q5 block; no countdowns, scarcity or confirm-shaming; "Not now" has the same weight as Subscribe; no plan preselected.
- R10 CLEAR WITH CONDITIONS: Download my data works with or without a subscription; deletion first cancels at the processor (no further charges, tested); retained rows disclosed on the delete screen.
- Q1 (a); a paying subscriber who later connects a broker: paid plan canceled at once with an automatic pro-rata refund and a notice.
- Q3: delete notes when the noted trader deletes the account (a reused handle must never carry a note), one-time in-app line; no moderation (defer to privacy).
- Q4: owner-only ?view=<uuid>, 404 to everyone else, Referrer-Policy no-referrer.
- Q5 Subscribe screen: description line ("Every trader's record stays free to view without a subscription."); plan radios with neither preselected, "plus applicable sales tax"; "No free trial. You are charged today."; renewal line with the next charge date; cancel line (Account → Manage subscription → Cancel, effective at period end, access until the date, no further charge); refund line (recommend: no partial-month refunds on monthly, a full refund on yearly within 14 days of purchase or renewal); the disclaimer and links; a required unchecked checkbox "I agree my subscription renews automatically at [$X] per [interval] plus tax until I cancel."; button "Subscribe: $9.99/month". Store a consent record (user, plan, disclosure hash, time). After purchase: subscribed line, charged today incl. tax, renewal date, cancel link, refund line, billing contact; no celebration or upsell.
- Other notices: annual renewal reminder 30 days ahead; price change 30 days ahead; failed payment with the grace end; cancellation confirmation.
- Q6: 7-day grace with access and no extra charge; when retries run out the subscription ends with no carried-over debt; a dispute sets unpaid at once (only paid features switch off); a full refund ends access at once, a partial goodwill refund changes nothing; resuming after a lapse needs fresh consent.
- Q7: store an allow-list (ids, type, status, plan, amount, currency, tax, period dates); after deletion keep the consent and charge/refund rows keyed by the processor customer id for 3 years.
- Extra: cancel link labeled "Cancel subscription" on the account page, no more steps than signing up, at most one dismissible retention offer; plan switches show the new price, date and proration; WCAG 2.2 AA end to end; "Activating…" says so after 60 s and never asks to pay again; live billing waits for Terms with billing, renewal and refund sections, and test mode shows "Test mode, no real charge"; USD prices with "plus applicable sales tax".

### Privacy member, round 1
- R1 CLEAR WITH CONDITIONS: handles added by POST or server action, never in a query string.
- R2 CLEAR (only public fields). R3 CLEAR. R8 CLEAR (the Privacy link must cover billing, notes and views).
- R4 CLEAR WITH CONDITIONS (Q4 rules). R5 CLEAR WITH CONDITIONS: note text and view names never in logs, errors, analytics, discovery_events or prompts; keyed by trader_id, never handle.
- R6 CLEAR WITH CONDITIONS: Cache-Control private, no-store; Referrer-Policy no-referrer; no share-card images.
- R7 CLEAR WITH CONDITIONS: processor metadata carries an opaque reference only, no handle, user id or email.
- R9 CLEAR WITH CONDITIONS: subscription status never shown to anyone but the account holder.
- R10 CLEAR WITH CONDITIONS: export and delete work for every signed-in user, lapsed or never paid.
- R11 CLEAR, and Record tools loads never count as profile views or reach any trader-facing number.
- Q1 (a): traders never become processor customers; entitlement from connection state, no billing_customers row (test).
- Q3: cascade. Notes naming a deleted trader go, the trader leaves every view, in deleteProfile's first transaction and with on delete cascade; keyed by trader_id so a reissued handle never picks up an old note; no notice to the subscriber (F3b), the page and Privacy Policy say it ahead; no moderation; escaped, 2,000 characters on the server; a trader's own export never includes others' notes; a frozen trader's notes stay.
- Q4: owner-only random id (≥128 bits), byte-identical 404 for missing and foreign views, no names or handles in the URL, server-side ownership checks on every action (test with a second user), id never logged next to a user id.
- Q5: a line by Subscribe: payment details are entered on the processor's page; Stock Social never sees the card number.
- Q7: ids, type and status only, no payload column. billing_events: vendor_event_id, type, vendor_object_id, vendor_customer_id, livemode, received_at, processed_at, error_code (an app enum). billing_customers as in the file. subscriptions: no amount, tax or location. Purge billing_events 35 days after receipt; on account deletion delete the user's billing rows at once; the processor is the record holder for tax.
- Extra: deletion cancels the processor subscription and deletes the processor customer first, marks and retries hourly on error, never blocks deletion; logs counts only; checkout sends only the price id, return URLs and an opaque reference (no email or name prefill); export holds exactly views (name, ordered handles, times), notes (handle, text, time), subscription (plan, status, period end, cancel at period end); views and notes stay readable, exportable and deletable after a lapse; webhook verified on the raw body with timestamp tolerance, nothing logged from a rejected body; no third-party script, font or embed.

## Round 2 (each member read the other two; votes on the conflicts)
- **C1 billing data.** Securities: merged (minimal inbox; consent and charge rows kept 3 years under the processor
  customer id). Consumer: merged, mostly privacy's minimal set, plus period dates and the consent record kept 3 years.
  Privacy: merged, the same. **Decision:** minimal inbox purged after 35 days, no payload; no charge rows are kept by
  the app at all (the processor holds charges, refunds and tax), so only the consent record survives deletion.
- **C2 emails.** All three: (a), the processor sends every billing notice; a narrow fixed-text fallback only.
- **C3 a subscriber who connects a broker.** All three: (a), cancel at once with an automatic pro-rata refund.
- **C4 a deleted trader.** Consumer: no notice. Privacy: a one-time line naming no one, from a counter. Securities: a
  line shown when the subscriber opens the view (pull, not push). **Decision:** the merged line, shown on the next
  visit, naming no one.
- **C5 after a lapse.** All three: readable, editable, exportable and deletable; only the comparison locks.
- **C6 refund line.** All three accept the consumer member's line; the Subscribe screen, the Terms and the
  acknowledgment must always state the same policy, and a change applies only to later purchases.
- **C7 consent.** All three: a required unchecked checkbox and a minimal consent record; the hash covers the full text
  shown, including the disclaimer.
- **C8 objections.** Securities: "Every trader's record" is F3a completeness wording; use "Trader records stay free to
  view without a subscription."; retention offers mention price and plan only. Privacy: autocomplete prefixes by POST
  only; the billing contact is a role address; E7 wording as in condition 24. Consumer: deletion cancels first and
  no charge goes through after a deletion request.
