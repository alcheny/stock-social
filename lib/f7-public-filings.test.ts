// F-7 filing-system client and parser (ACs 11, 12; legal C4, C6-C8). The fake (e2e/fakes/public-filings.ts) runs
// in-test on its own port. Fictional filers, issuers and symbols only.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { fakeState, filingXml, setScenario, startPublicFilingsFake } from '../e2e/fakes/public-filings.ts';
import { filingsClient, FilingsStopped, MAX_DOC_BYTES, MIN_GAP_MS, parseFiling } from './public-filings.ts';

const env = { NODE_ENV: 'test', PUBLIC_FILINGS_CONTACT: 'ops@example.test' };
let fake: { server: Server; base: string };
before(async () => { fake = await startPublicFilingsFake(0); }, { timeout: 30_000 });
after(() => { fake?.server.closeAllConnections(); fake?.server.close(); });

const fixture = (f: string) => readFileSync(new URL(`../e2e/fixtures/public-filings/${f}`, import.meta.url), 'utf8');

test('AC 12: the fixture gives the expected rows; entities are decoded; only matcher fields are kept (C4)', () => {
  const xml = fixture('mixed.xml');
  const { filing, skipped } = parseFiling(xml);
  assert.ok(filing);
  assert.equal(skipped, 0);
  assert.equal(filing.ownerKey, '9000000101');
  assert.equal(filing.ownerName, 'Avery & Fictional');
  assert.equal(filing.director, true); assert.equal(filing.officer, true);
  assert.equal(filing.owners, 1);
  assert.equal(filing.symbol, 'QZXC');
  assert.deepEqual(filing.rows, [
    { derivative: false, date: '2026-03-30', code: 'P', units: 200, price: 10.5, acquired: true, heldAfter: 1200, indirect: false },
    { derivative: false, date: '2026-03-31', code: 'S', units: 50, price: 11.25, acquired: false, heldAfter: 1150, indirect: false },
    { derivative: false, date: '2026-03-31', code: 'G', units: 25, price: null, acquired: false, heldAfter: 1125, indirect: false },
    { derivative: false, date: '2026-03-31', code: 'P', units: 70, price: 10, acquired: true, heldAfter: 70, indirect: true },
    { derivative: true, date: '2026-03-30', code: 'M', units: 300, price: 0, acquired: true, heldAfter: 300, indirect: false },
  ]);
  const kept = JSON.stringify(filing);
  for (const never of ['Imaginary Lane', 'Nowhereville', 'Fictional Signer', 'footnote', 'remarks', 'Family Holding Trust', 'Chief Imaginary Officer', 'Widgets']) {
    assert.ok(!kept.includes(never), never);
  }
});

test('AC 12: truncated, oversized and unknown-structure documents are skipped and counted, never thrown', () => {
  const xml = fixture('mixed.xml');
  assert.equal(parseFiling(xml.slice(0, Math.floor(xml.length / 2))).filing, null);
  assert.equal(parseFiling(xml + ' '.repeat(MAX_DOC_BYTES)).filing, null);
  assert.equal(parseFiling('').filing, null);
  assert.equal(parseFiling('<<<&&&>>>').filing, null);
  assert.equal(parseFiling(fixture('unknown.xml')).filing, null);
  // A known document with one malformed row keeps the good rows and counts the bad one.
  const bad = xml.replace('<transactionShares><value>50</value>', '<transactionShares><value>fifty</value>');
  const p = parseFiling(bad);
  assert.equal(p.filing?.rows.length, 4);
  assert.equal(p.skipped, 1);
});

test('AC 11: no contact, no request; a non-loopback base must be https and explicitly allowed', async () => {
  await setScenario(fake.base, { name: 'basic' });
  assert.throws(() => filingsClient(fake.base, { NODE_ENV: 'test' }), /PUBLIC_FILINGS_CONTACT/);
  assert.throws(() => filingsClient(fake.base, { NODE_ENV: 'test', PUBLIC_FILINGS_CONTACT: '  ' }), /PUBLIC_FILINGS_CONTACT/);
  assert.throws(() => filingsClient('https://filings.example.test', env), /not allowed/);
  assert.throws(() => filingsClient('http://filings.example.test', { ...env, PUBLIC_TRADERS: '1' }), /not allowed/);
  assert.throws(() => filingsClient(fake.base, { ...env, PUBLIC_TRADERS: '0' }), /not allowed/);
  assert.equal((await fakeState(fake.base)).requests.length, 0);
});

