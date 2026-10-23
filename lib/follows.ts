// F-2 PR-2: follows and "not interested", private to the viewer (POLICY F6). Every read here is keyed by the viewer's
// own id; nothing counts follows or lists who follows a trader (lib/follows.test.ts scans the app for that).
// "Not interested" and unfollow both write a 90-day exclusion (criterion 4); Undo, "Show again" and a new follow end
// it (until = now()) without deleting it, so a same-day feed cursor never changes (lib/discovery/exclusions.ts).
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { EXCLUSION_DAYS } from './discovery/weights.ts';
import type { ExclusionRow } from './discovery/exclusions.ts';

type Tx = typeof sql | TransactionSql;
const HANDLE = /^[a-z0-9_]{3,20}$/;

// The trader a handle names, checked against the pattern before any query (F-1: a NUL byte made the database a 500).
export async function traderId(handle: unknown): Promise<number | null> {
  if (typeof handle !== 'string' || !HANDLE.test(handle)) return null;
  const [u] = await sql`select id from users where handle = ${handle} and deleted_at is null`;
  return u ? (u.id as number) : null;
}

// `first`: the viewer followed no one before (the privacy line shows once).
export async function follow(viewer: number, trader: number): Promise<{ first: boolean }> {
  return sql.begin(async (tx) => {
    const [{ any }] = await tx`select exists (select 1 from follows where viewer_id = ${viewer}) as any`;
    await tx`insert into follows (viewer_id, trader_id) values (${viewer}, ${trader}) on conflict do nothing`;
    await endExclusion(viewer, trader, tx);
    return { first: !any };
  });
}

export async function unfollow(viewer: number, trader: number): Promise<void> {
  await sql.begin(async (tx) => {
    const gone = await tx`delete from follows where viewer_id = ${viewer} and trader_id = ${trader} returning 1`;
    if (gone.length) await exclude(viewer, trader, 'unfollow', tx);
  });
}

// A running exclusion is extended and keeps its start; an ended one starts again now.
export async function exclude(viewer: number, trader: number, reason: 'not_interested' | 'unfollow', tx: Tx = sql): Promise<void> {
  await tx`insert into viewer_exclusions (viewer_id, trader_id, until, reason)
    values (${viewer}, ${trader}, now() + ${EXCLUSION_DAYS} * interval '1 day', ${reason})
    on conflict (viewer_id, trader_id) do update set until = excluded.until, reason = excluded.reason,
      created_at = case when viewer_exclusions.until > now() then viewer_exclusions.created_at else now() end`;
}

export async function endExclusion(viewer: number, trader: number, tx: Tx = sql): Promise<void> {
  await tx`update viewer_exclusions set until = now() where viewer_id = ${viewer} and trader_id = ${trader} and until > now()`;
}

// The feed's reads: the viewer's exclusions running at `since` or later, and which of the page's traders they follow.
export async function exclusionsFor(viewer: number, since: Date): Promise<ExclusionRow[]> {
  const rows = await sql`select trader_id, created_at, until from viewer_exclusions where viewer_id = ${viewer} and until > ${since}`;
  return rows.map((r) => ({ trader: r.trader_id as number, createdAt: (r.created_at as Date).getTime(), until: (r.until as Date).getTime() }));
}
export async function followingAmong(viewer: number, traders: number[]): Promise<Set<number>> {
  if (!traders.length) return new Set();
  return new Set((await sql`select trader_id from follows where viewer_id = ${viewer} and trader_id = any(${traders})`).map((r) => r.trader_id as number));
}

// /me/following: the viewer's own lists.
export type Listed = { handle: string; name: string; until?: Date };
export async function ownLists(viewer: number): Promise<{ following: Listed[]; hidden: Listed[] }> {
  const [following, hidden] = await Promise.all([
    sql`select u.handle, u.display_name from follows f join users u on u.id = f.trader_id and u.deleted_at is null
      where f.viewer_id = ${viewer} order by f.created_at desc`,
    sql`select u.handle, u.display_name, x.until from viewer_exclusions x join users u on u.id = x.trader_id and u.deleted_at is null
      where x.viewer_id = ${viewer} and x.until > now() order by x.created_at desc`,
  ]);
  const listed = (r: Record<string, unknown>): Listed => ({ handle: r.handle as string, name: r.display_name as string, ...(r.until ? { until: r.until as Date } : {}) });
  return { following: following.map(listed), hidden: hidden.map(listed) };
}
