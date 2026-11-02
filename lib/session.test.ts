// lib/session.ts owner patches O1 and O2 (docs/security/review-2026-11-01.md F17, F11). next/headers needs a request,
// so this file stubs it: the cookie and header values come from the two maps below.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const g = globalThis as unknown as { __cookies: Map<string, string>; __headers: Map<string, string> };
g.__cookies = new Map();
g.__headers = new Map();
const STUB = `data:text/javascript,${encodeURIComponent(`
const g = globalThis;
export async function cookies() { return { get: (n) => (g.__cookies.has(n) ? { name: n, value: g.__cookies.get(n) } : undefined), set() {}, delete() {} }; }
export async function headers() { return { get: (n) => g.__headers.get(n) ?? null }; }`)}`;
registerHooks({ resolve: (spec, ctx, next) => (spec === 'next/headers' ? { url: STUB, shortCircuit: true } : next(spec, ctx)) });
const { currentUser, origin } = await import('./session.ts');

function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  return async () => {
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    const set = (e: Record<string, string | undefined>) => { for (const [k, v] of Object.entries(e)) if (v === undefined) delete process.env[k]; else process.env[k] = v; };
    set(env);
    try { await fn(); } finally { set(saved); g.__headers.clear(); }
  };
}

test('O2 origin: production with no site URL throws', withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: undefined, ALLOW_DEV_AUTH: undefined }, async () => {
  g.__headers.set('host', 'h.example');
  await assert.rejects(origin(), /NEXT_PUBLIC_SITE_URL is required in production/);
}));

test('O2 origin: the site URL wins in production; a non-public build (ALLOW_DEV_AUTH=1) keeps the request host', withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://site.example/', ALLOW_DEV_AUTH: undefined }, async () => {
  g.__headers.set('host', 'evil.example');
  assert.equal(await origin(), 'https://site.example');
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.ALLOW_DEV_AUTH = '1';
  assert.equal(await origin(), 'http://evil.example');
}));

test('O2 origin: a forwarded scheme other than https gives http://', withEnv({ NODE_ENV: 'test', NEXT_PUBLIC_SITE_URL: undefined }, async () => {
  g.__headers.set('host', 'h.example');
  g.__headers.set('x-forwarded-proto', 'javascript');
  assert.equal(await origin(), 'http://h.example');
  g.__headers.set('x-forwarded-proto', 'https');
  assert.equal(await origin(), 'https://h.example');
  g.__headers.set('x-forwarded-proto', 'https:');
  assert.equal(await origin(), 'http://h.example');
  g.__headers.delete('x-forwarded-proto');
  assert.equal(await origin(), 'http://h.example');
}));

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

dbTest('O1 currentUser: a session for a profile marked for deletion returns no user', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { createSession, SESSION_COOKIE, sessionSecret, signToken } = await import('./auth/sessions.ts');
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }));
  try {
    g.__cookies.set(SESSION_COOKIE, signToken(await createSession(u.id, new Date()), sessionSecret()));
    assert.equal((await currentUser())?.id, u.id);
    await sql`update users set deleted_at = now() where id = ${u.id}`;
    assert.equal(await currentUser(), null);
  } finally {
    g.__cookies.clear();
    await sql`delete from users where id = ${u.id}`;
  }
});
