// Ticker pages' data in SQL: /t/SYMBOL (summary, charts, capped trade list, "Also closed by these traders"), its
// metadata and share card, and the /t index. Each function returns what the in-memory helpers in lib/ticker.ts return
// for the same rows (equivalence tests: lib/ticker-sql.test.ts), but no query ships one row per closed trade.
// Exactness: counts, bins, medians, min/max, dates and every average return are exact (sums are ordered aggregates in
// the same order the pages read rows). The 95% ranges match to ~1e-15: Postgres ln() and the JS Math.log() may differ
// in the last bit, and bets are summed in a different order.
import type postgres from 'postgres';
import { sql as defaultSql } from './db.ts';
import { logSafe } from './privacy-log.ts';
import { confidenceFromClusters, confidenceFromSums, type Cluster, type Confidence } from './trades.ts';
import {
  MIN_HOLD_BUCKET, MIN_REST, normalizeSymbol,
  type Concentration, type HoldBucket, type HoldBuckets, type MonthBucket, type RelatedSymbol, type Spread, type SpreadBin,
  type Timeline, type TickerIndexRow, type TickerSort, type TickerSummary,
} from './ticker.ts';

export type Db = postgres.ISql;
const DAY = 86_400_000;

// A page's several statements read one snapshot (as the single full read they replace did), so a rebuild that commits
// between two of them can't make the count and the list disagree. A caller's own transaction is used as is.
const snapshot = <T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> =>
  db === defaultSql ? (defaultSql.begin('isolation level repeatable read read only', (tx) => fn(tx)) as Promise<T>) : fn(db);
export const TICKER_ROWS_CAP = 500;
export const TICKER_INDEX_CAP = 100;

type ScopeRow = { scope: string; n: number; wins: number; sum: number | null; verified: number; traders: number; verified_traders: number; first_open: Date; last_close: Date };
type BetRow = { scope: string; user_id: number; x: number; d: number; n: number };

// One symbol's trades, as the pages read them: live users only. Times are cut to milliseconds because the JS helpers
// compare Date values; `closed_at`/`id` keep full precision for ordering, which is the page's row order.
// hb = holdIndex() in lib/ticker.ts (NaN and negatives fall to 0). NaN sorts above every number in Postgres, so the
// sign tests below exclude it explicitly, as `NaN > 0` is false in JS.
const tradesOf = (db: Db, symbol: string) => db`
  select t.id, t.user_id, t.return_pct as r, t.holding_days as h, t.closed_at, t.verified as v,
         date_trunc('milliseconds', t.opened_at) as o, date_trunc('milliseconds', t.closed_at) as c,
         case when t.holding_days = 'NaN' or t.holding_days < 1 then 0 when t.holding_days < 7 then 1
              when t.holding_days < 28 then 2 else 3 end as hb
  from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
  where t.symbol = ${symbol}`;

// Headline numbers per scope: 'all', 'h0'..'h3' (hold buckets) and 'rest' (everyone but the single most active trader,
// only when exactly one trader has the most trades). `sum` is in the page's row order, so averages are exact.
async function scopes(db: Db, symbol: string, full: boolean): Promise<{ rows: ScopeRow[]; top: number; tied: number; leader: number | null }> {
  const rows = (await db`
    with s as (${tradesOf(db, symbol)}),
    pu as (select user_id, count(*)::int as cnt from s group by user_id),
    lead as (select user_id from pu where cnt = (select max(cnt) from pu)),
    solo as (select case when (select count(*) from lead) = 1 then (select user_id from lead) end as leader),
    g as (
      select s.*, sc.scope from s cross join lateral (values ('all'),
        (case when ${full} then 'h' || s.hb end),
        (case when ${full} and s.user_id <> (select leader from solo) then 'rest' end)) sc(scope)
      where sc.scope is not null)
    select scope, count(*)::int as n, (count(*) filter (where r > 0 and r <> 'NaN'))::int as wins,
           sum(r order by closed_at desc, id desc) as sum, (count(*) filter (where v))::int as verified,
           count(distinct user_id)::int as traders, (count(distinct user_id) filter (where v))::int as verified_traders,
           min(o) as first_open, max(c) as last_close,
           (select max(cnt) from pu)::int as top, (select count(*) from lead)::int as tied, (select leader from solo) as leader
    from g group by scope`) as unknown as (ScopeRow & { top: number; tied: number; leader: number | null })[];
  return { rows, top: rows[0]?.top ?? 0, tied: rows[0]?.tied ?? 0, leader: rows[0]?.leader ?? null };
}

