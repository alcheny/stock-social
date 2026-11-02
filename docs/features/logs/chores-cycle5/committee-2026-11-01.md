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

## PR 2: the rest of the chore lane (`claude/chores-cycle5`)

Three builder subagents (fresh context, own worktrees, own databases), each tests-first on a disjoint file set:
backend (C5-43 a/c/d, C5-40), UI and accessibility (C5-39, C5-38, C5-36, C5-37), tests and readout (C5-42, F-30's
readout row). The orchestrating session merged them, merged main (#102, #105, #107), resolved the F-25 conflicts, ran
the gates and the 360 px check, and an independent reviewer (fresh context) reviewed the merged diff.

### Decisions

| # | Item | Question | Decision | Why |
|---|---|---|---|---|
| A1 | C5-43(a) | How to make the account count constant-time | Index `activities (user_id, source, account_id)` and a recursive walk reading one index row per distinct account; no stored count | The existing test inserts activities directly and expects the count without a sync; the walk gives exactly the old `count(distinct account_id)`. |
| A2 | C5-43(a) | First entry and last close | Per-trader `min(opened_at)` through the new `closed_trades (user_id, opened_at)` index; `max(closed_at)` through the existing index | One index row each. |
| A3 | C5-43(a) | Plain or partial indexes | Partial on an always-true `is not null`, named by the status read only | With plain indexes an unordered legacy read in `lib/display-log.batch.test.ts` changed row order; partial indexes leave every other plan as it was. |
| A4 | C5-43(a) | Proof | EXPLAIN ANALYZE rows read: a 3,000-close trader reads at most 4 `closed_trades` and 12 `activities` rows, as a 3-close trader does | The council's rule: rows read, never wall-clock. |
| C1 | C5-43(c) | What the stored sitemap holds | `sitemap_traders`: per (scope, symbol, trader) the verified close count and the UTC day of the newest close; requests group these rows through `visibleUserIds()` | A per-symbol table could not keep fix #4 (a deleted profile leaves every chunk at once, without a rebuild). |
| C1b | C5-43(c) | A request with no stored row, or a stale one | A request never builds and never waits; with no row it serves an empty index (home and `/t`); the cron's housekeeping rebuilds under a try-lock at most once per `REBUILD_MS` | The brief: no GET aggregates `closed_trades`. |
| C1c | C5-43(c) | Privacy classification | The new table in SCHEMA_MAP (personal, deleted with the account); its columns in `NOT_A_FIELD` as copies of the public fields "symbols" and "dates" | `PUBLIC_FIELDS` is pinned to the consent versions; the consent text is unchanged. |
| D1 | C5-43(d) | Clock for freeze marks | The database's `now()` (plus the test shift); `syncUser`'s 4th parameter `pinned?` keeps existing tests' explicit times | Acceptance: with the app clock 2 h off, the freeze lands at exactly 24 h of database time (tested both directions). |
| J1 | C5-40 | Flag format | `coverage().db.jit` 1/0 and the problem `'jit is on'` in `dbConfigCheck`; `docs/SYNC.md` adds `alter role … set jit = off` | Existing tests require numeric `db` values. Applying it in production is the owner's deploy setting. |
| U1 | C5-39 | Change the copy constants or the render sites | Render sites, through `Arrowed` / `<span aria-hidden="true">` | Tests pin the constants' exact text; the drawn text is unchanged. F-25's footer links (#102) already hid theirs. |
| U2 | C5-38 | Border colour | `currentColor`, 2 px border, padding reduced by 2 px | `lib/colour-literals.test.ts` forbids system colour keywords outside TOKENS; the outline is the focus ring. |
| U3 | C5-36 | Which "Record tools" goes | The Settings h2; the link stays | One council ballot names "single Record tools link". "Thesis held" and the nav's "My record" untouched (council). |
| U4 | C5-37 | The /tools landmark too | Yes: the shared `Disclaimer` no longer wraps its links in `<nav aria-label="Legal">`; /tools keeps the bold sentence, /account the muted variant (sentence and links, no box) | One component; the footer's Legal nav is on every page (F-3 R8 keeps the sentence and links). |
| T1 | C5-42 | Which source-text tests to back | 13 whose behaviour runs through the code's own functions or injection points, each naming the test it backs; none removed | The council: "behavioural tests beside the text-presence assertions; the old assertions stay". |
| T2 | C5-42 | The two race tests | An event-order assertion beside each, timing assertions kept | The brief. |
| R1 | F-30 row | What counts | One (trader, account, symbol, instant) group holding a BUY and a SELL, over all stored vendor activity of non-deleted, non-demo traders; classes 00:00:00Z / other whole hours / intraday; each cell under 5 printed "<5", no total | F-30's decision 2026-11-01 (counts only, suppressed under 5); the cells are disjoint, so no complementary suppression is needed. |

### Existing assertions changed (each maps to a council decision)

- C5-36: `lib/chores-cycle3.test.ts:231` and `e2e/chores-cycle3.spec.ts:13` hold the new delete-notes wording;
  `docs/features/logs/F-3/plan.md` §9 quotes it with a dated note.
- C5-39: e2e accessible-name lookups drop the arrow and add `exact: true` (`e2e/signin.spec.ts`, `record-strip.spec.ts`,
  `app.spec.ts`, `similar.spec.ts`, `section.spec.ts`). `record-strip.spec.ts:166` also filters on the drawn "←", so it
  still targets the back link (the strip's own link now shares its name).
- C5-43(c): four `lib/sitemaps.test.ts` tests encoded "a request rebuilds", which the council's item removes; each is
  rewritten to the cron-only rule with its completeness and once-each assertions kept, and a comment names the test it
  replaced. The count is unchanged.

### Process notes

- Two builders could not create a database role in the shared cluster (the worktree guard refused `su`). One created
  a separate trust-auth cluster on port 5447, which the orchestrator dropped after merging; the other used `setpriv`.
  The UI builder ran no e2e; the orchestrator ran its specs on the merged branch (one lookup fixed, above).
- `demoUser()` alias: the readout builder found its new query compared the helper's inner alias with itself; fixed in
  the loader. The other callers pass `u.id` or `r.user_id` and are not affected (checked).

### CI on #122 (Postgres 17, fresh database): the C5-43(a) EXPLAIN test

- **First failure (3,004 closes read).** In a correlated subquery the planner sizes a trader by the table's average, so
  a plain `min()`/`max()` aggregate over all of a trader's rows could cost the same as the one-row path. Each lookup is
  now `order by … limit 1` on its index. The test also adds 12 fictional filler traders, because on a table that is
  almost all one record, a sequential scan that stops early is a legitimate choice for the small record (reproduced on
  a fresh local database).
- **Second failure (3,001 closes read, Postgres 17 only).** Postgres 17 removes `col is not null` on a not-null column
  from the query before matching partial indexes, so the partial indexes on `… is not null` (decision A3) could never be
  used there. Their condition is now `opened_at >= '-infinity'` / `account_id >= ''` (true of every row), repeated word
  for word in the status query. The indexes are renamed `closed_trades_user_first` and `activities_user_source_acct`,
  because the schema helper never recreates an existing index. The earlier names exist only on local development
  databases (never merged).
