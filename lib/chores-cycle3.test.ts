// CHORES-3: the approval council cycle 3 chores (docs/features/logs/chores-cycle3/plan.md, Round 2 overrides §1-§5).
// C3-34 health endpoint and cron 401 line, C3-44 delete-screen notes line, K20 home link preview, K22 billing hygiene
// (test mode only, the billing vendor's in-repo fake), C3-39 Record tools while checkout is not open.
// Shared database: every DB case creates and removes its own users only; no global counts (the health query's real
// shape is checked, its status cases run on the pure function). Fixture data is fictional (POLICY P2).
import { after, before, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHORES_3, BILLING, RECORD_TOOLS, FIRST_VISIT } from './copy.ts';
import { cronAuthorized, logUnauthorized, CRON_LOG_WINDOW_MS } from './cron-auth.ts';
import { healthStatus, THRESHOLD_MS } from './health.ts';
import { MISSING_SHARD_MS } from './sync-shard.ts';
import { homePreview } from './home-preview.ts';
import { PLANS } from './billing.ts';
import { siteOrigin } from './site-origin.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const files = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(root, dir, f);
  return statSync(p).isDirectory() ? files(relative(root, p)) : /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) ? [relative(root, p)] : [];
});
const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
const HOUR = 3_600_000;

// Captures console.warn / console.error lines as the joined strings a log would hold.
function capture(method: 'warn' | 'error') {
  const lines: string[] = [];
  const m = mock.method(console, method, (...a: unknown[]) => { lines.push(a.map(String).join(' ')); });
  return { lines, restore: () => m.mock.restore() };
}
const req = (auth?: string) => new Request('http://app.test/api/x', { headers: auth === undefined ? {} : { authorization: auth } });

// ---- C3-34 ----------------------------------------------------------------------------------------------------------

test('C3-34: cronAuthorized accepts only the exact bearer, in constant time; unset CRON_SECRET refuses everything', () => {
  const env = { CRON_SECRET: 'cron-unit-secret-0123456789' };
  assert.equal(cronAuthorized(req('Bearer cron-unit-secret-0123456789'), env), true);
  assert.equal(cronAuthorized(req('Bearer cron-unit-secret-0123456780'), env), false); // same length, wrong value
  assert.equal(cronAuthorized(req('Bearer short'), env), false);
  assert.equal(cronAuthorized(req(), env), false);
  assert.equal(cronAuthorized(req('Bearer '), { CRON_SECRET: '' }), false);
  assert.equal(cronAuthorized(req('Bearer undefined'), {}), false);
  assert.match(read('lib/cron-auth.ts'), /timingSafeEqual\(digest\(req\.headers\.get\('authorization'\) \?\? ''\), digest\(`Bearer \$\{secret\}`\)\)/);
});

test('C3-34: the 401 line is rate-limited per route, carries the suppressed count, and goes through logSafe', () => {
  const c = capture('warn');
  try {
    const t0 = 1_000_000_000_000;
    assert.equal(logUnauthorized('sync', t0), true);
    for (let i = 1; i <= 4; i++) assert.equal(logUnauthorized('sync', t0 + i * 1000), false);
    assert.equal(logUnauthorized('billing-reconcile', t0 + 5000), true); // counted separately
    assert.equal(logUnauthorized('sync', t0 + CRON_LOG_WINDOW_MS + 1), true);
    assert.deepEqual(c.lines, [
      'cron unauthorized CronUnauthorized status 401 {"route":"sync","suppressed":0}',
      'cron unauthorized CronUnauthorized status 401 {"route":"billing-reconcile","suppressed":0}',
      'cron unauthorized CronUnauthorized status 401 {"route":"sync","suppressed":4}',
    ]);
  } finally { c.restore(); }
  assert.equal(CRON_LOG_WINDOW_MS, 60_000);
  // The call as written (lib/privacy-logs.test.ts scans every server console call, this one included).
  assert.match(read('lib/cron-auth.ts'), /console\.warn\('cron unauthorized', logSafe\(denied\), JSON\.stringify\(\{ route, suppressed \}\)\);/);
});

