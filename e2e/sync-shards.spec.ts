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

test('sync: a sharded call (of > 1, shard 0 included) syncs only; task=housekeeping runs the housekeeping and coverage with no sync; no parameters does both', async ({ request }) => {
  test.setTimeout(120_000); // sharded calls start after a random spread of up to 15 s
  const release = await cronLock('exclusive'); // e2e/cron-lock.ts: other files' cron calls wait
  try {
    for (const q of ['?shard=1&of=2', '?shard=0&of=2']) {
      const r = await request.post(`/api/sync${q}`, { headers: auth });
      expect(r.status(), q).toBe(200);
      const o = await r.json();
      expect(o.run).toMatchObject({ of: 2, shard: Number(new URLSearchParams(q).get('shard')) });
      expect(o.purgedLinks, q).toBeUndefined();
      expect(o.coverage, q).toBeNull();
      for (const k of ['ok', 'skipped', 'failed', 'stoppedAtDeadline']) expect(o).toHaveProperty(k);
    }

    const hk = await (await request.post('/api/sync?task=housekeeping&of=2', { headers: auth })).json();
    expect(hk.run).toBeNull();
    expect(hk.ok).toBe(0);
    expect(hk).toHaveProperty('purgedLinks');
    expect(hk).toHaveProperty('deletions');
    expect(hk).toHaveProperty('connections');
    expect(hk.coverage).toMatchObject({ of: 2 });
    expect(typeof hk.coverage.dbConfigOk).toBe('boolean');
    for (const q of ['?task=other', '?task=housekeeping&shard=0&of=2', '?task=housekeeping&of=0'])
      expect((await request.post(`/api/sync${q}`, { headers: auth })).status(), q).toBe(400);

    const plain = await (await request.post('/api/sync', { headers: auth })).json();
    expect(plain.run).toMatchObject({ of: 1, shard: 0 });
    expect(plain).toHaveProperty('purgedLinks');
    expect(plain.coverage).toMatchObject({ of: 1 });
    // Counts only: the answer and its coverage carry no handles or vendor ids.
    expect(JSON.stringify(plain)).not.toMatch(/momentum_maya|dividend_dan|yolo_yuki|stock-social-/);
  } finally { await release(); }
});
