// lib/broker.ts against the in-repo vendor fake over HTTP: the SDK is pointed at SNAPTRADE_BASE_URL, the connection is
// read-only, accounts carry the paper and initial-sync flags, activities page by offset, positions are percent only,
// and delete connection / delete user reach the vendor. No real vendor is contacted.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { toActivities, unrealizedPct } from './broker.ts';
import { startVendorFake } from '../e2e/fakes/vendor.ts';

test('unrealizedPct: per-unit cost against per-unit price (the SDK documents both as per share); nothing without them', () => {
  // Hand-computed: 10 units bought at 10, now 11 -> (11 - 10) / 10 = +10%. A lot-total reading would give +1000%.
  assert.equal(unrealizedPct({ units: '10', price: '11', cost_basis: '10' }), 0.1);
  assert.equal(unrealizedPct({ units: 2, price: 45, cost_basis: 50 }), -0.1);
  // The older model's per-share field works alone and wins when both are present.
  assert.equal(unrealizedPct({ units: 10, price: 11, average_purchase_price: 10 }), 0.1);
  assert.equal(unrealizedPct({ units: 10, price: 11, average_purchase_price: 10, cost_basis: '5.5' }), 0.1);
  assert.equal(unrealizedPct({ units: 10, price: 11, average_purchase_price: null, cost_basis: '10' }), 0.1);
  assert.equal(unrealizedPct({ units: 10, price: 11, average_purchase_price: 0, cost_basis: '10' }), 0.1);
  // Missing or zero price or cost: no percent.
  assert.equal(unrealizedPct({ units: '10', price: null, cost_basis: '10' }), null);
  assert.equal(unrealizedPct({ units: '10', price: '0', cost_basis: '10' }), null);
  assert.equal(unrealizedPct({ units: '10', price: '11' }), null);
  assert.equal(unrealizedPct({ units: '10', price: '11', cost_basis: '0', average_purchase_price: 0 }), null);
  assert.equal(unrealizedPct({ units: '10', price: '11', cost_basis: null }), null);
  assert.equal(unrealizedPct({ units: '0', price: '1', cost_basis: '1' }), null);
});

let fake: Awaited<ReturnType<typeof startVendorFake>>;
const PORT = 4300 + Math.floor(Math.random() * 500);
before(async () => {
  fake = await startVendorFake(PORT);
  process.env.SNAPTRADE_BASE_URL = fake.base;
  process.env.SNAPTRADE_CLIENT_ID = 'test';
  process.env.SNAPTRADE_CONSUMER_KEY = 'test-consumer';
  process.env.APP_SECRET_KEY ??= 'test-secret';
});
after(() => { fake?.server.close(); delete process.env.SNAPTRADE_BASE_URL; });

test('register, read-only portal URL, accounts with flags, paged activities, positions, delete connection and user', async () => {
  const b = await import('./broker.ts');
  const u = await b.registerUser('attempt-9');
  assert.match(u.snaptradeUserId, /^stock-social-attempt-9-/);
  assert.notEqual(u.secretEnc, `secret-${u.snaptradeUserId}`); // encrypted at rest
  const url = await b.connectUrl(u, 'https://app.example/connect/done');
  assert.ok(url.startsWith(`${fake.base}/portal?`));
  assert.deepEqual(await b.listAccounts(u), []);
  await fetch(`${fake.base}/_scenario`, { method: 'POST', body: JSON.stringify({ accounts: [
    { id: 'real-1', institution: 'Fake Brokerage', activities: 7, syncDone: false, positions: [{ symbol: 'QQQ', units: 10, price: 11, cost_basis: 10 }] },
    { id: 'paper-1', paper: true, activities: 2 },
  ] }) });
  await fetch(`${url}&go=1`, { redirect: 'manual' }); // the portal's Connect
  const accounts = await b.listAccounts(u);
  assert.deepEqual(accounts.map((a) => [a.id, a.isPaper, a.initialSyncCompleted, a.institution]), [['real-1', false, false, 'Fake Brokerage'], ['paper-1', true, true, 'Fake Brokerage']]);
  assert.equal(new Set(accounts.map((a) => a.authorizationId)).size, 1);
  const p1 = await b.fetchActivitiesPage(u, 'real-1', 0, 3);
  assert.equal(p1.activities.length, 3);
  assert.equal(p1.done, false);
  assert.deepEqual(p1.activities.map((a) => a.externalId), ['real-1-0', 'real-1-1', 'real-1-2']);
  assert.equal(p1.activities[0].verified, true);
  const p3 = await b.fetchActivitiesPage(u, 'real-1', 6, 3);
  assert.equal(p3.activities.length, 1);
  assert.equal(p3.done, true);
  await fetch(`${fake.base}/_sync`, { method: 'POST', body: JSON.stringify({ completed: true }) });
  assert.equal((await b.listAccounts(u))[0].initialSyncCompleted, true);
  assert.deepEqual(await b.fetchPositions(u, 'real-1'), [{ symbol: 'QQQ', unrealizedPct: 0.1 }]);
  await b.deleteConnection(u, accounts[0].authorizationId);
  assert.deepEqual(await b.listAccounts(u), []);
  await b.deleteUser(u);
  await assert.rejects(b.listAccounts(u)); // the vendor no longer knows the user
  const state = await (await fetch(`${fake.base}/_state`)).json();
  assert.equal(state[u.snaptradeUserId], undefined);
});

