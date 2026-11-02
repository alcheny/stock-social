// OD 2.17 (owner decision 2026-11-02, accepted): a handle whose account had a connected record (an `activities` row
// with source 'snaptrade') is retired (until = infinity) on rename and on deletion, never reissued and never purged; a
// demo or unconnected account keeps the 365-day hold; the one-hold cap never ends a retired hold; the holder may still
// take a retired handle back. Every fixture is this file's own (a random letter tag), removed by id or tag at the end.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const DAY = 86_400_000;
const letters = (p: string) => `${p}${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6).padEnd(6, 'q')}`;
const noVendor = { deleteVendorUser: async () => {}, endBilling: async () => {} };
const verdict = async (v: string) => {
  const { HandleTakenError } = await import('./auth/attempts.ts');
  return (e: unknown) => e instanceof HandleTakenError && e.verdict === v;
};

async function fixture(tag: string) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { insertActivities } = await import('./sync.ts');
  const ids: number[] = [];
  const make = async (handle: string, source: 'snaptrade' | 'demo' | null) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle });
    ids.push(u.id);
    if (source) await insertActivities(u.id, source, [{ externalId: `${tag}-${u.id}-b`, accountId: `${tag}-acct`, symbol: 'RTQ', side: 'BUY' as const, units: 1, price: 10, fee: 0, executedAt: new Date(Date.now() - 5 * DAY), verified: source === 'snaptrade', raw: {} }]);
    return u;
  };
  const hold = async (handle: string) => {
    const [r] = await sql`select user_id, until = 'infinity' as retired, until > now() as active,
      case when until = 'infinity' then null else extract(epoch from until - now()) / 86400 end as days from handle_reservations where handle = ${handle}`;
    return r ? { user_id: r.user_id === null ? null : Number(r.user_id), retired: r.retired as boolean, active: r.active as boolean, days: r.retired ? null : Math.round(Number(r.days)) } : null;
  };
  const cleanup = async () => {
    await sql`delete from handle_reservations where handle like ${`${tag}%`}`;
    if (ids.length) await sql`delete from users where id in ${sql(ids)}`;
  };
  return { sql, make, hold, cleanup };
}

