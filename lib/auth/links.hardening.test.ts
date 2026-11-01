// Security hardening (2026-11-01): F14 (opening the emailed link never claims it unless the browser that asked opens
// it; elsewhere a confirm step), F15 (auth_tx cleared on its own path), F17 (a profile marked for deletion cannot be
// signed into again and keeps no session), F28 (concurrent first claims for one address end in one user, no error).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { maskEmail } from './links.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('../db.ts')).sql.unsafe(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('../db.ts')).sql.end({ timeout: 1 }); });
const uniq = () => Math.random().toString(36).slice(2, 10);
const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('maskEmail: the first letter and the domain only, so a lured visitor can tell it is not their address', () => {
  assert.equal(maskEmail('trader@example.com'), 't•••@example.com');
  assert.equal(maskEmail('a@example.com'), 'a•••@example.com');
  assert.equal(maskEmail('no-at-sign'), '•••');
});

dbTest('peekLink: reports the status and the attempt without claiming; the claim afterwards still works once', async () => {
  const { claimLink, issueLink, peekLink } = await import('./links.ts');
  const { memoryOutbox, memorySender } = await import('./email.ts');
  const { createAttempt } = await import('./attempts.ts');
  const email = `peek${uniq()}@example.com`;
  const attempt = await createAttempt({ method: 'email', attested: true });
  await issueLink(attempt, email, memorySender, 'https://app.example');
  const token = new URL(memoryOutbox.last!.url).searchParams.get('t')!;
  for (let i = 0; i < 3; i++) assert.deepEqual(await peekLink(token), { status: 'ok', attemptId: attempt, email }); // a scanner's prefetches
  const claim = await claimLink(token);
  assert.equal(claim.status, 'ok');
  assert.deepEqual(await peekLink(token), { status: 'used' });
  assert.deepEqual(await peekLink('short'), { status: 'missing' });
  assert.deepEqual(await peekLink(`${token}x`), { status: 'missing' });
});

