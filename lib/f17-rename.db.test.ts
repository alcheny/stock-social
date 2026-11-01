// F-17 rename limit, holds, deletion and D22 against the database (docs/features/F-17-handle-and-name-integrity.md; plan
// docs/features/logs/F-16-F-17/plan.md §6.1, §6.2, §8 F-17 #2–#5, #12, #17; §R2 B3; §R3). Every fixture is this file's
// own (a random letter tag), removed by id or tag at the end. The 30-day clock is injected (changeHandle's opts.now).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const DAY = 86_400_000;
const letters = (p: string) => `${p}${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6).padEnd(6, 'q')}`;
const verdict = async (v: string) => {
  const { HandleTakenError } = await import('./auth/attempts.ts');
  return (e: unknown) => e instanceof HandleTakenError && e.verdict === v;
};
async function fixture(tag: string) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const ids: number[] = [];
  const make = async (handle?: string) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), handle ? { handle } : {});
    ids.push(u.id);
    return u;
  };
  const activeHolds = async (userId: number) => (await sql`select handle from handle_reservations where user_id = ${userId} and until > now() order by handle`).map((r) => r.handle as string);
  const cleanup = async () => {
    await sql`delete from handle_reservations where handle like ${`${tag}%`}`;
    if (ids.length) {
      const rows = await sql`select handle from users where id in ${sql(ids)}`;
      if (rows.length) await sql`delete from handle_reservations where handle in ${sql(rows.map((r) => r.handle as string))}`;
      await sql`delete from users where id in ${sql(ids)}`;
    }
  };
  return { sql, make, activeHolds, cleanup, ids };
}

dbTest('F-17 AC3: 50 renames in a loop — the second within 30 days is refused, and the account never holds more than one handle', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const tag = letters('fl');
  const f = await fixture(tag);
  try {
    const u = await f.make(`${tag}_0`);
    const soon = await verdict('soon');
    let ok = 0, refused = 0;
    for (let i = 1; i <= 50; i++) {
      try { await changeHandle(u.id, `${tag}_${i}`); ok++; } catch (e) { assert.ok(soon(e), String(e)); refused++; }
      assert.ok((await f.activeHolds(u.id)).length <= 1, `after rename ${i}`);
      assert.ok(Number((await f.sql`select count(*)::int as n from handle_reservations where user_id = ${u.id} and until > now()`)[0].n) <= 1);
    }
    assert.deepEqual({ ok, refused }, { ok: 1, refused: 49 });
    assert.equal((await f.sql`select handle from users where id = ${u.id}`)[0].handle, `${tag}_1`);
    assert.deepEqual(await f.activeHolds(u.id), [`${tag}_0`]);
  } finally {
    await f.cleanup();
  }
});

dbTest('F-17 AC3: the 30-day clock — refused at day 29, allowed at day 31 (injected now); the refusal names the rule', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const tag = letters('fc');
  const f = await fixture(tag);
  try {
    const u = await f.make(`${tag}_a`);
    const t0 = Date.now();
    await changeHandle(u.id, `${tag}_b`, { now: new Date(t0) });
    const [r] = await f.sql`select handle_renamed_at from users where id = ${u.id}`;
    assert.equal((r.handle_renamed_at as Date).getTime(), t0);
    await assert.rejects(changeHandle(u.id, `${tag}_c`, { now: new Date(t0 + 29 * DAY) }), await verdict('soon'));
    assert.equal(await changeHandle(u.id, `${tag}_c`, { now: new Date(t0 + 31 * DAY) }), `${tag}_c`);
  } finally {
    await f.cleanup();
  }
});

dbTest('F-17 Q8: leaving the untouched provisional handle does not start the clock', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const tag = letters('fp');
  const f = await fixture(tag);
  try {
    const u = await f.make();
    assert.match(u.handle, /^trader_[a-z0-9]{8}$/);
    await changeHandle(u.id, `${tag}_a`);
    assert.equal((await f.sql`select handle_renamed_at from users where id = ${u.id}`)[0].handle_renamed_at, null);
    await changeHandle(u.id, `${tag}_b`); // the first counted rename
    await assert.rejects(changeHandle(u.id, `${tag}_c`), await verdict('soon'));
    assert.deepEqual(await f.activeHolds(u.id), [`${tag}_a`]);
  } finally {
    await f.sql`delete from handle_reservations where handle like 'trader_%' and user_id in ${f.sql(f.ids)}`;
    await f.cleanup();
  }
});

