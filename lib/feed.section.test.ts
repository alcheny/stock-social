// F-2 PR-3: the suggestions section in the feed (criteria 7, 8, 9, 10), against the database. The same rows for every
// viewer signed out; signed in, minus the viewer, their follows and every running "Not interested" (F-2 PR-4, O4: an
// unfollow is a slight negative, never a hide); ordered by the TR-9 lower bound; fewer than 3 → none.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const DAY = 86_400_000;
const HOLDS = [0.5, 3, 14, 60, 300];

// n traders (plus a viewer at index 0), `closes` each, holding period by trader, accounts 60 days old (so reasons are
// about the record, not "New here"). `sign` −1 makes every return a loss.
// Fix round 1: `hold` and `ret` (optional) set a trader's holding period and returns; the defaults are as before.
async function fixture(n: number, o: { closes?: number; sign?: 1 | -1; hold?: (t: number) => number; ret?: (t: number, i: number) => number } = {}) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `x${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let t = 0; t <= n; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  await sql`update users set created_at = now() - interval '60 days' where id in ${sql(ids)}`;
  const at = Date.now() - 600_000, k = o.closes ?? 5, sign = o.sign ?? 1;
  const traders = ids.slice(1), hold = o.hold ?? ((t: number) => HOLDS[t % 5]), ret = o.ret ?? ((t: number, i: number) => 0.02 + ((t * 7 + i) % 9) / 100);
  await sql`insert into closed_trades ${sql(traders.flatMap((u, t) => Array.from({ length: k }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `X${(t * k + i) % 47}`, opened_at: new Date(at - (t * k + i) * 1000 - hold(t) * DAY),
    closed_at: new Date(at - (t * k + i) * 1000), return_pct: sign * ret(t, i), holding_days: hold(t), verified: true,
  }))))}`;
  return { sql, ids, viewer: ids[0], traders, handle: (id: number) => `${tag}${ids.indexOf(id)}`, remove: () => sql`delete from users where id in ${sql(ids)}` };
}

dbTest('signed out: a section after the 5th card of each page, 3 distinct traders none of whom has a card among the 10 around it, at most 2 per holding bucket, in the pool\'s lower-bound order; each reason true against the trader\'s record; the same for every signed-out request', async () => {
  const { loadFeedPage, feedList } = await import('./feed.ts');
  const { holdBucket, median, SECTION_NEAR } = await import('./discovery/section.ts');
  const f = await fixture(40);
  try {
    const p1 = await loadFeedPage(undefined, { ids: f.traders });
    assert.equal(p1.cards.length, 30);
    assert.ok(p1.section, 'a section');
    assert.equal(p1.section!.length, 3);
    const near = new Set(p1.cards.slice(0, SECTION_NEAR).map((c) => c.user_id));
    assert.ok(p1.section!.every((r) => !near.has(r.userId)));
    assert.equal(new Set(p1.section!.map((r) => r.userId)).size, 3);
    const rows = await f.sql`select user_id, holding_days from closed_trades where user_id = any(${p1.section!.map((r) => r.userId)})`;
    const hold = (id: number) => median(rows.filter((r) => r.user_id === id).map((r) => Number(r.holding_days)));
    const buckets = p1.section!.map((r) => holdBucket(hold(r.userId)));
    assert.ok([...new Set(buckets)].every((b) => buckets.filter((x) => x === b).length <= 2));
    for (const r of p1.section!) {
      // Fix round 1: one template; every row's reason is its record's holding bucket.
      assert.equal(r.reason.kind, 'hold', JSON.stringify(r.reason));
      assert.equal(r.reason.bucket, holdBucket(hold(r.userId)));
      assert.ok(p1.byUser.get(r.userId)?.length, 'the pane\'s record is on the page');
      assert.equal(r.handle, f.handle(r.userId));
    }
    // The order is the pool's (fix round 1: the TR-9 weight alone, ties by closes then id): the rows are the first
    // candidates that qualify.
    const { pool } = await feedList({ asOf: p1.asOf, day: p1.asOf.toISOString().slice(0, 10), ids: f.traders });
    const order = pool.map((t) => t.trader).filter((id) => !near.has(id));
    assert.deepEqual(p1.section!.map((r) => order.indexOf(r.userId)).sort((a, b) => a - b), p1.section!.map((r) => order.indexOf(r.userId)));
    assert.equal(order.indexOf(p1.section![0].userId), 0);
    for (let i = 1; i < pool.length; i++) assert.ok(pool[i - 1].weight >= pool[i].weight, 'never above a record with a higher lower bound');
    // Page 2 has its own section, new faces first.
    const p2 = await loadFeedPage(p1.next!, { ids: f.traders });
    assert.ok(p2.section);
    assert.deepEqual(p2.section!.filter((r) => p1.section!.some((s) => s.userId === r.userId)), []);
    // Identical for every signed-out request.
    const again = await loadFeedPage(undefined, { ids: f.traders, now: p1.asOf.getTime() });
    assert.deepEqual(again.section, p1.section);
  } finally {
    await f.remove();
  }
});

dbTest('losses are suggested under the same rules: a feed of losing records only has the same section shape', async () => {
  const { loadFeedPage } = await import('./feed.ts');
  const f = await fixture(40, { sign: -1 });
  try {
    const p1 = await loadFeedPage(undefined, { ids: f.traders });
    assert.equal(p1.section?.length, 3);
    assert.ok(p1.cards.every((c) => c.return_pct < 0));
  } finally {
    await f.remove();
  }
});

// F-2 PR-4 (owner decision O4, business lead committee PR-1b §5): restated. An unfollow no longer leaves the section: it
// is a slight negative on that trader for the viewer (WEIGHTS.unfollow), never a hide. Follows still leave the section
// (not the feed), so they now leave exactly k candidates in the loop below.
dbTest('signed in: the viewer, their follows and every running "Not interested" leave the section; an unfollow leaves neither the section nor the feed but ranks the trader below otherwise identical records; 1 or 2 candidates left → no section; all hidden → no section', async () => {
  const { loadFeedPage } = await import('./feed.ts');
  const { follow, unfollow, exclude } = await import('./follows.ts');
  const { SECTION_NEAR, holdBucket } = await import('./discovery/section.ts');
  const f = await fixture(40);
  try {
    const out = await loadFeedPage(undefined, { ids: f.traders });
    const [a, b, c] = out.section!.map((r) => r.userId);
    await follow(f.viewer, a);
    await exclude(f.viewer, b, 'not_interested');
    await follow(f.viewer, c); await unfollow(f.viewer, c); // an 'unfollow' row: a preference, never a hide
    const signedIn = await loadFeedPage(undefined, { ids: f.traders, viewer: f.viewer });
    const shown = signedIn.section!.map((r) => r.userId);
    for (const id of [a, b, f.viewer]) assert.ok(!shown.includes(id), `${id} left out`);
    assert.ok(!shown.includes(c), 'every record here has the same evidence: the unfollowed one reads after all of them');
    assert.equal(shown.length, 3);
    // The unfollowed trader is still in the feed; the hidden one is not.
    const cards = async () => { const all: number[] = []; let p = await loadFeedPage(undefined, { ids: f.traders, viewer: f.viewer }); for (;;) { all.push(...p.cards.map((x) => x.user_id)); if (!p.next) return all; p = await loadFeedPage(p.next, { ids: f.traders, viewer: f.viewer }); } };
    const all = await cards();
    assert.ok(all.includes(c));
    assert.ok(!all.includes(b));
    // Leave exactly k candidates besides c (follows leave the section but not the feed, so the near cards stay put): with
    // 2, c is still a row (never a hide) and reads last among its equals; with 1 or 0 → no section.
    const near = new Set(signedIn.cards.slice(0, SECTION_NEAR).map((x) => x.user_id));
    assert.ok(!near.has(c));
    const bucket = (id: number) => holdBucket(HOLDS[f.traders.indexOf(id) % 5]);
    const rest = f.traders.filter((id) => !near.has(id) && ![a, b, c].includes(id));
    const keep = rest.filter((id) => bucket(id) !== bucket(c));
    for (const k of [2, 1, 0]) {
      for (const id of rest.filter((x) => !keep.slice(0, k).includes(x))) await follow(f.viewer, id);
      const p = await loadFeedPage(undefined, { ids: f.traders, viewer: f.viewer, now: signedIn.asOf.getTime() });
      assert.deepEqual(new Set(p.cards.slice(0, SECTION_NEAR).map((x) => x.user_id)), near);
      if (k === 2) {
        const rows = p.section!.map((r) => r.userId);
        assert.deepEqual(new Set(rows), new Set([...keep.slice(0, 2), c]));
        assert.equal(rows[2], c, 'below its equals');
      } else assert.equal(p.section, null, `${k} candidates and the unfollowed one`);
    }
    // Every trader hidden by the viewer: no cards, no section.
    for (const id of f.traders) await exclude(f.viewer, id, 'not_interested');
    const none = await loadFeedPage(undefined, { ids: f.traders, viewer: f.viewer });
    assert.equal(none.cards.length, 0);
    assert.equal(none.section, null);
  } finally {
    await f.remove();
  }
});

dbTest('demo-only feed and small feeds: no section (fewer than 3 traders outside the 10 cards around it)', async () => {
  const { sql } = await import('./db.ts');
  const { loadFeedPage } = await import('./feed.ts');
  const demo = (await sql`select id from users where handle in ('momentum_maya', 'dividend_dan', 'yolo_yuki')`).map((r) => r.id as number);
  if (demo.length) assert.equal((await loadFeedPage(undefined, { ids: demo })).section, null);
  for (const n of [1, 2, 3, 5]) {
    const f = await fixture(n);
    try {
      const p = await loadFeedPage(undefined, { ids: f.traders });
      assert.ok(p.cards.length > 0);
      assert.equal(p.section, null, `${n} traders`);
    } finally {
      await f.remove();
    }
  }
});

dbTest('a trader whose import is running is never a row (TR-3); the next candidate takes the place', async () => {
  const { loadFeedPage } = await import('./feed.ts');
  const f = await fixture(40);
  try {
    const p = await loadFeedPage(undefined, { ids: f.traders });
    const first = p.section![0].userId;
    await f.sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at)
      values ((select signup_attempt_id from users where id = ${first}), ${first}, 'importing', now(), now(), now())`;
    const q = await loadFeedPage(undefined, { ids: f.traders, now: p.asOf.getTime() });
    assert.equal(q.section?.length, 3);
    assert.ok(!q.section!.some((r) => r.userId === first));
    assert.ok(q.section!.every((r) => q.byUser.get(r.userId)?.length));
  } finally {
    await f.remove();
  }
});

// Fix round 1 (tester Medium 1): 30 of 40 traders share one holding period and come first in the pool; the section is
// still there, its rows chosen from every candidate under the cap (2 from that period, 1 from another).
dbTest('a run of candidates sharing one holding period still makes a section: at most 2 of that period, the third from the rest of the pool', async () => {
  const { loadFeedPage } = await import('./feed.ts');
  const { holdBucket } = await import('./discovery/section.ts');
  // The 30 also have the bigger moves, so they lead under either order (closes then id, or the size of a move).
  const f = await fixture(40, { hold: (t) => (t < 30 ? 3 : HOLDS[t % 5]), ret: (t, i) => (t < 30 ? 0.3 + i / 100 : 0.02 + i / 100) });
  try {
    const p1 = await loadFeedPage(undefined, { ids: f.traders });
    assert.equal(p1.section?.length, 3, 'a section');
    const bucket = (id: number) => holdBucket(f.traders.indexOf(id) < 30 ? 3 : HOLDS[f.traders.indexOf(id) % 5]);
    assert.equal(p1.section!.filter((r) => bucket(r.userId) === 1).length, 2);
    assert.ok(p1.section!.some((r) => bucket(r.userId) !== 1));
  } finally {
    await f.remove();
  }
});
