import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HANDLE_RESERVED_DAYS } from './delete.ts';

test('a deleted handle is reserved for one year', () => assert.equal(HANDLE_RESERVED_DAYS, 365));

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

dbTest('deleteProfile: vendor first (a failure deletes nothing but marks deleted_at), then the row cascades, every sign-in link that carried the address goes, the handle is reserved with no personal data', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt, signInWithIdentity, handleAvailable } = await import('./auth/attempts.ts');
  const { createSession } = await import('./auth/sessions.ts');
  const { deleteProfile } = await import('./delete.ts');
  const { issueLink } = await import('./auth/links.ts');
  const tag = `del${Math.random().toString(36).slice(2, 8)}`;
  const email = `${tag}@example.com`;
  const attempt = await createAttempt({ method: 'email', attested: true });
  // Two links carry the address: the one on the completed attempt, and an unclaimed one on a later attempt (a second
  // sign-in started but never finished, so that attempt has no user_id). login_links has no FK to users.
  await issueLink(attempt, email, async () => {}, 'https://app.example');
  const u = await signInWithIdentity(attempt, { provider: 'email', subject: email, email });
  const laterAttempt = await createAttempt({ method: 'email', attested: true });
  await issueLink(laterAttempt, email, async () => {}, 'https://app.example');
  assert.equal((await sql`select 1 from login_links where email = ${email}`).length, 2);
  await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  await createSession(u.id);
  const user = { id: u.id, handle: u.handle, snaptrade_user_id: `${tag}-vendor`, snaptrade_secret_enc: 'enc' };
  try {
    await assert.rejects(deleteProfile(user, { deleteVendorUser: async () => { throw new Error('vendor down'); } }), /vendor down/);
    assert.equal((await sql`select 1 from users where id = ${u.id}`).length, 1);
    assert.equal((await sql`select 1 from login_links where email = ${email}`).length, 2); // nothing deleted before the vendor call succeeds
    assert.equal((await sql`select 1 from handle_reservations where handle = ${u.handle}`).length, 0);
    const [marked] = await sql`select deleted_at from users where id = ${u.id}`;
    assert.ok(marked.deleted_at); // deletion in progress: the row stays, marked, until the vendor call succeeds
    const vendorCalls: string[] = [];
    await deleteProfile(user, { deleteVendorUser: async (v) => { vendorCalls.push(v.snaptradeUserId); } });
    assert.deepEqual(vendorCalls, [`${tag}-vendor`]);
    assert.equal((await sql`select 1 from users where id = ${u.id}`).length, 0);
    assert.equal((await sql`select 1 from sessions where user_id = ${u.id}`).length, 0);
    assert.equal((await sql`select 1 from identities where user_id = ${u.id}`).length, 0);
    assert.equal((await sql`select 1 from login_links where email = ${email}`).length, 0); // zero rows carry the address (COMPLIANCE §3)
    assert.equal((await sql`select 1 from login_links where attempt_id in (${attempt}, ${laterAttempt})`).length, 0);
    const [res] = await sql`select * from handle_reservations where handle = ${u.handle}`;
    assert.deepEqual(Object.keys(res).sort(), ['handle', 'until', 'user_id']);
    assert.equal(res.user_id, null); // a deleted account's reservation never links to it (fix committee 2026-11-01, decision 8)
    assert.ok(new Date(res.until).getTime() > Date.now() + 364 * 86_400_000);
    const [att] = await sql`select user_id, completed_at from signup_attempts where id = ${attempt}`;
    assert.equal(att.user_id, null); // the funnel row survives without the person
    assert.ok(att.completed_at);
    assert.equal(await handleAvailable(u.handle), false);
    await assert.rejects(createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: u.handle }));
  } finally {
    await sql`delete from users where id = ${u.id}`;
    await sql`delete from login_links where attempt_id in (${attempt}, ${laterAttempt})`;
    await sql`delete from handle_reservations where handle = ${u.handle}`;
  }
});

