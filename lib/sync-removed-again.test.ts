// Fixes-labels QA round 2 (N2): an account removed, listed again (a trade on it executed after the removal, which only
// a later listing imports) and then missing again is stamped again, so the status line shows the second removal's date
// (lib/record-status-load.ts hides a stamp older than such a trade). The guards stay: only after a vendor list that came
// back and is not empty, never on an error, only while the connection still lists at least one account. Every fixture
// is this file's own (a unique tag).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const DAY = 86_400_000, HOUR = 3_600_000;
type VAcc = { id: string; authorizationId: string; institution: string; isPaper: boolean; initialSyncCompleted: boolean };
const vacc = (id: string): VAcc => ({ id, authorizationId: 'a', institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `q${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-vendor`, snaptrade_secret_enc: 'enc' };
  const ids = [`${tag}-a1`, `${tag}-a2`];
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', now(), now(), now(), ${sql.json(ids.map(vacc))} from users where id = ${u.id}`;
  const removedAt = async (id: string) => ((await sql`select removed_at from broker_accounts where account_id = ${id}`)[0]?.removed_at as Date | null) ?? null;
  // A trade the relisting imported: a buy on that account at `at` (raw rows are immutable; the fake vendor reads none).
  const trade = (account: string, at: Date) => sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, fee, executed_at, raw)
    values (${u.id}, 'snaptrade', ${`${tag}-${at.getTime()}`}, ${account}, 'AAA', 'BUY', 1, 1, 0, ${at}, ${sql.json({})})`;
  const broker = (listed: VAcc[] | (() => never)) => ({ listAccounts: async () => (typeof listed === 'function' ? listed() : listed), fetchActivities: async () => [] });
  return { sql, user, ids, removedAt, trade, broker, uid: u.id as number,
    cleanup: async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id in ${sql(ids)}`; } };
}

dbTest('N2: removed, listed again with a trade after the removal, then missing again → stamped again with the second date; the status shows it', async () => {
  const { syncUser } = await import('./sync.ts');
  const { statusFacts } = await import('./record-status-load.ts');
  const h = await setup();
  try {
    const t0 = new Date(Date.now() - 10 * DAY), t1 = new Date(Date.now() - 8 * DAY), t3 = new Date(Date.now() - 2 * DAY);
    await syncUser(h.user, h.broker([vacc(h.ids[0]), vacc(h.ids[1])]), undefined, t0);
    await syncUser(h.user, h.broker([vacc(h.ids[0])]), undefined, t1);
    assert.equal((await h.removedAt(h.ids[1]))?.getTime(), t1.getTime());
    // Listed again: the relisting imports a trade executed after the removal; removed_at is never cleared.
    await h.trade(h.ids[1], new Date(t1.getTime() + 3 * DAY));
    await syncUser(h.user, h.broker([vacc(h.ids[0]), vacc(h.ids[1])]), undefined, new Date(t1.getTime() + 4 * DAY));
    assert.equal((await h.removedAt(h.ids[1]))?.getTime(), t1.getTime());
    let f = (await statusFacts([h.uid], new Map([[h.uid, { state: 'connected' as const }]]))).get(h.uid)!;
    assert.equal(f.connections[0].accounts.find((a) => a.id === h.ids[1])!.removedAt, null); // shown as listed again
    // Missing again: stamped with the second removal's date.
    await syncUser(h.user, h.broker([vacc(h.ids[0])]), undefined, t3);
    assert.equal((await h.removedAt(h.ids[1]))?.getTime(), t3.getTime());
    f = (await statusFacts([h.uid], new Map([[h.uid, { state: 'connected' as const }]]))).get(h.uid)!;
    assert.equal(f.connections[0].accounts.find((a) => a.id === h.ids[1])!.removedAt?.getTime(), t3.getTime());
    // Still missing on the next sync, with no newer trade: the date is written once.
    await syncUser(h.user, h.broker([vacc(h.ids[0])]), undefined, new Date(t3.getTime() + HOUR));
    assert.equal((await h.removedAt(h.ids[1]))?.getTime(), t3.getTime());
    assert.equal((await h.removedAt(h.ids[0])), null);
  } finally {
    await h.cleanup();
  }
});

dbTest('N2 guards: after a relisting with a trade, a vendor error stamps nothing; an empty list is a disconnect, never a re-stamp', async () => {
  const { syncUser } = await import('./sync.ts');
  const h = await setup();
  try {
    const t0 = new Date(Date.now() - 10 * DAY), t1 = new Date(Date.now() - 8 * DAY);
    await syncUser(h.user, h.broker([vacc(h.ids[0]), vacc(h.ids[1])]), undefined, t0);
    await syncUser(h.user, h.broker([vacc(h.ids[0])]), undefined, t1);
    await h.trade(h.ids[1], new Date(t1.getTime() + DAY));
    await assert.rejects(syncUser(h.user, h.broker(() => { throw new Error('vendor down'); }), undefined, new Date(t1.getTime() + 2 * DAY)));
    assert.equal((await h.removedAt(h.ids[1]))?.getTime(), t1.getTime());
    await syncUser(h.user, h.broker([]), undefined, new Date(t1.getTime() + 3 * DAY));
    // Merge with main (#79, F3-3): the freeze needs a second empty list at least FREEZE_CONFIRM_HOURS later.
    await syncUser(h.user, h.broker([]), undefined, new Date(t1.getTime() + 4 * DAY));
    assert.equal((await h.removedAt(h.ids[1]))?.getTime(), t1.getTime());
    assert.equal(await h.removedAt(h.ids[0]), null);
    assert.ok((await h.sql`select disconnected_at from connections where user_id = ${h.uid}`)[0].disconnected_at);
  } finally {
    await h.cleanup();
  }
});
