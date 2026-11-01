// Sitemaps above SITEMAP_LIMIT symbols (known limit removed 2026-11-01): `/sitemap.xml` keeps the home page, `/t` and the
// first SITEMAP_LIMIT indexable symbols; every further SITEMAP_LIMIT go to `/sitemaps/sitemap/<k>.xml` (Next.js
// generateSitemaps, app/sitemaps/sitemap.ts), and robots.txt lists every sitemap (one Sitemap line each; committee
// 2026-11-01: Next's robots takes a list, so no hand-written index route).
// Symbols and dates only, alphabetical (byte order), never ranked; the same rule as lib/ticker.ts#isIndexableTicker,
// applied in SQL so thin and demo-only symbols take no slot.
import { sql } from './db.ts';
import { buildSitemapEntries, MIN_INDEX_TRADERS, MIN_INDEX_TRADES, SITEMAP_LIMIT, type SitemapRow } from './ticker.ts';

export const EXTRA_SITEMAP_PATH = '/sitemaps/sitemap';

// How many sitemaps n indexable symbols need: always 1 (`/sitemap.xml`), plus one per further SITEMAP_LIMIT.
export const sitemapCount = (n: number) => Math.max(1, Math.ceil((Number.isFinite(n) && n > 0 ? n : 0) / SITEMAP_LIMIT));
// The ids of the sitemaps after `/sitemap.xml`: '1' … String(count − 1).
export const extraSitemapIds = (n: number) => Array.from({ length: sitemapCount(n) - 1 }, (_, i) => String(i + 1));
// A generateSitemaps id as a chunk number ≥ 1, or null for anything else.
export function chunkOf(id: string): number | null {
  return /^[1-9][0-9]{0,5}$/.test(id) ? Number(id) : null;
}

// Every sitemap's URL, `/sitemap.xml` first, for robots.txt.
export function sitemapUrls(baseUrl: string, n: number): string[] {
  const base = baseUrl.replace(/\/+$/, '');
  return [`${base}/sitemap.xml`, ...extraSitemapIds(n).map((id) => `${base}${EXTRA_SITEMAP_PATH}/${id}.xml`)];
}

// `prefix` is a test hook (only symbols starting with it); the app passes none.
const indexable = (prefix?: string) => sql`
  select symbol, max(closed_at) as last_closed_at,
         count(*) filter (where verified) as verified_trades,
         count(distinct user_id) filter (where verified) as verified_traders
  from closed_trades ${prefix ? sql`where starts_with(symbol, ${prefix})` : sql``}
  group by symbol
  having count(*) filter (where verified) >= ${MIN_INDEX_TRADES} and count(distinct user_id) filter (where verified) >= ${MIN_INDEX_TRADERS}`;

export async function indexableCount(opts: { prefix?: string } = {}): Promise<number> {
  const [r] = await sql`select count(*)::int as n from (${indexable(opts.prefix)}) s`;
  return r.n as number;
}

// robots.txt and every further sitemap request read the count (Next.js calls generateSitemaps per request to check the
// id): kept COUNT_TTL_MS per server, so a crawl of k sitemaps runs about k + 1 aggregations, not 2k.
export const COUNT_TTL_MS = 10 * 60_000;
let counted: { n: number; at: number } | null = null;
export async function indexableCountCached(now = Date.now()): Promise<number> {
  if (counted && now - counted.at < COUNT_TTL_MS) return counted.n;
  const n = await indexableCount();
  counted = { n, at: now };
  return n;
}

// A chunk's symbol entries only (the home page and /t are in /sitemap.xml).
export const symbolEntries = (rows: SitemapRow[], baseUrl: string) => {
  const base = baseUrl.replace(/\/+$/, '');
  return buildSitemapEntries(rows, base).filter((e) => e.url.startsWith(`${base}/t/`));
};

// Chunk k (0 for `/sitemap.xml`): the indexable symbols at positions [k·SITEMAP_LIMIT, (k+1)·SITEMAP_LIMIT) in byte order.
export async function sitemapChunk(k: number, opts: { prefix?: string } = {}): Promise<SitemapRow[]> {
  const rows = await sql`select * from (${indexable(opts.prefix)}) s order by symbol collate "C"
    limit ${SITEMAP_LIMIT} offset ${k * SITEMAP_LIMIT}`;
  return rows.map((r) => ({
    symbol: r.symbol as string, lastClosedAt: new Date(r.last_closed_at as Date),
    verifiedTrades: Number(r.verified_trades), verifiedTraders: Number(r.verified_traders),
  }));
}
