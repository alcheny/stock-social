// F-16 Step 0 (docs/features/logs/F-16-F-17/plan.md §5.1): the visible-user predicate skips a hidden profile like a
// deletion in progress, in every form (join, ids, owner, id, as-of), and handleStatus names what /u/<handle> renders.
// Scoped to this file's own users, handles and symbol (shared database); no global counts.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { isVisibleUser } from './visible-users.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

test('isVisibleUser: hidden or deleted is not visible; hidden_at is optional for existing callers', () => {
  assert.equal(isVisibleUser({ deleted_at: null }), true);
  assert.equal(isVisibleUser({ deleted_at: null, hidden_at: null }), true);
  assert.equal(isVisibleUser({ deleted_at: null, hidden_at: new Date() }), false);
  assert.equal(isVisibleUser({ deleted_at: new Date(), hidden_at: null }), false);
});

test('handleStatus: junk and F-7 filer handles are "none" without a database read', async () => {
  const { handleStatus } = await import('./visible-users.ts');
  for (const h of ['', 'ab', 'Has_Caps', 'x'.repeat(21), 'a b', 'pf_some_filer']) assert.equal(await handleStatus(h), 'none', h);
});

dbTest('the predicate skips a hidden user in every form, and handleStatus names each state', async () => {
  const { sql } = await import('./db.ts');
  const vu = await import('./visible-users.ts');
  const tag = `fv${Math.random().toString(36).slice(2, 9)}`;
  const sym = tag.toUpperCase().slice(0, 8);
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const attempts: number[] = [];
  const mk = async (h: string) => { const a = await createAttempt({ method: 'dev', attested: true }); attempts.push(a); return createUserForAttempt(a, { handle: h }); };
  const live = await mk(`${tag}a`);
  const hid = await mk(`${tag}b`);
  const gone = await mk(`${tag}c`);
  const held = `${tag}d`; // a handle only a hold row knows (a rename's old handle)
  const hiddenAt = new Date(Date.now() - 60_000);
  await sql`update users set hidden_at = ${hiddenAt} where id = ${hid.id}`;
  await sql`update users set deleted_at = now() where id = ${gone.id}`;
  await sql`insert into handle_reservations (handle, until, user_id) values (${held}, now() + interval '1 day', ${live.id})`;
  const ids = [live.id, hid.id, gone.id];
  try {
    for (const [u, n] of [[live.id, 1], [hid.id, 2], [gone.id, 3]] as const) {
      await sql`insert into closed_trades (user_id, account_id, symbol, sell_id, return_pct, holding_days, opened_at, closed_at, verified)
        values (${u}, 'acc', ${sym}, ${`${tag}-${n}`}, 0.1, 2, now() - interval '3 days', now(), true)`;
    }
    const joined = await sql`select t.user_id from closed_trades t join users u on u.id = t.user_id and ${vu.visibleUser('u')} where t.symbol = ${sym}`;
    assert.deepEqual(joined.map((r) => r.user_id), [live.id]);
    const sub = await sql`select user_id from closed_trades where symbol = ${sym} and user_id in (${vu.visibleUserIds()})`;
    assert.deepEqual(sub.map((r) => r.user_id), [live.id]);
    const owner = await sql`select user_id from closed_trades where symbol = ${sym} and ${vu.visibleOwner('closed_trades')}`;
    assert.deepEqual(owner.map((r) => r.user_id), [live.id]);
    const ownerCol = await sql`select t.user_id from closed_trades t where t.symbol = ${sym} and ${vu.visibleOwner('t', 'user_id')}`;
    assert.deepEqual(ownerCol.map((r) => r.user_id), [live.id]);
    for (const [id, want] of [[live.id, 1], [hid.id, 0], [gone.id, 0]] as const) {
      const [r] = await sql`select count(*)::int as n from closed_trades where user_id = ${id} and symbol = ${sym} and ${vu.visibleId(id)}`;
      assert.equal(r.n, want, `visibleId(${id})`);
    }
    // As of a time before the hide, the hidden trader still counts (a snapshot's pages never shift); as of now, not.
    const asOf = async (d: Date | null) => (await sql`select u.id from users u where u.id in ${sql(ids)} and ${vu.visibleUserAsOf('u', d)} order by u.id`).map((r) => r.id);
    assert.deepEqual(await asOf(new Date(hiddenAt.getTime() - 1000)), [live.id, hid.id, gone.id]);
    assert.deepEqual(await asOf(new Date()), [live.id]);
    assert.deepEqual(await asOf(null), [live.id]);
    const rows = await sql`select deleted_at, hidden_at from users where id in ${sql(ids)} order by id`;
    assert.deepEqual(rows.map((u) => isVisibleUser(u as { deleted_at: Date | null; hidden_at: Date | null })), [true, false, false]);

    assert.equal(await vu.handleStatus(live.handle), 'visible');
    assert.equal(await vu.handleStatus(hid.handle), 'hidden');
    assert.equal(await vu.handleStatus(gone.handle), 'retired'); // deletion pending
    assert.equal(await vu.handleStatus(held), 'retired'); // held by a rename
    assert.equal(await vu.handleStatus(`${tag}z`), 'none'); // never used
    await sql`update handle_reservations set until = now() where handle = ${held}`; // an ended hold is no longer retired
    assert.equal(await vu.handleStatus(held), 'none');
  } finally {
    await sql`delete from handle_reservations where handle = ${held}`;
    await sql`delete from users where id in ${sql(ids)}`;
    await sql`delete from funnel_events where attempt_id in ${sql(attempts)}`;
    await sql`delete from signup_attempts where id in ${sql(attempts)}`;
  }
});
