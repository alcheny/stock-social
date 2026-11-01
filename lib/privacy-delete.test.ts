// Privacy work (2026-11-01, tester QA 1, committee D17): deleting an account deletes its privacy marks and display log;
// its sign-up attempts stay only as anonymous funnel rows (no user link, no vendor id), as F-1 designed (lib/delete.test.ts).
import { after, before } from 'node:test';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

dbTest('deleting an account removes its marks and display log; its attempts (first and later sign-ins) keep no user link and no vendor id', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt, completeAttempt } = await import('./auth/attempts.ts');
  const { deleteProfile } = await import('./delete.ts');
  const tag = Math.random().toString(36).slice(2, 7);
  const first = await createAttempt({ method: 'dev', attested: true });
  const u = await createUserForAttempt(first, { handle: `pd${tag}` });
  const again = await createAttempt({ method: 'dev', attested: true });
  await completeAttempt(again, u.id);
  const otherAttempt = await createAttempt({ method: 'dev', attested: true });
  const other = await createUserForAttempt(otherAttempt, { handle: `po${tag}` });
  await sql`update signup_attempts set snaptrade_user_id = ${`pd-vendor-${tag}`}, snaptrade_secret_enc = 'enc' where id = ${again}`;
  await sql`insert into privacy_orphans (kind, viewer_id, trade_key) values ('like', ${u.id}, 'k')`;
  await sql`insert into display_log (user_id, day, demo, headline, trade_count, open_summary, evidence) values (${u.id}, '2026-10-01', false, 'h', 0, 'n', 'e')`;
  try {
    const [row] = await sql`select id, handle, snaptrade_user_id, snaptrade_secret_enc from users where id = ${u.id}`;
    await deleteProfile(row as never, { deleteVendorUser: async () => {} });
    const left = await sql`select user_id, snaptrade_user_id, snaptrade_secret_enc from signup_attempts where id in (${first}, ${again})`;
    assert.equal(left.length, 2);
    for (const a of left) assert.deepEqual([a.user_id, a.snaptrade_user_id, a.snaptrade_secret_enc], [null, null, null]);
    for (const [t, q] of [
      ['privacy_orphans', sql`select count(*)::int as n from privacy_orphans where viewer_id = ${u.id}`],
      ['display_log', sql`select count(*)::int as n from display_log where user_id = ${u.id}`],
    ] as const) assert.equal((await q)[0].n, 0, t);
    assert.equal((await sql`select user_id from signup_attempts where id = ${otherAttempt}`)[0].user_id, other.id);
  } finally {
    await sql`delete from users where id in (${u.id}, ${other.id})`;
  }
});
