// F-1 PR-2a acceptance tests (docs/features/logs/F-1/plan.md §4): the state machine, zero-depth validation, provisional
// vs confirmed claims, decline/expiry/S6c cleanup, sign-in by connection, the chunked resumable import, the tick,
// staleness, paper accounts, and the per-user lock. DB tests run with DATABASE_URL and an in-memory vendor fake.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { BrokerUser, VendorAccount } from './broker.ts';
import { advanceCursor, aggregateRecord, assertTransition, clockState, IllegalTransitionError, ownsConnection, parseConnectionId, PENDING_HOURS, REFUSED_STATUSES, RETRY_BASE_MS, RETRY_MAX_MS, retryDelayMs, STALE_HOURS, STATES, startCursor, TRANSITIONS, type Deps } from './connections.ts';
import { recordBodyCopy, RECORD_BODY } from './copy.ts';
import { attemptCookieValue } from './auth/links.ts';

test('state machine: six states, only pending→importing|declined|expired and importing→connected|failed', () => {
  assert.deepEqual([...STATES], ['pending', 'importing', 'connected', 'declined', 'expired', 'failed']);
  assert.doesNotThrow(() => assertTransition('pending', 'importing'));
  assert.doesNotThrow(() => assertTransition('pending', 'declined'));
  assert.doesNotThrow(() => assertTransition('pending', 'expired'));
  assert.doesNotThrow(() => assertTransition('importing', 'connected'));
  assert.doesNotThrow(() => assertTransition('importing', 'failed'));
  for (const from of STATES) for (const to of STATES) if (!TRANSITIONS[from].includes(to)) assert.throws(() => assertTransition(from, to), IllegalTransitionError, `${from}→${to}`);
  assert.equal(TRANSITIONS.connected.length + TRANSITIONS.declined.length + TRANSITIONS.expired.length + TRANSITIONS.failed.length, 0);
});

test('clocks: pending expires at 24 h, importing with no progress fails at 24 h, nothing else moves', () => {
  const t0 = new Date('2026-10-22T10:00:00Z');
  const h = (n: number) => new Date(t0.getTime() + n * 3_600_000);
  assert.equal(PENDING_HOURS, 24);
  assert.equal(STALE_HOURS, 24);
  const pending = { state: 'pending' as const, pending_at: t0, importing_at: null, last_progress_at: null };
  assert.equal(clockState(pending, h(23.99)), null);
  assert.equal(clockState(pending, h(24)), 'expired');
  const importing = { state: 'importing' as const, pending_at: t0, importing_at: h(1), last_progress_at: h(2) };
  assert.equal(clockState(importing, h(25.9)), null);
  assert.equal(clockState(importing, h(26)), 'failed');
  assert.equal(clockState({ ...importing, last_progress_at: null }, h(25)), 'failed'); // falls back to importing_at
  for (const state of ['connected', 'declined', 'expired', 'failed'] as const) assert.equal(clockState({ ...pending, state }, h(1000)), null);
});

test('cursor: one page per step, next account when a page is short, offsets by the limit', () => {
  const c = startCursor();
  assert.deepEqual(c, { i: 0, offset: 0, pass: 1 });
  assert.deepEqual(advanceCursor(c, false, 1000), { i: 0, offset: 1000, pass: 1 });
  assert.deepEqual(advanceCursor({ i: 0, offset: 1000, pass: 1 }, true, 1000), { i: 1, offset: 0, pass: 1 });
});

test('body copy by state (plan §8 item 3): S5 line while importing, S8 line only when connected with no closes', () => {
  assert.equal(recordBodyCopy('importing', 0), RECORD_BODY.importing);
  assert.equal(recordBodyCopy('importing', 5), null); // committee fix (item 8): trades listed, the banner alone says importing
  assert.equal(recordBodyCopy('connected', 0), 'No closed trades yet. Your record starts with your first close.');
  assert.equal(recordBodyCopy('connected', 1), null);
  assert.equal(recordBodyCopy('none', 0), 'No trades yet.');
  assert.doesNotMatch(RECORD_BODY.importing, /No closed trades yet/);
  assert.equal(RECORD_BODY.banner(0), 'Importing your record · 0 closed trades so far');
  assert.equal(RECORD_BODY.banner(1), 'Importing your record · 1 closed trade so far');
  assert.equal(RECORD_BODY.finished, 'Import finished.');
});

test('ownership: a user owns its connection; before a user exists only the signed attempt cookie does', () => {
  const secret = 'k';
  assert.equal(ownsConnection({ user_id: 7, attempt_id: 3 }, 7, undefined, secret), true);
  assert.equal(ownsConnection({ user_id: 7, attempt_id: 3 }, 8, attemptCookieValue(3, secret), secret), false);
  assert.equal(ownsConnection({ user_id: null, attempt_id: 3 }, null, attemptCookieValue(3, secret), secret), true);
  assert.equal(ownsConnection({ user_id: null, attempt_id: 3 }, null, attemptCookieValue(4, secret), secret), false);
  assert.equal(ownsConnection({ user_id: null, attempt_id: 3 }, 9, undefined, secret), false);
});

test('schema: connections carries the six states and a timestamp per state; claims carry the F-1 columns; positions are percent-only', () => {
  const s = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');
  const block = s.slice(s.indexOf('create table if not exists connections'), s.indexOf('create table if not exists open_positions'));
  assert.match(block, /state text not null check \(state in \('pending', 'importing', 'connected', 'declined', 'expired', 'failed'\)\)/);
  for (const st of STATES) assert.match(block, new RegExp(`${st}_at timestamptz`));
  for (const col of ['connection_id', 'confirmed_at', 'removed_at', 'is_paper', 'paper_seen_at']) assert.match(block, new RegExp(`schema_add_column\\('broker_accounts', '${col}'`));
  const pos = s.slice(s.indexOf('create table if not exists open_positions'));
  assert.doesNotMatch(pos, /\b(units|price|amount|quantity|cost)\b/);
  assert.match(pos, /unrealized_pct double precision not null/);
  assert.doesNotMatch(s, /\b(drop|truncate)\b|delete\s+from/i);
});

test('connection ids from a query string or form are digits only (D3): NaN, floats, signs, blanks and oversized values are rejected before any query', () => {
  assert.equal(parseConnectionId('12'), 12);
  assert.equal(parseConnectionId('123456789012345678'), 123456789012345678);
  for (const bad of [undefined, null, '', 'abc', '1.5', '-1', '0', '+1', ' 1', '1e3', 'NaN', '1234567890123456789', 7]) assert.equal(parseConnectionId(bad), null, String(bad));
});

test('vendor backoff (D4): 30 s doubling per consecutive failure, capped at one hour; only 401/403/404 fail an import', () => {
  assert.equal(RETRY_BASE_MS, 30_000);
  assert.equal(RETRY_MAX_MS, 3_600_000);
  assert.deepEqual([1, 2, 3, 4].map(retryDelayMs), [30_000, 60_000, 120_000, 240_000]);
  assert.equal(retryDelayMs(8), 3_600_000);
  assert.equal(retryDelayMs(20), 3_600_000);
  assert.deepEqual([...REFUSED_STATUSES].sort(), [401, 403, 404]);
  for (const st of [400, 429, 500, 502, 503]) assert.equal(REFUSED_STATUSES.has(st), false);
});

test('record aggregate (fix round 3): the state is over every consented connection, never the newest one; pending, declined and expired rows never count; a later live connection of the same accounts supersedes a failed one', () => {
  const a = (id: string, isPaper = false) => ({ id, authorizationId: `auth-${id}`, institution: 'X', isPaper, initialSyncCompleted: true });
  const t = new Date('2026-10-23T10:00:00Z');
  const row = (id: number, state: (typeof STATES)[number], accts: string[], imported = 0, consented = true) =>
    ({ id, state, consent_at: consented ? t : null, imported_count: imported, accounts: accts.map((x) => a(x)) });
  // Nothing consented.
  assert.deepEqual(aggregateRecord([]), { state: 'none', imported: 0, importing: [] });
  assert.deepEqual(aggregateRecord([], true), { state: 'connected', imported: 0, importing: [] });
  for (const st of ['pending', 'declined', 'expired'] as const) assert.equal(aggregateRecord([row(1, st, ['p'], 0, false)]).state, 'none', st);
  // One consented connection: its own state.
  assert.equal(aggregateRecord([row(1, 'importing', ['a'])]).state, 'importing');
  assert.equal(aggregateRecord([row(1, 'connected', ['a'])]).state, 'connected');
  assert.equal(aggregateRecord([row(1, 'failed', ['a'])]).state, 'failed');
  // The tester's repro: an older import still running and a newer connected one → importing, counts summed, the running id listed.
  assert.deepEqual(aggregateRecord([row(1, 'importing', ['a1', 'a2', 'a3'], 4), row(2, 'connected', ['b1'], 2)]), { state: 'importing', imported: 6, importing: [1] });
  // An older import still running and a newer pending, declined or expired link → importing, never pending.
  for (const st of ['pending', 'declined', 'expired'] as const) assert.deepEqual(aggregateRecord([row(1, 'importing', ['a'], 4), row(2, st, ['b'], 0, false)]), { state: 'importing', imported: 4, importing: [1] }, st);
  // Two imports running → both driven.
  assert.deepEqual(aggregateRecord([row(1, 'importing', ['a'], 1), row(2, 'importing', ['b'], 2)]).importing, [1, 2]);
  // Importing wins over failed; failed wins over connected; connected only when every counted connection is connected.
  assert.equal(aggregateRecord([row(1, 'failed', ['a']), row(2, 'importing', ['b'])]).state, 'importing');
  assert.equal(aggregateRecord([row(1, 'connected', ['a']), row(2, 'failed', ['b'])]).state, 'failed');
  assert.equal(aggregateRecord([row(1, 'failed', ['a']), row(2, 'connected', ['b'])]).state, 'failed'); // a different account: still incomplete
  assert.equal(aggregateRecord([row(1, 'connected', ['a']), row(2, 'connected', ['b'])]).state, 'connected');
  // "Try again": a later live connection re-imports every real account of the failed one → the failed row no longer counts.
  assert.deepEqual(aggregateRecord([row(1, 'failed', ['a'], 3), row(2, 'connected', ['a'], 5)]), { state: 'connected', imported: 5, importing: [] });
  assert.equal(aggregateRecord([row(1, 'failed', ['a']), row(2, 'importing', ['a'])]).state, 'importing');
  assert.equal(aggregateRecord([row(1, 'failed', ['a', 'b']), row(2, 'connected', ['a'])]).state, 'failed'); // only part re-imported
  assert.equal(aggregateRecord([row(2, 'failed', ['a']), row(1, 'connected', ['a'])]).state, 'failed'); // an older connection never supersedes
  assert.equal(aggregateRecord([row(1, 'failed', ['a']), row(2, 'failed', ['a'])]).state, 'failed');
  // A pending link never supersedes a failed import.
  assert.equal(aggregateRecord([row(1, 'failed', ['a']), row(2, 'pending', ['a'], 0, false)]).state, 'failed');
});

