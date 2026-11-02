// F-22 through the database: stored vendor transfer rows and rebuildTrades give the shown closes and the counts
// (users.excluded_transferred_out, users.sells_partly_transferred, users.excluded_transfer); a transfer out of a pair with
// no stored activity is counted too; rebuilding twice gives identical closed_trades rows. Fictional records; each test
// deletes only the user it created.
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
  const tag = `f22${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const acc = `${tag}-acc`;
  const day = (n: number) => new Date(Date.UTC(2025, 2, 1) + n * 86_400_000);
  const act = (id: string, side: 'BUY' | 'SELL', units: number, price: number, n: number, symbol = 'WX') => ({
    externalId: `${tag}-${id}`, accountId: acc, symbol, side, units, price, fee: 0, executedAt: day(n), verified: true, raw: {},
  });
  const vendor = (id: string, type: string, n: number, units: number | null, symbol = 'WX') =>
    fromVendorRows(acc, [{ id: `${tag}-${id}`, type, units, trade_date: day(n).toISOString(), symbol: { symbol } }]).actions;
  const counters = async () => (await sql`select excluded_transfer, excluded_transferred_out, sells_partly_transferred, excluded_corporate from users where id = ${u.id}`)[0];
  const closes = async () => (await sql`select sell_id, symbol, return_pct, opened_at, holding_days, verified from closed_trades where user_id = ${u.id} order by sell_id`).map((r) => ({ ...r }));
  return {
    sql, u, act, vendor, counters, closes, rebuild: () => rebuildTrades(u.id),
    insert: (acts: ReturnType<typeof act>[]) => insertActivities(u.id, 'snaptrade', acts),
    insertCa: (rows: (CorporateAction & { raw: unknown })[]) => insertCorporateActions(sql, u.id, 'snaptrade', rows),
    cleanup: () => sql`delete from users where id = ${u.id}`,
  };
}

dbTest('the three probes and Q5 through stored rows: −60% closes shown, the transfer out and the partly-transferred sell counted; rebuilt twice, identical', async () => {
  const s = await setup();
  try {
    await s.insert([
      s.act('b1', 'BUY', 100, 100, 0, 'P1'), s.act('s1', 'SELL', 100, 40, 40, 'P1'), // probe 1
      s.act('b2', 'BUY', 100, 100, 0, 'P2'), s.act('s2', 'SELL', 99, 40, 40, 'P2'), // probe 2
      s.act('b3', 'BUY', 100, 100, 0, 'P3'), // probe 3
      s.act('b5', 'BUY', 100, 100, 0, 'Q5'), s.act('s5', 'SELL', 101, 40, 40, 'Q5'), // Q5
    ]);
    await s.insertCa([...s.vendor('t1', 'TRANSFER', 20, 1, 'P1'), ...s.vendor('t2', 'EXTERNAL_ASSET_TRANSFER_OUT', 20, -1, 'P2'),
      ...s.vendor('t3', 'TRANSFER', 20, -100, 'P3'), ...s.vendor('t5', 'EXTERNAL_ASSET_TRANSFER_IN', 20, 1, 'Q5'),
      ...s.vendor('t6', 'EXTERNAL_ASSET_TRANSFER_OUT', 20, -5, 'NOACT')]); // a pair with no stored activity
    await s.rebuild();
    const first = await s.closes();
    assert.deepEqual(first.map((r) => [r.symbol, Math.round(r.return_pct * 1e6) / 1e6]), [['P1', -0.6], ['P2', -0.6], ['Q5', -0.6]]);
    assert.deepEqual(await s.counters(), { excluded_transfer: 0, excluded_transferred_out: 3, sells_partly_transferred: 1, excluded_corporate: 0 });
    await s.rebuild();
    assert.deepEqual(await s.closes(), first, 'byte-identical rebuild');
  } finally { await s.cleanup(); }
});

dbTest('the loader: an _OUT row with units above 0 contradicts its type and is read unit-less (tainted, counted as out); a unit-less TRANSFER is not counted as out', async () => {
  const s = await setup();
  try {
    await s.insert([s.act('b', 'BUY', 10, 100, 0), s.act('s', 'SELL', 10, 90, 40), s.act('b2', 'BUY', 10, 100, 0, 'YX'), s.act('s2', 'SELL', 10, 90, 40, 'YX')]);
    await s.insertCa([...s.vendor('o', 'EXTERNAL_ASSET_TRANSFER_OUT', 20, 3), ...s.vendor('u', 'TRANSFER', 20, null, 'YX')]);
    await s.rebuild();
    assert.deepEqual(await s.counters(), { excluded_transfer: 2, excluded_transferred_out: 1, sells_partly_transferred: 0, excluded_corporate: 0 });
  } finally { await s.cleanup(); }
});
