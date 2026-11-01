// OPTIONS fix round 7 (orchestrator re-verification of #62): one definition of "this row carries an option type", the
// same in code (import) and in SQL (rebuild), and the shared-account filter on every option query, as rebuildTrades has.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasOptionType } from './options.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

// [raw row, expected]: null, a missing key, empty, blanks and a tab; then real values, one padded.
const CASES: [Record<string, unknown>, boolean][] = [
  [{ option_type: null }, false], [{}, false], [{ option_type: '' }, false], [{ option_type: ' ' }, false], [{ option_type: '   ' }, false], [{ option_type: '\t' }, false],
  [{ option_type: 'CALL' }, true], [{ option_type: 'PUT' }, true], [{ option_type: 'BUY_TO_OPEN' }, true], [{ option_type: ' SELL_TO_CLOSE ' }, true],
];

test('hasOptionType: true only for a non-empty string after trimming', () => {
  for (const [raw, want] of CASES) assert.equal(hasOptionType(raw.option_type), want, JSON.stringify(raw));
  for (const v of [0, 1, true, {}, []]) assert.equal(hasOptionType(v), false);
});

test('the importer routes by the same definition: an empty option_type is an equity row; a padded one is an option row', async () => {
  const { toOptionRows } = await import('./broker.ts');
  for (const [raw, want] of CASES) {
    const row = { id: 'r', type: 'BUY', symbol: { symbol: 'EMP' }, units: 1, price: 1, trade_date: '2025-01-02T15:00:00Z', ...raw };
    assert.equal(toOptionRows('a', [row] as never).length === 1, want, JSON.stringify(raw));
  }
});

test('import routing through the public functions: each row lands on exactly one side (shares or the option sink), as hasOptionType says', async () => {
  const { startVendorFake } = await import('../e2e/fakes/vendor.ts');
  const fake = await startVendorFake(0); // a free port
  const env = { base: process.env.SNAPTRADE_BASE_URL, id: process.env.SNAPTRADE_CLIENT_ID, key: process.env.SNAPTRADE_CONSUMER_KEY };
  process.env.SNAPTRADE_BASE_URL = fake.base; process.env.SNAPTRADE_CLIENT_ID = 'test'; process.env.SNAPTRADE_CONSUMER_KEY = 'test';
  process.env.APP_SECRET_KEY ??= 'test-secret';
  try {
    const b = await import('./broker.ts');
    const u = await b.registerUser('attempt-opt-type');
    const url = await b.connectUrl(u, 'https://app.example/connect/done');
    const rows = CASES.map(([raw], i) => ({ id: `ot-${i}`, symbol: 'EMP', type: i % 2 ? 'SELL' : 'BUY', units: 1, price: 10, fee: 0, trade_date: `2025-01-0${(i % 9) + 1}T15:00:00Z`, ...raw }));
    await fetch(`${fake.base}/_scenario`, { method: 'POST', body: JSON.stringify({ accounts: [{ id: 'ot-acc', activities: rows }] }) });
    await fetch(`${url}&go=1`, { redirect: 'manual' });
    const sunk: string[] = [];
    const page = await b.fetchActivitiesPage(u, 'ot-acc', 0, 1000, (r) => sunk.push(...r.map((x) => x.externalId)));
    const shares = page.activities.map((a) => a.externalId);
    const week: string[] = [];
    const weekShares = (await b.fetchActivities(u, new Date('2025-01-01'), ['ot-acc'], (r) => week.push(...r.map((x) => x.externalId)))).map((a) => a.externalId);
    CASES.forEach(([raw, want], i) => {
      const id = `ot-${i}`;
      for (const [s, o] of [[shares, sunk], [weekShares, week]]) {
        assert.equal(s.includes(id) !== o.includes(id), true, `${JSON.stringify(raw)}: exactly one side`);
        assert.equal(o.includes(id), want, JSON.stringify(raw));
      }
    });
    await b.deleteUser(u);
  } finally {
    await new Promise<void>((done) => { fake.server.close(() => done()); fake.server.closeAllConnections(); });
    if (env.base === undefined) delete process.env.SNAPTRADE_BASE_URL; else process.env.SNAPTRADE_BASE_URL = env.base;
    if (env.id !== undefined) process.env.SNAPTRADE_CLIENT_ID = env.id;
    if (env.key !== undefined) process.env.SNAPTRADE_CONSUMER_KEY = env.key;
  }
});

