# F-35 · A trade is published once its date has passed

Status: built
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
- 2026-11-02 (build committee, `docs/features/logs/F-35/`): the publish rule (`executed_at <= now()`) covers shares,
  options and corporate actions; the 24 h grace bounds only the re-read window. Why: what feeds the matcher must not be
  dated after today (UX lead, plan §1).
- 2026-11-02: option rows dated ahead get their own counter (`users.excluded_future_options`), shown summed with
  `excluded_future` on one line; no sells-only counter (F-21 hand-off note instead). Why: option rows dated ahead were
  counted nowhere (F3c); a speculative column was rejected (business lead r1).
- 2026-11-02: the line's second sentence is "It waits on this line until that date passes." / "They wait on this line
  until their dates pass." Why: it describes the line only, so it is true whatever happens at maturity (a sell with no
  entry is counted, not shown) (business lead r1). The pinned first sentence is kept; the compare tool's card keeps it
  alone (an existing test pins its strings).
- 2026-11-02: the watermark is `users.published_through`, written by `rebuildRecord` with the rebuild's own clock;
  inserts of rows dated ahead lower it (never fill a null). No matcher version bump: the pass also rebuilds, once, any
  record with no watermark holding a row still dated ahead (`maturedInitial`). Why: engineer r1-2, r1-4, r2-1.
- 2026-11-02: the matured pass runs in each shard run before the workers, opt-in (`mature: true` from the route), within
  50 records and 20 s, oldest matured row first; it restores `last_synced_at`. Frozen records are included. Why:
  engineer r1-3, r1-6; business lead r1-5, r1-6 ("publish"); tester QA 1.
- 2026-11-02: the month page (while the month runs) and /me/record name waiting rows too. Why: UX lead user test (F3c:
  "Trades close through today" and "none can be hidden" must not hide a waiting row).
- 2026-11-02: an unpriceable trade sell dated ahead is counted on the future line while it waits. Why: code review 1
  (main's grace counted it in excluded_corporate; F-35 must not leave it uncounted).

## Acceptance criteria
- [x] On Nov 1 (a test clock relative to the database's `now()`), a row dated Nov 2 is absent from every surface, and
      the future count shows 1.
- [x] On the first sync tick at or after the row's date, with no new activity, the row publishes.
- [x] Two consecutive ticks with one matured row give exactly one rebuild, and a third tick gives none.
- [x] The watermark advances only after a successful rebuild. A failed rebuild leaves it, and the next tick retries.
- [x] The month page's "through today" holds, in an e2e run under TZ=UTC and one other zone.
- [x] The existing 24-hour-grace tests get twins for the new rule. None is deleted.
- [x] The matured-rows query's plan shows no sequential scan of `activities` at the LOAD shape.
- [x] Tests use dates relative to the database's `now()`, never literal dates.

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
- 2026-11-02: built on `claude/f35-publish-after-date` through the committee cycle (plan signed after 3 rounds; tests
  first; tester QA pass; UX lead and business lead user tests at 360 px; independent code review, every finding taken
  or recorded): `docs/features/logs/F-35/`. LOAD EXPLAIN: 2,000,000 activities, rows read = the 20,000 future-stored rows,
  partial indexes only. e2e under UTC and Pacific/Kiritimati, light and dark.
