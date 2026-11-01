import { sql } from './db.ts';
import { isDemoUser } from './demo.ts';
import { publicRecord } from './connections.ts';
import { tradeSharePayload } from './trade-share.ts';
import { filerVisibleSql } from './public-gate.ts';

// The only query behind the trade page and card. A held thesis is nulled in SQL, so it never reaches rendering code.
export async function loadTradeShare(handle: string, sellId: string) {
  const [t] = await sql`
    select ct.user_id, ct.symbol, ct.return_pct, ct.holding_days, ct.closed_at,
      case when ct.thesis_status = 'published' then ct.thesis end as thesis,
      u.display_name, u.public_filer_id, ct.filing_url, ct.opened_at
    from closed_trades ct join users u on u.id = ct.user_id and u.deleted_at is null and ${filerVisibleSql('u')}
    where u.handle = ${handle} and ct.sell_id = ${sellId}`;
  if (!t) return null;
  const all = await sql`select symbol, opened_at, closed_at, return_pct, holding_days, verified from closed_trades where user_id = ${t.user_id}`;
  const payload = tradeSharePayload({
    symbol: t.symbol, returnPct: t.return_pct, holdingDays: t.holding_days, closedAt: t.closed_at,
    thesis: t.thesis, thesisStatus: t.thesis ? 'published' : null, demo: await isDemoUser(t.user_id),
    allTrades: all.map((r) => ({ symbol: r.symbol, openedAt: r.opened_at, closedAt: r.closed_at, returnPct: r.return_pct, holdingDays: r.holding_days })),
  }, new Date());
  // Fix round 6 (TR-3): the record state and source travel with the payload, so the card and the link preview apply
  // the profile's rule (a failed import is never presented as a whole verified record).
  const verified = all.length > 0 && all.every((r) => r.verified);
  const state = (await publicRecord(Number(t.user_id))).state;
  // F-7: a public record's filing links: the sale's, and the opening purchase's (C17: and never a New record).
  // ponytail: only the first matched purchase is linked (closed_trades keeps no lot list) — store the matched buys' filing ids at rebuild to link each.
  const bought = t.public_filer_id ? (await sql`select distinct filing_url from public_transactions where filer_id = ${t.public_filer_id} and side = 'BUY' and symbol = ${t.symbol} and executed_at = ${t.opened_at}`).map((r) => r.filing_url as string) : [];
  const filings = t.filing_url ? { sold: t.filing_url as string, bought } : null;
  return { ...payload, newRecord: payload.newRecord && !filings, handle, displayName: t.display_name as string, state, verified, filings };
}

// Route params may be percent-encoded; malformed input is a 404, not a 500.
export function decodeSellId(raw: string): string | null {
  try { return decodeURIComponent(raw); } catch { return null; }
}
