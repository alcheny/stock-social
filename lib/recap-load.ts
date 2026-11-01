import { sql } from './db.ts';
import { isDemoUser } from './demo.ts';
import { publicRecord } from './connections.ts';
import { monthRecap, monthsOnRecord, wholeRecord, type RecapView } from './recap.ts';
import { openPercents } from './trade-share-load.ts';
import { routeHandle } from './params.ts';
import { statusFor } from './record-status-load.ts'; // FIXES-LABELS: status

// The only query behind the recap page and card. Reads closed_trades (so recaps stay public after disconnect), plus the
// open positions' unrealized percents for the strip's open count on a connected or failed record (F-12).
export async function loadRecap(handle: string, ym: string) {
  if (!routeHandle(handle)) return null; // F12: junk in the URL is a 404, not a database error
  const [u] = await sql`select id, display_name from users where handle = ${handle} and deleted_at is null`;
  if (!u) return null;
  const rows = await sql`select sell_id, symbol, verified, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${u.id} order by closed_at desc, id desc`; // F-12: the profile's order, so sums match it to the bit
  const all = rows.map((r) => ({ sellId: r.sell_id as string, symbol: r.symbol as string, openedAt: r.opened_at as Date, closedAt: r.closed_at as Date, returnPct: r.return_pct as number, holdingDays: r.holding_days as number }));
  const now = new Date();
  const recap = monthRecap(all, ym, now);
  if (!recap) return null;
  const state = (await publicRecord(Number(u.id))).state;
  // FIXES-LABELS: status (F-11): the status-line facts beside the state (the page renders live, the image static).
  return { handle, displayName: u.display_name as string, demo: await isDemoUser(u.id), verified: rows.length > 0 && rows.every((r) => r.verified), state, recap, record: wholeRecord(all, now), open: await openPercents(Number(u.id), state), months: monthsOnRecord(all) /* FIXES-LABELS (D-24) */, status: await statusFor(Number(u.id), state) } satisfies RecapView;
}
