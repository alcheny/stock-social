import { sql } from './db.ts';
import { recordStates, type RecordStatus } from './connections.ts';
import { groupByUser } from './pane.ts';
import { confidence, evidenceWeight, rankTraders, type ConfidenceInput } from './trades.ts';
import { discounted, mixFeed } from './discovery/explore.ts';
import { CURSOR_MAX_AGE_MS, encodeCursor, pageOf, readCursor, type Cursor } from './discovery/pager.ts';
import { displayFilter, shapeList, splitExclusions } from './discovery/exclusions.ts';
import { exclusionsFor, followingAmong, sectionSkips } from './follows.ts';
import { capped, chooseRows, median, reasonFor, SECTION_AT, SECTION_NEAR, SECTION_SPARES, sectionCandidates, sectionPool, type Reason, type SectionTrader, type TraderFacts } from './discovery/section.ts';

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
// F-2 PR-1b: eligible traders outside the candidates read for exploration and the section, one card each (their best
// recent close), at most EXPLORE_EXTRA a day in a day-seeded order; the cursor admits offsets up to FEED_LIST_MAX.
export const EXPLORE_EXTRA = 150;
export const FEED_LIST_MAX = FEED_CANDIDATES + EXPLORE_EXTRA;
// F-2 PR-1 fix round 1 (business lead blocker 2): at most this many of one trader's closes among the candidates. Six is
// the most the caps let one trader show on a 30-card page (2 per 10), so nothing a page could show is lost; the other
// closes stay on the profile (TR-1: nothing is hidden there).
export const FEED_PER_TRADER = 6;
// Fix round 1 (load check): the candidates are read from the closes of this window first (an index range on
// closed_at); the full pass runs only when that can't be proven to give the same 200 (see feedCandidates).
export const RECENT_HOURS = 14 * 24;
// The largest size term a finite double allows: ln(1 + |r|·100) ≤ ln(1 + Number.MAX_VALUE) ≈ 709.78.
const SIZE_MAX = Math.log1p(Number.MAX_VALUE);

export type FeedCandidate = {
  id: number; sell_id: string; symbol: string; return_pct: number; holding_days: number; closed_at: Date; verified: boolean;
  thesis: string | null; thesis_status: string | null; handle: string; display_name: string; user_id: number; score: number;
};

// F-2 PR-1 fix round 2 (tester High A): "this close's sell was imported after asOf". Was `sell_id not in (select
// external_id from late)` over a CTE: a hashed subplan only while the planner expects the late set to fit in work_mem.
// Above that (~120,000 activities imported since a cursor's asOf) Postgres rescanned the whole set for every candidate
// row: 129 s to over 180 s a page. A plain anti-join (`not exists`) is no fix on its own: right after a burst of imports,
// before autovacuum analyzes them, the planner expects 1 late row and runs the anti-join as a nested loop over the late
// scan, rescanned per row, whenever the outer side is small (measured: a short recent window, a few traders). So the
// late filter must not depend on the planner's estimate, nor on a cached plan (a prepared statement's generic plan can
// be built while `activities` is small and kept after it grows, until autovacuum analyzes it):
// - `activities` is read once per candidate statement, in `late` (the late sells as one array, an index range on
//   created_at or one scan), never per row: a per-row probe of its unique index, or a max(created_at) probe, became a
//   scan per row under a stale or cached plan (73 to 75 s a page);
// - every filter is `not in` over that array, unnested. The planner always estimates an unnested non-constant array at
//   10 rows, so it is always a hashed subplan, never rescanned (the 5-close count builds the hash once and keeps it).
//   Memory grows with the late set (~75,000 sells is a few MB). Fix round 3 (tester Medium E): never a bound array
//   either (a constant to a custom plan: above hash_mem, rescanned per row); a weight miss reads lateArray itself.
// Only a sell can be a close's sell_id (closed_trades.sell_id is the closing sell's external_id), so only sells count.
// F-2 PR-1 review (tester Low G): `a` and `o` are two `array(select …)` InitPlans, not one `array_agg … filter` aggregate:
// with fresh statistics Postgres runs that aggregate in parallel and merging the workers' partial arrays cost 2× (600,000
// late sells: 750–940 ms against 400–510 ms for both scans, reviewer's run).
// ponytail: a page with no kept list (a crafted `?after=`) is linear in the late sells since its asOf, ~2.3 ms per 1,000
// with the weights kept (fix round 3: 150,000 ~320 ms, 600,000 ~1.3 s); a cap would need a stored import time per close.
const lateArray = (asOf: Date) => sql`array(select external_id from activities where created_at > ${asOf} and side = 'SELL')`;

