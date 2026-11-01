// Known limit removed 2026-11-01 (docs/features/logs/known-limits/committee-2026-11-01.md, item 3): a feed page with no
// kept list (a crafted `?after=`, another server, a restart) read every sell imported since its cursor's asOf, so its
// cost grew with the import volume of up to 48 hours (~1.3 s at 600,000 late sells). Each close now carries when its
// sell was imported (closed_trades.sell_imported_at), so the page reads only the closes it ranks.
// This measures a crafted cursor (asOf 47 hours ago, page 2) on the 12-heavy budget fixture with no late sells and
// again after LATE_SELLS sells were imported since asOf (by traders outside the list, dated before asOf: the shape a
// first import has): the same page both times, and the page's time does not grow with the late volume.
// Skipped unless LOAD=1. How to run (DATABASE_URL set): LOAD=1 node --test lib/feed.crafted.load.test.ts
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const loadTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 1_800_000 }, fn);
const log = (s: string) => console.log(`# load: ${s}`);
const made: number[] = [];
const LATE_SELLS = 600_000, IMPORTERS = 20, ROUNDS = 7;
// The feed budget (lib/feed.load.test.ts FEED_BOUNDS) and the most the late volume may add to the median.
const BUDGET_MS = 400, GROWTH_MS = 100;

before(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => {
  if (!LOAD || !hasDb) return;
  const { sql } = await import('./db.ts');
  for (let i = 0; i < made.length; i += 100) await sql`delete from users where id in ${sql(made.slice(i, i + 100))}`;
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

// 500 traders, 12 heavy (4,700 closes), closes spread over the 3 days before asOf (and years back for the heavy ones).
async function fixture(asOf: number) {
  const { sql } = await import('./db.ts');
  const tag = `fc${Math.random().toString(36).slice(2, 8)}`;
  const ids = await users(500, tag);
  for (const [u, id] of ids.entries()) {
    const heavy = u < 12, n = heavy ? 4_700 : 20;
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      select ${id}, ${tag} || '-' || ${u} || '-' || i, 'a', 'L' || ((${u} * 7 + i) % 300),
             ${new Date(asOf)}::timestamptz - (((${u} * 37 + i * 101) % 4320) || ' minutes')::interval - (case when i > 20 then i * 6 else 0 end || ' hours')::interval - (1 + (${u} + i) % 30 || ' days')::interval,
             ${new Date(asOf)}::timestamptz - (((${u} * 37 + i * 101) % 4320) + 1 || ' minutes')::interval - (case when i > 20 then i * 6 else 0 end || ' hours')::interval,
             (((${u} * 31 + i * 17) % 401) - 200) / 1000.0, 1 + (${u} + i) % 30, true
      from generate_series(0, ${n - 1}) i`;
  }
  await sql`analyze closed_trades`;
  return tag;
}

loadTest('a crafted cursor 47 hours old: the same page, and no growth with 600,000 sells imported since its asOf', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage, clearFeedCache } = await import('./feed.ts');
  const { encodeCursor, utcDay } = await import('./discovery/pager.ts');
  const asOf = Date.now() - 47 * 3_600_000;
  const t0 = performance.now();
  const tag = await fixture(asOf);
  log(`crafted fixture: 500 traders (12 heavy), ${Math.round(performance.now() - t0)} ms setup`);
  const crafted = encodeCursor({ day: utcDay(asOf), asOf, offset: 30 });
  const run = async () => {
    const warm: number[] = [], cold: number[] = [];
    let cards: string[] | null = null;
    for (let r = 0; r < ROUNDS; r++) {
      for (const what of ['all', 'lists'] as const) {
        clearFeedCache('all');
        if (what === 'lists') { await loadFeedPage(crafted); clearFeedCache('lists'); } // weights kept, list forgotten
        const s = performance.now();
        const page = await loadFeedPage(crafted);
        (what === 'all' ? cold : warm).push(performance.now() - s);
        const ids = page.cards.map((c) => c.sell_id);
        if (cards) assert.deepEqual(ids, cards); else cards = ids;
      }
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    return { warm: median(warm), cold: median(cold), cards: cards! };
  };
  try {
    const none = await run();
    assert.equal(none.cards.length, 30, 'a full page 2');
    log(`crafted page 2, no late sells: weights kept median ${none.warm.toFixed(0)} ms, cold median ${none.cold.toFixed(0)} ms`);
    const importers = await users(IMPORTERS, `${tag}i`);
    const per = LATE_SELLS / IMPORTERS;
    const t1 = performance.now();
    for (const [k, id] of importers.entries()) {
      await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
        select ${id}, 'snaptrade', ${tag} || '-imp-' || ${k} || '-' || i, 'a', 'L' || (i % 300), 'SELL', 1, 10,
               ${new Date(asOf)}::timestamptz - (i || ' seconds')::interval, '{}'::jsonb
        from generate_series(1, ${per}) i`;
    }
    await sql`analyze activities`;
    const [{ n }] = await sql`select count(*)::int as n from activities where created_at > ${new Date(asOf)} and side = 'SELL'`;
    assert.ok(n >= LATE_SELLS, `late sells ${n}`);
    log(`crafted fixture: ${n.toLocaleString('en-US')} sells imported since asOf, ${Math.round(performance.now() - t1)} ms setup`);
    const late = await run();
    assert.deepEqual(late.cards, none.cards, 'the same page: sells of traders outside the list change nothing');
    log(`crafted page 2 after ${n.toLocaleString('en-US')} late sells: weights kept median ${late.warm.toFixed(0)} ms (+${(late.warm - none.warm).toFixed(0)}), cold median ${late.cold.toFixed(0)} ms (+${(late.cold - none.cold).toFixed(0)})`);
    assert.ok(late.warm - none.warm < GROWTH_MS, `weights kept: ${none.warm.toFixed(0)} → ${late.warm.toFixed(0)} ms`);
    assert.ok(late.cold - none.cold < GROWTH_MS, `cold: ${none.cold.toFixed(0)} → ${late.cold.toFixed(0)} ms`);
    assert.ok(late.warm < BUDGET_MS, `weights kept median ${late.warm.toFixed(0)} ms`);
  } finally {
    await sql`delete from activities where user_id = any(${made})`;
  }
});
