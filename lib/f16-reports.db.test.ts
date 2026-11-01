// F-16 profile reports on the database (plan docs/features/logs/F-16-F-17/plan.md §5.5; AC-F16 #3, #4, #7, #20, #21,
// #22; v2 E10). A report never hides anything at any count or category; one per reporter per profile, ever; per-reporter
// and per-target limits; the reported trader's own reads and export never carry the reporter. Scoped to this file's own
// users (shared database); no global counts.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDb, people, ready, removePeople } from './thesis-fixtures.ts';
import { REPORT_HOLD_AT } from './reports.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const yes = { allow: () => true };

async function handles(ids: number[]) {
  const { sql } = await import('./db.ts');
  const rows = await sql`select id, handle from users where id = any(${ids})`;
  return new Map(rows.map((r) => [r.id as number, r.handle as string]));
}
// Lets the next report through the one-a-minute rule (and, past 10, the per-target hour), without waiting.
async function age(ids: number[], seconds: number) {
  const { sql } = await import('./db.ts');
  await sql`update thesis_reports set created_at = created_at - ${seconds} * interval '1 second' where reporter_id = any(${ids}) or trader_id = any(${ids})`;
}

dbTest('many distinct reporters (3 × REPORT_HOLD_AT + 1) and 20 under-18 reports hide nothing: the profile stays public', async () => {
  const { sql } = await import('./db.ts');
  const { reportProfile } = await import('./reports.ts');
  const { visibleUser } = await import('./visible-users.ts');
  const n = 3 * REPORT_HOLD_AT + 1;
  const { ids } = await people(1 + n, 'f16m');
  const { ids: kids } = await people(21, 'f16k');
  const [trader, ...reporters] = ids;
  const [young, ...kidReporters] = kids;
  const h = await handles([trader, young]);
  try {
    for (const [i, r] of reporters.entries()) {
      assert.equal(await reportProfile(r, h.get(trader), i % 2 ? 'abusive' : 'impersonation-elsewhere', yes), 'reported', `reporter ${i}`);
    }
    const shown = async (id: number) => (await sql`select hidden_at, (select count(*)::int from users v where v.id = ${id} and ${visibleUser('v')}) as visible from users where id = ${id}`)[0];
    assert.deepEqual({ ...(await shown(trader)) }, { hidden_at: null, visible: 1 });
    for (const [i, r] of kidReporters.entries()) {
      if (i === 10) await age(kidReporters, 3_700); // past the per-target hour for the second ten
      assert.equal(await reportProfile(r, h.get(young), 'may-be-under-18', yes), 'reported', `under-18 reporter ${i}`);
      if (i === 0) assert.deepEqual({ ...(await shown(young)) }, { hidden_at: null, visible: 1 });
    }
    assert.deepEqual({ ...(await shown(young)) }, { hidden_at: null, visible: 1 });
    // Nothing else changed either: no audit row, no thesis held.
    assert.equal((await sql`select count(*)::int as n from trust_audit where user_id = any(${[trader, young]})`)[0].n, 0);
    // Every profile row: target 'profile' exactly when sell_id is empty, with a fixed category.
    const rows = await sql`select target, sell_id, category from thesis_reports where trader_id = any(${[trader, young]})`;
    assert.equal(rows.length, n + 20);
    for (const r of rows) assert.deepEqual({ target: r.target, sell_id: r.sell_id }, { target: 'profile', sell_id: '' });
    assert.ok(rows.every((r) => ['abusive', 'impersonation-elsewhere', 'may-be-under-18'].includes(r.category)));
  } finally { await removePeople([...ids, ...kids]); }
});

