import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/ticker.ts';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api', '/connect'] },
    sitemap: `${siteUrl(process.env)}/sitemap.xml`,
  };
}
