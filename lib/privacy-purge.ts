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
//     trade comes back). Preference data with a live trade is never removed on a timer (owner, 2026-11-01);
//   - fix round 5 (item 8): handle reservations whose hold has ended (a deleted or renamed handle after its year, or one
//     released early by the rename cap, lib/auth/attempts.ts#changeHandle): the handle is free, the row has no use.
// Account deletion is separate and removes everything (lib/delete.ts).
import type { ReservedSql } from 'postgres';
import { sql } from './db.ts';
// OPTIONS (docs/features/logs/options/plan.md D7, L8): option contract symbols (they carry the strike) never stay in the
// public open_positions table, a frozen trader's included. The option tables themselves go with the account (cascade).
import { purgeOccPositions } from './options-sync.ts';

type ReserveSql = ReservedSql<Record<string, never>>;

export const PRIVACY_PURGE_LOCK = 41; // (41, 0). USER_LOCK 1 (lib/sync.ts), ATTEMPT_LOCK 2 (lib/connections.ts), PURGE_LOCK 3 (lib/discovery/purge.ts)
export const PRIVACY_PURGE_BOX_MS = 20_000;
export const PRIVACY_PURGE_BATCH = 5_000;
export const UNFINISHED_SIGNUP_DAYS = 30;
export const ORPHAN_GRACE_DAYS = 30;

export type PrivacyPurgeReport = {
  ran: boolean; done: boolean;
  sessions: number; links: number; attempts: number; orphansMarked: number; orphansCleared: number; likes: number; rejects: number;
  reservations: number;
  occPositions?: number; // OPTIONS
};

// `now`, `only` and `hold` are test hooks (a test runs the dated steps at a past `now`, so other tests' rows are untouched).
export type PurgeStep = 'sessions' | 'links' | 'attempts' | 'orphans' | 'reservations';
type Opts = { boxMs?: number; batch?: number; clock?: () => number; hold?: () => Promise<void>; now?: Date; only?: PurgeStep[] };

