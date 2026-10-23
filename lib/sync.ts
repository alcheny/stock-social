import { sql } from './db.ts';
import type { TransactionSql } from 'postgres';
import { fetchActivities, fetchActivitiesPage, fetchPositions, listAccounts, PAGE_LIMIT, VENDOR_TIMEOUT_MS } from './broker.ts';
import { AccountClaimedError, claimIn } from './claims.ts';
import { reattachTheses, type KeptThesis } from './theses.ts';
import { matchTrades, type Activity } from './trades.ts';
import { replacePositions } from './positions.ts';

const BACKFILL_MS = 7 * 86_400_000; // brokers post late corrections; re-read the last week
// Per-user advisory lock (F-1: a sync is one transaction; a second one for the same user waits or is skipped).
export const USER_LOCK = 1;
type Db = TransactionSql | typeof sql;

// PR-3 (heavy-use defect 1): one statement carries at most 65,534 parameters. An activity row binds 11 and a closed trade
// 11, so a whole history in one insert failed past ~5,950 rows (a 10,000-activity first sync; a record with more than
// ~5,950 closes). Every bulk insert is chunked at this many rows (11,000 parameters).
export const INSERT_CHUNK = 1000;
// PR-3 (heavy-use, memory): the rebuild reads activities a page at a time, never a whole history at once.
export const REBUILD_PAGE = 1000;
// F-1 PR-3 fix round 6 (engineer re-sit, Medium): the vendor's trade date reaches the database unchecked, and a trade
// dated in the future cannot be a closed trade. An activity dated more than FUTURE_GRACE_HOURS after the database clock
// (a day: time zones and a vendor posting the next session's date) is quarantined: its raw row is kept (activities are
// immutable), the rebuild never matches or publishes it, and it is counted in `users.excluded_future` (shown on the
// profile with its reason). It is re-checked on every rebuild, so a date the vendor corrects comes back on the next sync.
export const FUTURE_GRACE_HOURS = 24;
const notFuture = (db: Db) => db`executed_at <= now() + ${FUTURE_GRACE_HOURS}::float8 * interval '1 hour'`;

export async function insertActivities(userId: number, source: 'snaptrade' | 'demo', acts: (Activity & { raw: unknown })[], db: Db = sql) {
  for (let i = 0; i < acts.length; i += INSERT_CHUNK) {
    const rows = acts.slice(i, i + INSERT_CHUNK).map((a) => ({
      user_id: userId, source, external_id: a.externalId, account_id: a.accountId, symbol: a.symbol,
      side: a.side, units: a.units, price: a.price, fee: a.fee, executed_at: a.executedAt, raw: db.json(a.raw as never),
    }));
    await db`insert into activities ${db(rows)} on conflict (source, external_id) do nothing`;
  }
}

