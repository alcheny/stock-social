// F-2 PR-3b: "Similar trades" on a profile, against the database: other traders' trades in the profile's holding bucket,
// the same for every viewer signed out, a signed-in viewer's hidden traders (and own record) left out, an unfollow never
// a hide, losses like gains, Demo after verified, fewer than 5 closes or 3 rows → no section.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const DAY = 86_400_000;
const HOLDS = [0.5, 3, 14, 60, 300];

async function fixture(n: number, ret: (t: number, i: number) => number = (t, i) => ((t * 7 + i) % 9 - 4) / 100 || 0.01) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `m${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let t = 0; t <= n; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const at = Date.now() - 2 * DAY, traders = ids.slice(1);
  await sql`insert into closed_trades ${sql(traders.flatMap((u, t) => Array.from({ length: 8 }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `M${(t + i) % 13}`, opened_at: new Date(at - (t * 8 + i) * 60_000 - HOLDS[t % 5] * DAY),
    closed_at: new Date(at - (t * 8 + i) * 60_000), return_pct: ret(t, i), holding_days: HOLDS[t % 5] + (i % 2) * 0.1, verified: true,
  }))))}`;
  return { sql, viewer: ids[0], traders, remove: () => sql`delete from users where id in ${sql(ids)}` };
}

dbTest('rows are other traders\' trades in the profile\'s holding bucket, one per trader, in TR-9 order; the same for every signed-out request', async () => {
  const { loadSimilar, clearSimilarCache } = await import('./similar.ts');
  const { feedList } = await import('./feed.ts');
  const { holdBucket } = await import('./discovery/section.ts');
  const f = await fixture(30);
  try {
    clearSimilarCache();
    const self = f.traders[1]; // bucket 1 (3 days)
    const s = await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders });
    assert.equal(s!.rows.length, 3);
    assert.ok(s!.rows.every((r) => r.trader !== self && holdBucket(r.holdingDays) === 1 && r.bucket === 1));
    assert.equal(new Set(s!.rows.map((r) => r.trader)).size, 3);
    const hour = Math.floor(Date.now() / 3_600_000) * 3_600_000;
    const pool = (await feedList({ asOf: new Date(hour), day: new Date(hour).toISOString().slice(0, 10), ids: f.traders })).pool.filter((t) => holdBucket(t.hold) === 1 && t.trader !== self);
    assert.deepEqual(s!.rows.map((r) => r.trader), pool.slice(0, 3).map((t) => t.trader));
    // Each row is that trader's most recent close in the bucket; its pane carries the whole record.
    for (const r of s!.rows) {
      const [x] = await f.sql`select sell_id from closed_trades where user_id = ${r.trader} order by closed_at desc, sell_id desc limit 1`;
      assert.equal(r.sellId, x.sell_id);
      assert.equal(s!.byUser.get(r.trader)!.length, 8);
    }
    assert.deepEqual(await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders }), s);
    assert.equal(await loadSimilar({ trader: self, hold: 3, closes: 4, ids: f.traders }), null); // fewer than 5 closes
  } finally {
    await f.remove();
  }
});

dbTest('signed in: the viewer\'s own record and hidden traders leave the rows; an unfollow does not; fewer than 3 left → no section', async () => {
  const { loadSimilar, clearSimilarCache } = await import('./similar.ts');
  const { exclude, follow, unfollow } = await import('./follows.ts');
  const f = await fixture(30);
  try {
    clearSimilarCache();
    const self = f.traders[1];
    const out = (await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders }))!.rows.map((r) => r.trader);
    await exclude(f.viewer, out[0], 'not_interested');
    await follow(f.viewer, out[1]); await unfollow(f.viewer, out[1]);
    const mine = (await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders, viewer: f.viewer }))!.rows.map((r) => r.trader);
    assert.ok(!mine.includes(out[0]));
    assert.ok(mine.includes(out[1]), 'an unfollow is never a hide (O4)');
    // The viewer's own record is never a row of theirs.
    const asTrader = await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders, viewer: mine[0] });
    assert.ok(!asTrader!.rows.some((r) => r.trader === mine[0]));
    // Everyone else in the bucket hidden → no section.
    for (const id of f.traders) if (id !== self) await exclude(f.viewer, id, 'not_interested');
    assert.equal(await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders, viewer: f.viewer }), null);
    // Signed out the rows are unchanged.
    assert.deepEqual((await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders }))!.rows.map((r) => r.trader), out);
  } finally {
    await f.remove();
  }
});

dbTest('losses are rows under the same rules (an all-loss fixture fills the section); a Demo record reads after verified ones', async () => {
  const { loadSimilar, clearSimilarCache } = await import('./similar.ts');
  const f = await fixture(30, (t, i) => -(0.02 + ((t + i) % 5) / 100));
  try {
    clearSimilarCache();
    const s = await loadSimilar({ trader: f.traders[1], hold: 3, closes: 8, ids: f.traders });
    assert.equal(s!.rows.length, 3);
    assert.ok(s!.rows.every((r) => s!.byUser.get(r.trader)!.every((p) => p.returnPct < 0)));
    // Mark the first row's record unverified: it moves after the verified ones.
    await f.sql`update closed_trades set verified = false where user_id = ${s!.rows[0].trader}`;
    clearSimilarCache(); (await import('./feed.ts')).clearFeedCache(); // a cold server
    const d = await loadSimilar({ trader: f.traders[1], hold: 3, closes: 8, ids: f.traders });
    assert.ok(!d!.rows.slice(0, 2).some((r) => r.trader === s!.rows[0].trader));
  } finally {
    await f.remove();
  }
});

dbTest('fix round 1 (D2): the profile\'s read (panes: false) reads no row trader\'s record; the rows are the same, with verified and the trade\'s id', async () => {
  const { loadSimilar, clearSimilarCache } = await import('./similar.ts');
  const f = await fixture(30);
  try {
    clearSimilarCache();
    const full = await loadSimilar({ trader: f.traders[1], hold: 3, closes: 8, ids: f.traders });
    clearSimilarCache();
    const lite = await loadSimilar({ trader: f.traders[1], hold: 3, closes: 8, ids: f.traders, panes: false });
    assert.deepEqual(lite!.rows, full!.rows);
    assert.equal(lite!.byUser.size, 0);
    for (const r of lite!.rows) {
      assert.equal(r.verified, true);
      const [x] = await f.sql`select id, return_pct from closed_trades where sell_id = ${r.sellId}`;
      assert.equal(r.tradeId, String(x.id));
      assert.equal(r.returnPct, x.return_pct);
    }
    await f.sql`update closed_trades set verified = false where user_id = ${lite!.rows[0].trader} and sell_id <> ${lite!.rows[0].sellId}`;
    clearSimilarCache();
    const again = await loadSimilar({ trader: f.traders[1], hold: 3, closes: 8, ids: f.traders, panes: false });
    assert.equal(again!.rows.find((r) => r.trader === lite!.rows[0].trader)?.verified ?? false, false);
  } finally {
    await f.remove();
  }
});

// Known limits sweep 2 (`similar`): the per-request bucket walk and the pool shared between servers (similar_pools).
// Each "server" is its own instance of the module (`./similar.ts?s=…`) with the same database. Their shared-pool rows
// are this file's own scopes (`ids` lists of the fixtures made here), deleted in finally.
const PURE_HOLDS = [0.2, 0.9, 1, 3, 7, 7.5, 20, 28, 29, 100, 183, 184, 400];
function randomPool(seed: number, n: number) {
  let x = seed;
  const rnd = () => (x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  return Array.from({ length: n }, (_, i) => ({
    trader: 1000 + i, score: Math.round(rnd() * 100) / 10, weight: Math.round(rnd() * 8) / 4, hold: PURE_HOLDS[Math.floor(rnd() * PURE_HOLDS.length)],
    n: 5 + Math.floor(rnd() * 4), ...(rnd() < 0.2 ? { verified: false } : rnd() < 0.5 ? { verified: true } : {}),
  }));
}

test('sweep 2: the bucket walk returns exactly similarCandidates(...).slice(0, SIMILAR_SPARES) on random pools, selves and skip sets', async () => {
  const { pickFor } = await import('./similar.ts');
  const { similarCandidates, SIMILAR_SPARES } = await import('./discovery/similar.ts');
  for (let seed = 1; seed <= 60; seed++) {
    const pool = randomPool(seed, seed % 7 === 0 ? 3 : 20 + seed * 5), pick = pickFor(pool);
    for (const hold of PURE_HOLDS) for (const k of [0, 1, 5, 40]) {
      const self = pool[(seed * 3 + k) % pool.length].trader;
      const skip = new Set(pool.filter((_, i) => (i * 7 + seed) % 11 < Math.min(k, 10)).map((t) => t.trader));
      assert.deepEqual(pick(self, hold, skip), similarCandidates(pool, self, hold, skip).slice(0, SIMILAR_SPARES), `seed ${seed} hold ${hold} k ${k}`);
    }
  }
  assert.deepEqual(pickFor([])(1, 3, new Set()), []);
});

test('sweep 2: the shared pool text decodes to the same pool, NaN, Infinity, -0 and a missing verified included', async () => {
  const { encodePool, decodePool } = await import('./similar.ts');
  const pool = [...randomPool(9, 30), { trader: 1, score: Number.NaN, weight: Infinity, hold: -Infinity, n: -0 }, { trader: 2, score: -0.5, weight: 1e-7, hold: 1 / 3, n: 5, verified: false }];
  assert.deepEqual(decodePool(encodePool(pool)), pool);
});

type Instance = typeof import('./similar.ts');
let serverN = 0;
async function servers(n: number, opts: { coldWaitMs?: number } = {}): Promise<Instance[]> {
  const out: Instance[] = [];
  for (let i = 0; i < n; i++) {
    const m: Instance = await import(`./similar.ts?server=${++serverN}`);
    Object.assign(m.similarTesting, { shareIds: true, dbOffsetMs: 0, builds: 0, fetches: 0, coldWaitMs: opts.coldWaitMs, beforeWrite: undefined });
    out.push(m);
  }
  return out;
}
const builds = (ss: Instance[]) => ss.reduce((a, s) => a + s.similarTesting.builds, 0);
const at = (ss: Instance[], dbOffsetMs: number) => { for (const s of ss) s.similarTesting.dbOffsetMs = dbOffsetMs; };
async function row(f: { sql: Awaited<ReturnType<typeof fixture>>['sql']; traders: number[] }, key: string) {
  return (await f.sql`select hour, built_at, claimed_at, claim, pool is not null as has_pool from similar_pools where key = ${key}`)[0];
}

dbTest('sweep 2 (AC1, AC4): three servers asking at once build the pool once; all three serve the same rows as a server-local build (today\'s path)', async () => {
  const f = await fixture(30);
  const ss = await servers(3, { coldWaitMs: 20_000 });
  const key = ss[0].similarScope(f.traders);
  try {
    const now = Date.now(), self = f.traders[1];
    const outs = await Promise.all(ss.map((s) => s.loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders, now, panes: false })));
    assert.equal(builds(ss), 1, 'one build for three servers');
    assert.equal(ss.reduce((a, s) => a + s.similarTesting.fetches, 0), 2);
    // Today's path: a server-local build (no shared row), the candidates by similarCandidates over feedList's pool.
    const local: Instance = await import(`./similar.ts?server=${++serverN}`);
    const { feedList } = await import('./feed.ts');
    const { similarCandidates, SIMILAR_SPARES } = await import('./discovery/similar.ts');
    const hour = Math.floor(now / 3_600_000) * 3_600_000;
    const pool = (await feedList({ asOf: new Date(hour), day: new Date(hour).toISOString().slice(0, 10), ids: f.traders })).pool;
    const shared = await ss[2].similarPool(now, f.traders);
    assert.deepEqual(shared.pool, pool);
    for (const [i, hold] of [0.5, 3, 14, 60, 300].entries()) {
      const me = f.traders[i + 2], skip = new Set([f.traders[(i * 5 + 7) % 30]]);
      assert.deepEqual(shared.pick(me, hold, skip), similarCandidates(pool, me, hold, skip).slice(0, SIMILAR_SPARES));
      const opts = { trader: me, hold, closes: 8, ids: f.traders, now, panes: false };
      assert.deepEqual(await ss[1].loadSimilar(opts), await local.loadSimilar(opts));
    }
    for (const o of outs) assert.deepEqual(o, outs[0]);
    assert.equal((await row(f, key)).has_pool, true);
  } finally {
    await f.sql`delete from similar_pools where key = ${key}`;
    await f.remove();
  }
});

dbTest('sweep 2 (AC5, AC6): over simulated time the three servers rebuild at most once per SIMILAR_REFRESH_MS; a trader added after a build reaches every server within 2 intervals', async () => {
  const f = await fixture(30);
  const ss = await servers(3, { coldWaitMs: 20_000 });
  const key = ss[0].similarScope(f.traders);
  const late = f.traders[29];
  try {
    const t0 = Date.now() - (Date.now() % 3_600_000) + 60_000; // inside one hour throughout
    await f.sql`delete from closed_trades where user_id = ${late}`; // not eligible at the first build
    const ask = (dt: number) => { at(ss, dt); return Promise.all(ss.map((s) => s.similarPool(t0 + dt, f.traders))); };
    await ask(0);
    assert.equal(builds(ss), 1);
    assert.ok(!(await ss[0].similarPool(t0, f.traders)).pool.some((t) => t.trader === late));
    await f.sql`insert into closed_trades ${f.sql(Array.from({ length: 8 }, (_, i) => ({ user_id: late, sell_id: `late-${late}-${i}`, account_id: 'a', symbol: 'LT',
      opened_at: new Date(Date.now() - 6 * DAY), closed_at: new Date(Date.now() - 3 * DAY - i * 60_000), return_pct: 0.02, holding_days: 3, verified: true })))}`;
    for (const dt of [1_000, 5_000, 9_000]) { await ask(dt); await Promise.all(ss.map((s) => s.similarSettled())); }
    assert.equal(builds(ss), 1, 'no rebuild inside one interval');
    for (const dt of [11_000, 12_000, 15_000]) { await ask(dt); await Promise.all(ss.map((s) => s.similarSettled())); }
    assert.equal(builds(ss), 2, 'one rebuild for the next interval, across all three servers');
    for (const dt of [22_000, 25_000]) { await ask(dt); await Promise.all(ss.map((s) => s.similarSettled())); }
    assert.ok(builds(ss) <= 3, `builds ${builds(ss)} over 25 s (a server-local cache: 9)`);
    for (const s of ss) assert.ok((await s.similarPool(t0 + 25_000, f.traders)).pool.some((t) => t.trader === late), 'the added trader is in every server\'s pool');
  } finally {
    await f.sql`delete from similar_pools where key = ${key}`;
    await f.remove();
  }
});

dbTest('sweep 2 (AC7): a dead claim makes a cold server wait at most the cold wait, then build itself; the lease is taken over later; a stale builder\'s write is fenced off', async () => {
  const f = await fixture(30);
  const [a, b] = await servers(2, { coldWaitMs: 300 });
  const key = a.similarScope(f.traders);
  try {
    const now = Date.now(), hour = new Date(Math.floor(now / 3_600_000) * 3_600_000);
    await f.sql`insert into similar_pools (key, hour, claimed_at, claim) values (${key}, ${hour}, now(), 'dead')`;
    const s = performance.now();
    const k = await a.similarPool(now, f.traders);
    assert.ok(performance.now() - s < 300 + 5_000, 'no wait for the 60 s lease');
    assert.ok(k.pool.length > 0);
    assert.equal(a.similarTesting.builds, 1);
    assert.equal((await row(f, key)).claim, 'dead', 'the dead claim still holds inside its lease');
    // After the lease: A claims and builds, and B takes the claim over while A is still building (A's lease looks
    // expired to B). A's late write must not land.
    at([a], 61_000); at([b], 61_000 + 61_000);
    let bWrote = false;
    a.similarTesting.beforeWrite = async () => { await b.similarPool(now + 1, f.traders); bWrote = true; };
    a.similarPool(now + 11_000, f.traders);
    await a.similarSettled();
    assert.ok(bWrote);
    const r = await row(f, key);
    assert.equal(r.claim, null); assert.equal(r.has_pool, true);
    const [{ ok }] = await f.sql`select built_at > now() + interval '100 seconds' as ok from similar_pools where key = ${key}`;
    assert.equal(ok, true, 'the row holds B\'s build (claimed at +122 s), not A\'s (+61 s)');
  } finally {
    await f.sql`delete from similar_pools where key = ${key}`;
    await f.remove();
  }
});

dbTest('sweep 2 (AC8): a previous hour\'s row, or a stale one, is never served to a cold server, and a server a whole hour behind never moves the row\'s hour back', async () => {
  const f = await fixture(30);
  const [a, b, c] = await servers(3, { coldWaitMs: 5_000 });
  const key = a.similarScope(f.traders);
  try {
    const now = Date.now(), prev = now - 3_600_000;
    await a.similarPool(prev, f.traders);
    assert.equal(a.similarTesting.builds, 1);
    await b.similarPool(now, f.traders);
    assert.equal(b.similarTesting.builds, 1, 'the cold server built the current hour');
    const [r] = await f.sql`select ${f.sql`(extract(epoch from hour) * 1000)::float8`} as h from similar_pools where key = ${key}`;
    assert.equal(r.h, Math.floor(now / 3_600_000) * 3_600_000);
    at([c], 30_000);
    await c.similarPool(prev, f.traders); // a server whose clock is an hour behind: serves the newer row, builds nothing
    assert.equal(c.similarTesting.builds, 0);
    const [r2] = await f.sql`select ${f.sql`(extract(epoch from hour) * 1000)::float8`} as h from similar_pools where key = ${key}`;
    assert.equal(r2.h, r.h);
    // A current-hour row older than SIMILAR_REFRESH_MS is not served cold either: the cold server rebuilds it.
    const [d] = await servers(1, { coldWaitMs: 5_000 });
    at([d], 30_000);
    await d.similarPool(now, f.traders);
    assert.equal(d.similarTesting.builds, 1);
    assert.equal(d.similarTesting.fetches, 0);
  } finally {
    await f.sql`delete from similar_pools where key = ${key}`;
    await f.remove();
  }
});

dbTest('sweep 2: a trader deleted after the shared pool was built never appears from it (soft-deleted or removed)', async () => {
  const f = await fixture(30);
  const [a, b, c] = await servers(3, { coldWaitMs: 5_000 });
  const key = a.similarScope(f.traders);
  try {
    const now = Date.now(), self = f.traders[1];
    const first = (await a.loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders, now, panes: false }))!.rows.map((r) => r.trader);
    await f.sql`update users set deleted_at = now() where id = ${first[0]}`;
    const fromB = (await b.loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders, now, panes: false }))!.rows.map((r) => r.trader);
    assert.equal(b.similarTesting.builds, 0, 'served from the stale shared pool');
    assert.ok(!fromB.includes(first[0]));
    await f.sql`delete from users where id = ${first[1]}`;
    const fromC = (await c.loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders, now, panes: false }))!.rows.map((r) => r.trader);
    assert.equal(c.similarTesting.builds, 0);
    assert.ok(!fromC.includes(first[0]) && !fromC.includes(first[1]));
  } finally {
    await f.sql`delete from similar_pools where key = ${key}`;
    await f.remove();
  }
});
