// Security hardening (2026-11-01), F27: the Content-Security-Policy (per-request nonce, set in proxy.ts) and the static
// security headers (next.config.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentSecurityPolicy, hstsWanted, portalFrameOrigins, securityHeaders, VENDOR_PORTAL_ORIGIN } from './csp.ts';

const parse = (csp: string) => new Map(csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v] as const; }));

test('CSP: nonce-based strict-dynamic scripts, no inline script, framing refused, only the vendor portal framed', () => {
  const p = parse(contentSecurityPolicy({ nonce: 'abc123', dev: false, https: true, frameOrigins: [VENDOR_PORTAL_ORIGIN] }));
  assert.deepEqual(p.get('default-src'), ["'self'"]);
  assert.deepEqual(p.get('script-src'), ["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
  assert.deepEqual(p.get('style-src'), ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(p.get('img-src'), ["'self'", 'data:', 'blob:']);
  assert.deepEqual(p.get('font-src'), ["'self'"]);
  assert.deepEqual(p.get('connect-src'), ["'self'"]);
  assert.deepEqual(p.get('frame-src'), ['https://app.snaptrade.com']);
  assert.deepEqual(p.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(p.get('base-uri'), ["'none'"]);
  assert.deepEqual(p.get('object-src'), ["'none'"]);
  assert.deepEqual(p.get('upgrade-insecure-requests'), []);
  assert.equal(p.has('form-action'), false); // the provider sign-in form redirects to any configured authorization endpoint
  assert.equal(p.get('script-src')!.includes("'unsafe-inline'"), false);
  assert.deepEqual(parse(contentSecurityPolicy({ nonce: 'n', dev: false, https: false, frameOrigins: [] })).get('frame-src'), ["'none'"]);
});

test('CSP: unsafe-eval only in development; upgrade-insecure-requests only on https', () => {
  const dev = parse(contentSecurityPolicy({ nonce: 'n', dev: true, https: false, frameOrigins: ['http://127.0.0.1:4102'] }));
  assert.ok(dev.get('script-src')!.includes("'unsafe-eval'"));
  assert.equal(dev.has('upgrade-insecure-requests'), false);
  assert.deepEqual(dev.get('frame-src'), ['http://127.0.0.1:4102']);
  const prod = parse(contentSecurityPolicy({ nonce: 'n', dev: false, https: false, frameOrigins: [VENDOR_PORTAL_ORIGIN] }));
  assert.equal(prod.get('script-src')!.includes("'unsafe-eval'"), false);
});

test('portalFrameOrigins: the vendor portal origin (VENDOR_PORTAL_ORIGIN overrides, https only), plus the loopback test fake when SNAPTRADE_BASE_URL is set', () => {
  assert.deepEqual(portalFrameOrigins({}), ['https://app.snaptrade.com']);
  assert.deepEqual(portalFrameOrigins({ VENDOR_PORTAL_ORIGIN: 'https://portal.vendor.example/some/path' }), ['https://portal.vendor.example']);
  assert.deepEqual(portalFrameOrigins({ VENDOR_PORTAL_ORIGIN: 'http://portal.vendor.example' }), ['https://app.snaptrade.com']); // never plain http
  assert.deepEqual(portalFrameOrigins({ VENDOR_PORTAL_ORIGIN: 'not a url' }), ['https://app.snaptrade.com']);
  assert.deepEqual(portalFrameOrigins({ SNAPTRADE_BASE_URL: 'http://127.0.0.1:4102/api' }), ['https://app.snaptrade.com', 'http://127.0.0.1:4102']);
  assert.deepEqual(portalFrameOrigins({ SNAPTRADE_BASE_URL: 'garbage' }), ['https://app.snaptrade.com']);
});

test('HSTS only on the production deployment (no includeSubDomains): Vercel production, or off Vercel a production server on an https site; never a preview', () => {
  assert.equal(hstsWanted({ VERCEL_ENV: 'production', NODE_ENV: 'production' }), true);
  assert.equal(hstsWanted({ VERCEL_ENV: 'preview', NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://preview.example' }), false);
  assert.equal(hstsWanted({ VERCEL_ENV: 'development', NODE_ENV: 'production' }), false);
  assert.equal(hstsWanted({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://app.example' }), true);
  assert.equal(hstsWanted({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }), false);
  assert.equal(hstsWanted({ NODE_ENV: 'production' }), false); // e2e: a production build over http
  assert.equal(hstsWanted({ NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: 'https://app.example' }), false);
});

test('static headers: nosniff, referrer policy, permissions (share and clipboard left on), COOP allowing the portal popup, no framing, HSTS when wanted', () => {
  const h = (hsts: boolean) => new Map(securityHeaders(hsts).map((x) => [x.key, x.value]));
  const prod = h(true);
  assert.equal(prod.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(prod.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(prod.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
  assert.doesNotMatch(prod.get('Permissions-Policy')!, /web-share|clipboard-write/);
  assert.equal(prod.get('Cross-Origin-Opener-Policy'), 'same-origin-allow-popups');
  assert.equal(prod.get('X-Frame-Options'), 'DENY');
  assert.equal(prod.get('Content-Security-Policy'), "frame-ancestors 'none'");
  assert.equal(prod.get('Strict-Transport-Security'), 'max-age=63072000');
  assert.equal(h(false).has('Strict-Transport-Security'), false);
});

test('the portal route forces the redirect flow for a portal origin the CSP would not let the page frame', () => {
  const route = readFileSync(new URL('../app/connect/portal/route.ts', import.meta.url), 'utf8');
  assert.match(route, /portalFrameOrigins\(\)\.includes\(o\)/);
});

test('next.config.ts uses the static headers; proxy.ts sets the nonce CSP on request and response and skips static files', () => {
  const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.match(config, /securityHeaders\(hstsWanted\(\)\)/);
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
  assert.match(proxy, /export function proxy\(/);
  assert.match(proxy, /contentSecurityPolicy\(/);
  assert.match(proxy, /frameOrigins: portalFrameOrigins\(\)/);
  assert.match(proxy, /requestHeaders\.set\('Content-Security-Policy'/);
  assert.match(proxy, /response\.headers\.set\('Content-Security-Policy'/);
  assert.match(proxy, /_next\/static\|_next\/image\|favicon\.ico/);
});