test('fix round 3: every vendor request is bounded: a request that hangs is aborted at the timeout and fails with VendorTimeoutError; a slow one under it succeeds', async () => {
  const { createServer } = await import('node:http');
  const b = await import('./broker.ts');
  assert.equal(b.VENDOR_TIMEOUT_MS, 30_000); // far below the sync tick's 10-minute lease
  const u = await b.registerUser('attempt-hang');
  let opened = 0, aborted = 0;
  const hung = createServer((req) => { opened++; req.socket.on('close', () => aborted++); }); // never answers
  await new Promise<void>((r) => hung.listen(0, '127.0.0.1', () => r()));
  const base = process.env.SNAPTRADE_BASE_URL;
  b.vendorTimeout.ms = 200;
  try {
    // The fake answers activities after 50 ms: under the bound, the page lands.
    await fetch(`${fake.base}/_scenario`, { method: 'POST', body: JSON.stringify({ accounts: [{ id: 'slow-1', activities: 2 }], delayMs: 50 }) });
    await fetch(`${await b.connectUrl(u, 'https://app.example/connect/done')}&go=1`, { redirect: 'manual' });
    assert.equal((await b.fetchActivitiesPage(u, 'slow-1', 0, 10)).activities.length, 2);
    process.env.SNAPTRADE_BASE_URL = `http://127.0.0.1:${(hung.address() as { port: number }).port}`;
    const calls: [string, () => Promise<unknown>][] = [
      ['listAccounts', () => b.listAccounts(u)],
      ['fetchActivitiesPage', () => b.fetchActivitiesPage(u, 'acc', 0, 10)],
      ['fetchActivities', () => b.fetchActivities(u, new Date('2026-01-01'), ['acc'])],
      ['fetchActivities (listing)', () => b.fetchActivities(u, new Date('2026-01-01'))],
      ['fetchPositions', () => b.fetchPositions(u, 'acc')],
      ['connectUrl', () => b.connectUrl(u, 'https://app.example/connect/done')],
      ['deleteConnection', () => b.deleteConnection(u, 'auth')],
      ['deleteUser', () => b.deleteUser(u)],
      ['registerUser', () => b.registerUser('attempt-hang-2')],
    ];
    for (const [name, call] of calls) {
      const t = Date.now();
      await assert.rejects(call(), b.VendorTimeoutError, name);
      const took = Date.now() - t;
      assert.ok(took >= 190 && took < 2_000, `${name} took ${took} ms`);
    }
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(opened, calls.length);
    assert.equal(aborted, calls.length, 'each hung request was aborted, not left open');
  } finally {
    b.vendorTimeout.ms = b.VENDOR_TIMEOUT_MS;
    process.env.SNAPTRADE_BASE_URL = base;
    hung.closeAllConnections();
    hung.close();
  }
});

// Fixes cycle 3, F3-1 (docs/direction/cycle3-2026-11-01.md): a BUY/SELL row with an id and a symbol is never dropped.
test('F3-1: toActivities keeps every share trade row: usable rows are activities, rows with no usable price, units or date are returned to be counted', () => {
  const base = { symbol: { symbol: 'AAA' }, type: 'SELL', trade_date: '2024-01-05', price: 12, units: 10, fee: -1 };
  const { activities, unusable } = toActivities('acc', [
    { ...base, id: 'ok' },
    { ...base, id: 'str', price: '12.5' as never, units: '-3' as never }, // numeric strings still read
    { ...base, id: 'p0', price: 0 },
    { ...base, id: 'pnull', price: null as never },
    { ...base, id: 'pneg', price: -4 }, // reached the insert before and failed the whole sync on price > 0
    { ...base, id: 'u0', units: 0 },
    { ...base, id: 'nodate', trade_date: null },
    { ...base, id: 'baddate', trade_date: 'not a date', type: 'BUY', price: undefined },
    { ...base, id: 'opt', price: 0, option_symbol: { id: 'x' } }, // options: not this path
    { ...base, id: 'div', price: 0, type: 'DIVIDEND' },
    { ...base, id: undefined, price: 0 },
    { ...base, id: 'nosym', symbol: null, price: 0 },
  ]);
  assert.deepEqual(activities.map((a) => [a.externalId, a.side, a.units, a.price, a.fee]), [['ok', 'SELL', 10, 12, 1], ['str', 'SELL', 3, 12.5, 1]]);
  assert.deepEqual(unusable.map((a) => a.externalId), ['p0', 'pnull', 'pneg', 'u0', 'nodate', 'baddate']);
  for (const a of unusable) { assert.equal(a.kind, 'unpriceable'); assert.ok(a.kind === 'unpriceable' && a.reason === 'trade'); assert.ok(a.raw); }
  const by = new Map(unusable.map((a) => [a.externalId, a as unknown as { side: string; units?: number; undated?: boolean; executedAt: Date }]));
  assert.deepEqual([by.get('p0')!.side, by.get('p0')!.units, by.get('p0')!.undated], ['SELL', 10, undefined]);
  assert.equal(by.get('u0')!.units, undefined);
  assert.deepEqual([by.get('nodate')!.undated, by.get('nodate')!.executedAt.getTime(), by.get('nodate')!.units], [true, 0, 10]);
  assert.deepEqual([by.get('baddate')!.side, by.get('baddate')!.undated], ['BUY', true]);
});
