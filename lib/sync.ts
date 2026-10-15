import { sql } from './db.ts';
import { fetchActivities, listAccountIds } from './broker.ts';
import { AccountClaimedError, claimAccounts } from './claims.ts';
import { reattachTheses, type KeptThesis } from './theses.ts';
import { matchTrades, type Activity } from './trades.ts';

const BACKFILL_MS = 7 * 86_400_000; // brokers post late corrections; re-read the last week

export async function insertActivities(userId: number, source: 'snaptrade' | 'demo', acts: (Activity & { raw: unknown })[]) {
  if (!acts.length) return;
  const rows = acts.map((a) => ({
    user_id: userId, source, external_id: a.externalId, account_id: a.accountId, symbol: a.symbol,
    side: a.side, units: a.units, price: a.price, fee: a.fee, executed_at: a.executedAt, raw: sql.json(a.raw as never),
  }));
  await sql`insert into activities ${sql(rows)} on conflict (source, external_id) do nothing`;
}

// Recompute a user's closed trades from raw activities. Theses survive via sell_id.
export async function rebuildTrades(userId: number) {
  const rows = await sql`select * from activities where user_id = ${userId}`;
  const { trades, excluded } = matchTrades(
    rows.map((r) => ({
      externalId: r.external_id, accountId: r.account_id, symbol: r.symbol, side: r.side, units: r.units,
      price: r.price, fee: r.fee, executedAt: r.executed_at, verified: r.source === 'snaptrade',
    })),
  );

  await sql.begin(async (tx) => {
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
  });
}

type Broker = {
  listAccountIds: typeof listAccountIds;
  fetchActivities: typeof fetchActivities;
};

// Returns the activity count; throws AccountClaimedError (writing nothing) if any account belongs to another profile.
export async function syncUser(
  user: { id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null },
  broker: Broker = { listAccountIds, fetchActivities },
  rebuild: typeof rebuildTrades = rebuildTrades,
) {
  if (!user.snaptrade_user_id || !user.snaptrade_secret_enc) return 0;
  const bu = { snaptradeUserId: user.snaptrade_user_id, secretEnc: user.snaptrade_secret_enc };
  // Claim first so no conflicting data is ever read for the wrong user. Zero-activity accounts are claimed too.
  const accountIds = await broker.listAccountIds(bu);
  if (!(await claimAccounts(user.id, accountIds)).ok) throw new AccountClaimedError();
  const [{ last }] = await sql`select max(executed_at) as last from activities where user_id = ${user.id} and source = 'snaptrade'`;
  const since = last ? new Date(last.getTime() - BACKFILL_MS) : new Date('2000-01-01');
  const acts = await broker.fetchActivities(bu, since, accountIds);
  await insertActivities(user.id, 'snaptrade', acts);
  await rebuild(user.id);
  return acts.length;
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
