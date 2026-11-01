// F-24 AC6 (docs/features/F-24-late-sell-reconciliation.md; plan docs/features/logs/F-24/plan.md round 2 + round 3) and
// the pass's robustness, through syncUser with `cadence` on a shifted database clock and an in-memory vendor in the
// shapes lib/broker.ts returns (a page is `done` when it returns fewer rows than asked, as the real vendor's is):
// (a) a re-issue (the vendor lists N, a new id with E's account, symbol, side, time, units and price, and no longer E):
//     N is 'suspected' after the pass, and the close is published once;
// (b) both listed: 'genuine', two closes;
// (c) E on page 1 and N on page 2 of a multi-page pass: genuine;
// (d) a week read inserting N with E unlisted: held, never shown twice, the pass brought forward; a week read listing
//     both: genuine at once when N is dated a day inside the window, held when it is not;
// (e) two identical fills arriving in the same read (a week read, an import page) are never held;
// (f) a genuine losing fill held across pages is back in closed_trades and the stats after the deciding pass;
// (g) an unstable order between page calls makes the pass invalid ('shifted'): it decides nothing, counted;
// (h) a stored row the vendor never lists: the first pass decides nothing ('missing'); the next with the same shortfall
//     decides;
// (i) no activities row is ever updated or deleted (all columns and xmin compared).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 180_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000, DAY = 24 * HOUR;
const base = Date.now() - 40 * DAY; // the test's clock: 40 days ago, shifted per round
const shiftAt = (h: number) => base + h * HOUR - Date.now();
const at = (d: number) => new Date(base + d * DAY); // a trade date, days from the test clock's start

type Row = { externalId: string; accountId: string; symbol: string; side: 'BUY' | 'SELL'; units: number; price: number; fee: number; executedAt: Date; verified: boolean; raw: unknown };

