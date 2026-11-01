// F-2 PR-2: follows and "not interested" (criteria 1, 4 and 5 for these tables). Private to the viewer: nothing counts
// or lists them for anyone else; 90-day exclusions honored on the signed-in feed only; Undo and "Show again" end an
// exclusion without deleting it; the tick deletes rows ended over a day ago; deletion leaves zero rows.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const DAY = 86_400_000;

const root = fileURLToPath(new URL('..', import.meta.url));
const sources = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(root, dir, f);
  return statSync(p).isDirectory() ? sources(relative(root, p)) : /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) ? [relative(root, p)] : [];
});

test('no page, card, share image or route can expose follower counts or lists: only lib/follows.ts, lib/delete.ts and the purge name the tables, every read is keyed by the viewer, nothing counts them', () => {
  const tables = /\b(follows|viewer_exclusions)\b/;
  const naming = [...sources('app'), ...sources('lib')].filter((f) => [...readFileSync(join(root, f), 'utf8').matchAll(/sql`[^`]*`|tx`[^`]*`|conn`[^`]*`/g)].some((m) => tables.test(m[0])));
  assert.deepEqual(naming.sort(), ['lib/delete.ts', 'lib/discovery/purge.ts', 'lib/follows.ts']);
  const src = readFileSync(join(root, 'lib/follows.ts'), 'utf8');
  const statements = [...src.matchAll(/(?:sql|tx)`([^`]*)`/g)].map((m) => m[1]).filter((q) => tables.test(q));
  assert.ok(statements.length >= 8);
  for (const q of statements) {
    assert.doesNotMatch(q, /count\s*\(/i, q);
    if (/^\s*(select|update|delete)/i.test(q) || /\bfrom (follows|viewer_exclusions)\b/.test(q)) assert.match(q, /viewer_id = \$\{viewer\}/, q);
  }
  // No copy mentions followers or a count of them; the share image and the pane chart route never import follows.
  assert.doesNotMatch(readFileSync(join(root, 'lib/copy.ts'), 'utf8'), /follower/i);
  for (const f of sources('app').filter((f) => /opengraph-image|story|pane-chart|sitemap|robots/.test(f))) assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /from ['"][^'"]*(follows|follow-button|not-interested|discovery-actions)/, f);
});

dbTest('the handle is checked against the pattern before any query (the F-1 NUL-byte 500); unknown, deleted or malformed handles name no one', async () => {
  const { traderId } = await import('./follows.ts');
  for (const bad of ['a\u0000b', 'momentum_maya\u0000', '../x', '', 'AB', 'x'.repeat(21), 12, null, undefined, ['momentum_maya'], { handle: 'x' }]) assert.equal(await traderId(bad), null);
  assert.equal(await traderId('no_such_handle_q'), null);
});

async function people(n: number, closes = 5) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `f${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let t = 0; t < n; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const at = Date.now() - 600_000;
  if (closes) await sql`insert into closed_trades ${sql(ids.slice(1).flatMap((u, t) => Array.from({ length: closes }, (_, i) => ({
    user_id: u, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `F${(t * 5 + i) % 43}`, opened_at: new Date(at - DAY),
    closed_at: new Date(at - (t * 5 + i) * 1000), return_pct: ((t + i) % 7 - 3) / 10 || 0.05, holding_days: 1, verified: true,
  }))))}`;
  return { sql, tag, ids, viewer: ids[0], traders: ids.slice(1), handle: (i: number) => `${tag}${i}`, remove: () => sql`delete from users where id in ${sql(ids)}` };
}

dbTest('follow, unfollow and "not interested": unfollow and "not interested" exclude for 90 days; Undo, "Show again" and a new follow end it without deleting it; the first follow is flagged once', async () => {
  const F = await import('./follows.ts');
  const p = await people(3, 0);
  const [a, b] = p.traders;
  try {
    assert.deepEqual(await F.follow(p.viewer, a), { first: true });
    assert.deepEqual(await F.follow(p.viewer, a), { first: false }); // idempotent
    assert.deepEqual(await F.follow(p.viewer, b), { first: false });
    assert.deepEqual([...await F.followingAmong(p.viewer, [a, b])].sort(), [a, b].sort());
    await assert.rejects(p.sql`insert into follows (viewer_id, trader_id) values (${a}, ${a})`); // never yourself
    await F.unfollow(p.viewer, a);
    const [x] = await p.sql`select reason, until - created_at as span, until > now() as running from viewer_exclusions where viewer_id = ${p.viewer} and trader_id = ${a}`;
    assert.equal(x.reason, 'unfollow');
    assert.equal(x.running, true);
    assert.match(String(x.span), /^90 days/);
    assert.deepEqual([...await F.followingAmong(p.viewer, [a, b])], [b]);
    await F.follow(p.viewer, a); // following again ends the exclusion; the row stays (ended)
    const [y] = await p.sql`select until <= now() as ended from viewer_exclusions where viewer_id = ${p.viewer} and trader_id = ${a}`;
    assert.equal(y.ended, true);
    await F.exclude(p.viewer, b, 'not_interested');
    const lists = await F.ownLists(p.viewer);
    assert.deepEqual(lists.hidden.map((t) => t.handle), [p.handle(2)]);
    await F.endExclusion(p.viewer, b); // Undo / "Show again"
    assert.equal((await F.ownLists(p.viewer)).hidden.length, 0);
    assert.equal((await p.sql`select 1 from viewer_exclusions where viewer_id = ${p.viewer}`).length, 2); // ended, not deleted
    await F.unfollow(p.viewer, p.traders[0]);
    await F.unfollow(p.viewer, p.traders[0]); // not following: no new exclusion row, nothing changes
    assert.equal((await p.sql`select 1 from viewer_exclusions where viewer_id = ${p.viewer} and until > now()`).length, 1);
  } finally {
    await p.remove();
  }
});

dbTest('the signed-in feed honors exclusions (excluded at 89 d 23 h 59 m, back at 90 d + 1 s); a hide between pages drops the trader in place; Undo brings them back; signed out and other viewers see the whole list', async () => {
  const F = await import('./follows.ts');
  const { loadFeedPage } = await import('./feed.ts');
  const p = await people(41);
  const ids = p.traders;
  const keys = (pg: { cards: { sell_id: string }[] }) => pg.cards.map((c) => c.sell_id);
  try {
    const base1 = await loadFeedPage(undefined, { ids });
    const base2 = await loadFeedPage(base1.next!, { ids });
    const t = base2.cards[0].user_id;
    // A hide after page 1: page 2 is the same slice without that trader's cards, in the same order.
    const mine1 = await loadFeedPage(undefined, { ids, viewer: p.viewer });
    assert.deepEqual(keys(mine1), keys(base1));
    assert.deepEqual([...mine1.viewer!.following], []);
    assert.equal(mine1.viewer!.id, p.viewer); // the pane hides Follow and "…" on this id's own record
    await new Promise((r) => setTimeout(r, 5));
    await F.exclude(p.viewer, t, 'not_interested');
    const mine2 = await loadFeedPage(mine1.next!, { ids, viewer: p.viewer });
    assert.deepEqual(keys(mine2), keys(base2).filter((_, i) => base2.cards[i].user_id !== t));
    assert.equal(mine2.from, base2.from); // the same slice of the list (positions kept)
    assert.deepEqual(keys(await loadFeedPage(base1.next!, { ids })), keys(base2)); // signed out: unchanged
    assert.deepEqual(keys(await loadFeedPage(base1.next!, { ids, viewer: p.traders[5] })), keys(base2)); // another viewer: unchanged
    // Undo within the session: later slices include them again.
    await F.endExclusion(p.viewer, t);
    assert.deepEqual(keys(await loadFeedPage(mine1.next!, { ids, viewer: p.viewer })), keys(base2));
    // A new page 1 with a running exclusion: the trader is not in the list at all, and the caps hold.
    await F.exclude(p.viewer, t, 'not_interested');
    const fresh = [];
    let pg = await loadFeedPage(undefined, { ids, viewer: p.viewer, now: Date.now() + 1000 });
    for (;;) { fresh.push(...pg.cards); if (!pg.next) break; pg = await loadFeedPage(pg.next, { ids, viewer: p.viewer, now: Date.now() + 1000 }); }
    assert.ok(fresh.length > 30 && fresh.every((c) => c.user_id !== t));
    const { worstWindow } = await import('./discovery/diversity.ts');
    const w = worstWindow(fresh.map((c) => ({ key: c.sell_id, trader: c.user_id, symbol: c.symbol })));
    assert.ok(w.trader <= 2 && w.symbol <= 2);
    // The 90-day boundary, by a backdated exclusion: still out at 89 d 23 h 59 m, back at 90 d + 1 s.
    await p.sql`update viewer_exclusions set created_at = now() - interval '89 days 23 hours 59 minutes', until = now() + interval '1 minute' where viewer_id = ${p.viewer}`;
    const all = async (now: number) => { const out = []; let q = await loadFeedPage(undefined, { ids, viewer: p.viewer, now }); for (;;) { out.push(...q.cards); if (!q.next) return out; q = await loadFeedPage(q.next, { ids, viewer: p.viewer, now }); } };
    assert.ok((await all(Date.now() + 3000)).every((c) => c.user_id !== t), 'excluded at 89 d 23 h 59 m');
    await p.sql`update viewer_exclusions set created_at = now() - interval '90 days 1 second', until = now() - interval '1 second' where viewer_id = ${p.viewer}`;
    assert.ok((await all(Date.now() + 4000)).some((c) => c.user_id === t), 'back at 90 d + 1 s');
  } finally {
    await p.remove();
  }
});

// Fix round 1 (committee, the owner may reverse it with FEED_HIDES_UNFOLLOWED): unfollow affects suggestions (PR-3),
// not the feed; the privacy line shows once per viewer, ever.
dbTest('fix round 1: an unfollow keeps its 90-day row but neither the feed nor "Not interested" honors it; it never replaces a running "Not interested"; the privacy line is flagged once per viewer, even after the list empties', async () => {
  const F = await import('./follows.ts');
  const { FEED_HIDES_UNFOLLOWED } = await import('./discovery/weights.ts');
  assert.equal(FEED_HIDES_UNFOLLOWED, false);
  const { loadFeedPage } = await import('./feed.ts');
  const p = await people(6);
  const [a, b] = p.traders;
  const ids = p.traders;
  const all = async (viewer?: number) => { const out: number[] = []; let q = await loadFeedPage(undefined, { ids, viewer, now: Date.now() + 1000 }); for (;;) { out.push(...q.cards.map((c) => c.user_id)); if (!q.next) return out; q = await loadFeedPage(q.next, { ids, viewer, now: Date.now() + 1000 }); } };
  try {
    assert.deepEqual(await F.follow(p.viewer, a), { first: true });
    await F.unfollow(p.viewer, a); // the list is empty again
    const [x] = await p.sql`select reason, until > now() as running from viewer_exclusions where viewer_id = ${p.viewer} and trader_id = ${a}`;
    assert.deepEqual({ ...x }, { reason: 'unfollow', running: true }); // kept for PR-3's section
    assert.ok((await all(p.viewer)).includes(a), 'an unfollowed trader stays in the feed');
    assert.deepEqual(await all(p.viewer), await all());
    assert.deepEqual((await F.ownLists(p.viewer)).hidden, []); // never listed under "Not interested"
    assert.equal(await F.isHidden(p.viewer, a), false);
    assert.deepEqual(await F.follow(p.viewer, b), { first: false }); // shown once per viewer, not per empty list
    // "Not interested" on a followed trader, then unfollow: still hidden, still "not_interested".
    await F.exclude(p.viewer, b, 'not_interested');
    await F.unfollow(p.viewer, b);
    const [y] = await p.sql`select reason from viewer_exclusions where viewer_id = ${p.viewer} and trader_id = ${b}`;
    assert.equal(y.reason, 'not_interested');
    assert.equal(await F.isHidden(p.viewer, b), true);
    assert.ok(!(await all(p.viewer)).includes(b));
    // "Not interested" over a running unfollow starts now (the feed never honored the unfollow, so no cursor re-shapes).
    await p.sql`update viewer_exclusions set created_at = now() - interval '1 hour' where viewer_id = ${p.viewer} and trader_id = ${a}`;
    await F.exclude(p.viewer, a, 'not_interested');
    const [z] = await p.sql`select reason, now() - created_at < interval '1 minute' as fresh from viewer_exclusions where viewer_id = ${p.viewer} and trader_id = ${a}`;
    assert.deepEqual({ ...z }, { reason: 'not_interested', fresh: true });
    assert.deepEqual((await F.ownLists(p.viewer)).hidden.map((t) => t.handle).sort(), [p.handle(1), p.handle(2)].sort());
  } finally {
    await p.remove();
  }
});

dbTest('purge: deletes only exclusions ended over a day ago, in batches; a call cut by its time box resumes on the next; two concurrent callers: exactly one purges and the other returns at once', async () => {
  const { purgeDiscovery, PURGE_BOX_MS } = await import('./discovery/purge.ts');
  assert.equal(PURGE_BOX_MS, 30_000);
  const p = await people(8, 0);
  const [a, b, c, ...rest] = p.traders;
  try {
    await p.sql`insert into viewer_exclusions (viewer_id, trader_id, created_at, until, reason) values
      (${p.viewer}, ${a}, now() - interval '30 days', now() - interval '1 day 1 second', 'unfollow'),
      (${p.viewer}, ${b}, now() - interval '30 days', now() - interval '23 hours 59 minutes', 'not_interested'),
      (${p.viewer}, ${c}, now() - interval '30 days', now() + interval '60 days', 'not_interested')`;
    for (const t of rest) await p.sql`insert into viewer_exclusions (viewer_id, trader_id, created_at, until, reason) values (${p.viewer}, ${t}, now() - interval '100 days', now() - interval '10 days', 'unfollow')`;
    const mine = () => p.sql`select trader_id from viewer_exclusions where viewer_id = ${p.viewer} order by trader_id`.then((r) => r.map((x) => x.trader_id as number));
    // A box that ends after the first batch of 2: cut, then resumed.
    let t = 0;
    const cut = await purgeDiscovery({ batch: 2, boxMs: 10, clock: () => (t += 6) });
    assert.equal(cut.ran, true);
    assert.equal(cut.done, false);
    assert.ok(cut.deleted >= 2 && cut.deleted < 5);
    const rest2 = await purgeDiscovery({ batch: 2 });
    assert.equal(rest2.done, true);
    assert.deepEqual(await mine(), [b, c].sort((x, y) => x - y)); // ended 23 h 59 m ago and running: kept
    // Concurrency: the first holds the lock; the second skips the purge at once and never waits.
    let open!: () => void;
    const held = new Promise<void>((r) => { open = r; });
    let holding!: () => void;
    const inLock = new Promise<void>((r) => { holding = r; });
    const first = purgeDiscovery({ hold: () => { holding(); return held; } });
    await inLock;
    const second = await purgeDiscovery();
    assert.deepEqual(second, { ran: false, deleted: 0, done: false });
    open();
    assert.equal((await first).ran, true);
  } finally {
    await p.remove();
  }
});

dbTest('deletion: as viewer and as trader, zero rows left in follows and viewer_exclusions; a failed vendor call still leaves zero', async () => {
  const F = await import('./follows.ts');
  const { deleteProfile } = await import('./delete.ts');
  const p = await people(4, 0);
  const [a, b, c] = p.traders;
  const rows = (id: number) => p.sql`select (select count(*) from follows where viewer_id = ${id} or trader_id = ${id})::int + (select count(*) from viewer_exclusions where viewer_id = ${id} or trader_id = ${id})::int as n`.then((r) => r[0].n as number);
  try {
    await F.follow(p.viewer, a); await F.exclude(p.viewer, b, 'not_interested'); await F.follow(c, p.viewer); await F.exclude(a, p.viewer, 'not_interested');
    assert.equal(await rows(p.viewer), 4);
    const u = { id: p.viewer, handle: p.handle(0), snaptrade_user_id: 'v', snaptrade_secret_enc: 'e' };
    await assert.rejects(deleteProfile(u, { deleteVendorUser: async () => { throw new Error('vendor down'); } }));
    assert.equal(await rows(p.viewer), 0); // the first step ran before the vendor call
    await deleteProfile(u, { deleteVendorUser: async () => {} });
    assert.equal((await p.sql`select 1 from users where id = ${p.viewer}`).length, 0);
    // As trader: the cascade.
    await F.follow(b, a); await F.exclude(c, a, 'unfollow');
    await p.sql`delete from users where id = ${a}`;
    assert.equal(await rows(a), 0);
  } finally {
    await p.remove();
    await p.sql`delete from handle_reservations where handle = ${p.handle(0)}`;
  }
});

dbTest('review: "@x is back" (/me/following?back=x) only after this viewer ended a "Not interested" on x in the last minute', async () => {
  const F = await import('./follows.ts');
  const p = await people(3, 0);
  try {
    const [a, b] = p.traders;
    assert.equal(await F.shownAgainJustNow(p.viewer, p.handle(1)), false, 'never hidden');
    assert.equal(await F.shownAgainJustNow(p.viewer, 'no_such_handle_q'), false, 'no such trader');
    await F.exclude(p.viewer, a, 'not_interested');
    assert.equal(await F.shownAgainJustNow(p.viewer, p.handle(1)), false, 'still hidden');
    await F.endExclusion(p.viewer, a);
    assert.equal(await F.shownAgainJustNow(p.viewer, p.handle(1)), true, 'just shown again');
    assert.equal(await F.shownAgainJustNow(b, p.handle(1)), false, 'another viewer');
    await p.sql`update viewer_exclusions set until = now() - interval '2 minutes' where viewer_id = ${p.viewer} and trader_id = ${a}`;
    assert.equal(await F.shownAgainJustNow(p.viewer, p.handle(1)), false, 'ended earlier');
  } finally { await p.remove(); }
});

// Known-limits sweep (lists): /me/following's three lists page FOLLOW_PAGE at a time on a keyset, like /me/likes.
async function crowd(n: number) {
  const { sql } = await import('./db.ts');
  const tag = `k${Math.random().toString(36).slice(2, 7)}`;
  const [{ id: attempt }] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const rows = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id)
    select ${tag} || '_' || lpad(i::text, 3, '0'), 'P ' || i, now(), ${attempt} from generate_series(0, ${n}) i order by i returning id, handle`;
  const ids = rows.map((r) => r.id as number);
  return { sql, tag, viewer: ids[0], traders: ids.slice(1), handles: new Map(rows.map((r) => [r.id as number, r.handle as string])),
    remove: async () => { await sql`delete from users where id in ${sql(ids)}`; await sql`delete from signup_attempts where id = ${attempt}`; } };
}
// 120 rows on two adjacent microseconds (60 each, a non-round µs): a page boundary (50, 100) falls inside each tie and
// on the 1 µs step, where a timestamp rebuilt from a double would be off by one.
const T0 = '2026-10-01 12:00:00.123457+00', T1 = '2026-10-01 12:00:00.123456+00';
const stamps = (traders: number[]) => traders.map((t, i) => ({ t, at: i % 2 ? T0 : T1 }));
const expected = (s: { t: number; at: string }[]) => [...s].sort((a, b) => b.at.localeCompare(a.at) || b.t - a.t).map((x) => x.t);
async function walk(fn: (after?: unknown) => Promise<{ rows: { handle: string }[]; next: string | null }>) {
  const seen: string[] = [], sizes: number[] = [];
  let after: string | undefined;
  for (let i = 0; i < 10; i++) {
    const pg = await fn(after);
    seen.push(...pg.rows.map((r) => r.handle)); sizes.push(pg.rows.length);
    if (!pg.next) break;
    after = pg.next;
  }
  return { seen, sizes };
}

dbTest('lists: following, running hides and expired hides each page 50 at a time, newest first; walking every page lists each row exactly once, across same-microsecond ties and a 1 µs step', async () => {
  const F = await import('./follows.ts');
  const c = await crowd(360);
  try {
    const [fol, hid, exp] = [c.traders.slice(0, 120), c.traders.slice(120, 240), c.traders.slice(240, 360)].map(stamps);
    // Set in SQL from text: the driver turns a timestamp parameter into a JS Date (milliseconds), losing the µs.
    const at = (s: { t: number; at: string }[]) => c.sql`(case when ${c.sql.array(s.filter((x) => x.at === T0).map((x) => x.t))}::int[] @> array[trader_id] then ${T0}::text::timestamptz else ${T1}::text::timestamptz end)`;
    await c.sql`insert into follows ${c.sql(fol.map((x) => ({ viewer_id: c.viewer, trader_id: x.t })))}`;
    await c.sql`update follows set created_at = ${at(fol)} where viewer_id = ${c.viewer}`;
    await c.sql`insert into viewer_exclusions ${c.sql([...hid, ...exp].map((x) => ({ viewer_id: c.viewer, trader_id: x.t, until: new Date(Date.now() + 30 * DAY), reason: 'not_interested' })))}`;
    await c.sql`update viewer_exclusions set created_at = ${at(hid)} where viewer_id = ${c.viewer} and trader_id in ${c.sql(hid.map((x) => x.t))}`;
    await c.sql`update viewer_exclusions set created_at = '2026-06-01', until = ${at(exp)} where viewer_id = ${c.viewer} and trader_id in ${c.sql(exp.map((x) => x.t))}`;
    const [{ n }] = await c.sql`select count(distinct created_at)::int as n from follows where viewer_id = ${c.viewer}`;
    assert.equal(n, 2); // two distinct microseconds really stored
    for (const [fn, s] of [[F.ownFollowing, fol], [F.ownHidden, hid], [F.expiredHidesPage, exp]] as const) {
      const r = await walk((a) => fn(c.viewer, a));
      assert.deepEqual(r.sizes, [50, 50, 20], fn.name);
      assert.deepEqual(r.seen, expected(s).map((t) => c.handles.get(t)), fn.name);
    }
    assert.equal(F.FOLLOW_PAGE, 50);
    assert.deepEqual((await F.ownLists(c.viewer)).following.length, 50); // the first pages, as before for small lists
  } finally { await c.remove(); }
});

dbTest('lists: a deleted trader is left out inside the query, so a page is still full; a malformed cursor reads the first page and never throws', async () => {
  const F = await import('./follows.ts');
  const c = await crowd(55);
  try {
    await c.sql`insert into follows ${c.sql(c.traders.map((t, i) => ({ viewer_id: c.viewer, trader_id: t, created_at: new Date(Date.now() - i * 1000) })))}`;
    await c.sql`update users set deleted_at = now() where id in ${c.sql(c.traders.slice(0, 3))}`;
    const p1 = await F.ownFollowing(c.viewer);
    assert.equal(p1.rows.length, 50);
    assert.ok(p1.rows.every((r) => !c.traders.slice(0, 3).some((t) => c.handles.get(t) === r.handle)));
    assert.equal((await F.ownFollowing(c.viewer, p1.next)).rows.length, 2);
    for (const bad of ['x', '1.', '.1', '1.2.3', '1\u0000.2', '9'.repeat(18) + '.1', '1.99999999999', '1.2147483648', 12, null, ['1.2'], { a: 1 }]) {
      assert.deepEqual((await F.ownFollowing(c.viewer, bad)).rows, p1.rows, String(bad));
      assert.equal(F.isListCursor(bad), false, String(bad));
    }
    assert.equal(F.isListCursor(p1.next), true);
  } finally { await c.remove(); }
});

dbTest('lists: Record tools gets at most 100 followed handles, A to Z in byte order, leaving out the view\'s traders, and says when there are more; no count is read', async () => {
  const F = await import('./follows.ts');
  const c = await crowd(130);
  try {
    await c.sql`insert into follows ${c.sql(c.traders.map((t) => ({ viewer_id: c.viewer, trader_id: t })))}`;
    const all = c.traders.map((t) => c.handles.get(t)!).sort();
    const r = await F.followHandles(c.viewer, 100);
    assert.deepEqual(r, { handles: all.slice(0, 100), more: true });
    const ex = await F.followHandles(c.viewer, 100, all.slice(0, 4));
    assert.deepEqual(ex.handles, all.slice(4, 104));
    assert.deepEqual(await F.followHandles(c.viewer, 200), { handles: all, more: false });
    assert.deepEqual(await F.followHandles(c.traders[0], 100), { handles: [], more: false });
  } finally { await c.remove(); }
});

test('lists (QA Q1): a list paged past its end drops only its own cursor, keeping the others and `back`; a page with rows, or page 1 empty, stays', async () => {
  const { pastEndQuery } = await import('./follows.ts');
  const page = (n: number) => ({ rows: Array.from({ length: n }, () => ({ handle: 'x', name: 'X' })), next: null });
  const at = { f: '1.2', h: '3.4', e: '5.6' };
  assert.equal(pastEndQuery(at, { f: page(0), h: page(2), e: page(1) }, { back: 'abc' }), '?h=3.4&e=5.6&back=abc');
  assert.equal(pastEndQuery(at, { f: page(0), h: page(0), e: page(0) }), '');
  assert.equal(pastEndQuery({ f: '1.0' }, { f: page(0), h: page(0), e: page(0) }), ''); // a forged or stale cursor
  assert.equal(pastEndQuery(at, { f: page(1), h: page(1), e: page(1) }), null);
  assert.equal(pastEndQuery({}, { f: page(0), h: page(0), e: page(0) }), null); // page 1 empty: the empty-state copy is true
  assert.equal(pastEndQuery({ f: 'bad' }, { f: page(0), h: page(0), e: page(0) }), null); // an invalid cursor already reads page 1
});