test('C3-34: the cron routes log a 401 with a literal route name only: the request never reaches the log line', () => {
  for (const f of ['app/api/sync/route.ts', 'app/api/billing/reconcile/route.ts']) {
    const calls = [...read(f).matchAll(/logUnauthorized\(([^)]*)\)/g)].map((m) => m[1]);
    assert.equal(calls.length, 1, f);
    assert.match(calls[0], /^'(sync|billing-reconcile)'$/, f); // no req, header or token is passed
  }
  // The line's own arguments: a literal, the reduced fixed error, and two fixed fields (no request in scope).
  const src = read('lib/cron-auth.ts');
  const fn = src.slice(src.indexOf('export function logUnauthorized'));
  assert.match(fn, /^export function logUnauthorized\(route: CronRoute, now = Date\.now\(\)\): boolean \{/);
  assert.doesNotMatch(fn, /\b(req|request|headers?|authorization|ip|forwarded)\b/i);
  assert.match(src, /constructor\(\) \{ super\('cron unauthorized'\); \}/);
});

test('C3-34: the cron routes log through logUnauthorized; health never logs a bearer; the threshold is the sync round', () => {
  for (const [f, route] of [['app/api/sync/route.ts', 'sync'], ['app/api/billing/reconcile/route.ts', 'billing-reconcile']]) {
    const src = read(f);
    const i = src.indexOf(`logUnauthorized('${route}')`);
    assert.ok(i > 0, f);
    assert.ok(i < src.indexOf("{ error: 'unauthorized' }"), f); // logged in the 401 branch, before its answer
  }
  const healthSrc = read('app/api/health/route.ts') + read('lib/health.ts');
  assert.doesNotMatch(healthSrc, /logUnauthorized/);
  assert.match(read('lib/health.ts'), /const details = cronAuthorized\(req\);[\s\S]*const body = details \? d : \{ status: d\.status \};/);
  // The class name survives minification (logSafe prints constructor.name; QA D1).
  assert.match(read('lib/cron-auth.ts'), /Object\.defineProperty\(CronUnauthorized, 'name', \{ value: 'CronUnauthorized' \}\);/);
  // Follow-up (orchestrator review of #76): from the cron schedule (lib/chores-cycle3-followup.test.ts has both cases).
  assert.equal(THRESHOLD_MS, MISSING_SHARD_MS);
  assert.match(read('lib/health.ts'), /export const THRESHOLD_MS = thresholdFor\(cronTickMs\(\)\);/);
  assert.doesNotMatch(read('lib/health.ts'), /\b20\s*\*\s*60|1_?200_?000|THRESHOLD_MS\s*=\s*\d/);
});

test('C3-34: degraded when the database fails, no run was ever recorded, or the newest run is older than a round', () => {
  const now = Date.UTC(2026, 10, 1, 12);
  const at = (ms: number) => new Date(now - ms);
  assert.equal(healthStatus({ dbOk: true, last: null, stalest: null }, now).status, 'degraded');
  assert.equal(healthStatus({ dbOk: true, last: at(10 * 60_000), stalest: null }, now).status, 'ok');
  assert.equal(healthStatus({ dbOk: true, last: at(THRESHOLD_MS), stalest: null }, now).status, 'ok');
  assert.equal(healthStatus({ dbOk: true, last: at(THRESHOLD_MS + 60_000), stalest: null }, now).status, 'degraded');
  assert.equal(healthStatus({ dbOk: false, last: at(1000), stalest: at(1000) }, now).status, 'degraded');
  // A trader held 30 h (backoff, quarantine) is reported, never a cause.
  const d = healthStatus({ dbOk: true, last: at(5 * 60_000), stalest: at(30 * HOUR) }, now);
  assert.deepEqual(d, { status: 'ok', db: true, lastRunAt: at(5 * 60_000).toISOString(), lastRunAgeHours: 0.08, stalestSyncAgeHours: 30, thresholdHours: 0.25 });
  assert.deepEqual(healthStatus({ dbOk: false, last: null, stalest: null }, now), { status: 'degraded', db: false, lastRunAt: null, lastRunAgeHours: null, stalestSyncAgeHours: null, thresholdHours: 0.25 });
  // A clock skew never yields a negative age.
  assert.equal(healthStatus({ dbOk: true, last: new Date(now + 5000), stalest: null }, now).lastRunAgeHours, 0);
});

