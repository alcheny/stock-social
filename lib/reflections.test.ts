import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkReflection, reflectionInsights, type Reason } from './reflections.ts';

const mk = (reason: Reason, rets: number[]) => rets.map((r, i) => ({ sellId: `${reason}${i}`, returnPct: r, reason }));
const run = (...gs: ReturnType<typeof mk>[]) => {
  const all = gs.flat();
  return reflectionInsights(all, new Map(all.map((t) => [t.sellId, t.reason])));
};
const five = (x: number) => [x, x, x, x, x];

test('empty', () => assert.deepEqual(reflectionInsights([], new Map()), []));

test('one trade: not enough, no takeaway', () => {
  const [g] = run(mk('impulse', [0.1]));
  assert.equal(g.n, 1);
  assert.equal(g.enough, false);
  assert.equal(g.takeaway, null);
  assert.equal(g.avgReturn, null);
});

test('untagged trades are excluded', () => {
  const trades = [{ sellId: 'a', returnPct: 0.1 }, { sellId: 'b', returnPct: 0.2 }];
  const g = reflectionInsights(trades, { a: 'tip' });
  assert.equal(g.length, 1);
  assert.equal(g[0].n, 1);
});

test('4 vs 5 trades flips enough', () => {
  assert.equal(run(mk('planned', five(0.01).slice(0, 4)))[0].enough, false);
  assert.equal(run(mk('planned', five(0.01)))[0].enough, true);
});

test('one qualifying group: stats but no takeaway', () => {
  const gs = run(mk('planned', [0.1, 0.1, -0.1, 0, 0.2]), mk('impulse', [0.1]));
  assert.equal(gs[0].winRate, 0.6);
  assert.ok(Math.abs(gs[0].avgReturn! - 0.06) < 1e-9);
  assert.ok(gs.every((g) => g.takeaway === null));
});

test('two groups, both sign directions formatted', () => {
  const gs = run(mk('planned', five(0.014)), mk('impulse', five(-0.031)));
  assert.equal(gs[1].takeaway, 'Trades tagged Impulse averaged -3.1% vs +1.4% for Planned setup');
  assert.equal(gs[0].takeaway, 'Trades tagged Planned setup averaged +1.4% vs -3.1% for Impulse');
});

test('three groups: compare with highest n, ties by enum order', () => {
  const gs = run(mk('planned', five(0.014)), mk('catalyst', [...five(0.05), 0.05]), mk('impulse', five(-0.031)));
  assert.match(gs[2].takeaway!, /for News\/catalyst$/);
  assert.match(gs[0].takeaway!, /for News\/catalyst$/);
  const tie = run(mk('planned', five(0.014)), mk('tip', five(0.02)), mk('impulse', five(-0.031)));
  assert.equal(tie[2].takeaway, 'Trades tagged Impulse averaged -3.1% vs +1.4% for Planned setup');
});

test('tag on a missing sell_id is ignored; takeaway has no advice words', () => {
  const gs = reflectionInsights([{ sellId: 'a', returnPct: 0.1 }], { a: 'other', gone: 'impulse' });
  assert.deepEqual(gs.map((g) => g.reason), ['other']);
  const t = run(mk('planned', five(0.01)), mk('impulse', five(-0.02)))[1].takeaway!;
  assert.doesNotMatch(t, /should|avoid|try/i);
});

test('checkReflection', () => {
  const ok = { userId: 1, reason: 'impulse', sellId: 's', owned: true };
  assert.deepEqual(checkReflection(ok), { ok: true, reason: 'impulse', sellId: 's' });
  assert.deepEqual(checkReflection({ ...ok, reason: '' }), { ok: true, reason: null, sellId: 's' });
  for (const bad of [{ userId: null }, { reason: 'foo' }, { reason: undefined }, { reason: 5 }, { owned: false }, { sellId: undefined }, { sellId: 5 }]) {
    assert.deepEqual(checkReflection({ ...ok, ...bad }), { ok: false, error: 'Not allowed' });
  }
});

test('nothing deletes, truncates or drops trade_reflections', () => {
  const strip = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8').replace(/--.*$/gm, '').replace(/\/\/.*$/gm, '');
  const schema = strip('../db/schema.sql');
  const sync = strip('./sync.ts');
  assert.match(schema, /create table if not exists trade_reflections/);
  assert.doesNotMatch(schema, /\b(drop|truncate)\b|delete\s+from/i);
  assert.doesNotMatch(sync, /trade_reflections|truncate|\bdrop\b/i);
  for (const m of sync.matchAll(/delete\s+from\s+(\w+)/gi)) assert.equal(m[1], 'closed_trades');
});

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => {
  if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
});
after(async () => {
  if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 });
});

dbTest('reflections survive rebuildTrades, orphans too', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const tag = `t${Math.random().toString(36).slice(2, 12)}`;
  const [{ id }] = await sql`with a as (insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag}, 'r', now(), a.id from a returning id`;
  try {
    const act = (ext: string, side: string, price: number, at: string) => sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
      values (${id}, 'demo', ${`${tag}-${ext}`}, ${tag}, 'AAPL', ${side}, 1, ${price}, ${at}, '{}')`;
    await act('b', 'BUY', 10, '2025-01-02');
    await act('s', 'SELL', 12, '2025-01-05');
    await rebuildTrades(id);
    const [t] = await sql`select sell_id from closed_trades where user_id = ${id}`;
    await sql`insert into trade_reflections (user_id, sell_id, reason) values (${id}, ${t.sell_id}, 'planned'), (${id}, 'orphan', 'tip')`;
    await rebuildTrades(id);
    const rows = await sql`select sell_id from trade_reflections where user_id = ${id}`;
    assert.deepEqual(rows.map((r) => r.sell_id).sort(), [t.sell_id, 'orphan'].sort());
  } finally {
    await sql`delete from users where id = ${id}`;
  }
});
