// Fixes cycle 4, F4-1 (docs/direction/cycle4-2026-11-01.md, C4-6) through the rebuild: a symbol-less vendor sell is
// stored as an account-wide unusable row, counted once per rebuild however many pairs its account has, and a future-dated
// unusable sell is counted as future until its date passes. Fictional rows; only rows this file creates are read or deleted.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { insertActivities, rebuildTrades } = await import('./sync.ts');
  const { insertCorporateActions } = await import('./corporate-actions.ts');
  const { toActivities } = await import('./broker.ts');
  const tag = `f41${Math.random().toString(36).slice(2, 10)}`;
  const made: number[] = [];
  const mkUser = async () => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
    made.push(u.id);
    return u.id;
  };
  // Vendor-shaped trade rows, through the real importer (lib/broker.ts#toActivities); `symbol` null is the F4-1 row.
  const vendor = (id: string, side: 'BUY' | 'SELL', units: number, price: number, at: string | null, symbol: string | null = 'FAKE', acc = 'acc') =>
    ({ acc, row: { id: `${tag}-${id}`, symbol: symbol === null ? null : { symbol }, type: side, trade_date: at, price, units: side === 'SELL' ? -units : units, fee: 0 } });
  const store = async (u: number, rows: ReturnType<typeof vendor>[]) => {
    for (const acc of new Set(rows.map((r) => r.acc))) {
      const got = toActivities(`${tag}-${acc}`, rows.filter((r) => r.acc === acc).map((r) => r.row));
      await insertActivities(u, 'snaptrade', got.activities);
      await insertCorporateActions(sql, u, 'snaptrade', got.unusable);
    }
  };
  const closes = async (u: number) => (await sql`select sell_id, return_pct from closed_trades where user_id = ${u} order by closed_at, sell_id`)
    .map((r) => [(r.sell_id as string).slice(tag.length + 1), +(r.return_pct as number).toFixed(4)]);
  const counts = async (u: number) => {
    const [r] = await sql`select excluded_positions, excluded_corporate, excluded_future from users where id = ${u}`;
    return { positions: r.excluded_positions as number, corporate: r.excluded_corporate as number, future: r.excluded_future as number };
  };
  const cleanup = async () => { if (made.length) await sql`delete from users where id in ${sql(made)}`; };
  return { sql, tag, mkUser, vendor, store, closes, counts, rebuildTrades, cleanup };
}

dbTest('F4-1 probe through the rebuild: the symbol-less sell is stored with account scope and counted; +80% is never published', async () => {
  const t = await setup();
  try {
    const u = await t.mkUser();
    await t.store(u, [t.vendor('b1', 'BUY', 100, 10, '2026-04-01T14:00:00Z'), t.vendor('s1', 'SELL', 100, 15, '2026-04-05T14:00:00Z', null),
      t.vendor('b2', 'BUY', 100, 20, '2026-04-08T14:00:00Z'), t.vendor('s2', 'SELL', 100, 18, '2026-04-10T14:00:00Z')]);
    const [stored] = await t.sql`select symbol, kind, detail from corporate_actions where user_id = ${u}`;
    assert.deepEqual([stored.symbol, stored.kind, stored.detail.reason, stored.detail.side, stored.detail.scope, stored.detail.units], ['', 'unpriceable', 'trade', 'SELL', 'account', 100]);
    const r = await t.rebuildTrades(u);
    assert.deepEqual(await t.closes(u), []);
    assert.equal(r.excludedCorporate, 2);
    assert.deepEqual(await t.counts(u), { positions: 0, corporate: 2, future: 0 });
  } finally { await t.cleanup(); }
});

