// Security hardening (2026-11-01), F27: the app's security headers. Pure, so node:test covers them; proxy.ts sets the
// CSP per request (its nonce), next.config.ts the static headers.

export type CspInput = { nonce: string; dev: boolean; https: boolean; vendorBaseUrl: string | null | undefined };

// Scripts only from this origin with this request's nonce ('strict-dynamic': Next's own chunks load from those);
// styles allow inline (React style attributes). The vendor portal is framed (https, or the loopback test fake). No
// form-action: the provider sign-in form's redirect goes to whichever authorization endpoint is configured.
export function contentSecurityPolicy(i: CspInput): string {
  let vendor: string | null = null;
  try { vendor = i.vendorBaseUrl ? new URL(i.vendorBaseUrl).origin : null; } catch { vendor = null; }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${i.nonce}' 'strict-dynamic'${i.dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src https:${vendor && vendor !== 'null' ? ` ${vendor}` : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    ...(i.https && !i.dev ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

// Every response. The CSP here (framing only) covers what proxy.ts does not run on; on pages the proxy's full policy
// replaces it. Camera and the like are off; web-share and clipboard-write stay on (the share button). The opener
// policy keeps the vendor portal's broker popup working.
export function securityHeaders(production: boolean): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    ...(production ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
  ];
}
