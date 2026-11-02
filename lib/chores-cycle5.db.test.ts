// Chores cycle 5 (docs/direction/cycle5-2026-11-01.md §6, ranks 9 and 21): C5-43 (a) the status facts read in constant
// time per trader, (d) the TR-5 freeze marks on the database clock, and C5-40 the JIT flag in the coverage report.
// (C5-43 (c), the sitemap on the cron, is in lib/sitemaps.test.ts.) Fixtures are this file's own; the shared database's
// other rows are only read.
import { after, before, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { dbConfigCheck } from './sync-limits.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const H = 3_600_000, DAY = 24 * H;
const tagOf = (p: string) => `${p}${Math.random().toString(36).slice(2, 9)}`;

// ---- C5-43 (a): status facts in constant time ----

type Plan = { 'Node Type': string; 'Relation Name'?: string; 'Actual Rows'?: number; 'Actual Loops'?: number; 'Rows Removed by Filter'?: number; 'Rows Removed by Index Recheck'?: number; Plans?: Plan[] };
// Rows each table's scans read (returned plus filtered out), over every loop, from EXPLAIN ANALYZE. PostgreSQL 16
// reports a per-loop average rounded to an integer, so a scan over many loops can read slightly more than this says;
// a whole-record scan (one loop, every row) shows in full.
function rowsRead(plan: Plan, out: Record<string, number> = {}): Record<string, number> {
  if (plan['Relation Name']) {
    const loops = plan['Actual Loops'] ?? 1;
    const n = ((plan['Actual Rows'] ?? 0) + (plan['Rows Removed by Filter'] ?? 0) + (plan['Rows Removed by Index Recheck'] ?? 0)) * loops;
    out[plan['Relation Name']] = (out[plan['Relation Name']] ?? 0) + n;
  }
  for (const p of plan.Plans ?? []) rowsRead(p, out);
  return out;
}

dbTest('C5-43 (a): the status facts read a constant number of closed_trades and activities rows per trader (EXPLAIN), whatever the record size', async () => {
  const { sql } = await import('./db.ts');
  const { statusQuery, statusRows } = await import('./record-status-load.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = tagOf('c5a');
  const mk = async (n: string) => (await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` })).id;
  const [big, small] = [await mk('b'), await mk('s')];
  // Fictional filler traders, so the tables look like a feed's (many records) rather than one record: on a table that
  // is almost all one trader, a sequential scan that stops at the first match is the planner's legitimate cheap choice
  // for the small record, and says nothing about the council's 2 M-close scale (CI's fresh database showed it).
  const fillers: number[] = [];
  for (let k = 0; k < 12; k++) fillers.push(await mk(`f${k}`));
  const N = 3000;
  try {
    // The big record: N closes and 2N activities on two accounts, with a consented connection listing both (the
    // removal-date check runs per account). The small one: 3 closes on one account.
    for (const [u, n, accts] of [[big, N, 2], [small, 3, 1]] as const) {
      await sql`insert into connections (attempt_id, user_id, state, consent_at, connected_at, institution, accounts)
        select signup_attempt_id, id, 'connected', now() - interval '60 days', now(), 'Fake Brokerage',
          ${sql.json(Array.from({ length: accts }, (_, i) => ({ id: `${tag}-${u}-${i}`, authorizationId: 'a', institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true })))}
        from users where id = ${u}`;
      await sql`insert into broker_accounts (account_id, user_id, confirmed_at) select ${`${tag}-${u}-`} || i, ${u}, now() from generate_series(0, ${accts - 1}) i`;
      await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, fee, executed_at, raw)
        select ${u}, 'snaptrade', ${`${tag}-${u}-a`} || i, ${`${tag}-${u}-`} || (i % ${accts}), 'AAA', 'BUY', 1, 1, 0, now() - interval '400 days' + i * interval '1 minute', '{}'
        from generate_series(1, ${2 * n}) i`;
      await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
        select ${u}, ${`${tag}-${u}-s`} || i, 'a', 'AAA', now() - interval '300 days' + i * interval '1 minute', now() - interval '200 days' + i * interval '1 minute', 0.01, 1, true
        from generate_series(1, ${n}) i`;
    }
    await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, fee, executed_at, raw)
      select f, 'snaptrade', ${`${tag}-f-`} || f || '-' || i, ${`${tag}-f-`} || f, 'AAA', 'BUY', 1, 1, 0, now() - interval '400 days' + i * interval '1 minute', '{}'
      from unnest(${fillers}::int[]) f, generate_series(1, 4000) i`;
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      select f, ${`${tag}-f-`} || f || '-s' || i, 'a', 'AAA', now() - interval '300 days' + i * interval '1 minute', now() - interval '200 days' + i * interval '1 minute', 0.01, 1, true
      from unnest(${fillers}::int[]) f, generate_series(1, 2000) i`;
    await sql`analyze closed_trades`;
    await sql`analyze activities`;
    // Results: the same facts the old whole-record read gave (first entry, last close, account count).
    const [want] = await sql`select min(opened_at) as f, max(closed_at) as l from closed_trades where user_id = ${big}`;
    const rows = await statusRows([big, small]);
    assert.equal(rows.get(big)!.firstEntry?.getTime(), (want.f as Date).getTime());
    assert.equal(rows.get(big)!.lastClose?.getTime(), (want.l as Date).getTime());
    assert.deepEqual([rows.get(big)!.accounts, rows.get(small)!.accounts], [2, 1]);
    assert.equal(rows.get(big)!.source, 'broker');
    const read = async (ids: number[]) => {
      const [r] = await sql`explain (analyze, format json) ${statusQuery(ids)}`;
      return rowsRead((r['QUERY PLAN'] as { Plan: Plan }[])[0].Plan);
    };
    const one = await read([big]);
    const two = await read([small]);
    // Before (whole-record read): closed_trades N rows, activities 2N (the account count) plus 2N (the demo check) plus
    // 2N per listed account (the removal-date check). After: a few index rows per trader and account.
    assert.ok((one.closed_trades ?? 0) <= 4, `closed_trades rows read: ${one.closed_trades}`);
    assert.ok((one.activities ?? 0) <= 12, `activities rows read: ${one.activities}`);
    assert.equal(one.closed_trades ?? 0, two.closed_trades ?? 0, 'closed_trades: the same for 3 and 3,000 closes');
    assert.ok((one.activities ?? 0) <= (two.activities ?? 0) + 4, `activities: one more account, not more rows (${one.activities} vs ${two.activities})`);
  } finally {
    await sql`delete from users where id in ${sql([big, small, ...fillers])}`;
    await sql`delete from broker_accounts where account_id like ${`${tag}-%`}`;
  }
});

test('C5-43 (a): the schema has the (user_id, opened_at) index and the account-count index, added idempotently', () => {
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  assert.match(schema, /schema_add_index\('closed_trades_user_opened', 'create index closed_trades_user_opened on closed_trades \(user_id, opened_at\) where opened_at is not null'\)/);
  assert.match(schema, /schema_add_index\('activities_user_source_account', 'create index activities_user_source_account on activities \(user_id, source, account_id\) where account_id is not null'\)/);
});

// ---- C5-43 (d): the freeze marks on the database clock ----

dbTest('C5-43 (d): with the app clock skewed by 2 h, a connection freezes at exactly 24 h of database time after the first miss', async () => {
  const { sql } = await import('./db.ts');
  const { syncUser, FREEZE_CONFIRM_HOURS } = await import('./sync.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = tagOf('c5d');
  const acc = `${tag}-acc`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-vendor`, snaptrade_secret_enc: 'enc' };
  const [c] = await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', now(), now(), now(), ${sql.json([{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }])}
    from users where id = ${u.id} returning id`;
  const empty = { listAccounts: async () => [], fetchActivities: async () => [] };
  const conn = async () => (await sql`select missing_since, disconnected_at from connections where id = ${c.id}`)[0] as { missing_since: Date | null; disconnected_at: Date | null };
  const dbNow = async () => (await sql`select now() as t`)[0].t as Date;
  assert.equal(FREEZE_CONFIRM_HOURS, 24);
  try {
    // The instance's clock runs 2 h ahead of the database's.
    mock.timers.enable({ apis: ['Date'], now: Date.now() + 2 * H });
    const t0 = await dbNow();
    await syncUser(user, empty, undefined, undefined, { shiftMs: 0 });
    const missing = (await conn()).missing_since!;
    assert.ok(missing, 'the first empty list marks the connection missing');
    assert.ok(Math.abs(missing.getTime() - t0.getTime()) < 60_000, `missing_since on the database clock (${missing.toISOString()} vs ${t0.toISOString()})`);
    // The shift that puts the database's clock at `ms` past 24 h after the mark, computed by the database (microseconds;
    // the sync's transaction starts after this read, so its clock is at or past that point, by a few milliseconds).
    const shiftTo = async (ms: number) => Number((await sql`select extract(epoch from missing_since + interval '24 hours' - now()) * 1000 + ${ms}::float8 as s
      from connections where id = ${c.id}`)[0].s);
    // A list 1 s before 24 h of database time: not frozen (an app clock 2 h ahead would read 26 h).
    await syncUser(user, empty, undefined, undefined, { shiftMs: await shiftTo(-1_000) });
    assert.equal((await conn()).disconnected_at, null, 'not frozen before 24 h of database time');
    // The instance's clock now runs 2 h behind: a list at 24 h of database time freezes it (an app clock would read 22 h).
    mock.timers.setTime(t0.getTime() - 2 * H);
    await syncUser(user, empty, undefined, undefined, { shiftMs: await shiftTo(0) });
    assert.ok((await conn()).disconnected_at, 'frozen at 24 h of database time');
    const [{ past }] = await sql`select extract(epoch from disconnected_at - missing_since) * 1000 - ${DAY}::float8 as past from connections where id = ${c.id}`;
    assert.ok(Number(past) >= 0 && Number(past) < 1_000, `the freeze lands at 24 h of database time (${past} ms past)`);
  } finally {
    mock.timers.reset();
    await sql`delete from users where id = ${u.id}`;
    await sql`delete from broker_accounts where account_id = ${acc}`;
  }
});

// ---- C5-40: JIT off for the app role ----

test('C5-40: the coverage check flags JIT when it is on', () => {
  const plan = { shards: 1, workers: 6, maxSyncCostMs: 270_000, userLeaseMs: 600_000 };
  const good = { statementTimeoutMs: 60_000, idleInTxMs: 300_000, maxConnections: 100 };
  assert.deepEqual(dbConfigCheck({ ...good, jit: 1 }, plan), { ok: false, problems: ['jit is on'] });
  assert.deepEqual(dbConfigCheck({ ...good, jit: 0 }, plan), { ok: true, problems: [] });
  const doc = readFileSync(new URL('../docs/SYNC.md', import.meta.url), 'utf8');
  assert.match(doc, /alter role stock_social set jit = off;/);
});

dbTest('C5-40: the coverage report reads the session\'s JIT flag from the database (on and off) and flags it when on', async () => {
  const url = process.env.DATABASE_URL!;
  const on = postgres(url, { max: 1, onnotice: () => {}, connection: { jit: 'on' } });
  const off = postgres(url, { max: 1, onnotice: () => {}, connection: { jit: 'off' } }); // as `alter role … set jit = off` gives each session
  try {
    const { dbSettings, coverage } = await import('./sync-shard.ts');
    assert.equal((await dbSettings(on)).jit, 1);
    assert.equal((await dbSettings(off)).jit, 0);
    const { sql } = await import('./db.ts');
    const [{ jit }] = await sql`select current_setting('jit') = 'on' as jit`;
    const cov = await coverage(1, { ids: [] });
    assert.equal(cov.db.jit, jit ? 1 : 0);
    assert.ok(Object.values(cov.db).every((n) => typeof n === 'number'), 'db settings stay numbers (the log line)');
    assert.equal(cov.dbProblems.includes('jit is on'), jit);
  } finally {
    await on.end({ timeout: 1 });
    await off.end({ timeout: 1 });
  }
});
