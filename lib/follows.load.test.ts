// F-2 PR-2 heavy use (plan §4): a trader followed and hidden by 100,000 viewers is deleted in < 5 s with zero rows
// left; 100,000 ended exclusions are purged within one ≤ 30 s call. Skipped unless LOAD=1, so `npm test` stays fast.
// How to run (DATABASE_URL set): LOAD=1 node --test lib/follows.load.test.ts
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LOAD = process.env.LOAD === '1';
const hasDb = !!process.env.DATABASE_URL;
const VIEWERS = 100_000;
before(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (LOAD && hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

test(`heavy: a trader followed and hidden by ${VIEWERS.toLocaleString('en-US')} viewers is deleted in < 5 s, zero rows left; ${VIEWERS.toLocaleString('en-US')} ended exclusions purge in one call ≤ 30 s`,
  { skip: !LOAD ? 'heavy-use suite: set LOAD=1' : !hasDb && 'no DATABASE_URL', timeout: 900_000 }, async () => {
  const { sql } = await import('./db.ts');
  const { deleteProfile } = await import('./delete.ts');
  const { purgeDiscovery } = await import('./discovery/purge.ts');
  const tag = `h${Math.random().toString(36).slice(2, 7)}`;
  const [{ id: attempt }] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const [trader, other] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${`${tag}_t`}, 'Heavy', now(), ${attempt}), (${`${tag}_o`}, 'Other', now(), ${attempt}) returning id`.then((r) => r.map((x) => x.id as number));
  await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || '_' || i, 'Viewer ' || i, now(), ${attempt} from generate_series(1, ${VIEWERS}) i`;
  const viewers = sql`select id from users where handle like ${`${tag}\\_%`} and id not in (${trader}, ${other})`;
  await sql`insert into follows (viewer_id, trader_id) select id, ${trader} from (${viewers}) v where id % 2 = 0`;
  await sql`insert into viewer_exclusions (viewer_id, trader_id, until, reason) select id, ${trader}, now() + interval '90 days', 'not_interested' from (${viewers}) v where id % 2 = 1`;
  await sql`insert into viewer_exclusions (viewer_id, trader_id, created_at, until, reason) select id, ${other}, now() - interval '40 days', now() - interval '2 days', 'unfollow' from (${viewers}) v`;
  await sql`analyze follows`; await sql`analyze viewer_exclusions`;
  const refs = () => sql`select (select count(*) from follows where trader_id = ${trader})::int + (select count(*) from viewer_exclusions where trader_id = ${trader})::int as n`.then((r) => r[0].n as number);
  try {
    assert.equal(await refs(), VIEWERS);
    const t0 = performance.now();
    await deleteProfile({ id: trader, handle: `${tag}_t`, snaptrade_user_id: null, snaptrade_secret_enc: null }, { deleteVendorUser: async () => {} });
    const ms = performance.now() - t0;
    console.log(`delete a trader referenced by ${VIEWERS} viewers: ${ms.toFixed(0)} ms`);
    assert.ok(ms < 5_000, `${ms} ms`);
    assert.equal(await refs(), 0);
    const p0 = performance.now();
    const r = await purgeDiscovery();
    const pms = performance.now() - p0;
    console.log(`purge ${r.deleted} ended exclusions: ${pms.toFixed(0)} ms (done: ${r.done})`);
    assert.ok(r.ran && r.done && r.deleted >= VIEWERS && pms <= 30_000);
    assert.equal((await sql`select count(*)::int as n from viewer_exclusions where trader_id = ${other}`)[0].n, 0);
  } finally {
    await sql`delete from follows where viewer_id in (${viewers})`;
    await sql`delete from viewer_exclusions where viewer_id in (${viewers})`;
    const c0 = performance.now();
    await sql`delete from users where handle like ${`${tag}\\_%`}`;
    console.log(`cleanup of ${VIEWERS} users: ${(performance.now() - c0).toFixed(0)} ms`);
    await sql`delete from handle_reservations where handle = ${`${tag}_t`}`;
    await sql`delete from signup_attempts where id = ${attempt}`;
  }
});
