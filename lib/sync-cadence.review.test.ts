// F-14 code-review fixes (docs/features/logs/F-14/committee-2026-11-01.md, after the build): per-account activities
// reads marked as they return; a combined read removes a vanished position only once its sell is imported (or after 3
// days unlisted); coverage counts only accounts still read; a future connected_at never turns the throttle off.
// syncUser is called directly with `cadence` and a shifted database clock; an in-memory broker counts the vendor calls.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 60_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const HOUR = 3_600_000;
// A trader with a connected connection (consented long before the test's clock) listing `n` real accounts.
async function trader(n: number) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `cr${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const accs = Array.from({ length: n }, (_, i) => ({ id: `${tag}-a${i}`, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }));
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now() - interval '400 days', now() - interval '400 days', ${sql.json(accs)} from users where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id in ${sql(accs.map((a) => a.id))}`; };
  return { sql, tag, user, accs, cleanup };
}
const act = (tag: string, id: string, accountId: string, symbol: string, side: 'BUY' | 'SELL', price: number, at: Date) => ({
  externalId: `${tag}-${id}`, accountId, symbol, side, units: 1, price, fee: 0, executedAt: at, verified: true, raw: {},
});
// The test's clock: `days` days in the past plus `h` hours (the database clock shifted).
const base = Date.now() - 30 * 86_400_000;
const shiftAt = (h: number) => base + h * HOUR - Date.now();

dbTest('review 1: a multi-account activities read that fails on its second account still marks the first, so its 6 h floor holds across retries', async () => {
  const t = await trader(2);
  const { syncUser } = await import('./sync.ts');
  try {
    const calls = new Map<string, number>();
    const broker = {
      listAccounts: async () => t.accs,
      fetchActivities: async (_u: unknown, _s: Date, ids?: string[]) => {
        for (const id of ids ?? []) {
          calls.set(id, (calls.get(id) ?? 0) + 1);
          if (id === t.accs[1].id) throw Object.assign(new Error('upstream'), { status: 503 });
        }
        return [];
      },
    };
    // Backoff-like retries at 0, 1, 3, 7 and 15 h: the first account is read at 0 and again only after its 6 h floor.
    for (const h of [0, 1, 3, 7, 15]) {
      await assert.rejects(syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(h) }));
    }
    assert.equal(calls.get(t.accs[0].id), 3, 'first account: 0, 7 and 15 h (the floor), never at 1 or 3 h');
  } finally { await t.cleanup(); }
});

dbTest('review 2 (TR-4): a combined read keeps a position the vendor stopped listing until its sell is imported; a position unlisted for 3 days without a sell goes', async () => {
  const t = await trader(1);
  const { syncUser } = await import('./sync.ts');
  const acc = t.accs[0].id;
  try {
    const at = (h: number) => new Date(base + h * HOUR);
    let positions = [{ symbol: 'ZZZ', unrealizedPct: -20 }, { symbol: 'TTT', unrealizedPct: 5 }];
    let acts = [act(t.tag, 'b1', acc, 'ZZZ', 'BUY', 100, at(-48)), act(t.tag, 'b2', acc, 'TTT', 'BUY', 100, at(-48))];
    const broker = { listAccounts: async () => t.accs, fetchActivities: async () => acts, fetchPositions: async () => positions };
    const open = async () => (await t.sql`select symbol from open_positions where user_id = ${t.user.id} order by symbol`).map((r) => r.symbol);
    const closed = async () => (await t.sql`select symbol from closed_trades where user_id = ${t.user.id}`).map((r) => r.symbol);
    await syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(0) });
    assert.deepEqual(await open(), ['TTT', 'ZZZ']);
    // Day 1: the vendor's holdings already dropped ZZZ, but its sell is not posted yet: ZZZ stays listed.
    positions = [{ symbol: 'TTT', unrealizedPct: 6 }];
    await syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(25) });
    assert.deepEqual(await open(), ['TTT', 'ZZZ'], 'kept: no sell imported since it was last listed');
    assert.deepEqual(await closed(), []);
    // Day 2: the sell is posted: the closed trade is published and the position goes in the same sync.
    acts = [...acts, act(t.tag, 's1', acc, 'ZZZ', 'SELL', 80, at(30))];
    await syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(50) });
    assert.deepEqual(await open(), ['TTT']);
    assert.deepEqual(await closed(), ['ZZZ']);
    // A transfer out: TTT stops being listed with no sell; it goes once unlisted for 3 days.
    positions = [];
    await syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(75) });
    assert.deepEqual(await open(), ['TTT'], 'one day unlisted: kept');
    await t.sql`update open_positions set fetched_at = now() - interval '4 days' where user_id = ${t.user.id}`;
    await syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(100) });
    assert.deepEqual(await open(), [], 'unlisted past 3 days: removed');
  } finally { await t.cleanup(); }
});

