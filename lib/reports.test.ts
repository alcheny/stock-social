// fix-user-text B (F-9): the report action. Signed out refuses; one report changes nothing; REPORT_HOLD_AT distinct
// signed-in reporters hold the note (rule 'reports'); one report per reader per note; one per reader per minute; never
// your own note; reports and the hold survive rebuildTrades (keyed by sell_id); nothing deletes a thesis; deleting a
// profile removes its reporter ids; no thesis text or reporter id reaches a log.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasDb, people, ready, removePeople, trades } from './thesis-fixtures.ts';
import { REPORT_COPY, REPORT_HOLD_AT, REPORT_INTERVAL_MS, reportMessage } from './reports.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const yes = { allow: () => true };
// Code only: line comments removed.
const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/(^|\s)\/\/[^\n]*/g, '$1');

test('the rules: three distinct reporters, one report per minute; the copy names no person and no count', () => {
  assert.equal(REPORT_HOLD_AT, 3);
  assert.equal(REPORT_INTERVAL_MS, 60_000);
  assert.equal(REPORT_COPY.label, 'Report this note');
  assert.equal(reportMessage('reported'), 'Reported. Thank you.');
  assert.equal(reportMessage('held'), reportMessage('reported')); // a reporter never learns that the note was held
  for (const v of Object.values(REPORT_COPY)) assert.doesNotMatch(v, /\d|@/);
});

test('no code path deletes a thesis on report, hold or release; reports only insert', () => {
  for (const f of ['./reports.ts', './thesis-review.ts', '../scripts/review-theses.ts']) {
    const s = src(f);
    assert.doesNotMatch(s, /delete\s+from/i, f);
    assert.doesNotMatch(s, /\bthesis\s*=\s*null|set\s+thesis\s*=/i, f);
    assert.doesNotMatch(s, /\b(activities|insertActivities|rebuildTrades)\b/, `${f} touches no trade`);
  }
  // The report action and the review list never read the dev session.
  assert.doesNotMatch(src('./thesis-review.ts'), /session|viewer/);
  assert.doesNotMatch(src('./reports.ts'), /from '\.\/session\.ts'|currentUser/);
});

dbTest('signed out refuses; one report changes nothing; three distinct signed-in reporters hold it with rule "reports"', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { tag, ids: [trader, a, b, c, d] } = await people(5);
  try {
    const [t] = await trades(trader, tag, 1);
    await sql`update closed_trades set thesis = 'Bought the pullback to the 20-day.', thesis_status = 'published' where id = ${t.id}`;
    const status = async () => (await sql`select thesis_status, thesis_hold_rule, thesis from closed_trades where id = ${t.id}`)[0];
    assert.equal(await reportThesis(null, t.id, yes), 'signed-out');
    assert.equal(await reportThesis(undefined, t.id, yes), 'signed-out');
    assert.equal(await reportThesis(a, 'x; drop', yes), 'invalid');
    assert.equal(await reportThesis(trader, t.id, yes), 'own');
    assert.equal(await reportThesis(a, t.id, yes), 'reported');
    assert.equal((await status()).thesis_status, 'published');
    assert.equal(await reportThesis(a, t.id, yes), 'already'); // one report per reader per note
    assert.equal(await reportThesis(b, t.id, yes), 'reported');
    assert.equal((await status()).thesis_status, 'published');
    assert.equal(await reportThesis(c, t.id, yes), 'held');
    assert.deepEqual({ ...(await status()) }, { thesis_status: 'held', thesis_hold_rule: 'reports', thesis: 'Bought the pullback to the 20-day.' }); // held, never deleted
    // Fix round 4 (item 2): a later reader of the held note gets the neutral answer of a missing note on every press
    // ("Reported. Thank you."), nothing is recorded, and the note stays held with its rule.
    assert.equal(await reportThesis(d, t.id, yes), 'not-found');
    assert.equal(reportMessage('not-found'), REPORT_COPY.done);
    assert.equal(reportMessage('held'), REPORT_COPY.done);
    assert.equal(await reportThesis(d, t.id, yes), 'not-found');
    assert.equal(await reportThesis(trader, t.id, yes), 'own');
    assert.deepEqual({ ...(await status()) }, { thesis_status: 'held', thesis_hold_rule: 'reports', thesis: 'Bought the pullback to the 20-day.' });
    assert.equal((await sql`select count(*)::int as n from thesis_reports where trader_id = ${trader}`)[0].n, 3);
  } finally { await removePeople([trader, a, b, c, d]); }
});

