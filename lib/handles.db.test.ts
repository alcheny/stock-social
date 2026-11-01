import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hskel, HSKEL_SQL } from './handles.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

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
    assert.equal(await checkHandle(resv[0]), 'taken');
    assert.equal(await checkHandle(`${tag}_g0ne`), 'lookalike');
    assert.equal(await checkHandle(resv[0], u.id), 'taken', 'a bare reservation binds everyone');
    assert.equal(await checkHandle(resv[1]), 'taken');
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
    await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
    const rows = await sql`select display_name from users where id in ${sql(ids)} order by id`;
    assert.deepEqual(rows.map((r) => r.display_name), ['Maya \u{1F468}‍\u{1F469}', `${tag}_b`]);
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});
