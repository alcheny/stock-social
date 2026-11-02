// Fixes cycle 4 (C4-1, C4-2; reliability condition 5; independent review finding 6): a matcher change only reaches a
// record when it is rebuilt, and a cadence-gated sync rebuilds only after a read (frozen records never). So a deploy
// rebuilds every record once per MATCHER_VERSION, each under the trader's lock, with rebuildRecord (theses of closes that
// become counted go to kept_theses and come back by sell_id). Progress is kept per record (matcher_rebuilt), so a deploy
// rebuilds only the records not yet done, a failing record is retried next time without redoing the rest, and the run
// stops at its time budget; the version is written to matcher_runs once no record is left.
import { sql } from './db.ts';
import { MATCHER_VERSION } from './trades.ts';
import { USER_LOCK } from './sync.ts';
import { rebuildRecord } from './options-sync.ts';
import { addMoves, noCounts, reasonCounts, type ReasonCounts } from './matcher-report.ts';
import { logSafe } from './privacy-log.ts'; // FIXES-CYCLE5 (F5-17)
import type { Shard } from './sync-limits.ts';

// Chores cycle 5 (C5-43 part b): records left over at the deploy's time budget no longer wait for the next deploy. The
// sync tick's catchUpMatcher (below) rebuilds them shard by shard, frozen ones included, and marks the version done.
// ponytail: a sync running old code between this rebuild and the cutover can rebuild one active record with the old
// matcher after it is marked; its next sync on the new code fixes it — fix: key closed_trades rows by matcher version.
// ponytail: a trader whose published closes the rebuild turns into counts is not told (their /me/record shows the count
// only; lib/session.ts is protected) — fix: a one-time owner-facing notice listing records whose shown count dropped.
// `moves` (F-32 Part A): filled with the run's per-reason changes (tests read it; the run logs it either way).
// FIXES-CYCLE5 (F5-17): `rebuild` is a test seam (default rebuildRecord). A failing record is counted by its error class
// (lib/privacy-log.ts#logSafe: class, status and code only), so the log says why without naming a record.
export async function rebuildAllForMatcher(version = MATCHER_VERSION, ids?: number[], budgetMs = Number(process.env.MATCHER_REBUILD_MS) || 600_000, moves: ReasonCounts = noCounts(),
  rebuild: typeof rebuildRecord = rebuildRecord): Promise<{ rebuilt: number; failed: number; left: number } | null> {
  const [done] = await sql`select 1 from matcher_runs where version = ${version}`;
  if (done && !ids) return null;
  const users = await sql`select u.id from users u
    where ${ids ? sql`u.id in ${sql(ids.length ? ids : [0])} and` : sql``}
      not exists (select 1 from matcher_rebuilt m where m.user_id = u.id and m.version >= ${version})
      and (exists (select 1 from activities a where a.user_id = u.id) or exists (select 1 from corporate_actions c where c.user_id = u.id))
    order by u.id`;
  const byClass: Record<string, number> = {}; // FIXES-CYCLE5 (F5-17): error classes only, never an id or handle
  const { rebuilt, failed, newer } = await rebuildEach(users.map((u) => u.id as number), version, budgetMs, false, Date.now, undefined, moves, byClass, rebuild);
  const left = users.length - rebuilt - newer;
  if (failed) console.error('matcher rebuild: records failed, the version stays open', JSON.stringify({ count: failed, byClass }));
  if (rebuilt) logMoves(version, moves);
  if (!left && !ids) await sql`insert into matcher_runs (version) values (${version}) on conflict (version) do nothing`;
  return { rebuilt, failed, left };
}

// Rebuilds each record under the trader's lock and marks it rebuilt for `version`, until `budgetMs` has passed (checked
// before each record, so one record can run past it). `skipLocked`: a record whose lock is held (a sync in flight) is
// skipped, not waited on, and stays for the next call; the deploy path waits instead. Inside the lock the record's marker
// is read again: a record rebuilt for this version or a newer one since the batch was selected is left alone (`newer`),
// and the marker never moves down, so older code can never rebuild a record back after a newer version reached it
// (parent review of #107: the batch is selected before the locks are taken).
// F-32 Part A (decision "Version bumps"): each rebuilt record's counts are read before and after in its transaction, and
// the change is added to `moves` once the transaction commits. Counts per reason only, never an id.
async function rebuildEach(ids: number[], version: number, budgetMs: number, skipLocked: boolean, now = Date.now, beforeRecord?: (id: number) => Promise<void>, moves: ReasonCounts = noCounts(),
  byClass: Record<string, number> = {}, rebuild: typeof rebuildRecord = rebuildRecord) { // FIXES-CYCLE5 (F5-17): byClass, rebuild
  const start = now();
  let rebuilt = 0, failed = 0, busy = 0, newer = 0;
  for (const id of ids) {
    if (now() - start > budgetMs) break;
    try {
      if (beforeRecord) await beforeRecord(id);
      const outcome = await sql.begin(async (tx) => {
        if (skipLocked) {
          const [got] = await tx`select pg_try_advisory_xact_lock(${USER_LOCK}, ${id}) as ok`;
          if (!got.ok) return 'busy' as const;
        } else await tx`select pg_advisory_xact_lock(${USER_LOCK}, ${id})`;
        const [mark] = await tx`select version from matcher_rebuilt where user_id = ${id}`;
        if (mark && (mark.version as number) >= version) return 'newer' as const;
        const before = await reasonCounts(tx, id);
        await rebuild(id, tx);
        const after = await reasonCounts(tx, id);
        await tx`insert into matcher_rebuilt (user_id, version) values (${id}, ${version})
          on conflict (user_id) do update set version = excluded.version where matcher_rebuilt.version < excluded.version`;
        return { before, after };
      });
      if (typeof outcome === 'object') { rebuilt++; addMoves(moves, outcome.before, outcome.after); } else if (outcome === 'busy') busy++; else newer++;
    } catch (e) { failed++; const c = logSafe(e); byClass[c] = (byClass[c] ?? 0) + 1; } // FIXES-CYCLE5 (F5-17)
  }
  return { rebuilt, failed, busy, newer };
}

