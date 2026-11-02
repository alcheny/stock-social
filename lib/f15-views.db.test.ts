// F-15 · the view rollup against the database: deleted with the profile, never follows a handle, no identifier column,
// only registry values stored, the four users share columns kept, and 50 concurrent beacons add up on one row.
// Shared database: every test creates its own users and reads only rows naming them. Cycle 4 F4-20 (C4-23): every row
// these tests create (users, their sign-up attempts and handle reservations, the 2001-dated drop rows and the feed-key
// rollup row) is tracked and deleted before the pool ends; nothing this file did not create is deleted.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
// What this file created, deleted in `after` before sql.end.
const created = { users: [] as number[], attempts: [] as number[], drops: new Set<string>(), feedKeys: new Set<string>() };
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  try {
    // Reservations first: deleting a user only nulls its reservations' user_id.
    await sql`delete from handle_reservations where user_id = any(${created.users}::bigint[])`;
    await sql`delete from users where id = any(${created.users}::int[])`; // rollup rows and closed trades cascade
    await sql`delete from signup_attempts where id = any(${created.attempts}::bigint[])`;
    for (const k of created.drops) { const [ms, surface, reason] = k.split('|'); await sql`delete from view_drops where day = ${new Date(Number(ms))}::date and surface = ${surface} and reason = ${reason}`; }
    for (const k of created.feedKeys) { const [ms, surface, via] = k.split('|'); await sql`delete from view_rollup where day = ${new Date(Number(ms))}::date and surface = ${surface} and via = ${via} and user_id is null`; }
    const left = await sql`select (select count(*)::int from users where id = any(${created.users}::int[])) u,
      (select count(*)::int from signup_attempts where id = any(${created.attempts}::bigint[])) a,
      (select count(*)::int from view_rollup where user_id = any(${created.users}::int[])) r`;
    assert.deepEqual({ ...left[0] }, { u: 0, a: 0, r: 0 }, 'every row this file created is gone');
  } finally {
    await sql.end({ timeout: 1 });
  }
});

