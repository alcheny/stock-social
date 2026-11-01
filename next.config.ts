import type { NextConfig } from 'next';
import { securityHeaders } from './lib/csp.ts';

// F-1 PR-2b fix round 2 (engineer, Low): no page of the app may be framed by another site (clickjacking on /connect,
// consent and settings). Both headers, for browsers that only know one of them. The vendor's portal the app frames is
// the vendor's page, unaffected. Security hardening (2026-11-01), F27: the static security headers (lib/csp.ts); the
// pages' full Content-Security-Policy, with its per-request nonce, is set in proxy.ts.
const config: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders(process.env.NODE_ENV === 'production') }];
  },
};
export default config;
