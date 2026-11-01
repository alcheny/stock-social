// F-7 importer, operator actions and account guards (ACs 3-7, 23, 24, 32, 33; Round 4/5: placeholder attempt survives
// the purge, last_success_at). The fake runs in-test on its own port; every filer, filing and state key is this file's own
// (random suffix), so tests running at the same time on the shared database are untouched. Fictional names only.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { setScenario, startPublicFilingsFake, type FakeFiling, type FakeOwner } from '../e2e/fakes/public-filings.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
const env = { NODE_ENV: 'test', PUBLIC_FILINGS_CONTACT: 'ops@example.test' };
const tag = Math.random().toString(36).slice(2, 8);
const keys: string[] = [];
const states: string[] = [];
let fake: { server: Server; base: string };

before(async () => {
  fake = await startPublicFilingsFake(0);
  if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests();
});
after(async () => {
  fake?.server.closeAllConnections();
  fake?.server.close();
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  const ids = (await sql`select id from public_filers where filer_key in ${sql(keys.length ? keys : [''])}`).map((r) => r.id as number);
  if (ids.length) {
    await sql`delete from public_filer_log where filer_id in ${sql(ids)}`;
    await sql`delete from users where public_filer_id in ${sql(ids)}`;
    await sql`delete from public_filers where id in ${sql(ids)}`;
  }
  if (states.length) await sql`delete from public_import_state where source in ${sql(states)}`;
  await sql`delete from handle_reservations where handle like ${`pf_${tag}%`}`;
  await sql.end({ timeout: 1 });
});

let seq = 0;
const owner = (name: string, role: Partial<FakeOwner> = { director: true }): FakeOwner => { const key = `${tag}${++seq}`; keys.push(key); return { key, name, ...role }; };
const fid = () => `${tag}-f${++seq}`;
async function stateAt(day: string) {
  const { sql } = await import('./db.ts');
  const key = `test-${tag}-${++seq}`;
  states.push(key);
  await sql`insert into public_import_state (source, cursor) values (${key}, ${sql.json({ day, offset: 0 })})`;
  return key;
}
async function run(state: string, o: Record<string, unknown> = {}) {
  const { importPublicFilings } = await import('./public-import.ts');
  return importPublicFilings({ boxMs: 15_000, env, baseUrl: fake.base, state, today: '2026-03-05', ...o });
}
async function userOf(key: string) {
  const { sql } = await import('./db.ts');
  const [u] = await sql`select u.* from users u join public_filers pf on pf.id = u.public_filer_id where pf.filer_key = ${key}`;
  return (u ?? null) as { id: number; handle: string; display_name: string; signup_attempt_id: string } | null;
}
const trip = (o: FakeOwner, sym: string, buy: number, sell: number, first = '2026-03-02'): FakeFiling[] => [
  { id: fid(), day: first, owner: o, symbol: sym, rows: [{ date: '2026-02-27', code: 'P', units: 100, price: buy, ad: 'A', after: 100 }] },
  { id: fid(), day: '2026-03-03', owner: o, symbol: sym, rows: [{ date: '2026-03-02', code: 'S', units: 100, price: sell, ad: 'D', after: 0 }] },
];

