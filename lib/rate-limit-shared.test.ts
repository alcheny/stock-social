// Security hardening (2026-11-01): the shared Postgres limiter, its keys (no personal data) and the client address.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalEmail, clientIp, limitKey, windowStart } from './rate-limit.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  await sql`delete from rate_limits where key like 'test:%'`;
  await sql.end({ timeout: 1 });
});

test('limitKey: scope plus a keyed hash; never the value itself; stable per value, distinct per value and scope', () => {
  process.env.SESSION_SECRET ||= 'test-secret-for-limit-keys';
  const a = limitKey('mail', 'trader@example.com');
  assert.match(a, /^mail:[0-9a-f]{32}$/);
  assert.ok(!a.includes('trader'));
  assert.equal(a, limitKey('mail', 'trader@example.com'));
  assert.notEqual(a, limitKey('mail', 'other@example.com'));
  assert.notEqual(a.slice(5), limitKey('ip', 'trader@example.com').slice(3)); // same hash, but the scope differs
  assert.equal(limitKey('ip', '1.2.3.4').startsWith('ip:'), true);
});

test('canonicalEmail: lower-case, +tag stripped from the local part (for the limit key only)', () => {
  assert.equal(canonicalEmail('Trader+news@Example.com'), 'trader@example.com');
  assert.equal(canonicalEmail('trader+a+b@example.com'), 'trader@example.com');
  assert.equal(canonicalEmail('trader@example.com'), 'trader@example.com');
  assert.equal(canonicalEmail('+x@example.com'), '@example.com');
});

test('clientIp: proxy headers only on Vercel or with TRUST_PROXY_HEADERS=1; IPv6 truncated to /64; junk is null', () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(clientIp(h({ 'x-real-ip': '203.0.113.7' }), {}), null); // headers are forgeable without a trusted proxy
  assert.equal(clientIp(h({ 'x-real-ip': '203.0.113.7' }), { VERCEL: '1' }), '203.0.113.7');
  assert.equal(clientIp(h({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' }), { TRUST_PROXY_HEADERS: '1' }), '198.51.100.2');
  assert.equal(clientIp(h({ 'x-real-ip': '198.51.100.9', 'x-forwarded-for': '1.1.1.1' }), { TRUST_PROXY_HEADERS: '1' }), '198.51.100.9');
  assert.equal(clientIp(h({ 'x-real-ip': '2001:db8:1:2:3:4:5:6' }), { VERCEL: '1' }), '2001:db8:1:2::/64');
  assert.equal(clientIp(h({ 'x-real-ip': '2001:db8::1' }), { VERCEL: '1' }), '2001:db8:0:0::/64');
  assert.equal(clientIp(h({ 'x-real-ip': '[2001:db8:a::1]' }), { VERCEL: '1' }), '2001:db8:a:0::/64');
  assert.equal(clientIp(h({ 'x-real-ip': 'not-an-ip' }), { VERCEL: '1' }), null);
  assert.equal(clientIp(h({}), { VERCEL: '1' }), null);
  assert.equal(clientIp(h({ 'x-real-ip': '203.0.113.7' }), { TRUST_PROXY_HEADERS: 'true' }), null);
});

test('windowStart: fixed windows aligned to the epoch', () => {
  assert.equal(windowStart(new Date('2026-01-01T00:14:59Z'), 900).toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(windowStart(new Date('2026-01-01T00:15:00Z'), 900).toISOString(), '2026-01-01T00:15:00.000Z');
});

dbTest('hit: allows up to the limit per window, refuses past it, starts over in the next window; keys and windows are independent', async () => {
  const { hit } = await import('./rate-limit.ts');
  const key = `test:${Math.random().toString(36).slice(2, 10)}`;
  const t0 = new Date('2030-01-01T00:00:00Z');
  for (let i = 0; i < 3; i++) assert.equal(await hit(key, 3, 60, new Date(t0.getTime() + i * 1000)), true);
  assert.equal(await hit(key, 3, 60, new Date(t0.getTime() + 10_000)), false);
  assert.equal(await hit(`${key}-other`, 3, 60, t0), true);
  assert.equal(await hit(key, 3, 3600, t0), true); // another window length is its own counter
  assert.equal(await hit(key, 3, 60, new Date(t0.getTime() + 60_000)), true); // next window
});

dbTest('hit: parallel calls never slip past the limit (one upsert per call)', async () => {
  const { hit } = await import('./rate-limit.ts');
  const key = `test:${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date('2030-01-02T00:00:00Z');
  const got = await Promise.all(Array.from({ length: 12 }, () => hit(key, 5, 60, now)));
  assert.equal(got.filter(Boolean).length, 5);
});

dbTest('pruneRateLimits: windows that ended more than a day ago go; current ones stay', async () => {
  const { hit, pruneRateLimits } = await import('./rate-limit.ts');
  const { sql } = await import('./db.ts');
  const key = `test:${Math.random().toString(36).slice(2, 10)}`;
  await hit(key, 5, 60, new Date(Date.now() - 3 * 86_400_000));
  await hit(key, 5, 60);
  await pruneRateLimits();
  const rows = await sql`select window_start from rate_limits where key like ${`${key}%`}`;
  assert.equal(rows.length, 1);
});
