import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chunkOf, sitemapUrls, symbolEntries, extraSitemapIds, sitemapCount } from './sitemaps.ts';
import { buildSitemapEntries, SITEMAP_LIMIT } from './ticker.ts';

test('sitemapCount / extraSitemapIds: one sitemap up to the limit, one more per further SITEMAP_LIMIT symbols', () => {
  assert.equal(sitemapCount(0), 1);
  assert.equal(sitemapCount(NaN), 1);
  assert.equal(sitemapCount(-3), 1);
  assert.equal(sitemapCount(SITEMAP_LIMIT), 1);
  assert.equal(sitemapCount(SITEMAP_LIMIT + 1), 2);
  assert.equal(sitemapCount(3 * SITEMAP_LIMIT), 3);
  assert.equal(sitemapCount(3 * SITEMAP_LIMIT + 1), 4);
  assert.deepEqual(extraSitemapIds(SITEMAP_LIMIT), []);
  assert.deepEqual(extraSitemapIds(2 * SITEMAP_LIMIT + 1), ['1', '2']);
});

test('chunkOf: only a positive integer id is a chunk', () => {
  assert.equal(chunkOf('1'), 1);
  assert.equal(chunkOf('12'), 12);
  for (const bad of ['0', '-1', '01', '1.5', '1e3', ' 1', '1.xml', '', 'abc', '9999999']) assert.equal(chunkOf(bad), null, bad);
});

test('sitemapUrls: /sitemap.xml first, then each further sitemap; no doubled slash', () => {
  assert.deepEqual(sitemapUrls('https://x.example/', 2 * SITEMAP_LIMIT + 1),
    ['https://x.example/sitemap.xml', 'https://x.example/sitemaps/sitemap/1.xml', 'https://x.example/sitemaps/sitemap/2.xml']);
  assert.deepEqual(sitemapUrls('http://l', 0), ['http://l/sitemap.xml']);
  assert.deepEqual(sitemapUrls('http://l', SITEMAP_LIMIT), ['http://l/sitemap.xml']);
});

test('further sitemaps: a database error fails the request at run time and lists none only while building', () => {
  const src = readFileSync(new URL('../app/sitemaps/sitemap.ts', import.meta.url), 'utf8');
  assert.match(src, /export async function generateSitemaps/);
  assert.match(src, /NEXT_PHASE === 'phase-production-build'\) return \[\];\n\s*throw e;/);
  assert.match(src, /props: \{ id: Promise<string> \}/, 'Next.js 16: the id arrives as a promise');
});

