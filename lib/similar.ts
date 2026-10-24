// F-2 PR-3b: the "Similar trades" section's reads for a profile (ordering: lib/discovery/similar.ts).
// - The pool is the feed's section pool at the start of the current UTC hour, kept in memory and rebuilt in the
//   background once it is SIMILAR_REFRESH_MS old (the kept pool serves meanwhile), so a profile view adds a few small reads.
// - Signed out it reads no viewer table (lib/feed.signed-out.test.ts); signed in, only the viewer's own running
//   "Not interested" rows (an unfollow is never a hide: owner decision O4).
import { sql } from './db.ts';
import { hiddenTraders } from './follows.ts';
import { feedList, records, type PaneRow } from './feed.ts';
import { recordStates, type RecordStatus } from './connections.ts';
import { utcDay } from './discovery/pager.ts';
import { holdBucket, type SectionTrader } from './discovery/section.ts';
import { SIMILAR_MIN, SIMILAR_SPARES, similarCandidates, similarRows } from './discovery/similar.ts';

const HOUR = 3_600_000;
export const SIMILAR_REFRESH_MS = 10_000; // a kept pool older than this is rebuilt in the background (it serves meanwhile)
type Kept = { built: number; pool: Promise<SectionTrader[]>; next?: Promise<SectionTrader[]> };
const kept = new Map<string, Kept>();
// Row traders' records for their sheets, kept as long as a pool: most profiles in one holding bucket show the same few
// traders, so a heavy record is read once per SIMILAR_REFRESH_MS, not once per profile view.
const panes = new Map<number, { at: number; rows: PaneRow[] }>();
const PANES_MAX = 32;
export function clearSimilarCache() { kept.clear(); panes.clear(); }

function poolAt(now: number, ids?: number[]): Promise<SectionTrader[]> {
  const key = ids ? ids.join(',') : '*', hour = Math.floor(now / HOUR) * HOUR;
  const build = () => feedList({ asOf: new Date(hour), day: utcDay(hour), ids }).then((r) => r.pool);
  const k = kept.get(key);
  if (!k) {
    const pool = build();
    pool.catch(() => kept.delete(key));
    if (kept.size > 16) kept.clear();
    kept.set(key, { built: now, pool });
    return pool;
  }
  if (now - k.built >= SIMILAR_REFRESH_MS && !k.next) {
    const next = (k.next = build());
    next.then(() => kept.set(key, { built: now, pool: next }), () => { k.next = undefined; });
  }
  return k.pool;
}

export type SimilarRow = { trader: number; handle: string; name: string; tradeId: string; sellId: string; symbol: string; returnPct: number; closedAt: Date; holdingDays: number; bucket: number; verified: boolean };
export type Similar = { rows: SimilarRow[]; byUser: Map<number, PaneRow[]>; states: Map<number, RecordStatus> };

// Fix round 1 (business lead D2): `panes: false` (the profile) skips the row traders' records; a sheet loads its pane on
// first open from /u/<h>/pane, as the feed loads its full pane chart. `verified` is read with the row instead.
export async function loadSimilar(o: { trader: number; hold: number; closes: number; viewer?: number; now?: number; ids?: number[]; panes?: boolean }): Promise<Similar | null> {
  if (o.closes < SIMILAR_MIN) return null;
  const [pool, hidden] = await Promise.all([poolAt(o.now ?? Date.now(), o.ids),
    o.viewer ? hiddenTraders(o.viewer) : []]);
  const skip = new Set<number>([...(o.viewer ? [o.viewer] : []), ...hidden]);
  const cands = similarCandidates(pool, o.trader, o.hold, skip).slice(0, SIMILAR_SPARES);
  if (cands.length < 3) return null;
  const bucket = holdBucket(o.hold);
  const [found, states] = await Promise.all([sql`
    select u.id, u.handle, u.display_name, t.id as trade_id, t.sell_id, t.symbol, t.return_pct, t.closed_at, t.holding_days,
      not exists (select 1 from closed_trades v where v.user_id = u.id and not v.verified) as verified
    from users u cross join lateral (select id, sell_id, symbol, return_pct, closed_at, holding_days from closed_trades x where x.user_id = u.id
      and (case when holding_days < 1 then 0 when holding_days <= 7 then 1 when holding_days <= 28 then 2 when holding_days <= 183 then 3 else 4 end) = ${bucket}
      order by closed_at desc, sell_id desc limit 1) t
    where u.id = any(${cands.map((c) => c.trader)}) and u.deleted_at is null`, recordStates(cands.map((c) => c.trader))]);
  const trades = new Map(found.filter((r) => states.get(r.id as number)?.state !== 'importing').map((r) => [r.id as number, {
    trader: r.id as number, handle: r.handle as string, name: r.display_name as string, tradeId: String(r.trade_id), sellId: r.sell_id as string, symbol: r.symbol as string,
    returnPct: r.return_pct as number, closedAt: r.closed_at as Date, holdingDays: r.holding_days as number, bucket, verified: r.verified as boolean }]));
  const rows = similarRows(cands, trades, bucket);
  if (!rows) return null;
  const now = o.now ?? Date.now();
  const states1 = new Map(rows.map((r) => [r.trader, states.get(r.trader)!]));
  if (o.panes === false) return { rows, byUser: new Map(), states: states1 };
  const miss = rows.map((r) => r.trader).filter((id) => !(now - (panes.get(id)?.at ?? -Infinity) < SIMILAR_REFRESH_MS));
  if (miss.length) {
    const read = new Map<number, PaneRow[]>(miss.map((id) => [id, []]));
    for (const p of await records(miss)) read.get(p.userId)?.push(p);
    for (const [id, rs] of read) { panes.delete(id); if (panes.size >= PANES_MAX) panes.delete(panes.keys().next().value!); panes.set(id, { at: now, rows: rs }); }
  }
  const byUser = new Map<number, PaneRow[]>(rows.map((r) => [r.trader, panes.get(r.trader)!.rows]));
  return { rows, byUser, states: states1 };
}
