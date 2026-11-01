// Known limits sweep 2 (`similar`): the "Similar trades" pool at 5,000 feed-eligible traders. It measures
// - the cold pool build (no kept pool, no kept feed weight and no fresh shared row: a fresh server or instance), then a
//   second cold server (a fresh shared row to read; before the shared table this was a rebuild with feed weights warm);
// - one profile's loadSimilar (panes: false, as app/u/[handle]/page.tsx reads it) with the pool warm, p50/p95;
// - the in-memory candidate pick per request (the whole-pool filter and sort before; the bucket walk after).
// Skipped unless LOAD=1, so `npm test` stays fast. How to run (DATABASE_URL set): LOAD=1 node --test lib/similar.load.test.ts
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const loadTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 900_000 }, fn);
// Bounds with ≥ 15% headroom over the measured numbers (see the sweep report).
export const SIMILAR_BOUNDS = { requestP95Ms: 60, pickP95Ms: 0.5 };
const FIX = { traders: 5_000, closes: 6, requests: 200 };
const HOLDS = [0.5, 3, 14, 60, 300];
const log = (s: string) => console.log(`# load: ${s}`);
const made: number[] = [];

before(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => {
  if (!LOAD || !hasDb) return;
  const { sql } = await import('./db.ts');
  for (let i = 0; i < made.length; i += 500) await sql`delete from users where id in ${sql(made.slice(i, i + 500))}`;
  await sql.end({ timeout: 1 });
});

async function fixture() {
  const { sql } = await import('./db.ts');
  const tag = `sl${Math.random().toString(36).slice(2, 8)}`;
  const t0 = performance.now();
  const users = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, ${FIX.traders}) returning id),
         n as (select id, row_number() over (order by id) as k from a)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || k, ${tag} || k, now(), id from n returning id`;
  made.push(...users.map((u) => u.id as number));
  // Every close dated in the last 3 days, before the start of the current hour's asOf (the pool reads the hour's start).
  const hour = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  const rows = made.flatMap((id, u) => Array.from({ length: FIX.closes }, (_, i) => {
    const closed = hour - 60_000 - ((u * 37 + i * 101) % 4320) * 60_000, hold = HOLDS[u % 5] + (i % 2) * 0.1;
    return { user_id: id, sell_id: `${tag}-${u}-${i}`, account_id: 'a', symbol: `S${(u * 7 + i) % 300}`, opened_at: new Date(closed - hold * 86_400_000),
      closed_at: new Date(closed), return_pct: (((u * 31 + i * 17) % 401) - 200) / 1000, holding_days: hold, verified: u % 11 !== 0 };
  }));
  for (let i = 0; i < rows.length; i += 2000) await sql`insert into closed_trades ${sql(rows.slice(i, i + 2000))}`;
  await sql`analyze closed_trades`;
  log(`similar fixture: ${FIX.traders} traders, ${rows.length.toLocaleString('en-US')} closes, ${Math.round(performance.now() - t0)} ms setup`);
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * p) - 1)];

loadTest('similar pool at 5,000 traders: cold build and rebuild measured; a profile request p95 and the per-request pick bounded', async () => {
  await fixture();
  const similar = await import('./similar.ts');
  const { clearFeedCache, feedList } = await import('./feed.ts');
  const { similarCandidates, SIMILAR_SPARES } = await import('./discovery/similar.ts');
  const now = Date.now();
  similar.clearSimilarCache(); clearFeedCache();
  let s = performance.now();
  await similar.loadSimilar({ trader: made[1], hold: 3, closes: 6, now, panes: false });
  const cold = performance.now() - s;
  similar.clearSimilarCache();
  s = performance.now();
  await similar.loadSimilar({ trader: made[1], hold: 3, closes: 6, now, panes: false });
  const rebuild = performance.now() - s;
  const times: number[] = [];
  let shown = 0;
  for (let r = 0; r < FIX.requests; r++) {
    const u = (r * 97) % made.length;
    s = performance.now();
    const out = await similar.loadSimilar({ trader: made[u], hold: HOLDS[u % 5], closes: 6, now, panes: false });
    times.push(performance.now() - s);
    if (out) shown++;
  }
  // The in-memory pick alone, on the same pool.
  const hour = Math.floor(now / 3_600_000) * 3_600_000;
  const { pool } = await feedList({ asOf: new Date(hour), day: new Date(hour).toISOString().slice(0, 10) });
  const pick = (similar as { pickFor?: (p: typeof pool) => (self: number, hold: number, skip: ReadonlySet<number>) => unknown[] }).pickFor;
  const walk = pick ? pick(pool) : null;
  const pickTimes: number[] = [], walkTimes: number[] = [];
  for (let r = 0; r < 500; r++) {
    const u = (r * 89) % made.length, skip = new Set<number>([made[(u + 1) % made.length]]);
    s = performance.now(); similarCandidates(pool, made[u], HOLDS[u % 5], skip).slice(0, SIMILAR_SPARES); pickTimes.push(performance.now() - s);
    if (walk) { s = performance.now(); walk(made[u], HOLDS[u % 5], skip); walkTimes.push(performance.now() - s); }
  }
  log(`pool ${pool.length} traders: cold build ${cold.toFixed(0)} ms, next cold server (fresh shared row; before the shared row: a rebuild with feed weights warm) ${rebuild.toFixed(0)} ms`);
  log(`profile request (pool warm, panes: false): p50 ${pct(times, 0.5).toFixed(1)} ms, p95 ${pct(times, 0.95).toFixed(1)} ms, ${shown}/${FIX.requests} with a section`);
  log(`per-request pick: whole-pool filter+sort p50 ${pct(pickTimes, 0.5).toFixed(3)} ms p95 ${pct(pickTimes, 0.95).toFixed(3)} ms` +
    (walk ? `; bucket walk p50 ${pct(walkTimes, 0.5).toFixed(3)} ms p95 ${pct(walkTimes, 0.95).toFixed(3)} ms` : ''));
  assert.ok(shown > FIX.requests / 2, 'most profiles get a section');
  assert.ok(pct(times, 0.95) < SIMILAR_BOUNDS.requestP95Ms, `request p95 ${pct(times, 0.95).toFixed(1)} ms`);
  if (walk) assert.ok(pct(walkTimes, 0.95) < SIMILAR_BOUNDS.pickP95Ms, `walk p95 ${pct(walkTimes, 0.95).toFixed(3)} ms`);
});
