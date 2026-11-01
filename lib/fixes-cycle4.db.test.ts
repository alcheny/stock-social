// Fixes cycle 4 (C4-1, C4-2; reliability conditions 5 and 6): a deploy rebuilds every record once per matcher version,
// and a thesis on a close that becomes counted is kept aside and comes back when the close is published again.
// Fictional rows; only rows this file creates are read or deleted.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { insertActivities } = await import('./sync.ts');
  const tag = `c4${Math.random().toString(36).slice(2, 10)}`;
  const made: number[] = [];
  const mkUser = async (n: string) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` });
    made.push(u.id);
    return u.id;
  };
  const row = (id: string, side: 'BUY' | 'SELL', units: number, price: number, at: string) => ({
    externalId: `${tag}-${id}`, accountId: `${tag}-acc`, symbol: 'FAKE', side, units, price, fee: 0, executedAt: new Date(at), verified: true, raw: {},
  });
  const closes = async (id: number) => (await sql`select sell_id, return_pct, thesis from closed_trades where user_id = ${id} order by closed_at`)
    .map((r) => [(r.sell_id as string).slice(tag.length + 1), +(r.return_pct as number).toFixed(6), r.thesis as string | null]);
  const cleanup = async () => { if (made.length) await sql`delete from users where id in ${sql(made)}`; };
  return { sql, tag, mkUser, row, closes, insertActivities, cleanup };
}

dbTest('C4-1/C4-2 deploy rebuild: a record built by the old matcher loses its made-up close; its thesis is kept and returns with the close', async () => {
  const { sql, tag, mkUser, row, closes, insertActivities, cleanup } = await setup();
  const { rebuildAllForMatcher } = await import('./matcher-rebuild.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  try {
    const u = await mkUser('a');
    // The record's C4-2 probe: a short (nothing held), its cover, then a long round trip.
    await insertActivities(u, 'snaptrade', [row('s0', 'SELL', 100, 15, '2026-10-01T14:00:00Z'), row('b0', 'BUY', 100, 14, '2026-10-02T14:00:00Z'),
      row('b1', 'BUY', 100, 20, '2026-10-05T14:00:00Z'), row('s1', 'SELL', 100, 18, '2026-10-14T14:00:00Z')]);
    // The old matcher published the last sell as +28.6% from the cover; a trader wrote a thesis on it. Simulated here as
    // the stored state a deploy finds (the test's own fixture rows; production never patches closed_trades).
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status)
      values (${u}, ${`${tag}-s1`}, ${`${tag}-acc`}, 'FAKE', '2026-10-02T14:00:00Z', '2026-10-14T14:00:00Z', ${18 / 14 - 1}, 12, true, 'Fictional note.', 'published')`;
    assert.equal(await rebuildAllForMatcher(9001, [u]), 1);
    assert.deepEqual(await closes(u), []);
    const [usr] = await sql`select excluded_positions from users where id = ${u}`;
    assert.equal(usr.excluded_positions, 2);
    const [kept] = await sql`select thesis, thesis_status from kept_theses where user_id = ${u} and sell_id = ${`${tag}-s1`}`;
    assert.deepEqual([kept.thesis, kept.thesis_status], ['Fictional note.', 'published']);
    // The vendor later corrects the first row's date to after the round trip (test fixture edit): there is no oversell
    // any more, so FIFO prices the close from the first buy and it is published again with its thesis.
    await sql`update activities set executed_at = '2026-10-20T14:00:00Z' where user_id = ${u} and external_id = ${`${tag}-s0`}`;
    await rebuildRecord(u);
    assert.deepEqual((await closes(u)).filter((c) => c[0] === 's1'), [['s1', 0.285714, 'Fictional note.']]);
  } finally {
    await cleanup();
  }
});

dbTest('C4-1/C4-2 deploy rebuild: runs once per matcher version, reads no connection state (frozen records too), and is safe to repeat', async () => {
  const { sql, mkUser, row, closes, insertActivities, cleanup } = await setup();
  const { rebuildAllForMatcher } = await import('./matcher-rebuild.ts');
  const version = 9000 + Math.floor(Math.random() * 900);
  try {
    const u = await mkUser('f');
    await insertActivities(u, 'snaptrade', [row('b', 'BUY', 100, 10, '2026-10-01T14:00:00Z'), row('s', 'SELL', 100, 11, '2026-10-02T14:00:00Z')]);
    // No connection at all (as a frozen record that never syncs): the rebuild selects by stored rows only.
    assert.equal(await rebuildAllForMatcher(version, [u]), 1);
    assert.deepEqual(await closes(u), [['s', 0.1, null]]);
    assert.equal(await rebuildAllForMatcher(version, [u]), 1); // explicit ids always rebuild; same result
    assert.deepEqual(await closes(u), [['s', 0.1, null]]);
    // A version already marked done is skipped on the deploy path (no ids).
    await sql`insert into matcher_runs (version) values (${version}) on conflict do nothing`;
    assert.equal(await rebuildAllForMatcher(version), null);
  } finally {
    await sql`delete from matcher_runs where version = ${version}`;
    await cleanup();
  }
});

dbTest('C4-2 (reliability condition 7): option rows on the share path with a gap are taken out once; share counts stay exact', async () => {
  const { sql, mkUser, row, closes, insertActivities, cleanup } = await setup();
  const { rebuildRecord } = await import('./options-sync.ts');
  try {
    const u = await mkUser('o');
    const occ = 'XYZ   261016C00123450'; // a fictional contract that reached the share path as its OCC string
    await insertActivities(u, 'snaptrade', [
      { ...row('os1', 'SELL', 1, 3, '2026-10-01T14:00:00Z'), symbol: occ }, // oversell: a gap in the option pair
      { ...row('ob1', 'BUY', 1, 2, '2026-10-02T14:00:00Z'), symbol: occ },
      { ...row('os2', 'SELL', 1, 4, '2026-10-03T14:00:00Z'), symbol: occ }, // counted for the gap
      row('s0', 'SELL', 10, 5, '2026-10-01T14:00:00Z'), // a share sell with no entry: counted once
      row('b1', 'BUY', 10, 10, '2026-10-02T14:00:00Z'), row('b2', 'BUY', 30, 10, '2026-10-02T14:00:00Z'),
      row('s1', 'SELL', 10, 11, '2026-10-04T14:00:00Z'), // after the share gap: counted
    ]);
    await rebuildRecord(u);
    assert.deepEqual(await closes(u), []);
    const [usr] = await sql`select excluded_positions, excluded_corporate from users where id = ${u}`;
    // Both option-pair sells leave the share counts (removeOptionPairs); the two share sells stay counted: 2 share sells.
    assert.deepEqual([usr.excluded_positions, usr.excluded_corporate], [2, 0]);
  } finally {
    await cleanup();
  }
});