async function trader() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { syncUser, insertActivities } = await import('./sync.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const tag = `rr${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const acc = { id: `${tag}-a`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true };
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json([acc])}, now()
    from users where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  const row = (id: string, side: 'BUY' | 'SELL', units: number, price: number, date: Date, symbol = 'XX'): Row => ({
    externalId: `${tag}-${id}`, accountId: acc.id, symbol, side, units, price, fee: 0, executedAt: date, verified: true, raw: { type: side, id: `${tag}-${id}` },
  });
  // The vendor: `list` is its full history in its own order; `order` (if set) gives the list for the nth page call.
  const v = { list: [] as Row[], order: null as null | ((call: number) => Row[]), weekCalls: 0, pageCalls: [] as number[] };
  const broker = {
    pageLimit: undefined as number | undefined,
    listAccounts: async () => [acc],
    fetchActivities: async (_u: unknown, since: Date, ids?: string[]) => {
      v.weekCalls++;
      return v.list.filter((r) => (ids ?? []).includes(r.accountId) && r.executedAt >= since);
    },
    fetchActivitiesPage: async (_u: unknown, id: string, offset: number, limit = 1000) => {
      const l = (v.order ? v.order(v.pageCalls.length) : v.list).filter((r) => r.accountId === id);
      v.pageCalls.push(offset);
      const activities = l.slice(offset, offset + limit);
      return { activities, unusable: [], done: activities.length < limit };
    },
  };
  // Closes counted inside each sync's transaction right after its one rebuild (a close is never shown twice in a sync).
  const inSync: number[] = [];
  const rebuild = async (id: number, tx: import('postgres').TransactionSql) => {
    await rebuildRecord(id, tx);
    inSync.push((await tx`select count(*)::int as n from closed_trades where user_id = ${id} and symbol = 'XX'`)[0].n);
  };
  const round = (h: number) => syncUser(user, broker as never, rebuild, undefined, { cadence: true, shiftMs: shiftAt(h) });
  const store = (rows: Row[]) => insertActivities(user.id, 'snaptrade', rows);
  const due = (when: string | null = '2000-01-01') => sql`update broker_accounts set reconcile_due_at = ${when} where account_id = ${acc.id}`;
  const closes = async () => (await sql`select sell_id, return_pct, holding_days, closed_at from closed_trades where user_id = ${u.id} and symbol = 'XX' order by sell_id`);
  const state = async (id: string) => (await sql`select state from activity_reissues where source = 'snaptrade' and external_id = ${`${tag}-${id}`}`)[0]?.state ?? null;
  const cursor = async () => (await sql`select reconcile_offset, reconcile_due_at, reconcile_invalid, reconcile_missing, reconcile_valid, reconcile_seen
    from broker_accounts where account_id = ${acc.id}`)[0];
  // (i): every activities row of this trader, all columns and the row version (xmin: any update changes it).
  const raw = async () => (await sql`select id, xmin::text as v, source, external_id, account_id, symbol, side, units, price, fee, executed_at, raw::text as raw, created_at
    from activities where user_id = ${u.id} order by id`).map((r) => ({ ...r }));
  const unchanged = async (prev: Record<string, unknown>[], msg: string) => {
    const now = await raw();
    const byId = new Map(now.map((r) => [String(r.id), r]));
    for (const r of prev) assert.deepEqual(byId.get(String(r.id)), r, `${msg}: activities row ${String(r.id)} unchanged and present`);
    return now;
  };
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id = ${acc.id}`; };
  return { sql, tag, user, acc, v, broker, row, round, store, due, closes, state, cursor, raw, unchanged, inSync, cleanup };
}

// The original pair: a 20-unit buy and E, a 10-unit sell; N is E's twin under a new vendor id.
const pair = (t: Awaited<ReturnType<typeof trader>>, sellPrice = 12, d = -20) => ({
  b1: t.row('b1', 'BUY', 20, 10, at(d - 10)),
  e: t.row('e', 'SELL', 10, sellPrice, at(d)),
  n: t.row('n', 'SELL', 10, sellPrice, at(d)),
});

dbTest('(a) re-issue: the full read lists N and no longer E → N suspected after the pass, the close published once', async () => {
  const t = await trader();
  try {
    const { b1, e, n } = pair(t);
    await t.store([b1, e]);
    t.v.list = [b1, e];
    await t.round(0); // claims the account (a week read)
    assert.equal((await t.closes()).length, 1);
    let snap = await t.raw();
    t.v.list = [b1, n]; // the vendor re-issued E as N
    await t.due();
    const pages = t.v.pageCalls.length, weeks = t.v.weekCalls;
    await t.round(25);
    assert.equal(t.v.pageCalls.length, pages + 1, 'a one-page pass read the history');
    assert.equal(t.v.weekCalls, weeks, 'in place of the week read');
    assert.equal(await t.state('n'), 'suspected');
    const c = await t.closes();
    assert.deepEqual(c.map((r) => r.sell_id), [e.externalId], 'one close, under the original id');
    assert.equal(t.inSync.at(-1), 1, 'never two closes inside the sync');
    const cur = await t.cursor();
    assert.equal(cur.reconcile_offset, null, 'the pass ended');
    assert.equal(cur.reconcile_invalid, 0);
    snap = await t.unchanged(snap, '(a)');
    assert.equal(snap.length, 3, 'N stored (raw), never published');
    // A later pass changes nothing: the suspected row stays held.
    await t.due();
    await t.round(50);
    assert.equal(await t.state('n'), 'suspected');
    assert.equal((await t.closes()).length, 1);
    await t.unchanged(snap, '(a) second pass');
  } finally { await t.cleanup(); }
});

dbTest('(b) genuine: the full read lists both E and N → genuine, two closes', async () => {
  const t = await trader();
  try {
    const { b1, e, n } = pair(t);
    await t.store([b1, e]);
    t.v.list = [b1, e];
    await t.round(0);
    const snap = await t.raw();
    // N is dated outside the week window of the newest stored row (a later buy), so only the pass can find it.
    const late = t.row('late', 'BUY', 1, 5, at(-2), 'YY');
    await t.store([late]);
    t.v.list = [b1, e, n, late];
    await t.due();
    await t.round(25);
    assert.equal(t.v.pageCalls.length, 1, 'the pass read it');
    assert.equal(await t.state('n'), 'genuine');
    assert.deepEqual((await t.closes()).map((r) => r.sell_id).sort(), [e.externalId, n.externalId].sort(), 'two closes');
    await t.unchanged(snap, '(b)');
  } finally { await t.cleanup(); }
});

dbTest('(c) boundary: E on page 1 and N on page 2 of a multi-page pass → genuine (a week read between the pages)', async () => {
  const t = await trader();
  try {
    const { b1, e, n } = pair(t, 12, -30);
    // 65 rows listed: B1, E at 5, 62 filler buys, N last (index 64). pageLimit 60 > RECONCILE_OVERLAP (50): page 1 is
    // rows 0..59, page 2 starts 50 back (offset 10) and lists rows 10..64 (55 < 60: done).
    const fill = Array.from({ length: 62 }, (_, i) => t.row(`f${i}`, 'BUY', 1, 5, at(-15 + i / 100), 'FL'));
    const stored = [b1, ...fill.slice(0, 4), e, ...fill.slice(4)];
    await t.store(stored);
    t.v.list = stored;
    t.broker.pageLimit = 60;
    await t.round(0);
    let snap = await t.raw();
    await t.due();
    await t.round(25); // page 1 (E listed, N not yet posted)
    assert.deepEqual(t.v.pageCalls, [0]);
    assert.equal((await t.cursor()).reconcile_offset, 10, 'the next page starts RECONCILE_OVERLAP rows back');
    t.v.list = [...stored, n]; // the vendor posts N; it is listed last
    const weeks = t.v.weekCalls;
    await t.round(50); // under the 47 h page gap: the week read (N's date is outside its window)
    assert.equal(t.v.weekCalls, weeks + 1);
    assert.deepEqual(t.v.pageCalls, [0]);
    assert.equal(await t.state('n'), null, 'the week read did not list N');
    await t.round(75); // page 2: N inserted, its twin E listed on page 1
    assert.deepEqual(t.v.pageCalls, [0, 10]);
    assert.equal(await t.state('n'), 'genuine');
    assert.equal((await t.closes()).length, 2, 'two genuine identical fills, two closes');
    const cur = await t.cursor();
    assert.equal(cur.reconcile_offset, null);
    assert.equal(cur.reconcile_invalid, 0);
    assert.equal(cur.reconcile_seen, null, 'listed ids dropped at the pass end');
    snap = await t.unchanged(snap, '(c)');
  } finally { await t.cleanup(); }
});

dbTest('(d) a week read inserting N with E unlisted: held pending, never shown twice, the pass brought forward', async () => {
  const t = await trader();
  try {
    const { b1, e, n } = pair(t);
    await t.store([b1, e]);
    t.v.list = [b1, e];
    await t.round(0);
    const snap = await t.raw();
    const far = new Date(base + 30 * DAY).toISOString();
    await t.due(far);
    t.v.list = [b1, n]; // E is in the week window but no longer listed
    await t.round(25);
    assert.equal(t.v.pageCalls.length, 0, 'no pass ran: the week read');
    assert.equal(await t.state('n'), 'pending');
    assert.equal(t.inSync.at(-1), 1, 'one close inside the sync that inserted N');
    assert.deepEqual((await t.closes()).map((r) => r.sell_id), [e.externalId]);
    const due = (await t.cursor()).reconcile_due_at as Date;
    assert.ok(due.getTime() <= base + 25 * HOUR + 10 * 60_000 && due.getTime() > base + 24 * HOUR, 'reconcile_due_at brought forward to the sync time');
    await t.unchanged(snap, '(d)');
  } finally { await t.cleanup(); }
});

dbTest('(d) a week read listing both E and N: genuine at once when N is dated a day or more inside the window; held when not', async () => {
  const t = await trader();
  try {
    // Inside: E and N on the newest date (since = newest − 7 d).
    const { b1, e, n } = pair(t);
    await t.store([b1, e]);
    t.v.list = [b1, e];
    await t.round(0);
    const snap = await t.raw();
    await t.due(new Date(base + 30 * DAY).toISOString());
    t.v.list = [b1, e, n];
    await t.round(25);
    assert.equal(t.v.pageCalls.length, 0);
    assert.equal(await t.state('n'), 'genuine');
    assert.equal((await t.closes()).length, 2);
    await t.unchanged(snap, '(d) inside');
  } finally { await t.cleanup(); }
  const t2 = await trader();
  try {
    // Within the window's first day: E and N at newest − 6.5 d, so the pair is not decided by the week read.
    const b1 = t2.row('b1', 'BUY', 20, 10, at(-30));
    const e = t2.row('e', 'SELL', 10, 12, at(-26.5)), n = t2.row('n', 'SELL', 10, 12, at(-26.5));
    const newest = t2.row('z', 'BUY', 1, 5, at(-20), 'YY');
    await t2.store([b1, e, newest]);
    t2.v.list = [b1, e, newest];
    await t2.round(0);
    await t2.due(new Date(base + 30 * DAY).toISOString());
    t2.v.list = [b1, e, n, newest];
    await t2.round(25);
    assert.equal(await t2.state('n'), 'pending', 'a pair at the window\'s first day waits for the pass');
    assert.equal((await t2.closes()).length, 1);
    assert.ok(((await t2.cursor()).reconcile_due_at as Date).getTime() <= base + 25 * HOUR + 10 * 60_000, 'brought forward');
    await t2.round(50); // the pass lists both
    assert.equal(t2.v.pageCalls.length, 1);
    assert.equal(await t2.state('n'), 'genuine');
    assert.equal((await t2.closes()).length, 2);
  } finally { await t2.cleanup(); }
});

dbTest('(e) two identical fills arriving in the same week read are never held', async () => {
  const t = await trader();
  try {
    const { b1, e, n } = pair(t);
    await t.store([b1]);
    t.v.list = [b1];
    await t.round(0);
    t.v.list = [b1, e, n];
    await t.round(25);
    assert.equal(await t.state('e'), null);
    assert.equal(await t.state('n'), null);
    assert.equal((await t.sql`select count(*)::int as n from activity_reissues where user_id = ${t.user.id}`)[0].n, 0);
    assert.equal((await t.closes()).length, 2);
  } finally { await t.cleanup(); }
});

dbTest('(e) two identical fills on the same import page are never held (importStep)', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { startConnection, completeLink, consent, importStep } = await import('./connections.ts');
  const tag = `ri${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const [{ signup_attempt_id: attempt }] = await sql`select signup_attempt_id from users where id = ${u.id}`;
  const acc = `${tag}-a`;
  const r = (id: string, side: 'BUY' | 'SELL', units: number, price: number, d: Date) => ({
    externalId: `${tag}-${id}`, accountId: acc, symbol: 'XX', side, units, price, fee: 0, executedAt: d, verified: true, raw: { type: side },
  });
  const rows = [r('b1', 'BUY', 20, 10, at(-30)), r('e', 'SELL', 10, 12, at(-20)), r('n', 'SELL', 10, 12, at(-20))];
  const deps = {
    pageLimit: 10,
    registerUser: async (ref: number | string) => ({ snaptradeUserId: `${tag}-v${ref}`, secretEnc: 'enc' }),
    connectUrl: async () => 'https://vendor.example/portal',
    listAccounts: async () => [{ id: acc, authorizationId: `auth-${acc}`, institution: 'x', isPaper: false, initialSyncCompleted: true }],
    fetchActivitiesPage: async (_u: unknown, _a: string, offset: number, limit = 10) => {
      const activities = rows.slice(offset, offset + limit);
      return { activities, unusable: [], done: activities.length < limit };
    },
    fetchPositions: async () => [],
    deleteConnection: async () => {}, deleteUser: async () => {},
  };
  try {
    await startConnection({ userId: u.id, attemptId: Number(attempt) }, 'https://app.example/connect/done', deps as never);
    const out = await completeLink({ userId: u.id, attemptId: Number(attempt) }, deps as never);
    const id = (out as { id: number }).id;
    await consent(id, new Date(), deps as never);
    for (let i = 0; i < 8; i++) if ((await importStep(id, deps as never)).state !== 'importing') break;
    assert.equal((await sql`select count(*)::int as n from activities where user_id = ${u.id}`)[0].n, 3, 'the page was imported');
    assert.equal((await sql`select count(*)::int as n from activity_reissues where user_id = ${u.id}`)[0].n, 0, 'never held');
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 2, 'both closes');
  } finally {
    await sql`delete from users where id = ${u.id}`;
    await sql`delete from broker_accounts where account_id = ${acc}`;
  }
});

