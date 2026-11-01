// The in-repo vendor fake's listen path (the lib/broker-corporate.test.ts cancellations): a test that picked a random
// fixed port could find it taken by another process (a second suite on the same host), and the fake's unhandled
// EADDRINUSE surfaced after the `before` hook ended, cancelling every test in the file. Port 0 takes a free port and
// a taken port now rejects, so the hook fails with the cause.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { startVendorFake } from '../e2e/fakes/vendor.ts';

test('port 0 binds a free port and the base names it; two fakes at once never collide', async () => {
  const a = await startVendorFake(0);
  const b = await startVendorFake(0);
  try {
    const pa = (a.server.address() as { port: number }).port;
    const pb = (b.server.address() as { port: number }).port;
    assert.notEqual(pa, pb);
    assert.equal(a.base, `http://127.0.0.1:${pa}`);
    assert.equal((await fetch(`${a.base}/_scenario`, { method: 'POST', body: '{}' })).status, 200);
    assert.equal((await fetch(`${b.base}/_scenario`, { method: 'POST', body: '{}' })).status, 200);
  } finally {
    a.server.close();
    b.server.close();
  }
});

test('a port another process holds rejects with EADDRINUSE instead of an uncaught exception', async () => {
  const holder = createServer();
  await new Promise<void>((r) => holder.listen(0, '127.0.0.1', () => r()));
  try {
    const port = (holder.address() as { port: number }).port;
    await assert.rejects(startVendorFake(port), { code: 'EADDRINUSE' });
  } finally {
    holder.close();
  }
});
