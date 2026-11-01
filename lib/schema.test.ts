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
  const url = process.env.DATABASE_URL!;
  const db = postgres(url, { max: 1, onnotice: () => {} });
  // The uncleaned row is exactly what the connection tick cleans (it cleans every uncleaned declined or expired row in
  // the database), and another test file may tick while this one applies the schema. So a second session holds that
  // row's lock from just after it is committed until it is deleted: a concurrent tick's cleanup blocks on its final
  // update and then finds the row gone, and the apply (whose predicate the row fails) never waits on it.
  const holder = postgres(url, { max: 1, onnotice: () => {} });
  let release!: () => void;
  const released = new Promise<void>((r) => (release = r));
  let open: Promise<unknown> = Promise.resolve();
  const snap = JSON.stringify([{ id: 'acct-x', authorizationId: 'auth-x', institution: 'Test Broker', paper: false }]);
  let attempt: number | null = null;
  try {
    await db.unsafe(ddl).simple();
    const [a] = await db`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
    attempt = Number(a.id);
    const mk = (state: string, ended: string, cleaned: boolean) => db.unsafe(
      `insert into connections (attempt_id, state, institution, accounts, pending_at, ${state === 'declined' ? 'declined_at' : state === 'expired' ? 'expired_at' : 'connected_at'}, cleanup_done_at)
       values ($1, $2, 'Test Broker', $3::text::jsonb, now() - interval '${ended}', now() - interval '${ended}', ${cleaned ? 'now()' : 'null'}) returning id`,
      [a.id, state, snap]).then((r) => Number(r[0].id));
    const ids = {
      oldDeclined: await mk('declined', '30 hours', true),
      oldExpired: await mk('expired', '48 hours', true),
      freshDeclined: await mk('declined', '1 hour', true),
      uncleaned: 0, // cleanup still needs the snapshot to remove the link; inserted and locked below
      connected: await mk('connected', '48 hours', true),
    };
    let locked!: (id: number) => void;
    const ready = new Promise<number>((r) => (locked = r));
    open = holder.begin(async (tx) => {
      // A tick may clean the row in the instant between its insert and the lock: then it is dropped and made again.
      for (;;) {
        const id = await mk('expired', '48 hours', false);
        const [r] = await tx`select cleanup_done_at from connections where id = ${id} for update`;
        if (r.cleanup_done_at === null) { locked(id); break; }
        await tx`delete from connections where id = ${id}`;
      }
      await released;
      await tx`delete from connections where id = ${ids.uncleaned}`; // still under the lock: no tick ever cleans it
    });
    ids.uncleaned = await Promise.race([ready, open.then(() => 0)]); // the holder failing rejects here
    assert.ok(ids.uncleaned > 0);
    await db.unsafe(ddl).simple();
    await db.unsafe(ddl).simple(); // idempotent
    const rows = await db`select id, state, accounts, institution, cleanup_done_at from connections where attempt_id = ${a.id} order by id`;
    assert.equal(rows.length, 5); // no row deleted
    const by = new Map(rows.map((r) => [Number(r.id), r]));
    for (const id of [ids.oldDeclined, ids.oldExpired]) assert.deepEqual([by.get(id)!.accounts, by.get(id)!.institution], [[], null]);
    for (const id of [ids.freshDeclined, ids.uncleaned, ids.connected]) {
      assert.equal(by.get(id)!.accounts.length, 1);
      assert.equal(by.get(id)!.institution, 'Test Broker');
    }
    assert.equal(by.get(ids.uncleaned)!.cleanup_done_at, null);
  } finally {
    release();
    await open;
    if (attempt !== null) {
      await db`delete from connections where attempt_id = ${attempt}`;
      await db`delete from signup_attempts where id = ${attempt}`;
    }
    await holder.end({ timeout: 1 });
    await db.end({ timeout: 1 });
  }
});

// Known limits sweep 2 (indexes): five lookup columns got indexes through the catalog-checked helper.
const NEW_INDEXES: [string, string, RegExp][] = [
  ['users_signup_attempt', 'users', /\(signup_attempt_id\)$/],
  ['identities_email', 'identities', /\(email\) WHERE \(email IS NOT NULL\)$/],
  ['login_links_email', 'login_links', /\(email\) WHERE \(email <> ''::text\)$/],
  ['connections_attempt', 'connections', /\(attempt_id\)$/],
  ['subscriptions_customer', 'subscriptions', /\(vendor_customer_id\)$/],
];

test('schema: the five lookup indexes go through schema_add_index and their ponytail notes are gone', () => {
  for (const [name, table] of NEW_INDEXES) assert.match(bare, new RegExp(`select schema_add_index\\('${name}', [$']+create index ${name} on ${table} \\(`));
  assert.doesNotMatch(ddl, /users\.signup_attempt_id has no index|sign-in by email scans identities|email match scans login_links|deletes scan connections|update by customer scans subscriptions/);
});

dbTest('schema: the five lookup indexes exist as defined', async () => {
  const db = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const rows = await db`select indexname, tablename, indexdef from pg_indexes where schemaname = current_schema() and indexname in ${db(NEW_INDEXES.map((i) => i[0]))}`;
    const by = new Map(rows.map((r) => [r.indexname as string, r]));
    for (const [name, table, def] of NEW_INDEXES) {
      assert.equal(by.get(name)?.tablename, table, name);
      assert.match(by.get(name)!.indexdef as string, def);
    }
  } finally { await db.end({ timeout: 1 }); }
});

