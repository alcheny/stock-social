// F-7 public-record traders on feed-side surfaces (docs/features/logs/F-7/plan.md §2 item 4, Round 4 items 3-4, Round 5
// item 7; plan-round2-engineer.md §4.3 AC 9, 20, 21, 22, 31). Fictional filers (`pf_*`) inserted directly and deleted.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC_FEED_DELAY_DAYS } from './public-gate.ts';
import { sectionCandidates } from './discovery/section.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const DAY = 86_400_000;
const tag = Math.random().toString(36).slice(2, 7);
const H = { a: `pf_a${tag}`, b: `pf_b${tag}`, l: `pf_l${tag}`, hid: `pf_h${tag}`, t: `f7t${tag}` };
const RS = [0.12, -0.08, 0.2, -0.15, 0.06];
const ids: Record<string, number> = {};

before(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  await sql.unsafe(src('../db/schema.sql')).simple();
  const { insertFiler, deleteFilers } = await import('../e2e/f7-fixture.ts');
  await deleteFilers(sql, [H.a, H.b, H.l, H.hid]);
  const now = Date.now();
  const closes = (rs: number[], sym: string) => rs.map((r, i) => ({ symbol: `${sym}${i}`, r, daysAgo: 1 + i * 0.5, hold: 3, feedAfterDaysAgo: 0.5 }));
  ids.a = (await insertFiler(sql, { handle: H.a, name: 'Fictional Filer A', closes: closes(RS, 'ZQA') }, now)).userId;
  // 4 ready closes and a 5th still inside the 30-day floor: not eligible (both eligibility branches).
  ids.b = (await insertFiler(sql, { handle: H.b, name: 'Fictional Filer B', closes: [...closes(RS.slice(0, 4), 'ZQB'), { symbol: 'ZQB9', r: 0.3, daysAgo: 0.2, feedAfterDaysAgo: -20 }] }, now)).userId;
  ids.l = (await insertFiler(sql, { handle: H.l, name: 'Fictional Filer L', closes: closes(RS.map((r) => -Math.abs(r)), 'ZQL') }, now)).userId;
  ids.hid = (await insertFiler(sql, { handle: H.hid, name: 'Fictional Filer H', hidden: true, closes: closes(RS, 'ZQH') }, now)).userId;
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  ids.t = (await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: H.t })).id;
  // A connected trader with the filer's exact closes: same score, same weight.
  await sql`insert into closed_trades ${sql(RS.map((r, i) => ({
    user_id: ids.t, sell_id: `${H.t}-${i}`, account_id: 'a', symbol: `ZQA${i}`, opened_at: new Date(now - (1 + i * 0.5 + 3) * DAY),
    closed_at: new Date(now - (1 + i * 0.5) * DAY), return_pct: r, holding_days: 3, verified: true,
  })))}`;
});
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  const { deleteFilers } = await import('../e2e/f7-fixture.ts');
  await deleteFilers(sql, [H.a, H.b, H.l, H.hid]);
  await sql`delete from users where handle = ${H.t}`;
  await sql.end({ timeout: 1 });
});

const withEnv = async <T>(v: string | undefined, fn: () => Promise<T>): Promise<T> => {
  const old = process.env.PUBLIC_TRADERS;
  if (v === undefined) delete process.env.PUBLIC_TRADERS; else process.env.PUBLIC_TRADERS = v;
  try { return await fn(); } finally { if (old === undefined) delete process.env.PUBLIC_TRADERS; else process.env.PUBLIC_TRADERS = old; }
};
const all = () => [ids.a, ids.b, ids.l, ids.hid, ids.t];

test('AC 21: the feed floor is pinned at 30 days', () => assert.equal(PUBLIC_FEED_DELAY_DAYS, 30));

dbTest('AC 20: an eligible filer\'s closes join the feed, never verified, with its public state; equal closes score like a connected trader\'s', async () => {
  const { feedCandidates, clearFeedCache } = await import('./feed.ts');
  const { recordStates } = await import('./connections.ts');
  clearFeedCache();
  const c = await feedCandidates({ ids: all() });
  const of = (u: number) => c.filter((t) => t.user_id === u);
  assert.equal(of(ids.a).length, 5);
  assert.ok(of(ids.a).every((t) => t.verified === false));
  const score = (u: number) => of(u).map((t) => Number(t.score)).sort().join(',');
  assert.equal(score(ids.a), score(ids.t)); // same score as a connected trader with the same closes
  assert.equal(score(ids.l), score(ids.t)); // all losses rank like equal gains
  assert.equal((await recordStates([ids.a])).get(ids.a)!.state, 'public_demo');
  // AC 9 / C13: a hidden filer is in no feed read.
  assert.equal(of(ids.hid).length, 0);
});

