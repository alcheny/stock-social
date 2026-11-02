// F-25 (docs/features/F-25-one-link-rule-for-trade-rows.md): trade URLs by trade_key, through the database. Views count
// by key only; the legacy sell-id lookup applies the page's visibility rule; a URL survives rebuildTrades; the reflection
// form's key resolves only to my own close; the pane carries keys for its 5 latest rows (attached by id, ties included)
// and the feed issues the same statements. Every fixture is this file's own (tagged handles), deleted at the end.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import postgres from 'postgres';

// The pane route imports next/server (an extensionless package path under Node's ESM resolver).
registerHooks({ resolve: (spec, ctx, next) => next(/^next\/(server|navigation|headers|cache)$/.test(spec) ? `${spec}.js` : spec.startsWith('@/') ? new URL(spec.slice(2), new URL('..', import.meta.url)).href : spec, ctx) });

const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
// The statement-count case reads the pool lib/db.ts reuses (as lib/feed.signed-out.test.ts does).
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q) => { log.push(String(q)); } });
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const tagOf = () => `f25${randomBytes(4).toString('hex').slice(0, 7)}`; // fixture tags only
async function user(handle: string) {
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  return createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle });
}
async function closes(userId: number, rows: { sell: string; symbol?: string; r: number; at: number }[]) {
  const { sql } = await import('./db.ts');
  await sql`insert into closed_trades ${sql(rows.map((x) => ({ user_id: userId, sell_id: x.sell, account_id: 'a', symbol: x.symbol ?? 'FTV', opened_at: new Date(x.at - 3 * 86_400_000),
    closed_at: new Date(x.at), return_pct: x.r, holding_days: 3, verified: true })))}`;
}

dbTest('F-25: trade_key equals sha256 of the sell id, backslashes and non-ASCII included (the JS key and the column agree)', async () => {
  const { sql } = await import('./db.ts');
  const tag = tagOf();
  const u = await user(`${tag}k`);
  try {
    const sells = [`${tag}-plain`, `${tag}-back\\slash\\\\x`, `${tag}-ünï-✓`, `${tag}-a/b c%2F`];
    await closes(u.id, sells.map((sell, i) => ({ sell, r: 0.01, at: Date.now() - (i + 1) * 3_600_000 })));
    const rows = await sql`select sell_id, trade_key from closed_trades where user_id = ${u.id}`;
    assert.equal(rows.length, 4);
    for (const r of rows) assert.equal(r.trade_key, sha(r.sell_id as string), r.sell_id as string);
  } finally { await sql`delete from users where id = ${u.id}`; }
});

dbTest('F-25: a view of /u/<h>/trade/<trade_key> counts for the trader; one of /u/<h>/trade/<sell_id> counts none', async () => {
  const { sql } = await import('./db.ts');
  const { viewedUserId, surfaceOf } = await import('./views.ts');
  const tag = tagOf();
  const u = await user(`${tag}v`);
  try {
    await closes(u.id, [{ sell: `${tag}-v1`, r: -0.04, at: Date.now() - 86_400_000 }]);
    const key = sha(`${tag}-v1`);
    const byKey = surfaceOf(`/u/${u.handle}/trade/${key}`)!;
    const bySell = surfaceOf(`/u/${u.handle}/trade/${tag}-v1`)!;
    assert.equal(await viewedUserId(byKey), u.id);
    assert.equal(await viewedUserId(bySell), null);
    // Another handle's key counts nothing.
    const other = await user(`${tag}o`);
    try { assert.equal(await viewedUserId({ ...byKey, handle: other.handle }), null); } finally { await sql`delete from users where id = ${other.id}`; }
  } finally { await sql`delete from users where id = ${u.id}`; }
});

