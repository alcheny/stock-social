// F-11 (docs/features/logs/fixes-labels/plan.md §3 "Vendor fake"): the in-repo vendor fake's POST /_remove drops one
// account from a user's listing (an account removed at the broker), or every account ({all: true}, a disconnect). Runs
// the fake on a free port of its own, so it never meets the e2e run's fake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { startVendorFake } from '../e2e/fakes/vendor.ts';

test('vendor fake: POST /_remove {accountId} drops that account from the listing; {all: true} empties it', async () => {
  const { server } = await startVendorFake(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (p: string, b: unknown) => fetch(`${base}${p}`, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
  try {
    await post('/snapTrade/registerUser', { userId: 'u1' });
    await post('/_scenario', { accounts: [{ id: 'x1', activities: 2 }, { id: 'x2', activities: 2 }] });
    await fetch(`${base}/portal?u=u1&r=&go=1&json=1`, { method: 'POST' });
    const listed = async () => ((await (await fetch(`${base}/accounts?userId=u1`)).json()) as { id: string }[]).map((a) => a.id);
    assert.deepEqual(await listed(), ['x1', 'x2']);
    assert.deepEqual(await post('/_remove', { accountId: 'x2' }), { ok: true, removed: 1 });
    assert.deepEqual(await listed(), ['x1']);
    assert.deepEqual(await post('/_remove', { all: true }), { ok: true, removed: 1 });
    assert.deepEqual(await listed(), []);
  } finally {
    await new Promise((done) => server.close(done));
  }
});