const tag = () => `f15${Math.random().toString(36).slice(2, 10)}`;
async function user(handle = tag()): Promise<{ id: number; handle: string }> {
  const { sql } = await import('./db.ts');
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  created.attempts.push(Number(a.id));
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${handle}, ${handle}, now(), ${a.id}) returning id, handle`;
  created.users.push(u.id);
  return u as { id: number; handle: string };
}
// A day far in the past that no other test writes, so counts read here are this test's own.
const DAY = (n: number) => new Date(Date.UTC(2001, 0, 1 + n));

dbTest('F-15: deleteProfile removes every rollup row naming the trader; no row holds the handle', async () => {
  const { sql } = await import('./db.ts');
  const { recordView } = await import('./views.ts');
  const { deleteProfile } = await import('./delete.ts');
  const u = await user();
  for (const surface of ['profile', 'trade', 'month'] as const) await recordView({ surface, userId: u.id, ref: 'external', via: 'card', signedIn: false, selfView: false, day: DAY(1) });
  assert.equal((await sql`select count(*)::int n from view_rollup where user_id = ${u.id}`)[0].n, 3);
  await deleteProfile({ id: u.id, handle: u.handle, snaptrade_user_id: null, snaptrade_secret_enc: null }, { deleteVendorUser: async () => {}, endBilling: async () => {} });
  assert.equal((await sql`select count(*)::int n from view_rollup where user_id = ${u.id}`)[0].n, 0);
  assert.equal((await sql`select count(*)::int n from users where id = ${u.id}`)[0].n, 0);
  const hit = await sql`select 1 from view_rollup r where row(r.*)::text like ${'%' + u.handle + '%'} limit 1`;
  assert.equal(hit.length, 0);
});

dbTest('F-15: a rename then a new user with the old handle: none of the old counts appear under the new owner of the handle', async () => {
  // Committee reading (2026-11-01, raised for the owner): counts are keyed by user id, never by handle text, so nothing
  // is found under the text of either handle; the new user A has none; the old rows stay with the renamed account's id.
  const { sql } = await import('./db.ts');
  const { recordView } = await import('./views.ts');
  const { changeHandle } = await import('./auth/attempts.ts');
  const a = await user();
  await recordView({ surface: 'profile', userId: a.id, ref: 'external', via: 'none', signedIn: false, selfView: false, day: DAY(2) });
  const b = tag();
  await changeHandle(a.id, b);
  const newA = await user(a.handle);
  assert.notEqual(newA.id, a.id);
  assert.equal((await sql`select count(*)::int n from view_rollup where user_id = ${newA.id}`)[0].n, 0);
  for (const h of [a.handle, b]) assert.equal((await sql`select 1 from view_rollup r where row(r.*)::text like ${'%' + h + '%'} limit 1`).length, 0, h);
  const cols = await sql`select column_name from information_schema.columns where table_name in ('view_rollup', 'view_drops') and data_type = 'text'`;
  assert.deepEqual(cols.map((c) => c.column_name).sort(), ['reason', 'ref_class', 'surface', 'surface', 'via']);
  assert.equal((await sql`select sum(n)::int n from view_rollup where user_id = ${a.id}`)[0].n, 1);
});

dbTest('F-15: the rollup and drop tables have exactly the allowed columns; none holds an IP, agent, viewer, session, cookie or fingerprint', async () => {
  const { sql } = await import('./db.ts');
  const rows = await sql<{ t: string; c: string }[]>`select table_name t, column_name c from information_schema.columns
    where table_schema = current_schema() and table_name in ('view_rollup', 'view_drops') order by table_name, ordinal_position`;
  const by = (t: string) => rows.filter((r) => r.t === t).map((r) => r.c);
  assert.deepEqual(by('view_rollup'), ['day', 'surface', 'user_id', 'ref_class', 'via', 'signed_in', 'self_view', 'n']);
  assert.deepEqual(by('view_drops'), ['day', 'surface', 'reason', 'n']);
  for (const r of rows) assert.doesNotMatch(r.c, /ip|addr|agent|^ua|viewer|session|cookie|finger|referr|url|path|query|handle|token|hash|device|time|_at$/, `${r.t}.${r.c}`);
});

dbTest('F-15: only registry values are stored: 200 random beacons through the route leave surface, ref and via in the closed sets', async () => {
  const { sql } = await import('./db.ts');
  const { recordView, recordDrop, viewedUserId, SURFACES, REF_CLASSES, DROP_REASONS } = await import('./views.ts');
  const { handleBeacon } = await import('./views-route.ts');
  const { VIA_CODES } = await import('./referral.ts');
  const u = await user();
  const day = DAY(3);
  const junk = ['card', 'inv_t', 'inv_zed', 'x', '', 'NAV', '<script>', 'u' + u.id, u.handle, 'story', 'month'];
  const paths = [`/u/${u.handle}`, `/u/${u.handle}/month/2026-10`, `/u/${u.handle}/trade/nope`, '/u/' + u.handle + 'x', '/', '/how', '/me'];
  let seed = 7;
  const rnd = (n: number) => ((seed = (seed * 48271) % 2147483647) % n);
  const viewer = async () => null;
  for (let i = 0; i < 200; i++) {
    const body = JSON.stringify({ path: paths[rnd(paths.length)], ref: ['external', 'internal', 'none', 'bogus'][rnd(4)], via: junk[rnd(junk.length)], auto: rnd(5) === 0 });
    const req = new Request('http://app.test/api/views', { method: 'POST', body, headers: { origin: 'http://app.test', host: 'app.test', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } });
    // Only this test's trader and a past day are written, so the shared table is read for this test's rows only.
    await handleBeacon(req, { viewer, viewedUserId, limited: () => 'ok',
      recordView: (k) => (k.userId === u.id ? recordView({ ...k, day }) : Promise.resolve()),
      recordDrop: (s, r) => {
        if (s !== 'profile' && s !== 'month') return Promise.resolve();
        created.drops.add(`${day.getTime()}|${s}|${r}`); // the same Date the write casts, so the same day
        return recordDrop(s, r, day);
      } });
  }
  const stored = await sql`select distinct surface, ref_class, via from view_rollup where user_id = ${u.id}`;
  assert.ok(stored.length > 0);
  for (const r of stored) {
    assert.ok((SURFACES as readonly string[]).includes(r.surface), r.surface);
    assert.ok((REF_CLASSES as readonly string[]).includes(r.ref_class), r.ref_class);
    assert.ok(r.via === 'none' || VIA_CODES.includes(r.via), r.via);
  }
  const drops = await sql`select distinct surface, reason from view_drops where day = ${day}::date`;
  for (const r of drops) assert.ok((DROP_REASONS as readonly string[]).includes(r.reason), r.reason);
  // The trade page with no such closed trade counted nothing.
  assert.equal((await sql`select count(*)::int n from view_rollup where user_id = ${u.id} and surface = 'trade'`)[0].n, 0);
});

dbTest('F-15: a hidden or removed public filer, and a filer with no closed trade, count nothing (their pages 404)', async () => {
  const { sql } = await import('./db.ts');
  const { viewedUserId } = await import('./views.ts');
  const filer = async (o: { hidden?: boolean; removed?: boolean; trade?: boolean }) => {
    const [f] = await sql`insert into public_filers (source, filer_key, demo, hidden_at, removed_at)
      values ('insider_reports', ${tag()}, true, ${o.hidden ? new Date() : null}, ${o.removed ? new Date() : null}) returning id`;
    const u = await user();
    await sql`update users set public_filer_id = ${f.id} where id = ${u.id}`;
    if (o.trade) await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u.id}, ${'f15-' + tag()}, 'a', 'F15X', now() - interval '3 days', now() - interval '1 day', 0.02, 2, true)`;
    return { ...u, filerId: f.id as number };
  };
  const shown = await filer({ trade: true }), hidden = await filer({ hidden: true, trade: true }), removed = await filer({ removed: true, trade: true }), empty = await filer({});
  const plain = await user(); // a broker or demo user with no trade still has a page
  const prof = (handle: string) => viewedUserId({ surface: 'profile', handle, detail: null });
  assert.equal(await prof(shown.handle), shown.id);
  assert.equal(await prof(hidden.handle), null);
  assert.equal(await prof(removed.handle), null);
  assert.equal(await prof(empty.handle), null);
  assert.equal(await prof(plain.handle), plain.id);
  const [{ sell_id: sellId, trade_key: key }] = await sql`select sell_id, trade_key from closed_trades where user_id = ${hidden.id}`;
  assert.equal(await viewedUserId({ surface: 'trade', handle: hidden.handle, detail: sellId }), null);
  assert.equal(await viewedUserId({ surface: 'trade', handle: hidden.handle, detail: key }), null); // F-25: nor by its key
  const ym = new Date(Date.now() - 86_400_000).toISOString().slice(0, 7);
  assert.equal(await viewedUserId({ surface: 'month', handle: hidden.handle, detail: ym }), null);
  for (const f of [shown, hidden, removed, empty]) { await sql`delete from users where id = ${f.id}`; await sql`delete from public_filers where id = ${f.filerId}`; }
});

