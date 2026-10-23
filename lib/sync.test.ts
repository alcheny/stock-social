// F-1: a sync is one transaction per user under the per-user advisory lock (docs/features/F-1-broker-connection.md).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { USER_LOCK } from './sync.ts';

test('sync and import steps share one per-user lock key', () => assert.equal(USER_LOCK, 1));

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `s${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-vendor`, snaptrade_secret_enc: 'enc' };
  const act = (id: string, accountId: string, side: 'BUY' | 'SELL', price: number, day: number) => ({
    externalId: `${tag}-${id}`, accountId, symbol: 'AAA', side, units: 1, price, fee: 0, executedAt: new Date(Date.UTC(2024, 0, day)), verified: true, raw: {},
  });
  const count = async (table: 'activities' | 'closed_trades') => (await sql`select count(*)::int as n from ${sql(table)} where user_id = ${u.id}`)[0].n as number;
  // F-1: a sync reads only accounts under a consented authorization: a connected connection on authorization 'a'.
  const connected = async (ids: string[]) => sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', now(), now(), now(), ${sql.json(ids.map((id) => ({ id, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true })))} from users where id = ${u.id}`;
  return { sql, tag, user, act, count, connected, cleanup: async (ids: string[]) => { await sql`delete from users where id = ${u.id}`; if (ids.length) await sql`delete from broker_accounts where account_id in ${sql(ids)}`; } };
}

dbTest('two syncs for the same trader at once: one runs, the other is skipped; rows never interleave; a third sync afterwards runs normally', async () => {
  const { tag, user, act, count, connected, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const acc = `${tag}-acc`;
  await connected([acc]);
  let inFlight = 0, maxInFlight = 0;
  const broker = {
    listAccounts: async () => [{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }],
    fetchActivities: async () => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 150));
      inFlight--;
      return [act('b1', acc, 'BUY', 100, 1), act('s1', acc, 'SELL', 110, 2)];
    },
  };
  try {
    const [r1, r2] = await Promise.all([syncUser(user, broker), syncUser(user, broker)]);
    assert.deepEqual([r1, r2].sort(), [2, 'skipped']);
    assert.equal(maxInFlight, 1); // the skipped one never reached the vendor
    assert.equal(await count('activities'), 2);
    assert.equal(await count('closed_trades'), 1);
    assert.equal(await syncUser(user, broker), 2); // idempotent re-sync
    assert.equal(await count('activities'), 2);
  } finally {
    await cleanup([acc]);
  }
});

dbTest('a failure anywhere in a sync leaves activities, closed_trades, claims and positions exactly as before', async () => {
  const { sql, tag, user, act, count, connected, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const acc = `${tag}-acc`, acc2 = `${tag}-acc2`;
  const accounts = (ids: string[]) => ids.map((id) => ({ id, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }));
  await connected([acc]);
  try {
    await syncUser(user, { listAccounts: async () => accounts([acc]), fetchActivities: async () => [act('b1', acc, 'BUY', 100, 1), act('s1', acc, 'SELL', 90, 2)], fetchPositions: async () => [{ symbol: 'ZZZ', unrealizedPct: 0.1 }] });
    const snapshot = async () => JSON.stringify([
      await sql`select external_id from activities where user_id = ${user.id} order by external_id`,
      await sql`select sell_id, return_pct from closed_trades where user_id = ${user.id} order by sell_id`,
      await sql`select account_id, confirmed_at from broker_accounts where user_id = ${user.id} order by account_id`,
      await sql`select symbol, unrealized_pct from open_positions where user_id = ${user.id} order by symbol`,
    ]);
    const before = await snapshot();
    assert.equal(await count('closed_trades'), 1);
    // Positions fail after the new activities were inserted and the trades rebuilt inside the same transaction.
    await assert.rejects(syncUser(user, {
      listAccounts: async () => accounts([acc, acc2]),
      fetchActivities: async () => [act('b2', acc2, 'BUY', 50, 3), act('s2', acc2, 'SELL', 60, 4)],
      fetchPositions: async () => { throw new Error('vendor down'); },
    }), /vendor down/);
    assert.equal(await snapshot(), before);
    assert.equal((await sql`select 1 from broker_accounts where account_id = ${acc2}`).length, 0); // the new claim rolled back too
    // A rebuild failure rolls back the inserted activities as well.
    await assert.rejects(syncUser(user, { listAccounts: async () => accounts([acc]), fetchActivities: async () => [act('b3', acc, 'BUY', 1, 5)] }, async () => { throw new Error('rebuild broke'); }), /rebuild broke/);
    assert.equal(await snapshot(), before);
  } finally {
    await cleanup([acc, acc2]);
  }
});

dbTest('disconnect after connecting (TR-5): accounts the vendor no longer lists mark the connection disconnected; the record freezes and nothing is deleted', async () => {
  const { sql, tag, user, act, count, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const acc = `${tag}-acc`;
  const vendorAcc = (ids: string[]) => ids.map((id) => ({ id, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }));
  try {
    const [a] = await sql`select signup_attempt_id from users where id = ${user.id}`;
    const [c] = await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, importing_at, connected_at, consent_at, accounts)
      values (${a.signup_attempt_id}, ${user.id}, 'a', 'connected', now(), now(), now(), ${sql.json([{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }])}) returning id`;
    await syncUser(user, { listAccounts: async () => vendorAcc([acc]), fetchActivities: async () => [act('b1', acc, 'BUY', 100, 1), act('s1', acc, 'SELL', 120, 2)] });
    assert.equal(await count('closed_trades'), 1);
    assert.equal((await sql`select disconnected_at from connections where id = ${c.id}`)[0].disconnected_at, null);
    await syncUser(user, { listAccounts: async () => [], fetchActivities: async () => [] });
    assert.ok((await sql`select disconnected_at from connections where id = ${c.id}`)[0].disconnected_at);
    assert.equal(await count('activities'), 2);
    assert.equal(await count('closed_trades'), 1);
    assert.equal((await sql`select 1 from broker_accounts where account_id = ${acc} and user_id = ${user.id}`).length, 1); // confirmed claim kept
  } finally {
    await cleanup([acc]);
  }
});

dbTest('usersToSync (D1, D5): only a trader with a connected connection and no import in progress; never pending-only, importing-only, failed-only or a profile being deleted', async () => {
  const { sql, tag, user, cleanup } = await setup();
  const { usersToSync } = await import('./sync.ts');
  const listed = async () => (await usersToSync()).some((u) => u.id === user.id);
  const [a] = await sql`select signup_attempt_id from users where id = ${user.id}`;
  const row = async (state: string) => Number((await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, accounts)
    values (${a.signup_attempt_id}, ${user.id}, ${`${tag}-${state}`}, ${state}, '[]') returning id`)[0].id);
  try {
    assert.equal(await listed(), false); // a vendor id alone is not a consent
    const pending = await row('pending');
    assert.equal(await listed(), false);
    await sql`update connections set state = 'failed', failure_reason = 'stale' where id = ${pending}`;
    assert.equal(await listed(), false);
    const connected = await row('connected');
    assert.equal(await listed(), true);
    const importing = await row('importing');
    assert.equal(await listed(), false);
    await sql`update connections set state = 'connected' where id = ${importing}`;
    assert.equal(await listed(), true);
    await sql`update users set deleted_at = now() where id = ${user.id}`;
    assert.equal(await listed(), false);
    assert.ok(connected);
  } finally {
    await cleanup([]);
  }
});

