// Security hardening (2026-11-01), F27: the Content-Security-Policy (per-request nonce, set in proxy.ts) and the static
// security headers (next.config.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentSecurityPolicy, securityHeaders } from './csp.ts';

const parse = (csp: string) => new Map(csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v] as const; }));

test('CSP: nonce-based strict-dynamic scripts, no inline script, framing refused, portal frames allowed', () => {
  const p = parse(contentSecurityPolicy({ nonce: 'abc123', dev: false, https: true, vendorBaseUrl: null }));
  assert.deepEqual(p.get('default-src'), ["'self'"]);
  assert.deepEqual(p.get('script-src'), ["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
  assert.deepEqual(p.get('style-src'), ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(p.get('img-src'), ["'self'", 'data:', 'blob:']);
  assert.deepEqual(p.get('font-src'), ["'self'"]);
  assert.deepEqual(p.get('connect-src'), ["'self'"]);
  assert.deepEqual(p.get('frame-src'), ['https:']);
  assert.deepEqual(p.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(p.get('base-uri'), ["'none'"]);
  assert.deepEqual(p.get('object-src'), ["'none'"]);
  assert.deepEqual(p.get('upgrade-insecure-requests'), []);
  assert.equal(p.has('form-action'), false); // the provider sign-in form redirects to any configured authorization endpoint
  assert.equal(p.get('script-src')!.includes("'unsafe-inline'"), false);
});

test('CSP: unsafe-eval only in development; upgrade-insecure-requests only on https; the test vendor origin may be framed', () => {
  const dev = parse(contentSecurityPolicy({ nonce: 'n', dev: true, https: false, vendorBaseUrl: 'http://127.0.0.1:4102/api' }));
  assert.ok(dev.get('script-src')!.includes("'unsafe-eval'"));
  assert.equal(dev.has('upgrade-insecure-requests'), false);
  assert.deepEqual(dev.get('frame-src'), ['https:', 'http://127.0.0.1:4102']);
  const bad = parse(contentSecurityPolicy({ nonce: 'n', dev: false, https: false, vendorBaseUrl: 'not a url' }));
  assert.deepEqual(bad.get('frame-src'), ['https:']);
  assert.equal(bad.get('script-src')!.includes("'unsafe-eval'"), false);
});

test('static headers: nosniff, referrer policy, permissions (share and clipboard left on), COOP allowing the portal popup, no framing, HSTS in production only', () => {
  const h = (prod: boolean) => new Map(securityHeaders(prod).map((x) => [x.key, x.value]));
  const prod = h(true);
  assert.equal(prod.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(prod.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(prod.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
  assert.doesNotMatch(prod.get('Permissions-Policy')!, /web-share|clipboard-write/);
  assert.equal(prod.get('Cross-Origin-Opener-Policy'), 'same-origin-allow-popups');
  assert.equal(prod.get('X-Frame-Options'), 'DENY');
  assert.equal(prod.get('Content-Security-Policy'), "frame-ancestors 'none'");
  assert.equal(prod.get('Strict-Transport-Security'), 'max-age=63072000; includeSubDomains');
  assert.equal(h(false).has('Strict-Transport-Security'), false);
});

test('next.config.ts uses the static headers; proxy.ts sets the nonce CSP on request and response and skips static files', () => {
  const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.match(config, /securityHeaders\(/);
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
  assert.match(proxy, /export function proxy\(/);
  assert.match(proxy, /contentSecurityPolicy\(/);
  assert.match(proxy, /requestHeaders\.set\('Content-Security-Policy'/);
  assert.match(proxy, /response\.headers\.set\('Content-Security-Policy'/);
  assert.match(proxy, /_next\/static\|_next\/image\|favicon\.ico/);
});