dbTest('(f) a genuine LOSING fill held pending across pages is back in closed_trades and the stats after the deciding pass', async () => {
  const t = await trader();
  const { stats } = await import('./trades.ts');
  try {
    const { b1, e, n } = pair(t, 8, -30); // sold at a loss
    // 65 rows listed: N at 5 (page 1), E last at 64 (page 2 only); filler buys newer than the pair, so no week read
    // window reaches it.
    const fill = Array.from({ length: 62 }, (_, i) => t.row(`f${i}`, 'BUY', 1, 5, at(-10 + i / 100), 'FL'));
    await t.store([b1, e, ...fill]);
    t.v.list = [b1, e, ...fill];
    t.broker.pageLimit = 60;
    await t.round(0);
    const snap = await t.raw();
    const shown = await t.closes();
    assert.equal(shown.length, 1);
    assert.ok(Number(shown[0].return_pct) < 0, 'a losing close');
    t.v.list = [b1, ...fill.slice(0, 4), n, ...fill.slice(4), e];
    await t.due();
    await t.round(25); // page 1 inserts N; E is not on it
    assert.equal(await t.state('n'), 'pending');
    assert.equal((await t.closes()).length, 1, 'held while the pass runs');
    const weeks = t.v.weekCalls;
    await t.round(50); // the week read between pages
    assert.equal(t.v.weekCalls, weeks + 1, 'a week read, not a page');
    assert.deepEqual(t.v.pageCalls, [0]);
    assert.equal(await t.state('n'), 'pending');
    assert.equal((await t.closes()).length, 1);
    await t.round(75); // page 2 lists E: the pair is genuine
    assert.deepEqual(t.v.pageCalls, [0, 10]);
    assert.equal(await t.state('n'), 'genuine');
    const c = await t.closes();
    assert.deepEqual(c.map((r) => r.sell_id).sort(), [e.externalId, n.externalId].sort());
    assert.ok(c.every((r) => Number(r.return_pct) < 0), 'both losses published');
    const s = stats(c.map((r) => ({ returnPct: Number(r.return_pct), holdingDays: Number(r.holding_days), closedAt: r.closed_at as Date })));
    assert.equal(s.trades, 2);
    assert.equal(s.winRate, 0);
    assert.ok(s.avgReturn < 0);
    await t.unchanged(snap, '(f)');
  } finally { await t.cleanup(); }
});

