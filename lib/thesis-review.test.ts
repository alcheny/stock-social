// fix-user-text B (F-9): the release path and the start-up re-check. Publishing a held thesis makes it public and marks
// it released; keeping it marks it reviewed and leaves it held; neither deletes. remoderateAll flips published → held
// only, skips released theses, covers kept_theses, and returns counts. The review page's flag is off by default and
// always off in production, and the page never reads the session.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasDb, people, ready, removePeople, trades } from './thesis-fixtures.ts';
import { reviewQueueOn } from './thesis-review.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

test('review queue flag: off by default, on only with REVIEW_QUEUE=1 outside production', () => {
  assert.equal(reviewQueueOn({}), false);
  assert.equal(reviewQueueOn({ REVIEW_QUEUE: '0', NODE_ENV: 'development' }), false);
  assert.equal(reviewQueueOn({ REVIEW_QUEUE: 'true', NODE_ENV: 'development' }), false);
  assert.equal(reviewQueueOn({ REVIEW_QUEUE: '1', NODE_ENV: 'production' }), false);
  assert.equal(reviewQueueOn({ REVIEW_QUEUE: '1', NODE_ENV: 'development' }), true);
});

test('the review page 404s unless the flag is on, and reads no session or viewer (no admin rights from the dev stub)', () => {
  const page = readFileSync(new URL('../app/review/theses/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /if \(!reviewQueueOn\(\)\) notFound\(\);/);
  assert.ok(page.indexOf('notFound()') < page.indexOf('listHeld()'), 'the flag is checked before anything is read');
  assert.doesNotMatch(page, /lib\/session|lib\/viewer|currentUser|viewerId|cookies|actions\.ts/);
  assert.doesNotMatch(page, /<form|action=/, 'read-only');
  // Fix round 1: the vendor's activity id is never rendered (only as a React key); the trade is named by symbol and date.
  const uses = page.split('\n').filter((l) => !l.trim().startsWith('//') && /sellId|sell_id/.test(l));
  assert.equal(uses.length, 1);
  assert.match(uses[0], /^\s*<li key=\{`\$\{r\.userId\}-\$\{r\.sellId\}`\}>$/);
  assert.match(page, /r\.symbol/);
  assert.match(page, /r\.closedAt/);
  const lib = readFileSync(new URL('./thesis-review.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(lib, /import[^\n]*(session|viewer)/);
});

dbTest('publish releases a held thesis; keep leaves it held and reviewed; neither deletes; a missing one is refused', async () => {
  const { sql } = await import('./db.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { releaseThesis, listHeld } = await import('./thesis-review.ts');
  const { tag, ids: [trader] } = await people(1);
  try {
    const [t1, t2, t3] = await trades(trader, tag, 3);
    await saveThesisFor(trader, t1.id, 'DM me, first');
    await saveThesisFor(trader, t2.id, 'DM me, second');
    await saveThesisFor(trader, t3.id, 'Plain note on the base.');
    const mine = (await listHeld(10_000)).filter((r) => r.userId === trader);
    assert.deepEqual(mine.map((r) => r.sellId), [t1.sell, t2.sell]);
    assert.ok(mine.every((r) => r.rule && r.reports === 0 && !r.reviewed));
    assert.equal(await releaseThesis(trader, t1.sell, 'publish'), true);
    assert.equal(await releaseThesis(trader, t2.sell, 'keep'), true);
    assert.equal(await releaseThesis(trader, t3.sell, 'publish'), false); // not held
    assert.equal(await releaseThesis(trader, `${tag}-nope`, 'publish'), false);
    const rows = await sql`select sell_id, thesis, thesis_status, thesis_hold_rule, thesis_reviewed_at is not null as reviewed from closed_trades where user_id = ${trader} order by sell_id`;
    assert.deepEqual(rows.map((r) => [r.thesis, r.thesis_status, r.reviewed]), [['DM me, first', 'published', true], ['DM me, second', 'held', true], ['Plain note on the base.', 'published', false]]);
    assert.equal(rows[0].thesis_hold_rule, null);
    assert.ok(rows[1].thesis_hold_rule);
    // A released thesis is public again: an edit starts moderation again (and clears the release).
    await saveThesisFor(trader, t1.id, 'DM me, first, edited');
    assert.equal((await sql`select thesis_status from closed_trades where id = ${t1.id}`)[0].thesis_status, 'held');
  } finally { await removePeople([trader]); }
});

dbTest('remoderateAll: published → held only, released theses skipped, kept_theses covered, counts returned; held never flips back', async () => {
  const { sql } = await import('./db.ts');
  const { remoderateAll } = await import('./thesis-review.ts');
  const { tag, ids: [trader, other] } = await people(2);
  try {
    const [t1, t2, t3, t4] = await trades(trader, tag, 4);
    await sql`update closed_trades set thesis = 'Join my group, DM me', thesis_status = 'published' where id = ${t1.id}`;
    await sql`update closed_trades set thesis = 'DM me, released by the owner', thesis_status = 'published', thesis_reviewed_at = now() where id = ${t2.id}`;
    await sql`update closed_trades set thesis = 'Held but clean now', thesis_status = 'held', thesis_hold_rule = 'link' where id = ${t3.id}`;
    await sql`update closed_trades set thesis = 'Bought the retest of the breakout.', thesis_status = 'published' where id = ${t4.id}`;
    await sql`insert into kept_theses (user_id, sell_id, thesis, thesis_status) values (${trader}, ${`${tag}-gone`}, 'DM me (kept)', 'published'), (${trader}, ${`${tag}-gone2`}, 'Clean kept note.', 'published')`;
    const r = await remoderateAll([trader, other]);
    assert.deepEqual(r, { checked: 4, held: 2 });
    const st = (await sql`select id::text as id, thesis_status, thesis_hold_rule from closed_trades where user_id = ${trader}`).reduce((m, x) => m.set(x.id, [x.thesis_status, x.thesis_hold_rule]), new Map());
    assert.equal(st.get(t1.id)[0], 'held');
    assert.ok(st.get(t1.id)[1]);
    assert.deepEqual(st.get(t2.id), ['published', null]); // released: skipped
    assert.deepEqual(st.get(t3.id), ['held', 'link']); // never held → published
    assert.deepEqual(st.get(t4.id), ['published', null]);
    assert.deepEqual((await sql`select sell_id, thesis_status from kept_theses where user_id = ${trader} order by sell_id`).map((x) => [x.sell_id, x.thesis_status]),
      [[`${tag}-gone`, 'held'], [`${tag}-gone2`, 'published']]);
    assert.deepEqual(await remoderateAll([trader]), { checked: 2, held: 0 }); // idempotent
  } finally { await removePeople([trader, other]); }
});