const allowedBody = (b: Record<string, unknown>, details: boolean) => {
  assert.deepEqual(Object.keys(b), details ? ['status', 'db', 'lastRunAt', 'lastRunAgeHours', 'stalestSyncAgeHours', 'thresholdHours'] : ['status']);
  assert.ok(b.status === 'ok' || b.status === 'degraded');
  for (const v of Object.values(b)) assert.ok(v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && (/^(ok|degraded)$/.test(v) || /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v))), String(v));
  assert.doesNotMatch(JSON.stringify(b), /@|\$|%|error|fail/i);
};

test('C3-34: the health route answers the public body without the bearer, the details with it, never cached; a thrown query is degraded (503)', async () => {
  const saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'cron-health-secret-abcdefgh';
  const { healthDeps, healthResponse: GET } = await import('./health.ts');
  assert.match(read('app/api/health/route.ts'), /return healthResponse\(req\);/);
  const prev = { ...healthDeps };
  const c = capture('error');
  try {
    healthDeps.now = () => Date.UTC(2026, 10, 1, 12);
    const asked: boolean[] = [];
    healthDeps.read = async (details) => { asked.push(details); return { dbOk: true, last: new Date(Date.UTC(2026, 10, 1, 11, 55)), stalest: details ? new Date(Date.UTC(2026, 10, 1, 2)) : null }; };
    let res = await GET(req());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { status: 'ok' });
    res = await GET(req('Bearer wrong-wrong-wrong-wrong-wr'));
    assert.deepEqual(await res.json(), { status: 'ok' });
    res = await GET(req('Bearer cron-health-secret-abcdefgh'));
    assert.equal(res.headers.get('cache-control'), 'no-store');
    allowedBody(await res.json(), true);
    // The anonymous calls never ask for the stalest-trader scan; the bearer call does.
    assert.deepEqual(asked, [false, false, true]);
    healthDeps.read = async () => { throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.9:5432 for trader_x'), { code: 'ECONNREFUSED' }); };
    res = await GET(req());
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { status: 'degraded' });
    res = await GET(req('Bearer cron-health-secret-abcdefgh'));
    const b = await res.json();
    allowedBody(b, true);
    assert.equal(b.db, false);
    assert.deepEqual(c.lines, ['health query failed Error code ECONNREFUSED', 'health query failed Error code ECONNREFUSED']);
  } finally {
    Object.assign(healthDeps, prev); c.restore();
    if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
  }
});

dbTest('C3-34: the real health query runs and returns times or nulls (shape only: other files write sync_shards)', async () => {
  const { readHealth } = await import('./health.ts');
  const pub = await readHealth(false);
  assert.equal(pub.stalest, null);
  const r = await readHealth(true);
  assert.equal(r.dbOk, true);
  for (const v of [r.last, r.stalest]) assert.ok(v === null || v instanceof Date);
  allowedBody(healthStatus(r, Date.now()) as unknown as Record<string, unknown>, true);
});

// ---- C3-44 ----------------------------------------------------------------------------------------------------------

