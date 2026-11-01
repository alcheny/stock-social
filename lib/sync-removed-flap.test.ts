// Fixes-labels review of PR #85 (B1): a vendor account list that flaps (a short list, then the full one again) never
// freezes a live record. "record frozen" comes from connections.disconnected_at alone (F3-3's two-list confirmed
// disconnect); a short list only marks the missing account's row "removed", and the next list that names the account
// again clears its removed_at (lib/sync.ts#syncUser). Committee decision: docs/features/logs/fixes-labels/
// committee-2026-11-01.md, "2026-11-01: PR #85 review B1". The vendor is the same in-process broker fake the other
// sync-removed tests use. Every fixture is this file's own (a unique tag); nothing counts rows it did not create.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { statusParts, type StatusConnection, type StatusFacts, type Part } from './record-status.ts';
import { STATUS_LINE as S } from './copy.ts';
import { dateText } from './date-text.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const DAY = 86_400_000, HOUR = 3_600_000;
const FROZEN = /record frozen|frozen|Disconnected/i;
type VAcc = { id: string; authorizationId: string; institution: string; isPaper: boolean; initialSyncCompleted: boolean };
const vacc = (id: string, isPaper = false): VAcc => ({ id, authorizationId: 'a', institution: 'Fake Brokerage', isPaper, initialSyncCompleted: true });
const text = (ps: Part[]) => ps.map((p) => p.text).join(' · ');

async function setup(real: string[], paper: string[] = []) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `fl${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  await sql`update users set snaptrade_user_id = ${`${tag}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  const user = { id: u.id, snaptrade_user_id: `${tag}-vendor`, snaptrade_secret_enc: 'enc' };
  const ids = real.map((a) => `${tag}-${a}`), paperIds = paper.map((a) => `${tag}-${a}`);
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', ${new Date(Date.now() - 60 * DAY)}, now(), now(), ${sql.json([...ids.map((id) => vacc(id)), ...paperIds.map((id) => vacc(id, true))])}
    from users where id = ${u.id}`;
  // One closed trade on the first real account (a buy and a sell long before the flap), so the record has a status line.
  // Every real account has a buy (the plain "Connected:" line counts the accounts with activities).
  const act = (n: string, side: 'BUY' | 'SELL', price: number, at: Date, account = ids[0]) => ({ user_id: u.id, source: 'snaptrade', external_id: `${tag}-${n}`, account_id: account,
    symbol: 'AAA', side, units: 1, price, fee: 0, executed_at: at, raw: sql.json({}) });
  await sql`insert into activities ${sql([act('b', 'BUY', 10, new Date(Date.now() - 100 * DAY)), act('s', 'SELL', 11, new Date(Date.now() - 99 * DAY)),
    ...ids.slice(1).map((id, i) => act(`o${i}`, 'BUY', 10, new Date(Date.now() - 98 * DAY), id))])}`;
  const broker = (listed: VAcc[]) => ({ listAccounts: async () => listed, fetchActivities: async () => [] });
  const removed = async () => Object.fromEntries((await sql`select account_id, removed_at from broker_accounts where user_id = ${u.id}`)
    .map((r) => [r.account_id as string, (r.removed_at as Date | null)?.getTime() ?? null]));
  const status = async () => {
    const { statusFor } = await import('./record-status-load.ts');
    return (await statusFor(u.id, 'connected'))!;
  };
  const disconnected = async () => (await sql`select disconnected_at from connections where user_id = ${u.id}`)[0].disconnected_at as Date | null;
  return { user, ids, paperIds, broker, removed, status, disconnected, uid: u.id as number,
    cleanup: async () => { await sql`delete from users where id = ${u.id}`; await sql`delete from broker_accounts where account_id in ${sql([...ids, ...paperIds])}`; } };
}

// The live line on every surface of a record whose connection has no disconnected_at: never frozen, "updated" shown.
function assertLive(f: StatusFacts, label: string) {
  for (const mode of ['live', 'static'] as const) {
    const l = statusParts(f, new Date(), mode);
    assert.equal(l.show, true, label);
    assert.equal(l.frozen, null, `${label} ${mode}`);
    const all = [l.line1, l.line2, l.accounts, l.card].map(text).join(' | ');
    assert.doesNotMatch(all, FROZEN, `${label} ${mode}: ${all}`);
    assert.match(text(l.line2), /updated /, `${label} ${mode}: the live "updated" part`);
  }
  return statusParts(f, new Date(), 'live');
}

