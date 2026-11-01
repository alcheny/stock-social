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
