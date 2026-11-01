// F-24 code review regressions (lib/reconcile.ts): each test fails on the code before the review fixes.
// 1. a multi-page pass whose pages hold an unusable trade row (no price: corporate_actions) early on page 1 and an option
//    row inside page 1's last RECONCILE_OVERLAP rows stays valid and decides (the overlap counts every vendor row);
// 2. an account with few share rows and many stored option rows is not given up for 'bound' (the bound counts them);
// 3. a pass given up while a pending row exists waits its period: the next day's sync reads the week;
// 4. pageFailureCounts: outage, timeout, serialization and connection codes never count; a refusal or a bug does;
// 5. firstDue: on the account's hashed weekday, at 00:00 UTC (whatever the session's time zone), never before
//    claimed_at + 7 d;
// 6. dropUnread clears reconcile_missing for an account no longer read.
// The in-memory vendor returns vendor-shaped rows through lib/broker.ts#toActivities and #toOptionRows, as the real
// fetchActivitiesPage and fetchActivities do.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageFailureCounts } from './reconcile.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 180_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000, DAY = 24 * HOUR;
const base = Date.now() - 40 * DAY; // the test's clock: 40 days ago, shifted per round
const shiftAt = (h: number) => base + h * HOUR - Date.now();
const at = (d: number) => new Date(base + d * DAY); // a trade date, days from the test clock's start

// A vendor activity row as the SDK returns it (the fields lib/broker.ts reads).
type VRow = { id: string; symbol: { symbol: string } | null; type: string; units?: number; price?: number; fee?: number; trade_date: string;
  option_type?: string; option_symbol?: unknown };

async function trader() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { syncUser, insertActivities } = await import('./sync.ts');
  const { rebuildRecord, insertOptionActivities } = await import('./options-sync.ts');
  const { toActivities, toOptionRows } = await import('./broker.ts');
  const tag = `rv${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const acc = { id: `${tag}-a`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true };
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json([acc])}, now()
    from users where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  const share = (id: string, side: 'BUY' | 'SELL', units: number, price: number, date: Date, symbol = 'XX'): VRow =>
    ({ id: `${tag}-${id}`, symbol: { symbol }, type: side, units, price, fee: 0, trade_date: date.toISOString() });
  // A share trade row with no price: toActivities returns it in `unusable` (lib/corporate-actions.ts#unusableTrade).
  const unpriced = (id: string, date: Date): VRow => ({ id: `${tag}-${id}`, symbol: { symbol: 'UU' }, type: 'BUY', units: 3, trade_date: date.toISOString() });
  // An option row (BUY_TO_OPEN with a contract): toOptionRows returns it, toActivities skips it.
  const option = (id: string, date: Date): VRow => ({
    id: `${tag}-${id}`, symbol: null, type: 'BUY', units: 1, price: 2, fee: 0, trade_date: date.toISOString(), option_type: 'BUY_TO_OPEN',
    option_symbol: { ticker: 'OPT 260116C00010000', option_type: 'CALL', strike_price: 10, expiration_date: '2026-01-16', is_mini_option: false,
      underlying_symbol: { symbol: 'OPT', type: { code: 'cs' } } },
  });
  const v = { list: [] as VRow[], weekCalls: 0, pageCalls: [] as number[] };
  type Sink = (rows: ReturnType<typeof toOptionRows>) => void;
  const broker = {
    pageLimit: undefined as number | undefined,
    listAccounts: async () => [acc],
    fetchActivities: async (_u: unknown, since: Date, ids?: string[], sink?: Sink) => {
      v.weekCalls++;
      const rows = (ids ?? []).includes(acc.id) ? v.list.filter((r) => new Date(r.trade_date) >= since) : [];
      sink?.(toOptionRows(acc.id, rows as never));
      return toActivities(acc.id, rows);
    },
    fetchActivitiesPage: async (_u: unknown, id: string, offset: number, limit = 1000, sink?: Sink) => {
      v.pageCalls.push(offset);
      const slice = (id === acc.id ? v.list : []).slice(offset, offset + limit);
      sink?.(toOptionRows(id, slice as never));
      return { ...toActivities(id, slice), done: slice.length < limit };
    },
  };
  const round = (h: number) => syncUser(user, broker as never, (id, tx) => rebuildRecord(id, tx), undefined, { cadence: true, shiftMs: shiftAt(h) });
  const store = (rows: VRow[]) => insertActivities(user.id, 'snaptrade', toActivities(acc.id, rows).activities);
  const storeOptions = (rows: VRow[]) => insertOptionActivities(user.id, 'snaptrade', toOptionRows(acc.id, rows as never));
  const due = (when: string | null = '2000-01-01') => sql`update broker_accounts set reconcile_due_at = ${when} where account_id = ${acc.id}`;
  const state = async (id: string) => (await sql`select state from activity_reissues where source = 'snaptrade' and external_id = ${`${tag}-${id}`}`)[0]?.state ?? null;
  const cursor = async () => (await sql`select reconcile_offset, reconcile_due_at, reconcile_invalid, reconcile_missing, reconcile_valid
    from broker_accounts where account_id = ${acc.id}`)[0];
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id = ${acc.id}`; };
  return { sql, tag, user, acc, v, broker, share, unpriced, option, round, store, storeOptions, due, state, cursor, cleanup };
}

