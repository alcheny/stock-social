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

// ponytail: records left over at the time budget wait for the next deploy (frozen ones included) — fix: let the sync tick
// pick up records with no matcher_rebuilt row for the current version, in shards (lib/sync-shard.ts).
// ponytail: a sync running old code between this rebuild and the cutover can rebuild one active record with the old
// matcher after it is marked; its next sync on the new code fixes it — fix: key closed_trades rows by matcher version.
// ponytail: a trader whose published closes the rebuild turns into counts is not told (their /me/record shows the count
// only; lib/session.ts is protected) — fix: a one-time owner-facing notice listing records whose shown count dropped.
export async function rebuildAllForMatcher(version = MATCHER_VERSION, ids?: number[], budgetMs = Number(process.env.MATCHER_REBUILD_MS) || 600_000): Promise<{ rebuilt: number; failed: number; left: number } | null> {
  const [done] = await sql`select 1 from matcher_runs where version = ${version}`;
  if (done && !ids) return null;
  const users = await sql`select u.id from users u
    where ${ids ? sql`u.id in ${sql(ids.length ? ids : [0])} and` : sql``}
      not exists (select 1 from matcher_rebuilt m where m.user_id = u.id and m.version = ${version})
      and (exists (select 1 from activities a where a.user_id = u.id) or exists (select 1 from corporate_actions c where c.user_id = u.id))
    order by u.id`;
  const start = Date.now();
  let rebuilt = 0, failed = 0;
  for (const u of users) {
    if (Date.now() - start > budgetMs) break;
    try {
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${USER_LOCK}, ${u.id as number})`;
        await rebuildRecord(u.id as number, tx);
        await tx`insert into matcher_rebuilt (user_id, version) values (${u.id as number}, ${version})
          on conflict (user_id) do update set version = excluded.version`;
      });
      rebuilt++;
    } catch { failed++; }
  }
  const left = users.length - rebuilt;
  if (failed) console.error('matcher rebuild: records failed, the version stays open', JSON.stringify({ count: failed }));
  if (!left && !ids) await sql`insert into matcher_runs (version) values (${version}) on conflict (version) do nothing`;
  return { rebuilt, failed, left };
}
