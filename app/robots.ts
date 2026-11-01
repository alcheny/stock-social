import type { MetadataRoute } from 'next';
import { indexableCountCached, sitemapUrls } from '@/lib/sitemaps.ts';
import { siteUrl } from '@/lib/ticker.ts';

export const dynamic = 'force-dynamic';

// One Sitemap line per sitemap: /sitemap.xml, then /sitemaps/sitemap/<k>.xml per further SITEMAP_LIMIT symbols
// (lib/sitemaps.ts). With no database, /sitemap.xml alone (it serves then too).
export default async function robots(): Promise<MetadataRoute.Robots> {
  let n = 0;
  try { n = await indexableCountCached(); } catch { /* /sitemap.xml alone */ }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api', '/connect'] },
    sitemap: sitemapUrls(siteUrl(process.env), n),
  };
}
