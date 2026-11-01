// Security hardening (2026-11-01), F12 and F19: route and form values are checked before they reach SQL, so junk (a NUL
// byte, a non-numeric id) is a 404 or a no-op, never a database error and a 500.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeHandle, tradeIdParam } from './params.ts';
import { decodeSellId } from './trade-share-load.ts';

test('routeHandle: exactly what users.handle allows (its CHECK); anything else is null', () => {
  for (const ok of ['momentum_maya', 'abc', 'a_1', 'x'.repeat(20)]) assert.equal(routeHandle(ok), ok);
  for (const bad of ['ab', 'x'.repeat(21), 'Momentum_Maya', 'maya\0', 'ma ya', 'maya%00', '../x', '', 42, undefined, null]) assert.equal(routeHandle(bad), null, String(bad));
});

test('tradeIdParam: a positive bigint in digits only', () => {
  assert.equal(tradeIdParam('1'), '1');
  assert.equal(tradeIdParam('123456789012345678'), '123456789012345678');
  for (const bad of ['0', '01', '-1', '1.5', '1e3', 'abc', '', ' 1', '1234567890123456789', null, 7]) assert.equal(tradeIdParam(bad), null, String(bad));
});

test('decodeSellId: a NUL byte (Postgres text cannot hold one) is refused like malformed encoding', () => {
  assert.equal(decodeSellId('abc%2Fdef'), 'abc/def');
  assert.equal(decodeSellId('%E0%A4%A'), null);
  assert.equal(decodeSellId('abc%00'), null);
  assert.equal(decodeSellId('abc\0'), null);
});

test('the profile, recap and trade-share loaders, and saveThesis, check their input before the query', () => {
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  for (const p of ['app/u/[handle]/page.tsx', 'lib/recap-load.ts', 'lib/trade-share-load.ts']) assert.match(src(p), /routeHandle\(/, p);
  assert.match(src('app/actions.ts'), /tradeIdParam\(form\.get\('tradeId'\)\)/);
});

const hasDb = !!process.env.DATABASE_URL;
test('loaders answer null (a 404) for a handle with a NUL byte instead of a database error', { skip: !hasDb && 'no DATABASE_URL' }, async () => {
  const { loadRecap } = await import('./recap-load.ts');
  const { loadTradeShare } = await import('./trade-share-load.ts');
  try {
    assert.equal(await loadRecap('maya\0', '2026-01'), null);
    assert.equal(await loadTradeShare('maya\0', 'x'), null);
    assert.equal(await loadTradeShare('momentum_maya', 'x\0'), null);
  } finally {
    await (await import('./db.ts')).sql.end({ timeout: 1 });
  }
});