dbTest('B1 repro 1: two accounts listed as both, then a1 only, then a2 only, then both: never frozen, "updated" shown throughout, and no account reads removed at the end', async () => {
  const { syncUser } = await import('./sync.ts');
  const h = await setup(['a1', 'a2']);
  try {
    const [a1, a2] = h.ids;
    const base = Date.now();
    const t = (hoursAgo: number) => new Date(base - hoursAgo * HOUR);
    await syncUser(h.user, h.broker([vacc(a1), vacc(a2)]), undefined, t(4));
    assertLive(await h.status(), 'both');
    await syncUser(h.user, h.broker([vacc(a1)]), undefined, t(3));
    assert.deepEqual(await h.removed(), { [a1]: null, [a2]: t(3).getTime() });
    let l = assertLive(await h.status(), 'a1 only');
    assert.equal(l.accounts.map((p) => p.text).join(' | '), `Account 1 of 2 · Fake Brokerage | Account 2 of 2 removed ${dateText(t(3), new Date(), { year: 'always' })}`);
    // a2 listed again: its stamp is cleared; a1 is now the missing one.
    await syncUser(h.user, h.broker([vacc(a2)]), undefined, t(2));
    assert.deepEqual(await h.removed(), { [a1]: t(2).getTime(), [a2]: null });
    l = assertLive(await h.status(), 'a2 only');
    assert.match(text(l.line1), /Connected: Fake Brokerage \(1 account\)$/);
    // Both again: nothing reads removed, and the line is the plain live one.
    await syncUser(h.user, h.broker([vacc(a1), vacc(a2)]), undefined, t(1));
    assert.deepEqual(await h.removed(), { [a1]: null, [a2]: null });
    l = assertLive(await h.status(), 'both again');
    assert.match(text(l.line1), /^Record since .+ · Connected: Fake Brokerage \(2 accounts\)$/);
    assert.deepEqual(l.accounts.map((p) => p.text), ['Account 1 of 2 · Fake Brokerage', 'Account 2 of 2 · Fake Brokerage']);
    assert.equal(await h.disconnected(), null);
  } finally {
    await h.cleanup();
  }
});

dbTest('B1 repro 2: one real and one simulated account, a single list with only the simulated one: "No account connected since" with "updated", never frozen; the next full list clears it', async () => {
  const { syncUser } = await import('./sync.ts');
  const h = await setup(['r1'], ['p1']);
  try {
    const [r1] = h.ids, [p1] = h.paperIds;
    const t1 = new Date(Date.now() - 2 * HOUR), t2 = new Date(Date.now() - HOUR);
    await syncUser(h.user, h.broker([vacc(r1), vacc(p1, true)]), undefined, new Date(Date.now() - 3 * HOUR));
    await syncUser(h.user, h.broker([vacc(p1, true)]), undefined, t1);
    assert.equal((await h.removed())[r1], t1.getTime());
    const l = assertLive(await h.status(), 'simulated only');
    const d = dateText(t1, new Date(), { year: 'always' });
    assert.match(text(l.line1), new RegExp(`^Record since .+ · ${S.allRemoved(d)}$`));
    assert.doesNotMatch(text(l.line1), /Connected:|\(0 accounts?\)/);
    assert.deepEqual(l.accounts.map((p) => p.text), [`Account removed ${d}`]);
    assert.equal(await h.disconnected(), null);
    await syncUser(h.user, h.broker([vacc(r1), vacc(p1, true)]), undefined, t2);
    assert.equal((await h.removed())[r1], null);
    const back = assertLive(await h.status(), 'listed again');
    assert.match(text(back.line1), /Connected: Fake Brokerage \(1 account\)$/);
    assert.deepEqual(back.accounts, []);
  } finally {
    await h.cleanup();
  }
});

