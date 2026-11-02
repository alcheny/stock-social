// F-2 PR-3b: the "Similar trades" section's reads for a profile (ordering: lib/discovery/similar.ts).
// - The pool is the feed's section pool at the start of the current UTC hour. It is kept in memory per server and
//   rebuilt every SIMILAR_REFRESH_MS. The kept pool serves meanwhile, so a profile view adds only a few small reads.
// - Known limits sweep 2: the pool is shared between servers through `similar_pools`, one row per scope ('*' in
//   production) overwritten in place. Once its copy is SIMILAR_REFRESH_MS old, a server checks the row's time in the
//   background, without reading the pool. If the row is newer, the server fetches it once. If the row is stale, one
//   claim statement lets exactly one server rebuild it (lease SIMILAR_LEASE_MS, DB clock). The write is fenced on that
//   claim's token and never moves `hour` backwards. A cold server serves a fresh row. Otherwise it claims and builds,
//   or waits at most SIMILAR_COLD_WAIT_MS for the claim holder and then builds the pool itself.
// - Each request walks its holding bucket's pre-sorted list (pickFor) instead of filtering and sorting the whole pool.
// - Signed out it reads no viewer table (lib/feed.signed-out.test.ts). Signed in, it reads only the viewer's own running
//   "Not interested" rows (an unfollow is never a hide: owner decision O4).
import { createHash, randomUUID } from 'node:crypto';
import { sql } from './db.ts';
import { logSafe } from './privacy-log.ts';
import { hiddenTraders } from './follows.ts';
import { feedList, records, type PaneRow } from './feed.ts';
import { recordStates, type RecordStatus } from './connections.ts';
import { feedReadySql, filerVisibleSql } from './public-gate.ts';
import { visibleUser } from './visible-users.ts'; // F-16: the rows read now skip a hidden trader (the kept pool may be older)
import { utcDay } from './discovery/pager.ts';
import { holdBucket, type SectionTrader } from './discovery/section.ts';
import { SIMILAR_MIN, SIMILAR_SPARES, similarCandidates, similarRows } from './discovery/similar.ts';

const HOUR = 3_600_000;
export const SIMILAR_REFRESH_MS = 10_000; // a kept pool older than this is rebuilt in the background (it serves meanwhile)
export const SIMILAR_LEASE_MS = 60_000; // a rebuild claim older than this is taken over (its builder died or stalled)
// About 2x the measured cold build: 357 ms at 5,000 traders (lib/similar.load.test.ts).
export const SIMILAR_COLD_WAIT_MS = 750;
// ponytail: the shared pool is the full feed list, rebuilt fleet-wide every SIMILAR_REFRESH_MS even when no record
// changed — a change marker (max closed_trades id, user and connection changes) checked before the claim would skip
// no-op rebuilds.
type Picker = (self: number, hold: number, skip: ReadonlySet<number>) => SectionTrader[];
// hour: the pool's asOf. at: the shared row's built_at in ms (-1 for a build kept only by this server).
type Kept = { hour: number; at: number; checked: number; pool: SectionTrader[]; pick: Picker; next?: Promise<void> };
const kept = new Map<string, Kept>();
const cold = new Map<string, Promise<Kept>>();
// Tests: scopes with `ids` are shared only when shareIds is set. dbOffsetMs shifts the DB clock this server reads
// (simulated time), coldWaitMs replaces SIMILAR_COLD_WAIT_MS, and beforeWrite runs between a build and its write.
export const similarTesting: { shareIds: boolean; dbOffsetMs: number; coldWaitMs?: number; builds: number; fetches: number; beforeWrite?: () => Promise<void> } =
  { shareIds: false, dbOffsetMs: 0, builds: 0, fetches: 0 };
// Row traders' records for their sheets, kept as long as a pool: most profiles in one holding bucket show the same few
// traders, so a heavy record is read once per SIMILAR_REFRESH_MS, not once per profile view.
const panes = new Map<number, { at: number; rows: PaneRow[] }>();
const PANES_MAX = 32;
export function clearSimilarCache() { kept.clear(); cold.clear(); panes.clear(); }
export async function similarSettled() { await Promise.all([...kept.values()].map((k) => k.next)); }

export const similarScope = (ids?: number[]) => ids ? `ids:${createHash('sha256').update(ids.join(',')).digest('hex').slice(0, 32)}` : '*';

// The pool as text. JSON cannot carry NaN, Infinity or -0, so these numbers are tagged strings (SectionTrader has no
// string field).
const TAGGED = new Set(['NaN', 'Infinity', '-Infinity', '-0']);
export const encodePool = (p: readonly SectionTrader[]) =>
  JSON.stringify(p, (_k, v) => typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0)) ? (Object.is(v, -0) ? '-0' : String(v)) : v);
