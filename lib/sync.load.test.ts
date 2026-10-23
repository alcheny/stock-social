// F-1 PR-3 heavy-use tests (docs/features/F-1-broker-connection.md: 10,000 activities per trader, 5 accounts per trader,
// 500 traders per hourly sync; repeated hourly syncs idempotent; a heavy record syncs and rebuilds within a bounded time;
// two syncs for one trader never interleave). The real vendor module (lib/broker.ts) runs against the in-repo vendor
// fake over HTTP (e2e/fakes/vendor.ts) with seeded histories, so every run sees the same data.
// Skipped unless LOAD=1, so `npm test` stays fast. Run on demand (CI or locally), with DATABASE_URL set:
//   LOAD=1 node --expose-gc --test lib/sync.load.test.ts
// Timings print as `# load: …` lines. Bounds are asserted; docs/features/logs/F-1/build-pr3-engineer.md records them.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { seededActivities, startVendorFake } from '../e2e/fakes/vendor.ts';
import type { Activity } from './trades.ts';
import type { SyncableUser } from './sync.ts';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const loadTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 900_000 }, fn);

// The bounds (asserted). Each is about ten times the time measured on a development container, so a slower CI runner
// passes and a regression to per-row work or a whole-history read does not.
export const BOUNDS = {
  importMs: 15_000, // 10,000 activities in 5 accounts (one simulated): every import step plus the rebuild
  stepMs: 3_000, // any single import step (one vendor page, or the rebuild): fits a short function duration
  rebuildMs: 5_000, // a standalone rebuild of the 10,000-activity record
  syncMs: 5_000, // one hourly sync of the 10,000-activity record (backfill week)
  firstSyncMs: 15_000, // a first sync that pages the whole 10,000-activity history in
  fleetMs: 60_000, // 500 traders through 8 concurrent callers of the sync tick
  heapMb: 64, // peak heap growth during the heavy import and syncs
};
const HEAVY = { accounts: 4, perAccount: 2_500, paper: 500 }; // 10,000 imported activities, 5 accounts
const FLEET = { traders: 500, callers: 8, accounts: 2, perAccount: 20 };

const log = (s: string) => console.log(`# load: ${s}`);
const ms = (t0: number) => Math.round(performance.now() - t0);
let fake: Awaited<ReturnType<typeof startVendorFake>>;
const PORT = 5300 + Math.floor(Math.random() * 500);
const tag = `l${Math.random().toString(36).slice(2, 8)}`;
const made: number[] = [];
const accountIds: string[] = [];

before(async () => {
  if (!LOAD || !hasDb) return;
  await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
  fake = await startVendorFake(PORT);
  process.env.SNAPTRADE_BASE_URL = fake.base;
  process.env.SNAPTRADE_CLIENT_ID = 'test';
  process.env.SNAPTRADE_CONSUMER_KEY = 'test-consumer';
  process.env.APP_SECRET_KEY ??= 'load-test-secret';
});
after(async () => {
  if (!LOAD || !hasDb) return;
  const { sql } = await import('./db.ts');
  if (made.length) await sql`delete from users where id in ${sql(made)}`;
  if (accountIds.length) await sql`delete from broker_accounts where account_id in ${sql(accountIds)}`;
  fake?.server.close();
  await sql.end({ timeout: 1 });
});

