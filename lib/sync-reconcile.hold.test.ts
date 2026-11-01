// F-24, council cycle 5 RT-2: the rebuild passes held possible re-issues to the matcher (`held: true`) instead of
// dropping them. A held BUY opens no lot; a held SELL is counted; every SELL of the pair after a held row (or at its
// instant, other than the held row's unheld twins) is counted while the row is held. Dropping the row instead priced the
// pair's later sells from a ledger missing (or doubling) a fill: a wrong figure published, a loss gone uncounted.
// 1. Pure matcher probes (held SELL, held BUY), each contrasted with the old drop and with the truth.
// 2. End to end through syncUser (cadence, in-memory broker): a held row's later sell is counted while held, then shown
//    with the right return once a read lists the pair (count rule).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchTrades, type Activity } from './trades.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000, DAY = 24 * HOUR;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const T = (d: number) => new Date(Date.UTC(2026, 0, 1) + d * DAY);
const act = (id: string, side: 'BUY' | 'SELL', units: number, price: number, d: number, held = false): Activity => ({
  externalId: id, accountId: 'A', symbol: 'XX', side, units, price, fee: 0, executedAt: T(d), verified: true, ...(held ? { held: true } : {}),
});
const returns = (r: ReturnType<typeof matchTrades>) => Object.fromEntries(r.trades.map((t) => [t.sellId, t.returnPct]));

test('(1a) a held identical SELL: the later sell is counted, never priced from the wrong lot; E stays shown', () => {
  const b1 = act('b1', 'BUY', 10, 10, 0), b2 = act('b2', 'BUY', 10, 5, 1), b3 = act('b3', 'BUY', 10, 8, 1.5);
  const e = act('e', 'SELL', 10, 6, 2), s = act('s', 'SELL', 10, 12, 3);
  const nHeld = act('n', 'SELL', 10, 6, 2, true), n = act('n', 'SELL', 10, 6, 2);
  const held = matchTrades([b1, b2, b3, e, nHeld, s]);
  assert.deepEqual(Object.keys(returns(held)), ['e'], 'only E is priced while N is held');
  assert.ok(near(returns(held).e, -0.4), 'E: -40% from the 10 lot');
  assert.equal(held.excludedHeld, 2, 'N (held sell) and the later sell are counted (their own count, RT-2)');
  assert.equal(held.excluded, 0, 'never as "no recorded entry"');
  // The two readings the held row stands between, and the old drop:
  const genuine = returns(matchTrades([b1, b2, b3, e, n, s])); // N a second fill
  assert.ok(near(genuine.n, 0.2) && near(genuine.s, 0.5), 'truth if genuine: N +20%, the later sell +50%');
  const dropped = matchTrades([b1, b2, b3, e, s]); // the old rebuild: N left out
  assert.ok(near(returns(dropped).s, 1.4), 'the old drop published the later sell at +140% from the 5 lot');
  assert.equal(dropped.excluded, 0, 'and counted nothing');
  assert.ok(!near(returns(dropped).s, genuine.s), 'a wrong figure if N is genuine');
});

test('(1b) a held identical BUY: the later sells are counted, never published at a wrong figure (a -20% close shown as +6.7% under the old drop)', () => {
  const e = act('e', 'BUY', 10, 20, 0), nHeld = act('n', 'BUY', 10, 20, 0, true), n = act('n', 'BUY', 10, 20, 0);
  const b1 = act('b1', 'BUY', 10, 15, 1), s1 = act('s1', 'SELL', 10, 20, 2), s2 = act('s2', 'SELL', 10, 16, 3);
  const held = matchTrades([e, nHeld, b1, s1, s2]);
  assert.deepEqual(held.trades, [], 'no sell after the held buy is priced');
  assert.equal(held.excludedHeld, 2, 'both later sells counted (their own count, RT-2)');
  assert.equal(held.excluded, 0);
  const genuine = returns(matchTrades([e, n, b1, s1, s2]));
  assert.ok(near(genuine.s1, 0) && near(genuine.s2, -0.2), 'truth if genuine: s2 -20% from N\'s 20 lot');
  const dropped = returns(matchTrades([e, b1, s1, s2]));
  assert.ok(near(dropped.s2, 16 / 15 - 1), 'the old drop: s2 +6.7% from the 15 lot');
  assert.ok(dropped.s2 > 0 && genuine.s2 < 0, 'a loss published as a gain');
});

