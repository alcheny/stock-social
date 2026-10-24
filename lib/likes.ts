// F-2 PR-4: the viewer's own trade-level choices, private like follows (POLICY F6): likes (double tap, +3 for PR-5) and
// trade rejects (the feed card's reject swipe, O1). Every read is keyed by the viewer's own id; nothing counts likes or
// lists who liked (lib/likes.test.ts scans the app for that). Keyed by trade_key (closed_trades.trade_key, the sha256
// of the closing sell's id), so a like or reject re-attaches after a rebuild; one whose trade is gone is kept and
// ignored on read. No event rows (PR-5).
import { createHash } from 'node:crypto';
import { sql } from './db.ts';
import { TRADE_REJECT_DAYS } from './discovery/weights.ts';
import type { RejectRow } from './discovery/exclusions.ts';

export const KEY = /^[0-9a-f]{64}$/;
export const tradeKey = (sellId: string): string => createHash('sha256').update(sellId, 'utf8').digest('hex');

// The trade's trader, or null for a malformed key, an unknown trade or the viewer's own trade.
async function traderOf(viewer: number, key: unknown): Promise<number | null> {
  if (typeof key !== 'string' || !KEY.test(key)) return null;
  const [t] = await sql`select t.user_id from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null where t.trade_key = ${key} limit 1`;
  return t && t.user_id !== viewer ? (t.user_id as number) : null;
}

export async function like(viewer: number, key: unknown): Promise<boolean> {
  const trader = await traderOf(viewer, key);
  if (!trader) return false;
  await sql`insert into trade_likes (viewer_id, trade_key, trader_id) values (${viewer}, ${key as string}, ${trader}) on conflict do nothing`;
  return true;
}
export async function unlike(viewer: number, key: unknown): Promise<boolean> {
  if (typeof key !== 'string' || !KEY.test(key)) return false;
  await sql`delete from trade_likes where viewer_id = ${viewer} and trade_key = ${key}`;
  return true;
}
// Which of these cards the viewer liked (the feed's like buttons, read by GET /me/liked).
export async function likedAmong(viewer: number, keys: string[]): Promise<Set<string>> {
  const ok = keys.filter((k) => KEY.test(k));
  if (!ok.length) return new Set();
  return new Set((await sql`select trade_key from trade_likes where viewer_id = ${viewer} and trade_key = any(${ok})`).map((r) => r.trade_key as string));
}

// /me/following "Liked records": the viewer's likes whose trade exists now, newest like first. No return shown there.
export type Liked = { key: string; sellId: string; symbol: string; closedAt: Date; handle: string; name: string };
export async function ownLikes(viewer: number): Promise<Liked[]> {
  const rows = await sql`select l.trade_key, t.sell_id, t.symbol, t.closed_at, u.handle, u.display_name from trade_likes l
    join closed_trades t on t.trade_key = l.trade_key join users u on u.id = t.user_id and u.deleted_at is null
    where l.viewer_id = ${viewer} order by l.created_at desc, t.closed_at desc limit 200`;
  return rows.map((r) => ({ key: r.trade_key as string, sellId: r.sell_id as string, symbol: r.symbol as string, closedAt: r.closed_at as Date, handle: r.handle as string, name: r.display_name as string }));
}

// The reject: hidden until now + TRADE_REJECT_DAYS ('infinity' when the owner makes it permanent). A repeat while
// running keeps its start; an ended one starts again now (a same-day cursor's list never re-shapes).
export async function rejectTrade(viewer: number, key: unknown): Promise<boolean> {
  const trader = await traderOf(viewer, key);
  if (!trader) return false;
  const until = Number.isFinite(TRADE_REJECT_DAYS) ? sql`now() + ${TRADE_REJECT_DAYS} * interval '1 day'` : sql`'infinity'::timestamptz`;
  await sql`insert into trade_rejects (viewer_id, trade_key, trader_id, until) values (${viewer}, ${key as string}, ${trader}, ${until})
    on conflict (viewer_id, trade_key) do update set until = excluded.until,
      created_at = case when trade_rejects.until > now() then trade_rejects.created_at else now() end
    where trade_rejects.viewer_id = ${viewer}`;
  return true;
}
export async function undoReject(viewer: number, key: unknown): Promise<boolean> {
  if (typeof key !== 'string' || !KEY.test(key)) return false;
  await sql`update trade_rejects set until = now() where viewer_id = ${viewer} and trade_key = ${key} and until > now()`;
  return true;
}
// The feed's read: the viewer's rejects running at `since` or later (a reject's trader part never outlasts its until).
export async function rejectsFor(viewer: number, since: Date): Promise<RejectRow[]> {
  const rows = await sql`select trade_key, trader_id, created_at, until from trade_rejects where viewer_id = ${viewer} and until > ${since}`;
  return rows.map((r) => ({ key: r.trade_key as string, trader: r.trader_id as number, createdAt: (r.created_at as Date).getTime(), until: untilMs(r.until) }));
}
const untilMs = (u: unknown) => (u instanceof Date && !Number.isNaN(u.getTime()) ? u.getTime() : Infinity); // 'infinity' reads as an invalid Date
// Similar trades (lib/similar.ts): the trades this viewer has hidden now.
export async function rejectedKeys(viewer: number): Promise<string[]> {
  return (await sql`select trade_key from trade_rejects where viewer_id = ${viewer} and until > now()`).map((r) => r.trade_key as string);
}