// Recompute a user's closed trades from raw activities. Theses survive via sell_id. Runs in the caller's transaction
// when given one (an import step, a sync), else in its own.
// Reviewer fix (plan §4/§9): an account the vendor flags as simulated, even on a later sync after a real import, never
// feeds the record. Its raw activities stay (immutable), but the rebuild leaves them out, so its trades leave the
// Verified record while the profile counts the account as a simulated account excluded. A flag cleared again by the
// vendor brings them back on the next rebuild.
// PR-3 (heavy-use): FIFO lots never cross an (account, symbol) pair, so the rebuild streams the activities in that
// order, REBUILD_PAGE rows per query (keyset pages, no raw payload read), matches each pair as soon as it is complete
// and writes its closes in chunks. Memory holds one page plus the pair still open at the page's end, never the whole
// history. The order is total (account, symbol, time, then the vendor's id), so same-instant rows always match the same
// way and repeated rebuilds give byte-identical rows (defect 3: the read had no order at all). Returns what it wrote and
// the most activity rows it held at once.
type PairRow = { account_id: string; symbol: string; executed_at: Date; at: string; external_id: string; side: 'BUY' | 'SELL'; units: number; price: number; fee: number; source: string };
export async function rebuildTrades(userId: number, tx?: TransactionSql): Promise<{ trades: number; excluded: number; future: number; maxHeld: number }> {
  const run = async (tx: TransactionSql) => {
    // Reviewer fix round 2: a rebuild never deletes a thesis. One whose trade is not produced now (its account is flagged
    // simulated, a vendor correction) is kept in kept_theses by sell_id, shown nowhere, and re-attached when the trade
    // returns. Kept rows come first, so a thesis on a current closed_trades row always wins its sell_id; saveThesis
    // removes the kept row when the trader edits or clears that thesis, so a cleared thesis never comes back.
    const aside = await tx`select sell_id, thesis, thesis_status from kept_theses where user_id = ${userId}`;
    const live = await tx`select sell_id, thesis, thesis_status from closed_trades where user_id = ${userId} and thesis is not null`;
    const kept = [...aside, ...live] as unknown as KeptThesis[];
    const attachedIds = new Set<string>();
    await tx`delete from closed_trades where user_id = ${userId}`;
    let written = 0, excluded = 0, maxHeld = 0;
    const flush = async (rows: Activity[]) => {
      if (!rows.length) return;
      const m = matchTrades(rows);
      excluded += m.excluded;
      const { attached } = reattachTheses(kept, m.trades);
      for (let i = 0; i < m.trades.length; i += INSERT_CHUNK) {
        await tx`insert into closed_trades ${tx(m.trades.slice(i, i + INSERT_CHUNK).map((t) => {
          const k = attached.get(t.sellId);
          if (k) attachedIds.add(t.sellId);
          return {
            user_id: userId, sell_id: t.sellId, account_id: t.accountId, symbol: t.symbol, opened_at: t.openedAt,
            closed_at: t.closedAt, return_pct: t.returnPct, holding_days: t.holdingDays, verified: t.verified,
            thesis: k?.thesis ?? null, thesis_status: k?.thesis_status ?? null,
          };
        }))}`;
      }
      written += m.trades.length;
    };
    let open: Activity[] = []; // the (account, symbol) pair the last page ended in
    // PR-3 fix round 4 (engineer note): the key is the whole unique row key, source included; without it two sources
    // sharing a vendor id at a page boundary lost a row.
    let after: { account_id: string; symbol: string; at: string; external_id: string; source: string } | null = null;
    for (;;) {
      const page: PairRow[] = await tx<PairRow[]>`select account_id, symbol, executed_at, executed_at::text as at, external_id, side, units, price, fee, source
        from activities a where a.user_id = ${userId}
        and not exists (select 1 from broker_accounts b where b.account_id = a.account_id and b.user_id = ${userId} and b.is_paper)
        and ${notFuture(tx)}
        ${after ? tx`and (a.account_id, a.symbol, a.executed_at, a.external_id, a.source) > (${after.account_id}, ${after.symbol}, ${after.at}::timestamptz, ${after.external_id}, ${after.source})` : tx``}
        order by a.account_id, a.symbol, a.executed_at, a.external_id, a.source limit ${REBUILD_PAGE}`;
      for (const r of page) {
        const a: Activity = {
          externalId: r.external_id, accountId: r.account_id, symbol: r.symbol, side: r.side, units: r.units,
          price: r.price, fee: r.fee, executedAt: r.executed_at, verified: r.source === 'snaptrade',
        };
        if (open.length && (open[0].accountId !== a.accountId || open[0].symbol !== a.symbol)) { await flush(open); open = []; }
        open.push(a);
        maxHeld = Math.max(maxHeld, open.length + page.length);
      }
      if (page.length < REBUILD_PAGE) break;
      const last: PairRow = page[page.length - 1];
      after = { account_id: last.account_id, symbol: last.symbol, at: last.at, external_id: last.external_id, source: last.source };
    }
    await flush(open);
    const setAside = live.filter((k) => !attachedIds.has(k.sell_id as string));
    if (setAside.length) {
      await tx`insert into kept_theses ${tx(setAside.map((k) => ({ user_id: userId, sell_id: k.sell_id, thesis: k.thesis, thesis_status: k.thesis_status })))}
        on conflict (user_id, sell_id) do update set thesis = excluded.thesis, thesis_status = excluded.thesis_status`;
    }
    const [{ future }] = await tx`select count(*)::int as future from activities a where a.user_id = ${userId} and not (${notFuture(tx)})
      and not exists (select 1 from broker_accounts b where b.account_id = a.account_id and b.user_id = ${userId} and b.is_paper)`;
    await tx`update users set excluded_positions = ${excluded}, excluded_future = ${future}, last_synced_at = now() where id = ${userId}`;
    return { trades: written, excluded, future: future as number, maxHeld };
  };
  return tx ? run(tx) : sql.begin(run);
}

type Broker = {
  listAccounts: typeof listAccounts; // with the authorization, paper and sync flags
  fetchActivities: typeof fetchActivities;
  // PR-3 (heavy-use): a sync with no stored history reads it page by page (one page held at a time) when available.
  fetchActivitiesPage?: typeof fetchActivitiesPage;
  fetchPositions?: typeof fetchPositions;
  pageLimit?: number;
};
const defaultBroker: Broker = { listAccounts, fetchActivities, fetchActivitiesPage, fetchPositions };