test('every sitemap read of closed_trades uses the visible-user predicate (fix #4, lib/visible-users.ts)', () => {
  const src = readFileSync(new URL('./sitemaps.ts', import.meta.url), 'utf8');
  const reads = [...src.matchAll(/sql`([^`]*)`/g)].map((m) => m[1]).filter((q) => /\bfrom closed_trades\b/.test(q));
  assert.ok(reads.length >= 1);
  for (const q of reads) assert.match(q, /\$\{visibleUserIds\(\)\}/, q);
  assert.doesNotMatch(readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8'), /from closed_trades/, 'app/sitemap.ts reads through lib/sitemaps.ts');
});

test('robots.txt lists every sitemap and falls back to /sitemap.xml alone', () => {
  const src = readFileSync(new URL('../app/robots.ts', import.meta.url), 'utf8');
  assert.match(src, /sitemap: sitemapUrls\(/);
  assert.match(src, /catch/);
});

// DB-backed (DATABASE_URL with db/schema.sql applied; skipped otherwise).
const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 300_000 }, fn);
before(async () => {
  if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
});
after(async () => {
  if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 });
});

// The known limit: past the cap, symbols fell off alphabetically. Now 2·SITEMAP_LIMIT + 1 indexable symbols (plus thin
// and demo-only ones that must take no slot) land in exactly three sitemaps, each symbol once, in order.
dbTest('above the limit every indexable symbol is in exactly one sitemap, in order; thin and demo-only ones in none', async () => {
  const { sql } = await import('./db.ts');
  const { indexableCount, sitemapChunk, rebuildSitemapIndex } = await import('./sitemaps.ts');
  const tag = `sm${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const users = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, 2) returning id),
         n as (select id, row_number() over (order by id) as k from a)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag.toLowerCase()} || k, ${tag} || k, now(), id from n returning id`;
  const [u1, u2] = users.map((u) => u.id as number);
  const total = 2 * SITEMAP_LIMIT + 1;
  try {
    // Indexable: 3 verified closes from 2 traders. Then 10 thin symbols (2 closes) and 10 demo-only (unverified).
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      select case when j = 2 then ${u2}::int else ${u1}::int end, ${tag} || '-' || i || '-' || j, 'a', ${tag} || lpad(i::text, 6, '0'),
             now() - interval '2 days', now() - interval '1 day', 0.01, 1, true
      from generate_series(1, ${total}) i, generate_series(0, 2) j`;
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      select case when j = 1 then ${u2}::int else ${u1}::int end, ${tag} || '-t' || i || '-' || j, 'a', ${tag} || 'T' || i,
             now() - interval '2 days', now() - interval '1 day', 0.01, 1, j < 2 or i > 10
      from generate_series(1, 20) i, generate_series(0, 2) j where i > 10 or j < 2`;
    await sql`update closed_trades set verified = false where sell_id like ${`${tag}-t%`} and symbol in (select ${tag} || 'T' || i from generate_series(11, 20) i)`;
    assert.equal(await indexableCount({ prefix: tag }), total);
    await rebuildSitemapIndex({ prefix: tag }); // C5-43 (c): the cron's rebuild; no request builds
    const chunks = [0, 1, 2, 3].map((k) => sitemapChunk(k, { prefix: tag }));
    const [c0, c1, c2, c3] = await Promise.all(chunks);
    assert.deepEqual([c0.length, c1.length, c2.length, c3.length], [SITEMAP_LIMIT, SITEMAP_LIMIT, 1, 0]);
    const listed = [...c0, ...c1, ...c2].map((r) => r.symbol);
    const expected = Array.from({ length: total }, (_, i) => `${tag}${String(i + 1).padStart(6, '0')}`);
    assert.deepEqual(listed, expected, 'every symbol once, in byte order, no thin or demo-only symbol');
    // The routes keep every chunk's symbols (buildSitemapEntries' own cap never cuts a chunk); a further chunk has symbols only.
    assert.equal(buildSitemapEntries(c1, 'http://l').length, SITEMAP_LIMIT + 2);
    const e1 = symbolEntries(c1, 'http://l/');
    assert.equal(e1.length, SITEMAP_LIMIT);
    assert.ok(e1.every((x) => x.url.startsWith('http://l/t/')));
  } finally {
    await sql`delete from users where id in (${u1}, ${u2})`;
    await sql`delete from sitemap_chunks where scope = ${tag}`;
  }
});

// Known-limits sweep 2: the boundaries are one shared row (no per-server count) and a chunk is a range read.
test('no per-server count: robots.txt and the sitemap ids read the shared row, judged stale by the database clock', () => {
  const src = readFileSync(new URL('./sitemaps.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /indexableCountCached|COUNT_TTL_MS|^let /m, 'no module-level count cache');
  assert.doesNotMatch(src, /Date\.now\(/, 'staleness uses the database clock');
  assert.match(src, /built_at < now\(\) - make_interval/);
  assert.doesNotMatch(src, /\boffset \$\{/i, 'chunks are ranges, not offsets');
  assert.match(src, /collate "C" limit/, 'each chunk in byte order');
  assert.match(readFileSync(new URL('../app/robots.ts', import.meta.url), 'utf8'), /\(await sitemapIndex\(\)\)\.n/);
  assert.match(readFileSync(new URL('../app/sitemaps/sitemap.ts', import.meta.url), 'utf8'), /publishedIds\(await sitemapIndex\(\)\)/);
});

test('publishedIds: every id up to the high-water mark', async () => {
  const { publishedIds } = await import('./sitemaps.ts');
  assert.deepEqual(publishedIds({ firsts: ['B'], n: 7, published: 3 }), ['1', '2', '3']);
  assert.deepEqual(publishedIds({ firsts: ['B', 'C'], n: 9, published: 0 }), ['1', '2']);
  assert.deepEqual(publishedIds({ firsts: [], n: 0, published: 0 }), []);
});

// Small chunks (the `limit` test hook) so these run fast: 25 indexable symbols in chunks of 10 → 3 sitemaps.
const L = 10;
async function fixture() {
  const { sql } = await import('./db.ts');
  const tag = `sk${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const users = await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, 2) returning id),
         n as (select id, row_number() over (order by id) as k from a)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag.toLowerCase()} || k, ${tag} || k, now(), id from n returning id`;
  const [u1, u2] = users.map((u) => u.id as number);
  const sym = (s: string) => `${tag}${s}`;
  const add = (names: string[]) => sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
    select case when j = 2 then ${u2}::int else ${u1}::int end, s || '-' || j, 'a', s, now() - interval '2 days', now() - interval '1 day', 0.01, 1, true
    from unnest(${names.map(sym)}::text[]) s, generate_series(0, 2) j`;
  const base = Array.from({ length: 25 }, (_, i) => String(i + 1).padStart(3, '0'));
  await add(base);
  const opts = { prefix: tag, limit: L };
  const done = async () => { await sql`delete from users where id in (${u1}, ${u2})`; await sql`delete from sitemap_chunks where scope = ${tag}`; };
  return { sql, tag, u1, u2, sym, add, base, opts, done };
}
const allChunks = async (opts: { prefix: string; limit: number }, ks: number[]) => {
  const { sitemapChunk } = await import('./sitemaps.ts');
  const out: string[][] = [];
  for (const k of ks) out[k] = (await sitemapChunk(k, opts)).map((r) => r.symbol);
  return out;
};

