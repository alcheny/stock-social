import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hskel, HSKEL_SQL } from './handles.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

// The schema's display-name cleanup statement, limited to the ids in $1.
function usersCleanup(): string {
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const start = schema.indexOf('update users set display_name = coalesce(nullif(btrim(regexp_replace(display_name,');
  assert.ok(start > 0, 'the cleanup statement is in the schema');
  const stmt = schema.slice(start, schema.indexOf(';', start));
  assert.match(stmt, /\n {2}where display_name ~ '\[[^']+\]'$/);
  return `${stmt} and id = any($1::int[])`;
}

const rand = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 5).padEnd(5, 'q');

dbTest('the SQL handle skeleton (and its index expression) agrees with hskel', async () => {
  const { sql } = await import('./db.ts');
  const samples = ['rnomentum_maya', 'MOMENTUM_0L1', 'rrnn01', 'trader_2024', 'calm_trader', 'a0b1c_rn', 'rn', 'r0n', '1rn0', 'mrnm'];
  for (const s of samples) {
    const [r] = await sql.unsafe(`select ${HSKEL_SQL('$1')} as k`, [s]);
    assert.equal(r.k, hskel(s), s);
  }
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  assert.ok(schema.includes(`create index users_handle_skel on users ((${HSKEL_SQL('handle')}))`), 'index expression matches HSKEL_SQL');
  const [{ n }] = await sql`select count(*)::int as n from pg_indexes where indexname = 'users_handle_skel'`;
  assert.equal(n, 1);
});

dbTest('checkHandle: taken, look-alike of another handle or an active reservation, self and own reservation are ok', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { checkHandle } = await import('./handles.ts');
  const tag = `hk${rand()}`;
  const ids: number[] = [];
  const resv = [`${tag}_gone`, `${tag}_mine`];
  try {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_calm` });
    ids.push(u.id);
    assert.equal(await checkHandle(`${tag}_calm`), 'taken');
    assert.equal(await checkHandle(`${tag}_ca1m`), 'lookalike');
    assert.equal(await checkHandle(`${tag}_calm`, u.id), 'ok', 'own handle');
    assert.equal(await checkHandle(`${tag}_ca1m`, u.id), 'ok', 'own handle skeleton');
    await sql`insert into handle_reservations (handle, until) values (${resv[0]}, now() + interval '1 day')`;
    await sql`insert into handle_reservations (handle, until, user_id) values (${resv[1]}, now() + interval '1 day', ${u.id})`;
    // Fix round 1: an active reservation held by someone else (or by no one) is 'reserved', never 'taken'.
    assert.equal(await checkHandle(resv[0]), 'reserved');
    assert.equal(await checkHandle(`${tag}_g0ne`), 'lookalike');
    assert.equal(await checkHandle(resv[0], u.id), 'reserved', 'a bare reservation binds everyone');
    assert.equal(await checkHandle(resv[1]), 'reserved');
    assert.equal(await checkHandle(resv[1], u.id), 'ok', 'own reservation: reclaim');
    await sql`update handle_reservations set until = now() - interval '1 second' where handle = ${resv[0]}`;
    assert.equal(await checkHandle(resv[0]), 'ok', 'an expired reservation frees the handle');
    assert.equal(await checkHandle('Bad Handle!'), 'format');
    assert.equal(await checkHandle('admin'), 'reserved');
    const [demo] = await sql`select handle from users where id in (select user_id from activities where source = 'demo') limit 1`;
    if (demo) {
      assert.equal(await checkHandle(`${demo.handle}1`), 'lookalike');
      assert.equal(await checkHandle(`${demo.handle}_`), 'lookalike');
    }
  } finally {
    await sql`delete from handle_reservations where handle in ${sql(resv)}`;
    if (ids.length) await sql`delete from users where id in ${sql(ids)}`;
  }
});

dbTest('recheckDisplayNames: a name that now fails falls back to the handle; a dirty one is cleaned; returns a count', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { recheckDisplayNames } = await import('./handles.ts');
  const tag = `rd${rand()}`;
  const ids: number[] = [];
  try {
    for (const n of ['a', 'b', 'c']) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_${n}`, name: 'Fine Name' })).id);
    await sql`update users set display_name = 'Verified Desk' where id = ${ids[0]}`;
    await sql`update users set display_name = ${'Sam⁠ Lee'} where id = ${ids[1]}`;
    assert.equal(await recheckDisplayNames({ userIds: ids }), 2);
    const rows = await sql`select id, handle, display_name from users where id in ${sql(ids)} order by id`;
    assert.deepEqual(rows.map((r) => r.display_name), [`${tag}_a`, 'Sam Lee', 'Fine Name']);
    assert.equal(await recheckDisplayNames({ userIds: ids }), 0, 'idempotent');
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});

