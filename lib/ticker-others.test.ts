// Fixes-labels round 3 (engineer): the baseline's "other stocks" range. othersConfidence() clusters bets in SQL and
// returns one row of sums; confidenceFromSums() is the one formula, also behind confidenceFromClusters(). Both must
// equal the JS clustering (confidence(), one bet = one trader's overlapping holds in one stock) on the same rows.
// Fixtures use their own random symbols and handles and remove only their own users; the SQL and the reference read
// one snapshot, so rows other tests write meanwhile can't make them disagree.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { confidence, confidenceFromClusters, confidenceFromSums, type Cluster, type Confidence } from './trades.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
const made: number[] = [];
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (made.length) await sql`delete from users where id in ${sql(made)}`;
  await sql.end({ timeout: 1 });
});

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 2, 1);
const rand = () => Math.random().toString(36).slice(2, 7).toUpperCase().replace(/^[0-9]/, 'Q');

function close(a: Confidence, b: Confidence) {
  assert.equal(a.n, b.n); assert.equal(a.k, b.k); assert.equal(a.tier, b.tier); assert.equal(a.edge, b.edge);
  assert.ok(Math.abs(a.spanDays - b.spanDays) < 1e-9, `${a.spanDays} vs ${b.spanDays}`);
  for (const key of ['perTrade', 'pace30'] as const) {
    const x = a[key], y = b[key];
    assert.equal(x === null, y === null, key);
    if (x && y) for (const f of ['low', 'mid', 'high'] as const) assert.ok(Math.abs(x[f] - y[f]) < 1e-9, `${key}.${f}: ${x[f]} vs ${y[f]}`);
  }
}

test('confidenceFromSums is confidenceFromClusters on the same bets (one formula)', () => {
  const clusters: Cluster[] = [{ x: 0.03, d: 4, n: 1 }, { x: -0.05, d: 9, n: 2 }, { x: 0.12, d: 20, n: 3 }, { x: 0.01, d: 1, n: 1 }, { x: -0.02, d: 3, n: 1 }, { x: 0.04, d: 6, n: 2 }];
  const n = clusters.reduce((a, c) => a + c.n, 0);
  const sumX = clusters.reduce((a, c) => a + c.x, 0), sumD = clusters.reduce((a, c) => a + c.d, 0);
  const m = sumX / n, R = sumX / sumD;
  const ssM = clusters.reduce((a, c) => a + (c.x - c.n * m) ** 2, 0), ssR = clusters.reduce((a, c) => a + (c.x - R * c.d) ** 2, 0);
  assert.deepEqual(confidenceFromSums({ n, k: clusters.length, sumX, sumD, ssM, ssR, spanDays: 120 }), confidenceFromClusters(clusters, n, 120));
  // Under MIN_BETS: no range, whatever the sums say.
  const few = confidenceFromSums({ n: 4, k: 4, sumX: 0.1, sumD: 10, ssM: 0.01, ssR: 0.01, spanDays: 40 });
  assert.equal(few.perTrade, null);
  assert.equal(few.tier, 'too-early');
  assert.equal(confidenceFromSums({ n: 0, k: 0, sumX: 0, sumD: 0, ssM: 0, ssR: 0, spanDays: 0 }).perTrade, null);
});

dbTest('othersConfidence equals JS clustering by (trader, stock) over the other stocks, verified or Demo, live users only', async () => {
  const { sql } = await import('./db.ts');
  const { othersConfidence } = await import('./ticker-sql.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `to${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let i = 0; i < 4; i++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${i}` })).id);
  made.push(...ids);
  const [X, Y, Z] = [rand(), rand(), rand()];
  let seq = 0;
  const ins = async (user: number, symbol: string, openDay: number, closeDay: number, r: number, verified = true) =>
    sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
        values (${user}, ${`to-${Date.now()}-${seq++}-${Math.random()}`}, 'a', ${symbol}, ${new Date(T0 + openDay * DAY)}, ${new Date(T0 + closeDay * DAY)}, ${r}, ${closeDay - openDay}, ${verified})`;
  // Overlapping holds of one trader in one stock (one bet), the same window in another stock (a separate bet), a
  // boundary touch (inclusive: one bet), Demo rows, rows in the excluded symbol and a deleted user's rows.
  await ins(ids[0], Y, 0, 10, 0.05); await ins(ids[0], Y, 5, 12, -0.02); await ins(ids[0], Z, 5, 12, 0.03);
  await ins(ids[0], Y, 12, 15, 0.01); await ins(ids[1], Y, 0, 3, -0.06); await ins(ids[1], Y, 20, 22, 0.08);
  await ins(ids[2], Z, 1, 2, 0.02); await ins(ids[2], Z, 30, 31, -0.01); await ins(ids[1], Z, 40, 50, 0.04);
  await ins(ids[0], X, 0, 3, 0.5); await ins(ids[1], X, 1, 4, -0.5);
  await ins(ids[2], Y, 2, 9, 0.07, false); await ins(ids[3], Z, 3, 4, 0.2);
  await sql`update users set deleted_at = now() where id = ${ids[3]}`;

  await sql.begin('isolation level repeatable read read only', async (tx) => {
    for (const verified of [true, false]) {
      const ref = (await tx`
        select t.user_id, t.symbol, t.return_pct, t.holding_days, date_trunc('milliseconds', t.opened_at) as o, date_trunc('milliseconds', t.closed_at) as c
        from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
        where t.symbol <> ${X} and t.verified = ${verified}`) as unknown as { user_id: number; symbol: string; return_pct: number; holding_days: number; o: Date; c: Date }[];
      const js = confidence(ref.map((r) => ({ symbol: `${r.user_id}:${r.symbol}`, openedAt: r.o, closedAt: r.c, returnPct: r.return_pct, holdingDays: r.holding_days })), new Date());
      const got = await othersConfidence(X, verified, tx as never);
      assert.equal(got.n, ref.length);
      close(got.conf, js);
    }
  });
  // The fixture's own rows are clustered as the JS does: on these rows alone, ids[0]'s Y holds 0–10, 5–12, 12–15 are one bet.
  const mine = confidence([[0, 10], [5, 12], [12, 15]].map(([a, b]) => ({ symbol: 'u0:Y', openedAt: new Date(T0 + a * DAY), closedAt: new Date(T0 + b * DAY), returnPct: 0.01, holdingDays: b - a })), new Date());
  assert.equal(mine.k, 1);
});