dbTest('two servers agree: a fresh module (another server) reads the same boundaries and lists the same ids', async () => {
  const f = await fixture();
  try {
    const a = await import('./sitemaps.ts');
    const other = 'server=2';
    const b: typeof a = await import(`./sitemaps.ts?${other}`);
    const ia = await a.rebuildSitemapIndex(f.opts);
    const ib = await b.sitemapIndex(f.opts);
    assert.deepEqual(ib, ia);
    assert.deepEqual(ia!.firsts, [f.sym('011'), f.sym('021')]);
    assert.equal(ia!.n, 25);
    assert.deepEqual(b.publishedIds(ib), a.publishedIds(ia!));
    const c = await allChunks(f.opts, [0, 1, 2]);
    assert.deepEqual(c.map((x) => x.length), [10, 10, 5]);
    assert.deepEqual(c.flat(), f.base.map(f.sym), 'every symbol once, in order');
  } finally { await f.done(); }
});

dbTest('shrink: a sitemap robots.txt once listed answers empty (200), never 404; robots lists fewer', async () => {
  const f = await fixture();
  try {
    const { rebuildSitemapIndex, publishedIds, sitemapChunk } = await import('./sitemaps.ts');
    assert.equal((await rebuildSitemapIndex(f.opts))!.published, 2);
    await f.sql`update closed_trades set verified = false where symbol = any(${f.base.slice(10).map(f.sym)}::text[])`;
    const ix = (await rebuildSitemapIndex(f.opts))!;
    assert.deepEqual(ix.firsts, [], 'robots.txt now lists /sitemap.xml alone');
    assert.equal(ix.n, 10);
    assert.deepEqual(publishedIds(ix), ['1', '2'], 'both ids still answer');
    assert.deepEqual(await sitemapChunk(1, f.opts), []);
    assert.deepEqual(await sitemapChunk(2, f.opts), []);
    assert.equal((await sitemapChunk(0, f.opts)).length, 10);
  } finally { await f.done(); }
});

