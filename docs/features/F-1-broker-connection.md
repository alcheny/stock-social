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

## Acceptance criteria
Each one testable; the pipeline writes a test for every line.
- [ ] A signed-in trader can start a read-only brokerage connection and return to their own profile with
      closed trades visible in the same session.
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
- Which brokerages must work on day one, and which real accounts can be used to test them?
- Does real sign-in (replacing the dev auth stub) belong to this feature, or come right after it?
- What does the trader see while the first sync runs (it can take seconds to minutes on a big record)?
- Does the connection flow live inside the app (modal/iframe) or redirect out to the vendor's portal
  as it does today?
- What should the empty profile say right after connecting when no trades have closed yet?
- Is there a target for "heavy use" (activities per record, traders per hourly sync) to test against?

## Rework notes