dbTest('F4-1: a symbol-less sell in an account with several pairs (one a rename chain) is counted once per rebuild, and once more for an account with no trades', async () => {
  const t = await setup();
  try {
    const u = await t.mkUser();
    await t.store(u, [
      t.vendor('a1', 'BUY', 10, 10, '2026-04-01T14:00:00Z', 'AAA'), t.vendor('a2', 'SELL', 10, 12, '2026-04-09T14:00:00Z', 'AAA'), // holds lots then: counted
      t.vendor('b1', 'BUY', 10, 10, '2026-04-06T14:00:00Z', 'BBB'), t.vendor('b2', 'SELL', 10, 13, '2026-04-09T14:00:00Z', 'BBB'),
      t.vendor('c1', 'BUY', 10, 10, '2026-04-06T14:00:00Z', 'CCC'),
      t.vendor('d2', 'SELL', 10, 14, '2026-04-12T14:00:00Z', 'DDD'),
      t.vendor('x1', 'SELL', 10, 15, '2026-04-05T14:00:00Z', null), // the symbol-less sell
      t.vendor('y1', 'SELL', 5, 15, '2026-04-05T14:00:00Z', null, 'acc2'), // an account with no other row
    ]);
    // CCC is renamed DDD (1:1) after the buy: a chain, replayed in its own flush with the account-wide rows.
    await t.sql`insert into corporate_actions (user_id, source, external_id, account_id, symbol, kind, detail, executed_at, raw)
      values (${u}, 'snaptrade', ${`${t.tag}-ren`}, ${`${t.tag}-acc`}, 'CCC', 'symbol-change', ${t.sql.json({ newSymbol: 'DDD', outUnits: 10, inUnits: 10 })}, '2026-04-08T00:00:00Z', '{}')`;
    for (let i = 0; i < 2; i++) {
      const r = await t.rebuildTrades(u);
      assert.deepEqual(await t.closes(u), [['b2', 0.3], ['d2', 0.4]]);
      assert.equal(r.excludedCorporate, 3, `rebuild ${i + 1}: x1 once, y1 once, a2`);
      assert.deepEqual(await t.counts(u), { positions: 0, corporate: 3, future: 0 });
    }
  } finally { await t.cleanup(); }
});

dbTest('F4-1: a future-dated unusable sell raises excluded_future and moves to the corporate count once its date passes', async () => {
  const t = await setup();
  try {
    const u = await t.mkUser();
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    await t.store(u, [t.vendor('b1', 'BUY', 10, 10, '2026-04-01T14:00:00Z', 'OTHR'), t.vendor('s1', 'SELL', 10, 11, '2026-04-03T14:00:00Z', 'OTHR'),
      t.vendor('f1', 'SELL', 10, 15, future, null), // symbol-less, dated in the future
      t.vendor('f2', 'SELL', 10, 0, future, 'FAKE')]); // no usable price, dated in the future
    let r = await t.rebuildTrades(u);
    assert.deepEqual(await t.closes(u), [['s1', 0.1]]);
    assert.equal(r.future, 2);
    assert.deepEqual(await t.counts(u), { positions: 0, corporate: 0, future: 2 });
    // The clock passes the rows' date (simulated by moving the test's own fixture rows into the past).
    await t.sql`update corporate_actions set executed_at = '2026-04-10T14:00:00Z' where user_id = ${u}`;
    r = await t.rebuildTrades(u);
    assert.deepEqual(await t.closes(u), [['s1', 0.1]]);
    assert.equal(r.future, 0);
    assert.deepEqual(await t.counts(u), { positions: 0, corporate: 2, future: 0 });
  } finally { await t.cleanup(); }
});

dbTest('F4-1 review: an undated symbol-less sell through the rebuild: counted once, the account\'s later sell never priced from the wrong lot', async () => {
  const t = await setup();
  try {
    const u = await t.mkUser();
    await t.store(u, [t.vendor('b1', 'BUY', 100, 10, '2026-04-01T14:00:00Z'), t.vendor('b2', 'BUY', 100, 20, '2026-04-10T14:00:00Z'),
      t.vendor('s2', 'SELL', 100, 18, '2026-04-20T14:00:00Z'), t.vendor('o1', 'BUY', 10, 10, '2026-04-02T14:00:00Z', 'OTHR'),
      t.vendor('o2', 'SELL', 10, 11, '2026-04-03T14:00:00Z', 'OTHR'), t.vendor('s1', 'SELL', 100, 15, null, null)]);
    const r = await t.rebuildTrades(u);
    assert.deepEqual(await t.closes(u), []);
    assert.equal(r.excludedCorporate, 3); // s1 once (two pairs replayed it), s2, o2
    assert.deepEqual(await t.counts(u), { positions: 0, corporate: 3, future: 0 });
  } finally { await t.cleanup(); }
});
