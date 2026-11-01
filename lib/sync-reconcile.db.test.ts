// F-24 late-posted trades (docs/features/F-24-late-sell-reconciliation.md; plan docs/features/logs/F-24/plan.md, round 2
// and "Round 3 changes"): the insert-only reconciliation pass, through syncUser with `cadence` on a shifted database
// clock. Most tests use an in-memory broker that counts every vendor call (week read, pass page, share moves,
// positions) and pages the account's history like the vendor (offset/limit, `done` on a short page); AC1 also runs over
// HTTP against the in-repo vendor fake (e2e/fakes/vendor.ts) through the real lib/broker.ts. Each pass is made due by
// setting broker_accounts.reconcile_due_at to the test clock (never the weekday stagger). Every test creates and
// deletes only its own rows (a random tag). Skipped without DATABASE_URL.
//   AC1: a late losing SELL the week read never lists reaches closed_trades after the pass; a second pass inserts 0 rows.
//   AC2: no activities row is updated or deleted (every column, raw and xmin/ctid, before and after); only late rows added.
//   AC3: a 3-page pass (offset null -> 50 -> 100 -> null, a week read between pages, 47 h pacing), at most one
//        activities-endpoint call per account per 24 h, the same vendor call totals with the pass on and off; a rolled
//        back page day and a RouteDeadlineError cut leave the cursor and the marks; a page that always throws a
//        TypeError is given up after 2 failed syncs (reason 'failures') and the week read resumes.
//   AC4: frozen, unlisted, paper and unconsented accounts with a due pass are never read; an account that leaves the
//        read set mid-pass has its pass state cleared on the trader's next sync.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { FakeActivity } from '../e2e/fakes/vendor.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 300_000 }, fn);
let fakeBase = '';
let server: Server | null = null;
before(async () => {
  if (!hasDb) return;
  await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
  const fake = await (await import('../e2e/fakes/vendor.ts')).startVendorFake(0);
  server = fake.server;
  fakeBase = fake.base;
  process.env.SNAPTRADE_BASE_URL = fakeBase;
  process.env.SNAPTRADE_CLIENT_ID = 'test';
  process.env.SNAPTRADE_CONSUMER_KEY = 'test-consumer';
  process.env.APP_SECRET_KEY ||= 'reconcile-test-secret';
});
after(async () => {
  if (!hasDb) return;
  server?.close();
  server?.closeAllConnections();
  await (await import('./db.ts')).sql.end({ timeout: 1 });
});

const MIN = 60_000, HOUR = 3_600_000, DAY = 24 * HOUR;
// The test's clock: 60 days back (other files use the last 40), shifted per round.
const base = Date.now() - 60 * DAY;
const shiftAt = (h: number) => base + h * HOUR - Date.now();
const at = (h: number) => new Date(base + h * HOUR);

type Row = { externalId: string; accountId: string; symbol: string; side: 'BUY' | 'SELL'; units: number; price: number; fee: number; executedAt: Date; verified: true; raw: unknown };
const row = (id: string, accountId: string, symbol: string, side: 'BUY' | 'SELL', price: number, executedAt: Date): Row => ({
  externalId: id, accountId, symbol, side, units: 1, price, fee: 0, executedAt, verified: true,
  raw: { id, type: side, symbol: { symbol }, units: 1, price, trade_date: executedAt.toISOString() },
});
// `n` rows of BUY/SELL pairs over 5 symbols, 6 h apart, the last one at `end` (no two share a time: no twins).
const history = (prefix: string, accountId: string, n: number, end: Date): Row[] => Array.from({ length: n }, (_, i) => {
  const pair = i >> 1;
  return row(`${prefix}-h${i}`, accountId, `S${pair % 5}`, i % 2 ? 'SELL' : 'BUY', i % 2 ? 100 + (pair % 7) - 3 : 100, new Date(end.getTime() - (n - 1 - i) * 6 * HOUR));
});
const byDate = (rows: Row[]) => rows.sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());