// The one report line per run: the version and the net change per reason (counts only; lib/privacy-logs.test.ts).
const logMoves = (version: number, m: ReasonCounts) =>
  console.log('matcher rebuild: moves per reason', JSON.stringify({ version, shown: m.shown, excluded: m.excluded, corporate: m.corporate, transfer: m.transfer, held: m.held }));

// A record the matcher has to rebuild for `version`: it has stored rows and no matcher_rebuilt row for that version or a
// newer one (a record a newer deploy already rebuilt is never rebuilt back by older code).
// `ids` narrows the population (tests: only their own records); `shard` narrows it to `id % of = shard`.
const pending = (version: number, ids?: number[], shard?: Shard) => sql`
  not exists (select 1 from matcher_rebuilt m where m.user_id = u.id and m.version >= ${version})
  and (exists (select 1 from activities a where a.user_id = u.id) or exists (select 1 from corporate_actions c where c.user_id = u.id))
  ${ids ? sql`and u.id in ${sql(ids.length ? ids : [0])}` : sql``}
  ${shard && shard.of > 1 ? sql`and u.id % ${shard.of} = ${shard.shard}` : sql``}`;

export type CatchUp = { rebuilt: number; failed: number; busy: number; newer: number; left: number; done: boolean };
export const MATCHER_CATCHUP_MS = 20_000;
export const MATCHER_CATCHUP_BATCH = 200;

/** Chores cycle 5 (C5-43 part b; council cycle 5: before any MATCHER_VERSION bump). The sync tick's share of the
 *  matcher rebuild: each call rebuilds up to `batch` of this shard's records not yet rebuilt for `version` (frozen and
 *  disconnected records included: the selection reads stored rows only), within `budgetMs`, skipping a record whose
 *  sync holds its lock. Once no record is left in any shard, the version is written to matcher_runs, and later calls
 *  cost one primary-key read. So a matcher change reaches every record within ticks, with no further deploy.
 *  `ids` limits the population to those records (tests); with `ids` the version is marked done only for that population
 *  being empty, which only a test's private version number may rely on. */
// `beforeRecord` is a test hook (it runs before each record's transaction), used to interleave another rebuild.
export async function catchUpMatcher(o: { shard: Shard; budgetMs?: number; version?: number; ids?: number[]; batch?: number; now?: () => number; beforeRecord?: (id: number) => Promise<void>; moves?: ReasonCounts }): Promise<CatchUp | null> {
  const version = o.version ?? MATCHER_VERSION;
  // A newer version done (or a record rebuilt for a newer version, in `pending`) counts as done: code still serving the
  // cron while the next deploy rebuilds must never rebuild a record back with the older matcher (independent review).
  const [done] = await sql`select 1 from matcher_runs where version >= ${version} limit 1`;
  if (done) return null;
  const batch = o.batch ?? MATCHER_CATCHUP_BATCH;
  const users = await sql`select u.id from users u where ${pending(version, o.ids, o.shard)} order by u.id limit ${batch}`;
  const moves = o.moves ?? noCounts();
  const byClass: Record<string, number> = {}; // FIXES-CYCLE5 (F5-17)
  const r = await rebuildEach(users.map((u) => u.id as number), version, o.budgetMs ?? MATCHER_CATCHUP_MS, true, o.now, o.beforeRecord, moves, byClass);
  if (r.failed) console.error('matcher catch-up: records failed, the version stays open', JSON.stringify({ count: r.failed, byClass }));
  if (r.rebuilt) logMoves(version, moves);
  // ponytail: a record that fails every time is retried first on every tick of its shard (ids in order), so more than `batch`
  // such records in one shard would starve the rest — fix: a matcher_rebuilt attempt count, failed records ordered last.
  // ponytail: `left` counts this shard's records up to one batch past the ones rebuilt (a cheap bound, not the backlog)
  // — fix: a count(*) here if the coverage report ever needs the exact backlog.
  const [{ n }] = await sql`select count(*)::int as n from (select 1 from users u where ${pending(version, o.ids, o.shard)} limit ${batch}) x`;
  let marked = false;
  if (!n) {
    const [any] = await sql`select 1 from users u where ${pending(version, o.ids)} limit 1`;
    if (!any) {
      await sql`insert into matcher_runs (version) values (${version}) on conflict (version) do nothing`;
      marked = true;
    }
  }
  return { ...r, left: n as number, done: marked };
}
