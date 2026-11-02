# F-40 · In-app disconnect

Status: ready
Queued: development paused by the owner 2026-11-02 (relayed by the orchestrator); not built until the owner resumes development.
Start conditions: none. F-41 (last known positions) follows it directly, so a disconnect never hides open losers for
long.

## Why
The consent copy promises that a record stays public after the trader disconnects (`lib/copy.ts:108`), but nothing in
the app disconnects: only the sync freeze writes `disconnected_at` (`lib/sync.ts:464`). OD 2.10 asks for it before
real users. Owner decision 2026-11-02 (OD 2.10, accepted en bloc; A3:195). Deleting the vendor connection on a freeze
is F-48 (OD 2.12). Committee check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: A signed-in trader can disconnect each broker connection (one broker login) from account settings. That
  connection freezes exactly as a confirmed sync freeze does (DESIGN TR-5): its closed trades and theses stay public,
  its row reads "Disconnected ‹Mon D, YYYY›", and nothing is deleted. "record frozen" shows only when every connection
  is disconnected (`lib/record-status.ts:46`). No vendor-side delete here. Why: the owner accepted OD 2.10 on
  2026-11-02; engineer review (`disconnected_at` is per connection).
- 2026-11-02: The confirmation page says what happens: the record stays public and frozen, new trades stop being
  imported, and deleting the whole profile is a separate action that is still available (link). It never says
  "permanently" or "ever". The button reads "Disconnect ‹broker name›"; Cancel returns to settings with focus on that
  row. Why: POLICY P6 (a freeze never blocks deletion); OD 2.9; legal committee and UX reviews.
- 2026-11-02: On disconnect, that connection's `open_positions` rows move to `unlisted_positions` (as the sync freeze
  does), for F-41 to show as last known. Why: engineer review (a frozen user is never synced, `lib/sync.ts:224`).
- 2026-11-02: Reconnecting the same login later resumes the same record after fresh consent (OD 2.30, TR-6). The
  connect path no longer treats a disconnected row's authorization as already known (`lib/connections.ts:349` adds
  `and disconnected_at is null`). Why: the owner accepted OD 2.30; engineer review (otherwise a reconnect can end
  `abandoned`).

## Acceptance criteria
- [ ] With two connections, disconnecting one sets its `disconnected_at`; the other keeps syncing; the status line keeps
      the live freshness date and the disconnected row reads "Disconnected ‹date›"; "record frozen" appears only when
      both are disconnected (DB + e2e).
- [ ] After disconnect no sync reads that connection (vendor fake), and closed trades and theses are byte-identical.
- [ ] Its open positions move to `unlisted_positions`; no raw or derived row is deleted (test).
- [ ] The confirmation page pins its three lines and the button label; it fits 360 px with no horizontal scroll; every
      control is keyboard-reachable with a visible focus and an accessible name; Cancel restores focus (e2e, A1).
- [ ] POST with the existing origin checks; a signed-out or other user's request changes nothing.
- [ ] No vendor delete call is made (vendor fake).
- [ ] Reconnecting after fresh consent resumes the same record and ends `connected`, not `abandoned` (test of
      `lib/connections.ts:349`).

## Out of scope
- The vendor-side delete (F-48); profile deletion (exists, `lib/delete.ts`).

## Open questions
- None.

## POLICY notes
- P6; F5 read-only connections.

## Rework notes

## Build log