// Pure: the copy and the partly disconnected record's account rows (review nit 2).
const NOW = new Date('2026-11-01T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const acct = (id: string, removedAt: Date | null = null) => ({ id, isPaper: false, removedAt, institution: 'Fake Brokerage' });
const conn = (id: number, accounts: StatusConnection['accounts'], disconnectedAt: Date | null = null): StatusConnection =>
  ({ id, consentAt: ago(400 * DAY), disconnectedAt, institution: 'Fake Brokerage', accounts });
const facts = (extra: Partial<StatusFacts>): StatusFacts => ({
  source: 'broker', state: 'connected', firstEntry: new Date('2026-01-05T15:00:00Z'), lastClose: ago(3 * DAY), lastSyncedAt: ago(2 * HOUR),
  brokers: ['Fake Brokerage'], accounts: 2, connections: [conn(1, [acct('a1')])], ...extra,
});

test('B1 (b): the all-removed words carry no "frozen"; only a disconnect says "record frozen"', () => {
  assert.equal(S.allRemoved('Oct 28, 2026'), 'No account connected since Oct 28, 2026');
  assert.doesNotMatch(S.allRemoved('x'), /frozen/i);
  assert.match(S.frozen('x'), /record frozen/);
});

test('nit 2: a partly disconnected record marks the disconnected connection\'s account rows "disconnected" with its date', () => {
  const d = ago(5 * DAY), r = ago(9 * DAY);
  const l = statusParts(facts({ accounts: 3, connections: [conn(1, [acct('a1')]), conn(2, [acct('b1'), acct('b2', r)], d)] }), NOW, 'live');
  assert.equal(l.frozen, null);
  const ds = dateText(d, NOW, { year: 'always' }), rs = dateText(r, NOW, { year: 'always' });
  assert.deepEqual(l.accounts.map((p) => p.text), ['Account 1 of 3 · Fake Brokerage', `Account 2 of 3 disconnected ${ds}`, `Account 3 of 3 removed ${rs}`]);
  assert.equal(l.accounts[1].time?.iso, d.toISOString());
  // Not partly disconnected: rows unchanged.
  const live = statusParts(facts({ connections: [conn(1, [acct('a1')]), conn(2, [acct('b1')])] }), NOW, 'live');
  assert.deepEqual(live.accounts.map((p) => p.text), ['Account 1 of 2 · Fake Brokerage', 'Account 2 of 2 · Fake Brokerage']);
});

test('nit 2 and B1 (b): every live account removed and the other connection disconnected: not frozen, the live line with both facts', () => {
  const d = ago(20 * DAY), r = ago(4 * DAY);
  const f = facts({ connections: [conn(1, [acct('a1')], d), conn(2, [acct('b1', r)])] });
  const l = statusParts(f, NOW, 'live');
  assert.equal(l.frozen, null);
  assert.equal(text(l.line1), `Record since Jan 5, 2026 · ${S.allRemoved(dateText(r, NOW, { year: 'always' }))} · Fake Brokerage disconnected ${dateText(d, NOW, { year: 'always' })}`);
  assert.match(text(l.line2), /updated 2 hours ago$/);
  assert.deepEqual(l.accounts.map((p) => p.text), [`Account 1 of 2 disconnected ${dateText(d, NOW, { year: 'always' })}`, `Account 2 of 2 removed ${dateText(r, NOW, { year: 'always' })}`]);
});

test('nits 3-5: the ticker page dates in UTC (dateText), the trade page has no statement between its imports, the profile reads the status beside its load', () => {
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const ticker = src('app/t/[symbol]/page.tsx');
  assert.doesNotMatch(ticker, /toLocaleDateString\(/);
  assert.match(ticker, /dateText\(/);
  const trade = src('app/u/[handle]/trade/[sellId]/page.tsx').split('\n');
  const lastImport = trade.findLastIndex((l) => /^import /.test(l));
  const fl = trade.findIndex((l) => /^const FL_THESIS/.test(l));
  assert.ok(fl > lastImport, 'FL_THESIS is declared after the last import');
  const profile = src('app/u/[handle]/page.tsx');
  assert.match(profile, /statusRowP = [^;]*statusRowsOrEmpty\(/s);
  assert.match(profile, /Promise\.all\(\[load\(handleParam\), statusRowP\]\)/);
});