// C5-43 (c) replaced "stale boundaries: … an overflow marks the row stale and the next read rebuilds": a request no
// longer rebuilds, so the same completeness is asserted after the cron's rebuild, and no chunk ever holds more than L.
dbTest('C5-43 (c): new closes wait for the cron\'s rebuild: no request rebuilds, even on a stale row; after it every symbol is in exactly one chunk, none above its size', async () => {
  const f = await fixture();
  try {
    const { rebuildSitemapIndex, rebuildSitemapIfDue, sitemapIndex, sitemapRebuilds } = await import('./sitemaps.ts');
    await rebuildSitemapIndex(f.opts);
    const stale = () => f.sql`update sitemap_chunks set built_at = '-infinity' where scope = ${f.tag}`;
    // 5 new symbols inside chunk 1's range, and the row stale: requests serve the stored sitemap and build nothing.
    const mid = ['011A', '012A', '013A', '014A', '015A'];
    await f.add(mid);
    await stale();
    const before = sitemapRebuilds.count;
    const c = await allChunks(f.opts, [0, 1, 2]);
    assert.deepEqual(c.map((x) => x.length), [10, 10, 5]);
    assert.deepEqual(c.flat(), f.base.map(f.sym), 'the stored sitemap: the new symbols are not listed yet');
    assert.equal((await sitemapIndex(f.opts)).n, 25);
    assert.equal(sitemapRebuilds.count, before, 'no request rebuilds');
    // The cron's step rebuilds the stale row: every symbol once, in order, in chunks of L.
    assert.deepEqual(await rebuildSitemapIfDue(f.opts), { rebuilt: true, n: 30 });
    assert.equal(sitemapRebuilds.count, before + 1);
    const d = await allChunks(f.opts, [0, 1, 2, 3]);
    assert.deepEqual(d.map((x) => x.length), [10, 10, 10, 0]);
    assert.deepEqual(d.flat(), [...f.base, ...mid].sort().map(f.sym), 'every symbol in exactly one chunk');
    // More new symbols in chunk 1's range than it holds, and one before chunk 0's first: the next rebuild cuts them
    // again; no chunk is ever above L.
    const ix = await sitemapIndex(f.opts);
    const into1 = Array.from({ length: 11 }, (_, i) => `${ix.firsts[0].slice(f.tag.length)}B${String(i).padStart(2, '0')}`);
    const into0 = ['000'];
    await f.add([...into1, ...into0]);
    assert.ok((await allChunks(f.opts, [0, 1, 2, 3])).every((x) => x.length <= L), 'before the rebuild: the stored chunks');
    await stale();
    assert.equal((await rebuildSitemapIfDue(f.opts)).rebuilt, true);
    const e = await allChunks(f.opts, [0, 1, 2, 3, 4]);
    assert.ok(e.every((x) => x.length <= L), e.map((x) => x.length).join(','));
    assert.deepEqual(e.flat(), [...f.base, ...mid, ...into1, ...into0].sort().map(f.sym), 'after the rebuild: complete, once each');
  } finally { await f.done(); }
});

dbTest('a profile being deleted leaves every chunk at once, without a rebuild (fix #4)', async () => {
  const f = await fixture();
  try {
    const { rebuildSitemapIndex, sitemapRebuilds } = await import('./sitemaps.ts');
    await rebuildSitemapIndex(f.opts);
    await f.sql`update users set deleted_at = now() where id = ${f.u2}`;
    const before = sitemapRebuilds.count;
    const c = await allChunks(f.opts, [0, 1, 2]);
    assert.deepEqual(c.flat(), [], 'one trader left: no symbol is indexable');
    assert.equal(sitemapRebuilds.count, before);
  } finally { await f.done(); }
});