const post = (path: string, body: unknown) => fetch(`${fake.base}${path}`, { method: 'POST', body: JSON.stringify(body) });
async function mkUser(n: string) {
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { sql } = await import('./db.ts');
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` });
  made.push(u.id);
  const [{ signup_attempt_id: a }] = await sql`select signup_attempt_id from users where id = ${u.id}`;
  return { id: u.id, attemptId: Number(a) };
}
// Heap sampling: the peak above the starting point while `fn` runs.
async function peakHeap<T>(fn: () => Promise<T>): Promise<{ value: T; mb: number }> {
  (globalThis as { gc?: () => void }).gc?.();
  const base = process.memoryUsage().heapUsed;
  let peak = base;
  const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().heapUsed); }, 5);
  try {
    const value = await fn();
    peak = Math.max(peak, process.memoryUsage().heapUsed);
    return { value, mb: Math.round((peak - base) / 1e5) / 10 };
  } finally { clearInterval(timer); }
}
// The stable serialization of a record: every column but the row id, in sell order, hashed.
async function recordHash(userId: number) {
  const { sql } = await import('./db.ts');
  const rows = await sql`select sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status
    from closed_trades where user_id = ${userId} order by sell_id`;
  return { n: rows.length, hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16) };
}
// What the pure matcher says the record is, from the seeded rows (the same mapping as lib/broker.ts#toActivities).
async function expectedTrades(accounts: string[], seedOf: (i: number) => number, n: number) {
  const { matchTrades } = await import('./trades.ts');
  let trades = 0, excluded = 0;
  for (const [i, id] of accounts.entries()) {
    const acts: Activity[] = seededActivities(id, n, seedOf(i)).map((r) => ({
      externalId: r.id, accountId: id, symbol: r.symbol, side: r.type, units: Math.abs(r.units), price: r.price, fee: Math.abs(r.fee ?? 0), executedAt: new Date(r.trade_date), verified: true,
    })).sort((a, b) => a.symbol.localeCompare(b.symbol) || a.executedAt.getTime() - b.executedAt.getTime() || a.externalId.localeCompare(b.externalId));
    const m = matchTrades(acts);
    trades += m.trades.length; excluded += m.excluded;
  }
  return { trades, excluded };
}

let heavy: { id: number; attemptId: number } | null = null;
const heavyAccounts = Array.from({ length: HEAVY.accounts }, (_, i) => `${tag}-h${i}`);

loadTest('heavy record: 10,000 activities in 5 accounts (one simulated) import in chunks and rebuild within bounds; memory stays bounded', async () => {
  const { sql } = await import('./db.ts');
  const c = await import('./connections.ts');
  const { PAGE_LIMIT } = await import('./broker.ts');
  const { rebuildTrades, REBUILD_PAGE } = await import('./sync.ts');
  const paper = `${tag}-hp`;
  accountIds.push(...heavyAccounts, paper);
  await post('/_scenario', { accounts: [
    ...heavyAccounts.map((id, i) => ({ id, authorization: `${tag}-auth-h`, institution: 'Fake Brokerage', activities: HEAVY.perAccount, seed: 1000 + i,
      positions: i === 0 ? [{ symbol: 'AAA', units: 5, price: 11, cost_basis: 10 }] : [] })),
    { id: paper, authorization: `${tag}-auth-h`, paper: true, activities: HEAVY.paper, seed: 999 },
  ] });
  heavy = await mkUser('heavy');
  const who = { userId: heavy.id, attemptId: heavy.attemptId };
  const pages: number[] = [];
  const deps = { ...c.realDeps, fetchActivitiesPage: async (...a: Parameters<typeof c.realDeps.fetchActivitiesPage>) => {
    const p = await c.realDeps.fetchActivitiesPage(...a); pages.push(p.activities.length); return p;
  } };
  const url = await c.startConnection(who, 'https://app.example/connect/done', deps);
  await fetch(`${url}&go=1`, { redirect: 'manual' }); // the portal's Connect
  const link = await c.completeLink(who, deps);
  assert.equal(link.kind, 'consent');
  const id = (link as { id: number }).id;
  await c.consent(id, new Date(), deps);
  let steps = 0, slowest = 0;
  const t0 = performance.now();
  const { mb } = await peakHeap(async () => {
    for (let r = { state: 'importing' } as { state: string }; r.state === 'importing'; steps++) {
      const s0 = performance.now();
      r = await c.importStep(id, deps, new Date());
      slowest = Math.max(slowest, ms(s0));
      assert.ok(steps < 100, 'the import ends');
    }
  });
  const importMs = ms(t0);
  assert.equal((await c.getConnection(id))!.state, 'connected');
  const [{ n: stored }] = await sql`select count(*)::int as n from activities where user_id = ${heavy.id}`;
  assert.equal(stored, HEAVY.accounts * HEAVY.perAccount); // the simulated account is never imported
  assert.ok(pages.every((n) => n <= PAGE_LIMIT));
  assert.equal(pages.length, HEAVY.accounts * (Math.floor(HEAVY.perAccount / PAGE_LIMIT) + 1)); // chunks of one vendor page
  const want = await expectedTrades(heavyAccounts, (i) => 1000 + i, HEAVY.perAccount);
  const got = await recordHash(heavy.id);
  assert.equal(got.n, want.trades);
  assert.equal((await sql`select excluded_positions from users where id = ${heavy.id}`)[0].excluded_positions, want.excluded);
  const r0 = performance.now();
  const rebuilt = await rebuildTrades(heavy.id);
  const rebuildMs = ms(r0);
  assert.equal(rebuilt.trades, want.trades);
  assert.equal((await recordHash(heavy.id)).hash, got.hash); // a rebuild changes nothing
  log(`heavy import: ${stored} activities, ${pages.length} pages, ${steps} steps, ${got.n} closes, ${want.excluded} excluded; import ${importMs} ms (bound ${BOUNDS.importMs}), slowest step ${slowest} ms (bound ${BOUNDS.stepMs}), rebuild ${rebuildMs} ms (bound ${BOUNDS.rebuildMs}), rebuild held at most ${rebuilt.maxHeld} rows, heap peak +${mb} MB (bound ${BOUNDS.heapMb})`);
  assert.ok(importMs < BOUNDS.importMs, `import ${importMs} ms`);
  assert.ok(slowest < BOUNDS.stepMs, `slowest step ${slowest} ms`);
  assert.ok(rebuildMs < BOUNDS.rebuildMs, `rebuild ${rebuildMs} ms`);
  assert.ok(mb < BOUNDS.heapMb, `heap +${mb} MB`);
  assert.ok(rebuilt.maxHeld < stored / 2, `rebuild held ${rebuilt.maxHeld} of ${stored} rows`); // never the whole history
  assert.ok(rebuilt.maxHeld <= REBUILD_PAGE * 2, `rebuild held ${rebuilt.maxHeld}`); // a page plus one open (account, symbol) pair
});

loadTest('three consecutive hourly syncs of the heavy record leave closed_trades byte-identical, add no activity, keep a thesis; each within bounds', async () => {
  assert.ok(heavy, 'the heavy import ran');
  const { sql } = await import('./db.ts');
  const { syncUser } = await import('./sync.ts');
  const [one] = await sql`select sell_id from closed_trades where user_id = ${heavy.id} order by sell_id limit 1`;
  await sql`update closed_trades set thesis = 'Planned exit.', thesis_status = 'published' where sell_id = ${one.sell_id}`;
  const before = await recordHash(heavy.id);
  const [{ n: acts }] = await sql`select count(*)::int as n from activities where user_id = ${heavy.id}`;
  const u = (await sql`select id, snaptrade_user_id, snaptrade_secret_enc from users where id = ${heavy.id}`)[0] as { id: number; snaptrade_user_id: string; snaptrade_secret_enc: string };
  const times: number[] = [];
  const { mb } = await peakHeap(async () => {
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const read = await syncUser(u);
      times.push(ms(t0));
      assert.ok(typeof read === 'number' && read > 0 && read < acts / 10, `a sync reads the backfill week only (${read})`);
      assert.deepEqual(await recordHash(heavy!.id), before);
      assert.equal((await sql`select count(*)::int as n from activities where user_id = ${heavy!.id}`)[0].n, acts);
    }
  });
  assert.equal((await sql`select thesis from closed_trades where sell_id = ${one.sell_id}`)[0].thesis, 'Planned exit.');
  log(`three syncs: ${times.join(' / ')} ms (bound ${BOUNDS.syncMs} each), closed_trades ${before.n} rows, sha256 ${before.hash} unchanged, heap peak +${mb} MB`);
  for (const t of times) assert.ok(t < BOUNDS.syncMs, `sync ${t} ms`);
  assert.ok(mb < BOUNDS.heapMb, `heap +${mb} MB`);
});

loadTest('two syncs for the heavy trader under contention: one runs, the other is skipped without touching the vendor; nothing interleaves', async () => {
  assert.ok(heavy, 'the heavy import ran');
  const { sql } = await import('./db.ts');
  const { syncUser } = await import('./sync.ts');
  const broker = await import('./broker.ts');
  const before = await recordHash(heavy.id);
  const u = (await sql`select id, snaptrade_user_id, snaptrade_secret_enc from users where id = ${heavy.id}`)[0] as { id: number; snaptrade_user_id: string; snaptrade_secret_enc: string };
  let inFlight = 0, most = 0, lists = 0;
  const slow = { ...broker, listAccounts: async (b: Parameters<typeof broker.listAccounts>[0]) => { lists++; return broker.listAccounts(b); },
    fetchActivities: async (...a: Parameters<typeof broker.fetchActivities>) => {
      most = Math.max(most, ++inFlight);
      await new Promise((r) => setTimeout(r, 300));
      try { return await broker.fetchActivities(...a); } finally { inFlight--; }
    } };
  const t0 = performance.now();
  const results = await Promise.all([syncUser(u, slow), syncUser(u, slow), syncUser(u, slow)]);
  const took = ms(t0);
  assert.equal(results.filter((r) => r === 'skipped').length, 2);
  assert.equal(results.filter((r) => typeof r === 'number').length, 1);
  assert.equal(most, 1);
  assert.equal(lists, 1); // a skipped sync never reached the vendor
  assert.deepEqual(await recordHash(heavy.id), before);
  log(`contention: 3 simultaneous syncs of one trader → 1 ran, 2 skipped, in ${took} ms`);
});

loadTest('a first sync with no stored history pages a 10,000-activity record in (it used to fail: one insert past 65,534 parameters)', async () => {
  const { sql } = await import('./db.ts');
  const { syncUser } = await import('./sync.ts');
  const broker = await import('./broker.ts');
  const accounts = Array.from({ length: HEAVY.accounts }, (_, i) => `${tag}-f${i}`);
  accountIds.push(...accounts);
  const bu = await broker.registerUser(`${tag}-first`);
  await post('/_scenario', { accounts: accounts.map((id, i) => ({ id, authorization: `${tag}-auth-f`, activities: HEAVY.perAccount, seed: 2000 + i })) });
  await fetch(`${await broker.connectUrl(bu, 'https://app.example/connect/done')}&go=1`, { redirect: 'manual' });
  const me = await mkUser('first');
  await sql`update users set snaptrade_user_id = ${bu.snaptradeUserId}, snaptrade_secret_enc = ${bu.secretEnc} where id = ${me.id}`;
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    values (${me.attemptId}, ${me.id}, ${`${tag}-auth-f`}, 'connected', now(), now(), now(), ${sql.json(accounts.map((id) => ({ id, authorizationId: `${tag}-auth-f`, institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true })))})`;
  const u = { id: me.id, snaptrade_user_id: bu.snaptradeUserId, snaptrade_secret_enc: bu.secretEnc };
  const t0 = performance.now();
  const { value: read, mb } = await peakHeap(() => syncUser(u));
  const took = ms(t0);
  assert.equal(read, HEAVY.accounts * HEAVY.perAccount);
  const want = await expectedTrades(accounts, (i) => 2000 + i, HEAVY.perAccount);
  assert.equal((await recordHash(me.id)).n, want.trades);
  log(`first sync: ${read} activities paged in and rebuilt to ${want.trades} closes in ${took} ms (bound ${BOUNDS.firstSyncMs}), heap peak +${mb} MB`);
  assert.ok(took < BOUNDS.firstSyncMs, `first sync ${took} ms`);
  assert.ok(mb < BOUNDS.heapMb, `heap +${mb} MB`);
});

