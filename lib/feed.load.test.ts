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
const tag = `fl${Math.random().toString(36).slice(2, 8)}`;
const made: number[] = [];

before(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => {
  if (!LOAD || !hasDb) return;
  const { sql } = await import('./db.ts');
  for (let i = 0; i < made.length; i += 100) await sql`delete from users where id in ${sql(made.slice(i, i + 100))}`;
  await sql.end({ timeout: 1 });
});

loadTest('signed-out feed, pages 1 to 3 at 500 traders (12 heavy): server time p95 < 400 ms; caps hold across the joins', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage } = await import('./feed.ts');
  const { worstWindow } = await import('./discovery/diversity.ts');
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
      const closed = now - (heavy ? (i < 10 ? i * 3_600_000 + u * 60_000 : 3 * 86_400_000 + i * 6 * 3_600_000) : ((u * 37 + i * 101) % 4320) * 60_000 + 60_000);
      const hold = 1 + ((u + i) % 30);
      return { user_id: made[u], sell_id: `${tag}-${u}-${i}`, account_id: 'a', symbol: `L${(u * 7 + i) % 300}`, opened_at: new Date(closed - hold * 86_400_000),
        closed_at: new Date(closed), return_pct: (((u * 31 + i * 17) % 401) - 200) / 1000, holding_days: hold, verified: true };
    });
    for (let i = 0; i < rows.length; i += 1000) await sql`insert into closed_trades ${sql(rows.slice(i, i + 1000))}`;
    total += n;
  }
  await sql`analyze closed_trades`;
  log(`feed fixture: ${FIX.traders} traders, ${total.toLocaleString('en-US')} closes, ${Math.round(performance.now() - t0)} ms setup`);

  const times: number[][] = [[], [], []];
  for (let r = 0; r < FIX.rounds; r++) {
    let after: string | null | undefined;
    const shown = [];
    for (let p = 0; p < 3; p++) {
      const s = performance.now();
      const page = await loadFeedPage(after);
      times[p].push(performance.now() - s);
      shown.push(...page.cards);
      after = page.next;
      if (!after) break;
    }
    if (r === 0) {
      const w = worstWindow(shown.map((c) => ({ key: String(c.id), trader: c.user_id, symbol: c.symbol })));
      assert.ok(w.trader <= 2 && w.symbol <= 2, JSON.stringify(w));
      assert.equal(new Set(shown.map((c) => c.id)).size, shown.length);
      assert.equal(shown.length, 90, 'three full pages');
      log(`feed pages 1-3: ${shown.length} cards, ${new Set(shown.map((c) => c.user_id)).size} distinct traders, ${shown.filter((c) => c.explore).length} exploration picks`);
    }
  }
  const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1];
  const all = times.flat();
  log(`feed server time p95: page 1 ${p95(times[0]).toFixed(0)} ms, page 2 ${p95(times[1]).toFixed(0)} ms, page 3 ${p95(times[2]).toFixed(0)} ms, all ${p95(all).toFixed(0)} ms (median ${[...all].sort((a, b) => a - b)[Math.floor(all.length / 2)].toFixed(0)} ms, ${all.length} pages)`);
  assert.ok(p95(all) < FEED_BOUNDS.p95Ms, `p95 ${p95(all).toFixed(0)} ms`);
});
