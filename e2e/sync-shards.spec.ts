// Sharded hourly sync (docs/SYNC.md): POST /api/sync auth and shard parameters against `npm run start`. The cron secret
// is read from .env (the value `next start` loads), as in connect.spec.ts. Shard runs, leases and coverage themselves
// are covered by lib/sync-shard.test.ts; these check the endpoint's contract.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { cronLock } from './cron-lock.ts';

const cronSecret = process.env.CRON_SECRET ?? readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^CRON_SECRET=(.*)$/m)?.[1];
const auth = { authorization: `Bearer ${cronSecret}` };

test('sync: the cron secret is checked before the shard parameters (401 with or without them, wrong secret too)', async ({ request }) => {
  for (const q of ['', '?shard=0&of=4', '?shard=9&of=2', '?shard=x']) {
    expect((await request.post(`/api/sync${q}`)).status()).toBe(401);
    expect((await request.post(`/api/sync${q}`, { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);
  }
});

test('sync: GET (the host cron) is the same endpoint: 401 without or with a wrong secret; with the secret it runs (shard 1 of 2: no housekeeping)', async ({ request }) => {
  test.setTimeout(60_000);
  for (const q of ['', '?shard=1&of=2']) {
    expect((await request.get(`/api/sync${q}`)).status()).toBe(401);
    expect((await request.get(`/api/sync${q}`, { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);
  }
  expect((await request.get('/api/sync?shard=2&of=2', { headers: auth })).status()).toBe(400);
  const release = await cronLock('exclusive');
  try {
    const r = await request.get('/api/sync?shard=1&of=2', { headers: auth });
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.run).toMatchObject({ of: 2, shard: 1 });
    expect(b.purgedLinks).toBeUndefined();
  } finally { await release(); }
});

test('sync: invalid shard parameters answer 400 with a reason and sync nothing', async ({ request }) => {
  for (const q of ['?shard=1', '?of=4', '?shard=4&of=4', '?shard=-1&of=4', '?shard=1.5&of=4', '?shard=0&of=0', '?shard=0&of=1025', '?shard=a&of=b']) {
    const r = await request.post(`/api/sync${q}`, { headers: auth });
    expect(r.status(), q).toBe(400);
    expect(typeof (await r.json()).error).toBe('string');
  }
});

test('sync: a shard other than 0 runs only its shard (no housekeeping, no coverage); shard 0 runs both; no parameters is shard 0 of 1', async ({ request }) => {
  test.setTimeout(120_000); // sharded calls start after a random spread of up to 15 s
  const release = await cronLock('exclusive'); // e2e/cron-lock.ts: other files' cron calls wait
  try {
  const other = await request.post('/api/sync?shard=1&of=2', { headers: auth });
  expect(other.status()).toBe(200);
  const o = await other.json();
  expect(o.run).toMatchObject({ of: 2, shard: 1 });
  expect(o.purgedLinks).toBeUndefined();
  expect(o.coverage).toBeNull();
  for (const k of ['ok', 'skipped', 'failed', 'stoppedAtDeadline']) expect(o).toHaveProperty(k);

  const zero = await (await request.post('/api/sync?shard=0&of=2', { headers: auth })).json();
  expect(zero.run).toMatchObject({ of: 2, shard: 0 });
  expect(zero).toHaveProperty('purgedLinks');
  expect(zero).toHaveProperty('deletions');
  expect(zero.coverage).toMatchObject({ of: 2 });
  expect(typeof zero.coverage.dbConfigOk).toBe('boolean');

  const plain = await (await request.post('/api/sync', { headers: auth })).json();
  expect(plain.run).toMatchObject({ of: 1, shard: 0 });
  expect(plain.coverage).toMatchObject({ of: 1 });
  // Counts only: the answer and its coverage carry no handles or vendor ids.
  expect(JSON.stringify(plain)).not.toMatch(/momentum_maya|dividend_dan|yolo_yuki|stock-social-/);
  } finally { await release(); }
});
