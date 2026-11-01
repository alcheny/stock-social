// Chores cycle 5 (C5-43 part b; approval council cycle 5: lands before any MATCHER_VERSION bump). The sync tick's
// matcher catch-up: a version bump over 50 fictional records is drained by repeated shard calls, with no deploy, and the
// version is marked done once none is left. Each test uses its own version number and only its own records (`ids`);
// only rows this file creates are read or deleted.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

// A version no deploy uses (smallint), picked per test so parallel files never share one.
const privateVersion = () => 20000 + Math.floor(Math.random() * 12000);

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { insertActivities } = await import('./sync.ts');
  const tag = `c5m${Math.random().toString(36).slice(2, 10)}`;
  const made: number[] = [];
  const versions: number[] = [];
  const mkRecord = async (n: string, buy = 10, sell = 11) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` });
    made.push(u.id);
    await insertActivities(u.id, 'snaptrade', [
      { externalId: `${tag}-${n}-b`, accountId: `${tag}-acc`, symbol: 'FAKE', side: 'BUY', units: 10, price: buy, fee: 0, executedAt: new Date('2026-10-01T14:00:00Z'), verified: true, raw: {} },
      { externalId: `${tag}-${n}-s`, accountId: `${tag}-acc`, symbol: 'FAKE', side: 'SELL', units: 10, price: sell, fee: 0, executedAt: new Date('2026-10-02T14:00:00Z'), verified: true, raw: {} },
    ]);
    return u.id;
  };
  const version = () => { const v = privateVersion(); versions.push(v); return v; };
  const cleanup = async () => {
    if (versions.length) await sql`delete from matcher_runs where version in ${sql(versions)}`;
    if (made.length) await sql`delete from users where id in ${sql(made)}`;
  };
  return { sql, tag, made, mkRecord, version, cleanup };
}

dbTest('C5-43(b) catch-up: a version bump over 50 records is drained by shard calls with no deploy, then marked done', async () => {
  const { sql, tag, made, mkRecord, version, cleanup } = await setup();
  const { catchUpMatcher } = await import('./matcher-rebuild.ts');
  try {
    for (let i = 0; i < 50; i++) await mkRecord(`r${i}`);
    const ids = [...made];
    // One record still shows a figure the old matcher published (the test's own fixture row; production never patches
    // closed_trades): the catch-up must replace it with the current matcher's +10%.
    await sql`update closed_trades set return_pct = 0.5 where user_id = ${ids[0]}`;
    const v = version();
    const of = 3;
    let rebuilt = 0, calls = 0, done = false;
    // The cron's shard calls in turn (shard 0, 1, 2, 0, …), each with a small batch, until the version is done.
    while (!done && calls < 60) {
      const r = await catchUpMatcher({ shard: { shard: calls % of, of }, version: v, ids, batch: 4 });
      assert.ok(r, 'a version not yet done is never skipped');
      assert.equal(r.failed, 0);
      rebuilt += r.rebuilt;
      done = r.done;
      calls++;
    }
    assert.equal(done, true);
    assert.equal(rebuilt, 50);
    // Every record carries the version, and the old figure is gone.
    const [{ n }] = await sql`select count(*)::int as n from matcher_rebuilt where user_id in ${sql(ids)} and version = ${v}`;
    assert.equal(n, 50);
    const [c] = await sql`select return_pct from closed_trades where user_id = ${ids[0]} and sell_id = ${`${tag}-r0-s`}`;
    assert.equal(+(+c.return_pct).toFixed(6), 0.1);
    const [run] = await sql`select 1 as ok from matcher_runs where version = ${v}`;
    assert.equal(run?.ok, 1);
    // Done: later ticks cost one primary-key read and rebuild nothing.
    assert.equal(await catchUpMatcher({ shard: { shard: 0, of }, version: v, ids }), null);
  } finally {
    await cleanup();
  }
});

dbTest('C5-43(b) catch-up: a shard rebuilds only its own records, and the version stays open while another shard has some left', async () => {
  const { sql, made, mkRecord, version, cleanup } = await setup();
  const { catchUpMatcher } = await import('./matcher-rebuild.ts');
  try {
    for (let i = 0; i < 6; i++) await mkRecord(`s${i}`);
    const ids = [...made];
    const v = version();
    const mine = ids.filter((id) => id % 2 === 0), theirs = ids.filter((id) => id % 2 === 1);
    const r = await catchUpMatcher({ shard: { shard: 0, of: 2 }, version: v, ids });
    assert.deepEqual(r, { rebuilt: mine.length, failed: 0, busy: 0, left: 0, done: theirs.length === 0 });
    const rows = await sql`select user_id from matcher_rebuilt where user_id in ${sql(ids)} and version = ${v} order by user_id`;
    assert.deepEqual(rows.map((x) => x.user_id), mine.sort((a, b) => a - b));
    if (theirs.length) {
      const [open] = await sql`select 1 from matcher_runs where version = ${v}`;
      assert.equal(open, undefined, 'the other shard still has records: the version is not done');
      const r2 = await catchUpMatcher({ shard: { shard: 1, of: 2 }, version: v, ids });
      assert.deepEqual(r2, { rebuilt: theirs.length, failed: 0, busy: 0, left: 0, done: true });
    }
  } finally {
    await cleanup();
  }
});

dbTest('C5-43(b) catch-up: a record whose sync holds its lock is skipped, not waited on, and rebuilt by the next call', async () => {
  const { sql, made, mkRecord, version, cleanup } = await setup();
  const { catchUpMatcher } = await import('./matcher-rebuild.ts');
  const { USER_LOCK } = await import('./sync.ts');
  const conn = await sql.reserve();
  try {
    await mkRecord('l0');
    await mkRecord('l1');
    const ids = [...made];
    const v = version();
    // Another session holds the first record's lock, as a sync in flight does.
    await conn`select pg_advisory_lock(${USER_LOCK}, ${ids[0]})`;
    const r = await catchUpMatcher({ shard: { shard: 0, of: 1 }, version: v, ids });
    assert.deepEqual(r, { rebuilt: 1, failed: 0, busy: 1, left: 1, done: false });
    await conn`select pg_advisory_unlock(${USER_LOCK}, ${ids[0]})`;
    const r2 = await catchUpMatcher({ shard: { shard: 0, of: 1 }, version: v, ids });
    assert.deepEqual(r2, { rebuilt: 1, failed: 0, busy: 0, left: 0, done: true });
  } finally {
    conn.release();
    await cleanup();
  }
});

dbTest('C5-43(b) catch-up: the time budget stops the call before the next record; the rest wait for the next tick', async () => {
  const { made, mkRecord, version, cleanup } = await setup();
  const { catchUpMatcher } = await import('./matcher-rebuild.ts');
  try {
    for (let i = 0; i < 3; i++) await mkRecord(`t${i}`);
    const ids = [...made];
    const v = version();
    // A clock that moves 10 ms per read and a 15 ms budget: the first record starts at 0 ms, the second check reads 20 ms.
    let t = 0;
    const r = await catchUpMatcher({ shard: { shard: 0, of: 1 }, version: v, ids, budgetMs: 15, now: () => (t += 10) - 10 });
    assert.deepEqual(r, { rebuilt: 1, failed: 0, busy: 0, left: 2, done: false });
    const r2 = await catchUpMatcher({ shard: { shard: 0, of: 1 }, version: v, ids });
    assert.deepEqual(r2, { rebuilt: 2, failed: 0, busy: 0, left: 0, done: true });
  } finally {
    await cleanup();
  }
});

dbTest('C5-43(b) catch-up: records with no stored rows are never selected, so they never hold a version open', async () => {
  const { sql, made, version, cleanup } = await setup();
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { catchUpMatcher } = await import('./matcher-rebuild.ts');
  try {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `c5mempty${Math.random().toString(36).slice(2, 8)}` });
    made.push(u.id);
    const v = version();
    assert.deepEqual(await catchUpMatcher({ shard: { shard: 0, of: 1 }, version: v, ids: [u.id] }), { rebuilt: 0, failed: 0, busy: 0, left: 0, done: true });
    const [m] = await sql`select 1 from matcher_rebuilt where user_id = ${u.id}`;
    assert.equal(m, undefined);
  } finally {
    await cleanup();
  }
});

test('C5-43(b) route: every shard call runs the catch-up after its sync, never the housekeeping-only call, in its own try/catch', () => {
  const route = readFileSync(new URL('../app/api/sync/route.ts', import.meta.url), 'utf8');
  const at = (s: string) => route.indexOf(s);
  assert.ok(at('await runShard(') > 0 && at('await runShard(') < at('await catchUpMatcher('));
  assert.match(route, /try \{ if \(syncs && left\(\) > 0\) matcher = await catchUpMatcher\(\{ shard, budgetMs: Math\.min\(MATCHER_CATCHUP_MS, left\(\)\) \}\); \} catch \(e\) \{ console\.error\('matcher catch-up failed', logSafe\(e\)\); \}/);
  assert.match(route, /run: run \? counters : null, matcher,/);
});