dbTest('AC 21 (Round 5 item 7): a filer whose 5th close is inside the floor is not eligible; past the floor it is', async () => {
  const { sql } = await import('./db.ts');
  const { feedCandidates, clearFeedCache } = await import('./feed.ts');
  clearFeedCache();
  assert.equal((await feedCandidates({ ids: all() })).filter((t) => t.user_id === ids.b).length, 0);
  assert.equal((await feedCandidates({ ids: all(), asOf: new Date() })).filter((t) => t.user_id === ids.b).length, 0);
  await sql`update closed_trades set feed_after = now() - interval '1 minute' where sell_id = ${`pub:${H.b}:4`}`;
  try {
    clearFeedCache();
    const c = await feedCandidates({ ids: all() });
    assert.equal(c.filter((t) => t.user_id === ids.b).length, 5);
  } finally {
    await sql`update closed_trades set feed_after = now() + interval '20 days' where sell_id = ${`pub:${H.b}:4`}`;
  }
});

dbTest('AC 21 (Round 5 item 7): an embargoed close added to an in-feed filer leaves the list, order, weights and section pool unchanged', async () => {
  const { sql } = await import('./db.ts');
  const { feedList, clearFeedCache } = await import('./feed.ts');
  const asOf = new Date(), day = asOf.toISOString().slice(0, 10);
  const shape = (r: Awaited<ReturnType<typeof feedList>>) => ({
    list: r.list.map((t) => `${t.sell_id}:${t.explore}`), ranked: r.ranked.map((t) => t.sell_id),
    pool: r.pool.map((p) => `${p.trader}:${p.weight}:${p.n}:${p.hold}:${p.verified}`),
  });
  clearFeedCache();
  const before = shape(await feedList({ asOf, day, ids: all() }));
  assert.ok(before.list.some((k) => k.startsWith(`pub:${H.a}:`)));
  // Closed an hour before asOf (so the score would rank it near the top), its filing floor 29 days away.
  await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, filing_url, feed_after)
    values (${ids.a}, ${`pub:${H.a}:late`}, 'public', 'ZQAX', ${new Date(asOf.getTime() - 2 * DAY)}, ${new Date(asOf.getTime() - 3_600_000)}, 0.9, 1, false,
      'https://filings.example/late', now() + interval '29 days')`;
  try {
    clearFeedCache();
    assert.deepEqual(shape(await feedList({ asOf, day, ids: all() })), before);
    clearFeedCache('lists'); // warm weights, a cold list: still the same
    assert.deepEqual(shape(await feedList({ asOf, day, ids: all() })), before);
  } finally {
    await sql`delete from closed_trades where sell_id = ${`pub:${H.a}:late`}`;
  }
});

dbTest('AC 9: with the switch off no filer reaches the feed, the section pool or a page; connected traders are unaffected', async () => {
  const { feedCandidates, feedList, loadFeedPage, clearFeedCache } = await import('./feed.ts');
  await withEnv('0', async () => {
    clearFeedCache();
    const c = await feedCandidates({ ids: all() });
    assert.ok(c.some((t) => t.user_id === ids.t));
    assert.ok(!c.some((t) => [ids.a, ids.b, ids.l, ids.hid].includes(t.user_id)));
    const asOf = new Date();
    const r = await feedList({ asOf, day: asOf.toISOString().slice(0, 10), ids: all() });
    assert.ok(!r.pool.some((p) => p.trader !== ids.t));
    const page = await loadFeedPage(undefined, { ids: all() });
    assert.ok(page.cards.every((t) => t.user_id === ids.t));
  });
  clearFeedCache();
});

dbTest('AC 20 / AC 31: a filer card on a feed page carries its public state; its facts are never verified, so it never takes the new-record slot', async () => {
  const { loadFeedPage, feedList, clearFeedCache } = await import('./feed.ts');
  clearFeedCache();
  const page = await loadFeedPage(undefined, { ids: all() });
  const card = page.cards.find((t) => t.user_id === ids.a)!;
  assert.ok(card, 'the filer has a card');
  assert.equal(page.records.get(ids.a)!.state, 'public_demo');
  const asOf = new Date();
  const { pool } = await feedList({ asOf, day: asOf.toISOString().slice(0, 10), ids: all() });
  const fa = pool.find((p) => p.trader === ids.a)!;
  assert.equal(fa.verified, false);
  // The slot: a weight-0 record never carded goes first only if every close is verified.
  const zero = [{ ...fa, weight: 0, n: 5 }, { trader: -1, weight: 0.5, n: 9, hold: 3, score: 1, verified: true }, { trader: -2, weight: 0.4, n: 9, hold: 30, score: 1, verified: true }, { trader: -3, weight: 0.3, n: 9, hold: 200, score: 1, verified: true }];
  assert.notEqual(sectionCandidates(zero, [], 0, new Set())[0].trader, ids.a);
});

test('Round 5 item 7: every feed-side read applies the filer gate and the feed floor (feed, similar, suggest)', () => {
  const feed = src('./feed.ts');
  // Candidates (c), the second eligibility branch, the TR-9 weight read: each carries the floor; eligibility the gate.
  assert.equal((feed.match(/ready\('(t|x|y|closed_trades)', asOf\)/g) ?? []).length, 4, 'the floor on c, the eligibility count, the fingerprint and the weights');
  assert.match(feed, /filerVisibleSql\('u'\)/);
  assert.match(feed, /feedReadySql/);
  const similar = src('./similar.ts');
  assert.match(similar, /feedReadySql\('x'\)/);
  assert.match(similar, /filerVisibleSql\('u'\)/);
  // The suggestions section's rows come from the feed's own pool (lib/feed.ts#feedList), never a separate read.
  assert.doesNotMatch(src('../app/suggest-section.tsx'), /sql`/);
});

