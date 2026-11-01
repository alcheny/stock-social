// F-24 AC5 (docs/features/F-24-late-sell-reconciliation.md D4; plan docs/features/logs/F-24/plan.md §4 and round 3 item 8):
// every rebuild that changes or removes a close already shown is counted (users.closes_rewritten) and logged once per
// user with the internal id and counts only:
//   console.log('sync closes rewritten', <id>, '{"changed":c,"removed":r,"added":a}')
// - a late BUY that changes the FIFO match of a shown close (changed = 1), on the cadence path and the plain syncUser path;
// - a paper flip removes the account's closes (removed);
// - an add-only rebuild writes and logs nothing;
// - an option close changed by a late option buy is counted too.
// Also the 'sync reissues' and 'sync reconcile invalid' line shapes, at run time and in the source (lib/privacy-logs.test.ts).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { consoleCalls, unsafeArgs } from './privacy-logs.test.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000, DAY = 24 * HOUR;
const base = Date.now() - 40 * DAY;
const shiftAt = (h: number) => base + h * HOUR - Date.now();
const at = (d: number) => new Date(base + d * DAY);

const F24 = ['sync closes rewritten', 'sync reissues', 'sync reconcile invalid'];
const KEYS: Record<string, string[]> = {
  'sync closes rewritten': ['changed', 'removed', 'added'],
  'sync reissues': ['found', 'cleared', 'pending', 'suspected', 'optionTwins'],
  'sync reconcile invalid': ['reason'],
};

type Row = { externalId: string; accountId: string; symbol: string; side: 'BUY' | 'SELL'; units: number; price: number; fee: number; executedAt: Date; verified: boolean; raw: unknown };

async function trader() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { syncUser, insertActivities } = await import('./sync.ts');
  const tag = `rl${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const acc = { id: `${tag}-a`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true };
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json([acc])}, now()
    from users where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  const row = (id: string, side: 'BUY' | 'SELL', units: number, price: number, date: Date, symbol = 'XX'): Row => ({
    externalId: `${tag}-${id}`, accountId: acc.id, symbol, side, units, price, fee: 0, executedAt: date, verified: true, raw: { type: side },
  });
  const v = { list: [] as Row[], options: [] as unknown[], paper: false };
  const broker = {
    listAccounts: async () => [{ ...acc, isPaper: v.paper }],
    fetchActivities: async (_u: unknown, since: Date, ids?: string[], sink?: (r: unknown[]) => void) => {
      if (v.options.length) {
        const { toOptionRows } = await import('./broker.ts');
        for (const id of ids ?? []) sink?.(toOptionRows(id, v.options as never));
      }
      return v.list.filter((r) => (ids ?? []).includes(r.accountId) && r.executedAt >= since);
    },
    fetchActivitiesPage: async (_u: unknown, id: string, offset: number, limit = 1000, sink?: (r: unknown[]) => void) => {
      if (v.options.length && offset === 0) sink?.((await import('./broker.ts')).toOptionRows(id, v.options as never));
      const activities = v.list.filter((r) => r.accountId === id).slice(offset, offset + limit);
      return { activities, unusable: [], done: activities.length < limit };
    },
  };
  // Every console.log during one sync, captured (and kept off the test output).
  const logs: unknown[][] = [];
  const capture = async <T>(fn: () => Promise<T>) => {
    const orig = console.log;
    console.log = (...a: unknown[]) => { logs.push(a); };
    try { return await fn(); } finally { console.log = orig; }
  };
  const round = (h: number) => capture(() => syncUser(user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(h) }));
  const plain = () => capture(() => syncUser(user, broker as never)); // the non-cadence path (syncTick, connect/done)
  const rewritten = async () => (await sql`select closes_rewritten as n from users where id = ${u.id}`)[0].n as number;
  const lines = (name: string) => logs.filter((l) => l[0] === name);
  // Every F-24 line: the literal, this trader's internal id, then JSON of counts (or the reason) only.
  const assertShapes = () => {
    for (const l of logs.filter((x) => F24.includes(x[0] as string))) {
      assert.equal(l.length, 3, `${String(l[0])}: three arguments`);
      assert.equal(l[1], u.id, 'the internal numeric id');
      assert.equal(typeof l[2], 'string');
      const o = JSON.parse(l[2] as string) as Record<string, unknown>;
      assert.deepEqual(Object.keys(o), KEYS[l[0] as string], `${String(l[0])}: keys`);
      for (const [k, x] of Object.entries(o)) {
        if (k === 'reason') assert.ok(['shifted', 'missing', 'bound', 'failures'].includes(x as string));
        else assert.ok(Number.isInteger(x) && (x as number) >= 0, `${k}: a count`);
      }
      const text = JSON.stringify(l);
      for (const s of [tag, acc.id, 'XX', 'XYZ', u.handle]) assert.ok(!text.includes(s), `no ${s} in ${text}`);
    }
  };
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id = ${acc.id}`; };
  return { sql, tag, user, acc, v, row, round, plain, logs, lines, rewritten, assertShapes, store: (r: Row[]) => insertActivities(u.id, 'snaptrade', r), cleanup };
}

