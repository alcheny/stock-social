// fix-user-text B (F-9): the owner-run release script can publish any held thesis, keep one held, list them, and refuses
// anything else with its usage line. It ships in the same change as the report hold (lib/reports.ts).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { hasDb, people, ready, removePeople, trades } from '../lib/thesis-fixtures.ts';
import { run } from './review-theses.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('../lib/db.ts')).sql.end({ timeout: 1 }); });

test('the release script ships beside the report hold', () => {
  assert.ok(existsSync(new URL('../lib/reports.ts', import.meta.url)));
  assert.ok(existsSync(new URL('./review-theses.ts', import.meta.url)));
});

test('usage: anything but list | publish <user_id> <sell_id> | keep <user_id> <sell_id> exits 2 and touches nothing', async () => {
  for (const argv of [[], ['delete', '1', 'x'], ['publish'], ['publish', 'abc', 'x'], ['keep', '1'], ['list', 'extra']]) {
    const out: string[] = [];
    assert.equal(await run(argv, (l) => out.push(l)), 2, argv.join(' '));
    assert.match(out[0], /^usage: /);
  }
});

dbTest('list shows held theses with rule and report count; publish releases any held thesis, keep keeps it; a wrong id exits 1', async () => {
  const { sql } = await import('../lib/db.ts');
  const { saveThesisFor } = await import('../lib/thesis-save.ts');
  const { reportThesis } = await import('../lib/reports.ts');
  const { tag, ids: [trader, a, b, c] } = await people(4, 'rv');
  try {
    const [t1, t2, t3] = await trades(trader, tag, 3);
    await saveThesisFor(trader, t1.id, 'DM me for the setup');
    await saveThesisFor(trader, t2.id, 'Ordinary note on the breakout.');
    for (const r of [a, b, c]) assert.notEqual(await reportThesis(r, t2.id, { allow: () => true }), 'rate');
    await saveThesisFor(trader, t3.id, 'DM me again');
    const out: string[] = [];
    assert.equal(await run(['list'], (l) => out.push(l)), 0);
    const text = out.join('\n');
    assert.ok(text.includes(`${trader}\t${t1.sell}\t`));
    assert.ok(text.includes(`${trader}\t${t2.sell}\t`));
    assert.match(text, /rule: reports\treports: 3/);
    // Publish the report-held one and a rule-held one; keep the third.
    for (const sell of [t2.sell, t1.sell]) assert.equal(await run(['publish', String(trader), sell], () => {}), 0);
    assert.equal(await run(['keep', String(trader), t3.sell], () => {}), 0);
    assert.equal(await run(['publish', String(trader), `${tag}-missing`], () => {}), 1);
    const rows = await sql`select sell_id, thesis_status, thesis_reviewed_at is not null as reviewed from closed_trades where user_id = ${trader} order by sell_id`;
    assert.deepEqual(rows.map((r) => [r.thesis_status, r.reviewed]), [['published', true], ['published', true], ['held', true]]);
    assert.equal((await sql`select count(*)::int as n from thesis_reports where trader_id = ${trader}`)[0].n, 3); // nothing deleted
  } finally { await removePeople([trader, a, b, c]); }
});
