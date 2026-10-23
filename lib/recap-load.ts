import { sql } from './db.ts';
import { isDemoUser } from './demo.ts';
import { publicRecord } from './connections.ts';
import { monthRecap, wholeRecord } from './recap.ts';

// The only query behind the recap page and card. Reads closed_trades only, so recaps stay public after disconnect.
export async function loadRecap(handle: string, ym: string) {
  const [u] = await sql`select id, display_name from users where handle = ${handle} and deleted_at is null`;
  if (!u) return null;
  const rows = await sql`select sell_id, symbol, verified, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${u.id}`;
  const all = rows.map((r) => ({ sellId: r.sell_id as string, symbol: r.symbol as string, openedAt: r.opened_at as Date, closedAt: r.closed_at as Date, returnPct: r.return_pct as number, holdingDays: r.holding_days as number }));
  const now = new Date();
  const recap = monthRecap(all, ym, now);
  if (!recap) return null;
  return { handle, displayName: u.display_name as string, demo: await isDemoUser(u.id), verified: rows.length > 0 && rows.every((r) => r.verified), state: (await publicRecord(Number(u.id))).state, recap, record: wholeRecord(all, now) };
}