dbTest('own, already (ever, even after the owner resolves it), one a minute, not-found for hidden or deleted', async () => {
  const { sql } = await import('./db.ts');
  const { reportProfile } = await import('./reports.ts');
  const { resolveReport } = await import('./trust-digest.ts');
  const { ids: [a, b, c, d, r] } = await people(5, 'f16o');
  const h = await handles([a, b, c, d, r]);
  try {
    assert.equal(await reportProfile(a, h.get(a), 'abusive', yes), 'own');
    assert.equal(await reportProfile(r, h.get(a), 'abusive', yes), 'reported');
    assert.equal(await reportProfile(r, h.get(a), 'personal-information', yes), 'already');
    assert.equal(await reportProfile(r, h.get(b), 'abusive', yes), 'rate'); // a second target within a minute
    await age([r], 61);
    assert.equal(await resolveReport(r, a, 'unfounded'), true);
    assert.equal(await reportProfile(r, h.get(a), 'abusive', yes), 'already'); // ever
    await sql`update users set hidden_at = now() where id = ${c}`;
    await sql`update users set deleted_at = now() where id = ${d}`;
    assert.equal(await reportProfile(r, h.get(c), 'abusive', yes), 'not-found');
    assert.equal(await reportProfile(r, h.get(d), 'abusive', yes), 'not-found');
    assert.equal(await reportProfile(r, 'nobodyf16x', 'abusive', yes), 'not-found');
    // A thesis report counts against the same one-a-minute rule (one reporter, any target).
    assert.equal(await reportProfile(r, h.get(b), 'abusive', yes), 'reported');
    assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${r}`)[0].n, 2);
  } finally { await removePeople([a, b, c, d, r]); }
});

dbTest('per reporter: the shared daily limiter (5 a day) refuses the sixth and rolls the report back', async () => {
  const { sql } = await import('./db.ts');
  const { reportProfile, PROFILE_REPORTS_PER_DAY } = await import('./reports.ts');
  const { ids } = await people(PROFILE_REPORTS_PER_DAY + 2, 'f16d');
  const [r, ...targets] = ids;
  const h = await handles(targets);
  try {
    for (const [i, t] of targets.entries()) {
      const out = await reportProfile(r, h.get(t), 'abusive'); // the real limiter (lib/rate-limit.ts#hit)
      assert.equal(out, i < PROFILE_REPORTS_PER_DAY ? 'reported' : 'rate', `report ${i + 1}`);
      await age([r], 61);
    }
    assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${r}`)[0].n, PROFILE_REPORTS_PER_DAY);
    // An injected refusal also rolls back.
    const { ids: [x, y] } = await people(2, 'f16e');
    try {
      assert.equal(await reportProfile(x, (await handles([y])).get(y), 'abusive', { allow: () => false }), 'rate');
      assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${x}`)[0].n, 0);
    } finally { await removePeople([x, y]); }
  } finally { await removePeople(ids); }
});

dbTest('per target: 10 reports an hour, the 11th refused; parallel reports never pass the limit (lock after lookup)', async () => {
  const { sql } = await import('./db.ts');
  const { reportProfile, PROFILE_REPORTS_PER_TARGET_HOUR } = await import('./reports.ts');
  const { ids } = await people(PROFILE_REPORTS_PER_TARGET_HOUR + 4, 'f16t');
  const [trader, ...reporters] = ids;
  const h = (await handles([trader])).get(trader);
  try {
    const outs = await Promise.all(reporters.map((r) => reportProfile(r, h, 'pretends-to-be-someone', yes)));
    assert.equal(outs.filter((o) => o === 'reported').length, PROFILE_REPORTS_PER_TARGET_HOUR);
    assert.equal(outs.filter((o) => o === 'rate').length, reporters.length - PROFILE_REPORTS_PER_TARGET_HOUR);
    assert.equal((await sql`select count(*)::int as n from thesis_reports where trader_id = ${trader}`)[0].n, PROFILE_REPORTS_PER_TARGET_HOUR);
    // One reporter pressing twice at once: one report, the other answer is already (or the minute rule).
    const { ids: [t2, r2] } = await people(2, 'f16p');
    try {
      const h2 = (await handles([t2])).get(t2);
      const two = await Promise.all([reportProfile(r2, h2, 'abusive', yes), reportProfile(r2, h2, 'abusive', yes)]);
      assert.deepEqual(two.sort(), ['already', 'reported']);
    } finally { await removePeople([t2, r2]); }
  } finally { await removePeople(ids); }
});

dbTest('the reported trader\'s own reads and data export never carry the reporter', async () => {
  const { reportProfile } = await import('./reports.ts');
  const { exportFor } = await import('./record-tools.ts');
  const { profileReads } = await import('../app/u/[handle]/load.ts');
  const { ids: [trader, r] } = await people(2, 'f16i');
  const h = await handles([trader, r]);
  try {
    assert.equal(await reportProfile(r, h.get(trader), 'impersonation-elsewhere', yes), 'reported');
    const reads = profileReads((f) => f);
    const seen = JSON.stringify({ user: await reads.user(h.get(trader)!), trades: await reads.trades(trader), export: await exportFor(trader) });
    assert.ok(!seen.includes(h.get(r)!), 'no reporter handle');
    assert.doesNotMatch(seen, /reporter|impersonation-elsewhere|"category"/);
  } finally { await removePeople([trader, r]); }
});