dbTest('(g) an unstable order between page calls (same-instant rows reordered) → the pass is invalid (shifted), decides nothing, counted', async () => {
  const t = await trader();
  const logs: unknown[][] = [];
  const orig = console.log;
  try {
    const { b1, e, n } = pair(t, 12, -30);
    const same = at(-12);
    const fill = Array.from({ length: 66 }, (_, i) => t.row(`f${i}`, 'BUY', 1, 5, same, 'FL')); // one instant
    await t.store([b1, e, ...fill]);
    t.v.list = [b1, e, ...fill];
    t.broker.pageLimit = 60;
    await t.round(0);
    const snap = await t.raw();
    // The re-issue: N listed, E not. Page 1 order: [B1, N, fill...] (rows 0-59); page 2 (rows 10-67) swaps two same-instant
    // rows (index 5 and 65): the row first at 65 moves before page 2's offset and is never listed (skipped), the row
    // first at 5 is listed twice, so page 2 shares 51 ids with page 1 instead of 50.
    const first = [b1, n, ...fill];
    const second = [...first];
    [second[5], second[65]] = [second[65], second[5]];
    t.v.order = (call) => (call === 0 ? first : second);
    await t.due();
    await t.round(25);
    assert.equal(await t.state('n'), 'pending');
    console.log = (...a: unknown[]) => { logs.push(a); };
    await t.round(75);
    console.log = orig;
    assert.deepEqual(t.v.pageCalls, [0, 10]);
    assert.equal(await t.state('n'), 'pending', 'an invalid pass decides nothing (a valid one would have suspected N)');
    const cur = await t.cursor();
    assert.equal(cur.reconcile_invalid, 1, 'reconcile_invalid incremented');
    assert.equal(cur.reconcile_offset, null, 'the pass ended');
    assert.equal(cur.reconcile_missing, null);
    assert.deepEqual(logs.filter((l) => l[0] === 'sync reconcile invalid'), [['sync reconcile invalid', t.user.id, '{"reason":"shifted"}']]);
    assert.equal((await t.closes()).length, 1);
    await t.unchanged(snap, '(g)');
  } finally { console.log = orig; await t.cleanup(); }
});

