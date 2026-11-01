// OPTIONS fix round 2 (re-review after merging PR #40): the exercise-day rule follows a rename chain; the OCC-close
// removal keeps theses; the pane's closing note follows the gate. Database cases create and remove their own rows.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { OptionRow } from './options.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `g${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const share = (id: string, symbol: string, side: 'BUY' | 'SELL', price: number, at: string) => ({
    externalId: `${tag}-${id}`, accountId: `${tag}-a`, symbol, side, units: 100, price, fee: 0, executedAt: new Date(at), verified: true, raw: {},
  });
  return { sql, tag, u, share, cleanup: () => sql`delete from users where id = ${u.id}` };
}

dbTest('fix round 2 A: a share close renamed by a symbol change (XYZ→ABC) after an exercise day in XYZ is still removed and counted', async () => {
  const { sql, tag, u, share, cleanup } = await setup();
  const { insertActivities } = await import('./sync.ts');
  const { insertCorporateActions } = await import('./corporate-actions.ts');
  const { insertOptionActivities, rebuildRecord } = await import('./options-sync.ts');
  try {
    await insertActivities(u.id, 'snaptrade', [share('b', 'XYZ', 'BUY', 10, '2026-03-02T15:00:00Z'), share('s', 'ABC', 'SELL', 16, '2026-05-01T15:00:00Z')]);
    await insertCorporateActions(sql, u.id, 'snaptrade', [{ externalId: `${tag}-ren`, accountId: `${tag}-a`, symbol: 'XYZ', executedAt: new Date('2026-04-01T12:00:00Z'),
      kind: 'symbol-change', newSymbol: 'ABC', outUnits: 100, inUnits: 100, raw: {} }]);
    const ex: OptionRow & { raw: unknown } = { externalId: `${tag}-x`, accountId: `${tag}-a`, kind: 'OPTIONEXERCISE', openClose: null, underlying: 'XYZ', underlyingType: 'cs',
      right: 'CALL', expiry: '2026-03-20', strikeMilli: 10_000, multiplier: 100, occTicker: 'XYZ   260320C00010000', units: 1, price: 0, fee: 0, amount: null, currency: 'USD',
      executedAt: new Date('2026-03-02T20:00:00Z'), verified: true, raw: {} };
    // Before the exercise row: the renamed close exists (the chain matches it at +60%).
    await rebuildRecord(u.id);
    const [before] = await sql`select symbol, round(return_pct::numeric, 4)::float8 as r from closed_trades where user_id = ${u.id}`;
    assert.deepEqual({ ...before }, { symbol: 'ABC', r: 0.6 });
    await insertOptionActivities(u.id, 'snaptrade', [ex]);
    const r = await rebuildRecord(u.id);
    assert.equal(r.removedForExercise, 1);
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 0);
    assert.equal((await sql`select excluded_exercise_shares as n from users where id = ${u.id}`)[0].n, 1);
  } finally { await cleanup(); }
});

dbTest('fix round 2 B: a thesis on a close removed for an OCC symbol survives in kept_theses and re-attaches if the close returns', async () => {
  const { sql, tag, u, share, cleanup } = await setup();
  const { insertActivities } = await import('./sync.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const occ = 'XYZ   261219C00123450';
  try {
    await insertActivities(u.id, 'snaptrade', [share('b', occ, 'BUY', 2, '2026-10-01T15:00:00Z'), share('s', occ, 'SELL', 3, '2026-10-02T15:00:00Z')]);
    // A close written before the removal existed, with a thesis (as on a record built before this PR).
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified, thesis, thesis_status)
      values (${u.id}, ${`${tag}-s`}, ${`${tag}-a`}, ${occ}, '2026-10-01T15:00:00Z', '2026-10-02T15:00:00Z', 0.5, 1, true, 'why', 'published')`;
    const r = await rebuildRecord(u.id);
    assert.equal(r.occRemoved, 1);
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 0);
    const [k] = await sql`select thesis, thesis_status from kept_theses where user_id = ${u.id} and sell_id = ${`${tag}-s`}`;
    assert.deepEqual({ ...k }, { thesis: 'why', thesis_status: 'published' });
    // Idempotent: a second rebuild keeps it (the thesis rides along on the rebuilt close before each removal).
    await rebuildRecord(u.id);
    assert.equal((await sql`select count(*)::int as n from kept_theses where user_id = ${u.id} and sell_id = ${`${tag}-s`}`)[0].n, 1);
  } finally { await cleanup(); }
});

test('fix round 2 C: the pane\'s closing note follows the gate (the paneView line), never a fixed "Options … aren\'t shown"', () => {
  const pane = readFileSync(new URL('../app/pane.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(pane, /Options and positions with no recorded entry aren't shown/);
  assert.match(pane, /OPTIONS\.paneNote\(/);
});

test('fix round 2 C: the note\'s words per state', async () => {
  const { OPTIONS } = await import('./copy.ts');
  // Gated or no options: options are not shown; open: they are summarized in the line above.
  assert.equal(OPTIONS.paneNote(false), "Closed trades from connected accounts are published, losses included. Options and positions with no recorded entry aren't shown.");
  assert.equal(OPTIONS.paneNote(true), "Closed share trades from connected accounts are published, losses included; option trades are summarized above. Positions with no recorded entry aren't shown.");
});
