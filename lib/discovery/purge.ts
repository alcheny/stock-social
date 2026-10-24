// F-2 PR-2 (plan demand D): the discovery purge, called by the sync tick (app/api/sync/route.ts) after the connection
// tick and the deletion retries, before syncTick. One caller at a time (a session advisory lock, tried, never waited
// for); the caller that loses the lock skips only the purge. A fixed time box of ≤ 30 s per call, in batches by the
// (until) index; a call cut by its box resumes on the next tick. In PR-2 it deletes exclusions that ended over a day
// ago (an ended row is kept a day so a same-day feed cursor never changes). PR-5 extends it to the event log.
import { sql } from '../db.ts';

export const PURGE_LOCK = 3; // USER_LOCK (lib/sync.ts) is 1, ATTEMPT_LOCK (lib/connections.ts) is 2
export const PURGE_BOX_MS = 30_000;
export const PURGE_BATCH = 10_000;
export const EXCLUSION_KEEP_ENDED_DAYS = 1;

export type PurgeReport = { ran: boolean; deleted: number; done: boolean };

// `hold`: a test hook, awaited while the lock is held.
export async function purgeDiscovery(opts: { boxMs?: number; batch?: number; clock?: () => number; hold?: () => Promise<void> } = {}): Promise<PurgeReport> {
  const clock = opts.clock ?? Date.now;
  const end = clock() + Math.min(opts.boxMs ?? PURGE_BOX_MS, PURGE_BOX_MS);
  const batch = opts.batch ?? PURGE_BATCH;
  const conn = await sql.reserve();
  try {
    const [{ got }] = await conn`select pg_try_advisory_lock(${PURGE_LOCK}, 0) as got`;
    if (!got) return { ran: false, deleted: 0, done: false };
    try {
      await opts.hold?.();
      let deleted = 0;
      // F-2 PR-4: then trade rejects ended over a day ago (a permanent one, until = 'infinity', is never purged).
      const steps = [() => conn`delete from viewer_exclusions where (viewer_id, trader_id) in (
          select viewer_id, trader_id from viewer_exclusions where until < now() - ${EXCLUSION_KEEP_ENDED_DAYS} * interval '1 day'
          order by until limit ${batch})`, () => conn`delete from trade_rejects where (viewer_id, trade_key) in (
          select viewer_id, trade_key from trade_rejects where until < now() - ${EXCLUSION_KEEP_ENDED_DAYS} * interval '1 day'
          order by until limit ${batch})`];
      for (const step of steps) for (;;) {
        if (clock() >= end) return { ran: true, deleted, done: false };
        const gone = await step();
        deleted += gone.count;
        if (gone.count < batch) break;
      }
      return { ran: true, deleted, done: true };
    } finally {
      await conn`select pg_advisory_unlock(${PURGE_LOCK}, 0)`;
    }
  } finally {
    conn.release();
  }
}
