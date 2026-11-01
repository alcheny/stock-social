// F-6 · open positions on the feed (docs/features/logs/F-6/plan.md): loadFeedPage carries each page trader's unrealized
// percents for a connected or failed record only; a record with no consented connection, an importing one or a deleted
// trader carries none. Open positions never move the ranking (feed order, TR-9 lower bound).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const STATES = ['connected', 'failed', 'none', 'importing', 'deleted'] as const;

async function fixture() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `o${Math.random().toString(36).slice(2, 9)}`;
  const at = Date.now() - 30 * 60_000;
  const users: { id: number; state: (typeof STATES)[number] }[] = [];
  for (const [t, state] of STATES.entries()) {
    const attempt = await createAttempt({ method: 'dev', attested: true });
    const u = await createUserForAttempt(attempt, { handle: `${tag}${t}` });
    users.push({ id: u.id, state });
    await sql`insert into closed_trades ${sql(Array.from({ length: 6 }, (_, i) => ({
      user_id: u.id, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `${tag.slice(1, 4).toUpperCase()}${t * 6 + i}`,
      opened_at: new Date(at - (t * 6 + i) * 60_000 - 86_400_000), closed_at: new Date(at - (t * 6 + i) * 60_000),
      return_pct: (i % 2 ? 0.2 : -0.15) * (t + 1), holding_days: 1, verified: true,
    })))}`;
    if (state !== 'none' && state !== 'deleted') {
      await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at)
        values (${attempt}, ${u.id}, ${state}, now(), now(), now())`;
    }
  }
  return { sql, tag, users, ids: users.map((u) => u.id), remove: () => sql`delete from users where id in ${sql(users.map((u) => u.id))}` };
}

dbTest('F-6 feed: open positions for connected and failed records only; none, importing and deleted carry none', async () => {
  const { loadFeedPage, clearFeedCache } = await import('./feed.ts');
  const f = await fixture();
  try {
    const by = Object.fromEntries(f.users.map((u) => [u.state, u.id]));
    // Every trader holds two positions, one symbol in two accounts (two positions, never merged).
    await f.sql`insert into open_positions ${f.sql(f.users.flatMap((u, t) => [
      { user_id: u.id, account_id: 'a', symbol: 'OPN', unrealized_pct: [-0.2, -0.21, -0.22, -0.23, -0.24][t] },
      { user_id: u.id, account_id: 'b', symbol: 'OPN', unrealized_pct: 0.05 },
    ]))}`;
    // Deleted after asOf: the trader's cards leave the page (a gap), and nothing of theirs is read for it.
    clearFeedCache();
    const now = Date.now() - 5_000;
    await f.sql`update users set deleted_at = now() where id = ${by.deleted}`;
    const page = await loadFeedPage(undefined, { now, ids: f.ids });
    const onPage = new Set(page.cards.map((c) => c.user_id));
    assert.ok(onPage.has(by.connected) && onPage.has(by.failed) && onPage.has(by.none), 'connected, failed and none records are on the page');
    assert.ok(!onPage.has(by.importing) && !onPage.has(by.deleted), 'importing and deleted records are not');
    assert.deepEqual([...page.open!.get(by.connected)!].sort(), [-0.2, 0.05]);
    assert.deepEqual([...page.open!.get(by.failed)!].sort(), [-0.21, 0.05]);
    for (const s of ['none', 'importing', 'deleted'] as const) assert.equal(page.open!.has(by[s]), false, s);
  } finally {
    await f.remove();
  }
});

dbTest('F-6 feed: a trader with no open positions has no entry; open positions never change the feed order', async () => {
  const { loadFeedPage, feedList, clearFeedCache } = await import('./feed.ts');
  const f = await fixture();
  try {
    const asOf = new Date(Date.now() - 5_000);
    const day = asOf.toISOString().slice(0, 10);
    clearFeedCache();
    const before = (await feedList({ asOf, day, ids: f.ids })).list.map((c) => c.sell_id);
    const empty = await loadFeedPage(undefined, { now: asOf.getTime(), ids: f.ids });
    assert.equal(empty.open!.size, 0);
    await f.sql`insert into open_positions ${f.sql(f.ids.map((id) => ({ user_id: id, account_id: 'a', symbol: 'OPN', unrealized_pct: -0.9 })))}`;
    clearFeedCache();
    assert.deepEqual((await feedList({ asOf, day, ids: f.ids })).list.map((c) => c.sell_id), before);
  } finally {
    await f.remove();
  }
});