// `ids` is a test hook (rank only these traders); the feed passes none.
// F-2 PR-1: `asOf` freezes the ranking clock for a feed session (lib/discovery/pager.ts): the score's age, the
// eligibility count and the candidate set read only closes at or before it, so a page built later slices the same list.
// Without it the clock is now() and nothing is filtered (today's behavior). A close dated in the future therefore
// enters a paged feed when its date arrives (the rebuild quarantines anything more than a day ahead).
// Ties break on the close's vendor id (unique, kept across rebuilds), not the row id (which a rebuild renumbers).
// F-2 PR-1 fix round 1 (tester Medium 2): with `asOf`, the list is pinned to what existed at asOf, not only to what was
// dated by then:
// - a close whose sell activity was imported after asOf (the hourly sync's normal case: dated before, imported after)
//   counts nowhere, for the score, the eligibility count or the weights;
// - a trader deleted after asOf, or whose import started after asOf, keeps their place in the list (the page leaves a
//   gap: loadFeedPage); a trader whose import was still running at asOf stays out even once it finishes.
// At most FEED_PER_TRADER closes per trader (fix round 1, business lead blocker 2).
export async function feedCandidates(opts: { ids?: number[]; asOf?: Date } = {}): Promise<FeedCandidate[]> {
  return (await candidatesAt(opts)).map(({ pn: _n, pm: _m, pk: _k, x: _x, ...t }) => t);
}

// Fix round 2: with asOf, each row also carries its trader's weight fingerprint (pn, pm, pk: see weights()), read in
// the same statement so the late sells are read once per list, not once per query.
// F-2 PR-1b: with `day`, the same statement also returns rows with x = true: the best close of each eligible trader
// outside the candidates (at most EXPLORE_EXTRA, in a day-seeded order), for exploration and the section only.
type Candidate = FeedCandidate & { pn?: number; pm?: string; pk?: number; x?: boolean };
async function candidatesAt(opts: { ids?: number[]; asOf?: Date; day?: string }): Promise<Candidate[]> {
  // The recent window first. Exact when it fills the 200 and its 200th score S is above anything an older close can
  // score: a close older than the window scores at most SIZE_MAX · e^(−RECENT_HOURS/RECENCY_HOURS) (≈ 0.65), so with
  // S above that, every close scoring ≥ S is in the window and the per-trader ranks of those closes are the same.
  const recent = await candidateQuery(opts, true);
  const top = recent.filter((t) => !t.x);
  if (top.length === FEED_CANDIDATES && Number(top[top.length - 1].score) > SIZE_MAX * Math.exp(-RECENT_HOURS / RECENCY_HOURS)) return recent;
  return candidateQuery(opts, false);
}

