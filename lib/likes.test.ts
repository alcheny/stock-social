// F-2 PR-4: private likes and rejected trades. trade_key equals node:crypto's sha256 for awkward sell ids and survives
// rebuildTrades; a like re-attaches after a rebuild; nothing public reads either table; every read is keyed by the
// viewer; the likes list pages (10,000 likes); deletion's first step leaves zero rows.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const root = fileURLToPath(new URL('..', import.meta.url));
const sources = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(root, dir, f);
  return statSync(p).isDirectory() ? sources(relative(root, p)) : /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) ? [relative(root, p)] : [];
});
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

async function people(n: number) {
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `l${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let i = 0; i < n; i++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${i}` })).id);
  return { tag, ids };
}
const closes = async (user: number, sellIds: string[]) => {
  const { sql } = await import('./db.ts');
  const at = Date.now() - 3_600_000;
  const out: { id: string; sell: string; key: string }[] = [];
  for (let k = 0; k < sellIds.length; k += 2000) {
    out.push(...(await sql`insert into closed_trades ${sql(sellIds.slice(k, k + 2000).map((s, j) => ({ user_id: user, sell_id: s, account_id: 'a', symbol: `K${(k + j) % 20}`,
      opened_at: new Date(at - 86_400_000), closed_at: new Date(at - (k + j) * 1000), return_pct: (k + j) % 2 ? -0.1 : 0.1, holding_days: 1, verified: true })))} returning id, sell_id, trade_key`)
      .map((r) => ({ id: String(r.id), sell: r.sell_id as string, key: r.trade_key as string })));
  }
  return out;
};

