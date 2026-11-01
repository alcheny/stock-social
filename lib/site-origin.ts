// CHORES-3 (K20): the public origin, read from configuration, never a request's Host header (F-3 D10). Moved here from
// lib/billing.ts (which re-exports it) so pages that have nothing to do with billing, such as the feed's link preview,
// share the one rule without importing billing.
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return (site || (vercel ? (/^https?:\/\//.test(vercel) ? vercel : `https://${vercel}`) : 'http://localhost:3000')).replace(/\/+$/, '');
}