test('GET /auth/email claims only for the browser holding the signed attempt cookie; anyone else gets the confirm step (a POST)', () => {
  const route = src('app/auth/email/route.ts');
  assert.match(route, /peekLink\(/);
  assert.match(route, /ownsAttempt\(/);
  assert.match(route, /\/auth\/email\/confirm\?t=/);
  assert.ok(route.indexOf('ownsAttempt(') < route.indexOf('finishEmailLink('));
  assert.doesNotMatch(route, /claimLink\(/);
  const page = src('app/auth/email/confirm/page.tsx');
  assert.match(page, /peekLink\(/);
  assert.match(page, /<form action=\{confirmEmailLink\}>/);
  assert.match(page, /maskEmail\(/);
  assert.match(page, /<h1>/);
  const actions = src('app/auth/actions.ts');
  assert.match(actions, /export async function confirmEmailLink\(/);
  // The attempt cookie reaches /auth (was path /login).
  assert.match(actions, /set\(ATTEMPT_COOKIE, [^\n]*path: '\/'/);
});

test('F15: the OIDC callback clears auth_tx on the path it was set on (/auth)', () => {
  const route = src('app/auth/callback/[provider]/route.ts');
  assert.match(route, /jar\.delete\(\{ name: TX_COOKIE, path: '\/auth' \}\)/);
  assert.match(src('app/auth/actions.ts'), /set\(TX_COOKIE, [\s\S]{0,200}path: '\/auth'/);
});

dbTest('F17: a profile marked for deletion is not found by its identity or its address; a new sign-in neither reaches it nor fails with a database error', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt, signInWithIdentity, DeletionPendingError } = await import('./attempts.ts');
  const email = `gone${uniq()}@example.com`;
  const u = await signInWithIdentity(await createAttempt({ method: 'email', attested: true }), { provider: 'email', subject: email, email });
  await sql`update users set deleted_at = now() where id = ${u.id}`;
  try {
    const a2 = await createAttempt({ method: 'email', attested: true });
    await assert.rejects(signInWithIdentity(a2, { provider: 'email', subject: email, email }), DeletionPendingError);
    // No second account was left behind for the taken identity, and the attempt is not completed onto the marked profile.
    assert.equal((await sql`select 1 from identities where email = ${email}`).length, 1);
    const [r2] = await sql`select user_id from signup_attempts where id = ${a2}`;
    assert.equal(r2.user_id, null);
    assert.equal((await sql`select 1 from users where signup_attempt_id = ${a2}`).length, 0);
    // Another provider's verified address never reaches the marked profile either: it gets an account of its own.
    const a3 = await createAttempt({ method: 'provider_a', attested: true });
    const other = await signInWithIdentity(a3, { provider: 'provider_a', subject: `sub-${uniq()}`, email });
    assert.notEqual(other.id, u.id);
    await sql`delete from users where id = ${other.id}`;
  } finally {
    await sql`delete from users where id = ${u.id}`;
  }
});

dbTest('F17: deleteProfile ends every session of the profile in its first step, even when the vendor call then fails', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt, signInWithIdentity } = await import('./attempts.ts');
  const { createSession } = await import('./sessions.ts');
  const { deleteProfile } = await import('../delete.ts');
  const email = `sess${uniq()}@example.com`;
  const u = await signInWithIdentity(await createAttempt({ method: 'email', attested: true }), { provider: 'email', subject: email, email });
  await createSession(u.id);
  await createSession(u.id);
  try {
    await assert.rejects(deleteProfile({ id: u.id, handle: u.handle, snaptrade_user_id: 'v', snaptrade_secret_enc: 'e' }, { deleteVendorUser: async () => { throw new Error('vendor down'); } }), /vendor down/);
    assert.equal((await sql`select 1 from sessions where user_id = ${u.id}`).length, 0);
  } finally {
    await sql`delete from users where id = ${u.id}`;
  }
});

test('F17: the delete action ends this browser\'s session even when the deletion throws; the dev sign-in skips marked profiles', () => {
  assert.match(src('app/auth/actions.ts'), /try \{\s*await deleteRow\(user\);\s*\} finally \{\s*await endSession\(\);\s*\}/);
  assert.match(src('app/actions.ts'), /select id from users where handle = \$\{handle\} and deleted_at is null/);
});

dbTest('F28: two first claims for one address at once end in one user and one identity, both signed into it, no orphan users row', async () => {
  const { sql } = await import('../db.ts');
  const { createAttempt, signInWithIdentity } = await import('./attempts.ts');
  const email = `race${uniq()}@example.com`;
  const [a1, a2, a3] = [await createAttempt({ method: 'email', attested: true }), await createAttempt({ method: 'email', attested: true }), await createAttempt({ method: 'email', attested: true })];
  const out = await Promise.all([a1, a2, a3].map((a) => signInWithIdentity(a, { provider: 'email', subject: email, email })));
  try {
    assert.equal(new Set(out.map((u) => u.id)).size, 1);
    assert.equal((await sql`select 1 from identities where provider = 'email' and subject = ${email}`).length, 1);
    const attempts = await sql`select user_id from signup_attempts where id in ${sql([a1, a2, a3])}`;
    for (const r of attempts) assert.equal(r.user_id, out[0].id);
    assert.equal((await sql`select 1 from users where signup_attempt_id in ${sql([a1, a2, a3])} and id <> ${out[0].id}`).length, 0);
  } finally {
    await sql`delete from users where id = ${out[0].id}`;
  }
});

test('F28: the email link route turns an unexpected error into the expired state, logging a code only', () => {
  const finish = src('app/auth/email/finish.ts');
  assert.match(finish, /catch \(e\)/);
  assert.match(finish, /\/login\?error=expired/);
  assert.match(finish, /console\.error\('email sign-in failed', \{ code: /);
  assert.doesNotMatch(finish, /console\.\w+\([^\n]*(\.message|\.detail|\.email|, e\))/); // never the error itself, its detail or an address
});
