// F-1 PR-2b, S3 (docs/features/logs/F-1/plan.md §2): the embedded portal's message protocol, origin-checked; the portal
// URL the server accepts from the vendor; which browsers go straight to the redirect flow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { framingAllowed, parsePortalMessage, portalOrigin, portalTarget, portalView, prefersRedirect, PORTAL_BLANK_MS, PORTAL_CONTINUE, PORTAL_DONE, PORTAL_LINK_MS, PORTAL_MINT_GRACE_MS, PORTAL_REDIRECT, PORTAL_SLOW_MS, type PortalFlags } from './portal.ts';
import { clearProbeCache, probePortalMode, PROBE_FAIL_TTL_MS, PROBE_TIMEOUT_MS, PROBE_TTL_MS } from './portal-probe.ts';

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

test('fix round 1 (G5): a counted message only ever picks one of two fixed same-origin paths; an ERROR carrying a URL anywhere still goes to the redirect flow', () => {
  assert.equal(PORTAL_REDIRECT, '/connect/start');
  assert.equal(PORTAL_DONE, '/connect/done?m=embedded');
  assert.equal(PORTAL_CONTINUE, '/connect/continue'); // fix round 2: the explained step before PORTAL_REDIRECT
  const lure = 'https://evil.test/steal';
  const errors: unknown[] = [
    { status: 'ERROR', redirect: lure, url: lure, errorCode: lure, detail: lure },
    { status: 'ERROR', errorCode: 'POPUP_BLOCKED', redirectURI: lure },
    `ERROR:${lure}`, 'ERROR:javascript:alert(1)', 'ERROR:/\\evil.test',
  ];
  for (const data of errors) {
    const m = parsePortalMessage({ origin: VENDOR, data }, VENDOR)!;
    assert.equal(m.kind, 'error', JSON.stringify(data));
    assert.ok(!String((m as { code: string | null }).code).includes('evil') && !String((m as { code: string | null }).code).includes(':'), JSON.stringify(data)); // a URL is dropped, never carried
    assert.equal(portalTarget(m), PORTAL_CONTINUE); // fix round 2: the one-line explanation, then the redirect flow
  }
  for (const data of [{ status: 'SUCCESS', authorizationId: lure, url: lure }, `SUCCESS:${lure}`, 'CLOSED', { status: 'ABANDONED', redirect: lure }]) {
    assert.equal(portalTarget(parsePortalMessage({ origin: VENDOR, data }, VENDOR)!), PORTAL_DONE, JSON.stringify(data));
  }
});

test('fix round 1 (tester defect 1) as amended by fix round 2 (business lead 1, UX lead 1): before load the 3 s line and the 8 s filled primary; a loaded portal never shows the slow line or a filled primary; silent 8 s after load, or an error: the quiet "page blank" line beside the secondary button; a handshake clears it', () => {
  const f = (o: Partial<PortalFlags>): PortalFlags => ({ loaded: false, handshake: false, slow: false, promoted: false, stuck: false, errored: false, ...o });
  assert.equal(PORTAL_BLANK_MS, 8_000);
  assert.equal(PORTAL_MINT_GRACE_MS, 1_000);
  // Loading, unchanged: "Opening…", the 3 s line, the 8 s promotion to the filled primary.
  assert.deepEqual(portalView(f({})), { line: 'opening', control: 'link' });
  assert.deepEqual(portalView(f({ slow: true })), { line: 'opening-slow', control: 'link' });
  assert.deepEqual(portalView(f({ slow: true, promoted: true })), { line: 'opening-slow', control: 'primary' });
  // Loaded: never the slow line, never the filled primary, whatever the timers say.
  const loadedCases: Partial<PortalFlags>[] = [{}, { slow: true }, { promoted: true }, { slow: true, promoted: true }, { stuck: true }, { slow: true, promoted: true, stuck: true }, { errored: true }];
  for (const o of loadedCases) {
    const v = portalView(f({ ...o, loaded: true }));
    assert.notEqual(v.line, 'opening-slow', JSON.stringify(o));
    assert.notEqual(v.control, 'primary', JSON.stringify(o));
  }
  assert.deepEqual(portalView(f({ loaded: true })), { line: null, control: 'link' });
  assert.deepEqual(portalView(f({ loaded: true, slow: true, promoted: true })), { line: null, control: 'secondary' }); // promoted while loading: the secondary button
  // Silent for 8 s after the load (a working portal waiting for the trader, or a refused frame): the quiet line.
  assert.deepEqual(portalView(f({ loaded: true, stuck: true })), { line: 'blank', control: 'secondary' });
  assert.deepEqual(portalView(f({ errored: true })), { line: 'blank', control: 'secondary' });
  assert.deepEqual(portalView(f({ loaded: true, errored: true })), { line: 'blank', control: 'secondary' });
  for (const o of [{ loaded: true, stuck: true }, { loaded: true, slow: true, promoted: true, stuck: true }, { loaded: true }]) {
    assert.deepEqual(portalView(f({ ...o, handshake: true })), { line: null, control: 'link' }, JSON.stringify(o));
  }
});

