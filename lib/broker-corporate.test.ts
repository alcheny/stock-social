// Corporate actions through the real import path (POLICY F3c, PR #40): lib/broker.ts reads the share-moving rows with the
// vendor's documented type filter, the trade read stays BUY/SELL only, and syncUser against the in-repo vendor fake turns
// the false -45% (2:1 split, partial sale) and +1000% (1:10 reverse split) into the correct +10%. A dividend reinvestment
// becomes a buy, a stock dividend with a stated rate is priced, and a transfer in is excluded and counted.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startVendorFake, type FakeActivity, type FakeCorporateRow } from '../e2e/fakes/vendor.ts';

const hasDb = !!process.env.DATABASE_URL;
let fake: Awaited<ReturnType<typeof startVendorFake>>;
const PORT = 4800 + Math.floor(Math.random() * 400);
before(async () => {
  fake = await startVendorFake(PORT);
  process.env.SNAPTRADE_BASE_URL = fake.base;
  process.env.SNAPTRADE_CLIENT_ID = 'test';
  process.env.SNAPTRADE_CONSUMER_KEY = 'test-consumer';
  process.env.APP_SECRET_KEY ??= 'test-secret';
  if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
});
after(async () => {
  fake?.server.close();
  delete process.env.SNAPTRADE_BASE_URL;
  if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 });
});

type Row = FakeActivity | FakeCorporateRow;
const row = (acc: string, id: string, type: Row['type'], symbol: string, units: number, price: number, day: string, description?: string): Row =>
  ({ id: `${acc}-${id}`, type, symbol, units, price, fee: 0, trade_date: `${day}T15:00:00Z`, ...(description ? { description } : {}) }) as Row;
// Buys a month before each action (outside the late-posting window), sells three weeks after it.
const history = (acc: string): Row[] => [
  row(acc, 'b1', 'BUY', 'SPLITCO', 100, 100, '2025-02-03'), row(acc, 'sp1', 'SPLIT', 'SPLITCO', 100, 0, '2025-03-10', '2 FOR 1 STOCK SPLIT'),
  row(acc, 's1', 'SELL', 'SPLITCO', 100, 55, '2025-04-01'), // partial sale: -45% if the split were dropped
  row(acc, 'b2', 'BUY', 'REVCO', 100, 10, '2025-02-03'), row(acc, 'sp2', 'SPLIT', 'REVCO', -90, 0, '2025-03-10', '1 FOR 10 REVERSE SPLIT'),
  row(acc, 's2', 'SELL', 'REVCO', 10, 110, '2025-04-01'), // +1000% if the reverse split were dropped
  row(acc, 'b3', 'BUY', 'DIVCO', 100, 105, '2025-02-03'), row(acc, 'sd', 'STOCK_DIVIDEND', 'DIVCO', 5, 0, '2025-03-10', '5% STOCK DIVIDEND'),
  row(acc, 's3', 'SELL', 'DIVCO', 105, 110, '2025-04-01'),
  row(acc, 'b4', 'BUY', 'REICO', 10, 100, '2025-02-03'), row(acc, 'rei', 'REI', 'REICO', 1, 100, '2025-03-10'),
  row(acc, 's4', 'SELL', 'REICO', 11, 110, '2025-04-01'),
  row(acc, 'tin', 'TRANSFER', 'XFERCO', 10, 0, '2025-02-03'), row(acc, 's5', 'SELL', 'XFERCO', 10, 120, '2025-04-01'),
];

async function linked(acc: string) {
  const b = await import('./broker.ts');
  const u = await b.registerUser(`ca-${acc}`);
  await fetch(`${fake.base}/_scenario`, { method: 'POST', body: JSON.stringify({ accounts: [{ id: acc, activities: history(acc) }] }) });
  await fetch(`${await b.connectUrl(u, 'https://app.example/done')}&go=1`, { redirect: 'manual' });
  return { b, u };
}

test('the trade read stays BUY/SELL only; fetchShareMoves reads the share-moving rows and maps them', async () => {
  const acc = `bc-${Math.random().toString(36).slice(2, 8)}`;
  const { b, u } = await linked(acc);
  const trades = await b.fetchActivitiesPage(u, acc, 0, 1000);
  assert.deepEqual(new Set(trades.activities.map((a) => a.side)), new Set(['BUY', 'SELL']));
  assert.equal(trades.activities.length, 9);
  const moves = await b.fetchShareMoves(u, acc);
  assert.deepEqual(moves.activities.map((a) => [a.symbol, a.side, a.units, a.price]), [['REICO', 'BUY', 1, 100]]);
  assert.deepEqual(moves.actions.map((a) => [a.symbol, a.kind]).sort(), [['DIVCO', 'stock-dividend'], ['REVCO', 'split'], ['SPLITCO', 'split'], ['XFERCO', 'unpriceable']]);
  await b.deleteUser(u);
});

test('syncUser against the vendor fake: the -45% and +1000% inputs read +10%; stock dividend and reinvestment priced; the transfer in is excluded and counted', { skip: !hasDb && 'no DATABASE_URL' }, async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { syncUser } = await import('./sync.ts');
  const acc = `bc-${Math.random().toString(36).slice(2, 8)}`;
  const { b, u } = await linked(acc);
  const user = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `ca${acc.replace(/[^a-z0-9]/g, '')}` });
  try {
    await sql`update users set snaptrade_user_id = ${u.snaptradeUserId}, snaptrade_secret_enc = ${u.secretEnc} where id = ${user.id}`;
    const [account] = await b.listAccounts(u);
    await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
      select signup_attempt_id, id, ${account.authorizationId}, 'connected', now(), now(), now(), ${sql.json([{ ...account }] as never)} from users where id = ${user.id}`;
    await syncUser({ id: user.id, snaptrade_user_id: u.snaptradeUserId, snaptrade_secret_enc: u.secretEnc });
    const rows = await sql`select symbol, return_pct from closed_trades where user_id = ${user.id} order by symbol`;
    assert.deepEqual(rows.map((r) => [r.symbol, Math.round((r.return_pct as number) * 1e9) / 1e9]), [['DIVCO', 0.1], ['REICO', 0.1], ['REVCO', 0.1], ['SPLITCO', 0.1]]);
    const [c] = await sql`select excluded_positions, excluded_corporate from users where id = ${user.id}`;
    assert.deepEqual([c.excluded_positions, c.excluded_corporate], [0, 1]);
    // A second sync reads the same rows again: nothing duplicated, the same record.
    await syncUser({ id: user.id, snaptrade_user_id: u.snaptradeUserId, snaptrade_secret_enc: u.secretEnc });
    assert.equal((await sql`select count(*)::int as n from corporate_actions where user_id = ${user.id}`)[0].n, 4);
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${user.id}`)[0].n, 4);
  } finally {
    await sql`delete from users where id = ${user.id}`;
    await sql`delete from broker_accounts where account_id = ${acc}`;
    await b.deleteUser(u).catch(() => {});
  }
});
