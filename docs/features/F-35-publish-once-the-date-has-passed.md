# F-35 · A trade is published once its date has passed

Status: blocked
Blocked: waits for F-24 (PR #84, `claude/f24-late-postings`) to merge, since it edits `lib/sync.ts` and the future-count query this feature changes
Start conditions: #84 merges. It is its own build slot (the sync slot). If the watermark needs a column, it rebases on
whichever of #84 or F-31 (#98) touches `db/schema.sql` first.

## Why
The 24-hour future grace publishes trades dated tomorrow (`lib/sync.ts:36-39`), though the comment above it promises
publication only once the date has passed (`:36-37`). On Nov 1 the month page says "Trades close through today"
above a close dated Nov 2 (`app/u/[handle]/month/[ym]/page.tsx:89`). That is false on screen today (council cycle 5,
C5-30, brief rank 6). It amends the options-era 24-hour grace (#62), an orchestrator ruling the council may amend.
Approved by the approval council (`docs/ideas/approval-2026-11-01-cycle5.md`: second-vote mean 3.87, final vote 15/15,
all approving, 7 of them with conditions).

## Decisions
- 2026-11-01: Rows dated up to 24 hours ahead stay stored and counted on their own future line, and are re-checked on
  every rebuild, as today. They publish only once their `executed_at` is no later than the database clock (`now()`).
  Rows further ahead stay quarantined and counted, as now. Why: approved by the approval council (cycle 5); brief C5-30.
- 2026-11-01: One indexed query per sync tick finds the rows that have matured. It schedules a rebuild for each
  trader under the per-user advisory lock and the shard budget, with no new activity needed (today rebuilds run only
  when `actIds.length > 0 || changed`, `lib/sync.ts:600-602`). A watermark (an added column, or a max over existing
  rows; never a drop or rename) makes each matured row trigger exactly one rebuild, and it advances only after a
  successful rebuild. Why: approved by the approval council (cycle 5); RT round 4, RE, EN.
- 2026-11-01: The matured-rows query is backed by an index on `executed_at` and bounded per tick. The PR shows its
  EXPLAIN at the LOAD shape with no sequential scan. Why: approved by the approval council (cycle 5); RE, EN.
- 2026-11-01: While a row waits, the profile's future line says plainly that the trade will appear once its date
  passes. Why: approved by the approval council (cycle 5); VW.
- 2026-11-01: A maturing future BUY never moves F-21's pane count, which counts sells and option closes only. Why:
  approved by the approval council (cycle 5); RT.

## Acceptance criteria
- [ ] On Nov 1 (a test clock relative to the database's `now()`), a row dated Nov 2 is absent from every surface, and
      the future count shows 1.
- [ ] On the first sync tick at or after the row's date, with no new activity, the row publishes.
- [ ] Two consecutive ticks with one matured row give exactly one rebuild, and a third tick gives none.
- [ ] The watermark advances only after a successful rebuild. A failed rebuild leaves it, and the next tick retries.
- [ ] The month page's "through today" holds, in an e2e run under TZ=UTC and one other zone.
- [ ] The existing 24-hour-grace tests get twins for the new rule. None is deleted.
- [ ] The matured-rows query's plan shows no sequential scan of `activities` at the LOAD shape.
- [ ] Tests use dates relative to the database's `now()`, never literal dates.

## Out of scope
- How far ahead a row is quarantined (unchanged).
- Vendor date stamps (F-30, lapsed this cycle).

## Open questions
- None.

## POLICY notes
- F3a: no page shows a close dated after "today".
- F3c: a waiting row is counted on its own line, never dropped or guessed.

## Hand-offs to in-flight work
- F-24 (#84) edits the same future-count query (`lib/sync.ts:181`) and `syncUser`. Build after it.
- F-31 (#98) and #84 may touch `db/schema.sql`. Add the watermark after whichever lands first, additively.
- Chore C5-43(d) (database clock for freeze marks) touches the same file and can ride with this build.

## Rework notes

## Build log
