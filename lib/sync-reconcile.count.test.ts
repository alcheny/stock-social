// F-24, third orchestrator review (the reviewer's tests, adapted to the harness of lib/sync-reconcile.confirm.test.ts):
// M1: one vendor response clears held twins by COUNT per twin group (k listed rows of the group, p unheld rows: at most
//     k − p listed held rows cleared, oldest stored first), so the record keeps as many fills as one response lists:
//     RA1 (a confirm row whose original is re-issued before the widened read) and RA2 (a re-issue and a late genuine twin
//     in the same read) both end with 2 closes.
// L1: a fetchActivities call that returned PAGE_LIMIT rows or more is several vendor responses and decides nothing (RB).
// L2: dueRequestsSql's widened-read charge counts every row kind the read returns, option rows included (RC).
// L3: "rows stored by this transaction" is xmin = pg_current_xact_id(), wrong for inserts in a savepoint: a static check
//     that no F-24 file opens one and lib/sync.ts has only the claim check's (which inserts no activity row).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 180_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000, DAY = 24 * HOUR;
const base = Date.now() - 40 * DAY;
const shiftAt = (h: number) => base + h * HOUR - Date.now();
const at = (d: number) => new Date(base + d * DAY);

type Row = { externalId: string; accountId: string; symbol: string; side: 'BUY' | 'SELL'; units: number; price: number; fee: number; executedAt: Date; verified: boolean; raw: unknown };

