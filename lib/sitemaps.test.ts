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
  const { indexableCount, sitemapChunk } = await import('./sitemaps.ts');
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

dbTest('stale boundaries: new symbols land in exactly one chunk; an overflow in any chunk marks the row stale and the next read rebuilds', async () => {
  const f = await fixture();
  try {
    const { rebuildSitemapIndex, sitemapIndex, sitemapChunk, sitemapRebuilds } = await import('./sitemaps.ts');
    await rebuildSitemapIndex(f.opts);
    const stale = async () => (await f.sql`select built_at = '-infinity' as s from sitemap_chunks where scope = ${f.tag}`)[0].s as boolean;
    // 5 new symbols inside chunk 1's range: chunk 1 holds 15 (> L, ≤ 2L): nothing cut, row marked stale.
    const mid = ['011A', '012A', '013A', '014A', '015A'];
    await f.add(mid);
    const c = await allChunks(f.opts, [0, 2, 1]);
    assert.deepEqual([c[0].length, c[1].length, c[2].length], [10, 15, 5]);
    assert.deepEqual([...c[0], ...c[1], ...c[2]], [...f.base, ...mid].sort().map(f.sym), 'every symbol in exactly one chunk');
    assert.equal(await stale(), true, 'chunk 1 overflow marks the shared row stale');
    const before = sitemapRebuilds.count;
    const ix = await sitemapIndex(f.opts);
    assert.equal(sitemapRebuilds.count, before + 1);
    assert.equal(ix.firsts.length, 2); assert.equal(ix.n, 30);
    assert.equal(await stale(), false);
    const d = await allChunks(f.opts, [0, 1, 2]);
    assert.deepEqual(d.map((x) => x.length), [10, 10, 10]);
    // A further chunk above 2L is cut at 2L (until the rebuild it triggers); chunk 0 is cut at L.
    const ix2 = await sitemapIndex(f.opts);
    const into1 = Array.from({ length: 11 }, (_, i) => `${ix2.firsts[0].slice(f.tag.length)}B${String(i).padStart(2, '0')}`);
    const into0 = ['000'];
    await f.add([...into1, ...into0]);
    assert.equal((await sitemapChunk(1, f.opts)).length, 2 * L);
    assert.equal(await stale(), true);
    await rebuildSitemapIndex(f.opts);
    const e = await allChunks(f.opts, [0, 1, 2, 3, 4]);
    assert.deepEqual(e.flat(), [...f.base, ...mid, ...into1, ...into0].sort().map(f.sym), 'after the rebuild: complete, once each');
    await f.add(['0000']); // now chunk 0 has 11 → cut at L, stale
    await f.sql`update sitemap_chunks set built_at = now() where scope = ${f.tag}`;
    assert.equal((await sitemapChunk(0, f.opts)).length, L);
    assert.equal(await stale(), true, 'chunk 0 overflow marks it stale too');
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

dbTest('concurrent requests on two connections: one build for a missing row, one rebuild for a stale one', async () => {
  const f = await fixture();
  try {
    const { sitemapIndex, sitemapRebuilds } = await import('./sitemaps.ts');
    let before = sitemapRebuilds.count;
    const got = await Promise.all(Array.from({ length: 4 }, () => sitemapIndex(f.opts)));
    assert.equal(sitemapRebuilds.count, before + 1, 'missing row: built once, the others waited');
    for (const g of got) assert.deepEqual(g, got[0]);
    await f.sql`update sitemap_chunks set built_at = '-infinity' where scope = ${f.tag}`;
    before = sitemapRebuilds.count;
    const again = await Promise.all(Array.from({ length: 4 }, () => sitemapIndex(f.opts)));
    assert.equal(sitemapRebuilds.count, before + 1, 'stale row: rebuilt once, the others served the row they read');
    for (const g of again) assert.deepEqual(g.firsts, got[0].firsts);
  } finally { await f.done(); }
});

dbTest('the wait for another server\'s first build is bounded: a hung builder fails the request, it does not hang it', async () => {
  const f = await fixture();
  const postgres = (await import('postgres')).default;
  const other = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const { sitemapIndex } = await import('./sitemaps.ts');
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
    await assert.rejects(sitemapIndex({ ...f.opts, waitMs: 200 }), /lock timeout/);
    assert.ok(performance.now() - t0 < 3_000);
    release(); await holder;
  } finally { await other.end({ timeout: 1 }); await f.done(); }
});
