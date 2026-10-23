import { sql } from './db.ts';
import { recordStates, type RecordStatus } from './connections.ts';
import { groupByUser } from './pane.ts';
import { confidence, evidenceWeight, rankTraders, type ConfidenceInput } from './trades.ts';
import { mixFeed } from './discovery/explore.ts';
import { encodeCursor, pageOf, readCursor } from './discovery/pager.ts';

// Feed ranking (DESIGN §2.6): size of move × recency. |return| means losses rank as high as equal gains.
// score = ln(1 + |r|·100) · exp(-max(0, min(age_hours / RECENCY_HOURS, MAX_DECAY)))
// F-1 PR-3 fix round 4 (business lead blocker): unclamped, exp(-age/48) underflows past ~35,800 hours (4.08 years) and
// the database raises "value out of range: underflow" for the whole feed. The exponent is clamped at MAX_DECAY:
// e^-600 ≈ 2.7e-261 stays a normal double, and so does its product with the smallest non-zero size term
// (ln(1 + 2.2e-16) ≈ 2.2e-16). Closes younger than MAX_DECAY × RECENCY_HOURS (3.3 years) score exactly as before; older
// ones share the floor and keep their order by size of move. Ties break on (closed_at, id), newest first (a future
// closed_at reads as now, fix round 6).
// F-1 PR-3 fix round 6 (engineer re-sit, Medium): the age is clamped below at 0 as well. A close dated in the future
// (the vendor's trade date is not checked by the database) had a negative age, so exp() grew: a close a day ahead
// outranked every real close and one ~3.9 years ahead overflowed the double ("value out of range: overflow", the whole
// feed failed). Clamped, a future date scores exactly like a close at this instant, never above, and its tie-break
// reads it as this instant too (it never wins a tie by its future date). The rebuild also
// quarantines activities dated more than a day ahead (lib/sync.ts#FUTURE_GRACE_HOURS), so such closes should not exist.
export const RECENCY_HOURS = 48;
export const MAX_DECAY = 600;
export const FEED_CANDIDATES = 200;

export type FeedCandidate = {
  id: number; sell_id: string; symbol: string; return_pct: number; holding_days: number; closed_at: Date; verified: boolean;
  thesis: string | null; thesis_status: string | null; handle: string; display_name: string; user_id: number; score: number;
};

// `ids` is a test hook (rank only these traders); the feed passes none.
// F-2 PR-1: `asOf` freezes the ranking clock for a feed session (lib/discovery/pager.ts): the score's age, the
// eligibility count and the candidate set read only closes at or before it, so a page built later slices the same list.
// Without it the clock is now() and nothing is filtered (today's behavior). A close dated in the future therefore
// enters a paged feed when its date arrives (the rebuild quarantines anything more than a day ahead).
// Ties break on the close's vendor id (unique, kept across rebuilds), not the row id (which a rebuild renumbers).
export async function feedCandidates(opts: { ids?: number[]; asOf?: Date } = {}): Promise<FeedCandidate[]> {
  const clock = opts.asOf ? sql`${opts.asOf}::timestamptz` : sql`now()`;
  const upTo = opts.asOf ? sql`and closed_at <= ${opts.asOf}` : sql``;
  // date_part is double precision (extract() is numeric since PostgreSQL 14: the same value, several times slower per
  // row; F-2 PR-1 load check).
  const score = sql`ln(1 + abs(t.return_pct) * 100) * exp(-greatest(0::float8, least(date_part('epoch', ${clock} - t.closed_at) / 3600 / ${RECENCY_HOURS}::float8, ${MAX_DECAY}::float8)))`;
  // The eligible traders first (≥ 5 closes, not deleted, no import running), then one pass over their closes (F-2 PR-1
  // load check: a hash semi-join over a small set instead of merge joins over every row).
  return (await sql`
    with elig as materialized (
      (select user_id from closed_trades where true ${upTo} ${opts.ids ? sql`and user_id in ${sql(opts.ids.length ? opts.ids : [0])}` : sql``}
       group by user_id having count(*) >= 5)
      intersect select id from users where deleted_at is null
      -- F-1 fix round 3 (TR-3): a record with an import still running is not in the feed until it is whole.
      except select user_id from connections where state = 'importing' and consent_at is not null
    ), top as (
      select t.id, t.sell_id, t.symbol, t.return_pct, t.holding_days, t.closed_at, t.verified, t.thesis, t.thesis_status, t.user_id, ${score} as score
      from closed_trades t where t.user_id in (select user_id from elig) ${opts.asOf ? sql`and t.closed_at <= ${opts.asOf}` : sql``}
      order by score desc, least(t.closed_at, ${clock}) desc, t.sell_id desc
      limit ${FEED_CANDIDATES}
    )
    select top.*, u.handle, u.display_name from top join users u on u.id = top.user_id
    order by top.score desc, least(top.closed_at, ${clock}) desc, top.sell_id desc`) as unknown as FeedCandidate[];
}

