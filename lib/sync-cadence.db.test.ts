// F-14 sync cadence, the database parts (docs/features/F-14-sync-cadence.md; committee
// docs/features/logs/F-14/committee-2026-11-01.md, G1–G10 and the round 3 final rule). Every vendor call goes over HTTP
// to the in-repo vendor fake (e2e/fakes/vendor.ts, started in this process) through the real lib/broker.ts; its
// `/_stats` per-account counts are the evidence (activities, share moves, positions, failed). Each test has its own
// traders (`ids`), its own past rounds (the database clock shifted back to hours it claims: lib/sync-test-hours.ts),
// and an `of` no other test uses. Skipped without DATABASE_URL.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { FakeAccount, FakeActivity } from '../e2e/fakes/vendor.ts';
import type { RunReport } from './sync-shard.ts';
import { claimHours } from './sync-test-hours.ts';
import { ACTIVITIES_EVERY_MS, ATTEMPT_FLOOR_MS, FUTURE_SLACK_MS, POSITIONS_EVERY_MS, POSITIONS_PER_DAY, type DueFlags } from './sync-cadence.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 180_000 }, fn);
let base = ''; // the fake's, on a free port (port 0)
let server: Server | null = null;

before(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
  const fake = await (await import('../e2e/fakes/vendor.ts')).startVendorFake(0);
  server = fake.server;
  base = fake.base;
  process.env.SNAPTRADE_BASE_URL = base;
  process.env.SNAPTRADE_CLIENT_ID = 'test';
  process.env.SNAPTRADE_CONSUMER_KEY = 'test-consumer';
  process.env.APP_SECRET_KEY ||= 'cadence-test-secret';
});
after(async () => {
  if (!hasDb) return;
  server?.close();
  await (await import('./db.ts')).sql.end({ timeout: 1 });
});

const HOUR = 3_600_000;
const MIN = 60_000;
const usedOf = new Set<number>();
// Shard counts (`of`) are split between the files that drive runShard in parallel, so no two share a lease or delete
// each other's: lib/sync-shard.test.ts 500–1000, this file 1001–1012 (up to 8 used), lib/sync-cadence.review.test.ts
// 1013–1018, lib/options-shard.test.ts 1019–1024 (the table allows 1–1024).
const freshOf = () => { for (;;) { const of = 1001 + Math.floor(Math.random() * 12); if (!usedOf.has(of)) { usedOf.add(of); return of; } } };
const post = async (path: string, body: unknown) => {
  const r = await fetch(`${base}${path}`, { method: 'POST', body: JSON.stringify(body) });
  assert.equal(r.status, 200, `${path} answered ${r.status}`);
  return r.json();
};
type Count = { activities: number; shareMoves: number; positions: number; failed: number };
const zero = (): Count => ({ activities: 0, shareMoves: 0, positions: 0, failed: 0 });
const stats = async () => (await (await fetch(`${base}/_stats`)).json()) as { accounts: Record<string, Count>; lists: Record<string, number> };
const buy = (id: string, symbol: string, day: string, price = 100): FakeActivity => ({ id, symbol, type: 'BUY', units: 10, price, fee: 0, trade_date: `${day}T15:00:00Z` });
const sell = (id: string, symbol: string, day: string, price: number): FakeActivity => ({ id, symbol, type: 'SELL', units: 10, price, fee: 0, trade_date: `${day}T16:00:00Z` });
const held = (symbol: string, pct: number) => ({ symbol, units: 10, price: 100 * (1 + pct), cost_basis: 100 });

