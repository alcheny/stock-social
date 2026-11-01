// F-15 · rollup rows older than the retention bound are purged by the existing cron path (lib/privacy-purge.ts on the
// sync tick, step 'views'); a row on the bound's edge stays. The step runs at a past `now`, so only rows far in the past
// (this test's own days) can be removed.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

dbTest('F-15: purgePrivacy step views removes rollup and drop rows older than VIEW_RETENTION_DAYS and keeps the edge day', async () => {
  const { sql } = await import('./db.ts');
  const { recordView, recordDrop, VIEW_RETENTION_DAYS } = await import('./views.ts');
  const { purgePrivacy } = await import('./privacy-purge.ts');
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const h = `f15p${Math.random().toString(36).slice(2, 10)}`;
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${h}, ${h}, now(), ${a.id}) returning id`;
  const NOW = new Date(Date.UTC(1990, 5, 15, 12));
  const day = (back: number) => new Date(NOW.getTime() - back * 86_400_000);
  for (const back of [VIEW_RETENTION_DAYS + 30, VIEW_RETENTION_DAYS + 1, VIEW_RETENTION_DAYS, 3]) {
    await recordView({ surface: 'profile', userId: u.id, ref: 'external', via: 'none', signedIn: false, selfView: false, day: day(back) });
    await recordDrop('ticker', 'declared_bot', day(back));
  }
  const r = await purgePrivacy({ now: NOW, only: ['views'], batch: 1 });
  assert.equal(r.done, true);
  assert.ok(r.views >= 4, `purged ${r.views}`);
  const left = await sql`select (${NOW}::date - day) back from view_rollup where user_id = ${u.id} order by back`;
  assert.deepEqual(left.map((x) => x.back), [3, VIEW_RETENTION_DAYS]);
  const drops = await sql`select (${NOW}::date - day) back from view_drops where day between ${day(400)}::date and ${NOW}::date order by back`;
  assert.deepEqual(drops.map((x) => x.back), [3, VIEW_RETENTION_DAYS]);
  await sql`delete from users where id = ${u.id}`;
});

test('F-15: the views step is on the existing cron path (the sync tick calls purgePrivacy) and the bound is stated', async () => {
  const route = readFileSync(new URL('../app/api/sync/route.ts', import.meta.url), 'utf8');
  assert.match(route, /purgePrivacy\(/);
  const purge = readFileSync(new URL('./privacy-purge.ts', import.meta.url), 'utf8');
  assert.match(purge, /delete from view_rollup/);
  assert.match(purge, /delete from view_drops/);
  const { VIEW_RETENTION_DAYS } = await import('./views.ts');
  assert.equal(VIEW_RETENTION_DAYS, 120);
  const { SCHEMA_MAP } = await import('./privacy-retention.ts');
  assert.match(SCHEMA_MAP.view_rollup.holds, /120 days/);
  assert.match(SCHEMA_MAP.view_drops.holds, /120 days/);
});
