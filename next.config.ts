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
    }];
  },
};
export default config;
