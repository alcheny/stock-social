// Known limit removed 2026-11-01: a vendor account id is per brokerage connection, so a fresh connection of the same
// brokerage account got a new id and dodged the TR-6 claim. The claim now also holds a stable account identity
// (lib/claims.ts#accountIdentity). These tests feed `institutionAccountId` the way lib/broker.ts#listAccounts will once
// the owner passes the vendor's `institution_account_id` through (that file is protected).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accountIdentity, normalizeInstitution, resetIdentityKey } from './claims.ts';
import type { VendorAccount } from './broker.ts';

process.env.APP_SECRET_KEY ||= 'test-only-identity-key';

test('normalizeInstitution: case, outer and inner whitespace, compatibility forms', () => {
  assert.equal(normalizeInstitution('  Fake   Brokerage\t'), 'fake brokerage');
  assert.equal(normalizeInstitution('FAKE BROKERAGE'), normalizeInstitution('fake brokerage'));
  assert.equal(normalizeInstitution('Ｆａｋｅ'), 'fake'); // full-width letters (NFKC)
});

test('accountIdentity: null without an institution account id; stable; per institution; never the raw id', () => {
  assert.equal(accountIdentity({ institution: 'Fake Brokerage' }), null);
  assert.equal(accountIdentity({ institution: 'Fake Brokerage', institutionAccountId: null }), null);
  assert.equal(accountIdentity({ institution: 'Fake Brokerage', institutionAccountId: '   ' }), null);
  const raw = '12345678';
  const k = accountIdentity({ institution: 'Fake Brokerage', institutionAccountId: raw })!;
  assert.match(k, /^[A-Za-z0-9_-]{43}$/); // 32 bytes, base64url
  assert.ok(!k.includes(raw));
  assert.equal(accountIdentity({ institution: ' fake  brokerage ', institutionAccountId: ` ${raw} ` }), k);
  assert.notEqual(accountIdentity({ institution: 'Other Brokerage', institutionAccountId: raw }), k, 'unique within an institution only');
  assert.notEqual(accountIdentity({ institution: 'Fake Brokerage', institutionAccountId: '12345679' }), k);
  // Keyed: another APP_SECRET_KEY gives another hash (a guessed account number can't be checked without the key).
  const before = process.env.APP_SECRET_KEY;
  try {
    process.env.APP_SECRET_KEY = `${before}-other`;
    resetIdentityKey();
    assert.notEqual(accountIdentity({ institution: 'Fake Brokerage', institutionAccountId: raw }), k);
  } finally {
    process.env.APP_SECRET_KEY = before;
    resetIdentityKey();
  }
});

test('schema: the identity is an additive column with an index, never unique', () => {
  const s = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  assert.match(s, /schema_add_column\('broker_accounts', 'identity', 'text'\)/);
  assert.match(s, /create index broker_accounts_identity on broker_accounts \(identity\)/);
  assert.doesNotMatch(s, /unique index broker_accounts_identity/);
});

