import type { MetadataRoute } from 'next';
import { sitemapChunk } from '@/lib/sitemaps.ts';
import { buildSitemapEntries, siteUrl } from '@/lib/ticker.ts';

export const dynamic = 'force-dynamic';

// The home page, /t and the first SITEMAP_LIMIT indexable symbols. Further symbols are in /sitemaps/sitemap/<k>.xml,
// and robots.txt lists every sitemap (lib/sitemaps.ts). With no database it still answers, with the home page and /t.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl(process.env);
  try {
    return buildSitemapEntries(await sitemapChunk(0), base);
  } catch {
    return buildSitemapEntries([], base);
  }
}
