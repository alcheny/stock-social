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
  const { syncTick, hourStart, HOUR_MS } = await import('./sync.ts');
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
    const now = new Date(hourStart(new Date()).getTime() - 3 * HOUR_MS + 5 * 60_000); // a past hour, 5 minutes in
    const results = await Promise.all(Array.from({ length: 4 }, () => syncTick({ now, sync })));
    assert.equal(overlap, false);
    assert.deepEqual([...mine.keys()].map((id) => calls.get(id)), sets.map(() => 1));
    assert.deepEqual(results.flatMap((r) => r.failed).filter((id) => mine.has(id)), [failOnce]);
    // Same round: nothing is claimed twice, the failed trader included.
    await syncTick({ now: new Date(now.getTime() + 60_000), sync });
    assert.deepEqual([...mine.keys()].map((id) => calls.get(id)), sets.map(() => 1));
    // Next round (an hour later): every trader once more.
    inFlight = new Set();
    await Promise.all(Array.from({ length: 4 }, () => syncTick({ now: new Date(now.getTime() + HOUR_MS), sync })));
    assert.deepEqual([...mine.keys()].map((id) => calls.get(id)), sets.map(() => 2));
  } finally {
    for (const s of sets) await s.cleanup([`${s.tag}-acc`]);
  }
});

// Fix round 1 (tester's medium): the claim is per clock hour plus a short in-flight lease. Ticks run at past hours, so a
// claim never shadows a real tick; other suites' traders are claimed too but never synced here.
async function hourTicks(n: number) {
  const sets = await Promise.all(Array.from({ length: n }, () => setup()));
  for (const s of sets) await s.connected([`${s.tag}-acc`]);
  const S = await import('./sync.ts');
  const ids = sets.map((s) => s.user.id);
  const mine = new Set(ids);
  const calls = new Map<number, number[]>();
  const at = (minute: number) => async (u: { id: number }) => { if (mine.has(u.id)) calls.set(u.id, [...(calls.get(u.id) ?? []), minute]); return 0; };
  const T0 = S.hourStart(new Date()).getTime() - 6 * S.HOUR_MS; // the top of a past hour
  const tick = (minute: number, sync = at(minute)) => S.syncTick({ now: new Date(T0 + minute * 60_000), sync });
  const synced = () => ids.map((id) => calls.get(id) ?? []);
  return { S, sets, ids, mine, calls, T0, tick, at, synced, cleanup: async () => { for (const s of sets) await s.cleanup([`${s.tag}-acc`]); } };
}

dbTest('PR-3 fix round 1: a late tick (+12 min) never makes the next on-time tick (+60) skip anyone: every trader is synced in hour 1 and again in hour 2', async () => {
  const h = await hourTicks(3);
  try {
    await h.tick(0);
    await h.tick(12); // the hour-1 call delivered late (or a duplicate): same clock hour, nobody again
    await h.tick(60);
    await h.tick(120);
    assert.deepEqual(h.synced(), h.ids.map(() => [0, 60, 120]));
    // A tick that only runs late in its hour still syncs everyone that hour, and the next on-time tick syncs them again.
    await h.tick(192);
    await h.tick(240);
    assert.deepEqual(h.synced(), h.ids.map(() => [0, 60, 120, 192, 240]));
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 1: a tick that crashes mid-run leaves no gap: a retry at +15 syncs the remaining traders (and the one whose lease lapsed), the next hour syncs all again', async () => {
  const h = await hourTicks(3);
  try {
    // The crash: claims (and so leases) until it holds one of ours, syncs nothing, never releases.
    let held: number | null = null;
    for (let u = await h.S.claimNextUser(new Date(h.T0)); u; u = await h.S.claimNextUser(new Date(h.T0))) {
      if (h.mine.has(u.id)) { held = u.id; break; }
      await h.S.releaseClaim(u);
    }
    assert.ok(held);
    // Still inside the lease (+5): the crashed claim is not taken, the others are.
    await h.tick(5);
    assert.deepEqual(h.synced(), h.ids.map((id) => (id === held ? [] : [5])));
    // After the lease lapses (+15): the crashed trader is synced in the same hour; the others are not synced twice.
    await h.tick(15);
    assert.deepEqual(h.synced(), h.ids.map((id) => (id === held ? [15] : [5])));
    await h.tick(60);
    assert.deepEqual(h.synced(), h.ids.map((id) => (id === held ? [15, 60] : [5, 60])));
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 1: concurrent ticks in one hour sync each trader once and never two at a time, including a tick in the next hour while a sync is still in flight', async () => {
  const h = await hourTicks(6);
  try {
    const inFlight = new Set<number>();
    let overlap = false;
    const slow = (minute: number, gate?: Promise<void>) => async (u: { id: number }) => {
      if (!h.mine.has(u.id)) return 0;
      if (inFlight.has(u.id)) overlap = true;
      inFlight.add(u.id);
      await h.at(minute)(u);
      await (gate ?? new Promise((r) => setTimeout(r, 20)));
      inFlight.delete(u.id);
      return 1;
    };
    await Promise.all(Array.from({ length: 4 }, () => h.tick(30, slow(30))));
    assert.equal(overlap, false);
    assert.deepEqual(h.synced(), h.ids.map(() => [30]));
    // A sync claimed at the top of the next hour is still running when other ticks of that hour arrive: its lease keeps
    // it out of them, so it is never synced twice at once nor twice in that hour.
    let open!: () => void;
    const gate = new Promise<void>((r) => { open = r; });
    h.calls.clear();
    let claimed = await h.S.claimNextUser(new Date(h.T0 + 60 * 60_000));
    while (claimed && !h.mine.has(claimed.id)) { await h.S.releaseClaim(claimed); claimed = await h.S.claimNextUser(new Date(h.T0 + 60 * 60_000)); }
    assert.ok(claimed);
    const c = claimed;
    const running = (async () => { try { await slow(60, gate)(c); } finally { await h.S.releaseClaim(c); } })();
    await Promise.all([h.tick(61, slow(61)), h.tick(61, slow(61))]);
    assert.deepEqual(h.calls.get(c.id), [60]);
    for (const id of h.ids.filter((id) => id !== c.id)) assert.deepEqual(h.calls.get(id), [61]);
    open();
    await running;
    await h.tick(62, slow(62));
    assert.equal(overlap, false);
    for (const id of h.ids) assert.equal(h.calls.get(id)?.length, 1, 'once in hour 2');
  } finally {
    await h.cleanup();
  }
});

dbTest('PR-3 fix round 1: a trader with an import running is never claimed', async () => {
  const h = await hourTicks(2);
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
