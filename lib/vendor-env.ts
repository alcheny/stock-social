// Committee fix (Medium, §10): SNAPTRADE_BASE_URL points the vendor SDK at the in-repo fake (e2e/fakes/vendor.ts) and is
// for tests only. In production it would send signed requests and vendor secrets to that host, so a production server
// refuses to start with it set (instrumentation.ts). The one override is the production test build the e2e suite runs:
// ALLOW_DEV_AUTH=1 (already the marker of a test build, lib/session.ts) AND a loopback URL, never another machine.
export type Env = Record<string, string | undefined>;

export class VendorBaseUrlError extends Error {
  constructor() { super('SNAPTRADE_BASE_URL is for tests only and must not be set in production.'); }
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
export function isLoopbackUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (u.protocol === 'http:' || u.protocol === 'https:') && LOOPBACK.has(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function assertVendorBaseUrl(env: Env = process.env): void {
  const url = env.SNAPTRADE_BASE_URL;
  if (!url || env.NODE_ENV !== 'production' || env.NEXT_PHASE === 'phase-production-build') return;
  if (env.ALLOW_DEV_AUTH === '1' && isLoopbackUrl(url)) return;
  throw new VendorBaseUrlError();
}
