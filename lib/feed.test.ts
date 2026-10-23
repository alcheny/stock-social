// F-1 PR-3 fix round 4 (business lead blocker): the feed's recency term is defined for a close of any age.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_DECAY, RECENCY_HOURS } from './feed.ts';
import { rankTraders } from './trades.ts';

test('the clamp sits below the underflow: e^-MAX_DECAY times the smallest size term is still a normal double', () => {
  // Unclamped, exp(-age/48) is 0 (underflow) from about 4.08 years: that age is past the clamp, which starts at 3.3 years.
  assert.equal(Math.exp(-746), 0);
  assert.ok(MAX_DECAY * RECENCY_HOURS < 746 * 48);
  const floor = Math.exp(-MAX_DECAY) * Math.log1p(2.2e-16);
  assert.ok(floor >= 2.2250738585072014e-308, 'normal, not subnormal or zero');
});

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

dbTest('a close dated 2015 does not break the ranking and ranks last; recent closes keep their order', async () => {
  const { sql } = await import('./db.ts');
  const { feedCandidates } = await import('./feed.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `f${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const v = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}v` });
  const close = (user: number, i: number, closedAt: string, r: number) => ({
    user_id: user, sell_id: `${tag}-${user}-${i}`, account_id: 'a', symbol: 'AAA', opened_at: new Date(new Date(closedAt).getTime() - 86_400_000),
    closed_at: new Date(closedAt), return_pct: r, holding_days: 1, verified: true,
  });
  const h = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
  try {
    await sql`insert into closed_trades ${sql([
      close(u.id, 1, h(1), 0.02), close(u.id, 2, h(10), -0.05), close(u.id, 3, h(30), 0.01), close(u.id, 4, h(100), 0.2),
      close(u.id, 5, h(24 * 365 * 3), 0.9), // 3 years: under the clamp
      close(u.id, 6, '2015-03-02T15:00:00Z', 0.5), // 11 years: past the underflow age (fails before the clamp)
      close(v.id, 1, '2014-01-02T15:00:00Z', 3), close(v.id, 2, '2013-01-02T15:00:00Z', 0.01), close(v.id, 3, '2012-01-02T15:00:00Z', 0.02),
      close(v.id, 4, '2011-01-02T15:00:00Z', 0.03), close(v.id, 5, '2010-01-02T15:00:00Z', -0.04),
    ])}`;
    const rows = await feedCandidates({ ids: [u.id] });
    assert.equal(rows.length, 6);
    // Recent closes in the unclamped order (size × exp(-age/48)), the 2015 close last.
    const expect = [[1, 0.02], [10, -0.05], [30, 0.01], [100, 0.2]].map(([hrs, r]) => Math.log1p(Math.abs(r) * 100) * Math.exp(-hrs / 48));
    const order = rows.map((r) => Number(r.score));
    for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] >= order[i], 'descending');
    assert.equal(new Date(rows[rows.length - 1].closed_at).getUTCFullYear(), 2015);
    const top4 = rows.slice(0, 4).map((r) => Number(r.score));
    assert.deepEqual(top4.map((x) => x.toPrecision(6)), [...expect].sort((a, b) => b - a).map((x) => x.toPrecision(6)));
    // Through the trader ranking (one trader, one weight) the 2015 close stays last.
    const ranked = rankTraders(rows.map((t) => ({ t, score: Number(t.score), weight: 0.5 })));
    assert.equal(new Date(ranked[ranked.length - 1].t.closed_at).getUTCFullYear(), 2015);
    // A record made only of old closes ranks among itself by size of move (all share the decay floor), with no error.
    const old = await feedCandidates({ ids: [v.id] });
    assert.deepEqual(old.map((r) => Number(r.return_pct)), [3, -0.04, 0.03, 0.02, 0.01]);
  } finally {
    await sql`delete from users where id in ${sql([u.id, v.id])}`;
  }
});

