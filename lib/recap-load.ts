import { sql } from './db.ts';
import { isDemoUser } from './demo.ts';
import { publicRecord } from './connections.ts';
import { monthRecap, wholeRecord } from './recap.ts';
import { filerVisibleSql } from './public-gate.ts';

// The only query behind the recap page and card. Reads closed_trades only, so recaps stay public after disconnect.
export async function loadRecap(handle: string, ym: string) {
  const [u] = await sql`select id, display_name, public_filer_id from users u where handle = ${handle} and deleted_at is null and ${filerVisibleSql('u')}`;
  if (!u) return null;
  const rows = await sql`select sell_id, symbol, verified, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${u.id}`;
  const all = rows.map((r) => ({ sellId: r.sell_id as string, symbol: r.symbol as string, openedAt: r.opened_at as Date, closedAt: r.closed_at as Date, returnPct: r.return_pct as number, holdingDays: r.holding_days as number }));
  const now = new Date();
  const recap = monthRecap(all, ym, now);
  if (!recap) return null;
  const record = wholeRecord(all, now);
  // F-7 (C17): a public record never shows New record.
  return { handle, displayName: u.display_name as string, demo: await isDemoUser(u.id), verified: rows.length > 0 && rows.every((r) => r.verified), state: (await publicRecord(Number(u.id))).state, recap, record: { ...record, newRecord: record.newRecord && !u.public_filer_id } };
}
