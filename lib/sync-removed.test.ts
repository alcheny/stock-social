// F-11 / TR-5 (docs/features/logs/fixes-labels/plan.md §3 "removed_at write", "Idle counter", §6 item 11): a sync stamps
// broker_accounts.removed_at only after the vendor's account list came back and was not empty, only for a confirmed real
// account no longer listed whose connection still lists at least one account, once; a later list that names it again
// clears it (PR #85 review B1: a short list labels the account row only until then). An empty list is
// the disconnect path (connections.disconnected_at), never a removal. The idle count is one number in the counts-only
// sync tick line. Every fixture here is this file's own (unique tag); nothing counts rows it did not create.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const DAY = 86_400_000;
type VAcc = { id: string; authorizationId: string; institution: string; isPaper: boolean; initialSyncCompleted: boolean };
const vacc = (id: string, isPaper = false): VAcc => ({ id, authorizationId: 'a', institution: 'Fake Brokerage', isPaper, initialSyncCompleted: true });

async function setup(accountIds: string[], paper: string[] = []) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `r${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-vendor`, snaptrade_secret_enc: 'enc' };
  const ids = accountIds.map((a) => `${tag}-${a}`);
  const paperIds = paper.map((a) => `${tag}-${a}`);
  const [c] = await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', now(), now(), now(), ${sql.json([...ids.map((id) => vacc(id)), ...paperIds.map((id) => vacc(id, true))])} from users where id = ${u.id} returning id`;
  const removed = async () => Object.fromEntries((await sql`select account_id, removed_at from broker_accounts where user_id = ${u.id}`).map((r) => [r.account_id as string, r.removed_at as Date | null]));
  const broker = (listed: VAcc[] | (() => never)) => ({
    listAccounts: async () => (typeof listed === 'function' ? listed() : listed),
    fetchActivities: async () => [],
  });
  return { sql, tag, user, ids, paperIds, connectionId: Number(c.id), removed, broker, cleanup: async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id in ${sql([...ids, ...paperIds])}`; } };
}

dbTest('removed_at: one of two accounts unlisted → only that one stamped; a later list without it keeps the first date; listing it again clears it (B1)', async () => {
  const { syncUser } = await import('./sync.ts');
  const h = await setup(['a1', 'a2']);
  try {
    const t0 = new Date(Date.now() - 3 * DAY), t1 = new Date(Date.now() - 2 * DAY), t2 = new Date(Date.now() - DAY);
    await syncUser(h.user, h.broker([vacc(h.ids[0]), vacc(h.ids[1])]), undefined, t0);
    assert.deepEqual(await h.removed(), { [h.ids[0]]: null, [h.ids[1]]: null });
    await syncUser(h.user, h.broker([vacc(h.ids[0])]), undefined, t1);
    let r = await h.removed();
    assert.equal(r[h.ids[0]], null);
    assert.equal(r[h.ids[1]]?.getTime(), t1.getTime());
    await syncUser(h.user, h.broker([vacc(h.ids[0])]), undefined, t2);
    assert.equal((await h.removed())[h.ids[1]]?.getTime(), t1.getTime()); // written once
    await syncUser(h.user, h.broker([vacc(h.ids[0]), vacc(h.ids[1])]), undefined, t2);
    r = await h.removed();
    assert.equal(r[h.ids[1]], null); // listed again: cleared (B1)
    assert.equal((await h.sql`select disconnected_at from connections where id = ${h.connectionId}`)[0].disconnected_at, null); // not a disconnect
  } finally {
    await h.cleanup();
  }
});

dbTest('removed_at: the vendor list throws → nothing stamped (and nothing else written); an empty list is the disconnect path, never a removal', async () => {
  const { syncUser } = await import('./sync.ts');
  const h = await setup(['a1', 'a2']);
  try {
    await syncUser(h.user, h.broker([vacc(h.ids[0]), vacc(h.ids[1])]));
    await assert.rejects(syncUser(h.user, h.broker(() => { throw new Error('vendor down'); })));
    assert.deepEqual(await h.removed(), { [h.ids[0]]: null, [h.ids[1]]: null });
    // Merge with main (#79, F3-3): an empty list only marks the connection missing; a second one FREEZE_CONFIRM_HOURS
    // later freezes it. Neither is a removal.
    const later = new Date(Date.now() + 25 * 3_600_000);
    await syncUser(h.user, h.broker([]));
    assert.deepEqual(await h.removed(), { [h.ids[0]]: null, [h.ids[1]]: null });
    assert.equal((await h.sql`select disconnected_at from connections where id = ${h.connectionId}`)[0].disconnected_at, null);
    await syncUser(h.user, h.broker([]), undefined, later);
    assert.deepEqual(await h.removed(), { [h.ids[0]]: null, [h.ids[1]]: null });
    assert.ok((await h.sql`select disconnected_at from connections where id = ${h.connectionId}`)[0].disconnected_at);
  } finally {
    await h.cleanup();
  }
});

dbTest('removed_at: a listing with only a simulated account left still stamps the real one; a simulated account is never stamped', async () => {
  const { syncUser } = await import('./sync.ts');
  const h = await setup(['a1'], ['p1']);
  try {
    await syncUser(h.user, h.broker([vacc(h.ids[0]), vacc(h.paperIds[0], true)]));
    await syncUser(h.user, h.broker([vacc(h.ids[0])]));
    assert.equal((await h.removed())[h.paperIds[0]], null);
    await syncUser(h.user, h.broker([vacc(h.paperIds[0], true)]));
    assert.ok((await h.removed())[h.ids[0]]);
  } finally {
    await h.cleanup();
  }
});

dbTest('idle count: the same predicate as idleSince (last sync, else earliest live consent, 30 days; frozen records not counted); the tick line carries it as a number and no id', async () => {
  const { sql } = await import('./db.ts');
  const { idleCount, syncTick } = await import('./sync.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `i${Math.random().toString(36).slice(2, 9)}`;
  const mk = async (name: string, lastSyncDaysAgo: number | null, conns: { consentDaysAgo: number; disconnected?: boolean }[]) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${name}` });
    await sql`update users set last_synced_at = ${lastSyncDaysAgo === null ? null : new Date(Date.now() - lastSyncDaysAgo * DAY)} where id = ${u.id}`;
    for (const c of conns) await sql`insert into connections (attempt_id, user_id, state, consent_at, connected_at, disconnected_at)
      select signup_attempt_id, id, 'connected', ${new Date(Date.now() - c.consentDaysAgo * DAY)}, now(), ${c.disconnected ? new Date() : null} from users where id = ${u.id}`;
    // QA round 2 (N5): the idle line needs a close, so every fixture has one (a record without one is lib/idle-count.test.ts's).
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u.id}, ${`${tag}${name}-s`}, 'a', 'AAA', ${new Date(Date.now() - 100 * DAY)}, ${new Date(Date.now() - 99 * DAY)}, 0.01, 1, true)`;
    return u.id;
  };
  const ids = [
    await mk('a', 31, [{ consentDaysAgo: 90 }]), // idle
    await mk('b', 2, [{ consentDaysAgo: 90 }]), // fresh
    await mk('c', null, [{ consentDaysAgo: 2 }]), // just connected: not idle
    await mk('d', null, [{ consentDaysAgo: 40 }]), // never synced, consented 40 days ago: idle
    await mk('e', 60, [{ consentDaysAgo: 90, disconnected: true }]), // frozen: not idle
    await mk('f', null, []), // no connection
  ];
  const logged: string[] = [];
  const log = console.log;
  try {
    assert.equal(await idleCount(ids), 2);
    console.log = (...a: unknown[]) => { logged.push(a.map(String).join(' ')); };
    const reports: Record<string, unknown>[] = [];
    // Deadline already past: claims nobody, syncs nobody; the counts still run, unscoped (the whole fleet's count).
    await syncTick({ deadline: 0, sync: async () => 1, report: (r) => reports.push(r) });
    console.log = log;
    assert.equal(typeof reports[0].idle, 'number');
    const line = logged.find((l) => l.startsWith('sync tick '))!;
    const body = JSON.parse(line.slice('sync tick '.length));
    assert.equal(typeof body.idle, 'number');
    assert.ok(Object.values(body).every((v) => typeof v === 'number' || typeof v === 'boolean' || v === null), line);
    assert.deepEqual(Object.keys(body), ['ok', 'skipped', 'failed', 'unclaimed', 'stoppedAtDeadline', 'idle']); // counts only, no id
    assert.doesNotMatch(line, new RegExp(tag));
    // Sharded sync (main #46): the route's tick is runShard + shard 0's coverage step; the idle count rides on coverage
    // (the call's fleet-level, numbers-only report), over the same scope.
    const { coverage } = await import('./sync-shard.ts');
    const covLines: string[] = [];
    const cov = await coverage(1, { ids }, undefined, (l) => covLines.push(l));
    assert.equal(cov.idle, 2);
    assert.equal((await coverage(1, { ids: [] }, undefined, (l) => covLines.push(l))).idle, 0);
    const covLine = covLines.find((l) => l.startsWith('sync coverage '))!;
    assert.equal(typeof JSON.parse(covLine.slice('sync coverage '.length)).idle, 'number');
    assert.doesNotMatch(covLines.join('\n'), new RegExp(tag));
  } finally {
    console.log = log;
    await sql`delete from users where id in ${sql(ids)}`;
  }
});
