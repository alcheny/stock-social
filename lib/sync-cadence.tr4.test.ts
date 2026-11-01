// F-14 × OPTIONS review (B1, B2; TR-4, no vanishing losses), through syncUser with `cadence` on a shifted database
// clock and an in-memory broker in the vendor's shapes:
// B1: a positions-only read never removes an open option position; it goes with the read that imports its close.
// B2: a backfill history page is not the account's recent week, so its positions take the positions-only rule: a share
//     position sold while the backfill runs stays listed (even unlisted past 3 days) until its sell is imported.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000, DAY = 24 * HOUR;
const base = Date.now() - 40 * DAY; // the test's clock: 40 days ago, shifted per round
const shiftAt = (h: number) => base + h * HOUR - Date.now();
const iso = (h: number) => new Date(base + h * HOUR).toISOString();

async function trader(backfilled: boolean) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `tr${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const acc = { id: `${tag}-a`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true };
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts, options_backfilled_at)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json([acc])},
      ${backfilled ? sql`now()` : null} from users where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id = ${acc.id}`; };
  return { sql, tag, user, acc, cleanup };
}

dbTest('B1: an open option position stays through positions-only reads after the vendor stops listing it, and goes with the read that imports its close', async () => {
  const t = await trader(true);
  const { syncUser } = await import('./sync.ts');
  const { toOptionRows, splitPositionKinds } = await import('./broker.ts');
  try {
    const os = { id: 'o', ticker: 'XYZ   271217C00123450', option_type: 'CALL', strike_price: 123.45, expiration_date: '2027-12-17', underlying_symbol: { symbol: 'XYZ', type: { code: 'cs' } } };
    const buy = { id: `${t.tag}-ob`, type: 'BUY', option_type: 'BUY_TO_OPEN', option_symbol: os, units: 1, price: 2, fee: 0, trade_date: iso(-240) };
    const sell = { id: `${t.tag}-os`, type: 'SELL', option_type: 'SELL_TO_CLOSE', option_symbol: os, units: 1, price: 1, fee: 0, trade_date: iso(2) }; // sold at a loss
    const position = { instrument: { kind: 'option', id: 'i', symbol: 'XYZ   271217C00123450', option_type: 'CALL', strike_price: '123.45', expiration_date: '2027-12-17', multiplier: '100',
      underlying: { kind: 'stock', id: 'u', symbol: 'XYZ', raw_symbol: 'XYZ' } }, units: '1', price: '1.5', cost_basis: '2' };
    let hour = 0;
    const broker = {
      listAccounts: async () => [t.acc],
      fetchActivities: async (_u: unknown, _s: Date, ids?: string[], sink?: (r: unknown[]) => void) => {
        for (const id of ids ?? []) sink?.(toOptionRows(id, (hour >= 2 ? [buy, sell] : [buy]) as never));
        return [];
      },
      fetchPositions: async (_u: unknown, _id: string, sink?: (s: unknown) => void) => {
        sink?.(splitPositionKinds(hour >= 2 ? [] : [position as never]).split);
        return [];
      },
    };
    const state = async () => {
      const [r] = await t.sql`select (select count(*)::int from open_option_positions where user_id = ${t.user.id}) as open,
        (select count(*)::int from option_trades where user_id = ${t.user.id}) as trades`;
      return [r.open, r.trades];
    };
    const reports: { activitiesRead: number; positionsRead: number }[] = [];
    const round = async (h: number) => {
      hour = h;
      await syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(h), report: (r) => reports.push(r) });
    };
    await round(0);
    assert.deepEqual(await state(), [1, 0], 'h0: read with activities, the option is open');
    for (const h of [7, 14]) {
      await round(h);
      assert.deepEqual(reports.at(-1), { accounts: 1, activitiesRead: 0, positionsRead: 1, deferred: 0, rebuilt: false }, `h${h}: positions only`);
      assert.deepEqual(await state(), [1, 0], `h${h}: unlisted, its close not imported: still open, never missing from both lists`);
    }
    await round(25);
    assert.equal(reports.at(-1)!.activitiesRead, 1);
    assert.deepEqual(await state(), [0, 1], 'h25: the close is imported and the open option goes in the same read');
  } finally { await t.cleanup(); }
});

dbTest('B2: during a multi-day option backfill a sold share position stays listed (past 3 days unlisted) until the week read imports its sell; "Updated" waits for the backfill', async () => {
  const t = await trader(false);
  const { syncUser, insertActivities } = await import('./sync.ts');
  try {
    // Stored share history (so the hourly path runs) and a connection still owed its option backfill: 10 pages of 1 row.
    await insertActivities(t.user.id, 'snaptrade', [{ externalId: `${t.tag}-b`, accountId: t.acc.id, symbol: 'XX', side: 'BUY', units: 1, price: 10, fee: 0, executedAt: new Date(base - 20 * DAY), verified: true, raw: {} }]);
    const PAGES = 10;
    let sold = false, weekReads = 0;
    const broker = {
      pageLimit: 1,
      listAccounts: async () => [t.acc],
      fetchActivities: async () => {
        weekReads++;
        return sold ? [{ externalId: `${t.tag}-s`, accountId: t.acc.id, symbol: 'XX', side: 'SELL' as const, units: 1, price: 8, fee: 0, executedAt: new Date(base + 1 * DAY + HOUR), verified: true, raw: {} }] : [];
      },
      fetchActivitiesPage: async (_u: unknown, _id: string, offset: number, limit = 1) => ({ activities: [], done: offset + limit >= PAGES }),
      fetchPositions: async () => (sold ? [] : [{ symbol: 'XX', unrealizedPct: -0.2 }]),
    };
    const state = async () => {
      const [r] = await t.sql`select (select count(*)::int from open_positions where user_id = ${t.user.id} and symbol = 'XX') as open,
        (select count(*)::int from closed_trades where user_id = ${t.user.id} and symbol = 'XX') as closed,
        (select last_synced_at from users where id = ${t.user.id}) as synced`;
      return r;
    };
    const day = (d: number) => syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(d * 25) });
    await day(0);
    assert.equal((await state()).open, 1);
    const synced0 = (await state()).synced;
    sold = true; // sold on day 1; the vendor stops listing it, the sell is only in the week read
    for (let d = 1; d <= 5; d++) {
      if (d === 3) await t.sql`update open_positions set fetched_at = now() - interval '4 days' where user_id = ${t.user.id}`; // unlisted past 3 days
      await day(d);
      const s = await state();
      assert.deepEqual([s.open, s.closed], [1, 0], `day ${d}: the backfill page read, not the week: never missing from both lists`);
      assert.deepEqual(s.synced, synced0, `day ${d}: "Updated" stays while the recent week is unread`);
    }
    assert.equal(weekReads, 0);
    for (let d = 6; d <= PAGES + 1; d++) await day(d); // the backfill finishes; the next daily read is the week
    const s = await state();
    assert.ok(weekReads >= 1);
    assert.deepEqual([s.open, s.closed], [0, 1], 'the week read imports the sell: the position goes with its closed trade');
    assert.ok(s.synced && (!synced0 || s.synced > synced0), '"Updated" moves once the week is read');
  } finally { await t.cleanup(); }
});
