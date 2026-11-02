// FIXES-CYCLE5 (F5-4, C5-6): the ticker pages' reads of ticker_trader_sums (db/schema.sql), the per-(symbol, trader,
// verified) summary kept in step with closed_trades by triggers and by each rebuild (lib/sync.ts#finishTickerSums).
// Lives under app/t/ so the stock pages' visible-user guard (lib/fixes-cycle2-trust.test.ts) reads its SQL: every
// statement joins users through the visible-user predicate (lib/visible-users.ts) and reads rows with n > 0 only (a
// pair whose closes are gone keeps a zeroed row). Public filings never reach the table.
// What it reproduces (lib/fixes-cycle5-ticker.db.test.ts keeps the statements it replaced as the oracle):
// - /t: per symbol, trades, traders (count(distinct user_id)), the last close and whether any trade is verified;
// - /t/SYMBOL's "other stocks" baseline (sideConfidence 'others'): per trust, the closed count, wins, bets and the
//   clustering sums. Bets never cross a (trader, symbol) pair and the range filters on trust before it clusters, so the
//   per-pair sums add up exactly to the old statement's.
import type postgres from 'postgres';
import { sql as defaultSql } from '../../lib/db.ts';
import { visibleUser } from '../../lib/visible-users.ts';
import { bucketCache } from '../../lib/bucket-cache.ts';

type Db = postgres.ISql;

export type SideSums = {
  n: number; wins: number; k: number; sx: number; sd: number; sxx: number; sxn: number; snn: number; sxd: number; sdd: number;
  firstOpen: Date | null; lastClose: Date | null;
};
export type SymbolTotal = { symbol: string; trades: number; traders: number; lastClosedAt: Date; verifiedTrades: number; verified: SideSums; demo: SideSums };

const SIDE_COLS = ['n', 'wins', 'k', 'sx', 'sd', 'sxx', 'sxn', 'snn', 'sxd', 'sdd'] as const;
export const emptySide = (): SideSums => ({ n: 0, wins: 0, k: 0, sx: 0, sd: 0, sxx: 0, sxn: 0, snn: 0, sxd: 0, sdd: 0, firstOpen: null, lastClose: null });

type TotalRow = { symbol: string; traders: number; trades: number; last_closed_at: Date } & Record<string, number | Date | null>;

// One row per symbol: Σ of every column per trust, read from the summary only (its primary key or a scan of it, plus
// users), never from closed_trades. Sums are float8 sums over trader rows; integers stay exact.
async function readTotals(sql: Db): Promise<SymbolTotal[]> {
  const rows = (await sql`
    select s.symbol, count(distinct s.user_id)::int as traders, sum(s.n)::int as trades, max(s.last_closed_at) as last_closed_at,
           coalesce(sum(s.n) filter (where s.verified), 0)::int as v_n, coalesce(sum(s.wins) filter (where s.verified), 0)::int as v_wins,
           coalesce(sum(s.k) filter (where s.verified), 0)::int as v_k, coalesce(sum(s.sx) filter (where s.verified), 0) as v_sx,
           coalesce(sum(s.sd) filter (where s.verified), 0) as v_sd, coalesce(sum(s.sxx) filter (where s.verified), 0) as v_sxx,
           coalesce(sum(s.sxn) filter (where s.verified), 0) as v_sxn, coalesce(sum(s.snn) filter (where s.verified), 0) as v_snn,
           coalesce(sum(s.sxd) filter (where s.verified), 0) as v_sxd, coalesce(sum(s.sdd) filter (where s.verified), 0) as v_sdd,
           min(s.first_open) filter (where s.verified) as v_first_open, max(s.last_close) filter (where s.verified) as v_last_close,
           coalesce(sum(s.n) filter (where not s.verified), 0)::int as d_n, coalesce(sum(s.wins) filter (where not s.verified), 0)::int as d_wins,
           coalesce(sum(s.k) filter (where not s.verified), 0)::int as d_k, coalesce(sum(s.sx) filter (where not s.verified), 0) as d_sx,
           coalesce(sum(s.sd) filter (where not s.verified), 0) as d_sd, coalesce(sum(s.sxx) filter (where not s.verified), 0) as d_sxx,
           coalesce(sum(s.sxn) filter (where not s.verified), 0) as d_sxn, coalesce(sum(s.snn) filter (where not s.verified), 0) as d_snn,
           coalesce(sum(s.sxd) filter (where not s.verified), 0) as d_sxd, coalesce(sum(s.sdd) filter (where not s.verified), 0) as d_sdd,
           min(s.first_open) filter (where not s.verified) as d_first_open, max(s.last_close) filter (where not s.verified) as d_last_close
    from ticker_trader_sums s join users u on u.id = s.user_id and ${visibleUser('u')}
    where s.n > 0
    group by s.symbol`) as unknown as TotalRow[];
  const side = (r: TotalRow, p: 'v' | 'd'): SideSums => {
    const out = emptySide();
    for (const c of SIDE_COLS) out[c] = Number(r[`${p}_${c}`]);
    out.firstOpen = (r[`${p}_first_open`] as Date | null) ?? null;
    out.lastClose = (r[`${p}_last_close`] as Date | null) ?? null;
    return out;
  };
  return rows.map((r) => {
    const verified = side(r, 'v');
    return { symbol: r.symbol, trades: r.trades, traders: r.traders, lastClosedAt: r.last_closed_at, verifiedTrades: verified.n, verified, demo: side(r, 'd') };
  });
}

