// Privacy work (2026-11-01, committee D10–D13, D19): purges on the existing sync tick (app/api/sync/route.ts): a fixed
// slot after the discovery purge and before the traders are synced, then any time left after them; each call in its own
// try/catch so nothing here can stop a sync.
// One caller at a time (advisory lock (41, 0), tried, never waited for); a fixed time box; batches; a call cut by its
// box resumes on the next tick. Removes data that has no further use:
//   - expired sessions;
//   - unused sign-in links: expired ones, and unused ones whose attempt finished another way (they still hold the
//     address); a used link keeps no address and stays until it expires, so a second tap can say "already used";
//   - unfinished sign-ups: attempts with no account after 30 days, with their funnel steps, links and signed-out
//     connections (a signed-in account's connections stay: they drive its record's state, TR-3);
//   - likes and rejected trades whose trade has been gone for 30 days (marked when first seen gone, unmarked if the
//     trade comes back). Preference data with a live trade is never removed on a timer (owner, 2026-11-01).
// Account deletion is separate and removes everything (lib/delete.ts).
import { sql } from './db.ts';
// OPTIONS (docs/features/logs/options/plan.md D7, L8): option contract symbols (they carry the strike) never stay in the
// public open_positions table, a frozen trader's included. The option tables themselves go with the account (cascade).
import { purgeOccPositions } from './options-sync.ts';

export const PRIVACY_PURGE_LOCK = 41; // (41, 0). USER_LOCK 1 (lib/sync.ts), ATTEMPT_LOCK 2 (lib/connections.ts), PURGE_LOCK 3 (lib/discovery/purge.ts)
export const PRIVACY_PURGE_BOX_MS = 20_000;
export const PRIVACY_PURGE_BATCH = 5_000;
export const UNFINISHED_SIGNUP_DAYS = 30;
export const ORPHAN_GRACE_DAYS = 30;

export type PrivacyPurgeReport = {
  ran: boolean; done: boolean;
  sessions: number; links: number; attempts: number; orphansMarked: number; orphansCleared: number; likes: number; rejects: number;
  occPositions?: number; // OPTIONS
};

// `now`, `only` and `hold` are test hooks (a test runs the dated steps at a past `now`, so other tests' rows are untouched).
export type PurgeStep = 'sessions' | 'links' | 'attempts' | 'orphans';
type Opts = { boxMs?: number; batch?: number; clock?: () => number; hold?: () => Promise<void>; now?: Date; only?: PurgeStep[] };