type VendorAccount = { id: string; authorizationId: string; institution: string; isPaper: boolean; initialSyncCompleted: boolean };
type Call = { kind: 'week' | 'page' | 'moves' | 'positions'; id: string; h: number; offset?: number };
// The in-memory vendor: each account's history in the vendor's order; every call recorded with the round's hour.
function memBroker(o: { accounts: () => VendorAccount[]; history: Record<string, Row[]>; pageLimit?: number }) {
  const b = {
    h: 0,
    pageLimit: o.pageLimit,
    calls: [] as Call[],
    pageError: null as null | ((id: string, offset: number) => unknown),
    positionsError: null as null | ((id: string) => unknown),
    listAccounts: async () => o.accounts(),
    fetchActivities: async (_u: unknown, since: Date, ids?: string[]) => {
      const out: Row[] = [];
      for (const id of ids ?? []) {
        b.calls.push({ kind: 'week', id, h: b.h });
        out.push(...(o.history[id] ?? []).filter((r) => r.executedAt >= since));
      }
      return { activities: out, unusable: [] };
    },
    fetchActivitiesPage: async (_u: unknown, id: string, offset: number, limit = 1000) => {
      b.calls.push({ kind: 'page', id, h: b.h, offset });
      const e = b.pageError?.(id, offset);
      if (e) throw e;
      const rows = (o.history[id] ?? []).slice(offset, offset + limit);
      return { activities: rows, unusable: [], done: rows.length < limit };
    },
    fetchShareMoves: async (_u: unknown, id: string) => { b.calls.push({ kind: 'moves', id, h: b.h }); return { activities: [], actions: [] }; },
    fetchPositions: async (_u: unknown, id: string) => {
      b.calls.push({ kind: 'positions', id, h: b.h });
      const e = b.positionsError?.(id);
      if (e) throw e;
      return [];
    },
  };
  return b;
}
type Mem = ReturnType<typeof memBroker>;

// A trader with connected connections (consented 400 days before the real clock, option backfill done), one per
// authorization, each with a snapshot of its accounts (`k` is the account id's suffix).
async function trader(conns: { auth: string; accts: { k: string; paper?: boolean }[] }[]) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `rc${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const id = (k: string) => `${tag}-${k}`;
  const vendor = (k: string, auth: string, paper = false): VendorAccount => ({ id: id(k), authorizationId: `${tag}-${auth}`, institution: 'x', isPaper: paper, initialSyncCompleted: true });
  const connIds: Record<string, number> = {};
  for (const c of conns) {
    const snap = c.accts.map((a) => vendor(a.k, c.auth, a.paper));
    const [r] = await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
      select signup_attempt_id, id, ${`${tag}-${c.auth}`}, 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json(snap)}, now()
      from users where id = ${u.id} returning id`;
    connIds[c.auth] = Number(r.id);
  }
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  const cleanup = async () => {
    await sql`delete from users where id = ${u.id}`;
    await sql`delete from broker_accounts where account_id like ${`${tag}-%`}`;
  };
  return { sql, tag, user, id, vendor, connIds, cleanup };
}
type Trader = Awaited<ReturnType<typeof trader>>;

const round = async (t: Trader, b: Mem, h: number, rebuild?: (id: number, tx: unknown) => Promise<unknown>) => {
  const { syncUser } = await import('./sync.ts');
  b.h = h;
  return syncUser(t.user, b as never, rebuild as never, undefined, { cadence: true, shiftMs: shiftAt(h) });
};
const due = (t: Trader, accountId: string, h: number) => t.sql`update broker_accounts set reconcile_due_at = ${at(h)} where account_id = ${accountId} and user_id = ${t.user.id}`;
const cursor = async (t: Trader, accountId: string) => (await t.sql`select reconcile_due_at, reconcile_offset, reconcile_page_at, reconcile_started_at, reconcile_pages,
    reconcile_expect, reconcile_tail, reconcile_seen, reconcile_valid, reconcile_missing, reconcile_invalid, activities_read_at
  from broker_accounts where account_id = ${accountId}`)[0];
// The cursor as text (every pass column and the committed read time), for "unchanged" comparisons.
const cursorText = async (t: Trader, accountId: string) => (await t.sql`select (reconcile_due_at, reconcile_offset, reconcile_page_at, reconcile_started_at,
    reconcile_pages, reconcile_expect, reconcile_tail, reconcile_seen, reconcile_valid, reconcile_missing, reconcile_invalid, activities_read_at, positions_read_at)::text as s
  from broker_accounts where account_id = ${accountId}`)[0].s as string;
const marksText = async (t: Trader, accountId: string) => ((await t.sql`select (activities_attempted_at, positions_reads, reconcile_failures)::text as s
  from sync_read_marks where user_id = ${t.user.id} and account_id = ${accountId}`)[0]?.s ?? null) as string | null;
const failures = async (t: Trader, accountId: string) => Number((await t.sql`select reconcile_failures from sync_read_marks where user_id = ${t.user.id} and account_id = ${accountId}`)[0]?.reconcile_failures ?? 0);
const activityCount = async (t: Trader) => (await t.sql`select count(*)::int as n from activities where user_id = ${t.user.id}`)[0].n as number;
const closes = async (t: Trader) => (await t.sql`select sell_id, account_id, symbol, return_pct, holding_days, closed_at from closed_trades where user_id = ${t.user.id} order by closed_at, sell_id`)
  .map((r) => ({ ...r })) as unknown as { sell_id: string; account_id: string; symbol: string; return_pct: number; holding_days: number; closed_at: Date }[];