// PR-3 (heavy-use defects found by lib/sync.load.test.ts; docs/features/logs/F-1/build-pr3-engineer.md).
dbTest('PR-3 defect 1: a record with 7,000 closes (7,007 activities) inserts and rebuilds; one statement used to carry every row and failed past ~5,950 (65,534 parameters)', async () => {
  const { tag, user, count, cleanup } = await setup();
  const { insertActivities, rebuildTrades, INSERT_CHUNK } = await import('./sync.ts');
  assert.equal(INSERT_CHUNK, 1000);
  const acc = `${tag}-big`;
  const acts = [];
  for (let s = 0; s < 7; s++) {
    const symbol = `S${s}`;
    acts.push({ externalId: `${tag}-${s}-b`, accountId: acc, symbol, side: 'BUY' as const, units: 1000, price: 10, fee: 0, executedAt: new Date(Date.UTC(2024, 0, 1)), verified: true, raw: {} });
    for (let i = 0; i < 1000; i++) acts.push({ externalId: `${tag}-${s}-s${i}`, accountId: acc, symbol, side: 'SELL' as const, units: 1, price: 10 + (i % 3), fee: 0, executedAt: new Date(Date.UTC(2024, 0, 2) + i * 60_000), verified: true, raw: {} });
  }
  try {
    await insertActivities(user.id, 'snaptrade', acts);
    assert.equal(await count('activities'), 7007);
    const r = await rebuildTrades(user.id);
    assert.deepEqual({ trades: r.trades, excluded: r.excluded }, { trades: 7000, excluded: 0 });
    assert.equal(await count('closed_trades'), 7000);
  } finally {
    await cleanup([]);
  }
});