const tag = `c3${process.pid % 100000}`;
let seq = 0;
const madeUsers: number[] = [], madeAttempts: number[] = [];
async function user(): Promise<{ id: number; attempt: number }> {
  const { sql } = await import('./db.ts');
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${`${tag}_${++seq}`}, 'Test user', now(), ${a.id}) returning id`;
  madeAttempts.push(a.id as number); madeUsers.push(u.id as number);
  return { id: u.id as number, attempt: a.id as number };
}
before(async () => {
  if (hasDb) await (await import('./db.ts')).sql.unsafe(read('db/schema.sql')).simple();
});
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  try {
    if (madeUsers.length) {
      await sql`delete from connections where user_id = any(${madeUsers})`;
      await sql`delete from users where id = any(${madeUsers})`;
    }
    if (madeAttempts.length) await sql`delete from signup_attempts where id = any(${madeAttempts}) and not exists (select 1 from users u where u.signup_attempt_id = signup_attempts.id)`;
  } finally { await sql.end({ timeout: 1 }); }
});

dbTest('C3-44: the notes line applies to a public record or to others\' notes and views naming the user, never to a connection alone', async () => {
  const { sql } = await import('./db.ts');
  const { notesLineApplies } = await import('./delete.ts');
  const fresh = await user();
  assert.equal(await notesLineApplies(fresh.id), false);
  for (const state of ['pending', 'importing', 'connected', 'declined', 'expired', 'failed']) {
    const u = await user();
    await sql`insert into connections (attempt_id, user_id, state, consent_at) values (${u.attempt}, ${u.id}, ${state}, ${state === 'pending' ? null : sql`now()`})`;
    assert.equal(await notesLineApplies(u.id), false, state);
  }
  const traded = await user();
  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    values (${traded.id}, ${`${tag}-s`}, 'acct', 'CHX', now() - interval '3 days', now() - interval '1 day', -0.04, 2, true)`;
  assert.equal(await notesLineApplies(traded.id), true);
  const open = await user();
  await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct) values (${open.id}, 'a', 'CHX', -0.1)`;
  assert.equal(await notesLineApplies(open.id), true);
  const viewer = await user();
  const noted = await user();
  await sql`insert into record_notes (owner_id, trader_id, body) values (${viewer.id}, ${noted.id}, 'a private note')`;
  assert.equal(await notesLineApplies(noted.id), true);
  const saved = await user();
  const [v] = await sql`insert into record_views (owner_id, name) values (${viewer.id}, 'A view') returning id`;
  await sql`insert into record_view_traders (view_id, trader_id, position) values (${v.id}, ${saved.id}, 1)`;
  assert.equal(await notesLineApplies(saved.id), true);
  assert.equal(await notesLineApplies(viewer.id), false); // writing notes about others is not a record
});

test('C3-44: a failed check shows the line (over-disclosure is the safe side); the copy is the F-3 committee\'s words', async () => {
  const src = read('lib/delete.ts');
  const fn = src.slice(src.indexOf('export async function notesLineApplies'));
  assert.match(fn, /catch \(e\) \{\s*console\.error\('delete notice check failed', logSafe\(e\)\);\s*return true;/);
  assert.equal(BILLING.deleteNotes, "If you publish a record, other subscribers' private notes about you are deleted and you are removed from their saved views.");
  assert.ok(read('docs/features/logs/F-3/plan.md').includes(BILLING.deleteNotes));
  const page = read('app/settings/page.tsx');
  assert.match(page, /\{await notesLineApplies\(me\.id\) && <p className="muted">\{BILLING\.deleteNotes\}<\/p>\}/);
  // View 2 shows neither line, as before; Delete my profile is unchanged (C3-40 is not approved).
  const view2 = page.slice(page.indexOf('{confirm ? ('), page.indexOf(') : ('));
  assert.doesNotMatch(view2, /deleteNotes|deleteBilling/);
  assert.match(page, /<Link className="button wide" href="\/settings\?confirm=1" data-testid="delete-first">\{SETTINGS\.deleteAction\}<\/Link>/);
});

// ---- K20 ------------------------------------------------------------------------------------------------------------

const COMPLETENESS = /stock social|\d|%|\$|\bevery\b|any broker|all trades|the only|\bcomplete|verified|guarantee|best|top/i;

test('K20: the positioning line is the design system council\'s, with no name, figure or completeness claim; D27 unchanged', () => {
  assert.equal(CHORES_3.position, 'Closed trades imported read-only from connected broker accounts. Losses included.');
  assert.ok(read('docs/direction/design-system-2026-11-01.md').includes(CHORES_3.position));
  assert.equal(CHORES_3.position, `${CHORES_3.homeTitle} ${CHORES_3.losses}`);
  assert.ok(read('docs/direction/design-system-2026-11-01.md').includes(CHORES_3.demo));
  for (const s of [CHORES_3.position, CHORES_3.homeTitle, CHORES_3.losses, CHORES_3.demo]) assert.doesNotMatch(s, COMPLETENESS, s);
  assert.equal(FIRST_VISIT.line, 'Verified trades, straight from the broker. Losses included.');
});

test('K20: the preview never repeats the title in the description, and says demo records are marked while they exist', () => {
  for (const demo of [true, false]) {
    const p = homePreview(demo);
    assert.equal(p.title, CHORES_3.homeTitle);
    assert.ok(!p.description.startsWith(p.title));
    assert.equal(p.description, demo ? 'Losses included. Demo records are marked Demo.' : 'Losses included.');
    assert.equal(p.metaDescription, demo ? `${CHORES_3.position} ${CHORES_3.demo}` : CHORES_3.position);
    assert.equal(p.cardText, p.metaDescription);
    for (const s of Object.values(p)) assert.doesNotMatch(s, COMPLETENESS, s);
  }
  const src = read('lib/home-preview.ts');
  assert.match(src, /catch \(e\) \{\s*console\.error\('demo check failed', logSafe\(e\)\);\s*return true;/);
});

dbTest('K20: the demo check is remembered per instance for its TTL; a failure is not remembered', async () => {
  const { demoShown, DEMO_TTL_MS } = await import('./home-preview.ts');
  const t = Date.now() + 10 * DEMO_TTL_MS; // past any earlier memo
  const first = await demoShown(t);
  assert.equal(typeof first, 'boolean');
  assert.equal(await demoShown(t + DEMO_TTL_MS - 1), first);
  assert.equal(DEMO_TTL_MS, 300_000);
  assert.match(read('lib/home-preview.ts'), /return true; \/\/ not remembered/);
});

test('K20: the image is a scoped text-only route, never a root opengraph file; the feed metadata uses the configured origin', () => {
  const card = read('app/home-card/route.tsx').replace(/^\s*\/\/.*$/gm, '');
  assert.match(card, /width: 1200, height: 630/);
  assert.match(card, /\{cardText\}/);
  assert.match(card, /q\.get\('d'\) !== '0'/); // FIXES-CYCLE4-PART2 (F4-8): `q` is the request's searchParams
  assert.match(card, /const q = new URL\(req\.url\)\.searchParams;/);
  assert.doesNotMatch(card, /<img|<svg|fetch\(|\.ttf|\.woff|Stock Social|logo/i);
  assert.match(card, /'Cache-Control': 'public, max-age=3600, s-maxage=3600'/);
  const top = readdirSync(join(root, 'app'));
  assert.ok(!top.some((f) => /^(opengraph-image|twitter-image)\./.test(f)), 'no root opengraph/twitter image file');
  const page = read('app/page.tsx');
  assert.match(page, /metadataBase: new URL\(siteOrigin\(\)\)/);
  assert.match(page, /\.\.\.\(after \? \{ robots: \{ index: false \} \} : \{\}\)/);
  assert.doesNotMatch(page.slice(page.indexOf('generateMetadata'), page.indexOf('export default')), /\btitle: ['"`]/);
  assert.doesNotMatch(page, /lib\/billing\.ts|headers\(\)/);
  assert.equal(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'https://site.example/' }), 'https://site.example');
  assert.equal(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'app.example' }), 'https://app.example');
  assert.equal(siteOrigin({}), 'http://localhost:3000');
  assert.match(read('lib/billing.ts'), /export \{ siteOrigin \} from '\.\/site-origin\.ts';/);
});

