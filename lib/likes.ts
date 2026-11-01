// F-2 PR-4: private likes and rejected trades. Every read and write here is keyed by the viewer's own id; nothing counts
// likes or lists who liked a trade (POLICY F6; lib/likes.test.ts scans the app). Both are keyed by the close's
// trade_key (a generated column: sha256 of its sell id), which survives rebuildTrades. Stored only: before PR-5 they
// change nothing shown but this viewer's own hidden set (a rejected trade) and their own likes list.
import { createHash } from 'node:crypto';
import { sql } from './db.ts';
import type { Signal } from './discovery/weights.ts';
import { followable, unfollowsFor } from './follows.ts';
import { filerVisibleSql } from './public-gate.ts';

export const tradeKey = (sellId: string) => createHash('sha256').update(sellId, 'utf8').digest('hex');
export const LIKES_PAGE = 50;
const ID = /^[0-9]{1,18}$/;

// The close a feed card names, never the viewer's own: by its trade_key (64 hex, what cards send: it survives
// rebuildTrades, which deletes and re-inserts closed_trades with new ids, so a page rendered before a rebuild still
// acts on the right close) or by its closed_trades id (older pages, no-JS forms rendered before this change). Both are
// checked by shape before any query; the same live-trader and not-your-own rules apply either way.
const TRADE_KEY = /^[0-9a-f]{64}$/;
async function close(viewer: number, ref: unknown): Promise<{ key: string; trader: number } | null> {
  if (typeof ref !== 'string' || !(TRADE_KEY.test(ref) || ID.test(ref))) return null;
  const [r] = TRADE_KEY.test(ref)
    ? await sql`select t.trade_key, t.user_id from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null where t.trade_key = ${ref} limit 1`
    : await sql`select t.trade_key, t.user_id from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null where t.id = ${ref}`;
  return r && r.user_id !== viewer ? { key: r.trade_key as string, trader: r.user_id as number } : null;
}

