import type { MetadataRoute } from 'next';
import { chunkOf, extraSitemapIds, indexableCountCached, sitemapChunk, symbolEntries } from '@/lib/sitemaps.ts';
import { siteUrl } from '@/lib/ticker.ts';

export const dynamic = 'force-dynamic';

// Next.js 16 generateSitemaps: /sitemaps/sitemap/<id>.xml for each id; any other id is a 404. Ids start at 1 (chunk 0
// is /sitemap.xml). Next also calls it at build time (generateStaticParams), where no database may be reachable: there
// it lists none. At request time a database error fails the request (a 5xx a crawler retries), never a false 404.
export async function generateSitemaps(): Promise<{ id: string }[]> {
  try {
    return extraSitemapIds(await indexableCountCached()).map((id) => ({ id }));
  } catch (e) {
    if (process.env.NEXT_PHASE === 'phase-production-build') return [];
    throw e;
  }
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const k = chunkOf(await props.id);
  if (k === null) return [];
  return symbolEntries(await sitemapChunk(k), siteUrl(process.env));
}
