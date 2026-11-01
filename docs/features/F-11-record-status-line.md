# F-11 · Record status line: freshness, accounts and removed accounts

Status: ready

## Why
Nothing tells a viewer how fresh a record is or which accounts it covers. A removed account is never named, although
"Account removed ‹date›" is a DESIGN TR-5 Must. Fix #4 in the approval record replaces the false "Connected" on
disconnected records with "Disconnected ‹date› · record frozen". This feature builds what remains of D29 (decided by
the idea board, `docs/IDEAS.md` 2026-11-01). It also keeps the slower vendor cadence of F-14 honest. Approved by
the approval council (`docs/ideas/approval-2026-11-01.md`, C7: second-vote mean 4.07, final vote 15/15).

## Decisions
- 2026-11-01: D29, verbatim: "the profile shows 'Last close ‹date› · updated ‹relative time›' under 'Record since',
  labels accounts 'Account 1 of 2', and says when a connection has not synced for 30 days ('idle' means no sync, not
  no closes; facts only); idle connections are counted internally." Why: decided by the idea board; approved for
  build by the approval council.
- 2026-11-01: TR-5's "Account removed ‹date›" is shown where an account was removed, beside the fix's "Disconnected
  ‹date›". Why: DESIGN TR-5 Must; approved by the approval council.
- 2026-11-01: "Updated" is computed at request time from the last successful sync (`last_synced_at`) only, never from
  the cron schedule, the render time or a cache. A failed sync leaves it unchanged. Why: approved by the approval
  council. The red team showed a cached relative time making a month-old record look fresh, and common sense vetoes
  false freshness.
- 2026-11-01: Share images and any cached render carry absolute dates only, with the year outside the current year.
  Relative times appear only on dynamic pages, and always next to the absolute date in a `<time datetime>` element.
  Why: approved by the approval council (common sense's veto condition; accessibility).
- 2026-11-01: The wording of "as of" and "updated" uses the design system's settled wording. Why: the design system
  council is settling it now (orchestrator, 2026-11-01).
- 2026-11-01: Open positions follow F-6 ("only for connected or failed records"). Positions of a disconnected account
  (OD-9) stay with the owner. Why: the decisions keeper's condition.
- 2026-11-01: Applies to broker-connected records only. F-7 public profiles state freshness by filing date under
  F-7's own rules. Why: approved by the approval council (F-7 interface condition).

## Acceptance criteria
- [ ] The profile shows "Last close ‹date› · updated ‹relative time›" under "Record since", in D29's words or the design
      system's settled wording (e2e).
- [ ] "Updated" is derived from `last_synced_at` of the last successful sync. A unit test shows a failed sync leaves
      it unchanged and that it never reads the schedule.
- [ ] A record with two accounts labels them "Account 1 of 2" and "Account 2 of 2" (e2e).
- [ ] A connection with no successful sync for 30 days shows the idle fact, with no verdict words. Idle connections
      are counted internally only, with no identifier in logs (test).
- [ ] A removed account shows "Account removed ‹date›" and its trades stay listed (TR-1, TR-5). A disconnected record
      shows "Disconnected ‹date›" and never "Connected" (e2e over profile, pane, feed card, trade and month pages).
- [ ] Trade, month and record images and any cached page contain no relative time, and every date outside the current
      year shows the year (image and render tests).
- [ ] Status is given in words, never by icon or colour alone. Relative times come with the absolute date in
      `<time datetime>` (component test).
- [ ] One status-line helper (pure, unit-tested) serves the profile, pane, feed card, trade and month pages, so there
      is no second date style.
- [ ] No completeness wording ("every trade", "full record") in the line (scanner and string test).
- [ ] Ships with or before F-14's throttle (merge order in the coordination map).

## Out of scope
- Status on the F-4 record card and share-card placement of "Disconnected" (owner questions OD-14 and creative Q1).
- F-7 public profiles' freshness.

## Open questions
- None from the council.

## Rework notes
