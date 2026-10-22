import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HANDLE_RESERVED_DAYS } from './delete.ts';

test('a deleted handle is reserved for one year', () => assert.equal(HANDLE_RESERVED_DAYS, 365));

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

dbTest('deleteProfile: vendor first (a failure deletes nothing), then the row cascades, the handle is reserved with no personal data', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt, signInWithIdentity, handleAvailable } = await import('./auth/attempts.ts');
  const { createSession } = await import('./auth/sessions.ts');
  const { deleteProfile } = await import('./delete.ts');
  const tag = `del${Math.random().toString(36).slice(2, 8)}`;
  const attempt = await createAttempt({ method: 'email', attested: true });
  const u = await signInWithIdentity(attempt, { provider: 'email', subject: `${tag}@example.com`, email: `${tag}@example.com` });
  await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  await createSession(u.id);
  const user = { id: u.id, handle: u.handle, snaptrade_user_id: `${tag}-vendor`, snaptrade_secret_enc: 'enc' };
  try {
    await assert.rejects(deleteProfile(user, { deleteVendorUser: async () => { throw new Error('vendor down'); } }), /vendor down/);
    assert.equal((await sql`select 1 from users where id = ${u.id}`).length, 1);
    assert.equal((await sql`select 1 from handle_reservations where handle = ${u.handle}`).length, 0);
    const vendorCalls: string[] = [];
    await deleteProfile(user, { deleteVendorUser: async (v) => { vendorCalls.push(v.snaptradeUserId); } });
    assert.deepEqual(vendorCalls, [`${tag}-vendor`]);
    assert.equal((await sql`select 1 from users where id = ${u.id}`).length, 0);
    assert.equal((await sql`select 1 from sessions where user_id = ${u.id}`).length, 0);
    assert.equal((await sql`select 1 from identities where user_id = ${u.id}`).length, 0);
    const [res] = await sql`select * from handle_reservations where handle = ${u.handle}`;
    assert.deepEqual(Object.keys(res).sort(), ['handle', 'until']);
    assert.ok(new Date(res.until).getTime() > Date.now() + 364 * 86_400_000);
    const [att] = await sql`select user_id, completed_at from signup_attempts where id = ${attempt}`;
    assert.equal(att.user_id, null); // the funnel row survives without the person
    assert.ok(att.completed_at);
    assert.equal(await handleAvailable(u.handle), false);
    await assert.rejects(createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: u.handle }));
  } finally {
    await sql`delete from users where id = ${u.id}`;
    await sql`delete from handle_reservations where handle = ${u.handle}`;
  }
});