// Plan checks: the real query texts (parameters as $1), explained (never executed) with seq scans off, so the result
// depends on the index being usable, not on table statistics other test files change in parallel.
const PLAN_CASES: [string, string, unknown[]][] = [
  ['identities_email', `select u.id, u.handle from identities i join users u on u.id = i.user_id where i.email = $1 and u.deleted_at is null limit 1`, ['x@example.com']], // lib/auth/attempts.ts
  ['subscriptions_customer', `update subscriptions set disputed_at = coalesce(disputed_at, now()), status = case when status = 'canceled' then status else 'unpaid' end, updated_at = now()
      where vendor_customer_id = $1 and status <> 'canceled' returning user_id, vendor_subscription_id`, ['cus_x']], // lib/billing.ts dispute
  ['subscriptions_customer', `update subscriptions set disputed_at = null, updated_at = now() where vendor_customer_id = $1 and disputed_at is not null returning vendor_subscription_id`, ['cus_x']],
  ['users_signup_attempt', `select 1 from only users x where signup_attempt_id = $1 for key share of x`, [1]], // the FK check on a signup_attempts delete
  ['connections_attempt', `select 1 from only connections x where attempt_id = $1 for key share of x`, [1]],
  ['connections_attempt', `delete from connections where attempt_id in ($1) and user_id is null`, [1]], // lib/privacy-purge.ts
  ['users_signup_attempt', `select a.id from signup_attempts a
      where a.user_id is null and a.completed_at is null and a.snaptrade_user_id is null
        and a.created_at < $1::timestamptz - 30 * interval '1 day'
        and not exists (select 1 from users u where u.signup_attempt_id = a.id)
        and not exists (select 1 from connections c where c.attempt_id = a.id
          and (c.user_id is not null or c.state in ('pending', 'importing', 'connected') or c.cleanup_done_at is null))
      order by a.created_at limit 100 for update skip locked`, [new Date()]], // lib/privacy-purge.ts#purgeUnfinishedAttempts
];

dbTest('schema: each lookup index is usable by its real query (explained with seq scans off)', async () => {
  const db = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    for (const [index, text, params] of PLAN_CASES) {
      await db.begin(async (tx) => {
        await tx`set local enable_seqscan = off`;
        const [row] = await tx.unsafe(`explain (format json) ${text}`, params as never[]);
        assert.match(JSON.stringify(row['QUERY PLAN']), new RegExp(`"Index Name":"${index}"`), `${index}: ${text.slice(0, 60)}`);
      });
    }
  } finally { await db.end({ timeout: 1 }); }
});