export const decodePool = (s: string): SectionTrader[] => JSON.parse(s, (_k, v) => typeof v === 'string' && TAGGED.has(v) ? Number(v) : v);

// Each holding bucket's candidates in similarCandidates' order, with nobody left out. A request skips its own trader and
// `skip` while walking the list. The sort is stable and byEvidence is a total order, so this returns
// similarCandidates(pool, self, hold, skip).slice(0, SIMILAR_SPARES).
export function pickFor(pool: readonly SectionTrader[]): Picker {
  const groups = new Map<number, SectionTrader[]>();
  for (const t of pool) { const b = holdBucket(t.hold); const g = groups.get(b); if (g) g.push(t); else groups.set(b, [t]); }
  const ordered = new Map([...groups].map(([b, g]) => [b, similarCandidates(g, Number.NaN, g[0].hold, new Set())]));
  return (self, hold, skip) => {
    const out: SectionTrader[] = [];
    for (const t of ordered.get(holdBucket(hold)) ?? []) {
      if (t.trader === self || skip.has(t.trader)) continue;
      out.push(t);
      if (out.length === SIMILAR_SPARES) break;
    }
    return out;
  };
}

const dbNow = () => sql`(now() + ${similarTesting.dbOffsetMs}::float8 * interval '1 millisecond')`;
const ms = (col: string) => sql`(extract(epoch from ${sql(col)}) * 1000)::float8`;
const install = (key: string, hour: number, at: number, pool: SectionTrader[], now: number): Kept => {
  if (kept.size > 16 && !kept.has(key)) kept.clear();
  const k = { hour, at, checked: now, pool, pick: pickFor(pool) };
  kept.set(key, k);
  return k;
};
const build = async (hour: number, ids?: number[]) => { similarTesting.builds++; return (await feedList({ asOf: new Date(hour), day: utcDay(hour), ids })).pool; };

// One server claims a stale row (or the first one). It builds the pool, then writes it only if its claim still holds.
// Returns null when another server holds the claim or the row is fresh.
async function claimAndBuild(key: string, hour: number, ids?: number[]): Promise<{ pool: SectionTrader[]; at: number } | null> {
  const token = randomUUID(), h = new Date(hour);
  const [c] = await sql`
    insert into similar_pools as p (key, hour, claimed_at, claim) values (${key}, ${h}, ${dbNow()}, ${token})
    on conflict (key) do update set claimed_at = excluded.claimed_at, claim = excluded.claim
      where (p.hour < excluded.hour or (p.hour = excluded.hour and (p.built_at is null or p.built_at < excluded.claimed_at - ${SIMILAR_REFRESH_MS}::float8 * interval '1 millisecond')))
        and (p.claimed_at is null or p.claimed_at < excluded.claimed_at - ${SIMILAR_LEASE_MS}::float8 * interval '1 millisecond')
    returning 1`;
  if (!c) return null;
  let pool: SectionTrader[];
  try { pool = await build(hour, ids); } catch (e) {
    await sql`update similar_pools set claimed_at = null, claim = null where key = ${key} and claim = ${token}`.catch(() => {});
    throw e;
  }
  await similarTesting.beforeWrite?.();
  const [w] = await sql`update similar_pools set pool = ${encodePool(pool)}, hour = ${h}, built_at = claimed_at, claimed_at = null, claim = null
    where key = ${key} and claim = ${token} and hour <= ${h} returning ${ms('built_at')} as at`;
  return { pool, at: w ? (w.at as number) : -1 };
}

const readRow = async (key: string, hour: number, withPool: boolean) => (await sql`
  select ${ms('hour')} as hour, ${ms('built_at')} as at,
    (built_at is not null and built_at >= ${dbNow()} - ${SIMILAR_REFRESH_MS}::float8 * interval '1 millisecond') as fresh
    ${withPool ? sql`, case when hour >= ${new Date(hour)} then pool end as pool` : sql``}
  from similar_pools where key = ${key}`)[0] as { hour: number; at: number | null; fresh: boolean; pool?: string | null } | undefined;

// A cold server (no kept pool for this scope): see the header.
async function coldPool(key: string, hour: number, now: number, ids?: number[]): Promise<Kept> {
  if (ids && !similarTesting.shareIds) return install(key, hour, -1, await build(hour, ids), now);
  const deadline = performance.now() + (similarTesting.coldWaitMs ?? SIMILAR_COLD_WAIT_MS);
  for (;;) {
    const r = await readRow(key, hour, true);
    // A fresh row, or one for a later hour than this server's clock (skew). A stale current-hour row is not served
    // cold: it can be up to an hour old, where today's cold build was current.
    if (r?.pool != null && r.at != null && (r.hour > hour || (r.hour === hour && r.fresh))) {
      similarTesting.fetches++;
      return install(key, r.hour, r.at, decodePool(r.pool), now);
    }
    const got = await claimAndBuild(key, hour, ids);
    if (got) return install(key, hour, got.at, got.pool, now);
    if (performance.now() >= deadline) return install(key, hour, -1, await build(hour, ids), now);
    await new Promise((res) => setTimeout(res, 50));
  }
}