// ---- F-2 PR-1: feed mix and paging ----
// The feed is one list per (UTC day, asOf): candidates at asOf → TR-9 ranking (lower bound, losses weigh like gains)
// → diversity caps and seeded exploration (lib/discovery/explore.ts). Pages are 30-card slices of it. The same list
// for every viewer, signed in or out; nothing here reads a session or a viewer table (lib/feed.signed-out.test.ts).
export type FeedItem = FeedCandidate & { explore: boolean };
export type PaneRow = { userId: number; id: string; symbol: string; returnPct: number; holdingDays: number; closedAt: Date; verified: boolean; thesis: string | null };

async function records(userIds: number[]) {
  // One batched query for every candidate trader's full record (weights here; pane chart and stats on the page). Times
  // travel as epoch milliseconds (a number parses far faster than a timestamp string: F-2 PR-1 load check).
  const rows = userIds.length ? await sql`
    select user_id, id::text as id, symbol, return_pct, holding_days, verified,
           date_part('epoch', opened_at) * 1000 as opened, date_part('epoch', closed_at) * 1000 as closed,
           case when thesis_status = 'published' then thesis end as thesis
    from closed_trades where user_id = any(${userIds})` : [];
  return rows.map((r) => ({
    userId: r.user_id as number, id: r.id as string, symbol: r.symbol as string, returnPct: r.return_pct as number,
    holdingDays: r.holding_days as number, openedAt: new Date(r.opened as number), closedAt: new Date(r.closed as number), verified: r.verified as boolean,
    thesis: r.thesis as string | null,
  }));
}

export async function feedList(opts: { asOf: Date; day: string; ids?: number[] }) {
  const candidates = await feedCandidates({ asOf: opts.asOf, ids: opts.ids });
  const rows = await records([...new Set(candidates.map((t) => t.user_id))]);
  // Rank by the pace-interval lower bound (TR-9): small lucky samples can't top the feed. Losses weigh like gains.
  // Read at asOf: a close after it changes no weight.
  const byTrader = new Map<number, ConfidenceInput[]>();
  for (const r of rows) {
    if (r.closedAt > opts.asOf) continue;
    const ts = byTrader.get(r.userId);
    if (ts) ts.push(r); else byTrader.set(r.userId, [r]);
  }
  const weight = new Map([...byTrader].map(([id, ts]) => [id, evidenceWeight(confidence(ts, opts.asOf))]));
  const ranked = rankTraders(candidates.map((t) => ({ t, score: Number(t.score), weight: weight.get(t.user_id) ?? 0 })))
    .map(({ t }) => ({ ...t, key: t.sell_id, trader: t.user_id }));
  const list: FeedItem[] = mixFeed(ranked, { day: opts.day }).map(({ card: { key: _k, trader: _t, ...t }, explore }) => ({ ...t, explore }));
  return { list, rows };
}

export type FeedPage = {
  cards: FeedItem[]; offset: number; asOf: Date; next: string | null;
  byUser: Map<number, PaneRow[]>; records: Map<number, RecordStatus>;
};

// One page of the feed for a `?after=` value (or the paging action's cursor). Anything invalid is page 1.
export async function loadFeedPage(after: unknown, opts: { now?: number; ids?: number[] } = {}): Promise<FeedPage> {
  const c = readCursor(after, opts.now ?? Date.now(), FEED_CANDIDATES);
  const asOf = new Date(c.asOf);
  const { list, rows } = await feedList({ asOf, day: c.day, ids: opts.ids });
  const page = pageOf(list, c);
  const onPage = new Set(page.items.map((t) => t.user_id));
  const byUser = groupByUser(rows.filter((r) => onPage.has(r.userId)).map(({ openedAt: _o, ...r }) => r));
  // Fix round 4 (TR-3): a failed import stays in the feed (never hidden) but its card and pane say it may be incomplete.
  return { cards: page.items, offset: c.offset, asOf, next: page.next && encodeCursor(page.next), byUser, records: await recordStates([...onPage]) };
}
