// F-14 merge re-check: one vendor positions read can list the same key twice (two lots of one option contract in an
// account, or one share symbol twice). The inserts that update on conflict cannot touch a row twice, so a duplicate made
// the whole sync throw and roll back every round. Rows are de-duplicated first, keeping the first, as main's
// `on conflict do nothing` did. Each site, on the plain sync, the cadence sync (combined and positions-only reads) and
// the import's option write.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000;
const base = Date.now() - 40 * 24 * HOUR;
const shiftAt = (h: number) => base + h * HOUR - Date.now();

async function trader() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `dp${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const acc = { id: `${tag}-a`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true };
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json([acc])}, now()
    from users where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id = ${acc.id}`; };
  return { sql, tag, user, acc, cleanup };
}

// Two lots of one option contract (same underlying, expiry, right, strike, multiplier) and one share symbol twice.
const lot = (cost: string) => ({ instrument: { kind: 'option', id: `i${cost}`, symbol: 'XYZ   271217C00123450', option_type: 'CALL', strike_price: '123.45', expiration_date: '2027-12-17', multiplier: '100',
  underlying: { kind: 'stock', id: 'u', symbol: 'XYZ', raw_symbol: 'XYZ' } }, units: '1', price: '1.5', cost_basis: cost });

async function dupBroker(acc: { id: string }) {
  const { splitPositionKinds } = await import('./broker.ts');
  return {
    listAccounts: async () => [acc],
    fetchActivities: async () => [],
    fetchPositions: async (_u: unknown, _id: string, sink?: (s: unknown) => void) => {
      sink?.(splitPositionKinds([lot('1') as never, lot('2') as never]).split);
      return [{ symbol: 'DUP', unrealizedPct: 0.1 }, { symbol: 'DUP', unrealizedPct: 0.2 }];
    },
  };
}
const held = async (sql: Awaited<ReturnType<typeof trader>>['sql'], id: number) => {
  const [r] = await sql`select (select count(*)::int from open_option_positions where user_id = ${id}) as options,
    (select count(*)::int from open_positions where user_id = ${id} and symbol = 'DUP') as shares,
    (select unrealized_pct from open_positions where user_id = ${id} and symbol = 'DUP') as pct`;
  return r;
};

dbTest('the plain sync: two lots of one option contract and a share symbol listed twice store one row each (the first), no rollback', async () => {
  const t = await trader();
  const { syncUser } = await import('./sync.ts');
  try {
    await syncUser(t.user, (await dupBroker(t.acc)) as never);
    await syncUser(t.user, (await dupBroker(t.acc)) as never); // and again: never throws
    const r = await held(t.sql, t.user.id);
    assert.deepEqual([r.options, r.shares], [1, 1]);
  } finally { await t.cleanup(); }
});

dbTest('the cadence sync: duplicates on a combined read (settle) and on a positions-only read (upsert) keep the first, every round', async () => {
  const t = await trader();
  const { syncUser } = await import('./sync.ts');
  try {
    const reports: { activitiesRead: number; positionsRead: number }[] = [];
    for (const h of [0, 7, 14, 25]) {
      await syncUser(t.user, (await dupBroker(t.acc)) as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(h), report: (r) => reports.push(r) });
      const r = await held(t.sql, t.user.id);
      assert.deepEqual([r.options, r.shares, r.pct], [1, 1, 0.1], `h${h}: one row each, the first lot`);
    }
    assert.deepEqual(reports.map((r) => [r.activitiesRead, r.positionsRead]), [[1, 1], [0, 1], [0, 1], [1, 1]], 'combined, positions-only, positions-only, combined');
  } finally { await t.cleanup(); }
});

dbTest("the import's option write (replaceImportedOptionPositions): two lots of one contract store one row", async () => {
  const t = await trader();
  const { replaceImportedOptionPositions } = await import('./options-sync.ts');
  const { splitPositionKinds } = await import('./broker.ts');
  try {
    const split = splitPositionKinds([lot('1') as never, lot('2') as never]).split;
    await t.sql.begin((tx) => replaceImportedOptionPositions(tx, t.user.id, [t.acc.id], [t.acc.id], new Map([[t.acc.id, split]])));
    assert.equal((await held(t.sql, t.user.id)).options, 1);
  } finally { await t.cleanup(); }
});
