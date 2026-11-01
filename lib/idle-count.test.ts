// Fixes-labels QA round 2 (N5): the sync's idle count counts only records that would show the idle line
// (lib/record-status.ts#statusParts): a broker record with at least one close, no consented import running or failed,
// not Demo, not built from public filings, not frozen (every connection disconnected; PR #85 review B1: a record whose
// live accounts are all removed is not frozen, shows the idle line and is counted);
// and the coverage step passes its whole scope (Scope.idRange too). Every fixture is this file's own (a unique tag).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const DAY = 86_400_000;

dbTest('N5: idle count = records showing the idle line (a close, live, not importing or failed, not Demo; every account removed is not frozen, B1); idRange scopes it', async () => {
  const { sql } = await import('./db.ts');
  const { idleCount } = await import('./sync.ts');
  const { coverage } = await import('./sync-shard.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `n${Math.random().toString(36).slice(2, 9)}`;
  const accts: string[] = [];
  type Opt = { close?: boolean; state?: 'connected' | 'importing' | 'failed'; demo?: boolean; removed?: 'all' | 'one' };
  const mk = async (name: string, o: Opt = {}) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${name}` });
    await sql`update users set last_synced_at = ${new Date(Date.now() - 45 * DAY)} where id = ${u.id}`;
    const ids = [`${tag}${name}-1`, `${tag}${name}-2`];
    accts.push(...ids);
    const list = ids.map((id) => ({ id, authorizationId: 'a', institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true }));
    await sql`insert into connections (attempt_id, user_id, state, consent_at, connected_at, accounts)
      select signup_attempt_id, id, 'connected', ${new Date(Date.now() - 90 * DAY)}, now(), ${sql.json(list)} from users where id = ${u.id}`;
    if (o.state && o.state !== 'connected') await sql`insert into connections (attempt_id, user_id, state, consent_at)
      select signup_attempt_id, id, ${o.state}, now() from users where id = ${u.id}`;
    await sql`insert into broker_accounts ${sql(ids.map((id, i) => ({ account_id: id, user_id: u.id, confirmed_at: new Date(),
      removed_at: o.removed === 'all' || (o.removed === 'one' && i === 1) ? new Date(Date.now() - 50 * DAY) : null })))}`;
    if (o.close !== false) await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u.id}, ${`${tag}${name}-s`}, ${ids[0]}, 'AAA', ${new Date(Date.now() - 100 * DAY)}, ${new Date(Date.now() - 99 * DAY)}, 0.01, 1, ${!o.demo})`;
    if (o.demo) await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
      values (${u.id}, 'demo', ${`${tag}${name}-d`}, ${ids[0]}, 'AAA', 'BUY', 1, 1, ${new Date(Date.now() - 100 * DAY)}, ${sql.json({})})`;
    return u.id as number;
  };
  try {
    const idle = await mk('idle'); // counted
    const oneRemoved = await mk('one', { removed: 'one' }); // counted: an account left
    const allRemoved = await mk('allrm', { removed: 'all' }); // counted: every live account removed is not frozen (B1), so idle
    const ids = [idle, oneRemoved, allRemoved,
      await mk('noclose', { close: false }), // no close: no status line
      await mk('imp', { state: 'importing' }), // an import running: no status line
      await mk('fail', { state: 'failed' }), // a failed import: the failed note, no status line
      await mk('demo', { demo: true }), // Demo data: "Demo data", never idle
    ];
    assert.equal(await idleCount(ids), 3);
    // Scope.idRange (lib/sync-shard.ts): the range alone, and with ids.
    const lo = Math.min(...ids), hi = Math.max(...ids);
    assert.equal(await idleCount(ids, [lo, hi]), 3);
    assert.equal(await idleCount(ids, [allRemoved, allRemoved]), 1);
    assert.equal(await idleCount(ids, [oneRemoved, oneRemoved]), 1);
    assert.equal(await idleCount(undefined, [idle, idle]), 1);
    // The coverage step passes its whole scope.
    assert.equal((await coverage(1, { ids, idRange: [idle, idle] })).idle, 1);
    assert.equal((await coverage(1, { idRange: [oneRemoved, oneRemoved] })).idle, 1);
    assert.match(readFileSync(new URL('./sync-shard.ts', import.meta.url), 'utf8'), /idleCount\(scope\.ids, scope\.idRange\)/);
  } finally {
    await sql`delete from users where handle like ${`${tag}%`}`;
    if (accts.length) await sql`delete from broker_accounts where account_id in ${sql(accts)}`;
  }
});