// ---------- DB tests ----------
const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

type Row = { id: string; symbol: string; side: 'BUY' | 'SELL'; price: number; at: string };
const pair = (acct: string, n: number, sym = 'AAA', gain = 1.1): Row[] => [
  { id: `${acct}-b${n}`, symbol: sym, side: 'BUY', price: 100, at: `2024-01-${String((n % 27) + 1).padStart(2, '0')}T10:00:00Z` },
  { id: `${acct}-s${n}`, symbol: sym, side: 'SELL', price: 100 * gain, at: `2024-01-${String((n % 27) + 1).padStart(2, '0')}T15:00:00Z` },
];

// In-memory vendor: accounts, rows per account, positions, what was deleted, optional delay and forced failures.
function fakeVendor() {
  const v = {
    accounts: [] as VendorAccount[],
    rows: new Map<string, Row[]>(),
    positions: new Map<string, { symbol: string; unrealizedPct: number }[]>(),
    deletedConnections: [] as string[],
    deletedUsers: [] as string[],
    delayMs: 0,
    failPositions: null as null | number,
    calls: [] as string[],
  };
  const fail = (status: number) => Object.assign(new Error(`vendor ${status}`), { response: { status } });
  const deps: Deps = {
    pageLimit: 3,
    registerUser: async (ref) => ({ snaptradeUserId: `vendor-${ref}`, secretEnc: 'enc' }),
    connectUrl: async () => 'https://vendor.example/portal',
    listAccounts: async () => { v.calls.push('listAccounts'); return v.accounts; },
    fetchActivitiesPage: async (_u: BrokerUser, accountId, offset, limit = 3) => {
      v.calls.push(`page:${accountId}:${offset}`);
      if (v.delayMs) await new Promise((r) => setTimeout(r, v.delayMs));
      const rows = (v.rows.get(accountId) ?? []).slice(offset, offset + limit);
      return { activities: rows.map((r) => ({ externalId: r.id, accountId, symbol: r.symbol, side: r.side, units: 1, price: r.price, fee: 0, executedAt: new Date(r.at), verified: true, raw: {} })), done: rows.length < limit };
    },
    fetchPositions: async (_u, accountId) => { v.calls.push('positions'); if (v.failPositions) throw fail(v.failPositions); return v.positions.get(accountId) ?? []; },
    deleteConnection: async (_u, id) => { v.deletedConnections.push(id); },
    deleteUser: async (u) => { v.deletedUsers.push(u.snaptradeUserId); },
  };
  return { v, deps };
}
const acct = (id: string, o: Partial<VendorAccount> = {}): VendorAccount => ({ id, authorizationId: `auth-${id}`, institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true, ...o });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `c${Math.random().toString(36).slice(2, 10)}`;
  const mkUser = async (n: string) => createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` });
  const events = async (attempt: number) => (await sql`select name, meta from funnel_events where attempt_id = ${attempt} order by id`).map((e) => e.name as string);
  const conn = async (id: number) => (await sql`select * from connections where id = ${id}`)[0];
  const claims = async (ids: string[]) => sql`select account_id, user_id, confirmed_at, connection_id, is_paper from broker_accounts where account_id in ${sql(ids)} order by account_id`;
  const cleanup = async (userIds: number[], accountIds: string[] = []) => {
    if (userIds.length) await sql`delete from users where id in ${sql(userIds)}`;
    if (accountIds.length) await sql`delete from broker_accounts where account_id in ${sql(accountIds)}`;
  };
  return { sql, tag, mkUser, events, conn, claims, cleanup };
}

dbTest('signed in: link writes a pending row and provisional claims only (no activities); consent confirms claims and starts the import; steps read one page each, rebuild once, store positions, finish connected; funnel events carry no personal data', async () => {
  const { sql, tag, mkUser, events, conn, claims, cleanup } = await setup();
  const { startConnection, completeLink, consent, importStep, getConnection } = await import('./connections.ts');
  const { v, deps } = fakeVendor();
  const u = await mkUser('a');
  const [{ signup_attempt_id: attempt }] = await sql`select signup_attempt_id from users where id = ${u.id}`;
  const a1 = `${tag}-a1`, a2 = `${tag}-a2`;
  v.accounts = [acct(a1), acct(a2, { authorizationId: `auth-${a1}` })];
  v.rows.set(a1, [...pair(a1, 1), ...pair(a1, 2, 'BBB', 0.9), ...pair(a1, 3), ...pair(a1, 4)]); // 8 rows = 3 pages at limit 3
  v.rows.set(a2, pair(a2, 1, 'CCC', 1.2)); // 2 rows = 1 page
  v.positions.set(a1, [{ symbol: 'DDD', unrealizedPct: 0.05 }]);
  try {
    const url = await startConnection({ userId: u.id, attemptId: Number(attempt) }, 'https://app.example/connect/done', deps);
    assert.equal(url, 'https://vendor.example/portal');
    const [reg] = await sql`select snaptrade_user_id from users where id = ${u.id}`;
    assert.equal(reg.snaptrade_user_id, `vendor-${u.id}`);
    const out = await completeLink({ userId: u.id, attemptId: Number(attempt) }, deps);
    assert.equal(out.kind, 'consent');
    const id = (out as { id: number }).id;
    const c = await conn(id);
    assert.equal(c.state, 'pending');
    assert.ok(c.pending_at);
    assert.equal(c.user_id, u.id);
    assert.equal(c.vendor_authorization_id, `auth-${a1}`);
    // Zero depth: the link and the account ids only (TR-6), nothing imported.
    assert.equal((await sql`select 1 from activities where user_id = ${u.id}`).length, 0);
    const prov = await claims([a1, a2]);
    assert.deepEqual(prov.map((r) => [r.user_id, r.confirmed_at, Number(r.connection_id)]), [[u.id, null, id], [u.id, null, id]]);
    assert.ok(!v.calls.some((x) => x.startsWith('page:')));
    // Consent: the tap is consent_at; claims confirmed; importing with a cursor at the start.
    const who = await consent(id, new Date(), deps);
    assert.deepEqual(who, { userId: u.id, handle: u.handle });
    const c2 = await conn(id);
    assert.equal(c2.state, 'importing');
    assert.ok(c2.consent_at && c2.importing_at && c2.last_progress_at);
    assert.ok((await claims([a1, a2])).every((r) => r.confirmed_at));
    await assert.rejects(consent(id, new Date(), deps), /no longer awaiting consent/);
    // Steps: 3 pages for a1, 1 for a2, then rebuild + positions, then connected (sync was complete at link time).
    const seen: number[] = [];
    let r = await importStep(id, deps);
    seen.push(r.imported);
    assert.deepEqual(r, { state: 'importing', imported: 3, progressed: true });
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 0); // rebuilt once, at the end
    for (let i = 0; i < 10 && r.state === 'importing'; i++) { r = await importStep(id, deps); seen.push(r.imported); }
    assert.equal(r.state, 'connected');
    assert.deepEqual(v.calls.filter((x) => x.startsWith('page:')), [`page:${a1}:0`, `page:${a1}:3`, `page:${a1}:6`, `page:${a2}:0`]);
    assert.equal(v.calls.filter((x) => x === 'positions').length, 2);
    assert.deepEqual(seen, [3, 6, 8, 10, 10, 10]); // monotonic
    const c3 = await getConnection(id);
    assert.equal(c3!.state, 'connected');
    assert.ok(c3!.connected_at);
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 5);
    assert.deepEqual([...await sql`select symbol, unrealized_pct from open_positions where user_id = ${u.id}`], [{ symbol: 'DDD', unrealized_pct: 0.05 }]);
    assert.deepEqual(await events(Number(attempt)), ['landed', 'method_chosen', 'attested', 'portal_opened', 'link_succeeded', 'consented', 'import_finished']);
    const rows = await sql`select name, meta::text as meta from funnel_events where attempt_id = ${attempt}`;
    const text = JSON.stringify(rows);
    assert.doesNotMatch(text, /@|\d{7,}/);
    assert.doesNotMatch(text, new RegExp(tag));
    assert.match(text, /"trades\\": 5/);
    // A further step on a finished connection is a no-op.
    assert.deepEqual(await importStep(id, deps), { state: 'connected', imported: 10, progressed: false });
  } finally {
    await cleanup([u.id], [a1, a2]);
  }
});

dbTest('decline: declined with its timestamp, the link removed at the vendor, provisional claims released so the same account can be claimed by another trader; confirmed claims are never released', async () => {
  const { sql, tag, mkUser, events, conn, claims, cleanup } = await setup();
  const { completeLink, decline, consent, startConnection, drive } = await import('./connections.ts');
  const { v, deps } = fakeVendor();
  const a = await mkUser('a'), b = await mkUser('b');
  const att = async (uid: number) => Number((await sql`select signup_attempt_id from users where id = ${uid}`)[0].signup_attempt_id);
  const acc = `${tag}-x`, confirmed = `${tag}-y`;
  try {
    // A has a confirmed claim on `confirmed` from an earlier, consented connection.
    v.accounts = [acct(confirmed)];
    await startConnection({ userId: a.id, attemptId: await att(a.id) }, 'r', deps);
    const first = await completeLink({ userId: a.id, attemptId: await att(a.id) }, deps) as { id: number };
    await consent(first.id, new Date(), deps);
    assert.equal((await drive(first.id, deps)).state, 'connected');
    // A links a new account and declines.
    v.accounts = [acct(confirmed), acct(acc, { authorizationId: 'auth-new' })];
    const out = await completeLink({ userId: a.id, attemptId: await att(a.id) }, deps) as { kind: string; id: number };
    assert.equal(out.kind, 'consent');
    assert.equal((await claims([acc]))[0].confirmed_at, null);
    await decline(out.id, deps);
    const c = await conn(out.id);
    assert.equal(c.state, 'declined');
    assert.ok(c.declined_at && c.cleanup_done_at);
    assert.deepEqual(v.deletedConnections, ['auth-new']);
    assert.deepEqual(v.deletedUsers, []); // a users row exists: the vendor user stays
    assert.equal((await claims([acc])).length, 0); // released
    assert.equal((await claims([confirmed])).length, 1); // confirmed, never released
    assert.ok((await events(await att(a.id))).includes('declined'));
    // The same account is claimable by B now.
    const { v: vb, deps: depsB } = fakeVendor();
    vb.accounts = [acct(acc)];
    await startConnection({ userId: b.id, attemptId: await att(b.id) }, 'r', depsB);
    const outB = await completeLink({ userId: b.id, attemptId: await att(b.id) }, depsB);
    assert.equal(outB.kind, 'consent');
    assert.equal((await claims([acc]))[0].user_id, b.id);
    // A replayed decline on a consented (connected) row is a no-op: no state change, no cleanup, the vendor link survives (D2).
    await decline(first.id, deps);
    assert.equal((await conn(first.id)).state, 'connected');
    assert.equal((await conn(first.id)).cleanup_done_at, null);
    assert.deepEqual(v.deletedConnections, ['auth-new']); // the consented authorization was never deleted
    assert.equal((await claims([confirmed])).length, 1);
    await decline(out.id, deps); // declining twice is idempotent
    assert.deepEqual(v.deletedConnections, ['auth-new']);
    assert.equal((await events(await att(a.id))).filter((e) => e === 'declined').length, 1); // recorded once
  } finally {
    await cleanup([a.id, b.id], [acc, confirmed]);
  }
});

dbTest('brokerage-first: no users row until consent; the attestation on the attempt precedes the user; the vendor user moves from the attempt to the user; zero real accounts creates no user row and deletes the vendor user', async () => {
  const { sql, tag, events, conn, cleanup } = await setup();
  const { createAttempt } = await import('./auth/attempts.ts');
  const { startConnection, completeLink, consent } = await import('./connections.ts');
  const { v, deps } = fakeVendor();
  const attempt = await createAttempt({ method: 'brokerage', attested: true });
  const acc = `${tag}-bf`;
  let userId: number | null = null;
  try {
    await startConnection({ userId: null, attemptId: attempt }, 'r', deps);
    const [a] = await sql`select snaptrade_user_id, user_id from signup_attempts where id = ${attempt}`;
    assert.equal(a.snaptrade_user_id, `vendor-attempt-${attempt}`);
    assert.equal(a.user_id, null);
    v.accounts = [acct(acc), acct(`${tag}-paper`, { isPaper: true, authorizationId: `auth-${acc}` })];
    const out = await completeLink({ userId: null, attemptId: attempt }, deps) as { kind: string; id: number };
    assert.equal(out.kind, 'consent');
    assert.equal((await conn(out.id)).user_id, null);
    assert.equal((await sql`select 1 from users where signup_attempt_id = ${attempt}`).length, 0); // still no user
    assert.equal((await sql`select 1 from broker_accounts where account_id = ${acc}`).length, 0); // the claim lives on the connection snapshot
    const who = await consent(out.id, new Date(), deps);
    userId = who.userId;
    const [u] = await sql`select handle, signup_attempt_id, snaptrade_user_id, adult_attested_at from users where id = ${userId}`;
    assert.equal(Number(u.signup_attempt_id), attempt);
    assert.equal(u.snaptrade_user_id, `vendor-attempt-${attempt}`);
    assert.match(u.handle, /^trader_/);
    assert.equal((await sql`select snaptrade_user_id from signup_attempts where id = ${attempt}`)[0].snaptrade_user_id, null);
    const claims = await sql`select account_id, is_paper, confirmed_at from broker_accounts where user_id = ${userId} order by account_id`;
    assert.deepEqual(claims.map((r) => [r.account_id, r.is_paper, !!r.confirmed_at]), [[acc, false, true], [`${tag}-paper`, true, true]]);
    assert.equal((await conn(out.id)).user_id, userId);
    assert.deepEqual((await events(attempt)).slice(-3), ['portal_opened', 'link_succeeded', 'consented']);
    const [ev] = await sql`select meta from funnel_events where attempt_id = ${attempt} and name = 'link_succeeded'`;
    assert.deepEqual(ev.meta, { accounts: 2, paper: 1 });

    // S6c: only a simulated account → declined, no user row, vendor link and vendor user deleted.
    const attempt2 = await createAttempt({ method: 'brokerage', attested: true });
    const { v: v2, deps: deps2 } = fakeVendor();
    await startConnection({ userId: null, attemptId: attempt2 }, 'r', deps2);
    v2.accounts = [acct(`${tag}-p2`, { isPaper: true })];
    const none = await completeLink({ userId: null, attemptId: attempt2 }, deps2) as { kind: string; id: number };
    assert.equal(none.kind, 'none');
    assert.equal((await conn(none.id)).state, 'declined');
    assert.equal((await sql`select 1 from users where signup_attempt_id = ${attempt2}`).length, 0);
    assert.deepEqual(v2.deletedConnections, [`auth-${tag}-p2`]);
    assert.deepEqual(v2.deletedUsers, [`vendor-attempt-${attempt2}`]);
    assert.equal((await sql`select snaptrade_user_id from signup_attempts where id = ${attempt2}`)[0].snaptrade_user_id, null);
    assert.ok((await events(attempt2)).includes('no_real_account'));
  } finally {
    await cleanup(userId ? [userId] : [], [acc, `${tag}-paper`]);
  }
});

dbTest('sign-in by connection: a fresh link whose accounts are all confirmed-claimed by one trader signs that trader in and drops the link; a different signed-in trader, or a partial claim, is refused', async () => {
  const { sql, tag, mkUser, conn, cleanup } = await setup();
  const { createAttempt } = await import('./auth/attempts.ts');
  const { startConnection, completeLink, consent } = await import('./connections.ts');
  const owner = await mkUser('o'), other = await mkUser('x');
  const att = async (uid: number) => Number((await sql`select signup_attempt_id from users where id = ${uid}`)[0].signup_attempt_id);
  const a1 = `${tag}-s1`, a2 = `${tag}-s2`, free = `${tag}-free`;
  try {
    const { v, deps } = fakeVendor();
    v.accounts = [acct(a1), acct(a2, { authorizationId: `auth-${a1}` })];
    await startConnection({ userId: owner.id, attemptId: await att(owner.id) }, 'r', deps);
    const first = await completeLink({ userId: owner.id, attemptId: await att(owner.id) }, deps) as { id: number };
    await consent(first.id, new Date(), deps);
    // Returning trader, signed out: a new attempt, a new vendor user, the same two accounts.
    const attempt = await createAttempt({ method: 'brokerage', attested: true });
    const { v: v2, deps: d2 } = fakeVendor();
    await startConnection({ userId: null, attemptId: attempt }, 'r', d2);
    v2.accounts = [acct(a1, { authorizationId: 'auth-again' }), acct(a2, { authorizationId: 'auth-again' })];
    const out = await completeLink({ userId: null, attemptId: attempt }, d2);
    assert.equal(out.kind, 'signin');
    assert.equal((out as { userId: number }).userId, owner.id);
    assert.equal((await conn((out as { id: number }).id)).state, 'declined');
    assert.deepEqual(v2.deletedConnections, ['auth-again']);
    assert.deepEqual(v2.deletedUsers, [`vendor-attempt-${attempt}`]);
    assert.equal((await sql`select user_id from signup_attempts where id = ${attempt}`)[0].user_id, owner.id);
    assert.equal((await sql`select 1 from users where signup_attempt_id = ${attempt}`).length, 0); // no second user
    // A different signed-in trader is refused and the link dropped.
    const { v: v3, deps: d3 } = fakeVendor();
    v3.accounts = [acct(a1, { authorizationId: 'auth-other' })];
    await startConnection({ userId: other.id, attemptId: await att(other.id) }, 'r', d3);
    const refused = await completeLink({ userId: other.id, attemptId: await att(other.id) }, d3);
    assert.equal(refused.kind, 'refused');
    assert.deepEqual(v3.deletedConnections, ['auth-other']);
    assert.equal((await sql`select user_id from broker_accounts where account_id = ${a1}`)[0].user_id, owner.id);
    // Signed out with a partial overlap (one claimed, one free) → refused, nothing claimed.
    const attempt3 = await createAttempt({ method: 'brokerage', attested: true });
    const { v: v4, deps: d4 } = fakeVendor();
    await startConnection({ userId: null, attemptId: attempt3 }, 'r', d4);
    v4.accounts = [acct(a1, { authorizationId: 'auth-p' }), acct(free, { authorizationId: 'auth-p' })];
    assert.equal((await completeLink({ userId: null, attemptId: attempt3 }, d4)).kind, 'refused');
    assert.equal((await sql`select 1 from broker_accounts where account_id = ${free}`).length, 0);
    assert.equal((await sql`select user_id from signup_attempts where id = ${attempt3}`)[0].user_id, null);
  } finally {
    await cleanup([owner.id, other.id], [a1, a2, free]);
  }
});

dbTest('expiry with a clock: a pending row is marked expired at 24 h lazily on read and by the tick, which removes the link at the vendor and releases the provisional claims; no profile ever shows pending older than 24 h', async () => {
  const { sql, tag, mkUser, events, conn, claims, cleanup } = await setup();
  const { startConnection, completeLink, applyClocks, tick, consent } = await import('./connections.ts');
  const u = await mkUser('e');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const acc = `${tag}-exp`;
  const { v, deps } = fakeVendor();
  v.accounts = [acct(acc)];
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    const t0 = new Date('2026-10-22T10:00:00Z');
    const { id } = await completeLink({ userId: u.id, attemptId: attempt }, deps, t0) as { id: number };
    const h = (n: number) => new Date(t0.getTime() + n * 3_600_000);
    assert.deepEqual(await applyClocks(h(23.9), { id }), { expired: [], failed: [] });
    assert.equal((await conn(id)).state, 'pending');
    // Lazily, on a read (marking only): expired; claims still there until the tick's cleanup.
    assert.deepEqual(await applyClocks(h(24), { userId: u.id }), { expired: [id], failed: [] });
    const c = await conn(id);
    assert.equal(c.state, 'expired');
    assert.equal(c.expired_at.toISOString(), h(24).toISOString());
    assert.equal(c.cleanup_done_at, null);
    assert.deepEqual(v.deletedConnections, []);
    await assert.rejects(consent(id, h(24), deps), /no longer awaiting consent/);
    const t = await tick(deps, h(25));
    assert.equal(t.cleaned, 1);
    assert.deepEqual(v.deletedConnections, [`auth-${acc}`]);
    assert.equal((await claims([acc])).length, 0);
    assert.ok((await conn(id)).cleanup_done_at);
    assert.ok((await events(attempt)).includes('expired'));
    assert.equal((await sql`select count(*)::int as n from connections where state = 'pending' and pending_at + interval '24 hours' <= ${h(25)} and id = ${id}`)[0].n, 0);
  } finally {
    await cleanup([u.id], [acc]);
  }
});

dbTest('staleness: an importing row with no progress for 24 h becomes failed (reason stale), lazily and by the tick; the record is unchanged; a vendor 4xx fails the row; a 5xx leaves it importing', async () => {
  const { sql, tag, mkUser, events, conn, cleanup } = await setup();
  const { startConnection, completeLink, consent, importStep, applyClocks } = await import('./connections.ts');
  const u = await mkUser('s');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const acc = `${tag}-st`;
  const { v, deps } = fakeVendor();
  v.accounts = [acct(acc)];
  v.rows.set(acc, pair(acc, 1));
  const t0 = new Date('2026-10-22T10:00:00Z');
  const h = (n: number) => new Date(t0.getTime() + n * 3_600_000);
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    const { id } = await completeLink({ userId: u.id, attemptId: attempt }, deps, t0) as { id: number };
    await consent(id, h(1), deps);
    // The page is read at h(2); positions then fail with a 500: the whole step rolls back, nothing recorded, still importing.
    assert.deepEqual(await importStep(id, deps, h(2)), { state: 'importing', imported: 2, progressed: true });
    v.failPositions = 500;
    const deferred = await importStep(id, deps, h(3));
    assert.deepEqual({ ...deferred, retryAt: undefined }, { state: 'importing', imported: 2, progressed: false, retryAt: undefined });
    assert.equal(deferred.retryAt, h(3).getTime() + 30_000); // D4: a 5xx defers the next step; nothing is failed
    assert.equal((await conn(id)).state, 'importing');
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 0);
    assert.equal((await conn(id)).import_cursor.rebuilt, undefined);
    assert.equal((await conn(id)).import_cursor.retries, 1);
    assert.equal((await conn(id)).last_progress_at.toISOString(), h(2).toISOString());
    v.failPositions = null;
    // No progress for 24 h → failed, stale, lazily; the activities read so far stay, closed_trades untouched.
    assert.deepEqual(await applyClocks(h(25.9), { userId: u.id }), { expired: [], failed: [] });
    assert.deepEqual(await applyClocks(h(26), { userId: u.id }), { expired: [], failed: [id] });
    const c = await conn(id);
    assert.equal(c.state, 'failed');
    assert.equal(c.failure_reason, 'stale');
    assert.ok(c.failed_at);
    assert.ok((await events(attempt)).includes('failed'));
    assert.deepEqual(await importStep(id, deps, h(27)), { state: 'failed', imported: 2, progressed: false });
    // A vendor 401/403 on a step fails the row with reason vendor (the vendor refused the link).
    const { id: id2 } = await completeLink({ userId: u.id, attemptId: attempt }, { ...deps, listAccounts: async () => [acct(`${tag}-v`, { authorizationId: 'auth-v' })] }, h(30)) as { id: number };
    await consent(id2, h(30), deps);
    const d403 = { ...deps, fetchActivitiesPage: async () => { throw Object.assign(new Error('vendor 403'), { response: { status: 403 } }); } };
    assert.deepEqual(await importStep(id2, d403, h(31)), { state: 'failed', imported: 0, progressed: false });
    assert.equal((await conn(id2)).failure_reason, 'vendor');
  } finally {
    await cleanup([u.id], [acc, `${tag}-v`]);
  }
});

dbTest('tick advances every importing row with no client poll, resuming from the stored cursor; it waits for the vendor\'s initial sync and re-reads once after it completes, so late rows are not missed', async () => {
  const { sql, tag, mkUser, conn, cleanup } = await setup();
  const { startConnection, completeLink, consent, importStep, tick, WAIT_RECHECK_MS } = await import('./connections.ts');
  const u = await mkUser('t');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const acc = `${tag}-tk`;
  const { v, deps } = fakeVendor();
  v.accounts = [acct(acc, { initialSyncCompleted: false })];
  v.rows.set(acc, [...pair(acc, 1), ...pair(acc, 2)]);
  const t0 = new Date('2026-10-22T10:00:00Z');
  const s = (n: number) => new Date(t0.getTime() + n * 1000);
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    const { id } = await completeLink({ userId: u.id, attemptId: attempt }, deps, t0) as { id: number };
    await consent(id, s(1), deps);
    // One client step (the tab), then the tab closes.
    assert.equal((await importStep(id, deps, s(2))).imported, 3);
    // The tick finishes the pass and then waits on the vendor's flag: still importing, no progress recorded while waiting.
    const t1 = await tick(deps, s(10));
    assert.equal(t1.advanced, 1);
    let c = await conn(id);
    assert.equal(c.state, 'importing');
    assert.equal(c.imported_count, 4);
    assert.equal(c.import_cursor.rebuilt, true);
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 2); // rebuilt so the profile shows what arrived
    assert.equal(c.last_progress_at.toISOString(), s(10).toISOString());
    // Re-checks are throttled.
    assert.deepEqual(await importStep(id, deps, s(11)), { state: 'importing', imported: 4, progressed: false });
    const listCalls = v.calls.filter((x) => x === 'listAccounts').length;
    await importStep(id, deps, s(12));
    assert.equal(v.calls.filter((x) => x === 'listAccounts').length, listCalls);
    // The vendor finishes and posted one more pair meanwhile: a second pass picks it up, then connected.
    v.accounts = [acct(acc, { initialSyncCompleted: true })];
    v.rows.set(acc, [...pair(acc, 1), ...pair(acc, 2), ...pair(acc, 3, 'EEE')]);
    const t2 = await tick(deps, s(10 + WAIT_RECHECK_MS / 1000 + 1));
    assert.equal(t2.advanced, 1);
    c = await conn(id);
    assert.equal(c.state, 'connected');
    assert.equal(c.import_cursor.pass, 2);
    assert.equal((await sql`select count(*)::int as n from activities where user_id = ${u.id}`)[0].n, 6);
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 3);
    assert.equal(c.imported_count, 4 + 6); // the counter counts rows read, duplicates included; the record dedupes on (source, external_id)
  } finally {
    await cleanup([u.id], [acc]);
  }
});

dbTest('paper accounts: claimed, excluded from the import, counted; a real account flagged paper on a later sync stops being imported and stays claimed', async () => {
  const { sql, tag, mkUser, cleanup } = await setup();
  const { startConnection, completeLink, consent, drive } = await import('./connections.ts');
  const { syncUser } = await import('./sync.ts');
  const u = await mkUser('p');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const real = `${tag}-real`, paper = `${tag}-paper`;
  const { v, deps } = fakeVendor();
  v.accounts = [acct(real), acct(paper, { isPaper: true, authorizationId: `auth-${real}` })];
  v.rows.set(real, pair(real, 1));
  v.rows.set(paper, [...pair(paper, 1), ...pair(paper, 2)]);
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    const { id } = await completeLink({ userId: u.id, attemptId: attempt }, deps) as { id: number };
    await consent(id, new Date(), deps);
    assert.equal((await drive(id, deps)).state, 'connected');
    assert.deepEqual([...await sql`select distinct account_id from activities where user_id = ${u.id}`], [{ account_id: real }]);
    const rows = await sql`select account_id, is_paper, paper_seen_at from broker_accounts where user_id = ${u.id} order by account_id`;
    assert.deepEqual(rows.map((r) => [r.account_id, r.is_paper, !!r.paper_seen_at]), [[paper, true, true], [real, false, false]]);
    assert.equal((await sql`select count(*)::int as n from broker_accounts where user_id = ${u.id} and is_paper`)[0].n, 1);
    assert.ok(!v.calls.includes(`page:${paper}:0`));
    // Hourly sync re-reads the flag: the real account is now reported as paper; nothing more is imported from it.
    const [bu] = await sql<{ id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null }[]>`select id, snaptrade_user_id, snaptrade_secret_enc from users where id = ${u.id}`;
    const fetched: string[][] = [];
    const n = await syncUser(bu, {
      listAccounts: async () => [acct(real, { isPaper: true }), acct(paper, { isPaper: true })],
      fetchActivities: async (_b, _s, ids) => { fetched.push(ids ?? []); return []; },
    });
    assert.equal(n, 0);
    assert.deepEqual(fetched, []); // no real account left: nothing fetched
    assert.deepEqual((await sql`select account_id, is_paper from broker_accounts where user_id = ${u.id} order by account_id`).map((r) => [r.account_id, r.is_paper]), [[paper, true], [real, true]]);
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 1); // the record stays
  } finally {
    await cleanup([u.id], [real, paper]);
  }
});

dbTest('concurrency: two import steps for one user at once never interleave: each vendor page is consumed exactly once and the result equals a sequential run', async () => {
  const { sql, tag, mkUser, conn, cleanup } = await setup();
  const { startConnection, completeLink, consent, importStep } = await import('./connections.ts');
  const u = await mkUser('q');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const acc = `${tag}-cc`;
  const { v, deps } = fakeVendor();
  v.accounts = [acct(acc)];
  v.rows.set(acc, [...pair(acc, 1), ...pair(acc, 2), ...pair(acc, 3), ...pair(acc, 4), ...pair(acc, 5)]); // 10 rows, 4 pages of 3
  v.delayMs = 60;
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    const { id } = await completeLink({ userId: u.id, attemptId: attempt }, deps) as { id: number };
    await consent(id, new Date(), deps);
    const results = await Promise.all([importStep(id, deps), importStep(id, deps), importStep(id, deps), importStep(id, deps)]);
    const pages = v.calls.filter((x) => x.startsWith('page:'));
    assert.deepEqual(pages, [`page:${acc}:0`, `page:${acc}:3`, `page:${acc}:6`, `page:${acc}:9`]); // in order, each once
    assert.deepEqual(results.map((r) => r.imported).sort((a, b) => a - b), [3, 6, 9, 10]);
    const c = await conn(id);
    assert.equal(c.imported_count, 10);
    assert.deepEqual(c.import_cursor, { i: 1, offset: 0, pass: 1 });
    assert.equal((await sql`select count(*)::int as n from activities where user_id = ${u.id}`)[0].n, 10);
  } finally {
    await cleanup([u.id], [acc]);
  }
});

dbTest('D1: the hourly sync never touches a pending link: syncUser and the tick read nothing and confirm nothing; a later decline releases the claims and removes the link', async () => {
  const { sql, tag, mkUser, conn, claims, cleanup } = await setup();
  const { startConnection, completeLink, decline, tick } = await import('./connections.ts');
  const { syncUser, usersToSync } = await import('./sync.ts');
  const { v, deps } = fakeVendor();
  const u = await mkUser('d1');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const acc = `${tag}-d1`;
  v.accounts = [acct(acc)];
  v.rows.set(acc, [...pair(acc, 1), ...pair(acc, 2), ...pair(acc, 3)]);
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    const { id } = await completeLink({ userId: u.id, attemptId: attempt }, deps) as { id: number };
    assert.equal((await conn(id)).state, 'pending');
    const [bu] = await sql<{ id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null }[]>`select id, snaptrade_user_id, snaptrade_secret_enc from users where id = ${u.id}`;
    const fetched: string[][] = [];
    const broker = {
      listAccounts: async () => v.accounts,
      fetchActivities: async (_b: unknown, _s: unknown, ids?: string[]) => { fetched.push(ids ?? []); return v.rows.get(acc)!.map((r) => ({ externalId: r.id, accountId: acc, symbol: r.symbol, side: r.side, units: 1, price: r.price, fee: 0, executedAt: new Date(r.at), verified: true, raw: {} })); },
    };
    // The route would not even list this trader; and a direct sync reads nothing under a non-consented authorization.
    assert.equal((await usersToSync()).some((x) => x.id === u.id), false);
    assert.equal(await syncUser(bu, broker), 0);
    assert.deepEqual(fetched, []);
    await tick(deps);
    assert.equal((await sql`select count(*)::int as n from activities where user_id = ${u.id}`)[0].n, 0);
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 0);
    const c = await conn(id);
    assert.equal(c.state, 'pending');
    assert.deepEqual((await claims([acc])).map((r) => [r.user_id, r.confirmed_at]), [[u.id, null]]); // still provisional
    assert.ok(!v.calls.some((x) => x.startsWith('page:')));
    // A later decline releases everything.
    await decline(id, deps);
    assert.equal((await conn(id)).state, 'declined');
    assert.equal((await claims([acc])).length, 0);
    assert.deepEqual(v.deletedConnections, [`auth-${acc}`]);
    assert.equal(await syncUser(bu, broker), 0);
    assert.equal((await sql`select count(*)::int as n from activities where user_id = ${u.id}`)[0].n, 0);
  } finally {
    await cleanup([u.id], [acc]);
  }
});

dbTest('D2: an expired, uncleaned link re-bundled into a new consent is not cut by the tick: cleanup of the expired row skips the authorization the live connection holds', async () => {
  const { sql, tag, mkUser, conn, cleanup } = await setup();
  const { startConnection, completeLink, consent, applyClocks, tick, drive } = await import('./connections.ts');
  const { v, deps } = fakeVendor();
  const u = await mkUser('d2');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const acc = `${tag}-d2`;
  v.accounts = [acct(acc, { authorizationId: 'auth-x' })];
  v.rows.set(acc, pair(acc, 1));
  const t0 = new Date('2026-10-22T10:00:00Z');
  const h = (n: number) => new Date(t0.getTime() + n * 3_600_000);
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    const { id: a } = await completeLink({ userId: u.id, attemptId: attempt }, deps, t0) as { id: number };
    assert.deepEqual(await applyClocks(h(24), { userId: u.id }), { expired: [a], failed: [] }); // marked, not cleaned
    // The trader returns from the portal: the vendor still lists auth-x, which is bundled into pending B.
    const outB = await completeLink({ userId: u.id, attemptId: attempt }, deps, h(24.5)) as { kind: string; id: number };
    assert.equal(outB.kind, 'consent');
    assert.equal((await conn(outB.id)).vendor_authorization_id, 'auth-x');
    await consent(outB.id, h(24.6), deps);
    const t = await tick(deps, h(25));
    assert.equal(t.cleaned, 1);
    assert.ok((await conn(a)).cleanup_done_at);
    assert.deepEqual(v.deletedConnections, []); // auth-x is held by B: never deleted
    assert.equal((await conn(outB.id)).state, 'connected'); // the tick also drove B
    assert.equal((await sql`select user_id from broker_accounts where account_id = ${acc}`)[0].user_id, u.id);
    // And a replayed cleanup of A, or a decline of B, changes nothing more.
    await tick(deps, h(26));
    assert.deepEqual(v.deletedConnections, []);
    assert.equal((await drive(outB.id, deps, h(26))).state, 'connected');
  } finally {
    await cleanup([u.id], [acc]);
  }
});

dbTest('D4: a vendor 429 defers the step with backoff and keeps the cursor; a step before retryAt makes no vendor call, one after it reads the page and the import finishes; 401 fails with reason vendor', async () => {
  const { sql, tag, mkUser, conn, cleanup } = await setup();
  const { startConnection, completeLink, consent, importStep, drive, retryDelayMs } = await import('./connections.ts');
  const { v, deps } = fakeVendor();
  const u = await mkUser('d4');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const acc = `${tag}-d4`;
  v.accounts = [acct(acc)];
  v.rows.set(acc, [...pair(acc, 1), ...pair(acc, 2)]); // 4 rows, 2 pages
  const t0 = new Date('2026-10-22T10:00:00Z');
  const s = (n: number) => new Date(t0.getTime() + n * 1000);
  const fail = (status: number) => Object.assign(new Error(`vendor ${status}`), { response: { status } });
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    const { id } = await completeLink({ userId: u.id, attemptId: attempt }, deps, t0) as { id: number };
    await consent(id, s(1), deps);
    assert.equal((await importStep(id, deps, s(2))).imported, 3);
    const cursorBefore = (await conn(id)).import_cursor;
    let fails = 2;
    const flaky = { ...deps, fetchActivitiesPage: async (...args: Parameters<Deps['fetchActivitiesPage']>) => { if (fails-- > 0) throw fail(429); return deps.fetchActivitiesPage(...args); } };
    const r1 = await importStep(id, flaky, s(3));
    assert.deepEqual(r1, { state: 'importing', imported: 3, progressed: false, retryAt: s(3).getTime() + retryDelayMs(1) });
    let c = await conn(id);
    assert.equal(c.state, 'importing');
    assert.deepEqual({ i: c.import_cursor.i, offset: c.import_cursor.offset, pass: c.import_cursor.pass }, { i: cursorBefore.i, offset: cursorBefore.offset, pass: cursorBefore.pass });
    assert.equal(c.import_cursor.retries, 1);
    assert.equal(c.last_progress_at.toISOString(), s(2).toISOString()); // waiting is not progress
    // Before retryAt: no vendor call at all.
    const pages = v.calls.filter((x) => x.startsWith('page:')).length;
    assert.deepEqual(await importStep(id, flaky, s(10)), { state: 'importing', imported: 3, progressed: false, retryAt: r1.retryAt });
    assert.equal(v.calls.filter((x) => x.startsWith('page:')).length, pages);
    assert.equal((await drive(id, flaky, s(10))).progressed, false);
    // At retryAt the second 429 doubles the wait; after that the page lands and the backoff is cleared.
    const r2 = await importStep(id, flaky, s(33));
    assert.equal(r2.retryAt, s(33).getTime() + retryDelayMs(2));
    assert.equal((await conn(id)).import_cursor.retries, 2);
    const r3 = await drive(id, flaky, s(100));
    assert.equal(r3.state, 'connected');
    c = await conn(id);
    assert.equal(c.import_cursor.retries, undefined);
    assert.equal(c.import_cursor.retryAt, undefined);
    assert.equal((await sql`select count(*)::int as n from activities where user_id = ${u.id}`)[0].n, 4);
    // 401: the vendor refused the link; failed with reason vendor.
    v.accounts = [acct(`${tag}-d4b`, { authorizationId: 'auth-d4b' })];
    const { id: id2 } = await completeLink({ userId: u.id, attemptId: attempt }, deps, s(200)) as { id: number };
    await consent(id2, s(200), deps);
    assert.deepEqual(await importStep(id2, { ...deps, fetchActivitiesPage: async () => { throw fail(401); } }, s(201)), { state: 'failed', imported: 0, progressed: false });
    assert.equal((await conn(id2)).failure_reason, 'vendor');
  } finally {
    await cleanup([u.id], [acc, `${tag}-d4b`]);
  }
});

dbTest('D5: after a failed import the sync publishes nothing: the failed connection\'s accounts are not read, closed_trades stays empty, and the record state is failed', async () => {
  const { sql, tag, mkUser, conn, cleanup } = await setup();
  const { startConnection, completeLink, consent, importStep, latestConnection } = await import('./connections.ts');
  const { syncUser, usersToSync } = await import('./sync.ts');
  const { v, deps } = fakeVendor();
  const u = await mkUser('d5');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const a1 = `${tag}-d5a`, a2 = `${tag}-d5b`;
  v.accounts = [acct(a1), acct(a2, { authorizationId: `auth-${a1}` })];
  v.rows.set(a1, [...pair(a1, 1), ...pair(a1, 2)]);
  v.rows.set(a2, pair(a2, 1));
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    const { id } = await completeLink({ userId: u.id, attemptId: attempt }, deps) as { id: number };
    await consent(id, new Date(), deps);
    assert.equal((await importStep(id, deps)).imported, 3); // one page of a1; a2 never read
    const fail = { ...deps, fetchActivitiesPage: async () => { throw Object.assign(new Error('vendor 403'), { response: { status: 403 } }); } };
    assert.equal((await importStep(id, fail)).state, 'failed');
    assert.equal((await latestConnection(u.id))!.state, 'failed');
    const [bu] = await sql<{ id: number; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null }[]>`select id, snaptrade_user_id, snaptrade_secret_enc from users where id = ${u.id}`;
    const fetched: string[][] = [];
    const broker = {
      listAccounts: async () => v.accounts,
      fetchActivities: async (_b: unknown, _s: unknown, ids?: string[]) => { fetched.push(ids ?? []); return [...v.rows.get(a1)!, ...v.rows.get(a2)!].map((r) => ({ externalId: r.id, accountId: r.id.startsWith(a2) ? a2 : a1, symbol: r.symbol, side: r.side, units: 1, price: r.price, fee: 0, executedAt: new Date(r.at), verified: true, raw: {} })); },
    };
    assert.equal((await usersToSync()).some((x) => x.id === u.id), false);
    assert.equal(await syncUser(bu, broker), 0);
    assert.deepEqual(fetched, []);
    assert.equal((await sql`select count(*)::int as n from activities where user_id = ${u.id}`)[0].n, 3);
    assert.equal((await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n, 0); // never rebuilt, never published
    assert.equal((await conn(id)).state, 'failed');
  } finally {
    await cleanup([u.id], [a1, a2]);
  }
});

dbTest('D6: a brokerage-first consent that loses the claim race leaves no ghost user: the users row goes, the attempt reopens, and the link and the vendor user are deleted in one cleanup', async () => {
  const { sql, tag, mkUser, events, conn, cleanup } = await setup();
  const { createAttempt } = await import('./auth/attempts.ts');
  const { startConnection, completeLink, consent } = await import('./connections.ts');
  const { claimAccounts, AccountClaimedError } = await import('./claims.ts');
  const other = await mkUser('d6');
  const attempt = await createAttempt({ method: 'brokerage', attested: true });
  const acc = `${tag}-d6`;
  const { v, deps } = fakeVendor();
  try {
    await startConnection({ userId: null, attemptId: attempt }, 'r', deps);
    v.accounts = [acct(acc)];
    const out = await completeLink({ userId: null, attemptId: attempt }, deps) as { kind: string; id: number };
    assert.equal(out.kind, 'consent');
    // Between the link and the tap, another trader confirm-claims the account.
    assert.deepEqual(await claimAccounts(other.id, [acc]), { ok: true });
    // Fix round 4: assert on this attempt's own rows only (its attempt id and its vendor user), never a table-wide
    // count that other test files change concurrently.
    const mine = () => sql`select id from users where signup_attempt_id = ${attempt} or snaptrade_user_id = ${`vendor-attempt-${attempt}`}`;
    assert.equal((await mine()).length, 0);
    await assert.rejects(consent(out.id, new Date(), deps), AccountClaimedError);
    assert.equal((await mine()).length, 0); // no ghost
    const [a] = await sql`select user_id, completed_at, snaptrade_user_id, snaptrade_secret_enc from signup_attempts where id = ${attempt}`;
    assert.deepEqual([a.user_id, a.completed_at, a.snaptrade_user_id, a.snaptrade_secret_enc], [null, null, null, null]);
    const c = await conn(out.id);
    assert.equal(c.state, 'declined');
    assert.equal(c.user_id, null);
    assert.ok(c.cleanup_done_at);
    assert.deepEqual(v.deletedConnections, [`auth-${acc}`]);
    assert.deepEqual(v.deletedUsers, [`vendor-attempt-${attempt}`]);
    assert.equal((await sql`select user_id from broker_accounts where account_id = ${acc}`)[0].user_id, other.id);
    assert.ok((await events(attempt)).includes('failed'));
  } finally {
    await cleanup([other.id], [acc]);
  }
});

dbTest('fix round 4: recordStates gives the feed the same aggregate as recordStatus for many traders at once; a failed import reads failed, a trader with nothing consented reads none', async () => {
  const { sql, tag, mkUser, cleanup } = await setup();
  const { startConnection, completeLink, consent, importStep, recordStates, recordStatus } = await import('./connections.ts');
  const { v, deps } = fakeVendor();
  const u = await mkUser('r4f'), w = await mkUser('r4n');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const a1 = `${tag}-r4a`;
  v.accounts = [acct(a1)];
  v.rows.set(a1, [...pair(a1, 1), ...pair(a1, 2)]);
  try {
    assert.equal((await recordStates([])).size, 0);
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    const { id } = await completeLink({ userId: u.id, attemptId: attempt }, deps) as { id: number };
    await consent(id, new Date(), deps);
    assert.equal((await recordStates([u.id])).get(u.id)!.state, 'importing');
    await importStep(id, deps);
    const fail = { ...deps, fetchActivitiesPage: async () => { throw Object.assign(new Error('vendor 403'), { response: { status: 403 } }); } };
    assert.equal((await importStep(id, fail)).state, 'failed');
    const m = await recordStates([u.id, w.id, u.id]);
    assert.equal(m.size, 2);
    assert.deepEqual(m.get(u.id), await recordStatus(u.id));
    assert.equal(m.get(u.id)!.state, 'failed');
    assert.deepEqual(m.get(w.id), { state: 'none', imported: 0, importing: [] });
  } finally {
    await cleanup([u.id, w.id], [a1]);
  }
});

dbTest('public record (fix round 2): a pending, declined or expired link contributes nothing public; the state and the simulated-account count come only from a consented connection and confirmed claims', async () => {
  const { sql, tag, mkUser, cleanup } = await setup();
  const { startConnection, completeLink, consent, decline, importStep, publicRecord } = await import('./connections.ts');
  const { v, deps } = fakeVendor();
  const real = `${tag}-pr`, paper = `${tag}-pp`, real2 = `${tag}-pr2`, paper2 = `${tag}-pp2`, real3 = `${tag}-pr3`;
  const users: number[] = [];
  const link = async (u: { id: number }) => {
    const [{ signup_attempt_id: a }] = await sql`select signup_attempt_id from users where id = ${u.id}`;
    await startConnection({ userId: u.id, attemptId: Number(a) }, 'https://app.example/connect/done', deps);
    const out = await completeLink({ userId: u.id, attemptId: Number(a) }, deps);
    assert.equal(out.kind, 'consent');
    return (out as { id: number }).id;
  };
  try {
    // No link at all.
    const u0 = await mkUser('n'); users.push(u0.id);
    assert.deepEqual(await publicRecord(u0.id), { state: 'none', paper: 0 });
    // Pending: a vendor user and a provisional paper claim exist, nothing is public (the D-medium of re-run 1).
    const u = await mkUser('p'); users.push(u.id);
    v.accounts = [acct(real), acct(paper, { isPaper: true, authorizationId: `auth-${real}` })];
    v.rows.set(real, pair(real, 1));
    const id = await link(u);
    assert.equal((await sql`select count(*)::int as n from broker_accounts where user_id = ${u.id} and is_paper and confirmed_at is null`)[0].n, 1);
    assert.ok((await sql`select snaptrade_user_id from users where id = ${u.id}`)[0].snaptrade_user_id);
    assert.deepEqual(await publicRecord(u.id), { state: 'none', paper: 0 });
    // Declined: still nothing.
    await decline(id, deps);
    assert.deepEqual(await publicRecord(u.id), { state: 'none', paper: 0 });
    // Expired: still nothing.
    const id2 = await link(u);
    await sql`update connections set pending_at = now() - interval '25 hours' where id = ${id2}`;
    const { applyClocks } = await import('./connections.ts');
    await applyClocks(new Date(), { id: id2 });
    assert.equal((await sql`select state from connections where id = ${id2}`)[0].state, 'expired');
    assert.deepEqual(await publicRecord(u.id), { state: 'none', paper: 0 });
    // Consented: importing, with the confirmed paper claim counted; then connected with no closes (S8).
    const id3 = await link(u);
    await consent(id3, new Date(), deps);
    assert.deepEqual(await publicRecord(u.id), { state: 'importing', paper: 1 });
    for (let i = 0; i < 10 && (await publicRecord(u.id)).state === 'importing'; i++) await importStep(id3, deps);
    assert.deepEqual(await publicRecord(u.id), { state: 'connected', paper: 1 });
    // A later link waiting on consent (with a new simulated account) changes nothing public.
    v.accounts = [acct(real), acct(paper, { isPaper: true, authorizationId: `auth-${real}` }), acct(real3, { authorizationId: `auth-${paper2}` }), acct(paper2, { isPaper: true })];
    await link(u);
    assert.deepEqual(await publicRecord(u.id), { state: 'connected', paper: 1 });
    // A consented connection that failed shows as failed.
    const uf = await mkUser('f'); users.push(uf.id);
    v.accounts = [acct(real2)];
    const idf = await link(uf);
    await consent(idf, new Date(), deps);
    await sql`update connections set state = 'failed', failed_at = now(), failure_reason = 'vendor' where id = ${idf}`;
    assert.deepEqual(await publicRecord(uf.id), { state: 'failed', paper: 0 });
  } finally {
    await cleanup(users, [real, paper, real2, paper2, real3]);
  }
});

dbTest('fix round 3, the tester\'s repro: a 3-account import is running and a second link is consented; the record stays importing (nothing complete) until both finish; the owner poll drives both and never answers pending from a newer link; after the tick, 7 closes and connected', async () => {
  const { sql, tag, mkUser, conn, cleanup } = await setup();
  const { startConnection, completeLink, consent, drive, ownerPoll, publicRecord, recordStatus, tick } = await import('./connections.ts');
  const { v, deps: base } = fakeVendor();
  const deps = { ...base, pageLimit: 10 }; // one account per step, as the real page size does for small histories
  const u = await mkUser('r3');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const [a1, a2, a3, b1] = ['a1', 'a2', 'a3', 'b1'].map((x) => `${tag}-${x}`);
  const first = [acct(a1, { authorizationId: `auth-${tag}-L1` }), acct(a2, { authorizationId: `auth-${tag}-L1` }), acct(a3, { authorizationId: `auth-${tag}-L1` })];
  for (const [i, x] of [a1, a2, a3].entries()) v.rows.set(x, [...pair(x, 1, `S${i}A`), ...pair(x, 2, `S${i}B`)]);
  v.rows.set(b1, pair(b1, 1, 'BBB'));
  const closes = async () => (await sql`select count(*)::int as n from closed_trades where user_id = ${u.id}`)[0].n as number;
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    v.accounts = first;
    const { id: id1 } = await completeLink({ userId: u.id, attemptId: attempt }, deps) as { id: number };
    await consent(id1, new Date(), deps);
    assert.deepEqual(await ownerPoll(u.id, deps), { state: 'importing', imported: 4, closes: 0 }); // account 1 read
    // A second link lands on its consent page and waits: the poll still drives the running import and says importing.
    v.accounts = [...first, acct(b1, { authorizationId: `auth-${tag}-L2` })];
    const out = await completeLink({ userId: u.id, attemptId: attempt }, deps);
    assert.equal(out.kind, 'consent');
    const id2 = (out as { id: number }).id;
    assert.deepEqual(await ownerPoll(u.id, deps), { state: 'importing', imported: 8, closes: 0 }); // account 2 read; never 'pending'
    assert.equal((await conn(id1)).import_cursor.i, 2);
    // The trader consents to the second link, which then finishes on its own (what the old newest-row poll did).
    await consent(id2, new Date(), deps);
    assert.equal((await drive(id2, deps)).state, 'connected');
    assert.equal((await conn(id1)).state, 'importing');
    assert.equal(await closes(), 5); // accounts 1, 2 and the second link: a partial record exists in closed_trades ...
    assert.deepEqual(await publicRecord(u.id), { state: 'importing', paper: 0 }); // ... but is never presented as whole
    assert.deepEqual(await recordStatus(u.id), { state: 'importing', imported: 10, importing: [id1] });
    // The hourly tick finishes the first import: the whole record, connected.
    const t = await tick(deps);
    assert.ok(t.advanced >= 1);
    assert.equal((await conn(id1)).state, 'connected');
    assert.equal(await closes(), 7);
    assert.deepEqual(await publicRecord(u.id), { state: 'connected', paper: 0 });
    assert.deepEqual(await ownerPoll(u.id, deps), { state: 'connected', imported: 14, closes: 7 });
  } finally {
    await cleanup([u.id], [a1, a2, a3, b1]);
  }
});

dbTest('fix round 3: with a newer link still pending, the owner poll finishes the running import and reports it ("Import finished"), never pending; with only a pending link it answers none', async () => {
  const { sql, tag, mkUser, conn, cleanup } = await setup();
  const { startConnection, completeLink, consent, ownerPoll } = await import('./connections.ts');
  const { v, deps: base } = fakeVendor();
  const deps = { ...base, pageLimit: 10 };
  const u = await mkUser('r3p');
  const attempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const [a1, a2, b1] = ['pa1', 'pa2', 'pb1'].map((x) => `${tag}-${x}`);
  const first = [acct(a1, { authorizationId: `auth-${tag}-P1` }), acct(a2, { authorizationId: `auth-${tag}-P1` })];
  v.rows.set(a1, pair(a1, 1, 'PPA'));
  v.rows.set(a2, pair(a2, 1, 'PPB'));
  try {
    await startConnection({ userId: u.id, attemptId: attempt }, 'r', deps);
    v.accounts = first;
    const { id: id1 } = await completeLink({ userId: u.id, attemptId: attempt }, deps) as { id: number };
    assert.deepEqual(await ownerPoll(u.id, deps), { state: 'none', imported: 0, closes: 0 }); // only a pending link
    await consent(id1, new Date(), deps);
    assert.equal((await ownerPoll(u.id, deps)).state, 'importing');
    v.accounts = [...first, acct(b1, { authorizationId: `auth-${tag}-P2` })];
    const { id: id2 } = await completeLink({ userId: u.id, attemptId: attempt }, deps) as { id: number };
    const seen: string[] = [];
    let r = await ownerPoll(u.id, deps);
    for (let i = 0; i < 10 && r.state === 'importing'; i++) { seen.push(r.state); r = await ownerPoll(u.id, deps); }
    seen.push(r.state);
    assert.ok(!seen.includes('pending'), seen.join());
    assert.deepEqual(r, { state: 'connected', imported: 4, closes: 2 });
    assert.equal((await conn(id1)).state, 'connected');
    assert.equal((await conn(id2)).state, 'pending'); // untouched, still the trader's to decide
  } finally {
    await cleanup([u.id], [a1, a2, b1]);
  }
});

// Committee fixes (docs/features/logs/F-1/build-pr2a-fix4.md).
dbTest('committee fix 1 (High): a brokerage-first attempt is found only through its own signed cookie; an id presented without it is refused and counted with no personal data', async () => {
  const { sql, events } = await setup();
  const { createAttempt } = await import('./auth/attempts.ts');
  const { boundAttempt, refuseUnbound } = await import('./connections.ts');
  const secret = 'fake-committee-secret';
  const mine = await createAttempt({ method: 'brokerage', attested: true });
  const theirs = await createAttempt({ method: 'brokerage', attested: true });
  const email = await createAttempt({ method: 'email', attested: true });
  assert.equal(await boundAttempt(attemptCookieValue(mine, secret), secret), mine);
  assert.equal(await boundAttempt(undefined, secret), null);
  assert.equal(await boundAttempt(String(mine), secret), null); // an unsigned id
  assert.equal(await boundAttempt(`${mine}.forged`, secret), null);
  assert.equal(await boundAttempt(attemptCookieValue(mine, 'another-secret'), secret), null);
  assert.equal(await boundAttempt(attemptCookieValue(email, secret), secret), null); // not a brokerage attempt
  await sql`update signup_attempts set completed_at = now() where id = ${theirs}`;
  assert.equal(await boundAttempt(attemptCookieValue(theirs, secret), secret), null); // consumed
  await refuseUnbound(String(mine));
  const rows = await sql`select name, meta::text as meta from funnel_events where attempt_id = ${mine} and name = 'failed'`;
  assert.deepEqual(rows.map((r) => [r.name, JSON.parse(r.meta)]), [['failed', { reason: 'unbound' }]]);
  assert.doesNotMatch(JSON.stringify(rows), /@|\d{7,}/);
  // Unknown or malformed ids write nothing and never throw.
  const before = (await sql`select count(*)::int as n from funnel_events where meta->>'reason' = 'unbound' and attempt_id = ${mine}`)[0].n;
  for (const raw of ['999999999999', 'abc', '-1', '1.5', '', undefined]) await refuseUnbound(raw);
  assert.equal((await sql`select count(*)::int as n from funnel_events where meta->>'reason' = 'unbound' and attempt_id = ${mine}`)[0].n, before);
  assert.deepEqual(await events(theirs), ['landed', 'method_chosen', 'attested']);
});

dbTest('committee fix 1 (Low): a double tap on brokerage-first consent creates exactly one user; the vendor user moves once and is never copied back onto the attempt', async () => {
  const { sql, tag, conn, cleanup } = await setup();
  const { createAttempt } = await import('./auth/attempts.ts');
  const { startConnection, completeLink, consent, NotPendingError } = await import('./connections.ts');
  const { v, deps } = fakeVendor();
  const attempt = await createAttempt({ method: 'brokerage', attested: true });
  const acc = `${tag}-dt`;
  v.accounts = [acct(acc)];
  const mine = () => sql`select id, snaptrade_user_id from users where signup_attempt_id = ${attempt} or snaptrade_user_id = ${`vendor-attempt-${attempt}`}`;
  let ids: number[] = [];
  try {
    await startConnection({ userId: null, attemptId: attempt }, 'r', deps);
    const { id } = await completeLink({ userId: null, attemptId: attempt }, deps) as { id: number };
    const results = await Promise.allSettled([consent(id, new Date(), deps), consent(id, new Date(), deps)]);
    ids = (await mine()).map((u) => u.id as number);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.ok(lost.reason instanceof NotPendingError);
    const users = await mine();
    assert.equal(users.length, 1); // exactly one user
    assert.equal(users[0].snaptrade_user_id, `vendor-attempt-${attempt}`);
    const [a] = await sql`select user_id, completed_at, snaptrade_user_id, snaptrade_secret_enc from signup_attempts where id = ${attempt}`;
    assert.equal(a.user_id, users[0].id);
    assert.ok(a.completed_at);
    assert.deepEqual([a.snaptrade_user_id, a.snaptrade_secret_enc], [null, null]); // never copied back
    assert.equal((await conn(id)).state, 'importing');
    assert.deepEqual(v.deletedUsers, []);
  } finally {
    await cleanup(ids, [acc]);
  }
});

dbTest('committee fix 3 (Medium): after cleanup a declined or expired row keeps no account snapshot or institution (ids and timestamps stay); a declined brokerage-first attempt keeps no vendor user; an abandoned attempt is swept after 24 h', async () => {
  const { sql, tag, mkUser, conn, cleanup } = await setup();
  const { createAttempt } = await import('./auth/attempts.ts');
  const { startConnection, completeLink, decline, applyClocks, tick, cleanupAttempts } = await import('./connections.ts');
  const { v, deps } = fakeVendor();
  const u = await mkUser('ret');
  const userAttempt = Number((await sql`select signup_attempt_id from users where id = ${u.id}`)[0].signup_attempt_id);
  const a1 = `${tag}-ret1`, a2 = `${tag}-ret2`, a3 = `${tag}-ret3`;
  try {
    // Signed in, declined.
    v.accounts = [acct(a1)];
    await startConnection({ userId: u.id, attemptId: userAttempt }, 'r', deps);
    const d = await completeLink({ userId: u.id, attemptId: userAttempt }, deps) as { id: number };
    assert.equal((await conn(d.id)).accounts.length, 1);
    await decline(d.id, deps);
    const cd = await conn(d.id);
    assert.deepEqual([cd.state, cd.accounts, cd.institution], ['declined', [], null]);
    assert.ok(cd.cleanup_done_at && cd.declined_at && cd.pending_at);
    assert.equal(Number(cd.attempt_id), userAttempt);
    assert.equal(cd.user_id, u.id);
    // Signed in, expired, cleaned by the tick.
    const t0 = new Date('2026-10-22T10:00:00Z');
    v.accounts = [acct(a2)];
    const e = await completeLink({ userId: u.id, attemptId: userAttempt }, deps, t0) as { id: number };
    await applyClocks(new Date(t0.getTime() + 24 * 3_600_000), { id: e.id });
    v.accounts = [];
    await tick(deps, new Date(t0.getTime() + 25 * 3_600_000));
    const ce = await conn(e.id);
    assert.deepEqual([ce.state, ce.accounts, ce.institution], ['expired', [], null]);
    assert.ok(ce.cleanup_done_at && ce.expired_at);
    // Brokerage-first, declined: the vendor user is deleted with its link and no attempt row keeps it.
    const bf = await createAttempt({ method: 'brokerage', attested: true });
    v.accounts = [acct(a3)];
    await startConnection({ userId: null, attemptId: bf }, 'r', deps);
    const b = await completeLink({ userId: null, attemptId: bf }, deps) as { id: number };
    await decline(b.id, deps);
    const cb = await conn(b.id);
    assert.deepEqual([cb.accounts, cb.institution], [[], null]);
    assert.ok(v.deletedUsers.includes(`vendor-attempt-${bf}`));
    const [ab] = await sql`select snaptrade_user_id, snaptrade_secret_enc from signup_attempts where id = ${bf}`;
    assert.deepEqual([ab.snaptrade_user_id, ab.snaptrade_secret_enc], [null, null]);
    // Portal opened, never finished: kept while fresh (the portal may still be open), swept once 24 h old.
    const fresh = await createAttempt({ method: 'brokerage', attested: true });
    const old = await createAttempt({ method: 'brokerage', attested: true });
    await startConnection({ userId: null, attemptId: fresh }, 'r', deps);
    await startConnection({ userId: null, attemptId: old }, 'r', deps);
    await sql`update signup_attempts set created_at = now() - interval '25 hours' where id = ${old}`;
    await cleanupAttempts(deps);
    assert.ok(v.deletedUsers.includes(`vendor-attempt-${old}`));
    assert.ok(!v.deletedUsers.includes(`vendor-attempt-${fresh}`));
    assert.equal((await sql`select snaptrade_user_id from signup_attempts where id = ${old}`)[0].snaptrade_user_id, null);
    assert.equal((await sql`select snaptrade_user_id from signup_attempts where id = ${fresh}`)[0].snaptrade_user_id, `vendor-attempt-${fresh}`);
    // An old attempt whose link still waits on consent keeps its vendor user.
    const waiting = await createAttempt({ method: 'brokerage', attested: true });
    await startConnection({ userId: null, attemptId: waiting }, 'r', deps);
    v.accounts = [acct(`${tag}-ret4`)];
    await completeLink({ userId: null, attemptId: waiting }, deps);
    await sql`update signup_attempts set created_at = now() - interval '25 hours' where id = ${waiting}`;
    await cleanupAttempts(deps);
    assert.ok(!v.deletedUsers.includes(`vendor-attempt-${waiting}`));
    await sql`update signup_attempts set snaptrade_user_id = null, snaptrade_secret_enc = null where id in (${fresh}, ${waiting})`;
  } finally {
    await cleanup([u.id], [a1, a2, a3, `${tag}-ret4`]);
  }
});