// ---- K22 (test mode only; LIVE_BILLING untouched) ----------------------------------------------------------------------

const BILLING_FILES = [...files('app/tools'), ...files('app/account')];
const copyStrings = (o: Record<string, unknown>): string[] => Object.values(o).flatMap((v) => {
  if (typeof v === 'string') return [v];
  if (typeof v === 'function') {
    const d = new Date(Date.UTC(2026, 11, 1));
    const out: string[] = [];
    for (const args of [[], [d], [d, 'monthly'], ['monthly'], ['annual', d], [2, 3], [1], [['a', 'b']]]) {
      try { const r = (v as (...a: unknown[]) => unknown)(...args); if (typeof r === 'string') out.push(r); } catch { /* another signature */ }
    }
    return out;
  }
  if (v && typeof v === 'object') return copyStrings(v as Record<string, unknown>);
  return [];
});
const block = (name: string) => { const s = read('lib/copy.ts'); const i = s.indexOf(`export const ${name} = {`); assert.ok(i >= 0, name); return s.slice(i, s.indexOf('\n} as const;', i)); };

test('K22: Cancel opens the billing vendor\'s cancel flow directly: no app screen, save offer or extra step in between', () => {
  const actions = read('app/account/actions.ts');
  assert.match(actions, /export async function openCancel\(\) \{ return portal\(true\); \}/);
  const body = actions.slice(actions.indexOf('async function portal('));
  const calls = new Set([...body.matchAll(/\b([a-zA-Z_]\w*)\(/g)].map((m) => m[1]));
  for (const c of calls) assert.ok(['portal', 'currentUser', 'redirect', 'portalUrl', 'siteOrigin', 'logSafe', 'error'].includes(c), c);
  assert.doesNotMatch(actions, /cookies|save|offer|pause|discount|coupon|survey|reason/i);
  assert.match(read('app/account/page.tsx'), /formAction=\{openCancel\}>\{BILLING\.cancel\}/);
  assert.deepEqual(readdirSync(join(root, 'app/account')).sort(), ['actions.ts', 'activating.tsx', 'export', 'page.tsx']);
  const billing = read('lib/billing.ts');
  const portal = billing.slice(billing.indexOf('export async function portalUrl'), billing.indexOf('// ---- entitlements'));
  assert.match(portal, /type: 'subscription_cancel', subscription_cancel: \{ subscription: live\.vendor_subscription_id/);
});

test('K22: no billing or Record tools copy says paid data is more accurate, fresher, faster, complete or exclusive', () => {
  const strings = [...copyStrings(BILLING as unknown as Record<string, unknown>), ...copyStrings(RECORD_TOOLS as unknown as Record<string, unknown>)];
  assert.ok(strings.length > 40);
  for (const s of strings) assert.doesNotMatch(s, /more accurate|accuracy|fresher|faster|real[- ]?time|instant|\bcomplete\b|exclusive|premium data|ahead of|first to|earlier access|before others/i, s);
});

test('K22: no "was" or struck price, and every price shown is a PLANS price', () => {
  const labels = new Set(Object.values(PLANS).map((p) => `$${(p.cents / 100).toFixed(2)}`));
  assert.equal(labels.size, 2);
  const texts = [...BILLING_FILES.map((f) => [f, read(f)] as const), ['BILLING', block('BILLING')] as const, ['RECORD_TOOLS', block('RECORD_TOOLS')] as const];
  assert.ok(BILLING_FILES.includes('app/tools/focus.tsx'));
  for (const [f, src] of texts) {
    assert.doesNotMatch(src, /<s>|<s |<del|<strike|line-through|textDecoration/, f);
    assert.doesNotMatch(src, /\bwas\s*\$|\bwas\s+\d|previously|regular price|save\s+\d+\s*%|\d+\s*% off|discount/i, f);
    for (const m of src.matchAll(/\$\d[\d,]*(?:\.\d\d)?/g)) assert.ok(labels.has(m[0]), `${f}: ${m[0]}`);
  }
  for (const s of copyStrings(BILLING as unknown as Record<string, unknown>)) for (const m of s.matchAll(/\$\d[\d,]*(?:\.\d\d)?/g)) assert.ok(labels.has(m[0]), m[0]);
});

dbTest('K22: with the billing vendor\'s fake, Cancel sends one portal request on the cancel flow for the live subscription', async () => {
  const { createBillingFake } = await import('../e2e/fakes/billing.ts');
  const b = await import('./billing.ts');
  const ENV = { STRIPE_SECRET_KEY: 'sk_test_chores3', STRIPE_WEBHOOK_SECRET: 'whsec_fake_chores3', STRIPE_PRICE_MONTHLY: 'price_c3_monthly', STRIPE_PRICE_ANNUAL: 'price_c3_annual', STRIPE_API_BASE: 'http://fake.invalid' };
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(ENV)) { saved[k] = process.env[k]; process.env[k] = v; }
  const prevFetch = b.billingDeps.fetch;
  try {
    assert.equal(b.testMode(b.billingAvailable()), true); // test mode only
    const fake = createBillingFake({ webhookSecret: ENV.STRIPE_WEBHOOK_SECRET, prices: { monthly: ENV.STRIPE_PRICE_MONTHLY, annual: ENV.STRIPE_PRICE_ANNUAL } });
    const cus = await (await fake.fetch('http://fake.invalid/v1/customers', { method: 'POST', body: '', headers: { authorization: `Bearer ${ENV.STRIPE_SECRET_KEY}`, 'stripe-version': b.API_VERSION } })).json() as { id: string };
    const seen: { url: string; body: string }[] = [];
    b.billingDeps.fetch = (async (url: string | URL | Request, init?: RequestInit) => { seen.push({ url: String(url), body: String(init?.body ?? '') }); return fake.fetch(url as string, init); }) as typeof fetch;
    const { sql } = await import('./db.ts');
    const u = await user();
    await sql`insert into billing_customers (user_id, vendor_customer_id) values (${u.id}, ${cus.id})`;
    await sql`insert into subscriptions (user_id, vendor_subscription_id, vendor_customer_id, plan, status, current_period_start, current_period_end, cancel_at_period_end)
      values (${u.id}, ${`sub_c3_${u.id}`}, ${cus.id}, 'monthly', 'active', now() - interval '3 days', now() + interval '27 days', false)`;
    const url = await b.portalUrl(u.id, 'http://app.test', true);
    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /\/v1\/billing_portal\/sessions$/);
    const params = new URLSearchParams(seen[0].body);
    assert.equal(params.get('flow_data[type]'), 'subscription_cancel');
    assert.equal(params.get('flow_data[subscription_cancel][subscription]'), `sub_c3_${u.id}`);
    assert.equal(params.get('return_url'), 'http://app.test/account');
    assert.match(String(url), /\/portal\/bps_fake/); // the vendor's hosted page, as returned (the fake has no base here)
  } finally {
    b.billingDeps.fetch = prevFetch;
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

// ---- C3-39 ----------------------------------------------------------------------------------------------------------

test('C3-39: one rule decides "checkout not open" for /tools and /account; closed states show no primary button and a way back', () => {
  const parts = read('app/tools/parts.tsx');
  assert.match(parts, /export async function checkoutFor\(userId: number \| undefined\)/);
  assert.match(parts, /const billing = \(userId \? await checkoutOpen\(userId\) : gateState\(\) !== 'closed'\) \? billingAvailable\(\) : null;/);
  assert.doesNotMatch(parts.split('\n').slice(0, 3).join('\n'), /use (client|server)/);
  const tools = read('app/tools/page.tsx');
  const account = read('app/account/page.tsx');
  assert.match(tools, /const \{ billing, closed \} = await checkoutFor\(me\?\.id\);/);
  assert.match(account, /const checkout = a\.kind === 'none' && !row \? await checkoutFor\(me\.id\) : null;/);
  for (const src of [tools, account]) assert.doesNotMatch(src, /checkoutOpen\(|gateState\(/); // never a second copy of the rule
  // /account: the open state's markup is unchanged; closed states are secondary with the state in the visible text.
  assert.match(account, /\? <Link className="button" href="\/tools">\{BILLING\.seeTools\}<\/Link>/);
  assert.match(account, /: <Link className="button secondary" href="\/tools">\{checkout\?\.closed \? CHORES_3\.seeToolsNotOpen : CHORES_3\.seeToolsUnavailable\}<\/Link>/);
  // Locked /tools: the way back only where the Subscribe screen is not shown.
  assert.match(tools, /: <><p className="muted">\{closed \? BILLING\.notOpen : BILLING\.unavailable\}<\/p><BackToFeed \/><\/>\}/);
  assert.match(parts, /<p className="rt-links"><Link href="\/">\{CHORES_3\.backToFeed\}<\/Link><\/p>/);
  for (const s of [CHORES_3.seeToolsNotOpen, CHORES_3.seeToolsUnavailable, CHORES_3.backToFeed]) assert.doesNotMatch(s, /\d|\$|soon|waitlist|notify|email|price/i, s);
  assert.equal(CHORES_3.seeToolsNotOpen, `${BILLING.seeTools} (not open yet)`);
  assert.equal(CHORES_3.seeToolsUnavailable, `${BILLING.seeTools} (not available right now)`);
  assert.match(BILLING.notOpen, /not open yet/);
  assert.match(BILLING.unavailable, /not available right now/);
  // The F-3 plan records the amendment.
  assert.match(read('docs/features/logs/F-3/plan.md'), /2026-11-01 amendment \(C3-39/);
});