test('(1c) a sell at the held row\'s instant that is its unheld twin stays shown; another sell at that instant is counted', () => {
  const b = act('b', 'BUY', 30, 10, 0), e = act('e', 'SELL', 10, 12, 1), nHeld = act('n', 'SELL', 10, 12, 1, true), x = act('x', 'SELL', 5, 11, 1);
  const r = matchTrades([b, e, nHeld, x]);
  assert.deepEqual(Object.keys(returns(r)), ['e']);
  assert.equal(r.excludedHeld, 2, 'N and the non-twin sell at its instant (their own count, RT-2)');
});

dbTest('(2) end to end: a held row\'s later sell is counted (no close) while held; once a read lists N with E it is genuine and the later sell shows the right return', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { syncUser, insertActivities } = await import('./sync.ts');
  const tag = `rh${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const acc = { id: `${tag}-a`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true };
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json([acc])}, now()
    from users where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  const base = Date.now() - 40 * DAY;
  const at = (d: number) => new Date(base + d * DAY);
  const row = (id: string, side: 'BUY' | 'SELL', units: number, price: number, d: number) => ({
    externalId: `${tag}-${id}`, accountId: acc.id, symbol: 'XX', side, units, price, fee: 0, executedAt: at(d), verified: true, raw: { type: side },
  });
  const b1 = row('b1', 'BUY', 10, 10, -26), b2 = row('b2', 'BUY', 10, 5, -25), b3 = row('b3', 'BUY', 10, 8, -24.5);
  const e = row('e', 'SELL', 10, 6, -23), n = row('n', 'SELL', 10, 6, -23), s = row('s', 'SELL', 10, 12, -21);
  let list = [b1, b2, b3, e];
  // No paged endpoint: no pass, every daily read is the week read.
  const broker = { listAccounts: async () => [acc], fetchActivities: async (_u: unknown, since: Date) => list.filter((r) => r.executedAt >= since) };
  const round = (h: number) => syncUser(user, broker as never, undefined, undefined, { cadence: true, shiftMs: base + h * HOUR - Date.now() });
  const shown = async () => Object.fromEntries((await sql`select sell_id, return_pct from closed_trades where user_id = ${u.id}`).map((r) => [String(r.sell_id).slice(tag.length + 1), Number(r.return_pct)]));
  // RT-2: held-counted sells have their own column (excluded_held), never excluded_positions ("no recorded entry").
  const excluded = async () => (await sql`select excluded_held as n from users where id = ${u.id}`)[0].n as number;
  const noEntry = async () => (await sql`select excluded_positions as n from users where id = ${u.id}`)[0].n as number;
  const state = async () => (await sql`select state from activity_reissues where external_id = ${n.externalId}`)[0]?.state ?? null;
  try {
    await insertActivities(u.id, 'snaptrade', list);
    await round(0);
    assert.deepEqual(Object.keys(await shown()), ['e']);
    assert.equal(await excluded(), 0);
    list = [b1, b2, b3, n]; // the week read lists N, not E: N held
    await round(25);
    assert.equal(await state(), 'pending');
    assert.equal(await excluded(), 1, 'the held sell is counted');
    list = [b1, b2, b3, n, s]; // the pair's later sell arrives while N is held
    await round(50);
    assert.equal(await state(), 'pending');
    const held = await shown();
    assert.deepEqual(held, { e: -0.4 }, `while N is held the later sell is not priced (got ${JSON.stringify(held)})`);
    assert.equal(await excluded(), 2, 'the later sell is counted in excluded_held');
    assert.equal(await noEntry(), 0, 'and never as a sell with no recorded entry');
    list = [b1, b2, b3, e, n, s]; // one read lists N with its unheld twin E (k = 2, p = 1): N genuine
    await round(75);
    assert.equal(await state(), 'genuine');
    const r = await shown();
    assert.deepEqual(Object.keys(r).sort(), ['e', 'n', 's']);
    assert.ok(near(r.e, -0.4) && near(r.n, 0.2), 'E from the 10 lot, N from the 5 lot');
    assert.ok(near(r.s, 0.5), `the later sell at +50% from the 8 lot (got ${r.s})`);
    assert.equal(await excluded(), 0, 'excluded_held drops back');
  } finally {
    await sql`delete from users where id = ${u.id}`;
    await sql`delete from broker_accounts where account_id = ${acc.id}`;
  }
});
