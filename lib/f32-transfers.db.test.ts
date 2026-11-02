// F-32 Part A through the database: a stored vendor transfer row (its raw type, as rows stored before F-32 carry it) is
// read as a transfer by loadCorporateActions, and rebuildTrades writes users.excluded_transfer (a count only), leaving
// excluded_corporate for every other cause. Fictional records; each test deletes only the user it created.
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
  const { insertCorporateActions, fromVendorRows } = await import('./corporate-actions.ts');
  const tag = `f32${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const acc = `${tag}-acc`;
  const day = (n: number) => new Date(Date.UTC(2025, 2, 1) + n * 86_400_000);
  const act = (id: string, side: 'BUY' | 'SELL', units: number, price: number, n: number, symbol = 'WX') => ({
    externalId: `${tag}-${id}`, accountId: acc, symbol, side, units, price, fee: 0, executedAt: day(n), verified: true, raw: {},
  });
  // A vendor share-move row, mapped exactly as the sync maps it (fromVendorRows), so `raw` is the vendor row.
  const vendor = (id: string, type: string, n: number, units: number | null, symbol = 'WX') =>
    fromVendorRows(acc, [{ id: `${tag}-${id}`, type, units, trade_date: day(n).toISOString(), symbol: { symbol } }]).actions;
  const counters = async () => (await sql`select excluded_positions, excluded_corporate, excluded_transfer from users where id = ${u.id}`)[0];
  const shown = async () => (await sql`select symbol from closed_trades where user_id = ${u.id} order by symbol`).map((r) => r.symbol as string);
  return {
    sql, u, act, vendor, counters, shown, rebuild: () => rebuildTrades(u.id),
    insert: (acts: ReturnType<typeof act>[]) => insertActivities(u.id, 'snaptrade', acts),
    insertCa: (rows: (CorporateAction & { raw: unknown })[]) => insertCorporateActions(sql, u.id, 'snaptrade', rows),
    load: async () => (await import('./corporate-actions.ts')).loadCorporateActions(sql, u.id, sql`true`),
    cleanup: () => sql`delete from users where id = ${u.id}`,
  };
}

dbTest('p5 probe through the database: the WX transfer in counts the −60% close in excluded_transfer, excluded_corporate stays 0', async () => {
  const s = await setup();
  try {
    await s.insert([s.act('wb', 'BUY', 100, 100, 0), s.act('ws', 'SELL', 100, 40, 9), s.act('yb', 'BUY', 100, 100, 0, 'YX'), s.act('ys', 'SELL', 100, 140, 9, 'YX')]);
    await s.rebuild();
    assert.deepEqual(await s.counters(), { excluded_positions: 0, excluded_corporate: 0, excluded_transfer: 0 });
    await s.insertCa(s.vendor('t', 'TRANSFER', 21, 1));
    const loaded = await s.load();
    assert.equal(loaded.length, 1);
    assert.equal((loaded[0] as { transfer?: true }).transfer, true, 'derived from the stored row\'s type');
    await s.rebuild();
    assert.deepEqual(await s.shown(), ['YX']);
    assert.deepEqual(await s.counters(), { excluded_positions: 0, excluded_corporate: 0, excluded_transfer: 1 });
  } finally { await s.cleanup(); }
});

dbTest('the external transfer types are transfers; an unpaired ADJUSTMENT is not (it stays corporate); counts reset on rebuild', async () => {
  const s = await setup();
  try {
    await s.insert([s.act('b1', 'BUY', 10, 100, 0, 'AA'), s.act('s1', 'SELL', 10, 90, 5, 'AA'), s.act('b2', 'BUY', 10, 100, 0, 'BB'), s.act('s2', 'SELL', 10, 90, 5, 'BB'),
      s.act('b3', 'BUY', 10, 100, 0, 'CC'), s.act('s3', 'SELL', 10, 90, 5, 'CC')]);
    await s.insertCa([...s.vendor('i', 'EXTERNAL_ASSET_TRANSFER_IN', 10, 2, 'AA'), ...s.vendor('o', 'EXTERNAL_ASSET_TRANSFER_OUT', 11, -2, 'BB'), ...s.vendor('a', 'ADJUSTMENT', 12, 3, 'CC')]);
    await s.rebuild();
    assert.deepEqual(await s.counters(), { excluded_positions: 0, excluded_corporate: 1, excluded_transfer: 2 });
    // A row stored before F-32 carries no flag in `detail`: the loader reads the raw type, so it reads the same.
    assert.equal((await s.sql`select count(*)::int as n from corporate_actions where user_id = ${s.u.id} and detail ? 'transfer'`)[0].n, 0, 'nothing new is stored');
    await s.sql`delete from corporate_actions where user_id = ${s.u.id}`;
    await s.rebuild();
    assert.deepEqual(await s.counters(), { excluded_positions: 0, excluded_corporate: 0, excluded_transfer: 0 });
    assert.deepEqual(await s.shown(), ['AA', 'BB', 'CC']);
  } finally { await s.cleanup(); }
});

dbTest('loadCorporateActions flags exactly the three transfer types: not an ADJUSTMENT, a spin-off described on a transfer row, or an unusable trade row', async () => {
  const s = await setup();
  try {
    const { fromVendorRows, unusableTrade } = await import('./corporate-actions.ts');
    const acc = `${s.u.id}-acc`, row = (id: string, type: string, units: number | null, description?: string) =>
      ({ id: `${s.u.id}-${id}`, type, units, trade_date: '2025-03-10', symbol: { symbol: 'WX' }, ...(description ? { description } : {}) });
    const mapped = fromVendorRows(acc, [row('t', 'TRANSFER', 1), row('i', 'EXTERNAL_ASSET_TRANSFER_IN', null), row('o', 'EXTERNAL_ASSET_TRANSFER_OUT', -2),
      row('a', 'ADJUSTMENT', 3), row('sp', 'TRANSFER', 4, 'SPIN-OFF shares')]).actions;
    const bad = unusableTrade(acc, { id: `${s.u.id}-u`, symbol: 'WX', type: 'SELL', trade_date: '2025-03-11', price: 0, units: 5 })!;
    await s.insertCa([...mapped, bad]);
    const flagged = Object.fromEntries((await s.load()).map((a) => [a.externalId.slice(`${s.u.id}-`.length), (a as { transfer?: true }).transfer === true]));
    assert.deepEqual(flagged, { t: true, i: true, o: true, a: false, sp: false, u: false });
  } finally { await s.cleanup(); }
});
