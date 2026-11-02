// Orchestrator item after #82 (F-16/F-17 committee log): a thesis report names its close by the stable trade_key, so a
// report sent from a page rendered before a rebuild still reaches the note; a row id is still accepted with the same
// rules (lib/likes.ts#close does the same). Scoped to this file's own users (shared database).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDb, people, ready, removePeople, trades } from './thesis-fixtures.ts';
import { tradeKey } from './likes.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const allow = { allow: () => true };
const TEXT = 'Took profits into the gap; f16 trade key sentinel.';

dbTest('a report by trade_key reaches the note after a rebuild between render and report; the stale row id does not', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const { tag, ids: [trader, a, b] } = await people(3, 'f16k');
  try {
    const [t] = await trades(trader, tag, 1);
    await sql`update closed_trades set thesis = ${TEXT}, thesis_status = 'published' where id = ${t.id}`;
    const [{ trade_key: key }] = await sql`select trade_key from closed_trades where id = ${t.id}`;
    assert.equal(key, tradeKey(t.sell)); // what the card renders equals the stored key
    // The page renders now (it holds the row id and the key); then the record is rebuilt.
    const renderedId = String(t.id);
    await rebuildRecord(trader);
    const [after] = await sql`select id, thesis from closed_trades where user_id = ${trader} and sell_id = ${t.sell}`;
    assert.ok(after && String(after.id) !== renderedId, 'the rebuild gave the close a new row id');
    assert.equal(after.thesis, TEXT);
    assert.equal(await reportThesis(a, key, allow), 'reported');
    const rows = await sql`select reporter_id from thesis_reports where trader_id = ${trader} and sell_id = ${t.sell}`;
    assert.deepEqual(rows.map((r) => r.reporter_id), [a]);
    // The stale row id names nothing now: the neutral answer, nothing written.
    assert.equal(await reportThesis(b, renderedId, allow), 'not-found');
    assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${b}`)[0].n, 0);
    // A fresh row id still works, with the same rules (already reported by the same reader; own note).
    assert.equal(await reportThesis(a, String(after.id), allow), 'already');
    assert.equal(await reportThesis(trader, key, allow), 'own');
  } finally { await removePeople([trader, a, b]); }
});

dbTest('a malformed key is invalid; an unknown well-formed key is not-found', async () => {
  const { reportThesis } = await import('./reports.ts');
  const { ids: [a] } = await people(1, 'f16q');
  try {
    assert.equal(await reportThesis(a, 'g'.repeat(64), allow), 'invalid');
    assert.equal(await reportThesis(a, 'A'.repeat(64), allow), 'invalid');
    assert.equal(await reportThesis(a, '0'.repeat(64), allow), 'not-found');
  } finally { await removePeople([a]); }
});