async function candidateQuery({ ids, asOf, day }: { ids?: number[]; asOf?: Date; day?: string }, recentOnly: boolean): Promise<Candidate[]> {
  const clock = asOf ? sql`${asOf}::timestamptz` : sql`now()`;
  // date_part is double precision (extract() is numeric since PostgreSQL 14: the same value, several times slower per
  // row; F-2 PR-1 load check).
  const score = sql`ln(1 + abs(t.return_pct) * 100) * exp(-greatest(0::float8, least(date_part('epoch', ${clock} - t.closed_at) / 3600 / ${RECENCY_HOURS}::float8, ${MAX_DECAY}::float8)))`;
  const order = sql`score desc, least(closed_at, ${clock}) desc, sell_id desc`;
  const notLateHere = (col: ReturnType<typeof sql>, arr = 'a') => sql`${col} not in (select unnest(${sql(arr)}) from late)`;
  const lo = sql`${clock} - ${RECENT_HOURS} * interval '1 hour'`;
  return (await sql`
    with ${asOf ? sql`late as materialized (select ${lateArray(asOf)} as a, array(select external_id from activities
      where created_at > ${asOf} and side = 'SELL' and executed_at <= ${lo}) as o),` : sql``}
    c as materialized (
      select t.id, t.sell_id, t.symbol, t.return_pct, t.holding_days, t.closed_at, t.verified, t.thesis, t.thesis_status, t.user_id, ${score} as score
      from closed_trades t
      where true ${recentOnly ? sql`and t.closed_at > ${lo}` : sql``}
        ${asOf ? sql`and t.closed_at <= ${asOf} and ${notLateHere(sql`t.sell_id`)}` : sql``}
        ${ids ? sql`and t.user_id in ${sql(ids.length ? ids : [0])}` : sql``}
    ), elig as materialized (
      -- ≥ 5 closes at asOf (c's own count first, fix round 3), not deleted (by asOf), no import running (at asOf). F-1 fix
      -- round 3 (TR-3): a record with an import still running is not in the feed until it is whole.
      select d.user_id, d.n from (select user_id, count(*) as n from c group by user_id) d join users u on u.id = d.user_id
      where ${asOf ? sql`(u.deleted_at is null or u.deleted_at > ${asOf})` : sql`u.deleted_at is null`}
        and (d.n >= 5 or (select count(*) from (select 1 from closed_trades x where x.user_id = d.user_id
             ${asOf ? sql`and x.closed_at <= ${asOf} and ${notLateHere(sql`x.sell_id`)}` : sql``} limit 5) five) = 5)
        and not exists (select 1 from connections k where k.user_id = d.user_id and k.consent_at is not null and ${asOf
          ? sql`k.consent_at <= ${asOf} and (k.state = 'importing' or (k.state = 'connected' and k.connected_at > ${asOf}) or (k.state = 'failed' and k.failed_at > ${asOf}))`
          : sql`k.state = 'importing'`})
    ), r as (
      select c.*, row_number() over (partition by c.user_id order by c.score desc, least(c.closed_at, ${clock}) desc, c.sell_id desc) as rk
      from c join elig using (user_id)
    ), top as (
      select * from r where rk <= ${FEED_PER_TRADER} order by ${order} limit ${FEED_CANDIDATES}
    ), src as (
      select top.*, false as x from top${day ? sql` union all (select r.*, true from r where rk = 1 and user_id not in (select user_id from top)
        order by md5(${day} || user_id::text) limit ${EXPLORE_EXTRA})` : sql``}
    )${asOf ? sql`, pr as materialized (
      -- The weight fingerprint (fix round 2; PR-1b fix round 1, tester Medium 1: from c alone, for every listed trader;
      -- counting the 200's whole records was ~45 ms of the statement on the 50-heavy fixture). A rebuild renumbers every
      -- row of a trader and a new close adds one, so the newest id in c changes with either (a listed trader always has a
      -- close in c); pn and pk change when a close enters or leaves c; ol counts the trader's closes older than c's window
      -- whose sells are late (o), so a close imported after asOf and dated before the window changes the key once it
      -- counts. Same rows and the same closes counted at asOf: the same weight.
      select c.user_id, count(*)::int as pn, ${recentOnly ? 'c' : 'f'} || max(c.id)::text || ':' || coalesce(max(ol.n), 0)::text as pm, max(e.n)::int as pk
      from c join elig e using (user_id) left join (${recentOnly ? sql`select y.user_id, count(*) as n from closed_trades y
        where y.sell_id in (select unnest(o) from late) group by y.user_id` : sql`select 0 as user_id, 0 as n where false`}) ol using (user_id)
      where c.user_id in (select user_id from src) group by c.user_id
    )` : sql``}
    select top.id, top.sell_id, top.symbol, top.return_pct, top.holding_days, top.closed_at, top.verified, top.thesis, top.thesis_status,
           top.user_id, top.score, top.x, u.handle, u.display_name ${asOf ? sql`, pr.pn, pr.pm, pr.pk` : sql``}
    from src top join users u on u.id = top.user_id ${asOf ? sql`left join pr on pr.user_id = top.user_id` : sql``}
    order by top.x, top.score desc, least(top.closed_at, ${clock}) desc, top.sell_id desc`) as unknown as Candidate[];
}

// ---- F-2 PR-1: feed mix and paging ----
// The feed is one list per (UTC day, asOf): candidates at asOf → TR-9 ranking (lower bound, losses weigh like gains)
// → diversity caps and seeded exploration (lib/discovery/explore.ts). Pages are 30-card slices of it. The same list
// for every viewer, signed in or out; nothing here reads a session or a viewer table (lib/feed.signed-out.test.ts).
export type FeedItem = FeedCandidate & { explore: boolean };
export type PaneRow = { userId: number; id: string; symbol: string; returnPct: number; holdingDays: number; closedAt: Date; verified: boolean; thesis: string | null };

// Every page trader's full current record, for the pane's chart and stats.
// Fix round 1 (load check, tester Medium 3): one JSON text per trader instead of one row per close. A page of heavy
// traders is ~50,000 closes; the database reads them in ~30 ms, but parsing them as rows took ~200 ms in the client.
// Values are exact: a float8's text is its shortest round-trip form, and times travel as epoch milliseconds as before.
// PR-1b fix round 1 (tester Medium 1): read in two halves side by side (two connections): a page with ~20 heavy records
// spent ~70 ms in one aggregate on one core.
export async function records(userIds: number[]): Promise<PaneRow[]> {
  if (userIds.length > 8) return (await Promise.all([0, 1].map((h) => records1(userIds.filter((_, i) => i % 2 === h))))).flat();
  return records1(userIds);
}
async function records1(userIds: number[]): Promise<PaneRow[]> {
  if (!userIds.length) return [];
  const rows = await sql`
    select user_id, '[' || string_agg(concat_ws(',', id, to_json(symbol)::text, return_pct, holding_days, verified::int,
      date_part('epoch', closed_at) * 1000, coalesce(to_json(case when thesis_status = 'published' then thesis end)::text, 'null')), ',') || ']' as j
    from closed_trades where user_id = any(${userIds}) group by user_id`;
  const out: PaneRow[] = [];
  for (const r of rows) {
    const a = JSON.parse(r.j as string) as (string | number | null)[];
    for (let k = 0; k < a.length; k += 7) out.push({
      userId: r.user_id as number, id: String(a[k]), symbol: a[k + 1] as string, returnPct: a[k + 2] as number, holdingDays: a[k + 3] as number,
      verified: a[k + 4] === 1, closedAt: new Date(a[k + 5] as number), thesis: a[k + 6] as string | null,
    });
  }
  return out;
}

// F-2 PR-1 fix round 1 (load check, tester Medium 3): a trader's TR-9 weight at asOf, kept in memory. The key is the
// trader's row count and largest row id (a rebuild renumbers every row; a new close adds one) plus the number of
// those rows counted at asOf. The counted rows are a subset that only grows with asOf, so the same row set and the same
// count are the same rows: the same weight. Only a trader whose record changed reads its record again.
// F-2 PR-3: with the weight, the facts the suggestions section reads at asOf (median holding days, closes counted).
const weightCache = new Map<string, TraderFacts>();
const WEIGHT_CACHE_MAX = 20_000;

// Fix round 2: the fingerprints (n, m, k per trader) come with the candidates, from the same statement (candidateQuery).
type Print = { n: number; m: string; k: number };
async function weights(prints: Map<number, Print>, asOf: Date): Promise<Map<number, TraderFacts>> {
  const out = new Map<number, TraderFacts>();
  const userIds = [...prints.keys()];
  if (!userIds.length) return out;
  const keys = new Map([...prints].map(([id, p]) => [id, `${id}:${p.n}:${p.m}:${p.k}`]));
  const miss: number[] = [];
  for (const id of userIds) {
    const w = weightCache.get(keys.get(id) ?? '');
    if (w === undefined) miss.push(id); else out.set(id, w);
  }
  if (miss.length) {
    // One JSON text per trader, as in records().
    const rows = await sql`
      select user_id, bool_and(verified) as v, '[' || string_agg(concat_ws(',', to_json(symbol)::text, return_pct, holding_days,
        date_part('epoch', opened_at) * 1000, date_part('epoch', closed_at) * 1000), ',') || ']' as j
      from closed_trades where user_id = any(${miss}) and closed_at <= ${asOf}
        and sell_id not in (select unnest(${lateArray(asOf)})) group by user_id`;
    const byTrader = new Map<number, ConfidenceInput[]>(miss.map((id) => [id, []]));
    const verified = new Map(rows.map((r) => [r.user_id as number, r.v as boolean]));
    for (const r of rows) {
      const a = JSON.parse(r.j as string) as (string | number)[], ts = byTrader.get(r.user_id as number)!;
      for (let k = 0; k < a.length; k += 5) ts.push({
        symbol: a[k] as string, returnPct: a[k + 1] as number, holdingDays: a[k + 2] as number,
        openedAt: new Date(a[k + 3] as number), closedAt: new Date(a[k + 4] as number),
      });
    }
    for (const [id, ts] of byTrader) {
      const c = ts.length ? confidence(ts, asOf) : null; // F-4 C3: the tier from the same call, for the new-record slot
      const w: TraderFacts = { weight: c ? evidenceWeight(c) : 0, hold: median(ts.map((t) => t.holdingDays)), n: ts.length, verified: verified.get(id) ?? false, tier: c?.tier };
      out.set(id, w);
      const key = keys.get(id);
      if (!key) continue;
      if (weightCache.size >= WEIGHT_CACHE_MAX) weightCache.delete(weightCache.keys().next().value!);
      weightCache.set(key, w);
    }
  }
  return out;
}

// `ranked`: the list before the mix (F-2 PR-2: a viewer's exclusions are taken out of it, then it is mixed again).
// `pool`: F-2 PR-3, the section's traders, ordered by the TR-9 lower bound (lib/discovery/section.ts#sectionPool).
export async function feedList(opts: { asOf: Date; day: string; ids?: number[] }): Promise<{ list: FeedItem[]; ranked: FeedCandidate[]; pool: SectionTrader[] }> {
  const all = await candidatesAt({ asOf: opts.asOf, ids: opts.ids, day: opts.day });
  const candidates = all.filter((t) => !t.x), extra = all.filter((t) => t.x);
  const prints = new Map<number, Print>();
  for (const t of candidates) prints.set(t.user_id, { n: t.pn!, m: t.pm!, k: t.pk! });
  // Rank by the pace-interval lower bound (TR-9): small lucky samples can't top the feed. Losses weigh like gains.
  // Read at asOf: a close after it, or imported after it, changes no weight.
  for (const t of extra) prints.set(t.user_id, { n: t.pn!, m: t.pm!, k: t.pk! });
  const weight = await weights(prints, opts.asOf);
  const ranked = discounted(rankTraders(candidates.map((t) => ({ t, score: Number(t.score), weight: weight.get(t.user_id)?.weight ?? 0 })))
    .map(({ t }) => ({ ...t, key: t.sell_id, trader: t.user_id })));
  const list: FeedItem[] = mixFeed(ranked, { day: opts.day, extra: extra.map((t) => ({ ...t, key: t.sell_id, trader: t.user_id })) })
    .map(({ card: { key: _k, trader: _t, pn: _n, pm: _m, pk: _p, x: _x, ...t }, explore }) => ({ ...t, explore }));
  const pool = sectionPool([...candidates, ...extra].map((t) => ({ trader: t.user_id, score: Number(t.score) })), weight);
  return { list, ranked: ranked.map(({ key: _k, trader: _t, pn: _n, pm: _m, pk: _p, x: _x, ...t }) => t), pool };
}

export type FeedPage = {
  cards: FeedItem[]; offset: number; asOf: Date; next: string | null;
  // The list positions this page covers (1-based, for the no-JS page's position heading).
  from: number; to: number;
  byUser: Map<number, PaneRow[]>; records: Map<number, RecordStatus>;
  // F-2 PR-2: signed in only, the viewer's follows among the page's traders. Never anyone else's.
  viewer: { id: number; following: Set<number> } | null;
  // F-2 PR-3: the suggestions section after the page's 5th card, or null (fewer than 3 rows). Its traders' records are in
  // byUser and records, for the pane each row opens.
  section: SectionRow[] | null;
};
export type SectionRow = { userId: number; handle: string; name: string; reason: Reason };

// F-2 PR-1 fix round 1: the list of each (day, asOf) is kept in memory for its cursor's lifetime, so a later page from
// the same server slices exactly the list page 1 showed (a trader removed meanwhile leaves a gap, never a shift). Only
// the order is kept (vendor id, trader, pick); each page reads its cards' current rows. On another server, or after a
// restart, the list is recomputed from the database, pinned to asOf as feedCandidates describes.
// F-2 PR-2: a slot is a mix card (key = the close's vendor id, trader = its user id); the ranked list before the mix is
// kept too, for a viewer whose exclusions shape the list.
type Slot = { key: string; trader: number; symbol: string; explore: boolean; score: number };
type Kept = { asOf: number; mixed: Slot[]; ranked: Slot[]; pool: SectionTrader[] };
const lists = new Map<string, Kept>();
const LIST_CACHE_MAX = 256;
// Tests: forget every kept list and weight (a cold server), or only the lists (fix round 2: a page whose list this
// server never built, such as a crafted `?after=`, on a server whose weights are warm).
export function clearFeedCache(what: 'all' | 'lists' = 'all') { lists.clear(); if (what === 'all') weightCache.clear(); }

async function listFor(c: Cursor, now: number, ids?: number[]): Promise<Kept> {
  const key = `${c.day}|${c.asOf}|${ids ? ids.join(',') : '*'}`;
  const kept = lists.get(key);
  if (kept) return kept;
  const { list, ranked, pool } = await feedList({ asOf: new Date(c.asOf), day: c.day, ids });
  const slot = (t: FeedCandidate, explore: boolean): Slot => ({ key: t.sell_id, trader: t.user_id, symbol: t.symbol, explore, score: Number(t.score) });
  for (const [k, v] of lists) if (v.asOf < now - CURSOR_MAX_AGE_MS || lists.size >= LIST_CACHE_MAX) lists.delete(k);
  const out = { asOf: c.asOf, mixed: list.map((t) => slot(t, t.explore)), ranked: ranked.map((t) => slot(t, false)), pool };
  lists.set(key, out);
  return out;
}

// One page of the feed for a `?after=` value (or the paging action's cursor). Anything invalid is page 1.
// F-2 PR-2: `viewer` (lib/viewer.ts, signed in only): that viewer's exclusions shape the list (made by asOf) or filter
// the page in place (made since), lib/discovery/exclusions.ts; never on a profile (TR-1).
export async function loadFeedPage(after: unknown, opts: { now?: number; ids?: number[]; viewer?: number } = {}): Promise<FeedPage> {
  const now = opts.now ?? Date.now();
  const c = readCursor(after, now, FEED_LIST_MAX);
  const [kept, mine, skips] = await Promise.all([listFor(c, now, opts.ids), opts.viewer ? exclusionsFor(opts.viewer, new Date(Math.min(c.asOf, now))) : [],
    opts.viewer ? sectionSkips(opts.viewer) : []]);
  const { shaping, hidden } = splitExclusions(mine, c.asOf, now);
  const slots = kept.ranked.some((s) => shaping.has(s.trader)) ? shapeList(kept.ranked, shaping, c.day).map(({ card, explore }) => ({ ...card, explore })) : kept.mixed;
  const sliced = pageOf(slots, c);
  const page = { ...sliced, items: displayFilter(sliced.items, hidden) };
  // The page's cards as they are now (a thesis held since page 1 is not shown; a corrected return shows corrected). A
  // card whose trader was deleted since asOf, or whose close is gone, is a gap. The three reads run side by side.
  const traders = [...new Set(page.items.map((s) => s.trader))];
  // F-2 PR-3: the section's candidates (the same for every viewer; signed in, minus the viewer, follows and exclusions).
  // The first 3 records are read with the page's; the spares only when a row turns out importing or deleted.
  // Nothing is read for it when the candidates cannot make 3 rows even before that check (it only removes candidates).
  // Fix round 1: the spares are chosen from every candidate under the bucket cap (tester Medium 1: a fixed slice of 8
  // sharing one holding period made no section), and the 10 cards around it are the displayed ones (tester Low 1).
  const cands = capped(sectionCandidates(kept.pool, slots, c.offset, new Set(opts.viewer ? [opts.viewer, ...skips] : []), page.items), SECTION_SPARES);
  const candIds = cands.map((t) => t.trader);
  const likely = (chooseRows(cands) ?? []).map((t) => t.trader);
  const withSection = page.items.length >= SECTION_AT && likely.length > 0;
  const [rows, states, panes, following, people] = await Promise.all([
    page.items.length ? sql`
      select t.id, t.sell_id, t.symbol, t.return_pct, t.holding_days, t.closed_at, t.verified, t.thesis, t.thesis_status, t.user_id, u.handle, u.display_name
      from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
      where t.sell_id = any(${page.items.map((s) => s.key)})` : [],
    // Fix round 4 (TR-3): a failed import stays in the feed (never hidden) but its card and pane say it may be
    // incomplete. Fix round 1: a trader whose import started after asOf is left out until it is whole (a gap).
    recordStates(withSection ? [...new Set([...traders, ...candIds])] : traders),
    records(withSection ? [...new Set([...traders, ...likely])] : traders),
    opts.viewer ? followingAmong(opts.viewer, traders) : null,
    withSection ? sql`select id, handle, display_name from users where id = any(${candIds}) and deleted_at is null` : [],
  ]);
  const bySell = new Map(rows.map((r) => [r.sell_id as string, r]));
  const cards: FeedItem[] = page.items.flatMap((s) => {
    const r = bySell.get(s.key);
    if (!r || r.user_id !== s.trader || states.get(s.trader)?.state === 'importing') return [];
    return [{ ...(r as unknown as FeedCandidate), score: s.score, explore: s.explore }];
  });
  const who = new Map(people.map((u) => [u.id as number, u]));
  const near = new Set(cards.slice(0, SECTION_NEAR).map((t) => t.user_id)); // a card dropped as a gap moves the next one in
  const picked = withSection && cards.length >= SECTION_AT ? chooseRows(cands.filter((t) => who.has(t.trader) && !near.has(t.trader) && states.get(t.trader)?.state !== 'importing')) : null;
  const missing = (picked ?? []).map((t) => t.trader).filter((id) => !likely.includes(id) && !traders.includes(id));
  if (missing.length) panes.push(...await records(missing));
  const section = picked && picked.map((t): SectionRow => {
    const u = who.get(t.trader)!;
    return { userId: t.trader, handle: u.handle as string, name: u.display_name as string, reason: reasonFor(t) };
  });
  const onPage = new Set([...cards.map((t) => t.user_id), ...(picked ?? []).map((t) => t.trader)]);
  const byUser = groupByUser(panes.filter((r) => onPage.has(r.userId)));
  return {
    cards, offset: c.offset, asOf: new Date(c.asOf), next: page.next && encodeCursor(page.next),
    from: c.offset + 1, to: c.offset + sliced.items.length, byUser, records: new Map([...states].filter(([id]) => onPage.has(id))),
    viewer: following && { id: opts.viewer!, following }, section,
  };
}
