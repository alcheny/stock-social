// C5-42 (approval council cycle 5, chore lane; brief docs/direction/cycle5-2026-11-01.md §6 rank 20): behavioural tests
// beside source-text assertions. The old assertions stay where they are; each test here calls the real route handler or
// function and names the source-text test it backs. Every call below is answered before the handler reaches the
// database (a refused bearer, refused parameters, or an injected health reading), so nothing here reads or writes rows.
// `@/` resolves to the repo root the way lib/bdi-names.test.ts resolves it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url);
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) return next(new URL(spec.slice(2), ROOT).href, ctx);
    if (/^next\/[a-z]+$/.test(spec)) return next(`${spec}.js`, ctx); // next/server, next/headers: no ESM exports map
    return next(spec, ctx);
  },
});
const load = async <T>(rel: string) => (await import(pathToFileURL(new URL(rel, ROOT).pathname).href)) as T;
type Handler = (req: unknown) => Promise<Response>;
type SyncRoute = { POST: Handler; GET: Handler; maxDuration: number };
const syncRoute = () => load<SyncRoute>('app/api/sync/route.ts');
const { NextRequest } = await import('next/server' as string) as typeof import('next/server');

const SECRET = `c5-42-fictional-cron-secret-${Math.random().toString(36).slice(2)}`;
const call = (method: 'GET' | 'POST', query = '', bearer?: string) =>
  new NextRequest(`https://app.example/api/sync${query}`, { method, headers: bearer === undefined ? {} : { authorization: bearer } });
async function withSecret<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const was = process.env.CRON_SECRET;
  if (value === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = value;
  try { return await fn(); } finally { if (was === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = was; }
}
function captureWarn() {
  const lines: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  return { lines, restore: () => { console.warn = orig; } };
}

// First in the file: logUnauthorized logs once per route per minute per process, so this call is the one that logs.
test('C5-42 backs lib/chores-cycle3.test.ts "C3-34: the cron routes log a 401 with a literal route name only": a wrong bearer gets 401 and one line that names the route and holds no part of the bearer', async () => {
  const wrong = `Bearer ${SECRET.slice(0, -1)}X`;
  const c = captureWarn();
  let res: Response;
  try { res = await withSecret(SECRET, async () => (await syncRoute()).POST(call('POST', '?shard=0&of=1', wrong))); } finally { c.restore(); }
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'unauthorized' });
  assert.deepEqual(c.lines, ['cron unauthorized CronUnauthorized status 401 {"route":"sync","suppressed":0}']);
  for (const part of [wrong, SECRET, SECRET.slice(0, 12), 'c5-42-fictional']) assert.ok(!c.lines.join('\n').includes(part), part);
});

test('C5-42 backs lib/sync-route.test.ts "route: the secret is checked before the parameters; GET is POST": a missing or wrong bearer with bad parameters is 401 (never 400) on POST and on GET', async () => {
  const { POST, GET } = await syncRoute();
  const c = captureWarn();
  try {
    await withSecret(SECRET, async () => {
      for (const handler of [POST, GET]) {
        for (const bearer of [undefined, '', 'Bearer ', `Bearer ${SECRET}x`, SECRET]) {
          for (const query of ['?shard=9&of=2', '?task=nonsense', '?of=0']) {
            const res = await handler(call(handler === POST ? 'POST' : 'GET', query, bearer));
            assert.equal(res.status, 401, `${handler === POST ? 'POST' : 'GET'} ${query} ${bearer === undefined ? '(none)' : 'wrong bearer'}`);
          }
        }
      }
    });
    // No CRON_SECRET on the server: even the bearer "Bearer undefined" is refused.
    await withSecret(undefined, async () => {
      for (const handler of [POST, GET]) assert.equal((await handler(call('POST', '', 'Bearer undefined'))).status, 401);
    });
  } finally { c.restore(); }
});

test('C5-42 backs lib/sync-route.test.ts "route: the secret is checked before the parameters; GET is POST": with the right bearer, GET answers bad parameters exactly as POST does (400, the same body)', async () => {
  const { POST, GET } = await syncRoute();
  await withSecret(SECRET, async () => {
    for (const query of ['?task=nonsense', '?task=housekeeping&shard=0', '?task=housekeeping&of=0', '?shard=x&of=2']) {
      const post = await POST(call('POST', query, `Bearer ${SECRET}`));
      const get = await GET(call('GET', query, `Bearer ${SECRET}`));
      assert.equal(post.status, 400, query);
      assert.equal(get.status, post.status, query);
      const body = await post.json();
      assert.match(String(body.error), /\S/, query);
      assert.deepEqual(await get.json(), body, query);
    }
  });
});

test('C5-42 backs lib/sync.test.ts "fix round 4: each route declares a duration above the 30 s vendor bound…": the route modules export the durations lib/sync.ts and lib/connections.ts mirror', async () => {
  const S = await import('./sync.ts');
  const C = await import('./connections.ts');
  assert.equal((await syncRoute()).maxDuration, S.SYNC_ROUTE_MAX_S);
  assert.equal((await load<{ maxDuration: number }>('app/api/import/step/route.ts')).maxDuration, C.STEP_ROUTE_MAX_S);
});

test('C5-42 backs lib/chores-cycle3.test.ts "C3-34: … health never logs a bearer …": the health answer is the public body without the bearer (a wrong one is not logged) and the details with it', async () => {
  const { GET } = await load<{ GET: Handler }>('app/api/health/route.ts');
  const { healthDeps, THRESHOLD_MS } = await import('./health.ts');
  const now = Date.UTC(2030, 0, 1, 12);
  const keep = { ...healthDeps };
  healthDeps.read = async (details) => ({ dbOk: true, last: new Date(now - 60_000), stalest: details ? new Date(now - 3 * 3_600_000) : null });
  healthDeps.now = () => now;
  const warn = captureWarn();
  const errs: string[] = [];
  const origErr = console.error;
  console.error = (...a: unknown[]) => { errs.push(a.map(String).join(' ')); };
  try {
    await withSecret(SECRET, async () => {
      const req = (bearer?: string) => new Request('https://app.example/api/health', { headers: bearer === undefined ? {} : { authorization: bearer } });
      for (const bearer of [undefined, 'Bearer nope', `Bearer ${SECRET}x`]) {
        const res = await GET(req(bearer));
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await res.json(), { status: 'ok' });
      }
      const full = await (await GET(req(`Bearer ${SECRET}`))).json();
      assert.deepEqual(Object.keys(full).sort(), ['db', 'lastRunAgeHours', 'lastRunAt', 'stalestSyncAgeHours', 'status', 'thresholdHours']);
      assert.equal(full.status, 'ok');
      assert.equal(full.stalestSyncAgeHours, 3);
      // Degraded (the newest run older than the threshold) is 503 with the public body only.
      healthDeps.read = async () => ({ dbOk: true, last: new Date(now - THRESHOLD_MS - 1), stalest: null });
      const late = await GET(req());
      assert.equal(late.status, 503);
      assert.deepEqual(await late.json(), { status: 'degraded' });
    });
  } finally {
    Object.assign(healthDeps, keep);
    warn.restore();
    console.error = origErr;
  }
  assert.deepEqual(warn.lines, [], 'a wrong bearer on health is never logged');
  assert.deepEqual(errs, []);
});