// F-1 PR-3 fix round 6 (engineer re-sit, Medium): a close dated in the future had a negative age, so exp() grew without
// bound: a day ahead it topped the feed, about 3.9 years ahead the whole feed query failed with an overflow.
dbTest('closes dated 2031 and tomorrow do not break the feed query and never score above a close at this instant', async () => {
  const { sql } = await import('./db.ts');
  const { feedCandidates } = await import('./feed.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `f${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const v = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}v` });
  const close = (user: number, i: number, closedAt: string, r: number) => ({
    user_id: user, sell_id: `${tag}-${user}-${i}`, account_id: 'a', symbol: 'AAA', opened_at: new Date(new Date(closedAt).getTime() - 86_400_000),
    closed_at: new Date(closedAt), return_pct: r, holding_days: 1, verified: true,
  });
  const h = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
  try {
    await sql`insert into closed_trades ${sql([
      // u: real closes, two an hour old (10% and 30% moves).
      close(u.id, 1, h(1), 0.1), close(u.id, 2, h(2), -0.05), close(u.id, 3, h(30), 0.01), close(u.id, 4, h(100), 0.2), close(u.id, 5, h(1), 0.3),
      // v: the same moves, one dated 2031 (past the overflow age), one tomorrow, the rest real.
      close(v.id, 1, '2031-01-02T15:00:00Z', 0.1), close(v.id, 2, h(-24), 0.1), close(v.id, 3, h(3), 0.01), close(v.id, 4, h(4), 0.02), close(v.id, 5, h(5), 0.03),
    ])}`;
    // The page's own call (every trader, no hook) answers; before the fix it raised "value out of range: overflow".
    await feedCandidates();
    const rows = await feedCandidates({ ids: [u.id, v.id] });
    assert.equal(rows.length, 10);
    const size = Math.log1p(0.1 * 100);
    const future = rows.filter((r) => new Date(r.closed_at).getTime() > Date.now());
    assert.equal(future.length, 2);
    // A future close scores like a close at this instant: exactly its size term, never above it.
    for (const r of future) assert.equal(Number(r.score).toPrecision(12), size.toPrecision(12));
    for (const r of rows) assert.ok(Number(r.score) <= Math.log1p(Math.abs(Number(r.return_pct)) * 100) + 1e-12, 'no score above its size term');
    // It never outranks a real close that ranks at least like now: an hour-old 30% move is above both (unclamped, the
    // close dated tomorrow scored e^0.5 times its size term and took the top).
    assert.equal(Number(rows[0].return_pct), 0.3);
    assert.equal(rows[0].user_id, u.id);
    assert.deepEqual(rows.slice(1, 3).map((r) => r.user_id), [v.id, v.id]);
  } finally {
    await sql`delete from users where id in ${sql([u.id, v.id])}`;
  }
});

// ---- F-2 PR-1: feed mix and paging ----
// A fixture of `n` traders, `per` closes each, minutes old, distinct symbols per trader (so the caps leave room).
async function fixture(n: number, per: number, ret: (t: number, i: number) => number, opts: { minutesAgo?: number; holdDays?: number } = {}) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `p${Math.random().toString(36).slice(2, 9)}`;
  const ids: number[] = [];
  for (let t = 0; t < n; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const at = Date.now() - (opts.minutesAgo ?? 30) * 60_000;
  const rows = ids.flatMap((u, t) => Array.from({ length: per }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `${tag.slice(1, 4).toUpperCase()}${(t * per + i) % 37}`,
    opened_at: new Date(at - (t * per + i) * 60_000 - (opts.holdDays ?? 1) * 86_400_000), closed_at: new Date(at - (t * per + i) * 60_000),
    return_pct: ret(t, i), holding_days: opts.holdDays ?? 1, verified: true,
  })));
  for (let i = 0; i < rows.length; i += 1000) await sql`insert into closed_trades ${sql(rows.slice(i, i + 1000))}`;
  return { sql, tag, ids, remove: () => sql`delete from users where id in ${sql(ids)}` };
}
const keyOf = (c: { user_id: number; symbol: string; closed_at: Date; explore: boolean }) => `${c.user_id}|${c.symbol}|${new Date(c.closed_at).getTime()}|${c.explore}`;

