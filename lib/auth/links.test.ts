import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attemptCookieValue, hashToken, issueLink, LINK_MINUTES, linkExpiry, linkStatus, newLinkToken, normalizeEmail, ownsAttempt, pendingLinkEmail, SendFailedError } from './links.ts';
import { defaultSender, httpsSender, memoryOutbox, memorySender } from './email.ts';
import { allow, resetRateLimits } from './rate-limit.ts';
import { LOGIN_MAIL } from '../copy.ts';

test('link token: random, url-safe, stored only as its sha256; 15-minute life; single use', () => {
  const a = newLinkToken(), b = newLinkToken();
  assert.notEqual(a.token, b.token);
  assert.match(a.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(a.hash, hashToken(a.token));
  assert.notEqual(a.hash, a.token);
  assert.equal(LINK_MINUTES, 15);
  const now = new Date('2026-01-01T00:00:00Z');
  const exp = linkExpiry(now);
  assert.equal(exp.getTime() - now.getTime(), 15 * 60_000);
  assert.equal(linkStatus(undefined, now), 'missing');
  assert.equal(linkStatus({ expires_at: exp, used_at: null }, now), 'ok');
  assert.equal(linkStatus({ expires_at: exp, used_at: null }, new Date(exp.getTime() + 1)), 'expired');
  assert.equal(linkStatus({ expires_at: exp, used_at: null }, exp), 'expired');
  assert.equal(linkStatus({ expires_at: exp, used_at: now }, now), 'used');
});

test('normalizeEmail lower-cases and trims; rejects junk', () => {
  assert.equal(normalizeEmail('  Trader@Example.COM '), 'trader@example.com');
  assert.equal(normalizeEmail('no-at-sign'), null);
  assert.equal(normalizeEmail('a @example.com'), null);
  assert.equal(normalizeEmail(42), null);
  assert.equal(normalizeEmail(`${'a'.repeat(250)}@example.com`), null);
});

test('email sender: one HTTPS call with the link only; the memory sink is the default outside production', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init: init! }); return new Response('', { status: 202 }); }) as typeof fetch;
  const send = httpsSender({ AUTH_EMAIL_SEND_URL: 'https://mail.example/send', AUTH_EMAIL_SEND_KEY: 'k', AUTH_EMAIL_FROM: 'noreply@example.com' }, fetchFn);
  await send({ to: 'trader@example.com', url: 'https://app.example/auth/email?t=abc' });
  assert.equal(calls.length, 1);
  const got = calls[0];
  const body = JSON.parse(String(got.init.body));
  assert.equal(got.url, 'https://mail.example/send');
  assert.equal((got.init.headers as Record<string, string>).authorization, 'Bearer k');
  assert.deepEqual(body, { from: 'noreply@example.com', to: 'trader@example.com', subject: LOGIN_MAIL.subject, text: LOGIN_MAIL.text('https://app.example/auth/email?t=abc') });
  const failing = httpsSender({ AUTH_EMAIL_SEND_URL: 'https://mail.example/send' }, (async () => new Response('', { status: 500 })) as typeof fetch);
  await assert.rejects(failing({ to: 'trader@example.com', url: 'https://app.example/x' }), (e: Error) => !/trader@|app\.example\/x/.test(e.message));
  assert.equal(defaultSender({}), memorySender);
  assert.throws(() => defaultSender({ NODE_ENV: 'production' }), /AUTH_EMAIL_SEND_URL/);
  assert.equal(defaultSender({ NODE_ENV: 'production', ALLOW_DEV_AUTH: '1' }), memorySender);
  await memorySender({ to: 'trader@example.com', url: 'u' });
  assert.deepEqual(memoryOutbox.last, { to: 'trader@example.com', url: 'u' });
});

test('rate limit: sliding window per key', () => {
  resetRateLimits();
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(allow('k', 3, 1000, t0 + i), true);
  assert.equal(allow('k', 3, 1000, t0 + 10), false);
  assert.equal(allow('other', 3, 1000, t0 + 10), true);
  assert.equal(allow('k', 3, 1000, t0 + 1001), true);
});

test('"Send again" ownership: the signed attempt cookie must name the same attempt; tampering and other ids fail', () => {
  const v = attemptCookieValue(42, 'k');
  assert.equal(ownsAttempt(v, 42, 'k'), true);
  assert.equal(ownsAttempt(v, 43, 'k'), false);
  assert.equal(ownsAttempt(v, 42, 'other'), false);
  assert.equal(ownsAttempt(`${v}x`, 42, 'k'), false);
  assert.equal(ownsAttempt('42', 42, 'k'), false);
  assert.equal(ownsAttempt(undefined, 42, 'k'), false);
  assert.equal(ownsAttempt(attemptCookieValue(0, 'k'), 0, 'k'), false);
});

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('../db.ts')).sql.unsafe(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('../db.ts')).sql.end({ timeout: 1 }); });

dbTest('issueLink: a send failure closes the link row (nothing claimable is left) and throws SendFailedError; a good send leaves one open link', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt } = await import('./attempts.ts');
  const attempt = await createAttempt({ method: 'email', attested: true });
  const email = `fail${Math.random().toString(36).slice(2, 8)}@example.com`;
  try {
    await assert.rejects(issueLink(attempt, email, async () => { throw new Error('sender down (500)'); }, 'https://app.example'), (e: Error) => e instanceof SendFailedError && !e.message.includes('@'));
    const rows = await sql`select expires_at, used_at from login_links where attempt_id = ${attempt}`;
    assert.equal(rows.length, 1);
    assert.equal(linkStatus(rows[0] as { expires_at: Date; used_at: Date | null }), 'used'); // the claim in app/auth/email/route.ts refuses it
    assert.equal(await pendingLinkEmail(attempt), email); // "Send again" still knows the address
    const sent: string[] = [];
    await issueLink(attempt, email, async (m) => { sent.push(m.url); }, 'https://app.example');
    assert.equal(sent.length, 1);
    const open = await sql`select token_hash from login_links where attempt_id = ${attempt} and used_at is null`;
    assert.equal(open.length, 1);
    assert.equal(open[0].token_hash, hashToken(new URL(sent[0]).searchParams.get('t')!));
  } finally {
    await sql`delete from login_links where attempt_id = ${attempt}`;
  }
});
