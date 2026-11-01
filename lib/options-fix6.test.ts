// OPTIONS fix round 6 (orchestrator's independent review of PR #62): option rows stored on the share path before this PR
// never keep producing public share closes — frozen records included (db-setup repairs them), option-tagged rows with a
// plain ticker too — counted once, under options; every rebuild goes through rebuildRecord; the OCC pattern trims; the
// exercise-day taint parses an OCC fallback symbol. Database cases create and remove their own rows.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `r${Math.random().toString(36).slice(2, 9)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const acc = `${tag}-a`;
  const row = (id: string, symbol: string, side: 'BUY' | 'SELL', price: number, at: string, raw: unknown = {}) => ({
    user_id: u.id, source: 'snaptrade', external_id: `${tag}-${id}`, account_id: acc, symbol, side, units: 1, price, fee: 0, executed_at: new Date(at), raw: sql.json(raw as never),
  });
  const closes = async () => (await sql`select symbol from closed_trades where user_id = ${u.id} order by symbol`).map((r) => r.symbol as string);
  const counters = async () => (await sql`select excluded_positions as p, excluded_options_other as o from users where id = ${u.id}`)[0];
  return { sql, tag, u, acc, row, closes, counters, cleanup: () => sql`delete from users where id = ${u.id}` };
}

dbTest('blocking 1, repro A: a frozen trader\'s stored OCC pair stops being a public close after db-setup\'s repair (theses kept, counted once)', async () => {
  const { sql, tag, u, acc, row, closes, counters, cleanup } = await setup();
  const { repairOptionShareCloses } = await import('./options-sync.ts');
  try {
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, disconnected_at)
      select signup_attempt_id, id, 'connected', now(), now(), now(), now() from users where id = ${u.id}`; // frozen: never synced again
    await sql`insert into activities ${sql([row('b', 'XYZ   250117C00150000', 'BUY', 2, '2025-01-02T15:00:00Z'), row('s', 'XYZ   250117C00150000', 'SELL', 5, '2025-01-10T15:00:00Z'),
      row('kb', 'ABC', 'BUY', 10, '2025-01-02T15:00:00Z'), row('ks', 'ABC', 'SELL', 11, '2025-01-10T15:00:00Z')])}`;
    // The record as a rebuild before this PR left it: the option pair matched as a share close, with a thesis.
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status) values
      (${u.id}, ${`${tag}-s`}, ${acc}, 'XYZ   250117C00150000', '2025-01-02T15:00:00Z', '2025-01-10T15:00:00Z', 1.5, 8, true, 'why', 'published'),
      (${u.id}, ${`${tag}-ks`}, ${acc}, 'ABC', '2025-01-02T15:00:00Z', '2025-01-10T15:00:00Z', 0.1, 8, true, null, null)`;
    const repaired = await repairOptionShareCloses([u.id]);
    assert.equal(repaired, 1);
    assert.deepEqual(await closes(), ['ABC']);
    assert.deepEqual({ ...await counters() }, { p: 0, o: 1 });
    assert.equal((await sql`select thesis from kept_theses where user_id = ${u.id} and sell_id = ${`${tag}-s`}`)[0].thesis, 'why');
    // Idempotent: nothing left to repair.
    assert.equal(await repairOptionShareCloses([u.id]), 0);
    // db-setup calls it for everyone.
    assert.match(readFileSync(new URL('../scripts/db-setup.ts', import.meta.url), 'utf8'), /repairOptionShareCloses\(\)/);
  } finally { await cleanup(); }
});

dbTest('blocking 1, repro B: activities whose raw has option_type set but a plain ticker never produce a share close after rebuildRecord', async () => {
  const { sql, u, row, closes, counters, cleanup } = await setup();
  const { rebuildRecord } = await import('./options-sync.ts');
  try {
    await sql`insert into activities ${sql([row('b', 'ABC', 'BUY', 2, '2025-01-02T15:00:00Z', { option_type: 'BUY_TO_OPEN' }), row('s', 'ABC', 'SELL', 5, '2025-01-10T15:00:00Z', { option_type: 'SELL_TO_CLOSE' }),
      row('kb', 'DEF', 'BUY', 10, '2025-01-02T15:00:00Z'), row('ks', 'DEF', 'SELL', 11, '2025-01-10T15:00:00Z')])}`;
    await rebuildRecord(u.id);
    assert.deepEqual(await closes(), ['DEF']); // no "ABC +150%"
    assert.deepEqual({ ...await counters() }, { p: 0, o: 1 });
  } finally { await cleanup(); }
});