test('only lib/likes.ts, lib/delete.ts name trade_likes and trade_exclusions; every read and delete is keyed by the viewer; nothing counts them; no public page, card, image or route imports them', () => {
  const tables = /\b(trade_likes|trade_exclusions)\b/;
  const naming = [...sources('app'), ...sources('lib')].filter((f) => [...readFileSync(join(root, f), 'utf8').matchAll(/sql`[^`]*`|tx`[^`]*`|conn`[^`]*`/g)].some((m) => tables.test(m[0])));
  assert.deepEqual(naming.sort(), ['lib/delete.ts', 'lib/likes.ts', 'lib/privacy-purge.ts']);
  // Privacy work (committee D10): the tick's purge names the tables only to find, mark and remove likes and rejects whose
  // trade is gone (a closed_trades not-exists in every statement); it never reads them for anyone or counts them.
  const purge = [...readFileSync(join(root, 'lib/privacy-purge.ts'), 'utf8').matchAll(/(?:sql|tx|conn)`([^`]*)`/g)].map((m) => m[1]).filter((q) => tables.test(q));
  assert.ok(purge.length >= 4);
  for (const q of purge) {
    assert.doesNotMatch(q, /count\s*\(/i, q);
    if (/^\s*insert into privacy_orphans/i.test(q) || /delete from trade_(likes|exclusions)/i.test(q)) {
      // Marking and removing: only rows whose trade matches no closed trade.
      assert.match(q, /not exists \(select 1 from closed_trades c where c\.trade_key = [lx]\.trade_key\)/, q);
    } else {
      // Anything else only clears marks (privacy_orphans), never touching the likes or rejects themselves.
      assert.match(q, /^\s*delete from privacy_orphans/i, q);
      assert.doesNotMatch(q, /delete from trade_|insert into trade_|update trade_/i, q);
    }
  }
  const statements = [...readFileSync(join(root, 'lib/likes.ts'), 'utf8').matchAll(/sql`([^`]*)`/g)].map((m) => m[1]).filter((q) => tables.test(q));
  assert.ok(statements.length >= 8);
  for (const q of statements) {
    assert.doesNotMatch(q, /count\s*\(/i, q);
    if (!/^\s*insert/i.test(q)) assert.match(q, /viewer_id = \$\{viewer\}/, q);
  }
  for (const f of sources('app').filter((f) => /opengraph-image|story|pane|sitemap|robots|u\/\[handle\]|similar|suggest/.test(f))) assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /lib\/likes|card-menu|likeTrade/, f);
});

test('no like copy carries a number or a count', async () => {
  const { LIKES } = await import('./copy.ts');
  // Privacy work (owner copy, 2026-11-01): LIKES.private states that no count exists, in the owner's exact words, held by
  // the exact-string test below; every other like line is held to this rule unchanged.
  for (const [k, v] of Object.entries(LIKES)) { if (k === 'private') continue; const t = typeof v === 'function' ? (v as (...a: string[]) => string)('KQ', 'Jan') : v; assert.doesNotMatch(t, /\d|\bcount\b|people|others/i, t); }
});

test('the likes privacy line is exactly the owner\'s text: it names no number and says no one sees a count', async () => {
  const { LIKES } = await import('./copy.ts');
  assert.equal(LIKES.private, 'Only you can see your likes. Traders are never told and no one sees a count. Likes help order your own feed.');
  assert.doesNotMatch(LIKES.private, /\d|people|others/);
});

dbTest('trade_key equals node:crypto sha256 (UTF-8) for a\\b, \\x41, \\\\, \\001, a trailing \\ and non-ASCII text; no input error', async () => {
  const { sql } = await import('./db.ts');
  const { tradeKey } = await import('./likes.ts');
  const { ids: [u] } = await people(1);
  const odd = ['a\\b', '\\x41', '\\\\', '\\001', 'end\\', 'é—株式-ü', "q'uote", 'plain'];
  try {
    const rows = await closes(u, odd.map((s) => `${u}-${s}`));
    for (const r of rows) { assert.equal(r.key, sha(r.sell)); assert.equal(tradeKey(r.sell), r.key); }
    assert.equal(new Set(rows.map((r) => r.key)).size, odd.length);
  } finally {
    await sql`delete from users where id = ${u}`;
  }
});

dbTest('fix round 1: rejecting a liked trade removes the like (the likes list is empty); Undo restores it at its place; an unliked trade stays unliked after Undo; another viewer is untouched', async () => {
  const { sql } = await import('./db.ts');
  const { like, rejectTrade, undoRejectTrade, ownLikes, likedAmong } = await import('./likes.ts');
  const { tag, ids: [viewer, trader, other] } = await people(3);
  try {
    const [a, b, c] = await closes(trader, [`${tag}-r1`, `${tag}-r2`, `${tag}-r3`]);
    await like(viewer, a.id); await like(viewer, b.id); await like(other, a.id);
    await sql`update trade_likes set created_at = now() - interval '1 hour' where viewer_id = ${viewer} and trade_key = ${a.key}`;
    const before = (await ownLikes(viewer)).rows.map((r) => r.key);
    assert.deepEqual(before, [b.key, a.key]);
    assert.equal(await rejectTrade(viewer, a.id), true);
    assert.deepEqual((await ownLikes(viewer)).rows.map((r) => r.key), [b.key]);
    assert.deepEqual([...await likedAmong(viewer, [a.id])], []);
    assert.deepEqual([...await likedAmong(other, [a.id])], [a.id]);
    assert.equal(await undoRejectTrade(viewer, a.id), true);
    assert.deepEqual((await ownLikes(viewer)).rows.map((r) => r.key), before);
    assert.equal((await sql`select 1 from trade_exclusions where viewer_id = ${viewer}`).length, 0);
    await rejectTrade(viewer, c.id); await undoRejectTrade(viewer, c.id);
    assert.deepEqual([...await likedAmong(viewer, [c.id])], []);
  } finally {
    await sql`delete from users where handle like ${tag + '%'}`;
  }
});

dbTest('like, unlike, reject: one row each, never your own trade; a like and a reject survive rebuildTrades and re-attach to the rebuilt close; the feed drops a rejected trade for that viewer only', async () => {
  const { sql } = await import('./db.ts');
  const { like, unlike, rejectTrade, undoRejectTrade, likedAmong, rejectedAmong, ownLikes } = await import('./likes.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const { tag, ids: [viewer, trader, other] } = await people(3);
  try {
    await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw) values
      (${trader}, 'demo', ${`${tag}-b`}, 'acct', 'KQ', 'BUY', 1, 10, now() - interval '3 days', '{}'),
      (${trader}, 'demo', ${`${tag}-s\\1`}, 'acct', 'KQ', 'SELL', 1, 12, now() - interval '1 day', '{}')`;
    await rebuildTrades(trader);
    const [t1] = await sql`select id::text, trade_key from closed_trades where user_id = ${trader}`;
    assert.equal(t1.trade_key, sha(`${tag}-s\\1`));
    // Fix round 1: a reject removes the like, so the reject comes first here and the like after it (both rows kept).
    assert.equal(await rejectTrade(viewer, t1.id), true);
    assert.equal(await like(viewer, t1.id), true);
    assert.equal(await like(viewer, t1.id), true); // idempotent
    assert.equal(await like(trader, t1.id), false); // never your own
    for (const bad of ['1; drop', '', 'x', -1, null, '9'.repeat(19)]) assert.equal(await like(viewer, bad), false);
    assert.equal((await sql`select 1 from trade_likes where viewer_id = ${viewer}`).length, 1);
    await rebuildTrades(trader);
    const [t2] = await sql`select id::text, trade_key, sell_id from closed_trades where user_id = ${trader}`;
    assert.notEqual(t2.id, t1.id);
    assert.equal(t2.trade_key, t1.trade_key);
    assert.deepEqual([...await likedAmong(viewer, [t2.id])], [t2.id]);
    assert.deepEqual([...await likedAmong(other, [t2.id])], []);
    assert.deepEqual([...await rejectedAmong(viewer, [t2.sell_id])], [t2.sell_id]);
    assert.deepEqual([...await rejectedAmong(other, [t2.sell_id])], []);
    assert.equal((await ownLikes(viewer)).rows[0].symbol, 'KQ');
    assert.equal(await unlike(viewer, { id: t2.id }), true);
    assert.equal((await ownLikes(viewer)).rows.length, 0);
    // The feed: a rejected close is gone for this viewer, there for everyone else; Undo brings it back.
    const { loadFeedPage, clearFeedCache } = await import('./feed.ts');
    const [f] = await closes(other, [1, 2, 3, 4, 5].map((i) => `${tag}-feed${i}`)); // the feed lists records with 5 closes or more
    clearFeedCache();
    const n = (await loadFeedPage(undefined, { ids: [other] })).cards.length;
    assert.ok(n >= 1);
    const shown = async (who?: number) => (await loadFeedPage(undefined, { ids: [other], viewer: who })).cards.map((c) => String(c.id));
    assert.ok((await shown()).includes(f.id));
    assert.equal(await rejectTrade(viewer, f.id), true);
    assert.ok(!(await shown(viewer)).includes(f.id));
    assert.equal((await shown(viewer)).length, n - 1);
    assert.ok((await shown(trader)).includes(f.id));
    assert.ok((await shown()).includes(f.id));
    assert.equal(await undoRejectTrade(viewer, f.id), true);
    assert.ok((await shown(viewer)).includes(f.id));
    // A like whose close is gone is kept and ignored on read.
    await like(viewer, t2.id);
    await sql`delete from closed_trades where user_id = ${trader}`;
    assert.equal((await sql`select 1 from trade_likes where viewer_id = ${viewer}`).length, 1);
    assert.deepEqual((await ownLikes(viewer)).rows, []);
  } finally {
    await sql`delete from users where id in ${sql([viewer, trader, other])}`;
  }
});

// What the heavy test proves is that a page's cost does not grow with its depth: the keyset is index-backed (no OFFSET
// scan, no filter or sort over the viewer's 10,000 likes). EXPLAIN ANALYZE states that in rows read, which machine load
// cannot change; the timings then compare deep pages with shallow ones run in turn, so both see the same load.
type PlanNode = { 'Node Type': string; 'Relation Name'?: string; 'Index Name'?: string; 'Actual Rows': number; 'Actual Loops': number;
  'Rows Removed by Filter'?: number; 'Rows Removed by Index Recheck'?: number; 'Shared Hit Blocks'?: number; 'Shared Read Blocks'?: number; Plans?: PlanNode[] };
const planNodes = (n: PlanNode): PlanNode[] => [n, ...(n.Plans ?? []).flatMap(planNodes)];
// Rows a node read: those it returned plus those it threw away, over all its loops.
const rowsRead = (n: PlanNode) => (n['Actual Rows'] + (n['Rows Removed by Filter'] ?? 0) + (n['Rows Removed by Index Recheck'] ?? 0)) * n['Actual Loops'];
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

dbTest('heavy: a viewer with 10,000 likes lists them 50 a page, newest first, every like once; a deep page reads no more likes than a shallow one (EXPLAIN) and takes about as long', async () => {
  const { sql } = await import('./db.ts');
  const { ownLikes, ownLikesQuery, LIKES_PAGE } = await import('./likes.ts');
  const { ids: [viewer, trader] } = await people(2);
  try {
    const rows = await closes(trader, Array.from({ length: 10_000 }, (_, i) => `${trader}-h${i}`));
    const at = Date.now();
    // Some likes share a timestamp (the keyset's tie-break).
    for (let k = 0; k < rows.length; k += 2000) await sql`insert into trade_likes ${sql(rows.slice(k, k + 2000).map((r, j) => ({ viewer_id: viewer, trade_key: r.key, trader_id: trader, created_at: new Date(at - Math.floor((k + j) / 3) * 1000) })))}`;
    const seen = new Set<string>();
    const cursors: (string | undefined)[] = [], ms: number[] = [];
    let after: string | null | undefined, pages = 0, prev = Infinity;
    do {
      cursors.push(after ?? undefined);
      const t0 = performance.now();
      const p = await ownLikes(viewer, after ?? undefined);
      ms.push(performance.now() - t0);
      assert.ok(p.rows.length <= LIKES_PAGE);
      for (const r of p.rows) { assert.ok(!seen.has(r.key)); seen.add(r.key); }
      const first = rows.findIndex((r) => r.key === p.rows[0]?.key);
      if (p.rows.length) { assert.ok(Math.floor(first / 3) >= Math.floor(prev / 3) || prev === Infinity); prev = first; }
      after = p.next; pages++;
    } while (after);
    assert.equal(seen.size, 10_000);
    assert.equal(pages, 200);

    // Statistics first, as a live table has them (autovacuum). Without them, or with ones sampled before these 10,000 rows
    // existed (another test file's analyze), the planner picks plans that read every like or close in sight: a bitmap
    // or primary-key scan plus a top-N sort of all the viewer's likes below the cursor, or a BitmapAnd over all 10,000 of
    // the trader's closes per like (both seen in auto_explain logs under parallel load). Which ran would then depend on
    // when autovacuum last woke, not on the query.
    await sql`analyze trade_likes, closed_trades, users`;

    // The page statements exactly as ownLikes sends them, prepared on one reserved connection. ownLikes goes through the
    // pool, which hands consecutive queries to its connections in turn; each connection keeps its own plan cache, and
    // with an even number of them, calls that alternate shallow and deep pages land on disjoint connections.
    const conn = await sql.reserve();
    try {
      const first = (await ownLikesQuery(viewer).describe()).string, next = (await ownLikesQuery(viewer, cursors[1]).describe()).string;
      // The parameters exec() below binds, in this order: viewer, then the cursor's microseconds and key, then the limit.
      assert.match(first, /viewer_id = \$1\b[\s\S]*limit \$2\)/);
      assert.match(next, /viewer_id = \$1\b[\s\S]*\$2::bigint[\s\S]*\$3\)[\s\S]*limit \$4\)/);
      await conn.unsafe(`prepare likes_first as ${first}`);
      await conn.unsafe(`prepare likes_next as ${next}`);
      const bound = LIKES_PAGE + 1;
      const exec = (page: number) => {
        const m = page === 1 ? null : /^([0-9]+)\.([0-9a-f]{64})$/.exec(cursors[page - 1]!)!;
        return m ? `execute likes_next(${viewer}, ${m[1]}, '${m[2]}', ${bound})` : `execute likes_first(${viewer}, ${bound})`;
      };

      // 1. Deterministic: the plan of every page, both as a custom plan (planned for that cursor) and as the generic plan
      // a prepared statement switches to after five runs. Every node that touches trade_likes is an index read of at most
      // a page plus the look-ahead row (LIMIT 51), counting rows a filter or recheck threw away; every node on
      // closed_trades reads at most one close per chosen like; nothing sorts more than a page. On the last page an OFFSET
      // would read ~10,000 index rows, a cursor checked as a filter rather than an index bound would remove ~9,950, a sort
      // of all likes or a scan of the trader's closes in closed_at order (which reaches older likes' closes later) would
      // read thousands; none of these depend on machine load.
      let deepBlocks = 0;
      for (const mode of ['force_custom_plan', 'force_generic_plan']) {
        await conn.unsafe(`set plan_cache_mode = ${mode}`);
        for (let page = 1; page <= pages; page++) {
          const [r] = await conn.unsafe(`explain (analyze, buffers, format json) ${exec(page)}`);
          const nodes = planNodes((r['QUERY PLAN'] as { Plan: PlanNode }[])[0].Plan);
          const on = (t: string) => nodes.filter((n) => n['Relation Name'] === t || n['Index Name']?.startsWith(`${t}_`));
          const at = `page ${page} (${mode})`;
          assert.ok(on('trade_likes').some((n) => /Index/.test(n['Node Type'])), `${at}: trade_likes is read through an index`);
          for (const n of on('trade_likes')) {
            assert.notEqual(n['Node Type'], 'Seq Scan', at);
            assert.ok(rowsRead(n) <= bound, `${at}: ${n['Node Type']} on trade_likes read ${rowsRead(n)} rows (at most ${bound})`);
            if (page === pages && mode === 'force_custom_plan') deepBlocks += (n['Shared Hit Blocks'] ?? 0) + (n['Shared Read Blocks'] ?? 0);
          }
          for (const n of on('closed_trades')) assert.ok(rowsRead(n) <= bound, `${at}: ${n['Node Type']} on closed_trades read ${rowsRead(n)} rows (at most ${bound})`);
          for (const s of nodes.filter((n) => /Sort$/.test(n['Node Type']))) {
            for (const c of s.Plans ?? []) assert.ok(c['Actual Rows'] * c['Actual Loops'] <= bound, `${at}: a sort over ${c['Actual Rows']} rows`);
          }
        }
      }

      // 2. Timing, as the app runs it (plan_cache_mode auto) and tolerant of machine load: each of pages 2 to 21 and 181
      // to 200 run five times in turn on the one connection, keeping each page's fastest run (the closest to its unloaded
      // cost); the deep pages' median may not be much above the shallow ones'. A loaded machine slows some runs, rarely
      // all five of a page.
      await conn.unsafe('set plan_cache_mode = auto');
      const fastest = async (page: number) => {
        let best = Infinity;
        for (let k = 0; k < 5; k++) { const t0 = performance.now(); await conn.unsafe(exec(page)); best = Math.min(best, performance.now() - t0); }
        return best;
      };
      const shallow: number[] = [], deep: number[] = [];
      for (let i = 0; i < 20; i++) { shallow.push(await fastest(2 + i)); deep.push(await fastest(181 + i)); }
      const [walkMedian, slowest, shallowMedian, deepMedian, worst] = [median(ms), Math.max(...ms), median(shallow), median(deep), Math.max(...shallow, ...deep)];
      console.log(`# 10,000 likes: ${pages} pages, median page ${walkMedian.toFixed(1)} ms, slowest page ${slowest.toFixed(1)} ms; fastest of 5: `
        + `pages 2-21 median ${shallowMedian.toFixed(2)} ms, pages 181-200 median ${deepMedian.toFixed(2)} ms; the deepest page read ${deepBlocks} trade_likes blocks`);
      assert.ok(deepMedian <= 2 * shallowMedian + 5, `deep pages ${deepMedian} ms vs shallow ${shallowMedian} ms`);
      // Ceilings: a page's fastest run (about 1 ms unloaded), and the walk's slowest page through ownLikes before any
      // statistics existed (183 ms seen under parallel load).
      assert.ok(worst < 100, `a page's fastest run took ${worst} ms`);
      assert.ok(slowest < 1_000, `slowest page ${slowest} ms`);
    } finally {
      // Only this test's two statements: the driver keeps its own prepared statements on the connection.
      await conn.unsafe('deallocate likes_first').catch(() => {});
      await conn.unsafe('deallocate likes_next').catch(() => {});
      await conn.unsafe('reset plan_cache_mode').catch(() => {});
      conn.release();
    }
  } finally {
    await sql`delete from users where id in ${sql([viewer, trader])}`;
  }
});