dbTest('F-25: the legacy lookup resolves only a visible trader\'s own sell id; unknown, another handle\'s, a deleted user and a hidden or removed filer get null', async () => {
  const { sql } = await import('./db.ts');
  const { legacyTradeKey, loadTradeShareByKey } = await import('./trade-share-load.ts');
  const tag = tagOf();
  const a = await user(`${tag}a`), b = await user(`${tag}b`), gone = await user(`${tag}d`);
  const filers: number[] = [];
  const filer = async (h: string, o: { hidden?: boolean; removed?: boolean }) => {
    const [f] = await sql`insert into public_filers (source, filer_key, demo, hidden_at, removed_at) values ('insider_reports', ${`${tag}-${h}`}, true, ${o.hidden ? new Date() : null}, ${o.removed ? new Date() : null}) returning id`;
    filers.push(f.id as number);
    const u = await user(`${tag}${h}`);
    await sql`update users set public_filer_id = ${f.id} where id = ${u.id}`;
    await closes(u.id, [{ sell: `${tag}-${h}-1`, r: 0.02, at: Date.now() - 86_400_000 }]);
    return u;
  };
  const hidden = await filer('h', { hidden: true }), removed = await filer('r', { removed: true });
  try {
    await closes(a.id, [{ sell: `${tag}-a1`, r: -0.07, at: Date.now() - 86_400_000 }]);
    await closes(b.id, [{ sell: `${tag}-b1`, r: 0.03, at: Date.now() - 86_400_000 }]);
    await closes(gone.id, [{ sell: `${tag}-d1`, r: 0.03, at: Date.now() - 86_400_000 }]);
    await sql`update users set deleted_at = now() where id = ${gone.id}`;
    assert.equal(await legacyTradeKey(a.handle, `${tag}-a1`), sha(`${tag}-a1`));
    assert.equal(await legacyTradeKey(a.handle, `${tag}-b1`), null); // another handle's sell id
    assert.equal(await legacyTradeKey(a.handle, `${tag}-nope`), null);
    assert.equal(await legacyTradeKey(a.handle, sha(`${tag}-a1`)), null); // a key is not a sell id
    assert.equal(await legacyTradeKey(gone.handle, `${tag}-d1`), null);
    assert.equal(await legacyTradeKey(hidden.handle, `${tag}-h-1`), null);
    assert.equal(await legacyTradeKey(removed.handle, `${tag}-r-1`), null);
    assert.equal(await legacyTradeKey('NOT A HANDLE', `${tag}-a1`), null);
    assert.equal(await legacyTradeKey(a.handle, 'x\0'), null);
    // The page loads by key only, under the same rule.
    const t = await loadTradeShareByKey(a.handle, sha(`${tag}-a1`));
    assert.equal(t?.symbol, 'FTV');
    assert.equal(t?.tradeKey, sha(`${tag}-a1`));
    assert.ok(!('sellId' in (t ?? {})), 'the payload carries no sell id');
    assert.equal(await loadTradeShareByKey(a.handle, `${tag}-a1`), null);
    assert.equal(await loadTradeShareByKey(b.handle, sha(`${tag}-a1`)), null);
    assert.equal(await loadTradeShareByKey(hidden.handle, sha(`${tag}-h-1`)), null);
    assert.equal(await loadTradeShareByKey(gone.handle, sha(`${tag}-d1`)), null);
  } finally {
    await sql`delete from users where id in ${sql([a.id, b.id, gone.id, hidden.id, removed.id])}`;
    await sql`delete from public_filers where id in ${sql(filers)}`;
  }
});

dbTest('F-25: every trade-page key captured before rebuildTrades still loads the same symbol and figure after it', async () => {
  const { sql } = await import('./db.ts');
  const { insertActivities, rebuildTrades } = await import('./sync.ts');
  const { loadTradeShareByKey } = await import('./trade-share-load.ts');
  const tag = tagOf();
  const u = await user(`${tag}r`);
  const day = (n: number) => new Date(Date.UTC(2025, 0, n));
  const act = (id: string, side: 'BUY' | 'SELL', units: number, price: number, n: number, symbol: string) => ({
    externalId: `${tag}-${id}`, accountId: `${tag}-acc`, symbol, side, units, price, fee: 0, executedAt: day(n), verified: true, raw: {},
  });
  try {
    await insertActivities(u.id, 'snaptrade', [act('b1', 'BUY', 10, 100, 1, 'AAA'), act('s1', 'SELL', 10, 90, 5, 'AAA'), act('b2', 'BUY', 5, 20, 2, 'BBB'), act('s2', 'SELL', 5, 25, 9, 'BBB')]);
    await rebuildTrades(u.id);
    const before = await sql`select id, trade_key, symbol, return_pct from closed_trades where user_id = ${u.id} order by trade_key`;
    assert.equal(before.length, 2);
    const shown = new Map<string, { symbol: string; ret: number }>();
    for (const r of before) { const t = (await loadTradeShareByKey(u.handle, r.trade_key as string))!; shown.set(r.trade_key as string, { symbol: t.symbol, ret: t.returnPct }); }
    await rebuildTrades(u.id);
    const after = await sql`select id, trade_key from closed_trades where user_id = ${u.id} order by trade_key`;
    assert.notDeepEqual(after.map((r) => r.id), before.map((r) => r.id), 'the rebuild renumbers rows');
    for (const [key, v] of shown) {
      const t = await loadTradeShareByKey(u.handle, key);
      assert.deepEqual({ symbol: t?.symbol, ret: t?.returnPct }, v, key);
    }
    assert.ok([...shown.values()].some((v) => v.ret < 0), 'a loss is among them');
  } finally { await sql`delete from users where id = ${u.id}`; }
});

