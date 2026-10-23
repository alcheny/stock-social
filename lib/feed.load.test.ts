// F-2 PR-1 heavy check (plan §1 PR-1 and §4): the signed-out feed's server time, pages 1 to 3, p95 < 400 ms at 500
// traders, 12 of them heavy (4,700 closes each, the F-1 heavy record's size). Measured on lib/feed.ts#loadFeedPage,
// which is every query and every computation the page does before rendering (the render itself is measured end to end
// by the e2e heavy-feed test). Skipped unless LOAD=1, so `npm test` stays fast.
// How to run (DATABASE_URL set): LOAD=1 node --expose-gc --test lib/feed.load.test.ts
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const loadTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 900_000 }, fn);
export const FEED_BOUNDS = { p95Ms: 400 };
const FIX = { traders: 500, heavy: 12, heavyCloses: 4_700, closes: 20, rounds: 20 };
const log = (s: string) => console.log(`# load: ${s}`);
const made: number[] = [];

before(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => {
  if (!LOAD || !hasDb) return;
  const { sql } = await import('./db.ts');
  for (let i = 0; i < made.length; i += 100) await sql`delete from users where id in ${sql(made.slice(i, i + 100))}`;
  await sql.end({ timeout: 1 });
});

// F-2 PR-1 fix round 1 (tester Medium 3): the plan's heavy fixture too, 50 heavy traders with 5 fresh closes each, so
// most of the candidates are heavy records (as in production: heavy traders are the ones with fresh closes).
async function fixture(FIX: { traders: number; heavy: number; heavyCloses: number; closes: number; fresh: number }) {
  const { sql } = await import('./db.ts');
  const tag = `fl${Math.random().toString(36).slice(2, 8)}`;
  const t0 = performance.now();
  const users = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, ${FIX.traders}) returning id),
         n as (select id, row_number() over (order by id) as k from a)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || k, ${tag} || k, now(), id from n returning id`;
  made.push(...users.map((u) => u.id as number));
  const now = Date.now();
  let total = 0;
  for (let u = 0; u < made.length; u++) {
    const heavy = u < FIX.heavy, n = heavy ? FIX.heavyCloses : FIX.closes;
    const rows = Array.from({ length: n }, (_, i) => {
      // Fresh closes spread over the last 3 days, older ones back over years for the heavy records.
      const closed = now - (heavy ? (i < FIX.fresh ? i * 3_600_000 + u * 60_000 : 3 * 86_400_000 + i * 6 * 3_600_000) : ((u * 37 + i * 101) % 4320) * 60_000 + 60_000);
      const hold = 1 + ((u + i) % 30);
      return { user_id: made[u], sell_id: `${tag}-${u}-${i}`, account_id: 'a', symbol: `L${(u * 7 + i) % 300}`, opened_at: new Date(closed - hold * 86_400_000),
        closed_at: new Date(closed), return_pct: (((u * 31 + i * 17) % 401) - 200) / 1000, holding_days: hold, verified: true };
    });
    for (let i = 0; i < rows.length; i += 1000) await sql`insert into closed_trades ${sql(rows.slice(i, i + 1000))}`;
    total += n;
  }
  await sql`analyze closed_trades`;
  log(`feed fixture: ${FIX.traders} traders (${FIX.heavy} heavy), ${total.toLocaleString('en-US')} closes, ${Math.round(performance.now() - t0)} ms setup`);
  return { remove: async () => { const ids = made.splice(0); for (let i = 0; i < ids.length; i += 100) await sql`delete from users where id in ${sql(ids.slice(i, i + 100))}`; } };
}

// Pages 1 to 3, FIX.rounds times, every page in the p95. Round 1 is a cold server (no kept list or weight; logged on its
// own); every later page 1 is a new asOf (a new list) with the weights kept, as on a running server between two record
// changes.
async function measure(rounds: number) {
  const { loadFeedPage, feedCandidates, clearFeedCache } = await import('./feed.ts');
  const { worstWindow } = await import('./discovery/diversity.ts');
  clearFeedCache();
  const times: number[][] = [[], [], []];
  let cold = 0;
  for (let r = 0; r < rounds; r++) {
    let after: string | null | undefined;
    const shown = [];
    for (let p = 0; p < 3; p++) {
      const s = performance.now();
      const page = await loadFeedPage(after);
      const ms = performance.now() - s;
      times[p].push(ms);
      if (r === 0 && p === 0) cold = ms;
      shown.push(...page.cards);
      after = page.next;
      if (!after) break;
    }
    if (r === 0) {
      const w = worstWindow(shown.map((c) => ({ key: String(c.id), trader: c.user_id, symbol: c.symbol })));
      assert.ok(w.trader <= 2 && w.symbol <= 2, JSON.stringify(w));
      assert.equal(new Set(shown.map((c) => c.id)).size, shown.length);
      assert.equal(shown.length, 90, 'three full pages');
      const cands = await feedCandidates({ asOf: new Date() });
      log(`feed pages 1-3: ${shown.length} cards, ${new Set(shown.map((c) => c.user_id)).size} distinct traders, ${shown.filter((c) => c.explore).length} exploration picks; 200 candidates from ${new Set(cands.map((c) => c.user_id)).size} traders`);
    }
  }
  const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1];
  const all = times.flat();
  log(`feed server time p95: page 1 ${p95(times[0]).toFixed(0)} ms, page 2 ${p95(times[1]).toFixed(0)} ms, page 3 ${p95(times[2]).toFixed(0)} ms, all ${p95(all).toFixed(0)} ms (median ${[...all].sort((a, b) => a - b)[Math.floor(all.length / 2)].toFixed(0)} ms, ${all.length} pages); cold page 1 ${cold.toFixed(0)} ms`);
  return p95(all);
}

loadTest('signed-out feed, pages 1 to 3 at 500 traders (12 heavy): server time p95 < 400 ms; caps hold across the joins', async () => {
  const fx = await fixture({ traders: 500, heavy: 12, heavyCloses: 4_700, closes: 20, fresh: 10 });
  try {
    const p95 = await measure(FIX.rounds);
    assert.ok(p95 < FEED_BOUNDS.p95Ms, `p95 ${p95.toFixed(0)} ms`);
  } finally {
    await fx.remove();
  }
});

loadTest('fix round 1: signed-out feed, pages 1 to 3 at 500 traders (50 heavy, 5 fresh closes each): server time p95 < 400 ms', async () => {
  const fx = await fixture({ traders: 500, heavy: 50, heavyCloses: 4_700, closes: 20, fresh: 5 });
  try {
    const p95 = await measure(FIX.rounds);
    assert.ok(p95 < FEED_BOUNDS.p95Ms, `p95 ${p95.toFixed(0)} ms`);
  } finally {
    await fx.remove();
  }
});

// F-2 PR-1 fix round 2 (tester High A): a cursor page with no kept list (another server, a restart, a crafted `?after=`)
// after ≥ 150,000 activities were imported since the cursor's asOf. The late filter was `not in (late)`, which Postgres
// rescans per candidate row once the late set exceeds work_mem: 129 s to over 180 s a page. Now an anti-join.
// The fixture: the 12-heavy budget fixture; page 1 is served; then 15 traders' first imports land (10,000 activities
// each, with 3,000 closes each) plus a late close for 20 listed traders, all after page 1's asOf. Page 2 is then read
// with no kept list LATE.rounds times, first with the statistics as autovacuum left them (the planner expects almost no
// late rows), then analyzed. Each read must be the page the kept list served, and:
// - with the weights kept (a crafted `?after=`, or another warm server): p95 over the reads under the feed budget
//   (FEED_BOUNDS.p95Ms), as the other cases here measure it;
// - on a fully cold server (no kept list, no kept weight): logged, and every read under COLD_LATE_MS. A cold server's first page is
//   over the budget even with no late import (the business lead's accepted cold start, with its trigger); this bound
//   catches a late filter that rescans (43 s here before the fix).
const COLD_LATE_MS = 1_000;
const LATE = { importers: 15, perImporter: 10_000, closesPerImporter: 3_000, lateForListed: 20, rounds: 10 };
loadTest('fix round 2: page 2 with no kept list after 150,000 activities imported since its asOf: under the budget, the kept list\'s page', async () => {
  const fx = await fixture({ traders: 500, heavy: 12, heavyCloses: 4_700, closes: 20, fresh: 10 });
  const { sql } = await import('./db.ts');
  const { loadFeedPage, clearFeedCache } = await import('./feed.ts');
  try {
    clearFeedCache();
    const p1 = await loadFeedPage(undefined);
    assert.ok(p1.next, 'a page 2 exists');
    const kept = await loadFeedPage(p1.next);
    await new Promise((r) => setTimeout(r, 5)); // every import below is strictly after asOf
    const tag = `lt${Math.random().toString(36).slice(2, 8)}`;
    const imp = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, ${LATE.importers}) returning id),
           n as (select id, row_number() over (order by id) as k from a)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || k, ${tag} || k, now(), id from n returning id`;
    made.push(...imp.map((u) => u.id as number));
    const t0 = performance.now();
    for (const [k, u] of imp.entries()) {
      await sql`
        insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
        select ${u.id}, 'snaptrade', ${tag} || '-' || ${k} || '-' || i, 'a', 'L' || (i % 300), case when i % 2 = 0 then 'BUY' else 'SELL' end, 1, 10,
               now() - (i || ' minutes')::interval, '{}'::jsonb
        from generate_series(1, ${LATE.perImporter}) i`;
      // Their closes (the rebuild's output): every one's sell was imported after asOf.
      await sql`
        insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
        select ${u.id}, ${tag} || '-' || ${k} || '-' || (2 * i + 1), 'a', 'L' || ((2 * i + 1) % 300), now() - interval '3 days' - (i || ' minutes')::interval,
               now() - interval '1 hour' - (i || ' minutes')::interval, ((i % 401) - 200) / 100.0, 2, true
        from generate_series(0, ${LATE.closesPerImporter - 1}) i`;
    }
    // A late close for 20 traders already in the list (dated an hour before asOf, imported after it): it must not count.
    const listed = [...new Set(kept.cards.map((c) => c.user_id))].slice(0, LATE.lateForListed);
    for (const [k, id] of listed.entries()) {
      const sell = `${tag}-x-${k}`;
      await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
        values (${id}, 'snaptrade', ${sell}, 'a', 'LX', 'SELL', 1, 10, ${new Date(p1.asOf.getTime() - 3_600_000)}, '{}'::jsonb)`;
      await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
        values (${id}, ${sell}, 'a', 'LX', ${new Date(p1.asOf.getTime() - 86_400_000)}, ${new Date(p1.asOf.getTime() - 3_600_000)}, 3.5, 1, true)`;
    }
    const [{ n }] = await sql`select count(*)::int as n from activities where created_at > ${p1.asOf}`;
    assert.ok(n >= 150_000, `late activities ${n}`);
    log(`late fixture: ${n.toLocaleString('en-US')} activities imported after asOf, ${Math.round(performance.now() - t0)} ms setup`);
    // Not analyzed on purpose first (autovacuum has not run yet: the planner's row estimates are stale), then analyzed.
    const warm: number[] = [], cold: number[] = [];
    for (const analyzed of [false, true]) {
      if (analyzed) await sql`analyze activities`;
      for (let r = 0; r < LATE.rounds; r++) {
        for (const what of ['all', 'lists'] as const) {
          clearFeedCache('all');
          if (what === 'lists') { await loadFeedPage(p1.next); clearFeedCache('lists'); } // weights kept, list forgotten
          const s = performance.now();
          const page = await loadFeedPage(p1.next);
          const ms = performance.now() - s;
          (what === 'all' ? cold : warm).push(ms);
          const when = `${analyzed ? 'analyzed' : 'stale statistics'}, ${what === 'all' ? 'cold server' : 'weights kept'}`;
          assert.deepEqual(page.cards.map((c) => c.sell_id), kept.cards.map((c) => c.sell_id), `the kept list's page 2 (${when})`);
          if (what === 'all') assert.ok(ms < COLD_LATE_MS, `page 2 ${ms.toFixed(0)} ms (${when})`);
        }
      }
    }
    const fmt = (xs: number[]) => xs.map((t) => t.toFixed(0)).join(', ');
    const p95 = [...warm].sort((a, b) => a - b)[Math.ceil(warm.length * 0.95) - 1];
    assert.ok(p95 < FEED_BOUNDS.p95Ms, `page 2 with the weights kept: p95 ${p95.toFixed(0)} ms (${fmt(warm)})`);
    log(`page 2 with no kept list after ${n.toLocaleString('en-US')} late activities (first ${LATE.rounds} of each with stale statistics): weights kept ${fmt(warm)} ms (p95 ${p95.toFixed(0)}); cold server ${fmt(cold)} ms`);
  } finally {
    await sql`delete from activities where user_id = any(${made})`;
    await fx.remove();
  }
});
