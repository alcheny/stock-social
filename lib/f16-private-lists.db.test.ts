// F-16 fix round 1 (review item 2): a viewer's own lists never show a hidden trader's display name, symbol or return.
// Likes and hidden trades skip the trader like a deleted one (visibleUser); follows, Not interested and Record tools
// views keep the row (unfollow, Show again and Remove still work by handle) under the neutral HIDDEN_NOTICE.name.
// Scoped to this file's own users (shared database).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDb, people, ready, removePeople, trades } from './thesis-fixtures.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

dbTest("a hidden trader's name, symbol and return reach no liker's or follower's list; unfollow still works", async () => {
  const { sql } = await import('./db.ts');
  const { hideProfile, unhideProfile } = await import('./trust-hide.ts');
  const likes = await import('./likes.ts');
  const follows = await import('./follows.ts');
  const tools = await import('./record-tools.ts');
  const { HIDDEN_NOTICE } = await import('./copy.ts');
  const { tag, ids: [trader, viewer] } = await people(2, 'f16l');
  const NAME = `Sentinel ${tag}`;
  const SYM = `Z${tag.slice(-5).toUpperCase()}`;
  try {
    const [t1, t2] = await trades(trader, tag, 2);
    await sql`update users set display_name = ${NAME} where id = ${trader}`;
    await sql`update closed_trades set symbol = ${SYM}, return_pct = 4.321 where user_id = ${trader}`;
    const [{ handle }] = await sql`select handle from users where id = ${trader}`;
    assert.equal(await likes.like(viewer, t1.id), true);
    assert.equal(await likes.rejectTrade(viewer, t2.id), true);
    await follows.follow(viewer, trader);
    await follows.exclude(viewer, trader, 'not_interested');
    const v = await tools.createView(viewer, 'f16 view');
    assert.ok(v.ok);
    assert.equal((await tools.addTrader(viewer, v.id, handle)).ok, true);
    // Visible: everything shows the name.
    assert.equal((await likes.ownLikes(viewer)).rows[0]?.name, NAME);
    assert.equal((await follows.ownFollowing(viewer)).rows[0]?.name, NAME);
    assert.ok(await hideProfile(trader, 'abusive'));
    const seen = JSON.stringify([
      await likes.ownLikes(viewer), await likes.ownHiddenTrades(viewer), await likes.hiddenTradeCount(viewer),
      await follows.ownFollowing(viewer), await follows.ownHidden(viewer), await follows.expiredHidesPage(viewer),
      await follows.followHandles(viewer, 10), await tools.getView(viewer, v.id),
    ]);
    for (const leak of [NAME, SYM, '4.321']) assert.ok(!seen.includes(leak), `${leak} leaked: ${seen}`);
    assert.deepEqual((await likes.ownLikes(viewer)).rows, []);
    assert.deepEqual((await likes.ownHiddenTrades(viewer)).rows, []);
    assert.equal(await likes.hiddenTradeCount(viewer), 0);
    assert.deepEqual((await follows.ownFollowing(viewer)).rows, [{ handle, name: HIDDEN_NOTICE.name }]);
    assert.equal((await follows.ownHidden(viewer)).rows[0]?.name, HIDDEN_NOTICE.name);
    assert.deepEqual((await follows.followHandles(viewer, 10)).handles, []);
    assert.deepEqual((await tools.getView(viewer, v.id))?.traders, [{ id: trader, handle, name: HIDDEN_NOTICE.name }]);
    // Unfollow by id (the action resolves the handle with traderId) still works while hidden.
    assert.equal(await follows.traderId(handle), trader);
    await follows.unfollow(viewer, trader);
    assert.deepEqual((await follows.ownFollowing(viewer)).rows, []);
    // Unhide: the like comes back with its name.
    assert.ok(await unhideProfile(trader, 'issue-resolved'));
    assert.equal((await likes.ownLikes(viewer)).rows[0]?.name, NAME);
  } finally { await removePeople([trader, viewer]); }
});

// Orchestrator review item 1: a Record tools comparison card for a hidden trader reads nothing of theirs (exclusion
// counts, F-24's excluded_held among them, paper accounts, record state, institutions, account count) and claims no "Demo data": a neutral card.
dbTest("a hidden trader's comparison card is neutral: no figures, exclusions, connected line or record state", async () => {
  const { sql } = await import('./db.ts');
  const { hideProfile, unhideProfile } = await import('./trust-hide.ts');
  const tools = await import('./record-tools.ts');
  const { HIDDEN_NOTICE } = await import('./copy.ts');
  const { tag, ids: [trader] } = await people(1, 'f16c');
  try {
    await trades(trader, tag, 2);
    await sql`update users set excluded_positions = 2, excluded_future = 1, excluded_corporate = 1, excluded_held = 1 where id = ${trader}`;
    const [{ handle }] = await sql`select handle from users where id = ${trader}`;
    const [shown] = await tools.compareCards([{ id: trader, handle, name: 'x' }]);
    assert.equal(shown.notice, null);
    assert.equal(shown.excluded.length, 4); // F-24's excluded_held line too
    assert.ok(await hideProfile(trader, 'abusive'));
    const [c] = await tools.compareCards([{ id: trader, handle, name: HIDDEN_NOTICE.name }]);
    assert.deepEqual(c, {
      id: trader, handle, name: HIDDEN_NOTICE.name, notice: HIDDEN_NOTICE.line,
      state: 'none', badge: null, isNew: false, since: null, connected: null, closed: 0, figures: null, excluded: [],
    });
    assert.ok(!JSON.stringify(c).includes('Demo data'));
    assert.ok(await unhideProfile(trader, 'issue-resolved'));
    assert.equal((await tools.compareCards([{ id: trader, handle, name: 'x' }]))[0].notice, null);
  } finally { await removePeople([trader]); }
});
