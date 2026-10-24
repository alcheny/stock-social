// F-2 PR-3b: "Similar trades" on a profile, against the database: other traders' trades in the profile's holding bucket,
// the same for every viewer signed out, a signed-in viewer's hidden traders (and own record) left out, an unfollow never
// a hide, losses like gains, Demo after verified, fewer than 5 closes or 3 rows → no section.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const DAY = 86_400_000;
const HOLDS = [0.5, 3, 14, 60, 300];

async function fixture(n: number, ret: (t: number, i: number) => number = (t, i) => ((t * 7 + i) % 9 - 4) / 100 || 0.01) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `m${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let t = 0; t <= n; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const at = Date.now() - 2 * DAY, traders = ids.slice(1);
  await sql`insert into closed_trades ${sql(traders.flatMap((u, t) => Array.from({ length: 8 }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `M${(t + i) % 13}`, opened_at: new Date(at - (t * 8 + i) * 60_000 - HOLDS[t % 5] * DAY),
    closed_at: new Date(at - (t * 8 + i) * 60_000), return_pct: ret(t, i), holding_days: HOLDS[t % 5] + (i % 2) * 0.1, verified: true,
  }))))}`;
  return { sql, viewer: ids[0], traders, remove: () => sql`delete from users where id in ${sql(ids)}` };
}

dbTest('rows are other traders\' trades in the profile\'s holding bucket, one per trader, in TR-9 order; the same for every signed-out request', async () => {
  const { loadSimilar, clearSimilarCache } = await import('./similar.ts');
  const { feedList } = await import('./feed.ts');
  const { holdBucket } = await import('./discovery/section.ts');
  const f = await fixture(30);
  try {
    clearSimilarCache();
    const self = f.traders[1]; // bucket 1 (3 days)
    const s = await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders });
    assert.equal(s!.rows.length, 3);
    assert.ok(s!.rows.every((r) => r.trader !== self && holdBucket(r.holdingDays) === 1 && r.bucket === 1));
    assert.equal(new Set(s!.rows.map((r) => r.trader)).size, 3);
    const hour = Math.floor(Date.now() / 3_600_000) * 3_600_000;
    const pool = (await feedList({ asOf: new Date(hour), day: new Date(hour).toISOString().slice(0, 10), ids: f.traders })).pool.filter((t) => holdBucket(t.hold) === 1 && t.trader !== self);
    assert.deepEqual(s!.rows.map((r) => r.trader), pool.slice(0, 3).map((t) => t.trader));
    // Each row is that trader's most recent close in the bucket; its pane carries the whole record.
    for (const r of s!.rows) {
      const [x] = await f.sql`select sell_id from closed_trades where user_id = ${r.trader} order by closed_at desc, sell_id desc limit 1`;
      assert.equal(r.sellId, x.sell_id);
      assert.equal(s!.byUser.get(r.trader)!.length, 8);
    }
    assert.deepEqual(await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders }), s);
    assert.equal(await loadSimilar({ trader: self, hold: 3, closes: 4, ids: f.traders }), null); // fewer than 5 closes
  } finally {
    await f.remove();
  }
});

dbTest('signed in: the viewer\'s own record and hidden traders leave the rows; an unfollow does not; fewer than 3 left → no section', async () => {
  const { loadSimilar, clearSimilarCache } = await import('./similar.ts');
  const { exclude, follow, unfollow } = await import('./follows.ts');
  const f = await fixture(30);
  try {
    clearSimilarCache();
    const self = f.traders[1];
    const out = (await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders }))!.rows.map((r) => r.trader);
    await exclude(f.viewer, out[0], 'not_interested');
    await follow(f.viewer, out[1]); await unfollow(f.viewer, out[1]);
    const mine = (await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders, viewer: f.viewer }))!.rows.map((r) => r.trader);
    assert.ok(!mine.includes(out[0]));
    assert.ok(mine.includes(out[1]), 'an unfollow is never a hide (O4)');
    // The viewer's own record is never a row of theirs.
    const asTrader = await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders, viewer: mine[0] });
    assert.ok(!asTrader!.rows.some((r) => r.trader === mine[0]));
    // Everyone else in the bucket hidden → no section.
    for (const id of f.traders) if (id !== self) await exclude(f.viewer, id, 'not_interested');
    assert.equal(await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders, viewer: f.viewer }), null);
    // Signed out the rows are unchanged.
    assert.deepEqual((await loadSimilar({ trader: self, hold: 3, closes: 8, ids: f.traders }))!.rows.map((r) => r.trader), out);
  } finally {
    await f.remove();
  }
});

dbTest('losses are rows under the same rules (an all-loss fixture fills the section); a Demo record reads after verified ones', async () => {
  const { loadSimilar, clearSimilarCache } = await import('./similar.ts');
  const f = await fixture(30, (t, i) => -(0.02 + ((t + i) % 5) / 100));
  try {
    clearSimilarCache();
    const s = await loadSimilar({ trader: f.traders[1], hold: 3, closes: 8, ids: f.traders });
    assert.equal(s!.rows.length, 3);
    assert.ok(s!.rows.every((r) => s!.byUser.get(r.trader)!.every((p) => p.returnPct < 0)));
    // Mark the first row's record unverified: it moves after the verified ones.
    await f.sql`update closed_trades set verified = false where user_id = ${s!.rows[0].trader}`;
    clearSimilarCache(); (await import('./feed.ts')).clearFeedCache(); // a cold server
    const d = await loadSimilar({ trader: f.traders[1], hold: 3, closes: 8, ids: f.traders });
    assert.ok(!d!.rows.slice(0, 2).some((r) => r.trader === s!.rows[0].trader));
  } finally {
    await f.remove();
  }
});
