// F-24 committee option C (orchestrator review of #84, 2nd round; F1, F2): a pair is genuine only when ONE vendor response
// lists both rows. A complete pass whose pages listed a held row and its twins only on different pages leaves it
// 'confirm' (held); the account's next daily activities read, widened to a day before its trade date (one call, in place
// of the week read), decides it: genuine if that one read lists both, else suspected.
// R2 (syncUser, cadence, pageLimit 60): a far-apart genuine losing pair ends genuine after the widened read, with the
//    vendor's activities calls per account per 24 h unchanged against a run with no pass; a widened read listing only the
//    re-issue suspects it; an original the pass never listed suspects directly (no widened read); two failed widened reads
//    give up (reason 'confirm') and the plain week is read; a suspected row is set back to 'confirm' by a later pass that
//    lists both on different pages; dueRequestsSql charges the widened read's extra pages.
// R1 (importStep on a reconnect, pageLimit 2): pages days or hours apart are never joined, so a re-issue N found after its
//    original E was listed on an earlier page is never genuine (both list shapes of the reviewer's repro).
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
  const tag = `rc${Math.random().toString(36).slice(2, 9)}`;
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
  // The vendor: every activities call (week, widened or page) is recorded with the round it was made in.
  const v = { list: [] as Row[], fail: false, calls: [] as { h: number; kind: 'read' | 'page'; since?: Date; offset?: number }[], h: 0 };
  const broker = {
    pageLimit: 60,
    listAccounts: async () => [acc],
    fetchActivities: async (_u: unknown, since: Date, ids?: string[]) => {
      if (v.fail) throw Object.assign(new Error('vendor 500'), { status: 500 });
      v.calls.push({ h: v.h, kind: 'read', since });
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
  const closes = async () => sql`select sell_id, return_pct, holding_days, closed_at from closed_trades where user_id = ${u.id} and symbol = 'XX' order by sell_id`;
  const state = async (id: string) => (await sql`select state from activity_reissues where source = 'snaptrade' and external_id = ${`${tag}-${id}`}`)[0]?.state ?? null;
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id = ${acc.id}`; };
  return { sql, tag, user, acc, v, broker, row, round, due, closes, state, inSync, cleanup, store: (r: Row[]) => insertActivities(u.id, 'snaptrade', r) };
}

// The reviewer's R2 setup: B1, F1 (a 10-unit sell at a loss), 62 filler buys; F2 identical to F1, posted late, listed last.
const r2 = (t: Awaited<ReturnType<typeof trader>>) => {
  const b1 = t.row('b1', 'BUY', 20, 10, at(-40));
  const f1 = t.row('f1', 'SELL', 10, 8, at(-30));
  const fill = Array.from({ length: 62 }, (_, i) => t.row(`fl${i}`, 'BUY', 1, 5, at(-15 + i / 100), 'FL'));
  const f2 = t.row('f2', 'SELL', 10, 8, at(-30));
  return { b1, f1, fill, f2, stored: [b1, f1, ...fill] };
};
// Runs a pass over the 65-row list: page@0 (h25: F1 listed, F2 not), the week read (h50), page@10 (h75: F2 inserted,
// F1 not on this page): F2 'confirm'.
async function passToConfirm(t: Awaited<ReturnType<typeof trader>>) {
  const { f2, stored } = r2(t);
  await t.store(stored);
  t.v.list = stored;
  await t.round(0);
  t.v.list = [...stored, f2];
  await t.due();
  await t.round(25);
  await t.round(50);
  await t.round(75);
  assert.deepEqual(t.v.calls.filter((c) => c.kind === 'page').map((c) => c.offset), [0, 10]);
}

dbTest('R2: a far-apart genuine losing pair: confirm after the pass, genuine after the next daily (widened) read, the loss shown; activities calls per 24 h unchanged', async () => {
  const t = await trader();
  const n = await trader(); // the same rounds with no pass
  const { stats } = await import('./trades.ts');
  try {
    const { f1, f2 } = r2(t);
    await passToConfirm(t);
    assert.equal(await t.state('f2'), 'confirm', 'the pass listed both only on different pages');
    assert.equal((await t.closes()).length, 1, 'held while confirm');
    await t.round(100); // the next daily read: widened
    const w = t.v.calls.at(-1)!;
    assert.equal(w.kind, 'read');
    assert.ok(w.since!.getTime() <= f2.executedAt.getTime() - DAY, 'widened to a day before F2');
    assert.equal(await t.state('f2'), 'genuine', 'one response listed both');
    const c = await t.closes();
    assert.deepEqual(c.map((r) => r.sell_id).sort(), [f1.externalId, f2.externalId].sort());
    assert.ok(c.every((r) => Number(r.return_pct) < 0), 'both losses published');
    const s = stats(c.map((r) => ({ returnPct: Number(r.return_pct), holdingDays: Number(r.holding_days), closedAt: r.closed_at as Date })));
    assert.equal(s.trades, 2);
    assert.equal(s.winRate, 0);
    assert.ok(s.avgReturn < 0);
    assert.ok(t.inSync.every((x) => x <= 2));
    // Budget: the same rounds for a trader with no pass make the same vendor activities calls, one per round (rounds are
    // at least 25 h apart, so one per account per 24 h).
    const { stored: s2, f2: g2 } = r2(n);
    await n.store(s2);
    n.v.list = s2;
    await n.round(0);
    n.v.list = [...s2, g2];
    await n.due(new Date(base + 60 * DAY).toISOString());
    for (const h of [25, 50, 75, 100]) await n.round(h);
    const perRound = (x: typeof t) => [0, 25, 50, 75, 100].map((h) => x.v.calls.filter((c) => c.h === h).length);
    assert.deepEqual(perRound(t), [1, 1, 1, 1, 1]);
    assert.deepEqual(perRound(t), perRound(n), 'activities calls per round unchanged by the pass and the widened read');
  } finally { await t.cleanup(); await n.cleanup(); }
});

dbTest('R2: a widened read that lists only the re-issue suspects it (one close)', async () => {
  const t = await trader();
  try {
    const { f1 } = r2(t);
    await passToConfirm(t);
    assert.equal(await t.state('f2'), 'confirm');
    t.v.list = t.v.list.filter((r) => r.externalId !== f1.externalId); // by the widened read, the vendor lists F2 only
    await t.round(100);
    assert.equal(t.v.calls.at(-1)!.kind, 'read');
    assert.equal(await t.state('f2'), 'suspected');
    assert.deepEqual((await t.closes()).map((r) => r.sell_id), [f1.externalId]);
    assert.ok(t.inSync.every((x) => x <= 1));
  } finally { await t.cleanup(); }
});

dbTest('R2: an original the pass never listed suspects directly (no widened read); a later pass that lists both on different pages sets it back to confirm, and the widened read clears it', async () => {
  const t = await trader();
  try {
    const { f1, f2, stored } = r2(t);
    await t.store(stored);
    t.v.list = stored;
    await t.round(0);
    const reissued = [stored[0], ...stored.slice(2), f2]; // F1 not listed during the whole pass
    t.v.list = reissued;
    await t.due();
    for (const h of [25, 50, 75]) await t.round(h);
    assert.deepEqual(t.v.calls.filter((c) => c.kind === 'page').map((c) => c.offset), [0, 10]);
    assert.equal(await t.state('f2'), 'suspected', 'its original was listed nowhere: suspected at the pass end');
    await t.round(100);
    const w = t.v.calls.at(-1)!;
    assert.equal(w.kind, 'read');
    assert.ok(w.since!.getTime() > f2.executedAt.getTime(), 'the plain week (not widened)');
    assert.equal(await t.state('f2'), 'suspected');
    assert.equal((await t.closes()).length, 1);
    // The vendor lists F1 again (index 1, page 1 only) with F2 last (page 2 only): the next pass sets F2 back to confirm.
    t.v.list = [...stored, f2];
    await t.due();
    for (const h of [125, 150, 175]) await t.round(h);
    assert.deepEqual(t.v.calls.filter((c) => c.kind === 'page').map((c) => c.offset), [0, 10, 0, 10]);
    assert.equal(await t.state('f2'), 'confirm', 'a suspected row the pass listed with its twin is confirm');
    assert.equal((await t.closes()).length, 1, 'still held');
    await t.round(200);
    assert.equal(await t.state('f2'), 'genuine');
    assert.deepEqual((await t.closes()).map((r) => r.sell_id).sort(), [f1.externalId, f2.externalId].sort());
  } finally { await t.cleanup(); }
});

dbTest('R2: two failed widened reads in a row give up: confirm rows suspected, reason confirm logged, the next read is the plain week', async () => {
  const t = await trader();
  const logs: unknown[][] = [];
  const orig = console.log;
  try {
    const { f2 } = r2(t);
    await passToConfirm(t);
    assert.equal(await t.state('f2'), 'confirm');
    t.v.fail = true;
    await assert.rejects(t.round(100));
    await assert.rejects(t.round(101));
    assert.equal(await t.state('f2'), 'confirm', 'rolled back: still confirm');
    assert.equal((await t.sql`select confirm_failures as n from sync_read_marks where user_id = ${t.user.id} and account_id = ${t.acc.id}`)[0].n, 2);
    t.v.fail = false;
    console.log = (...a: unknown[]) => { logs.push(a); };
    await t.round(102);
    console.log = orig;
    const w = t.v.calls.at(-1)!;
    assert.equal(w.kind, 'read');
    assert.ok(w.since!.getTime() > f2.executedAt.getTime(), 'the plain week');
    assert.equal(await t.state('f2'), 'suspected');
    assert.deepEqual(logs.filter((l) => l[0] === 'sync reconcile invalid'), [['sync reconcile invalid', t.user.id, '{"reason":"confirm"}']]);
    assert.equal((await t.sql`select confirm_failures as n from sync_read_marks where user_id = ${t.user.id} and account_id = ${t.acc.id}`)[0].n, 0);
    assert.equal((await t.closes()).length, 1);
  } finally { console.log = orig; await t.cleanup(); }
});

dbTest('R2: dueRequestsSql charges the widened read\'s extra vendor pages (ceil(rows since a day before / 1000) − 1)', async () => {
  const t = await trader();
  const { dueRequestsSql } = await import('./sync-cadence.ts');
  try {
    const { stored, f2 } = r2(t);
    // 2,100 more stored rows after F2's date: with F2 'confirm', the widened read spans ceil(2,165 / 1000) = 3 pages.
    const many = Array.from({ length: 2100 }, (_, i) => t.row(`m${i}`, 'BUY', 1, 5, at(-29 + i / 1000), 'MM'));
    await t.store([...stored, ...many]);
    t.v.list = stored;
    await t.round(0);
    await t.store([f2]);
    const charge = async () => (await t.sql`select ${dueRequestsSql(t.sql`${t.user.id}::int`, t.sql`now()`)} as n`)[0].n as number;
    const none = await charge();
    // A confirm row (written as the pass end writes it; the decision itself is covered above).
    await t.sql`insert into activity_reissues (user_id, source, external_id, account_id, original_id, state, decided_at)
      values (${t.user.id}, 'snaptrade', ${f2.externalId}, ${t.acc.id}, ${`${t.tag}-f1`}, 'confirm', now())`;
    const [{ n }] = await t.sql`select count(*)::int as n from activities where user_id = ${t.user.id} and account_id = ${t.acc.id} and executed_at >= ${new Date(f2.executedAt.getTime() - DAY)}`;
    assert.ok(n > 2000 && n <= 3000);
    assert.equal(await charge(), none + 2, 'two extra pages');
    await t.sql`update activity_reissues set state = 'suspected' where external_id = ${f2.externalId}`;
    assert.equal(await charge(), none, 'nothing extra without a confirm row');
  } finally { await t.cleanup(); }
});

// R1: importStep on a reconnect (E stored before), the reviewer's lists. Call 1 lists [b, e, z]; later calls list `later`.
async function importWithLists(later: (r: Record<string, Row>) => Row[], waitMs: number) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { startConnection, completeLink, consent, importStep } = await import('./connections.ts');
  const { insertActivities } = await import('./sync.ts');
  const tag = `rk${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const [{ signup_attempt_id: attempt }] = await sql`select signup_attempt_id from users where id = ${u.id}`;
  const acc = `${tag}-a`;
  const mk = (id: string, side: 'BUY' | 'SELL', units: number, price: number, d: Date, symbol = 'XX'): Row => ({
    externalId: `${tag}-${id}`, accountId: acc, symbol, side, units, price, fee: 0, executedAt: d, verified: true, raw: { type: side },
  });
  const r = { b: mk('b', 'BUY', 20, 10, at(-30)), e: mk('e', 'SELL', 10, 12, at(-20)), z: mk('z', 'BUY', 1, 5, at(-10), 'YY'),
    w: mk('w', 'BUY', 1, 5, at(-40), 'YY'), n: mk('n', 'SELL', 10, 12, at(-20)) };
  await insertActivities(u.id, 'snaptrade', [r.b, r.e]); // the earlier connection's rows
  let call = 0;
  const deps = {
    pageLimit: 2,
    registerUser: async (ref: number | string) => ({ snaptradeUserId: `${tag}-v${ref}`, secretEnc: 'enc' }),
    connectUrl: async () => 'https://vendor.example/portal',
    listAccounts: async () => [{ id: acc, authorizationId: `auth-${acc}`, institution: 'x', isPaper: false, initialSyncCompleted: true }],
    fetchActivitiesPage: async (_u: unknown, _a: string, offset: number, limit = 2) => {
      const list = call++ === 0 ? [r.b, r.e, r.z] : later(r);
      const activities = list.slice(offset, offset + limit);
      return { activities, unusable: [], done: activities.length < limit };
    },
    fetchPositions: async () => [],
    deleteConnection: async () => {}, deleteUser: async () => {},
  };
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id = ${acc}`; };
  const t0 = Date.now();
  try {
    // #99: no global tick (another file's, with its own vendor deps) may drive this import between its steps.
    const { unswept } = await import('./test-sweep-lock.ts');
    const id = await unswept(async () => {
      await startConnection({ userId: u.id, attemptId: Number(attempt) }, 'https://app.example/connect/done', deps as never);
      const out = await completeLink({ userId: u.id, attemptId: Number(attempt) }, deps as never);
      const cid = (out as { id: number }).id;
      await consent(cid, new Date(t0), deps as never);
      for (let i = 0; i < 12; i++) {
        // Each later step `waitMs` after the previous one (a backoff, a deadline cut, the tick's spacing).
        const res = await importStep(cid, deps as never, new Date(t0 + (i + 1) * waitMs));
        if (res.state !== 'importing') break;
      }
      return cid;
    });
    const [c] = await sql`select state from connections where id = ${id}`;
    const nState = (await sql`select state from activity_reissues where source = 'snaptrade' and external_id = ${r.n.externalId}`)[0]?.state ?? null;
    const xx = (await sql`select sell_id from closed_trades where user_id = ${u.id} and symbol = 'XX'`).map((x) => x.sell_id as string);
    return { conn: c.state as string, nState, xx, e: r.e.externalId, calls: call, cleanup };
  } catch (err) { await cleanup(); throw err; }
}

for (const [name, later] of [
  ['a late row before the cursor: [w, b, n, z]', (r: Record<string, Row>) => [r.w, r.b, r.n, r.z]],
  ['the vendor appends the re-issue: [b, z, n]', (r: Record<string, Row>) => [r.b, r.z, r.n]],
] as const) {
  for (const waitMs of [1000, 2 * HOUR]) {
    dbTest(`R1 (importStep reconnect, ${name}, steps ${waitMs / 1000} s apart): N is never genuine and exactly one XX close`, async () => {
      const r = await importWithLists(later, waitMs);
      try {
        assert.equal(r.conn, 'connected', 'the import finished');
        assert.ok(r.calls >= 2);
        assert.notEqual(r.nState, 'genuine', 'E and N were never listed by one response');
        assert.equal(r.nState, 'pending', 'held for the account\'s first pass');
        assert.deepEqual(r.xx, [r.e], 'exactly one XX close, the original');
      } finally { await r.cleanup(); }
    });
  }
}
