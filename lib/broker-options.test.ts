// OPTIONS AC 12–13 (docs/features/logs/options/plan.md): lib/broker.ts against the in-repo vendor fake. The option
// event types join the type filter through OPTION_EVENT_TYPES; option rows reach the optional sink in the vendor's
// field names; the share rows and signatures are unchanged; positions split by instrument kind and never carry an OCC
// symbol into open positions.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startVendorFake } from '../e2e/fakes/vendor.ts';
import { ACTIVITY_TYPES, OPTION_EVENT_TYPES, splitPositionKinds, toOptionRows, type PositionSplit } from './broker.ts';
import type { OptionRow } from './options.ts';

let fake: Awaited<ReturnType<typeof startVendorFake>>;
const PORT = 4800 + Math.floor(Math.random() * 400);
before(async () => {
  fake = await startVendorFake(PORT);
  process.env.SNAPTRADE_BASE_URL = fake.base;
  process.env.SNAPTRADE_CLIENT_ID = 'test';
  process.env.SNAPTRADE_CONSUMER_KEY = 'test-consumer';
  process.env.APP_SECRET_KEY ??= 'test-secret';
});
after(() => { fake?.server.close(); delete process.env.SNAPTRADE_BASE_URL; });

const optionSymbol = (o: { right?: 'CALL' | 'PUT'; strike?: number; expiry?: string; mini?: boolean; underlying?: string; type?: string; ticker?: string } = {}) => ({
  id: 'opt-sym', ticker: o.ticker ?? `${(o.underlying ?? 'XYZ').padEnd(6, ' ')}261219${(o.right ?? 'CALL')[0]}${String(Math.round((o.strike ?? 123.45) * 1000)).padStart(8, '0')}`,
  option_type: o.right ?? 'CALL', strike_price: o.strike ?? 123.45, expiration_date: o.expiry ?? '2026-12-19', is_mini_option: o.mini ?? false,
  underlying_symbol: { symbol: o.underlying ?? 'XYZ', type: { code: o.type ?? 'cs' } },
});