dbTest('OD 2.17: renaming a connected trader retires the old handle (until = infinity), refused for every other account', async () => {
  const { changeHandle, createAttempt, createUserForAttempt, HandleTakenError } = await import('./auth/attempts.ts');
  const { checkHandle } = await import('./handles.ts');
  const tag = letters('rc');
  const f = await fixture(tag);
  try {
    const u = await f.make(`${tag}_a`, 'snaptrade');
    const other = await f.make(`${tag}_x`, null);
    assert.equal(await changeHandle(u.id, `${tag}_b`), `${tag}_b`);
    assert.deepEqual(await f.hold(`${tag}_a`), { user_id: u.id, retired: true, active: true, days: null });
    assert.equal(await checkHandle(`${tag}_a`, other.id), 'reserved');
    assert.equal(await checkHandle(`${tag}_a`), 'reserved');
    // A year and a day later (the rename clock is injected; the hold uses the database clock and has no end).
    await assert.rejects(changeHandle(other.id, `${tag}_a`, { now: new Date(Date.now() + 400 * DAY) }), await verdict('reserved'));
    await assert.rejects(createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_a` }), (e: unknown) => e instanceof HandleTakenError && e.verdict === 'reserved');
    // The purge removes only ended holds (until <= now): a retired one never ends, even far in the future.
    const [p] = await f.sql`select count(*)::int as n from handle_reservations where handle = ${`${tag}_a`} and until <= ${new Date(Date.now() + 100 * 365 * DAY)}`;
    assert.equal(p.n, 0);
  } finally { await f.cleanup(); }
});

dbTest('OD 2.17: the purge never removes a retired hold, and still removes an ended one', async () => {
  const { purgePrivacy } = await import('./privacy-purge.ts');
  const tag = letters('rp');
  const f = await fixture(tag);
  try {
    // A purge clock in the past (1966), so it can reach only this file's ended row (1965) on the shared database.
    await f.sql`insert into handle_reservations (handle, until) values (${`${tag}_r`}, 'infinity'), (${`${tag}_e`}, '1965-01-01T00:00:00Z')`;
    for (let i = 0; i < 20; i++) {
      const r = await purgePrivacy({ now: new Date('1966-01-01T00:00:00Z'), only: ['reservations'] });
      if (r.ran) break; // another test's purge may hold the lock for a moment
      await new Promise((ok) => setTimeout(ok, 250));
    }
    assert.deepEqual(await f.hold(`${tag}_r`), { user_id: null, retired: true, active: true, days: null });
    assert.equal(await f.hold(`${tag}_e`), null);
  } finally { await f.cleanup(); }
});

dbTest('OD 2.17: a demo or unconnected trader\'s old handle keeps the 365-day hold', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const tag = letters('rd');
  const f = await fixture(tag);
  try {
    const demo = await f.make(`${tag}_d`, 'demo');
    const none = await f.make(`${tag}_n`, null);
    await changeHandle(demo.id, `${tag}_e`);
    await changeHandle(none.id, `${tag}_m`);
    assert.deepEqual(await f.hold(`${tag}_d`), { user_id: demo.id, retired: false, active: true, days: 365 });
    assert.deepEqual(await f.hold(`${tag}_n`), { user_id: none.id, retired: false, active: true, days: 365 });
  } finally { await f.cleanup(); }
});

dbTest('OD 2.17: deleting a connected trader retires its handle (and keeps its earlier retired one); an unconnected one keeps the year', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const { deleteProfile } = await import('./delete.ts');
  const tag = letters('rx');
  const f = await fixture(tag);
  try {
    const u = await f.make(`${tag}_a`, 'snaptrade');
    await changeHandle(u.id, `${tag}_b`);
    await deleteProfile({ id: u.id, handle: `${tag}_b`, snaptrade_user_id: null, snaptrade_secret_enc: null }, noVendor);
    assert.equal((await f.sql`select 1 from users where id = ${u.id}`).length, 0);
    assert.deepEqual(await f.hold(`${tag}_b`), { user_id: null, retired: true, active: true, days: null });
    assert.deepEqual(await f.hold(`${tag}_a`), { user_id: null, retired: true, active: true, days: null });
    const n = await f.make(`${tag}_n`, null);
    await deleteProfile({ id: n.id, handle: `${tag}_n`, snaptrade_user_id: null, snaptrade_secret_enc: null }, noVendor);
    assert.deepEqual(await f.hold(`${tag}_n`), { user_id: null, retired: false, active: true, days: 365 });
  } finally { await f.cleanup(); }
});

dbTest('OD 2.17: the one-hold cap never ends a retired hold; the holder may take a retired handle back, and it stays retired', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const { checkHandle } = await import('./handles.ts');
  const tag = letters('rk');
  const f = await fixture(tag);
  try {
    const u = await f.make(`${tag}_a`, 'snaptrade');
    const other = await f.make(`${tag}_x`, null);
    const t0 = Date.now();
    await changeHandle(u.id, `${tag}_b`, { now: new Date(t0) });
    await changeHandle(u.id, `${tag}_c`, { now: new Date(t0 + 31 * DAY) });
    await changeHandle(u.id, `${tag}_d`, { now: new Date(t0 + 62 * DAY) });
    for (const h of ['a', 'b', 'c']) assert.deepEqual(await f.hold(`${tag}_${h}`), { user_id: u.id, retired: true, active: true, days: null }, h);
    // Take one back: allowed at any time (the rename clock doesn't move), and the row stays retired.
    assert.equal(await changeHandle(u.id, `${tag}_a`, { now: new Date(t0 + 63 * DAY) }), `${tag}_a`);
    assert.deepEqual(await f.hold(`${tag}_a`), { user_id: u.id, retired: true, active: true, days: null });
    assert.deepEqual(await f.hold(`${tag}_d`), { user_id: u.id, retired: true, active: true, days: null });
    assert.equal((await f.sql`select handle_renamed_at from users where id = ${u.id}`)[0].handle_renamed_at.getTime(), t0 + 62 * DAY);
    for (const h of ['b', 'c', 'd']) assert.equal(await checkHandle(`${tag}_${h}`, other.id), 'reserved', h);
    assert.equal(await checkHandle(`${tag}_b`, u.id), 'ok', 'its own retired handle is free to its holder');
  } finally { await f.cleanup(); }
});

dbTest('OD 2.17: a trader who connects after holding a handle for a year retires the next one; the held row is not shortened', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const { insertActivities } = await import('./sync.ts');
  const tag = letters('rl');
  const f = await fixture(tag);
  try {
    const u = await f.make(`${tag}_a`, null);
    const t0 = Date.now();
    await changeHandle(u.id, `${tag}_b`, { now: new Date(t0) });
    assert.equal((await f.hold(`${tag}_a`))?.days, 365);
    await insertActivities(u.id, 'snaptrade', [{ externalId: `${tag}-late`, accountId: `${tag}-acct`, symbol: 'RTQ', side: 'BUY' as const, units: 1, price: 10, fee: 0, executedAt: new Date(t0 - DAY), verified: true, raw: {} }]);
    await changeHandle(u.id, `${tag}_c`, { now: new Date(t0 + 31 * DAY) });
    assert.deepEqual(await f.hold(`${tag}_b`), { user_id: u.id, retired: true, active: true, days: null });
    // Only non-retired holds count toward the cap, so the year's hold on _a is its one hold and runs on unchanged.
    assert.deepEqual(await f.hold(`${tag}_a`), { user_id: u.id, retired: false, active: true, days: 365 });
  } finally { await f.cleanup(); }
});
