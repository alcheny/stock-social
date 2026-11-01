// F-15 second half · the readout's G2 floor (orchestrator review A): the readout counts share_action rows from
// g2FloorOffset(SHARE_RETENTION_DAYS) days before the window's last day, so a purge run up to 7 days after the window
// (the latest a run can see that window) never removes a counted row: same window, same G2 before and after the purge.
// Shared database: this test makes its own users and rows, uses a far-past window and reads only its own users.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('../lib/db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('../lib/db.ts')).sql.end({ timeout: 1 }); });

dbTest('F-15 G2: the same window prints the same G2 before and after purgePrivacy step shares', async () => {
  const { sql } = await import('../lib/db.ts');
  const { SHARE_RETENTION_DAYS } = await import('../lib/share-actions.ts');
  const { purgePrivacy } = await import('../lib/privacy-purge.ts');
  const { buildReadout, g2FloorOffset, loadG2, weekWindow } = await import('./f15-readout.ts');
  const now = new Date(Date.UTC(1992, 5, 17, 12)); // a Wednesday; the window ends Sunday 1992-06-14
  const { to } = weekWindow(now);
  assert.equal(to, '1992-06-14');
  const floor = g2FloorOffset(SHARE_RETENTION_DAYS);
  const day = (back: number) => new Date(Date.parse(`${to}T00:00:00Z`) - back * 86_400_000);
  const ids: number[] = [];
  const user = async () => {
    const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
    const h = `f15r${Math.random().toString(36).slice(2, 10)}`;
    const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${h}, ${h}, now(), ${a.id}) returning id`;
    await sql`insert into connections (attempt_id, user_id, state, connected_at) values (${a.id}, ${u.id}, 'connected', now())`;
    ids.push(u.id);
    return u.id as number;
  };
  const share = (id: number, back: number, surface = 'card', outcome = 'sheet', sign = 'up') =>
    sql`insert into share_action (user_id, day, surface, outcome, record_sign) values (${id}, ${day(back)}::date, ${surface}, ${outcome}, ${sign})`;
  try {
    // 7 card sharers (no cell under 5, so every G2 figure prints): one only on the floor's edge day, the rest inside.
    await share(await user(), floor);
    for (let i = 0; i < 6; i++) await share(await user(), 10 + i);
    // 5 traders whose only rows are older than the floor (inside the 120-day bound at the window's end, purged 7 days
    // later) or after the window: counted by neither run.
    for (let i = 0; i < 4; i++) { const id = await user(); await share(id, floor + 1); await share(id, SHARE_RETENTION_DAYS - 2); }
    await share(await user(), -3);
    const g2Of = async () => {
      const g2 = await loadG2(sql, to, SHARE_RETENTION_DAYS, ids);
      const md = buildReadout({ rollup: [], drops: [], g1: { strict: g2.traders.length, partial: 0 }, g2 }, now);
      return md.slice(md.indexOf('## G2'), md.indexOf('## G3'));
    };
    const beforePurge = await g2Of();
    assert.match(beforePurge, /\| Of those, share their card at least once \| ≥ 60% \| 7 of 12 \(58%\) \|/);
    const old = async () => (await sql`select count(*)::int n from share_action where user_id = any(${ids}::int[]) and day < ${day(floor)}::date`)[0].n;
    assert.equal(await old(), 8);
    const r = await purgePrivacy({ now: new Date(Date.parse(`${to}T23:30:00Z`) + 7 * 86_400_000), only: ['shares'] });
    assert.equal(r.done, true);
    assert.equal(await old(), 0, 'the purge removed the rows past the bound');
    const kept = await sql`select count(*)::int n from share_action where user_id = any(${ids}::int[]) and day = ${day(floor)}::date`;
    assert.equal(kept[0].n, 1, 'the floor edge day survives the purge');
    assert.equal(await g2Of(), beforePurge);
  } finally {
    await sql`delete from users where id = any(${ids}::int[])`;
  }
});