dbTest('deletion: as viewer and as trader, zero rows left in trade_likes and trade_exclusions; a failed vendor call still leaves zero', async () => {
  const { sql } = await import('./db.ts');
  const { like, rejectTrade } = await import('./likes.ts');
  const { deleteProfile } = await import('./delete.ts');
  const { ids: [a, b, c] } = await people(3);
  try {
    const [tb] = await closes(b, [`${b}-d1`]);
    const [ta] = await closes(a, [`${a}-d1`]);
    await like(a, tb.id); await rejectTrade(a, tb.id); await like(c, ta.id); await rejectTrade(c, ta.id); await like(c, tb.id);
    const user = (await sql`select id, snaptrade_user_id, snaptrade_secret_enc from users where id = ${a}`)[0] as never;
    await assert.rejects(deleteProfile(user, { deleteVendorUser: async () => { throw new Error('vendor down'); } } as never));
    const left = async (id: number) => (await sql`select (select count(*) from trade_likes where viewer_id = ${id} or trader_id = ${id})::int
      + (select count(*) from trade_exclusions where viewer_id = ${id} or trader_id = ${id})::int as n`)[0].n as number;
    assert.equal(await left(a), 0);
    assert.equal(await left(c), 1); // c's like on b stays
  } finally {
    await sql`delete from users where id in ${sql([a, b, c])}`;
  }
});