// console.log lines written while `fn` runs (passed through).
async function logged<T>(fn: () => Promise<T>): Promise<{ lines: string[]; out: T }> {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); orig(...a); };
  try { return { lines, out: await fn() }; } finally { console.log = orig; }
}
const near = (a: Date, b: Date, ms = 5 * MIN) => Math.abs(a.getTime() - b.getTime()) <= ms;

// ---------------------------------------------------------------------------------------------------------------- AC1

dbTest('AC1: a losing SELL dated 10 days before the newest stored trade, never listed by the week read, reaches closed_trades after the pass; a second pass inserts 0 rows', async () => {
  const t = await trader([{ auth: 'a', accts: [{ k: 'a' }] }]);
  const { insertActivities } = await import('./sync.ts');
  const { stats } = await import('./trades.ts');
  try {
    const A = t.id('a');
    const newest = at(-24);
    const stored = [
      row(`${t.tag}-bx`, A, 'XX', 'BUY', 100, at(-40 * 24)),
      row(`${t.tag}-by`, A, 'YY', 'BUY', 50, at(-30 * 24)),
      row(`${t.tag}-sy`, A, 'YY', 'SELL', 60, at(-20 * 24)),
      row(`${t.tag}-bz`, A, 'ZZ', 'BUY', 10, newest),
    ];
    const late = row(`${t.tag}-sx`, A, 'XX', 'SELL', 80, new Date(newest.getTime() - 10 * DAY)); // a 20% loss
    await insertActivities(t.user.id, 'snaptrade', stored);
    const b = memBroker({ accounts: () => [t.vendor('a', 'a')], history: { [A]: byDate([...stored, late]) } });

    await round(t, b, 0);
    assert.deepEqual(b.calls.filter((c) => c.kind === 'week').map((c) => c.id), [A], 'h0: the week read');
    assert.equal(b.calls.filter((c) => c.kind === 'page').length, 0, 'h0: no pass (not due)');
    assert.deepEqual((await closes(t)).map((c) => c.sell_id), [`${t.tag}-sy`], 'the week read never lists the late sell');

    await due(t, A, 1);
    b.calls.length = 0;
    await round(t, b, 25);
    assert.deepEqual(b.calls.filter((c) => c.kind === 'page').map((c) => [c.id, c.offset]), [[A, 0]], 'h25: the pass page');
    assert.equal(b.calls.filter((c) => c.kind === 'week').length, 0, 'the page replaces that day\'s week read');
    const found = (await closes(t)).find((c) => c.sell_id === late.externalId);
    assert.ok(found, 'the late sell is in closed_trades');
    assert.equal(found.symbol, 'XX');
    assert.ok(found.return_pct < 0, `a loss (${found.return_pct})`);
    assert.ok(Math.abs(found.return_pct - -0.2) < 1e-9, 'the loss as published: -20%');
    assert.ok(near(found.closed_at, late.executedAt, 1000));
    // It counts in the trader's record (the stats every profile computes from closed_trades on read).
    const all = await closes(t);
    const s = stats(all.map((c) => ({ returnPct: c.return_pct, holdingDays: c.holding_days, closedAt: c.closed_at })));
    assert.equal(s.trades, 2);
    assert.ok(s.avgLoss < 0 && Math.abs(s.avgLoss - -0.2) < 1e-9, 'the loss is in the headline stats');
    const c1 = await cursor(t, A);
    assert.equal(c1.reconcile_offset, null, 'a one-page pass ends at once');
    assert.equal(c1.reconcile_invalid, 0);
    assert.ok(c1.reconcile_due_at > at(25 + 7 * 24 - 1), 'the next pass a period later');

    // A second pass: nothing new to insert.
    const n = await activityCount(t);
    const before = await closes(t);
    await due(t, A, 26);
    b.calls.length = 0;
    await round(t, b, 50);
    assert.deepEqual(b.calls.filter((c) => c.kind === 'page').map((c) => c.offset), [0], 'h50: a second pass');
    assert.equal(await activityCount(t), n, 'the second pass inserts 0 rows');
    assert.deepEqual(await closes(t), before, 'and changes no close');
  } finally { await t.cleanup(); }
});