// C5-43 (c) replaced "concurrent requests on two connections: one build for a missing row, one rebuild for a stale one":
// the build moved from the request to the cron, so the same once-only rule is asserted on concurrent cron calls, and
// requests build nothing.
dbTest('concurrent cron calls on two connections: one build for a missing row, one rebuild for a stale one, none while younger than REBUILD_MS; requests never build', async () => {
  const f = await fixture();
  try {
    const { sitemapIndex, rebuildSitemapIfDue, sitemapRebuilds, REBUILD_MS } = await import('./sitemaps.ts');
    let before = sitemapRebuilds.count;
    const none = await Promise.all(Array.from({ length: 4 }, () => sitemapIndex(f.opts)));
    for (const g of none) assert.deepEqual(g, { firsts: [], n: 0, published: 0 });
    assert.equal(sitemapRebuilds.count, before, 'missing row: requests build nothing (robots.txt lists /sitemap.xml alone)');
    const got = await Promise.all(Array.from({ length: 4 }, () => rebuildSitemapIfDue(f.opts)));
    assert.equal(sitemapRebuilds.count, before + 1, 'missing row: built once, the other calls skipped');
    assert.equal(got.filter((g) => g.rebuilt).length, 1);
    const built = await sitemapIndex(f.opts);
    assert.equal(built.n, 25);
    // Younger than REBUILD_MS on the database clock: no cron call rebuilds.
    await f.sql`update sitemap_chunks set built_at = now() - make_interval(secs => ${REBUILD_MS / 1000 - 30}) where scope = ${f.tag}`;
    assert.deepEqual(await rebuildSitemapIfDue(f.opts), { rebuilt: false, n: 25 });
    assert.equal(sitemapRebuilds.count, before + 1);
    await f.sql`update sitemap_chunks set built_at = now() - make_interval(secs => ${REBUILD_MS / 1000 + 1}) where scope = ${f.tag}`;
    before = sitemapRebuilds.count;
    const again = await Promise.all(Array.from({ length: 4 }, () => rebuildSitemapIfDue(f.opts)));
    assert.equal(sitemapRebuilds.count, before + 1, 'stale row: rebuilt once, the other calls skipped');
    assert.equal(again.filter((g) => g.rebuilt).length, 1);
    assert.deepEqual((await sitemapIndex(f.opts)).firsts, built.firsts);
  } finally { await f.done(); }
});

