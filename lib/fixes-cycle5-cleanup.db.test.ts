// Fixes cycle 5 (docs/features/logs/fixes-cycle5/plan-round2.md), F5-16 (C5-14): lib/trades-prompt.db.test.ts and
// lib/f15-share-action.db.test.ts delete what they create. Each suite runs twice as a child `node --test` against a
// schema of its own (search_path, so only that suite's rows are counted and no concurrent suite can move a count): the
// row count of every table is the same after each run as on the fresh schema. The schema is this test's own and is
// removed at the end. The suite-wide CI check is an owner item (.github is protected).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hasDb = !!process.env.DATABASE_URL;
const made: string[] = [];
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  for (const s of made) await sql.unsafe(`drop schema if exists ${s} cascade`); // this test's own schemas only
  await sql.end({ timeout: 1 });
});

const counts = async (schema: string) => {
  const { sql } = await import('./db.ts');
  const tables = (await sql`select table_name as t from information_schema.tables where table_schema = ${schema} and table_type = 'BASE TABLE' order by table_name`).map((r) => r.t as string);
  const out: Record<string, number> = {};
  for (const t of tables) out[t] = (await sql.unsafe(`select count(*)::int as n from ${schema}."${t}"`))[0].n as number;
  return out;
};

const runSuite = (file: string, schema: string) => {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('search_path', schema);
  // A child of the test runner reports over the parent's channel unless NODE_TEST_CONTEXT is cleared.
  const { NODE_TEST_CONTEXT: _ctx, ...env } = process.env;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', fileURLToPath(new URL(file, import.meta.url))], {
    env: { ...env, DATABASE_URL: url.toString() }, encoding: 'utf8', timeout: 240_000,
  });
  assert.equal(r.status, 0, `${file} failed:\n${r.stdout.slice(-3000)}\n${r.stderr.slice(-2000)}`);
  assert.match(r.stdout, /# fail 0/);
  assert.doesNotMatch(r.stdout, /# pass 0\b/, 'the suite ran its tests against the database');
};

for (const file of ['./trades-prompt.db.test.ts', './f15-share-action.db.test.ts']) {
  test(`F5-16: ${file.slice(2)} run twice leaves every table's row count as on a fresh schema`, { skip: !hasDb && 'no DATABASE_URL', timeout: 600_000 }, async () => {
    const { sql } = await import('./db.ts');
    const schema = `fc5clean_${Math.random().toString(36).slice(2, 10)}`;
    made.push(schema);
    await sql.unsafe(`create schema ${schema}`);
    // The suite's own before hook applies db/schema.sql into the schema on its first run; the baseline is taken after a
    // run of the schema alone (its seeded lookup rows), so only the suite's rows can differ.
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('search_path', schema);
    const postgres = (await import('postgres')).default;
    const own = postgres(url.toString(), { onnotice: () => {}, max: 1 });
    try {
      const { readFileSync } = await import('node:fs');
      await own.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
    } finally { await own.end({ timeout: 1 }); }
    const fresh = await counts(schema);
    assert.ok(Object.keys(fresh).includes('users') && Object.keys(fresh).includes('signup_attempts'), 'the schema was applied');
    runSuite(file, schema);
    const first = await counts(schema);
    runSuite(file, schema);
    const second = await counts(schema);
    assert.deepEqual(first, fresh, 'the first run left rows behind');
    assert.deepEqual(second, fresh, 'the second run left rows behind');
  });
}
