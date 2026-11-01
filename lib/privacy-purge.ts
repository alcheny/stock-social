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
//   - shared Similar-trades pools (lib/similar.ts) idle for a day;
//   - likes and rejected trades whose trade has been gone for 30 days (marked when first seen gone, unmarked if the
//     trade comes back). Preference data with a live trade is never removed on a timer (owner, 2026-11-01).
// Account deletion is separate and removes everything (lib/delete.ts).
import type { ReservedSql } from 'postgres';
import { sql } from './db.ts';

type ReserveSql = ReservedSql<Record<string, never>>;

export const PRIVACY_PURGE_LOCK = 41; // (41, 0). USER_LOCK 1 (lib/sync.ts), ATTEMPT_LOCK 2 (lib/connections.ts), PURGE_LOCK 3 (lib/discovery/purge.ts)
export const PRIVACY_PURGE_BOX_MS = 20_000;
export const PRIVACY_PURGE_BATCH = 5_000;
export const UNFINISHED_SIGNUP_DAYS = 30;
export const ORPHAN_GRACE_DAYS = 30;

export type PrivacyPurgeReport = {
  ran: boolean; done: boolean;
  sessions: number; links: number; attempts: number; similarPools: number; orphansMarked: number; orphansCleared: number; likes: number; rejects: number;
  orphanTimeouts: number; // cursor batches that hit ORPHAN_BATCH_MS and were retried with a smaller window
};

// Known-limits sweep 2 (2026-11-01): the clearing and marking steps walk the trade_key hash space (trade_key is a lowercase
// sha256 hex string, db/schema.sql: closed_trades.trade_key, lib/likes.ts#tradeKey) a window at a time from a cursor
// persisted in privacy_purge_cursors: a position in the first 32 bits of the hash space and a window span, never a key,
// viewer or trade. A window is `trade_key >= lo and trade_key < hi` (hex prefixes computed here), read through
// trade_likes_key, trade_exclusions_key and privacy_orphans_key. Each step spends at most ORPHAN_STEP_MS a call and walks
// at most one lap; each batch has a statement timeout of ORPHAN_BATCH_MS; the span shrinks 16-fold after a timeout and
// halves after a slow batch (so the cursor always moves), and doubles after a fast one. Before: every call walked all of privacy_orphans, trade_likes and trade_exclusions (2-3 index probes
// a row) until the box ended. lib/privacy-purge.load.test.ts: 1,000,000 orphans, one lap in at most 10 calls.
// ponytail: an orphan is seen up to one lap late (measured: a lap over 1,000,000 rows took 7 calls of 5-6 s, from the widest window; two calls an
// hourly tick; the 30-day grace is a floor) — mark from the rebuild when it drops a close (lib/sync.ts#rebuildTrades
// returning the gone trade_keys) instead of a lap.
export const ORPHAN_STEP_MS = 2_500;
// A cursor batch's statement timeout (also capped by the time left in the box): a window learned on a small table is far
// too wide once the table grows (seen in the 1M load test: a whole-space window over 1,000,000 rows ran 11.5 s), so it
// times out early, shrinks by TIMEOUT_SHRINK and the step goes on with the smaller window.
export const ORPHAN_BATCH_MS = 3_000; // under a quarter of the box
const TIMEOUT_SHRINK = 16;
export const CURSOR_SPACE = 2 ** 32;
const FIRST_SPAN = 2 ** 24; // 1/256 of the space: ~4,000 rows a window at 1,000,000 rows
export type OrphanStep = 'clear' | 'mark-like' | 'mark-reject';
type Window = { lo: string; hi: string };
type Batch = { n: number; more: boolean };

// `now`, `only` and `hold` are test hooks (a test runs the dated steps at a past `now`, so other tests' rows are untouched);
// so are `orphanSteps` (which cursor steps run) and `timeoutMs` (a fixed statement timeout).
export type PurgeStep = 'sessions' | 'links' | 'attempts' | 'similar' | 'orphans';
type Opts = {
  boxMs?: number; batch?: number; clock?: () => number; hold?: () => Promise<void>; now?: Date; only?: PurgeStep[];
  orphanSteps?: OrphanStep[]; timeoutMs?: number;
};

