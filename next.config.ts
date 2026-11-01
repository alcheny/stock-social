import type { NextConfig } from 'next';

// F-1 PR-2b fix round 2 (engineer, Low): no page of the app may be framed by another site (clickjacking on /connect,
// consent and settings). Both headers, for browsers that only know one of them. The vendor's portal the app frames is
// the vendor's page, unaffected.
const config: NextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    },
    // F-3 (committee K6): Record tools, the account page and the data export are private: never indexed, cached by a
    // shared cache or sent as a referrer.
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