dbTest('ACs 3-6, 32 and last_success_at: identity by filer key, names as filed, roles, data minimum, amendments, idempotent re-import, counts-only logs', async () => {
  const { sql } = await import('./db.ts');
  const a = owner(`${tag} Fictional Twin`), b = owner(`${tag} Fictional Twin`, { officer: true });
  const big = owner(`${tag} Holder Only`, { tenPercent: true }), other = owner(`${tag} Other Only`, { other: true });
  const ta = trip(a, 'QZXA', 10, 12), tb = trip(b, 'QZXB', 20, 15);
  const filings = [...ta, ...tb, ...trip(big, 'QZXC', 1, 2), ...trip(other, 'QZXD', 1, 2),
    { id: fid(), day: '2026-03-03', owner: a, symbol: 'QZXA', rows: [{ date: '2026-03-02', code: 'P', units: 5, price: 3, ad: 'A' as const, after: 5, indirect: true }], derivative: [{ date: '2026-03-02', code: 'M', units: 9, price: 0, ad: 'A' as const, after: 9 }] }];
  await setScenario(fake.base, { filings });
  const state = await stateAt('2026-03-02');
  const logs: string[] = [];
  const log = console.log;
  console.log = (...x: unknown[]) => { logs.push(x.join(' ')); };
  let r;
  try { r = await run(state); } finally { console.log = log; }
  assert.equal(r.ran, true); assert.equal(r.stopped, false);
  assert.equal(r.filings, filings.length);
  assert.equal(r.roleSkipped, 4);
  const ua = await userOf(a.key), ub = await userOf(b.key);
  assert.ok(ua && ub); assert.notEqual(ua.id, ub.id);
  assert.equal(ua.display_name, a.name); assert.equal(ub.display_name, b.name);
  assert.equal(await userOf(big.key), null); assert.equal(await userOf(other.key), null);
  const [pfa] = await sql`select demo, excluded from public_filers where filer_key = ${a.key}`;
  assert.equal(pfa.demo, true); // a loopback source is never a real filing system
  assert.deepEqual(pfa.excluded, { indirect: 1, derivative: 1 });
  const pct = async (u: { id: number }) => (await sql`select return_pct, verified from closed_trades where user_id = ${u.id}`).map((t) => [Math.round(t.return_pct * 100), t.verified]);
  assert.deepEqual(await pct(ua), [[20, false]]);
  assert.deepEqual(await pct(ub), [[-25, false]]);
  // C4 / AC 32: a stored raw row holds only matcher fields; no address, signature, remarks, footnotes or holding label.
  const raw = JSON.stringify(await sql`select t.* from public_transactions t join public_filers pf on pf.id = t.filer_id where pf.filer_key = ${a.key}`);
  for (const never of ['Imaginary Lane', 'Nowhereville', 'Signer', 'ootnote', 'emarks', 'Trust', 'Officer', 'Twin']) assert.ok(!raw.includes(never), never);
  // C8: logs hold counts only - no filer or issuer name, no symbol.
  const out = logs.join('\n');
  for (const never of [tag, 'Fictional', 'QZX', 'Widgets']) assert.ok(!out.includes(never), never);
  assert.ok(logs.length >= 1);
  const [st] = await sql`select cursor, last_success_at from public_import_state where source = ${state}`;
  assert.ok(st.last_success_at instanceof Date);
  assert.equal(st.cursor.day, '2026-03-05');

  // AC 3: an amendment of a's purchase replaces its rows; the rebuilt percent changes.
  filings.push({ ...ta[0], id: fid(), day: '2026-03-05', amends: ta[0].id, rows: [{ ...ta[0].rows[0], price: 8 }] });
  await setScenario(fake.base, { filings });
  await run(state);
  assert.deepEqual(await pct(ua), [[50, false]]);
  // AC 5: re-reading every day is idempotent.
  const count = async () => (await sql`select count(*)::int as n from public_transactions t join public_filers pf on pf.id = t.filer_id where pf.filer_key in ${sql([a.key, b.key])}`)[0].n;
  const before = await count();
  await sql`update public_import_state set cursor = ${sql.json({ day: '2026-03-02', offset: 0 })} where source = ${state}`;
  await run(state);
  assert.equal(await count(), before);
  assert.deepEqual(await pct(ua), [[50, false]]);
  assert.equal((await userOf(a.key))?.id, ua.id);
});