// Captures the 'sync reconcile invalid' lines written while fn runs.
async function invalidLogs(fn: () => Promise<unknown>): Promise<string[]> {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { if (a[0] === 'sync reconcile invalid') logs.push(String(a[2])); };
  try { await fn(); } finally { console.log = orig; }
  return logs;
}

dbTest('1: an unusable row early on page 1 and an option row in its last 50 rows keep a multi-page pass valid; it decides', async () => {
  const t = await trader();
  try {
    const b1 = t.share('b1', 'BUY', 20, 10, at(-40));
    const e = t.share('e', 'SELL', 10, 12, at(-30));
    const n = t.share('n', 'SELL', 10, 12, at(-30)); // E re-issued as N
    const fill = Array.from({ length: 61 }, (_, i) => t.share(`f${i}`, 'BUY', 1, 5, at(-15 + i / 100), 'FL'));
    await t.store([b1, e, ...fill]);
    t.v.list = [b1, e, ...fill];
    t.broker.pageLimit = 60;
    await t.round(0); // claims the account (a week read)
    // 65 vendor rows: B1, a filler, U (no price) at 2, N at 3, fillers, an option row at 55 (inside page 1's last 50),
    // fillers. Page 1 is rows 0..59; page 2 starts 50 back (offset 10) and lists rows 10..64 (55 < 60: done).
    const u = t.unpriced('u', at(-35)), o = t.option('o', at(-14));
    const list = [b1, fill[0], u, n, ...fill.slice(1, 52), o, ...fill.slice(52)];
    assert.equal(list.length, 65);
    assert.equal(list.indexOf(o), 55);
    t.v.list = list;
    await t.due();
    const logs = await invalidLogs(async () => {
      await t.round(25);
      assert.deepEqual(t.v.pageCalls, [0]);
      assert.equal(await t.state('n'), 'pending', 'N held after page 1');
      assert.equal((await t.sql`select count(*)::int as n from corporate_actions where external_id = ${u.id}`)[0].n, 1, 'U stored as an unusable trade row');
      assert.equal((await t.sql`select count(*)::int as n from option_activities where external_id = ${o.id}`)[0].n, 1, 'the option row stored');
      await t.round(75);
    });
    assert.deepEqual(t.v.pageCalls, [0, 10]);
    assert.deepEqual(logs, [], 'never given up');
    assert.equal(await t.state('n'), 'suspected', 'the valid pass decided');
    const cur = await t.cursor();
    assert.equal(cur.reconcile_offset, null, 'the pass ended');
    assert.equal(cur.reconcile_invalid, 0);
  } finally { await t.cleanup(); }
});

