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
  // The rejected call's own effect, not a table-wide count (which raced with the other test files' inserts): the call
  // carries a unique marker, and no row may carry it. The attested control proves the marker would be written.
  const marker = `attest-${Math.random().toString(36).slice(2, 10)}`;
  const mine = async () => (await sql`select id from signup_attempts where referred_surface = ${marker}`).map((r) => Number(r.id));
  await assert.rejects(createAttempt({ method: 'email', attested: false, surface: marker as never }), NotAttestedError);
  assert.deepEqual(await mine(), []);
  const control = await createAttempt({ method: 'email', attested: true, surface: marker as never });
  assert.deepEqual(await mine(), [control]);
  await sql`delete from funnel_events where attempt_id = ${control}`;
  await sql`delete from signup_attempts where id = ${control}`;
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
    // The provisional display name (= the old handle) follows the new handle: nothing shows the discarded handle.
    const [d1] = await sql`select display_name from users where id = ${u1.id}`;
    assert.equal(d1.display_name, `${tag}_new`);
    // A blank display name follows too.
    await sql`update users set display_name = ' ' where id = ${u1.id}`;
    await changeHandle(u1.id, `${tag}_blank`);
    assert.equal((await sql`select display_name from users where id = ${u1.id}`)[0].display_name, `${tag}_blank`);
    // A display name the trader typed themselves is never overwritten by a handle change.
    await sql`update users set display_name = 'Typed Name' where id = ${u1.id}`;
    await changeHandle(u1.id, `${tag}_again`);
    const [d2] = await sql`select handle, display_name from users where id = ${u1.id}`;
    assert.deepEqual(d2, { handle: `${tag}_again`, display_name: 'Typed Name' });
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

// Fix committee 2026-11-01 (decisions 7, 8, 11): the rename hold, reclaim, look-alikes and display names.
const letters = (p: string) => `${p}${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6).padEnd(6, 'q')}`;

dbTest('changeHandle: the old handle is held ~365 days for others, the same trader can take it back, deletion leaves a bare reservation', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt, createUserForAttempt, changeHandle, handleAvailable, HandleTakenError } = await import('./attempts.ts');
  const { checkHandle } = await import('../handles.ts');
  const tag = letters('rh');
  const a = `${tag}_a`, b = `${tag}_b`, c = `${tag}_c`;
  const ids: number[] = [];
  const verdict = (v: string) => (e: unknown) => e instanceof HandleTakenError && e.verdict === v;
  try {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: a });
    const other = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: c });
    ids.push(u.id, other.id);
    assert.equal(await changeHandle(u.id, b), b);
    const [r] = await sql`select user_id, extract(epoch from until - now()) / 86400 as days from handle_reservations where handle = ${a}`;
    assert.equal(Number(r.user_id), u.id);
    assert.ok(Number(r.days) > 364.9 && Number(r.days) <= 365, String(r.days));
    // Others: the old handle is unavailable, with the rule named (fix round 1: an active reservation is 'reserved').
    assert.equal(await handleAvailable(a), false);
    assert.equal(await checkHandle(a, other.id), 'reserved');
    await assert.rejects(changeHandle(other.id, a), verdict('reserved'));
    await assert.rejects(createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: a }), verdict('reserved'));
    await assert.rejects(changeHandle(other.id, b), verdict('taken'));
    await assert.rejects(changeHandle(other.id, 'Bad Handle!'), verdict('format'));
    await assert.rejects(changeHandle(other.id, 'admin'), verdict('reserved'));
    // The same trader takes the old handle back; that reservation goes, and the handle they leave is held instead.
    assert.equal(await checkHandle(a, u.id), 'ok');
    assert.equal(await changeHandle(u.id, a), a);
    assert.equal((await sql`select 1 from handle_reservations where handle = ${a}`).length, 0);
    assert.equal(Number((await sql`select user_id from handle_reservations where handle = ${b}`)[0].user_id), u.id);
    // The same handle again is a no-op.
    assert.equal(await changeHandle(u.id, a), a);
    assert.equal((await sql`select 1 from handle_reservations where handle = ${a}`).length, 0);
    // Deleting the account leaves only the bare reservation (handle and date), still binding everyone.
    await sql`delete from users where id = ${u.id}`;
    const [bare] = await sql`select user_id, until > now() as active from handle_reservations where handle = ${b}`;
    assert.deepEqual({ user_id: bare.user_id, active: bare.active }, { user_id: null, active: true });
    assert.equal(await checkHandle(b, other.id), 'reserved');
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
    await sql`delete from handle_reservations where handle in ${sql([a, b])}`;
  }
});

dbTest('changeHandle and createUserForAttempt: a look-alike of another live handle names the look-alike rule', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt, createUserForAttempt, changeHandle, HandleTakenError } = await import('./attempts.ts');
  const tag = letters('lk');
  const ids: number[] = [];
  const lookalike = (e: unknown) => e instanceof HandleTakenError && e.verdict === 'lookalike';
  try {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_calm` });
    const v = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_other` });
    ids.push(u.id, v.id);
    await assert.rejects(changeHandle(v.id, `${tag}_ca1m`), lookalike);
    await assert.rejects(createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_ca1m` }), lookalike);
    assert.equal((await sql`select handle from users where id = ${v.id}`)[0].handle, `${tag}_other`);
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});

dbTest('createUserForAttempt: a refused display name throws DisplayNameError and writes nothing; an accepted one is stored cleaned', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt, createUserForAttempt, DisplayNameError } = await import('./attempts.ts');
  const tag = letters('dn');
  const ids: number[] = [];
  try {
    const bad = await createAttempt({ method: 'dev', attested: true });
    await assert.rejects(createUserForAttempt(bad, { handle: `${tag}_x`, name: 'Verified Desk' }), (e: unknown) => e instanceof DisplayNameError && /verified/.test((e as Error).message));
    await assert.rejects(createUserForAttempt(bad, { handle: `${tag}_x`, name: 'Desk ✅' }), DisplayNameError);
    assert.equal((await sql`select 1 from users where handle = ${`${tag}_x`}`).length, 0);
    assert.equal((await sql`select user_id from signup_attempts where id = ${bad}`)[0].user_id, null);
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_y`, name: ' Ma​ya ‮' });
    ids.push(u.id);
    assert.equal((await sql`select display_name from users where id = ${u.id}`)[0].display_name, 'Maya');
    const blank = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_z`, name: '​ ' });
    ids.push(blank.id);
    assert.equal((await sql`select display_name from users where id = ${blank.id}`)[0].display_name, `${tag}_z`, 'an empty name falls back to the handle');
  } finally {
    if (ids.length) await sql`delete from users where id in ${sql(ids)}`;
  }
});
