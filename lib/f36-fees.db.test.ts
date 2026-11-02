// F-36 (plan Round 2 changes, R2-7; AC3, AC6): the version-3 deploy rebuild recalculates fee-bearing returns, keeps its
// return shape, and reports counts only, including how many returns changed sign (expected 0); a zero-fee record
// rebuilds byte-identical. Fictional rows; only rows this file creates are read or deleted.
import { after, before, mock, test } from 'node:test';
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
  const tag = `f36${Math.random().toString(36).slice(2, 10)}`;
  const made: number[] = [];
  const mkUser = async (n: string) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` });
    made.push(u.id);
    return u.id;
  };
  const row = (id: string, side: 'BUY' | 'SELL', units: number, price: number, fee: number, at: string) => ({
    externalId: `${tag}-${id}`, accountId: `${tag}-acc`, symbol: 'FAKE', side, units, price, fee, executedAt: new Date(at), verified: true, raw: {},
  });
  const closes = async (id: number) => (await sql`select sell_id, return_pct from closed_trades where user_id = ${id} order by closed_at`)
    .map((r) => [(r.sell_id as string).slice(tag.length + 1), +(r.return_pct as number).toFixed(6)]);
  const cleanup = async () => { if (made.length) await sql`delete from users where id in ${sql(made)}`; };
  return { sql, tag, mkUser, row, closes, insertActivities, cleanup };
}

// Runs the deploy rebuild for these records under a fresh version and returns its result and its counts-only lines.
async function rebuildLogged(ids: number[]) {
  const { rebuildAllForMatcher } = await import('./matcher-rebuild.ts');
  const version = 9000 + Math.floor(Math.random() * 900);
  const log = mock.method(console, 'log', () => {});
  const err = mock.method(console, 'error', () => {});
  try {
    const out = await rebuildAllForMatcher(version, ids);
    const line = log.mock.calls.map((c) => c.arguments).find((a) => a[0] === 'matcher rebuild');
    const errors = err.mock.calls.map((c) => c.arguments);
    return { out, version, report: line ? JSON.parse(line[1] as string) : null, errors };
  } finally {
    log.mock.restore();
    err.mock.restore();
  }
}

dbTest('F-36 AC6: the deploy rebuild recalculates fee-bearing returns, no return changes sign, and the report is counts only', async () => {
  const { sql, tag, mkUser, row, closes, insertActivities, cleanup } = await setup();
  const { rebuildRecord } = await import('./options-sync.ts');
  try {
    const u = await mkUser('a');
    await insertActivities(u, 'snaptrade', [
      row('b1', 'BUY', 2, 5, 10, '2026-10-01T14:00:00Z'), row('s1', 'SELL', 2, 15, 0, '2026-10-05T14:00:00Z'), // the probe: +50%
      row('b2', 'BUY', 10, 20, 4, '2026-10-06T14:00:00Z'), row('s2', 'SELL', 10, 18, 2, '2026-10-08T14:00:00Z'), // a loss
      row('b3', 'BUY', 5, 10, 0, '2026-10-09T14:00:00Z'), row('s3', 'SELL', 5, 12, 0, '2026-10-12T14:00:00Z'), // no fee
    ]);
    await rebuildRecord(u);
    // The stored state a deploy finds: the old matcher's figures, divided by the purchase cost alone (the test's own
    // fixture rows; production never patches closed_trades).
    const legacy: Record<string, number> = { s1: (30 - 10 - 10) / 10, s2: (180 - 200 - 4 - 2) / 200, s3: (60 - 50) / 50 };
    for (const [id, r] of Object.entries(legacy)) await sql`update closed_trades set return_pct = ${r} where user_id = ${u} and sell_id = ${`${tag}-${id}`}`;
    const { out, version, report, errors } = await rebuildLogged([u]);
    assert.deepEqual(out, { rebuilt: 1, failed: 0, left: 0 }); // the return shape is unchanged
    assert.deepEqual(await closes(u), [['s1', 0.5], ['s2', -0.127451], ['s3', 0.2]]);
    assert.deepEqual(report, { version, rebuilt: 1, failed: 0, left: 0, returnsChanged: 2, signChanged: 0 });
    assert.deepEqual(errors, []);
  } finally {
    await cleanup();
  }
});

dbTest('F-36 AC6: a return that changes sign in the rebuild is counted and logged (counts only, never ids or figures)', async () => {
  const { sql, tag, mkUser, row, insertActivities, cleanup } = await setup();
  const { rebuildRecord } = await import('./options-sync.ts');
  try {
    const u = await mkUser('b');
    await insertActivities(u, 'snaptrade', [row('b', 'BUY', 1, 10, 1, '2026-10-01T14:00:00Z'), row('s', 'SELL', 1, 12, 0, '2026-10-05T14:00:00Z')]);
    await rebuildRecord(u);
    await sql`update closed_trades set return_pct = -0.1 where user_id = ${u} and sell_id = ${`${tag}-s`}`; // fixture: a stored loss
    const { out, report, errors } = await rebuildLogged([u]);
    assert.deepEqual(out, { rebuilt: 1, failed: 0, left: 0 });
    assert.equal(report.signChanged, 1);
    assert.equal(report.returnsChanged, 1);
    assert.deepEqual(errors, [['matcher rebuild: a return changed sign', JSON.stringify({ count: 1 })]]);
    assert.doesNotMatch(JSON.stringify([report, errors]), new RegExp(tag));
  } finally {
    await cleanup();
  }
});

dbTest('F-36 AC3: a zero-fee record rebuilds byte-identical under the new version', async () => {
  const { mkUser, row, insertActivities, cleanup } = await setup();
  const { rebuildRecord, snapshotCloses } = await import('./options-sync.ts');
  const { sql } = await import('./db.ts');
  try {
    const u = await mkUser('c');
    await insertActivities(u, 'snaptrade', [row('b1', 'BUY', 10, 100, 0, '2026-10-01T14:00:00Z'), row('b2', 'BUY', 10, 120, 0, '2026-10-03T14:00:00Z'),
      row('s1', 'SELL', 15, 130, 0, '2026-10-10T14:00:00Z'), row('s2', 'SELL', 5, 90, 0, '2026-10-12T14:00:00Z')]);
    await rebuildRecord(u);
    const snap = async () => { const s = await sql.begin((tx) => snapshotCloses(tx, u)); return s.ids.map((id, i) => `${id} ${s.hashes[i]}`).sort(); };
    const before = await snap();
    assert.equal(before.length, 2);
    const { out, report } = await rebuildLogged([u]);
    assert.deepEqual(out, { rebuilt: 1, failed: 0, left: 0 });
    assert.deepEqual(await snap(), before);
    assert.equal(report.returnsChanged, 0);
    assert.equal(report.signChanged, 0);
  } finally {
    await cleanup();
  }
});
