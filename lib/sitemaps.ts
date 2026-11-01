// Sitemaps above SITEMAP_LIMIT symbols (known limit removed 2026-11-01): `/sitemap.xml` keeps the home page, `/t` and the
// first SITEMAP_LIMIT indexable symbols; every further SITEMAP_LIMIT go to `/sitemaps/sitemap/<k>.xml` (Next.js
// generateSitemaps, app/sitemaps/sitemap.ts), and robots.txt lists every sitemap (one Sitemap line each; committee
// 2026-11-01: Next's robots takes a list, so no hand-written index route).
// Symbols and dates only, never ranked; the same rule as lib/ticker.ts#isIndexableTicker, applied in SQL so thin and
// demo-only symbols take no slot. Chunks are cut in the database's default order (so the existing closed_trades_symbol
// index serves each chunk's range); within a chunk symbols are in byte order (collate "C"). On a database whose default
// collation is C (the local one) that is byte order across chunks too. On another collation (e.g. en_US, which orders
// punctuation like '.' and '-' at a lower level) symbols such as "BRK.B" and "BRKA" can sort into a different chunk than
// byte order would put them; every symbol is still in exactly one sitemap.
//
// Sweep 2 (2026-11-01): the boundaries are one shared row per scope (`sitemap_chunks`), so every server lists and answers
// the same sitemaps, and a chunk is a range read of its own symbols (no offset over every close).
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { visibleUserIds } from './visible-users.ts';
import { buildSitemapEntries, MIN_INDEX_TRADERS, MIN_INDEX_TRADES, SITEMAP_LIMIT, type SitemapRow } from './ticker.ts';

export const EXTRA_SITEMAP_PATH = '/sitemaps/sitemap';

// How many sitemaps n indexable symbols need: always 1 (`/sitemap.xml`), plus one per further SITEMAP_LIMIT.
export const sitemapCount = (n: number) => Math.max(1, Math.ceil((Number.isFinite(n) && n > 0 ? n : 0) / SITEMAP_LIMIT));
// The ids of the sitemaps after `/sitemap.xml`: '1' … String(count − 1).
export const extraSitemapIds = (n: number) => Array.from({ length: sitemapCount(n) - 1 }, (_, i) => String(i + 1));
// A generateSitemaps id as a chunk number ≥ 1, or null for anything else (at most 6 digits: bounds the high-water mark).
export function chunkOf(id: string): number | null {
  return /^[1-9][0-9]{0,5}$/.test(id) ? Number(id) : null;
}

// Every sitemap's URL, `/sitemap.xml` first, for robots.txt.
export function sitemapUrls(baseUrl: string, n: number): string[] {
  const base = baseUrl.replace(/\/+$/, '');
  return [`${base}/sitemap.xml`, ...extraSitemapIds(n).map((id) => `${base}${EXTRA_SITEMAP_PATH}/${id}.xml`)];
}

// `prefix`, `limit` and `waitMs` are test hooks (only symbols starting with prefix; chunks of limit symbols; the lock
// wait); the app passes none.
export type SitemapOpts = { prefix?: string; limit?: number; waitMs?: number };

// Only visible users' closes count (fix #4, lib/visible-users.ts: a profile being deleted is never on a public aggregate
// surface). `lo`/`hi`: a chunk's range [lo, hi) in the default collation (served by closed_trades_symbol).
const indexable = (prefix?: string, lo?: string | null, hi?: string | null) => {
  // The test hook's range bounds the index scan to the prefix (test symbols are the prefix plus digits and letters).
  const scoped = prefix ? sql`and starts_with(symbol, ${prefix}) and symbol >= ${prefix} and symbol < ${prefix + 'Z'.repeat(32)}` : sql``;
  const from = lo != null ? sql`and symbol >= ${lo}` : sql``;
  const to = hi != null ? sql`and symbol < ${hi}` : sql``;
  return sql`
  select symbol, max(closed_at) as last_closed_at,
         count(*) filter (where verified) as verified_trades,
         count(distinct user_id) filter (where verified) as verified_traders
  from closed_trades where user_id in (${visibleUserIds()}) ${scoped} ${from} ${to}
  group by symbol
  having count(*) filter (where verified) >= ${MIN_INDEX_TRADES} and count(distinct user_id) filter (where verified) >= ${MIN_INDEX_TRADERS}`;
};

export async function indexableCount(opts: { prefix?: string } = {}): Promise<number> {
  const [r] = await sql`select count(*)::int as n from (${indexable(opts.prefix)}) s`;
  return r.n as number;
}

// The shared boundaries. firsts[i] is the first symbol of further sitemap i + 1; n the indexable symbols at the build;
// published the most further sitemap ids ever listed (never shrinks: an id robots.txt once listed keeps answering 200,
// with an empty urlset once it is past the end, never a 404; chunkOf caps ids at 6 digits).
export type SitemapIndex = { firsts: string[]; n: number; published: number };
// Rebuilt at most once per REBUILD_MS, fleet-wide (staleness is judged by the database's clock, not a server's).
export const REBUILD_MS = 10 * 60_000;
// How long a request waits for another server's first build (no row yet) before failing like a database error.
export const LOCK_WAIT_MS = 5_000;
// ponytail: the boundaries are rebuilt by a crawler's request, once per REBUILD_MS, with one aggregation of every close —
// rebuild them on the cron tick (app/api/sync) or keep them up to date in lib/sync.ts#rebuildTrades.