// One row per independent bet (confidence(): one trader's overlapping holds are one bet), per scope. Gaps and islands:
// a trade starts a new bet when it opens after every earlier hold in its partition closed. Partitions are ordered by
// entry, ties in the page's row order, as confidence()'s stable sort sees them.
// ponytail: the 95% range reads one row per bet (bets ≤ trades); a symbol with ~10^5 non-overlapping bets would want the
// two variance sums in SQL instead.
async function bets(db: Db, symbol: string, full: boolean): Promise<BetRow[]> {
  return (await db`
    with s as (${tradesOf(db, symbol)}),
    w as (
      select s.*, ln(greatest(1 + r, 1e-9)) as x, greatest(h, 1) as dd,
             max(c) over (partition by user_id order by o, closed_at desc, id desc rows between unbounded preceding and 1 preceding) as pa,
             max(c) over (partition by hb, user_id order by o, closed_at desc, id desc rows between unbounded preceding and 1 preceding) as ph
      from s),
    f as (
      select w.*,
             sum(case when pa is null or o > pa then 1 else 0 end) over (partition by user_id order by o, closed_at desc, id desc rows unbounded preceding) as ka,
             sum(case when ph is null or o > ph then 1 else 0 end) over (partition by hb, user_id order by o, closed_at desc, id desc rows unbounded preceding) as kh
      from w)
    select 'all' as scope, user_id, sum(x order by o, closed_at desc, id desc) as x, sum(dd order by o, closed_at desc, id desc) as d, count(*)::int as n
    from f group by user_id, ka
    union all
    select 'h' || hb, user_id, sum(x order by o, closed_at desc, id desc), sum(dd order by o, closed_at desc, id desc), count(*)::int
    from f where ${full} group by hb, user_id, kh`) as unknown as BetRow[];
}

const clusters = (rows: BetRow[]): Cluster[] => rows.map((b) => ({ x: Number(b.x), d: Number(b.d), n: b.n }));

// tickerSummary() from a scope row and its bets.
export function summaryFrom(g: ScopeRow | undefined, betRows: BetRow[]): TickerSummary {
  if (!g || !g.n) return { n: 0, wins: 0, losses: 0, winRate: null, avgReturn: null, traders: 0, demoOnly: false, mixed: false, conf: null };
  const n = g.n;
  const spanDays = (g.last_close.getTime() - g.first_open.getTime()) / DAY;
  return {
    n, wins: g.wins, losses: n - g.wins, winRate: g.wins / n, avgReturn: Number(g.sum) / n,
    traders: g.traders, demoOnly: g.verified === 0, mixed: g.verified > 0 && g.verified < n,
    conf: confidenceFromClusters(clusters(betRows), n, spanDays),
  };
}

export type TickerHeadline = { summary: TickerSummary; verifiedTrades: number; verifiedTraders: number };

// What generateMetadata and the share card need: the summary of every trade, nothing else.
export async function tickerHeadline(symbol: string, db: Db = defaultSql): Promise<TickerHeadline> {
  const [s, b] = await snapshot(db, (tx) => Promise.all([scopes(tx, symbol, false), bets(tx, symbol, false)]));
  const all = s.rows.find((r) => r.scope === 'all');
  return { summary: summaryFrom(all, b.filter((r) => r.scope === 'all')), verifiedTrades: all?.verified ?? 0, verifiedTraders: all?.verified_traders ?? 0 };
}

const HOLD_DEFS: { key: HoldBucket['key']; label: string }[] = [
  { key: 'lt1', label: 'Under 1 day' }, { key: '1to7', label: '1 to under 7 days' },
  { key: '7to28', label: '7 to under 28 days' }, { key: 'gte28', label: '28 days or more' },
];

const monthIndex = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
const monthKey = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;

