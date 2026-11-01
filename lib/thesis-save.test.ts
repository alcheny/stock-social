// fix-user-text B (F-9): saving a thesis. Stored text carries no direction controls; a rule match is held with its rule;
// the first write is dated, a later edit is dated as an edit and clears an owner release; old theses get no invented
// date; the dates, rule and release survive rebuildTrades and the kept_theses path; the trade share data carries only
// published, cleaned text.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDb, people, ready, removePeople, trades } from './thesis-fixtures.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const BIDI = /[‪-‮⁦-⁩‎‏]/;

dbTest('saved thesis text contains no U+202A–202E, U+2066–2069 or U+200E/F; a match is held with its rule; clearing removes text and dates', async () => {
  const { sql } = await import('./db.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { tag, ids: [trader] } = await people(1);
  try {
    const [t1, t2] = await trades(trader, tag, 2);
    await saveThesisFor(trader, t1.id, 'Stop ‮ecnetnes‬ under ⁦the⁩ base ‎and‏ the 50-day.');
    await saveThesisFor(trader, t2.id, 'DM me for the next one');
    const rows = await sql`select id::text as id, thesis, thesis_status, thesis_hold_rule from closed_trades where user_id = ${trader} order by sell_id`;
    for (const r of rows) assert.doesNotMatch(r.thesis, BIDI);
    assert.equal(rows.find((r) => r.id === t1.id)!.thesis_status, 'published');
    const held = rows.find((r) => r.id === t2.id)!;
    assert.equal(held.thesis_status, 'held');
    assert.ok(typeof held.thesis_hold_rule === 'string' && held.thesis_hold_rule.length > 0, 'the matched rule is recorded');
    assert.equal(held.thesis, 'DM me for the next one'); // held, never dropped
    await saveThesisFor(trader, t2.id, '   ');
    assert.deepEqual({ ...(await sql`select thesis, thesis_status, thesis_hold_rule, thesis_written_at, thesis_edited_at from closed_trades where id = ${t2.id}`)[0] },
      { thesis: null, thesis_status: null, thesis_hold_rule: null, thesis_written_at: null, thesis_edited_at: null });
    // Someone else's trade and a malformed id change nothing.
    await saveThesisFor(trader + 1_000_000, t1.id, 'not mine');
    await saveThesisFor(trader, 'abc', 'bad id');
    assert.notEqual((await sql`select thesis from closed_trades where id = ${t1.id}`)[0].thesis, 'not mine');
  } finally { await removePeople([trader]); }
});

dbTest('dates: first write sets written_at; an edit sets edited_at, keeps written_at and clears a release; the same text changes nothing; an old thesis gets no invented date', async () => {
  const { sql } = await import('./db.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { tag, ids: [trader] } = await people(1);
  try {
    const [t1, t2] = await trades(trader, tag, 2);
    const row = async (id: string) => (await sql`select thesis, thesis_written_at, thesis_edited_at, thesis_reviewed_at from closed_trades where id = ${id}`)[0];
    await saveThesisFor(trader, t1.id, 'Sold at 2x ATR.');
    const first = await row(t1.id);
    assert.ok(first.thesis_written_at instanceof Date);
    assert.equal(first.thesis_edited_at, null);
    await sql`update closed_trades set thesis_reviewed_at = now() where id = ${t1.id}`;
    await saveThesisFor(trader, t1.id, 'Sold at 2x ATR.'); // same text: nothing changes
    assert.ok((await row(t1.id)).thesis_reviewed_at);
    assert.equal((await row(t1.id)).thesis_edited_at, null);
    await saveThesisFor(trader, t1.id, 'Sold at 2x ATR, a bit early.');
    const edited = await row(t1.id);
    assert.equal(edited.thesis_written_at.getTime(), first.thesis_written_at.getTime());
    assert.ok(edited.thesis_edited_at instanceof Date);
    assert.equal(edited.thesis_reviewed_at, null);
    // A thesis written before the columns existed: an edit dates the edit only, never the writing.
    await sql`update closed_trades set thesis = 'Old note.', thesis_status = 'published' where id = ${t2.id}`;
    await saveThesisFor(trader, t2.id, 'Old note, edited.');
    const old = await row(t2.id);
    assert.equal(old.thesis_written_at, null);
    assert.ok(old.thesis_edited_at instanceof Date);
  } finally { await removePeople([trader]); }
});

dbTest('thesis_written_at, thesis_edited_at, the hold rule and the release survive rebuildTrades and the kept_theses path', async () => {
  const { sql } = await import('./db.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const { tag, ids: [trader] } = await people(1);
  const account = `${tag}-acct`;
  try {
    const [t1, t2] = await trades(trader, tag, 2, account);
    await saveThesisFor(trader, t1.id, 'Earnings gap, sold into strength.');
    await saveThesisFor(trader, t1.id, 'Earnings gap, sold into strength the next day.');
    await saveThesisFor(trader, t2.id, 'DM me for entries');
    await sql`update closed_trades set thesis_reviewed_at = now() - interval '1 hour' where id = ${t2.id}`;
    const meta = async () => (await sql`select sell_id, thesis, thesis_status, thesis_hold_rule, thesis_written_at, thesis_edited_at, thesis_reviewed_at
      from closed_trades where user_id = ${trader} order by sell_id`).map((r) => ({ ...r }));
    const before = await meta();
    assert.ok(before[0].thesis_written_at && before[0].thesis_edited_at);
    await rebuildTrades(trader);
    assert.deepEqual(await meta(), before);
    // The account is flagged simulated: its trades leave, the theses with all their columns wait in kept_theses...
    await sql`insert into broker_accounts (account_id, user_id, is_paper) values (${account}, ${trader}, true)`;
    await rebuildTrades(trader);
    assert.deepEqual(await meta(), []);
    const kept = (await sql`select sell_id, thesis, thesis_status, thesis_hold_rule, thesis_written_at, thesis_edited_at, thesis_reviewed_at
      from kept_theses where user_id = ${trader} order by sell_id`).map((r) => ({ ...r }));
    assert.deepEqual(kept, before);
    // ...and come back unchanged when the flag clears.
    await sql`update broker_accounts set is_paper = false where account_id = ${account}`;
    await rebuildTrades(trader);
    assert.deepEqual(await meta(), before);
  } finally { await removePeople([trader]); }
});

dbTest('trade share data (page, card and link preview) carries only published, cleaned text', async () => {
  const { sql } = await import('./db.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { loadTradeShare } = await import('./trade-share-load.ts');
  const { tag, ids: [trader] } = await people(1);
  try {
    const [t1, t2] = await trades(trader, tag, 2);
    const [{ handle }] = await sql`select handle from users where id = ${trader}`;
    await saveThesisFor(trader, t1.id, 'Base ‮breakout‬ on volume.');
    await saveThesisFor(trader, t2.id, 'DM me for the next one');
    const a = await loadTradeShare(handle, t1.sell);
    assert.ok(a && a.thesis);
    assert.doesNotMatch(a.thesis, BIDI);
    assert.ok(a.note.writtenAt instanceof Date);
    const b = await loadTradeShare(handle, t2.sell);
    assert.equal(b!.thesis, null);
    assert.equal(b!.note.writtenAt, null); // a held note's dates stay private too
    assert.ok(!JSON.stringify(b).includes('DM me'));
  } finally { await removePeople([trader]); }
});

// ---- Fix round 3 ----

// Item 9: clearing a report-held note and writing it again never escapes the hold; a release resets it.
dbTest('a report hold survives clearing the note and writing it again; after a release an edit publishes', async () => {
  const { sql } = await import('./db.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { reportThesis } = await import('./reports.ts');
  const { releaseThesis } = await import('./thesis-review.ts');
  const { tag, ids: [trader, a, b, c] } = await people(4);
  const yes = { allow: () => true };
  try {
    const [t] = await trades(trader, tag, 1);
    const text = 'Bought the retest of the base, stop under the low.';
    await saveThesisFor(trader, t.id, text);
    for (const r of [a, b]) assert.equal(await reportThesis(r, t.id, yes), 'reported');
    assert.equal(await reportThesis(c, t.id, yes), 'held');
    const row = async () => ({ ...(await sql`select thesis, thesis_status, thesis_hold_rule from closed_trades where user_id = ${trader} and sell_id = ${t.sell}`)[0] });
    await saveThesisFor(trader, t.id, '');
    assert.equal((await row()).thesis, null);
    assert.equal((await row()).thesis_status, null);
    await saveThesisFor(trader, t.id, text);
    assert.deepEqual(await row(), { thesis: text, thesis_status: 'held', thesis_hold_rule: 'reports' });
    await saveThesisFor(trader, t.id, 'A different note entirely.');
    assert.deepEqual(await row(), { thesis: 'A different note entirely.', thesis_status: 'held', thesis_hold_rule: 'reports' });
    assert.equal(await releaseThesis(trader, t.sell, 'publish'), true);
    await saveThesisFor(trader, t.id, 'A different note, edited after the release.');
    assert.deepEqual(await row(), { thesis: 'A different note, edited after the release.', thesis_status: 'published', thesis_hold_rule: null });
  } finally { await removePeople([trader, a, b, c]); }
});

// Item 13: the schema's stored-text cleanup turns a thesis made only of stripped characters into no thesis (NULL,
// status NULL), never an empty published one. Only this test's own rows are touched.
dbTest('schema cleanup: a thesis of stripped characters only becomes NULL with no status; others keep theirs', async () => {
  const { sql } = await import('./db.ts');
  const { readFileSync } = await import('node:fs');
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const start = schema.indexOf('update closed_trades set thesis = nullif(btrim(regexp_replace(regexp_replace(thesis,');
  assert.ok(start > 0, 'the cleanup statement is in the schema');
  const stmt = schema.slice(start, schema.indexOf(';', start));
  const { tag, ids: [trader] } = await people(1);
  try {
    const [t1, t2] = await trades(trader, tag, 2);
    await sql`update closed_trades set thesis = ${'​‮⁦'}, thesis_status = 'published' where id = ${t1.id}`;
    await sql`update closed_trades set thesis = ${'Sto​p under the base'}, thesis_status = 'published' where id = ${t2.id}`;
    for (let i = 0; i < 2; i++) await sql.unsafe(`${stmt} and user_id = $1`, [trader]); // idempotent
    const rows = await sql`select id::text as id, thesis, thesis_status from closed_trades where user_id = ${trader} order by sell_id`;
    assert.deepEqual(rows.map((r) => [r.thesis, r.thesis_status]), [[null, null], ['Stop under the base', 'published']]);
  } finally { await removePeople([trader]); }
});

// Fix round 4 (item 5): after the cleanup, an emptied thesis carries no status, hold rule or dates, an emptied kept copy
// is not re-attached by rebuildTrades, and neither can be reported. Only this test's own rows are touched.
dbTest('schema cleanup: an emptied thesis loses its rule and dates; an emptied kept copy is never re-attached or reportable', async () => {
  const { sql } = await import('./db.ts');
  const { readFileSync } = await import('node:fs');
  const { rebuildTrades } = await import('./sync.ts');
  const { reportThesis } = await import('./reports.ts');
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const stmt = (head: string) => {
    const start = schema.indexOf(head);
    assert.ok(start > 0, head);
    return schema.slice(start, schema.indexOf(';', start));
  };
  const strip = stmt('update closed_trades set thesis = nullif(btrim(regexp_replace(regexp_replace(thesis,');
  const stripKept = stmt('update kept_theses set thesis = regexp_replace(regexp_replace(thesis,');
  const clear = stmt('update closed_trades set thesis_status = null, thesis_hold_rule = null,');
  const clearKept = stmt("update kept_theses set thesis = '', thesis_status = null,");
  const { tag, ids: [trader, a] } = await people(2);
  try {
    const [t1, t2, t3] = await trades(trader, tag, 3);
    await sql`update closed_trades set thesis = ${'​‮'}, thesis_status = 'held', thesis_hold_rule = 'link',
      thesis_written_at = now(), thesis_edited_at = now(), thesis_reviewed_at = now() where id = ${t1.id}`;
    // A kept copy for t2's sell, made only of stripped characters, still marked published with a rule and dates.
    await sql`insert into kept_theses (user_id, sell_id, thesis, thesis_status, thesis_hold_rule, thesis_written_at)
      values (${trader}, ${t2.sell}, ${'​ ⁦'}, 'published', 'link', now())`;
    await sql`update closed_trades set thesis = 'Kept as it is.', thesis_status = 'published', thesis_written_at = now() where id = ${t3.id}`;
    for (let i = 0; i < 2; i++) { // idempotent
      await sql.unsafe(`${strip} and user_id = $1`, [trader]);
      await sql.unsafe(`${stripKept} and user_id = $1`, [trader]);
      await sql.unsafe(`${clear} and user_id = $1`, [trader]);
      await sql.unsafe(`${clearKept} and user_id = $1`, [trader]);
    }
    const [r1] = await sql`select thesis, thesis_status, thesis_hold_rule, thesis_written_at, thesis_edited_at, thesis_reviewed_at from closed_trades where id = ${t1.id}`;
    assert.deepEqual({ ...r1 }, { thesis: null, thesis_status: null, thesis_hold_rule: null, thesis_written_at: null, thesis_edited_at: null, thesis_reviewed_at: null });
    const [k] = await sql`select thesis, thesis_status, thesis_hold_rule, thesis_written_at from kept_theses where user_id = ${trader} and sell_id = ${t2.sell}`;
    assert.deepEqual({ ...k }, { thesis: '', thesis_status: null, thesis_hold_rule: null, thesis_written_at: null });
    const [r3] = await sql`select thesis, thesis_status from closed_trades where id = ${t3.id}`;
    assert.deepEqual({ ...r3 }, { thesis: 'Kept as it is.', thesis_status: 'published' });
    await rebuildTrades(trader);
    const rows = await sql`select id::text as id, sell_id, thesis, thesis_status from closed_trades where user_id = ${trader} order by sell_id`;
    assert.deepEqual(rows.map((r) => [r.thesis, r.thesis_status]), [[null, null], [null, null], ['Kept as it is.', 'published']]);
    // Even a stray empty note row is never reportable.
    await sql`update closed_trades set thesis = '', thesis_status = 'published' where id = ${rows[1].id}`;
    assert.equal(await reportThesis(a, rows[1].id, { allow: () => true }), 'not-found');
    assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${a}`)[0].n, 0);
  } finally { await removePeople([trader, a]); }
});
