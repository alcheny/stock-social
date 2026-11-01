// F-7 launch switch and sources (ACs 8, 10; legal C19, C20; Round 4 item 6: loopback by default).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importerBaseAllowed, isFilerHandle, publicSources, publicTradersOn } from './public-gate.ts';

const both = { PUBLIC_FILINGS_CONTACT: 'ops@example.test', PUBLIC_RECORDS_CONTACT: 'records@example.test' };

test('AC 8: the switch table', () => {
  assert.equal(publicTradersOn({ PUBLIC_TRADERS: '0' }), false);
  assert.equal(publicTradersOn({ PUBLIC_TRADERS: '0', NODE_ENV: 'development' }), false);
  assert.equal(publicTradersOn({ PUBLIC_TRADERS: '1', NODE_ENV: 'development' }), true);
  assert.equal(publicTradersOn({ PUBLIC_TRADERS: '1', NODE_ENV: 'production' }), false);
  assert.equal(publicTradersOn({ PUBLIC_TRADERS: '1', NODE_ENV: 'production', PUBLIC_FILINGS_CONTACT: both.PUBLIC_FILINGS_CONTACT }), false);
  assert.equal(publicTradersOn({ PUBLIC_TRADERS: '1', NODE_ENV: 'production', PUBLIC_RECORDS_CONTACT: both.PUBLIC_RECORDS_CONTACT }), false);
  assert.equal(publicTradersOn({ PUBLIC_TRADERS: '1', NODE_ENV: 'production', LAUNCH_OPEN: '1', ...both }), true);
  assert.equal(publicTradersOn({ NODE_ENV: 'development' }), true);
  assert.equal(publicTradersOn({ NODE_ENV: 'test' }), true);
  assert.equal(publicTradersOn({ NODE_ENV: 'production', ...both }), false);
});

test('fix round 3: in production real filers show only once the launch gate is open; the sandbox path is unchanged', () => {
  const prod = { PUBLIC_TRADERS: '1', NODE_ENV: 'production', ...both, SNAPTRADE_CLIENT_ID: 'live', SNAPTRADE_BASE_URL: 'https://vendor.example.test' };
  assert.equal(publicTradersOn(prod), false); // gate closed
  assert.equal(publicTradersOn({ ...prod, LAUNCH_OPEN: '0' }), false);
  assert.equal(publicTradersOn({ ...prod, LAUNCH_OPEN: '1' }), true);
  assert.equal(importerBaseAllowed('https://filings.example.test', prod), false);
  assert.equal(importerBaseAllowed('https://filings.example.test', { ...prod, LAUNCH_OPEN: '1' }), true);
  // The e2e production build (nothing real can enter, loopback filings): fictional filers still show.
  assert.equal(publicTradersOn({ NODE_ENV: 'production', ALLOW_DEV_AUTH: '1' }), true);
  assert.equal(publicTradersOn({ NODE_ENV: 'production', ALLOW_DEV_AUTH: '1', SNAPTRADE_BASE_URL: 'https://vendor.example.test' }), false);
});

test('AC 8 / Round 4 item 6: unset reaches loopback only; another host needs an explicit on and the contact', () => {
  const remote = 'https://filings.example.test';
  assert.equal(importerBaseAllowed('http://127.0.0.1:4103', { NODE_ENV: 'development' }), true);
  assert.equal(importerBaseAllowed(remote, { NODE_ENV: 'development' }), false);
  assert.equal(importerBaseAllowed(remote, { NODE_ENV: 'development', PUBLIC_FILINGS_CONTACT: both.PUBLIC_FILINGS_CONTACT }), false);
  assert.equal(importerBaseAllowed(remote, { NODE_ENV: 'development', PUBLIC_TRADERS: '1' }), false);
  assert.equal(importerBaseAllowed(remote, { NODE_ENV: 'development', PUBLIC_TRADERS: '1', PUBLIC_FILINGS_CONTACT: both.PUBLIC_FILINGS_CONTACT }), true);
  assert.equal(importerBaseAllowed('http://127.0.0.1:4103', { PUBLIC_TRADERS: '0' }), false);
  assert.equal(importerBaseAllowed(remote, { NODE_ENV: 'production', PUBLIC_TRADERS: '1', PUBLIC_FILINGS_CONTACT: both.PUBLIC_FILINGS_CONTACT }), false);
});

test('AC 10: only the insider source can be enabled; other sources are ignored even when listed', () => {
  assert.deepEqual(publicSources({}), ['insider_reports']);
  assert.deepEqual(publicSources({ PUBLIC_SOURCES: 'legislator,holdings' }), []);
  assert.deepEqual(publicSources({ PUBLIC_SOURCES: 'legislator, insider_reports ,holdings' }), ['insider_reports']);
  assert.deepEqual(publicSources({ PUBLIC_SOURCES: '' }), []);
});

test('filer handles carry the reserved prefix', () => {
  assert.equal(isFilerHandle('pf_rowan'), true);
  assert.equal(isFilerHandle('rowan_pf'), false);
});

test('AC 8: the importer does not run (and sends nothing) when the switch is off or the source is not enabled', async () => {
  const { importPublicFilings } = await import('./public-import.ts');
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { calls++; throw new Error('no request expected'); }) as typeof fetch;
  try {
    const off = await importPublicFilings({ boxMs: 1000, env: { PUBLIC_TRADERS: '0', PUBLIC_FILINGS_CONTACT: both.PUBLIC_FILINGS_CONTACT }, baseUrl: 'http://127.0.0.1:1' });
    assert.equal(off.ran, false);
    const noSource = await importPublicFilings({ boxMs: 1000, env: { PUBLIC_SOURCES: 'holdings', PUBLIC_FILINGS_CONTACT: both.PUBLIC_FILINGS_CONTACT }, baseUrl: 'http://127.0.0.1:1' });
    assert.equal(noSource.ran, false);
    const noBase = await importPublicFilings({ boxMs: 1000, env: { PUBLIC_FILINGS_CONTACT: both.PUBLIC_FILINGS_CONTACT } });
    assert.equal(noBase.ran, false);
  } finally { globalThis.fetch = realFetch; }
  assert.equal(calls, 0);
});