dbTest('2: few share rows and many stored option rows: the pass is not given up for the page bound and reaches the end', async () => {
  const t = await trader();
  try {
    // 100 option rows first, then 5 share buys: 105 vendor rows, pageLimit 60 (step 10) → 6 pages (offsets 0..50).
    // A bound on the 5 share rows alone is ceil(5/10) + 2 = 3 pages.
    const opts = Array.from({ length: 100 }, (_, i) => t.option(`o${i}`, at(-60 + i / 10)));
    const shares = Array.from({ length: 5 }, (_, i) => t.share(`s${i}`, 'BUY', 1, 5, at(-5 + i / 10)));
    await t.store(shares);
    await t.storeOptions(opts);
    t.v.list = [...opts, ...shares];
    t.broker.pageLimit = 60;
    await t.round(0);
    await t.due();
    const logs = await invalidLogs(async () => {
      for (let k = 0; k < 6; k++) await t.round(25 + 50 * k);
    });
    assert.deepEqual(t.v.pageCalls, [0, 10, 20, 30, 40, 50], 'every page read');
    assert.deepEqual(logs, [], 'not given up (bound or otherwise)');
    const cur = await t.cursor();
    assert.equal(cur.reconcile_offset, null, 'the pass ended');
    assert.equal(cur.reconcile_invalid, 0, 'a deciding end');
    const dueAt = (cur.reconcile_due_at as Date).getTime();
    const end = base + (25 + 250) * HOUR;
    assert.ok(Math.abs(dueAt - (end + 7 * DAY)) < 10 * 60_000, 'the next pass a period after the end');
  } finally { await t.cleanup(); }
});

dbTest('3: a pass given up while a pending row exists waits its period: the next day reads the week, no page', async () => {
  const t = await trader();
  try {
    const b1 = t.share('b1', 'BUY', 20, 10, at(-30));
    const e = t.share('e', 'SELL', 10, 12, at(-20));
    const n = t.share('n', 'SELL', 10, 12, at(-20));
    const x = t.share('x', 'BUY', 1, 5, at(-25), 'YY'); // stored; the vendor never lists it
    await t.store([b1, e, x]);
    t.v.list = [b1, e];
    await t.round(0);
    t.v.list = [b1, n];
    await t.due();
    const logs = await invalidLogs(() => t.round(25));
    assert.deepEqual(logs, ['{"reason":"missing"}'], 'given up');
    assert.equal(t.v.pageCalls.length, 1);
    assert.equal(await t.state('n'), 'pending');
    const dueAt = ((await t.cursor()).reconcile_due_at as Date).getTime();
    const t25 = base + 25 * HOUR;
    assert.ok(dueAt > t25 + 7 * DAY - 10 * 60_000 && dueAt < t25 + 7 * DAY + 10 * 60_000, 'due about 7 days later, not brought forward');
    const weeks = t.v.weekCalls;
    await t.round(50);
    assert.equal(t.v.weekCalls, weeks + 1, 'the week read');
    assert.equal(t.v.pageCalls.length, 1, 'no page call');
    assert.ok(Math.abs(((await t.cursor()).reconcile_due_at as Date).getTime() - dueAt) < 1000, 'the due date unchanged');
  } finally { await t.cleanup(); }
});

test('4: pageFailureCounts: outages, timeouts and connection or serialization codes never count; a refusal or a bug does', () => {
  assert.equal(pageFailureCounts(new TypeError('x is undefined')), true, 'a bug counts');
  assert.equal(pageFailureCounts({ status: 400 }), true, 'a refusal counts');
  for (const e of [{ status: 503 }, { status: 429 }, { name: 'RouteDeadlineError' }, { code: 'ECONNRESET' }, { code: '57014' }, { code: '40001' },
    { code: '40P01' }, { code: 'CONNECTION_CLOSED' }, { code: 'UND_ERR_SOCKET' }, { code: '08P01' }]) {
    assert.equal(pageFailureCounts(e), false, `${JSON.stringify(e)} does not count`);
  }
});