dbTest('O3/O4 signals as PR-5 will read them: like +3; a rejected trade −4 on its trader for 90 days then 0 (the trade stays hidden); an unfollow −1 for 90 days, never a hide, gone after a new follow', async () => {
  const { sql } = await import('./db.ts');
  const { like, rejectTrade, signalsFor, rejectedAmong } = await import('./likes.ts');
  const { follow, unfollow } = await import('./follows.ts');
  const { traderPreference } = await import('./discovery/weights.ts');
  const { ids: [v, t1, t2, t3] } = await people(4);
  try {
    const [a] = await closes(t1, [`${t1}-s1`]); const [b] = await closes(t2, [`${t2}-s1`]);
    await like(v, a.id); await rejectTrade(v, b.id); await follow(v, t3); await unfollow(v, t3);
    const now = Date.now();
    const pref = traderPreference(await signalsFor(v), now);
    assert.deepEqual([pref.get(t1), pref.get(t2), pref.get(t3)], [3, -4, -1]);
    const later = traderPreference(await signalsFor(v), now + 90 * 86_400_000 + 60_000);
    assert.deepEqual([later.get(t1), later.get(t2), later.get(t3)], [3, undefined, undefined]);
    await sql`update trade_exclusions set created_at = now() - interval '91 days' where viewer_id = ${v}`;
    assert.deepEqual([...await rejectedAmong(v, [b.sell])], [b.sell], 'a rejected trade stays hidden past 90 days');
    await follow(v, t3);
    assert.equal(traderPreference(await signalsFor(v), Date.now()).get(t3), undefined);
  } finally {
    await sql`delete from users where id in ${sql([v, t1, t2, t3])}`;
  }
});

