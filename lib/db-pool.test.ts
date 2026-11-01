// Sharded sync (code review should-fix 3): DATABASE_POOL_MAX is clamped to 3..500, never silently replaced by 10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const poolMax = (v: string | undefined) => {
  const env: Record<string, string | undefined> = { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://x@127.0.0.1:1/x' };
  if (v === undefined) delete env.DATABASE_POOL_MAX; else env.DATABASE_POOL_MAX = v;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', "const m = await import('./lib/db.ts'); console.log(m.POOL_MAX); process.exit(0);"], { env: env as NodeJS.ProcessEnv, encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname });
  return Number(r.stdout.trim());
};

test('DATABASE_POOL_MAX: unset or junk is 10; 1 and 2 clamp to 3; 8 stays 8; 9999 clamps to 500', () => {
  assert.equal(poolMax(undefined), 10);
  assert.equal(poolMax('junk'), 10);
  assert.equal(poolMax('1'), 3);
  assert.equal(poolMax('2'), 3);
  assert.equal(poolMax('8'), 8);
  assert.equal(poolMax('9999'), 500);
});
