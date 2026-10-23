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

// Committee fix (Low, PR-2a round 6): the one-time snapshot blanking is an idempotent update, never a delete, and only
// touches declined or expired rows that cleanup finished more than 24 h after they ended.
dbTest('schema: a repeat apply blanks accounts and institution on cleaned declined/expired rows older than 24 h, and nothing else', async () => {
  assert.match(bare, /update connections set accounts = '\[\]'::jsonb, institution = null\s+where state in \('declined', 'expired'\) and cleanup_done_at is not null/);
  const db = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const snap = JSON.stringify([{ id: 'acct-x', authorizationId: 'auth-x', institution: 'Test Broker', paper: false }]);
  try {
    await db.unsafe(ddl).simple();
    const [a] = await db`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
    const mk = (state: string, ended: string, cleaned: boolean) => db.unsafe(
      `insert into connections (attempt_id, state, institution, accounts, pending_at, ${state === 'declined' ? 'declined_at' : state === 'expired' ? 'expired_at' : 'connected_at'}, cleanup_done_at)
       values ($1, $2, 'Test Broker', $3::text::jsonb, now() - interval '${ended}', now() - interval '${ended}', ${cleaned ? 'now()' : 'null'}) returning id`,
      [a.id, state, snap]).then((r) => Number(r[0].id));
    const ids = {
      oldDeclined: await mk('declined', '30 hours', true),
      oldExpired: await mk('expired', '48 hours', true),
      freshDeclined: await mk('declined', '1 hour', true),
      uncleaned: await mk('expired', '48 hours', false), // cleanup still needs the snapshot to remove the link
      connected: await mk('connected', '48 hours', true),
    };
    await db.unsafe(ddl).simple();
    await db.unsafe(ddl).simple(); // idempotent
    const rows = await db`select id, state, accounts, institution, cleanup_done_at from connections where attempt_id = ${a.id} order by id`;
    assert.equal(rows.length, 5); // no row deleted
    const by = new Map(rows.map((r) => [Number(r.id), r]));
    for (const id of [ids.oldDeclined, ids.oldExpired]) assert.deepEqual([by.get(id)!.accounts, by.get(id)!.institution], [[], null]);
    for (const id of [ids.freshDeclined, ids.connected]) {
      assert.equal(by.get(id)!.accounts.length, 1);
      assert.equal(by.get(id)!.institution, 'Test Broker');
    }
    // The uncleaned row is exactly what the connection tick cleans, and a test file running alongside may tick while
    // this one applies the schema. So the check is on the invariant itself: as long as the row is still uncleaned, its
    // snapshot is intact (the apply never blanks it). If a concurrent tick's cleanup finished it, cleanup itself
    // blanked it and recorded cleanup_done_at; that is the cleanup's job, not the apply's.
    const u = by.get(ids.uncleaned)!;
    assert.equal(u.state, 'expired');
    if (u.cleanup_done_at === null) assert.deepEqual([u.accounts.length, u.institution], [1, 'Test Broker']);
    else assert.deepEqual([u.accounts, u.institution], [[], null]);
    await db`delete from connections where attempt_id = ${a.id}`;
    await db`delete from signup_attempts where id = ${a.id}`;
  } finally {
    await db.end({ timeout: 1 });
  }
});
