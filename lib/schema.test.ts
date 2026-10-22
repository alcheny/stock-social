import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

// db/schema.sql is applied by every DB-backed test file in parallel (and by CI from an empty database). A repeat apply
// must take no table lock: `add column if not exists` / `create index if not exists` lock the table before noticing
// nothing is missing, and that deadlocked against another file's inserts (F-1 PR-1 fix round 1, 40P01).
const ddl = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const bare = ddl.replace(/--.*$/gm, '');
const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);

test('schema: additions go through the catalog-checked helpers, the backfill is guarded, applies are serialized', () => {
  assert.doesNotMatch(bare, /add column if not exists/i);
  assert.doesNotMatch(bare, /create index if not exists/i);
  assert.match(bare, /create or replace function schema_add_column/);
  assert.match(bare, /create or replace function schema_add_index/);
  assert.ok(bare.match(/select schema_add_column\(/g)!.length >= 16);
  assert.ok(bare.match(/select schema_add_index\(/g)!.length >= 8);
  // The set-not-null (an ACCESS EXCLUSIVE lock) only inside the guard that checks the column is still nullable.
  const guarded = bare.match(/do \$b\$[\s\S]*?end \$b\$;/)![0];
  assert.match(guarded, /is_nullable = 'YES'/);
  assert.match(guarded, /alter table users alter column signup_attempt_id set not null/);
  assert.equal(bare.split('alter table users alter column signup_attempt_id set not null').length, 2);
  assert.match(bare, /pg_advisory_xact_lock\(hashtext\('db\/schema.sql'\)\)/);
  assert.doesNotMatch(bare, /\b(drop|truncate)\b|delete\s+from/i);
});

dbTest('a repeat apply waits on no table lock while another session holds an open insert into users and activities', async () => {
  const url = process.env.DATABASE_URL!;
  const holder = postgres(url, { max: 1, onnotice: () => {} });
  const applier = postgres(url, { max: 1, onnotice: () => {} });
  const tag = `lock${Math.random().toString(36).slice(2, 8)}`;
  let release!: () => void;
  let inserted!: () => void;
  const released = new Promise<void>((r) => (release = r));
  const ready = new Promise<void>((r) => (inserted = r));
  // An open transaction holding RowExclusive on users, signup_attempts and activities (and the FK row shares).
  const open = holder.begin(async (tx) => {
    const [a] = await tx`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
    const [u] = await tx`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${tag}, 'x', now(), ${a.id}) returning id`;
    await tx`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
      values (${u.id}, 'demo', ${tag}, ${tag}, 'AAPL', 'BUY', 1, 1, now(), '{}')`;
    inserted();
    await released;
    throw new Error('rollback'); // nothing of this test stays in the database
  }).catch(() => {});
  try {
    await ready;
    await applier.unsafe(`set lock_timeout = '3000'`);
    await applier.unsafe(ddl).simple(); // any wait on a table lock fails here with "canceling statement due to lock timeout"
    await applier.unsafe(ddl).simple();
  } finally {
    release();
    await open;
    await holder.end({ timeout: 1 });
    await applier.end({ timeout: 1 });
  }
});
