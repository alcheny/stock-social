# F-1 · Broker connection, end to end

Status: ready

## Why
A trader signs up, connects a brokerage read-only, and lands on a clean, readable profile of their own
record in the same session. This is the first thing Phase 1 must prove (supply), so it is finished before
anything else.

## Decisions
- 2026-10-22: Finish the broker connection before any other feature. Why: the owner wants connection
  done first; supply comes before demand (DESIGN §3.1, Standing direction 1).
- 2026-10-22: "Done" for this feature means three things: a working connector for brokerages, a clean
  and intuitive UI for users, and a clear and readable profile for traders. Why: the owner's definition
  of done.
- 2026-10-22: The developer adds test cases for every feature, including edge cases and heavy use
  (large records, many accounts, repeated syncs). Why: the owner requires it; CI already fails if the
  test count drops.
- 2026-10-22: Supported brokerages on day one: the set that together covers about 95% of retail
  brokerage accounts in the launch market, as reached through the integrated vendor. Named in the
  private launch checklist, not in the repo (POLICY: no third-party names). Why: the owner's coverage target.
- 2026-10-22: Sign-in at launch: two device-native account providers (the major email provider and
  the major phone maker, named in the private checklist), a passwordless email link, and a session
  created by completing a brokerage connection. The phone maker's sign-in is included from the start
  because it is the one-tap path on its phones and is required by its app store the day a native app
  ships with any other social sign-in.
  No social networks at launch; the platforms where traders gather are served through sharing (F-4)
  and referral links, not sign-in. Why: the owner chose the provider plus email after reviewing
  coverage (the provider alone reaches roughly nine in ten US adult internet users; email reaches
  everyone) and the cost of extra buttons (lower conversion, duplicate accounts that can never connect
  the same broker account twice, TR-6). Note: the brokerage link is not an identity provider; "log in
  with brokerage" means a session created by completing a verified connection, with the claimed broker
  account as the identity key. The email link is the recovery path for every other method.
- 2026-10-22: First sync depth is zero: the connect step only validates that the brokerage is linked.
  The record is then imported at the full depth the anti-cherry-picking rules require (TR-3: the full
  history the broker provides), after the trader consents to that depth on screen. Why: validate first,
  then import with explicit consent.
- 2026-10-22: While the import runs the trader lands on their profile with a banner that updates
  ("Importing your record, N trades so far"). Why: the owner chose the banner.
- 2026-10-22: Syncing an account has no concurrency issues: a sync is an atomic operation (one
  transaction per user; a second sync for the same user waits or is skipped, never interleaves). Why:
  the owner requires it.
- 2026-10-22: Empty record copy: open positions are shown, plus "No closed trades yet. Your record
  starts with your first close." Why: the owner approved option 5.
- 2026-10-22: The connection portal is the vendor's portal embedded in the app's own page (the vendor's
  web SDK in a modal); the broker's own login opens in the popup the portal manages, so a trader with a
  live session at the broker's website is not asked for a password again where the broker allows it.
  Where a browser blocks the popup (some mobile and in-app browsers), the app falls back to the
  redirect flow that runs today. Why: the owner chose the embedded portal after reviewing the vendor's
  broker list; nearly every large retail broker uses a login handoff, so the popup gives password-free
  login wherever it is possible at all, and the fallback keeps every browser working.
- 2026-10-22: Vendor isolation stays strict so a direct integration with one or more brokers can be
  added later without touching the trade math: one file per vendor, raw payloads stored, broker
  account IDs as the identity key. Why: the owner wants room to take over the connection ourselves in
  a future version. Note: a direct integration is a partnership per broker (a developer agreement, an
  approval process, usually months), not only code; it is recorded as a future option, not a plan.
- 2026-10-22: Consent has a recorded, time-boxed life. After the broker link succeeds the connection is
  in state "import pending" with the consent screen shown. Decline → the broker link is removed at the
  vendor and in the app, the attempt is recorded as "declined" and the trader sees "Import not started.
  Nothing is connected." No answer within the time limit (24 hours) → the same cleanup, recorded as
  "expired". Consent → import starts and the state moves to "importing", then "connected". "Import
  pending" can never persist beyond the limit. Why: the owner wants a recorded decline and a clean end
  state, never an indefinite pending link.
- 2026-10-22: Before the vendor's portal opens, the trader sees a short trust notice about the
  connector: who SnapTrade is, that the connection is read-only (the app can never place trades or
  move money), that for brokers with a login handoff the broker password is never shared with SnapTrade
  or with us, that SnapTrade reports an
  independent audit of its own security controls (its wording, linked, never presented as an audit of
  any record or of this app), and a link to SnapTrade's own
  security page and to our "How records are calculated" page. Every statement is one the vendor
  publishes itself; no claim of endorsement by brokers and no "recommended by" wording (POLICY F3a,
  Section 11 of COMPLIANCE). Why: the owner wants traders to know the connector is reputable before
  handing over broker access; the notice must stay factual and sourced.
