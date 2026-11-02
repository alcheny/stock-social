// Fixes cycle 5 (docs/features/logs/fixes-cycle5/plan-round2.md):
// F5-8 (C5-11): the rebuild's keyset pages keep the stored microseconds, so a page boundary on a sub-millisecond time
//   never re-reads (or skips) a row: the paged rebuild equals the matcher over the whole set, for shares and options.
// F5-15 (C5-13): a sync's vendor positions reads run before the rebuild locks the trader's closed trades, so a note save
//   (and any row lock on closed_trades) is never stuck behind a vendor call; the positions written are unchanged.
// Every test creates its own trader (unique tag) and deletes exactly what it created.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { OptionRow } from './options.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const MIN = 60_000;
const prng = (seed: number) => { let t = seed >>> 0; return () => { t = (t + 0x6d2b79f5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };

async function trader(prefix: string) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `${prefix}${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const accounts: string[] = [];
  const cleanup = async () => {
    await sql`delete from users where id = ${u.id}`;
    if (accounts.length) await sql`delete from broker_accounts where account_id in ${sql(accounts)}`;
  };
  return { sql, tag, id: u.id, accounts, cleanup };
}

// Every stored time gets 1..999 µs on top of its whole millisecond (spacing is a minute, so the order is unchanged).
const addMicros = (table: 'activities' | 'option_activities', userId: number) => import('./db.ts').then(({ sql }) =>
  sql`update ${sql(table)} set executed_at = executed_at + ((abs(hashtext(external_id)) % 999) + 1) * interval '1 microsecond' where user_id = ${userId}`);

dbTest('F5-8: 2,500 share activities with microsecond times over 3 rebuild pages equal matchTrades over the whole set', async () => {
  const t = await trader('fc5wp2a');
  const { insertActivities, rebuildTrades, REBUILD_PAGE } = await import('./sync.ts');
  const { matchTrades } = await import('./trades.ts');
  assert.ok(2500 > 2 * REBUILD_PAGE && 2500 < 3 * REBUILD_PAGE, 'three pages');
  const rnd = prng(8);
  const acc = `${t.tag}-acc`;
  const t0 = Date.UTC(2025, 0, 2, 15);
  // Two symbols, alternating buys and sells with varied units, so a re-read or skipped row changes the FIFO result.
  const acts = Array.from({ length: 2500 }, (_, i) => {
    const symbol = i < 1299 ? 'AAA' : 'BBB'; // each symbol starts on a buy, so no sell is oversold
    const side: 'BUY' | 'SELL' = i % 3 === 2 ? 'SELL' : 'BUY';
    return { externalId: `${t.tag}-${String(i).padStart(5, '0')}`, accountId: acc, symbol, side, units: side === 'SELL' ? 2 : 1, price: 50 + Math.floor(rnd() * 100), fee: 0,
      executedAt: new Date(t0 + i * MIN), verified: true, raw: {} };
  });
  try {
    await insertActivities(t.id, 'snaptrade', acts);
    await addMicros('activities', t.id);
    const micro = await t.sql`select count(*)::int as n from activities where user_id = ${t.id} and extract(microseconds from executed_at)::int % 1000 <> 0`;
    assert.equal(micro[0].n, 2500, 'every stored time has sub-millisecond digits');
    // The boundary rows of both page cuts carry microseconds (the case that re-read a row before the fix).
    const cuts = await t.sql`select executed_at::text as at from activities where user_id = ${t.id} order by account_id, symbol, executed_at, external_id, source offset ${REBUILD_PAGE - 1} limit 1`;
    assert.match(cuts[0].at as string, /\.\d{6}\+/);
    const r = await rebuildTrades(t.id);
    const all = await t.sql`select external_id, account_id, symbol, side, units, price, fee, executed_at, source from activities where user_id = ${t.id}
      order by account_id, symbol, executed_at, external_id, source`;
    const m = matchTrades(all.map((x) => ({ externalId: x.external_id, accountId: x.account_id, symbol: x.symbol, side: x.side, units: x.units, price: x.price, fee: x.fee,
      executedAt: x.executed_at, verified: x.source === 'snaptrade' })));
    const stored = await t.sql`select sell_id, symbol, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${t.id} order by sell_id`;
    const want = [...m.trades].sort((a, b) => (a.sellId < b.sellId ? -1 : 1)).map((x) => ({ sell_id: x.sellId, symbol: x.symbol, opened_at: x.openedAt.toISOString(),
      closed_at: x.closedAt.toISOString(), return_pct: x.returnPct, holding_days: x.holdingDays }));
    assert.equal(want.length, 833); // every sell closes (none excluded): a re-read or skipped row would change this
    assert.equal(m.excluded, 0);
    assert.equal(r.trades, want.length);
    assert.equal(r.excluded, m.excluded);
    assert.deepEqual(stored.map((x) => ({ ...x, opened_at: (x.opened_at as Date).toISOString(), closed_at: (x.closed_at as Date).toISOString() })), want);
  } finally { await t.cleanup(); }
});

dbTest('F5-8: 2,500 option activities with microsecond times over 3 option pages equal matchOptions over the whole set', async () => {
  const t = await trader('fc5wp2o');
  const { insertOptionActivities, rebuildOptionTrades, OPTION_PAGE } = await import('./options-sync.ts');
  const { matchOptions } = await import('./options.ts');
  assert.ok(2500 > 2 * OPTION_PAGE && 2500 < 3 * OPTION_PAGE, 'three pages');
  const rnd = prng(15);
  const acc = `${t.tag}-acc`;
  const t0 = Date.UTC(2025, 0, 2, 15);
  const asOf = new Date(Date.UTC(2025, 2, 1));
  // One contract per half; opens and closes alternate with varied prices, so a re-read row shifts every later pairing.
  const rows: (OptionRow & { raw: unknown })[] = Array.from({ length: 2500 }, (_, i) => {
    const open = i % 2 === 0;
    const put = i >= 1250;
    return { externalId: `${t.tag}-${String(i).padStart(5, '0')}`, accountId: acc, kind: open ? 'BUY' : 'SELL', openClose: open ? 'BUY_TO_OPEN' : 'SELL_TO_CLOSE',
      underlying: 'XYZ', underlyingType: 'cs', right: put ? 'PUT' : 'CALL', expiry: '2026-12-18', strikeMilli: 123_450, multiplier: 100,
      occTicker: put ? 'XYZ   261218P00123450' : 'XYZ   261218C00123450', units: 1, price: 1 + Math.floor(rnd() * 40) / 10, fee: 0, amount: null, currency: 'USD',
      executedAt: new Date(t0 + i * MIN), verified: true, raw: {} };
  });
  try {
    await insertOptionActivities(t.id, 'snaptrade', rows);
    await addMicros('option_activities', t.id);
    const micro = await t.sql`select count(*)::int as n from option_activities where user_id = ${t.id} and extract(microseconds from executed_at)::int % 1000 <> 0`;
    assert.equal(micro[0].n, 2500);
    const r = await t.sql.begin((tx) => rebuildOptionTrades(t.id, tx, asOf));
    const m = matchOptions(rows, asOf);
    const stored = await t.sql`select close_id, option_right, opened_at, closed_at, return_pct, holding_days from option_trades where user_id = ${t.id} order by close_id`;
    const want = [...m.trades].sort((a, b) => (a.closeId < b.closeId ? -1 : 1)).map((x) => ({ close_id: x.closeId, option_right: x.right,
      opened_at: x.openedAt.toISOString(), closed_at: x.closedAt.toISOString(), return_pct: x.returnPct, holding_days: x.holdingDays }));
    assert.equal(want.length, 1250);
    assert.equal(r.trades, want.length);
    assert.deepEqual(r.counts, m.counts);
    assert.deepEqual(stored.map((x) => ({ ...x, opened_at: (x.opened_at as Date).toISOString(), closed_at: (x.closed_at as Date).toISOString() })), want);
  } finally { await t.cleanup(); }
});

// F5-15: a trader with one connected account; the fake broker in the vendor's shapes, positions gated by a promise.
async function syncTrader(prefix: string) {
  const t = await trader(prefix);
  const vendor = `${t.tag}-v`;
  await t.sql`update users set snaptrade_user_id = ${vendor}, snaptrade_secret_enc = 'enc' where id = ${t.id}`;
  const acc = { id: `${t.tag}-a`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true };
  t.accounts.push(acc.id);
  await t.sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${t.sql.json([acc])} from users where id = ${t.id}`;
  const user = { id: t.id, snaptrade_user_id: vendor, snaptrade_secret_enc: 'enc' };
  const act = (id: string, side: 'BUY' | 'SELL', price: number, day: number) => ({
    externalId: `${t.tag}-${id}`, accountId: acc.id, symbol: 'AAA', side, units: 1, price, fee: 0, executedAt: new Date(Date.UTC(2024, 0, day)), verified: true, raw: {},
  });
  return { ...t, user, acc, act };
}

const optionPosition = { instrument: { kind: 'option', id: 'i', symbol: 'XYZ   271217C00123450', option_type: 'CALL', strike_price: '123.45', expiration_date: '2027-12-17', multiplier: '100',
  underlying: { kind: 'stock', id: 'u', symbol: 'XYZ', raw_symbol: 'XYZ' } }, units: '1', price: '1.5', cost_basis: '2' };

async function gatedBroker(s: Awaited<ReturnType<typeof syncTrader>>, gate: { on: boolean }) {
  const { splitPositionKinds } = await import('./broker.ts');
  let release!: () => void, entered!: () => void;
  const released = new Promise<void>((r) => { release = r; });
  const reached = new Promise<void>((r) => { entered = r; });
  let calls = 0;
  const broker = {
    listAccounts: async () => [s.acc],
    fetchActivities: async () => [s.act('b1', 'BUY', 100, 1), s.act('s1', 'SELL', 90, 2), s.act('b2', 'BUY', 40, 3)],
    fetchPositions: async (_u: unknown, _id: string, sink?: (x: unknown) => void) => {
      calls++;
      if (gate.on) { entered(); await released; }
      sink?.(splitPositionKinds([optionPosition as never]).split);
      return [{ symbol: 'AAA', unrealizedPct: -0.125 }, { symbol: 'QQQ', unrealizedPct: 0.25 }];
    },
  };
  return { broker, release, reached, calls: () => calls };
}

const positionsOf = async (s: Awaited<ReturnType<typeof syncTrader>>) => {
  const shares = await s.sql`select symbol, unrealized_pct from open_positions where user_id = ${s.id} order by symbol`;
  const opts = await s.sql`select * from open_option_positions where user_id = ${s.id}`;
  const strip = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([k, v]) => !['user_id', 'account_id', 'fetched_at', 'id', 'created_at', 'updated_at'].includes(k) && !(v instanceof Date)));
  return { shares: shares.map((r) => ({ ...r })), options: opts.map(strip) };
};