dbTest('a card action keyed by its trade_key survives a rebuild between render and click (the row id it was rendered with is gone); same rules: never your own, a deleted trader refuses', async () => {
  const { sql } = await import('./db.ts');
  const { like, unlike, rejectTrade, undoRejectTrade, tradeKey } = await import('./likes.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const { tag, ids: [viewer, trader] } = await people(2);
  try {
    await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw) values
      (${trader}, 'demo', ${`${tag}-b`}, 'acct', 'KR', 'BUY', 1, 10, now() - interval '3 days', '{}'),
      (${trader}, 'demo', ${`${tag}-s`}, 'acct', 'KR', 'SELL', 1, 12, now() - interval '1 day', '{}')`;
    await rebuildTrades(trader);
    // Render: the card carries the row id (DOM) and tradeKey(sell_id) (app/feed-rows.tsx), as the page computed them.
    const [rendered] = await sql`select id::text, sell_id from closed_trades where user_id = ${trader}`;
    const key = tradeKey(rendered.sell_id as string);
    await rebuildTrades(trader); // e.g. the hourly sync, between render and the click
    const [now] = await sql`select id::text from closed_trades where user_id = ${trader}`;
    assert.notEqual(now.id, rendered.id);
    assert.equal(await like(viewer, rendered.id), false); // the old row id no longer names a close (the bug this fixes)
    assert.equal(await like(viewer, key), true); // the key does
    assert.equal((await sql`select 1 from trade_likes where viewer_id = ${viewer} and trade_key = ${key}`).length, 1);
    assert.equal(await unlike(viewer, { id: key }), true);
    assert.equal((await sql`select 1 from trade_likes where viewer_id = ${viewer}`).length, 0);
    assert.equal(await rejectTrade(viewer, key), true);
    assert.equal(await undoRejectTrade(viewer, key), true);
    assert.equal((await sql`select 1 from trade_exclusions where viewer_id = ${viewer}`).length, 0);
    assert.equal(await like(trader, key), false); // never your own, by key too
    for (const bad of [key.toUpperCase(), key.slice(1), `${key}0`, 'g'.repeat(64)]) assert.equal(await like(viewer, bad), false);
    await sql`update users set deleted_at = now() where id = ${trader}`;
    assert.equal(await like(viewer, key), false); // a trader being deleted refuses, as by id
  } finally {
    await sql`delete from users where id in ${sql([viewer, trader])}`;
  }
});

test('feed card actions send the trade_key, not the row id: the row and the menu carry it, the swipe and the hide bar pass it on', () => {
  const read = (f: string) => readFileSync(join(root, f), 'utf8');
  const rows = read('app/feed-rows.tsx'), menu = read('app/card-menu.tsx'), gestures = read('app/feed-gestures.tsx'), hides = read('app/feed-hides.tsx');
  // F-25: the key is the selected trade_key column (the same sha256 of the sell id), so the row code never reads sell_id.
  assert.match(rows, /data-key=\{t\.trade_key\}/);
  assert.match(rows, /<CardMenu id=\{row\.id\} tradeKey=\{t\.trade_key!\}/);
  for (const call of ['likeForm.bind(null, tradeKey', 'likeTrade(tradeKey)', 'unlikeTrade(tradeKey)', 'rejectTradeForm.bind(null, tradeKey', 'key: tradeKey']) assert.ok(menu.includes(call), call);
  assert.ok(gestures.includes('key: row.dataset.key'));
  assert.ok(hides.includes('rejectTradeAction(key)') && hides.includes('undoRejectTradeAction(key)'));
});
