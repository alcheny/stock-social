// Corporate actions through the database (POLICY F3c): stored actions + rebuildTrades give the correct return, renames
// that link pairs are matched as one chain, counters are written and reset, theses re-attach by sell_id, rebuilds are
// identical, the insert is idempotent and the rows go with the profile.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CorporateAction } from './corporate-actions.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { insertActivities, rebuildTrades } = await import('./sync.ts');
  const { insertCorporateActions } = await import('./corporate-actions.ts');
  const tag = `ca${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const day = (n: number) => new Date(Date.UTC(2025, 0, n));
  const act = (id: string, side: 'BUY' | 'SELL', units: number, price: number, n: number, symbol = 'AAA', accountId = `${tag}-acc`) => ({
    externalId: `${tag}-${id}`, accountId, symbol, side, units, price, fee: 0, executedAt: day(n), verified: true, raw: {},
  });
  const ca = (id: string, n: number, fields: Record<string, unknown>, symbol = 'AAA', accountId = `${tag}-acc`) =>
    ({ externalId: `${tag}-${id}`, accountId, symbol, executedAt: day(n), raw: { id }, ...fields }) as CorporateAction & { raw: unknown };
  type T = { sell_id: string; symbol: string; return_pct: number; opened_at: Date; holding_days: number; thesis: string | null };
  const trades = async () => (await sql<T[]>`select sell_id, symbol, return_pct, opened_at, holding_days, thesis from closed_trades where user_id = ${u.id} order by closed_at, sell_id`)
    .map((r) => ({ ...r, return_pct: Math.round(r.return_pct * 1e9) / 1e9 }));
  const counters = async () => (await sql`select excluded_positions, excluded_corporate from users where id = ${u.id}`)[0];
  return {
    sql, tag, u, act, ca, trades, counters, rebuild: () => rebuildTrades(u.id),
    insert: (acts: ReturnType<typeof act>[]) => insertActivities(u.id, 'snaptrade', acts),
    insertCa: (rows: (CorporateAction & { raw: unknown })[]) => insertCorporateActions(sql, u.id, 'snaptrade', rows),
    cleanup: () => sql`delete from users where id = ${u.id}`,
  };
}

dbTest('a stored 2:1 split prices the sell at +10%; without it the oversold sell is excluded; rebuilds are identical and counters reset', async () => {
  const s = await setup();
  try {
    await s.insert([s.act('b', 'BUY', 100, 100, 1), s.act('s', 'SELL', 200, 55, 30)]);
    await s.rebuild();
    assert.deepEqual(await s.trades(), []);
    assert.deepEqual(await s.counters(), { excluded_positions: 1, excluded_corporate: 0 });
    await s.insertCa([s.ca('split', 10, { kind: 'split', units: 100, ratio: { p: 2, q: 1 } })]);
    const r = await s.rebuild();
    assert.equal(r.excludedCorporate, 0);
    const first = await s.trades();
    assert.equal(first.length, 1);
    assert.equal(first[0].return_pct, 0.1);
    assert.equal(first[0].holding_days, 29);
    assert.deepEqual(await s.counters(), { excluded_positions: 0, excluded_corporate: 0 });
    await s.rebuild();
    assert.deepEqual(await s.trades(), first);
  } finally { await s.cleanup(); }
});

dbTest('a thesis survives the rebuild that applies a split (re-attached by sell_id); an unpriceable action counts and keeps it aside', async () => {
  const s = await setup();
  try {
    await s.insert([s.act('b', 'BUY', 100, 100, 1), s.act('s', 'SELL', 100, 120, 30)]);
    await s.rebuild();
    await s.sql`update closed_trades set thesis = 'Held through the earnings run.', thesis_status = 'published' where user_id = ${s.u.id}`;
    await s.insertCa([s.ca('spin', 10, { kind: 'unpriceable', reason: 'spin-off', units: 5, scope: 'account' }, 'KID')]);
    await s.rebuild();
    assert.deepEqual(await s.trades(), []);
    assert.deepEqual(await s.counters(), { excluded_positions: 0, excluded_corporate: 1 });
    const [kept] = await s.sql`select thesis from kept_theses where user_id = ${s.u.id}`;
    assert.equal(kept.thesis, 'Held through the earnings run.');
  } finally { await s.cleanup(); }
});

dbTest('a rename chain A → B → C across pairs is matched as one position; a recycled ticker and other pairs stream as before', async () => {
  const s = await setup();
  try {
    await s.insert([
      s.act('b1', 'BUY', 100, 100, 1, 'AAA'), s.act('s1', 'SELL', 40, 120, 20, 'BBB'), s.act('s2', 'SELL', 120, 45, 40, 'CCC'),
      s.act('b2', 'BUY', 10, 50, 41, 'AAA'), s.act('s3', 'SELL', 10, 55, 42, 'AAA'),
      s.act('b3', 'BUY', 5, 10, 2, 'ZZZ'), s.act('s4', 'SELL', 5, 11, 3, 'ZZZ'),
    ]);
    await s.insertCa([
      s.ca('r1', 10, { kind: 'symbol-change', newSymbol: 'BBB', outUnits: 100, inUnits: 100 }, 'AAA'),
      s.ca('r2', 35, { kind: 'symbol-change', newSymbol: 'CCC', outUnits: 60, inUnits: 120 }, 'BBB'),
    ]);
    const r = await s.rebuild();
    assert.equal(r.trades, 4);
    const got = (await s.trades()).map((t) => [t.sell_id.replace(`${s.tag}-`, ''), t.symbol, t.return_pct]);
    assert.deepEqual(got, [['s4', 'ZZZ', 0.1], ['s1', 'BBB', 0.2], ['s2', 'CCC', -0.1], ['s3', 'AAA', 0.1]]);
    assert.deepEqual(await s.counters(), { excluded_positions: 0, excluded_corporate: 0 });
  } finally { await s.cleanup(); }
});

dbTest('insertCorporateActions is idempotent and stores the mapped fields; the rows are deleted with the profile', async () => {
  const s = await setup();
  const rows = [s.ca('x', 5, { kind: 'split', units: -95, ratio: { p: 1, q: 10 } }), s.ca('y', 6, { kind: 'symbol-change', newSymbol: 'NEW', outUnits: 10, inUnits: 10 })];
  await s.insertCa(rows);
  await s.insertCa(rows);
  const stored = await s.sql`select kind, detail, raw from corporate_actions where user_id = ${s.u.id} order by executed_at`;
  assert.deepEqual(stored.map((r) => [r.kind, r.detail, r.raw]), [
    ['split', { units: -95, ratio: { p: 1, q: 10 } }, { id: 'x' }], ['symbol-change', { newSymbol: 'NEW', outUnits: 10, inUnits: 10 }, { id: 'y' }],
  ]);
  await s.cleanup();
  assert.equal((await s.sql`select count(*)::int as n from corporate_actions where external_id like ${`${s.tag}-%`}`)[0].n, 0);
});

dbTest('actions of a simulated account or dated in the future are not applied', async () => {
  const s = await setup();
  try {
    await s.insert([s.act('b', 'BUY', 100, 100, 1), s.act('s', 'SELL', 100, 120, 30)]);
    const future = { ...s.ca('f', 1, { kind: 'unpriceable', reason: 'unknown', scope: 'account' }, 'KID'), executedAt: new Date(Date.now() + 5 * 86_400_000) };
    await s.insertCa([future]);
    await s.rebuild();
    assert.equal((await s.trades()).length, 1);
    await s.sql`insert into broker_accounts (account_id, user_id, is_paper) values (${`${s.tag}-p`}, ${s.u.id}, true) on conflict do nothing`;
    await s.insert([s.act('pb', 'BUY', 1, 1, 1, 'AAA', `${s.tag}-p`)]);
    await s.insertCa([s.ca('p', 10, { kind: 'unpriceable', reason: 'unknown', scope: 'account' }, 'KID', `${s.tag}-p`)]);
    await s.rebuild();
    assert.deepEqual(await s.counters(), { excluded_positions: 0, excluded_corporate: 0 });
  } finally { await s.sql`delete from broker_accounts where account_id = ${`${s.tag}-p`}`; await s.cleanup(); }
});

dbTest('vendor rows as the fake serves them, mapped by fromVendorRows (the path the owner broker.ts change would take): the import reads +10% after a 2:1 split', async () => {
  const s = await setup();
  const { fromVendorRows } = await import('./corporate-actions.ts');
  try {
    const acc = `${s.tag}-acc`;
    const served = [
      { id: `${s.tag}-b`, type: 'BUY', symbol: { symbol: 'SPLITCO' }, units: 100, price: 100, fee: 0, trade_date: '2025-03-03T15:00:00Z' },
      { id: `${s.tag}-sp`, type: 'SPLIT', symbol: { symbol: 'SPLITCO' }, units: 100, price: 0, trade_date: '2025-03-10T15:00:00Z', description: '2 FOR 1 STOCK SPLIT' },
      { id: `${s.tag}-s`, type: 'SELL', symbol: { symbol: 'SPLITCO' }, units: 200, price: 55, fee: 0, trade_date: '2025-04-01T15:00:00Z' },
    ];
    // BUY and SELL rows as lib/broker.ts maps them today; the rest through fromVendorRows.
    await s.insert(served.filter((r) => r.type === 'BUY' || r.type === 'SELL').map((r) => ({
      externalId: r.id, accountId: acc, symbol: r.symbol.symbol, side: r.type as 'BUY' | 'SELL', units: r.units, price: r.price, fee: 0, executedAt: new Date(r.trade_date), verified: true, raw: r,
    })));
    const mapped = fromVendorRows(acc, served);
    assert.deepEqual(mapped.activities, []);
    await s.insertCa(mapped.actions);
    await s.rebuild();
    const got = await s.trades();
    assert.deepEqual(got.map((t) => [t.symbol, t.return_pct]), [['SPLITCO', 0.1]]);
  } finally { await s.cleanup(); }
});
