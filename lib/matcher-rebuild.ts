// Fixes cycle 4 (C4-1, C4-2; reliability condition 5; independent review finding 6): a matcher change only reaches a
// record when it is rebuilt, and a cadence-gated sync rebuilds only after a read (frozen records never). So a deploy
// rebuilds every record once per MATCHER_VERSION, each under the trader's lock, with rebuildRecord (theses of closes that
// become counted go to kept_theses and come back by sell_id). Progress is kept per record (matcher_rebuilt), so a deploy
// rebuilds only the records not yet done, a failing record is retried next time without redoing the rest, and the run
// stops at its time budget; the version is written to matcher_runs once no record is left.
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { MATCHER_VERSION } from './trades.ts';
import { USER_LOCK } from './sync.ts';
import { rebuildRecord } from './options-sync.ts';

// ponytail: records left over at the time budget wait for the next deploy (frozen ones included) — fix: let the sync tick
// pick up records with no matcher_rebuilt row for the current version, in shards (lib/sync-shard.ts).
// ponytail: a sync running old code between this rebuild and the cutover can rebuild one active record with the old
// matcher after it is marked; its next sync on the new code fixes it — fix: key closed_trades rows by matcher version.
// ponytail: a trader whose published closes the rebuild turns into counts is not told (their /me/record shows the count
// only; lib/session.ts is protected) — fix: a one-time owner-facing notice listing records whose shown count dropped.
// F-36 (AC6): how many shown share returns a rebuild changed, and how many of those changed sign (expected 0: a matcher
// change that only moves the denominator keeps the numerator). Closes in both maps only: a close the rebuild removes or
// adds is counted by F-24's rewrites (lib/options-sync.ts#logRewrites).
// ponytail: the sign count compares stored and rebuilt share closes by sell_id only (option closes already divide by
// premium plus entry fees) — fix: one rebuild report table with per-cause counts if a later bump needs them.
export function signChanges(before: Map<string, number>, after: Map<string, number>): { changed: number; signChanged: number } {
  let changed = 0, signChanged = 0;
  for (const [id, r] of after) {
    const was = before.get(id);
    if (was === undefined || was === r) continue;
    changed++;
    if (Math.sign(was) !== Math.sign(r)) signChanged++;
  }
  return { changed, signChanged };
}
const shareReturns = async (tx: TransactionSql, userId: number) =>
  new Map((await tx`select sell_id, return_pct from closed_trades where user_id = ${userId}`).map((r) => [r.sell_id as string, r.return_pct as number]));

export async function rebuildAllForMatcher(version = MATCHER_VERSION, ids?: number[], budgetMs = Number(process.env.MATCHER_REBUILD_MS) || 600_000): Promise<{ rebuilt: number; failed: number; left: number } | null> {
  const [done] = await sql`select 1 from matcher_runs where version = ${version}`;
  if (done && !ids) return null;
  const users = await sql`select u.id from users u
    where ${ids ? sql`u.id in ${sql(ids.length ? ids : [0])} and` : sql``}
      not exists (select 1 from matcher_rebuilt m where m.user_id = u.id and m.version = ${version})
      and (exists (select 1 from activities a where a.user_id = u.id) or exists (select 1 from corporate_actions c where c.user_id = u.id))
    order by u.id`;
  const start = Date.now();
  let rebuilt = 0, failed = 0, returnsChanged = 0, signChanged = 0;
  for (const u of users) {
    if (Date.now() - start > budgetMs) break;
    try {
      const c = await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${USER_LOCK}, ${u.id as number})`;
        const before = await shareReturns(tx, u.id as number);
        await rebuildRecord(u.id as number, tx);
        const counts = signChanges(before, await shareReturns(tx, u.id as number));
        await tx`insert into matcher_rebuilt (user_id, version) values (${u.id as number}, ${version})
          on conflict (user_id) do update set version = excluded.version`;
        return counts;
      });
      rebuilt++;
      returnsChanged += c.changed; // counted once the record's transaction committed
      signChanged += c.signChanged;
    } catch { failed++; }
  }
  const left = users.length - rebuilt;
  // F-36: the run's report, counts only (no ids, handles or figures).
  console.log('matcher rebuild', JSON.stringify({ version, rebuilt, failed, left, returnsChanged, signChanged }));
  if (signChanged > 0) console.error('matcher rebuild: a return changed sign', JSON.stringify({ count: signChanged }));
  if (failed) console.error('matcher rebuild: records failed, the version stays open', JSON.stringify({ count: failed }));
  if (!left && !ids) await sql`insert into matcher_runs (version) values (${version}) on conflict (version) do nothing`;
  return { rebuilt, failed, left };
}