export async function purgePrivacy(opts: Opts = {}): Promise<PrivacyPurgeReport> {
  const clock = opts.clock ?? Date.now;
  const end = clock() + Math.min(opts.boxMs ?? PRIVACY_PURGE_BOX_MS, PRIVACY_PURGE_BOX_MS);
  const batch = opts.batch ?? PRIVACY_PURGE_BATCH;
  const now = opts.now ?? new Date();
  const r: PrivacyPurgeReport = { ran: false, done: false, sessions: 0, links: 0, attempts: 0, orphansMarked: 0, orphansCleared: 0, likes: 0, rejects: 0, occPositions: 0 };
  const conn = await sql.reserve();
  try {
    const [{ got }] = await conn`select pg_try_advisory_lock(${PRIVACY_PURGE_LOCK}, 0) as got`;
    if (!got) return r;
    r.ran = true;
    try {
      await opts.hold?.();
      // Each step repeats until a batch comes back short; the box is checked before every batch.
      const steps: [keyof PrivacyPurgeReport, () => Promise<number>][] = [
        ['sessions', async () => (await conn`delete from sessions where token_hash in (
          select token_hash from sessions where expires_at < ${now} order by expires_at limit ${batch})`).count],
        ['links', async () => (await conn`delete from login_links where token_hash in (
          select l.token_hash from login_links l left join signup_attempts a on a.id = l.attempt_id
          where l.expires_at <= ${now} or (l.used_at is null and a.completed_at <= ${now}) limit ${batch})`).count],
        ['attempts', () => purgeUnfinishedAttempts(now, batch)],
        // OPTIONS: one statement (open_positions holds one row per position, few per trader); reported as a count.
        ['occPositions', () => purgeOccPositions(conn as never)],
        ['orphansCleared', async () => (await conn`delete from privacy_orphans where (kind, viewer_id, trade_key) in (
          select o.kind, o.viewer_id, o.trade_key from privacy_orphans o
          where exists (select 1 from closed_trades c where c.trade_key = o.trade_key)
             or (o.kind = 'like' and not exists (select 1 from trade_likes l where l.viewer_id = o.viewer_id and l.trade_key = o.trade_key))
             or (o.kind = 'reject' and not exists (select 1 from trade_exclusions x where x.viewer_id = o.viewer_id and x.trade_key = o.trade_key))
          limit ${batch})`).count],
        ['orphansMarked', async () => (await conn`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at)
          select 'like', l.viewer_id, l.trade_key, ${now}::timestamptz from trade_likes l
          where not exists (select 1 from closed_trades c where c.trade_key = l.trade_key)
            and not exists (select 1 from privacy_orphans o where o.kind = 'like' and o.viewer_id = l.viewer_id and o.trade_key = l.trade_key)
          limit ${batch} on conflict do nothing`).count],
        ['orphansMarked', async () => (await conn`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at)
          select 'reject', x.viewer_id, x.trade_key, ${now}::timestamptz from trade_exclusions x
          where not exists (select 1 from closed_trades c where c.trade_key = x.trade_key)
            and not exists (select 1 from privacy_orphans o where o.kind = 'reject' and o.viewer_id = x.viewer_id and o.trade_key = x.trade_key)
          limit ${batch} on conflict do nothing`).count],
        ['likes', async () => (await conn`with gone as (
            delete from trade_likes l using privacy_orphans o
            where o.kind = 'like' and o.viewer_id = l.viewer_id and o.trade_key = l.trade_key
              and o.first_seen_at < ${now}::timestamptz - ${ORPHAN_GRACE_DAYS} * interval '1 day'
              and not exists (select 1 from closed_trades c where c.trade_key = l.trade_key)
              and (l.viewer_id, l.trade_key) in (select viewer_id, trade_key from privacy_orphans where kind = 'like' order by first_seen_at limit ${batch})
            returning l.viewer_id, l.trade_key)
          delete from privacy_orphans o using gone g where o.kind = 'like' and o.viewer_id = g.viewer_id and o.trade_key = g.trade_key`).count],
        ['rejects', async () => (await conn`with gone as (
            delete from trade_exclusions x using privacy_orphans o
            where o.kind = 'reject' and o.viewer_id = x.viewer_id and o.trade_key = x.trade_key
              and o.first_seen_at < ${now}::timestamptz - ${ORPHAN_GRACE_DAYS} * interval '1 day'
              and not exists (select 1 from closed_trades c where c.trade_key = x.trade_key)
              and (x.viewer_id, x.trade_key) in (select viewer_id, trade_key from privacy_orphans where kind = 'reject' order by first_seen_at limit ${batch})
            returning x.viewer_id, x.trade_key)
          delete from privacy_orphans o using gone g where o.kind = 'reject' and o.viewer_id = g.viewer_id and o.trade_key = g.trade_key`).count],
      ];
      const stepOf = (k: keyof PrivacyPurgeReport): PurgeStep => (k === 'sessions' || k === 'links' || k === 'attempts' ? k : k === 'occPositions' ? 'attempts' : 'orphans');
      for (const [key, step] of steps) {
        if (opts.only && !opts.only.includes(stepOf(key))) continue;
        for (;;) {
          if (clock() >= end) return r;
          const n = await step();
          (r[key] as number) += n;
          if (n < batch) break;
        }
      }
      r.done = true;
      return r;
    } finally {
      await conn`select pg_advisory_unlock(${PRIVACY_PURGE_LOCK}, 0)`;
    }
  } finally {
    conn.release();
  }
}

// Attempts that never became an account: older than UNFINISHED_SIGNUP_DAYS, the vendor user already cleaned
// (lib/connections.ts#cleanupAttempts), no live or uncleaned connection, and no users row pointing at them (a user
// inserted just before its attempt was marked complete). One transaction per batch, children first.
async function purgeUnfinishedAttempts(now: Date, batch: number): Promise<number> {
  return sql.begin(async (tx) => {
    const ids = (await tx`select a.id from signup_attempts a
      where a.user_id is null and a.completed_at is null and a.snaptrade_user_id is null
        and a.created_at < ${now}::timestamptz - ${UNFINISHED_SIGNUP_DAYS} * interval '1 day'
        and not exists (select 1 from users u where u.signup_attempt_id = a.id)
        and not exists (select 1 from connections c where c.attempt_id = a.id
          and (c.user_id is not null or c.state in ('pending', 'importing', 'connected') or c.cleanup_done_at is null))
      order by a.created_at limit ${batch} for update skip locked`).map((x) => x.id as number);
    if (!ids.length) return 0;
    await tx`delete from funnel_events where attempt_id in ${tx(ids)}`;
    await tx`delete from login_links where attempt_id in ${tx(ids)}`;
    await tx`delete from connections where attempt_id in ${tx(ids)} and user_id is null`;
    return (await tx`delete from signup_attempts where id in ${tx(ids)}`).count;
  });
}