export async function like(viewer: number, id: unknown): Promise<boolean> {
  const c = await close(viewer, id);
  if (c && !(await followable(c.trader))) return false; // F-7 (C16): no Like on a public-record trade
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
  // Fix round 1 (business lead 1): a hidden trade is not also a liked one. The like moves into the exclusion (its time
  // kept in liked_at), so Undo puts it back where it was in the likes list.
  if (c) await sql`with d as (delete from trade_likes where viewer_id = ${viewer} and trade_key = ${c.key} returning created_at)
    insert into trade_exclusions (viewer_id, trade_key, trader_id, liked_at) values (${viewer}, ${c.key}, ${c.trader}, (select created_at from d))
    on conflict (viewer_id, trade_key) do update set liked_at = coalesce(trade_exclusions.liked_at, excluded.liked_at)`;
  return !!c;
}
export async function undoRejectTrade(viewer: number, id: unknown): Promise<boolean> {
  const c = await close(viewer, id);
  if (c) await sql`with d as (delete from trade_exclusions where viewer_id = ${viewer} and trade_key = ${c.key} returning trader_id, liked_at)
    insert into trade_likes (viewer_id, trade_key, trader_id, created_at) select ${viewer}, ${c.key}, trader_id, liked_at from d where liked_at is not null
    on conflict do nothing`;
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
// Each chosen like's close is found by its trade_key alone, then checked against the trader (`offset 0` keeps the
// trader condition out of the scan): with closed_trades (user_id, closed_at desc) on offer, a planner misled by stale
// statistics could walk the trader's closes newest first until it met the like's, so an older like, deeper in the
// list, cost more (up to all 10,000 of a trader's closes per like), or AND every like's lookup with all of them.
// ponytail: before planner statistics exist the first page (no cursor) and shallow pages may sort all of the viewer's likes below the cursor instead of reading 51 in index order (about 13 ms vs 1 ms for 10,000 likes; fast in time, not in rows read) — autovacuum's analyze fixes it; an analyze after bulk imports, or a plan the planner cannot choose (no hints in Postgres), would remove the dependence
// A like whose close is gone after a rebuild, or whose trader was deleted, is skipped (its page is one row shorter).
export type Liked = { key: string; handle: string; name: string; symbol: string; sellId: string; returnPct: number; closedAt: Date };
// The page's query, not yet run (lib/likes.test.ts EXPLAINs it to hold that a deep page reads no more rows than the first).
export function ownLikesQuery(viewer: number, after?: unknown) {
  const m = typeof after === 'string' ? /^([0-9]{1,17})\.([0-9a-f]{64})$/.exec(after) : null;
  return sql`with l as materialized (
      select trade_key, trader_id, created_at, (extract(epoch from created_at) * 1000000)::bigint::text as us from trade_likes
      where viewer_id = ${viewer} ${m ? sql`and (created_at, trade_key) < (timestamptz 'epoch' + ${m[1]}::bigint * interval '1 microsecond', ${m[2]})` : sql``}
      order by created_at desc, trade_key desc limit ${LIKES_PAGE + 1})
    select l.trade_key, l.us, u.handle, u.display_name, t.symbol, t.sell_id, t.return_pct, t.closed_at
    from l left join lateral (select symbol, sell_id, return_pct, closed_at from (select symbol, sell_id, return_pct, closed_at, user_id from closed_trades
        where trade_key = l.trade_key offset 0) c where c.user_id = l.trader_id limit 1) t on true
      left join users u on u.id = l.trader_id and u.deleted_at is null
    order by l.created_at desc, l.trade_key desc`;
}
export async function ownLikes(viewer: number, after?: unknown): Promise<{ rows: Liked[]; next: string | null }> {
  const rows = await ownLikesQuery(viewer, after);
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

// ---- F-2 PR-5 (criterion 15, shipped before behavior-based ordering): the viewer's own hidden trades (/me/hidden). ----
// A rejected trade stays out of that viewer's feed until they show it again. A hidden trade whose close is gone or whose
// trader was deleted is not listed or counted (lib/privacy-purge.ts removes it 30 days after it is first seen gone).
const KEY = /^[0-9a-f]{64}$/;
const AFTER = /^([0-9]{1,17})\.([0-9a-f]{64})$/;
// ponytail: a page skips hidden trades whose close is gone (until the privacy purge removes them), so it can show fewer
// than HIDDEN_PAGE rows — filtering in the keyset query would keep pages full.
export const HIDDEN_PAGE = 30;

// The viewer's own number of hidden trades whose close exists, for their feed line, read as at most HIDDEN_COUNT_MAX + 1
// rows (past HIDDEN_COUNT_MAX the line says "1,000+"; nothing here counts anyone else's).
// ponytail: past HIDDEN_COUNT_MAX the line says "1,000+" — an exact count would need a stored per-viewer counter.
export const HIDDEN_COUNT_MAX = 1_000;
export async function hiddenTradeCount(viewer: number): Promise<number> {
  return (await sql`select 1 from trade_exclusions x
    where x.viewer_id = ${viewer} and exists (select 1 from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
      where t.trade_key = x.trade_key and t.user_id = x.trader_id) limit ${HIDDEN_COUNT_MAX + 1}`).length;
}

export type HiddenTrade = { key: string; handle: string; name: string; symbol: string; sellId: string; closedAt: Date; verified: boolean; filer: 'public' | 'public_demo' | null };
// Newest first, HIDDEN_PAGE at a time (keyset on created_at in microseconds, then key), like /me/likes.
export async function ownHiddenTrades(viewer: number, after?: unknown): Promise<{ rows: HiddenTrade[]; next: string | null }> {
  const m = typeof after === 'string' ? AFTER.exec(after) : null;
  const rows = await sql`with x as materialized (
      select trade_key, trader_id, created_at, (extract(epoch from created_at) * 1000000)::bigint::text as us from trade_exclusions
      where viewer_id = ${viewer} ${m ? sql`and (created_at, trade_key) < (timestamptz 'epoch' + ${m[1]}::bigint * interval '1 microsecond', ${m[2]})` : sql``}
      order by created_at desc, trade_key desc limit ${HIDDEN_PAGE + 1})
    select x.trade_key, x.us, u.handle, u.display_name, t.symbol, t.sell_id, t.closed_at, t.verified, (select pf.demo from public_filers pf where pf.id = u.public_filer_id) as pf_demo
    from x left join lateral (select symbol, sell_id, closed_at, verified from closed_trades where trade_key = x.trade_key and user_id = x.trader_id limit 1) t on true
      left join users u on u.id = x.trader_id and u.deleted_at is null and ${filerVisibleSql('u')}
    order by x.created_at desc, x.trade_key desc`;
  const page = rows.slice(0, HIDDEN_PAGE), last = page.at(-1);
  return {
    rows: page.filter((r) => r.sell_id !== null && r.handle !== null).map((r) => ({ key: r.trade_key as string, handle: r.handle as string,
      name: r.display_name as string, symbol: r.symbol as string, sellId: r.sell_id as string, closedAt: r.closed_at as Date, verified: r.verified as boolean,
      filer: r.pf_demo === null ? null : r.pf_demo ? 'public_demo' : 'public' })), // F-7: a filer's row is labelled Public filing
    next: rows.length > HIDDEN_PAGE && last ? `${last.us}.${last.trade_key}` : null,
  };
}

// "Show again" by the trade's key: the row goes at once (the feed reads rejects live) and a like it carried comes back,
// as lib/likes.ts#undoRejectTrade does for a card id.
export async function showTradeAgain(viewer: number, key: unknown): Promise<boolean> {
  if (typeof key !== 'string' || !KEY.test(key)) return false;
  await sql`with d as (delete from trade_exclusions where viewer_id = ${viewer} and trade_key = ${key} returning trader_id, liked_at)
    insert into trade_likes (viewer_id, trade_key, trader_id, created_at) select ${viewer}, ${key}, trader_id, liked_at from d where liked_at is not null
    on conflict do nothing`;
  return true;
}

// The /me/hidden status line after "Show again" (`?back=<key>`): the trader's handle when that trade exists and is not
// hidden by this viewer now, so a crafted link can only state something true.
export async function backHandle(viewer: number, key: unknown): Promise<string | null> {
  if (typeof key !== 'string' || !KEY.test(key)) return null;
  const [r] = await sql`select u.handle from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
    where t.trade_key = ${key} and t.user_id <> ${viewer}
      and not exists (select 1 from trade_exclusions x where x.viewer_id = ${viewer} and x.trade_key = ${key}) limit 1`;
  return r ? (r.handle as string) : null;
}

// ---- F-2 PR-5: personal ordering's inputs (lib/discovery/personal-load.ts): this viewer's likes and rejected trades made
// at or before asOf and after `since`, with the close's symbol when it still exists. ----
export type Dated = { trader: number; at: number; symbol: string | null };
const dated = (rows: readonly Record<string, unknown>[]): Dated[] => rows.map((r) => ({ trader: r.trader_id as number, at: (r.created_at as Date).getTime(), symbol: (r.symbol as string | null) ?? null }));
export async function likesAt(viewer: number, since: Date, asOf: Date): Promise<Dated[]> {
  return dated(await sql`select l.trader_id, l.created_at, (select t.symbol from closed_trades t where t.trade_key = l.trade_key and t.user_id = l.trader_id limit 1) as symbol
    from trade_likes l where l.viewer_id = ${viewer} and l.created_at <= ${asOf} and l.created_at > ${since}`);
}
export async function rejectsAt(viewer: number, since: Date, asOf: Date): Promise<Dated[]> {
  return dated(await sql`select x.trader_id, x.created_at, (select t.symbol from closed_trades t where t.trade_key = x.trade_key and t.user_id = x.trader_id limit 1) as symbol
    from trade_exclusions x where x.viewer_id = ${viewer} and x.created_at <= ${asOf} and x.created_at > ${since}`);
}
