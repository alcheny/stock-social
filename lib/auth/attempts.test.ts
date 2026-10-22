import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMethod, METHODS, provisionalHandle } from './attempts.ts';
import { deviceFirst, orderMethods, providersFromEnv } from './providers.ts';

test('provisional handle: valid, random, never from the email', () => {
  const h = provisionalHandle();
  assert.match(h, /^trader_[a-z0-9]{8}$/);
  assert.notEqual(provisionalHandle(), h);
  assert.equal(provisionalHandle(() => Buffer.alloc(8)), 'trader_aaaaaaaa');
  assert.deepEqual([...METHODS], ['provider_a', 'provider_b', 'email', 'brokerage', 'dev']);
  assert.ok(isMethod('email') && !isMethod('sms'));
});

test('provider buttons exist only when their configuration is complete; the email link always does', () => {
  assert.deepEqual(providersFromEnv({}), []);
  assert.deepEqual(providersFromEnv({ AUTH_EMAIL_PROVIDER_ISSUER: 'https://a.example', AUTH_EMAIL_PROVIDER_CLIENT_ID: 'id' }), []);
  const both = providersFromEnv({
    AUTH_EMAIL_PROVIDER_ISSUER: 'https://a.example/', AUTH_EMAIL_PROVIDER_CLIENT_ID: 'id-a', AUTH_EMAIL_PROVIDER_CLIENT_SECRET: 'sec-a', AUTH_EMAIL_PROVIDER_LABEL: 'Mail Co',
    AUTH_DEVICE_PROVIDER_ISSUER: 'https://b.example', AUTH_DEVICE_PROVIDER_CLIENT_ID: 'id-b', AUTH_DEVICE_PROVIDER_CLIENT_SECRET: 'sec-b',
  });
  assert.deepEqual(both.map((p) => [p.key, p.issuer, p.label, p.responseMode]), [['provider_a', 'https://a.example', 'Mail Co', 'query'], ['provider_b', 'https://b.example', 'your phone account', 'form_post']]);
  assert.equal(both[0].clientSecret(), 'sec-a');
  const keyOnly = providersFromEnv({ AUTH_DEVICE_PROVIDER_ISSUER: 'https://b.example', AUTH_DEVICE_PROVIDER_CLIENT_ID: 'id-b', AUTH_DEVICE_PROVIDER_TEAM_ID: 't', AUTH_DEVICE_PROVIDER_KEY_ID: 'k' });
  assert.deepEqual(keyOnly, []); // private key missing
  assert.deepEqual(orderMethods({ available: [], deviceFirst: false }), ['email', 'brokerage']);
  assert.deepEqual(orderMethods({ available: ['provider_a', 'provider_b'], deviceFirst: false }), ['provider_a', 'provider_b', 'email', 'brokerage']);
  assert.deepEqual(orderMethods({ available: ['provider_a', 'provider_b'], deviceFirst: true }), ['provider_b', 'provider_a', 'email', 'brokerage']);
  assert.deepEqual(orderMethods({ available: ['provider_a'], deviceFirst: true, last: 'email' }), ['email', 'provider_a', 'brokerage']);
  assert.deepEqual(orderMethods({ available: ['provider_a'], deviceFirst: true, last: 'provider_b' }), ['provider_a', 'email', 'brokerage']);
  // The brokerage block (and its "or" divider) never moves first, whatever completed last.
  assert.deepEqual(orderMethods({ available: ['provider_a'], deviceFirst: false, last: 'brokerage' }), ['provider_a', 'email', 'brokerage']);
  assert.deepEqual(orderMethods({ available: [], deviceFirst: false, last: 'brokerage' }), ['email', 'brokerage']);
  assert.equal(deviceFirst('Mozilla/5.0 (PhoneOS 17)', { AUTH_DEVICE_PROVIDER_UA_PATTERN: 'PhoneOS' }), true);
  assert.equal(deviceFirst('Mozilla/5.0 (PhoneOS 17)', {}), false);
  assert.equal(deviceFirst('Mozilla/5.0', { AUTH_DEVICE_PROVIDER_UA_PATTERN: '(' }), false);
});

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('../db.ts')).sql.unsafe(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('../db.ts')).sql.end({ timeout: 1 }); });