export type SyncableUser = { id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null };
// The hourly sync's users (F-1, COMPLIANCE §3 consent at collection): a trader is synced only once a connection is
// `connected`, and never while an import runs (the tick's steps own that row). A pending link, a failed import and a
// profile being deleted are never synced.
const syncable = () => sql`u.snaptrade_user_id is not null and u.deleted_at is null
    and exists (select 1 from connections c where c.user_id = u.id and c.state = 'connected')
    and not exists (select 1 from connections c where c.user_id = u.id and c.state = 'importing')`;
export async function usersToSync(): Promise<SyncableUser[]> {
  return sql<SyncableUser[]>`select id, snaptrade_user_id, snaptrade_secret_enc from users u where ${syncable()} order by last_synced_at nulls first`;
}

// PR-3 (heavy-use defect 2): the hourly sync tick, safe to run from any number of callers at once (overlapping cron
// calls, retries, several instances). Before, each caller listed every trader and synced them all, so N callers synced
// each trader N times (the per-user lock only skipped calls that overlapped in time).
// Fix round 2 (tester's re-run 1): the claim is keyed on a round read from the database clock, and rounds run from :30
// to :30, half an hour away from the cron's :00. The rule:
//   - one clock: every claim and lease decision uses `now()` inside the claim statement, never the calling instance's
//     clock, so instance skew, a scheduler firing a moment early or late, and leases written by another instance all
//     compare against the same time;
//   - at most once per round: a trader is claimed only if `sync_claimed_at` is before the start of the current round
//     (the latest :30 at or before now, UTC). Any call within ±30 minutes of a :00 cron mark lands in that mark's round;
//   - per claim, not per tick: each claim reads the round when it runs, so a tick that runs across :30 claims under the
//     new round from then on (its earlier claims stay in the old one);
//   - at least once per round while any tick runs in it: every tick claims every trader not yet claimed this round;
//   - never two at once: a claim also takes a short in-flight lease (`sync_lease_until`), released when the sync ends or
//     fails; a leased trader is never claimed (`for update skip locked` keeps concurrent claims apart, and the per-user
//     advisory lock in syncUser still prevents interleaving when a lease lapses mid-sync). A caller that dies leaves its
//     lease to lapse after SYNC_LEASE_MS; that trader is then claimable again in the same round, since its sync never
//     finished;
//   - an import in progress is never claimed (`syncable`).
// A failed sync keeps its round claim, so it is retried next round.
// Fix round 3 (tester's re-run 2, row 14): a sync skipped because another sync still holds the per-user lock (a lease
// that lapsed mid-sync) puts back the claim it replaced, so it never takes the trader's round: when the lapse crosses
// :30, the next round's ticks still claim and read the trader once the holder finishes. The tick that was skipped does
// not claim that trader again (it would only be skipped again). Every vendor request is also bounded far below the lease
// (VENDOR_TIMEOUT_MS in lib/broker.ts), so a hung vendor call no longer holds the lock past it.
export const SYNC_LEASE_MS = 10 * 60_000; // far above one trader's sync (under 1 s for a 10,000-activity record)
export const ROUND_MS = 3_600_000;
export const ROUND_OFFSET_MS = 30 * 60_000; // rounds start at :30, away from the hourly cron's :00
// `prev` is the round claim this claim replaced (database text, microseconds), put back if the sync is skipped.
export type ClaimedUser = SyncableUser & { lease: string; prev: string | null };
// `shiftMs` and `ids` are test hooks: tests run in a past round by shifting the database clock, and claim only their
// own traders. Production calls pass neither (shift 0: the database clock as is; every syncable trader). `except` is
// the tick's own list of traders it was skipped on.
// `maxAccounts` (fix round 6): only traders whose consented real accounts, capped at SYNC_FIT_CAP, are at most this many.
export type ClaimScope = { shiftMs?: number; ids?: number[]; except?: number[]; maxAccounts?: number };
// The database clock (shifted by the test hook) and the start of its round; and the claim rule over them.
const clockSql = (shiftMs: number) => sql`select now() + ${shiftMs}::float8 * interval '1 millisecond' as t,
        date_trunc('hour', now() + ${shiftMs}::float8 * interval '1 millisecond' - ${ROUND_OFFSET_MS}::float8 * interval '1 millisecond', 'UTC')
          + ${ROUND_OFFSET_MS}::float8 * interval '1 millisecond' as round_start`;
