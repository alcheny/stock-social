// F-2 PR-4: likes (double tap +3, private) and the trade reject (O1: −4 on the trade, −1 on its trader), against the
// database. `closed_trades.trade_key` is the sha256 of the sell id (UTF-8), stable across rebuilds; likes and rejects
// are keyed by it, so they re-attach after a rebuild. Private to the viewer; deletion removes them the same day.
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
const DAY = 86_400_000;
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

const root = fileURLToPath(new URL('..', import.meta.url));
const sources = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(root, dir, f);
  return statSync(p).isDirectory() ? sources(relative(root, p)) : /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) ? [relative(root, p)] : [];
});

test('likes and rejects are private: only lib/likes.ts, lib/delete.ts and the purge name the tables, every read is keyed by the viewer, nothing counts them; no share image, pane chart or sitemap imports them; no event table', () => {
  const tables = /\b(trade_likes|trade_rejects)\b/;
  const naming = [...sources('app'), ...sources('lib')].filter((f) => [...readFileSync(join(root, f), 'utf8').matchAll(/sql`[^`]*`|tx`[^`]*`|conn`[^`]*`/g)].some((m) => tables.test(m[0])));
  assert.deepEqual(naming.sort(), ['lib/delete.ts', 'lib/discovery/purge.ts', 'lib/likes.ts']);
  const statements = [...readFileSync(join(root, 'lib/likes.ts'), 'utf8').matchAll(/(?:sql|tx)`([^`]*)`/g)].map((m) => m[1]).filter((q) => tables.test(q));
  assert.ok(statements.length >= 6);
  for (const q of statements) {
    assert.doesNotMatch(q, /count\s*\(/i, q);
    if (/^\s*(select|update|delete)/i.test(q) || /\bfrom (trade_likes|trade_rejects)\b/.test(q)) assert.match(q, /viewer_id = \$\{viewer\}/, q);
  }
  for (const f of sources('app').filter((f) => /opengraph-image|story|pane-chart|sitemap|robots/.test(f))) assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /from ['"][^'"]*(likes|card-gestures)/, f);
  const created = [...readFileSync(join(root, 'db/schema.sql'), 'utf8').matchAll(/create table if not exists (\w+)/gi)].map((m) => m[1]);
  assert.deepEqual(created.filter((t) => /event/i.test(t)), ['funnel_events'], 'no discovery event table before PR-5 (F-1\'s sign-up funnel only)');
});

async function people(n: number, closes = 5, tag = `l${Math.random().toString(36).slice(2, 8)}`) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const ids: number[] = [];
  for (let t = 0; t < n; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const at = Date.now() - 600_000;
  if (closes) await sql`insert into closed_trades ${sql(ids.slice(1).flatMap((u, t) => Array.from({ length: closes }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `L${(t * 5 + i) % 43}`, opened_at: new Date(at - DAY),
    closed_at: new Date(at - (t * 5 + i) * 1000), return_pct: ((t + i) % 7 - 3) / 10 || 0.05, holding_days: 1, verified: true,
  }))))}`;
  return { sql, tag, ids, viewer: ids[0], traders: ids.slice(1), handle: (i: number) => `${tag}${i}`, remove: () => sql`delete from users where id in ${sql(ids)}` };
}

dbTest('trade_key: the sha256 of the sell id\'s UTF-8 bytes for backslashes, \\x, octal escapes, a trailing backslash and non-ASCII; no input errors; lib/likes.ts#tradeKey agrees', async () => {
  const { tradeKey } = await import('./likes.ts');
  const p = await people(2, 0);
  const ids = ['a\\b', '\\x41', '\\\\', '\\001', 'trail\\', 'héllo ✓ 株', `${p.tag}-plain`].map((s) => `${p.tag}${s}`);
  try {
    await p.sql`insert into closed_trades ${p.sql(ids.map((sell_id) => ({ user_id: p.traders[0], sell_id, account_id: 'a', symbol: 'K', opened_at: new Date(), closed_at: new Date(), return_pct: 0.1, holding_days: 1, verified: true })))}`;
    const rows = await p.sql`select sell_id, trade_key from closed_trades where user_id = ${p.traders[0]}`;
    assert.equal(rows.length, ids.length);
    for (const r of rows) { assert.equal(r.trade_key, sha(r.sell_id as string), r.sell_id as string); assert.equal(tradeKey(r.sell_id as string), r.trade_key); }
  } finally {
    await p.remove();
  }
});

dbTest('like and unlike: idempotent, one row each, private; never your own trade or an unknown key; a like survives a rebuild that drops its trade (kept, ignored on read) and re-attaches when the trade returns', async () => {
  const L = await import('./likes.ts');
  const p = await people(3);
  const [a, b] = p.traders;
  try {
    const [t1, t2] = (await p.sql`select sell_id, trade_key, symbol, closed_at from closed_trades where user_id = ${a} order by closed_at desc limit 2`);
    assert.equal(await L.like(p.viewer, t1.trade_key as string), true);
    assert.equal(await L.like(p.viewer, t1.trade_key as string), true); // idempotent
    assert.equal(await L.like(p.viewer, t2.trade_key as string), true);
    assert.equal(await L.like(a, t1.trade_key as string), false, 'never your own trade');
    assert.equal(await L.like(p.viewer, 'f'.repeat(64)), false, 'no such trade');
    assert.equal((await p.sql`select count(*)::int as n from trade_likes where viewer_id = ${p.viewer}`)[0].n, 2);
    assert.deepEqual([...await L.likedAmong(p.viewer, [t1.trade_key, t2.trade_key, 'x'] as string[])].sort(), [t1.trade_key, t2.trade_key].sort());
    assert.deepEqual([...await L.likedAmong(b, [t1.trade_key] as string[])], [], 'another viewer sees none of them');
    const own = await L.ownLikes(p.viewer);
    assert.deepEqual(own.map((x) => x.sellId), [t2.sell_id, t1.sell_id], 'newest like first');
    assert.equal(own[0].handle, p.handle(1));
    // A rebuild deletes and re-inserts the trader's rows: the like is kept, ignored while its trade is gone, and back after.
    const saved = await p.sql`select user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified from closed_trades where user_id = ${a}`;
    await p.sql`delete from closed_trades where user_id = ${a}`;
    assert.equal((await L.ownLikes(p.viewer)).length, 0);
    assert.equal((await p.sql`select count(*)::int as n from trade_likes where viewer_id = ${p.viewer}`)[0].n, 2);
    await p.sql`insert into closed_trades ${p.sql(saved.map((r) => ({ ...r })))}`;
    assert.deepEqual((await L.ownLikes(p.viewer)).map((x) => x.sellId), [t2.sell_id, t1.sell_id]);
    await L.unlike(p.viewer, t1.trade_key as string);
    await L.unlike(p.viewer, t1.trade_key as string);
    assert.deepEqual((await L.ownLikes(p.viewer)).map((x) => x.sellId), [t2.sell_id]);
  } finally {
    await p.remove();
  }
});

dbTest('a rejected trade: gone from the viewer\'s feed for 90 days (gone at 89 d 23 h 59 m, back at 90 d + 1 s), dropped in place between pages, the trader\'s other cards stay; Undo brings it back; signed out and other viewers see the whole list; never your own trade', async () => {
  const L = await import('./likes.ts');
  const { loadFeedPage } = await import('./feed.ts');
  const p = await people(41);
  const ids = p.traders;
  const keys = (pg: { cards: { sell_id: string }[] }) => pg.cards.map((c) => c.sell_id);
  const all = async (viewer: number | undefined, now: number) => { const out: string[] = []; let q = await loadFeedPage(undefined, { ids, viewer, now }); for (;;) { out.push(...keys(q)); if (!q.next) return out; q = await loadFeedPage(q.next, { ids, viewer, now }); } };
  try {
    const base1 = await loadFeedPage(undefined, { ids });
    const base2 = await loadFeedPage(base1.next!, { ids });
    const mine1 = await loadFeedPage(undefined, { ids, viewer: p.viewer });
    assert.deepEqual(keys(mine1), keys(base1));
    const gone = base2.cards[3];
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(await L.rejectTrade(p.viewer, gone.trade_key), true);
    assert.equal(await L.rejectTrade(gone.user_id, gone.trade_key), false, 'never your own');
    const mine2 = await loadFeedPage(mine1.next!, { ids, viewer: p.viewer });
    assert.deepEqual(keys(mine2), keys(base2).filter((k) => k !== gone.sell_id), 'dropped in place, nothing else moves');
    assert.ok(mine2.cards.some((c) => c.user_id === gone.user_id) || !base2.cards.some((c) => c.user_id === gone.user_id && c.sell_id !== gone.sell_id), 'the trader\'s other cards stay');
    assert.deepEqual(keys(await loadFeedPage(base1.next!, { ids })), keys(base2));
    assert.deepEqual(keys(await loadFeedPage(base1.next!, { ids, viewer: p.traders[5] })), keys(base2));
    await L.undoReject(p.viewer, gone.trade_key);
    assert.deepEqual(keys(await loadFeedPage(mine1.next!, { ids, viewer: p.viewer })), keys(base2));
    await L.rejectTrade(p.viewer, gone.trade_key);
    const fresh = await all(p.viewer, Date.now() + 1000);
    assert.ok(!fresh.includes(gone.sell_id));
    assert.ok((await all(undefined, Date.now() + 1000)).includes(gone.sell_id));
    const [r] = await p.sql`select until - created_at as span, trader_id from trade_rejects where viewer_id = ${p.viewer}`;
    assert.match(String(r.span), /^90 days/);
    assert.equal(r.trader_id, gone.user_id);
    await p.sql`update trade_rejects set created_at = now() - interval '89 days 23 hours 59 minutes', until = now() + interval '1 minute' where viewer_id = ${p.viewer}`;
    assert.ok(!(await all(p.viewer, Date.now() + 3000)).includes(gone.sell_id), 'gone at 89 d 23 h 59 m');
    await p.sql`update trade_rejects set created_at = now() - interval '90 days 1 second', until = now() - interval '1 second' where viewer_id = ${p.viewer}`;
    assert.ok((await all(p.viewer, Date.now() + 4000)).includes(gone.sell_id), 'back at 90 d + 1 s');
  } finally {
    await p.remove();
  }
});

dbTest('deletion: as viewer and as trader, zero rows left in trade_likes and trade_rejects; a failed vendor call still leaves zero; purge deletes rejects ended over a day ago only', async () => {
  const L = await import('./likes.ts');
  const { deleteProfile } = await import('./delete.ts');
  const { purgeDiscovery } = await import('./discovery/purge.ts');
  const p = await people(4);
  const [a, b, c] = p.traders;
  const key = async (u: number, i = 0) => (await p.sql`select trade_key from closed_trades where user_id = ${u} order by sell_id limit 1 offset ${i}`)[0].trade_key as string;
  const rows = (id: number) => p.sql`select (select count(*) from trade_likes where viewer_id = ${id} or trader_id = ${id})::int + (select count(*) from trade_rejects where viewer_id = ${id} or trader_id = ${id})::int as n`.then((r) => r[0].n as number);
  try {
    await L.like(p.viewer, await key(a)); await L.rejectTrade(p.viewer, await key(b)); await L.like(b, await key(a));
    await L.rejectTrade(c, await key(a, 1));
    // Purge: a reject ended over a day ago goes; one ended 23 h 59 m ago and a running one stay.
    await L.rejectTrade(c, await key(b, 1)); await L.rejectTrade(c, await key(b, 2));
    await p.sql`update trade_rejects set until = now() - interval '1 day 1 second' where viewer_id = ${c} and trade_key = ${await key(b, 1)}`;
    await p.sql`update trade_rejects set until = now() - interval '23 hours 59 minutes' where viewer_id = ${c} and trade_key = ${await key(b, 2)}`;
    assert.equal((await purgeDiscovery()).done, true);
    assert.equal((await p.sql`select count(*)::int as n from trade_rejects where viewer_id = ${c}`)[0].n, 2);
    assert.equal(await rows(p.viewer), 2);
    const u = { id: p.viewer, handle: p.handle(0), snaptrade_user_id: 'v', snaptrade_secret_enc: 'e' };
    await assert.rejects(deleteProfile(u, { deleteVendorUser: async () => { throw new Error('vendor down'); } }));
    assert.equal(await rows(p.viewer), 0, 'the first step ran before the vendor call');
    await deleteProfile(u, { deleteVendorUser: async () => {} });
    await p.sql`delete from users where id = ${a}`;
    assert.equal(await rows(a), 0, 'as trader: the cascade');
  } finally {
    await p.remove();
    await p.sql`delete from handle_reservations where handle = ${p.handle(0)}`;
  }
});
