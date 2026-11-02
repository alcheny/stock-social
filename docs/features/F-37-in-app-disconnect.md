# F-37 · In-app disconnect

Status: ready
Start conditions: none (new files plus one settings-page entry). Part B waits for the vendor's written answer (OD 2.12).

## Why
The consent copy promises that a record stays public after the trader disconnects (`lib/copy.ts:108`), but nothing in
the app lets a trader disconnect: only the sync freeze writes `disconnected_at` (`lib/sync.ts:464`). OD 2.10 asks for
the in-app disconnect before any real user. Owner decision 2026-11-02 (OD 2.10 and 2.12, accepted en bloc;
`docs/direction/owner-decisions-2026-11-02-worklist.md`).

## Decisions
- 2026-11-02: A signed-in trader can disconnect each connected broker account from the account settings page. The
  record freezes at that moment exactly as a confirmed sync freeze does (DESIGN TR-5): closed trades and theses stay
  public, the status line reads "Disconnected ‹date› · record frozen", and nothing is deleted. Why: the owner accepted
  OD 2.10 on 2026-11-02; the consent copy already promises it.
- 2026-11-02: Part A makes no vendor-side delete. Part B, after the vendor confirms in writing that derived
  percentages may stay public once a connection is removed, deletes the vendor connection when a record freezes
  (in-app disconnect or confirmed freeze; amends DESIGN TR-5 in the owner's protected-files PR). Why: the owner accepted
  OD 2.10 and OD 2.12 on 2026-11-02.
- 2026-11-02: The confirmation step says plainly what happens: the record stays public and frozen, new trades stop
  being imported, and deleting the whole profile is a separate action that is still available (link). A record freeze
  never blocks deletion. Why: POLICY P6; OD 2.9's deletion wording.
- 2026-11-02: Reconnecting the same broker account later resumes the same record after fresh consent (OD 2.30,
  TR-6). Why: the owner accepted OD 2.30 on 2026-11-02.

## Acceptance criteria
- [ ] A trader with two connected accounts disconnects one: that account's `disconnected_at` is set, the other keeps
      syncing, and the profile's status line names the disconnected account's date (DB + e2e).
- [ ] After disconnect, no sync reads that account (vendor fake asserts no calls), and the record's closed trades and
      theses are unchanged byte for byte.
- [ ] The confirmation page names the three consequences and links to profile deletion; it is reachable by keyboard
      with a visible focus and an accessible name on every control (e2e, A1).
- [ ] The action is a POST with the existing CSRF/origin checks; a signed-out or other user's request changes nothing.
- [ ] Part A makes no vendor delete call (vendor fake). Part B, behind a switch that stays off until the owner records
      the vendor's answer, calls the vendor delete once per frozen connection and retries idempotently.
- [ ] Reconnecting after fresh consent resumes the same record (existing TR-6 path; test).

## Out of scope
- Deleting the profile (exists; `lib/delete.ts`).
- Any change to protected `lib/broker.ts` beyond what Part B needs; that edit goes to the protected-files session.

## Open questions
- Vendor (OD 2.12, letter Appendix A): may derived percentages stay public after the connection is deleted?

## POLICY notes
- P6: users can disconnect and delete; a freeze never blocks deletion. F5: connections stay read-only.

## Rework notes

## Build log