const claimable = () => sql`(u.sync_lease_until is null or u.sync_lease_until <= clock.t)
        and (u.sync_claimed_at is null or u.sync_claimed_at < clock.round_start or u.sync_lease_until is not null)`;
// A trader's real accounts under its connected connections' snapshots (what a sync reads; paper accounts are not read).
const accountsOf = () => sql`(select count(*) from connections c, jsonb_array_elements(c.accounts) a
        where c.user_id = u.id and c.state = 'connected' and coalesce((a->>'isPaper')::boolean, false) = false)`;
export async function claimNextUser(scope: ClaimScope = {}): Promise<ClaimedUser | null> {
  const { shiftMs = 0, ids, except, maxAccounts } = scope;
  if (ids && !ids.length) return null;
  if (maxAccounts !== undefined && maxAccounts < 0) return null;
  const [u] = await sql<ClaimedUser[]>`with clock as (${clockSql(shiftMs)})
    update users set sync_claimed_at = clock.t, sync_lease_until = clock.t + ${SYNC_LEASE_MS}::float8 * interval '1 millisecond'
    from clock, (
      select u.id, u.sync_claimed_at::text as prev from users u, clock where ${syncable()} ${ids ? sql`and u.id in ${sql(ids)}` : sql``}
        ${except?.length ? sql`and u.id not in ${sql(except)}` : sql``}
        ${maxAccounts !== undefined ? sql`and least(${accountsOf()}, ${SYNC_FIT_CAP}) <= ${maxAccounts}` : sql``}
        and ${claimable()}
      order by u.last_synced_at nulls first, u.id limit 1 for update of u skip locked) pick
    where users.id = pick.id
    returning users.id, users.snaptrade_user_id, users.snaptrade_secret_enc, users.sync_lease_until::text as lease, pick.prev`;
  return u ?? null;
}
// A skipped sync gives the round back: the claim it replaced is restored and its lease ended, only while the lease is
// still this claim's (a newer claim is left alone). The lease is not restored: the sync holding the lock is the one
// running, and once it ends the trader must be claimable by any tick in a round it has not been claimed in.
export async function restoreClaim(u: ClaimedUser) {
  await sql`update users set sync_claimed_at = ${u.prev}::text::timestamptz, sync_lease_until = null
    where id = ${u.id} and sync_lease_until = ${u.lease}::text::timestamptz`;
}
// Ends a claim's in-flight lease (only that claim's: a newer lease taken after this one lapsed is left alone). The lease
// is compared as the database wrote it (microseconds), never through a millisecond Date.
export async function releaseClaim(u: ClaimedUser) {
  // `::text` first: a bare `::timestamptz` parameter goes through a millisecond Date in the driver and never matches.
  await sql`update users set sync_lease_until = null where id = ${u.id} and sync_lease_until = ${u.lease}::text::timestamptz`;
}
// Syncable traders (in scope) no tick has claimed this round yet, and none holds: what is left for later calls.
export async function unclaimedCount(scope: ClaimScope = {}): Promise<number> {
  const { shiftMs = 0, ids } = scope;
  if (ids && !ids.length) return 0;
  const [{ n }] = await sql`with clock as (${clockSql(shiftMs)})
    select count(*)::int as n from users u, clock where ${syncable()} ${ids ? sql`and u.id in ${sql(ids)}` : sql``} and ${claimable()}`;
  return n as number;
}

