import { sql } from './db.ts';
import { isDemoUser } from './demo.ts';
import { tradeSharePayload } from './trade-share.ts';

// The only query behind the trade page and card. A held thesis is nulled in SQL, so it never reaches rendering code.
export async function loadTradeShare(handle: string, sellId: string) {
  const [t] = await sql`
    select ct.user_id, ct.symbol, ct.return_pct, ct.holding_days, ct.closed_at,
      case when ct.thesis_status = 'published' then ct.thesis end as thesis,
      u.display_name
    from closed_trades ct join users u on u.id = ct.user_id
    where u.handle = ${handle} and ct.sell_id = ${sellId}`;
  if (!t) return null;
  const all = await sql`select symbol, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${t.user_id}`;
  const payload = tradeSharePayload({
    symbol: t.symbol, returnPct: t.return_pct, holdingDays: t.holding_days, closedAt: t.closed_at,
    thesis: t.thesis, thesisStatus: t.thesis ? 'published' : null, demo: await isDemoUser(t.user_id),
    allTrades: all.map((r) => ({ symbol: r.symbol, openedAt: r.opened_at, closedAt: r.closed_at, returnPct: r.return_pct, holdingDays: r.holding_days })),
  }, new Date());
  return { ...payload, handle, displayName: t.display_name as string };
}

// Route params may be percent-encoded; malformed input is a 404, not a 500.
export function decodeSellId(raw: string): string | null {
  try { return decodeURIComponent(raw); } catch { return null; }
}
