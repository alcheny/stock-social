// FIXES-CYCLE5 (F5-2, C5-3): a note save and a report on it are keyed by the trade (trade_key), which survives
// rebuildTrades. A save that waits for a rebuild's lock is stored on the rebuilt row; a key that names no trade writes
// nothing and answers 'changed' (the form says so); every note and report form under app/ posts a trade key.
// Each test makes its own users (random tag) and removes only them.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { hasDb, people, ready, removePeople, trades } from './thesis-fixtures.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const yes = { allow: () => true };
const ROOT = new URL('../', import.meta.url);

async function keyOf(user: number, sell: string) {
  const { sql } = await import('./db.ts');
  const [r] = await sql`select id::text as id, trade_key, thesis, thesis_status from closed_trades where user_id = ${user} and sell_id = ${sell}`;
  return r as { id: string; trade_key: string; thesis: string | null; thesis_status: string | null };
}

dbTest('F5-2: a save by trade_key read before a rebuild is stored on the rebuilt row', async () => {
  const { rebuildTrades } = await import('./sync.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { tag, ids: [trader] } = await people(1, 'fc5wp1a');
  try {
    const [t] = await trades(trader, tag, 2);
    const before = await keyOf(trader, t.sell);
    assert.match(before.trade_key, /^[0-9a-f]{64}$/);
    await rebuildTrades(trader);
    const rebuilt = await keyOf(trader, t.sell);
    assert.notEqual(rebuilt.id, before.id, 'the rebuild gave the row a new id');
    assert.equal(rebuilt.trade_key, before.trade_key, 'the key survives');
    assert.equal(await saveThesisFor(trader, before.trade_key, 'Bought the base retest, stop under the low.'), 'saved');
    const after = await keyOf(trader, t.sell);
    assert.equal(after.thesis, 'Bought the base retest, stop under the low.');
    assert.equal(after.thesis_status, 'published');
    // The row id from before the rebuild names nothing now: 'changed', and nothing is written.
    assert.equal(await saveThesisFor(trader, before.id, 'Typed on an old page.'), 'changed');
    assert.equal((await keyOf(trader, t.sell)).thesis, 'Bought the base retest, stop under the low.');
    assert.equal(await saveThesisFor(trader, 'abc', 'bad ref'), 'invalid');
    assert.equal(await saveThesisFor(trader, 'A'.repeat(64), 'upper-case hex is not a key'), 'invalid');
  } finally { await removePeople([trader]); }
});

dbTest('F5-2: a save started while a rebuild holds the trader\'s rows waits for it and is stored after the rebuild commits', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { tag, ids: [trader] } = await people(1, 'fc5wp1b');
  try {
    const [t] = await trades(trader, tag, 2);
    const before = await keyOf(trader, t.sell);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let rebuildPid = 0;
    let rebuilt!: () => void;
    const rebuildDone = new Promise<void>((r) => { rebuilt = r; });
    const order: string[] = [];
    // The rebuild runs in a transaction this test holds open: its rows are locked, deleted and inserted again.
    const held = sql.begin(async (tx) => {
      rebuildPid = (await tx`select pg_backend_pid() as p`)[0].p as number;
      await rebuildTrades(trader, tx);
      rebuilt();
      await gate;
      order.push('rebuild committed');
    });
    await rebuildDone;
    const save = saveThesisFor(trader, before.trade_key, 'Saved while the sync ran.').then((r) => { order.push('save returned'); return r; });
    // Proven by the lock graph, not by a clock: wait until a backend is blocked by the rebuild's transaction.
    for (let i = 0; ; i++) {
      const [{ n }] = await sql`select count(*)::int as n from pg_stat_activity where ${rebuildPid} = any(pg_blocking_pids(pid))`;
      if (n > 0) break;
      assert.ok(i < 10_000, 'the save never waited on the rebuild');
      await new Promise((r) => setImmediate(r));
    }
    assert.deepEqual(order, [], 'the save is still waiting while the rebuild is open');
    release();
    await held;
    assert.equal(await save, 'saved');
    assert.deepEqual(order, ['rebuild committed', 'save returned']);
    const after = await keyOf(trader, t.sell);
    assert.notEqual(after.id, before.id, 'stored on the rebuilt row');
    assert.equal(after.thesis, 'Saved while the sync ran.');
  } finally { await removePeople([trader]); }
});

dbTest('F5-2: an unknown key (or a renumbered row id) answers \'changed\' and changes no closed_trades or kept_theses row', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { tag, ids: [trader] } = await people(1, 'fc5wp1c');
  try {
    const [t] = await trades(trader, tag, 2);
    const first = await keyOf(trader, t.sell);
    await sql`insert into kept_theses (user_id, sell_id, thesis, thesis_status) values (${trader}, ${`${tag}-gone`}, 'Kept aside.', 'published')`;
    const snapshot = async () => ({
      closes: await sql`select id::text, sell_id, thesis, thesis_status, thesis_hold_rule, thesis_written_at, thesis_edited_at from closed_trades where user_id = ${trader} order by id`,
      kept: await sql`select sell_id, thesis, thesis_status from kept_theses where user_id = ${trader} order by sell_id`,
    });
    const was = await snapshot();
    assert.equal(await saveThesisFor(trader, 'f'.repeat(64), 'Typed on a trade that left the record.'), 'changed');
    assert.deepEqual(await snapshot(), was);
    // Another trader's key is unknown on this record too.
    const { ids: [other] } = await people(1, 'fc5wp1c');
    try {
      assert.equal(await saveThesisFor(other, first.trade_key, 'not mine'), 'changed');
      assert.deepEqual(await snapshot(), was);
    } finally { await removePeople([other]); }
    await rebuildTrades(trader);
    const rebuilt = await snapshot();
    assert.equal(await saveThesisFor(trader, first.id, 'Typed before the renumbering.'), 'changed');
    assert.deepEqual(await snapshot(), rebuilt);
  } finally { await removePeople([trader]); }
});

