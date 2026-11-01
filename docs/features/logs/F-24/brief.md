# F-24 committee brief (orchestrator, 2026-11-01)

Feature file: `docs/features/F-24-late-sell-reconciliation.md` (read every decision and AC). Prerequisite F-14 merged as
#64 (44a134b; `docs/features/logs/F-14/committee-2026-11-01.md`). Code: `lib/sync.ts#syncUser` (two transactions; txn 2
computes `real` = consented, non-frozen, non-paper account ids and, under `opts.cadence`, `actIds` = accounts whose daily
activities read is due), `lib/sync-cadence.ts` (dueSql/decide/dueRequestsSql), `lib/sync-shard.ts` (metered broker, the
`paged` Set counts a page once per account per run), `lib/options-sync.ts` (pendingBackfill/saveBackfill: the model of a
resumable per-account history cursor; under cadence a backfill page REPLACES that account's week read, `pagedIds`).
`lib/broker.ts` is protected; `fetchActivitiesPage(u, accountId, offset, limit, sink)` already exists and returns
`{activities, unusable?, done}`. Vendor fake: `e2e/fakes/vendor.ts` (paged activities, `/_stats` per-account counts).

## Orchestrator's technical sketch (for the committee to accept, change or reject)

1. **Cursor.** Additive columns on `broker_accounts` (written inside txn 2, so a rolled-back sync never advances them):
   `reconcile_offset int` (null = no pass in progress), `reconciled_at timestamptz` (last completed pass),
   `reconcile_page_at timestamptz` (last page read). A pass starts when
   `coalesce(reconciled_at, claimed_at) <= t - RECONCILE_EVERY` (proposal: 7 days).
2. **Budget.** A reconcile page REPLACES that day's week read for that account (only accounts in `actIds`, i.e. due
   under F-14, and never while the option backfill is pending for it: the backfill page wins). Request count per
   account per day is unchanged (3), so `dueRequestsSql` needs no new term; the metered broker already counts a page as
   that account's one activities read. Pacing proposal: within a multi-page pass, pages alternate with week reads (a
   page only if the last page is ≥ 48 h old), so recent trades wait at most one extra day.
3. **TR-4 / "Updated".** A one-page pass from offset 0 that returns `done` is a superset of the week read: the account
   counts as read with its activities (combined positions rule, last_synced_at advances). Any other reconcile page is a
   history page: folded into `pagedIds` (positions-only rule; last_synced_at keeps its previous value).
4. **Re-issue rule.** Only the reconcile read can tell. For each row the page newly inserted (insert … returning) whose
   (account, symbol, side, executed_at, units, price) equals an already-stored row E (different id) not listed in this
   page: record (new id, E id) in a side table `activity_reissue_suspects` as `pending`; a later page of the same pass
   that lists E resolves it `genuine`; when the pass completes, `pending` → `suspected`. Rebuild input
   (`rebuildTrades` reads activities in lib/sync.ts) excludes ids that are `pending` or `suspected`. Activities stay raw
   and immutable (no flag column). Known gap: E listed on an EARLIER page of a multi-page pass than the new row
   (identical fills split across a 1,000-row boundary) ends `suspected` (excluded and counted, never doubled): accept
   with a ponytail, or persist the pass's listed ids?
5. **Close-change log.** In syncUser, around `rebuild(user.id, tx)`: snapshot closed_trades (sell_id + derived fields)
   into a temp table (on commit drop), rebuild, compare in SQL: `changed`, `removed` (already-shown closes), `added`.
   If changed+removed > 0: one `logSafe`-safe log line with the internal user id and counts only, and
   `users.closes_rewritten` (appended column) += changed+removed. Owner-visible via a DB query only (no public count:
   out of scope). Option closes too, or shares only?
6. **Scope.** Only under `opts.cadence` (the shard runner's production path); syncTick/non-cadence path unchanged.
   Accounts never read: frozen (`disconnected_at`), paper, unconsented (all outside `real`).
7. **Copy.** No UI change at all: a found close renders exactly like any close; thesis re-attaches by sell_id. Copy test
   asserts the profile/trade markup for a reconciled close carries no "late"/"corrected"/"new" wording.
8. **Privacy maps.** New table → `lib/privacy-retention.ts` SCHEMA_MAP; new columns → `lib/privacy-fields.ts` if
   public (none are public). docs/SYNC.md gets a section.

Open questions for the committee: period (7 d?), pacing (alternate?), the boundary gap in 4, option closes in 5,
whether the first pass for existing accounts should be staggered (e.g. by account id hash) so a deploy does not turn
every account's next daily read into a history page on the same day.
