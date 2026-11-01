// The configured public origin (no database, no vendor module): billing's return URLs (D10, lib/billing.ts re-exports
// it) and the layout's metadataBase (F-15 second half: canonical links and image URLs resolve against it), never a
// request's Host header.
// ponytail: a preview deploy without NEXT_PUBLIC_SITE_URL resolves canonical and image URLs to the production origin, so
// a preview's link previews fetch production cards — fix: set NEXT_PUBLIC_SITE_URL on preview deploys.
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  // A value without a scheme gets https:// (as the platform variable does), so new URL() in the layout can't throw.
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  const site = raw && !/^https?:\/\//.test(raw) ? `https://${raw}` : raw;
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return (site || (vercel ? (/^https?:\/\//.test(vercel) ? vercel : `https://${vercel}`) : 'http://localhost:3000')).replace(/\/+$/, '');
}
