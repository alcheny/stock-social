# F-35 brief (orchestrator's build session, 2026-11-01)

Feature: `docs/features/F-35-publish-once-the-date-has-passed.md`. F-24 (#84, bdf3ea9) merged, so the blocker is gone.

## What the code does today (main at 3bea348)
- `lib/sync.ts#notFuture` = `executed_at <= now() + 24 h`. The rebuild's share page query, the rename-chain query, the
  corporate-action load (`loadCorporateActions(tx, id, notFuture(tx))`) and the re-read window (`lastShare`) all use it.
  So a sell dated up to 24 h ahead is matched and published today.
- The future count (`rebuildTrades`, end) counts share rows with `not notFuture` that pass `storedFirst` and F-24's
  `notDuplicate`, not paper, not shared: `users.excluded_future`. Profile line (`app/u/[handle]/page.tsx:376`) and the
  compare cards (`lib/record-tools.ts:235`) print `PROFILE.excludedFuture(n)` = "N imported trade(s) excluded: dated in
  the future by the broker." (exact text pinned in `lib/copy.test.ts:302`).
- `lib/options-sync.ts` has its own `notFuture` (same 24 h grace, null dates pass) on every option read of the rebuild
  (`rebuildOptionTrades`, `exerciseDays`, option pairs). Future-dated option rows are left out and counted nowhere.
- A rebuild runs only when a sync reads activities or the account set changed (`rebuilt = actIds.length > 0 || changed`).
  Under F-14's cadence, activities are read about once per 25 h, so a row that matures waits up to a day (ponytail at
  `lib/sync.ts:515`).
- `rebuildTrades` sets `last_synced_at = now()`; under cadence `syncUser` then rewrites it to the oldest account read
  (F-14 orchestrator review), so "Updated" means "activities last read".
- Production tick: `/api/sync` → `lib/sync-shard.ts#runShard` (sharded, lease-fenced, deadline-bounded, workers claim
  traders with the per-user round claim, each sync under `pg_try_advisory_xact_lock(USER_LOCK, id)`).
- F-24 adds held rows (`heldRow`), the duplicate filter (`notDuplicate`) and `excluded_held`; `matchTrades` counts
  `excludedHeld`. All of that sits in the same rebuild queries this feature touches.
- Existing grace test: `lib/sync.test.ts` "fix round 6: an activity dated 2 days ahead is quarantined …" asserts a sell
  dated +12 h is **published** (`['AAA', 'CCC']`) and `excluded_future = 1`. The new rule contradicts those two
  assertions.

## Candidate design (for the UX lead to accept, amend or replace)
1. Two predicates. `published` = `executed_at <= now()` (what the record matches and shows). `notFuture` (24 h grace)
   stays as the quarantine bound and keeps its other jobs: the re-read window, corporate actions (out of scope:
   "how far ahead a row is quarantined, unchanged").
2. Rebuild queries (share pages, chain query; options rebuild, exercise days, option pairs) read `published` rows only.
3. Future count: share rows not `published` (same filters as today) → `excluded_future`; option rows not `published`
   (not paper, not shared) → a new `users.excluded_future_options` (additive column), so F-21's sells-only arithmetic
   never mixes option rows into the share counter. Profile line prints the sum.
4. Copy: the existing sentence stays (pinned by a test); a second sentence is added in the same line: "It appears on
   this record once its date passes." / "They appear on this record once their dates pass."
5. Watermark: `users.published_through timestamptz` (additive). `rebuildTrades` sets it to the transaction's `now()`
   inside the rebuild's transaction, so it advances only when the rebuild commits.
6. Matured-rows query: one statement per shard run, after the workers end, finds users with a row (share or option)
   where `executed_at > created_at` (stored while future-dated: partial indexes on `executed_at` with that predicate),
   `executed_at <= now()`, `executed_at > now() - 8 days` (bound), `executed_at > coalesce(published_through, -inf)`;
   not deleted, not a public filer, no import running; in the shard; `limit MATURED_PER_RUN`.
7. Each found user: one transaction, `pg_try_advisory_xact_lock(USER_LOCK, id)` (busy → skip; the watermark has not
   moved, so the next run retries), `rebuildRecord(id, tx)`, then `last_synced_at` put back to its previous value (a
   rebuild-only pass read nothing from the vendor). Stops at the run's deadline. Counted in the run report
   (`matured`, `maturedFailed`), numbers only.
8. Frozen records (all connections disconnected): open question. Publishing a stored row whose date passed reads
   nothing from the vendor; the profile line promises it appears.
9. Tests use dates relative to the database's `now()`; time passing is simulated by moving the test's own rows (and
   its watermark) back by the same interval.

## Acceptance criteria → evidence
1. Nov 1 row dated Nov 2 absent from every surface, future count 1 → db test (closed_trades, option_trades, profile
   load, feed) + e2e on the profile.
2. First tick at/after the date, no new activity → publishes: db test through `runShard` with a fake sync.
3. Two ticks → one rebuild; third → none: counted rebuilds.
4. Failed rebuild leaves the watermark, next tick retries.
5. Month page "through today" under TZ=UTC and another zone: e2e (`TZ=` per project? the Playwright config is protected;
   use the browser context `timezoneId` and the server process zone).
6. Twins for the existing grace tests; none deleted.
7. EXPLAIN at LOAD shape: no Seq Scan on activities.
8. Relative dates only.
