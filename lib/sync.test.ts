// F-1: a sync is one transaction per user under the per-user advisory lock (docs/features/F-1-broker-connection.md).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { USER_LOCK } from './sync.ts';

test('sync and import steps share one per-user lock key', () => assert.equal(USER_LOCK, 1));

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `s${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-vendor`, snaptrade_secret_enc: 'enc' };
  const act = (id: string, accountId: string, side: 'BUY' | 'SELL', price: number, day: number) => ({
    externalId: `${tag}-${id}`, accountId, symbol: 'AAA', side, units: 1, price, fee: 0, executedAt: new Date(Date.UTC(2024, 0, day)), verified: true, raw: {},
  });
  const count = async (table: 'activities' | 'closed_trades') => (await sql`select count(*)::int as n from ${sql(table)} where user_id = ${u.id}`)[0].n as number;
  // F-1: a sync reads only accounts under a consented authorization: a connected connection on authorization 'a'.
  const connected = async (ids: string[]) => sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', now(), now(), now(), ${sql.json(ids.map((id) => ({ id, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true })))} from users where id = ${u.id}`;
  return { sql, tag, user, act, count, connected, cleanup: async (ids: string[]) => { await sql`delete from users where id = ${u.id}`; if (ids.length) await sql`delete from broker_accounts where account_id in ${sql(ids)}`; } };
}

dbTest('two syncs for the same trader at once: one runs, the other is skipped; rows never interleave; a third sync afterwards runs normally', async () => {
  const { tag, user, act, count, connected, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const acc = `${tag}-acc`;
  await connected([acc]);
  let inFlight = 0, maxInFlight = 0;
  const broker = {
    listAccounts: async () => [{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }],
    fetchActivities: async () => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 150));
      inFlight--;
      return [act('b1', acc, 'BUY', 100, 1), act('s1', acc, 'SELL', 110, 2)];
    },
  };
  try {
    const [r1, r2] = await Promise.all([syncUser(user, broker), syncUser(user, broker)]);
    assert.deepEqual([r1, r2].sort(), [2, 'skipped']);
    assert.equal(maxInFlight, 1); // the skipped one never reached the vendor
    assert.equal(await count('activities'), 2);
    assert.equal(await count('closed_trades'), 1);
    assert.equal(await syncUser(user, broker), 2); // idempotent re-sync
    assert.equal(await count('activities'), 2);
  } finally {
    await cleanup([acc]);
  }
});

dbTest('a failure anywhere in a sync leaves activities, closed_trades, claims and positions exactly as before', async () => {
  const { sql, tag, user, act, count, connected, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const acc = `${tag}-acc`, acc2 = `${tag}-acc2`;
  const accounts = (ids: string[]) => ids.map((id) => ({ id, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }));
  await connected([acc]);
  try {
    await syncUser(user, { listAccounts: async () => accounts([acc]), fetchActivities: async () => [act('b1', acc, 'BUY', 100, 1), act('s1', acc, 'SELL', 90, 2)], fetchPositions: async () => [{ symbol: 'ZZZ', unrealizedPct: 0.1 }] });
    const snapshot = async () => JSON.stringify([
      await sql`select external_id from activities where user_id = ${user.id} order by external_id`,
      await sql`select sell_id, return_pct from closed_trades where user_id = ${user.id} order by sell_id`,
      await sql`select account_id, confirmed_at from broker_accounts where user_id = ${user.id} order by account_id`,
      await sql`select symbol, unrealized_pct from open_positions where user_id = ${user.id} order by symbol`,
    ]);
    const before = await snapshot();
    assert.equal(await count('closed_trades'), 1);
    // Positions fail after the new activities were inserted and the trades rebuilt inside the same transaction.
    await assert.rejects(syncUser(user, {
      listAccounts: async () => accounts([acc, acc2]),
      fetchActivities: async () => [act('b2', acc2, 'BUY', 50, 3), act('s2', acc2, 'SELL', 60, 4)],
      fetchPositions: async () => { throw new Error('vendor down'); },
    }), /vendor down/);
    assert.equal(await snapshot(), before);
    assert.equal((await sql`select 1 from broker_accounts where account_id = ${acc2}`).length, 0); // the new claim rolled back too
    // A rebuild failure rolls back the inserted activities as well.
    await assert.rejects(syncUser(user, { listAccounts: async () => accounts([acc]), fetchActivities: async () => [act('b3', acc, 'BUY', 1, 5)] }, async () => { throw new Error('rebuild broke'); }), /rebuild broke/);
    assert.equal(await snapshot(), before);
  } finally {
    await cleanup([acc, acc2]);
  }
});

dbTest('disconnect after connecting (TR-5): accounts the vendor no longer lists mark the connection disconnected; the record freezes and nothing is deleted', async () => {
  const { sql, tag, user, act, count, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const acc = `${tag}-acc`;
  const vendorAcc = (ids: string[]) => ids.map((id) => ({ id, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }));
  try {
    const [a] = await sql`select signup_attempt_id from users where id = ${user.id}`;
    const [c] = await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, importing_at, connected_at, consent_at, accounts)
      values (${a.signup_attempt_id}, ${user.id}, 'a', 'connected', now(), now(), now(), ${sql.json([{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }])}) returning id`;
    await syncUser(user, { listAccounts: async () => vendorAcc([acc]), fetchActivities: async () => [act('b1', acc, 'BUY', 100, 1), act('s1', acc, 'SELL', 120, 2)] });
    assert.equal(await count('closed_trades'), 1);
    assert.equal((await sql`select disconnected_at from connections where id = ${c.id}`)[0].disconnected_at, null);
    await syncUser(user, { listAccounts: async () => [], fetchActivities: async () => [] });
    assert.ok((await sql`select disconnected_at from connections where id = ${c.id}`)[0].disconnected_at);
    assert.equal(await count('activities'), 2);
    assert.equal(await count('closed_trades'), 1);
    assert.equal((await sql`select 1 from broker_accounts where account_id = ${acc} and user_id = ${user.id}`).length, 1); // confirmed claim kept
  } finally {
    await cleanup([acc]);
  }
});

dbTest('usersToSync (D1, D5): only a trader with a connected connection and no import in progress; never pending-only, importing-only, failed-only or a profile being deleted', async () => {
  const { sql, tag, user, cleanup } = await setup();
  const { usersToSync } = await import('./sync.ts');
  const listed = async () => (await usersToSync()).some((u) => u.id === user.id);
  const [a] = await sql`select signup_attempt_id from users where id = ${user.id}`;
  const row = async (state: string) => Number((await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, accounts)
    values (${a.signup_attempt_id}, ${user.id}, ${`${tag}-${state}`}, ${state}, '[]') returning id`)[0].id);
  try {
    assert.equal(await listed(), false); // a vendor id alone is not a consent
    const pending = await row('pending');
    assert.equal(await listed(), false);
    await sql`update connections set state = 'failed', failure_reason = 'stale' where id = ${pending}`;
    assert.equal(await listed(), false);
    const connected = await row('connected');
    assert.equal(await listed(), true);
    const importing = await row('importing');
    assert.equal(await listed(), false);
    await sql`update connections set state = 'connected' where id = ${importing}`;
    assert.equal(await listed(), true);
    await sql`update users set deleted_at = now() where id = ${user.id}`;
    assert.equal(await listed(), false);
    assert.ok(connected);
  } finally {
    await cleanup([]);
  }
});