dbTest('(h) a stored row the vendor never lists: the first pass is missing (no decision), the second with the same shortfall decides', async () => {
  const t = await trader();
  const logs: unknown[][] = [];
  const orig = console.log;
  try {
    const { b1, e, n } = pair(t);
    const x = t.row('x', 'BUY', 1, 5, at(-25), 'YY'); // stored; the vendor never lists it (a cancel, owner Q3)
    await t.store([b1, e, x]);
    t.v.list = [b1, e];
    await t.round(0);
    const snap = await t.raw();
    t.v.list = [b1, n];
    await t.due();
    console.log = (...a: unknown[]) => { logs.push(a); };
    await t.round(25);
    console.log = orig;
    assert.equal(await t.state('n'), 'pending', 'no decision');
    let cur = await t.cursor();
    assert.deepEqual(cur.reconcile_missing, [x.externalId]);
    assert.equal(cur.reconcile_invalid, 1);
    assert.deepEqual(logs.filter((l) => l[0] === 'sync reconcile invalid'), [['sync reconcile invalid', t.user.id, '{"reason":"missing"}']]);
    assert.equal((await t.closes()).length, 1);
    await t.due();
    await t.round(50);
    assert.equal(await t.state('n'), 'suspected', 'the same shortfall decides');
    cur = await t.cursor();
    assert.equal(cur.reconcile_invalid, 0, 'reset by a deciding pass');
    assert.equal((await t.closes()).length, 1);
    await t.unchanged(snap, '(h)');
  } finally { console.log = orig; await t.cleanup(); }
});

