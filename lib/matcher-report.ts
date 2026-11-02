// F-32 Part A (decision "Version bumps"): the deploy rebuild reports counts only, the published-to-counted moves per
// reason. Each record's counts are read before and after its rebuild (in its transaction); the report is the sum of the
// changes over every record: counts per reason, never a user id, handle, symbol, unit, date or account.
import type { TransactionSql } from 'postgres';

export const REPORT_REASONS = ['shown', 'excluded', 'corporate', 'transfer', 'held'] as const;
export type ReasonCounts = Record<(typeof REPORT_REASONS)[number], number>;
export const noCounts = (): ReasonCounts => ({ shown: 0, excluded: 0, corporate: 0, transfer: 0, held: 0 });

// One record's published closes and its counted sells, by reason.
export async function reasonCounts(tx: TransactionSql, userId: number): Promise<ReasonCounts> {
  const [r] = await tx`select (select count(*)::int from closed_trades where user_id = ${userId}) as shown,
    excluded_positions as excluded, excluded_corporate as corporate, excluded_transfer as transfer, excluded_held as held
    from users where id = ${userId}`;
  return r ? { shown: r.shown, excluded: r.excluded, corporate: r.corporate, transfer: r.transfer, held: r.held } : noCounts();
}

// Adds one record's change (after − before) to the running report.
export function addMoves(report: ReasonCounts, before: ReasonCounts, after: ReasonCounts): ReasonCounts {
  for (const k of REPORT_REASONS) report[k] += after[k] - before[k];
  return report;
}

// The one log line: the version and the net change per reason, counts only.
export const movesLine = (version: number, report: ReasonCounts) => `matcher rebuild: moves per reason ${JSON.stringify({ version, ...report })}`;
