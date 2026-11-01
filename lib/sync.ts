import { sql } from './db.ts';
import type { TransactionSql } from 'postgres';
import { fetchActivities, fetchActivitiesPage, fetchPositions, fetchShareMoves, listAccounts, PAGE_LIMIT, VENDOR_TIMEOUT_MS } from './broker.ts';
import { AccountClaimedError, claimIn } from './claims.ts';
import { notShared } from './shared-accounts.ts';
import { reattachTheses, type KeptThesis } from './theses.ts';
import { matchTrades, type Activity } from './trades.ts';
import { actionIndex, chainsOf, insertCorporateActions, loadCorporateActions, pairKey } from './corporate-actions.ts';
import { replaceAccountPositions, replacePositions, settleAccountPositions } from './positions.ts';
import { decide, dueSql, writeMarks, type DueFlags } from './sync-cadence.ts';
import { logSafe } from './privacy-log.ts';
// OPTIONS (docs/features/logs/options/plan.md D1, D4, AC 11): option rows are stored beside the share rows, the record is
// rebuilt by rebuildRecord (rebuildTrades, unchanged, then the option steps) and the re-read window covers both tables.
import { insertOptionActivities, lastOptionActivityAt, markBackfilled, pendingBackfill, rebuildRecord, replaceAccountOptionPositions, replaceOptionPositions, saveBackfill } from './options-sync.ts';
import type { OptionRow } from './options.ts';
import type { PositionSplit } from './broker.ts';

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
export async function rebuildTrades(userId: number, tx?: TransactionSql): Promise<{ trades: number; excluded: number; future: number; maxHeld: number; excludedCorporate: number }> {
  const run = async (tx: TransactionSql) => {
    // F-7: a public filer's trades come from its filings only (lib/public-trades.ts); this rebuild never touches them.
    if ((await tx`select 1 from users where id = ${userId} and public_filer_id is not null`).length) throw new Error('public filer: not a broker record');
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
    // Corporate actions (POLICY F3c): the user's actions, read once. Pairs linked by a symbol change form a chain, skipped
    // by the stream below and matched together afterwards (one query per chain); account-wide actions reach every pair.
    const actions = await loadCorporateActions(tx, userId, notFuture(tx));
    const chainOf = chainsOf(actions);
    const actionsOf = actionIndex(actions);
    let excludedCorporate = 0;
    const flush = async (rows: Activity[], keys?: Set<string>) => {
      if (!rows.length) return;
      const m = matchTrades(rows, actions.length ? actionsOf(keys ?? new Set([pairKey(rows[0].accountId, rows[0].symbol)])) : []);
      excluded += m.excluded;
      excludedCorporate += m.excludedCorporate;
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
        and ${notShared(tx, userId)}
        and ${notFuture(tx)}
        ${after ? tx`and (a.account_id, a.symbol, a.executed_at, a.external_id, a.source) > (${after.account_id}, ${after.symbol}, ${after.at}::timestamptz, ${after.external_id}, ${after.source})` : tx``}
        order by a.account_id, a.symbol, a.executed_at, a.external_id, a.source limit ${REBUILD_PAGE}`;
      for (const r of page) {
        const a: Activity = {
          externalId: r.external_id, accountId: r.account_id, symbol: r.symbol, side: r.side, units: r.units,
          price: r.price, fee: r.fee, executedAt: r.executed_at, verified: r.source === 'snaptrade',
        };
        if (open.length && (open[0].accountId !== a.accountId || open[0].symbol !== a.symbol)) { await flush(open); open = []; }
        if (chainOf.has(pairKey(a.accountId, a.symbol))) continue; // matched with its chain below
        open.push(a);
        maxHeld = Math.max(maxHeld, open.length + page.length);
      }
      if (page.length < REBUILD_PAGE) break;
      const last: PairRow = page[page.length - 1];
      after = { account_id: last.account_id, symbol: last.symbol, at: last.at, external_id: last.external_id, source: last.source };
    }
    await flush(open);
    // Corporate actions: each rename chain's pairs, read and matched together (in the stream's total order).
    const chains = new Map<string, string[]>();
    for (const [k, root] of chainOf) chains.set(root, [...(chains.get(root) ?? []), k]);
    for (const keys of chains.values()) {
      const pairs = keys.map((k) => [k.slice(0, k.lastIndexOf('|')), k.slice(k.lastIndexOf('|') + 1)]);
      const rows = await tx<PairRow[]>`select account_id, symbol, executed_at, executed_at::text as at, external_id, side, units, price, fee, source
        from activities a where a.user_id = ${userId} and (a.account_id, a.symbol) in (select * from unnest(${pairs.map((x) => x[0])}::text[], ${pairs.map((x) => x[1])}::text[]))
        and not exists (select 1 from broker_accounts b where b.account_id = a.account_id and b.user_id = ${userId} and b.is_paper)
        and ${notFuture(tx)}
        order by a.account_id, a.symbol, a.executed_at, a.external_id, a.source`;
      maxHeld = Math.max(maxHeld, rows.length);
      await flush(rows.map((r) => ({
        externalId: r.external_id, accountId: r.account_id, symbol: r.symbol, side: r.side, units: r.units,
        price: r.price, fee: r.fee, executedAt: r.executed_at, verified: r.source === 'snaptrade',
      })), new Set(keys));
    }
    const setAside = live.filter((k) => !attachedIds.has(k.sell_id as string));
    if (setAside.length) {
      await tx`insert into kept_theses ${tx(setAside.map((k) => ({ user_id: userId, sell_id: k.sell_id, thesis: k.thesis, thesis_status: k.thesis_status })))}
        on conflict (user_id, sell_id) do update set thesis = excluded.thesis, thesis_status = excluded.thesis_status`;
    }
    const [{ future }] = await tx`select count(*)::int as future from activities a where a.user_id = ${userId} and not (${notFuture(tx)})
      and not exists (select 1 from broker_accounts b where b.account_id = a.account_id and b.user_id = ${userId} and b.is_paper)
      and ${notShared(tx, userId)}`;
    await tx`update users set excluded_positions = ${excluded}, excluded_future = ${future}, last_synced_at = now() where id = ${userId}`;
    await tx`update users set excluded_corporate = ${excludedCorporate} where id = ${userId}`; // corporate actions (F3c)
    return { trades: written, excluded, future: future as number, maxHeld, excludedCorporate };
  };
  return tx ? run(tx) : sql.begin(run);
}

export type Broker = {
  listAccounts: typeof listAccounts; // with the authorization, paper and sync flags
  fetchActivities: typeof fetchActivities;
  // PR-3 (heavy-use): a sync with no stored history reads it page by page (one page held at a time) when available.
  fetchActivitiesPage?: typeof fetchActivitiesPage;
  fetchPositions?: typeof fetchPositions;
  fetchShareMoves?: typeof fetchShareMoves; // corporate actions (F3c): each real account's share-moving rows
  pageLimit?: number;
};
export const defaultBroker: Broker = { listAccounts, fetchActivities, fetchActivitiesPage, fetchPositions, fetchShareMoves };

export type SyncableUser = { id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null };
// The hourly sync's users (F-1, COMPLIANCE §3 consent at collection): a trader is synced only once a connection is
// `connected`, and never while an import runs (the tick's steps own that row). A pending link, a failed import and a
// profile being deleted are never synced.
export const syncable = () => sql`u.snaptrade_user_id is not null and u.deleted_at is null
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
export const clockSql = (shiftMs: number) => sql`select now() + ${shiftMs}::float8 * interval '1 millisecond' as t,
        date_trunc('hour', now() + ${shiftMs}::float8 * interval '1 millisecond' - ${ROUND_OFFSET_MS}::float8 * interval '1 millisecond', 'UTC')
          + ${ROUND_OFFSET_MS}::float8 * interval '1 millisecond' as round_start`;
export const claimable = () => sql`(u.sync_lease_until is null or u.sync_lease_until <= clock.t)
        and (u.sync_claimed_at is null or u.sync_claimed_at < clock.round_start or u.sync_lease_until is not null)`;
// A trader's real accounts under its connected connections' snapshots (what a sync reads; paper accounts are not read).
export const accountsOf = () => sql`(select count(*) from connections c, jsonb_array_elements(c.accounts) a
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
// up to syncRequests(n) = 1 + 3n vendor requests (the account list, then each account's activities, positions and share
// moves), so the tick sizes the reserve per trader: it claims a trader only if that many vendor bounds fit before the
// route's end (`routeEnd`), and
// leaves the others unclaimed (counted in the log) for the next call, which starts with the whole budget. n is capped at
// SYNC_FIT_CAP, the most a whole call fits, so a trader with more accounts is still claimed, at the start of a call.
// ponytail: past SYNC_FIT_CAP accounts (or an activity or share-move read over one vendor page per account) a sync can still overrun;
// it then rolls back and its lease lapses, as before. Sharded sync (lib/sync-shard.ts) dispatches such a trader only
// at the start of a call, and after two overruns in a row quarantines it (backed off, counted `quarantined` in shard 0's
// coverage line) instead of retrying it first forever. The overrun needs every request near its 30 s bound; a normal
// sync of 5+ accounts takes seconds. Next step: split the sync per account like the import (a change to syncUser's
// one-transaction rule, D4/D5: its own design session).
export const syncRouteEnd = (startedAt: number) => startedAt + SYNC_ROUTE_MAX_S * 1000;
// Sharded sync (coordination with the corporate-actions PR #40): the vendor reads a sync makes per real account, in one
// constant that syncCost, SYNC_FIT_CAP, accountsThatFit and the shard runner's request budget all read: 3 since #40
// (activities, positions, and the corporate actions' share moves).
export const SYNC_REQUESTS_PER_ACCOUNT = 3;
export const syncRequests = (accounts: number) => 1 + SYNC_REQUESTS_PER_ACCOUNT * accounts;
export const syncCost = (accounts: number) => syncRequests(accounts) * VENDOR_TIMEOUT_MS;
export const SYNC_FIT_CAP = Math.floor((SYNC_ROUTE_MAX_S * 1000 / VENDOR_TIMEOUT_MS - 1) / SYNC_REQUESTS_PER_ACCOUNT);
export const accountsThatFit = (remainingMs: number) => Math.floor((remainingMs / VENDOR_TIMEOUT_MS - 1) / SYNC_REQUESTS_PER_ACCOUNT);

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
      console.error('sync failed', u.id, logSafe(e));
    } finally {
      // PR-3 fix round 4 (engineer note): a database connection lost here must not abort the tick (the route would
      // answer 500 and the traders after this one would go unsynced by this call). The lease is left to lapse after
      // SYNC_LEASE_MS; a lapsed lease makes the trader claimable again, so at worst it is synced once more that round
      // (a re-sync is idempotent: the last week re-read, the same rows).
      try { await release(u); } catch (e) { console.error('sync lease release failed', u.id, logSafe(e)); }
    }
  }
  let unclaimed: number | null = null;
  try { unclaimed = await unclaimedCount({ ids: opts.ids, shiftMs: opts.clockShiftMs?.() ?? 0 }); } catch (e) { console.error('sync unclaimed count failed', logSafe(e)); }
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
// F-14 (opt-in, `cadence`): the shard runner's hourly sync reads each account within the vendor's guidance (lib/sync-cadence.ts):
// activities with share moves at most once per 24 h, positions at most 4 times in any 24 h, the consented import and the
// first sync after a consent never throttled. Timestamps on the database clock (`shiftMs` is the tests' hook), written in
// this transaction (a failed sync never advances them); the successful vendor reads are also recorded after the
// transaction ends, whatever its outcome (sync_read_marks: the 6 h floor and the positions window). Without `cadence`
// (syncTick, tests) every account is read on every call, as before.
export type CadenceReport = { accounts: number; activitiesRead: number; positionsRead: number; deferred: number; rebuilt: boolean };
export type SyncOpts = { cadence?: boolean; shiftMs?: number; report?: (r: CadenceReport) => void };
export async function syncUser(
  user: { id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null },
  broker: Broker = defaultBroker,
  rebuild: (userId: number, tx: TransactionSql) => Promise<unknown> = (id, tx) => rebuildRecord(id, tx), // OPTIONS
  now = new Date(),
  opts: SyncOpts = {},
): Promise<number | 'skipped'> {
  if (!user.snaptrade_user_id || !user.snaptrade_secret_enc) return 0;
  const bu = { snaptradeUserId: user.snaptrade_user_id, secretEnc: user.snaptrade_secret_enc };
  const shiftMs = opts.shiftMs ?? 0;
  // The vendor reads that returned (recorded only after each call returns), for the marks written after the transaction.
  const readActs: string[] = [], readPos: string[] = [];
  try {
    return await sql.begin(async (tx) => {
      const [{ got }] = await tx`select pg_try_advisory_xact_lock(${USER_LOCK}, ${user.id}) as got`;
      if (!got) return 'skipped';
      const consented = new Set((await tx`select a->>'authorizationId' as auth from connections c, jsonb_array_elements(c.accounts) a
        where c.user_id = ${user.id} and c.state = 'connected'`).map((r) => r.auth as string));
      const accounts = (await broker.listAccounts(bu)).filter((a) => consented.has(a.authorizationId));
      // F-14 (G4, engineer 4): the claimed account set and paper flags before the claim, so a change still rebuilds.
      const shape = async () => (await tx`select coalesce(string_agg(account_id || ':' || is_paper::text, ',' order by account_id), '') as s
        from broker_accounts where user_id = ${user.id}`)[0].s as string;
      const before = opts.cadence ? await shape() : '';
      // Claim first so no conflicting data is ever read for the wrong user. Zero-activity accounts are claimed too.
      if (accounts.length && !(await claimIn(tx, user.id, accounts, { confirmed: true, now })).ok) throw new AccountClaimedError();
      const real = accounts.filter((a) => !a.isPaper).map((a) => a.id);
      // TR-5: a connection whose accounts the vendor no longer lists is disconnected; its record stays, frozen.
      const disconnected = await tx`update connections c set disconnected_at = ${now} where c.user_id = ${user.id} and c.state = 'connected' and c.disconnected_at is null
        and not exists (select 1 from jsonb_array_elements(c.accounts) a where a->>'id' in ${tx(accounts.length ? accounts.map((a) => a.id) : [''])})`;
      // Nothing consented is listed: no read, no rebuild, no positions (a failed import's pages are never published by a sync).
      if (!accounts.length) return 0;
      // F-14: which accounts are due (every real account without `cadence`).
      // ponytail: the account list (listAccounts, above) is still read every round: it carries the claim and TR-5's
      // disconnect check, and the vendor guidance the council cited does not cover it — whether it may be throttled is a
      // vendor question (MR-1) for the owner.
      // ponytail: the future-date quarantine is re-checked only when activities are read (about every 25 h), so a date
      // the vendor corrects appears up to a day later — a nightly rebuild-only pass would close it.
      let actIds = real, posIds = real, deferred = 0;
      const t = tx`now() + ${shiftMs}::float8 * interval '1 millisecond'`;
      if (opts.cadence && real.length) {
        const flags = await tx`select acct_ids.acct as id, d.* from unnest(${real}::text[]) as acct_ids(acct),
          lateral ${dueSql(sql`acct_ids.acct`, sql`${user.id}::int`, t)} d`;
        const plan = new Map(flags.map((f) => [f.id as string, decide(f as unknown as DueFlags)]));
        actIds = real.filter((id) => plan.get(id)?.activities);
        posIds = real.filter((id) => plan.get(id)?.positions);
        deferred = real.filter((id) => plan.get(id)?.deferred).length;
      }
      const changed = opts.cadence ? (await shape()) !== before || disconnected.count > 0 : true;
      // Fix round 6: a quarantined future date never sets the re-read window (it would skip the real last week).
      const [{ last: lastShare }] = await tx`select max(executed_at) as last from activities where user_id = ${user.id} and source = 'snaptrade' and ${notFuture(tx)}`;
      // OPTIONS (AC 11): the newest row across both raw tables sets the window, so an options-only trader re-reads a week.
      const lastOption = await lastOptionActivityAt(tx, user.id);
      const last: Date | null = lastShare && lastOption ? (lastShare > lastOption ? lastShare : lastOption) : (lastShare ?? lastOption);
      const options: (OptionRow & { raw: unknown })[] = [];
      const sink = (rows: (OptionRow & { raw: unknown })[]) => { options.push(...rows); };
      // OPTIONS × F-14: "the whole history was read" holds only when every real account was (a gated account waits).
      const allRead = actIds.length === real.length;
      // Accounts that read a backfill history page this sync in place of their week (their recent sells are not read).
      let pagedIds: string[] = [];
      let read = 0;
      if (!last && broker.fetchActivitiesPage) {
        // No stored history (a pre-F-1 record): the whole history, one vendor page per insert, never held at once.
        const limit = broker.pageLimit ?? PAGE_LIMIT;
        for (const id of actIds) {
          for (let offset = 0; ; offset += limit) {
            const page = await broker.fetchActivitiesPage(bu, id, offset, limit, sink);
            if (offset === 0) readActs.push(id); // F-14 (code review): marked once its first page returned
            await insertActivities(user.id, 'snaptrade', page.activities, tx);
            await insertOptionActivities(user.id, 'snaptrade', options.splice(0), tx); // OPTIONS
            read += page.activities.length;
            if (page.done) break;
          }
        }
        if (allRead) await markBackfilled(tx, user.id); // OPTIONS: the whole history was read with the option types
        // OPTIONS × F-14 (review nit): a gated account waits, but those read in full owe no backfill (cursor -1).
        else if (actIds.length) await saveBackfill(tx, user.id, real, new Map(actIds.map((id) => [id, -1])));
      } else {
        // The hourly case: the last week before the newest stored activity (bounded by a week of trading, not the history).
        const since = last ? new Date(last.getTime() - BACKFILL_MS) : new Date('2000-01-01');
        // OPTIONS (fix round 1, review 4): an account still owed its one-time option backfill reads its next history page
        // instead of the week (the same request count); the others read the week as before. F-14: only due accounts read.
        // ponytail: under F-14 a backfill page is that account's daily activities read, so a history of k pages takes about
        // k days to backfill its options — the vendor's written answer (MR-1) on history pages would let them go hourly.
        const backfill = broker.fetchActivitiesPage ? await pendingBackfill(tx, user.id) : new Map<string, number>();
        const paged = actIds.filter((id) => backfill.has(id));
        pagedIds = paged;
        const windowed = actIds.filter((id) => !backfill.has(id));
        if (opts.cadence) {
          // F-14 (code review): one call per account, each recorded as it returns, so a failure on a later account
          // still marks the reads already made (G2's floor applies to them).
          for (const id of windowed) {
            const acts = await broker.fetchActivities(bu, since, [id], sink);
            readActs.push(id);
            await insertActivities(user.id, 'snaptrade', acts, tx);
            await insertOptionActivities(user.id, 'snaptrade', options.splice(0), tx); // OPTIONS
            read += acts.length;
          }
        } else {
          const acts = windowed.length ? await broker.fetchActivities(bu, since, windowed, sink) : [];
          await insertActivities(user.id, 'snaptrade', acts, tx);
          await insertOptionActivities(user.id, 'snaptrade', options.splice(0), tx); // OPTIONS
          read = acts.length;
        }
        const progress = new Map<string, number>();
        for (const id of paged) {
          const limit = broker.pageLimit ?? PAGE_LIMIT, offset = backfill.get(id)!;
          const page = await broker.fetchActivitiesPage!(bu, id, offset, limit, sink);
          readActs.push(id);
          await insertActivities(user.id, 'snaptrade', page.activities, tx);
          await insertOptionActivities(user.id, 'snaptrade', options.splice(0), tx);
          read += page.activities.length;
          progress.set(id, page.done ? -1 : offset + limit);
        }
        if (paged.length) await saveBackfill(tx, user.id, real, progress);
        if (!last && allRead) await markBackfilled(tx, user.id); // the since-2000 read is the whole history
      }
      // Corporate actions (F3c): every real account's share-moving rows (whole history, idempotent inserts) before the
      // rebuild applies them. Counted: SYNC_REQUESTS_PER_ACCOUNT is 3 (activities, positions, share moves), so syncCost,
      // SYNC_FIT_CAP and the sharded runner's request budget include this read (one page per account; more pages are the
      // ponytail above). F-14 (S1): the same vendor endpoint as activities, so the same daily gate.
      if (broker.fetchShareMoves) {
        for (const id of actIds) {
          const moves = await broker.fetchShareMoves(bu, id);
          await insertActivities(user.id, 'snaptrade', moves.activities, tx);
          await insertCorporateActions(tx, user.id, 'snaptrade', moves.actions);
          read += moves.activities.length;
        }
      }
      // F-14 (G4): rebuilt when activities were read or the account set changed, so last_synced_at means "activities
      // last read" (the freshness line, the queue order, the coverage age). Always without `cadence`.
      const rebuilt = actIds.length > 0 || changed;
      const [{ prev }] = opts.cadence ? await tx`select last_synced_at as prev from users where id = ${user.id}` : [{ prev: null }];
      if (rebuilt) await rebuild(user.id, tx);
      if (broker.fetchPositions) {
        const splits = new Map<string, PositionSplit>(); // OPTIONS (D7)
        if (!opts.cadence) {
          const positions = [];
          for (const id of real) for (const p of await broker.fetchPositions(bu, id, (s) => { splits.set(id, s); })) positions.push({ accountId: id, symbol: p.symbol, unrealizedPct: p.unrealizedPct });
          await replacePositions(tx, user.id, positions);
          await replaceOptionPositions(tx, user.id, null, splits); // OPTIONS
        } else {
          // Accounts no longer real (disconnected, simulated) lose their positions on every sync (engineer 3).
          // (Through lib/positions.ts: lib/reflections.test.ts allows no delete in this file but closed_trades'.)
          const gone = (await tx`select distinct account_id from open_positions where user_id = ${user.id} ${real.length ? tx`and account_id not in ${tx(real)}` : tx``}`).map((x) => x.account_id as string);
          await replaceAccountPositions(tx, user.id, gone, []);
          // F-14 × OPTIONS (review B2): a backfill page is not this account's recent activities, so its sells may be
          // unread for days: its positions take the positions-only rule (never removed), not the combined one.
          const withActs = new Set(actIds.filter((id) => !pagedIds.includes(id)));
          for (const id of posIds) {
            const rows = (await broker.fetchPositions(bu, id, (s) => { splits.set(id, s); })).map((p) => ({ accountId: id, symbol: p.symbol, unrealizedPct: p.unrealizedPct }));
            readPos.push(id);
            if (withActs.has(id)) {
              // Read with this account's activities (and its rebuild): listed positions are updated and added; one the
              // vendor no longer lists goes once its sell is imported (or after 3 days unlisted), lib/positions.ts.
              await settleAccountPositions(tx, user.id, id, rows);
            } else if (rows.length) {
              // G3 (TR-4): a positions-only read adds and updates, never removes, so a position closed at a loss stays
              // listed until the read that also publishes its closed trade.
              await tx`insert into open_positions ${tx(rows.map((p) => ({ user_id: user.id, account_id: p.accountId, symbol: p.symbol, unrealized_pct: p.unrealizedPct })))}
                on conflict (user_id, account_id, symbol) do update set unrealized_pct = excluded.unrealized_pct, fetched_at = now()`;
            }
          }
          // OPTIONS × F-14: option positions follow the share rule (review B1, TR-4). Accounts read with their recent
          // activities are replaced; positions-only reads add and update, never remove; accounts no longer real are
          // dropped; the others (not due) stay as last read, their counts with them (lib/options-sync.ts).
          await replaceAccountOptionPositions(tx, user.id, real, posIds.filter((id) => withActs.has(id)), posIds.filter((id) => !withActs.has(id)), splits);
        }
      }
      if (opts.cadence) {
        // Stamped after the vendor calls returned (clock_timestamp, not the transaction's start), so the next read is due
        // a full period after this one's last call (tester: a stamp at the transaction start let two daily calls land
        // seconds under 24 h apart).
        const stamp = tx`clock_timestamp() + ${shiftMs}::float8 * interval '1 millisecond'`;
        if (actIds.length) await tx`update broker_accounts set activities_read_at = ${stamp} where user_id = ${user.id} and account_id in ${tx(actIds)}`;
        if (posIds.length && broker.fetchPositions) await tx`update broker_accounts set positions_read_at = ${stamp} where user_id = ${user.id} and account_id in ${tx(posIds)}`;
        // F-14 (orchestrator review): `last_synced_at` (F-11's "Updated …") is the oldest real account's last activities
        // read, never "now" after a rebuild that only an account-set change or a partial read triggered. While any real
        // account has never been read, the previous value stands.
        // OPTIONS × F-14 (review nit): while any real account is mid-backfill its recent week is unread, so the value
        // stands too.
        const midBackfill = broker.fetchActivitiesPage ? [...(await pendingBackfill(tx, user.id)).keys()].some((id) => real.includes(id)) : false;
        if (rebuilt && midBackfill) await tx`update users set last_synced_at = ${prev} where id = ${user.id}`;
        else if (rebuilt) {
          await tx`update users set last_synced_at = coalesce((select case when bool_or(activities_read_at is null) then null else min(activities_read_at) end
              from broker_accounts where user_id = ${user.id} and account_id in ${tx(real.length ? real : [''])}), ${prev})
            where id = ${user.id}`;
        }
        opts.report?.({ accounts: real.length, activitiesRead: actIds.length, positionsRead: broker.fetchPositions ? posIds.length : 0, deferred, rebuilt });
      }
      return read;
    });
  } catch (e) {
    // A cut at the route's end (RouteDeadlineError, lib/sync-shard.ts) is not a failed sync: its reads leave no marks, so
    // the next call reads at once instead of waiting out the 6 h floor (orchestrator review).
    if ((e as { name?: unknown } | null)?.name === 'RouteDeadlineError') { readActs.length = 0; readPos.length = 0; }
    throw e;
  } finally {
    // G2: fire and forget, after the transaction (its connection is back in the pool); never fatal.
    if (opts.cadence && (readActs.length || readPos.length)) {
      const { id } = user; // the internal id only (lib/privacy-logs.test.ts)
      try { await writeMarks(id, readActs, readPos, shiftMs); } catch (e) { console.error('sync marks failed', id, logSafe(e)); }
    }
  }
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
      console.error('sync failed', u.id, logSafe(e));
    }
  }
  return { ok, failed };
}