dbTest('a refused source stops the tick: no last_success_at, the cursor stays; at most max filings a tick and the cursor resumes', async () => {
  const { sql } = await import('./db.ts');
  const { MAX_FILINGS_PER_TICK } = await import('./public-import.ts');
  assert.equal(MAX_FILINGS_PER_TICK, 50);
  const o = owner(`${tag} Paced`);
  await setScenario(fake.base, { filings: trip(o, 'QZXE', 10, 11), fail: { status: 429, times: 99 } });
  const state = await stateAt('2026-03-02');
  const r = await run(state, { boxMs: 3000 });
  assert.equal(r.stopped, true);
  const [st] = await sql`select cursor, last_success_at from public_import_state where source = ${state}`;
  assert.equal(st.last_success_at, null);
  assert.deepEqual(st.cursor, { day: '2026-03-02', offset: 0 });
  // Unreconciled holdings are excluded by reason; one filing per tick resumes where it stopped.
  const u = owner(`${tag} Unreconciled`);
  await setScenario(fake.base, { filings: [
    { id: fid(), day: '2026-03-02', owner: u, symbol: 'QZXF', rows: [{ date: '2026-02-27', code: 'P', units: 100, price: 10, ad: 'A', after: 100 }] },
    { id: fid(), day: '2026-03-02', owner: u, symbol: 'QZXF', rows: [{ date: '2026-02-28', code: 'S', units: 50, price: 12, ad: 'D', after: 50 }] },
    { id: fid(), day: '2026-03-03', owner: u, symbol: 'QZXF', rows: [{ date: '2026-03-02', code: 'S', units: 10, price: 12, ad: 'D', after: 30 }] }] });
  const s2 = await stateAt('2026-03-02');
  assert.equal((await run(s2, { max: 1 })).filings, 1);
  assert.deepEqual((await sql`select cursor from public_import_state where source = ${s2}`)[0].cursor, { day: '2026-03-02', offset: 1 });
  await run(s2);
  const [pf] = await sql`select excluded from public_filers where filer_key = ${u.key}`;
  assert.deepEqual(pf.excluded, { unreconciled: 1 });
  assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${(await userOf(u.key))!.id}`)[0].n, 1);
});

dbTest('AC 7 and C2: a filer is never an account - no rebuild, signup, rename, referral, session or funnel row', async () => {
  const { sql } = await import('./db.ts');
  const o = owner(`${tag} Guarded`);
  await setScenario(fake.base, { filings: trip(o, 'QZXG', 10, 13) });
  await run(await stateAt('2026-03-02'));
  const u = await userOf(o.key);
  assert.ok(u);
  const { rebuildTrades } = await import('./sync.ts');
  await assert.rejects(rebuildTrades(u.id), /public filer/);
  assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 1);
  const { createAttempt, createUserForAttempt, changeHandle, HandleTakenError } = await import('./auth/attempts.ts');
  const at = await createAttempt({ method: 'dev', attested: true });
  await assert.rejects(createUserForAttempt(at, { handle: `pf_${tag}x` }), HandleTakenError);
  await sql`delete from funnel_events where attempt_id = ${at}`;
  await sql`delete from signup_attempts where id = ${at}`;
  await assert.rejects(changeHandle(u.id, `pf_${tag}y`), HandleTakenError);
  const { resolveReferrer } = await import('./referral.ts');
  assert.equal(resolveReferrer({ refHandle: u.handle, referrer: { id: u.id, handle: u.handle, isDemo: false } }), null);
  const { createSession } = await import('./auth/sessions.ts');
  await assert.rejects(createSession(u.id), /public filer/);
  assert.equal((await sql`select count(*)::int as n from sessions where user_id = ${u.id}`)[0].n, 0);
  assert.equal((await sql`select count(*)::int as n from funnel_events where attempt_id = ${u.signup_attempt_id}`)[0].n, 0);
  assert.equal((await sql`select count(*)::int as n from identities where user_id = ${u.id}`)[0].n, 0);
});

dbTest('the placeholder attempt survives the unfinished-attempt purge while a filer points at it, and is re-created after a purge with none', async () => {
  const { sql } = await import('./db.ts');
  const { purgePrivacy } = await import('./privacy-purge.ts');
  // The placeholder is dated at the epoch: at this `now` only placeholders nobody points at are old enough to purge.
  const purge = () => purgePrivacy({ only: ['attempts'], now: new Date('1971-01-01T00:00:00Z') });
  await purge();
  const o = owner(`${tag} After Purge`);
  await setScenario(fake.base, { filings: trip(o, 'QZXH', 10, 11) });
  await run(await stateAt('2026-03-02'));
  const u = await userOf(o.key);
  assert.ok(u);
  await purge();
  const [a] = await sql`select method, completed_at, user_id, adult_attested_at from signup_attempts where id = ${u.signup_attempt_id}`;
  assert.ok(a, 'still there');
  assert.equal(a.method, 'dev'); assert.equal(a.completed_at, null); assert.equal(a.user_id, null); assert.equal(a.adult_attested_at.getTime(), 0);
});

dbTest('AC 23: hide and unhide are logged and reversible; remove deletes profile, raw and derived rows, reserves the handle and blocks re-import', async () => {
  const { sql } = await import('./db.ts');
  const { filerAction } = await import('./public-import.ts');
  const o = owner(`${tag} Removable`);
  await setScenario(fake.base, { filings: [...trip(o, 'QZXI', 10, 12), { id: fid(), day: '2026-03-04', owner: o, symbol: 'QZXJ', rows: [{ date: '2026-03-03', code: 'P', units: 1, price: 1, ad: 'A', after: 1 }] }] });
  const state = await stateAt('2026-03-02');
  await run(state);
  const u = (await userOf(o.key))!;
  const [pf] = await sql`select id from public_filers where filer_key = ${o.key}`;
  assert.equal(await filerAction(pf.id, 'hide', 'review'), true);
  assert.ok((await sql`select hidden_at from public_filers where id = ${pf.id}`)[0].hidden_at);
  assert.equal(await filerAction(pf.id, 'unhide', 'review'), true);
  assert.equal((await sql`select hidden_at from public_filers where id = ${pf.id}`)[0].hidden_at, null);
  assert.equal(await filerAction(pf.id, 'remove', 'request'), true);
  const [gone] = await sql`select removed_at, hidden_at, excluded, open_symbols, demo from public_filers where id = ${pf.id}`;
  assert.ok(gone.removed_at); assert.deepEqual(gone.excluded, {}); assert.deepEqual(gone.open_symbols, []);
  assert.equal((await sql`select count(*)::int as n from users where id = ${u.id}`)[0].n, 0);
  assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 0);
  assert.equal((await sql`select count(*)::int as n from public_transactions where filer_id = ${pf.id}`)[0].n, 0);
  assert.equal((await sql`select count(*)::int as n from handle_reservations where handle = ${u.handle}`)[0].n, 1);
  await sql`delete from handle_reservations where handle = ${u.handle}`;
  const log = await sql`select action, reason from public_filer_log where filer_id = ${pf.id} order by id`;
  assert.deepEqual(log.map((l) => `${l.action}:${l.reason}`), ['hide:review', 'unhide:review', 'remove:request']);
  // Re-import of the same filings never recreates it.
  await sql`update public_import_state set cursor = ${sql.json({ day: '2026-03-02', offset: 0 })} where source = ${state}`;
  const r = await run(state);
  assert.equal(r.removedSkipped, 3);
  assert.equal(await userOf(o.key), null);
  assert.equal((await sql`select count(*)::int as n from public_transactions where filer_id = ${pf.id}`)[0].n, 0);
  assert.equal(await filerAction(pf.id, 'hide', 'review'), false);
});

dbTest('AC 33: the dry run fetches and matches in memory, writes nothing, needs an explicit on and the contact, and reports counts only', async () => {
  const { sql } = await import('./db.ts');
  const o = owner(`${tag} Dry Fictional`), p = owner(`${tag} Dry Holder`, { tenPercent: true });
  const five: FakeFiling[] = [];
  for (let i = 0; i < 5; i++) five.push(...trip(o, `QZK${i}`, 10, 10 + i));
  await setScenario(fake.base, { filings: [...five, ...trip(p, 'QZXK', 1, 2)] });
  const state = await stateAt('2026-03-02');
  await assert.rejects(run(state, { dryRun: true }), /PUBLIC_TRADERS=1/);
  const r = await run(state, { dryRun: true, env: { ...env, PUBLIC_TRADERS: '1' } });
  assert.equal(r.dryRun, true);
  assert.equal(r.filers, 1); assert.equal(r.priced, 1); assert.equal(r.five, 1); assert.equal(r.roleSkipped, 2);
  assert.equal((await sql`select count(*)::int as n from public_filers where filer_key in ${sql([o.key, p.key])}`)[0].n, 0);
  const [st] = await sql`select cursor, last_success_at from public_import_state where source = ${state}`;
  assert.deepEqual(st.cursor, { day: '2026-03-02', offset: 0 }); assert.equal(st.last_success_at, null);
  const text = JSON.stringify(r);
  for (const never of [tag, 'Fictional', 'QZ']) assert.ok(!text.includes(never), never);
});

test('AC 24: the privacy registry covers the four tables and the two closed_trades columns', async () => {
  const { SCHEMA_MAP } = await import('./privacy-retention.ts');
  const { NOT_A_FIELD } = await import('./privacy-fields.ts');
  for (const t of ['public_filers', 'public_transactions', 'public_import_state', 'public_filer_log']) assert.ok(SCHEMA_MAP[t], t);
  assert.equal(SCHEMA_MAP.public_transactions.personal, true);
  assert.ok(NOT_A_FIELD['closed_trades.filing_url']); assert.ok(NOT_A_FIELD['closed_trades.feed_after']);
});