// F-1 PR-3 fix round 4 (business lead 3): one call must fit one function duration. The cron route declares
// `maxDuration = SYNC_ROUTE_MAX_S` (app/api/sync/route.ts: 300 s, the host's default and its lowest plan's ceiling), and
// the tick stops claiming SYNC_RESERVE_MS (three vendor bounds) before the end, so a sync claimed just before the cut-off
// has 90 s to finish. A sync that still overruns is stopped with the function: its transaction rolls back and its lease
// lapses, so a later call (the cron runs every 5 minutes) syncs it in the same round. Traders left unclaimed when a call
// stops are counted in the log (a number, no personal data) so a round that does not cover everyone is visible.
export const SYNC_ROUTE_MAX_S = 300;
export const SYNC_RESERVE_MS = 3 * VENDOR_TIMEOUT_MS;
export const syncDeadline = (startedAt: number) => startedAt + SYNC_ROUTE_MAX_S * 1000 - SYNC_RESERVE_MS;
// F-1 PR-3 fix round 6 (engineer re-sit, Low): the fixed reserve fit a one-account sync only. A sync of n accounts makes
// up to 1 + 2n vendor requests (the account list, then each account's activities and positions), so the tick sizes the
// reserve per trader: it claims a trader only if (1 + 2n) vendor bounds fit before the route's end (`routeEnd`), and
// leaves the others unclaimed (counted in the log) for the next call, which starts with the whole budget. n is capped at
// SYNC_FIT_CAP, the most a whole call fits, so a trader with more accounts is still claimed, at the start of a call.
// ponytail: past SYNC_FIT_CAP accounts (or an activity read over one vendor page per account) a sync can still overrun;
// it then rolls back and its lease lapses, as before. Next step: split the sync per account like the import.
export const syncRouteEnd = (startedAt: number) => startedAt + SYNC_ROUTE_MAX_S * 1000;
export const syncCost = (accounts: number) => (1 + 2 * accounts) * VENDOR_TIMEOUT_MS;
export const SYNC_FIT_CAP = Math.floor((SYNC_ROUTE_MAX_S * 1000 / VENDOR_TIMEOUT_MS - 1) / 2);
export const accountsThatFit = (remainingMs: number) => Math.floor((remainingMs / VENDOR_TIMEOUT_MS - 1) / 2);

// `deadline` (epoch ms on `clock`, the instance's own clock: it measures this call's duration only) stops claiming
// once reached; `report` receives what the end-of-call log line says; `clock`, `release` and the rest are test hooks.
export type TickReport = { ok: number; skipped: number; failed: number; unclaimed: number | null; stoppedAtDeadline: boolean };
export async function syncTick<R>(opts: {
  sync?: (u: SyncableUser) => Promise<R>; ids?: number[]; clockShiftMs?: () => number;
  deadline?: number; routeEnd?: number; clock?: () => number; release?: (u: ClaimedUser) => Promise<void>; report?: (r: TickReport) => void;
} = {}) {
  const sync = opts.sync ?? ((u: SyncableUser) => syncUser(u));
  const clock = opts.clock ?? Date.now;
  const deadline = opts.deadline ?? Infinity;
  const release = opts.release ?? releaseClaim;
  const passed: number[] = []; // skipped by this tick: the lock's holder syncs them, so they are not claimed again here
  const routeEnd = opts.routeEnd ?? Infinity;
  let fit = SYNC_FIT_CAP; // the most accounts the last claim allowed
  const claim = () => {
    fit = routeEnd === Infinity ? SYNC_FIT_CAP : Math.min(SYNC_FIT_CAP, accountsThatFit(routeEnd - clock()));
    return claimNextUser({ ids: opts.ids, shiftMs: opts.clockShiftMs?.() ?? 0, except: passed, ...(routeEnd === Infinity ? {} : { maxAccounts: fit }) });
  };
  let ok = 0, skipped = 0, stopped = false;
  const failed: number[] = [];
  for (;;) {
    if (clock() >= deadline) { stopped = true; break; }
    const u = await claim();
    if (!u) break;
    try {
      if ((await sync(u)) === 'skipped') {
        skipped++;
        passed.push(u.id);
        await restoreClaim(u);
      } else ok++;
    } catch (e) {
      failed.push(u.id);
      console.error('sync failed', u.id, e instanceof Error ? e.message : e);
    } finally {
      // PR-3 fix round 4 (engineer note): a database connection lost here must not abort the tick (the route would
      // answer 500 and the traders after this one would go unsynced by this call). The lease is left to lapse after
      // SYNC_LEASE_MS; a lapsed lease makes the trader claimable again, so at worst it is synced once more that round
      // (a re-sync is idempotent: the last week re-read, the same rows).
      try { await release(u); } catch (e) { console.error('sync lease release failed', u.id, e instanceof Error ? e.message : e); }
    }
  }
  let unclaimed: number | null = null;
  try { unclaimed = await unclaimedCount({ ids: opts.ids, shiftMs: opts.clockShiftMs?.() ?? 0 }); } catch (e) { console.error('sync unclaimed count failed', e instanceof Error ? e.message : e); }
  // Traders left because they did not fit the time left are a stop at the deadline too.
  if (!stopped && fit < SYNC_FIT_CAP && (unclaimed ?? 0) > 0) stopped = true;
  const report: TickReport = { ok, skipped, failed: failed.length, unclaimed, stoppedAtDeadline: stopped };
  console.log('sync tick', JSON.stringify(report)); // counts only
  opts.report?.(report);
  return { ok, skipped, failed };
}

