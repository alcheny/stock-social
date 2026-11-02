# F-40 · Last known positions on a disconnected record

Status: ready
Start conditions: F-34 (one open-positions line) merges first, because this feature reuses its single producer.

## Why
When an account is disconnected or frozen, its open positions move to `unlisted_positions` and are shown nowhere
(`lib/positions.ts:7-12`, "until the owner decides OD-9"). A frozen record then hides losers that were still open.
Owner decision 2026-11-02 (OD 2.31, accepted en bloc; DES:1049-1051; C3:681-683).

## Decisions
- 2026-11-02: A disconnected or frozen account's last positions show on its record, labelled "Last known ‹Mon D,
  YYYY›" with the date the positions were last read. They use the same open line and the same unrealized values as a
  connected account (OD 2.25 as overridden on 2026-11-02), read from stored rows only, never refreshed. Why: the owner
  accepted OD 2.31 on 2026-11-02; TR-4 (open positions shown).
- 2026-11-02: The label is on every surface that shows them, including images and alt texts, with the year. Why: F-34's
  as-of rule; DSP-12.

## Acceptance criteria
- [ ] A fictional record with one disconnected account holding a −20% open position shows it with "Last known ‹date›"
      on the profile, pane, card and images (render tests), through F-34's one producer.
- [ ] No vendor call is made for a frozen account's positions (vendor fake).
- [ ] Paper and `notShared` accounts never feed the line (F-34 rule; test).
- [ ] The date is the stored read time, with the year; the same text appears in the alt text.
- [ ] Deleting the profile deletes these rows (existing deletion test extended).

## Out of scope
- Positions in the range (F-45).

## Open questions
- None.

## POLICY notes
- F4/TR-4 open positions shown; P3 percent only.

## Rework notes

## Build log
