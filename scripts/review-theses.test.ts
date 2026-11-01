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

test('usage: anything but list [user_id] | publish <user_id> <sell_id> | keep <user_id> <sell_id> exits 2 and touches nothing', async () => {
  for (const argv of [[], ['delete', '1', 'x'], ['publish'], ['publish', 'abc', 'x'], ['keep', '1'], ['list', 'extra'], ['list', '1', '2']]) {
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
    // Fix round 3 (item 11): `list <user_id>` shows only that trader's held theses, so the shared database's other rows
    // never reach the assertions; each assertion reads its own row's line.
    const out: string[] = [];
    assert.equal(await run(['list', String(trader)], (l) => out.push(l)), 0);
    const lines = out.filter((l) => !l.startsWith('\t'));
    assert.ok(lines.length >= 3 && lines.every((l) => l.startsWith(`${trader}\t`)), 'only this trader');
    const line = (sell: string) => lines.find((l) => l.startsWith(`${trader}\t${sell}\t`)) ?? '';
    assert.match(line(t1.sell), /\trule: contact details\treports: 0$/);
    assert.match(line(t2.sell), /\trule: reports\treports: 3$/);
    assert.match(line(t3.sell), /\trule: contact details\treports: 0$/);
    // Publish the report-held one and a rule-held one; keep the third.
    for (const sell of [t2.sell, t1.sell]) assert.equal(await run(['publish', String(trader), sell], () => {}), 0);
    assert.equal(await run(['keep', String(trader), t3.sell], () => {}), 0);
    assert.equal(await run(['publish', String(trader), `${tag}-missing`], () => {}), 1);
    const rows = await sql`select sell_id, thesis_status, thesis_reviewed_at is not null as reviewed from closed_trades where user_id = ${trader} order by sell_id`;
    assert.deepEqual(rows.map((r) => [r.thesis_status, r.reviewed]), [['published', true], ['published', true], ['held', true]]);
    assert.equal((await sql`select count(*)::int as n from thesis_reports where trader_id = ${trader}`)[0].n, 3); // nothing deleted
  } finally { await removePeople([trader, a, b, c]); }
});

// Fix round 3 (item 11): a full page says so and how to narrow it.
dbTest('list with no held theses for a trader says so; the page cap is named when reached', async () => {
  const { tag, ids: [trader] } = await people(1, 'rw');
  void tag;
  try {
    const out: string[] = [];
    assert.equal(await run(['list', String(trader)], (l) => out.push(l)), 0);
    assert.deepEqual(out, ['No held theses.']);
    const { LIST_CAP } = await import('./review-theses.ts');
    assert.equal(LIST_CAP, 200);
  } finally { await removePeople([trader]); }
});

// Fix round 4: the "first N shown" line is printed only when more held theses exist than the cap, and names the cap.
dbTest('list with a small cap prints that many rows and the "first N shown" line; a cap above the count prints no such line', async () => {
  const { saveThesisFor } = await import('../lib/thesis-save.ts');
  const { tag, ids: [trader] } = await people(1, 'rx');
  try {
    const ts = await trades(trader, tag, 3);
    for (const t of ts) await saveThesisFor(trader, t.id, 'DM me for the setup');
    const out: string[] = [];
    assert.equal(await run(['list', String(trader)], (l) => out.push(l), 2), 0);
    assert.equal(out.filter((l) => l.startsWith(`${trader}\t`)).length, 2);
    assert.equal(out.at(-1), '(first 2 shown; pass a user id to narrow the list)');
    const all: string[] = [];
    assert.equal(await run(['list', String(trader)], (l) => all.push(l), 3), 0);
    assert.equal(all.filter((l) => l.startsWith(`${trader}\t`)).length, 3);
    assert.ok(!all.some((l) => l.startsWith('(first')), 'no cap line when everything is shown');
  } finally { await removePeople([trader]); }
});