const lateBuy = async (path: 'cadence' | 'plain') => {
  const t = await trader();
  try {
    const sync = (h: number) => (path === 'cadence' ? t.round(h) : t.plain());
    const b1 = t.row('b1', 'BUY', 10, 10, at(-14)), s = t.row('s', 'SELL', 10, 12, at(-10));
    await t.store([b1, s]);
    t.v.list = [b1, s];
    await sync(0); // first rebuild: one close added, nothing shown before
    assert.deepEqual(t.lines('sync closes rewritten'), [], 'an add-only rebuild logs nothing');
    assert.equal(await t.rewritten(), 0);
    const [c0] = await t.sql`select sell_id, return_pct from closed_trades where user_id = ${t.user.id}`;
    // A BUY the vendor posts late, dated before B1 (inside the week window): FIFO now opens the shown close at 8, not 10.
    t.v.list = [t.row('b0', 'BUY', 10, 8, at(-16)), b1, s];
    t.logs.length = 0;
    await sync(25);
    const [c1] = await t.sql`select sell_id, return_pct from closed_trades where user_id = ${t.user.id}`;
    assert.equal(c1.sell_id, c0.sell_id);
    assert.notEqual(Number(c1.return_pct), Number(c0.return_pct), 'the shown close changed');
    assert.deepEqual(t.lines('sync closes rewritten'), [['sync closes rewritten', t.user.id, '{"changed":1,"removed":0,"added":0}']]);
    assert.equal(await t.rewritten(), 1, 'closes_rewritten + 1');
    t.assertShapes();
    // Add-only: a new round trip arrives; the shown close stays as it is.
    t.v.list.push(t.row('b2', 'BUY', 1, 5, at(-9), 'YY'), t.row('s2', 'SELL', 1, 6, at(-8), 'YY'));
    t.logs.length = 0;
    await sync(50);
    assert.equal((await t.sql`select count(*)::int as n from closed_trades where user_id = ${t.user.id}`)[0].n, 2);
    assert.deepEqual(t.lines('sync closes rewritten'), [], 'an add-only rebuild logs nothing');
    assert.equal(await t.rewritten(), 1, 'and counts nothing');
    t.assertShapes();
  } finally { await t.cleanup(); }
};

dbTest('AC5: a late BUY that re-matches a shown close: changed 1, counted once, one log line (cadence path)', () => lateBuy('cadence'));
dbTest('AC5: the same through the plain syncUser path (no cadence)', () => lateBuy('plain'));

dbTest('AC5: a paper flip removes the shown closes: removed counted and logged', async () => {
  const t = await trader();
  try {
    const rows = [t.row('b1', 'BUY', 10, 10, at(-14)), t.row('s1', 'SELL', 5, 12, at(-12)), t.row('s2', 'SELL', 5, 9, at(-10))];
    await t.store(rows);
    t.v.list = rows;
    await t.round(0);
    assert.equal((await t.sql`select count(*)::int as n from closed_trades where user_id = ${t.user.id}`)[0].n, 2);
    t.v.paper = true; // the vendor flags the account simulated
    t.logs.length = 0;
    await t.round(25);
    assert.equal((await t.sql`select count(*)::int as n from closed_trades where user_id = ${t.user.id}`)[0].n, 0);
    assert.deepEqual(t.lines('sync closes rewritten'), [['sync closes rewritten', t.user.id, '{"changed":0,"removed":2,"added":0}']]);
    assert.equal(await t.rewritten(), 2);
    t.assertShapes();
  } finally { await t.cleanup(); }
});

