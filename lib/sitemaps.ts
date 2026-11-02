// Sitemaps above SITEMAP_LIMIT symbols (known limit removed 2026-11-01): `/sitemap.xml` keeps the home page, `/t` and the
// first SITEMAP_LIMIT indexable symbols; every further SITEMAP_LIMIT go to `/sitemaps/sitemap/<k>.xml` (Next.js
// generateSitemaps, app/sitemaps/sitemap.ts), and robots.txt lists every sitemap (one Sitemap line each; committee
// 2026-11-01: Next's robots takes a list, so no hand-written index route).
// Symbols and dates only, never ranked; the same rule as lib/ticker.ts#isIndexableTicker, applied in SQL so thin and
// demo-only symbols take no slot. Chunks are cut in the database's default order (so the stored sitemap's primary key
// serves each chunk's range, C5-43 (c) below); within a chunk symbols are in byte order (collate "C"). On a database whose default
// collation is C (the local one) that is byte order across chunks too. On another collation (e.g. en_US, which orders
// punctuation like '.' and '-' at a lower level) symbols such as "BRK.B" and "BRKA" can sort into a different chunk than
// byte order would put them; every symbol is still in exactly one sitemap.
//
// Sweep 2 (2026-11-01): the boundaries are one shared row per scope (`sitemap_chunks`), so every server lists and answers
// the same sitemaps, and a chunk is a range read of its own symbols (no offset over every close). Chores cycle 5
// (C5-43 (c)): only the cron rebuilds them.
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
// wait of a forced rebuild); the app passes none.
export type SitemapOpts = { prefix?: string; limit?: number; waitMs?: number };

// ---- chores cycle 5 (C5-43 part c): sitemap ----
// No request aggregates closed_trades: the cron (app/api/sync, housekeeping) rebuilds a stored sitemap at most once per
// REBUILD_MS (rebuildSitemapIfDue), and robots.txt, the sitemap ids and every chunk read only that (sitemap_chunks and
// sitemap_traders). Stored per indexable symbol and trader: the trader's verified closes and the UTC day of their newest
// close (the sitemap prints the symbol and that day; the count only decides whether a symbol is listed). A trader whose
// deletion is in progress still leaves every chunk at once (fix #4): each read keeps visible traders only and applies
// the thresholds again. A new close shows at the next rebuild (up to REBUILD_MS plus the cron interval later).
// ponytail: each rebuild aggregates every close and rewrites every stored row (one statement, at most once per
// REBUILD_MS fleet-wide) — rebuild only the symbols of the records lib/sync.ts#rebuildTrades rewrote since the last one.

// F-7: public filings never count. Only visible users' closes count (fix #4, lib/visible-users.ts: a profile being
// deleted is never on a public aggregate surface). Per symbol and trader: the trader's verified closes and the UTC day of
// their newest close. Read only by the rebuild (and indexableCount).
const perTrader = (prefix?: string) => {
  // The test hook's range bounds the index scan to the prefix (test symbols are the prefix plus digits and letters).
  const scoped = prefix ? sql`and starts_with(symbol, ${prefix}) and symbol >= ${prefix} and symbol < ${prefix + 'Z'.repeat(32)}` : sql``;
  return sql`
  select symbol, user_id, (count(*) filter (where verified))::int as verified_trades, max((closed_at at time zone 'UTC')::date) as last_closed_day
  from closed_trades where filing_url is null and user_id in (${visibleUserIds()}) ${scoped}
  group by symbol, user_id`;
};
// The indexable rule (lib/ticker.ts#isIndexableTicker) over per-trader rows: enough verified closes from enough traders.
const indexableRule = () => sql`having sum(verified_trades) >= ${MIN_INDEX_TRADES} and count(*) filter (where verified_trades > 0) >= ${MIN_INDEX_TRADERS}`;

