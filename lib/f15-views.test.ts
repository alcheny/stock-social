// F-15 · the view counter's pure parts and the beacon route's logic with injected writers (lib/views-shared.ts,
// lib/views.ts, lib/views-route.ts): referrer stored only as a class, closed registry, bot filter, rate cap, a failing
// write never surfaces, and nothing about the user agent, address or rate key is logged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MARKS } from '../scripts/compliance.ts';
import { REF_CLASSES, botReason, parseBeacon, rateLimited, refClass, surfaceOf, RATE_MAX, type ViewKey } from './views.ts';
import { handleBeacon, type BeaconDeps } from './views-route.ts';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const hdrs = (o: Record<string, string | null> = {}) => {
  const base: Record<string, string | null> = { 'user-agent': UA, 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', origin: 'http://app.test', host: 'app.test', ...o };
  const h = new Headers();
  for (const [k, v] of Object.entries(base)) if (v !== null) h.set(k, v);
  return h;
};

test('F-15 surfaceOf: the counted surfaces, record handles, and nothing else', () => {
  assert.deepEqual(surfaceOf('/'), { surface: 'feed', handle: null, detail: null });
  assert.deepEqual(surfaceOf('/u/maya'), { surface: 'profile', handle: 'maya', detail: null });
  for (const p of ['/u/Maya', '/u/%20maya', '/u/maya%20', '/u/MAYA/trade/x', '/u/Maya/month/2026-10']) assert.equal(surfaceOf(p), null, p); // the pages 404
  assert.deepEqual(surfaceOf('/u/maya/trade/abc%2F1'), { surface: 'trade', handle: 'maya', detail: 'abc/1' });
  assert.deepEqual(surfaceOf('/u/maya/month/2026-10'), { surface: 'month', handle: 'maya', detail: '2026-10' });
  assert.equal(surfaceOf('/t/AAPL')?.surface, 'ticker');
  assert.equal(surfaceOf('/t/compare')?.surface, 'compare');
  assert.equal(surfaceOf('/how')?.surface, 'how');
  assert.equal(surfaceOf('/login?ref=a')?.surface, 'login');
  for (const p of ['/me', '/settings', '/u/maya/story', '/u/maya/month/2026-13', '/u/maya/month/x', '/u/a', '/u/maya/trade/a%00b', 'u/maya', '', 3, null, '/u/' + 'a'.repeat(300), '/api/views', '/connect']) {
    assert.equal(surfaceOf(p), null, String(p));
  }
});

test('F-15 refClass: only the referrer origin is compared; the result is one of three classes', () => {
  assert.equal(refClass('', 'https://app.test'), 'none');
  assert.equal(refClass('https://app.test/u/maya?via=card', 'https://app.test'), 'internal');
  assert.equal(refClass('https://elsewhere.example/some/long/path?with=query&and=ids', 'https://app.test'), 'external');
  assert.equal(refClass('not a url', 'https://app.test'), 'none');
  for (const r of ['', 'x', 'https://a.example', 'https://app.test/']) assert.ok((REF_CLASSES as readonly string[]).includes(refClass(r, 'https://app.test')));
});

test('F-15 parseBeacon: a full referrer URL is never accepted as the class; via is reduced to the registry', () => {
  assert.equal(parseBeacon(JSON.stringify({ path: '/u/maya', ref: 'https://elsewhere.example/x' })), null);
  assert.equal(parseBeacon(JSON.stringify({ path: '/u/maya', ref: 'EXTERNAL' })), null);
  assert.equal(parseBeacon('not json'), null);
  assert.equal(parseBeacon('[]'), null);
  assert.deepEqual(parseBeacon(JSON.stringify({ path: '/u/maya', ref: 'external', via: 'inv_bob', auto: 'yes' })), { path: '/u/maya', ref: 'external', via: 'none', auto: false });
  assert.deepEqual(parseBeacon(JSON.stringify({ path: '/', ref: 'none', via: 'card', auto: true, extra: 'dropped' })), { path: '/', ref: 'none', via: 'card', auto: true });
});

test('F-15 botReason: declared or non-browser agents, no fetch metadata at all, and the automation flag are dropped', () => {
  assert.equal(botReason(hdrs(), false), null);
  for (const ua of ['', 'curl/8.0', 'SomeLinkPreview/1.0', 'Mozilla/5.0 (compatible; Examplebot/2.1; +http://x.example)',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0', 'Mozilla/5.0 (compatible; ExampleExternalHit/1.1)',
    'Mozilla/5.0 (compatible; Some-Crawler/1.0)', 'Mozilla/5.0 (compatible; ExampleSpider)', 'Mozilla/5.0 (compatible; ExampleEmbedFetcher)', 'node-fetch/1.0', 'python-requests/2.31']) {
    assert.equal(botReason(hdrs({ 'user-agent': ua }), false), 'declared_bot', ua);
  }
  assert.equal(botReason(hdrs({ 'sec-fetch-site': null, origin: null }), false), 'no_fetch_metadata');
  assert.equal(botReason(hdrs({ 'sec-fetch-site': null, 'sec-fetch-mode': null }), false), null); // Origin only (older in-app views): counted
  assert.equal(botReason(hdrs(), true), 'automation');
});

test('F-15 bot filter: generic words only, no platform or product name (POLICY T1, T5)', () => {
  const src = readFileSync(new URL('./views.ts', import.meta.url), 'utf8').toLowerCase();
  for (const m of MARKS) assert.ok(!new RegExp(`\\b${m.replace(/ /g, '[\\s-]?')}\\b`).test(src), m);
  assert.doesNotMatch(src, /\.(com|net|org|io)\b/); // no domain list
});

test('F-15 rate cap: an engaged reader (30 a minute) is never capped; a burst past RATE_MAX is; no address → no cap', () => {
  const t0 = Date.UTC(2026, 10, 1, 10, 0, 0);
  const env = process.env.TRUST_PROXY_HEADERS;
  process.env.TRUST_PROXY_HEADERS = '1';
  try {
    const reader = hdrs({ 'x-forwarded-for': '203.0.113.7' });
    for (let i = 0; i < 30; i++) assert.equal(rateLimited(reader, t0 + i * 2000), 'ok', `beacon ${i}`);
    const burst = hdrs({ 'x-forwarded-for': '203.0.113.8' });
    const out = Array.from({ length: RATE_MAX + 5 }, () => rateLimited(burst, t0 + 5_000));
    assert.equal(out.filter((x) => x === 'ok').length, RATE_MAX);
    assert.deepEqual(out.slice(RATE_MAX), ['first-over', 'over', 'over', 'over', 'over']);
    assert.equal(rateLimited(burst, t0 + 65_000), 'ok'); // the next minute
    delete process.env.TRUST_PROXY_HEADERS;
    const anon = hdrs();
    for (let i = 0; i < 100; i++) assert.equal(rateLimited(anon, t0 + 10_000), 'ok', `anon ${i}`);
  } finally {
    if (env === undefined) delete process.env.TRUST_PROXY_HEADERS; else process.env.TRUST_PROXY_HEADERS = env;
  }
});

type Calls = { views: ViewKey[]; drops: [string, string][] };
const deps = (o: Partial<BeaconDeps> = {}, calls: Calls = { views: [], drops: [] }): [BeaconDeps, Calls] => [{
  viewer: async () => null,
  recordView: async (k) => { calls.views.push(k); },
  recordDrop: async (s, r) => { calls.drops.push([s, r]); },
  viewedUserId: async (t) => (t.handle === 'maya' ? 7 : null),
  limited: () => 'ok',
  ...o,
}, calls];
const post = (body: unknown, h = hdrs()) => new Request('http://app.test/api/views', { method: 'POST', headers: h, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('F-15 route: a counted view stores only surface, trader id, ref class, via class and the two flags', async () => {
  const [d, c] = deps({ viewer: async () => ({ id: 9 }) });
  const r = await handleBeacon(post({ path: '/u/maya', ref: 'external', via: 'card' }), d);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('set-cookie'), null);
  assert.deepEqual(c.views, [{ surface: 'profile', userId: 7, ref: 'external', via: 'card', signedIn: true, selfView: false }]);
  const [d2, c2] = deps({ viewer: async () => ({ id: 7 }) });
  await handleBeacon(post({ path: '/u/maya/month/2026-10', ref: 'internal' }), d2);
  assert.deepEqual(c2.views, [{ surface: 'month', userId: 7, ref: 'internal', via: 'none', signedIn: true, selfView: true }]);
  const [d3, c3] = deps();
  await handleBeacon(post({ path: '/', ref: 'none', via: 'inv_t' }), d3);
  assert.deepEqual(c3.views, [{ surface: 'feed', userId: null, ref: 'none', via: 'inv_t', signedIn: false, selfView: false }]);
});

test('F-15 route: unknown target, unknown path, bad body and cross-site requests count nothing', async () => {
  const [d, c] = deps();
  for (const b of [{ path: '/u/nobody', ref: 'none' }, { path: '/settings', ref: 'none' }, { path: '/u/maya', ref: 'http://x.example' }, 'junk', { ref: 'none' }]) {
    assert.equal((await handleBeacon(post(b), d)).status, 204);
  }
  assert.equal((await handleBeacon(post({ path: '/', ref: 'none' }, hdrs({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' })), d)).status, 403);
  assert.equal((await handleBeacon(post('x'.repeat(600)), d)).status, 413);
  assert.deepEqual(c, { views: [], drops: [] });
});

test('F-15 route: filtered beacons are counted as drops by surface and reason, never as views', async () => {
  const [d, c] = deps();
  await handleBeacon(post({ path: '/u/maya', ref: 'external' }, hdrs({ 'user-agent': 'ExamplePreview/1.0' })), d);
  await handleBeacon(post({ path: '/', ref: 'none', auto: true }), d);
  await handleBeacon(post({ path: '/me', ref: 'none' }, hdrs({ 'sec-fetch-site': null, origin: null })), d);
  const [dl, cl] = deps({ limited: () => 'first-over' });
  await handleBeacon(post({ path: '/how', ref: 'none' }), dl);
  const [dq, cq] = deps({ limited: () => 'over' });
  assert.equal((await handleBeacon(post({ path: '/how', ref: 'none' }, hdrs({ 'user-agent': 'ExamplePreview/1.0' })), dq)).status, 204);
  assert.deepEqual(cq, { views: [], drops: [] }); // past the first capped beacon in a minute: answered, not written
  assert.deepEqual(c.drops, [['profile', 'declared_bot'], ['feed', 'automation'], ['other', 'no_fetch_metadata']]);
  assert.deepEqual(cl.drops, [['how', 'rate']]);
  assert.deepEqual([...c.views, ...cl.views], []);
});

test('F-15 route: a client that aborts mid-body still gets 204 (never a 500)', async () => {
  const [d, c] = deps();
  const body = new ReadableStream({ pull(ctrl) { ctrl.error(new Error('aborted')); } });
  const req = new Request('http://app.test/api/views', { method: 'POST', headers: hdrs(), body, duplex: 'half' } as RequestInit);
  const orig = console.error; console.error = () => {};
  try { assert.equal((await handleBeacon(req, d)).status, 204); } finally { console.error = orig; }
  assert.deepEqual(c, { views: [], drops: [] });
});

test('F-15 route: a failing write answers 204 and logs one safe line with no agent, address or key', async () => {
  const lines: unknown[][] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { lines.push(a); };
  try {
    const err = Object.assign(new Error(`insert failed for ${UA} from 203.0.113.7`), { code: '57P01' });
    const [d] = deps({ recordView: async () => { throw err; } });
    const r = await handleBeacon(post({ path: '/u/maya', ref: 'external' }, hdrs({ 'x-forwarded-for': '203.0.113.7' })), d);
    assert.equal(r.status, 204);
    const [dd] = deps({ viewedUserId: async () => { throw err; } });
    assert.equal((await handleBeacon(post({ path: '/u/maya', ref: 'external' }), dd)).status, 204);
  } finally {
    console.error = orig;
  }
  assert.equal(lines.length, 2);
  for (const l of lines) {
    const text = l.join(' ');
    assert.equal(text, 'view beacon failed Error code 57P01');
    assert.doesNotMatch(text, /Mozilla|203\.0\.113|maya/);
  }
});

test('F-15 route and counter: no console call takes the user agent, address, key or salt', () => {
  for (const f of ['./views.ts', './views-route.ts', './views-shared.ts', '../app/api/views/route.ts', '../app/view-beacon.tsx']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    for (const m of src.matchAll(/console\.\w+\(([^)]*)\)/g)) assert.doesNotMatch(m[1], /user-agent|ua\b|ip\b|key|salt|headers|\bh\b/, `${f}: ${m[0]}`);
  }
});
