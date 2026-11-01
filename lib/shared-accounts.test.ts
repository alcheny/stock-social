// Known limit removed 2026-11-01 (item 4): profiles that shared one broker account before the TR-6 claim. Detected and
// counted, marked only when the owner asks, and a marked account leaves only the non-claimant's record on a rebuild the
// owner asks for. Nothing is deleted from activities; the claimant's record is unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

test('schema: marks are an additive table that only the owner\'s script fills', () => {
  assert.match(schema, /create table if not exists shared_account_marks/);
  assert.doesNotMatch(schema.replace(/--.*$/gm, ''), /insert into shared_account_marks/, 'the schema apply never marks');
  const sync = readFileSync(new URL('./sync.ts', import.meta.url), 'utf8');
  // Fixes cycle 3 (council cycle 3: "rename-chain read lacks notShared"): the chain read is the third.
  assert.equal(sync.match(/notShared\(tx, userId\)/g)?.length, 3, 'the rebuild leaves marked accounts out of its read, its rename-chain read and its future count');
});

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => {
  if (hasDb) await (await import('./db.ts')).sql.unsafe(schema).simple();
});
after(async () => {
  if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 });
});

dbTest('report, mark, rebuild: the claimant keeps the shared account; the other profile loses only it; nothing deleted; counts only in the output', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const { run } = await import('../scripts/shared-accounts.ts');
  const { sharedReport } = await import('./shared-accounts.ts');
  const tag = `sa${Math.random().toString(36).slice(2, 8)}`;
  const [a, b, c] = (await sql`
    with x as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, 3) returning id),
         n as (select id, row_number() over (order by id) as k from x)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || k, ${tag} || k, now(), id from n order by k returning id`).map((r) => r.id as number);
  const shared = `${tag}-shared`, own = `${tag}-own`;
  const trip = async (u: number, acct: string, ext: string, source = 'snaptrade', sym = 'SHR') => {
    await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw) values
      (${u}, ${source}, ${`${ext}-b`}, ${acct}, ${sym}, 'BUY', 1, 100, now() - interval '5 days', '{}'::jsonb),
      (${u}, ${source}, ${`${ext}-s`}, ${acct}, ${sym}, 'SELL', 1, 110, now() - interval '4 days', '{}'::jsonb)`;
  };
  try {
    // The claimant (earliest activity) and the other profile, both with activities of the shared account.
    await sql`insert into broker_accounts (account_id, user_id) values (${shared}, ${a}), (${own}, ${b})`;
    await trip(a, shared, `${tag}-a1`);
    await trip(b, shared, `${tag}-b1`);
    await trip(b, shared, `${tag}-b2`);
    await trip(b, own, `${tag}-b3`, 'snaptrade', 'OWN');
    await trip(c, shared, `${tag}-c1`, 'demo'); // demo rows are never a shared case
    await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct) values (${b}, ${shared}, 'SHR', 0.1), (${b}, ${own}, 'OWN', -0.2)`;
    for (const u of [a, b, c]) await rebuildTrades(u);
    await sql`update closed_trades set thesis = 'a reason', thesis_status = 'published' where sell_id = ${`${tag}-b1-s`}`;
    const record = async (u: number) => (await sql`select sell_id, return_pct, closed_at from closed_trades where user_id = ${u} order by sell_id`).map((r) => `${r.sell_id}|${r.return_pct}|${r.closed_at.toISOString()}`);
    const claimant = await record(a);
    const activities = async () => (await sql`select count(*)::int as n from activities where user_id = any(${[a, b, c]})`)[0].n as number;
    const acts = await activities();
    const scope = [a, b, c];
    assert.deepEqual(await sharedReport(sql, scope), { accounts: 1, profiles: 1, activities: 4, marked: 0, unmarked: 1, markedProfiles: 0 });

    const lines: string[] = [];
    const out = (l: string) => lines.push(l);
    // Report and --rebuild without marks change nothing.
    await run([], out, scope);
    await run(['--rebuild'], out, scope);
    assert.equal((await record(b)).length, 3);
    assert.equal((await sharedReport(sql, scope)).marked, 0, 'only --mark marks');
    // --mark marks once; marking alone changes no record.
    await run(['--mark'], out, scope);
    await run(['--mark'], out, scope);
    assert.deepEqual(lines.filter((l) => l.startsWith('marked now')), ['marked now: 1', 'marked now: 0']);
    assert.equal((await record(b)).length, 3);
    // --rebuild: the shared account leaves the other profile's record and positions; its own account stays.
    await run(['--rebuild'], out, scope);
    assert.deepEqual((await record(b)).map((r) => r.split('|')[0]), [`${tag}-b3-s`]);
    assert.deepEqual((await sql`select account_id from open_positions where user_id = ${b}`).map((r) => r.account_id), [own]);
    assert.equal((await sql`select thesis from kept_theses where user_id = ${b} and sell_id = ${`${tag}-b1-s`}`)[0]?.thesis, 'a reason', 'the thesis is kept');
    assert.deepEqual(await record(a), claimant, 'the claimant\'s record is unchanged');
    assert.equal((await record(c)).length, 1, 'demo record unchanged');
    assert.equal(await activities(), acts, 'no activity deleted');
    // A later rebuild (a sync, an import step) keeps the account out.
    await rebuildTrades(b);
    assert.equal((await record(b)).length, 1);
    assert.deepEqual(await sharedReport(sql, scope), { accounts: 1, profiles: 1, activities: 4, marked: 1, unmarked: 0, markedProfiles: 1 });
    // Counts only: no id, handle, account id or symbol in any line.
    for (const l of lines) {
      assert.match(l, /^[a-z ]+: (\d+|\{("[a-zA-Z]+":\d+,?)+\})$/, l);
      for (const bad of [tag, String(a), String(b), 'SHR', 'OWN']) assert.ok(!l.includes(bad), l);
    }
  } finally {
    await sql`delete from users where id = any(${[a, b, c]})`;
    await sql`delete from broker_accounts where account_id in (${shared}, ${own})`;
  }
});

dbTest('the report over the whole database is one line of counts', async () => {
  const { run } = await import('../scripts/shared-accounts.ts');
  const lines: string[] = [];
  await run([], (l) => lines.push(l));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^shared accounts: \{"accounts":\d+,"profiles":\d+,"activities":\d+,"marked":\d+,"unmarked":\d+,"markedProfiles":\d+\}$/);
});
