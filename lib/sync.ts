import { sql } from './db.ts';
import type { TransactionSql } from 'postgres';
import { fetchActivities, fetchActivitiesPage, fetchPositions, listAccounts, PAGE_LIMIT } from './broker.ts';
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
export async function rebuildTrades(userId: number, tx?: TransactionSql): Promise<{ trades: number; excluded: number; maxHeld: number }> {
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
    let after: { account_id: string; symbol: string; at: string; external_id: string } | null = null;
    for (;;) {
      const page: PairRow[] = await tx<PairRow[]>`select account_id, symbol, executed_at, executed_at::text as at, external_id, side, units, price, fee, source
        from activities a where a.user_id = ${userId}
        and not exists (select 1 from broker_accounts b where b.account_id = a.account_id and b.user_id = ${userId} and b.is_paper)
        ${after ? tx`and (a.account_id, a.symbol, a.executed_at, a.external_id) > (${after.account_id}, ${after.symbol}, ${after.at}::timestamptz, ${after.external_id})` : tx``}
        order by a.account_id, a.symbol, a.executed_at, a.external_id limit ${REBUILD_PAGE}`;
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
      after = { account_id: last.account_id, symbol: last.symbol, at: last.at, external_id: last.external_id };
    }
    await flush(open);
    const setAside = live.filter((k) => !attachedIds.has(k.sell_id as string));
    if (setAside.length) {
      await tx`insert into kept_theses ${tx(setAside.map((k) => ({ user_id: userId, sell_id: k.sell_id, thesis: k.thesis, thesis_status: k.thesis_status })))}
        on conflict (user_id, sell_id) do update set thesis = excluded.thesis, thesis_status = excluded.thesis_status`;
    }
    await tx`update users set excluded_positions = ${excluded}, last_synced_at = now() where id = ${userId}`;
    return { trades: written, excluded, maxHeld };
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
// Fix round 1 (tester's medium): the claim is keyed on the clock hour, not a window from the claiming call, so a late
// or retried call never makes the next on-time tick skip anyone. The rule:
//   - at most once per clock hour: a trader is claimed only if `sync_claimed_at` is before the start of this hour;
//   - at least once per hour while any tick runs in that hour: every tick claims every trader not yet claimed this hour;
//   - never two at once: a claim also takes a short in-flight lease (`sync_lease_until`), released when the sync ends or
//     fails; a leased trader is never claimed (`for update skip locked` keeps concurrent claims apart, and the per-user
//     advisory lock in syncUser still prevents interleaving). A caller that dies leaves its lease to lapse after
//     SYNC_LEASE_MS; that trader is then claimable again in the same hour, since its sync never finished.
// A failed sync keeps its hour claim, so it is retried next hour, as before.
export const SYNC_LEASE_MS = 10 * 60_000; // far above one trader's sync (under 1 s for a 10,000-activity record)
export const HOUR_MS = 3_600_000;
export const hourStart = (now: Date) => new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
export type ClaimedUser = SyncableUser & { lease: Date };
export async function claimNextUser(now = new Date()): Promise<ClaimedUser | null> {
  const lease = new Date(now.getTime() + SYNC_LEASE_MS);
  const [u] = await sql<SyncableUser[]>`update users set sync_claimed_at = ${now}, sync_lease_until = ${lease} where id = (
      select u.id from users u where ${syncable()}
        and (u.sync_lease_until is null or u.sync_lease_until <= ${now})
        and (u.sync_claimed_at is null or u.sync_claimed_at < ${hourStart(now)} or u.sync_lease_until is not null)
      order by u.last_synced_at nulls first, u.id limit 1 for update skip locked)
    returning id, snaptrade_user_id, snaptrade_secret_enc`;
  return u ? { ...u, lease } : null;
}
// Ends a claim's in-flight lease (only that claim's: a newer lease taken after this one lapsed is left alone).
export async function releaseClaim(u: ClaimedUser) {
  await sql`update users set sync_lease_until = null where id = ${u.id} and sync_lease_until = ${u.lease}`;
}
export async function syncTick<R>(opts: { now?: Date; sync?: (u: SyncableUser) => Promise<R> } = {}) {
  const now = opts.now ?? new Date();
  const sync = opts.sync ?? ((u: SyncableUser) => syncUser(u));
  let ok = 0, skipped = 0;
  const failed: number[] = [];
  for (let u = await claimNextUser(now); u; u = await claimNextUser(now)) {
    try {
      if ((await sync(u)) === 'skipped') skipped++; else ok++;
    } catch (e) {
      failed.push(u.id);
      console.error('sync failed', u.id, e instanceof Error ? e.message : e);
    } finally {
      await releaseClaim(u);
    }
  }
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
    const [{ last }] = await tx`select max(executed_at) as last from activities where user_id = ${user.id} and source = 'snaptrade'`;
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
