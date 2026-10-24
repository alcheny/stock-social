// F-2 PR-4 (owner decision O4, business lead committee PR-1b §5): "unfollow applies the unfollow weight to that trader's
// score for the viewer; it never removes the trader's cards or section rows". An unfollowed trader still appears in the
// feed, ranked below an otherwise identical trader; after 90 days, equal. The trader part of a trade reject (O1) works
// the same way and ends at 90 days. Signed out and other viewers: unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const DAY = 86_400_000;

// 6 traders × 5 closes (30 cards: no exploration, so the order is the ranking). Traders 1 and 2 are identical (same
// returns, holding periods and close times); trader 1's sell ids sort after trader 2's, so signed out 1 goes first.
// `spare`: trader 1 also has a 6th, lowest-scoring close (the one a viewer rejects, leaving the twins identical).
async function fixture(spare = false) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `q${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let t = 0; t < 7; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const at = Date.now() - 600_000;
  const twin = (t: number) => (t === 1 || t === 2 ? 1 : t);
  await sql`insert into closed_trades ${sql(ids.slice(1).flatMap((u, k) => Array.from({ length: 5 }, (_, i) => {
    const t = k + 1, s = twin(t);
    return { user_id: u, sell_id: `${tag}-${t === 1 ? 'z' : 'a'}${t}-${i}`, account_id: 'a', symbol: `Q${t}${i}`, opened_at: new Date(at - (s * 5 + i) * 60_000 - DAY),
      closed_at: new Date(at - (s * 5 + i) * 60_000), return_pct: (s % 2 ? 1 : -1) * (0.03 + ((s * 3 + i) % 7) / 100), holding_days: 1, verified: true };
  })))}`;
  if (spare) await sql`insert into closed_trades ${sql({ user_id: ids[1], sell_id: `${tag}-z1-5`, account_id: 'a', symbol: 'Q15', opened_at: new Date(at - 200 * 60_000 - DAY),
    closed_at: new Date(at - 200 * 60_000), return_pct: 0.0001, holding_days: 1, verified: true })}`;
  return { sql, ids, viewer: ids[0], traders: ids.slice(1), remove: () => sql`delete from users where id in ${sql(ids)}` };
}

const cardsOf = async (ids: number[], viewer?: number, now = Date.now()) => {
  const { loadFeedPage } = await import('./feed.ts');
  const out: { user_id: number; sell_id: string; trade_key: string }[] = [];
  let p = await loadFeedPage(undefined, { ids, viewer, now });
  for (;;) { out.push(...p.cards); if (!p.next) return out; p = await loadFeedPage(p.next, { ids, viewer, now }); }
};
// The k-th card of trader a comes before the k-th card of trader b, for every k.
const ahead = (list: { user_id: number }[], a: number, b: number) => {
  const ia = list.flatMap((c, i) => (c.user_id === a ? [i] : [])), ib = list.flatMap((c, i) => (c.user_id === b ? [i] : []));
  return ia.length === ib.length && ia.length > 0 && ia.every((x, k) => x < ib[k]);
};

dbTest('O4: an unfollowed trader still appears in the feed (every card), ranked below an otherwise identical trader; after 90 days, equal; signed out and another viewer unchanged', async () => {
  const F = await import('./follows.ts');
  const f = await fixture();
  const [one, two] = f.traders;
  try {
    const out = await cardsOf(f.traders);
    assert.equal(out.length, 30);
    assert.ok(ahead(out, one, two), 'signed out, the twin with the later sell ids goes first');
    await F.follow(f.viewer, one);
    await F.unfollow(f.viewer, one);
    const mine = await cardsOf(f.traders, f.viewer, Date.now() + 1000);
    assert.deepEqual(mine.map((c) => c.sell_id).sort(), out.map((c) => c.sell_id).sort(), 'never a hide: the same cards');
    assert.ok(ahead(mine, two, one), 'unfollowed: below its identical twin');
    assert.deepEqual((await cardsOf(f.traders, undefined, Date.now() + 1000)).map((c) => c.sell_id), out.map((c) => c.sell_id));
    assert.deepEqual((await cardsOf(f.traders, f.traders[4], Date.now() + 1000)).map((c) => c.sell_id), out.map((c) => c.sell_id));
    // Still in effect at 89 days; after 90 days the row has ended: equal again (the same list as signed out).
    await f.sql`update viewer_exclusions set created_at = now() - interval '89 days', until = now() + interval '1 day' where viewer_id = ${f.viewer}`;
    assert.ok(ahead(await cardsOf(f.traders, f.viewer, Date.now() + 2000), two, one));
    await f.sql`update viewer_exclusions set created_at = now() - interval '90 days 1 second', until = now() - interval '1 second' where viewer_id = ${f.viewer}`;
    assert.deepEqual((await cardsOf(f.traders, f.viewer, Date.now() + 3000)).map((c) => c.sell_id), (await cardsOf(f.traders, undefined, Date.now() + 3000)).map((c) => c.sell_id));
    // Following again ends it at once.
    await F.unfollow(f.viewer, one); // not following: nothing changes
    await F.follow(f.viewer, one); await F.unfollow(f.viewer, one); await F.follow(f.viewer, one);
    assert.ok(ahead(await cardsOf(f.traders, f.viewer, Date.now() + 4000), one, two));
  } finally {
    await f.remove();
  }
});

dbTest('O1: a trade reject hides that card and ranks its trader below an otherwise identical trader, never hides the trader\'s other cards; the trader part ends at 90 days while the trade stays hidden if the constant were permanent', async () => {
  const L = await import('./likes.ts');
  const f = await fixture(true);
  const [one] = f.traders;
  try {
    const out = await cardsOf(f.traders);
    const gone = out.find((c) => c.sell_id.endsWith('-z1-5'))!;
    await L.rejectTrade(f.viewer, gone.trade_key);
    const mine = await cardsOf(f.traders, f.viewer, Date.now() + 1000);
    assert.ok(!mine.some((c) => c.sell_id === gone.sell_id));
    assert.equal(mine.filter((c) => c.user_id === one).length, 5, 'the other five stay');
    assert.ok(out.some((c) => c.sell_id === gone.sell_id), 'signed out it is there');
    // Twins: card i of trader 1 against card i of trader 2 (equal scores): below while the trader part runs.
    const first = (list: { sell_id: string }[], i: number) => list.findIndex((c) => c.sell_id.endsWith(`-z1-${i}`)) < list.findIndex((c) => c.sell_id.endsWith(`-a2-${i}`));
    const each = [0, 1, 2, 3, 4];
    assert.ok(each.every((i) => !first(mine, i)), 'the trader ranks below its twin');
    // A permanent trade exclusion (until = infinity, the O3 alternative) after 90 days: the trade is still out, the
    // trader part has ended, and the twins read as signed out (trader 1 first).
    await f.sql`update trade_rejects set created_at = now() - interval '90 days 1 second', until = 'infinity' where viewer_id = ${f.viewer}`;
    const later = await cardsOf(f.traders, f.viewer, Date.now() + 2000);
    assert.ok(!later.some((c) => c.sell_id === gone.sell_id), 'the trade stays hidden');
    assert.ok(each.every((i) => first(later, i)), 'equal again');
  } finally {
    await f.remove();
  }
});