loadTest('500 traders synced by 8 concurrent callers of the sync tick: each exactly once, never two at a time, no duplicate activity, within bounds', async () => {
  const { sql } = await import('./db.ts');
  const { syncTick, syncUser } = await import('./sync.ts');
  const broker = await import('./broker.ts');
  // Setup: 500 vendor users, each with 2 linked accounts of 20 seeded activities, and a connected connection.
  const s0 = performance.now();
  const fleet: { id: number; vendor: string; accounts: string[] }[] = [];
  for (let t = 0; t < FLEET.traders; t++) {
    const accounts = Array.from({ length: FLEET.accounts }, (_, i) => `${tag}-t${t}-${i}`);
    accountIds.push(...accounts);
    const bu = await broker.registerUser(`${tag}-t${t}`);
    await post('/_scenario', { accounts: accounts.map((id, i) => ({ id, authorization: `${tag}-auth-t${t}`, activities: FLEET.perAccount, seed: 3000 + t * 10 + i })) });
    await fetch(`${await broker.connectUrl(bu, 'https://app.example/connect/done')}&go=1`, { redirect: 'manual' });
    const me = await mkUser(`t${t}`);
    await sql`update users set snaptrade_user_id = ${bu.snaptradeUserId}, snaptrade_secret_enc = ${bu.secretEnc} where id = ${me.id}`;
    await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
      values (${me.attemptId}, ${me.id}, ${`${tag}-auth-t${t}`}, 'connected', now(), now(), now(), ${sql.json(accounts.map((id) => ({ id, authorizationId: `${tag}-auth-t${t}`, institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true })))})`;
    fleet.push({ id: me.id, vendor: bu.snaptradeUserId, accounts });
  }
  const setupMs = ms(s0);
  const mine = new Set(fleet.map((f) => f.id));
  const calls = new Map<number, number>();
  const inFlight = new Set<number>();
  let interleaved = 0, peakConcurrent = 0;
  const sync = async (u: SyncableUser) => {
    if (!mine.has(u.id)) return 0; // a trader left by another suite: not ours
    if (inFlight.has(u.id)) interleaved++;
    inFlight.add(u.id);
    peakConcurrent = Math.max(peakConcurrent, inFlight.size);
    calls.set(u.id, (calls.get(u.id) ?? 0) + 1);
    try { return await syncUser(u); } finally { inFlight.delete(u.id); }
  };
  const now = new Date();
  const t0 = performance.now();
  const results = await Promise.all(Array.from({ length: FLEET.callers }, () => syncTick({ now, sync })));
  const took = ms(t0);
  const failed = results.flatMap((r) => r.failed).filter((id) => mine.has(id));
  assert.deepEqual(failed, []);
  assert.equal(interleaved, 0);
  assert.equal(fleet.filter((f) => calls.get(f.id) !== 1).length, 0, 'each trader exactly once');
  const [{ n, d }] = await sql`select count(*)::int as n, count(distinct external_id)::int as d from activities where user_id in ${sql([...mine])}`;
  assert.equal(n, FLEET.traders * FLEET.accounts * FLEET.perAccount);
  assert.equal(d, n);
  const perCaller = results.map((r) => r.ok + r.skipped + r.failed.length);
  // A second tick in the same round claims none of them again.
  await syncTick({ now: new Date(now.getTime() + 60_000), sync });
  assert.equal(fleet.filter((f) => calls.get(f.id) !== 1).length, 0);
  log(`fleet: ${FLEET.traders} traders × ${FLEET.accounts} accounts (setup ${setupMs} ms); ${FLEET.callers} concurrent callers synced each exactly once in ${took} ms (bound ${BOUNDS.fleetMs}), ${Math.round(took / FLEET.traders)} ms per trader, up to ${peakConcurrent} at once, per caller ${perCaller.join('/')}; a repeat tick in the same round synced none of them again`);
  assert.ok(took < BOUNDS.fleetMs, `fleet ${took} ms`);
});
