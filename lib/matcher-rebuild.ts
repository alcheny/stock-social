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
  // A record that fails to rebuild doesn't stop the deploy (final review): it is counted, and the version is written only
  // when every record rebuilt, so the next deploy tries them all again. Counts only, never an id.
  let failed = 0;
  for (const u of users) {
    try {
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${USER_LOCK}, ${u.id as number})`;
        await rebuildRecord(u.id as number, tx);
      });
    } catch { failed++; }
  }
  if (failed) console.error('matcher rebuild: records failed, the version stays open', JSON.stringify({ count: failed }));
  else if (!ids) await sql`insert into matcher_runs (version) values (${version}) on conflict (version) do nothing`;
  // ponytail: a sync running old code between this rebuild and the cutover can rebuild one active record with the old
  // matcher after the version is written; its next sync on the new code fixes it — fix: key closed_trades rows by matcher
  // version and rebuild stale ones on read.
  return users.length;
}