test('AC12: one exported list of the three option event types builds the type filter', () => {
  assert.deepEqual([...OPTION_EVENT_TYPES], ['OPTIONEXPIRATION', 'OPTIONASSIGNMENT', 'OPTIONEXERCISE']);
  assert.equal(ACTIVITY_TYPES, 'BUY,SELL,OPTIONEXPIRATION,OPTIONASSIGNMENT,OPTIONEXERCISE');
  const src = readFileSync(new URL('./broker.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /type: 'BUY,SELL'/); // every request uses ACTIVITY_TYPES
});

test('AC12: option rows parse from the vendor fields (strike in thousandths, mini ×10, expiry validated); share rows never become option rows', () => {
  const rows = toOptionRows('acc', [
    { id: 'o1', type: 'BUY', option_type: 'BUY_TO_OPEN', option_symbol: optionSymbol(), units: -2, price: 1.5, fee: -0.65, amount: -300.65, currency: { code: 'USD' }, trade_date: '2026-11-02T15:00:00Z' },
    { id: 'o2', type: 'OPTIONEXPIRATION', option_symbol: optionSymbol({ mini: true, expiry: '2026-02-30' }), units: 2, price: 0, trade_date: '2026-12-19' },
    { id: 'o3', type: 'OPTIONASSIGNMENT', trade_date: '2026-12-19' }, // no option_symbol
    { id: 's1', type: 'BUY', symbol: { symbol: 'XYZ' } as never, units: 3, price: 10, trade_date: '2026-11-02' },
  ] as never);
  assert.deepEqual(rows.map((r) => r.externalId), ['o1', 'o2', 'o3']);
  const [a, b, c] = rows as OptionRow[];
  assert.equal(a.strikeMilli, 123_450);
  assert.equal(a.multiplier, 100);
  assert.equal(a.units, 2);
  assert.equal(a.fee, 0.65);
  assert.equal(a.underlyingType, 'cs');
  assert.equal(a.occTicker, 'XYZ   261219C00123450');
  assert.equal(b.multiplier, 10);
  assert.equal(b.expiry, null); // not a real date: stored, then counted
  assert.equal(c.underlying, null);
  assert.equal(c.kind, 'OPTIONASSIGNMENT');
});

test('AC12/13 over HTTP: option rows reach the sink, share rows and signatures unchanged; the fake honours the type filter; positions split by kind', async () => {
  const b = await import('./broker.ts');
  const u = await b.registerUser('attempt-opt');
  const url = await b.connectUrl(u, 'https://app.example/connect/done');
  await fetch(`${fake.base}/_scenario`, { method: 'POST', body: JSON.stringify({ accounts: [{
    id: 'opt-1', activities: 4,
    optionActivities: [
      { id: 'ob', type: 'BUY', option_type: 'BUY_TO_OPEN', option_symbol: optionSymbol(), units: 1, price: 1.2, fee: 0.65, currency: { code: 'USD' }, trade_date: '2024-01-03T15:00:00Z' },
      { id: 'os', type: 'SELL', option_symbol: optionSymbol(), units: 1, price: 2.4, fee: 0.65, currency: { code: 'USD' }, trade_date: '2024-01-04T15:00:00Z' }, // no option_type
      { id: 'ox', type: 'OPTIONEXERCISE', option_symbol: optionSymbol({ right: 'PUT' }), units: 1, trade_date: '2024-01-05' },
      { id: 'oa', type: 'OPTIONASSIGNMENT', trade_date: '2024-01-05' },
    ],
    positions: [{ symbol: 'QQQ', units: 10, price: 11, cost_basis: 10 }],
    instruments: [
      { instrument: { kind: 'option', id: 'i1', symbol: 'XYZ   261219C00123450', option_type: 'CALL', strike_price: '123.45', expiration_date: '2026-12-19', multiplier: '100', underlying: { kind: 'stock', id: 'u', symbol: 'XYZ', raw_symbol: 'XYZ' } }, units: '2', price: '1.80', cost_basis: '1.20' },
      { instrument: { kind: 'option', id: 'i2', symbol: 'XYZ   261219P00100000', option_type: 'PUT', strike_price: '100', expiration_date: '2026-12-19', multiplier: '100', underlying: { kind: 'stock', id: 'u', symbol: 'XYZ', raw_symbol: 'XYZ' } }, units: '-1', price: '2', cost_basis: '3' },
      { instrument: { kind: 'future', id: 'f', symbol: 'FUTZ6' }, units: '1', price: '1', cost_basis: '1' },
      { instrument: { kind: 'future_option', id: 'fo', symbol: 'FUTZ6 C100' }, units: '1', price: '1', cost_basis: '1' },
      { instrument: { kind: 'stock', id: 'leak', symbol: 'ABC   261219C00050000', raw_symbol: 'ABC' }, units: '1', price: '1', cost_basis: '1' },
    ],
  }] }) });
  await fetch(`${url}&go=1`, { redirect: 'manual' });
  const sunk: OptionRow[] = [];
  const page = await b.fetchActivitiesPage(u, 'opt-1', 0, 1000, (rows) => sunk.push(...rows));
  assert.equal(page.activities.length, 4); // the share rows, as before
  assert.ok(page.activities.every((a) => a.symbol && a.externalId.startsWith('opt-1-')));
  assert.deepEqual(sunk.map((r) => r.externalId), ['ob', 'os', 'ox', 'oa']);
  // Without a sink nothing changes for the caller (the existing signature).
  assert.equal((await b.fetchActivitiesPage(u, 'opt-1', 0, 1000)).activities.length, 4);
  const viaWindow: OptionRow[] = [];
  const acts = await b.fetchActivities(u, new Date('2024-01-01'), ['opt-1'], (rows) => viaWindow.push(...rows));
  assert.equal(acts.length, 4);
  assert.equal(viaWindow.length, 4);
  // The fake honours the type filter as the vendor documents it.
  const st = await (await fetch(`${fake.base}/_state`)).json();
  assert.ok(st[u.snaptradeUserId]);
  // Positions: stock positions as before; options to the sink with the per-share percent; futures-type and OCC counted.
  let split: PositionSplit | null = null;
  const pos = await b.fetchPositions(u, 'opt-1', (s) => { split = s; });
  assert.deepEqual(pos, [{ symbol: 'QQQ', unrealizedPct: 0.1 }]);
  assert.ok(split);
  const s = split as PositionSplit;
  assert.equal(s.options.length, 1);
  assert.ok(Math.abs(s.options[0].unrealizedPct - 0.5) < 1e-12); // (1.80 - 1.20) / 1.20, per share, no multiplier
  assert.equal(s.options[0].right, 'CALL');
  assert.equal(s.options[0].expiry, '2026-12-19');
  assert.equal(s.short, 1);
  assert.equal(s.unsupported, 3);
  assert.ok(pos.every((p) => !/\d{6}[CP]\d{8}/.test(p.symbol)));
  assert.deepEqual(await b.fetchPositions(u, 'opt-1'), [{ symbol: 'QQQ', unrealizedPct: 0.1 }]); // no sink: same shares
  await b.deleteUser(u);
});

test('AC12: the fake vendor honours the `type` filter', async () => {
  const b = await import('./broker.ts');
  const u = await b.registerUser('attempt-type');
  const url = await b.connectUrl(u, 'https://app.example/connect/done');
  await fetch(`${fake.base}/_scenario`, { method: 'POST', body: JSON.stringify({ accounts: [{ id: 'typ-1', activities: 2,
    optionActivities: [{ id: 'oe', type: 'OPTIONEXPIRATION', option_symbol: optionSymbol(), trade_date: '2024-02-01' }] }] }) });
  await fetch(`${url}&go=1`, { redirect: 'manual' });
  const q = (type: string) => fetch(`${fake.base}/accounts/typ-1/activities?userId=${encodeURIComponent(u.snaptradeUserId)}&type=${type}`).then((r) => r.json());
  assert.equal((await q('BUY,SELL')).data.length, 2);
  assert.equal((await q('OPTIONEXPIRATION')).data.length, 1);
  assert.equal((await q(ACTIVITY_TYPES)).data.length, 3);
  await b.deleteUser(u);
});

test('AC13: splitPositionKinds keeps equity-like kinds only', () => {
  const p = (instrument: object, units = '1') => ({ instrument, units, price: '2', cost_basis: '1' }) as never;
  const { equityLike, split } = splitPositionKinds([p({ kind: 'stock', symbol: 'A' }), p({ kind: 'etf', symbol: 'B' }), p({ kind: 'cfd', symbol: 'C' }),
    p({ kind: 'option', symbol: 'XYZ   261219C00123450', option_type: 'CALL', strike_price: '1', expiration_date: '2026-12-19', multiplier: '10', underlying: { kind: 'bond', symbol: 'XYZ' } })]);
  assert.deepEqual(equityLike.map((x: { instrument: { symbol: string } }) => x.instrument.symbol), ['A', 'B']);
  assert.equal(split.unsupported, 2); // the cfd and the option on a non-stock underlying
});
