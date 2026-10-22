# F-1 · Broker connection, end to end

Status: draft

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
- 2026-10-22: Sign-in options: with a brokerage connection, with a major email-provider account, and
  with social accounts (listed in the private checklist). Why: the owner wants low-friction sign-in.
  Note: the brokerage link is not an identity provider; "log in with brokerage" means a session created
  by completing a verified connection, with the claimed broker account as the identity key (TR-6).
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
- 2026-10-22: Heavy-use targets for tests: 10,000 activities per trader, 5 accounts per trader, 500
  traders per hourly sync. Why: the owner accepted the defaults.

## Acceptance criteria
Each one testable; the pipeline writes a test for every line.
- [ ] A trader can sign in with an email-provider account or a social account, or create a session by
      completing a brokerage connection; the 18+ attestation is required on every first sign-in.
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
- [ ] Declining shows "Import not started. Nothing is connected." and offers to connect again.
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
- Which social accounts exactly (private checklist)? Each adds an OAuth client to maintain.

## Rework notes