test('AC 22 / AC 30: stock pages, the ticker image and the sitemap leave out public-filing closes', () => {
  for (const f of ['../app/t/page.tsx', '../app/t/[symbol]/page.tsx', '../app/t/[symbol]/opengraph-image.tsx', '../app/t/compare/page.tsx', './sitemaps.ts'] /* the sitemap read moved to lib/sitemaps.ts (#52) */) {
    const s = src(f);
    const reads = (s.match(/from closed_trades/g) ?? []).length;
    assert.ok(reads > 0, f);
    assert.equal((s.match(/filing_url is null/g) ?? []).length, reads, f);
  }
});

dbTest('AC 28 (C16): follow and like refuse a filer; "Not interested" still works on one', async () => {
  const { sql } = await import('./db.ts');
  const { follow, followable, exclude, followingAmong } = await import('./follows.ts');
  const { like, rejectTrade } = await import('./likes.ts');
  const [card] = await sql`select id::text from closed_trades where user_id = ${ids.a} limit 1`;
  assert.equal(await followable(ids.a), false);
  assert.equal(await followable(ids.t), true);
  await follow(ids.t, ids.a);
  assert.equal((await followingAmong(ids.t, [ids.a])).size, 0);
  assert.equal(await like(ids.t, card.id), false);
  assert.equal((await sql`select 1 from trade_likes where viewer_id = ${ids.t}`).length, 0);
  assert.equal(await rejectTrade(ids.t, card.id), true);
  await exclude(ids.t, ids.a, 'not_interested');
  assert.equal((await sql`select 1 from viewer_exclusions where viewer_id = ${ids.t} and trader_id = ${ids.a}`).length, 1);
  assert.match(src('../app/discovery-actions.ts'), /!\(await followable\(t\)\) \? \{ ok: false, reason: 'invalid' \}/);
});

dbTest('review (AC 9): the viewer\'s own lists leave out a hidden filer, and every filer with the switch off', async () => {
  const { sql } = await import('./db.ts');
  const { ownListsFirstPage, expiredHidesFirstPage } = await import('./follows.ts');
  const { ownHiddenTrades } = await import('./likes.ts');
  const day = 86_400_000;
  for (const [trader, until] of [[ids.a, Date.now() + day], [ids.hid, Date.now() + day], [ids.l, Date.now() - day]] as const) {
    await sql`insert into viewer_exclusions (viewer_id, trader_id, until, reason) values (${ids.t}, ${trader}, ${new Date(until)}, 'not_interested')
      on conflict (viewer_id, trader_id) do update set until = excluded.until, reason = excluded.reason, ended_at = null`;
  }
  await sql`insert into trade_exclusions (viewer_id, trade_key, trader_id) select ${ids.t}, trade_key, user_id from closed_trades where user_id in (${ids.a}, ${ids.hid}) on conflict do nothing`;
  const lists = async () => ({ hidden: (await ownListsFirstPage(ids.t)).hidden.map((x) => x.handle), expired: (await expiredHidesFirstPage(ids.t)).map((x) => x.handle),
    trades: [...new Set((await ownHiddenTrades(ids.t)).rows.map((x) => x.handle))] });
  const on = await withEnv(undefined, lists);
  assert.deepEqual(on, { hidden: [H.a], expired: [H.l], trades: [H.a] });
  assert.deepEqual(await withEnv('0', lists), { hidden: [], expired: [], trades: [] });
  await sql`update public_filers set hidden_at = now() where id = (select public_filer_id from users where id = ${ids.l})`;
  try { assert.deepEqual((await withEnv(undefined, lists)).expired, []); }
  finally { await sql`update public_filers set hidden_at = null where id = (select public_filer_id from users where id = ${ids.l})`; }
});