dbTest('attestation first: no attempt without it, no users row without a linked attempt (schema-enforced)', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt, NotAttestedError } = await import('./attempts.ts');
  const [{ n: before }] = await sql`select count(*)::int as n from signup_attempts`;
  await assert.rejects(createAttempt({ method: 'email', attested: false }), NotAttestedError);
  const [{ n: after }] = await sql`select count(*)::int as n from signup_attempts`;
  assert.equal(after, before);
  await assert.rejects(sql`insert into users (handle, display_name, adult_attested_at) values ('att_nobody', 'x', now())`, /null value in column "signup_attempt_id"/);
  await assert.rejects(sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values ('att_nobody', 'x', now(), 999999999)`, /violates foreign key/);
  assert.equal((await sql`select 1 from users where handle = 'att_nobody'`).length, 0);
  const [{ orphans }] = await sql`select count(*)::int as orphans from users u left join signup_attempts a on a.id = u.signup_attempt_id where a.id is null or a.adult_attested_at is null`;
  assert.equal(orphans, 0);
});

dbTest('signInWithIdentity: new subject → new user with a provisional handle; same subject → same user; verified email links', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt, signInWithIdentity, createUserForAttempt, HandleTakenError, changeHandle } = await import('./attempts.ts');
  const tag = `s${Math.random().toString(36).slice(2, 8)}`;
  const email = `${tag}.local@example.com`;
  const ids: number[] = [];
  try {
    const a1 = await createAttempt({ method: 'provider_a', attested: true, source: 'direct' });
    const u1 = await signInWithIdentity(a1, { provider: 'provider_a', subject: `${tag}-sub`, email });
    ids.push(u1.id);
    assert.match(u1.handle, /^trader_[a-z0-9]{8}$/);
    assert.ok(!u1.handle.includes(tag), 'handle must not derive from the email');
    const [row] = await sql`select signup_attempt_id, adult_attested_at from users where id = ${u1.id}`;
    assert.equal(Number(row.signup_attempt_id), a1);
    const [att] = await sql`select user_id, completed_at from signup_attempts where id = ${a1}`;
    assert.equal(att.user_id, u1.id);
    assert.ok(att.completed_at);
    const a2 = await createAttempt({ method: 'provider_a', attested: true });
    const again = await signInWithIdentity(a2, { provider: 'provider_a', subject: `${tag}-sub`, email: null });
    assert.equal(again.id, u1.id);
    assert.equal((await sql`select 1 from users where handle like ${`trader_%`} and id = ${u1.id}`).length, 1);
    const a3 = await createAttempt({ method: 'email', attested: true });
    const viaMail = await signInWithIdentity(a3, { provider: 'email', subject: email, email });
    assert.equal(viaMail.id, u1.id, 'the email link is the recovery path for a provider account');
    assert.equal((await sql`select count(*)::int as n from identities where user_id = ${u1.id}`)[0].n, 2);
    const a4 = await createAttempt({ method: 'dev', attested: true });
    await assert.rejects(createUserForAttempt(a4, { handle: u1.handle }), HandleTakenError);
    assert.equal((await sql`select user_id from signup_attempts where id = ${a4}`)[0].user_id, null);
    const nh = await changeHandle(u1.id, `${tag}_new`);
    assert.equal(nh, `${tag}_new`);
    await assert.rejects(changeHandle(u1.id, 'Bad Handle!'), HandleTakenError);
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});

dbTest('referral on the attempt lands on the users row, insert-only', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt, createUserForAttempt } = await import('./attempts.ts');
  const ref = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `ref${Math.random().toString(36).slice(2, 8)}` });
  const ids = [ref.id];
  try {
    const u = await createUserForAttempt(await createAttempt({ method: 'email', attested: true, referredBy: ref.id, surface: 'month' }));
    ids.push(u.id);
    const [r] = await sql`select referred_by_user_id, referred_via, referred_surface from users where id = ${u.id}`;
    assert.deepEqual(r, { referred_by_user_id: ref.id, referred_via: null, referred_surface: 'month' });
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});