dbTest('F-17 AC4 (§R3): a new rename releases the older hold; the holder renames back; back then away re-holds through on conflict', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const { checkHandle } = await import('./handles.ts');
  const tag = letters('fb');
  const f = await fixture(tag);
  const a = `${tag}_a`, b = `${tag}_b`, c = `${tag}_c`;
  try {
    const u = await f.make(a);
    const other = await f.make(`${tag}_o`);
    await changeHandle(u.id, b);
    assert.deepEqual(await f.activeHolds(u.id), [a]);
    const clock = (await f.sql`select handle_renamed_at from users where id = ${u.id}`)[0].handle_renamed_at as Date;
    // Rename back at once (no 30-day wait) and the clock does not move.
    assert.equal(await changeHandle(u.id, a), a);
    assert.deepEqual(await f.activeHolds(u.id), [b]);
    const [ra] = await f.sql`select user_id, until <= now() as ended from handle_reservations where handle = ${a}`;
    assert.deepEqual({ user_id: Number(ra.user_id), ended: ra.ended }, { user_id: u.id, ended: true }, 'ended, never deleted (B3)');
    assert.equal(((await f.sql`select handle_renamed_at from users where id = ${u.id}`)[0].handle_renamed_at as Date).getTime(), clock.getTime());
    // Away again onto the held b (a rename-back too): the ended row for a is held again by the existing on conflict.
    assert.equal(await changeHandle(u.id, b), b);
    assert.deepEqual(await f.activeHolds(u.id), [a]);
    const [ra2] = await f.sql`select user_id, extract(epoch from until - now()) / 86400 as days from handle_reservations where handle = ${a}`;
    assert.equal(Number(ra2.user_id), u.id);
    assert.ok(Number(ra2.days) > 364.9 && Number(ra2.days) <= 365);
    assert.equal(Number((await f.sql`select count(*)::int as n from handle_reservations where handle = ${a}`)[0].n), 1);
    // A later rename (a month on) to a fresh handle: b is held, a's hold ends and a is free for others.
    await changeHandle(u.id, c, { now: new Date(Date.now() + 31 * DAY) });
    assert.deepEqual(await f.activeHolds(u.id), [b]);
    assert.equal(await checkHandle(a, other.id), 'ok');
    assert.equal(await checkHandle(b, other.id), 'reserved');
  } finally {
    await f.cleanup();
  }
});

dbTest('F-17 AC5 (Q2): a hold is {handle, until, user_id}, at most a year out; deleteProfile succeeds with a hold and leaves none linked', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const { deleteProfile } = await import('./delete.ts');
  const tag = letters('fd');
  const f = await fixture(tag);
  try {
    const cols = (await f.sql`select column_name from information_schema.columns where table_name = 'handle_reservations' order by column_name`).map((r) => r.column_name);
    assert.deepEqual(cols, ['handle', 'until', 'user_id']);
    const u = await f.make(`${tag}_a`);
    await changeHandle(u.id, `${tag}_b`);
    const [h] = await f.sql`select until <= now() + interval '365 days' as within, until as at from handle_reservations where handle = ${`${tag}_a`}`;
    assert.equal(h.within, true);
    await deleteProfile({ id: u.id, handle: `${tag}_b`, snaptrade_user_id: null, snaptrade_secret_enc: null }, { deleteVendorUser: async () => {}, endBilling: async () => {} });
    assert.equal((await f.sql`select 1 from users where id = ${u.id}`).length, 0, 'the hold never blocks deletion');
    assert.equal((await f.sql`select 1 from handle_reservations where user_id = ${u.id}`).length, 0, 'no hold linked to the person');
    const [after] = await f.sql`select user_id, until from handle_reservations where handle = ${`${tag}_a`}`;
    assert.equal(after.user_id, null);
    assert.equal((after.until as Date).getTime(), (h.at as Date).getTime(), 'the release date stays');
    const [cur] = await f.sql`select user_id, until > now() as active from handle_reservations where handle = ${`${tag}_b`}`;
    assert.deepEqual({ user_id: cur.user_id, active: cur.active }, { user_id: null, active: true });
  } finally {
    await f.cleanup();
  }
});