// The stored sitemap's indexable symbols in [lo, hi) (the default collation, served by the primary key), visible traders
// only. Every request's read.
const stored = (scope: string, lo?: string | null, hi?: string | null) => {
  const from = lo != null ? sql`and symbol >= ${lo}` : sql``;
  const to = hi != null ? sql`and symbol < ${hi}` : sql``;
  return sql`
  select symbol, max(last_closed_day) as last_closed_at, sum(verified_trades)::int as verified_trades,
         (count(*) filter (where verified_trades > 0))::int as verified_traders
  from sitemap_traders where scope = ${scope} and user_id in (${visibleUserIds()}) ${from} ${to}
  group by symbol ${indexableRule()}`;
};

// Indexable symbols as the next rebuild would count them (tests; no request calls it).
export async function indexableCount(opts: { prefix?: string } = {}): Promise<number> {
  const [r] = await sql`select count(*)::int as n from (select symbol from (${perTrader(opts.prefix)}) p group by symbol ${indexableRule()}) s`;
  return r.n as number;
}

// The shared boundaries. firsts[i] is the first symbol of further sitemap i + 1; n the indexable symbols at the build;
// published the most further sitemap ids ever listed (never shrinks: an id robots.txt once listed keeps answering 200,
// with an empty urlset once it is past the end, never a 404; chunkOf caps ids at 6 digits).
export type SitemapIndex = { firsts: string[]; n: number; published: number };
// Rebuilt at most once per REBUILD_MS, fleet-wide (staleness is judged by the database's clock, not a server's).
export const REBUILD_MS = 10 * 60_000;
// How long a forced rebuild waits for a concurrent builder before failing.
export const LOCK_WAIT_MS = 5_000;
// Before the first rebuild: /sitemap.xml lists the home page and /t only, and robots.txt lists it alone.
const EMPTY: SitemapIndex = { firsts: [], n: 0, published: 0 };

const scopeOf = (o: SitemapOpts) => o.prefix ?? '';
const lockKey = (scope: string) => sql`hashtextextended(${`sitemap_chunks:${scope}`}, 0)`;
const toIndex = (r: Record<string, unknown>): SitemapIndex => ({ firsts: r.firsts as string[], n: Number(r.n), published: Number(r.published) });
const readRow = (q: typeof sql | TransactionSql, scope: string) => q`
  select firsts, n, published, built_at < now() - make_interval(secs => ${REBUILD_MS / 1000}) as stale
  from sitemap_chunks where scope = ${scope}`;

// Rebuild the stored sitemap and its boundaries (one aggregation, one transaction). 'force' blocks (up to waitMs, then
// fails) for a concurrent builder and always rebuilds; 'try' (the cron) skips while another builder runs and while the
// stored sitemap is younger than REBUILD_MS (judged under the lock, on the database's clock).
export const sitemapRebuilds = { count: 0 }; // builds run by this process (tests)
// ponytail: a rebuild is one transaction; an account's hard delete that commits during it makes the insert fail on the
// foreign key (the rebuild rolls back, logs "sitemap rebuild failed" and runs again on the next tick), and a delete that
// starts during it waits for it — no data shows either way (reads filter on visibility) — fix: insert only user ids
// that still exist (`where exists (select 1 from users …)`) under a share lock, or rebuild per symbol range.
async function build(opts: SitemapOpts, mode: 'force' | 'try'): Promise<{ ix: SitemapIndex | null; rebuilt: boolean }> {
  const scope = scopeOf(opts), limit = opts.limit ?? SITEMAP_LIMIT;
  return sql.begin(async (tx) => {
    if (mode === 'force') {
      await tx`select set_config('lock_timeout', ${`${opts.waitMs ?? LOCK_WAIT_MS}ms`}, true)`;
      await tx`select pg_advisory_xact_lock(${lockKey(scope)})`;
    } else {
      const [{ got }] = await tx`select pg_try_advisory_xact_lock(${lockKey(scope)}) as got`;
      if (!got) return { ix: null, rebuilt: false };
      const [r] = await readRow(tx, scope); // under the lock: a builder that just committed leaves nothing to do
      if (r && !r.stale) return { ix: toIndex(r), rebuilt: false };
    }
    sitemapRebuilds.count++;
    await tx`delete from sitemap_traders where scope = ${scope}`;
    await tx`
      with p as (${perTrader(opts.prefix)}), keep as (select symbol from p group by symbol ${indexableRule()})
      insert into sitemap_traders (scope, symbol, user_id, verified_trades, last_closed_day)
      select ${scope}, p.symbol, p.user_id, p.verified_trades, p.last_closed_day from p join keep using (symbol)`;
    const [r] = await tx`
      with s as (select symbol, row_number() over (order by symbol) - 1 as i from (${stored(scope)}) x),
           b as (select count(*)::int as n, coalesce(array_agg(symbol order by symbol) filter (where i > 0 and i % ${limit} = 0), '{}') as firsts from s)
      insert into sitemap_chunks as c (scope, firsts, n, published, built_at)
      select ${scope}, firsts, n, cardinality(firsts), now() from b
      on conflict (scope) do update set firsts = excluded.firsts, n = excluded.n,
        published = greatest(c.published, excluded.published), built_at = excluded.built_at
      returning firsts, n, published`;
    return { ix: toIndex(r), rebuilt: true };
  });
}
export async function rebuildSitemapIndex(opts: SitemapOpts = {}, mode: 'force' | 'try' = 'force'): Promise<SitemapIndex | null> {
  return (await build(opts, mode)).ix;
}