// In the background: take a newer shared row, or claim the rebuild of a stale one. The kept pool serves meanwhile.
function refresh(k: Kept, key: string, hour: number, now: number, ids?: number[]) {
  k.checked = now;
  const shared = !ids || similarTesting.shareIds;
  const run = async () => {
    if (!shared) { install(key, hour, -1, await build(hour, ids), now); return; }
    const r = await readRow(key, hour, false);
    const newer = r?.at != null && (r.hour > k.hour || (r.hour === k.hour && r.at > k.at));
    if (!r || r.at == null || r.hour < hour || !r.fresh) {
      const got = await claimAndBuild(key, hour, ids);
      if (got) { install(key, hour, got.at, got.pool, now); return; }
    }
    if (newer) {
      const f = await readRow(key, Math.min(hour, r!.hour), true);
      if (f?.pool != null && f.at != null) { similarTesting.fetches++; install(key, f.hour, f.at, decodePool(f.pool), now); }
    }
  };
  k.next = run().catch((e: unknown) => { console.error('similar pool refresh failed', logSafe(e)); }).finally(() => { k.next = undefined; });
}

export async function similarPool(now: number, ids?: number[]): Promise<Kept> {
  const key = similarScope(ids), hour = Math.floor(now / HOUR) * HOUR;
  const k = kept.get(key);
  if (!k) {
    let p = cold.get(key);
    if (!p) {
      p = coldPool(key, hour, now, ids).finally(() => cold.delete(key));
      cold.set(key, p);
    }
    return p;
  }
  // ponytail: in a new hour, while another server builds its pool, every profile view here re-reads the row and tries the
  // claim (k.hour < hour ignores k.checked; up to the 60 s lease if that builder died) — throttle it to once a second.
  if (!k.next && (k.hour < hour || now - k.checked >= SIMILAR_REFRESH_MS)) refresh(k, key, hour, now, ids);
  return k;
}

export type SimilarRow = { trader: number; handle: string; name: string; tradeId: string; sellId: string /* server-only (lib/similar.test.ts); never rendered */; tradeKey: string /* F-25: the row's trade link */; symbol: string; returnPct: number; closedAt: Date; holdingDays: number; bucket: number; verified: boolean };
export type Similar = { rows: SimilarRow[]; byUser: Map<number, PaneRow[]>; states: Map<number, RecordStatus> };

// Fix round 1 (business lead D2): `panes: false` (the profile) skips the row traders' records; a sheet loads its pane on
// first open from /u/<h>/pane, as the feed loads its full pane chart. `verified` is read with the row instead.
export async function loadSimilar(o: { trader: number; hold: number; closes: number; viewer?: number; now?: number; ids?: number[]; panes?: boolean }): Promise<Similar | null> {
  if (o.closes < SIMILAR_MIN) return null;
  const [pool, hidden] = await Promise.all([similarPool(o.now ?? Date.now(), o.ids),
    o.viewer ? hiddenTraders(o.viewer) : []]);
  const skip = new Set<number>([...(o.viewer ? [o.viewer] : []), ...hidden]);
  const cands = pool.pick(o.trader, o.hold, skip);
  if (cands.length < 3) return null;
  const bucket = holdBucket(o.hold);
  const [found, states] = await Promise.all([sql`
    select u.id, u.handle, u.display_name, t.id as trade_id, t.sell_id, t.trade_key, t.symbol, t.return_pct, t.closed_at, t.holding_days,
      not exists (select 1 from closed_trades v where v.user_id = u.id and not v.verified) as verified
    from users u cross join lateral (select id, sell_id, trade_key, symbol, return_pct, closed_at, holding_days from closed_trades x where x.user_id = u.id and ${feedReadySql('x')}
      and (case when holding_days < 1 then 0 when holding_days <= 7 then 1 when holding_days <= 28 then 2 when holding_days <= 183 then 3 else 4 end) = ${bucket}
      order by closed_at desc, sell_id desc limit 1) t
    where u.id = any(${cands.map((c) => c.trader)}) and ${visibleUser('u')} and ${filerVisibleSql('u')}`, recordStates(cands.map((c) => c.trader))]);
  const trades = new Map(found.filter((r) => states.get(r.id as number)?.state !== 'importing').map((r) => [r.id as number, {
    trader: r.id as number, handle: r.handle as string, name: r.display_name as string, tradeId: String(r.trade_id), sellId: r.sell_id as string, tradeKey: r.trade_key as string, symbol: r.symbol as string,
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