- 2026-10-22: Phone-number sign-in (SMS one-time code) is planned for the first follow-up after launch,
  not for launch. The sign-up funnel is instrumented from day one (step reached, method chosen,
  completed, time to complete) so the decision to add phone is made on measured drop-off at the email
  step. When added: rate limits and a fraud filter against SMS pumping before the first message is
  sent, codes that are transactional only, and phone never the sole recovery factor for an account
  holding a brokerage link. Why: the owner wants sign-up completion as high as possible, like the
  one-tap provider path, and accepts deferring phone until the data shows it is needed.
- 2026-10-22: Heavy-use targets for tests: 10,000 activities per trader, 5 accounts per trader, 500
  traders per hourly sync. Why: the owner accepted the defaults.

- 2026-10-22: Trust-notice wording fixed to the legally compliant form (POLICY F3a: never imply
  auditing of records): the notice says the vendor reports an independent audit of its own security
  controls, in the vendor's words with a link, and nothing about this app or any record being audited.
  Why: the owner chose the compliant version.
- 2026-10-22: Three mechanics the committee found necessary, recorded so the build has them: (a) a
  fresh connection whose accounts are all already claimed by one existing trader signs that trader in
  and drops the new link; "refused" applies only when a different signed-in user tries (TR-6 kept);
  (b) account claims are provisional until consent (`confirmed_at`); claims of a declined or expired
  connection are released, confirmed claims are never released; (c) a `signup_attempts` row with no
  personal data holds the 18+ attestation and the vendor link, and the user row is created at consent,
  so the attestation always precedes the account. Why: without these the decisions above contradict
  each other or the vendor's API; none changes what the owner decided.
- 2026-10-22: The owner confirmed F-1 is decided; Status set to ready.

## Acceptance criteria
Each one testable; the pipeline writes a test for every line.
- [ ] A trader can sign in with either device-native provider account, with an email link, or by
      completing a brokerage connection; the 18+ attestation is required on every first sign-in, on
      every method, before a user row exists.
- [ ] The sign-up funnel records, per attempt: method chosen, each step reached, completion, and time
      to complete, with no personal data in the event (tested: events contain no email, phone or name).
- [ ] A trust notice precedes the portal on every connection attempt: read-only, password not shared
      for login-handoff brokers, the vendor's audit status, links to the vendor's security page and
      the app's "How records are calculated" page; its wording is a fixed string tested against the
      banned-claims list (no "endorsed", "recommended", "guaranteed", "secure" as a bare promise).
- [ ] The portal opens embedded in the app's page; the broker login runs in the portal's popup; when the
      popup is blocked the app falls back to the redirect flow and the trader still completes the
      connection (tested in a popup-blocked browser context).
- [ ] Completing a read-only brokerage connection writes only the link and the claimed account IDs
      (TR-6), imports nothing, and shows the trader a consent screen naming the import depth (full
      history the broker provides, every account under the login, TR-2/TR-3).
- [ ] A connection row carries a state (pending, importing, connected, declined, expired, failed) and a
      timestamp for each transition; a declined or expired connection has no broker link at the vendor
      and no account claims in the app; a profile never shows "pending" older than 24 hours (a cron
      expires them; tested with a clock).
- [ ] Declining shows "Import not started. Nothing is connected." and offers to connect again; the
      connection's provisional claims are released (tested: the same account can then be claimed by
      the same or another trader), while confirmed claims are never released.
- [ ] A connection whose accounts are all confirmed-claimed by one existing trader signs that trader
      in; a different signed-in trader is refused with the existing message.
- [ ] The 18+ attestation is stored on a `signup_attempts` row before any user row exists; no user row
      is ever created without a linked attestation (tested).
- [ ] Account deletion exists (POLICY P6): it deletes personal data, the vendor user, events and
      affinities, freezes nothing public that the owner's rules say survives (the handle is reserved
      for one year with no personal data), and is tested end to end.
- [ ] After consent, the trader lands on their profile with a banner that updates with the number of
      trades imported so far and disappears when the import finishes.
- [ ] Two syncs for the same trader never interleave: a concurrent sync waits or is skipped, every
      sync is one transaction, and a failure leaves the record exactly as before (tested with
      concurrent calls).
- [ ] A failed or abandoned connection returns the trader to a page that says what happened and offers
      to retry; nothing is written for that attempt.
- [ ] A brokerage account already claimed by another trader is refused with a clear message (existing
      `claims` behaviour kept).
- [ ] Edge cases are covered by tests: no trades yet, sells without a recorded entry, duplicate
      activities on re-sync, a disconnect after connecting (record freezes, TR-5).
- [ ] Heavy use is covered by tests: a record with thousands of activities and several accounts syncs
      and rebuilds within a bounded time, and repeated hourly syncs stay idempotent.
- [ ] The profile a new trader lands on is readable on a 375px screen signed out: name, record-since,
      headline stats with their range, the chart, the trade list.

## Out of scope
- Phase 2/3 features (predictions, leagues, subscriptions).

## Open questions
- Which real test accounts exist for each day-one brokerage?

## Rework notes