// One transaction per user under the per-user advisory lock: a concurrent sync for the same user is skipped and a
// failure anywhere leaves activities, closed_trades, claims and positions exactly as before.
// Only accounts under a consented authorization (one in the snapshot of a `connected` connection) are read or claimed:
// a pending link, a link still in the portal and a failed import's accounts are left exactly as they are (D1, D5).
// Returns the activity count, 'skipped' when another sync holds the lock; throws AccountClaimedError (writing nothing)
// if any account belongs to another profile. Simulated accounts are claimed, excluded and counted; never imported.
export async function syncUser(
  user: { id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null },
  broker: Broker = defaultBroker,
  rebuild: (userId: number, tx: TransactionSql) => Promise<unknown> = rebuildTrades,
  now = new Date(),
): Promise<number | 'skipped'> {
  if (!user.snaptrade_user_id || !user.snaptrade_secret_enc) return 0;
  const bu = { snaptradeUserId: user.snaptrade_user_id, secretEnc: user.snaptrade_secret_enc };
  return sql.begin(async (tx) => {
    const [{ got }] = await tx`select pg_try_advisory_xact_lock(${USER_LOCK}, ${user.id}) as got`;
    if (!got) return 'skipped';
    const consented = new Set((await tx`select a->>'authorizationId' as auth from connections c, jsonb_array_elements(c.accounts) a
      where c.user_id = ${user.id} and c.state = 'connected'`).map((r) => r.auth as string));
    const accounts = (await broker.listAccounts(bu)).filter((a) => consented.has(a.authorizationId));
    // Claim first so no conflicting data is ever read for the wrong user. Zero-activity accounts are claimed too.
    if (accounts.length && !(await claimIn(tx, user.id, accounts, { confirmed: true, now })).ok) throw new AccountClaimedError();
    const real = accounts.filter((a) => !a.isPaper).map((a) => a.id);
    // TR-5: a connection whose accounts the vendor no longer lists is disconnected; its record stays, frozen.
    await tx`update connections c set disconnected_at = ${now} where c.user_id = ${user.id} and c.state = 'connected' and c.disconnected_at is null
      and not exists (select 1 from jsonb_array_elements(c.accounts) a where a->>'id' in ${tx(accounts.length ? accounts.map((a) => a.id) : [''])})`;
    // Nothing consented is listed: no read, no rebuild, no positions (a failed import's pages are never published by a sync).
    if (!accounts.length) return 0;
    // Fix round 6: a quarantined future date never sets the re-read window (it would skip the real last week).
    const [{ last }] = await tx`select max(executed_at) as last from activities where user_id = ${user.id} and source = 'snaptrade' and ${notFuture(tx)}`;
    let read = 0;
    if (!last && broker.fetchActivitiesPage) {
      // No stored history (a pre-F-1 record): the whole history, one vendor page per insert, never held at once.
      const limit = broker.pageLimit ?? PAGE_LIMIT;
      for (const id of real) {
        for (let offset = 0; ; offset += limit) {
          const page = await broker.fetchActivitiesPage(bu, id, offset, limit);
          await insertActivities(user.id, 'snaptrade', page.activities, tx);
          read += page.activities.length;
          if (page.done) break;
        }
      }
    } else {
      // The hourly case: the last week before the newest stored activity (bounded by a week of trading, not the history).
      const since = last ? new Date(last.getTime() - BACKFILL_MS) : new Date('2000-01-01');
      const acts = real.length ? await broker.fetchActivities(bu, since, real) : [];
      await insertActivities(user.id, 'snaptrade', acts, tx);
      read = acts.length;
    }
    await rebuild(user.id, tx);
    if (broker.fetchPositions) {
      const positions = [];
      for (const id of real) for (const p of await broker.fetchPositions(bu, id)) positions.push({ accountId: id, symbol: p.symbol, unrealizedPct: p.unrealizedPct });
      await replacePositions(tx, user.id, positions);
    }
    return read;
  });
}

// Cron loop: one user's failure (incl. AccountClaimedError) never stops the rest. Logs the user id only.
export async function syncAll<U extends { id: number }>(users: U[], sync: (u: U) => Promise<unknown>) {
  let ok = 0;
  const failed: number[] = [];
  for (const u of users) {
    try {
      await sync(u);
      ok++;
    } catch (e) {
      failed.push(u.id);
      console.error('sync failed', u.id, e instanceof Error ? e.message : e);
    }
  }
  return { ok, failed };
}