// monthlyTimeline(): bucket 0 is 'earlier', 1..24 the UTC months ending at today's (future dates clamp into the last).
async function timeline(db: Db, symbol: string, today: Date): Promise<Timeline> {
  const first = monthIndex(today) - 23;
  const rows = (await db`
    with s as (${tradesOf(db, symbol)})
    select least(24, greatest(0, (extract(year from c at time zone 'UTC') * 12 + extract(month from c at time zone 'UTC') - 1)::int - ${first} + 1)) as b,
           (count(*) filter (where r > 0 and r <> 'NaN'))::int as up, (count(*) filter (where r < 0))::int as down, count(*)::int as n
    from s group by 1`) as unknown as { b: number; up: number; down: number; n: number }[];
  const buckets: MonthBucket[] = [{ month: 'earlier', up: 0, down: 0, flat: 0, n: 0 }];
  for (let i = first; i <= first + 23; i++) buckets.push({ month: monthKey(i), up: 0, down: 0, flat: 0, n: 0 });
  let n = 0;
  for (const r of rows) Object.assign(buckets[r.b], { up: r.up, down: r.down, flat: r.n - r.up - r.down, n: r.n }), (n += r.n);
  return { buckets, n, monthsWithTrades: buckets.slice(1).filter((b) => b.n > 0).length };
}

// outcomeSpread() on toSpreadPct() values (percent, Math.round = floor(x + 0.5)), non-finite dropped. `returns` (the
// dots) is filled only under 10 trades, the only time the chart draws one dot per trade.
async function spread(db: Db, symbol: string): Promise<{ spread: Spread; returns: number[] }> {
  const vals = db`
    select floor(r * 1e8 + 0.5) / 1e6 as v, closed_at, id from (${tradesOf(db, symbol)}) s
    where r not in ('NaN', 'Infinity', '-Infinity')`;
  const [binRows, mid] = await Promise.all([
    db`
      select case when v < -50 then 0 when v >= 50 then 11 else floor(v / 10)::int + 6 end as bin, count(*)::int as n,
             (count(*) filter (where v > 0))::int as up, (count(*) filter (where v < 0))::int as down, min(v) as min, max(v) as max
      from (${vals}) v group by 1` as unknown as Promise<{ bin: number; n: number; up: number; down: number; min: number; max: number }[]>,
    db`
      select v, rn, cnt from (select v, closed_at, id, row_number() over (order by v) as rn, count(*) over () as cnt from (${vals}) v) z
      where cnt < 10 or rn in ((cnt + 1) / 2, cnt / 2 + 1)
      order by closed_at desc, id desc` as unknown as Promise<{ v: number; rn: string; cnt: string }[]>,
  ]);
  const bins: SpreadBin[] = [{ lo: null, hi: -50, count: 0, open: 'low' }];
  for (let lo = -50; lo < 50; lo += 10) bins.push({ lo, hi: lo + 10, count: 0, open: null });
  bins.push({ lo: 50, hi: null, count: 0, open: 'high' });
  let n = 0, up = 0, down = 0, min: number | null = null, max: number | null = null;
  for (const b of binRows) {
    bins[b.bin].count = b.n; n += b.n; up += b.up; down += b.down;
    min = min === null ? b.min : Math.min(min, b.min); max = max === null ? b.max : Math.max(max, b.max);
  }
  const at = (rn: number) => mid.find((m) => Number(m.rn) === rn)!.v;
  const median = n === 0 ? null : n % 2 ? at((n + 1) / 2) : (at(n / 2) + at(n / 2 + 1)) / 2;
  return { spread: { n, bins, median, up, down, flat: n - up - down, min, max }, returns: n < 10 ? mid.map((m) => m.v) : [] };
}

export type TickerRowOut = { id: number; user_id: number; handle: string; display_name: string; symbol: string; return_pct: number; holding_days: number; opened_at: Date; closed_at: Date; verified: boolean };
export type TickerPage = TickerHeadline & {
  rows: TickerRowOut[]; spread: Spread; returns: number[]; timeline: Timeline; holds: HoldBuckets; concentration: Concentration | null;
};

