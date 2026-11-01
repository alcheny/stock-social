// OPTIONS fix round 5 (final review blocking 1): the production cron runs runShard → metered broker → syncUser. The
// metered wrappers must forward the option sinks (fetchActivities' 4th argument, fetchActivitiesPage's 5th,
// fetchPositions' 3rd), or the hourly sync stores no option row, stamps the backfill with nothing read and wipes the open
// option positions. Driven through runShard with its test hooks, on this test's own trader only (its own `of`, its own
// past rounds), with an in-memory broker in the vendor's option shapes (lib/broker.ts#toOptionRows).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 60_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const MIN = 60_000;
const os = { id: 'o', ticker: 'XYZ   250620C00123450', option_type: 'CALL', strike_price: 123.45, expiration_date: '2025-06-20', underlying_symbol: { symbol: 'XYZ', type: { code: 'cs' } } };

dbTest('runShard forwards the option sinks: option rows are stored, the open option position survives a second run, and the backfill is stamped only after its rows were read', async () => {
  const { sql } = await import('./db.ts');
  const S = await import('./sync.ts');
  const H = await import('./sync-shard.ts');
  const { toOptionRows, splitPositionKinds } = await import('./broker.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `k${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const acc = `${tag}-acc`;
  const of = 1001 + Math.floor(Math.random() * 24); // above lib/sync-shard.test.ts's 500–1000, within the table's 1–1024
  // Its own past :00 marks, far behind every other test's (lib/sync-shard.test.ts walks back from 40 rounds).
  const T0 = Math.floor(Date.now() / S.ROUND_MS) * S.ROUND_MS - (3000 + Math.floor(Math.random() * 3000)) * S.ROUND_MS;
  const at = (minute: number) => () => T0 + minute * MIN - Date.now();
  await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', now(), now(), now(), ${sql.json([{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }])} from users where id = ${u.id}`;
  // Stored share history from before options were imported: the next syncs owe this connection its option backfill.
  await S.insertActivities(u.id, 'snaptrade', [{ externalId: `${tag}-sb`, accountId: acc, symbol: 'ABC', side: 'BUY', units: 1, price: 10, fee: 0, executedAt: new Date('2025-01-02T15:00:00Z'), verified: true, raw: {} }]);
  const history = [
    { id: `${tag}-ob`, type: 'BUY', option_type: 'BUY_TO_OPEN', option_symbol: os, units: 1, price: 2, fee: 0, trade_date: '2025-03-03T15:00:00Z' },
    { id: `${tag}-os`, type: 'SELL', option_type: 'SELL_TO_CLOSE', option_symbol: os, units: 1, price: 3, fee: 0, trade_date: '2025-04-01T15:00:00Z' },
  ];
  const position = { instrument: { kind: 'option', id: 'i', symbol: 'XYZ   271217C00123450', option_type: 'CALL', strike_price: '123.45', expiration_date: '2027-12-17', multiplier: '100',
    underlying: { kind: 'stock', id: 'u', symbol: 'XYZ', raw_symbol: 'XYZ' } }, units: '1', price: '1.5', cost_basis: '1' };
  const got = { activities: 0, page: 0, positions: 0 };
  const broker = {
    pageLimit: 1, // one option row per backfill page: two runs to finish
    listAccounts: async () => [{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }],
    fetchActivities: async (_u: unknown, _since: Date, _ids?: string[], sink?: (r: unknown[]) => void) => { if (typeof sink === 'function') got.activities++; return []; },
    fetchActivitiesPage: async (_u: unknown, id: string, offset: number, limit = 1, sink?: (r: unknown[]) => void) => {
      if (typeof sink === 'function') got.page++;
      const rows = history.slice(offset, offset + limit);
      sink?.(toOptionRows(id, rows as never));
      return { activities: [], done: offset + limit >= history.length };
    },
    fetchPositions: async (_u: unknown, _id: string, sink?: (s: unknown) => void) => {
      if (typeof sink === 'function') got.positions++;
      sink?.(splitPositionKinds([position as never]).split);
      return [];
    },
  };
  const run = (minute: number) => H.runShard({ shard: { shard: u.id % of, of }, ids: [u.id], shiftMs: at(minute), jitterMs: 0, config: { concurrency: 1, rps: 1000, burst: 1000, page: 500 }, log: () => {}, broker: broker as never });
  const state = async () => {
    const [r] = await sql`select (select count(*)::int from option_activities where user_id = ${u.id}) as rows, (select count(*)::int from open_option_positions where user_id = ${u.id}) as open,
      (select options_backfilled_at from connections where user_id = ${u.id}) as stamped, (select count(*)::int from option_trades where user_id = ${u.id}) as trades`;
    return r;
  };
  try {
    const r1 = await run(5);
    assert.equal(r1.done, 1);
    let s = await state();
    assert.equal(s.rows, 1, 'the first backfill page\'s option row is stored');
    assert.equal(s.stamped, null, 'not stamped: the history is not read to its end');
    assert.equal(s.open, 1, 'the open option position is stored');
    const r2 = await run(65); // the next round
    assert.equal(r2.done, 1);
    s = await state();
    assert.equal(s.rows, 2);
    assert.ok(s.stamped, 'stamped once every row was read');
    assert.equal(s.trades, 1);
    assert.equal(s.open, 1, 'the open option position survives the second run');
    const r3 = await run(125); // backfilled: the week read, with its sink
    assert.equal(r3.done, 1);
    assert.equal((await state()).open, 1);
    // Every metered method handed its sink on (a wrapper that drops a parameter fails here).
    assert.deepEqual(got, { activities: 1, page: 2, positions: 3 });
  } finally {
    await sql`delete from users where id = ${u.id}`;
    await sql`delete from broker_accounts where account_id = ${acc}`;
    await sql`delete from sync_shards where of = ${of}`;
  }
});
