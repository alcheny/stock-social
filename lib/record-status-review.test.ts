// FIXES-LABELS (code review): the status line's loader degrades and re-reads honestly.
// - item 5: a failed status read leaves the line out (an empty map), logged as counts only, never failing the feed.
// - item 9: an account removed and later listed again (a trade on it after the removal) no longer reads "Account removed".
// - item 11 (C3-5): a record none of whose connections carries disconnected_at always gets the live line, never
//   "Disconnected" or "record frozen", also after an idle period, with a removed account and with every account
//   removed (PR #85 review B1 restores this pin: QA round 2's N7 had frozen an all-removed record; it now reads "No
//   account connected since ‹date›" with the live line 2, and only disconnected_at freezes).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { statusRowsOrEmpty, type StatusRow } from './record-status-load.ts';
import { statusParts, paneSegments, recordSegments, cardSegments, timeText, type StatusConnection, type StatusFacts } from './record-status.ts';
import { connectedLine } from './copy.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const DAY = 86_400_000;
const NOW = new Date('2026-11-01T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

test('item 5: a rejected status read is an empty map; the log line carries a count and the error class only', async () => {
  const calls: unknown[][] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { calls.push(a); };
  try {
    const secret = Object.assign(new Error('connection to host db.internal for user trader@example.com failed'), { code: '08006' });
    const got = await statusRowsOrEmpty([7, 8, 9], async () => { throw secret; });
    assert.ok(got instanceof Map);
    assert.equal(got.size, 0);
    // A loader that throws synchronously is caught too.
    assert.equal((await statusRowsOrEmpty([1], () => { throw new TypeError('x'); })).size, 0);
  } finally { console.error = orig; }
  assert.equal(calls.length, 2);
  const line = calls[0].map(String).join(' ');
  assert.match(line, /"traders":3/);
  assert.match(line, /Error code 08006/);
  assert.doesNotMatch(line, /example\.com|db\.internal|\b7\b|\b8\b|\b9\b/);
  // A good read passes through untouched.
  const ok = new Map<number, StatusRow>([[1, { source: 'none', firstEntry: null, lastClose: null, lastSyncedAt: null, brokers: [], accounts: 0, connections: [] }]]);
  assert.equal(await statusRowsOrEmpty([1], async () => ok), ok);
});

test('item 5: the feed reads the status through the safe wrapper', () => {
  const src = readFileSync(new URL('./feed.ts', import.meta.url), 'utf8');
  assert.match(src, /statusRowsOrEmpty\(/);
  assert.doesNotMatch(src, /[^y]statusRows\(/);
});

// ---- item 11 ----
const acct = (id: string, removedAt: Date | null = null) => ({ id, isPaper: false, removedAt, institution: 'Fake Brokerage' });
const conn = (id: number, accounts: StatusConnection['accounts']): StatusConnection => ({ id, consentAt: ago(400 * DAY), disconnectedAt: null, institution: 'Fake Brokerage', accounts });
const facts = (extra: Partial<StatusFacts>): StatusFacts => ({
  source: 'broker', state: 'connected', firstEntry: ago(300 * DAY), lastClose: ago(40 * DAY), lastSyncedAt: ago(2 * 3_600_000),
  brokers: ['Fake Brokerage'], accounts: 2, connections: [conn(1, [acct('a1'), acct('a2')])], ...extra,
});
const FROZEN = /Disconnected|record frozen|frozen/i;

test('item 11: no disconnected_at on any connection → the live line, never frozen: fresh, idle, never synced, a removed account, every account removed, two connections', () => {
  const cases: [string, StatusFacts][] = [
    ['fresh', facts({})],
    ['idle 45 days', facts({ lastSyncedAt: ago(45 * DAY) })],
    ['idle a year', facts({ lastSyncedAt: ago(365 * DAY) })],
    ['never synced, consent 400 days ago', facts({ lastSyncedAt: null })],
    ['one of two accounts removed', facts({ connections: [conn(1, [acct('a1'), acct('a2', ago(10 * DAY))])] })],
    ['the only account removed', facts({ accounts: 1, connections: [conn(1, [acct('a1', ago(10 * DAY))])] })],
    ['removed and idle', facts({ lastSyncedAt: ago(60 * DAY), accounts: 1, connections: [conn(1, [acct('a1', ago(50 * DAY))])] })],
    ['two connections, all accounts removed', facts({ connections: [conn(1, [acct('a1', ago(5 * DAY))]), conn(2, [acct('b1', ago(4 * DAY))])] })],
    ['two connections, one account removed', facts({ connections: [conn(1, [acct('a1', ago(5 * DAY))]), conn(2, [acct('b1')])] })],
    ['a real account removed beside a simulated one', facts({ accounts: 1, connections: [conn(1, [acct('a1', ago(3 * DAY)), { ...acct('p1'), isPaper: true }])] })],
  ];
  for (const [label, f] of cases) {
    for (const mode of ['live', 'static'] as const) {
      const l = statusParts(f, NOW, mode);
      assert.equal(l.show, true, label);
      assert.equal(l.frozen, null, label);
      // The live Connected line, counting the accounts not removed (QA round 1, finding 6); none left: "No account
      // connected since ‹date›" in its place, never "(0 accounts)".
      const live = f.connections.flatMap((c) => c.accounts).filter((x) => !x.isPaper && !x.removedAt).length;
      const removedAny = f.connections.some((c) => c.accounts.some((x) => x.removedAt));
      if (!removedAny) assert.equal(l.line1[1].text, connectedLine(f.brokers, f.accounts), `${label} ${mode}: line 1 is the live Connected line`);
      else if (live) assert.equal(l.line1[1].text, connectedLine(['Fake Brokerage'], live), `${label} ${mode}: live accounts counted`);
      else assert.match(l.line1[1].text, /^No account connected since [A-Z][a-z]{2} \d{1,2}, \d{4}$/, `${label} ${mode}: no account left`);
      // Line 2 is the live one: "updated" when synced and not idle, the idle fact when idle.
      if (l.idle) assert.match(l.line2.map((p) => p.text).join(' · '), /not updated since /, `${label} ${mode}`);
      else if (f.lastSyncedAt) assert.match(l.line2.map((p) => p.text).join(' · '), /updated /, `${label} ${mode}`);
      for (const part of [...l.line1, ...l.line2, ...l.accounts, ...l.card]) assert.doesNotMatch(part.text, FROZEN, `${label} ${mode}: ${part.text}`);
    }
    for (const segs of [paneSegments(f, NOW), recordSegments(f, NOW), cardSegments(f, NOW)]) {
      assert.doesNotMatch((segs ?? []).map((s) => s.text).join(''), FROZEN, label);
    }
  }
  // An idle record still says it is idle (and the removed account still says removed), without freezing.
  const idle = statusParts(cases[1][1], NOW, 'live');
  assert.equal(idle.idle, true);
  assert.ok(idle.card.length > 0);
  assert.match(statusParts(cases[4][1], NOW, 'live').accounts.map((p) => p.text).join(' | '), /Account 2 of 2 removed /);
  assert.match(statusParts(cases[5][1], NOW, 'live').accounts.map((p) => p.text).join(' | '), /^Account removed /);
});

// ---- item 9 ----
dbTest('item 9: "Account removed" is left out once a trade on that account executed after the removal; removed_at stays', async () => {
  const { sql } = await import('./db.ts');
  const { statusFacts } = await import('./record-status-load.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `rv${Math.random().toString(36).slice(2, 9)}`;
  const u = (await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` })).id;
  const ids = [`${tag}-1`, `${tag}-2`, `${tag}-3`];
  const removed = new Date(Date.now() - 10 * DAY);
  try {
    const accounts = ids.map((id) => ({ id, authorizationId: 'a', institution: 'Fake Brokerage', isPaper: false, initialSyncCompleted: true }));
    await sql`insert into connections (attempt_id, user_id, state, consent_at, connected_at, institution, accounts)
      select signup_attempt_id, id, 'connected', ${new Date(Date.now() - 60 * DAY)}, now(), 'Fake Brokerage', ${sql.json(accounts)} from users where id = ${u}`;
    await sql`insert into broker_accounts ${sql(ids.map((id) => ({ account_id: id, user_id: u, confirmed_at: new Date(), removed_at: id === ids[0] ? null : removed })))}`;
    const act = (account: string, n: string, at: Date) => ({ user_id: u, source: 'snaptrade', external_id: `${tag}-${n}`, account_id: account,
      symbol: 'AAA', side: 'BUY', units: 1, price: 1, fee: 0, executed_at: at, raw: sql.json({}) });
    // Account 2: a trade before its removal only (still removed). Account 3: a trade after it (listed again).
    await sql`insert into activities ${sql([act(ids[0], 'a', new Date(Date.now() - 30 * DAY)), act(ids[1], 'b', new Date(Date.now() - 20 * DAY)), act(ids[2], 'c', new Date(Date.now() - 2 * DAY))])}`;
    const f = (await statusFacts([u], new Map([[u, { state: 'connected' as const }]]))).get(u)!;
    assert.deepEqual(f.connections[0].accounts.map((a) => [a.id, a.removedAt?.getTime() ?? null]), [[ids[0], null], [ids[1], removed.getTime()], [ids[2], null]]);
    const l = statusParts({ ...f, firstEntry: new Date(Date.now() - 30 * DAY) }, new Date(), 'live');
    assert.deepEqual(l.accounts.map((p) => p.text.replace(/removed .*/, 'removed')), ['Account 1 of 3 · Fake Brokerage', 'Account 2 of 3 removed', 'Account 3 of 3 · Fake Brokerage']);
    // Display only: the stored stamp is unchanged.
    const [row] = await sql`select removed_at from broker_accounts where account_id = ${ids[2]}`;
    assert.equal((row.removed_at as Date).getTime(), removed.getTime());
  } finally {
    await sql`delete from users where id = ${u}`;
    await sql`delete from broker_accounts where account_id like ${`${tag}-%`}`;
  }
});

test('QA round 1 (finding 6): a removed account leaves the Connected count; (finding 9) a relative time shows its date', () => {
  const two = statusParts(facts({ accounts: 2, connections: [conn(1, [acct('a1'), acct('a2', ago(3 * DAY))])] }), NOW, 'live');
  assert.equal(two.line1[1].text, 'Connected: Fake Brokerage (1 account)');
  const one = statusParts(facts({ accounts: 1, connections: [conn(1, [acct('a1', ago(3 * DAY))])] }), NOW, 'live');
  // With the only account removed nothing is connected (QA round 2, N7), and the record is not frozen (PR #85 review B1).
  assert.equal(one.line1.map((p) => p.text).join(' · '), 'Record since Jan 5, 2026 · No account connected since Oct 29, 2026');
  assert.equal(one.frozen, null);
  assert.match(one.line2.map((p) => p.text).join(' · '), /updated 2 hours ago$/);
  assert.match(one.accounts[0].text, /^Account removed /);
  // No removal: today's exact line (the vendor's institutions and the profile's account count).
  assert.equal(statusParts(facts({ accounts: 3 }), NOW, 'live').line1[1].text, 'Connected: Fake Brokerage (3 accounts)');
  assert.equal(timeText({ text: '2 hours ago', iso: 'x', title: 'Nov 1' }), '2 hours ago (Nov 1)');
  assert.equal(timeText({ text: 'Oct 30, 2026', iso: 'x' }), 'Oct 30, 2026');
  const src = readFileSync(new URL('../app/status-line.tsx', import.meta.url), 'utf8');
  assert.match(src, /s\.title \? timeText\(s\)/);
});

test('QA round 1 (finding 11): the trade and month pages\' line says "Demo data" once (the strip label under it says it)', () => {
  const demo = facts({ source: 'demo', connections: [] });
  assert.equal(recordSegments(demo, NOW)!.map((x) => x.text).join(''), 'Record since Jan 5, 2026');
  // The profile's own line still names it (it has no strip label beside it).
  assert.equal(statusParts(demo, NOW, 'live').line1.map((p) => p.text).join(' · '), 'Record since Jan 5, 2026 · Demo data');
});