async function harness() {
  const { sql } = await import('./db.ts');
  const H = await import('./sync-shard.ts');
  const S = await import('./sync.ts');
  const broker = await import('./broker.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  // Each test's own past: the hours from 2 before T0 to 100 after it (every round, bucket and read-count window below),
  // claimed in sync_read_counts, so the coverage sums count this test's reads only (lib/sync-test-hours.ts).
  const hours = await claimHours('lib/sync-cadence.db.test.ts', [-2, 100]);
  const T0 = hours.T0;
  // Round r runs at minute 5 of hour r (rounds run :30 to :30, so this is round r).
  const at = (minute: number) => () => T0 + minute * MIN - Date.now();
  const atRound = (r: number) => at(r * 60 + 5);
  const of = freshOf();
  const tag = `f${Math.random().toString(36).slice(2, 9).padEnd(7, '0')}`;
  const ids: number[] = [];
  const accountIds: string[] = [];
  const vendorIds = new Map<number, string>();
  const lines: string[] = [];
  let n = 0;
  // A connected trader whose accounts the vendor fake lists; the connection's consent is an hour before the first round.
  const trader = async (accounts: (FakeAccount & { authorization: string })[]) => {
    const k = n++;
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${k}` });
    const bu = await broker.registerUser(`${tag}-${k}`);
    await post('/_accounts', { userId: bu.snaptradeUserId, accounts });
    await sql`update users set snaptrade_user_id = ${bu.snaptradeUserId}, snaptrade_secret_enc = ${bu.secretEnc} where id = ${u.id}`;
    const since = new Date(T0 - HOUR);
    const snapshot = accounts.map((a) => ({ id: a.id, authorizationId: a.authorization, institution: 'Fake Brokerage', isPaper: !!a.paper, initialSyncCompleted: true }));
    const [c] = await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
      select signup_attempt_id, id, ${accounts[0].authorization}, 'connected', ${since}, ${since}, ${since}, ${sql.json(snapshot)} from users where id = ${u.id} returning id`;
    ids.push(u.id);
    accountIds.push(...accounts.map((a) => a.id));
    vendorIds.set(u.id, bu.snaptradeUserId);
    return { id: u.id, snaptrade_user_id: bu.snaptradeUserId, snaptrade_secret_enc: bu.secretEnc, vendor: bu.snaptradeUserId, secretEnc: bu.secretEnc, connection: Number(c.id), accounts: accounts.map((a) => a.id) };
  };
  const acct = (k: string, o: Partial<FakeAccount> = {}) => ({ id: `${tag}-${k}`, authorization: `${tag}-auth-${k}`, activities: [], positions: [], ...o });
  // One hourly round: runShard (the production default sync, cadence on) over every shard of this test's traders.
  const round = async (r: number): Promise<RunReport> => {
    assert.ok(hours.owns(T0 + r * HOUR), `round ${r} is outside this test's claimed hours`);
    const shards = [...new Set(ids.map((id) => id % of))];
    const reports = [];
    for (const shard of shards) reports.push(await H.runShard({ shard: { shard, of }, ids, shiftMs: atRound(r), jitterMs: 0, config: { concurrency: 2, rps: 1000, burst: 1000, page: 500 }, log: (l) => lines.push(l) }));
    const sum = { ...reports[0] };
    for (const x of reports.slice(1)) for (const k of Object.keys(x) as (keyof RunReport)[]) if (typeof x[k] === 'number') (sum[k] as number) += x[k] as number;
    return sum;
  };
  // Per-account vendor calls since the previous snapshot.
  let last = await stats();
  const delta = async () => {
    const now = await stats();
    const out: Record<string, Count> = {};
    for (const id of accountIds) {
      const a = now.accounts[id] ?? zero(), b = last.accounts[id] ?? zero();
      out[id] = { activities: a.activities - b.activities, shareMoves: a.shareMoves - b.shareMoves, positions: a.positions - b.positions, failed: a.failed - b.failed };
    }
    let lists = 0;
    for (const v of vendorIds.values()) lists += (now.lists[v] ?? 0) - (last.lists[v] ?? 0);
    last = now;
    return { accounts: out, lists };
  };
  const ba = async (id: string) => (await sql`select activities_read_at, positions_read_at, is_paper from broker_accounts where account_id = ${id}`)[0];
  const marks = async (uid: number, id: string) => (await sql`select activities_attempted_at, positions_reads::text[] as reads from sync_read_marks where user_id = ${uid} and account_id = ${id}`)[0];
  const open = async (uid: number) => (await sql`select account_id, symbol, unrealized_pct from open_positions where user_id = ${uid} order by account_id, symbol`).map((x) => ({ ...x }));
  const closed = async (uid: number) => (await sql`select account_id, symbol, return_pct from closed_trades where user_id = ${uid} order by account_id, symbol, closed_at`).map((x) => ({ ...x }));
  // The shifted database clock at round r, minute m (for writes a test makes "now").
  const dbAt = (r: number, extraMin = 0) => new Date(T0 + (r * 60 + 5 + extraMin) * MIN);
  const cleanup = async () => {
    await post('/_fail', { status: 500, times: 0 });
    if (ids.length) await sql`delete from users where id in ${sql(ids)}`;
    if (accountIds.length) await sql`delete from broker_accounts where account_id in ${sql(accountIds)}`;
    await sql`delete from sync_shards where of = ${of}`;
    await hours.release();
  };
  return { sql, H, S, broker, T0, at, atRound, of, tag, ids, trader, acct, round, delta, ba, marks, open, closed, dbAt, cleanup, lines };
}

// The model of dueSql in minutes (the same as lib/sync-cadence.test.ts#flagsAt; kept here so this file does not import
// that file's tests). The last test checks the SQL against it.
type ModelState = { readAt: number | null; attemptedAt: number | null; posReads: number[]; consent: number };
function flagsAt(s: ModelState, t: number): DueFlags {
  const ACT = ACTIVITIES_EVERY_MS / MIN, POS = POSITIONS_EVERY_MS / MIN, FLOOR = ATTEMPT_FLOOR_MS / MIN, SLACK = FUTURE_SLACK_MS / MIN;
  const free = (col: number | null, every: number) => col === null || col <= t - every || col > t + SLACK || col < s.consent;
  const inWindow = s.posReads.filter((r) => r > t - ACT && r <= t + SLACK).length;
  const past = s.posReads.filter((r) => r <= t + SLACK);
  const lastPos = past.length ? Math.max(...past) : null;
  return {
    activities_due: free(s.readAt, ACT) && free(s.attemptedAt, FLOOR),
    positions_own: free(lastPos, POS) && inWindow <= POSITIONS_PER_DAY - 2,
    positions_24h: inWindow,
    consent_new: (s.readAt === null || s.readAt < s.consent) && (s.attemptedAt === null || s.attemptedAt < s.consent || s.attemptedAt > t + SLACK),
  };
}

// The most calls in any 24 consecutive rounds [i, i + 24), and the longest gap between calls (from the first round to the last).
const window24 = (perRound: number[]) => Math.max(0, ...perRound.map((_, i) => perRound.slice(i, i + 24).reduce((a, b) => a + b, 0)));
const maxGap = (perRound: number[]) => { let g = 0, prev = 0; perRound.forEach((x, i) => { if (x) { g = Math.max(g, i - prev); prev = i; } }); return Math.max(g, perRound.length - 1 - prev); };

dbTest('48 hourly rounds through the real runner and the vendor fake: per account ≤ 1 activities and ≤ 1 share-move read and ≤ 4 positions reads in any 24 h (a rolled-back read retried after the 6 h floor is the only extra), liveness 26 h / 14 h, a missed round, deferrals only after rollbacks, and the run counters equal the vendor counts', async () => {
  const h = await harness();
  try {
    const a = h.acct('a', { activities: [buy('a1', 'AAA', '2024-02-01'), sell('a2', 'AAA', '2024-02-02', 110)], positions: [held('BBB', 0.05)] });
    const b1 = h.acct('b1', { activities: [buy('b1', 'CCC', '2024-02-01')], positions: [held('CCC', -0.1)] });
    const b2 = h.acct('b2', { authorization: b1.authorization, activities: [buy('b2', 'DDD', '2024-02-01'), sell('b3', 'DDD', '2024-02-03', 90)], positions: [] });
    const c = h.acct('c', { activities: [buy('c1', 'EEE', '2024-02-01')], positions: [held('EEE', 0.2)] });
    const A = await h.trader([a]), B = await h.trader([b1, b2]), C = await h.trader([c]);
    const accts = [a.id, b1.id, b2.id, c.id];
    const per = new Map(accts.map((id) => [id, { activities: [] as number[], shareMoves: [] as number[], positions: [] as number[], failed: [] as number[] }]));
    // The rollbacks: from round 7, B's second account's next positions call fails (a positions-only round: b1's read
    // returned and is recorded, the sync rolls back); from round 24, C's next positions call fails, right after its daily
    // activities read (round 24 or 25: exactly 24 h is due or not by milliseconds). Found from the vendor's failed counts.
    const rollbacks = new Map<string, number[]>(accts.map((id) => [id, []]));
    const owners = new Map([[a.id, [a.id]], [b1.id, [b1.id, b2.id]], [b2.id, [b1.id, b2.id]], [c.id, [c.id]]]);
    const MISSED = 30;
    const deferredAt: number[] = [];
    const runTotals = { lists: 0, activities: 0, positions: 0 };
    const vendorTotals = { lists: 0, activities: 0, positions: 0 };
    for (let r = 0; r < 48; r++) {
      if (r === 7) await post('/_fail', { status: 503, times: 1, match: `/accounts/${b2.id}/positions` });
      if (r === 24) await post('/_fail', { status: 503, times: 1, match: `/accounts/${c.id}/positions` });
      let rep: RunReport | null = null;
      if (r !== MISSED) rep = await h.round(r);
      const d = await h.delta();
      for (const id of accts) {
        const x = d.accounts[id], p = per.get(id)!;
        p.activities.push(x.activities); p.shareMoves.push(x.shareMoves); p.positions.push(x.positions); p.failed.push(x.failed);
      }
      if (rep) {
        if (rep.readsDeferred) deferredAt.push(r);
        runTotals.lists += rep.accountLists; runTotals.activities += rep.activitiesReads; runTotals.positions += rep.positionsReads;
        assert.equal(rep.failed + rep.refused + rep.quarantined, 0, `round ${r}`);
        assert.equal(rep.transient, accts.reduce((s, id) => s + d.accounts[id].failed, 0), `round ${r}: transient`);
      }
      for (const id of accts) if (owners.get(id)!.some((o) => d.accounts[o].failed)) rollbacks.get(id)!.push(r);
      vendorTotals.lists += d.lists;
      for (const id of accts) { vendorTotals.activities += d.accounts[id].activities; vendorTotals.positions += d.accounts[id].positions + d.accounts[id].failed; }
    }
    // The run's counters (G9) are the vendor's own counts: lists, activities reads (single-page accounts) and positions
    // calls (failed ones included: the call was made).
    assert.deepEqual(runTotals, vendorTotals);
    for (const id of accts) {
      const p = per.get(id)!;
      const rb = rollbacks.get(id) ?? [];
      // An activities read that rolled back is retried once the 6 h floor has passed: the only extra read in a window.
      const rolledActs = p.activities.map((x, i) => (rb.includes(i) ? x : 0));
      for (let i = 0; i < 48; i++) {
        const w = (xs: number[]) => xs.slice(i, i + 24).reduce((s, x) => s + x, 0);
        assert.ok(w(p.activities) - w(rolledActs) <= 1, `${id} rounds ${i}–${i + 23}: ${w(p.activities)} activities reads (${w(rolledActs)} rolled back)`);
        assert.ok(w(p.shareMoves) - w(rolledActs) <= 1, `${id} rounds ${i}–${i + 23}: ${w(p.shareMoves)} share-move reads`);
        assert.ok(w(p.activities) + w(p.shareMoves) <= 2 + 2 * w(rolledActs), `${id}: activities-endpoint calls`);
      }
      if (!rb.length) assert.equal(window24(p.activities), 1, `${id}: activities in any 24 rounds`);
      assert.ok(window24(p.positions) <= 4, `${id}: ${window24(p.positions)} positions reads in 24 rounds (${p.positions.join('')})`);
      assert.ok(window24(p.positions.map((x, i) => x + p.failed[i])) <= 5, `${id}: positions calls with failures`);
      // Liveness: activities at least every 26 h, positions at least every 14 h (the missed round included).
      assert.ok(maxGap(p.activities) <= 26, `${id}: activities gap ${maxGap(p.activities)} (${p.activities.join('')})`);
      assert.ok(maxGap(p.positions) <= 14, `${id}: positions gap ${maxGap(p.positions)} (${p.positions.join('')})`);
      assert.equal(p.activities[0], 1, `${id}: read at once on the first round`);
      assert.equal(p.activities[MISSED] + p.positions[MISSED], 0);
    }
    const all = [...new Set([...rollbacks.values()].flat())];
    assert.equal(rollbacks.get(b1.id)!.length, 1);
    assert.ok(rollbacks.get(b1.id)![0] <= 8);
    // Deferrals only while rollbacks occur (within 24 h after one).
    for (const r of deferredAt) assert.ok(all.some((x) => r > x && r - x < 24), `deferred at round ${r} with no rollback in the 24 h before (${all})`);
    // C's rolled-back daily read was re-read once the 6 h floor had passed, not before.
    const cp = per.get(c.id)!;
    const [R] = rollbacks.get(c.id)!;
    assert.ok(R === 24 || R === 25, `C rolled back at round ${R}`);
    assert.equal(cp.activities[R], 1);
    assert.equal(cp.activities.slice(R + 1, R + 6).reduce((s, x) => s + x, 0), 0, 'no re-read inside the 6 h floor');
    assert.equal(cp.activities.slice(R + 6, R + 10).reduce((s, x) => s + x, 0), 1, `re-read once the floor passed (round ${MISSED} missed): ${cp.activities.join('')}`);
    // The records: every closed trade published, every position listed.
    assert.equal((await h.closed(A.id)).length, 1);
    assert.equal((await h.closed(B.id)).length, 1);
    assert.deepEqual((await h.open(C.id)).map((x) => x.symbol), ['EEE']);
    // Logs: counts only (no handle, account or vendor id).
    for (const l of h.lines) assert.doesNotMatch(l, new RegExp(h.tag));
  } finally {
    await h.cleanup();
  }
});

dbTest('consent exemption: a reconnect makes the next round read activities and positions at once despite fresh timestamps, then the caps resume; importStep calls the vendor whatever the timestamps say and its first hourly sync reads at once; "Importing your record" never waits', async () => {
  const h = await harness();
  try {
    const x = h.acct('x', { activities: [buy('x1', 'AAA', '2024-02-01')], positions: [held('AAA', 0.1)] });
    const X = await h.trader([x]);
    const reads = async (r: number) => { await h.round(r); return (await h.delta()).accounts[x.id]; };
    assert.deepEqual(await reads(0), { activities: 1, shareMoves: 1, positions: 1, failed: 0 });
    assert.deepEqual(await reads(1), zero());
    // Round 2: a reconnect (connected_at = the shifted now): read at once although both timestamps are an hour fresh.
    await h.sql`update connections set connected_at = ${h.dbAt(2, -1)} where id = ${X.connection}`;
    assert.deepEqual(await reads(2), { activities: 1, shareMoves: 1, positions: 1, failed: 0 });
    // Then the caps resume: no activities read until 24 h after round 2, positions on their own clock.
    const later: { activities: number; positions: number }[] = [];
    for (let r = 3; r <= 27; r++) later.push(await reads(r));
    assert.equal(later.slice(0, 23).reduce((s, c) => s + c.activities, 0), 0, 'no activities read in rounds 3–25');
    assert.equal(later.reduce((s, c) => s + c.activities, 0), 1, 'the daily read at round 26 or 27');
    assert.ok(later.slice(0, 5).every((c) => c.positions === 0), 'positions held by their 6 h clock after the consent read');
    assert.ok(window24([1, ...later.map((c) => c.positions)]) <= 4);

    // The consented import: timestamps and marks set to "now", then importStep reads every page, the share moves and the
    // positions at once, one vendor step per call, never deferred.
    const { importStep } = await import('./connections.ts');
    const y = h.acct('y', { activities: [buy('y1', 'BBB', '2024-02-01'), sell('y2', 'BBB', '2024-02-02', 95)], positions: [held('CCC', -0.05)] });
    const Y = await h.trader([y]);
    const tImp = h.dbAt(30, 10);
    await h.sql`update connections set state = 'importing', connected_at = null, import_cursor = '{}' where id = ${Y.connection}`;
    await h.sql`insert into broker_accounts (account_id, user_id, confirmed_at, is_paper, activities_read_at, positions_read_at)
      values (${y.id}, ${Y.id}, ${tImp}, false, ${tImp}, ${tImp})`;
    await h.sql`insert into sync_read_marks (user_id, account_id, activities_attempted_at, positions_reads) values (${Y.id}, ${y.id}, ${tImp}, array[${tImp}::timestamptz])`;
    await h.delta();
    const steps = [];
    let res;
    for (let i = 0; i < 10; i++) {
      res = await importStep(Y.connection, { ...h.broker }, new Date(tImp.getTime() + (i + 1) * 1000));
      steps.push(res);
      if (res.state !== 'importing') break;
    }
    assert.equal(res!.state, 'connected');
    assert.ok(steps.every((s) => s.progressed && !('retryAt' in s && s.retryAt)), JSON.stringify(steps));
    const imp = (await h.delta()).accounts[y.id];
    assert.deepEqual({ a: imp.activities, s: imp.shareMoves, p: imp.positions }, { a: 1, s: 1, p: 1 });
    assert.equal((await h.closed(Y.id)).length, 1);
    // The import never wrote the timestamps (G5).
    assert.equal((await h.ba(y.id)).activities_read_at.getTime(), tImp.getTime());
    // Its first hourly sync (round 31) reads at once, whatever the timestamps say; the next round does not.
    await h.round(31);
    assert.deepEqual((await h.delta()).accounts[y.id], { activities: 1, shareMoves: 1, positions: 1, failed: 0 });
    await h.round(32);
    assert.deepEqual((await h.delta()).accounts[y.id], zero());
  } finally {
    await h.cleanup();
  }
});

dbTest('a failed vendor call leaves the timestamps and marks unchanged and the next round reads; a null timestamp syncs; a timestamp 10 days in the future syncs', async () => {
  const h = await harness();
  try {
    const x = h.acct('x', { activities: [buy('x1', 'AAA', '2024-02-01')], positions: [held('AAA', 0.1)] });
    const X = await h.trader([x]);
    await h.round(0);
    await h.delta();
    let before = await h.ba(x.id), m0 = await h.marks(X.id, x.id);
    assert.ok(before.activities_read_at && m0.activities_attempted_at);
    // The daily activities read (round 24 or 25) fails (503).
    await post('/_fail', { status: 503, times: 1, match: `/accounts/${x.id}/activities` });
    let R = 24, failedRound = false;
    for (; R <= 25 && !failedRound; R++) {
      before = await h.ba(x.id); m0 = await h.marks(X.id, x.id);
      const rep = await h.round(R);
      failedRound = (await h.delta()).accounts[x.id].failed === 1;
      assert.equal(rep.transient, failedRound ? 1 : 0);
    }
    assert.ok(failedRound, 'the daily read was attempted');
    const after24 = await h.ba(x.id), m24 = await h.marks(X.id, x.id);
    assert.equal(after24.activities_read_at.getTime(), before.activities_read_at.getTime(), 'activities_read_at unchanged');
    assert.equal(after24.positions_read_at.getTime(), before.positions_read_at.getTime(), 'positions_read_at unchanged');
    assert.equal(m24.activities_attempted_at.getTime(), m0.activities_attempted_at.getTime(), 'no attempt mark for a failed call');
    assert.deepEqual(m24.reads, m0.reads);
    // The next round reads.
    await h.round(R);
    const d25 = (await h.delta()).accounts[x.id];
    assert.deepEqual({ a: d25.activities, p: d25.positions }, { a: 1, p: 1 });
    assert.ok((await h.ba(x.id)).activities_read_at > before.activities_read_at);
    // A null timestamp (a column bug that wiped both the committed read and the marks) syncs at once.
    await h.sql`update broker_accounts set activities_read_at = null, positions_read_at = null where account_id = ${x.id}`;
    await h.sql`delete from sync_read_marks where user_id = ${X.id}`;
    await h.round(R + 1);
    let d = (await h.delta()).accounts[x.id];
    assert.deepEqual({ a: d.activities, p: d.positions }, { a: 1, p: 1 });
    // A null committed read with marks past the 6 h floor syncs too.
    await h.sql`update broker_accounts set activities_read_at = null where account_id = ${x.id}`;
    await h.round(R + 8);
    d = (await h.delta()).accounts[x.id];
    assert.equal(d.activities, 1);
    // A timestamp 10 days in the future (columns and marks) is treated as due.
    const future = h.dbAt(R + 9 + 240);
    await h.sql`update broker_accounts set activities_read_at = ${future}, positions_read_at = ${future} where account_id = ${x.id}`;
    await h.sql`update sync_read_marks set activities_attempted_at = ${future}, positions_reads = array[${future}::timestamptz, ${future}::timestamptz, ${future}::timestamptz, ${future}::timestamptz] where user_id = ${X.id}`;
    await h.round(R + 9);
    d = (await h.delta()).accounts[x.id];
    assert.deepEqual({ a: d.activities, p: d.positions }, { a: 1, p: 1 });
    assert.ok((await h.ba(x.id)).activities_read_at < future);
    // ... and the future marks do not take the caps away afterwards: the next rounds read positions on their 6 h clock.
    let pos = 0;
    for (let r = R + 10; r <= R + 15; r++) { await h.round(r); pos += (await h.delta()).accounts[x.id].positions; }
    assert.ok(pos <= 1, `${pos} positions reads in the 6 rounds after a future mark`);
    // Only the committed column in the future: due as well.
    await h.sql`update broker_accounts set activities_read_at = ${future} where account_id = ${x.id}`;
    await h.sql`update sync_read_marks set activities_attempted_at = ${h.dbAt(R)} where user_id = ${X.id}`;
    await h.round(R + 16);
    assert.equal((await h.delta()).accounts[x.id].activities, 1);
  } finally {
    await h.cleanup();
  }
});

dbTest('a rebuild that always fails (syncUser with cadence, 24 hourly clocks): at most 4 activities and 4 positions reads in 24 h, for an account read before and for one never read', async () => {
  const h = await harness();
  try {
    const x = h.acct('x', { activities: [buy('x1', 'AAA', '2024-02-01')], positions: [held('AAA', 0.1)] });
    const y = h.acct('y', { activities: [buy('y1', 'BBB', '2024-02-01')], positions: [held('BBB', 0.1)] });
    const X = await h.trader([x]), Y = await h.trader([y]);
    // X was read successfully a day before round 0 (rounds −24; its consent two days before); Y never.
    await h.sql`update connections set connected_at = ${h.dbAt(-48)} where id = ${X.connection}`;
    await h.S.syncUser(X, h.S.defaultBroker, undefined, h.dbAt(-24), { cadence: true, shiftMs: h.atRound(-24)() });
    await h.delta();
    const failing = async () => { throw new Error('rebuild rejects this record'); };
    const per = new Map([[x.id, { a: [] as number[], s: [] as number[], p: [] as number[] }], [y.id, { a: [] as number[], s: [] as number[], p: [] as number[] }]]);
    for (let r = 0; r < 24; r++) {
      for (const u of [X, Y]) {
        try { await h.S.syncUser(u, h.S.defaultBroker, failing, h.dbAt(r), { cadence: true, shiftMs: h.atRound(r)() }); } catch { /* the rebuild's failure */ }
      }
      const d = await h.delta();
      for (const id of [x.id, y.id]) { const p = per.get(id)!; p.a.push(d.accounts[id].activities); p.s.push(d.accounts[id].shareMoves); p.p.push(d.accounts[id].positions); }
    }
    for (const [id, p] of per) {
      const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
      assert.ok(sum(p.a) <= 4, `${id}: ${sum(p.a)} activities reads in 24 h (${p.a.join('')})`);
      assert.ok(sum(p.s) <= 4, `${id}: ${sum(p.s)} share-move reads in 24 h`);
      assert.ok(sum(p.p) <= 4, `${id}: ${sum(p.p)} positions reads in 24 h (${p.p.join('')})`);
      assert.ok(sum(p.a) >= 3, `${id}: still retried (${p.a.join('')})`);
    }
    // Nothing was ever committed for Y; X keeps its committed read of round −24.
    assert.equal((await h.ba(y.id))?.activities_read_at ?? null, null); // even its claim rolled back each time
    assert.equal((await h.closed(Y.id)).length, 0);
  } finally {
    await h.cleanup();
  }
});

dbTest('TR-4: a position closed at a loss stays listed while only positions are read, and the closed trade replaces it at the next activities read: never missing from both; a paper flip removes positions and rebuilds that round; an account no longer listed loses its positions', async () => {
  const h = await harness();
  try {
    const rows = [buy('z1', 'ZZZ', '2024-03-01')];
    const z = h.acct('z', { activities: rows, positions: [held('ZZZ', -0.2)] });
    const Z = await h.trader([z]);
    await h.round(0);
    assert.deepEqual((await h.open(Z.id)).map((p) => [p.symbol, Math.round(p.unrealized_pct * 100)]), [['ZZZ', -20]]);
    assert.equal((await h.closed(Z.id)).length, 0);
    await h.delta();
    // After round 0 the trader sells at −20%: the vendor no longer lists the position and has the closing sell.
    await post('/_accounts', { userId: Z.vendor, accounts: [{ ...z, activities: [...rows, sell('z2', 'ZZZ', '2024-03-05', 80)], positions: [] }] });
    let positionsOnly = 0, readAt = -1;
    for (let r = 1; r <= 26; r++) {
      await h.round(r);
      const d = (await h.delta()).accounts[z.id];
      const o = (await h.open(Z.id)).map((p) => p.symbol), c = await h.closed(Z.id);
      assert.ok(o.includes('ZZZ') || c.some((t) => t.symbol === 'ZZZ'), `round ${r}: the loss is missing from both lists`);
      if (d.activities) { readAt = r; break; }
      if (d.positions) positionsOnly++;
      assert.deepEqual(o, ['ZZZ'], `round ${r}: a positions-only read never removes`);
      assert.equal(c.length, 0, `round ${r}`);
    }
    assert.ok(positionsOnly >= 2, `positions were read on their own clock (${positionsOnly})`);
    assert.ok(readAt >= 24, `activities read at round ${readAt}`);
    assert.deepEqual(await h.open(Z.id), []);
    assert.deepEqual((await h.closed(Z.id)).map((t) => [t.symbol, Math.round(t.return_pct * 100)]), [['ZZZ', -20]]);

    // A paper flip: p2 becomes simulated at the vendor. The next round (no activities due) removes its positions and
    // rebuilds the record without its trades; p1 is left as it was.
    const p1 = h.acct('p1', { activities: [buy('p1b', 'AAA', '2024-02-01'), sell('p1s', 'AAA', '2024-02-02', 110)], positions: [held('BBB', 0.1)] });
    const p2 = h.acct('p2', { authorization: p1.authorization, activities: [buy('p2b', 'CCC', '2024-02-01'), sell('p2s', 'CCC', '2024-02-02', 120)], positions: [held('DDD', 0.3)] });
    const P = await h.trader([p1, p2]);
    await h.round(40);
    assert.deepEqual((await h.closed(P.id)).map((t) => t.account_id), [p1.id, p2.id]);
    assert.deepEqual((await h.open(P.id)).map((t) => t.account_id), [p1.id, p2.id]);
    await h.round(41);
    await h.delta();
    await post('/_accounts', { userId: P.vendor, accounts: [p1, { ...p2, paper: true }] });
    await h.round(42);
    const d42 = (await h.delta()).accounts;
    assert.equal(d42[p1.id].activities + d42[p2.id].activities, 0, 'no activities due');
    assert.equal((await h.ba(p2.id)).is_paper, true);
    assert.deepEqual((await h.open(P.id)).map((t) => t.account_id), [p1.id], 'the paper account lost its positions');
    assert.deepEqual((await h.closed(P.id)).map((t) => t.account_id), [p1.id], 'rebuilt that round without the paper account');
    // p1 no longer listed (p2 still listed, so the connection stays): p1 loses its positions next round, its record stays.
    await post('/_accounts', { userId: P.vendor, accounts: [{ ...p2, paper: true }] });
    await h.round(43);
    assert.deepEqual(await h.open(P.id), []);
    assert.deepEqual((await h.closed(P.id)).map((t) => t.account_id), [p1.id]);
  } finally {
    await h.cleanup();
  }
});

dbTest('business lead: a reconnect whose read rolls back fills the positions window; the forced read finds it full, so activities wait with positions, and no closed trade is published while its open position was removed (and the reverse)', async () => {
  const h = await harness();
  try {
    const rows = [buy('x1', 'ZZZ', '2024-03-01')];
    const x = h.acct('x', { activities: rows, positions: [held('ZZZ', -0.3)] });
    const y = h.acct('y', { authorization: x.authorization, activities: [buy('y1', 'YYY', '2024-03-01')], positions: [held('YYY', 0.1)] });
    const X = await h.trader([x, y]);
    const xs: { a: number; p: number; deferred: number }[] = [];
    const check = async (r: number) => {
      const o = (await h.open(X.id)).filter((p) => p.account_id === x.id).map((p) => p.symbol), c = (await h.closed(X.id)).filter((t) => t.account_id === x.id);
      assert.ok(o.includes('ZZZ') !== c.some((t) => t.symbol === 'ZZZ'), `round ${r}: ZZZ listed ${o.includes('ZZZ')}, closed ${c.length}`);
    };
    for (let r = 0; r <= 15; r++) {
      const rep = await h.round(r);
      const d = (await h.delta()).accounts[x.id];
      xs.push({ a: d.activities, p: d.positions, deferred: rep.readsDeferred });
      if (r === 0) await post('/_accounts', { userId: X.vendor, accounts: [{ ...x, activities: [...rows, sell('x2', 'ZZZ', '2024-03-04', 70)], positions: [] }, y] });
      await check(r);
    }
    // Round 16: a reconnect; the consent read of x returns (recorded), y's positions call fails, the sync rolls back.
    await h.sql`update connections set connected_at = ${h.dbAt(16, -1)} where id = ${X.connection}`;
    await post('/_fail', { status: 503, times: 1, match: `/accounts/${y.id}/positions` });
    for (let r = 16; r <= 30; r++) {
      const rep = await h.round(r);
      const d = (await h.delta()).accounts[x.id];
      xs.push({ a: d.activities, p: d.positions, deferred: rep.readsDeferred });
      await check(r);
    }
    assert.equal(xs[16].a, 1, 'the consent read at once');
    const m = await h.marks(X.id, x.id);
    assert.equal(m.reads.length, 4);
    // Within the 24 h after the rolled-back consent read, x's activities are read at most once more, and only together
    // with positions; while the window is full they are deferred (counted).
    const after = xs.slice(17);
    for (const [i, s] of after.entries()) if (s.a) assert.equal(s.p, 1, `round ${17 + i}: activities without positions`);
    assert.ok(after.some((s) => s.deferred > 0), `deferred while the window was full (${JSON.stringify(after)})`);
    assert.equal(after.reduce((s, v) => s + v.a, 0), 1, 'read once the window had a slot');
    const posRounds = xs.map((s) => s.p);
    assert.ok(window24(posRounds) <= 4, `x positions reads in 24 rounds: ${posRounds.join('')}`);
    // At the end: the loss is a closed trade and no longer an open position.
    assert.deepEqual((await h.closed(X.id)).filter((t) => t.account_id === x.id).map((t) => t.symbol), ['ZZZ']);
  } finally {
    await h.cleanup();
  }
});

dbTest('coverage: capRatio and capBreach from the hourly read counts, the oldest read ages and the freshness alarm; the log line holds numbers only', async () => {
  const h = await harness();
  try {
    const accs = ['c1', 'c2', 'c3', 'c4'].map((k) => h.acct(k));
    const T = [];
    for (const a of accs) T.push(await h.trader([a]));
    const t = h.dbAt(50);
    for (const [i, a] of accs.entries()) {
      await h.sql`insert into broker_accounts (account_id, user_id, confirmed_at, is_paper, activities_read_at, positions_read_at)
        values (${a.id}, ${T[i].id}, ${t}, false, ${new Date(t.getTime() - (2 + i) * HOUR)}, ${new Date(t.getTime() - (1 + i) * HOUR)})`;
    }
    // A paper account and a removed one are not counted.
    const paper = h.acct('pp');
    await h.sql`insert into broker_accounts (account_id, user_id, is_paper, activities_read_at) values (${paper.id}, ${T[0].id}, true, ${new Date(t.getTime() - 100 * HOUR)})`;
    const hour = (back: number) => new Date(Math.floor((t.getTime() - back * HOUR) / HOUR) * HOUR);
    const bucket = (back: number, n: number) => h.sql`insert into sync_read_counts (hour, account_lists, activities, positions) values (${hour(back)}, ${n}, ${n}, ${n})
      on conflict (hour) do update set activities = excluded.activities`;
    await bucket(1, 2);
    await bucket(10, 2); // 4 reads in the last 24 h over 4 accounts: ratio 1
    await bucket(30, 50); // outside the window
    await bucket(-3, 70); // after the clock (a later hour): not in the last 24 h either
    const lines: string[] = [];
    const scope = { ids: h.ids, shiftMs: t.getTime() - Date.now() };
    let c = await h.H.coverage(1, scope, undefined, (l) => lines.push(l));
    assert.equal(c.realAccounts, 4);
    assert.equal(c.activitiesReads24h, 4);
    assert.equal(c.capRatio, 1);
    assert.equal(c.capBreach, false);
    assert.equal(c.oldestActivitiesReadHours, 5);
    assert.equal(c.oldestPositionsReadHours, 4);
    assert.equal(c.freshnessAlarm, false);
    // One more read in the window: 5 / 4 = 1.25 > 1.05.
    await h.sql`update sync_read_counts set activities = 3 where hour = ${hour(1)}`;
    c = await h.H.coverage(1, scope, undefined, (l) => lines.push(l));
    assert.equal(c.capRatio, 1.25);
    assert.equal(c.capBreach, true);
    // Ages past the alarms: activities 27 h (> 26), then positions 19 h (> 18; 15 h is a normal gap and does not alarm).
    await h.sql`update broker_accounts set activities_read_at = ${new Date(t.getTime() - 27 * HOUR)} where account_id = ${accs[0].id}`;
    c = await h.H.coverage(1, scope, undefined, (l) => lines.push(l));
    assert.equal(c.oldestActivitiesReadHours, 27);
    assert.equal(c.freshnessAlarm, true);
    await h.sql`update broker_accounts set activities_read_at = ${new Date(t.getTime() - 2 * HOUR)} where account_id = ${accs[0].id}`;
    await h.sql`update broker_accounts set positions_read_at = ${new Date(t.getTime() - 15 * HOUR)} where account_id = ${accs[1].id}`;
    c = await h.H.coverage(1, scope, undefined, (l) => lines.push(l));
    assert.equal(c.oldestPositionsReadHours, 15);
    assert.equal(c.freshnessAlarm, false);
    await h.sql`update broker_accounts set positions_read_at = ${new Date(t.getTime() - 19 * HOUR)} where account_id = ${accs[1].id}`;
    c = await h.H.coverage(1, scope, undefined, (l) => lines.push(l));
    assert.equal(c.oldestPositionsReadHours, 19);
    assert.equal(c.freshnessAlarm, true);
    // A never-read account counts as very old, not hidden.
    await h.sql`update broker_accounts set positions_read_at = null where account_id = ${accs[1].id}`;
    c = await h.H.coverage(1, scope, undefined, (l) => lines.push(l));
    assert.ok(c.oldestPositionsReadHours >= 1e6);
    assert.equal(c.freshnessAlarm, true);
    // The log: counts, ratios, flags and the database settings check only.
    assert.ok(lines.length >= 5);
    for (const l of lines) {
      assert.match(l, /^sync (coverage|round incomplete) \{/);
      assert.doesNotMatch(l, new RegExp(h.tag));
      const o = JSON.parse(l.slice(l.indexOf('{')));
      // No identifier fields (orchestrator review: a bare-number match against the line flaked on a fresh database, where
      // small user ids equal counters such as an hour count); with the value checks below, an id cannot be logged: there
      // is no key that could carry one and no string value anywhere but the fixed problem texts.
      const keys = (x: object): string[] => Object.entries(x).flatMap(([k, v]) => [k, ...(v && typeof v === 'object' && !Array.isArray(v) ? keys(v) : [])]);
      for (const k of keys(o)) assert.doesNotMatch(k, /(^|_)id$|Id$|^ids?$|user|account(?!s$)|handle/i, k);
      for (const p of (o.dbProblems ?? []) as string[]) for (const id of h.ids) assert.ok(!p.includes(String(id)), p);
      for (const [k, v] of Object.entries(o)) {
        if (k === 'dbProblems') assert.ok(Array.isArray(v) && v.every((p) => typeof p === 'string'));
        else if (k === 'db') assert.ok(Object.values(v as object).every((n) => typeof n === 'number'));
        else assert.ok(typeof v === 'number' || typeof v === 'boolean', `${k}: ${typeof v}`);
      }
    }
  } finally {
    await h.cleanup();
  }
});

dbTest('the SQL rule (dueSql) matches the unit tests\' model on 300 random states (null, old, fresh, future and pre-consent timestamps, windows of 0–4 reads)', async () => {
  const h = await harness();
  const { dueSql } = await import('./sync-cadence.ts');
  try {
    const x = h.acct('x');
    const X = await h.trader([x]);
    await h.sql`insert into broker_accounts (account_id, user_id, is_paper) values (${x.id}, ${X.id}, false)`;
    let seed = 42;
    const r = () => { seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31; return seed / 2 ** 31; };
    const T = 1000 * 60; // the clock, minutes from an epoch of the test's own
    const epoch = h.T0;
    const pick = () => { const v = r(); return v < 0.15 ? null : v < 0.3 ? T - Math.floor(r() * 400) : v < 0.4 ? T + Math.floor(r() * 20) : v < 0.45 ? T + 14_400 : T - Math.floor(r() * 3000); };
    const ts = (m: number | null) => (m === null ? null : new Date(epoch + m * MIN));
    for (let i = 0; i < 300; i++) {
      const readAt = pick(), attemptedAt = pick();
      const posReads = Array.from({ length: Math.floor(r() * 5) }, () => pick()).filter((v): v is number => v !== null).sort((a, b) => a - b);
      const consent = r() < 0.7 ? T - 3000 - Math.floor(r() * 100) : T - Math.floor(r() * 1500);
      await h.sql`update broker_accounts set activities_read_at = ${ts(readAt)} where account_id = ${x.id}`;
      const arr = `{${posReads.map((m) => ts(m)!.toISOString()).join(',')}}`;
      await h.sql`insert into sync_read_marks (user_id, account_id, activities_attempted_at, positions_reads) values (${X.id}, ${x.id}, ${ts(attemptedAt)}, ${arr}::timestamptz[])
        on conflict (user_id, account_id) do update set activities_attempted_at = excluded.activities_attempted_at, positions_reads = excluded.positions_reads`;
      await h.sql`update connections set connected_at = ${ts(consent)} where id = ${X.connection}`;
      const [d] = await h.sql`select d.* from ${dueSql(h.sql`${x.id}::text`, h.sql`${X.id}::int`, h.sql`${ts(T)}::timestamptz`)} d`;
      const want = flagsAt({ readAt, attemptedAt, posReads, consent }, T);
      assert.deepEqual({ ...d }, want, `case ${i}: ${JSON.stringify({ readAt, attemptedAt, posReads, consent, T })}`);
    }
  } finally {
    await h.cleanup();
  }
});
