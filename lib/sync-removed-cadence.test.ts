// Merge of F-14 (sync cadence, #64) with F-11's removed_at stamp: under the cadence the vendor's account list is still
// read on every run (lib/sync.ts: the list carries the claim and TR-5's freeze check), while activities and positions
// wait for their due time. So the stamp follows the list, not the activities read: a run that read the list but deferred
// every activities read still stamps an account the list no longer has, and a run whose list read failed stamps
// nothing. Every fixture here is this file's own (unique tag); nothing counts rows it did not create.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

type VAcc = { id: string; authorizationId: string; institution: string; isPaper: boolean; initialSyncCompleted: boolean };
const vacc = (id: string): VAcc => ({ id, authorizationId: 'a', institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `rc${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-vendor`, snaptrade_secret_enc: 'enc' };
  const ids = [`${tag}-a1`, `${tag}-a2`];
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', now(), now(), now(), ${sql.json(ids.map(vacc))} from users where id = ${u.id}`;
  const removed = async () => Object.fromEntries((await sql`select account_id, removed_at from broker_accounts where user_id = ${u.id}`).map((r) => [r.account_id as string, r.removed_at as Date | null]));
  const calls = { lists: 0, activities: 0 };
  const broker = (listed: VAcc[] | (() => never)) => ({
    listAccounts: async () => { calls.lists++; return typeof listed === 'function' ? listed() : listed; },
    fetchActivities: async () => { calls.activities++; return []; },
  });
  const cleanup = async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id in ${sql(ids)}`; };
  return { user, ids, removed, broker, calls, cleanup };
}

dbTest('F-14 × removed_at: a cadence run that defers every activities read still reads the list and stamps the unlisted account', async () => {
  const { syncUser } = await import('./sync.ts');
  const h = await setup();
  try {
    const reports: { activitiesRead: number; deferred: number }[] = [];
    const opts = { cadence: true, report: (r: { activitiesRead: number; deferred: number }) => { reports.push(r); } };
    await syncUser(h.user, h.broker(h.ids.map(vacc)), undefined, new Date(), opts); // the first sync is never throttled
    assert.equal(reports[0]?.activitiesRead, 2);
    assert.deepEqual(await h.removed(), { [h.ids[0]]: null, [h.ids[1]]: null });
    const acts = h.calls.activities, lists = h.calls.lists;
    const t1 = new Date();
    await syncUser(h.user, h.broker([vacc(h.ids[0])]), undefined, t1, opts); // minutes later: nothing due
    assert.equal(h.calls.lists, lists + 1); // the list was read
    assert.equal(h.calls.activities, acts); // no activities read on this run
    assert.equal(reports[1]?.activitiesRead, 0);
    const r = await h.removed();
    assert.equal(r[h.ids[0]], null);
    assert.equal(r[h.ids[1]]?.getTime(), t1.getTime());
  } finally {
    await h.cleanup();
  }
});

dbTest('F-14 × removed_at: a cadence run whose list read fails stamps nothing', async () => {
  const { syncUser } = await import('./sync.ts');
  const h = await setup();
  try {
    await syncUser(h.user, h.broker(h.ids.map(vacc)), undefined, new Date(), { cadence: true });
    await assert.rejects(syncUser(h.user, h.broker(() => { throw new Error('vendor down'); }), undefined, new Date(), { cadence: true }));
    assert.deepEqual(await h.removed(), { [h.ids[0]]: null, [h.ids[1]]: null });
  } finally {
    await h.cleanup();
  }
});
