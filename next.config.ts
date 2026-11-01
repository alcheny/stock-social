import type { NextConfig } from 'next';
import { hstsWanted, securityHeaders } from './lib/csp.ts';

// F-1 PR-2b fix round 2 (engineer, Low): no page of the app may be framed by another site (clickjacking on /connect,
// consent and settings). Both headers, for browsers that only know one of them. The vendor's portal the app frames is
// the vendor's page, unaffected. Security hardening (2026-11-01), F27: the static security headers (lib/csp.ts); the
// pages' full Content-Security-Policy, with its per-request nonce, is set in proxy.ts.
const config: NextConfig = {
  // F4-6 half (1) (cycle 4, C4-3): lib/moderation.ts imports the scanner's word list from scripts/compliance.ts, whose
  // file reads make the tracer copy docs/, e2e/, team/ and the root Markdown into every route with a server action
  // (130-160 MB each). No route reads them at run time. Keys match every route (picomatch, `contains`); values are
  // anchored at the project root, so node_modules and lib/ keep their files. Pinned by lib/trace-excludes-f4-6.test.ts.
  // ponytail: the scanner itself still rides along (scripts/compliance.ts is protected) — half (2) moves the word list
  // to its own lib/ module (owner, Q7).
  outputFileTracingExcludes: {
    '/**': ['./docs/**', './e2e/**', './team/**', './*.md'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders(hstsWanted()) },
    // F-3 (committee K6): Record tools, the account page and the data export are private: never indexed, cached by a
    // shared cache or sent as a referrer. Listed after the site-wide headers, so their Referrer-Policy wins there.
    ...['/tools', '/account', '/account/:path*'].map((source) => ({
      source,
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Cache-Control', value: 'private, no-store' },
      ],
    }))];
  },
};
export default config;