dbTest('schema cleanup strips direction and zero-width characters from stored display names (never the joiner)', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `sc${rand()}`;
  const ids: number[] = [];
  try {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_a` });
    ids.push(u.id);
    const v = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_b` });
    ids.push(v.id);
    await sql`update users set display_name = ${'Ma‮ya \u{1F468}‍\u{1F469}'} where id = ${u.id}`;
    await sql`update users set display_name = ${'​‎'} where id = ${v.id}`;
    // Fix round 1: only the schema's display-name cleanup statement runs, scoped to this test's own users (the shared
    // database's other rows are never touched by a test).
    await sql.unsafe(usersCleanup(), [ids]);
    const rows = await sql`select display_name from users where id in ${sql(ids)} order by id`;
    assert.deepEqual(rows.map((r) => r.display_name), ['Maya \u{1F468}‍\u{1F469}', `${tag}_b`]);
    // The extended class: Hangul filler, braille blank and tags go; the variation selector stays.
    await sql`update users set display_name = ${'Ma\u3164ya\u2800 \u2764\uFE0F\u{E0041}'} where id = ${u.id}`;
    await sql.unsafe(usersCleanup(), [ids]);
    assert.equal((await sql`select display_name from users where id = ${u.id}`)[0].display_name, 'Maya \u2764\uFE0F');
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});

// Fix round 1 (item 5): look-alike claims take turns under the skeleton's advisory lock, so two can't both succeed.
dbTest('two parallel look-alike renames: exactly one succeeds, the other is refused as a look-alike', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt, changeHandle, HandleTakenError } = await import('./auth/attempts.ts');
  const tag = `pr${rand()}`;
  const ids: number[] = [];
  try {
    for (const n of ['a', 'b']) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_${n}` })).id);
    for (let round = 0; round < 3; round++) {
      const want = [`${tag}_calm${round}`, `${tag}_ca1m${round}`];
      const out = await Promise.allSettled([changeHandle(ids[0], want[0]), changeHandle(ids[1], want[1])]);
      assert.equal(out.filter((o) => o.status === 'fulfilled').length, 1, `round ${round}`);
      const lost = out.find((o) => o.status === 'rejected') as PromiseRejectedResult;
      assert.ok(lost.reason instanceof HandleTakenError);
      assert.equal(lost.reason.verdict, 'lookalike');
    }
    // Two parallel sign-ups with look-alike chosen handles: one account, one refusal.
    const out = await Promise.allSettled([`${tag}_zed1`, `${tag}_zedl`].map(async (h) => createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: h })));
    for (const o of out) if (o.status === 'fulfilled') ids.push(o.value.id);
    assert.equal(out.filter((o) => o.status === 'fulfilled').length, 1);
  } finally {
    await sql`delete from handle_reservations where handle like ${tag + '%'}`;
    if (ids.length) await sql`delete from users where id in ${sql(ids)}`;
  }
});

dbTest('dev sign-in: a blank name falls back to the handle unchecked; a typed name that fails carries its reason code', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt, DisplayNameError } = await import('./auth/attempts.ts');
  const tag = `dn${rand()}`;
  const ids: number[] = [];
  try {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_ok`, name: '' });
    ids.push(u.id);
    assert.equal((await sql`select display_name from users where id = ${u.id}`)[0].display_name, `${tag}_ok`);
    await assert.rejects(createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_no`, name: 'Support Team' }),
      (e: unknown) => e instanceof DisplayNameError && e.code === 'role');
    assert.equal((await sql`select 1 from users where handle = ${`${tag}_no`}`).length, 0);
  } finally {
    if (ids.length) await sql`delete from users where id in ${sql(ids)}`;
  }
});

// Fix round 3 (item 12): the dev sign-in treats a profile pending deletion as no account, so its handle goes through
// the new-account checks: closed sign-up says 'closed', open sign-up gets this verdict ('taken'), never a 500.
dbTest('checkHandle: a handle whose profile is pending deletion is taken', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { checkHandle } = await import('./handles.ts');
  const tag = `pd${rand()}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_a` });
  try {
    await sql`update users set deleted_at = now() where id = ${u.id}`;
    // Fix round 4: through the login's own lookup (app/actions.ts#login uses findLiveUserByHandle), so reverting its
    // deleted_at filter fails here.
    const { findLiveUserByHandle } = await import('./handles.ts');
    assert.equal(await findLiveUserByHandle(`${tag}_a`), null);
    await sql`update users set deleted_at = null where id = ${u.id}`;
    assert.deepEqual(await findLiveUserByHandle(`${tag}_a`), { id: u.id });
    await sql`update users set deleted_at = now() where id = ${u.id}`;
    assert.equal((await sql`select id from users where handle = ${`${tag}_a`} and deleted_at is null`).length, 0);
    assert.equal(await checkHandle(`${tag}_a`), 'taken');
  } finally {
    await sql`delete from users where id = ${u.id}`;
  }
});
