// F-24 follow-up (orchestrator, residual 1): a reconnect whose vendor re-issued every id. The import step that stores
// pending possible re-issues brings the account's next pass forward (lib/connections.ts#importStep → bringForward), so
// the pass runs on the account's next due daily read (F-14: the first hourly sync after a consent reads at once; a pass
// page replaces that day's read, no extra activities call) and the record shows its original closes again within days,
// not the ~7 days of the account's first period.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 300_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000, DAY = 24 * HOUR;
type Row = { externalId: string; accountId: string; symbol: string; side: 'BUY' | 'SELL'; units: number; price: number; fee: number; executedAt: Date; verified: boolean; raw: unknown };

dbTest('reconnect re-issuing every id: the import brings the pass forward; the next due daily read runs it and the 2 original closes are shown again within days', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { startConnection, completeLink, consent, importStep } = await import('./connections.ts');
  const { insertActivities, syncUser } = await import('./sync.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const { unswept } = await import('./test-sweep-lock.ts');
  const tag = `rr${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const [{ signup_attempt_id: attempt }] = await sql`select signup_attempt_id from users where id = ${u.id}`;
  const acc = `${tag}-a`;
  const t0 = Date.now();
  const d = (n: number) => new Date(t0 - 30 * DAY + n * DAY);
  const mk = (id: string, side: 'BUY' | 'SELL', units: number, price: number, at: Date): Row => ({
    externalId: `${tag}-${id}`, accountId: acc, symbol: 'XX', side, units, price, fee: 0, executedAt: at, verified: true, raw: { type: side },
  });
  const rows = [mk('b1', 'BUY', 10, 10, d(0)), mk('s1', 'SELL', 10, 12, d(1)), mk('b2', 'BUY', 10, 8, d(2)), mk('s2', 'SELL', 10, 6, d(3))];
  const reissued = rows.map((r) => ({ ...r, externalId: `${r.externalId}-new`, raw: { ...(r.raw as object), id: `${r.externalId}-new` } }));
  const sells = [rows[1].externalId, rows[3].externalId];
  const closes = async () => (await sql`select sell_id from closed_trades where user_id = ${u.id} and symbol = 'XX' order by sell_id`).map((r) => r.sell_id as string);
  const held = async () => (await sql`select excluded_held as n from users where id = ${u.id}`)[0].n as number;
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id = ${acc}`; };
  // The vendor after the reconnect: the same trades, every id re-issued, the originals gone. Every activities-endpoint call
  // (a week read or a page) is recorded with the round (hours after the import) it was made in.
  const v = { h: 0, calls: [] as { h: number; kind: 'read' | 'page'; offset?: number }[] };
  const account = { id: acc, authorizationId: `auth-${acc}`, institution: 'x', isPaper: false, initialSyncCompleted: true };
  const deps = {
    pageLimit: 60,
    registerUser: async (ref: number | string) => ({ snaptradeUserId: `${tag}-v${ref}`, secretEnc: 'enc' }),
    connectUrl: async () => 'https://vendor.example/portal',
    listAccounts: async () => [account],
    fetchActivities: async (_u: unknown, since: Date, ids?: string[]) => {
      v.calls.push({ h: v.h, kind: 'read' });
      return reissued.filter((r) => (ids ?? []).includes(r.accountId) && r.executedAt >= since);
    },
    fetchActivitiesPage: async (_u: unknown, id: string, offset: number, limit = 60) => {
      v.calls.push({ h: v.h, kind: 'page', offset });
      const activities = reissued.filter((r) => r.accountId === id).slice(offset, offset + limit);
      return { activities, unusable: [], done: activities.length < limit };
    },
    fetchPositions: async () => [],
    deleteConnection: async () => {}, deleteUser: async () => {},
  };
  try {
    // The stored history (the earlier connection's rows): 2 shown closes.
    await insertActivities(u.id, 'snaptrade', rows);
    await sql.begin((tx) => rebuildRecord(u.id, tx));
    assert.deepEqual(await closes(), [...sells].sort(), 'the 2 closes before the reconnect');
    // The reconnect import (real clock: its bringForward writes the database's now()).
    await unswept(async () => {
      await startConnection({ userId: u.id, attemptId: Number(attempt) }, 'https://app.example/connect/done', deps as never);
      const out = await completeLink({ userId: u.id, attemptId: Number(attempt) }, deps as never);
      const cid = (out as { id: number }).id;
      await consent(cid, new Date(t0), deps as never);
      let state = 'importing';
      for (let i = 0; i < 12 && state === 'importing'; i++) state = (await importStep(cid, deps as never, new Date(t0 + (i + 1) * 1000))).state;
      assert.equal(state, 'connected', 'the import finished');
    });
    const st = await sql`select external_id, state from activity_reissues where user_id = ${u.id} order by external_id`;
    assert.deepEqual(st.map((r) => [r.external_id, r.state]), reissued.map((r) => [r.externalId, 'pending']).sort((a, b) => (a[0] < b[0] ? -1 : 1)), 'the re-issued rows held pending');
    assert.deepEqual(await closes(), [], 'no close shown while the pair is held');
    assert.equal(await held(), 2, 'the 2 real sells counted (excluded_held)');
    const [{ due, now }] = await sql`select reconcile_due_at as due, now() as now from broker_accounts where account_id = ${acc}`;
    assert.ok(due !== null && (due as Date).getTime() <= (now as Date).getTime(), `the next pass brought forward to now (due ${due})`);

    // The hourly cadence syncs after the import (the shard runner's path), on the database clock shifted h hours ahead.
    const [ur] = await sql`select snaptrade_user_id, snaptrade_secret_enc from users where id = ${u.id}`;
    const user = { id: u.id, snaptrade_user_id: ur.snaptrade_user_id as string, snaptrade_secret_enc: ur.snaptrade_secret_enc as string };
    const rebuild = (id: number, tx: import('postgres').TransactionSql) => rebuildRecord(id, tx);
    const LAST = 3 * 24 + 2; // a few daily rounds
    let restoredAt: number | null = null;
    for (let h = 1; h <= LAST; h++) {
      v.h = h;
      await syncUser(user, deps as never, rebuild, undefined, { cadence: true, shiftMs: h * HOUR + 60_000 });
      const shown = await closes(), n = await held();
      assert.ok(shown.length + n <= 2, `h${h}: shown + counted never exceeds the 2 real sells`);
      if (restoredAt === null && shown.length === 2) restoredAt = h;
    }
    // F-14: one activities-endpoint call per account per 24 h (the consent exemption's first read included); the pass's
    // page took the place of a daily read, never an extra call.
    const synced = v.calls.filter((c) => c.h >= 1); // the consented import's own pages (h0) are never throttled
    const hs = synced.map((c) => c.h);
    for (let i = 1; i < hs.length; i++) assert.ok(hs[i] - hs[i - 1] >= 24, `activities calls 24 h apart: ${JSON.stringify(v.calls)}`);
    const pages = synced.filter((c) => c.kind === 'page');
    assert.ok(pages.length >= 1 && pages[0].offset === 0, `the pass read its page at offset 0 on a due daily read: ${JSON.stringify(v.calls)}`);
    assert.ok(pages[0].h <= 26, `the pass ran on the first or next due daily read, not a period later (h${pages[0].h})`);
    // The count rule decided the re-issues: duplicates (suspected, decided).
    const fin = await sql`select external_id, state, undecided from activity_reissues where user_id = ${u.id} order by external_id`;
    assert.deepEqual(fin.map((r) => [r.external_id, r.state, r.undecided]), reissued.map((r) => [r.externalId, 'suspected', false]).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    assert.ok(restoredAt !== null && restoredAt <= LAST, `the 2 original closes shown again within ${LAST} h (restored at ${restoredAt})`);
    assert.deepEqual(await closes(), [...sells].sort(), 'the 2 original closes');
    assert.equal(await held(), 0, 'excluded_held 0');
  } finally { await cleanup(); }
});
