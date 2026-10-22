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
- 2026-10-22: Heavy-use targets for tests: 10,000 activities per trader, 5 accounts per trader, 500
  traders per hourly sync. Why: the owner accepted the defaults.

## Acceptance criteria
Each one testable; the pipeline writes a test for every line.
- [ ] A trader can sign in with an email-provider account or a social account, or create a session by
      completing a brokerage connection; the 18+ attestation is required on every first sign-in.
- [ ] Completing a read-only brokerage connection writes only the link and the claimed account IDs
      (TR-6), imports nothing, and shows the trader a consent screen naming the import depth (full
      history the broker provides, every account under the login, TR-2/TR-3).
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
- If the trader declines the import consent, what happens: the link is dropped, or kept with no record?
- Portal in-app or redirect: the vendor's portal can open as a redirect (today) or embedded in the
  page; decision pending.

## Rework notes