// Totals are cached per 60 s bucket, single flight (lib/bucket-cache.ts), only on the default pool and only in the
// deployed app (the gate F5-5 uses: VERCEL_ENV=production), so local runs and e2e read fresh rows. A caller's own
// transaction or connection always reads the table in its own snapshot.
// Privacy (code review 7): a profile hidden or deleted inside a bucket stays in these AGGREGATE counts (trades, traders,
// sums; no handle or identity) for at most one bucket, 60 s; every per-trader read keeps the visible-user filter.
// ponytail: per process — each server builds its own copy once a minute; a rollup row written by the hourly cron would
// let servers share one build.
export const TOTALS_BUCKET_MS = 60_000;
export const totalsClock = { now: () => Date.now() }; // tests move the bucket
export const totalsStats = { builds: 0 }; // tests count pool builds
const cache = bucketCache<SymbolTotal[]>(2);
export const totalsCacheOn = () => process.env.VERCEL_ENV === 'production';
export function clearTotalsCache() { cache.clear(); }

export function symbolTotals(sql: Db = defaultSql): Promise<SymbolTotal[]> {
  if (sql !== defaultSql) return readTotals(sql);
  const build = () => { totalsStats.builds++; return readTotals(defaultSql); };
  if (!totalsCacheOn()) return build();
  return cache.get(String(Math.floor(totalsClock.now() / TOTALS_BUCKET_MS)), build);
}

// Every symbol but `symbol`, one trust, summed here (never total minus this symbol: a subtraction would leave rounding
// residue in the sums and can't give back the other symbols' first and last dates).
export function othersSums(totals: SymbolTotal[], symbol: string, verified: boolean): SideSums {
  const out = emptySide();
  for (const t of totals) {
    if (t.symbol === symbol) continue;
    const s = verified ? t.verified : t.demo;
    if (!s.n) continue;
    for (const c of SIDE_COLS) out[c] += s[c];
    if (s.firstOpen && (!out.firstOpen || s.firstOpen < out.firstOpen)) out.firstOpen = s.firstOpen;
    if (s.lastClose && (!out.lastClose || s.lastClose > out.lastClose)) out.lastClose = s.lastClose;
  }
  return out;
}

// Σ(x − n·m)² and Σ(x − R·d)² over bets, from the expanded sums. Rounding can leave a tiny residue where the exact value
// is 0 (every bet alike); a result within rounding of the terms' size is 0, as the direct sum gives.
export function varianceSums(s: SideSums): { ssM: number; ssR: number } {
  if (!s.n) return { ssM: 0, ssR: 0 };
  const m = s.sx / s.n, r = s.sx / s.sd;
  const tidy = (v: number, scale: number) => (v <= scale * 1e-12 ? 0 : v);
  return {
    ssM: tidy(s.sxx - 2 * m * s.sxn + m * m * s.snn, s.sxx + m * m * s.snn),
    ssR: tidy(s.sxx - 2 * r * s.sxd + r * r * s.sdd, s.sxx + r * r * s.sdd),
  };
}

// relatedSymbolsSql's rows: per other symbol closed by this symbol's traders, its traders, trades and whether any is
// verified. Reads this symbol's summary rows (primary key) and those traders' rows (ticker_trader_sums_user).
export async function relatedRows(sql: Db, symbol: string): Promise<{ symbol: string; traders: number; trades: number; demo_only: boolean }[]> {
  return (await sql`
    with me as (select distinct m.user_id from ticker_trader_sums m where m.symbol = ${symbol} and m.n > 0),
    o as (
      select s.symbol, s.user_id, s.n, s.verified from ticker_trader_sums s join users u on u.id = s.user_id and ${visibleUser('u')}
      where s.symbol <> ${symbol} and s.n > 0 and s.user_id in (select user_id from me))
    select symbol, count(distinct user_id)::int as traders, sum(n)::int as trades, not bool_or(verified) as demo_only
    from o where (select count(distinct user_id) from o) >= 2
    group by symbol
    order by traders desc, symbol collate "C"
    limit 8`) as unknown as { symbol: string; traders: number; trades: number; demo_only: boolean }[];
}
// end FIXES-CYCLE5
