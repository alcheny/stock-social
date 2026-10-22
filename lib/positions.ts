// Open positions (TR-4): derived vendor data like closed_trades, replaced as a set at the end of an import and on every
// sync, inside the caller's transaction. Symbol and unrealized percent only; never units, prices or amounts.
import type { TransactionSql } from 'postgres';

export type OpenPosition = { accountId: string; symbol: string; unrealizedPct: number };

export async function replacePositions(tx: TransactionSql, userId: number, positions: OpenPosition[]) {
  await tx`delete from open_positions where user_id = ${userId}`;
  if (positions.length) await tx`insert into open_positions ${tx(positions.map((p) => ({ user_id: userId, account_id: p.accountId, symbol: p.symbol, unrealized_pct: p.unrealizedPct })))} on conflict do nothing`;
}
