# F-41 · Last known positions on a disconnected record

Status: blocked
Blocked: builds after F-34 (`claude/f34-open-positions-line`, building) and F-40 merge, and rebases on F-16/F-17 (#100), which edits `app/t/open-positions.ts`, `lib/record-status-load.ts` and `lib/trade-share-load.ts` (merge order)

## Why
A disconnected or frozen account's open positions move to `unlisted_positions` and are shown nowhere
(`lib/positions.ts:7-12`, "until the owner decides OD-9"); a fully frozen record's `open_positions` rows are never
moved and show with no label (`lib/positions.ts:11-12`, `lib/sync.ts:224`). A frozen record can then hide losers that
were still open (TR-4). Owner decision 2026-11-02 (OD 2.31, accepted en bloc; DES:1049-1051; C3:681-683). Committee
check: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.

## Decisions
- 2026-11-02: A disconnected connection's last positions show on its record, labelled "Last known ‹Mon D, YYYY›" with
  the time they were last read, through F-34's single open-line producer and with the same unrealized values as a
  connected account (OD 2.25 as overridden on 2026-11-02). They come from stored rows only and are never refreshed.
  Only rows whose connection has `disconnected_at` count, not rows that are only in their missing window. Option
  positions stay excluded (options are gated). Why: the owner accepted OD 2.31 on 2026-11-02; engineer review.
- 2026-11-02: The label is text (never colour alone) on every surface that shows the positions, including images and
  alt texts, with the year, next to the disclaimer. Why: F-34's as-of rule; A1; F3; UX review.
- 2026-11-02: They show only for traders whose accepted consent version lists open positions with unrealized percent
  and says they stay public after disconnect. Why: legal committee condition (P3, P6).
- 2026-11-02: Reconnecting replaces "Last known" with live values on every surface. Why: business lead review.

## Acceptance criteria
- [ ] A fictional record with one disconnected connection holding a −20% open position shows it with "Last known ‹date›"
      on the profile, pane, card and images, signed out, through F-34's producer (render tests pin the text).
- [ ] A fully frozen record's positions show the same label (test).
- [ ] No vendor call for a frozen connection's positions; option positions and paper or `notShared` accounts never feed
      the line (tests).
- [ ] A trader whose consent version does not cover open positions shows none (test).
- [ ] After reconnecting, live values replace the label everywhere (test).
- [ ] Deleting the profile deletes these rows (deletion test extended).

## Out of scope
- Positions in the range (F-46).

## Open questions
- None.

## POLICY notes
- F4/TR-4; P3 percent only.

## Rework notes

## Build log