dbTest('F-2 PR-1: asOf freezes the ranking: a trade closed after asOf appears nowhere and moves nothing', async () => {
  const { feedList } = await import('./feed.ts');
  const f = await fixture(12, 6, (t, i) => ((t * 7 + i * 3) % 11 - 5) / 20);
  const late = await fixture(1, 6, () => 0.9, { minutesAgo: -1 }); // a new trader whose 6 closes (now + 1 min to now − 4 min) are all after asOf
  try {
    const asOf = new Date(Date.now() - 5 * 60_000);
    const day = asOf.toISOString().slice(0, 10);
    const ids = [...f.ids, ...late.ids];
    const before = (await feedList({ asOf, day, ids })).list.map(keyOf);
    assert.ok(before.length >= 30, `${before.length} cards`);
    // After asOf: a big fresh close for a listed trader, five closes for a trader with one old close (eligible only
    // after asOf), and the late trader's own closes (they were all dated after asOf already).
    const { sql } = f;
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${f.ids[0]}, ${`${f.tag}-late-0`}, 'a', 'ZZLATE', now() - interval '1 day', now() - interval '1 minute', 2.5, 1, true)`;
    const late2 = await fixture(1, 1, () => 0.1, { minutesAgo: 600 });
    for (let i = 0; i < 5; i++) await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${late2.ids[0]}, ${`${late2.tag}-n${i}`}, 'a', 'ZZNEW', now() - interval '1 day', now() - interval '1 minute', 1.5, 1, true)`;
    try {
      const after = (await feedList({ asOf, day, ids: [...ids, ...late2.ids] })).list.map(keyOf);
      assert.deepEqual(after, before);
      assert.ok(!after.some((k) => k.includes('ZZLATE') || k.includes('ZZNEW') || late.ids.some((u) => k.startsWith(`${u}|`))));
      // A new page 1 (a later asOf) does see them.
      const fresh = (await feedList({ asOf: new Date(), day, ids: [...ids, ...late2.ids] })).list.map(keyOf);
      assert.ok(fresh.some((k) => k.includes('ZZLATE')));
      assert.ok(fresh.some((k) => k.startsWith(`${late2.ids[0]}|`)));
    } finally {
      await late2.remove();
    }
  } finally {
    await f.remove();
    await late.remove();
  }
});

dbTest('F-2 PR-1: pages 1 to 3 concatenated equal the unpaged list; caps hold across the joins; a tampered cursor is page 1', async () => {
  const { feedList, loadFeedPage } = await import('./feed.ts');
  const { worstWindow } = await import('./discovery/diversity.ts');
  const { decodeCursor } = await import('./discovery/pager.ts');
  const f = await fixture(40, 5, (t, i) => ((t * 13 + i * 5) % 17 - 8) / 25);
  try {
    const now = Date.now();
    const p1 = await loadFeedPage(undefined, { now, ids: f.ids });
    assert.equal(p1.cards.length, 30);
    assert.ok(p1.next, 'a second page');
    const c = decodeCursor(p1.next, now, 200)!;
    assert.equal(c.asOf, now);
    const p2 = await loadFeedPage(p1.next, { now: now + 1000, ids: f.ids });
    const p3 = await loadFeedPage(p2.next!, { now: now + 2000, ids: f.ids });
    const shown = [...p1.cards, ...p2.cards, ...p3.cards];
    const { list } = await feedList({ asOf: new Date(now), day: new Date(now).toISOString().slice(0, 10), ids: f.ids });
    assert.deepEqual(shown.map(keyOf), list.slice(0, 90).map(keyOf));
    assert.equal(new Set(shown.map(keyOf)).size, shown.length, 'no card repeats');
    const w = worstWindow(shown.map((x) => ({ key: keyOf(x), trader: x.user_id, symbol: x.symbol })));
    assert.ok(w.trader <= 2 && w.symbol <= 2, JSON.stringify(w));
    assert.ok(shown.filter((x) => x.explore).length >= 18, 'at least 2 of every 10');
    // Each page's panes cover exactly its own traders.
    assert.deepEqual([...p2.byUser.keys()].sort(), [...new Set(p2.cards.map((x) => x.user_id))].sort());
    // Tampered → page 1 (a fresh clock), never a throw.
    for (const bad of ['', 'garbage', p1.next!.slice(0, -1), p1.next! + 'A', ['x'], 'e30']) {
      const p = await loadFeedPage(bad, { now, ids: f.ids });
      assert.equal(p.offset, 0);
      assert.deepEqual(p.cards.map(keyOf), p1.cards.map(keyOf));
    }
  } finally {
    await f.remove();
  }
});

