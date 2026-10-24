// F-2 PR-4: private likes and rejected trades. Every read and write here is keyed by the viewer's own id; nothing counts
// likes or lists who liked a trade (POLICY F6; lib/likes.test.ts scans the app). Both are keyed by the close's
// trade_key (a generated column: sha256 of its sell id), which survives rebuildTrades. Stored only: before PR-5 they
// change nothing shown but this viewer's own hidden set (a rejected trade) and their own likes list.
import { createHash } from 'node:crypto';
import { sql } from './db.ts';
import type { Signal } from './discovery/weights.ts';
import { unfollowsFor } from './follows.ts';

export const tradeKey = (sellId: string) => createHash('sha256').update(sellId, 'utf8').digest('hex');
export const LIKES_PAGE = 50;
const ID = /^[0-9]{1,18}$/;

// The close a feed card names (its closed_trades id, checked before any query), never the viewer's own.
async function close(viewer: number, id: unknown): Promise<{ key: string; trader: number } | null> {
  if (typeof id !== 'string' || !ID.test(id)) return null;
  const [r] = await sql`select t.trade_key, t.user_id from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null where t.id = ${id}`;
  return r && r.user_id !== viewer ? { key: r.trade_key as string, trader: r.user_id as number } : null;
}

export async function like(viewer: number, id: unknown): Promise<boolean> {
  const c = await close(viewer, id);
  if (c) await sql`insert into trade_likes (viewer_id, trade_key, trader_id) values (${viewer}, ${c.key}, ${c.trader}) on conflict do nothing`;
  return !!c;
}
// By the card's id, or by the key itself (the likes list, where the close may be gone).
export async function unlike(viewer: number, ref: { id?: unknown; key?: unknown }): Promise<boolean> {
  const key = typeof ref.key === 'string' && /^[0-9a-f]{64}$/.test(ref.key) ? ref.key : (await close(viewer, ref.id))?.key;
  if (key) await sql`delete from trade_likes where viewer_id = ${viewer} and trade_key = ${key}`;
  return !!key;
}
export async function rejectTrade(viewer: number, id: unknown): Promise<boolean> {
  const c = await close(viewer, id);
  if (c) await sql`insert into trade_exclusions (viewer_id, trade_key, trader_id) values (${viewer}, ${c.key}, ${c.trader}) on conflict do nothing`;
  return !!c;
}
export async function undoRejectTrade(viewer: number, id: unknown): Promise<boolean> {
  const c = await close(viewer, id);
  if (c) await sql`delete from trade_exclusions where viewer_id = ${viewer} and trade_key = ${c.key}`;
  return !!c;
}

// The feed page's cards this viewer liked (by card id), and the sell ids among the page's this viewer rejected.
export async function likedAmong(viewer: number, ids: readonly (string | number)[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  return new Set((await sql`select t.id from trade_likes l join closed_trades t on t.trade_key = l.trade_key
    where l.viewer_id = ${viewer} and t.id = any(${ids.map(String)})`).map((r) => String(r.id)));
}
export async function rejectedAmong(viewer: number, sellIds: readonly string[]): Promise<Set<string>> {
  if (!sellIds.length) return new Set();
  const keys = new Map(sellIds.map((s) => [tradeKey(s), s]));
  return new Set((await sql`select trade_key from trade_exclusions where viewer_id = ${viewer} and trade_key = any(${[...keys.keys()]})`)
    .map((r) => keys.get(r.trade_key as string)!));
}

// /me/likes: the viewer's likes, newest first, LIKES_PAGE at a time (keyset on created_at in microseconds, then key). The
// page's likes are chosen first on the viewer's index, then joined (a plan that stays fast before statistics exist).
// A like whose close is gone after a rebuild, or whose trader was deleted, is skipped (its page is one row shorter).
export type Liked = { key: string; handle: string; name: string; symbol: string; sellId: string; returnPct: number; closedAt: Date };
export async function ownLikes(viewer: number, after?: unknown): Promise<{ rows: Liked[]; next: string | null }> {
  const m = typeof after === 'string' ? /^([0-9]{1,17})\.([0-9a-f]{64})$/.exec(after) : null;
  const rows = await sql`with l as materialized (
      select trade_key, trader_id, created_at, (extract(epoch from created_at) * 1000000)::bigint::text as us from trade_likes
      where viewer_id = ${viewer} ${m ? sql`and (created_at, trade_key) < (timestamptz 'epoch' + ${m[1]}::bigint * interval '1 microsecond', ${m[2]})` : sql``}
      order by created_at desc, trade_key desc limit ${LIKES_PAGE + 1})
    select l.trade_key, l.us, u.handle, u.display_name, t.symbol, t.sell_id, t.return_pct, t.closed_at
    from l left join lateral (select symbol, sell_id, return_pct, closed_at from closed_trades where trade_key = l.trade_key and user_id = l.trader_id limit 1) t on true
      left join users u on u.id = l.trader_id and u.deleted_at is null
    order by l.created_at desc, l.trade_key desc`;
  const page = rows.slice(0, LIKES_PAGE);
  const last = page.at(-1);
  return {
    rows: page.filter((r) => r.sell_id !== null && r.handle !== null).map((r) => ({ key: r.trade_key as string, handle: r.handle as string, name: r.display_name as string,
      symbol: r.symbol as string, sellId: r.sell_id as string, returnPct: r.return_pct as number, closedAt: r.closed_at as Date })),
    next: rows.length > LIKES_PAGE && last ? `${last.us}.${last.trade_key}` : null,
  };
}

// PR-5's input (lib/discovery/weights.ts#traderPreference): this viewer's stored choices. Read by nothing shown yet.
export async function signalsFor(viewer: number): Promise<Signal[]> {
  const [rows, unfollows] = await Promise.all([sql`select trader_id, 'like' as kind, created_at from trade_likes where viewer_id = ${viewer}
    union all select trader_id, 'tradeReject', created_at from trade_exclusions where viewer_id = ${viewer}`, unfollowsFor(viewer)]);
  return [...rows.map((r) => ({ trader: r.trader_id as number, kind: r.kind as Signal['kind'], at: (r.created_at as Date).getTime() })),
    ...unfollows.map((u) => ({ trader: u.trader, kind: 'unfollow' as const, at: u.at }))];
}
