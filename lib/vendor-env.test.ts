// Committee fix (Medium): SNAPTRADE_BASE_URL never reaches a production server, except the e2e production test build
// (ALLOW_DEV_AUTH=1 and a loopback URL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertVendorBaseUrl, isLoopbackUrl, VendorBaseUrlError } from './vendor-env.ts';

test('SNAPTRADE_BASE_URL: production refuses it; only a loopback URL on a test build (ALLOW_DEV_AUTH=1) is allowed', () => {
  const prod = { NODE_ENV: 'production' };
  assert.throws(() => assertVendorBaseUrl({ ...prod, SNAPTRADE_BASE_URL: 'https://vendor.example' }), VendorBaseUrlError);
  assert.throws(() => assertVendorBaseUrl({ ...prod, SNAPTRADE_BASE_URL: 'http://127.0.0.1:4102' }), VendorBaseUrlError);
  assert.throws(() => assertVendorBaseUrl({ ...prod, ALLOW_DEV_AUTH: '1', SNAPTRADE_BASE_URL: 'https://vendor.example' }), VendorBaseUrlError);
  assert.throws(() => assertVendorBaseUrl({ ...prod, ALLOW_DEV_AUTH: '1', SNAPTRADE_BASE_URL: 'http://127.0.0.1.attacker.example' }), VendorBaseUrlError);
  assert.throws(() => assertVendorBaseUrl({ ...prod, ALLOW_DEV_AUTH: '1', SNAPTRADE_BASE_URL: 'http://user:pw@127.0.0.1:4102' }), VendorBaseUrlError);
  assert.throws(() => assertVendorBaseUrl({ ...prod, ALLOW_DEV_AUTH: 'true', SNAPTRADE_BASE_URL: 'http://127.0.0.1:4102' }), VendorBaseUrlError);
  assert.doesNotThrow(() => assertVendorBaseUrl({ ...prod, ALLOW_DEV_AUTH: '1', SNAPTRADE_BASE_URL: 'http://127.0.0.1:4102' }));
  assert.doesNotThrow(() => assertVendorBaseUrl({ ...prod, ALLOW_DEV_AUTH: '1', SNAPTRADE_BASE_URL: 'http://localhost:4102' }));
  assert.doesNotThrow(() => assertVendorBaseUrl(prod)); // unset: the SDK's own host
  assert.doesNotThrow(() => assertVendorBaseUrl({ ...prod, SNAPTRADE_BASE_URL: '' }));
  assert.doesNotThrow(() => assertVendorBaseUrl({ NODE_ENV: 'development', SNAPTRADE_BASE_URL: 'https://vendor.example' }));
  assert.doesNotThrow(() => assertVendorBaseUrl({ NODE_ENV: 'test', SNAPTRADE_BASE_URL: 'http://127.0.0.1:4102' }));
  assert.doesNotThrow(() => assertVendorBaseUrl({ ...prod, NEXT_PHASE: 'phase-production-build', SNAPTRADE_BASE_URL: 'https://vendor.example' }));
  assert.equal(isLoopbackUrl('not a url'), false);
  assert.equal(isLoopbackUrl('ftp://127.0.0.1'), false);
  assert.equal(isLoopbackUrl('http://[::1]:4102'), true);
});

test('the check runs at server startup: instrumentation.ts calls it from register()', () => {
  const src = readFileSync(new URL('../instrumentation.ts', import.meta.url), 'utf8');
  assert.match(src, /export (async )?function register\(/);
  assert.match(src, /assertVendorBaseUrl\(\)/);
});