dbTest('the SQL predicate agrees with hasOptionType on every case', async () => {
  const { sql } = await import('./db.ts');
  const { optionTypeSet } = await import('./options-sync.ts');
  for (const [raw, want] of CASES) {
    const [r] = await sql`select ${optionTypeSet(sql, sql`${sql.json(raw as never)}::jsonb`)} as v`;
    assert.equal(r.v, want, JSON.stringify(raw));
    assert.equal(r.v, hasOptionType(raw.option_type));
  }
});

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `t${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const row = (id: string, account: string, symbol: string, side: 'BUY' | 'SELL', price: number, at: string, raw: unknown = {}) => ({
    user_id: u.id, source: 'snaptrade', external_id: `${tag}-${id}`, account_id: account, symbol, side, units: 1, price, fee: 0, executed_at: new Date(at), raw: sql.json(raw as never),
  });
  const closes = async () => (await sql`select symbol from closed_trades where user_id = ${u.id} order by symbol`).map((r) => r.symbol as string);
  const other = async () => (await sql`select excluded_options_other as o from users where id = ${u.id}`)[0].o as number;
  return { sql, tag, u, row, closes, other, cleanup: () => sql`delete from users where id = ${u.id}` };
}

dbTest('an equity close whose raw option_type is "" stays in closed_trades and is not counted as an option (the repair leaves it too)', async () => {
  const { sql, tag, u, row, closes, other, cleanup } = await setup();
  const { rebuildRecord, repairOptionShareCloses } = await import('./options-sync.ts');
  try {
    await sql`insert into activities ${sql([row('b', `${tag}-a`, 'EMP', 'BUY', 10, '2025-01-02T15:00:00Z', { option_type: '' }), row('s', `${tag}-a`, 'EMP', 'SELL', 12, '2025-01-10T15:00:00Z', { option_type: '  ' })])}`;
    await rebuildRecord(u.id);
    assert.deepEqual(await closes(), ['EMP']);
    assert.equal(await other(), 0);
    assert.equal(await repairOptionShareCloses([u.id]), 0);
    assert.deepEqual(await closes(), ['EMP']);
  } finally { await cleanup(); }
});

dbTest('a marked shared account is left out of the option queries, as rebuildTrades leaves it out: its option sells, option trades and exercise days count nowhere', async () => {
  const { sql, tag, u, row, closes, other, cleanup } = await setup();
  const { insertOptionActivities, rebuildRecord } = await import('./options-sync.ts');
  const shared = `${tag}-shared`, own = `${tag}-own`;
  const opt = (id: string, account: string, kind: string, oc: string | null, at: string, price = 1) => ({ externalId: `${tag}-${id}`, accountId: account, kind, openClose: oc, underlying: 'XYZ', underlyingType: 'cs',
    right: 'CALL', expiry: '2025-06-20', strikeMilli: 1000, multiplier: 100, occTicker: 'XYZ   250620C00001000', units: 1, price, fee: 0, amount: null, currency: 'USD', executedAt: new Date(at), verified: true, raw: {} });
  try {
    await sql`insert into shared_account_marks (account_id, user_id) values (${shared}, ${u.id})`;
    await sql`insert into activities ${sql([
      row('ob', shared, 'XYZ   250117C00150000', 'BUY', 2, '2025-01-02T15:00:00Z'), row('os', shared, 'XYZ   250117C00150000', 'SELL', 5, '2025-01-10T15:00:00Z'),
      row('tb', shared, 'ABC', 'BUY', 2, '2025-01-02T15:00:00Z', { option_type: 'BUY_TO_OPEN' }), row('ts', shared, 'ABC', 'SELL', 3, '2025-01-03T15:00:00Z', { option_type: 'SELL_TO_CLOSE' }),
      row('kb', own, 'QRS', 'BUY', 10, '2025-01-02T15:00:00Z'), row('ks', own, 'QRS', 'SELL', 11, '2025-01-20T15:00:00Z'),
    ])}`;
    await insertOptionActivities(u.id, 'snaptrade', [opt('1', shared, 'BUY', 'BUY_TO_OPEN', '2025-03-01T15:00:00Z'), opt('2', shared, 'SELL', 'SELL_TO_CLOSE', '2025-03-05T15:00:00Z', 2),
      { ...opt('3', shared, 'OPTIONASSIGNMENT', null, '2025-01-10T15:00:00Z'), underlying: 'QRS' }]);
    const r = await rebuildRecord(u.id);
    assert.equal(r.occRemoved, 0); // the shared account's option-pair sells are not counted
    assert.equal(r.options.trades, 0); // nor its option closes shown
    assert.equal(r.removedForExercise, 0); // nor its assignment day a taint on this profile's own QRS close
    assert.equal(r.options.short + r.options.other, 0);
    assert.deepEqual(await closes(), ['QRS']);
    assert.equal(await other(), 0);
  } finally { await cleanup(); await sql`delete from shared_account_marks where user_id = ${u.id}`; }
});
