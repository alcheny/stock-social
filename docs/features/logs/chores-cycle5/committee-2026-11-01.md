# Chores from approval council cycle 5: committee log (2026-11-01)

Source: `docs/ideas/approval-2026-11-01-cycle5.md` ("Routed", chore lane) and the briefs in
`docs/direction/cycle5-2026-11-01.md` §6 (Rank 9 C5-43, Ranks 15, 16, 18-21 for C5-39, C5-36, C5-38, C5-37, C5-42,
C5-40). The council's narrowings are used exactly as recorded. Two PRs, in order:

1. `claude/chores-cycle5-matcher-catchup`: C5-43 part (b) alone. F-32 Part A and F-36 must not ship a
   `MATCHER_VERSION` bump until it is on main (council round 3 routing, 15/15).
2. `claude/chores-cycle5`: the rest (C5-43 a, c, d; C5-39; C5-38; C5-40; C5-42; C5-36 and C5-37 narrowed; the F-30
   readout row).

Roles are separate subagents with fresh context where the step is a review; the orchestrating build session wrote the
code. Every probe record is fictional.

## PR 1: C5-43 part (b), matcher catch-up in the sync tick

### Decisions

| # | Question | Decision | Why |
|---|---|---|---|
| B1 | Where the catch-up runs | Every shard call of the cron (`syncs`: unsharded and `shard=i&of=N`), after the shard's sync; never the housekeeping-only call | The brief: "rebuilt within each shard's budget". Each shard rebuilds only `id % of = shard`, so shards never race on one record, and the sync keeps its priority (fresh trades first). |
| B2 | Its budget | `min(MATCHER_CATCHUP_MS = 20 s, time left before the route's 30 s privacy margin)`, checked before each record; at most 200 records per call | The sync stops claiming 90 s before the route ends (`SYNC_RESERVE_MS`), so the catch-up always has room after a full sync; the batch bounds the selection read. |
| B3 | A record whose sync holds the lock | Skipped (`pg_try_advisory_xact_lock`), counted `busy`, taken by a later call | Waiting on a long sync could spend the whole budget on one record; the deploy path keeps waiting (unchanged). |
| B4 | When the version is marked done | When this shard has none left and no record in any shard is left (one `exists` read), the version goes into `matcher_runs`; later calls cost one primary-key read | The brief: "the version is marked done when none are left". A shard that finishes first never marks the version for the others. |
| B5 | Population | Records with stored rows (activities or corporate actions) and no `matcher_rebuilt` row for the version: the same predicate as the deploy rebuild, frozen and disconnected records included | One definition of "not yet rebuilt" for both paths (shared `pending` fragment). |
| B6 | The deploy path | Kept as is (`scripts/db-setup.ts` → `rebuildAllForMatcher`), now sharing the per-record loop | Fewest records left for the tick; no behaviour change there (its tests unchanged and passing). |
| B7 | Response and logs | The route's JSON gains `matcher: { rebuilt, failed, busy, left, done } \| null` (counts only); a failure logs a count | Numbers only (docs/SYNC.md → Logs rule); no ids. |
| B8 | Test | 50 fictional records, a private version number, three shards' calls in turn with batch 4 until done; plus shard scoping, lock skip, time budget and empty-record cases | The council's test ("bump the version over 50 fictional records and drain them with no deploy"). A private version and `ids` keep the test off other files' rows. |

### Known limits (ponytails in `lib/matcher-rebuild.ts`)

- `left` is bounded by one batch, not the exact backlog.
- A record that fails every time is retried first on each tick of its shard; more than 200 such records in one shard
  would starve the rest.
- (kept) A sync on old code between the rebuild and the cutover can rebuild one record with the old matcher.

### Independent code review (fresh-context subagent, 2026-11-02, after merging main at ca34767)

- **Blocking 1 (fixed).** `matcher_rebuilt` holds one row per record, so "no row for version N" was also true of a
  record a newer deploy had already rebuilt for N+1. During the next bump, this code (then the old code serving the
  cron) could rebuild such a record back with the old matcher while the deploy still marked N+1 done; a frozen record
  would keep the old figures for good. Fix: a record counts as done for N when its row is N or newer (`>=`, in the
  shared `pending` fragment and the deploy rebuild's selection), and the catch-up stops once any version ≥ N is done.
  Test added: "older code never rebuilds back a record a newer version already rebuilt …".
- Also found while fixing it: the drain test's "old figure" fixture updated a row that did not exist yet
  (`insertActivities` builds no closes), so it proved nothing. It now inserts the stale close as a fixture row, as
  `lib/fixes-cycle4.db.test.ts` does, and the test asserts that the close reads +10% afterwards.
- Verified correct by the reviewer: the lock key and skip path, the shard predicate (matches `lib/sync-shard.ts`), the
  done-marking logic, unchanged `rebuildAllForMatcher` behaviour, the route's time budget and the tests' isolation on a
  shared database.

### Parent's independent review of #107 (head b7df09a, 2026-11-02): BLOCK, fixed

- **Blocking (fixed).** The batch was selected before each record's lock was taken, and the marker upsert overwrote
  unconditionally. Interleaving (reproduced by the reviewer): older code selects [A, X] and stalls on A; X is rebuilt
  for v+1 and v+1 is marked done; older code then rebuilds X back and writes v, while `catchUpMatcher(v+1)` returns
  `null`. Fix in `rebuildEach` (both paths): inside the lock the marker is read again and a record at this version or
  newer is left alone (`newer`, counted in the response and excluded from the deploy path's `left`); the upsert only
  moves the marker up (`where matcher_rebuilt.version < excluded.version`). Regression test "a newer rebuild that lands
  after the older batch was selected is never rebuilt back (re-checked inside the lock)" drives exactly that
  interleaving through a `beforeRecord` test hook; it fails with the in-lock check removed and passes with it.
- **Non-blocking (kept, noted).** The done check reads `version >= v`, so a higher version marked done elsewhere would
  make these tests' calls return `null`. Only this file writes versions ≥ 20000 (`lib/fixes-cycle4.db.test.ts` uses
  9000-9899, below them), its tests run one after another and each deletes its own `matcher_runs` rows in `finally`, so
  no parallel writer exists today; a new test file writing high versions must use a range of its own.
  Running the full suite after the fix confirmed the concern in a narrower form: the two tests that mark a second
  (`newer`) version done had not registered it for cleanup, so their rows stayed behind and turned every later run of
  this file into `null` calls. Fixed: both register it, and the file's setup fails with that reason if any row ≥ 20000 is
  left (the file is the only writer of that range).

### Gates (PR 1)

- `npx tsc --noEmit`: clean.
- `npm test`: 2377 tests, 2349 pass, 0 fail, 26 skipped, 2 todo (before the review fix); the touched files were re-run
  after it (`lib/chores-cycle5-matcher.db.test.ts`, `lib/fixes-cycle4.db.test.ts`: 10 pass, 0 fail).
- `node scripts/autopilot.ts guard origin/main`: ok.
- `BASE_REF=main node scripts/compliance.ts auto`: one finding, `node_modules/@img/sharp-wasm32` (license). It comes from
  this container's installed optional package, not from this branch (package.json and package-lock.json are unchanged
  from main).
- `npm run build`: ok.
