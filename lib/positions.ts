// Open positions (TR-4): derived vendor data like closed_trades, replaced as a set at the end of an import and on every
// sync, inside the caller's transaction. Symbol and unrealized percent only; never units, prices or amounts.
import type { TransactionSql } from 'postgres';

export type OpenPosition = { accountId: string; symbol: string; unrealizedPct: number };

export async function replacePositions(tx: TransactionSql, userId: number, positions: OpenPosition[]) {
  await tx`delete from open_positions where user_id = ${userId}`;
  if (positions.length) await tx`insert into open_positions ${tx(positions.map((p) => ({ user_id: userId, account_id: p.accountId, symbol: p.symbol, unrealized_pct: p.unrealizedPct })))} on conflict do nothing`;
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