for (const cadence of [false, true]) {
  dbTest(`F5-15 (${cadence ? 'cadence' : 'every account'}): while the vendor positions call is pending, the trader's closed trades are not locked and a note save completes; the positions written are unchanged`, async () => {
    const s = await syncTrader(cadence ? 'fc5wp2c' : 'fc5wp2n');
    const control = await syncTrader(cadence ? 'fc5wp2d' : 'fc5wp2m');
    const { syncUser } = await import('./sync.ts');
    const { saveThesisFor } = await import('./thesis-save.ts');
    const opts = cadence ? { cadence: true } : {};
    try {
      // The control trader: the same vendor rows, never gated (the positions a sync writes for them).
      const c = await gatedBroker(control, { on: false });
      await syncUser(control.user, c.broker as never, undefined, undefined, opts);
      // The trader's first sync publishes the closed trade the note goes on.
      const gate = { on: false };
      const g = await gatedBroker(s, gate);
      await syncUser(s.user, g.broker as never, undefined, undefined, opts);
      const [trade] = await s.sql`select id from closed_trades where user_id = ${s.id}`;
      assert.ok(trade, 'one closed trade');
      // The second sync: activities read again (cadence: the vendor marks reset so every read is due), positions gated.
      if (cadence) {
        await s.sql`update broker_accounts set activities_read_at = null, positions_read_at = null where user_id = ${s.id}`;
        await s.sql`delete from sync_read_marks where user_id = ${s.id}`; // the G2 marks too (the 6 h attempt floor)
      }
      gate.on = true;
      const before = g.calls();
      const sync = syncUser(s.user, g.broker as never, undefined, undefined, opts);
      // The positions call is now pending, inside the sync's transaction (a sync that ends without one fails the test).
      await Promise.race([g.reached, sync.then(() => { throw new Error('the sync ended without a positions call'); })]);
      // Another connection can lock the trader's closed trades at once (NOWAIT fails at once if a lock is held).
      await s.sql.begin(async (tx) => { await tx`select id from closed_trades where user_id = ${s.id} for update nowait`; });
      // A note save completes before the vendor call is released (it would wait on the rebuild's row locks otherwise).
      await saveThesisFor(s.id, String(trade.id), 'Entry on the breakout, exit at the stop.');
      const [saved] = await s.sql`select thesis from closed_trades where id = ${trade.id}`;
      assert.equal(saved.thesis, 'Entry on the breakout, exit at the stop.');
      assert.equal(g.calls(), before + 1, 'the positions call has not returned yet');
      g.release();
      await sync;
      // The rebuild ran after the note save: the note is on the rebuilt trade.
      const notes = await s.sql`select thesis from closed_trades where user_id = ${s.id}`;
      assert.deepEqual(notes.map((r) => r.thesis), ['Entry on the breakout, exit at the stop.']);
      // The positions written equal the control trader's (same vendor rows, no gate) and the vendor rows themselves.
      const mine = await positionsOf(s), theirs = await positionsOf(control);
      assert.deepEqual(mine, theirs);
      assert.deepEqual(mine.shares, [{ symbol: 'AAA', unrealized_pct: -0.125 }, { symbol: 'QQQ', unrealized_pct: 0.25 }]);
      assert.equal(mine.options.length, 1);
    } finally { await s.cleanup(); await control.cleanup(); }
  });
}
