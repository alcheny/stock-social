// F-1 PR-2b, S3 (docs/features/logs/F-1/plan.md §2): the embedded portal's message protocol, origin-checked; the portal
// URL the server accepts from the vendor; which browsers go straight to the redirect flow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePortalMessage, portalOrigin, prefersRedirect, PORTAL_LINK_MS, PORTAL_SLOW_MS } from './portal.ts';

const VENDOR = 'https://portal.vendor.test';

test('portal messages: the four events in both of the vendor\'s formats, from the portal origin only', () => {
  const m = (data: unknown, origin = VENDOR) => parsePortalMessage({ origin, data }, VENDOR);
  assert.deepEqual(m({ status: 'SUCCESS', authorizationId: 'auth-1' }), { kind: 'success', authorizationId: 'auth-1' });
  assert.deepEqual(m('SUCCESS:auth-2'), { kind: 'success', authorizationId: 'auth-2' });
  assert.deepEqual(m('SUCCESS'), { kind: 'success', authorizationId: null });
  assert.deepEqual(m({ status: 'ERROR', errorCode: 'POPUP_BLOCKED', detail: 'x' }), { kind: 'error', code: 'POPUP_BLOCKED' });
  assert.deepEqual(m('ERROR:1010'), { kind: 'error', code: '1010' });
  assert.deepEqual(m({ status: 'ERROR' }), { kind: 'error', code: null });
  assert.deepEqual(m('CLOSED'), { kind: 'closed' });
  assert.deepEqual(m('CLOSE_MODAL'), { kind: 'closed' });
  assert.deepEqual(m({ status: 'CLOSED' }), { kind: 'closed' });
  assert.deepEqual(m('ABANDONED'), { kind: 'abandoned' });
  assert.deepEqual(m({ status: 'ABANDONED' }), { kind: 'abandoned' });
});

test('portal messages: any other origin, a missing expected origin, or an unknown shape is ignored', () => {
  for (const origin of ['https://evil.test', 'http://portal.vendor.test', 'https://portal.vendor.test.evil.test', 'null', '', 'https://portal.vendor.test:444']) {
    assert.equal(parsePortalMessage({ origin, data: { status: 'SUCCESS', authorizationId: 'a' } }, VENDOR), null, origin);
  }
  assert.equal(parsePortalMessage({ origin: VENDOR, data: 'SUCCESS' }, null), null);
  assert.equal(parsePortalMessage({ origin: VENDOR, data: 'SUCCESS' }, ''), null);
  for (const data of [null, undefined, 42, {}, [], { status: 7 }, 'HELLO', { status: 'REDIRECT', url: 'https://evil.test' }, 'success-ish']) {
    assert.equal(parsePortalMessage({ origin: VENDOR, data }, VENDOR), null, JSON.stringify(data));
  }
  // An id is a short opaque token or nothing: a long or odd value is dropped, never carried anywhere.
  assert.deepEqual(parsePortalMessage({ origin: VENDOR, data: { status: 'SUCCESS', authorizationId: 'x'.repeat(200) } }, VENDOR), { kind: 'success', authorizationId: null });
  assert.deepEqual(parsePortalMessage({ origin: VENDOR, data: { status: 'SUCCESS', authorizationId: 'javascript:alert(1)' } }, VENDOR), { kind: 'success', authorizationId: null });
});

test('portal URL: the server only embeds an https vendor URL; loopback http only for the test fake', () => {
  assert.equal(portalOrigin('https://portal.vendor.test/redeem?token=abc', { allowLoopback: false }), VENDOR);
  assert.equal(portalOrigin('http://portal.vendor.test/redeem', { allowLoopback: false }), null);
  assert.equal(portalOrigin('http://127.0.0.1:4102/portal?u=x', { allowLoopback: false }), null);
  assert.equal(portalOrigin('http://127.0.0.1:4102/portal?u=x', { allowLoopback: true }), 'http://127.0.0.1:4102');
  assert.equal(portalOrigin('http://vendor.test/portal', { allowLoopback: true }), null);
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', '/relative', '', 'https://user:pw@portal.vendor.test/']) assert.equal(portalOrigin(bad, { allowLoopback: true }), null, bad);
});

test('in-app browsers and installed (standalone) apps go straight to the redirect flow; ordinary browsers embed', () => {
  const androidWebView = 'Mozilla/5.0 (Linux; Android 14; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36';
  const iosWebView = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  const iosWebViewWithAppToken = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SomeApp 300.0.0';
  const iosBrowser = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const androidBrowser = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  const desktop = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  assert.equal(prefersRedirect(androidWebView), true);
  assert.equal(prefersRedirect(iosWebView), true);
  assert.equal(prefersRedirect(iosWebViewWithAppToken), true);
  assert.equal(prefersRedirect(iosBrowser), false);
  assert.equal(prefersRedirect(androidBrowser), false);
  assert.equal(prefersRedirect(desktop), false);
  assert.equal(prefersRedirect(desktop, true), true); // installed to the home screen: no popups
  assert.equal(prefersRedirect(''), false);
});

test('loading timings are the UX lead\'s: 3 s "Taking longer than usual.", 8 s the link is promoted', () => {
  assert.equal(PORTAL_SLOW_MS, 3_000);
  assert.equal(PORTAL_LINK_MS, 8_000);
});
