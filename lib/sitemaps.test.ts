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
  }
});
