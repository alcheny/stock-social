// lib/broker.ts against the in-repo vendor fake over HTTP: the SDK is pointed at SNAPTRADE_BASE_URL, the connection is
// read-only, accounts carry the paper and initial-sync flags, activities page by offset, positions are percent only,
// and delete connection / delete user reach the vendor. No real vendor is contacted.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { unrealizedPct } from './broker.ts';
import { startVendorFake } from '../e2e/fakes/vendor.ts';

test('unrealizedPct: percent from price × units against cost basis; nothing without all three', () => {
  assert.equal(unrealizedPct({ units: '10', price: '11', cost_basis: '100' }), 0.1);
  assert.equal(unrealizedPct({ units: 2, price: 45, cost_basis: 100 }), -0.1);
  assert.equal(unrealizedPct({ units: '10', price: null, cost_basis: '100' }), null);
  assert.equal(unrealizedPct({ units: '0', price: '1', cost_basis: '0' }), null);
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
    { id: 'real-1', institution: 'Fake Brokerage', activities: 7, syncDone: false, positions: [{ symbol: 'QQQ', units: 2, price: 55, cost_basis: 100 }] },
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
