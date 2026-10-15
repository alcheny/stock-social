import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ACCOUNT_CLAIMED_BODY, ACCOUNT_CLAIMED_TITLE, partitionClaims } from './claims.ts';

test('partitionClaims: only ids owned by someone else conflict', () => {
  const owners = new Map([['acc-1', 1], ['acc-2', 2]]);
  assert.deepEqual(partitionClaims(['acc-1', 'acc-2', 'acc-new'], owners, 2), ['acc-1']);
  assert.deepEqual(partitionClaims(['acc-2', 'acc-new'], owners, 2), []);
});

test('error copy leaks no handle, id or "try again"', () => {
  const copy = `${ACCOUNT_CLAIMED_TITLE} ${ACCOUNT_CLAIMED_BODY}`;
  assert.match(copy, /another Stock Social profile/);
  assert.doesNotMatch(copy, /@|acc-|try again|support/i);
});

test('schema is idempotent-safe: no drop/truncate/delete from, claims table present', () => {
  const s = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');
  assert.doesNotMatch(s, /\b(drop|truncate)\b|delete\s+from/i);
  assert.match(s, /create table if not exists broker_accounts/);
  assert.match(s, /on conflict \(account_id\) do nothing/);
});

// DB-backed tests: need DATABASE_URL with db/schema.sql applied; skipped otherwise.
const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);

// CI's database starts empty; the schema is idempotent, so apply it here.
before(async () => {
  if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
});

after(async () => {
  if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 });
});

async function setup() {
  const { sql } = await import('./db.ts');
  const tag = `t${Math.random().toString(36).slice(2, 12)}`;
  const mk = async (n: string) => (await sql`insert into users (handle, display_name, adult_attested_at) values (${`${tag}${n}`}, ${n}, now()) returning id`)[0].id as number;
  return { sql, tag, a: await mk('a'), b: await mk('b') };
}

dbTest('claim: B is rejected for an account A owns; mixed request rolls back; owner idempotent', async () => {
  const { sql, tag, a, b } = await setup();
  const { claimAccounts } = await import('./claims.ts');
  try {
    assert.deepEqual(await claimAccounts(a, [`${tag}-1`]), { ok: true });
    assert.deepEqual(await claimAccounts(a, [`${tag}-1`]), { ok: true });
    assert.equal((await sql`select 1 from broker_accounts where account_id = ${`${tag}-1`}`).length, 1);
    assert.deepEqual(await claimAccounts(b, [`${tag}-new`, `${tag}-1`]), { ok: false, conflicts: [`${tag}-1`] });
    assert.equal((await sql`select 1 from broker_accounts where user_id = ${b}`).length, 0);
    assert.equal((await sql`select 1 from activities where user_id = ${b}`).length, 0);
  } finally {
    await sql`delete from users where id in ${sql([a, b])}`;
  }
});

dbTest('syncUser: conflict throws, writes nothing, no rebuild; owner re-sync works; empty account still claimed', async () => {
  const { sql, tag, a, b } = await setup();
  const { syncUser } = await import('./sync.ts');
  const { AccountClaimedError } = await import('./claims.ts');
  const act = (id: string, accountId: string) => ({
    externalId: `${tag}-${id}`, accountId, symbol: 'AAPL', side: 'BUY' as const, units: 1, price: 10, fee: 0,
    executedAt: new Date('2025-01-02'), verified: true, raw: {},
  });
  const stub = (accounts: string[], acts: ReturnType<typeof act>[]) => ({
    listAccountIds: async () => accounts,
    fetchActivities: async () => acts,
  });
  const u = (id: number) => ({ id, snaptrade_user_id: 'x', snaptrade_secret_enc: 'y' });
  let rebuilds = 0;
  const rebuild = async () => { rebuilds++; };
  try {
    assert.equal(await syncUser(u(a), stub([`${tag}-1`, `${tag}-2`], [act('e1', `${tag}-1`)]), rebuild), 1);
    assert.equal((await sql`select 1 from broker_accounts where account_id = ${`${tag}-2`} and user_id = ${a}`).length, 1);
    assert.equal(await syncUser(u(a), stub([`${tag}-1`], [act('e1', `${tag}-1`)]), rebuild), 1);
    assert.equal(rebuilds, 2);
    await assert.rejects(syncUser(u(b), stub([`${tag}-1`], [act('e2', `${tag}-1`)]), rebuild), AccountClaimedError);
    assert.equal(rebuilds, 2);
    assert.equal((await sql`select 1 from activities where user_id = ${b}`).length, 0);
  } finally {
    await sql`delete from users where id in ${sql([a, b])}`;
  }
});

const DEMO = ['momentum_maya', 'dividend_dan', 'yolo_yuki'];

dbTest('seed (run twice) leaves demo data out of broker_accounts and closed_trades unchanged', async () => {
  const { sql } = await import('./db.ts');
  const { execFileSync } = await import('node:child_process');
  const seed = () => execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/seed.ts', import.meta.url))], { env: process.env, stdio: 'pipe' });
  const snap = async () => JSON.stringify(await sql`select ct.user_id, ct.sell_id, ct.return_pct from closed_trades ct join users u on u.id = ct.user_id where u.handle in ${sql(DEMO)} order by 1, 2`);
  seed();
  const before = await snap();
  seed();
  assert.equal(await snap(), before);
  assert.equal((await sql`select 1 from broker_accounts ba join activities a on a.account_id = ba.account_id where a.source = 'demo'`).length, 0);
  assert.equal((await sql`select 1 from broker_accounts ba join users u on u.id = ba.user_id where u.handle in ${sql(DEMO)}`).length, 0);
});

dbTest('schema applies twice; backfill is idempotent and the earliest owner wins a duplicate', async () => {
  const { sql, tag, a, b } = await setup();
  const ddl = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const acct = `${tag}-dup`;
  const ins = (uid: number, ext: string, at: string) => sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
    values (${uid}, 'snaptrade', ${`${tag}-${ext}`}, ${acct}, 'AAPL', 'BUY', 1, 10, ${at}, '{}')`;
  try {
    await ins(b, 'eb', '2025-01-05');
    await ins(a, 'ea', '2025-01-02');
    await sql.unsafe(ddl).simple();
    await sql.unsafe(ddl).simple();
    const rows = await sql`select user_id from broker_accounts where account_id = ${acct}`;
    assert.deepEqual(rows.map((r) => r.user_id), [a]);
  } finally {
    await sql`delete from users where id in ${sql([a, b])}`;
    await sql`delete from broker_accounts where account_id = ${acct}`;
  }
});

test('syncAll: continues past a conflicting user and logs ids only', async () => {
  const { syncAll } = await import('./sync.ts');
  const { AccountClaimedError } = await import('./claims.ts');
  const logged: unknown[][] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const seen: number[] = [];
    const res = await syncAll([{ id: 1 }, { id: 2 }, { id: 3 }], async (u) => {
      seen.push(u.id);
      if (u.id === 2) throw new AccountClaimedError();
    });
    assert.deepEqual(res, { ok: 2, failed: [2] });
    assert.deepEqual(seen, [1, 2, 3]);
    assert.doesNotMatch(JSON.stringify(logged), /acc-/);
  } finally {
    console.error = orig;
  }
});
