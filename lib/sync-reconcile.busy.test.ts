// F-24, fourth orchestrator review:
// C7: a busy account (a full vendor page or more of stored rows since a day before its earliest 'confirm' row) never makes
//     the widened confirm read (it would be several responses, which decide nothing): its confirm rows are suspected at
//     once, counted (reconcile_invalid + 1) and logged with reason 'busy', and the plain week is read; over three pass
//     cycles there is never a widened read.
// C6: lib/broker.ts#fetchActivities calls the option sink once per internal vendor page, so a call that made two pages is
//     not one response even when rows it dropped (no symbol) leave it under PAGE_LIMIT activities: a re-issue seen with
//     its original only across the two pages is never genuine.
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
  const tag = `rb${Math.random().toString(36).slice(2, 9)}`;
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
  const v = { list: [] as Row[], read: null as null | ((since: Date, sink?: (r: unknown[]) => void) => Row[]), calls: [] as { h: number; kind: 'read' | 'page'; since?: Date; offset?: number }[], h: 0 };
  const broker = {
    pageLimit: 60,
    listAccounts: async () => [acc],
    fetchActivities: async (_u: unknown, since: Date, ids?: string[], sink?: (r: unknown[]) => void) => {
      v.calls.push({ h: v.h, kind: 'read', since });
      if (v.read) return v.read(since, sink);
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

dbTest('C7: a busy account: after the pass F2 is confirm; the next daily read is the plain week, F2 suspected, reason busy logged once; three pass cycles, never a widened read', async () => {
  const t = await trader();
  const { PAGE_LIMIT } = await import('./broker.ts');
  const logs: unknown[][] = [];
  const orig = console.log;
  try {
    // B1, F1 (a 10-unit sell at a loss), 1,100 filler buys dated after F1 (so ≥ PAGE_LIMIT stored rows since a day
    // before F1/F2), the newest 14 days after F1 (the week read never reaches the pair); F2 identical to F1, listed last.
    const b1 = t.row('b1', 'BUY', 20, 10, at(-40)), f1 = t.row('f1', 'SELL', 10, 8, at(-30)), f2 = t.row('f2', 'SELL', 10, 8, at(-30));
    const fill = Array.from({ length: 1100 }, (_, i) => t.row(`fl${i}`, 'BUY', 1, 5, at(-29 + i / 80), 'FL'));
    const stored = [b1, f1, ...fill];
    await t.store(stored);
    t.v.list = stored;
    t.broker.pageLimit = 600; // pages at 0 and 550 (553 < 600 rows: done); F1 on page 1 only, F2 on page 2 only
    await t.round(0);
    t.v.list = [...stored, f2];
    const [{ n }] = await t.sql`select count(*)::int as n from activities where user_id = ${t.user.id} and executed_at >= ${new Date(f2.executedAt.getTime() - DAY)}`;
    assert.ok(n + 1 >= PAGE_LIMIT, 'busy: a widened read would be more than one vendor page');
    const invalid = async () => (await t.sql`select reconcile_invalid as n from broker_accounts where account_id = ${t.acc.id}`)[0].n as number;
    for (const [k, h0] of [[1, 0], [2, 100], [3, 200]] as const) {
      await t.due();
      for (const h of [h0 + 25, h0 + 50, h0 + 75]) await t.round(h);
      assert.deepEqual(t.v.calls.filter((c) => c.kind === 'page').map((c) => c.offset), Array.from({ length: k }, () => [0, 550]).flat(), `cycle ${k}: the pass`);
      assert.equal(await t.state('f2'), 'confirm', `cycle ${k}: the pass listed both only on different pages`);
      assert.equal(await invalid(), 0, `cycle ${k}: the pass decided`);
      logs.length = 0;
      console.log = (...a: unknown[]) => { logs.push(a); };
      await t.round(h0 + 100);
      console.log = orig;
      const w = t.v.calls.at(-1)!;
      assert.equal(w.kind, 'read');
      assert.ok(w.since!.getTime() > f2.executedAt.getTime(), `cycle ${k}: the plain week, not widened`);
      assert.equal(await t.state('f2'), 'suspected', `cycle ${k}: suspected at once`);
      assert.deepEqual(logs.filter((l) => l[0] === 'sync reconcile invalid'), [['sync reconcile invalid', t.user.id, '{"reason":"busy"}']], `cycle ${k}: logged once`);
      assert.equal(await invalid(), 1, `cycle ${k}: counted`);
      assert.deepEqual(await t.closes(), [f1.externalId]);
    }
    const reads = t.v.calls.filter((c) => c.kind === 'read');
    assert.ok(reads.every((c) => c.since!.getTime() > f2.executedAt.getTime()), 'never a widened read');
    assert.ok(t.inSync.every((x) => x <= 1));
  } finally { console.log = orig; await t.cleanup(); }
});

dbTest('C6: a week read that made two vendor pages (the sink called per page), 2 rows dropped for no symbol so under PAGE_LIMIT activities, E on page 1 and its re-issue N on page 2: N never genuine, one close', async () => {
  const t = await trader();
  const { PAGE_LIMIT } = await import('./broker.ts');
  try {
    // The vendor's raw list (null = a row with no symbol, which toActivities drops but which takes a page's room).
    const b = t.row('b', 'BUY', 20, 10, at(-13)), e = t.row('e', 'SELL', 10, 12, at(-12)), n = t.row('n', 'SELL', 10, 12, at(-12));
    const fill = Array.from({ length: PAGE_LIMIT - 3 }, (_, i) => t.row(`fl${i}`, 'BUY', 1, 5, at(-12.5 + i / (PAGE_LIMIT * 4)), 'FL'));
    await t.store([b, e, ...fill]);
    t.v.list = [b, e, ...fill];
    await t.round(0);
    await t.due(new Date(base + 60 * DAY).toISOString());
    const rawBefore: (Row | null)[] = [b, e, ...fill.slice(0, -1), null, null, fill.at(-1)!]; // 1,001 raw rows
    const rawAfter: (Row | null)[] = [b, ...fill.slice(0, -1), null, null, fill.at(-1)!, n]; // E re-issued as N, listed last
    assert.equal(rawBefore.length, PAGE_LIMIT + 1);
    // Like lib/broker.ts#fetchActivities: pages of PAGE_LIMIT raw rows, the sink called once per page; page 1 read before
    // the re-issue, page 2 after it.
    let returned = 0;
    t.v.read = (_since, sink) => {
      const p1 = rawBefore.slice(0, PAGE_LIMIT); sink?.([]);
      const p2 = rawAfter.slice(PAGE_LIMIT, 2 * PAGE_LIMIT); sink?.([]);
      const out = [...p1, ...p2].filter((r): r is Row => r !== null);
      returned = out.length;
      return out;
    };
    await t.round(25);
    assert.ok(returned < PAGE_LIMIT, `under PAGE_LIMIT activities (${returned}): only the page count shows two responses`);
    assert.notEqual(await t.state('n'), 'genuine', 'E and N were on different vendor pages');
    assert.equal(await t.state('n'), 'pending');
    assert.deepEqual(await t.closes(), [e.externalId], 'exactly one close');
  } finally { await t.cleanup(); }
});