// DB-backed: DATABASE_URL with db/schema.sql applied; skipped otherwise.
const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => {
  if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
});
after(async () => {
  if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 });
});

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `ci${Math.random().toString(36).slice(2, 10)}`;
  const mkUser = async (n: string) => createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` });
  const users: number[] = [];
  const accounts: string[] = [];
  const cleanup = async () => {
    if (users.length) await sql`delete from users where id in ${sql(users)}`;
    if (accounts.length) await sql`delete from broker_accounts where account_id in ${sql(accounts)}`;
  };
  return { sql, tag, mkUser, users, accounts, cleanup };
}

// A vendor account as listAccounts returns it once the institution account id is passed through.
const vendorAcct = (id: string, instId: string | null, o: Partial<VendorAccount> = {}) =>
  ({ id, authorizationId: `auth-${id}`, institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true, institutionAccountId: instId, ...o }) as VendorAccount;

dbTest('the dodge: the same brokerage account under a new vendor id is refused for another profile; nothing is claimed', async () => {
  const { sql, tag, mkUser, users, accounts, cleanup } = await setup();
  const { claimIn } = await import('./claims.ts');
  const now = new Date();
  try {
    const a = await mkUser('a'), b = await mkUser('b');
    users.push(a.id, b.id);
    const v1 = `${tag}-v1`, v2 = `${tag}-v2`, free = `${tag}-free`;
    accounts.push(v1, v2, free);
    const inst = `${tag}-0001`;
    assert.deepEqual(await sql.begin((tx) => claimIn(tx, a.id, [vendorAcct(v1, inst)], { confirmed: true, now })), { ok: true });
    // B links the same brokerage account through a fresh connection (new vendor id v2), with a free account beside it.
    const ROLLBACK = new Error('rollback');
    let r: Awaited<ReturnType<typeof claimIn>> | undefined;
    await assert.rejects(sql.begin(async (tx) => {
      r = await claimIn(tx, b.id, [vendorAcct(v2, inst), vendorAcct(free, `${tag}-0002`)], { confirmed: true, now });
      throw ROLLBACK; // callers roll back on any conflict
    }), (e) => e === ROLLBACK);
    assert.deepEqual(r, { ok: false, conflicts: [v2] });
    assert.equal((await sql`select 1 from broker_accounts where user_id = ${b.id}`).length, 0, 'B claims nothing');
    // Identity in another letter case or spacing of the institution name: still the same account.
    let r2: Awaited<ReturnType<typeof claimIn>> | undefined;
    await assert.rejects(sql.begin(async (tx) => {
      r2 = await claimIn(tx, b.id, [vendorAcct(v2, ` ${inst} `, { institution: 'FAKE  BROKERAGE' })], { confirmed: false, now });
      throw ROLLBACK;
    }), (e) => e === ROLLBACK);
    assert.equal(r2!.ok, false);
    // The raw institution account id is stored nowhere.
    const [{ n }] = await sql`select count(*)::int as n from broker_accounts where identity = ${inst} or account_id = ${inst}`;
    assert.equal(n, 0);
  } finally {
    await cleanup();
  }
});

dbTest('the same profile reconnecting (new vendor id, same identity) is allowed; no identity keeps the vendor-id rule alone', async () => {
  const { sql, tag, mkUser, users, accounts, cleanup } = await setup();
  const { claimIn, accountIdentity: ident } = await import('./claims.ts');
  const now = new Date();
  try {
    const a = await mkUser('a'), b = await mkUser('b');
    users.push(a.id, b.id);
    const v1 = `${tag}-v1`, v2 = `${tag}-v2`, n1 = `${tag}-n1`, n2 = `${tag}-n2`;
    accounts.push(v1, v2, n1, n2);
    const inst = `${tag}-0001`;
    assert.deepEqual(await sql.begin((tx) => claimIn(tx, a.id, [vendorAcct(v1, inst)], { confirmed: true, now })), { ok: true });
    assert.deepEqual(await sql.begin((tx) => claimIn(tx, a.id, [vendorAcct(v2, inst)], { confirmed: true, now })), { ok: true });
    const rows = await sql`select account_id, identity from broker_accounts where user_id = ${a.id} order by account_id`;
    assert.deepEqual(rows.map((x) => x.account_id), [v1, v2]);
    assert.ok(rows.every((x) => x.identity === ident({ institution: 'Fake Brokerage', institutionAccountId: inst })));
    // Re-claiming without an identity (a vendor that stopped sending it) keeps the stored one.
    assert.deepEqual(await sql.begin((tx) => claimIn(tx, a.id, [vendorAcct(v1, null)], { confirmed: true, now })), { ok: true });
    assert.notEqual((await sql`select identity from broker_accounts where account_id = ${v1}`)[0].identity, null);
    // Accounts with no institution account id: two profiles, two vendor ids, as before (nothing to compare).
    assert.deepEqual(await sql.begin((tx) => claimIn(tx, a.id, [vendorAcct(n1, null)], { confirmed: true, now })), { ok: true });
    assert.deepEqual(await sql.begin((tx) => claimIn(tx, b.id, [vendorAcct(n2, null)], { confirmed: true, now })), { ok: true });
  } finally {
    await cleanup();
  }
});

dbTest('two profiles racing on one brokerage account under two vendor ids: exactly one wins', async () => {
  const { sql, tag, mkUser, users, accounts, cleanup } = await setup();
  const { claimIn } = await import('./claims.ts');
  const now = new Date();
  try {
    for (let round = 0; round < 5; round++) {
      const a = await mkUser(`a${round}`), b = await mkUser(`b${round}`);
      users.push(a.id, b.id);
      const va = `${tag}-${round}-a`, vb = `${tag}-${round}-b`, inst = `${tag}-${round}`;
      accounts.push(va, vb);
      const claim = (u: number, v: string) => sql.begin(async (tx) => {
        const r = await claimIn(tx, u, [vendorAcct(v, inst)], { confirmed: true, now });
        if (!r.ok) throw new Error('conflict');
        return r;
      }).then(() => 'ok', (e: Error) => e.message);
      const results = await Promise.all([claim(a.id, va), claim(b.id, vb)]);
      assert.deepEqual(results.sort(), ['conflict', 'ok'], `round ${round}`);
      const [{ owners }] = await sql`select count(distinct user_id)::int as owners from broker_accounts where account_id in (${va}, ${vb})`;
      assert.equal(owners, 1);
    }
  } finally {
    await cleanup();
  }
});

dbTest('connect flow: a fresh link of an owned brokerage account is refused before any claim, signed in or brokerage-first', async () => {
  const { sql, tag, mkUser, users, accounts, cleanup } = await setup();
  const { startConnection, completeLink, consent } = await import('./connections.ts');
  const { createAttempt } = await import('./auth/attempts.ts');
  const deleted: string[] = [];
  const vendor = (list: VendorAccount[]) => ({
    registerUser: async (ref: number | string) => ({ snaptradeUserId: `vendor-${ref}`, secretEnc: 'enc' }),
    connectUrl: async () => 'https://vendor.example/portal',
    listAccounts: async () => list,
    fetchActivitiesPage: async () => ({ activities: [], done: true }),
    fetchPositions: async () => [],
    deleteConnection: async (_u: unknown, id: string) => { deleted.push(id); },
    deleteUser: async () => {},
  });
  try {
    const owner = await mkUser('o'), other = await mkUser('x');
    users.push(owner.id, other.id);
    const att = async (id: number) => Number((await sql`select signup_attempt_id from users where id = ${id}`)[0].signup_attempt_id);
    const v1 = `${tag}-v1`, v2 = `${tag}-v2`, v3 = `${tag}-v3`, inst = `${tag}-0001`;
    accounts.push(v1, v2, v3);
    // The owner links and consents: the claim (vendor id v1) carries the identity.
    const d1 = vendor([vendorAcct(v1, inst)]);
    await startConnection({ userId: owner.id, attemptId: await att(owner.id) }, 'r', d1);
    const linked = await completeLink({ userId: owner.id, attemptId: await att(owner.id) }, d1);
    assert.equal(linked.kind, 'consent');
    await consent((linked as { id: number }).id, new Date(), d1);
    assert.notEqual((await sql`select identity from broker_accounts where account_id = ${v1}`)[0].identity, null);
    // Another signed-in profile links the same brokerage account through a fresh connection (vendor id v2): refused.
    const d2 = vendor([vendorAcct(v2, inst, { authorizationId: 'auth-fresh' })]);
    await startConnection({ userId: other.id, attemptId: await att(other.id) }, 'r', d2);
    assert.equal((await completeLink({ userId: other.id, attemptId: await att(other.id) }, d2)).kind, 'refused');
    assert.ok(deleted.includes('auth-fresh'), 'the link is removed at the vendor');
    assert.equal((await sql`select 1 from broker_accounts where account_id = ${v2}`).length, 0);
    // Brokerage-first (no profile yet), the same account under vendor id v3 beside an account nobody owns: refused (it
    // is not wholly the owner's to sign in to, and no new profile may take the owned account).
    const attempt = await createAttempt({ method: 'brokerage', attested: true });
    accounts.push(`${tag}-free`);
    const d3 = vendor([vendorAcct(v3, inst, { authorizationId: 'auth-first' }), vendorAcct(`${tag}-free`, null, { authorizationId: 'auth-first' })]);
    await startConnection({ userId: null, attemptId: attempt }, 'r', d3);
    assert.equal((await completeLink({ userId: null, attemptId: attempt }, d3)).kind, 'refused');
    assert.equal((await sql`select 1 from broker_accounts where account_id in (${v3}, ${`${tag}-free`})`).length, 0);
    assert.equal((await sql`select user_id from signup_attempts where id = ${attempt}`)[0].user_id, null);
    // The owner, signed out, linking the same account under a new vendor id (brokerage-first) signs in to their profile.
    const attempt2 = await createAttempt({ method: 'brokerage', attested: true });
    const d5 = vendor([vendorAcct(`${tag}-v5`, inst, { authorizationId: 'auth-back' })]);
    accounts.push(`${tag}-v5`);
    await startConnection({ userId: null, attemptId: attempt2 }, 'r', d5);
    const back = await completeLink({ userId: null, attemptId: attempt2 }, d5);
    assert.equal(back.kind, 'signin');
    assert.equal((back as { userId: number }).userId, owner.id);
    assert.equal((await sql`select 1 from broker_accounts where account_id = ${`${tag}-v5`}`).length, 0); // nothing new claimed
    // The owner reconnecting the same account under a new vendor id, signed in, is not refused.
    const d4 = vendor([vendorAcct(`${tag}-v4`, inst, { authorizationId: 'auth-again' })]);
    accounts.push(`${tag}-v4`);
    await startConnection({ userId: owner.id, attemptId: await att(owner.id) }, 'r', d4);
    assert.equal((await completeLink({ userId: owner.id, attemptId: await att(owner.id) }, d4)).kind, 'consent');
  } finally {
    await cleanup();
  }
});