dbTest('F-17 AC12 (D22): while the launch gate is closed, a rename onto a listed handle is refused as reserved', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const tag = letters('fg');
  const f = await fixture(tag);
  try {
    const u = await f.make(`${tag}_a`);
    const listed = `${tag}_ow`;
    const closed = { NODE_ENV: 'production', LAUNCH_ALLOWLIST: listed, SNAPTRADE_CLIENT_ID: 'x' };
    await assert.rejects(changeHandle(u.id, listed, { env: closed }), await verdict('reserved'));
    await assert.rejects(changeHandle(u.id, listed.toUpperCase(), { env: closed }), await verdict('reserved'));
    assert.equal((await f.sql`select handle from users where id = ${u.id}`)[0].handle, `${tag}_a`);
    assert.equal(await changeHandle(u.id, listed, { env: { ...closed, LAUNCH_OPEN: '1' } }), listed, 'open: allowed');
  } finally {
    await f.cleanup();
  }
});

dbTest('F-17 AC2: sign-up and rename refuse a reserved handle and look-alikes of demo, connected and F-7 handles', async () => {
  const { createAttempt, createUserForAttempt, changeHandle } = await import('./auth/attempts.ts');
  const tag = letters('fv');
  const f = await fixture(tag);
  try {
    const me = await f.make(`${tag}_me`);
    const demo = await f.make(`${tag}dm`);
    await f.sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
      values (${demo.id}, 'demo', ${`${tag}-d1`}, 'demo', 'DMX', 'BUY', 1, 1, now(), '{}')`;
    // Q3: every other account's handle is compared (connected traders included).
    await f.make(`${tag}_calm`);
    const cases: [string, string][] = [['admin', 'reserved'], ['Support', 'reserved'], [`${tag}dm1`, 'lookalike'], [`${tag}_ca1m`, 'lookalike'], [`pf_${tag}`, 'reserved']];
    for (const [h, v] of cases) {
      await assert.rejects(changeHandle(me.id, h), await verdict(v), `rename ${h}`);
      await assert.rejects(createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: h }), await verdict(v), `sign-up ${h}`);
    }
    assert.equal((await f.sql`select handle_renamed_at from users where id = ${me.id}`)[0].handle_renamed_at, null, 'a refused rename starts no clock');
  } finally {
    await f.cleanup();
  }
});

dbTest('F-17 AC17: after a rename the old handle\'s trade card and month recap load nothing; the new handle loads them', async () => {
  const { changeHandle } = await import('./auth/attempts.ts');
  const { loadTradeShare } = await import('./trade-share-load.ts');
  const { loadRecap } = await import('./recap-load.ts');
  const tag = letters('fo');
  const f = await fixture(tag);
  try {
    const old = `${tag}_old`, next = `${tag}_new`;
    const u = await f.make(old);
    const closed = new Date(Date.UTC(2026, 9, 15));
    await f.sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u.id}, ${`${tag}-s`}, 'acct', 'FOX', ${new Date(closed.getTime() - 3 * DAY)}, ${closed}, -0.04, 3, true)`;
    assert.ok(await loadTradeShare(old, `${tag}-s`));
    assert.ok(await loadRecap(old, '2026-10'));
    await changeHandle(u.id, next);
    assert.equal(await loadTradeShare(old, `${tag}-s`), null);
    assert.equal(await loadRecap(old, '2026-10'), null);
    assert.ok(await loadTradeShare(next, `${tag}-s`));
    assert.ok(await loadRecap(next, '2026-10'));
  } finally {
    await f.cleanup();
  }
});