export async function purgePrivacy(opts: Opts = {}): Promise<PrivacyPurgeReport> {
  const clock = opts.clock ?? Date.now;
  const end = clock() + Math.min(opts.boxMs ?? PRIVACY_PURGE_BOX_MS, PRIVACY_PURGE_BOX_MS);
  const batch = opts.batch ?? PRIVACY_PURGE_BATCH;
  const now = opts.now ?? new Date();
  // The statement timeout of an orphan batch runs on the wall clock (the `clock` hook may be a test's counter).
  const wallEnd = Date.now() + Math.min(opts.boxMs ?? PRIVACY_PURGE_BOX_MS, PRIVACY_PURGE_BOX_MS);
  const r: PrivacyPurgeReport = { ran: false, done: false, sessions: 0, links: 0, attempts: 0, orphansMarked: 0, orphansCleared: 0, likes: 0, rejects: 0, reservations: 0, /* OPTIONS */ occPositions: 0 };
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
        // Fix round 5 (item 8): ended handle reservations, oldest first, through handle_reservations_until.
        ['reservations', async () => (await conn`delete from handle_reservations where handle in (
          select handle from handle_reservations where until <= ${now} order by until limit ${batch})`).count],
        // OPTIONS: one statement (open_positions holds one row per position, few per trader); reported as a count.
        ['occPositions', () => purgeOccPositions(conn as never)],
        ['orphansCleared', async () => (await conn`delete from privacy_orphans where ctid = any(array(
          select o.ctid from privacy_orphans o
          where (select 1 from closed_trades c where c.trade_key = o.trade_key limit 1) is not null
             or (o.kind = 'like' and (select 1 from trade_likes l where l.viewer_id = o.viewer_id and l.trade_key = o.trade_key limit 1) is null)
             or (o.kind = 'reject' and (select 1 from trade_exclusions x where x.viewer_id = o.viewer_id and x.trade_key = o.trade_key limit 1) is null)
          limit ${batch}))`).count],
        // ponytail: both marking steps walk all of trade_likes / trade_exclusions (two index probes a row) every tick, even
        // when nothing is orphaned — mark orphans when the rebuild drops a close (trade_key) instead of scanning.
        ['orphansMarked', async () => (await conn`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at)
          select 'like', l.viewer_id, l.trade_key, ${now}::timestamptz from trade_likes l
          where not exists (select 1 from closed_trades c where c.trade_key = l.trade_key)
            and (select 1 from privacy_orphans o where o.kind = 'like' and o.viewer_id = l.viewer_id and o.trade_key = l.trade_key limit 1) is null
          limit ${batch} on conflict do nothing`).count],
        ['orphansMarked', async () => (await conn`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at)
          select 'reject', x.viewer_id, x.trade_key, ${now}::timestamptz from trade_exclusions x
          where not exists (select 1 from closed_trades c where c.trade_key = x.trade_key)
            and (select 1 from privacy_orphans o where o.kind = 'reject' and o.viewer_id = x.viewer_id and o.trade_key = x.trade_key limit 1) is null
          limit ${batch} on conflict do nothing`).count],
        ['likes', () => removeDue(conn, 'like', now, batch, () => timeLeft(conn, wallEnd))],
        ['rejects', () => removeDue(conn, 'reject', now, batch, () => timeLeft(conn, wallEnd))],
      ];
      const stepOf = (k: keyof PrivacyPurgeReport): PurgeStep => (k === 'sessions' || k === 'links' || k === 'attempts' || k === 'reservations' ? k : k === 'occPositions' ? 'attempts' : 'orphans');
      for (const [key, step] of steps) {
        if (opts.only && !opts.only.includes(stepOf(key))) continue;
        let marked = 0;
        for (;;) {
          if (clock() >= end) return r;
          const n = stepOf(key) === 'orphans' ? await indexOnly(conn, step, wallEnd) : await step();
          if (n === null) return r; // the batch reached the box's end and rolled back: the next tick resumes
          (r[key] as number) += n;
          if (key === 'orphansMarked') marked += n;
          if (n < batch) break;
        }
        // A large mark leaves privacy_orphans' statistics stale until autovacuum: refresh them now.
        if (marked >= batch) await conn`analyze privacy_orphans`;
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

// Known limit removed 2026-11-01 (orchestrator, from the privacy session; reworked after the orchestrator's review):
// with 200,000 freshly marked orphans and statistics taken while privacy_orphans was nearly empty, the planner joined a
// batch's keys to whole tables row by row (167 s, then 158 s for one batch: a nested loop rescanning the batch per
// orphan), while the box is only checked between batches. Now:
// - every check against privacy_orphans, the table whose statistics go stale, is a scalar `(select 1 … limit 1)`
//   subquery, which the planner cannot pull up into a join (an anti-join materialized every orphan and filtered it per
//   like: quadratic under stale statistics); the closed_trades checks keep the `not exists` form lib/likes.test.ts
//   requires of every statement that marks or removes a like or reject;
// - every orphan batch reads its keys first (the oldest due ones through privacy_orphans_seen, LIMIT batch), looks each
//   one up by primary key (a LIMIT 1 subquery per key) and deletes by row address (ctid = any(array(...)));
// - each batch runs in its own transaction with sequential scans, hash joins, merge joins and materialization off
//   (`set local`, so nothing leaks to the pooled connection), so each lookup and each closed_trades check is an index probe;
// - each batch has a statement timeout of the time left in the box: a batch that would still overrun rolls back and the
//   box ends there (the next tick resumes; nothing half-done).
// lib/privacy-purge.load.test.ts: 220,000 due orphans, statistics taken while empty, every batch far inside the box.
// ponytail: the clearing step walks orphan rows each tick until it finds a batch (linear in privacy_orphans, an index
// probe or three per row) — keep a resume cursor, or unmark orphans from the rebuild when a trade returns.
const PLAN_SAFE = ['enable_seqscan', 'enable_hashjoin', 'enable_mergejoin', 'enable_material'];
// The statement timeout, set to the time left in the box before each statement of a batch (orchestrator review: one
// timeout for a multi-statement batch let it overrun up to its statement count times).
const timeLeft = (conn: ReserveSql, wallEnd: number) =>
  conn`select set_config('statement_timeout', ${String(Math.max(50, wallEnd - Date.now()))}, true)`.then(() => undefined);
async function indexOnly(conn: ReserveSql, step: () => Promise<number>, wallEnd: number): Promise<number | null> {
  await conn`begin`;
  try {
    for (const g of PLAN_SAFE) await conn`select set_config(${g}, 'off', true)`;
    await timeLeft(conn, wallEnd);
    const n = await step();
    await conn`commit`;
    return n;
  } catch (e) {
    await conn`rollback`;
    if ((e as { code?: string }).code === '57014') return null; // statement timeout: the box is spent
    throw e;
  }
}

// The oldest due marks of one kind (gone for ORPHAN_GRACE_DAYS), then their likes or rejects whose trade is still gone,
// then those marks. Each row is found by one primary-key probe per key (a scalar subquery with LIMIT 1, which the planner
// cannot turn into a join over the whole table) and deleted by row address (ctid = any(array(...)), a TID scan): no plan
// choice can rescan a table per row. A mark whose trade came back is left to the clearing step.
async function removeDue(conn: ReserveSql, kind: 'like' | 'reject', now: Date, batch: number, renew: () => Promise<void>): Promise<number> {
  const due = await conn`select viewer_id, trade_key from privacy_orphans
    where kind = ${kind} and first_seen_at < ${now}::timestamptz - ${ORPHAN_GRACE_DAYS} * interval '1 day'
    order by first_seen_at limit ${batch}`;
  if (!due.length) return 0;
  const vs = due.map((d) => d.viewer_id as number), ts = due.map((d) => d.trade_key as string);
  await renew();
  const gone = kind === 'like'
    ? await conn`delete from trade_likes l where l.ctid = any(array(
          select (select y.ctid from trade_likes y where y.viewer_id = k.v and y.trade_key = k.t limit 1) from unnest(${vs}::int[], ${ts}::text[]) as k(v, t)))
        and not exists (select 1 from closed_trades c where c.trade_key = l.trade_key)
        returning l.viewer_id, l.trade_key`
    : await conn`delete from trade_exclusions x where x.ctid = any(array(
          select (select y.ctid from trade_exclusions y where y.viewer_id = k.v and y.trade_key = k.t limit 1) from unnest(${vs}::int[], ${ts}::text[]) as k(v, t)))
        and not exists (select 1 from closed_trades c where c.trade_key = x.trade_key)
        returning x.viewer_id, x.trade_key`;
  if (!gone.length) return 0;
  await renew();
  return (await conn`delete from privacy_orphans where ctid = any(array(
      select (select o.ctid from privacy_orphans o where o.kind = ${kind} and o.viewer_id = k.v and o.trade_key = k.t limit 1)
      from unnest(${gone.map((g) => g.viewer_id as number)}::int[], ${gone.map((g) => g.trade_key as string)}::text[]) as k(v, t)))`).count;
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