test('fix round 2 (business lead 1): framing headers decide embedded or redirect: X-Frame-Options DENY/SAMEORIGIN, CSP frame-ancestors (which wins when present, every policy must allow)', () => {
  const APP = 'https://app.example', P = VENDOR;
  const ok = (xfo: string | null, csp: string | null, app = APP) => framingAllowed({ xfo, csp }, app, P);
  assert.equal(ok(null, null), true);
  assert.equal(ok('DENY', null), false);
  assert.equal(ok('deny', null), false);
  assert.equal(ok('SAMEORIGIN', null), false);
  assert.equal(ok('SAMEORIGIN', null, P), true);
  assert.equal(ok('ALLOW-FROM https://app.example', null), true); // obsolete: browsers ignore it
  assert.equal(ok(null, "frame-ancestors 'none'"), false);
  assert.equal(ok(null, "default-src 'self'; frame-ancestors 'self'"), false);
  assert.equal(ok(null, "frame-ancestors 'self'", P), true);
  assert.equal(ok(null, 'frame-ancestors *'), true);
  assert.equal(ok(null, 'frame-ancestors https:'), true);
  assert.equal(ok(null, 'frame-ancestors https://app.example'), true);
  assert.equal(ok(null, 'frame-ancestors https://app.example:443/'), true);
  assert.equal(ok(null, 'frame-ancestors https://other.example'), false);
  assert.equal(ok(null, 'frame-ancestors https://*.example'), true);
  assert.equal(ok(null, 'frame-ancestors https://*.app.example'), false); // a wildcard needs a subdomain
  assert.equal(ok(null, 'frame-ancestors app.example'), true); // scheme from the portal (https)
  assert.equal(ok(null, 'frame-ancestors https://app.example:8443'), false);
  assert.equal(ok(null, "frame-ancestors 'none'", 'http://localhost:3000'), false);
  assert.equal(ok(null, 'frame-ancestors http://localhost:3000', 'http://localhost:3000'), true);
  // frame-ancestors present: X-Frame-Options is ignored (as browsers do).
  assert.equal(ok('DENY', 'frame-ancestors https://app.example'), true);
  // Two policies: both must allow.
  assert.equal(ok(null, "frame-ancestors https://app.example, frame-ancestors 'none'"), false);
  // A CSP without frame-ancestors falls back to X-Frame-Options.
  assert.equal(ok('DENY', "default-src 'self'"), false);
  assert.equal(ok(null, "default-src 'none'"), true);
});

test('fix round 2 (business lead 1): the server probe is one HEAD without credentials, cached per vendor origin for an hour; a failure or timeout means embedded, retried after 5 minutes', async () => {
  assert.equal(PROBE_TIMEOUT_MS, 1_500);
  assert.equal(PROBE_TTL_MS, 3_600_000);
  assert.equal(PROBE_FAIL_TTL_MS, 300_000);
  clearProbeCache();
  let t = 0;
  const calls: { url: string; init: RequestInit }[] = [];
  let headers: Record<string, string> = { 'x-frame-options': 'DENY' };
  let fail = false;
  const fetch = async (url: string, init: RequestInit) => { calls.push({ url, init }); if (fail) throw new Error('down'); return { headers: new Headers(headers) }; };
  const probe = (url = `${VENDOR}/redeem?t=1`) => probePortalMode(url, VENDOR, 'https://app.example', { fetch, now: () => t });
  assert.equal(await probe(), 'redirect');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'HEAD');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.ok(calls[0].init.signal);
  headers = {};
  t = PROBE_TTL_MS - 1;
  assert.equal(await probe(`${VENDOR}/redeem?t=2`), 'redirect'); // cached per origin, whatever the URL
  assert.equal(calls.length, 1);
  t = PROBE_TTL_MS;
  assert.equal(await probe(), 'embedded'); // expired: asked again
  assert.equal(calls.length, 2);
  // A failure means embedded, cached for 5 minutes only.
  clearProbeCache();
  fail = true; headers = { 'content-security-policy': "frame-ancestors 'none'" };
  assert.equal(await probe(), 'embedded');
  fail = false;
  t += PROBE_FAIL_TTL_MS - 1;
  assert.equal(await probe(), 'embedded');
  t += 1;
  assert.equal(await probe(), 'redirect');
  // A real timeout: a fetch that never answers is aborted and counts as embedded.
  clearProbeCache();
  const hang = (_u: string, init: RequestInit) => new Promise<{ headers: Headers }>((_, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))));
  const t0 = Date.now();
  assert.equal(await probePortalMode(`${VENDOR}/x`, VENDOR, 'https://app.example', { fetch: hang, timeoutMs: 50 }), 'embedded');
  assert.ok(Date.now() - t0 < 1_000);
  clearProbeCache();
});
