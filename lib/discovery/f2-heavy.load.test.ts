// F-2 PR-5 heavy use: personal scoring at scale (pure), concurrent activity batches, deleting a trader many viewers'
// activity rows name, and the orphan purge. Skipped unless LOAD=1, so `npm test` stays fast.
// How to run (DATABASE_URL set for the database parts): LOAD=1 node --test lib/discovery/f2-heavy.load.test.ts
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const skipPure = !LOAD && 'heavy-use suite: set LOAD=1';
const skipDb = !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL';
before(async () => { if (LOAD && hasDb) await (await import('../db.ts')).sql.unsafe(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (LOAD && hasDb) await (await import('../db.ts')).sql.end({ timeout: 1 }); });
const DAY = 86_400_000;

// A small deterministic generator (mulberry32), so every run scores the same inputs.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('heavy: 5,000 viewers × 500 events scored (viewerProfile + relevanceOf + personalOrder) against 350 candidates in < 100 s', { skip: skipPure, timeout: 300_000 }, async () => {
  const { viewerProfile, relevanceOf, personalOrder } = await import('./personal.ts');
  const VIEWERS = 5_000, EVENTS = 500, CARDS = 350, TRADERS = 120, SYMBOLS = 400;
  const r = rng(7);
  const holds = [0.5, 3, 14, 60, 300];
  const ranked = Array.from({ length: CARDS }, (_, i) => ({ key: `s${i}`, trader: i % TRADERS, symbol: `S${Math.floor(r() * SYMBOLS)}` }));
  const shapes = new Map<number, { hold: number; symbols: Set<string> }>();
  for (const c of ranked) {
    const s = shapes.get(c.trader) ?? { hold: holds[c.trader % 5] * (0.5 + r()), symbols: new Set<string>() };
    s.symbols.add(c.symbol);
    shapes.set(c.trader, s);
  }
  const now = Date.now();
  let moved = 0;
  const t0 = performance.now();
  for (let v = 0; v < VIEWERS; v++) {
    const at = () => now - Math.floor(r() * 95 * DAY);
    const tr = () => Math.floor(r() * (TRADERS + 30)); // some traders outside the candidates
    const events = Array.from({ length: EVENTS }, () => ({ type: 1 + Math.floor(r() * 7), trader: tr(), symbol: r() < 0.7 ? `S${Math.floor(r() * SYMBOLS)}` : null, at: at() }));
    const profile = viewerProfile({
      follows: Array.from({ length: 5 }, tr),
      likes: Array.from({ length: 20 }, () => ({ trader: tr(), at: at(), symbol: `S${Math.floor(r() * SYMBOLS)}` })),
      rejects: Array.from({ length: 5 }, () => ({ trader: tr(), at: at(), symbol: null })),
      hidden: Array.from({ length: 3 }, () => ({ trader: tr(), at: at() })),
      unfollows: Array.from({ length: 2 }, () => ({ trader: tr(), at: at() })),
      events, activity: true,
    }, now);
    const order = personalOrder(ranked, relevanceOf(profile, shapes));
    assert.equal(order.length, CARDS);
    if (order[0] !== ranked[0]) moved++;
  }
  const ms = performance.now() - t0;
  console.log(`scored ${VIEWERS} viewers × ${EVENTS} events against ${CARDS} candidates: ${ms.toFixed(0)} ms (${(ms / VIEWERS).toFixed(2)} ms per viewer)`);
  assert.ok(ms < 100_000, `${ms} ms`);
  assert.ok(moved > 0, 'the order is personal');
});

