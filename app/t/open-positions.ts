// F-6 · open positions on the stock pages (docs/features/logs/F-6/plan.md §1.5, §6): the aggregate only, never a list
// of who holds the stock (POLICY F1/F3b). Counted for visible traders (not deleted, not hidden: F-16) whose record is connected or failed (an
// importing record is not presented, TR-3; a record with no consented connection shows no positions). Percent only.
import { cache } from 'react';
import { sql } from '@/lib/db.ts';
import { visibleUser } from '@/lib/visible-users.ts';
import { recordStates } from '@/lib/connections.ts';
import { openSummary, type OpenSummary } from '@/lib/open-split.ts';
import { positionInRecord } from '@/lib/shared-accounts.ts'; // F-34

export type SymbolOpen = { o: OpenSummary; traders: number; asOf: Date };

// Once per request for the same symbols (a page and its metadata both read it).
export const symbolOpen = cache(async (...symbols: string[]): Promise<Map<string, SymbolOpen>> => {
  const out = new Map<string, SymbolOpen>();
  if (!symbols.length) return out;
  const rows = (await sql`
    select p.symbol, p.user_id, p.unrealized_pct, p.fetched_at
    from open_positions p join users u on u.id = p.user_id and ${visibleUser('u')}
    where p.symbol = any(${symbols}) and ${positionInRecord(sql)}`) as unknown as { symbol: string; user_id: number; unrealized_pct: number; fetched_at: Date }[];
  if (!rows.length) return out;
  const states = await recordStates(rows.map((r) => r.user_id));
  const shown = rows.filter((r) => ['connected', 'failed'].includes(states.get(r.user_id)?.state ?? 'none'));
  for (const symbol of symbols) {
    const mine = shown.filter((r) => r.symbol === symbol);
    const o = openSummary(mine.map((r) => r.unrealized_pct));
    // "As of" the oldest read counted: a record that stopped refreshing never reads as current.
    if (o) out.set(symbol, { o, traders: new Set(mine.map((r) => r.user_id)).size, asOf: new Date(Math.min(...mine.map((r) => r.fetched_at.getTime()))) });
  }
  return out;
});
