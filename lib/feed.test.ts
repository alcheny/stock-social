// F-1 PR-3 fix round 4 (business lead blocker): the feed's recency term is defined for a close of any age.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_DECAY, RECENCY_HOURS } from './feed.ts';
import { rankTraders } from './trades.ts';

test('the clamp sits below the underflow: e^-MAX_DECAY times the smallest size term is still a normal double', () => {
  // Unclamped, exp(-age/48) is 0 (underflow) from about 4.08 years: that age is past the clamp, which starts at 3.3 years.
  assert.equal(Math.exp(-746), 0);
  assert.ok(MAX_DECAY * RECENCY_HOURS < 746 * 48);
  const floor = Math.exp(-MAX_DECAY) * Math.log1p(2.2e-16);
  assert.ok(floor >= 2.2250738585072014e-308, 'normal, not subnormal or zero');
});

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

dbTest('a close dated 2015 does not break the ranking and ranks last; recent closes keep their order', async () => {
  const { sql } = await import('./db.ts');
  const { feedCandidates } = await import('./feed.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `f${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const v = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}v` });
  const close = (user: number, i: number, closedAt: string, r: number) => ({
    user_id: user, sell_id: `${tag}-${user}-${i}`, account_id: 'a', symbol: 'AAA', opened_at: new Date(new Date(closedAt).getTime() - 86_400_000),
    closed_at: new Date(closedAt), return_pct: r, holding_days: 1, verified: true,
  });
  const h = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
  try {
    await sql`insert into closed_trades ${sql([
      close(u.id, 1, h(1), 0.02), close(u.id, 2, h(10), -0.05), close(u.id, 3, h(30), 0.01), close(u.id, 4, h(100), 0.2),
      close(u.id, 5, h(24 * 365 * 3), 0.9), // 3 years: under the clamp
      close(u.id, 6, '2015-03-02T15:00:00Z', 0.5), // 11 years: past the underflow age (fails before the clamp)
      close(v.id, 1, '2014-01-02T15:00:00Z', 3), close(v.id, 2, '2013-01-02T15:00:00Z', 0.01), close(v.id, 3, '2012-01-02T15:00:00Z', 0.02),
      close(v.id, 4, '2011-01-02T15:00:00Z', 0.03), close(v.id, 5, '2010-01-02T15:00:00Z', -0.04),
    ])}`;
    const rows = await feedCandidates({ ids: [u.id] });
    assert.equal(rows.length, 6);
    // Recent closes in the unclamped order (size × exp(-age/48)), the 2015 close last.
    const expect = [[1, 0.02], [10, -0.05], [30, 0.01], [100, 0.2]].map(([hrs, r]) => Math.log1p(Math.abs(r) * 100) * Math.exp(-hrs / 48));
    const order = rows.map((r) => Number(r.score));
    for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] >= order[i], 'descending');
    assert.equal(new Date(rows[rows.length - 1].closed_at).getUTCFullYear(), 2015);
    const top4 = rows.slice(0, 4).map((r) => Number(r.score));
    assert.deepEqual(top4.map((x) => x.toPrecision(6)), [...expect].sort((a, b) => b - a).map((x) => x.toPrecision(6)));
    // Through the trader ranking (one trader, one weight) the 2015 close stays last.
    const ranked = rankTraders(rows.map((t) => ({ t, score: Number(t.score), weight: 0.5 })));
    assert.equal(new Date(ranked[ranked.length - 1].t.closed_at).getUTCFullYear(), 2015);
    // A record made only of old closes ranks among itself by size of move (all share the decay floor), with no error.
    const old = await feedCandidates({ ids: [v.id] });
    assert.deepEqual(old.map((r) => Number(r.return_pct)), [3, -0.04, 0.03, 0.02, 0.01]);
  } finally {
    await sql`delete from users where id in ${sql([u.id, v.id])}`;
  }
});