dbTest('(j) QA D1: two genuine identical fills stored together, then one re-issued: the re-issue is held (pending, then suspected), never genuine; at most 2 closes', async () => {
  const t = await trader();
  try {
    const b = t.row('b', 'BUY', 30, 10, at(-30));
    const e = t.row('e', 'SELL', 10, 12, at(-20)), n1 = t.row('n1', 'SELL', 10, 12, at(-20)), n2 = t.row('n2', 'SELL', 10, 12, at(-20));
    await t.store([b, e, n1]); // stored together: both genuine fills
    t.v.list = [b, e, n1];
    await t.round(0);
    assert.equal((await t.closes()).length, 2, 'both fills published');
    assert.equal(await t.state('n1'), null);
    const snap = await t.raw();
    await t.due(new Date(base + 30 * DAY).toISOString());
    t.v.list = [b, e, n2]; // the vendor re-issued N1 as N2 (inside the week window)
    await t.round(25);
    assert.equal(t.v.pageCalls.length, 0, 'a week read');
    assert.equal(await t.state('n2'), 'pending', 'E being listed does not clear N2: N1 is not listed');
    assert.ok(t.inSync.at(-1)! <= 2);
    assert.equal((await t.closes()).length, 2);
    await t.round(50); // brought forward: the deciding pass
    assert.equal(t.v.pageCalls.length, 1, 'the pass ran');
    assert.equal(await t.state('n2'), 'suspected', 'never genuine');
    assert.ok(t.inSync.every((n) => n <= 2), `at most 2 closes in every sync: ${t.inSync.join(',')}`);
    assert.equal((await t.closes()).length, 2);
    assert.equal((await t.cursor()).reconcile_invalid, 0, 'the pass decided');
    await t.unchanged(snap, '(j)');
  } finally { await t.cleanup(); }
});