// Everything /t/SYMBOL shows, with the trade list capped at `cap` (newest first). The summary and charts cover all trades.
export async function tickerPage(symbol: string, today: Date, cap = TICKER_ROWS_CAP, db: Db = defaultSql): Promise<TickerPage> {
  return snapshot(db, (tx) => tickerPageIn(tx, symbol, today, cap));
}

async function tickerPageIn(db: Db, symbol: string, today: Date, cap: number): Promise<TickerPage> {
  const [s, b, tl, sp, rows] = await Promise.all([
    scopes(db, symbol, true), bets(db, symbol, true), timeline(db, symbol, today), spread(db, symbol),
    db`
      select t.id, t.user_id, u.handle, u.display_name, t.symbol, t.return_pct, t.holding_days, t.opened_at, t.closed_at, t.verified
      from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
      where t.symbol = ${symbol}
      order by t.closed_at desc, t.id desc
      limit ${cap}` as unknown as Promise<TickerRowOut[]>,
  ]);
  const scope = (k: string) => s.rows.find((r) => r.scope === k);
  const betsOf = (k: string) => b.filter((r) => r.scope === k);
  const all = scope('all');
  const summary = summaryFrom(all, betsOf('all'));
  const holds: HoldBuckets = {
    n: summary.n,
    buckets: HOLD_DEFS.map((d, i): HoldBucket => {
      const g = scope(`h${i}`);
      const n = g?.n ?? 0;
      if (n < MIN_HOLD_BUCKET) return { ...d, n, shown: false, winRate: null, avgReturn: null, conf: null };
      const hs = summaryFrom(g, betsOf(`h${i}`));
      return { ...d, n, shown: true, winRate: hs.winRate, avgReturn: hs.avgReturn, conf: hs.conf };
    }),
  };
  // concentration(): bets are per trader, so the rest's bets are the 'all' bets of everyone but the leader.
  let concentration: Concentration | null = null;
  const n = summary.n;
  if (n >= 2) {
    if (summary.traders === 1) concentration = { kind: 'single', n };
    else if (s.tied > 1) concentration = { kind: 'tie', n, tied: s.tied, each: s.top, share: s.top / n };
    else if (n - s.top < MIN_REST) concentration = { kind: 'too-few', n, top: s.top, share: s.top / n, rest: n - s.top };
    else concentration = { kind: 'compare', n, top: s.top, share: s.top / n, rest: summaryFrom(scope('rest'), betsOf('all').filter((r) => r.user_id !== s.leader)) };
  }
  return {
    summary, verifiedTrades: all?.verified ?? 0, verifiedTraders: all?.verified_traders ?? 0,
    rows, spread: sp.spread, returns: sp.returns, timeline: tl, holds, concentration,
  };
}

// relatedSymbols() in SQL: other symbols closed by anyone who closed this one, hidden unless at least 2 such traders
// have other symbols, most shared traders first, ties by symbol (code-point order, as JS `<`), 8 at most.
export async function relatedSymbolsSql(symbol: string, db: Db = defaultSql): Promise<RelatedSymbol[]> {
  const rows = (await db`
    with o as (
      -- FIXES-LABELS (code review): live users only, as tradesOf (a deleted user's trades are on no page).
      select t.symbol, t.user_id, t.verified from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
      where t.symbol <> ${symbol} and t.user_id in (select distinct user_id from closed_trades where symbol = ${symbol}))
    select symbol, count(distinct user_id)::int as traders, count(*)::int as trades, not bool_or(verified) as demo_only
    from o where (select count(distinct user_id) from o) >= 2
    group by symbol
    order by traders desc, symbol collate "C"
    limit 8`) as unknown as { symbol: string; traders: number; trades: number; demo_only: boolean }[];
  return rows.map((r) => ({ symbol: r.symbol, traders: r.traders, trades: r.trades, demoOnly: r.demo_only }));
}

export type TickerIndexPage = { total: number; kind: 'all' | 'exact' | 'prefix' | 'none' | 'invalid'; symbol?: string; matched: number; rows: TickerIndexRow[] };