dbTest('PR-3 defect 3: the rebuild reads activities in a total order, so same-instant rows match the same way whatever order they were stored in; results equal the pure matcher over the whole history; theses survive; reads are paged', async () => {
  const one = await setup(), two = await setup();
  const { insertActivities, rebuildTrades, REBUILD_PAGE } = await import('./sync.ts');
  const { matchTrades } = await import('./trades.ts');
  const at = (d: number, h = 0) => new Date(Date.UTC(2024, 0, d, h));
  const rows = (tag: string) => [
    // A sell and a buy at the same instant: by the vendor id, the buy (…-0b) comes first and the sell closes it.
    { externalId: `${tag}-0b`, accountId: `${tag}-x`, symbol: 'AAA', side: 'BUY' as const, units: 1, price: 100, fee: 0, executedAt: at(1), verified: true, raw: {} },
    { externalId: `${tag}-0s`, accountId: `${tag}-x`, symbol: 'AAA', side: 'SELL' as const, units: 1, price: 110, fee: 0, executedAt: at(1), verified: true, raw: {} },
    { externalId: `${tag}-1b`, accountId: `${tag}-x`, symbol: 'BBB', side: 'BUY' as const, units: 2, price: 50, fee: 1, executedAt: at(2), verified: true, raw: {} },
    { externalId: `${tag}-1s`, accountId: `${tag}-x`, symbol: 'BBB', side: 'SELL' as const, units: 1, price: 40, fee: 0, executedAt: at(3), verified: true, raw: {} },
    { externalId: `${tag}-2s`, accountId: `${tag}-y`, symbol: 'AAA', side: 'SELL' as const, units: 1, price: 40, fee: 0, executedAt: at(4), verified: true, raw: {} }, // no entry: excluded
  ];
  const shape = async (s: Awaited<ReturnType<typeof setup>>) => (await s.sql`select sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis
    from closed_trades where user_id = ${s.user.id} order by sell_id`).map((r) => ({ ...(r as Record<string, unknown>), sell_id: (r.sell_id as string).slice(s.tag.length), account_id: (r.account_id as string).slice(s.tag.length) }));
  try {
    await insertActivities(one.user.id, 'snaptrade', rows(one.tag)); // stored buy first
    await insertActivities(two.user.id, 'snaptrade', rows(two.tag).reverse()); // stored sell first
    for (const s of [one, two]) await rebuildTrades(s.user.id);
    assert.deepEqual(await shape(one), await shape(two));
    assert.equal((await shape(one)).length, 2);
    for (const s of [one, two]) assert.equal((await s.sql`select excluded_positions from users where id = ${s.user.id}`)[0].excluded_positions, 1);
    // The same answer as the pure matcher over the whole history, sorted the same way.
    const all = rows(one.tag).sort((a, b) => a.accountId.localeCompare(b.accountId) || a.symbol.localeCompare(b.symbol) || a.executedAt.getTime() - b.executedAt.getTime() || a.externalId.localeCompare(b.externalId));
    assert.deepEqual((await shape(one)).map((r) => (r as Record<string, unknown>).return_pct), matchTrades(all).trades.sort((a, b) => a.sellId.localeCompare(b.sellId)).map((t) => t.returnPct));
    // A thesis survives a rebuild.
    await one.sql`update closed_trades set thesis = 'kept', thesis_status = 'published' where sell_id = ${`${one.tag}-1s`}`;
    await rebuildTrades(one.user.id);
    assert.equal((await one.sql`select thesis from closed_trades where sell_id = ${`${one.tag}-1s`}`)[0].thesis, 'kept');
    // Paged reads: a history several pages long, across pairs and with a pair spanning page boundaries, is complete.
    assert.equal(REBUILD_PAGE, 1000);
    const many = [];
    for (let i = 0; i < 2500; i++) many.push({ externalId: `${two.tag}-m${String(i).padStart(5, '0')}`, accountId: `${two.tag}-z`, symbol: i < 1500 ? 'LONG' : 'SHORTER', side: (i % 2 ? 'SELL' : 'BUY') as 'BUY' | 'SELL', units: 1, price: 10 + (i % 7), fee: 0, executedAt: new Date(Date.UTC(2024, 1, 1) + i * 60_000), verified: true, raw: {} });
    await insertActivities(two.user.id, 'snaptrade', many);
    const r = await rebuildTrades(two.user.id);
    assert.equal(r.trades, 2 + 1250);
    assert.ok(r.maxHeld <= REBUILD_PAGE + 1500, `held ${r.maxHeld}`); // a page plus the open pair, never all 2,505
  } finally {
    await one.cleanup([]);
    await two.cleanup([]);
  }
});

