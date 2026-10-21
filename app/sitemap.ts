import type { MetadataRoute } from 'next';
import { sql } from '@/lib/db.ts';
import { buildSitemapEntries, siteUrl, SITEMAP_LIMIT, type SitemapRow } from '@/lib/ticker.ts';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl(process.env);
  try {
    // ponytail: symbols past the cap fall off alphabetically; use sitemap indexes above 5000 symbols.
    const rows = (await sql`
      select symbol, max(closed_at) as last_closed_at,
             count(*) filter (where verified) as verified_trades,
             count(distinct user_id) filter (where verified) as verified_traders
      from closed_trades group by symbol order by symbol limit 5000`) as unknown as
      { symbol: string; last_closed_at: Date; verified_trades: string | number; verified_traders: string | number }[];
    const mapped: SitemapRow[] = rows.slice(0, SITEMAP_LIMIT).map((r) => ({
      symbol: r.symbol, lastClosedAt: new Date(r.last_closed_at),
      verifiedTrades: Number(r.verified_trades), verifiedTraders: Number(r.verified_traders),
    }));
    return buildSitemapEntries(mapped, base);
  } catch {
    return buildSitemapEntries([], base);
  }
}
