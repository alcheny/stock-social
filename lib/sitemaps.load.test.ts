// Sitemap per-request cost (known-limits sweep 2): 60,000 indexable symbols (180,000 verified closes, 12 sitemaps) under
// a test prefix, on top of whatever the shared database already holds. Measures what one crawler request costs:
// robots.txt / the id check (how many sitemaps there are) and the last further sitemap (a chunk). Before the fix each
// of them aggregated every close (the chunk then skipped k·SITEMAP_LIMIT symbols by offset); after it the count is one
// primary-key read of the shared boundary row and a chunk is a range read of its own symbols.
// Skipped unless LOAD=1, so `npm test` stays fast. How to run (DATABASE_URL set): LOAD=1 node --test lib/sitemaps.load.test.ts
// Timings print as `# load: …` lines. Recorded 2026-11-01 (development container, shared DB, medians of 5):
//   run 1 (~140k other closes): before count 200 ms, last chunk (11) 237 ms, chunk 0 237 ms;
//                               after  count 0 ms, last chunk 40 ms, chunk 0 39 ms, one rebuild 681 ms.
//   run 2 (~250k other closes, back to back): before count 707 ms, last chunk 702 ms, chunk 0 624 ms;
//                                             after  count 0 ms, last chunk 61 ms, chunk 0 33 ms, one rebuild 575 ms.
// Before, every request grows with every close in the table; after, a chunk grows with its own closes and the one
// full aggregation (the rebuild) runs once per REBUILD_MS fleet-wide.
// Bound (asserted on the new code only): a chunk ≤ 300 ms and a count ≤ 50 ms (≈ 4x the worst chunk measurement).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const SYMBOLS = 60_000;
const BOUNDS = { chunkMs: 300, countMs: 50 };

before(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const log = (s: string) => console.log(`# load: ${s}`);
async function median(fn: () => Promise<unknown>, runs = 5): Promise<number> {
  const t: number[] = [];
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); await fn(); t.push(performance.now() - t0); }
  return Math.round(t.sort((a, b) => a - b)[Math.floor(runs / 2)]);
}

test(`heavy: ${SYMBOLS.toLocaleString('en-US')} indexable symbols: a sitemap request reads its own chunk, not every close`,
  { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 900_000 }, async () => {
  const { sql } = await import('./db.ts');
  const mod: Record<string, any> = await import('./sitemaps.ts');
  const { SITEMAP_LIMIT } = await import('./ticker.ts');
  const tag = `SL${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  const users = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, 2) returning id),
         n as (select id, row_number() over (order by id) as k from a)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag.toLowerCase()} || k, ${tag} || k, now(), id from n returning id`;
  const [u1, u2] = users.map((u) => u.id as number);
  const prefix = tag;
  const isNew = typeof mod.sitemapIndex === 'function';
  try {
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      select case when j = 2 then ${u2}::int else ${u1}::int end, ${tag} || '-' || i || '-' || j, 'a', ${tag} || lpad(i::text, 6, '0'),
             now() - interval '2 days', now() - interval '1 day', 0.01, 1, true
      from generate_series(1, ${SYMBOLS}) i, generate_series(0, 2) j`;
    await sql`analyze closed_trades`;
    const last = Math.ceil(SYMBOLS / SITEMAP_LIMIT) - 1;
    let rebuildMs = 0;
    if (isNew) {
      const t0 = performance.now();
      await mod.rebuildSitemapIndex({ prefix });
      rebuildMs = Math.round(performance.now() - t0);
    }
    const countMs = await median(() => (isNew ? mod.sitemapIndex({ prefix }) : mod.indexableCount({ prefix })));
    const lastMs = await median(() => mod.sitemapChunk(last, { prefix }));
    const firstMs = await median(() => mod.sitemapChunk(0, { prefix }));
    assert.equal((await mod.sitemapChunk(last, { prefix })).length, SYMBOLS - last * SITEMAP_LIMIT);
    log(`${isNew ? 'after' : 'before'}: count ${countMs} ms, last chunk (${last}) ${lastMs} ms, chunk 0 ${firstMs} ms${isNew ? `, rebuild ${rebuildMs} ms` : ''}`);
    if (isNew) {
      assert.ok(lastMs <= BOUNDS.chunkMs, `last chunk ${lastMs} ms`);
      assert.ok(firstMs <= BOUNDS.chunkMs, `chunk 0 ${firstMs} ms`);
      assert.ok(countMs <= BOUNDS.countMs, `count ${countMs} ms`);
    }
  } finally {
    await sql`delete from users where id in (${u1}, ${u2})`;
    if (isNew) await sql`delete from sitemap_chunks where scope = ${prefix}`;
  }
});
