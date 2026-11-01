// Privacy work (2026-11-01, committee D14): the append-only display log (lib/display-log.ts, db/schema.sql display_log).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { snapshotText } from './display-log.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const DAY = 86_400_000;

async function person(tag: string) {
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  return (await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${Math.random().toString(36).slice(2, 7)}` })).id;
}

test('the snapshot is the profile\'s own text, percent only: headline, range, count, open positions, evidence; losses read like gains', () => {
  const today = new Date('2026-11-01T12:00:00Z');
  const closes = [0.1, -0.05, 0.02].map((r, i) => ({ symbol: `S${i}`, openedAt: new Date(today.getTime() - (40 + i) * DAY), closedAt: new Date(today.getTime() - (10 + i) * DAY), returnPct: r, holdingDays: 30 }));
  const s = snapshotText(closes, [{ accountId: 'b', symbol: 'ZZ', pct: -0.031 }, { accountId: 'a', symbol: 'ZZ', pct: 0.02 }, { accountId: 'a', symbol: 'AA', pct: 0 }], today);
  assert.equal(s.headline, '67% win rate · +2.3% avg return / trade');
  assert.equal(s.tradeCount, 3);
  assert.equal(s.openSummary, '3 open positions: AA 0.0%, ZZ (account 1) +2.0%, ZZ (account 2) -3.1%');
  assert.ok(s.evidence.length > 10);
  for (const t of Object.values(s)) if (typeof t === 'string') assert.doesNotMatch(t, /\$|USD|shares|units|qty/i, t);
  const empty = snapshotText([], [], today);
  assert.deepEqual([empty.headline, empty.rangeText, empty.tradeCount, empty.openSummary], ['No closed trades yet', null, 0, 'No open positions']);
});

dbTest('one row per public record per day; a second tick that day writes nothing; an empty record writes none; the reader returns the latest on or before a date', async () => {
  const { sql } = await import('./db.ts');
  const { writeDisplayLog, displayedOn } = await import('./display-log.ts');
  const u = await person('dl');
  const empty = await person('dle');
  const now = new Date();
  try {
    await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw) values
      (${u}, 'demo', ${`dl-${u}-b`}, 'acct', 'DLX', 'BUY', 1, 10, ${new Date(now.getTime() - 3 * DAY)}, '{}')`;
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u}, ${`dl-${u}-s`}, 'acct', 'DLX', ${new Date(now.getTime() - 3 * DAY)}, ${new Date(now.getTime() - DAY)}, -0.04, 2, false)`;
    const first = await writeDisplayLog({ now, ids: [u, empty] });
    assert.deepEqual(first, { written: 1, done: true });
    assert.deepEqual(await writeDisplayLog({ now, ids: [u, empty] }), { written: 0, done: true });
    const today = now.toISOString().slice(0, 10);
    const row = await displayedOn(u, today);
    assert.ok(row);
    assert.equal(row.day, today);
    assert.equal(row.gap, false);
    assert.match(row.asOf, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.ok(Math.abs(Date.parse(row.asOf) - Date.now()) < 120_000, 'asOf is when the row was written');
    assert.equal(row.demo, true, 'demo records are logged and marked demo');
    assert.equal(row.headline, '0% win rate · -4.0% avg return / trade');
    assert.equal(row.tradeCount, 1);
    assert.equal(await displayedOn(u, '2000-01-01'), null);
    const later = await displayedOn(u, '2999-01-01');
    assert.deepEqual([later?.asked, later?.day, later?.gap], ['2999-01-01', today, true], 'a day with no row says so');
    assert.equal(await displayedOn(empty, today), null);
    // An older day's row is never touched by a later day's write.
    const tomorrow = new Date(now.getTime() + DAY);
    assert.deepEqual(await writeDisplayLog({ now: tomorrow, ids: [u] }), { written: 1, done: true });
    assert.equal((await displayedOn(u, today))?.day, today);
  } finally {
    await sql`delete from users where id in (${u}, ${empty})`;
  }
});

dbTest('append-only: an update and a direct delete are refused by the database; deleting the account removes its rows', async () => {
  const { sql } = await import('./db.ts');
  const { deleteProfile } = await import('./delete.ts');
  const u = await person('dla');
  await sql`insert into display_log (user_id, day, demo, headline, range_text, trade_count, open_summary, evidence)
    values (${u}, '2026-10-01', false, 'h', null, 0, 'No open positions', 'e')`;
  await assert.rejects(sql`update display_log set headline = 'changed' where user_id = ${u}`, /append-only/);
  await assert.rejects(sql`delete from display_log where user_id = ${u}`, /append-only/);
  assert.equal((await sql`select headline from display_log where user_id = ${u}`)[0].headline, 'h');
  const [row] = await sql`select id, handle, snaptrade_user_id, snaptrade_secret_enc from users where id = ${u}`;
  await deleteProfile(row as never, { deleteVendorUser: async () => {} });
  assert.equal((await sql`select count(*)::int as n from display_log where user_id = ${u}`)[0].n, 0);
});

dbTest('a deleted (being deleted) account is not logged', async () => {
  const { sql } = await import('./db.ts');
  const { writeDisplayLog } = await import('./display-log.ts');
  const u = await person('dld');
  try {
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u}, ${`dld-${u}`}, 'acct', 'DLX', now() - interval '3 days', now() - interval '1 day', 0.04, 2, true)`;
    await sql`update users set deleted_at = now() where id = ${u}`;
    assert.equal((await writeDisplayLog({ ids: [u] })).written, 0);
  } finally {
    await sql`delete from users where id = ${u}`;
  }
});

dbTest('records with nothing to show never starve later ones: with room for one snapshot per call, the record after many empty ones is written on the first call', async () => {
  const { sql } = await import('./db.ts');
  const { writeDisplayLog } = await import('./display-log.ts');
  const empties = [await person('dls'), await person('dls'), await person('dls'), await person('dls')];
  const real = await person('dlr');
  try {
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${real}, ${`dlr-${real}`}, 'acct', 'DLX', now() - interval '3 days', now() - interval '1 day', 0.04, 2, true)`;
    let t = 0;
    const r = await writeDisplayLog({ ids: [...empties, real], batch: 1, boxMs: 2, clock: () => t++ });
    assert.equal(r.written, 1);
    assert.equal((await sql`select count(*)::int as n from display_log where user_id = ${real}`)[0].n, 1);
  } finally {
    for (const id of [...empties, real]) await sql`delete from users where id = ${id}`;
  }
});