dbTest('F-15: 50 concurrent beacons for one key make one row with count 50', async () => {
  const { sql } = await import('./db.ts');
  const { recordView } = await import('./views.ts');
  const u = await user();
  const key = { surface: 'profile' as const, userId: u.id, ref: 'external' as const, via: 'card', signedIn: false, selfView: false, day: DAY(4) };
  await Promise.all(Array.from({ length: 50 }, () => recordView(key)));
  const rows = await sql`select n from view_rollup where user_id = ${u.id}`;
  assert.deepEqual(rows.map((r) => r.n), [50]);
});

dbTest('F-15: a null trader key (feed) is one row too (nulls not distinct)', async () => {
  const { sql } = await import('./db.ts');
  const { recordView } = await import('./views.ts');
  // A unique via-less key on a day only this test writes.
  const day = DAY(5);
  created.feedKeys.add(`${day.getTime()}|how|inv_h`);
  await Promise.all(Array.from({ length: 10 }, () => recordView({ surface: 'how', userId: null, ref: 'none', via: 'inv_h', signedIn: true, selfView: false, day })));
  const rows = await sql`select n from view_rollup where day = ${day}::date and surface = 'how' and via = 'inv_h' and signed_in`;
  assert.equal(rows.length, 1);
  assert.ok(rows[0].n >= 10);
});

dbTest('F-15: the four users share columns stay in the schema (additive only)', async () => {
  const { sql } = await import('./db.ts');
  const cols = (await sql`select column_name from information_schema.columns where table_schema = current_schema() and table_name = 'users'`).map((r) => r.column_name);
  for (const c of ['share_prompt_seen_at', 'share_prompt_action', 'trade_shared_at', 'share_image_saved_at']) assert.ok(cols.includes(c), c);
  const block = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8').split('-- ---- F-15')[1].replace(/--[^\n]*/g, '');
  assert.doesNotMatch(block, /\b(drop|truncate|delete\s+from|alter\s+table)\b/i);
});
