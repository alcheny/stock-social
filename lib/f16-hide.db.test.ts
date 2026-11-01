// F-16 owner hide and unhide on the database (plan docs/features/logs/F-16-F-17/plan.md §5.3; AC-F16 #8, #9, #24; v2
// B2, E6). Only a whole profile or a thesis; one audit row per change in the same transaction (a failing audit leaves
// nothing hidden); nothing is removed; a hidden thesis stays hidden through the trader's edit, clear and rewrite; unhide
// follows the latest audit row. Scoped to this file's own users (shared database).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDb, people, ready, removePeople, trades } from './thesis-fixtures.ts';
import { HIDDEN_LINE, HIDDEN_RULE, heldLine } from './report-copy.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const failing = { audit: async () => { throw new Error('audit insert failed'); } };
const TEXT = 'Sold into strength after the gap; f16 sentinel text.';

async function counts(userId: number) {
  const { sql } = await import('./db.ts');
  const [c] = await sql`select
    (select count(*)::int from closed_trades where user_id = ${userId}) as trades,
    (select count(*)::int from activities where user_id = ${userId}) as activities,
    (select count(*)::int from kept_theses where user_id = ${userId}) as kept,
    (select count(*)::int from thesis_reports where trader_id = ${userId}) as reports,
    (select count(*)::int from users where id = ${userId}) as users`;
  return { ...c };
}
const lines = () => { const l: string[] = []; return { out: (s: string) => { l.push(s); }, l }; };

dbTest('profile: hide and unhide write one audit row each, change only hidden_at, and remove nothing', async () => {
  const { sql } = await import('./db.ts');
  const { hideProfile, unhideProfile, hideHistory } = await import('./trust-hide.ts');
  const { HIDE_REASONS, UNHIDE_REASONS } = await import('./trust-hide-reasons.ts');
  const { tag, ids: [u] } = await people(1, 'f16h');
  try {
    await trades(u, tag, 2);
    const before = await counts(u);
    assert.equal(await hideProfile(u, 'impersonation-elsewhere'), true);
    assert.ok((await sql`select hidden_at from users where id = ${u}`)[0].hidden_at instanceof Date);
    assert.equal(await hideProfile(u, 'abusive'), false); // already hidden: nothing written
    assert.equal(await unhideProfile(u, 'report-unfounded'), true);
    assert.equal((await sql`select hidden_at from users where id = ${u}`)[0].hidden_at, null);
    assert.equal(await unhideProfile(u, 'report-unfounded'), false);
    assert.deepEqual(await counts(u), before);
    const h = await hideHistory(u);
    assert.deepEqual(h.map((r) => [r.kind, r.user_id, r.sell_id, r.action, r.reason, r.actor]), [
      ['profile', u, null, 'hide', 'impersonation-elsewhere', 'owner'], ['profile', u, null, 'unhide', 'report-unfounded', 'owner']]);
    for (const r of h) {
      assert.ok(r.at instanceof Date);
      assert.ok((r.action === 'hide' ? HIDE_REASONS : UNHIDE_REASONS as readonly string[]).includes(r.reason));
    }
  } finally { await removePeople([u]); }
});

dbTest('a failing audit insert rolls the hide back: no hidden profile, no hidden thesis, no audit row', async () => {
  const { sql } = await import('./db.ts');
  const { hideProfile, hideThesis } = await import('./trust-hide.ts');
  const { run } = await import('../scripts/hide.ts');
  const { tag, ids: [u] } = await people(1, 'f16f');
  try {
    const [t] = await trades(u, tag, 1);
    await sql`update closed_trades set thesis = ${TEXT}, thesis_status = 'published' where id = ${t.id}`;
    await assert.rejects(hideProfile(u, 'abusive', 'owner', failing), /audit insert failed/);
    await assert.rejects(hideThesis(u, t.sell, 'abusive', 'owner', failing), /audit insert failed/);
    await assert.rejects(run(['profile', String(u), 'abusive'], lines().out, {}, failing), /audit insert failed/);
    assert.equal((await sql`select hidden_at from users where id = ${u}`)[0].hidden_at, null);
    assert.deepEqual({ ...(await sql`select thesis_status, thesis_hold_rule from closed_trades where id = ${t.id}`)[0] }, { thesis_status: 'published', thesis_hold_rule: null });
    assert.equal((await sql`select count(*)::int as n from trust_audit where user_id = ${u}`)[0].n, 0);
  } finally { await removePeople([u]); }
});

