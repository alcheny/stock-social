// Known-limits sweep 2 (feed, lib/feed.ts#candidatesAt): a quiet site, where the 14-day window cannot prove the 200 (no
// close in the last 14 days, as before launch), so every new session's page 1 used to rank every close in closed_trades
// (the full pass). The stepped windows (60 days, then 365) answer it, and the exploration picks come from users in their
// day-seeded order with a capped per-trader probe. Measured: page 1 with a new asOf each round (weights kept after the
// first), the candidates equal to the full pass's, and the pane read (records()) of a page's traders.
// The fixture: 500 traders × 400 closes from 15 days to ~2 years old, 50 more eligible traders with only old closes
// (1 to 2 years), and 2,000 signed-up users with no close (the picks walk past them). Every read uses the `ids` hook, so
// rows other tests leave in the shared database never change the path measured.
// Skipped unless LOAD=1. How to run (DATABASE_URL set): LOAD=1 node --test lib/feed.window.load.test.ts
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const loadTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 900_000 }, fn);
const log = (s: string) => console.log(`# load: ${s}`);
const made: number[] = [];
const FIX = { traders: 500, closes: 400, oldOnly: 50, empty: 2_000, rounds: 20 };
const BUDGET_MS = 400;

before(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => {
  if (!LOAD || !hasDb) return;
  const { sql } = await import('./db.ts');
  for (let i = 0; i < made.length; i += 500) await sql`delete from users where id in ${sql(made.slice(i, i + 500))}`;
  await sql.end({ timeout: 1 });
});

async function users(n: number, tag: string): Promise<number[]> {
  const { sql } = await import('./db.ts');
  const rows = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, ${n}) returning id),
         k as (select id, row_number() over (order by id) as k from a)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || k, ${tag} || k, now(), id from k returning id`;
  const ids = rows.map((u) => u.id as number);
  made.push(...ids);
  return ids;
}

loadTest('quiet site (no close in 14 days): page 1 p95 under the feed budget, candidates equal to the full pass', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage, clearFeedCache, records, candidateRows, RECENT_HOURS } = await import('./feed.ts');
  const tag = `fw${Math.random().toString(36).slice(2, 7)}`;
  const t0 = performance.now();
  const traders = await users(FIX.traders, `${tag}t`), oldOnly = await users(FIX.oldOnly, `${tag}o`), empty = await users(FIX.empty, `${tag}e`);
  for (const [u, id] of traders.entries()) {
    // Closes from 15 days back, one every ~1.8 days (about 25 in the 60-day window per trader).
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      select ${id}, ${tag} || '-' || ${u} || '-' || i, 'a', 'L' || ((${u} * 7 + i) % 300),
             now() - interval '15 days' - ((${u} * 13 + i * 2580) || ' minutes')::interval - (1 + (${u} + i) % 30 || ' days')::interval,
             now() - interval '15 days' - ((${u} * 13 + i * 2580) || ' minutes')::interval,
             (((${u} * 31 + i * 17) % 401) - 200) / 1000.0, 1 + (${u} + i) % 30, true
      from generate_series(0, ${FIX.closes - 1}) i`;
  }
  for (const [u, id] of oldOnly.entries()) {
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      select ${id}, ${tag} || '-o' || ${u} || '-' || i, 'a', 'O' || (i % 50), now() - interval '400 days' - (i || ' days')::interval,
             now() - interval '399 days' - (i || ' days')::interval, ((i % 21) - 10) / 100.0, 1, true
      from generate_series(0, 9) i`;
  }
  await sql`analyze closed_trades`;
  const ids = [...traders, ...oldOnly, ...empty];
  const [{ n }] = await sql`select count(*)::int as n from closed_trades where user_id = any(${ids})`;
  log(`quiet fixture: ${FIX.traders} traders + ${FIX.oldOnly} old-only + ${FIX.empty} with no close, ${n.toLocaleString('en-US')} closes, none in ${RECENT_HOURS / 24} days, ${Math.round(performance.now() - t0)} ms setup`);

  // Equal to the full pass (every column, the exploration picks and their weight keys).
  const asOf = new Date(), day = asOf.toISOString().slice(0, 10);
  const s0 = performance.now();
  const full = await candidateRows({ asOf, day, ids }, 'full');
  const fullMs = performance.now() - s0;
  const s1 = performance.now();
  const stepped = await candidateRows({ asOf, day, ids });
  const steppedMs = performance.now() - s1;
  const strip = (r: Record<string, unknown>) => { const { pn: _n, pm: _m, pk: _k, ...t } = r; return t; };
  assert.deepEqual(stepped.rows.map((r) => (r.x ? r : strip(r))), full.rows.map((r) => (r.x ? r : strip(r))));
  log(`candidates at one asOf: full pass ${fullMs.toFixed(0)} ms, ${stepped.window === null ? 'full pass' : `${stepped.window / 24}-day window`} ${steppedMs.toFixed(0)} ms (${stepped.rows.filter((r) => !r.x).length} + ${stepped.rows.filter((r) => r.x).length} picks)`);

  clearFeedCache();
  const times: number[] = [];
  let cold = 0, last: Awaited<ReturnType<typeof loadFeedPage>> | null = null;
  for (let r = 0; r < FIX.rounds; r++) {
    const s = performance.now();
    last = await loadFeedPage(undefined, { ids }); // every page 1 is a new asOf: a new list
    const ms = performance.now() - s;
    if (r === 0) cold = ms; else times.push(ms);
    assert.equal(last.cards.length, 30);
  }
  const p95 = [...times].sort((a, b) => a - b)[Math.ceil(times.length * 0.95) - 1];
  // The pane read of the last page's traders (lib/feed.ts#records, the whole-record ponytail).
  const pageTraders = [...new Set(last!.cards.map((c) => c.user_id))];
  const s2 = performance.now();
  const pane = await records(pageTraders);
  const paneMs = performance.now() - s2;
  const median = [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];
  log(`quiet page 1: p95 ${p95.toFixed(0)} ms, median ${median.toFixed(0)} ms over ${times.length} new lists (weights kept: ${times.map((t) => t.toFixed(0)).join(', ')}), cold ${cold.toFixed(0)} ms; pane read ${pageTraders.length} traders, ${pane.length.toLocaleString('en-US')} closes, ${paneMs.toFixed(0)} ms`);
  assert.ok(p95 < BUDGET_MS, `page 1 p95 ${p95.toFixed(0)} ms`);
});
