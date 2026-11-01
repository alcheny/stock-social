// F-1 PR-2b fix round 2 (engineer, Low): the import poll's per-trader minimum interval. Security hardening
// (2026-11-01): shared by every server instance (a row per key in rate_marks), no longer per process.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const keys: string[] = [];
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (keys.length) await sql`delete from rate_marks where key in ${sql(keys)}`;
  await sql.end({ timeout: 1 });
});

test('intervalAllowed: one call per key per interval, shared by every instance; other keys are independent; old marks are pruned', { skip: !hasDb && 'no DATABASE_URL' }, async () => {
  const { intervalAllowed, pruneRateMarks } = await import('./rate-limit.ts');
  const { sql } = await import('./db.ts');
  const tag = `test-step:${Math.random().toString(36).slice(2, 10)}`;
  const [u1, u2] = [`${tag}:u1`, `${tag}:u2`];
  keys.push(u1, u2);
  const t = (ms: number) => new Date(Date.UTC(2030, 0, 1) + ms);
  assert.equal(await intervalAllowed(u1, 1_000, t(10_000)), true);
  assert.equal(await intervalAllowed(u1, 1_000, t(10_500)), false);
  assert.equal(await intervalAllowed(u1, 1_000, t(10_999)), false);
  assert.equal(await intervalAllowed(u2, 1_000, t(10_999)), true); // another trader
  assert.equal(await intervalAllowed(u1, 1_000, t(11_000)), true); // a second later
  assert.equal(await intervalAllowed(u1, 1_000, t(11_000)), false); // a second call in the same instant: refused
  // Parallel calls in the same instant (as from many tabs or instances): exactly one passes.
  const got = await Promise.all(Array.from({ length: 8 }, () => intervalAllowed(u1, 1_000, t(20_000))));
  assert.equal(got.filter(Boolean).length, 1);
  // Bounded: marks older than a day go.
  const old = `${tag}:old`;
  keys.push(old);
  await intervalAllowed(old, 1_000, new Date(Date.now() - 3 * 86_400_000));
  await pruneRateMarks();
  assert.equal((await sql`select 1 from rate_marks where key = ${old}`).length, 0);
  assert.equal((await sql`select 1 from rate_marks where key = ${u1}`).length, 1);
});

test('the step route answers 429 with Retry-After at most once a second per trader, 401 signed out, and no-store on every answer', () => {
  const src = readFileSync(new URL('../app/api/import/step/route.ts', import.meta.url), 'utf8');
  assert.match(src, /await intervalAllowed\(`import-step:\$\{me\.id\}`, STEP_MIN_MS\)/);
  assert.doesNotMatch(readFileSync(new URL('./rate-limit.ts', import.meta.url), 'utf8'), /minInterval|per process, not shared/);
  assert.match(src, /const STEP_MIN_MS = 1_000/);
  assert.match(src, /status: 429, headers: \{ \.\.\.noStore, 'retry-after': '1' \}/);
  assert.match(src, /status: 401, headers: noStore/);
  assert.match(src, /\{ headers: noStore \}\);/);
});