test('AC 11: every request carries the product and contact, one worker at least 250 ms apart', async () => {
  await setScenario(fake.base, { name: 'basic' });
  const c = filingsClient(fake.base, env);
  // Two callers at once still go through the module's one worker.
  const [a, b] = await Promise.all([c.listFilings({ day: '2026-03-02' }), c.listFilings({ day: '2026-03-03' })]);
  assert.equal(a.length, 1); assert.equal(b.length, 2);
  assert.deepEqual(await c.listFilings({ day: '2026-01-01' }), []); // no index that day
  const xml = await c.fetchFiling(a[0].id);
  assert.ok(parseFiling(xml!).filing);
  const { requests } = await fakeState(fake.base);
  assert.equal(requests.length, 4);
  for (const r of requests) assert.equal(r.ua, 'Stock Social ops@example.test');
  for (let i = 1; i < requests.length; i++) assert.ok(requests[i].at - requests[i - 1].at >= MIN_GAP_MS - 5, `gap ${requests[i].at - requests[i - 1].at}`);
  assert.equal(MIN_GAP_MS >= 250, true);
});

test('AC 11: repeated 429 or 5xx backs off, then stops the tick', async () => {
  for (const name of ['429', '5xx']) {
    await setScenario(fake.base, { name });
    const c = filingsClient(fake.base, env, Date.now() + 4000);
    await assert.rejects(c.listFilings({ day: '2026-03-02' }), FilingsStopped);
    const { requests } = await fakeState(fake.base);
    assert.ok(requests.length >= 2 && requests.length <= 4, `${name}: ${requests.length} tries`);
    assert.ok(requests[1].at - requests[0].at >= 900, 'backed off');
  }
  // One refusal then success: the backoff recovers.
  await setScenario(fake.base, { name: 'basic' });
  await fetch(`${fake.base}/_fail`, { method: 'POST', body: JSON.stringify({ status: 503, times: 1 }) });
  assert.equal((await filingsClient(fake.base, env, Date.now() + 5000).listFilings({ day: '2026-03-02' })).length, 1);
});

test('review: bodies are read with a byte cap even when chunked (no content-length); index links must be on the base origin', async () => {
  const { createServer } = await import('node:http');
  const pad = ' '.repeat(64 * 1024), entry = (url: string, id: string) => ({ id, url, filedAt: '2026-03-02T21:00:00Z' });
  let base = '', big = false;
  const srv = createServer((req, res) => {
    res.on('error', () => {});
    const body = req.url!.startsWith('/index/') ? JSON.stringify({ filings: [entry(`${base}/view/a`, 'a'), entry('https://elsewhere.example.test/view/b', 'b')] }) : '<ownershipDocument/>';
    res.writeHead(200); // no content-length: chunked
    res.write(body.slice(0, -1));
    let n = 0;
    const more = () => { while (big && n++ * pad.length <= MAX_DOC_BYTES) if (!res.write(pad)) return void res.once('drain', more); res.end(body.slice(-1)); };
    more();
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  try {
    const c = filingsClient(base, env);
    assert.deepEqual((await c.listFilings({ day: '2026-03-02' })).map((e) => e.id), ['a']); // the other origin is skipped
    assert.equal(await c.fetchFiling('x'), '<ownershipDocument/>');
    big = true;
    assert.deepEqual(await c.listFilings({ day: '2026-03-02' }), []);
    assert.equal(await c.fetchFiling('x'), '');
  } finally { srv.closeAllConnections(); srv.close(); }
});

test('review: many unclosed tags or comments parse in linear time', () => {
  for (const junk of ['<ownershipDocument>'.repeat(30_000), '<!--'.repeat(30_000), `<ownershipDocument>${'<issuer '.repeat(100_000)}</ownershipDocument>`]) {
    const t0 = performance.now();
    assert.equal(parseFiling(junk).filing, null);
    assert.ok(performance.now() - t0 < 500, `${Math.round(performance.now() - t0)} ms`);
  }
});

test('the fake mirrors the parser: a generated filing parses to its rows', () => {
  const { filing } = parseFiling(filingXml({ id: 'x', day: '2026-01-02', owner: { key: '9000000999', name: 'Lee Fictional', officer: true }, symbol: 'QZXE',
    rows: [{ date: '2026-01-01', code: 'S', units: 3, price: 2, ad: 'D', after: null }] }));
  assert.deepEqual(filing?.rows, [{ derivative: false, date: '2026-01-01', code: 'S', units: 3, price: 2, acquired: false, heldAfter: null, indirect: false }]);
  assert.equal(filing?.officer, true); assert.equal(filing?.director, false);
});
