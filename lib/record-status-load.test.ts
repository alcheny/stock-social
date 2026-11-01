// F-11 (docs/features/logs/fixes-labels/plan.md §1 `statusFacts`, §5): the status facts for a set of traders come from
// ONE query, read no schedule or cron setting, and carry the removal dates the sync writes. This file pre-seeds the pool
// lib/db.ts reuses with a query-logging client (as lib/feed.signed-out.test.ts does). Fixtures are this file's own.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q) => { log.push(String(q)); } });
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const DAY = 86_400_000;

test('the loader reads no schedule, cron setting or render clock (F-11 AC2)', () => {
  const src = readFileSync(new URL('./record-status-load.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Date\.now\(|new Date\(\)|ROUND_MS|ROUND_OFFSET|process\.env|now\(\)/);
});

dbTest('statusFacts: one query for the id set; frozen, two-account-removed, demo and no-connection records; the states are the caller\'s', async () => {
  const { sql } = await import('./db.ts');
  const { statusFacts } = await import('./record-status-load.ts');
  const { statusParts } = await import('./record-status.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `l${Math.random().toString(36).slice(2, 9)}`;
  const mk = async (n: string) => (await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` })).id;
  const [frozen, two, demo, none] = [await mk('f'), await mk('t'), await mk('d'), await mk('n')];
  const ids = [frozen, two, demo, none];
  const acc = (id: string, paper = false) => ({ id, authorizationId: 'a', institution: 'Fake Brokerage', isPaper: paper, initialSyncCompleted: true });
  const disc = new Date(Date.now() - 5 * DAY), removed = new Date(Date.now() - 3 * DAY), synced = new Date(Date.now() - 2 * 3_600_000);
  try {
    for (const [u, accounts, d] of [[frozen, [acc(`${tag}-f1`)], disc], [two, [acc(`${tag}-t1`), acc(`${tag}-t2`), acc(`${tag}-tp`, true)], null]] as const) {
      await sql`insert into connections (attempt_id, user_id, state, consent_at, connected_at, disconnected_at, institution, accounts)
        select signup_attempt_id, id, 'connected', ${new Date(Date.now() - 60 * DAY)}, now(), ${d}, 'Fake Brokerage', ${sql.json(accounts)} from users where id = ${u}`;
      await sql`insert into broker_accounts ${sql(accounts.map((a) => ({ account_id: a.id, user_id: u, confirmed_at: new Date(), is_paper: a.isPaper })))}`;
      await sql`insert into activities ${sql(accounts.filter((a) => !a.isPaper).map((a) => ({ user_id: u, source: 'snaptrade', external_id: `${a.id}-x`, account_id: a.id,
        symbol: 'AAA', side: 'BUY', units: 1, price: 1, fee: 0, executed_at: new Date(Date.now() - 90 * DAY), raw: sql.json({}) })))}`;
    }
    await sql`update broker_accounts set removed_at = ${removed} where account_id = ${`${tag}-t2`}`;
    await sql`update users set last_synced_at = ${synced} where id = ${two}`;
    await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, fee, executed_at, raw)
      values (${demo}, 'demo', ${`${tag}-demo`}, 'demo', 'AAA', 'BUY', 1, 1, 0, now(), '{}')`;
    await sql`insert into closed_trades ${sql(ids.map((u, i) => ({ user_id: u, sell_id: `${tag}-s${i}`, account_id: 'a', symbol: 'AAA',
      opened_at: new Date(Date.now() - 30 * DAY), closed_at: new Date(Date.now() - 10 * DAY), return_pct: 0.05, holding_days: 20, verified: u !== demo })))}`;
    const states = new Map(ids.map((id) => [id, { state: 'connected' as const }]));
    log.length = 0;
    const f = await statusFacts(ids, states);
    assert.equal(log.length, 1, log.join('\n---\n'));
    assert.deepEqual(ids.map((id) => f.get(id)!.source), ['broker', 'broker', 'demo', 'none']);
    const now = new Date();
    const fz = statusParts(f.get(frozen)!, now, 'live');
    assert.equal(fz.frozen?.getTime(), disc.getTime());
    assert.match(fz.line1.map((p) => p.text).join(' · '), /Disconnected .* · record frozen$/);
    const t = f.get(two)!;
    assert.equal(t.lastSyncedAt?.getTime(), synced.getTime());
    assert.deepEqual(t.brokers, ['Fake Brokerage']);
    assert.equal(t.accounts, 2);
    assert.deepEqual(t.connections[0].accounts.map((a) => [a.id, a.isPaper, a.removedAt?.getTime() ?? null]), [[`${tag}-t1`, false, null], [`${tag}-t2`, false, removed.getTime()], [`${tag}-tp`, true, null]]);
    const tl = statusParts(t, now, 'live');
    assert.deepEqual(tl.accounts.map((p) => p.text.replace(/removed .*/, 'removed')), ['Account 1 of 2 · Fake Brokerage', 'Account 2 of 2 · Account removed']);
    assert.match(tl.line2.map((p) => p.text).join(' · '), /^Last close .* · updated 2 hours ago$/);
    assert.equal(statusParts(f.get(none)!, now, 'live').show, false);
    // The caller's state wins: the same facts while importing show nothing.
    const importing = await statusFacts([two], new Map([[two, { state: 'importing' as const }]]));
    assert.equal(statusParts(importing.get(two)!, now, 'live').show, false);
  } finally {
    await sql`delete from users where id in ${sql(ids)}`;
    await sql`delete from broker_accounts where account_id like ${`${tag}-%`}`;
  }
});

dbTest('statusFacts: an F-7 public filing profile (users.public_filer_id) is source "filing" and gets no status line, on any state', async () => {
  const { sql } = await import('./db.ts');
  const { statusFacts } = await import('./record-status-load.ts');
  const { statusParts, cardSegments, paneSegments } = await import('./record-status.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `p${Math.random().toString(36).slice(2, 9)}`;
  const [pf] = await sql`insert into public_filers (source, filer_key, demo) values ('insider_reports', ${`${tag}-k`}, true) returning id`;
  const u = (await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` })).id;
  try {
    await sql`update users set public_filer_id = ${pf.id}, last_synced_at = now() - interval '40 days' where id = ${u}`;
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u}, ${`${tag}-s`}, 'a', 'AAA', now() - interval '30 days', now() - interval '10 days', 0.05, 20, false)`;
    const now = new Date();
    for (const state of ['connected', 'public', 'public_demo'] as const) {
      const f = (await statusFacts([u], new Map([[u, { state }]]))).get(u)!;
      assert.equal(f.source, 'filing');
      const p = statusParts(f, now, 'live');
      assert.equal(p.show, false, state);
      assert.deepEqual(p.card, []);
      assert.ok(!(cardSegments(f, now)?.length), `${state}: no card line`);
      assert.ok(!(paneSegments(f, now)?.length), `${state}: no pane line`);
    }
  } finally {
    await sql`delete from users where id = ${u}`;
    await sql`delete from public_filers where id = ${pf.id}`;
  }
});
