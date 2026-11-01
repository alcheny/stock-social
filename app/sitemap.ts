import type { MetadataRoute } from 'next';
import { sitemapChunk } from '@/lib/sitemaps.ts';
import { buildSitemapEntries, siteUrl } from '@/lib/ticker.ts';

export const dynamic = 'force-dynamic';

// The home page, /t and the first SITEMAP_LIMIT indexable symbols. Further symbols are in /sitemaps/sitemap/<k>.xml,
// and /sitemap-index.xml lists every sitemap (lib/sitemaps.ts).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl(process.env);
  try {
    return buildSitemapEntries(await sitemapChunk(0), base);
  } catch {
    return buildSitemapEntries([], base);
  }
}