// Known limits sweep 2 (indexes): the login_links delete was `attempt_id in (subq) or email in (subq)`, which Postgres
// never turns into joins (a seq scan of login_links whatever its indexes). deleteLoginLinks is the index-usable form.
// Same rows as the old statement on ordinary data; the one difference is an identity whose email is '': the old form
// then matched every claimed link (email blanked to '') of every other user.
const OLD_PREDICATE = (u: number) => `attempt_id in (select id from signup_attempts where user_id = ${u})
  or email in (select email from identities where user_id = ${u} and email is not null)`;

async function linkFixture(tx: import('postgres').TransactionSql, tag: string) {
  const mkAttempt = async () => Number((await tx`insert into signup_attempts (method, adult_attested_at) values ('email', now()) returning id`)[0].id);
  const mkUser = async (h: string) => {
    const a = await mkAttempt();
    const [u] = await tx`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${h}, 'x', now(), ${a}) returning id`;
    await tx`update signup_attempts set user_id = ${u.id}, completed_at = now() where id = ${a}`;
    return { id: Number(u.id), attempt: a };
  };
  const e = `${tag}@example.com`, f = `${tag}.f@example.com`, g = `${tag}.g@example.com`;
  const me = await mkUser(`${tag}_u`), other = await mkUser(`${tag}_v`);
  await tx`insert into identities (user_id, provider, subject, email) values (${me.id}, 'email', ${e}, ${e}), (${me.id}, 'provider_a', ${tag + 'a'}, null),
    (${other.id}, 'email', ${g}, ${g})`;
  const loose = await mkAttempt(); // a second sign-in that never finished: no user_id
  const link = (name: string, attempt: number, email: string) => ({ token_hash: `${tag}-${name}`, email, attempt_id: attempt, expires_at: new Date(Date.now() + 9e5) });
  const rows = [
    link('own-claimed', me.attempt, ''), link('own-open', me.attempt, e), link('loose-mine', loose, e), link('loose-other', loose, f),
    link('other-claimed', other.attempt, ''), link('other-open', other.attempt, g),
  ];
  await tx`insert into login_links ${tx(rows)}`;
  const attempts = [me.attempt, other.attempt, loose];
  return { me, attempts, oldSet: async () => (await tx.unsafe(`select token_hash from login_links where attempt_id in (${attempts.join(',')}) and (${OLD_PREDICATE(me.id)})`))
    .map((r) => String(r.token_hash).slice(tag.length + 1)).sort() };
}

