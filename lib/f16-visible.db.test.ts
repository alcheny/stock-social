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

test('isVisibleUser: hidden or deleted is not visible; hidden_at is required (fix round 1)', () => {
  assert.equal(isVisibleUser({ deleted_at: null, hidden_at: null }), true);
  // @ts-expect-error a row loaded without hidden_at is refused by the type, and never reads as visible
  assert.equal(isVisibleUser({ deleted_at: null }), false);
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

// ---- F-16 predicate sweep (plan §5.2, §7; engineer A): the reads that moved onto the predicate skip a hidden trader;
// the feed's snapshot list keeps its order (E5); the hidden trader keeps their own account (E11). ----
type Fx = { sql: typeof import('./db.ts').sql; ids: number[]; attempts: number[]; tag: string; sym: string };
async function fixture(n: number): Promise<Fx & { users: { id: number; handle: string }[] }> {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `fs${Math.random().toString(36).slice(2, 9)}`;
  const sym = `Q${tag.toUpperCase().slice(2, 8)}`;
  const attempts: number[] = [], users: { id: number; handle: string }[] = [];
  for (let i = 0; i < n; i++) {
    const a = await createAttempt({ method: 'dev', attested: true });
    attempts.push(a);
    users.push(await createUserForAttempt(a, { handle: `${tag}${i}` }));
  }
  // Five recent closes each (feed eligibility), distinct sizes so the ranking is total.
  for (const [k, u] of users.entries()) {
    for (let j = 0; j < 5; j++) {
      await sql`insert into closed_trades (user_id, account_id, symbol, sell_id, return_pct, holding_days, opened_at, closed_at, verified)
        values (${u.id}, 'acc', ${sym}, ${`${tag}-${k}-${j}`}, ${0.05 + k * 0.03 + j * 0.001}, 3, now() - interval '5 days', now() - ${`${k * 7 + j} minutes`}::interval, true)`;
    }
    await sql`insert into open_positions (user_id, account_id, symbol, unrealized_pct, fetched_at) values (${u.id}, 'acc', ${sym}, 0.02, now())`;
  }
  return { sql, ids: users.map((u) => u.id), attempts, tag, sym, users };
}
async function cleanup(f: Fx) {
  await f.sql`delete from users where id in ${f.sql(f.ids)}`;
  await f.sql`delete from funnel_events where attempt_id in ${f.sql(f.attempts)}`;
  await f.sql`delete from signup_attempts where id in ${f.sql(f.attempts)}`;
}

dbTest('E5: the feed list as of a time before a hide keeps its order; as of now the hidden trader is out', async () => {
  const f = await fixture(3);
  try {
    const { feedList, feedCandidates } = await import('./feed.ts');
    const asOf = new Date(Date.now() - 1000);
    const day = asOf.toISOString().slice(0, 10);
    const order = async (at: Date) => (await feedList({ asOf: at, day, ids: f.ids })).list.map((t) => t.sell_id);
    const before = await order(asOf);
    const hid = f.users[1];
    assert.ok(before.some((s) => s.startsWith(`${f.tag}-1-`)), 'the trader is listed before the hide');
    await f.sql`update users set hidden_at = now() where id = ${hid.id}`;
    // Recomputed from the database after the hide, as of the same time: the same list, the same order (a gap, never a shift).
    assert.deepEqual(await order(asOf), before);
    const now = await order(new Date());
    assert.ok(now.length > 0);
    assert.ok(!now.some((s) => s.startsWith(`${f.tag}-1-`)), 'as of now the hidden trader is not listed');
    assert.ok(!(await feedCandidates({ ids: f.ids })).some((t) => t.user_id === hid.id));
  } finally { await cleanup(f); }
});

dbTest('the swept public reads skip a hidden trader (trade, month, record card, likes, follows, display log, compare)', async () => {
  const f = await fixture(2);
  try {
    const [live, hid] = f.users;
    const { loadTradeShare } = await import('./trade-share-load.ts');
    const { loadRecap } = await import('./recap-load.ts');
    const { recordCardLoader } = await import('../app/u/[handle]/record-card-data.ts');
    const { profileReads } = await import('../app/u/[handle]/load.ts');
    const { like } = await import('./likes.ts');
    const { followable } = await import('./follows.ts');
    const { snapshotsFor } = await import('./display-log.ts');
    const { compareCards } = await import('./record-tools.ts');
    const sell = `${f.tag}-1-0`;
    const [{ id: tradeId }] = await f.sql`select id::text as id from closed_trades where sell_id = ${sell}`;
    const ym = new Date().toISOString().slice(0, 7);
    const card = () => recordCardLoader(profileReads((fn) => fn))(hid.handle, 'unfurl');
    const reads = async () => ({
      trade: !!(await loadTradeShare(hid.handle, sell)),
      month: !!(await loadRecap(hid.handle, ym)),
      card: !!(await card()),
      followable: await followable(hid.id),
      log: (await snapshotsFor([hid.id], new Date())).has(hid.id),
      closed: (await compareCards([{ id: hid.id, handle: hid.handle, name: hid.handle }]))[0].closed,
    });
    assert.deepEqual(await reads(), { trade: true, month: true, card: true, followable: true, log: true, closed: 5 });
    await f.sql`update users set hidden_at = now() where id = ${hid.id}`;
    assert.deepEqual(await reads(), { trade: false, month: false, card: false, followable: false, log: false, closed: 0 });
    assert.equal(await like(live.id, tradeId), false, 'a hidden trader\'s trade is no like target');
    assert.equal((await snapshotsFor([live.id], new Date())).has(live.id), true, 'the visible trader is untouched');
  } finally { await cleanup(f); }
});

dbTest('E11: a hidden trader still signs in, loads settings and downloads their own data', async () => {
  const f = await fixture(2);
  try {
    const [hid, other] = f.users;
    await f.sql`update users set hidden_at = now() where id = ${hid.id}`;
    const { findLiveUserByHandle } = await import('./handles.ts');
    assert.deepEqual(await findLiveUserByHandle(hid.handle), { id: hid.id });
    const { createSession, userIdForSession } = await import('./auth/sessions.ts');
    assert.equal(await userIdForSession(await createSession(hid.id)), hid.id);
    // The settings page's own reads (app/settings/page.tsx).
    const { hasSubscribed } = await import('./billing.ts');
    const { notesLineApplies } = await import('./delete.ts');
    assert.equal(typeof await hasSubscribed(hid.id), 'boolean');
    assert.equal(typeof await notesLineApplies(hid.id), 'boolean');
    // Their own export (app/account/export/route.ts): their saved view, with the trader it holds.
    const [v] = await f.sql`insert into record_views (owner_id, name) values (${hid.id}, 'Mine') returning id`;
    await f.sql`insert into record_view_traders (view_id, trader_id, position) values (${v.id}, ${other.id}, 0)`;
    const { exportFor } = await import('./record-tools.ts');
    const out = await exportFor(hid.id);
    assert.deepEqual(out.views.map((x) => [x.name, x.traders]), [['Mine', [other.handle]]]);
    assert.ok(out.disclaimer.length > 0);
  } finally { await cleanup(f); }
});
