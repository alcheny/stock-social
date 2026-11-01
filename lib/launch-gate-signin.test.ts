// Privacy work (2026-11-01, committee D4, D6, D7, D8): the launch gate where it is enforced.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

dbTest('closed: a new identity is refused with nothing written; a known subject and a verified-email match still sign in', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, signInWithIdentity } = await import('./auth/attempts.ts');
  const { SignUpClosedError } = await import('./launch-gate.ts');
  const tag = Math.random().toString(36).slice(2, 9);
  const mail = `gate-${tag}@example.test`;
  const a1 = await createAttempt({ method: 'email', attested: true });
  await assert.rejects(signInWithIdentity(a1, { provider: 'email', subject: mail, email: mail }, { allowNew: false }), SignUpClosedError);
  assert.equal((await sql`select count(*)::int as n from identities where email = ${mail}`)[0].n, 0);
  assert.equal((await sql`select user_id from signup_attempts where id = ${a1}`)[0].user_id, null);
  const before = (await sql`select count(*)::int as n from users`)[0].n;
  // Open: created. Closed again: the same subject, and the same verified address by another provider, sign in.
  const a2 = await createAttempt({ method: 'email', attested: true });
  const u = await signInWithIdentity(a2, { provider: 'email', subject: mail, email: mail }, { allowNew: true });
  try {
    assert.equal((await sql`select count(*)::int as n from users`)[0].n >= before + 1, true);
    const a3 = await createAttempt({ method: 'email', attested: true });
    assert.equal((await signInWithIdentity(a3, { provider: 'email', subject: mail, email: mail }, { allowNew: false })).id, u.id);
    const a4 = await createAttempt({ method: 'provider_a', attested: true });
    assert.equal((await signInWithIdentity(a4, { provider: 'provider_a', subject: `sub-${tag}`, email: mail }, { allowNew: false })).id, u.id);
    const a5 = await createAttempt({ method: 'provider_a', attested: true });
    await assert.rejects(signInWithIdentity(a5, { provider: 'provider_a', subject: `other-${tag}`, email: null }, { allowNew: false }), SignUpClosedError);
  } finally {
    await sql`delete from users where id = ${u.id}`;
  }
});

dbTest('identityEmails lists only the account\'s verified addresses (the email allowlist reads them)', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, signInWithIdentity } = await import('./auth/attempts.ts');
  const { identityEmails } = await import('./privacy-gate-data.ts');
  const tag = Math.random().toString(36).slice(2, 9);
  const u = await signInWithIdentity(await createAttempt({ method: 'provider_a', attested: true }), { provider: 'provider_a', subject: `s-${tag}`, email: `owner-${tag}@example.test` });
  try {
    await sql`insert into identities (user_id, provider, subject, email) values (${u.id}, 'provider_b', ${`b-${tag}`}, null)`;
    assert.deepEqual(await identityEmails(u.id), [`owner-${tag}@example.test`]);
  } finally {
    await sql`delete from users where id = ${u.id}`;
  }
});

test('every real sign-up and connect path checks the gate before it writes or calls the vendor', () => {
  const actions = src('app/auth/actions.ts');
  const brokerage = actions.slice(actions.indexOf("if (method === 'brokerage') {"));
  assert.ok(brokerage.indexOf('signUpOpen()') < brokerage.indexOf('createAttempt('), 'brokerage-first: gate before the attempt row');
  for (const f of ['app/auth/email/route.ts', 'app/auth/callback/[provider]/route.ts']) {
    const s = src(f);
    assert.match(s, /signInWithIdentity\([^;]*\{ allowNew: signUpOpen\([^)]*\) \}\)/, f);
    assert.match(s, /if \(e instanceof SignUpClosedError\) return NextResponse\.redirect\(`\$\{base\}\/login\?error=closed`, 303\);/, f);
  }
  const cb = src('app/auth/callback/[provider]/route.ts');
  assert.ok(cb.indexOf('SignUpClosedError) return') < cb.indexOf("return fail('exchange')"), 'caught before the generic provider failure');
  const start = src('app/connect/start/route.ts');
  assert.ok(start.indexOf('connectAllowed(me)') > 0 && start.indexOf('connectAllowed(me)') < start.indexOf('startConnection('), 'start: before the vendor');
  const portal = src('app/connect/portal/route.ts');
  assert.ok(portal.indexOf('connectAllowed(me)') > 0 && portal.indexOf('connectAllowed(me)') < portal.indexOf('mintPortal('), 'portal: before the vendor');
  const consent = src('app/connect/actions.ts');
  const ca = consent.slice(consent.indexOf('export async function consentAction'));
  assert.ok(ca.indexOf('connectAllowed(me)') > 0 && ca.indexOf('connectAllowed(me)') < ca.indexOf('consent(c.id)'), 'consent: before the record is imported');
  // The dev stub (guarded by devGuard) and demo data stay outside the gate.
  assert.doesNotMatch(src('app/actions.ts'), /launch-gate|signUpOpen|connectAllowed/);
});