dbTest('AC1 (vendor fake over HTTP): the late losing SELL lands after the pass, read through the real broker; a second pass inserts 0 rows', async () => {
  const { sql } = await import('./db.ts');
  const broker = await import('./broker.ts');
  const { syncUser, defaultBroker } = await import('./sync.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `rv${Math.random().toString(36).slice(2, 9)}`;
  const A = `${tag}-a`, auth = `${tag}-auth`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const post = async (path: string, body: unknown) => {
    const r = await fetch(`${fakeBase}${path}`, { method: 'POST', body: JSON.stringify(body) });
    assert.equal(r.status, 200, `${path} answered ${r.status}`);
  };
  const stats = async () => ((await (await fetch(`${fakeBase}/_stats`)).json()) as { accounts: Record<string, { activities: number }> }).accounts[A]?.activities ?? 0;
  try {
    const bu = await broker.registerUser(`${tag}-0`);
    const day = (h: number) => new Date(base + h * HOUR).toISOString();
    const rows: FakeActivity[] = [
      { id: `${tag}-bx`, symbol: 'XX', type: 'BUY', units: 1, price: 100, fee: 0, trade_date: day(-40 * 24) },
      { id: `${tag}-by`, symbol: 'YY', type: 'BUY', units: 1, price: 50, fee: 0, trade_date: day(-30 * 24) },
      { id: `${tag}-sy`, symbol: 'YY', type: 'SELL', units: 1, price: 60, fee: 0, trade_date: day(-20 * 24) },
      { id: `${tag}-bz`, symbol: 'ZZ', type: 'BUY', units: 1, price: 10, fee: 0, trade_date: day(-24) },
    ];
    const late: FakeActivity = { id: `${tag}-sx`, symbol: 'XX', type: 'SELL', units: 1, price: 80, fee: 0, trade_date: day(-24 - 10 * 24) };
    await post('/_accounts', { userId: bu.snaptradeUserId, accounts: [{ id: A, authorization: auth, activities: rows, positions: [] }] });
    await sql`update users set snaptrade_user_id = ${bu.snaptradeUserId}, snaptrade_secret_enc = ${bu.secretEnc} where id = ${u.id}`;
    const snap = [{ id: A, authorizationId: auth, institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true }];
    await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
      select signup_attempt_id, id, ${auth}, 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json(snap)}, now() from users where id = ${u.id}`;
    const user = { id: u.id, snaptrade_user_id: bu.snaptradeUserId, snaptrade_secret_enc: bu.secretEnc };
    const sync = (h: number) => syncUser(user, defaultBroker, undefined, undefined, { cadence: true, shiftMs: shiftAt(h) });
    const sellIds = async () => (await sql`select sell_id from closed_trades where user_id = ${u.id} order by sell_id`).map((r) => r.sell_id as string);
    const count = async () => (await sql`select count(*)::int as n from activities where user_id = ${u.id}`)[0].n as number;

    await sync(0); // nothing stored: the whole history (the late sell is not posted yet)
    assert.equal(await count(), 4);
    // The vendor now posts the sell, dated 10 days before the newest stored trade.
    await post('/_accounts', { userId: bu.snaptradeUserId, accounts: [{ id: A, authorization: auth, activities: [rows[0], late, ...rows.slice(1)].sort((x, y) => x.trade_date.localeCompare(y.trade_date)), positions: [] }] });
    await sync(25); // the week read (the whole-history read restarted the period)
    assert.equal(await count(), 4, 'the week read does not list it');
    assert.deepEqual(await sellIds(), [`${tag}-sy`]);

    await sql`update broker_accounts set reconcile_due_at = ${at(26)} where account_id = ${A}`;
    const calls = await stats();
    await sync(50);
    assert.equal((await stats()) - calls, 1, 'one activities-endpoint call: the pass page in place of the week read');
    assert.equal(await count(), 5);
    assert.deepEqual(await sellIds(), [`${tag}-sx`, `${tag}-sy`].sort());
    const [x] = await sql`select return_pct from closed_trades where user_id = ${u.id} and sell_id = ${late.id}`;
    assert.ok(Math.abs(x.return_pct - -0.2) < 1e-9, `the late close is a 20% loss (${x.return_pct})`);

    await sql`update broker_accounts set reconcile_due_at = ${at(51)} where account_id = ${A}`;
    await sync(75);
    assert.equal(await count(), 5, 'a second pass inserts 0 rows');
    assert.equal((await sql`select reconcile_offset from broker_accounts where account_id = ${A}`)[0].reconcile_offset, null);
  } finally {
    await sql`delete from users where id = ${u.id}`;
    await sql`delete from broker_accounts where account_id = ${A}`;
  }
});

// ---------------------------------------------------------------------------------------------------------------- AC2

dbTest('AC2: a multi-page pass updates and deletes no activities row (every column, raw, xmin and ctid); it adds only the late rows', async () => {
  const t = await trader([{ auth: 'a', accts: [{ k: 'a' }] }]);
  const { insertActivities } = await import('./sync.ts');
  try {
    const A = t.id('a');
    const stored = history(t.tag, A, 160, at(-24));
    await insertActivities(t.user.id, 'snaptrade', stored);
    // Three rows the vendor posts late, dated well before the week window.
    const lateRows = [
      row(`${t.tag}-l1`, A, 'S1', 'SELL', 90, new Date(at(-30 * 24).getTime() + MIN)),
      row(`${t.tag}-l2`, A, 'S2', 'BUY', 95, new Date(at(-20 * 24).getTime() + MIN)),
      row(`${t.tag}-l3`, A, 'S3', 'SELL', 85, new Date(at(-12 * 24).getTime() + MIN)),
    ];
    const b = memBroker({ accounts: () => [t.vendor('a', 'a')], history: { [A]: byDate([...stored, ...lateRows]) }, pageLimit: 100 });
    const snapshot = async () => new Map((await t.sql`select a.id, a.external_id, xmin::text as xmin, ctid::text as ctid, a::text as row, a.raw::text as raw
      from activities a where a.user_id = ${t.user.id} order by a.id`).map((r) => [r.id as string, { ...r }]));
    const before = await snapshot();
    assert.equal(before.size, 160);
    await round(t, b, 0);
    await due(t, A, 1);
    for (const h of [25, 50, 75, 100, 125]) await round(t, b, h);
    assert.deepEqual(b.calls.filter((c) => c.kind === 'page').map((c) => [c.h, c.offset]), [[25, 0], [75, 50], [125, 100]], 'the pass read 3 pages');
    assert.equal((await cursor(t, A)).reconcile_offset, null, 'and ended');
    const afterSnap = await snapshot();
    for (const [id, r] of before) assert.deepEqual(afterSnap.get(id), r, `activities row ${id} unchanged (present, same bytes, same xmin)`);
    const added = [...afterSnap.values()].filter((r) => !before.has(r.id as string)).map((r) => r.external_id).sort();
    assert.deepEqual(added, lateRows.map((r) => r.externalId).sort(), 'only the late rows are added');
  } finally { await t.cleanup(); }
});

// ---------------------------------------------------------------------------------------------------------------- AC3

dbTest('AC3: a 3-page pass (offset null -> 50 -> 100 -> null) paced 47 h with a week read between pages; at most one activities-endpoint call per account per 24 h; the same vendor call totals as with no pass', async () => {
  // Page limit 100 and RECONCILE_OVERLAP 50: each later page starts 50 rows back, so 160 rows take pages at 0, 50 and
  // 100 (the third returns 60 < 100 rows: done).
  const { RECONCILE_OVERLAP, RECONCILE_PAGE_GAP_MS } = await import('./reconcile.ts');
  assert.equal(RECONCILE_OVERLAP, 50);
  const { insertActivities } = await import('./sync.ts');
  const on = await trader([{ auth: 'a', accts: [{ k: 'a' }] }]);
  const off = await trader([{ auth: 'a', accts: [{ k: 'a' }] }]);
  // Determinism (a flake seen once in a parallel run): the read stamps are clock_timestamp() at the end of a round's
  // vendor calls, and a round's clock is now() at its transaction start, both shifted by the same shiftAt(h). Rounds
  // exactly 24 h (or 47 h, or 6 h) apart then compare as 24 h plus (the later round's start delay − the earlier round's
  // end delay): a few milliseconds either way, decided by load (a slow listing transaction under parallel files made a
  // read due at h + 24 in one run and h + 25 in the other, so the on/off schedules differed). Each round's clock is moved
  // a further minute per hour, far above any round's duration, so every boundary is crossed by a minute, never by
  // jitter: reads land exactly 24 rounds apart and pages 48 rounds apart, in both runs.
  const roundAt = (t: Trader, b: Mem, h: number) => {
    b.h = h;
    return import('./sync.ts').then(({ syncUser }) => syncUser(t.user, b as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(h) + h * MIN }));
  };
  try {
    const run = async (t: Trader, pass: boolean) => {
      const A = t.id('a');
      const rows = history(t.tag, A, 160, at(-24));
      await insertActivities(t.user.id, 'snaptrade', rows);
      const b = memBroker({ accounts: () => [t.vendor('a', 'a')], history: { [A]: rows }, pageLimit: 100 });
      await roundAt(t, b, 0);
      await due(t, A, pass ? 1 : 100_000);
      const offsets: (number | null)[] = [];
      for (let h = 1; h <= 7 * 24; h++) {
        const pages = b.calls.filter((c) => c.kind === 'page').length;
        await roundAt(t, b, h);
        if (b.calls.filter((c) => c.kind === 'page').length > pages) offsets.push((await cursor(t, A)).reconcile_offset);
      }
      return { A, b, offsets };
    };
    const r1 = await run(on, true);
    const r0 = await run(off, false);
    const pages = r1.b.calls.filter((c) => c.kind === 'page');
    assert.deepEqual(pages.map((c) => c.offset), [0, 50, 100], 'pages at offsets 0, limit - 50, 2 (limit - 50)');
    assert.deepEqual(r1.offsets, [50, 100, null], 'the cursor after each page: 50, 100, then null (ended)');
    for (let i = 1; i < pages.length; i++) {
      assert.ok((pages[i].h - pages[i - 1].h) * HOUR >= RECONCILE_PAGE_GAP_MS, `page ${i} waits 47 h`);
      assert.ok(r1.b.calls.some((c) => c.kind === 'week' && c.h > pages[i - 1].h && c.h < pages[i].h), `a week read between page ${i - 1} and page ${i}`);
    }
    const c = await cursor(on, r1.A);
    assert.equal(c.reconcile_invalid, 0, 'the pass validated');
    assert.equal(c.reconcile_missing, null);
    assert.ok(c.reconcile_due_at >= at(pages[2].h + 7 * 24 - 1), 'the next pass a period after the last page');
    assert.equal(r0.b.calls.filter((x) => x.kind === 'page').length, 0, 'no pass when not due');
    for (const r of [r1, r0]) {
      const acts = r.b.calls.filter((x) => x.kind === 'week' || x.kind === 'page').map((x) => x.h);
      for (let i = 1; i < acts.length; i++) assert.ok(acts[i] - acts[i - 1] >= 24, `activities-endpoint reads 24 h apart (${acts.join(',')})`);
      const moves = r.b.calls.filter((x) => x.kind === 'moves').map((x) => x.h);
      for (let i = 1; i < moves.length; i++) assert.ok(moves[i] - moves[i - 1] >= 24, 'share moves (the same endpoint) 24 h apart');
    }
    const totals = (b: Mem) => ({
      activities: b.calls.filter((x) => x.kind === 'week' || x.kind === 'page').length,
      moves: b.calls.filter((x) => x.kind === 'moves').length,
      positions: b.calls.filter((x) => x.kind === 'positions').length,
    });
    assert.deepEqual(totals(r1.b), totals(r0.b), 'the same vendor calls with the pass on and off');
    assert.deepEqual(r1.b.calls.filter((x) => x.kind !== 'positions').map((x) => x.h), r0.b.calls.filter((x) => x.kind !== 'positions').map((x) => x.h),
      'on the same rounds');
  } finally { await on.cleanup(); await off.cleanup(); }
});

dbTest('AC3: a rolled-back page day leaves the cursor unchanged; a RouteDeadlineError cut leaves no marks, no failure count and the cursor; the pass resumes where it stopped', async () => {
  const t = await trader([{ auth: 'a', accts: [{ k: 'a' }] }]);
  const { insertActivities } = await import('./sync.ts');
  const { RouteDeadlineError } = await import('./sync-limits.ts');
  try {
    const A = t.id('a');
    const rows = history(t.tag, A, 160, at(-24));
    await insertActivities(t.user.id, 'snaptrade', rows);
    const b = memBroker({ accounts: () => [t.vendor('a', 'a')], history: { [A]: rows }, pageLimit: 100 });
    await round(t, b, 0);
    await due(t, A, 1);
    await round(t, b, 25); // page 0
    await round(t, b, 50); // the week
    assert.equal((await cursor(t, A)).reconcile_offset, 50);
    const cur = await cursorText(t, A);

    // h75: page 1 is read, then the rebuild throws: the transaction rolls back.
    const fail = async () => { throw new Error('rebuild failed'); };
    await assert.rejects(round(t, b, 75, fail), /rebuild failed/);
    assert.deepEqual(b.calls.filter((c) => c.kind === 'page').map((c) => c.offset), [0, 50]);
    assert.equal(await cursorText(t, A), cur, 'a rolled-back page day leaves the cursor (offset, page_at, seen, tail) as it was');
    assert.equal(await failures(t, A), 0, 'a failure outside the page step does not count toward giving the pass up');

    // h82 (past the 6 h floor F-14 keeps after h75's read; h81 is a few ms short of it): the page is read, then the route's deadline cuts the sync.
    const marks = await marksText(t, A);
    b.positionsError = () => new RouteDeadlineError();
    await assert.rejects(round(t, b, 82), (e: Error) => e.name === 'RouteDeadlineError');
    b.positionsError = null;
    assert.deepEqual(b.calls.filter((c) => c.kind === 'page').map((c) => c.offset), [0, 50, 50]);
    assert.equal(await marksText(t, A), marks, 'a cut leaves no marks');
    assert.equal(await failures(t, A), 0, 'and no failure count');
    assert.equal(await cursorText(t, A), cur, 'and the cursor');

    // h83: the cut comes on the page request itself.
    b.pageError = () => new RouteDeadlineError();
    await assert.rejects(round(t, b, 83), (e: Error) => e.name === 'RouteDeadlineError');
    b.pageError = null;
    assert.equal(await marksText(t, A), marks);
    assert.equal(await failures(t, A), 0);
    assert.equal(await cursorText(t, A), cur);

    // h84: the next call resumes at offset 50.
    await round(t, b, 84);
    assert.deepEqual(b.calls.filter((c) => c.kind === 'page').map((c) => c.offset), [0, 50, 50, 50, 50]);
    assert.equal((await cursor(t, A)).reconcile_offset, 100);
  } finally { await t.cleanup(); }
});

dbTest('AC3: a first page that always throws a TypeError: after 2 failed syncs the pass is given up (reason failures, reconcile_invalid + 1) and the week read resumes', async () => {
  const t = await trader([{ auth: 'a', accts: [{ k: 'a' }] }]);
  const { insertActivities } = await import('./sync.ts');
  try {
    const A = t.id('a');
    const rows = history(t.tag, A, 20, at(-24));
    await insertActivities(t.user.id, 'snaptrade', rows);
    const b = memBroker({ accounts: () => [t.vendor('a', 'a')], history: { [A]: rows }, pageLimit: 100 });
    await round(t, b, 0);
    await due(t, A, 1);
    b.pageError = () => new TypeError('bad row');
    await assert.rejects(round(t, b, 25), TypeError);
    assert.equal(await failures(t, A), 1);
    await assert.rejects(round(t, b, 26), TypeError);
    assert.equal(await failures(t, A), 2);
    b.calls.length = 0;
    const { lines } = await logged(() => round(t, b, 27));
    assert.deepEqual(b.calls.filter((c) => c.kind === 'page').length, 0, 'the pass is not tried a third time');
    assert.deepEqual(b.calls.filter((c) => c.kind === 'week').map((c) => c.id), [A], 'the week read resumes');
    assert.ok(lines.includes(`sync reconcile invalid ${t.user.id} ${JSON.stringify({ reason: 'failures' })}`), lines.join('\n'));
    const c = await cursor(t, A);
    assert.equal(c.reconcile_invalid, 1);
    assert.equal(c.reconcile_offset, null);
    assert.ok(c.reconcile_due_at >= at(27 + 7 * 24 - 1), 'the next pass a period later');
    assert.equal(await failures(t, A), 0, 'the count is reset');
  } finally { await t.cleanup(); }
});

dbTest('AC3: a later page that always throws a TypeError: after 2 failed syncs the pass is given up (reason failures) and the week read resumes', async () => {
  const t = await trader([{ auth: 'a', accts: [{ k: 'a' }] }]);
  const { insertActivities } = await import('./sync.ts');
  try {
    const A = t.id('a');
    const rows = history(t.tag, A, 160, at(-24));
    await insertActivities(t.user.id, 'snaptrade', rows);
    const b = memBroker({ accounts: () => [t.vendor('a', 'a')], history: { [A]: rows }, pageLimit: 100 });
    await round(t, b, 0);
    await due(t, A, 1);
    await round(t, b, 25);
    assert.equal((await cursor(t, A)).reconcile_offset, 50);
    b.pageError = (_id, offset) => (offset > 0 ? new TypeError('bad row') : null);
    await assert.rejects(round(t, b, 75), TypeError);
    assert.equal(await failures(t, A), 1);
    await assert.rejects(round(t, b, 76), TypeError);
    assert.equal(await failures(t, A), 2);
    b.calls.length = 0;
    const { lines } = await logged(() => round(t, b, 77));
    assert.equal(b.calls.filter((c) => c.kind === 'page').length, 0, 'given up: no third try');
    assert.deepEqual(b.calls.filter((c) => c.kind === 'week').map((c) => c.id), [A], 'the week read resumes');
    assert.ok(lines.includes(`sync reconcile invalid ${t.user.id} ${JSON.stringify({ reason: 'failures' })}`), lines.join('\n'));
    const c = await cursor(t, A);
    assert.equal(c.reconcile_invalid, 1);
    assert.equal(c.reconcile_offset, null);
    assert.equal(c.reconcile_seen, null, 'its listed ids dropped');
    assert.equal(c.reconcile_tail, null);
    assert.equal(await failures(t, A), 0);
  } finally { await t.cleanup(); }
});

// ---------------------------------------------------------------------------------------------------------------- AC4

dbTest('AC4: frozen, unlisted, paper and unconsented accounts with a due pass are never read; one that leaves the read set mid-pass has its pass state cleared on the next sync', async () => {
  // Connection a: live account a (small history), account c (the vendor later stops listing it) and paper account p.
  // Connection b: account b (frozen mid-pass). Account u: listed by the vendor under an authorization nobody consented.
  const t = await trader([{ auth: 'a', accts: [{ k: 'a' }, { k: 'c' }, { k: 'p', paper: true }] }, { auth: 'b', accts: [{ k: 'b' }] }]);
  const { insertActivities } = await import('./sync.ts');
  try {
    const [A, B, C, P, U] = ['a', 'b', 'c', 'p', 'u'].map(t.id);
    const hist: Record<string, Row[]> = {
      [A]: history(`${t.tag}-a`, A, 10, at(-24)),
      [B]: history(`${t.tag}-b`, B, 160, at(-24)),
      [C]: history(`${t.tag}-c`, C, 160, at(-24)),
      [P]: history(`${t.tag}-p`, P, 10, at(-24)),
      [U]: history(`${t.tag}-u`, U, 10, at(-24)),
    };
    await insertActivities(t.user.id, 'snaptrade', [...hist[A], ...hist[B], ...hist[C]]);
    let listC = true;
    const b = memBroker({
      accounts: () => [t.vendor('a', 'a'), ...(listC ? [t.vendor('c', 'a')] : []), t.vendor('p', 'a', true), t.vendor('b', 'b'), t.vendor('u', 'z')],
      history: hist, pageLimit: 100,
    });
    await t.sql`insert into broker_accounts (account_id, user_id) values (${U}, ${t.user.id})`; // a claim that has no consent now
    await round(t, b, 0);
    assert.ok((await t.sql`select is_paper from broker_accounts where account_id = ${P}`)[0].is_paper, 'p is claimed as paper');
    for (const id of [A, B, C]) await due(t, id, 1);
    await round(t, b, 25);
    assert.deepEqual(b.calls.filter((c) => c.kind === 'page').map((c) => c.id).sort(), [A, B, C].sort(), 'h25: each live account reads its pass page');
    for (const id of [B, C]) {
      const c = await cursor(t, id);
      assert.equal(c.reconcile_offset, 50, 'mid-pass');
      assert.ok(c.reconcile_seen?.length && c.reconcile_tail?.length);
    }
    // b's connection is frozen (TR-5) and the vendor stops listing c; p and u carry a running pass too.
    await t.sql`update connections set disconnected_at = now() where id = ${t.connIds.b}`;
    listC = false;
    await t.sql`update broker_accounts set reconcile_offset = 50, reconcile_seen = ${[`${t.tag}-x`]}, reconcile_tail = ${[`${t.tag}-x`]}, reconcile_pages = 1
      where account_id in ${t.sql([P, U])}`;
    const mark = b.calls.length;
    await round(t, b, 26); // the trader's next sync (a is still live)
    for (const id of [B, C, P, U]) {
      const c = await cursor(t, id);
      assert.deepEqual([c.reconcile_offset, c.reconcile_seen, c.reconcile_tail], [null, null, null], `${id}: its pass state and listed ids are cleared`);
    }
    // Each now has a due pass; a week of daily rounds reads none of them.
    for (const id of [B, C, P, U]) await due(t, id, 27);
    for (const h of [50, 75, 100, 125, 150]) await round(t, b, h);
    const unread = b.calls.slice(mark).filter((c) => [B, C, P, U].includes(c.id));
    assert.deepEqual(unread, [], 'no vendor call of any kind for a frozen, unlisted, paper or unconsented account');
    assert.ok(b.calls.slice(mark).some((c) => c.id === A && (c.kind === 'week' || c.kind === 'page')), 'the live account is still read');
    for (const id of [B, C, P, U]) assert.equal((await cursor(t, id)).reconcile_offset, null, `${id}: no pass started`);
  } finally { await t.cleanup(); }
});