dbTest('thesis: hidden (held, rule hidden), the author sees HIDDEN_LINE, an edit keeps it hidden, review release cannot unhide', async () => {
  const { sql } = await import('./db.ts');
  const { hideThesis, unhideThesis } = await import('./trust-hide.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { releaseThesis, listHeld } = await import('./thesis-review.ts');
  const { tag, ids: [u] } = await people(1, 'f16s');
  try {
    const [t, t2] = await trades(u, tag, 2);
    await saveThesisFor(u, t.id, TEXT);
    const row = async () => ({ ...(await sql`select thesis, thesis_status, thesis_hold_rule from closed_trades where id = ${t.id}`)[0] });
    assert.equal((await row()).thesis_status, 'published');
    const before = await counts(u);
    assert.equal(await hideThesis(u, t2.sell, 'abusive'), false); // no published thesis there: refused, nothing written
    assert.equal(await hideThesis(u, t.sell, 'personal-information'), true);
    assert.deepEqual(await row(), { thesis: TEXT, thesis_status: 'held', thesis_hold_rule: HIDDEN_RULE });
    assert.equal(heldLine((await row()).thesis_hold_rule), HIDDEN_LINE); // B2: the author's own view
    await saveThesisFor(u, t.id, `${TEXT} Edited.`);
    assert.deepEqual(await row(), { thesis: `${TEXT} Edited.`, thesis_status: 'held', thesis_hold_rule: HIDDEN_RULE });
    assert.equal(await releaseThesis(u, t.sell, 'publish'), false);
    assert.equal(await releaseThesis(u, t.sell, 'keep'), false);
    assert.equal((await row()).thesis_hold_rule, HIDDEN_RULE);
    assert.equal((await listHeld(10, u)).find((h) => h.sellId === t.sell)?.rule, HIDDEN_RULE);
    assert.equal(await unhideThesis(u, t.sell, 'issue-resolved'), true);
    assert.deepEqual(await row(), { thesis: `${TEXT} Edited.`, thesis_status: 'published', thesis_hold_rule: null });
    assert.equal(await unhideThesis(u, t.sell, 'issue-resolved'), false); // latest row is the unhide
    assert.deepEqual(await counts(u), before);
    // No thesis text in any audit column.
    const audit = await sql`select * from trust_audit where user_id = ${u}`;
    assert.equal(audit.length, 2);
    assert.ok(!JSON.stringify(audit).includes('sentinel'));
    assert.deepEqual(audit.map((a) => [a.kind, a.sell_id, a.action, a.actor]), [['thesis', t.sell, 'hide', 'owner'], ['thesis', t.sell, 'unhide', 'owner']]);
  } finally { await removePeople([u]); }
});

dbTest('E6: hide, the trader clears and rewrites (still hidden), clears again, unhide, then a new note publishes', async () => {
  const { sql } = await import('./db.ts');
  const { hideThesis, unhideThesis, thesisHiddenByOwner } = await import('./trust-hide.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { tag, ids: [u] } = await people(1, 'f16c');
  try {
    const [t] = await trades(u, tag, 1);
    const row = async () => ({ ...(await sql`select thesis, thesis_status, thesis_hold_rule from closed_trades where id = ${t.id}`)[0] });
    await saveThesisFor(u, t.id, TEXT);
    assert.equal(await hideThesis(u, t.sell, 'abusive'), true);
    assert.equal(await thesisHiddenByOwner(sql, u, t.sell), true);
    await saveThesisFor(u, t.id, ''); // clear: nothing left to show
    assert.deepEqual(await row(), { thesis: null, thesis_status: null, thesis_hold_rule: null });
    await saveThesisFor(u, t.id, 'A rewritten note after the clear.'); // the escape a cleared row would allow
    assert.deepEqual(await row(), { thesis: 'A rewritten note after the clear.', thesis_status: 'held', thesis_hold_rule: HIDDEN_RULE });
    await saveThesisFor(u, t.id, '');
    assert.equal(await unhideThesis(u, t.sell, 'hidden-by-mistake'), true); // no row with text: the audit row alone ends it
    assert.equal(await thesisHiddenByOwner(sql, u, t.sell), false);
    await saveThesisFor(u, t.id, 'A new note after the unhide.');
    assert.deepEqual(await row(), { thesis: 'A new note after the unhide.', thesis_status: 'published', thesis_hold_rule: null });
  } finally { await removePeople([u]); }
});

dbTest('the script: a trade or card is refused (exit 2), unknown reasons and non-role actors write nothing, history prints codes', async () => {
  const { sql } = await import('./db.ts');
  const { run } = await import('../scripts/hide.ts');
  const { hideItem, RefusedKind, REFUSED_KIND } = await import('./trust-hide.ts');
  const { tag, ids: [u] } = await people(1, 'f16x');
  try {
    const [t] = await trades(u, tag, 1);
    await sql`update closed_trades set thesis = ${TEXT}, thesis_status = 'published' where id = ${t.id}`;
    for (const kind of ['trade', 'card', 'month', t.sell]) {
      const o = lines();
      assert.equal(await run([kind, String(u), t.sell, 'abusive'], o.out), 2, kind);
      assert.equal(o.l[0], REFUSED_KIND);
      await assert.rejects(hideItem(kind, u, t.sell, 'abusive'), RefusedKind);
    }
    assert.equal(REFUSED_KIND, 'Only a whole profile or a thesis can be hidden; a single trade is never hidden.');
    assert.equal(await run(['profile', String(u), 'bad-trader'], lines().out), 2);
    assert.equal(await run(['profile', String(u), 'report-unfounded'], lines().out), 2); // an unhide reason can't hide
    assert.equal(await run(['profile', String(u), 'abusive', '--actor=someone@example.com'], lines().out), 2);
    assert.equal(await run(['profile', String(u), 'abusive'], lines().out, { TRUST_ACTOR: 'Real Name' }), 2);
    assert.equal((await sql`select count(*)::int as n from trust_audit where user_id = ${u}`)[0].n, 0);
    assert.equal((await sql`select hidden_at from users where id = ${u}`)[0].hidden_at, null);
    const o = lines();
    assert.equal(await run(['thesis', String(u), t.sell, 'legal-notice', '--actor=owner'], o.out), 0);
    assert.deepEqual(o.l, ['Thesis hidden.']);
    assert.equal(await run(['profile', String(u), 'abusive'], lines().out, { TRUST_ACTOR: 'owner-2' }), 0);
    assert.equal(await run(['unhide-profile', String(u), 'issue-resolved'], lines().out), 0);
    assert.equal(await run(['unhide-thesis', String(u), t.sell, 'issue-resolved'], lines().out), 0);
    assert.equal(await run(['unhide-thesis', String(u), t.sell, 'issue-resolved'], lines().out), 1);
    const hist = lines();
    assert.equal(await run(['history', String(u)], hist.out), 0);
    assert.equal(hist.l.length, 4);
    assert.ok(hist.l.every((l) => !l.includes('sentinel')));
    assert.match(hist.l[1], /\thide\tprofile\tabusive\towner-2$/);
  } finally { await removePeople([u]); }
});

dbTest('a hidden thesis stays hidden through rebuildRecord (keyed by sell id), and the unhide still ends it', async () => {
  const { sql } = await import('./db.ts');
  const { hideThesis, unhideThesis } = await import('./trust-hide.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const { tag, ids: [u] } = await people(1, 'f16b');
  try {
    const [t] = await trades(u, tag, 1);
    await sql`update closed_trades set thesis = ${TEXT}, thesis_status = 'published' where id = ${t.id}`;
    assert.equal(await hideThesis(u, t.sell, 'abusive'), true);
    await rebuildRecord(u);
    const row = async () => ({ ...(await sql`select thesis_status, thesis_hold_rule from closed_trades where user_id = ${u} and sell_id = ${t.sell}`)[0] });
    assert.deepEqual(await row(), { thesis_status: 'held', thesis_hold_rule: HIDDEN_RULE });
    assert.equal(await unhideThesis(u, t.sell, 'issue-resolved'), true);
    assert.deepEqual(await row(), { thesis_status: 'published', thesis_hold_rule: null });
  } finally { await removePeople([u]); }
});
