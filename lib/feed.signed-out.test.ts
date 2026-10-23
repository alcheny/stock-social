// F-2 PR-1 (plan demand A, behavioral guard): the signed-out feed, pages 1 to 3, reads no viewer table. The test
// pre-seeds the pool lib/db.ts reuses (`globalThis.sql`) with a query-logging client before that module loads; no
// product change. Later PRs only add cases here (signed-in reads for the session's viewer id only).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
const params: unknown[][] = []; // F-2 PR-2: each logged query's parameters, for the signed-in cases
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q, p) => { log.push(String(q)); params.push(p as unknown[]); } });
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

// F-2 PR-2: added cases. Signed in, the page and its paging action get the viewer from lib/viewer.ts (an id, nothing
// else) and pass it to loadFeedPage; the signed-out cases above are unchanged.
test('F-2 PR-2: the feed page and its paging action read who is viewing only through lib/viewer.ts#viewerId (an id) and pass it to loadFeedPage', () => {
  for (const f of ['../app/page.tsx', '../app/feed-actions.tsx']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(src, /import \{ viewerId \} from '@\/lib\/viewer\.ts';/, f);
    assert.match(src, /loadFeedPage\(.*\{ viewer: await viewerId\(\) \}\)/, f);
  }
  const viewer = readFileSync(new URL('./viewer.ts', import.meta.url), 'utf8');
  assert.deepEqual([...viewer.matchAll(/^export .*$/gm)].map((m) => m[0]), ['export async function viewerId(): Promise<number | undefined> {']);
  assert.match(viewer, /return \(await currentUser\(\)\)\?\.id;/);
});

dbTest('F-2 PR-2, signed in, pages 1 to 3: follows and viewer_exclusions are read only for the session\'s viewer id; never trade_likes or discovery_events', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage } = await import('./feed.ts');
  const { follow, exclude } = await import('./follows.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `s${Math.random().toString(36).slice(2, 9)}`;
  const ids: number[] = [];
  for (let t = 0; t < 41; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const [viewer, ...traders] = ids;
  const at = Date.now() - 600_000;
  await sql`insert into closed_trades ${sql(traders.flatMap((u, t) => Array.from({ length: 5 }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `G${(t * 5 + i) % 41}`, opened_at: new Date(at - 86_400_000),
    closed_at: new Date(at - (t * 5 + i) * 1000), return_pct: ((t + i) % 7 - 3) / 10 || 0.05, holding_days: 1, verified: true,
  }))))}`;
  // Another viewer's rows exist too; this viewer's queries must not reach them.
  await follow(viewer, traders[0]); await exclude(viewer, traders[1], 'not_interested'); await follow(traders[2], traders[3]);
  try {
    log.length = 0; params.length = 0;
    const p1 = await loadFeedPage(undefined, { ids: traders, viewer });
    const p2 = await loadFeedPage(p1.next!, { ids: traders, viewer });
    const p3 = await loadFeedPage(p2.next!, { ids: traders, viewer });
    assert.ok(p1.cards.length && p2.cards.length && p3.cards.length);
    assert.ok([p1, p2, p3].every((p) => p.cards.every((c) => c.user_id !== traders[1])), 'the excluded trader is not shown');
    assert.ok(p1.viewer && [p1, p2, p3].some((p) => p.viewer!.following.has(traders[0])));
    const reads = log.map((q, i) => ({ q, p: params[i] })).filter((x) => /\b(follows|viewer_exclusions)\b/.test(x.q));
    assert.ok(reads.length >= 6, `${reads.length} viewer reads`);
    for (const r of reads) {
      assert.match(r.q, /where viewer_id = \$1/, r.q);
      assert.equal(Number(r.p[0]), viewer, r.q); // the driver logs parameters serialized
    }
    assert.deepEqual(log.filter((q) => /\b(trade_likes|discovery_events)\b/.test(q)), []);
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});
