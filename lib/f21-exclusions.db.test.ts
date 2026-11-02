// F-21 · the stored counters behind the exclusion sum (committee decisions 4, 5, 8; ACs "future BUY", "notShared"):
// excluded_future_sells and excluded_shared are written in the rebuild's own transaction, a marked shared account in a
// rename chain feeds nothing and is counted, an OCC row in a marked account is counted once, and the E6 double count is
// pinned as today's behaviour (a ponytail and an owner flag, must-fix before real users).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUNTERS, exclusionTotal } from './exclusions.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const OCC = 'XYZ   261016C00123450';
async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { insertActivities } = await import('./sync.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const { storedExclusions, exclusionInput } = await import('./exclusions-load.ts');
  const { optionHeadline } = await import('./options-load.ts');
  const tag = `f21${Math.random().toString(36).slice(2, 9)}`;
  const made: number[] = [], accounts: string[] = [];
  const mkUser = async (n: string) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` });
    made.push(u.id);
    return u.id;
  };
  const act = (id: string, accountId: string, side: 'BUY' | 'SELL', price: number, at: Date | number, units = 100, symbol = 'AAA') => {
    if (!accounts.includes(accountId)) accounts.push(accountId);
    return { externalId: `${tag}-${id}`, accountId, symbol, side, units, price, fee: 0, executedAt: typeof at === 'number' ? new Date(Date.UTC(2024, 0, at)) : at, verified: true, raw: {} };
  };
  const opt = (id: string, acc: string, kind: string, oc: string, at: string, price: number) => ({
    externalId: `${tag}-${id}`, accountId: acc, kind, openClose: oc, underlying: 'XYZ', underlyingType: 'cs', right: 'CALL', expiry: '2026-10-16',
    strikeMilli: 123_450, multiplier: 100, occTicker: OCC, units: 1, price, fee: 0, amount: null, currency: 'USD', executedAt: new Date(at), verified: true, raw: {},
  });
  const counters = async (id: number) => (await sql`select excluded_positions, excluded_future, excluded_future_sells, excluded_corporate, excluded_held, excluded_shared,
    excluded_options_short, excluded_options_other, excluded_exercise_shares from users where id = ${id}`)[0];
  const total = async (id: number) => exclusionTotal(exclusionInput((await storedExclusions([id])).get(id), (await optionHeadline([id])).get(id)!));
  const closes = async (id: number) => Number((await sql`select count(*)::int as n from closed_trades where user_id = ${id}`)[0].n);
  const mark = (acc: string, id: number) => sql`insert into shared_account_marks (account_id, user_id) values (${acc}, ${id})`;
  const cleanup = async () => {
    if (made.length) await sql`delete from users where id in ${sql(made)}`;
    if (accounts.length) await sql`delete from broker_accounts where account_id in ${sql(accounts)}`;
  };
  return { sql, tag, mkUser, act, opt, counters, total, closes, mark, cleanup, insertActivities, rebuildRecord };
}

dbTest('F-21 AC (future BUY): the total counts sells only; a future BUY moves excluded_future, never the line, and maturing keeps it', async () => {
  const { sql, tag, mkUser, act, counters, total, cleanup, insertActivities, rebuildRecord } = await setup();
  try {
    const u = await mkUser('a');
    const acc = `${tag}-acc`;
    const soon = new Date(Date.now() + 5 * 86_400_000);
    await insertActivities(u, 'snaptrade', [act('b1', acc, 'BUY', 10, 1), act('s1', acc, 'SELL', 12, 2), act('s2', acc, 'SELL', 12, 3, 50, 'BBB'), act('fb', acc, 'BUY', 10, soon, 10, 'CCC')], sql);
    await rebuildRecord(u);
    let c = await counters(u);
    assert.deepEqual([c.excluded_positions, c.excluded_future, c.excluded_future_sells], [1, 1, 0]);
    assert.equal(await total(u), 1);
    // The BUY matures (its stored date passes): excluded_future drops, the line's count does not move.
    await sql`update activities set executed_at = now() - interval '1 day' where external_id = ${`${tag}-fb`}`;
    await rebuildRecord(u);
    c = await counters(u);
    assert.deepEqual([c.excluded_future, c.excluded_future_sells], [0, 0]);
    assert.equal(await total(u), 1);
    // A future SELL is counted while it is future-dated (and only its sell part).
    await insertActivities(u, 'snaptrade', [act('fs', acc, 'SELL', 10, soon, 5, 'CCC')], sql);
    await rebuildRecord(u);
    c = await counters(u);
    assert.deepEqual([c.excluded_future, c.excluded_future_sells], [1, 1]);
    assert.equal(await total(u), 2);
  } finally {
    await cleanup();
  }
});

dbTest('F-21 AC (notShared): a marked shared account in a rename chain feeds nothing, and its sell is counted in excluded_shared', async () => {
  const { sql, tag, mkUser, act, counters, total, closes, mark, cleanup, insertActivities, rebuildRecord } = await setup();
  const { insertCorporateActions } = await import('./corporate-actions.ts');
  try {
    const u = await mkUser('a');
    const acc = `${tag}-acc`;
    await insertActivities(u, 'snaptrade', [act('b1', acc, 'BUY', 10, 1, 100, 'OLD'), act('s1', acc, 'SELL', 11, 40, 100, 'NEW')], sql);
    await insertCorporateActions(sql, u, 'snaptrade', [{ externalId: `${tag}-rn`, accountId: acc, symbol: 'OLD', executedAt: new Date(Date.UTC(2024, 0, 10)), kind: 'symbol-change', newSymbol: 'NEW', outUnits: 100, inUnits: 100, raw: {} }]);
    await rebuildRecord(u);
    assert.equal(await closes(u), 1);
    assert.equal(await total(u), 0);
    await mark(acc, u);
    await rebuildRecord(u);
    assert.equal(await closes(u), 0);
    assert.equal((await counters(u)).excluded_shared, 1);
    assert.equal(await total(u), 1);
    // A second marked account outside any chain: its two sells (one with no entry) are counted there, never as positions.
    const acc2 = `${tag}-acc2`;
    await insertActivities(u, 'snaptrade', [act('b2', acc2, 'BUY', 10, 1), act('s2', acc2, 'SELL', 12, 2), act('s3', acc2, 'SELL', 12, 3, 500)], sql);
    await mark(acc2, u);
    await rebuildRecord(u);
    const c = await counters(u);
    assert.deepEqual([c.excluded_shared, c.excluded_positions], [3, 0]);
    assert.equal(await total(u), 3);
  } finally {
    await cleanup();
  }
});

dbTest('F-21 decision 4: an OCC row in a marked account is counted once, on the share path alone or in both tables; buys never', async () => {
  const { sql, tag, mkUser, act, opt, counters, mark, cleanup, insertActivities, rebuildRecord } = await setup();
  const { insertOptionActivities } = await import('./options-sync.ts');
  try {
    const u = await mkUser('a');
    const acc = `${tag}-acc`;
    await insertActivities(u, 'snaptrade', [act('ob', acc, 'BUY', 1, 1, 1, OCC), act('os', acc, 'SELL', 2, 2, 1, OCC)], sql);
    await mark(acc, u);
    await rebuildRecord(u);
    assert.equal((await counters(u)).excluded_shared, 1);
    // The same vendor rows also stored as option rows: still one.
    await insertOptionActivities(u, 'snaptrade', [opt('ob', acc, 'BUY', 'BUY_TO_OPEN', '2024-01-01T15:00:00Z', 1), opt('os', acc, 'SELL', 'SELL_TO_CLOSE', '2024-01-02T15:00:00Z', 2)] as never);
    await rebuildRecord(u);
    assert.equal((await counters(u)).excluded_shared, 1);
    // An option close only in the option table (another contract row): counted by the option part.
    await insertOptionActivities(u, 'snaptrade', [opt('ob2', acc, 'BUY', 'BUY_TO_OPEN', '2024-02-01T15:00:00Z', 1), opt('os2', acc, 'SELL', 'SELL_TO_CLOSE', '2024-02-02T15:00:00Z', 3)] as never);
    await rebuildRecord(u);
    const c = await counters(u);
    assert.equal(c.excluded_shared, 2);
    assert.deepEqual([c.excluded_options_short, c.excluded_options_other], [0, 0]); // marked rows never reach the option counters
  } finally {
    await cleanup();
  }
});

dbTest('F-21 review blocking 1: an unmarked OCC pair stored in both tables is one trade (the options matcher\'s), never two', async () => {
  const { sql, tag, mkUser, act, opt, counters, total, cleanup, insertActivities, rebuildRecord } = await setup();
  const { insertOptionActivities } = await import('./options-sync.ts');
  try {
    const u = await mkUser('a');
    const acc = `${tag}-acc`;
    await insertActivities(u, 'snaptrade', [act('ob', acc, 'BUY', 1, 1, 1, OCC), act('os', acc, 'SELL', 2, 2, 1, OCC)], sql);
    await insertOptionActivities(u, 'snaptrade', [opt('ob', acc, 'BUY', 'BUY_TO_OPEN', '2024-01-01T15:00:00Z', 1), opt('os', acc, 'SELL', 'SELL_TO_CLOSE', '2024-01-02T15:00:00Z', 2)] as never);
    await rebuildRecord(u);
    const c = await counters(u);
    assert.deepEqual([c.excluded_options_other, c.excluded_positions, c.excluded_shared], [0, 0, 0]);
    assert.equal(await total(u), 1); // the one option close, shown in option_trades
    // On the share path alone it is still one (counted under options via the share path).
    const u2 = await mkUser('b');
    await insertActivities(u2, 'snaptrade', [act('pb', `${acc}2`, 'BUY', 1, 1, 1, OCC), act('ps', `${acc}2`, 'SELL', 2, 2, 1, OCC)], sql);
    await rebuildRecord(u2);
    assert.equal((await counters(u2)).excluded_options_other, 1);
    assert.equal(await total(u2), 1);
  } finally {
    await cleanup();
  }
});

dbTest('F-21 review fix 2: a future-dated sell in a marked account is counted once, as shared (never in the future count)', async () => {
  const { sql, tag, mkUser, act, counters, total, mark, cleanup, insertActivities, rebuildRecord } = await setup();
  try {
    const u = await mkUser('a');
    const acc = `${tag}-acc`;
    await insertActivities(u, 'snaptrade', [act('fs', acc, 'SELL', 10, new Date(Date.now() + 5 * 86_400_000), 5)], sql);
    await mark(acc, u);
    await rebuildRecord(u);
    const c = await counters(u);
    assert.deepEqual([c.excluded_shared, c.excluded_future_sells, c.excluded_future], [1, 0, 0]);
    assert.equal(await total(u), 1);
  } finally {
    await cleanup();
  }
});

dbTest('F-21 E6 (pinned, ponytail, owner flag): an OCC share-path sell the share matcher counted as corporate is counted again under options', async () => {
  const { sql, tag, mkUser, act, counters, cleanup, insertActivities, rebuildRecord } = await setup();
  const { insertCorporateActions } = await import('./corporate-actions.ts');
  try {
    const u = await mkUser('a');
    const acc = `${tag}-acc`;
    await insertActivities(u, 'snaptrade', [act('b1', acc, 'BUY', 1, 1, 1, OCC), act('s1', acc, 'SELL', 2, 20, 1, OCC)], sql);
    // A split with no exact ratio on the pair between the buy and the sell: the share matcher counts the sell as corporate.
    await insertCorporateActions(sql, u, 'snaptrade', [{ externalId: `${tag}-sp`, accountId: acc, symbol: OCC, executedAt: new Date(Date.UTC(2024, 0, 10)), kind: 'unpriceable', reason: 'split', raw: {} } as never]);
    await rebuildRecord(u);
    const c = await counters(u);
    // Today: once under corporate and once under options (extraOther) — the known double count E6.
    assert.deepEqual([c.excluded_corporate, c.excluded_options_other, c.excluded_positions], [1, 1, 0]);
  } finally {
    await cleanup();
  }
});

dbTest('F-21 guard, live schema: every excluded_* column on users is classified in lib/exclusions.ts', async () => {
  const { sql } = await import('./db.ts');
  const cols = (await sql`select column_name from information_schema.columns where table_name = 'users' and column_name like 'excluded%'`).map((r) => r.column_name as string);
  assert.ok(cols.includes('excluded_future_sells') && cols.includes('excluded_shared'));
  for (const c of cols) assert.ok(c in COUNTERS, `users.${c} unclassified`);
});
