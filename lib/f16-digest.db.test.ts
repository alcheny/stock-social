// F-16 owner digest (plan docs/features/logs/F-16-F-17/plan.md §5.6; AC-F16 #11, #12, #20): a terminal script, under-18
// first even at 0, counts and links from siteUrl, held and hidden counts, repeat unfounded reporters, the last sync tick
// and stoppedAtDeadline; a resolve path; the only notification text carries no handle, name, thesis, symbol or return;
// never imports the session. Scoped to this file's own users (shared database).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasDb, people, ready, removePeople, trades } from './thesis-fixtures.ts';
import { DIGEST_ORDER, UNDER_18, digestNotice, formatDigest, type Digest } from './trust-digest.ts';
import { REPORT_CATEGORIES } from './report-copy.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const yes = { allow: () => true };
const code = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const empty = (): Digest => ({
  open: 0, openProfiles: 0, held: 0, hiddenProfiles: 0, hiddenTheses: 0, repeatUnfounded: 0, lastTick: null, stoppedAtDeadline: false,
  groups: DIGEST_ORDER.map((c) => ({ category: c, label: REPORT_CATEGORIES.find((x) => x.code === c)!.label, reports: 0, profileCount: 0, profiles: [] })),
});

test('under-18 is always the first group, even at 0; the other categories keep the form order', () => {
  assert.equal(DIGEST_ORDER[0], UNDER_18);
  assert.equal(DIGEST_ORDER.length, REPORT_CATEGORIES.length);
  const lines = formatDigest(empty(), 'https://example.test');
  assert.equal(lines[0], 'Open profile reports: 0 on 0 profiles');
  assert.equal(lines[1], '  May be under 18: 0');
  assert.match(lines.at(-1)!, /^Last sync tick: none; stopped at deadline: no$/);
});

