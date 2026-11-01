// F-6 · open positions on the stock pages (docs/features/logs/F-6/plan.md §1.5, §6): the aggregate only, never a list
// of who holds the stock (POLICY F1/F3b). Counted for traders not deleted whose record is connected or failed (an
// importing record is not presented, TR-3; a record with no consented connection shows no positions). Percent only.
import { sql } from '@/lib/db.ts';
import { recordStates } from '@/lib/connections.ts';
import { openSummary, type OpenSummary } from '@/lib/open-split.ts';

export type SymbolOpen = { o: OpenSummary; traders: number };

export async function symbolOpen(symbols: string[]): Promise<Map<string, SymbolOpen>> {
  const out = new Map<string, SymbolOpen>();
  if (!symbols.length) return out;
  const rows = (await sql`
    select p.symbol, p.user_id, p.unrealized_pct
    from open_positions p join users u on u.id = p.user_id and u.deleted_at is null
    where p.symbol = any(${symbols})`) as unknown as { symbol: string; user_id: number; unrealized_pct: number }[];
  if (!rows.length) return out;
  const states = await recordStates(rows.map((r) => r.user_id));
  for (const symbol of symbols) {
    const mine = rows.filter((r) => r.symbol === symbol && ['connected', 'failed'].includes(states.get(r.user_id)?.state ?? 'none'));
    const o = openSummary(mine.map((r) => r.unrealized_pct));
    if (o) out.set(symbol, { o, traders: new Set(mine.map((r) => r.user_id)).size });
  }
  return out;
}