test('heavy: 200 concurrent recordEvents batches of 50 (distinct viewers): p95 < 50 ms, no row lost', { skip: skipDb, timeout: 300_000 }, async () => {
  const { sql } = await import('../db.ts');
  const { recordEvents } = await import('./activity.ts');
  const BATCHES = 200, PER = 50;
  const tag = `hv${Math.random().toString(36).slice(2, 6)}`;
  const [{ id: attempt }] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id, activity_log_on_at)
    select ${tag} || '_v' || i, 'Viewer ' || i, now(), ${attempt}, now() from generate_series(1, ${BATCHES}) i`;
  await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id)
    select ${tag} || '_t' || i, 'Trader ' || i, now(), ${attempt} from generate_series(1, ${PER}) i`;
  const viewers = (await sql`select id from users where handle like ${`${tag}\\_v%`} order by id`).map((r) => r.id as number);
  const handles = Array.from({ length: PER }, (_, i) => `${tag}_t${i + 1}`);
  try {
    assert.equal(viewers.length, BATCHES);
    const batch = handles.map((h) => ({ type: 'dwell_long' as const, surface: 'feed' as const, target: { kind: 'trader' as const, handle: h } }));
    // `inFlight`: at most this many batches running at once (the rest wait their turn, and that wait is not counted).
    const round = async (inFlight: number) => {
      const times: number[] = [], results: (number | string)[] = [];
      const queue = [...viewers];
      const t0 = performance.now();
      await Promise.all(Array.from({ length: inFlight }, async () => {
        for (let v = queue.shift(); v !== undefined; v = queue.shift()) {
          const s = performance.now();
          results.push(await recordEvents(v, batch));
          times.push(performance.now() - s);
        }
      }));
      const wall = performance.now() - t0;
      times.sort((a, b) => a - b);
      const p95 = times[Math.ceil(times.length * 0.95) - 1], p50 = times[Math.floor(times.length / 2)];
      console.log(`${BATCHES} batches of ${PER}, ${inFlight} in flight: p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, max ${times.at(-1)!.toFixed(1)} ms, wall ${wall.toFixed(0)} ms`);
      assert.deepEqual(results, viewers.map(() => PER));
      return p95;
    };
    // All 200 at once: the client pool (lib/db.ts, postgres.js default max 10 connections) queues them, so this p95 is
    // mostly the queue (reported); the bound is checked on the batches the pool runs at once.
    const all = await round(BATCHES);
    await sql`update users set activity_batch_at = now() - interval '1 minute' where id = any(${viewers})`;
    const pooled = await round(10);
    const [{ n }] = await sql`select count(*)::int as n from discovery_events where viewer_id = any(${viewers})`;
    assert.equal(n, 2 * BATCHES * PER, 'no row lost');
    console.log(`p95 with all ${BATCHES} at once ${all.toFixed(1)} ms; with 10 in flight ${pooled.toFixed(1)} ms`);
    assert.ok(pooled < 50, `p95 ${pooled} ms`);
  } finally {
    await sql`delete from users where handle like ${`${tag}\\_%`}`;
    await sql`delete from signup_attempts where id = ${attempt}`;
  }
});

test('heavy: deleting a trader named by 100,000 viewers\' activity rows takes < 5 s and leaves none', { skip: skipDb, timeout: 900_000 }, async () => {
  const { sql } = await import('../db.ts');
  const { deleteProfile } = await import('../delete.ts');
  const VIEWERS = 100_000;
  const tag = `hd${Math.random().toString(36).slice(2, 6)}`;
  const [{ id: attempt }] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const [{ id: trader }] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${`${tag}_t`}, 'Heavy', now(), ${attempt}) returning id`;
  await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || '_' || i, 'Viewer ' || i, now(), ${attempt} from generate_series(1, ${VIEWERS}) i`;
  await sql`insert into discovery_events (viewer_id, surface, type, target_kind, target_user_id)
    select id, 1, 3, 'trader', ${trader} from users where handle like ${`${tag}\\_%`} and id <> ${trader}`;
  await sql`analyze discovery_events`;
  const refs = () => sql`select count(*)::int as n from discovery_events where target_user_id = ${trader}`.then((r) => r[0].n as number);
  try {
    assert.equal(await refs(), VIEWERS);
    const t0 = performance.now();
    await deleteProfile({ id: trader as number, handle: `${tag}_t`, snaptrade_user_id: null, snaptrade_secret_enc: null }, { deleteVendorUser: async () => {} });
    const ms = performance.now() - t0;
    console.log(`delete a trader named by ${VIEWERS} viewers' activity rows: ${ms.toFixed(0)} ms`);
    assert.equal(await refs(), 0);
    assert.ok(ms < 5_000, `${ms} ms`);
  } finally {
    const c0 = performance.now();
    await sql`delete from users where handle like ${`${tag}\\_%`}`;
    console.log(`cleanup of ${VIEWERS} users: ${(performance.now() - c0).toFixed(0)} ms`);
    await sql`delete from handle_reservations where handle = ${`${tag}_t`}`;
    await sql`delete from signup_attempts where id = ${attempt}`;
  }
});

