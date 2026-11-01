// Security hardening (2026-11-01), F27: the app's security headers. Pure, so node:test covers them; proxy.ts sets the
// CSP per request (its nonce), next.config.ts the static headers.

export type CspInput = { nonce: string; dev: boolean; https: boolean; frameOrigins: string[] };
type Env = Record<string, string | undefined>;

// The vendor's connection portal, the only page the app frames (the S3 dialog). The vendor returns the portal URL per
// session (lib/broker.ts#connectUrl) on its own portal host; VENDOR_PORTAL_ORIGIN overrides the default (https only).
// A minted URL that these sources do not cover is never framed: /connect/portal answers mode 'redirect' for it.
// ponytail: the vendor's exact portal host is not confirmed, so the default also allows any https subdomain of the
// vendor's domain — confirm the host against a live minted URL, then set VENDOR_PORTAL_ORIGIN (or narrow this default).
export const VENDOR_PORTAL_ORIGINS = ['https://app.snaptrade.com', 'https://*.snaptrade.com'] as const;
const originOf = (u: string | undefined) => { try { return u ? new URL(u) : null; } catch { return null; } };
export function portalFrameOrigins(env: Env = process.env): string[] {
  const o = originOf(env.VENDOR_PORTAL_ORIGIN);
  const out: string[] = o && o.protocol === 'https:' ? [o.origin] : [...VENDOR_PORTAL_ORIGINS];
  const fake = originOf(env.SNAPTRADE_BASE_URL); // the loopback test fake serves its portal on its own origin
  if (fake && fake.origin !== 'null') out.push(fake.origin);
  return out;
}
// Whether a frame-src source list covers an origin, as the browser decides it: an exact origin, or `https://*.domain`
// for any subdomain of domain over https on the default port (never the bare domain).
export function frameAllowed(origin: string, sources: string[]): boolean {
  const u = originOf(origin);
  if (!u) return false;
  return sources.some((src) => {
    const m = src.match(/^https:\/\/\*\.([a-z0-9.-]+)$/i);
    if (!m) return src === u.origin;
    return u.protocol === 'https:' && u.port === '' && u.hostname.toLowerCase().endsWith(`.${m[1].toLowerCase()}`);
  });
}

// Scripts only from this origin with this request's nonce ('strict-dynamic': Next's own chunks load from those);
// styles allow inline (React style attributes). Frames: the vendor portal only. No form-action: the provider sign-in
// form's redirect goes to whichever authorization endpoint is configured.
export function contentSecurityPolicy(i: CspInput): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${i.nonce}' 'strict-dynamic'${i.dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${i.frameOrigins.length ? i.frameOrigins.join(' ') : "'none'"}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    ...(i.https && !i.dev ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

// HSTS on the production deployment only (never a preview, which may share a parent domain): Vercel's production
// environment, or off Vercel a production server whose public site is https. No includeSubDomains: the app does not
// own every subdomain's transport.
export function hstsWanted(env: Env = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === 'production';
  return env.NODE_ENV === 'production' && (env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://');
}

// Every response. The CSP here (framing only) covers what proxy.ts does not run on; on pages the proxy's full policy
// replaces it. Camera and the like are off; web-share and clipboard-write stay on (the share button). The opener
// policy keeps the vendor portal's broker popup working.
export function securityHeaders(hsts: boolean): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    ...(hsts ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }] : []),
  ];
}