const scopeOf = (o: SitemapOpts) => o.prefix ?? '';
const lockKey = (scope: string) => sql`hashtextextended(${`sitemap_chunks:${scope}`}, 0)`;
const toIndex = (r: Record<string, unknown>): SitemapIndex => ({ firsts: r.firsts as string[], n: Number(r.n), published: Number(r.published) });
const readRow = (q: typeof sql | TransactionSql, scope: string) => q`
  select firsts, n, published, built_at < now() - make_interval(secs => ${REBUILD_MS / 1000}) as stale
  from sitemap_chunks where scope = ${scope}`;

// Rebuild the boundaries (one aggregation). 'force' and 'wait' block (up to waitMs, then fail) for a concurrent builder;
// 'try' skips (null) while one is running. Both re-read under the lock and return a row a builder just made fresh.
export const sitemapRebuilds = { count: 0 }; // builds run by this process (tests)
export async function rebuildSitemapIndex(opts: SitemapOpts = {}, mode: 'force' | 'wait' | 'try' = 'force'): Promise<SitemapIndex | null> {
  const scope = scopeOf(opts), limit = opts.limit ?? SITEMAP_LIMIT;
  return sql.begin(async (tx) => {
    if (mode !== 'try') {
      await tx`select set_config('lock_timeout', ${`${opts.waitMs ?? LOCK_WAIT_MS}ms`}, true)`;
      await tx`select pg_advisory_xact_lock(${lockKey(scope)})`;
    } else {
      const [{ got }] = await tx`select pg_try_advisory_xact_lock(${lockKey(scope)}) as got`;
      if (!got) return null;
    }
    if (mode !== 'force') { // under the lock: a builder that just committed leaves nothing to do
      const [r] = await readRow(tx, scope);
      if (r && !r.stale) return toIndex(r);
    }
    sitemapRebuilds.count++;
    const [r] = await tx`
      with s as (select symbol, row_number() over (order by symbol) - 1 as i from (${indexable(opts.prefix)}) x),
           b as (select count(*)::int as n, coalesce(array_agg(symbol order by symbol) filter (where i > 0 and i % ${limit} = 0), '{}') as firsts from s)
      insert into sitemap_chunks as c (scope, firsts, n, published, built_at)
      select ${scope}, firsts, n, cardinality(firsts), now() from b
      on conflict (scope) do update set firsts = excluded.firsts, n = excluded.n,
        published = greatest(c.published, excluded.published), built_at = excluded.built_at
      returning firsts, n, published`;
    return toIndex(r);
  });
}

// The shared boundaries: one primary-key read. No row yet: build it (waiting for a concurrent builder). Stale: one
// server rebuilds while every other one serves the row it read.
export async function sitemapIndex(opts: SitemapOpts = {}): Promise<SitemapIndex> {
  const [r] = await readRow(sql, scopeOf(opts));
  if (!r) return (await rebuildSitemapIndex(opts, 'wait'))!;
  if (r.stale) return (await rebuildSitemapIndex(opts, 'try')) ?? toIndex(r);
  return toIndex(r);
}

// Every further sitemap id that answers (robots.txt lists the first extraSitemapIds(n) of them).
export const publishedIds = (ix: SitemapIndex) =>
  Array.from({ length: Math.max(ix.published, ix.firsts.length) }, (_, i) => String(i + 1));

// The next request rebuilds (a chunk outgrew its size between builds).
const markStale = (scope: string) => sql`update sitemap_chunks set built_at = '-infinity' where scope = ${scope}`;

// A chunk's symbol entries only (the home page and /t are in /sitemap.xml).
export const symbolEntries = (rows: SitemapRow[], baseUrl: string) => {
  const base = baseUrl.replace(/\/+$/, '');
  return buildSitemapEntries(rows, base).filter((e) => e.url.startsWith(`${base}/t/`));
};

// Chunk k (0 for `/sitemap.xml`): the indexable symbols in [firsts[k−1], firsts[k]), in byte order. A range keeps every
// symbol in exactly one sitemap even while the boundaries are stale (a new symbol lands in whichever range covers it).
// A chunk above its size marks the row stale; chunk 0 is cut at the size (buildSitemapEntries' cap, app/sitemap.ts)
// and a further one at twice it (far under the protocol's 50,000), so a symbol is cut only until the next request's
// rebuild. A k past the end (an id published earlier) is empty.
export async function sitemapChunk(k: number, opts: SitemapOpts = {}): Promise<SitemapRow[]> {
  const limit = opts.limit ?? SITEMAP_LIMIT;
  const ix = await sitemapIndex(opts);
  if (k > ix.firsts.length) return [];
  const lo = k === 0 ? null : ix.firsts[k - 1];
  const hi = k < ix.firsts.length ? ix.firsts[k] : null;
  const cap = k === 0 ? limit : 2 * limit;
  const rows = await sql`select * from (${indexable(opts.prefix, lo, hi)}) s order by symbol collate "C" limit ${cap + 1}`;
  if (rows.length > limit) await markStale(scopeOf(opts));
  return rows.slice(0, cap).map((r) => ({
    symbol: r.symbol as string, lastClosedAt: new Date(r.last_closed_at as Date),
    verifiedTrades: Number(r.verified_trades), verifiedTraders: Number(r.verified_traders),
  }));
}
