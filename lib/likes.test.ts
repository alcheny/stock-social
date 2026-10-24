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
  assert.deepEqual(naming.sort(), ['lib/delete.ts', 'lib/likes.ts']);
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
  for (const v of Object.values(LIKES)) { const t = typeof v === 'function' ? (v as (...a: string[]) => string)('KQ', 'Jan') : v; assert.doesNotMatch(t, /\d|\bcount\b|people|others/i, t); }
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
    assert.equal(await like(viewer, t1.id), true);
    assert.equal(await like(viewer, t1.id), true); // idempotent
    assert.equal(await like(trader, t1.id), false); // never your own
    for (const bad of ['1; drop', '', 'x', -1, null, '9'.repeat(19)]) assert.equal(await like(viewer, bad), false);
    assert.equal(await rejectTrade(viewer, t1.id), true);
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

dbTest('heavy: a viewer with 10,000 likes lists them 50 a page, newest first, every like once; a page reads in well under 100 ms', async () => {
  const { sql } = await import('./db.ts');
  const { ownLikes, LIKES_PAGE } = await import('./likes.ts');
  const { ids: [viewer, trader] } = await people(2);
  try {
    const rows = await closes(trader, Array.from({ length: 10_000 }, (_, i) => `${trader}-h${i}`));
    const at = Date.now();
    // Some likes share a timestamp (the keyset's tie-break).
    for (let k = 0; k < rows.length; k += 2000) await sql`insert into trade_likes ${sql(rows.slice(k, k + 2000).map((r, j) => ({ viewer_id: viewer, trade_key: r.key, trader_id: trader, created_at: new Date(at - Math.floor((k + j) / 3) * 1000) })))}`;
    const seen = new Set<string>();
    let after: string | null | undefined, pages = 0, slowest = 0, prev = Infinity;
    do {
      const t0 = performance.now();
      const p = await ownLikes(viewer, after ?? undefined);
      slowest = Math.max(slowest, performance.now() - t0);
      assert.ok(p.rows.length <= LIKES_PAGE);
      for (const r of p.rows) { assert.ok(!seen.has(r.key)); seen.add(r.key); }
      const first = rows.findIndex((r) => r.key === p.rows[0]?.key);
      if (p.rows.length) { assert.ok(Math.floor(first / 3) >= Math.floor(prev / 3) || prev === Infinity); prev = first; }
      after = p.next; pages++;
    } while (after);
    assert.equal(seen.size, 10_000);
    assert.equal(pages, 200);
    console.log(`# 10,000 likes: ${pages} pages, slowest page ${slowest.toFixed(1)} ms`);
    assert.ok(slowest < 100, `${slowest} ms`);
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