dbTest('rate limit: one report per reader per minute (shared, in the database) and the per-process check refuses too', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { tag, ids: [trader, a] } = await people(2);
  try {
    const [t1, t2] = await trades(trader, tag, 2);
    await sql`update closed_trades set thesis = 'Earnings run-up, sold into strength.', thesis_status = 'published' where user_id = ${trader}`;
    assert.equal(await reportThesis(a, t1.id, yes), 'reported');
    assert.equal(await reportThesis(a, t2.id, yes), 'rate');
    await sql`update thesis_reports set created_at = now() - interval '61 seconds' where reporter_id = ${a}`;
    assert.equal(await reportThesis(a, t2.id, { allow: () => false }), 'rate');
    assert.equal(await reportThesis(a, t2.id, yes), 'reported');
    assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${a}`)[0].n, 2);
  } finally { await removePeople([trader, a]); }
});

dbTest('reports and the hold survive rebuildTrades (keyed by sell_id); an owner release resets the count; an edit of a report-held note stays held', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const { releaseThesis } = await import('./thesis-review.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { tag, ids: [trader, a, b, c, d] } = await people(5);
  try {
    const [t] = await trades(trader, tag, 1);
    await saveThesisFor(trader, t.id, 'Range breakout with a stop under the base.');
    assert.equal(await reportThesis(a, t.id, yes), 'reported');
    assert.equal(await reportThesis(b, t.id, yes), 'reported');
    await rebuildTrades(trader);
    const [t2] = await sql`select id::text as id, thesis_status from closed_trades where user_id = ${trader} and sell_id = ${t.sell}`;
    assert.notEqual(t2.id, t.id); // rebuilt row
    assert.equal(await reportThesis(c, t2.id, yes), 'held'); // the two earlier reports still count
    await rebuildTrades(trader);
    const row = async () => (await sql`select id::text as id, thesis, thesis_status, thesis_hold_rule, thesis_reviewed_at from closed_trades where user_id = ${trader} and sell_id = ${t.sell}`)[0];
    assert.equal((await row()).thesis_status, 'held');
    assert.equal((await row()).thesis_hold_rule, 'reports');
    // The author edits it: still held by reports until the owner reviews it.
    await saveThesisFor(trader, (await row()).id, 'Range breakout, stop under the base.');
    assert.equal((await row()).thesis_status, 'held');
    assert.equal((await row()).thesis_hold_rule, 'reports');
    // The owner releases it: published; only reports made after the release count from now on.
    assert.equal(await releaseThesis(trader, t.sell, 'publish'), true);
    assert.equal((await row()).thesis_status, 'published');
    assert.ok((await row()).thesis_reviewed_at);
    assert.equal(await reportThesis(d, (await row()).id, yes), 'reported');
    assert.equal((await row()).thesis_status, 'published');
    assert.equal((await sql`select count(*)::int as n from thesis_reports where trader_id = ${trader} and sell_id = ${t.sell}`)[0].n, 4);
  } finally { await removePeople([trader, a, b, c, d]); }
});

dbTest('deleting a profile removes its reporter ids (and the reports on its own notes)', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { deleteProfile } = await import('./delete.ts');
  const { tag, ids: [trader, a, b] } = await people(3);
  try {
    const [t] = await trades(trader, tag, 1);
    await sql`update closed_trades set thesis = 'Trimmed into the gap.', thesis_status = 'published' where id = ${t.id}`;
    assert.equal(await reportThesis(a, t.id, yes), 'reported');
    assert.equal(await reportThesis(b, t.id, yes), 'reported');
    const [ua] = await sql`select id, handle, snaptrade_user_id, snaptrade_secret_enc from users where id = ${a}`;
    await deleteProfile(ua as never, { deleteVendorUser: async () => {} });
    assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${a}`)[0].n, 0);
    assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${b}`)[0].n, 1);
    const [ut] = await sql`select id, handle, snaptrade_user_id, snaptrade_secret_enc from users where id = ${trader}`;
    await deleteProfile(ut as never, { deleteVendorUser: async () => {} });
    assert.equal((await sql`select count(*)::int as n from thesis_reports where trader_id = ${trader}`)[0].n, 0);
  } finally {
    await removePeople([trader, a, b]);
    await sql`delete from handle_reservations where handle like ${tag + '%'}`;
  }
});

dbTest('logs: reporting, saving, re-checking and releasing write no thesis text and no reporter id to any console method', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { releaseThesis, remoderateAll } = await import('./thesis-review.ts');
  const { tag, ids: [trader, a, b, c] } = await people(4);
  const seen: string[] = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
  const saved = methods.map((m) => console[m]);
  for (const m of methods) console[m] = (...args: unknown[]) => { seen.push(args.map((x) => (typeof x === 'string' ? x : JSON.stringify(x) ?? String(x))).join(' ')); };
  const text = `Secret-ish note ${tag} about the base`;
  try {
    const [t1, t2] = await trades(trader, tag, 2);
    await saveThesisFor(trader, t1.id, text);
    await saveThesisFor(trader, t2.id, `DM me ${tag}`);
    for (const r of [a, b, c]) await reportThesis(r, t1.id, yes);
    await remoderateAll([trader]);
    await releaseThesis(trader, t1.sell, 'publish');
    await reportThesis(a, 'not-a-number', yes);
  } finally {
    methods.forEach((m, i) => { console[m] = saved[i]; });
    await removePeople([trader, a, b, c]);
  }
  const all = seen.join('\n');
  assert.ok(!all.includes(tag), 'no thesis text or handle tag in logs');
  for (const id of [a, b, c]) assert.doesNotMatch(all, new RegExp(`\\b${id}\\b`), 'no reporter id in logs');
  void sql;
});

// Fix round 1 (item 1): reports count only from the last release, and an edit never moves that point back.
dbTest('release then edit: the reports made before the release never count again; one new report leaves it published', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { releaseThesis } = await import('./thesis-review.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const { tag, ids: [trader, a, b, c, d] } = await people(5);
  try {
    const [t] = await trades(trader, tag, 1);
    await saveThesisFor(trader, t.id, 'Bought the base retest, stop under the low.');
    const row = async () => (await sql`select id::text as id, thesis, thesis_status, thesis_hold_rule, thesis_reports_from from closed_trades where user_id = ${trader} and sell_id = ${t.sell}`)[0];
    assert.equal(await reportThesis(a, t.id, yes), 'reported');
    assert.equal(await reportThesis(b, t.id, yes), 'reported');
    assert.equal(await reportThesis(c, t.id, yes), 'held');
    assert.equal(await releaseThesis(trader, t.sell, 'publish'), true);
    const from = (await row()).thesis_reports_from;
    assert.ok(from, 'the release sets thesis_reports_from');
    await saveThesisFor(trader, (await row()).id, 'Bought the base retest; stop under the low.');
    assert.equal((await row()).thesis_status, 'published');
    assert.equal(+(await row()).thesis_reports_from, +from, 'an edit never clears or moves it');
    await rebuildTrades(trader);
    assert.equal(+(await row()).thesis_reports_from, +from, 'a rebuild carries it');
    assert.equal(await reportThesis(d, (await row()).id, yes), 'reported');
    assert.equal((await row()).thesis_status, 'published');
    // Clearing the note and writing a new one keeps it too.
    await saveThesisFor(trader, (await row()).id, '');
    await saveThesisFor(trader, (await row()).id, 'Second try: bought the base retest.');
    assert.equal(+(await row()).thesis_reports_from, +from);
  } finally { await removePeople([trader, a, b, c, d]); }
});

// Fix round 5 (item 6; corrected expectation): after a release the same readers can't hold the note again by pressing
// Report again ('already'); only when the author changed the note since the release does an earlier report count again
// (the row is re-dated, never deleted).
dbTest('after a release the same three reporters cannot re-hide the note; after an edit their reports count again', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { releaseThesis } = await import('./thesis-review.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { tag, ids: [trader, a, b, c] } = await people(4);
  try {
    const [t] = await trades(trader, tag, 1);
    await sql`update closed_trades set thesis = 'Faded the gap, covered at the open.', thesis_status = 'published' where id = ${t.id}`;
    for (const r of [a, b]) assert.equal(await reportThesis(r, t.id, yes), 'reported');
    assert.equal(await reportThesis(c, t.id, yes), 'held');
    await sql`update thesis_reports set created_at = created_at - interval '2 minutes' where trader_id = ${trader}`;
    assert.equal(await releaseThesis(trader, t.sell, 'publish'), true);
    for (const r of [a, b, c]) assert.equal(await reportThesis(r, t.id, yes), 'already');
    assert.equal((await sql`select thesis_status from closed_trades where id = ${t.id}`)[0].thesis_status, 'published');
    // The author edits the note after the release: the earlier reporters may report the new text.
    await saveThesisFor(trader, t.id, 'Faded the gap, covered at the open. Sized too big.');
    assert.equal((await sql`select thesis_status from closed_trades where id = ${t.id}`)[0].thesis_status, 'published');
    assert.equal(await reportThesis(a, t.id, yes), 'reported');
    assert.equal(await reportThesis(a, t.id, yes), 'already');
    assert.equal(await reportThesis(b, t.id, yes), 'reported');
    assert.equal(await reportThesis(c, t.id, yes), 'held');
    assert.equal((await sql`select count(*)::int as n from thesis_reports where trader_id = ${trader}`)[0].n, 3);
  } finally { await removePeople([trader, a, b, c]); }
});

dbTest('two readers racing to be the third: both are answered "Reported. Thank you."', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { tag, ids: [trader, a, b, c, d] } = await people(5);
  try {
    const [t] = await trades(trader, tag, 1);
    await sql`update closed_trades set thesis = 'Sold the first push, kept a runner.', thesis_status = 'published' where id = ${t.id}`;
    for (const r of [a, b]) assert.equal(await reportThesis(r, t.id, yes), 'reported');
    const out = await Promise.all([reportThesis(c, t.id, yes), reportThesis(d, t.id, yes)]);
    // Fix round 4: the reader who lost the race finds the note already held and gets the neutral answer.
    assert.deepEqual(out.sort(), ['held', 'not-found']);
    assert.deepEqual(out.map(reportMessage), [REPORT_COPY.done, REPORT_COPY.done]);
    assert.equal((await sql`select thesis_status from closed_trades where id = ${t.id}`)[0].thesis_status, 'held');
  } finally { await removePeople([trader, a, b, c, d]); }
});

// Fix round 1 (item 9): a rebuild running beside a report hold never writes the note back as published.
dbTest('rebuildTrades waits for a concurrent report hold and keeps it', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const { tag, ids: [trader] } = await people(1);
  try {
    const [t] = await trades(trader, tag, 1);
    await sql`update closed_trades set thesis = 'Bought the higher low.', thesis_status = 'published' where id = ${t.id}`;
    let locked!: () => void, release!: () => void;
    const isLocked = new Promise<void>((r) => { locked = r; });
    const gate = new Promise<void>((r) => { release = r; });
    const holder = sql.begin(async (tx) => {
      await tx`select 1 from closed_trades where id = ${t.id} for update`;
      await tx`update closed_trades set thesis_status = 'held', thesis_hold_rule = 'reports' where id = ${t.id}`;
      locked();
      await gate;
    });
    await isLocked;
    const rebuild = rebuildTrades(trader);
    await new Promise((r) => setTimeout(r, 300));
    release();
    await holder;
    await rebuild;
    const [row] = await sql`select thesis, thesis_status, thesis_hold_rule from closed_trades where user_id = ${trader} and sell_id = ${t.sell}`;
    assert.deepEqual({ ...row }, { thesis: 'Bought the higher low.', thesis_status: 'held', thesis_hold_rule: 'reports' });
  } finally { await removePeople([trader]); }
});

// ---- Fix round 3 ----

// Item 10: a well-formed id that names no note is answered like a report (no probing for hidden notes); a malformed id
// still fails.
dbTest('a missing note with a valid id is answered "Reported. Thank you."; a malformed id is not', async () => {
  const { reportThesis } = await import('./reports.ts');
  const { ids: [a] } = await people(1);
  try {
    const out = await reportThesis(a, '999999999999999999', yes);
    assert.equal(out, 'not-found');
    assert.equal(reportMessage(out), REPORT_COPY.done);
    assert.equal(reportMessage('invalid'), REPORT_COPY.failed);
    assert.equal(reportMessage(await reportThesis(a, 'x; drop', yes)), REPORT_COPY.failed);
  } finally { await removePeople([a]); }
});

// Item 10: the rate-limit slot is spent only by a report that was recorded.
dbTest('losing the insert race answers "already" and spends no rate-limit slot; a refused slot records nothing', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { tag, ids: [trader, a] } = await people(2);
  let calls = 0;
  const spy = { allow: () => { calls++; return true; } };
  try {
    const [t1, t2] = await trades(trader, tag, 2);
    await sql`update closed_trades set thesis = 'Sold the gap fill.', thesis_status = 'published' where user_id = ${trader}`;
    // Another request's insert of the same report is in flight (uncommitted) while this one runs.
    let inserted!: () => void, commit!: () => void;
    const isIn = new Promise<void>((r) => { inserted = r; });
    const gate = new Promise<void>((r) => { commit = r; });
    const other = sql.begin(async (tx) => {
      await tx`insert into thesis_reports (reporter_id, trader_id, sell_id) values (${a}, ${trader}, ${t1.sell})`;
      inserted();
      await gate;
    });
    await isIn;
    const mine = reportThesis(a, t1.id, spy);
    await new Promise((r) => setTimeout(r, 300));
    commit();
    await other;
    assert.equal(await mine, 'already');
    assert.equal(calls, 0, 'no slot spent on a lost race');
    // A refused slot leaves no report behind.
    await sql`update thesis_reports set created_at = now() - interval '61 seconds' where reporter_id = ${a}`;
    assert.equal(await reportThesis(a, t2.id, { allow: () => false }), 'rate');
    assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${a} and sell_id = ${t2.sell}`)[0].n, 0);
    assert.equal(await reportThesis(a, t2.id, spy), 'reported');
    assert.equal(calls, 1);
  } finally { await removePeople([trader, a]); }
});

