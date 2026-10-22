import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SESSION_DAYS, sessionSecret, signToken, unsignToken } from './sessions.ts';

test('session cookie value is token.signature; tampering or another key is rejected', () => {
  const v = signToken('tok_abc', 'key1');
  assert.match(v, /^tok_abc\.[A-Za-z0-9_-]{40,}$/);
  assert.equal(unsignToken(v, 'key1'), 'tok_abc');
  assert.equal(unsignToken(v, 'key2'), null);
  assert.equal(unsignToken(v.replace('tok_abc', 'tok_abd'), 'key1'), null);
  assert.equal(unsignToken(v.slice(0, -1) + (v.endsWith('A') ? 'B' : 'A'), 'key1'), null);
  assert.equal(unsignToken('tok_abc', 'key1'), null);
  assert.equal(unsignToken(undefined, 'key1'), null);
  assert.equal(unsignToken('42', 'key1'), null); // the old plain uid cookie is never a session
});

test('sessionSecret: SESSION_SECRET, else APP_SECRET_KEY, else throws; sessions last 30 days', () => {
  assert.equal(sessionSecret({ SESSION_SECRET: 's', APP_SECRET_KEY: 'a' }), 's');
  assert.equal(sessionSecret({ APP_SECRET_KEY: 'a' }), 'a');
  assert.throws(() => sessionSecret({}), /SESSION_SECRET/);
  assert.equal(SESSION_DAYS, 30);
});

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('../db.ts')).sql.unsafe(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('../db.ts')).sql.end({ timeout: 1 }); });

dbTest('sessions: created, looked up by hash, expire, delete; the raw token is never stored', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt, createUserForAttempt } = await import('./attempts.ts');
  const { createSession, deleteSession, userIdForSession } = await import('./sessions.ts');
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }));
  try {
    const now = new Date();
    const token = await createSession(u.id, now);
    assert.equal((await sql`select 1 from sessions where token_hash = ${token}`).length, 0);
    assert.equal(await userIdForSession(token, now), u.id);
    assert.equal(await userIdForSession('nope', now), null);
    assert.equal(await userIdForSession(token, new Date(now.getTime() + 31 * 86_400_000)), null);
    const later = new Date(now.getTime() + 2 * 3_600_000);
    assert.equal(await userIdForSession(token, later), u.id);
    const [s] = await sql`select last_seen_at from sessions where user_id = ${u.id}`;
    assert.equal(new Date(s.last_seen_at).getTime(), later.getTime());
    await deleteSession(token);
    assert.equal(await userIdForSession(token, now), null);
    // Signing in while signed in: the new session replaces the one this browser already holds.
    const first = await createSession(u.id, now);
    const second = await createSession(u.id, now, first);
    assert.equal(await userIdForSession(first, now), null);
    assert.equal(await userIdForSession(second, now), u.id);
    assert.equal((await sql`select count(*)::int as n from sessions where user_id = ${u.id}`)[0].n, 1);
    const third = await createSession(u.id, now, 'not-a-session'); // an unknown token replaces nothing
    assert.equal((await sql`select count(*)::int as n from sessions where user_id = ${u.id}`)[0].n, 2);
    assert.equal(await userIdForSession(third, now), u.id);
  } finally {
    await sql`delete from users where id = ${u.id}`;
  }
});
