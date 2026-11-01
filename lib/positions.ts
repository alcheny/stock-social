// Open positions (TR-4): derived vendor data like closed_trades, replaced per account read at the end of an import and on
// every sync, inside the caller's transaction. Symbol and unrealized percent only; never units, prices or amounts.
import type { TransactionSql } from 'postgres';

export type OpenPosition = { accountId: string; symbol: string; unrealizedPct: number };

// F3-4 (cycle 3): a sync's positions read, per account, never per user. The accounts read get their rows replaced; the
// rows of the trader's other accounts (one the vendor stopped listing, a frozen or simulated one) move to
// unlisted_positions with their read time, kept and rendered nowhere until the owner decides OD-9 (Q2). So every reader
// of open_positions still shows only the accounts the latest read listed, and no position is deleted by a sync.
// One exception, on purpose: a list with no consented account returns before positions are read (lib/sync.ts#syncUser),
// so one possibly faulty empty answer changes no display; the F3-3 freeze rule treats it the same way.
export async function replaceListedPositions(tx: TransactionSql, userId: number, accountIds: string[], positions: OpenPosition[]) {
  await moveUnlistedPositions(tx, userId, accountIds);
  await replaceAccountPositions(tx, userId, accountIds, positions);
}
// The move alone (F-14: the cadence sync reads only due accounts' positions, so it moves the unlisted accounts' rows
// aside without replacing the listed ones; lib/sync.ts).
export async function moveUnlistedPositions(tx: TransactionSql, userId: number, accountIds: string[]) {
  const read = tx(accountIds.length ? accountIds : ['']);
  await tx`with moved as (delete from open_positions where user_id = ${userId} and account_id not in ${read}
      returning user_id, account_id, symbol, unrealized_pct, fetched_at)
    insert into unlisted_positions (user_id, account_id, symbol, unrealized_pct, fetched_at) select * from moved
    on conflict (user_id, account_id, symbol) do update set unrealized_pct = excluded.unrealized_pct, fetched_at = excluded.fetched_at, unlisted_at = now()`;
  if (accountIds.length) await tx`delete from unlisted_positions where user_id = ${userId} and account_id in ${read}`;
}
// F-1 PR-3 fix round 6: an import step that read only some accounts' positions (its time ran out) adds the rest on the
// next step: those accounts' rows are replaced, the others' kept.
export async function replaceAccountPositions(tx: TransactionSql, userId: number, accountIds: string[], positions: OpenPosition[]) {
  if (!accountIds.length) return;
  await tx`delete from open_positions where user_id = ${userId} and account_id in ${tx(accountIds)}`;
  if (positions.length) await tx`insert into open_positions ${tx(positions.map((p) => ({ user_id: userId, account_id: p.accountId, symbol: p.symbol, unrealized_pct: p.unrealizedPct })))} on conflict do nothing`;
}

// Reviewer fix (PR-2a, finding 5): positions are per account, so one symbol held in two accounts is two positions.
// They are listed per account, never merged: a size-weighted percent would need amounts we deliberately never store,
// and an unweighted mean would be a number no account has. Rows are keyed by account and symbol; a symbol held in more
// than one account carries an "account N" label (N counts that trader's accounts holding it, ordered by account), so
// the rows are told apart without showing a vendor account id.
export type PositionRow = { key: string; symbol: string; pct: number; account: number | null };
export function positionRows(rows: { accountId: string; symbol: string; pct: number }[]): PositionRow[] {
  const sorted = [...rows].sort((a, b) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0));
  const per = new Map<string, number>();
  for (const r of sorted) per.set(r.symbol, (per.get(r.symbol) ?? 0) + 1);
  const seen = new Map<string, number>();
  return sorted.map((r) => {
    const n = (seen.get(r.symbol) ?? 0) + 1;
    seen.set(r.symbol, n);
    return { key: `${r.symbol}:${n}`, symbol: r.symbol, pct: r.pct, account: (per.get(r.symbol) ?? 0) > 1 ? n : null };
  });
}

// F-14 sync cadence (TR-4; code review): a read that lists an account's positions together with its activities updates
// and adds the listed positions, and removes a stored position the vendor no longer lists only once its closing is
// known: a SELL of that account and symbol imported since the position was last listed (the closed trade is then in
// this transaction's rebuild), or the position unlisted for SETTLE_STALE_MS (a transfer out, no sell to wait for). A
// vendor whose holdings update before its sell is posted no longer hides the loss until the next daily read.
// ponytail: the closing SELL is matched by symbol, so a position under a renamed symbol (#40's renames and
// reorganizations) or one re-listed under another symbol stays listed next to its closed trade for up to
// SETTLE_STALE_MS — matching through lib/corporate-actions.ts's rename chain would remove it with its trade.
export const SETTLE_STALE_MS = 3 * 86_400_000;
// One vendor read can list a key twice (two lots of one symbol, or of one option contract): an insert that updates on
// conflict cannot touch a row twice, so rows are de-duplicated first, keeping the first, as main's `do nothing` did.
export function firstByKey<T>(rows: T[], key: (r: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => { const k = key(r); if (seen.has(k)) return false; seen.add(k); return true; });
}
export async function settleAccountPositions(tx: TransactionSql, userId: number, accountId: string, listed: OpenPosition[]) {
  if (listed.length) {
    await tx`insert into open_positions ${tx(firstByKey(listed, (p) => `${p.accountId}\u0000${p.symbol}`).map((p) => ({ user_id: userId, account_id: p.accountId, symbol: p.symbol, unrealized_pct: p.unrealizedPct })))}
      on conflict (user_id, account_id, symbol) do update set unrealized_pct = excluded.unrealized_pct, fetched_at = now()`;
  }
  await tx`delete from open_positions p where p.user_id = ${userId} and p.account_id = ${accountId}
    ${listed.length ? tx`and p.symbol not in ${tx(listed.map((x) => x.symbol))}` : tx``}
    and (exists (select 1 from activities a where a.user_id = p.user_id and a.account_id = p.account_id and a.symbol = p.symbol
          and a.side = 'SELL' and a.created_at >= p.fetched_at)
      or p.fetched_at < now() - ${SETTLE_STALE_MS}::float8 * interval '1 millisecond')`;
}