// C5-43 (c) replaced "the wait for another server's first build is bounded: a hung builder fails the request": a
// request no longer waits for any builder, so it answers at once; the cron's call skips while the lock is held.
dbTest('a request never waits for a builder: with another server\'s rebuild holding the lock, the index and every chunk answer at once', async () => {
  const f = await fixture();
  const postgres = (await import('postgres')).default;
  const other = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const { sitemapIndex, sitemapChunk, rebuildSitemapIfDue } = await import('./sitemaps.ts');
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    let locked!: () => void;
    const isLocked = new Promise<void>((r) => { locked = r; });
    const holder = other.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`sitemap_chunks:${f.tag}`}, 0))`;
      locked(); await held;
    });
    await isLocked;
    const t0 = performance.now();
    assert.deepEqual(await sitemapIndex({ ...f.opts, waitMs: 200 }), { firsts: [], n: 0, published: 0 });
    assert.deepEqual(await sitemapChunk(0, f.opts), []);
    assert.deepEqual(await rebuildSitemapIfDue(f.opts), { rebuilt: false, n: null }, 'the cron call skips while another builds');
    assert.ok(performance.now() - t0 < 3_000);
    release(); await holder;
  } finally { await other.end({ timeout: 1 }); await f.done(); }
});

dbTest('F-7: public-filing closes count neither in the boundaries nor in any chunk', async () => {
  const f = await fixture();
  try {
    const { rebuildSitemapIndex } = await import('./sitemaps.ts');
    await f.sql`update closed_trades set filing_url = 'https://filings.example/x' where symbol = any(${f.base.slice(20).map(f.sym)}::text[])`;
    const ix = (await rebuildSitemapIndex(f.opts))!;
    assert.equal(ix.n, 20);
    assert.deepEqual(ix.firsts, [f.sym('011')]);
    const c = await allChunks(f.opts, [0, 1]);
    assert.deepEqual(c.flat(), f.base.slice(0, 20).map(f.sym));
  } finally { await f.done(); }
});

// ---- chores cycle 5 (C5-43 part c): sitemap on the cron ----

test('C5-43 (c): no request aggregates closed_trades: robots.txt, the sitemap ids and every chunk read the stored sitemap; only the cron rebuilds', () => {
  const src = readFileSync(new URL('./sitemaps.ts', import.meta.url), 'utf8');
  const body = (name: string) => { const i = src.indexOf(`export async function ${name}(`); return src.slice(i, src.indexOf('\n}\n', i)); };
  for (const name of ['sitemapIndex', 'sitemapChunk']) {
    const b = body(name);
    assert.ok(b.length > 20, name);
    assert.doesNotMatch(b, /closed_trades|perTrader|rebuild|build\(|indexableCount/, `${name} reads only the stored sitemap`);
  }
  assert.match(body('sitemapChunk'), /stored\(/);
  // perTrader (the one closed_trades aggregation) is used by the rebuild and the test count only.
  assert.equal([...src.matchAll(/\bperTrader\(/g)].length, 2, 'used by the rebuild and indexableCount only');
  for (const f of ['../app/robots.ts', '../app/sitemap.ts', '../app/sitemaps/sitemap.ts']) {
    const s = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(s, /rebuildSitemap|indexableCount|closed_trades/, f);
  }
  // The cron: the housekeeping block, in its named block, inside `if (zero)` (before the sync).
  const route = readFileSync(new URL('../app/api/sync/route.ts', import.meta.url), 'utf8');
  const start = route.indexOf('// ---- chores cycle 5 (C5-43 part c): sitemap ----');
  const end = route.indexOf('// ---- end chores cycle 5 (C5-43 part c) ----');
  assert.ok(start > 0 && end > start, 'the named block');
  assert.match(route.slice(start, end), /await rebuildSitemapIfDue\(\)/);
  assert.match(route.slice(start, end), /catch \(e\) \{ console\.error\('sitemap rebuild failed', logSafe\(e\)\); \}/);
  assert.ok(route.lastIndexOf('if (zero) {', start) > 0 && route.indexOf('runShard(', end) > end, 'in the housekeeping, before the sync');
});

dbTest('C5-43 (c): the stored sitemap keeps per symbol and trader only a verified count and a UTC day; it prints the symbol and the day, and goes with the account', async () => {
  const f = await fixture();
  try {
    const { rebuildSitemapIndex, sitemapChunk } = await import('./sitemaps.ts');
    await f.sql`update closed_trades set closed_at = '2026-10-05T23:59:58.123Z' where user_id = ${f.u1} and symbol = ${f.sym('001')}`;
    await rebuildSitemapIndex(f.opts);
    const cols = (await f.sql`select column_name from information_schema.columns where table_schema = current_schema() and table_name = 'sitemap_traders' order by ordinal_position`).map((r) => r.column_name);
    assert.deepEqual(cols, ['scope', 'symbol', 'user_id', 'verified_trades', 'last_closed_day']);
    const rows = await f.sql`select user_id, verified_trades, last_closed_day::text as d from sitemap_traders where scope = ${f.tag} and symbol = ${f.sym('001')} order by user_id`;
    assert.deepEqual(rows.map((r) => [r.user_id, r.verified_trades, r.d]), [[f.u1, 2, '2026-10-05'], [f.u2, 1, rows[1].d]]);
    const [c0] = [await sitemapChunk(0, f.opts)];
    const e = symbolEntries(c0, 'http://l');
    assert.equal(e.length, 10);
    assert.ok(e.every((x) => x.lastModified && x.lastModified.getTime() % 86_400_000 === 0), 'lastmod is a UTC day');
    const { NOT_A_FIELD, PUBLIC_FIELDS } = await import('./privacy-fields.ts');
    const { SCHEMA_MAP } = await import('./privacy-retention.ts');
    for (const col of cols.map((c) => `sitemap_traders.${c}`)) assert.ok(NOT_A_FIELD[col], `${col} classified`);
    // The printed columns are copies of existing public fields, so the consent line and its versions are unchanged.
    assert.match(NOT_A_FIELD['sitemap_traders.symbol'], /public field "symbols"/);
    assert.match(NOT_A_FIELD['sitemap_traders.last_closed_day'], /public field "dates"/);
    assert.ok(!PUBLIC_FIELDS.some((x) => x.columns.some((c) => c.startsWith('sitemap_traders.'))));
    assert.equal(SCHEMA_MAP.sitemap_traders.personal, true);
    await f.sql`delete from users where id = ${f.u2}`;
    assert.equal((await f.sql`select count(*)::int as n from sitemap_traders where scope = ${f.tag} and user_id = ${f.u2}`)[0].n, 0, 'deleted with the account');
  } finally { await f.done(); }
});
