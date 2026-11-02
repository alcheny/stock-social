// Known limit removed 2026-11-01 (item 3): "the close's sell was imported after asOf" is read from the close itself
// (closed_trades.sell_imported_at, set by a trigger) instead of from every sell imported since asOf. These tests hold the
// new filter to the old one, row by row, and the feed list built with no kept list to the one built with it.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

test('schema: the import time is additive, set by a guarded trigger, backfilled once (recent sells only)', () => {
  assert.match(schema, /alter table closed_trades add column sell_imported_at timestamptz/);
  const branch = schema.slice(schema.indexOf("column_name = 'sell_imported_at'"), schema.indexOf('end $si$'));
  assert.match(branch, /update closed_trades t set sell_imported_at/, 'the backfill runs only where the column is added');
  assert.match(branch, /created_at > now\(\) - interval '49 hours'/, 'only sells a live cursor can see (48 h)');
  assert.match(schema, /if not exists \(select 1 from pg_trigger where tgname = 'closed_trades_sell_imported_at'/);
  assert.doesNotMatch(schema, /create or replace trigger/i);
  // The probe matches the unique (source, external_id) index alone, with no user index the planner could prefer.
  assert.match(schema, /where source in \('snaptrade', 'demo'\) and external_id = new.sell_id and side = 'SELL'/);
});

test('lib/feed.ts reads no activities: every late filter is on the close', () => {
  const src = readFileSync(new URL('./feed.ts', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/--.*$/gm, '');
  assert.doesNotMatch(src, /from activities/);
  assert.doesNotMatch(src, /lateArray|unnest/);
});

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => {
  if (hasDb) await (await import('./db.ts')).sql.unsafe(schema).simple();
});
after(async () => {
  if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 });
});

dbTest('the same closes are left out as by the old filter, and the list is the same with or without a kept list', async () => {
  const { sql } = await import('./db.ts');
  const { feedList, feedCandidates, clearFeedCache } = await import('./feed.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const tag = `fi${Math.random().toString(36).slice(2, 8)}`;
  const ids = (await sql`
    with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, 8) returning id),
         n as (select id, row_number() over (order by id) as k from a)
    insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${tag} || k, ${tag} || k, now(), id from n returning id`).map((r) => r.id as number);
  const act = (u: number, ext: string, side: 'BUY' | 'SELL', price: number, hoursAgo: number) => sql`
    insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
    values (${u}, 'snaptrade', ${ext}, 'a', ${`${tag.toUpperCase()}${u % 3}`}, ${side}, 1, ${price}, now() - (${hoursAgo} || ' hours')::interval, '{}'::jsonb)`;
  try {
    // Before asOf: 6 round trips per trader (bought and sold), rebuilt into closes by the real rebuild.
    for (const [k, u] of ids.entries()) {
      for (let i = 0; i < 6; i++) {
        await act(u, `${tag}-${u}-b${i}`, 'BUY', 100, 100 - i * 10);
        await act(u, `${tag}-${u}-s${i}`, 'SELL', 100 + ((k * 7 + i * 13) % 40) - 20, 95 - i * 10);
      }
      await rebuildTrades(u);
    }
    // A close with no sell activity (as tests and corrections can leave): counts, as before.
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${ids[0]}, ${`${tag}-orphan`}, 'a', 'ORPH', now() - interval '3 days', now() - interval '2 hours', 0.5, 1, true)`;
    await new Promise((r) => setTimeout(r, 20));
    const asOf = new Date();
    await new Promise((r) => setTimeout(r, 20));
    // After asOf: a sell dated before asOf (the hourly sync's re-read window) for two traders, and one dated after it.
    for (const u of ids.slice(1, 3)) {
      await act(u, `${tag}-${u}-lb`, 'BUY', 100, 30);
      await act(u, `${tag}-${u}-ls`, 'SELL', 150, 1);
      await rebuildTrades(u); // renumbers every close of the trader; their import times stay
    }
    await act(ids[3], `${tag}-${ids[3]}-nb`, 'BUY', 100, 1);
    await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
      values (${ids[3]}, 'snaptrade', ${`${tag}-${ids[3]}-ns`}, 'a', ${`${tag.toUpperCase()}${ids[3] % 3}`}, 'SELL', 1, 90, now(), '{}'::jsonb)`; // F-35: dated after asOf at the insert's own clock (a row dated ahead now waits, unpublished, until its date)
    await rebuildTrades(ids[3]);

    // Row by row: the column equals the sell activity's import time, and the new test equals the old one.
    const rows = await sql`
      select t.sell_id, t.sell_imported_at, (select max(a.created_at) from activities a where a.external_id = t.sell_id and a.side = 'SELL') as created,
             exists (select 1 from activities a where a.external_id = t.sell_id and a.side = 'SELL' and a.created_at > ${asOf}) as old_late,
             not (t.sell_imported_at is null or t.sell_imported_at <= ${asOf}) as new_late
      from closed_trades t where t.user_id = any(${ids})`;
    assert.ok(rows.length >= 8 * 6 + 3);
    for (const r of rows) {
      assert.equal(r.sell_imported_at?.getTime() ?? null, r.created?.getTime() ?? null, r.sell_id);
      assert.equal(r.new_late, r.old_late, r.sell_id);
    }
    assert.equal(rows.filter((r) => r.old_late).length, 3, 'two late sells dated before asOf, one after');
    assert.equal(rows.find((r) => r.sell_id === `${tag}-orphan`)!.sell_imported_at, null);

    const cands = await feedCandidates({ ids, asOf });
    const listed = new Set(cands.map((c) => c.sell_id));
    for (const r of rows.filter((x) => x.old_late)) assert.ok(!listed.has(r.sell_id), `late ${r.sell_id} is not a candidate`);
    assert.ok(listed.has(`${tag}-orphan`), 'a close with no sell activity counts');

    // The list with no kept list (weights cold or kept) is the list page 1 built.
    const day = asOf.toISOString().slice(0, 10);
    clearFeedCache('all');
    const first = await feedList({ asOf, day, ids });
    const again = await feedList({ asOf, day, ids });
    clearFeedCache('all');
    const cold = await feedList({ asOf, day, ids });
    for (const other of [again, cold]) {
      assert.deepEqual(other.list.map((c) => [c.sell_id, c.score, c.explore]), first.list.map((c) => [c.sell_id, c.score, c.explore]));
      assert.deepEqual(other.pool, first.pool);
    }
    assert.ok(first.list.length > 0);
    // A later page 1 sees the late closes.
    const now = await feedCandidates({ ids, asOf: new Date() });
    assert.ok(now.some((c) => rows.some((r) => r.old_late && r.sell_id === c.sell_id)));
  } finally {
    await sql`delete from users where id = any(${ids})`;
  }
});
