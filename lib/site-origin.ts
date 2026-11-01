// CHORES-3 (K20): the public origin, read from configuration, never a request's Host header (F-3 D10). Moved here from
// lib/billing.ts (which re-exports it) so pages that have nothing to do with billing, such as the feed's link preview,
// share the one rule without importing billing.
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  // F-15 second half: a value without a scheme gets https:// (as the platform variable does), so the layout's
  // metadataBase can't throw.
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  const site = raw && !/^https?:\/\//.test(raw) ? `https://${raw}` : raw;
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return (site || (vercel ? (/^https?:\/\//.test(vercel) ? vercel : `https://${vercel}`) : 'http://localhost:3000')).replace(/\/+$/, '');
}
// ponytail: a preview deploy without NEXT_PUBLIC_SITE_URL declares the production origin as its canonical link (the
// framework itself uses the preview URL for social image URLs when VERCEL_ENV=preview, so only the canonical is
// affected) — fix: set NEXT_PUBLIC_SITE_URL on preview deploys.