dbTest('AC5: an option close changed by a late option buy is counted and logged too', async () => {
  const t = await trader();
  try {
    const os = { id: 'o', ticker: 'XYZ   271217C00123450', option_type: 'CALL', strike_price: 123.45, expiration_date: '2027-12-17', underlying_symbol: { symbol: 'XYZ', type: { code: 'cs' } } };
    const opt = (id: string, side: 'BUY' | 'SELL', price: number, d: number) => ({ id: `${t.tag}-${id}`, type: side, option_type: side === 'BUY' ? 'BUY_TO_OPEN' : 'SELL_TO_CLOSE',
      option_symbol: os, units: 1, price, fee: 0, trade_date: at(d).toISOString() });
    t.v.options = [opt('ob1', 'BUY', 2, -14), opt('os', 'SELL', 3, -10)];
    await t.round(0);
    const [o0] = await t.sql`select close_id, return_pct from option_trades where user_id = ${t.user.id}`;
    assert.ok(o0, 'an option close is shown');
    assert.deepEqual(t.lines('sync closes rewritten'), []);
    t.v.options = [opt('ob0', 'BUY', 1, -16), ...t.v.options];
    t.logs.length = 0;
    await t.round(25);
    const [o1] = await t.sql`select close_id, return_pct from option_trades where user_id = ${t.user.id}`;
    assert.equal(o1.close_id, o0.close_id);
    assert.notEqual(Number(o1.return_pct), Number(o0.return_pct), 'the shown option close changed');
    assert.deepEqual(t.lines('sync closes rewritten'), [['sync closes rewritten', t.user.id, '{"changed":1,"removed":0,"added":0}']]);
    assert.equal(await t.rewritten(), 1);
    t.assertShapes();
  } finally { await t.cleanup(); }
});

dbTest('the sync reissues and sync reconcile invalid lines: the internal id and JSON of counts or a reason only', async () => {
  const t = await trader();
  try {
    const b1 = t.row('b1', 'BUY', 20, 10, at(-30)), e = t.row('e', 'SELL', 10, 12, at(-20)), n = t.row('n', 'SELL', 10, 12, at(-20));
    const x = t.row('x', 'BUY', 1, 5, at(-25), 'YY'); // stored, never listed by the vendor
    await t.store([b1, e, x]);
    t.v.list = [b1, e];
    await t.round(0);
    t.v.list = [b1, n]; // a re-issue in the week read: held
    await t.sql`update broker_accounts set reconcile_due_at = ${new Date(base + 30 * DAY).toISOString()} where account_id = ${t.acc.id}`;
    t.logs.length = 0;
    await t.round(25);
    assert.deepEqual(t.lines('sync reissues'), [['sync reissues', t.user.id, '{"found":1,"cleared":0,"pending":1,"suspected":0,"optionTwins":0}']]);
    t.logs.length = 0;
    await t.round(50); // brought forward: the pass; x is missing, so it decides nothing
    assert.deepEqual(t.lines('sync reconcile invalid'), [['sync reconcile invalid', t.user.id, '{"reason":"missing"}']]);
    t.assertShapes();
    // The next pass with the same shortfall decides: N goes pending → suspected, a re-issue state change, so the sync
    // logs its 'sync reissues' line (plan §4: "Re-issue line per sync when any state changed"). An ended pass waits its
    // period (review fix: a held row no longer pulls it back), so the next one is made due here.
    assert.ok((await t.sql`select reconcile_due_at > ${new Date(base + 60 * HOUR).toISOString()}::timestamptz as later from broker_accounts where account_id = ${t.acc.id}`)[0].later,
      'the invalid pass set the next one a period later');
    await t.sql`update broker_accounts set reconcile_due_at = ${new Date(base + 70 * HOUR).toISOString()} where account_id = ${t.acc.id}`;
    t.logs.length = 0;
    await t.round(75);
    assert.equal((await t.sql`select state from activity_reissues where external_id = ${n.externalId}`)[0].state, 'suspected');
    assert.deepEqual(t.lines('sync reconcile invalid'), []);
    assert.deepEqual(t.lines('sync reissues'), [['sync reissues', t.user.id, '{"found":0,"cleared":0,"pending":0,"suspected":1,"optionTwins":0}']],
      'a pass that decides re-issue states logs the counts');
    t.assertShapes();
  } finally { await t.cleanup(); }
});

test('source: each F-24 log line passes only the internal id and a JSON object of counts (lib/privacy-logs.test.ts unsafeArgs)', () => {
  const read = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
  const calls = ['reconcile.ts', 'sync.ts', 'options-sync.ts'].flatMap((f) => consoleCalls(read(f)));
  for (const name of F24) {
    const found = calls.filter((a) => a[0] === `'${name}'`);
    assert.equal(found.length, 1, `${name}: one call site`);
    for (const a of found) {
      assert.equal(a.length, 3, `${name}: literal, id, JSON`);
      assert.equal(a[1], 'id', `${name}: the internal id`);
      assert.match(a[2], /^JSON\.stringify\(\{/, `${name}: JSON of an object literal`);
      assert.deepEqual(unsafeArgs(a), [], name);
    }
  }
});