dbTest('F-25: the reflection form key resolves to my own close\'s sell id only (another user\'s key, junk or none: null)', async () => {
  const { sql } = await import('./db.ts');
  const { ownSellIdForKey } = await import('./reflection-target.ts');
  const tag = tagOf();
  const me = await user(`${tag}m`), other = await user(`${tag}x`);
  try {
    await closes(me.id, [{ sell: `${tag}-m1`, r: 0.05, at: Date.now() - 86_400_000 }]);
    await closes(other.id, [{ sell: `${tag}-x1`, r: 0.05, at: Date.now() - 86_400_000 }]);
    assert.equal(await ownSellIdForKey(me.id, sha(`${tag}-m1`)), `${tag}-m1`);
    assert.equal(await ownSellIdForKey(me.id, sha(`${tag}-x1`)), null);
    assert.equal(await ownSellIdForKey(other.id, sha(`${tag}-m1`)), null);
    for (const junk of [`${tag}-m1`, '', null, 7, sha(`${tag}-m1`).toUpperCase()]) assert.equal(await ownSellIdForKey(me.id, junk), null, String(junk));
    assert.equal(await ownSellIdForKey(null, sha(`${tag}-m1`)), null);
    // Saving and clearing through the stored table, keyed by the resolved sell id (the action's own SQL).
    const sell = (await ownSellIdForKey(me.id, sha(`${tag}-m1`)))!;
    await sql`insert into trade_reflections (user_id, sell_id, reason) values (${me.id}, ${sell}, 'planned') on conflict (user_id, sell_id) do update set reason = excluded.reason`;
    assert.equal((await sql`select reason from trade_reflections where user_id = ${me.id}`)[0]?.reason, 'planned');
    await sql`delete from trade_reflections where user_id = ${me.id} and sell_id = ${sell}`;
    assert.equal((await sql`select 1 from trade_reflections where user_id = ${me.id}`).length, 0);
  } finally { await sql`delete from users where id in ${sql([me.id, other.id])}`; }
});