// ---- Fix round 4 (item 2) ----

// A held note (by a rule or by reports), an emptied note and a missing note give the same answer on the first and the
// second press, and none of them writes a report row or spends a rate-limit slot.
dbTest('missing, held and emptied notes: identical answers on every press, no report row, no rate slot', async () => {
  const { sql } = await import('./db.ts');
  const { reportThesis } = await import('./reports.ts');
  const { tag, ids: [trader, a] } = await people(2);
  let calls = 0;
  const spy = { allow: () => { calls++; return true; } };
  try {
    const [held, byReports, empty, live] = await trades(trader, tag, 4);
    await sql`update closed_trades set thesis = 'Note held by a rule.', thesis_status = 'held', thesis_hold_rule = 'link' where id = ${held.id}`;
    await sql`update closed_trades set thesis = 'Note held by reports.', thesis_status = 'held', thesis_hold_rule = 'reports' where id = ${byReports.id}`;
    await sql`update closed_trades set thesis = '', thesis_status = 'published' where id = ${empty.id}`;
    await sql`update closed_trades set thesis = 'Published note.', thesis_status = 'published' where id = ${live.id}`;
    const answers = async (id: string) => {
      const first = await reportThesis(a, id, spy);
      const second = await reportThesis(a, id, spy);
      return [first, second, reportMessage(first), reportMessage(second)];
    };
    const missing = await answers('999999999999999998');
    assert.deepEqual(missing, ['not-found', 'not-found', REPORT_COPY.done, REPORT_COPY.done]);
    assert.deepEqual(await answers(held.id), missing);
    assert.deepEqual(await answers(byReports.id), missing);
    assert.deepEqual(await answers(empty.id), missing);
    assert.equal(calls, 0, 'no rate slot spent');
    assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${a}`)[0].n, 0, 'no report row');
    // The reader is not rate limited by those presses: a published note is reported at once.
    assert.equal(await reportThesis(a, live.id, spy), 'reported');
    assert.equal(calls, 1);
    assert.deepEqual((await sql`select thesis_status, thesis_hold_rule from closed_trades where id = ${held.id}`).map((r) => ({ ...r })), [{ thesis_status: 'held', thesis_hold_rule: 'link' }]);
  } finally { await removePeople([trader, a]); }
});
