import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSitemapEntries, isIndexableTicker, siteUrl, SITEMAP_LIMIT } from './ticker.ts';

const t0 = Date.UTC(2026, 0, 1);

test('isIndexableTicker: needs 3 verified trades from 2 traders', () => {
  assert.equal(isIndexableTicker({ verifiedTrades: 0, verifiedTraders: 0 }), false);
  assert.equal(isIndexableTicker({ verifiedTrades: 2, verifiedTraders: 2 }), false);
  assert.equal(isIndexableTicker({ verifiedTrades: 3, verifiedTraders: 1 }), false);
  assert.equal(isIndexableTicker({ verifiedTrades: 3, verifiedTraders: 2 }), true);
  assert.equal(isIndexableTicker({ verifiedTrades: 0, verifiedTraders: 0 }), false); // demo-only: many rows, verified 0
  assert.equal(isIndexableTicker({ verifiedTrades: 2, verifiedTraders: 2 }), false); // 10 rows, only 2 verified
  assert.equal(isIndexableTicker({ verifiedTrades: NaN, verifiedTraders: 5 }), false);
  assert.equal(isIndexableTicker({ verifiedTrades: 5, verifiedTraders: -2 }), false);
});

test('siteUrl: env precedence, trailing slashes, never throws', () => {
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://a.example' }), 'https://a.example');
  assert.equal(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'b.vercel.app' }), 'https://b.vercel.app');
  assert.equal(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'https://b.vercel.app' }), 'https://b.vercel.app');
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://a.example', VERCEL_PROJECT_PRODUCTION_URL: 'b.vercel.app' }), 'https://a.example');
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://a.example//' }), 'https://a.example');
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: '  ', VERCEL_PROJECT_PRODUCTION_URL: '' }), 'http://localhost:3000');
  assert.equal(siteUrl({}), 'http://localhost:3000');
});

const sm = (symbol: string, trades = 3, traders = 2) => ({ symbol, lastClosedAt: new Date(t0), verifiedTrades: trades, verifiedTraders: traders });

test('buildSitemapEntries: filters, encodes, sorts, caps', () => {
  const e = buildSitemapEntries([sm('ZZZ'), sm('THIN', 2, 2), sm('A B'), sm('BRK.B'), sm('AAPL')], 'https://x.example/');
  assert.deepEqual(e.map((x) => x.url), ['https://x.example/', 'https://x.example/t', 'https://x.example/t/A%20B', 'https://x.example/t/AAPL', 'https://x.example/t/BRK.B', 'https://x.example/t/ZZZ']);
  assert.equal(e[0].lastModified, undefined);
  assert.ok(e[2].lastModified instanceof Date);
  for (const x of e) assert.ok(Object.keys(x).every((k) => k === 'url' || k === 'lastModified'));
  const many = Array.from({ length: SITEMAP_LIMIT + 1 }, (_, i) => sm(`S${String(i).padStart(5, '0')}`));
  assert.equal(buildSitemapEntries(many, 'http://l').length, SITEMAP_LIMIT + 2);
  assert.deepEqual(buildSitemapEntries([], 'http://l').map((x) => x.url), ['http://l/', 'http://l/t']);
  const bad = buildSitemapEntries([{ ...sm('BAD'), lastClosedAt: new Date(NaN) }], 'http://l');
  assert.equal(bad[2].lastModified, undefined);
});