dbTest('F-25: records() keys exactly the pane\'s 5 latest rows by id, a closed_at tie at the 5th and 6th included; the pane route carries at most 5', async () => {
  const { sql } = await import('./db.ts');
  const { records } = await import('./feed.ts');
  const { paneSummary } = await import('./pane.ts');
  const tag = tagOf();
  const u = await user(`${tag}p`);
  try {
    const t0 = Date.now() - 30 * 86_400_000;
    // 9 closes; the 5th and 6th newest share a closed_at.
    const ats = [9, 8, 7, 6, 5, 5, 4, 3, 2].map((h) => t0 + h * 3_600_000);
    await closes(u.id, ats.map((at, i) => ({ sell: `${tag}-p${i}`, r: i % 2 ? -0.02 : 0.03, at })));
    const rows = await records([u.id]);
    assert.equal(rows.length, 9);
    const keyed = rows.filter((r) => r.tradeKey);
    assert.equal(keyed.length, 5);
    const recent = paneSummary(rows).recent;
    assert.deepEqual(keyed.map((r) => r.id).sort(), recent.map((r) => r.id).sort());
    const ids = await sql`select id, trade_key from closed_trades where user_id = ${u.id}`;
    const keyOf = new Map(ids.map((r) => [String(r.id), r.trade_key as string]));
    for (const r of keyed) assert.equal(r.tradeKey, keyOf.get(r.id));
    // The lazy pane's JSON: keys on at most 5 rows, and no sell id anywhere in it.
    const { GET } = await import('../app/u/[handle]/pane/route.ts');
    // F-23: the pane JSON is the ?v=2 model; its 5 recent rows are the only rows it lists, each with its key.
    const res = await GET(new Request(`http://x.invalid/u/${u.handle}/pane?v=2`), { params: Promise.resolve({ handle: u.handle }) });
    const text = await res.text();
    const body = JSON.parse(text) as { model: { recent: { id: string; tradeKey?: string }[] } };
    assert.equal(body.model.recent.length, 5);
    assert.deepEqual(body.model.recent.map((r) => r.tradeKey), body.model.recent.map((r) => keyOf.get(r.id)));
    assert.equal((text.match(/[0-9a-f]{64}/g) ?? []).length, 5, 'keys for at most 5 rows');
    assert.ok(!text.includes(tag + '-p'), 'no sell id in the pane JSON');
  } finally { await sql`delete from users where id = ${u.id}`; }
});

dbTest('F-25: the feed page issues the same SQL statements as before for a one-trader page and a 30-card page of more than 8 traders', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage } = await import('./feed.ts');
  const tag = tagOf();
  const ids: number[] = [];
  for (let t = 0; t < 31; t++) ids.push((await user(`${tag}${t}`)).id);
  const solo = (await user(`${tag}s`)).id; // one recent close and four older ones: a page of exactly one card
  ids.push(solo);
  const at = Date.now() - 600_000;
  await sql`insert into closed_trades ${sql(ids.flatMap((u, t) => Array.from({ length: 5 }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `F${(t * 5 + i) % 41}`, opened_at: new Date(at - 86_400_000),
    closed_at: new Date(at - (t * 5 + i) * 1000), return_pct: ((t + i) % 7 - 3) / 10 || 0.05, holding_days: 1, verified: true,
  }))))}`;
  await sql`delete from closed_trades where user_id = ${solo}`; // only this file's own trader
  await closes(solo, Array.from({ length: 5 }, (_, i) => ({ sell: `${tag}-s${i}`, r: i ? 0.02 : -0.03, at: i ? at - 45 * 86_400_000 - i * 1000 : at })));
  try {
    // A fresh `now` per call is a fresh list (its cache key holds asOf), so each count is a whole page read.
    let clock = Date.now();
    // The first read of a trader set warms the per-trader weight cache; the second is the steady page read that is counted.
    const count = async (who: number[]) => { await loadFeedPage(undefined, { ids: who, now: (clock += 1000) }); log.length = 0; const p = await loadFeedPage(undefined, { ids: who, now: (clock += 1000) }); return { n: log.length, cards: p.cards }; };
    const one = await count([solo]);
    const thirty = await count(ids.filter((id) => id !== solo));
    assert.ok(one.cards.length >= 1 && one.cards.length <= 2, String(one.cards.length)); // one trader: the page's per-trader cap
    assert.equal(thirty.cards.length, 30);
    // records() reads in two halves above 8 traders (two statements), so 30 cards read one more than 1 card; the
    // F-25 keys add no statement to either (main: the same counts, docs/features/logs/F-25/committee-2026-11-01.md).
    // Measured on origin/main (63f48f4, before F-25) with this same fixture and warm-up: 17 statements for the one-trader
    // page and 13 for the 30-card page (more than 8 traders, so records() reads in two halves). F-25 adds a column to
    // two existing statements and no statement.
    // F-21 (committee decision 9: exactly one new query per page): the exclusion counters' one statement, on both pages.
    assert.deepEqual({ one: one.n, thirty: thirty.n }, { one: 17 + 1, thirty: 13 + 1 });
    assert.equal(log.filter((q) => /excluded_future_sells/.test(q)).length, 1, 'F-21: the one exclusion statement');
    for (const c of thirty.cards) assert.equal(c.trade_key, sha(c.sell_id));
  } finally { await sql`delete from users where id in ${sql(ids)}`; }
});