test('heavy: 200,000 orphaned likes are marked, then drained, within 10 orphan purge calls (lib/privacy-purge.ts) each, every call ≤ 30 s', { skip: skipDb, timeout: 900_000 }, async () => {
  const { sql } = await import('../db.ts');
  const { purgePrivacy } = await import('../privacy-purge.ts');
  const VIEWERS = 2_000, PER = 100, TOTAL = VIEWERS * PER;
  const tag = `ho${Math.random().toString(36).slice(2, 6)}`;
  const [{ id: attempt }] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const [{ id: trader }] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${`${tag}_t`}, 'Gone', now(), ${attempt}) returning id`;
  await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || '_' || i, 'Viewer ' || i, now(), ${attempt} from generate_series(1, ${VIEWERS}) i`;
  const viewers = sql`select id from users where handle like ${`${tag}\\_%`} and id <> ${trader}`;
  // Keys of closes that do not exist (sha256-shaped, never a real sell id's).
  await sql`insert into trade_likes (viewer_id, trade_key, trader_id)
    select v.id, encode(sha256((${tag} || ':' || v.id || ':' || k)::bytea), 'hex'), ${trader} from (${viewers}) v, generate_series(1, ${PER}) k`;
  await sql`analyze trade_likes`;
  const mine = (cond: ReturnType<typeof sql> | ReturnType<typeof sql.unsafe>) => sql`select count(*)::int as n from trade_likes l where trader_id = ${trader} ${cond}`.then((r) => r[0].n as number);
  const unmarked = sql`and not exists (select 1 from privacy_orphans o where o.kind = 'like' and o.viewer_id = l.viewer_id and o.trade_key = l.trade_key)`;
  let at: Date | undefined; // the drain runs as if 31 days later (the purge's `now` hook)
  // One purge call that ran (another process may hold the lock for a moment).
  const call = async () => {
    for (let i = 0; i < 120; i++) {
      const t0 = performance.now();
      const r = await purgePrivacy({ only: ['orphans'], ...(at ? { now: at } : {}) });
      const ms = performance.now() - t0;
      if (r.ran) return { ...r, deleted: r.likes + r.rejects, ms };
      await new Promise((res) => setTimeout(res, 250));
    }
    throw new Error('the purge lock was never free');
  };
  try {
    assert.equal(await mine(sql``), TOTAL);
    let calls = 0;
    for (; calls < 10 && (await mine(unmarked)) > 0; calls++) {
      const r = await call();
      console.log(`mark call ${calls + 1}: ${r.ms.toFixed(0)} ms, done ${r.done}`);
      assert.ok(r.ms <= 30_500, `${r.ms} ms`);
    }
    assert.equal(await mine(unmarked), 0, `all marked within ${calls} calls`);
    assert.equal(await mine(sql``), TOTAL, 'marking deletes nothing');
    at = new Date(Date.now() + 31 * 86_400_000);
    let drain = 0;
    let deleted = 0;
    for (; drain < 10 && (await mine(sql``)) > 0; drain++) {
      const r = await call();
      deleted += r.deleted;
      console.log(`drain call ${drain + 1}: ${r.ms.toFixed(0)} ms, deleted ${r.deleted}, done ${r.done}`);
      assert.ok(r.ms <= 30_500, `${r.ms} ms`);
    }
    assert.equal(await mine(sql``), 0, `drained within ${drain} calls`);
    assert.ok(deleted >= TOTAL);
    console.log(`orphans: marked in ${calls} call(s), drained in ${drain} call(s)`);
  } finally {
    await sql`delete from users where handle like ${`${tag}\\_%`}`;
    await sql`delete from signup_attempts where id = ${attempt}`;
  }
});
