import { sql } from './db.ts';
import type { TransactionSql } from 'postgres';
import { fetchActivities, fetchPositions, listAccounts } from './broker.ts';
import { AccountClaimedError, claimIn } from './claims.ts';
import { reattachTheses, type KeptThesis } from './theses.ts';
import { matchTrades, type Activity } from './trades.ts';
import { replacePositions } from './positions.ts';

const BACKFILL_MS = 7 * 86_400_000; // brokers post late corrections; re-read the last week
// Per-user advisory lock (F-1: a sync is one transaction; a second one for the same user waits or is skipped).
export const USER_LOCK = 1;
type Db = TransactionSql | typeof sql;

export async function insertActivities(userId: number, source: 'snaptrade' | 'demo', acts: (Activity & { raw: unknown })[], db: Db = sql) {
  if (!acts.length) return;
  const rows = acts.map((a) => ({
    user_id: userId, source, external_id: a.externalId, account_id: a.accountId, symbol: a.symbol,
    side: a.side, units: a.units, price: a.price, fee: a.fee, executed_at: a.executedAt, raw: db.json(a.raw as never),
  }));
  await db`insert into activities ${db(rows)} on conflict (source, external_id) do nothing`;
}

// Recompute a user's closed trades from raw activities. Theses survive via sell_id. Runs in the caller's transaction
// when given one (an import step, a sync), else in its own.
export async function rebuildTrades(userId: number, tx?: TransactionSql) {
  const run = async (tx: TransactionSql) => {
    const rows = await tx`select * from activities where user_id = ${userId}`;
    const { trades, excluded } = matchTrades(
      rows.map((r) => ({
        externalId: r.external_id, accountId: r.account_id, symbol: r.symbol, side: r.side, units: r.units,
        price: r.price, fee: r.fee, executedAt: r.executed_at, verified: r.source === 'snaptrade',
      })),
    );
    const kept = await tx`select sell_id, thesis, thesis_status from closed_trades where user_id = ${userId} and thesis is not null`;
    const { attached, orphaned } = reattachTheses(kept as unknown as KeptThesis[], trades);
    if (orphaned.length) console.warn(`rebuildTrades: user ${userId} has ${orphaned.length} orphaned thesis(es)`);
    // ponytail: orphaned theses are lost from the DB once the old rows are deleted; this warning is the only trace.
    await tx`delete from closed_trades where user_id = ${userId}`;
    if (trades.length) {
      await tx`insert into closed_trades ${tx(trades.map((t) => ({
        user_id: userId, sell_id: t.sellId, account_id: t.accountId, symbol: t.symbol, opened_at: t.openedAt,
        closed_at: t.closedAt, return_pct: t.returnPct, holding_days: t.holdingDays, verified: t.verified,
        thesis: attached.get(t.sellId)?.thesis ?? null, thesis_status: attached.get(t.sellId)?.thesis_status ?? null,
      })))}`;
    }
    await tx`update users set excluded_positions = ${excluded}, last_synced_at = now() where id = ${userId}`;
  };
  return tx ? run(tx) : sql.begin(run);
}

type Broker = {
  listAccounts: typeof listAccounts; // with the authorization, paper and sync flags
  fetchActivities: typeof fetchActivities;
  fetchPositions?: typeof fetchPositions;
};
const defaultBroker: Broker = { listAccounts, fetchActivities, fetchPositions };

export type SyncableUser = { id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null };
// The hourly sync's users (F-1, COMPLIANCE §3 consent at collection): a trader is synced only once a connection is
// `connected`, and never while an import runs (the tick's steps own that row). A pending link, a failed import and a
// profile being deleted are never synced.
export async function usersToSync(): Promise<SyncableUser[]> {
  return sql<SyncableUser[]>`select id, snaptrade_user_id, snaptrade_secret_enc from users u
    where snaptrade_user_id is not null and deleted_at is null
    and exists (select 1 from connections c where c.user_id = u.id and c.state = 'connected')
    and not exists (select 1 from connections c where c.user_id = u.id and c.state = 'importing') order by last_synced_at nulls first`;
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
  rebuild: typeof rebuildTrades = rebuildTrades,
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
    const since = last ? new Date(last.getTime() - BACKFILL_MS) : new Date('2000-01-01');
    const acts = real.length ? await broker.fetchActivities(bu, since, real) : [];
    await insertActivities(user.id, 'snaptrade', acts, tx);
    await rebuild(user.id, tx);
    if (broker.fetchPositions) {
      const positions = [];
      for (const id of real) for (const p of await broker.fetchPositions(bu, id)) positions.push({ accountId: id, symbol: p.symbol, unrealizedPct: p.unrealizedPct });
      await replacePositions(tx, user.id, positions);
    }
    return acts.length;
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