dbTest('F-2 PR-1: losses rank equal to gains: negating every return leaves the feed order unchanged', async () => {
  const { feedList, feedCandidates } = await import('./feed.ts');
  // Records under 10 bets (TR-9 "too early"), so the order is the feed's size-of-move × recency score and the mix.
  const f = await fixture(30, 6, (t, i) => ((t * 11 + i * 7) % 19 - 9) / 30 || 0.01);
  try {
    const asOf = new Date();
    const day = asOf.toISOString().slice(0, 10);
    const a = await feedList({ asOf, day, ids: f.ids });
    const sa = (await feedCandidates({ asOf, ids: f.ids })).map((r) => [r.user_id, r.symbol, Number(r.score).toPrecision(12)]);
    await f.sql`update closed_trades set return_pct = -return_pct where user_id in ${f.sql(f.ids)}`;
    const b = await feedList({ asOf, day, ids: f.ids });
    const sb = (await feedCandidates({ asOf, ids: f.ids })).map((r) => [r.user_id, r.symbol, Number(r.score).toPrecision(12)]);
    assert.deepEqual(sb, sa);
    assert.ok(a.list.length >= 60);
    assert.deepEqual(b.list.map((x) => `${x.user_id}|${x.symbol}|${x.explore}`), a.list.map((x) => `${x.user_id}|${x.symbol}|${x.explore}`));
    assert.deepEqual(b.list.map((x) => -Number(x.return_pct)), a.list.map((x) => Number(x.return_pct)));
    // Losses are in the feed at the rate they are in the records.
    assert.ok(a.list.some((x) => x.return_pct < 0) && a.list.some((x) => x.return_pct > 0));
  } finally {
    await f.remove();
  }
});