// LIKE's own wildcards and its escape character, escaped. A normalized symbol never holds them; this is the second guard.
export const likePrefix = (s: string) => `${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// tickerIndex() + filterTickerIndex() + the page's slice, in SQL. `total` is every symbol (the page's empty state and
// "Showing X of Y"), `matched` the rows the search matched before the cap. Sort is one of two fixed fragments.
// ponytail: the group by still reads every closed trade per request; at ~10^6 rows keep a per-symbol summary table.
// ponytail: counts include deleted users' trades (unlike tradesOf) — lib/ticker-sql.test.ts's tickerIndexPage reference
// aggregates every closed trade, so joining live users here needs that test's reference changed by its owner first
export async function tickerIndexPage(q: unknown, sort: TickerSort, cap = TICKER_INDEX_CAP, db: Db = defaultSql): Promise<TickerIndexPage> {
  return snapshot(db, (tx) => tickerIndexIn(tx, q, sort, cap));
}

async function tickerIndexIn(db: Db, q: unknown, sort: TickerSort, cap: number): Promise<TickerIndexPage> {
  const [{ total }] = (await db`select count(distinct symbol)::int as total from closed_trades`) as unknown as { total: number }[];
  let kind: TickerIndexPage['kind'] = 'all';
  let symbol: string | undefined;
  if (typeof q === 'string' && q.trim()) {
    const s = normalizeSymbol(q);
    if (!s) return { total, kind: 'invalid', matched: 0, rows: [] };
    symbol = s;
    kind = 'prefix';
  }
  const order = sort === 'az' ? db`symbol collate "C"` : db`date_trunc('milliseconds', max(closed_at)) desc, symbol collate "C"`;
  const where = symbol ? db`where symbol like ${likePrefix(symbol)}` : db``;
  const rows = (await db`
    select symbol, count(*)::int as trades, count(distinct user_id)::int as traders, max(closed_at) as last_closed_at,
           count(*) filter (where verified)::int as verified_trades, count(*) over ()::int as matched,
           bool_or(symbol = ${symbol ?? ''}) as exact
    from closed_trades ${where}
    group by symbol
    order by bool_or(symbol = ${symbol ?? ''}) desc, ${order}
    limit ${cap}`) as unknown as { symbol: string; trades: number; traders: number; last_closed_at: Date; verified_trades: number; matched: number; exact: boolean }[];
  const out = (r: (typeof rows)[number]): TickerIndexRow => ({ symbol: r.symbol, trades: r.trades, traders: r.traders, lastClosedAt: r.last_closed_at, demoOnly: r.verified_trades === 0 });
  if (symbol) {
    if (rows[0]?.exact) return { total, kind: 'exact', symbol, matched: 1, rows: [out(rows[0])] };
    if (!rows.length) return { total, kind: 'none', matched: 0, rows: [] };
  }
  return { total, kind, ...(symbol ? { symbol } : {}), matched: rows[0]?.matched ?? 0, rows: rows.map(out) };
}

// ---- FIXES-LABELS ---- (round 3, engineer): the baseline's "other stocks recorded here" range, from the same
// confidence() path as this stock's: trades in every symbol but this one, verified (or Demo) rows only, live users only.
// One bet = one trader's overlapping holds in one stock (gaps and islands per (user_id, symbol), boundary inclusive, as
// confidence() clusters). Returns ONE row of clustering sums, never one row per bet; m and R come from a CTE.
// ponytail: per-request full scan — every uncached /t/SYMBOL render runs two window sorts over all other symbols' closed
// trades (verified or Demo); fix: cache the result per (symbol, verified), or keep a per-symbol summary table of the
// clustering sums and subtract this symbol's row
export async function othersConfidence(symbol: string, verified: boolean, db: Db = defaultSql): Promise<{ n: number; winRate: number | null; conf: Confidence }> {
  const { n, winRate, conf } = await sideConfidence(db, symbol, 'others', verified);
  return { n, winRate, conf };
}

// FIXES-LABELS (code review): one side of the baseline, clustered as confidence() does: 'others' = every other symbol,
// 'this' = this symbol only (one bet = one trader's overlapping holds, as on the page). Live users only.
type Side = { n: number; winRate: number | null; conf: Confidence; traders: number };
async function sideConfidence(db: Db, symbol: string, side: 'others' | 'this', verified: boolean): Promise<Side> {
  const where = side === 'this' ? db`t.symbol = ${symbol}` : db`t.symbol <> ${symbol}`;
  const [r] = (await db`
    with s as (
      select t.id, t.user_id, t.symbol, t.return_pct as rp, ln(greatest(1 + t.return_pct, 1e-9)) as x, greatest(t.holding_days, 1) as dd,
             date_trunc('milliseconds', t.opened_at) as o, date_trunc('milliseconds', t.closed_at) as c
      from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
      where ${where} and t.verified = ${verified}),
    w as (
      select s.*, max(c) over (partition by user_id, symbol order by o, id rows between unbounded preceding and 1 preceding) as pa
      from s),
    f as (
      select w.*, sum(case when pa is null or o > pa then 1 else 0 end) over (partition by user_id, symbol order by o, id rows unbounded preceding) as kb
      from w),
    b as (select sum(x) as x, sum(dd) as d, count(*)::int as n from f group by user_id, symbol, kb),
    tot as (select coalesce(sum(n), 0)::int as n, count(*)::int as k, coalesce(sum(x), 0) as sx, coalesce(sum(d), 0) as sd from b),
    mr as (select tot.*, sx / nullif(n, 0) as m, sx / nullif(sd, 0) as r from tot)
    select mr.n, mr.k, mr.sx, mr.sd,
           (select sum((b.x - b.n * mr.m) ^ 2) from b) as ss_m,
           (select sum((b.x - mr.r * b.d) ^ 2) from b) as ss_r,
           (select min(o) from s) as first_open, (select max(c) from s) as last_close,
           (select count(*) filter (where rp > 0 and rp <> 'NaN') from s)::int as wins,
           (select count(distinct user_id) from s)::int as traders
    from mr`) as unknown as { wins: number; traders: number; n: number; k: number; sx: number; sd: number; ss_m: number | null; ss_r: number | null; first_open: Date | null; last_close: Date | null }[];
  const spanDays = r.first_open && r.last_close ? (r.last_close.getTime() - r.first_open.getTime()) / DAY : 0;
  return {
    n: r.n,
    traders: r.traders,
    winRate: r.n ? r.wins / r.n : null,
    conf: confidenceFromSums({ n: r.n, k: r.k, spanDays, sumX: Number(r.sx), sumD: Number(r.sd), ssM: Number(r.ss_m ?? 0), ssR: Number(r.ss_r ?? 0) }),
  };
}

// FIXES-LABELS (code review): /t/SYMBOL's page data and its baseline in ONE snapshot. The baseline compares like with
// like: the other stocks' verified rows (Demo rows for a Demo-only stock), and on a mixed stock this stock's verified
// rows only, so both sides are the same population (`self`; null = the page's own summary is that side). A failed
// baseline read leaves the section out (`baseline: null`), never the page.
export type TickerBaseline = { others: { n: number; winRate: number | null; conf: Confidence }; self: Side | null };
export async function tickerPageWithBaseline(symbol: string, today: Date, cap = TICKER_ROWS_CAP, db: Db = defaultSql): Promise<TickerPage & { baseline: TickerBaseline | null }> {
  return snapshot(db, async (tx) => {
    const page = await tickerPageIn(tx, symbol, today, cap);
    const s = page.summary;
    const read = async (q: Db): Promise<TickerBaseline> => {
      const [o, self] = await Promise.all([
        sideConfidence(q, symbol, 'others', !s.demoOnly),
        s.mixed ? sideConfidence(q, symbol, 'this', true) : Promise.resolve(null),
      ]);
      return { others: { n: o.n, winRate: o.winRate, conf: o.conf }, self };
    };
    // A savepoint keeps the snapshot usable when the baseline's statement fails.
    const sp = (tx as unknown as { savepoint?: (fn: (q: Db) => Promise<TickerBaseline>) => Promise<TickerBaseline> }).savepoint;
    let baseline: TickerBaseline | null = null;
    if (s.n) {
      try { baseline = await (sp ? sp.call(tx, read) : read(tx)); } catch (e) { console.error('ticker baseline failed, section left out', logSafe(e)); }
    }
    return { ...page, baseline };
  });
}