dbTest('5: firstDue: the hashed weekday at 00:00 UTC within 7 days of the clock, never before claimed_at + 7 d (any session time zone)', async () => {
  const t = await trader();
  const { plannedPages } = await import('./reconcile.ts');
  try {
    await t.store([t.share('b1', 'BUY', 1, 5, at(-3))]);
    await t.round(0); // claims the account
    const clock = new Date(base + 25 * HOUR + 17 * 60_000); // not a day start
    const check = async (claimed: Date, label: string) => {
      await t.sql`update broker_accounts set reconcile_due_at = null, claimed_at = ${claimed} where account_id = ${t.acc.id}`;
      await t.sql.begin(async (tx) => {
        await tx`set local time zone 'America/Los_Angeles'`;
        await plannedPages(tx, t.user.id, [t.acc.id], tx`${clock}::timestamptz`);
      });
      const [r] = await t.sql`select reconcile_due_at as due,
          mod(extract(epoch from reconcile_due_at)::numeric, 86400) = 0 as midnight,
          mod(floor(extract(epoch from reconcile_due_at) / 86400)::bigint, 7) = ((hashtext(account_id) % 7) + 7) % 7 as weekday,
          reconcile_due_at >= greatest(claimed_at + interval '7 days', ${clock}::timestamptz) as not_early,
          reconcile_due_at < greatest(claimed_at + interval '7 days', ${clock}::timestamptz) + interval '7 days' as within
        from broker_accounts where account_id = ${t.acc.id}`;
      assert.ok(r.due, `${label}: a due date written`);
      assert.equal(r.midnight, true, `${label}: 00:00 UTC`);
      assert.equal(r.weekday, true, `${label}: on the account's weekday`);
      assert.equal(r.not_early, true, `${label}: never before max(claimed_at + 7 d, clock)`);
      assert.equal(r.within, true, `${label}: the first such day`);
    };
    await check(new Date(clock.getTime() - 30 * DAY), 'claimed long ago');
    const [{ w }] = await t.sql`select (r.due_at - ${clock}::timestamptz) < interval '7 days' as w from (select reconcile_due_at as due_at from broker_accounts where account_id = ${t.acc.id}) r`;
    assert.equal(w, true, 'claimed long ago: within 7 days of the clock');
    await check(new Date(clock.getTime() - 2 * DAY + 5 * HOUR), 'claimed recently');
  } finally { await t.cleanup(); }
});

dbTest('6: dropUnread clears reconcile_missing for an account no longer read', async () => {
  const t = await trader();
  const { dropUnread } = await import('./reconcile.ts');
  try {
    await t.store([t.share('b1', 'BUY', 1, 5, at(-3))]);
    await t.round(0);
    await t.sql`update broker_accounts set reconcile_offset = null, reconcile_tail = null, reconcile_seen = null, reconcile_missing = ${[`${t.tag}-x`]}
      where account_id = ${t.acc.id}`;
    await t.sql.begin((tx) => dropUnread(tx, t.user.id, []));
    assert.equal((await t.cursor()).reconcile_missing, null, 'the listed ids of an account no longer read are dropped');
    // A real account keeps its shortfall.
    await t.sql`update broker_accounts set reconcile_missing = ${[`${t.tag}-x`]} where account_id = ${t.acc.id}`;
    await t.sql.begin((tx) => dropUnread(tx, t.user.id, [t.acc.id]));
    assert.deepEqual((await t.cursor()).reconcile_missing, [`${t.tag}-x`]);
  } finally { await t.cleanup(); }
});