// The next window span: cut by TIMEOUT_SHRINK after a timeout, halved after a batch slower than the step's budget,
// doubled after one under an eighth of it.
export function nextSpan(span: number, ms: number, timedOut: boolean): number {
  if (timedOut) return Math.max(1, Math.floor(span / TIMEOUT_SHRINK));
  if (ms > ORPHAN_STEP_MS) return Math.max(1, Math.floor(span / 2));
  if (ms < ORPHAN_STEP_MS / 8) return Math.min(CURSOR_SPACE, span * 2);
  return span;
}
const hex8 = (p: number) => p.toString(16).padStart(8, '0');
// [lo, hi) in text order: the first window starts at '' and the last ends at 'g' (above every lowercase hex string).
const windowOf = (pos: number, span: number): Window => ({ lo: pos === 0 ? '' : hex8(pos), hi: pos + span >= CURSOR_SPACE ? 'g' : hex8(pos + span) });

export async function purgePrivacy(opts: Opts = {}): Promise<PrivacyPurgeReport> {
  const clock = opts.clock ?? Date.now;
  const end = clock() + Math.min(opts.boxMs ?? PRIVACY_PURGE_BOX_MS, PRIVACY_PURGE_BOX_MS);
  const batch = opts.batch ?? PRIVACY_PURGE_BATCH;
  const now = opts.now ?? new Date();
  // The statement timeout of an orphan batch runs on the wall clock (the `clock` hook may be a test's counter).
  const wallEnd = Date.now() + Math.min(opts.boxMs ?? PRIVACY_PURGE_BOX_MS, PRIVACY_PURGE_BOX_MS);
  const limit: Limit = { wallEnd, fixed: opts.timeoutMs };
  const cursorLimit: Limit = { ...limit, cap: ORPHAN_BATCH_MS };
  const r: PrivacyPurgeReport = { ran: false, done: false, sessions: 0, links: 0, attempts: 0, similarPools: 0, orphansMarked: 0, orphansCleared: 0, likes: 0, rejects: 0, orphanTimeouts: 0 };
  const conn = await sql.reserve();
  try {
    const [{ got }] = await conn`select pg_try_advisory_lock(${PRIVACY_PURGE_LOCK}, 0) as got`;
    if (!got) return r;
    r.ran = true;
    try {
      await opts.hold?.();
      const full = (n: number): Batch => ({ n, more: n >= batch });
      // A plain step repeats until a batch says there is no more; the box is checked before every batch.
      const plain: [keyof PrivacyPurgeReport, PurgeStep, () => Promise<Batch>][] = [
        ['sessions', 'sessions', async () => full((await conn`delete from sessions where token_hash in (
          select token_hash from sessions where expires_at < ${now} order by expires_at limit ${batch})`).count)],
        ['links', 'links', async () => full((await conn`delete from login_links where token_hash in (
          select l.token_hash from login_links l left join signup_attempts a on a.id = l.attempt_id
          where l.expires_at <= ${now} or (l.used_at is null and a.completed_at <= ${now}) limit ${batch})`).count)],
        ['attempts', 'attempts', async () => full(await purgeUnfinishedAttempts(now, batch))],
        // Known-limits sweep 2 (similar): shared Similar-trades pools (lib/similar.ts) idle past a day.
        ['similarPools', 'similar', async () => full((await conn`delete from similar_pools where key in (
          select key from similar_pools where coalesce(built_at, claimed_at, hour) < ${now}::timestamptz - interval '1 day' limit ${batch})`).count)],
      ];
      for (const [key, of, step] of plain) {
        if (opts.only && !opts.only.includes(of)) continue;
        for (;;) {
          if (clock() >= end) return r;
          const b = await step();
          (r[key] as number) += b.n;
          if (!b.more) break;
        }
      }
      if (!opts.only || opts.only.includes('orphans')) {
        // A cursor step walks windows until its budget, one lap, or the box ends; a window whose batch filled up is
        // walked again (its done rows no longer match) before the cursor moves past it.
        const cursorSteps: [keyof PrivacyPurgeReport, OrphanStep, (w: Window) => Promise<number>][] = [
          ['orphansCleared', 'clear', async (w) => (await conn`delete from privacy_orphans where ctid = any(array(
            select o.ctid from privacy_orphans o
            where o.trade_key >= ${w.lo} and o.trade_key < ${w.hi}
              and ((select 1 from closed_trades c where c.trade_key = o.trade_key limit 1) is not null
               or (o.kind = 'like' and (select 1 from trade_likes l where l.viewer_id = o.viewer_id and l.trade_key = o.trade_key limit 1) is null)
               or (o.kind = 'reject' and (select 1 from trade_exclusions x where x.viewer_id = o.viewer_id and x.trade_key = o.trade_key limit 1) is null))
            limit ${batch}))`).count],
          ['orphansMarked', 'mark-like', async (w) => (await conn`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at)
            select 'like', l.viewer_id, l.trade_key, ${now}::timestamptz from trade_likes l
            where l.trade_key >= ${w.lo} and l.trade_key < ${w.hi}
              and not exists (select 1 from closed_trades c where c.trade_key = l.trade_key)
              and (select 1 from privacy_orphans o where o.kind = 'like' and o.viewer_id = l.viewer_id and o.trade_key = l.trade_key limit 1) is null
            limit ${batch} on conflict do nothing`).count],
          ['orphansMarked', 'mark-reject', async (w) => (await conn`insert into privacy_orphans (kind, viewer_id, trade_key, first_seen_at)
            select 'reject', x.viewer_id, x.trade_key, ${now}::timestamptz from trade_exclusions x
            where x.trade_key >= ${w.lo} and x.trade_key < ${w.hi}
              and not exists (select 1 from closed_trades c where c.trade_key = x.trade_key)
              and (select 1 from privacy_orphans o where o.kind = 'reject' and o.viewer_id = x.viewer_id and o.trade_key = x.trade_key limit 1) is null
            limit ${batch} on conflict do nothing`).count],
        ];
        for (const [key, name, work] of cursorSteps) {
          if (opts.orphanSteps && !opts.orphanSteps.includes(name)) continue;
          await conn`insert into privacy_purge_cursors (step, span) values (${name}, ${FIRST_SPAN}) on conflict (step) do nothing`;
          const [c] = await conn`select pos::float8 as pos, span::float8 as span from privacy_purge_cursors where step = ${name}`;
          let pos = c.pos as number, span = c.span as number, covered = 0, marked = 0;
          const stepEnd = clock() + ORPHAN_STEP_MS;
          while (covered < CURSOR_SPACE) {
            if (clock() >= end) return r;
            if (clock() >= stepEnd) break;
            const t0 = Date.now();
            const b = await indexOnly(conn, async () => {
              const k = await work(windowOf(pos, span));
              const next = nextSpan(span, Date.now() - t0, false);
              // A full batch leaves the cursor on this window; otherwise it moves past it (wrapping at the end of the space).
              const to = k >= batch ? pos : pos + span >= CURSOR_SPACE ? 0 : pos + span;
              await timeLeft(conn, cursorLimit);
              await conn`update privacy_purge_cursors set pos = ${to}, span = ${next}, laps = laps + ${k < batch && to === 0 ? 1 : 0}, updated_at = now() where step = ${name}`;
              return { k, to, next };
            }, cursorLimit);
            if (b === null) {
              // The batch hit its timeout and rolled back: a smaller window (persisted, so the cursor always moves), then
              // on with this step unless the box is spent.
              span = nextSpan(span, 0, true);
              r.orphanTimeouts++;
              await conn`update privacy_purge_cursors set span = ${span}, updated_at = now() where step = ${name}`;
              if (Date.now() >= wallEnd - 50) return r;
              continue;
            }
            const n = b.k;
            if (n < batch) { covered += Math.min(span, CURSOR_SPACE - pos); pos = b.to; } // the last window ends at the space's end
            span = b.next;
            (r[key] as number) += n;
            if (key === 'orphansMarked') marked += n;
          }
          // A large mark leaves privacy_orphans' statistics stale until autovacuum: refresh them now.
          // Bounded: a lock held by a vacuum or an index build skips it (it never holds up the purge).
          if (marked >= batch) await analyzeOrphans(conn);
        }
        for (const [key, kind] of [['likes', 'like'], ['rejects', 'reject']] as const) {
          for (;;) {
            if (clock() >= end) return r;
            const b = await indexOnly(conn, () => removeDue(conn, kind, now, batch, () => timeLeft(conn, limit)), limit);
            if (b === null) return r;
            r[key] += b.n;
            if (!b.more) break;
          }
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

// Known limit removed 2026-11-01 (orchestrator, from the privacy session; reworked after the orchestrator's review):
// with 200,000 freshly marked orphans and statistics taken while privacy_orphans was nearly empty, the planner joined a
// batch's keys to whole tables row by row (167 s, then 158 s for one batch: a nested loop rescanning the batch per
// orphan), while the box is only checked between batches. Now:
// - every check against privacy_orphans, the table whose statistics go stale, is a scalar `(select 1 … limit 1)`
//   subquery, which the planner cannot pull up into a join (an anti-join materialized every orphan and filtered it per
//   like: quadratic under stale statistics); the closed_trades checks keep the `not exists` form lib/likes.test.ts
//   requires of every statement that marks or removes a like or reject;
// - every orphan batch reads its keys first (the oldest due ones through privacy_orphans_seen, LIMIT batch, or a window
//   of the hash space through a trade_key index), looks each one up by primary key (a LIMIT 1 subquery per key) and
//   deletes by row address (ctid = any(array(...)));
// - each batch runs in its own transaction with sequential scans, bitmap scans, sorts, hash joins, merge joins and
//   materialization off (`set local`, so nothing leaks to the pooled connection), so each lookup, window and
//   closed_trades check is a plain index probe or ordered index range (a bitmap scan plus sort of a window, chosen under
//   stale statistics, would read the whole range first);
// - each batch has a statement timeout of the time left in the box: a batch that would still overrun rolls back and the
//   box ends there (the next tick resumes; nothing half-done).
// lib/privacy-purge.load.test.ts: 220,000 due orphans, statistics taken while empty, every batch far inside the box.
const PLAN_SAFE = ['enable_seqscan', 'enable_bitmapscan', 'enable_sort', 'enable_hashjoin', 'enable_mergejoin', 'enable_material'];
// The statement timeout, set to the time left in the box before each statement of a batch (orchestrator review: one
// timeout for a multi-statement batch let it overrun up to its statement count times).
type Limit = { wallEnd: number; fixed?: number; cap?: number };
const timeLeft = (conn: ReserveSql, l: Limit) =>
  conn`select set_config('statement_timeout', ${String(l.fixed ?? Math.max(50, Math.min(l.cap ?? Infinity, l.wallEnd - Date.now())))}, true)`.then(() => undefined);
async function indexOnly<T>(conn: ReserveSql, step: () => Promise<T>, l: Limit): Promise<T | null> {
  await conn`begin`;
  try {
    for (const g of PLAN_SAFE) await conn`select set_config(${g}, 'off', true)`;
    await timeLeft(conn, l);
    const n = await step();
    await conn`commit`;
    return n;
  } catch (e) {
    await conn`rollback`;
    if ((e as { code?: string }).code === '57014') return null; // statement timeout: the box is spent
    throw e;
  }
}

async function analyzeOrphans(conn: ReserveSql): Promise<void> {
  await conn`begin`;
  try {
    await conn`select set_config('lock_timeout', '2000', true)`;
    await conn`analyze privacy_orphans`;
    await conn`commit`;
  } catch (e) {
    await conn`rollback`;
    if ((e as { code?: string }).code !== '55P03') throw e; // lock timeout: the next large mark analyzes
  }
}

// The oldest due marks of one kind (gone for ORPHAN_GRACE_DAYS), then their likes or rejects whose trade is still gone,
// then every mark of the batch that is done (its like is gone or its trade came back), so a full batch of marks whose
// trade came back can never hold back the due marks behind it (before: they stayed until the clearing step reached them). Each row is found by one primary-key probe per key (a scalar
// subquery with LIMIT 1, which the planner cannot turn into a join over the whole table) and deleted by row address
// (ctid = any(array(...)), a TID scan): no plan choice can rescan a table per row. `n` counts the likes or rejects
// removed; `more` says a full batch of due marks was read (the next batch may hold more).
async function removeDue(conn: ReserveSql, kind: 'like' | 'reject', now: Date, batch: number, renew: () => Promise<void>): Promise<Batch> {
  const due = await conn`select viewer_id, trade_key from privacy_orphans
    where kind = ${kind} and first_seen_at < ${now}::timestamptz - ${ORPHAN_GRACE_DAYS} * interval '1 day'
    order by first_seen_at limit ${batch}`;
  if (!due.length) return { n: 0, more: false };
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
  // The window's marks that are done: their like or reject is gone (just removed, or removed by the viewer) or their
  // trade came back.
  await renew();
  if (kind === 'like') {
    await conn`delete from privacy_orphans where ctid = any(array(
      select (select o.ctid from privacy_orphans o where o.kind = 'like' and o.viewer_id = k.v and o.trade_key = k.t limit 1)
      from unnest(${vs}::int[], ${ts}::text[]) as k(v, t)
      where (select 1 from closed_trades c where c.trade_key = k.t limit 1) is not null
         or (select 1 from trade_likes y where y.viewer_id = k.v and y.trade_key = k.t limit 1) is null))`;
  } else {
    await conn`delete from privacy_orphans where ctid = any(array(
      select (select o.ctid from privacy_orphans o where o.kind = 'reject' and o.viewer_id = k.v and o.trade_key = k.t limit 1)
      from unnest(${vs}::int[], ${ts}::text[]) as k(v, t)
      where (select 1 from closed_trades c where c.trade_key = k.t limit 1) is not null
         or (select 1 from trade_exclusions y where y.viewer_id = k.v and y.trade_key = k.t limit 1) is null))`;
  }
  return { n: gone.length, more: due.length >= batch };
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