dbTest('review 3: coverage counts only accounts still read (a disconnected connection\'s accounts are not stale alarms)', async () => {
  const t = await trader(1);
  const { coverage } = await import('./sync-shard.ts');
  try {
    await t.sql`insert into broker_accounts (account_id, user_id, confirmed_at) values (${t.accs[0].id}, ${t.user.id}, now())`;
    await t.sql`update broker_accounts set activities_read_at = now() - interval '40 hours', positions_read_at = now() - interval '40 hours' where account_id = ${t.accs[0].id}`;
    const scope = { ids: [t.user.id] };
    let c = await coverage(1, scope, undefined, () => {});
    assert.equal(c.realAccounts, 1);
    assert.equal(c.freshnessAlarm, true);
    await t.sql`update connections set disconnected_at = now() where user_id = ${t.user.id}`;
    c = await coverage(1, scope, undefined, () => {});
    assert.equal(c.realAccounts, 0, 'a frozen (TR-5) record is not read again and not counted');
    assert.equal(c.freshnessAlarm, false);
  } finally { await t.cleanup(); }
});

dbTest('review 4: a connected_at ahead of the database clock never turns the throttle off', async () => {
  const t = await trader(1);
  const { syncUser } = await import('./sync.ts');
  try {
    let reads = 0;
    const broker = { listAccounts: async () => t.accs, fetchActivities: async () => { reads++; return []; } };
    await syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(0) });
    assert.equal(reads, 1);
    // A skewed connected_at days ahead of the (shifted) database clock.
    await t.sql`update connections set connected_at = now() + interval '3 days' where user_id = ${t.user.id}`;
    for (const h of [1, 2, 3]) await syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(h) });
    assert.equal(reads, 1, 'no re-read every hour');
  } finally { await t.cleanup(); }
});

// Orchestrator review: the production (cadence) path's guard, one account per call: a sync cut at the route's end after
// its first account's read leaves no marks, so the next call reads both accounts at once instead of waiting 6 h.
dbTest('review 5: a cadence sync cut by the route-end guard mid-read leaves no marks and is read in full by the next call', async () => {
  const t = await trader(2);
  const { runShard } = await import('./sync-shard.ts');
  try {
    const of = 1013 + Math.floor(Math.random() * 6); // its own range (lib/sync-cadence.db.test.ts lists the split)
    let wall = 1_000_000;
    const calls: string[] = [];
    const broker = {
      listAccounts: async () => t.accs,
      // The first account's read is slow: afterwards only 35 s are left, so the second account's 30 s call (plus the 10 s margin) is refused.
      fetchActivities: async (_u: unknown, _s: Date, ids?: string[]) => { calls.push(ids![0]); if (ids![0] === t.accs[0].id) wall += 65_000; return []; },
      fetchPositions: async () => [],
    };
    const shard = { shard: t.user.id % of, of };
    const cfg = { concurrency: 1, rps: 1000, burst: 1000, page: 500 };
    const r = await runShard({ shard, ids: [t.user.id], shiftMs: shiftAt(0), jitterMs: 0, config: cfg, log: () => {},
      broker: broker as never, clock: () => wall, routeEnd: wall + 100_000, vendorBoundMs: 30_000 });
    assert.equal(r.cutAtDeadline, 1, JSON.stringify(r));
    assert.deepEqual(calls, [t.accs[0].id], 'the second account\'s call never started');
    assert.equal((await t.sql`select count(*)::int as n from sync_read_marks where user_id = ${t.user.id}`)[0].n, 0, 'no marks for a cut');
    assert.equal((await t.sql`select count(*)::int as n from broker_accounts where user_id = ${t.user.id} and activities_read_at is not null`)[0].n, 0);
    // The next call (a whole budget, the next round) reads both accounts at once.
    calls.length = 0;
    wall = 2_000_000;
    const r2 = await runShard({ shard, ids: [t.user.id], shiftMs: shiftAt(1), jitterMs: 0, config: cfg, log: () => {},
      broker: { ...broker, fetchActivities: async (_u: unknown, _s: Date, ids?: string[]) => { calls.push(ids![0]); return []; } } as never,
      clock: () => wall, routeEnd: wall + 300_000, vendorBoundMs: 30_000 });
    assert.equal(r2.done, 1, JSON.stringify(r2));
    assert.deepEqual(calls.sort(), t.accs.map((a) => a.id).sort());
    await t.sql`delete from sync_shards where of = ${of}`;
  } finally { await t.cleanup(); }
});

// Orchestrator review: last_synced_at (F-11's "Updated …") is the oldest real account's last activities read, never
// "now" after a rebuild only an account-set change triggered.
dbTest('review 6: a rebuild triggered by an account-set change keeps last_synced_at at the last activities read', async () => {
  const t = await trader(2);
  const { syncUser } = await import('./sync.ts');
  try {
    const broker = { listAccounts: async () => t.accs, fetchActivities: async () => [] };
    await syncUser(t.user, broker as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(0) });
    const first = (await t.sql`select last_synced_at from users where id = ${t.user.id}`)[0].last_synced_at as Date;
    assert.ok(Math.abs(first.getTime() - (base)) < 60_000, 'the read time on the (shifted) database clock');
    // 3 h later the vendor lists one account fewer (an account-set change: rebuilt), but no activities are due.
    await syncUser(t.user, { ...broker, listAccounts: async () => [t.accs[0]] } as never, undefined, undefined, { cadence: true, shiftMs: shiftAt(3) });
    const after = (await t.sql`select last_synced_at from users where id = ${t.user.id}`)[0].last_synced_at as Date;
    assert.equal(after.getTime(), first.getTime(), 'not advanced to now');
  } finally { await t.cleanup(); }
});