// ---- F-2 PR-1 fix round 1 ----
// Tester Medium 2: a page cursor pins its list. Between page 1 and the next pages: a close imported after asOf but dated
// before it (the hourly sync's normal case), a 5th close imported late for a trader with 4, a trader deleted, and a
// trader whose second import starts. On a server that kept no list (the cache cleared), the next pages are the same
// list with the removed traders' cards left out: no card repeats, none moves, none is skipped.
dbTest('fix round 1: pages after page 1 slice the list page 1 saw: late imports wait, a deleted or importing trader leaves a gap', async () => {
  const { loadFeedPage, feedList, clearFeedCache } = await import('./feed.ts');
  const f = await fixture(60, 6, (t, i) => ((t * 7 + i * 3) % 13 - 6) / 20 || 0.02);
  const four = await fixture(1, 4, () => 0.05);
  const ids = [...f.ids, ...four.ids];
  const { sql } = f;
  try {
    const now = Date.now() - 5_000;
    const day = new Date(now).toISOString().slice(0, 10);
    const { list } = await feedList({ asOf: new Date(now), day, ids });
    assert.ok(list.length >= 90, `${list.length} cards`);
    const p1 = await loadFeedPage(undefined, { now, ids });
    assert.deepEqual(p1.cards.map((c) => c.sell_id), list.slice(0, 30).map((c) => c.sell_id));
    // After page 1: imports (activities created now, after asOf) of closes dated before asOf, with large moves.
    const late = async (user: number, sell: string, ret: number) => {
      await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
        values (${user}, 'snaptrade', ${sell}, 'a', 'ZZLATE', 'SELL', 1, 1, ${new Date(now - 60_000)}, '{}')`;
      await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
        values (${user}, ${sell}, 'a', 'ZZLATE', ${new Date(now - 86_400_000)}, ${new Date(now - 60_000)}, ${ret}, 1, true)`;
    };
    const later = list.slice(30, 90);
    const gone = later[5].user_id, importing = later[12].user_id;
    assert.notEqual(gone, importing);
    const lateTrader = f.ids.find((u) => u !== gone && u !== importing)!;
    await late(lateTrader, `${f.tag}-late-a`, 3.5);
    await late(four.ids[0], `${four.tag}-late-b`, 2.5);
    await sql`update users set deleted_at = now() where id = ${gone}`;
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at)
      values ((select signup_attempt_id from users where id = ${importing}), ${importing}, 'importing', now(), now(), now())`;
    clearFeedCache(); // another server, or a restart: the list is recomputed from the database
    const p2 = await loadFeedPage(p1.next, { now: now + 2_000, ids });
    const p3 = await loadFeedPage(p2.next, { now: now + 4_000, ids });
    const expected = later.filter((c) => c.user_id !== gone && c.user_id !== importing).map((c) => c.sell_id);
    assert.deepEqual([...p2.cards, ...p3.cards].map((c) => c.sell_id), expected);
    const all = [...p1.cards, ...p2.cards, ...p3.cards].map((c) => c.sell_id);
    assert.equal(new Set(all).size, all.length, 'no card repeats');
    assert.ok(!all.some((s) => s.includes('-late-')));
    assert.equal(p2.from, 31);
    assert.equal(p2.to, 60);
    // A new page 1 (a later asOf) sees the late closes and leaves out the deleted and importing traders.
    clearFeedCache();
    const fresh = await feedList({ asOf: new Date(), day, ids });
    assert.ok(fresh.list.some((c) => c.sell_id === `${f.tag}-late-a`), 'the late close');
    assert.ok(fresh.list.some((c) => c.user_id === four.ids[0]), 'the trader the late close made eligible');
    assert.ok(!fresh.list.some((c) => c.user_id === gone || c.user_id === importing), 'no deleted or importing trader');
  } finally {
    await sql`delete from connections where user_id in ${sql(ids)}`;
    await f.remove();
    await four.remove();
  }
});

dbTest('fix round 1: on the server that served page 1, a trader deleted outright (rows gone) leaves a gap; nothing repeats', async () => {
  const { loadFeedPage, feedList } = await import('./feed.ts');
  const f = await fixture(40, 6, (t, i) => ((t * 5 + i * 7) % 11 - 5) / 20 || 0.03);
  try {
    const now = Date.now() - 2_000;
    const { list } = await feedList({ asOf: new Date(now), day: new Date(now).toISOString().slice(0, 10), ids: f.ids });
    const p1 = await loadFeedPage(undefined, { now, ids: f.ids });
    const gone = list[33].user_id;
    await f.sql`delete from users where id = ${gone}`;
    const p2 = await loadFeedPage(p1.next, { now: now + 1_000, ids: f.ids });
    assert.deepEqual(p2.cards.map((c) => c.sell_id), list.slice(30, 60).filter((c) => c.user_id !== gone).map((c) => c.sell_id));
    assert.ok(p2.cards.length < 30);
    assert.equal(new Set([...p1.cards, ...p2.cards].map((c) => c.sell_id)).size, p1.cards.length + p2.cards.length);
  } finally {
    await f.remove();
  }
});

// Business lead blocker 2: one trader cannot own the list. 5 hyperactive traders (60 closes each in the last 20 hours,
// moves within ±8%) and 55 ordinary ones (6 to 20 closes over 30 days, moves within ±25%).
dbTest('fix round 1: on a skewed fixture the 200 candidates span ≥ 33 traders, ≤ 6 each; ≤ 6 per trader in any 30 cards', async () => {
  const { feedCandidates, feedList, FEED_PER_TRADER } = await import('./feed.ts');
  const { prng } = await import('./discovery/explore.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { sql } = await import('./db.ts');
  const tag = `k${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let t = 0; t < 60; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const r = prng(42), now = Date.now();
  const rows = ids.flatMap((u, t) => {
    const hyper = t < 5, n = hyper ? 60 : 6 + Math.floor(r() * 15);
    return Array.from({ length: n }, (_, i) => {
      const closed = now - (hyper ? r() * 20 * 3_600_000 : r() * 30 * 86_400_000) - 60_000;
      const ret = (r() * 2 - 1) * (hyper ? 0.08 : 0.25) || 0.01;
      return { user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `${tag.slice(1, 4).toUpperCase()}${Math.floor(r() * 45)}`,
        opened_at: new Date(closed - 86_400_000), closed_at: new Date(closed), return_pct: ret, holding_days: 1, verified: true };
    });
  });
  for (let i = 0; i < rows.length; i += 1000) await sql`insert into closed_trades ${sql(rows.slice(i, i + 1000))}`;
  try {
    const asOf = new Date(now);
    const cands = await feedCandidates({ asOf, ids });
    assert.equal(cands.length, 200);
    const per = new Map<number, number>();
    for (const c of cands) per.set(c.user_id, (per.get(c.user_id) ?? 0) + 1);
    assert.ok(per.size >= 33, `${per.size} traders in the 200 candidates`);
    assert.ok(Math.max(...per.values()) <= FEED_PER_TRADER);
    // Each trader's candidates are that trader's best-scoring closes (the cap keeps the top 6, it hides nothing else).
    const { list } = await feedList({ asOf, day: asOf.toISOString().slice(0, 10), ids });
    for (let s = 0; s + 30 <= list.length; s++) {
      const n = new Map<number, number>();
      for (const c of list.slice(s, s + 30)) n.set(c.user_id, (n.get(c.user_id) ?? 0) + 1);
      assert.ok(Math.max(...n.values()) <= 6, `window ${s}`);
    }
    const top5 = list.filter((c) => ids.indexOf(c.user_id) < 5).length;
    const seen = new Set<number>();
    let picks = 0, fresh = 0;
    for (const c of list.slice(0, 120)) { if (c.explore) { picks++; if (!seen.has(c.user_id)) fresh++; } seen.add(c.user_id); }
    assert.ok(fresh >= 0.8 * picks, `${fresh} of ${picks} exploration picks in the first 120 cards are new traders`);
    console.log(`# skewed fixture: ${per.size} traders in 200 candidates; list ${list.length} cards, ${new Set(list.map((c) => c.user_id)).size} traders; top 5 hold ${top5} (${Math.round((100 * top5) / list.length)}%); ${fresh} of ${picks} picks new in the first 120`);
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
  }
});

// Load check: the candidates come from the last RECENT_HOURS first; that must be the same 200 the full pass gives.
dbTest('fix round 1: the recent-window candidates equal the full pass (per-trader top 6, top 200 by score)', async () => {
  const { feedCandidates, FEED_PER_TRADER, RECENT_HOURS, RECENCY_HOURS, MAX_DECAY } = await import('./feed.ts');
  // 50 traders × 6 fresh closes (minutes old, 1% to 8% moves), plus old closes of large moves: 3 days (inside the
  // window, scoring above most fresh moves) and 15 days and 2 years (outside).
  const f = await fixture(50, 6, (t, i) => ((t * 3 + i) % 2 ? 1 : -1) * (0.01 + ((t * 17 + i * 5) % 8) / 100), { minutesAgo: 5 });
  const { sql } = f;
  try {
    const old = f.ids.flatMap((u, t) => [3, 15, 730].map((d, j) => ({ user_id: u, sell_id: `${f.tag}-old-${t}-${j}`, account_id: 'a', symbol: 'OLD',
      opened_at: new Date(Date.now() - (d + 1) * 86_400_000), closed_at: new Date(Date.now() - d * 86_400_000 - t * 60_000), return_pct: 40 + t, holding_days: 1, verified: true })));
    await sql`insert into closed_trades ${sql(old)}`;
    const asOf = new Date();
    const got = await feedCandidates({ asOf, ids: f.ids });
    assert.equal(got.length, 200);
    assert.ok(Number(got[199].score) > Math.log1p(Number.MAX_VALUE) * Math.exp(-RECENT_HOURS / RECENCY_HOURS), 'the window path answers');
    // The reference: every close, scored in JS, top 6 per trader, top 200.
    const all = await sql`select user_id, sell_id, return_pct, closed_at from closed_trades where user_id in ${sql(f.ids)}`;
    const scored = all.map((r) => ({ user: r.user_id as number, sell: r.sell_id as string,
      score: Math.log1p(Math.abs(r.return_pct as number) * 100) * Math.exp(-Math.max(0, Math.min((asOf.getTime() - new Date(r.closed_at as Date).getTime()) / 3_600_000 / RECENCY_HOURS, MAX_DECAY))) }));
    scored.sort((a, b) => b.score - a.score);
    const per = new Map<number, number>();
    const ref = scored.filter((c) => { const k = (per.get(c.user) ?? 0) + 1; per.set(c.user, k); return k <= FEED_PER_TRADER; }).slice(0, 200);
    assert.deepEqual(new Set(got.map((c) => c.sell_id)), new Set(ref.map((c) => c.sell)));
    assert.ok(got.some((c) => c.sell_id.includes('-old-') && c.symbol === 'OLD'), 'a large 3-day-old move is a candidate');
    for (let i = 1; i < got.length; i++) assert.ok(Number(got[i - 1].score) >= Number(got[i].score));
  } finally {
    await f.remove();
  }
});