dbTest('(k) QA D2: a pending N no longer listed (its original E listed) is suspected by a complete pass, and the next pass is not pulled forward daily', async () => {
  const t = await trader();
  try {
    const { b1, e, n } = pair(t);
    await t.store([b1, e]);
    t.v.list = [b1, e];
    await t.round(0);
    const snap = await t.raw();
    await t.due(new Date(base + 30 * DAY).toISOString());
    t.v.list = [b1, n]; // a week read lists N, not E: N held
    await t.round(25);
    assert.equal(await t.state('n'), 'pending');
    t.v.list = [b1, e]; // the vendor lists E again and no longer N
    await t.round(50); // brought forward: the pass
    assert.equal(t.v.pageCalls.length, 1, 'the pass ran');
    assert.equal(await t.state('n'), 'suspected', 'a complete pass leaves nothing pending');
    const cur = await t.cursor();
    assert.equal(cur.reconcile_invalid, 0, 'the pass decided');
    assert.ok((cur.reconcile_due_at as Date).getTime() > base + 50 * HOUR + 6 * DAY, 'the next pass a period later');
    for (const h of [75, 100, 125]) await t.round(h); // daily week reads
    assert.equal(t.v.pageCalls.length, 1, 'page calls only on the pass day');
    assert.equal((await t.closes()).length, 1);
    await t.unchanged(snap, '(k)');
  } finally { await t.cleanup(); }
});

dbTest('(l) QA D7: a held row the vendor no longer lists does not make the pass missing: the first complete pass decides', async () => {
  const t = await trader();
  const logs: unknown[][] = [];
  const orig = console.log;
  try {
    const { b1, e, n } = pair(t);
    await t.store([b1, e]);
    t.v.list = [b1, e];
    await t.round(0);
    const snap = await t.raw();
    t.v.list = [b1, n]; // re-issue: pass 1 suspects N
    await t.due();
    await t.round(25);
    assert.equal(await t.state('n'), 'suspected');
    t.v.list = [b1, e]; // the vendor no longer lists the held N
    await t.due();
    const pages = t.v.pageCalls.length;
    console.log = (...a: unknown[]) => { logs.push(a); };
    await t.round(50);
    console.log = orig;
    assert.equal(t.v.pageCalls.length, pages + 1, 'one pass');
    assert.deepEqual(logs.filter((l) => l[0] === 'sync reconcile invalid'), [], 'not missing');
    const cur = await t.cursor();
    assert.equal(cur.reconcile_invalid, 0, 'the first complete pass decided');
    assert.equal(cur.reconcile_missing, null);
    assert.equal(await t.state('n'), 'suspected');
    assert.equal((await t.closes()).length, 1);
    await t.unchanged(snap, '(l)');
  } finally { console.log = orig; await t.cleanup(); }
});