dbTest('nit: a sell on an OCC symbol with no entry is counted once, under options only; a trailing space does not hide an OCC symbol', async () => {
  const { sql, u, row, closes, counters, cleanup } = await setup();
  const { rebuildRecord, purgeOccPositions } = await import('./options-sync.ts');
  try {
    await sql`insert into activities ${sql([row('s', 'XYZ250117C00150000 ', 'SELL', 5, '2025-01-10T15:00:00Z'),
      row('b2', 'QRS   250117P00010000', 'BUY', 1, '2025-01-02T15:00:00Z'), row('s2', 'QRS   250117P00010000', 'SELL', 2, '2025-01-03T15:00:00Z')])}`;
    await rebuildRecord(u.id);
    assert.deepEqual(await closes(), []);
    assert.deepEqual({ ...await counters() }, { p: 0, o: 2 });
    await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct) values (${u.id}, 'a', 'XYZ250117C00150000 ', 0.1)`;
    assert.equal(await purgeOccPositions(sql, u.id), 1);
  } finally { await cleanup(); }
});

dbTest('nit: an exercise row without option_symbol whose activity symbol is an OCC string taints the underlying (its parsed root)', async () => {
  const { sql, tag, u, acc, row, closes, cleanup } = await setup();
  const { rebuildRecord } = await import('./options-sync.ts');
  try {
    await sql`insert into activities ${sql([row('b', 'XYZ', 'BUY', 100, '2025-01-02T15:00:00Z'), row('s', 'XYZ', 'SELL', 120, '2025-01-20T15:00:00Z')])}`;
    await sql`insert into option_activities (user_id, source, external_id, account_id, kind, executed_at, raw)
      values (${u.id}, 'snaptrade', ${`${tag}-x`}, ${acc}, 'OPTIONEXERCISE', '2025-01-10T15:00:00Z', ${sql.json({ symbol: { symbol: 'XYZ   250117C00100000' } } as never)})`;
    const r = await rebuildRecord(u.id);
    assert.equal(r.removedForExercise, 1);
    assert.deepEqual(await closes(), []);
  } finally { await cleanup(); }
});

dbTest('blocking 2: scripts/shared-accounts.ts --rebuild rebuilds a marked profile with rebuildRecord (no OCC close comes back; the exercise-share counter is set)', async () => {
  const { sql, tag, u, acc, row, closes, cleanup } = await setup();
  const { run } = await import('../scripts/shared-accounts.ts');
  try {
    await sql`insert into activities ${sql([row('b', 'XYZ   250117C00150000', 'BUY', 2, '2025-01-02T15:00:00Z'), row('s', 'XYZ   250117C00150000', 'SELL', 5, '2025-01-10T15:00:00Z'),
      row('eb', 'QRS', 'BUY', 10, '2025-01-02T15:00:00Z'), row('es', 'QRS', 'SELL', 11, '2025-01-20T15:00:00Z')])}`;
    await sql`insert into option_activities (user_id, source, external_id, account_id, kind, underlying, executed_at, raw)
      values (${u.id}, 'snaptrade', ${`${tag}-x`}, ${acc}, 'OPTIONASSIGNMENT', 'QRS', '2025-01-10T15:00:00Z', '{}')`;
    await sql`insert into shared_account_marks (account_id, user_id) values (${`${tag}-other`}, ${u.id})`;
    await run(['--rebuild'], () => {}, [u.id]);
    assert.deepEqual(await closes(), []);
    assert.equal((await sql`select excluded_exercise_shares as n from users where id = ${u.id}`)[0].n, 1);
  } finally { await cleanup(); }
});

test('blocking 2 (inventory): nothing but lib/options-sync.ts#rebuildRecord calls rebuildTrades (app/, lib/, scripts/; tests excluded)', () => {
  const root = new URL('..', import.meta.url).pathname;
  const files = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(join(root, p)).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
  const callers = [...files('app'), ...files('lib'), ...files('scripts')].filter((f) => /\brebuildTrades\(/.test(readFileSync(join(root, f), 'utf8').replace(/\/\/[^\n]*/g, '')));
  assert.deepEqual(callers.sort(), ['lib/options-sync.ts', 'lib/sync.ts']); // the definition and its one caller
  assert.equal((readFileSync(join(root, 'lib/sync.ts'), 'utf8').replace(/\/\/[^\n]*/g, '').match(/\brebuildTrades\(/g) ?? []).length, 1); // the definition only
});

test('nit: COMPLIANCE keeps the original CFTC/NFA row and records the options re-review separately (equity options are SEC/FINRA)', () => {
  const doc = readFileSync(new URL('../docs/COMPLIANCE.md', import.meta.url), 'utf8');
  assert.ok(doc.includes('| CFTC / NFA | Futures, options on futures, forex. | Options and futures are out of scope; `fetchActivities` skips them. If added, re-review. |'));
  assert.match(doc, /Re-review 2026-11-01 \(options support[^\n]*SEC\/FINRA/);
});
