// Fixes cycle 4 (C4-1, C4-2; reliability condition 5): a matcher change only reaches a record when it is rebuilt, and a
// cadence-gated sync rebuilds only after a read (frozen records never). So a deploy rebuilds every record once per
// MATCHER_VERSION, each under the trader's lock, with rebuildRecord (theses of closes that become counted go to
// kept_theses and come back by sell_id). The version is written only after every record is rebuilt, so a deploy that
// stops part-way rebuilds them all again next time (idempotent).
import { sql } from './db.ts';
import { MATCHER_VERSION } from './trades.ts';
import { USER_LOCK } from './sync.ts';
import { rebuildRecord } from './options-sync.ts';

// ponytail: a trader whose published closes the rebuild turns into counts is not told (their /me/record shows the count
// only; lib/session.ts is protected) — fix: a one-time owner-facing notice listing records whose shown count dropped.
// ponytail: one transaction per record, sequential (about the sync's pace, ~5k records an hour) inside the deploy — fix:
// run it from the tick in shards (lib/sync-shard.ts) once records outgrow a deploy's time limit.
export async function rebuildAllForMatcher(version = MATCHER_VERSION, ids?: number[]): Promise<number | null> {
  const [done] = await sql`select 1 from matcher_runs where version = ${version}`;
  if (done && !ids) return null;
  const users = await sql`select u.id from users u
    where ${ids ? sql`u.id in ${sql(ids.length ? ids : [0])} and` : sql``}
      (exists (select 1 from activities a where a.user_id = u.id) or exists (select 1 from corporate_actions c where c.user_id = u.id))
    order by u.id`;
  for (const u of users) {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${USER_LOCK}, ${u.id as number})`;
      await rebuildRecord(u.id as number, tx);
    });
  }
  if (!ids) await sql`insert into matcher_runs (version) values (${version}) on conflict (version) do nothing`;
  return users.length;
}