dbTest('F5-2: a save by key removes the kept copy of the same close (keyed on its sell_id)', async () => {
  const { sql } = await import('./db.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { tag, ids: [trader] } = await people(1, 'fc5wp1d');
  try {
    const [t, u] = await trades(trader, tag, 2);
    await sql`insert into kept_theses (user_id, sell_id, thesis, thesis_status) values (${trader}, ${t.sell}, 'An older copy.', 'published'), (${trader}, ${u.sell}, 'Another close.', 'published')`;
    assert.equal(await saveThesisFor(trader, (await keyOf(trader, t.sell)).trade_key, 'The latest word.'), 'saved');
    const kept = await sql`select sell_id from kept_theses where user_id = ${trader} order by sell_id`;
    assert.deepEqual(kept.map((r) => r.sell_id), [u.sell]);
  } finally { await removePeople([trader]); }
});

dbTest('F5-2: a report by trade_key sent after a rebuild reaches the same note', async () => {
  const { sql } = await import('./db.ts');
  const { rebuildTrades } = await import('./sync.ts');
  const { saveThesisFor } = await import('./thesis-save.ts');
  const { reportThesis } = await import('./reports.ts');
  const { tag, ids: [trader, reader] } = await people(2, 'fc5wp1e');
  try {
    const [t] = await trades(trader, tag, 1);
    const k = await keyOf(trader, t.sell);
    assert.equal(await saveThesisFor(trader, k.trade_key, 'Faded the gap, covered at the open.'), 'saved');
    await rebuildTrades(trader);
    assert.notEqual((await keyOf(trader, t.sell)).id, k.id);
    assert.equal(await reportThesis(reader, k.trade_key, yes), 'reported');
    const rows = await sql`select trader_id, sell_id from thesis_reports where reporter_id = ${reader}`;
    assert.deepEqual(rows.map((r) => [Number(r.trader_id), r.sell_id]), [[trader, t.sell]]);
    assert.equal(await reportThesis(reader, 'e'.repeat(64), yes), 'not-found');
  } finally { await removePeople([trader, reader]); }
});

// ---- the forms ----
const tsxUnder = (dir: string): string[] => readdirSync(new URL(dir, ROOT), { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? tsxUnder(`${dir}${d.name}/`) : d.name.endsWith('.tsx') ? [`${dir}${d.name}`] : []);
const code = (f: string) => readFileSync(new URL(f, ROOT), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

test('F5-2: every note form under app/ posts a trade key (the row id stays only as the fallback beside it), and every Report control names a trade key', () => {
  const files = tsxUnder('app/');
  let forms = 0, reports = 0;
  for (const f of files) {
    const s = code(f);
    // app/report-note.tsx is the Report control itself: its hidden field carries the prop it is given (checked below).
    if (f !== 'app/report-note.tsx') {
      for (const m of s.matchAll(/name="tradeId"/g)) {
        forms++;
        const before = s.slice(Math.max(0, m.index - 400), m.index);
        assert.match(before, /<input type="hidden" name="tradeKey" value=\{t\.trade_key\} \/>\s*<input type="hidden" $/, `${f}: the tradeKey line sits right above tradeId`);
      }
    }
    for (const m of s.matchAll(/reportId=\{([^\n]*?)\}\s+symbol=/g)) {
      reports++;
      assert.match(m[1], /t\.trade_key|t\.note\?\.tradeKey|tradeKey\(/, `${f}: reportId names a trade key: ${m[1]}`);
      assert.doesNotMatch(m[1], /String\(t\.id\)|note\??\.tradeId/, f);
    }
    for (const m of s.matchAll(/<ReportNote tradeId=\{([^}]*)\}/g)) {
      if (f === 'app/user-note.tsx') { assert.equal(m[1], 'reportId', f); continue; } // passes the reportId checked above
      reports++;
      assert.match(m[1], /^tradeKey\(/, `${f}: the Report control names a trade key`);
    }
  }
  assert.equal(forms, 1, 'the profile\'s note form');
  assert.ok(reports >= 3, `profile, trade page and feed card (${reports})`);
});

test('F5-2: the action prefers the trade key, keeps the row-id fallback, and on \'changed\' redirects to the alert with no text in the URL', () => {
  const s = code('app/actions.ts');
  const fn = s.slice(s.indexOf('export async function saveThesis'), s.indexOf('export async function', s.indexOf('export async function saveThesis') + 10));
  assert.match(fn, /form\.get\('tradeKey'\)/);
  assert.match(fn, /\/\^\[0-9a-f\]\{64\}\$\//);
  assert.match(fn, /tradeIdParam\(form\.get\('tradeId'\)\)/);
  assert.match(fn, /saveThesisFor\(user\.id, \(tradeKey \?\? tradeId\)!/);
  assert.match(fn, /redirect\(`\/u\/\$\{user\.handle\}\?note=changed\$\{tradeKey \? `&n=\$\{tradeKey\}` : ''\}\$\{w\}#note-changed`\)/);
  assert.doesNotMatch(fn, /thesis[^']*\}`\)|encodeURIComponent\(String\(form\.get\('thesis'\)/, 'the note text never goes in the URL');
});