dbTest('PR-3: a sync with no stored history reads it a vendor page at a time (one page held per insert); later syncs read the backfill week', async () => {
  const { tag, user, count, connected, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const acc = `${tag}-acc`;
  await connected([acc]);
  const all = Array.from({ length: 8 }, (_, i) => ({ externalId: `${tag}-p${i}`, accountId: acc, symbol: 'AAA', side: (i % 2 ? 'SELL' : 'BUY') as 'BUY' | 'SELL', units: 1, price: 100 + i, fee: 0, executedAt: new Date(Date.UTC(2024, 0, 1 + i)), verified: true, raw: {} }));
  const pages: number[] = [];
  const since: Date[] = [];
  const broker = {
    pageLimit: 3,
    listAccounts: async () => [{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }],
    fetchActivitiesPage: async (_u: unknown, _id: string, offset: number, limit = 3) => { const p = all.slice(offset, offset + limit); pages.push(p.length); return { activities: p, done: p.length < limit }; },
    fetchActivities: async (_u: unknown, s: Date) => { since.push(s); return all.slice(-2); },
  };
  try {
    assert.equal(await syncUser(user, broker), 8);
    assert.deepEqual(pages, [3, 3, 2]);
    assert.equal(since.length, 0);
    assert.equal(await count('activities'), 8);
    assert.equal(await count('closed_trades'), 4);
    assert.equal(await syncUser(user, broker), 2);
    assert.deepEqual(since.map((d) => d.toISOString()), [new Date(Date.UTC(2024, 0, 8) - 7 * 86_400_000).toISOString()]);
    assert.equal(await count('activities'), 8);
  } finally {
    await cleanup([acc]);
  }
});

dbTest('PR-3 defect 2: four concurrent callers of the sync tick sync each trader exactly once per round, never two at a time; the next round claims them again; a failure is retried next round, not by another caller', async () => {
  const sets = await Promise.all(Array.from({ length: 6 }, () => setup()));
  const { syncTick, ROUND_MS } = await import('./sync.ts');
  const mine = new Map(sets.map((s) => [s.user.id, s]));
  for (const s of sets) await s.connected([`${s.tag}-acc`]);
  const calls = new Map<number, number>();
  let inFlight = new Set<number>(), overlap = false;
  const failOnce = sets[0].user.id;
  const sync = async (u: { id: number }) => {
    if (!mine.has(u.id)) return 0; // another test file's trader: not ours to sync
    if (inFlight.has(u.id)) overlap = true;
    inFlight.add(u.id);
    calls.set(u.id, (calls.get(u.id) ?? 0) + 1);
    await new Promise((r) => setTimeout(r, 25));
    inFlight.delete(u.id);
    if (u.id === failOnce && calls.get(u.id) === 1) throw new Error('vendor down');
    return 1;
  };
  try {
    // A past round, 5 minutes after its cron mark, on the database clock shifted back (fix round 2); only our traders.
    const ids = [...mine.keys()];
    const at = (ms: number) => ({ ids, sync, clockShiftMs: () => ms - Date.now() });
    const now = Math.floor(Date.now() / ROUND_MS) * ROUND_MS - 3 * ROUND_MS + 5 * 60_000;
    const results = await Promise.all(Array.from({ length: 4 }, () => syncTick(at(now))));
    assert.equal(overlap, false);
    assert.deepEqual([...mine.keys()].map((id) => calls.get(id)), sets.map(() => 1));
    assert.deepEqual(results.flatMap((r) => r.failed).filter((id) => mine.has(id)), [failOnce]);
    // Same round: nothing is claimed twice, the failed trader included.
    await syncTick(at(now + 60_000));
    assert.deepEqual([...mine.keys()].map((id) => calls.get(id)), sets.map(() => 1));
    // Next round (an hour later): every trader once more.
    inFlight = new Set();
    await Promise.all(Array.from({ length: 4 }, () => syncTick(at(now + ROUND_MS))));
    assert.deepEqual([...mine.keys()].map((id) => calls.get(id)), sets.map(() => 2));
  } finally {
    for (const s of sets) await s.cleanup([`${s.tag}-acc`]);
  }
});


// Fix rounds 1 and 2 (tester's mediums): the claim is per round, :30 to :30 on the database clock, plus a short in-flight
// lease. Ticks run in a past round by shifting the database clock (minute 0 = a past :00 cron mark, so round k is
// minutes [60k - 30, 60k + 30)) and claim only these tests' traders, so no real trader is ever claimed here.
const MIN = 60_000;
async function roundTicks(n: number) {
  const sets = await Promise.all(Array.from({ length: n }, () => setup()));
  for (const s of sets) await s.connected([`${s.tag}-acc`]);
  const S = await import('./sync.ts');
  const ids = sets.map((s) => s.user.id);
  const mine = new Set(ids);
  const calls = new Map<number, number[]>();
  const T0 = Math.floor(Date.now() / S.ROUND_MS) * S.ROUND_MS - 20 * S.ROUND_MS; // a past :00
  const sim = { m: 0 }; // the database clock for clock-driven ticks, in minutes after T0; read at every claim
  const shiftTo = (minute: number) => T0 + minute * MIN - Date.now();
  const at = (minute?: number) => async (u: { id: number }) => { if (mine.has(u.id)) calls.set(u.id, [...(calls.get(u.id) ?? []), minute ?? sim.m]); return 0; };
  // A tick at a fixed database time (`minute`), or one that follows `sim.m` claim by claim (no minute).
  const tick = <R>(minute?: number, sync: (u: { id: number }) => Promise<R> = at(minute) as never) =>
    S.syncTick({ ids, sync, clockShiftMs: () => shiftTo(minute ?? sim.m) });
  const claim = (minute: number) => S.claimNextUser({ ids, shiftMs: shiftTo(minute) });
  const synced = () => ids.map((id) => calls.get(id) ?? []);
  const round = (m: number) => Math.floor((m + 30) / 60);
  return { S, sets, ids, mine, calls, T0, sim, tick, claim, at, synced, round, cleanup: async () => { for (const s of sets) await s.cleanup([`${s.tag}-acc`]); } };
}
const gate = () => { let open!: () => void; const p = new Promise<void>((r) => { open = r; }); return { p, open }; };
const until = async (f: () => boolean) => {
  for (const end = Date.now() + 5_000; !f(); await new Promise((r) => setTimeout(r, 5))) if (Date.now() > end) throw new Error('timed out waiting');
};

dbTest('PR-3 fix round 1: a late tick (+12 min) never makes the next on-time tick (+60) skip anyone: every trader is synced in round 1 and again in round 2', async () => {
  const h = await roundTicks(3);
  try {
    await h.tick(0);
    await h.tick(12); // the round-1 call delivered late (or a duplicate): same round, nobody again
    await h.tick(60);
    await h.tick(120);
    assert.deepEqual(h.synced(), h.ids.map(() => [0, 60, 120]));
    // A tick that only runs late in its round still syncs everyone that round, and the next on-time tick syncs them again.
    await h.tick(192);
    await h.tick(240);
    assert.deepEqual(h.synced(), h.ids.map(() => [0, 60, 120, 192, 240]));
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 1: a tick that crashes mid-run leaves no gap: a retry at +15 syncs the remaining traders (and the one whose lease lapsed), the next round syncs all again', async () => {
  const h = await roundTicks(3);
  try {
    // The crash: claims one trader (and so leases it), syncs nothing, never releases.
    const held = (await h.claim(0))?.id;
    assert.ok(held);
    // Still inside the lease (+5): the crashed claim is not taken, the others are.
    await h.tick(5);
    assert.deepEqual(h.synced(), h.ids.map((id) => (id === held ? [] : [5])));
    // After the lease lapses (+15): the crashed trader is synced in the same round; the others are not synced twice.
    await h.tick(15);
    assert.deepEqual(h.synced(), h.ids.map((id) => (id === held ? [15] : [5])));
    await h.tick(60);
    assert.deepEqual(h.synced(), h.ids.map((id) => (id === held ? [15, 60] : [5, 60])));
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 1: concurrent ticks in one round sync each trader once and never two at a time, including a tick in the next round while a sync is still in flight', async () => {
  const h = await roundTicks(6);
  try {
    const inFlight = new Set<number>();
    let overlap = false;
    const slow = (minute: number, wait?: Promise<void>) => async (u: { id: number }) => {
      if (inFlight.has(u.id)) overlap = true;
      inFlight.add(u.id);
      await h.at(minute)(u);
      await (wait ?? new Promise((r) => setTimeout(r, 20)));
      inFlight.delete(u.id);
      return 1;
    };
    await Promise.all(Array.from({ length: 4 }, () => h.tick(0, slow(0))));
    assert.equal(overlap, false);
    assert.deepEqual(h.synced(), h.ids.map(() => [0]));
    // A sync claimed at the next cron mark is still running when other ticks of that round arrive: its lease keeps it out
    // of them, so it is never synced twice at once nor twice in that round.
    const g = gate();
    h.calls.clear();
    const c = await h.claim(60);
    assert.ok(c);
    const running = (async () => { try { await slow(60, g.p)(c); } finally { await h.S.releaseClaim(c); } })();
    await Promise.all([h.tick(61, slow(61)), h.tick(61, slow(61))]);
    assert.deepEqual(h.calls.get(c.id), [60]);
    for (const id of h.ids.filter((id) => id !== c.id)) assert.deepEqual(h.calls.get(id), [61]);
    g.open();
    await running;
    await h.tick(62, slow(62));
    assert.equal(overlap, false);
    for (const id of h.ids) assert.equal(h.calls.get(id)?.length, 1, 'once in round 2');
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 1: a trader with an import running is never claimed', async () => {
  const h = await roundTicks(2);
  try {
    const [busy, free] = h.sets;
    await busy.sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, accounts)
      select signup_attempt_id, id, 'b', 'importing', now(), now(), '[]' from users where id = ${busy.user.id}`;
    await h.tick(0);
    await h.tick(60);
    assert.deepEqual(h.calls.get(busy.user.id), undefined);
    assert.deepEqual(h.calls.get(free.user.id), [0, 60]);
    const [row] = await busy.sql`select sync_claimed_at, sync_lease_until from users where id = ${busy.user.id}`;
    assert.equal(row.sync_claimed_at, null);
    assert.equal(row.sync_lease_until, null);
  } finally {
    await h.cleanup();
  }
});

// Fix round 2 (tester's re-run 1, scenarios 3 to 10 of the attack suite).
dbTest('PR-3 fix round 2: the claim uses the database clock: a claim stamps the database time, the lease is that time plus SYNC_LEASE_MS, the round starts at :30', async () => {
  const h = await roundTicks(1);
  try {
    const { sql } = h.sets[0];
    const [{ db }] = await sql`select now() as db`;
    const c = await h.S.claimNextUser({ ids: h.ids }); // no shift: production's clock
    assert.ok(c);
    const [row] = await sql`select sync_claimed_at as c, sync_lease_until as l from users where id = ${c.id}`;
    assert.ok(Math.abs(row.c.getTime() - db.getTime()) < 5_000);
    assert.equal(row.l.getTime() - row.c.getTime(), h.S.SYNC_LEASE_MS);
    await h.S.releaseClaim(c);
    assert.equal((await sql`select sync_lease_until as l from users where id = ${c.id}`)[0].l, null); // microsecond lease matched
    assert.equal(h.S.ROUND_OFFSET_MS, 30 * MIN);
    await sql`update users set sync_claimed_at = null where id = ${c.id}`; // back before the past rounds below
    // The boundary is at :30, not :00: a call 0.6 s before :30 and one 0.6 s after are different rounds.
    await h.tick(-60 + 29.99);
    await h.tick(-60 + 30.01);
    await h.tick(-60 + 59.9983); // :59:59.9, the next cron mark 0.1 s early: same round as :30.01
    await h.tick(0.005); // :00:00.3
    assert.deepEqual(h.synced(), [[-60 + 29.99, -60 + 30.01]]);
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 2: the scheduler fires 0.3 s late one hour and 0.1 s early the next: nobody is skipped (scenario 10)', async () => {
  const h = await roundTicks(2);
  try {
    await h.tick(0.005); // :00:00.3
    await h.tick(59.9983); // the next hour's call, 0.1 s early (:59:59.9)
    await h.tick(120.005);
    assert.deepEqual(h.synced(), h.ids.map(() => [0.005, 59.9983, 120.005]));
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 2: instances whose clocks are 2 min fast and 2 min slow fire their cron at true :58 and :02: alternating, both, or a retry a minute later, each trader is synced once per round (scenarios 6, 7, 8)', async () => {
  const h = await roundTicks(3);
  try {
    for (let k = 0; k < 6; k++) await h.tick(k * 60 + (k % 2 === 0 ? 2 : -2)); // one call per hour, alternating instances
    assert.deepEqual(h.synced().map((s) => s.length), h.ids.map(() => 6));
    h.calls.clear();
    for (let k = 7; k <= 9; k++) { await h.tick(k * 60 - 2); await h.tick(k * 60 + 2); } // both instances each hour
    assert.deepEqual(h.synced(), h.ids.map(() => [418, 478, 538]));
    h.calls.clear();
    await h.tick(600 - 2); // on time on the slow-firing instance
    await h.tick(601 + 2); // a retry on the other instance a minute later
    assert.deepEqual(h.synced(), h.ids.map(() => [598]));
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 2: a tick running across :30 claims under the new round after it: never twice in one round, and later claims carry the new round (scenario 3)', async () => {
  const h = await roundTicks(3);
  try {
    const g1 = gate(), g2 = gate();
    let a = 0, b = 0;
    const slow = (n: () => number, g: Promise<void>) => async (u: { id: number }) => { await h.at()(u); if (n() === 1) await g; return 1; };
    h.sim.m = 28;
    const A = h.tick(undefined, slow(() => ++a, g1.p)); // its first sync ends after :30
    await until(() => h.calls.size === 1);
    h.sim.m = 31;
    const B = h.tick(undefined, slow(() => ++b, g2.p)); // the next round's tick, slow on its first trader too
    await until(() => h.calls.size === 2);
    h.sim.m = 32;
    g1.open(); // A goes on claiming at :32, in round 1
    await until(() => [...h.calls.values()].flat().length === 4);
    h.sim.m = 33;
    g2.open();
    await Promise.all([A, B]);
    const [first, second] = [...h.calls.keys()];
    const third = h.ids.find((id) => id !== first && id !== second)!;
    assert.deepEqual(h.calls.get(first), [28, 32]); // round 0 at :28, then round 1 after the boundary
    assert.deepEqual(h.calls.get(second), [31]);
    assert.deepEqual(h.calls.get(third), [32]);
    for (const s of h.synced()) for (const r of [0, 1]) assert.ok(s.filter((m) => h.round(m) === r).length <= 1);
    const [row] = await h.sets[0].sql`select min(sync_claimed_at) as c from users where id in ${h.sets[0].sql(h.ids)}`;
    assert.ok(row.c.getTime() >= h.T0 + 30 * MIN, 'every claim after the boundary carries round 1');
    await h.tick(60); // round 1's cron: nobody again
    await h.tick(90); // round 2: everyone once
    assert.deepEqual(h.synced().map((s) => s.filter((m) => h.round(m) === 1).length), h.ids.map(() => 1));
    assert.deepEqual(h.synced().map((s) => s.filter((m) => h.round(m) === 2)), h.ids.map(() => [90]));
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 2: a lease that lapses mid-sync while the advisory lock holds: the second claimer is skipped, rows never interleave, no further sync that round (scenario 4)', async () => {
  const h = await roundTicks(1);
  try {
    const [id] = h.ids;
    const { sql } = h.sets[0];
    const g = gate();
    let inside = 0, overlap = false;
    const locked = (minute: number, wait?: Promise<void>) => async (u: { id: number }) => sql.begin(async (tx) => {
      const [{ got }] = await tx`select pg_try_advisory_xact_lock(${h.S.USER_LOCK}, ${u.id}) as got`;
      if (!got) return 'skipped' as const;
      if (++inside > 1) overlap = true;
      await h.at(minute)(u);
      if (wait) await wait;
      inside--;
      return 1;
    });
    const A = h.tick(0, locked(0, g.p));
    await until(() => h.calls.size === 1);
    const b = await h.tick(12, locked(12)); // the lease (until :10) has lapsed; the lock is still held by A
    assert.deepEqual(b, { ok: 0, skipped: 1, failed: [] });
    g.open();
    await A;
    await h.tick(20, locked(20));
    const [end] = await sql`select sync_lease_until as l from users where id = ${id}`;
    assert.equal(overlap, false);
    assert.deepEqual(h.calls.get(id), [0]);
    assert.equal(end.l, null);
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 2: 8 concurrent ticks across :30 (4 at :29, 4 at :31): never two at once, at most once per round, every trader once in round 1 (scenario 5)', async () => {
  const h = await roundTicks(12);
  try {
    const inFlight = new Set<number>();
    let overlap = false;
    const slow = (minute: number) => async (u: { id: number }) => {
      if (inFlight.has(u.id)) overlap = true;
      inFlight.add(u.id);
      await h.at(minute)(u);
      await new Promise((r) => setTimeout(r, 15));
      inFlight.delete(u.id);
      return 1;
    };
    await Promise.all([...Array.from({ length: 4 }, () => h.tick(29, slow(29))), ...Array.from({ length: 4 }, () => h.tick(31, slow(31)))]);
    await h.tick(35, slow(35));
    await h.tick(90, slow(90));
    assert.equal(overlap, false);
    for (const s of h.synced()) {
      assert.ok(s.filter((m) => h.round(m) === 0).length <= 1, JSON.stringify(s));
      assert.equal(s.filter((m) => h.round(m) === 1).length, 1, JSON.stringify(s));
      assert.deepEqual(s.filter((m) => h.round(m) === 2), [90]);
    }
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 2: an import running across :30 is never claimed (claim and lease stay null), and the first tick after it connects syncs it once (scenario 9)', async () => {
  const h = await roundTicks(1);
  try {
    const [id] = h.ids;
    const { sql } = h.sets[0];
    await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, accounts)
      select signup_attempt_id, id, 'b', 'importing', now(), now(), '[]' from users where id = ${id}`;
    for (const m of [28, 29, 30, 31]) {
      await h.tick(m);
      const [r] = await sql`select sync_claimed_at as c, sync_lease_until as l from users where id = ${id}`;
      assert.equal(r.c, null);
      assert.equal(r.l, null);
    }
    await Promise.all([h.tick(31), h.tick(31)]);
    assert.equal(h.calls.get(id), undefined);
    await sql`update connections set state = 'connected', connected_at = now() where user_id = ${id} and state = 'importing'`;
    await h.tick(32);
    await h.tick(33);
    assert.deepEqual(h.calls.get(id), [32]);
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 2, the rule: two instances skewed ±2 min with a cron at :00 on each, retries at arbitrary offsets, a tick across :30, an import and a lapsed lease: every trader is synced exactly once per round across 6 rounds, never interleaved', async () => {
  const h = await roundTicks(6);
  try {
    const { sql } = h.sets[0];
    const fresh = h.sets[5].user.id; // a trader with a second import running through most of round 3
    const entries: { id: number; m: number }[] = [];
    const inFlight = new Set<number>();
    let overlap = false;
    // A real sync's shape: one transaction under the per-user advisory lock; `hold` keeps the lock while the clock moves.
    const locked = (hold?: (id: number) => Promise<void> | undefined) => async (u: { id: number }) => sql.begin(async (tx) => {
      const [{ got }] = await tx`select pg_try_advisory_xact_lock(${h.S.USER_LOCK}, ${u.id}) as got`;
      if (!got) return 'skipped' as const;
      if (inFlight.has(u.id)) overlap = true;
      inFlight.add(u.id);
      entries.push({ id: u.id, m: h.sim.m });
      await hold?.(u.id);
      inFlight.delete(u.id);
      return 1;
    });
    const go = (m: number, sync = locked()) => { h.sim.m = m; return h.tick(undefined, sync); };
    for (let k = 1; k <= 6; k++) {
      const M = 60 * k; // the cron mark; the instance 2 min fast fires at true M - 2, the slow one at M + 2
      if (k === 3) {
        h.sim.m = M - 5;
        await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, accounts)
          select signup_attempt_id, id, 'imp', 'importing', now(), now(), '[]' from users where id = ${fresh}`;
      }
      if (k === 6) await go(M - 29.99); // a retry just after the round opens
      if (k === 2) await go(M + 0.005); // 0.3 s late on an unskewed caller
      if (k === 5) {
        // The fast instance's tick holds its first trader's lock past the lease (:58 to :71); the slow instance's cron
        // syncs the rest; a retry at :71 claims the lapsed lease and is skipped by the lock.
        const g = gate();
        let first: number | null = null;
        const P = go(M - 2, locked((id) => { if (first === null) { first = id; return g.p; } }));
        await until(() => first !== null);
        await go(M + 2);
        const r = await go(M + 11);
        assert.deepEqual(r, { ok: 0, skipped: 1, failed: [] });
        g.open();
        await P;
      } else if (k % 2 === 1) {
        await go(M - 2); await go(M + 2); // both instances fire
      } else {
        await go(k % 4 === 0 ? M - 2 : M + 2); // only one instance fires
      }
      if (k === 4) await go(M - 0.0017); // the scheduler 0.1 s early
      await go(M + 17); // a retry mid-round
      if (k === 3) {
        // The import connects at :28; a retry at :29 syncs it and is still in its sync at :30, then claims under round 4.
        h.sim.m = M + 28;
        await sql`update connections set state = 'connected', connected_at = now() where user_id = ${fresh} and state = 'importing'`;
        const g = gate();
        const X = go(M + 29, locked((id) => (id === fresh && h.sim.m < M + 30 ? g.p : undefined)));
        await until(() => entries.some((e) => e.id === fresh && e.m === M + 29));
        h.sim.m = M + 31;
        g.open();
        await X;
      } else {
        await go(M + 29.99); // 0.6 s before the boundary: still this round
      }
    }
    assert.equal(overlap, false);
    for (let r = 1; r <= 6; r++) {
      assert.deepEqual(h.ids.map((id) => entries.filter((e) => e.id === id && h.round(e.m) === r).length), h.ids.map(() => 1), `round ${r}: ${JSON.stringify(entries)}`);
    }
    assert.ok(entries.filter((e) => e.id === fresh && e.m >= 175 && e.m < 208).length === 0, 'never synced while importing');
    assert.deepEqual(entries.filter((e) => h.round(e.m) === 4).map((e) => e.m), h.ids.map(() => 211), 'the tick across :30 synced round 4');
  } finally {
    await h.cleanup();
  }
});

dbTest('fix round 3 (tester re-run 2, row 14): a lease that lapses mid-sync and a claim in the NEXT round (A claims :25 and holds the lock past :36; B at :36, C at :40): B and C are skipped and give the round back, so :60 reads the trader in round 1', async () => {
  const h = await roundTicks(1);
  try {
    const [id] = h.ids;
    const { sql } = h.sets[0];
    const g = gate();
    let entered = false, inside = 0, overlap = false;
    const fetchedAt: number[] = [];
    const locked = (minute: number, wait?: Promise<void>) => async (u: { id: number }) => sql.begin(async (tx) => {
      const [{ got }] = await tx`select pg_try_advisory_xact_lock(${h.S.USER_LOCK}, ${u.id}) as got`;
      if (!got) return 'skipped' as const;
      if (++inside > 1) overlap = true;
      entered = true; fetchedAt.push(minute);
      if (wait) await wait;
      inside--;
      return 1;
    });
    const A = h.tick(25, locked(25, g.p));
    await until(() => entered);
    const [claimA] = await sql`select sync_claimed_at::text as c from users where id = ${id}`;
    const b = await h.tick(36, locked(36)); // A's lease (until :35) has lapsed; A still holds the lock; :36 is round 1
    assert.deepEqual(b, { ok: 0, skipped: 1, failed: [] }); // claimed once, skipped once, not claimed again by this tick
    const [afterB] = await sql`select sync_claimed_at::text as c, sync_lease_until as l from users where id = ${id}`;
    assert.equal(afterB.c, claimA.c, 'the skipped claim put back the round-0 claim');
    assert.equal(afterB.l, null);
    assert.deepEqual(await h.tick(40, locked(40)), { ok: 0, skipped: 1, failed: [] }); // still held: skipped again, round given back again
    g.open();
    await A;
    const c = await h.tick(60, locked(60));
    const d = await h.tick(120, locked(120));
    assert.deepEqual(c, { ok: 1, skipped: 0, failed: [] });
    assert.deepEqual(d, { ok: 1, skipped: 0, failed: [] });
    assert.deepEqual(fetchedAt, [25, 60, 120], 'one vendor read in each of rounds 0, 1 and 2');
    assert.equal(overlap, false);
    assert.deepEqual(await h.tick(70, locked(70)), { ok: 0, skipped: 0, failed: [] }); // round 1 already read
    const [end] = await sql`select sync_lease_until as l from users where id = ${id}`;
    assert.equal(end.l, null);
  } finally {
    await h.cleanup();
  }
});

dbTest('fix round 3: a restore never overwrites a newer claim: a skipped claim whose lease was taken over again is left alone', async () => {
  const h = await roundTicks(1);
  try {
    const [id] = h.ids;
    const { sql } = h.sets[0];
    const first = await h.claim(36);
    assert.ok(first);
    assert.equal(first!.prev, null); // never claimed before
    await sql`update users set sync_lease_until = sync_lease_until - interval '20 minutes' where id = ${id}`; // lapses
    const second = await h.claim(37);
    assert.ok(second);
    await h.S.restoreClaim(first!); // stale: the lease is no longer this claim's
    const [r] = await sql`select sync_claimed_at::text as c, sync_lease_until::text as l from users where id = ${id}`;
    assert.equal(r.l, second!.lease);
    await h.S.restoreClaim(second!);
    const [r2] = await sql`select sync_claimed_at::text as c, sync_lease_until as l from users where id = ${id}`;
    assert.equal(r2.l, null);
    assert.equal(r2.c, second!.prev); // the first claim's time, as the database wrote it
  } finally {
    await h.cleanup();
  }
});

dbTest('fix round 3: a vendor request that times out fails the sync like a transport error: rolled back, lease released, round claim kept (retried next round)', async () => {
  const h = await roundTicks(1);
  const { VendorTimeoutError } = await import('./broker.ts');
  try {
    const [id] = h.ids;
    const s = h.sets[0];
    const acc = `${s.tag}-acc`;
    const broker = {
      listAccounts: async () => [{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }],
      fetchActivities: async () => { throw new VendorTimeoutError(30_000); },
    };
    const sync = (u: { id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null }) => h.S.syncUser(u, broker);
    const r = await h.tick(0, sync as never);
    assert.deepEqual(r, { ok: 0, skipped: 0, failed: [id] });
    assert.equal(await s.count('activities'), 0);
    const [row] = await s.sql`select sync_claimed_at as c, sync_lease_until as l from users where id = ${id}`;
    assert.equal(row.l, null);
    assert.notEqual(row.c, null);
    assert.equal((await s.sql`select count(*)::int as n from broker_accounts where account_id = ${acc}`)[0].n, 0); // the claim of the account rolled back too
    assert.deepEqual(await h.tick(10, sync as never), { ok: 0, skipped: 0, failed: [] }); // not again this round
    assert.deepEqual(await h.tick(60, sync as never), { ok: 0, skipped: 0, failed: [id] }); // retried next round
  } finally {
    await h.cleanup();
  }
});