test('the notification text carries counts only: no handle, name, thesis, symbol or return', () => {
  const d = empty();
  d.open = 3; d.openProfiles = 1; d.held = 2; d.hiddenTheses = 1;
  d.groups[0] = { ...d.groups[0], reports: 3, profileCount: 1, profiles: [{ handle: 'sentinel_handle', reports: 3 }] };
  const n = digestNotice(d);
  assert.equal(n, 'Trust and safety: 3 open profile reports (3 may be under 18), 2 held theses, 1 hidden items. Run scripts/trust-digest.ts for details.');
  assert.doesNotMatch(n, /sentinel|@|%|\$|\b[A-Z]{2,5}\b/);
  // The module exposes no other text builder that could leave the terminal, and no sender.
  const s = code('./trust-digest.ts');
  assert.doesNotMatch(s, /mail|smtp|fetch\(|webhook/i);
  for (const f of ['./trust-digest.ts', '../scripts/trust-digest.ts']) assert.doesNotMatch(code(f), /session\.ts'|next\/headers|currentUser|cookies\(/, f);
});

dbTest('digest: open reports by category (under-18 first), links, held and hidden counts, resolve, repeat unfounded', async () => {
  const { sql } = await import('./db.ts');
  const { reportProfile } = await import('./reports.ts');
  const { digest, repeatUnfounded, resolveReport, reportsOn } = await import('./trust-digest.ts');
  const { hideProfile, hideThesis } = await import('./trust-hide.ts');
  const { run } = await import('../scripts/trust-digest.ts');
  const { tag, ids } = await people(6, 'f16g');
  const [a, b, r1, r2, r3, hid] = ids;
  const hs = new Map((await sql`select id, handle from users where id = any(${ids})`).map((x) => [x.id as number, x.handle as string]));
  const age = () => sql`update thesis_reports set created_at = created_at - interval '61 seconds' where reporter_id = any(${ids})`;
  try {
    assert.equal(await reportProfile(r1, hs.get(a), 'may-be-under-18', yes), 'reported');
    assert.equal(await reportProfile(r2, hs.get(a), 'abusive', yes), 'reported');
    assert.equal(await reportProfile(r3, hs.get(b), 'abusive', yes), 'reported');
    await age();
    assert.equal(await reportProfile(r1, hs.get(b), 'abusive', yes), 'reported');
    const [t1, t2] = await trades(b, tag, 2);
    await sql`update closed_trades set thesis = 'f16 sentinel note', thesis_status = 'published' where id = any(${[t1.id, t2.id]})`;
    await sql`update closed_trades set thesis_status = 'held', thesis_hold_rule = 'link' where id = ${t2.id}`;
    assert.equal(await hideThesis(b, t1.sell, 'abusive'), true);
    assert.equal(await hideProfile(hid, 'legal-notice'), true);

    let d = await digest(ids);
    assert.equal(d.open, 4);
    assert.equal(d.openProfiles, 2);
    assert.equal(d.groups[0].category, 'may-be-under-18');
    assert.deepEqual(d.groups[0].profiles, [{ handle: hs.get(a), reports: 1 }]);
    const abusive = d.groups.find((g) => g.category === 'abusive')!;
    assert.equal(abusive.reports, 3);
    assert.deepEqual(abusive.profiles, [{ handle: hs.get(b), reports: 2 }, { handle: hs.get(a), reports: 1 }]);
    assert.equal(d.held, 1); // the link hold; the owner's hide counts under hiddenTheses only (fix round 1, item 6)
    assert.equal(d.hiddenTheses, 1);
    assert.equal(d.hiddenProfiles, 1);
    const lines = formatDigest(d, 'https://site.test');
    assert.equal(lines[1], `  May be under 18: 1 — https://site.test/u/${hs.get(a)} (1)`);
    assert.ok(lines.some((l) => l === `  Abusive or hateful name or note: 3 — https://site.test/u/${hs.get(b)} (2), https://site.test/u/${hs.get(a)} (1)`));
    assert.ok(!lines.join('\n').includes('sentinel'), 'no thesis text');
    assert.ok(!lines.join('\n').includes(hs.get(r1)!), 'no reporter');
    assert.ok(typeof d.stoppedAtDeadline === 'boolean');
    assert.ok(d.lastTick === null || d.lastTick instanceof Date);

    // Resolve: open → resolved; twice is a no-op; resolving hides nothing.
    assert.equal(await resolveReport(r1, b, 'unfounded'), true);
    assert.equal(await resolveReport(r1, b, 'unfounded'), false);
    assert.equal(await resolveReport(r1, a, 'unfounded'), true);
    assert.equal(await resolveReport(r2, a, 'bogus' as never), false);
    assert.deepEqual(await repeatUnfounded(ids), [{ reporterId: r1, unfounded: 2 }]);
    d = await digest(ids);
    assert.equal(d.open, 2);
    assert.equal(d.repeatUnfounded, 1);
    assert.equal(d.groups[0].reports, 0);
    assert.equal((await sql`select hidden_at from users where id = ${a}`)[0].hidden_at, null);
    assert.deepEqual((await reportsOn(a)).map((x) => [x.reporterId, x.category, x.resolution]), [[r1, 'may-be-under-18', 'unfounded'], [r2, 'abusive', null]]);

    // The CLI: resolve and reports; bad input is usage (exit 2).
    const out: string[] = [];
    assert.equal(await run(['resolve', String(r2), String(a), 'founded'], (l) => out.push(l)), 0);
    assert.deepEqual(out, ['Resolved (founded).']);
    assert.equal(await run(['resolve', String(r2), String(a), 'maybe'], () => {}), 2);
    assert.equal(await run(['reports', String(a)], (l) => out.push(l)), 0);
    assert.equal(out.length, 3);
    const all: string[] = [];
    assert.equal(await run([], (l) => all.push(l), { NEXT_PUBLIC_SITE_URL: 'https://site.test' }), 0);
    assert.match(all[1], /^ {2}May be under 18: \d+/);
    assert.match(all.at(-1)!, /^Last sync tick: .*; stopped at deadline: (yes|no)$/);
  } finally { await removePeople(ids); }
});

dbTest('fix 6: a hidden thesis is counted once (hiddenTheses), never also as held', async () => {
  const { sql } = await import('./db.ts');
  const { digest } = await import('./trust-digest.ts');
  const { hideThesis } = await import('./trust-hide.ts');
  const { tag, ids: [u] } = await people(1, 'f16d');
  try {
    const [t1, t2, t3] = await trades(u, tag, 3);
    await sql`update closed_trades set thesis = 'f16 digest note', thesis_status = 'published' where id = any(${[t1.id, t2.id, t3.id]})`;
    await sql`update closed_trades set thesis_status = 'held', thesis_hold_rule = 'link' where id = ${t3.id}`;
    assert.equal(await hideThesis(u, t1.sell, 'abusive'), true);
    assert.equal(await hideThesis(u, t2.sell, 'abusive'), true);
    const d = await digest([u]);
    assert.equal(d.hiddenTheses, 2);
    assert.equal(d.held, 1);
    assert.match(digestNotice(d), /1 held theses, 2 hidden items/);
  } finally { await removePeople([u]); }
});