// The cron's step (app/api/sync, housekeeping): rebuild when the stored sitemap is missing or older than REBUILD_MS and
// no other call is rebuilding it. Counts only.
export async function rebuildSitemapIfDue(opts: SitemapOpts = {}): Promise<{ rebuilt: boolean; n: number | null }> {
  const { ix, rebuilt } = await build(opts, 'try');
  return { rebuilt, n: ix?.n ?? null };
}

// The shared boundaries: one primary-key read, whatever their age (only the cron rebuilds; no row yet: empty).
export async function sitemapIndex(opts: SitemapOpts = {}): Promise<SitemapIndex> {
  const [r] = await readRow(sql, scopeOf(opts));
  return r ? toIndex(r) : EMPTY;
}
// ---- end chores cycle 5 (C5-43 part c) ----

// Every further sitemap id that answers (robots.txt lists the first extraSitemapIds(n) of them).
export const publishedIds = (ix: SitemapIndex) =>
  Array.from({ length: Math.max(ix.published, ix.firsts.length) }, (_, i) => String(i + 1));

// A chunk's symbol entries only (the home page and /t are in /sitemap.xml).
export const symbolEntries = (rows: SitemapRow[], baseUrl: string) => {
  const base = baseUrl.replace(/\/+$/, '');
  return buildSitemapEntries(rows, base).filter((e) => e.url.startsWith(`${base}/t/`));
};

// Chunk k (0 for `/sitemap.xml`): the stored sitemap's indexable symbols in [firsts[k−1], firsts[k]), in byte order. The
// boundaries and the stored rows come from the same rebuild, so a chunk never holds more than its size (a deletion only
// shrinks it). A k past the end (an id published earlier) is empty. C5-43 (c): reads no closed_trades.
export async function sitemapChunk(k: number, opts: SitemapOpts = {}): Promise<SitemapRow[]> {
  const limit = opts.limit ?? SITEMAP_LIMIT;
  const ix = await sitemapIndex(opts);
  if (k > ix.firsts.length) return [];
  const lo = k === 0 ? null : ix.firsts[k - 1];
  const hi = k < ix.firsts.length ? ix.firsts[k] : null;
  const rows = await sql`select * from (${stored(scopeOf(opts), lo, hi)}) s order by symbol collate "C" limit ${limit}`;
  return rows.map((r) => ({
    symbol: r.symbol as string, lastClosedAt: new Date(r.last_closed_at as Date),
    verifiedTrades: Number(r.verified_trades), verifiedTraders: Number(r.verified_traders),
  }));
}
