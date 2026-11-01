// CHORES-3 follow-up (the orchestrator's review of #76): the health threshold from the cron schedule, the delete-screen
// notes line failing open (behaviour, not source), the home card keyed by the demo state, and logSafe's stable label
// for minified class names. Fixture data is fictional (POLICY P2); no rows are written.
import { after, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cronTickMs, DOCUMENTED_TICK_MS, healthStatus, LONGEST_GAP_MS, thresholdFor, THRESHOLD_MS } from './health.ts';
import { MISSING_SHARD_MS } from './sync-shard.ts';
import { ROUND_MS } from './sync.ts';
import { logSafe } from './privacy-log.ts';
import { homePreview } from './home-preview.ts';

const hasDb = !!process.env.DATABASE_URL;
const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

test('health threshold: the documented 5-minute cron reads degraded after MISSING_SHARD_MS, an hourly one after a round plus that margin', () => {
  const now = Date.UTC(2026, 10, 1, 12);
  const at = (ms: number) => new Date(now - ms);
  // Documented schedule (docs/SYNC.md: every 5 minutes, never at :30).
  assert.equal(cronTickMs({}), DOCUMENTED_TICK_MS);
  assert.equal(cronTickMs({ SYNC_CRON_EVERY_MIN: '5' }), 5 * 60_000);
  const five = thresholdFor(cronTickMs({}));
  assert.equal(five, MISSING_SHARD_MS);
  assert.ok(LONGEST_GAP_MS < five, 'the skipped :30 tick never reads degraded');
  assert.equal(healthStatus({ dbOk: true, last: at(LONGEST_GAP_MS), stalest: null }, now, five).status, 'ok');
  assert.equal(healthStatus({ dbOk: true, last: at(MISSING_SHARD_MS + 60_000), stalest: null }, now, five).status, 'degraded');
  assert.equal(healthStatus({ dbOk: true, last: at(30 * 60_000), stalest: null }, now, five).status, 'degraded'); // a stalled cron is seen within the margin
  // Hourly host cron.
  const hourly = thresholdFor(cronTickMs({ SYNC_CRON_EVERY_MIN: '60' }));
  assert.equal(hourly, ROUND_MS + MISSING_SHARD_MS);
  assert.equal(healthStatus({ dbOk: true, last: at(ROUND_MS + 60_000), stalest: null }, now, hourly).status, 'ok');
  assert.equal(healthStatus({ dbOk: true, last: at(ROUND_MS + MISSING_SHARD_MS + 60_000), stalest: null }, now, hourly).status, 'degraded');
  assert.equal(healthStatus({ dbOk: true, last: null, stalest: null }, now, hourly).thresholdHours, 1.25);
  // Unparsable values fall back to the documented schedule; the process default is that schedule.
  for (const v of ['', 'x', '0', '-5', '1.5', '100000']) assert.equal(cronTickMs({ SYNC_CRON_EVERY_MIN: v }), DOCUMENTED_TICK_MS, v);
  assert.equal(THRESHOLD_MS, thresholdFor(cronTickMs()));
  assert.match(read('.env.example'), /^SYNC_CRON_EVERY_MIN=$/m);
});

test('the delete-screen notes line shows when its check fails (a query that really fails, not a source match)', { skip: !hasDb && 'no DATABASE_URL' }, async () => {
  const { notesLineApplies } = await import('./delete.ts');
  const lines: string[] = [];
  const m = mock.method(console, 'error', (...a: unknown[]) => { lines.push(a.map(String).join(' ')); });
  try {
    // NaN is not an integer: the database refuses the parameter (22P02), so the check throws and must fail open.
    assert.equal(await notesLineApplies(Number.NaN), true);
  } finally { m.mock.restore(); }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^delete notice check failed (PostgresError|DbError) code [0-9A-Z]{5}$/);
});

test('the home card is keyed by the demo state: the metadata names it, the image route draws it and reads no data', () => {
  const page = read('app/page.tsx');
  assert.match(page, /url: `\/home-card\?d=\$\{demo \? 1 : 0\}`/);
  assert.match(page, /const p = homePreview\(demo\);/); // the same state the page's text uses
  const card = read('app/home-card/route.tsx');
  assert.doesNotMatch(card, /demoShown|from '@\/lib\/db/);
  assert.match(card, /homePreview\(new URL\(req\.url\)\.searchParams\.get\('d'\) !== '0'\)/);
  assert.notEqual(homePreview(true).cardText, homePreview(false).cardText);
});

test('logSafe gives a minified class name a stable label: DbError with a SQLSTATE, else Error; real names are kept', () => {
  class u extends Error {}
  class Ab extends Error {}
  assert.equal(logSafe(Object.assign(new u('password authentication failed for user x'), { code: '28P01' })), 'DbError code 28P01');
  assert.equal(logSafe(Object.assign(new Ab('x'), { code: 'ECONNREFUSED' })), 'Error code ECONNREFUSED');
  assert.equal(logSafe(new u('x')), 'Error');
  class PostgresError extends Error {}
  assert.equal(logSafe(Object.assign(new PostgresError('x'), { code: '23505' })), 'PostgresError code 23505');
  assert.equal(logSafe(Object.assign(new Error('x'), { code: '23505' })), 'Error code 23505'); // unchanged (privacy-logs.test.ts)
  class CronUnauthorized extends Error { readonly status = 401; }
  assert.equal(logSafe(new CronUnauthorized()), 'CronUnauthorized status 401');
});
