// F-2 PR-1 (plan demand A, behavioral guard): the signed-out feed, pages 1 to 3, reads no viewer table. The test
// pre-seeds the pool lib/db.ts reuses (`globalThis.sql`) with a query-logging client before that module loads; no
// product change. Later PRs only add cases here (signed-in reads for the session's viewer id only).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q) => { log.push(String(q)); } });
const VIEWER_TABLES = /\b(follows|viewer_exclusions|trade_likes|discovery_events)\b/i;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

test('the feed page, its rows and its paging action query only through lib/feed.ts#loadFeedPage (no db or session import)', () => {
  for (const f of ['../app/page.tsx', '../app/feed-rows.tsx', '../app/feed-actions.tsx', '../app/feed-pager.tsx']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /lib\/db(\.ts)?['"]|lib\/session(\.ts)?['"]|next\/headers|\bsql`/, f);
  }
  assert.match(readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8'), /loadFeedPage\(/);
  assert.match(readFileSync(new URL('../app/feed-actions.tsx', import.meta.url), 'utf8'), /loadFeedPage\(/);
});

dbTest('signed out, pages 1 to 3: no query touches follows, viewer_exclusions, trade_likes or discovery_events', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage } = await import('./feed.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `g${Math.random().toString(36).slice(2, 9)}`;
  const ids: number[] = [];
  for (let t = 0; t < 40; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const at = Date.now() - 600_000;
  await sql`insert into closed_trades ${sql(ids.flatMap((u, t) => Array.from({ length: 5 }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `G${(t * 5 + i) % 41}`, opened_at: new Date(at - 86_400_000),
    closed_at: new Date(at - (t * 5 + i) * 1000), return_pct: ((t + i) % 7 - 3) / 10 || 0.05, holding_days: 1, verified: true,
  }))))}`;
  try {
    log.length = 0;
    // The page's own call (every trader), then pages 1 to 3 of a fixture large enough to have them.
    await loadFeedPage(undefined);
    const p1 = await loadFeedPage(undefined, { ids });
    const p2 = await loadFeedPage(p1.next!, { ids });
    const p3 = await loadFeedPage(p2.next!, { ids });
    assert.equal(p1.cards.length + p2.cards.length, 60);
    assert.ok(p3.cards.length > 0);
    assert.ok(log.length >= 12, `${log.length} queries logged`);
    const bad = log.filter((q) => VIEWER_TABLES.test(q));
    assert.deepEqual(bad, []);
    assert.ok(log.some((q) => /closed_trades/.test(q)), 'the log sees the feed query');
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});