class Rollback extends Error {}
const inRollback = async (fn: (tx: import('postgres').TransactionSql) => Promise<void>) => {
  const { sql } = await import('./db.ts');
  await sql.begin(async (tx) => { await fn(tx); throw new Rollback(); }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
};

dbTest('deleteLoginLinks: the same login_links rows as the old OR-of-IN statement on ordinary data (attempt arm, email arm, null-email identity, another user untouched)', async () => {
  const { deleteLoginLinks } = await import('./delete.ts');
  const tag = `dl${Math.random().toString(36).slice(2, 8)}`;
  await inRollback(async (tx) => {
    const fx = await linkFixture(tx, tag);
    const expected = ['loose-mine', 'own-claimed', 'own-open'];
    assert.deepEqual(await fx.oldSet(), expected);
    const gone = (await deleteLoginLinks(tx, fx.me.id)).map((h) => h.slice(tag.length + 1)).sort();
    assert.deepEqual(gone, expected);
    const left = (await tx`select token_hash from login_links where attempt_id in ${tx(fx.attempts)}`).map((r) => String(r.token_hash).slice(tag.length + 1)).sort();
    assert.deepEqual(left, ['loose-other', 'other-claimed', 'other-open']);
  });
});

dbTest('deleteLoginLinks: an identity with an empty email deletes no other user\'s claimed link (the old statement did)', async () => {
  const { deleteLoginLinks } = await import('./delete.ts');
  const tag = `dm${Math.random().toString(36).slice(2, 8)}`;
  await inRollback(async (tx) => {
    const fx = await linkFixture(tx, tag);
    await tx`insert into identities (user_id, provider, subject, email) values (${fx.me.id}, 'provider_b', ${tag + 'b'}, '')`;
    assert.deepEqual(await fx.oldSet(), ['loose-mine', 'other-claimed', 'own-claimed', 'own-open']); // the old bug, on this fixture
    const gone = (await deleteLoginLinks(tx, fx.me.id)).map((h) => h.slice(tag.length + 1)).sort();
    assert.deepEqual(gone, ['loose-mine', 'own-claimed', 'own-open']);
  });
});

dbTest('deleteLoginLinks: the statement can use login_links_attempt and login_links_email (no seq scan of login_links)', async () => {
  const { LOGIN_LINKS_DELETE } = await import('./delete.ts');
  await inRollback(async (tx) => {
    await tx`set local enable_seqscan = off`; // deterministic: proves the indexes are usable, whatever the table's stats
    const [row] = await tx.unsafe(`explain (format json) ${LOGIN_LINKS_DELETE}`, [-1]);
    const nodes: { 'Node Type': string; 'Relation Name'?: string; 'Index Name'?: string }[] = [];
    const walk = (n: Record<string, unknown>) => { nodes.push(n as never); for (const c of (n.Plans as Record<string, unknown>[] | undefined) ?? []) walk(c); };
    walk((row['QUERY PLAN'] as { Plan: Record<string, unknown> }[])[0].Plan);
    const used = nodes.map((n) => n['Index Name']).filter(Boolean);
    assert.ok(used.includes('login_links_attempt'), JSON.stringify(used));
    assert.ok(used.includes('login_links_email'), JSON.stringify(used));
    assert.ok(!nodes.some((n) => n['Node Type'] === 'Seq Scan' && n['Relation Name'] === 'login_links'));
  });
});

dbTest('deleteProfile: every shared Similar-trades pool naming the trader goes (a cache of ids with derived numbers); pools that do not name them stay (tester QA Q2)', async () => {
  const { sql } = await import('./db.ts');
  const { deleteProfile } = await import('./delete.ts');
  const { encodePool } = await import('./similar.ts');
  const tag = `dsp${Math.random().toString(36).slice(2, 8)}`;
  const { createAttempt, signInWithIdentity } = await import('./auth/attempts.ts');
  const attempt = await createAttempt({ method: 'email', attested: true });
  const u = await signInWithIdentity(attempt, { provider: 'email', subject: `${tag}@example.com`, email: `${tag}@example.com` });
  const id = u.id as number;
  // Other ids that share the trader's digits (id·10, id+1·…) must not match: the pattern ends at a JSON delimiter.
  const facts = { verified: true, n: 5 } as unknown as Record<string, unknown>;
  const pool = (ids: number[]) => encodePool(ids.map((t) => ({ ...facts, trader: t, score: 1 })) as never);
  const keys = { named: `${tag}-named`, last: `${tag}-last`, other: `${tag}-other` };
  try {
    await sql`insert into similar_pools (key, hour, built_at, pool) values
      (${keys.named}, now(), now(), ${pool([id, id * 10 + 7])}),
      (${keys.last}, now(), now(), ${pool([id + 1, id])}),
      (${keys.other}, now(), now(), ${pool([id * 10, Number(`${id}1`)])})`;
    await deleteProfile({ id, handle: u.handle as string, snaptrade_user_id: null, snaptrade_secret_enc: null }, { deleteVendorUser: async () => {} });
    const left = (await sql`select key from similar_pools where key like ${tag + '-%'} order by key`).map((r) => r.key);
    assert.deepEqual(left, [keys.other]);
  } finally {
    await sql`delete from similar_pools where key like ${tag + '-%'}`;
    await sql`delete from users where id = ${id}`;
    await sql`delete from handle_reservations where handle = ${u.handle as string}`;
  }
});