async function trader() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { syncUser, insertActivities } = await import('./sync.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const tag = `rq${Math.random().toString(36).slice(2, 9)}`;
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
  // `read` (if set) replaces the activities call (a fake that pages internally); every call is recorded with its round.
  const v = { list: [] as Row[], read: null as null | ((since: Date) => Row[]), calls: [] as { h: number; kind: 'read' | 'page'; since?: Date; offset?: number }[], h: 0 };
  const broker = {
    pageLimit: 60,
    listAccounts: async () => [acc],
    fetchActivities: async (_u: unknown, since: Date, ids?: string[]) => {
      v.calls.push({ h: v.h, kind: 'read', since });
      if (v.read) return v.read(since);
      return v.list.filter((r) => (ids ?? []).includes(r.accountId) && r.executedAt >= since);
    },
    fetchActivitiesPage: async (_u: unknown, id: string, offset: number, limit = 60) => {
      v.calls.push({ h: v.h, kind: 'page', offset });
      const activities = v.list.filter((r) => r.accountId === id).slice(offset, offset + limit);
      return { activities, unusable: [], done: activities.length < limit };
    },
  };
  const inSync: number[] = [];
  const rebuild = async (id: number, tx: import('postgres').TransactionSql) => {
    await rebuildRecord(id, tx);
    inSync.push((await tx`select count(*)::int as n from closed_trades where user_id = ${id} and symbol = 'XX'`)[0].n);
  };
  const round = (h: number) => { v.h = h; return syncUser(user, broker as never, rebuild, undefined, { cadence: true, shiftMs: shiftAt(h) }); };
  const due = (when: string = '2000-01-01') => sql`update broker_accounts set reconcile_due_at = ${when} where account_id = ${acc.id}`;
  const closes = async () => (await sql`select sell_id from closed_trades where user_id = ${u.id} and symbol = 'XX' order by sell_id`).map((r) => r.sell_id as string);
  const state = async (id: string) => (await sql`select state from activity_reissues where source = 'snaptrade' and external_id = ${`${tag}-${id}`}`)[0]?.state ?? null;
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id = ${acc.id}`; };
  return { sql, tag, user, acc, v, broker, row, round, due, closes, state, inSync, cleanup, store: (r: Row[]) => insertActivities(u.id, 'snaptrade', r) };
}
type T = Awaited<ReturnType<typeof trader>>;

// The R2 setup: B1, F1 (a 10-unit sell at a loss), 62 filler buys; F2 identical to F1, posted late, listed last.
const r2 = (t: T) => {
  const b1 = t.row('b1', 'BUY', 20, 10, at(-40));
  const f1 = t.row('f1', 'SELL', 10, 8, at(-30));
  const fill = Array.from({ length: 62 }, (_, i) => t.row(`fl${i}`, 'BUY', 1, 5, at(-15 + i / 100), 'FL'));
  const f2 = t.row('f2', 'SELL', 10, 8, at(-30));
  const f1x = t.row('f1x', 'SELL', 10, 8, at(-30)); // F1 re-issued under a new vendor id
  return { b1, f1, fill, f2, f1x, stored: [b1, f1, ...fill] };
};

dbTest('RA1 (M1): a confirm row whose original is re-issued before the widened read: the record keeps 2 closes (as many fills as one response lists), through later passes', async () => {
  const t = await trader();
  try {
    const { b1, f1, fill, f2, f1x, stored } = r2(t);
    await t.store(stored);
    t.v.list = stored;
    await t.round(0);
    t.v.list = [...stored, f2];
    await t.due();
    for (const h of [25, 50, 75]) await t.round(h);
    assert.deepEqual(t.v.calls.filter((c) => c.kind === 'page').map((c) => c.offset), [0, 10]);
    assert.equal(await t.state('f2'), 'confirm');
    assert.deepEqual(await t.closes(), [f1.externalId]);
    // The vendor re-issues F1 as F1x (F1 no longer listed), F2 still listed.
    t.v.list = [b1, f1x, ...fill, f2];
    await t.round(100); // the widened read lists F1x and F2: k = 2, p = 1 (F1) → one held row cleared, the older (F2)
    assert.equal(t.v.calls.at(-1)!.kind, 'read');
    assert.equal(await t.state('f2'), 'genuine', 'the late genuine fill is kept');
    assert.notEqual(await t.state('f1x'), 'genuine', 'the re-issue stays held');
    // Final review R2: F1x is still undecided and F2 comes after it in the canonical order, so F2's figure depends on how
    // F1x is decided: F2 is counted (excluded_held), never priced on a guess, until a read decides F1x.
    assert.deepEqual(await t.closes(), [f1.externalId], 'F2 counted while F1x is undecided');
    assert.ok(Number((await t.sql`select excluded_held as n from users where id = ${t.user.id}`)[0].n) >= 1, 'and counted');
    // Later rounds, two passes included: once a complete pass decides F1x (the count rule: a duplicate, dropped, R1),
    // F2 is shown: the record keeps 2 closes, as many fills as one response lists. Never more than 2 in any sync.
    await t.due();
    for (const h of [125, 150, 175, 200]) { await t.round(h); assert.ok((await t.closes()).length <= 2, `h${h}`); }
    await t.due();
    for (const h of [225, 250, 275, 300]) { await t.round(h); assert.ok((await t.closes()).length <= 2, `h${h}`); }
    assert.equal(await t.state('f1x'), 'suspected', 'F1x decided a duplicate by the count rule');
    assert.deepEqual(await t.closes(), [f1.externalId, f2.externalId].sort(), '2 closes: two fills listed in one response');
    assert.ok(t.v.calls.filter((c) => c.kind === 'page').length >= 4, 'passes ran');
    assert.notEqual(await t.state('f1x'), 'genuine');
    assert.ok(t.inSync.every((x) => x <= 2), `never more than 2 closes: ${t.inSync.join(',')}`);
  } finally { await t.cleanup(); }
});

dbTest('RA2 (M1): F1 re-issued as F1x in the same read as a late genuine twin F2: 2 closes, kept through passes', async () => {
  const t = await trader();
  try {
    const b1 = t.row('b1', 'BUY', 20, 10, at(-30)), f1 = t.row('f1', 'SELL', 10, 8, at(-20));
    const f1x = t.row('f1x', 'SELL', 10, 8, at(-20)), f2 = t.row('f2', 'SELL', 10, 8, at(-20));
    await t.store([b1, f1]);
    t.v.list = [b1, f1];
    await t.round(0);
    await t.due(new Date(base + 60 * DAY).toISOString());
    t.v.list = [b1, f1x, f2]; // one week read: F1 gone, F1x and F2 listed (k = 2, p = 1: one of them cleared)
    await t.round(25);
    assert.equal(t.v.calls.at(-1)!.kind, 'read');
    const states = [await t.state('f1x'), await t.state('f2')];
    assert.equal(states.filter((s) => s === 'genuine').length, 1, `exactly one of the two cleared: ${states}`);
    assert.equal((await t.closes()).length, 2);
    for (const h of [50, 75, 100]) { await t.due(); await t.round(h); assert.equal((await t.closes()).length, 2, `pass at h${h}`); }
    assert.ok(t.v.calls.filter((c) => c.kind === 'page').length >= 1, 'a pass ran');
    assert.ok(t.inSync.every((x) => x <= 2), `never more than 2 closes: ${t.inSync.join(',')}`);
  } finally { await t.cleanup(); }
});

dbTest('RB (L1): a week read that paged internally (PAGE_LIMIT rows) and saw E on one internal page and its re-issue N on the next decides nothing: N not genuine', async () => {
  const t = await trader();
  const { PAGE_LIMIT } = await import('./broker.ts');
  try {
    const b = t.row('b', 'BUY', 20, 10, at(-13)), e = t.row('e', 'SELL', 10, 12, at(-11.5)), n = t.row('n', 'SELL', 10, 12, at(-11.5));
    const fill = Array.from({ length: PAGE_LIMIT }, (_, i) => t.row(`fl${i}`, 'BUY', 1, 5, at(-12 + i / (PAGE_LIMIT * 2)), 'FL'));
    await t.store([b, e, ...fill]);
    t.v.list = [b, e, ...fill];
    await t.round(0);
    await t.due(new Date(base + 60 * DAY).toISOString());
    // The vendor re-issues E as N between the call's internal pages: page 1 (from the list before) lists E, page 2 (from
    // the list after, E gone and N appended) lists N. The call returns both: more than one vendor response.
    const before = [b, e, ...fill], afterList = [b, ...fill, n];
    t.v.read = () => [...before.slice(0, PAGE_LIMIT), ...afterList.slice(PAGE_LIMIT)];
    await t.round(25);
    assert.ok(t.v.read!(new Date(0)).some((r) => r === e) && t.v.read!(new Date(0)).some((r) => r === n), 'the call listed both');
    assert.notEqual(await t.state('n'), 'genuine', 'one call past a vendor page is not one response');
    assert.equal(await t.state('n'), 'pending');
    assert.deepEqual(await t.closes(), [e.externalId]);
  } finally { await t.cleanup(); }
});

dbTest('RC (L2): dueRequestsSql charges the widened read\'s pages over share and option rows: ceil(rows since a day before / 1000) − 1', async () => {
  const t = await trader();
  const { dueRequestsSql } = await import('./sync-cadence.ts');
  const { insertOptionActivities } = await import('./options-sync.ts');
  try {
    const { stored, f2 } = r2(t);
    await t.store(stored);
    t.v.list = stored;
    await t.round(0);
    await t.store([f2]);
    // 1,500 option rows of the account in the widened window.
    const opts = Array.from({ length: 1500 }, (_, i) => ({
      externalId: `${t.tag}-o${i}`, accountId: t.acc.id, kind: 'BUY', openClose: 'OPEN', underlying: 'XYZ', underlyingType: 'cs', right: 'CALL', expiry: '2027-12-17',
      strikeMilli: 123_450, multiplier: 100, occTicker: 'XYZ   271217C00123450', units: 1, price: 1, fee: 0, amount: null, currency: 'USD',
      executedAt: at(-29 + i / 1000), verified: true, raw: { t: t.tag },
    }));
    await insertOptionActivities(t.user.id, 'snaptrade', opts as never);
    const charge = async () => (await t.sql`select ${dueRequestsSql(t.sql`${t.user.id}::int`, t.sql`now()`)} as n`)[0].n as number;
    const none = await charge();
    await t.sql`insert into activity_reissues (user_id, source, external_id, account_id, original_id, state, decided_at)
      values (${t.user.id}, 'snaptrade', ${f2.externalId}, ${t.acc.id}, ${`${t.tag}-f1`}, 'confirm', now())`;
    const from = new Date(f2.executedAt.getTime() - DAY);
    const [{ s }] = await t.sql`select count(*)::int as s from activities where user_id = ${t.user.id} and account_id = ${t.acc.id} and source = 'snaptrade'
      and raw->>'type' in ('BUY', 'SELL') and executed_at >= ${from}`;
    const [{ o }] = await t.sql`select count(*)::int as o from option_activities where user_id = ${t.user.id} and account_id = ${t.acc.id} and source = 'snaptrade' and executed_at >= ${from}`;
    assert.equal(o, 1500);
    assert.equal(await charge() - none, Math.max(0, Math.ceil((s + o) / 1000) - 1), `share ${s} + option ${o} rows`);
    assert.ok(await charge() - none >= 1, 'option rows add a page');
  } finally { await t.cleanup(); }
});

test('L3 invariant: no savepoint in lib/reconcile.ts, lib/connections.ts, lib/options-sync.ts; lib/sync.ts has exactly one (the claim check, which inserts no activity row)', () => {
  const code = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // comments may name it
  for (const f of ['reconcile.ts', 'connections.ts', 'options-sync.ts']) assert.equal((code(f).match(/savepoint/gi) ?? []).length, 0, f);
  const s = code('sync.ts');
  assert.equal((s.match(/\.savepoint\(/g) ?? []).length, 1, 'lib/sync.ts: one savepoint');
  assert.equal((s.match(/savepoint/gi) ?? []).length, 1, 'lib/sync.ts: no other savepoint use');
  const i = s.indexOf('.savepoint(');
  const body = s.slice(i, s.indexOf('});', i));
  assert.match(body, /claimIn\(sp,/, 'the claim check');
  assert.doesNotMatch(body, /insert|markTwins|insertActivities|insertOptionActivities|insertCorporateActions/i, 'inserts nothing');
});
