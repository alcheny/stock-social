import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestRecapYm, monthRecap, parseYm, wholeRecord, type RecapTrade } from './recap.ts';
import { isNewRecord } from './trades.ts';

const NOW = new Date('2026-10-15T12:00:00Z');
const mk = (id: string, closed: string, ret = 0.05): RecapTrade => {
  const closedAt = new Date(closed);
  return { sellId: id, symbol: `S${id}`, openedAt: new Date(closedAt.getTime() - 3 * 864e5), closedAt, returnPct: ret, holdingDays: 3 };
};
const sept = (n: number, ret = 0.05) => Array.from({ length: n }, (_, i) => mk(`s${i}`, `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`, ret));

test('parseYm accepts valid and rejects malformed or future', () => {
  assert.ok(parseYm('2026-09', NOW));
  for (const bad of ['2026-13', '2026-00', '26-09', '2026-9', '2026-09-01', '', 'abc', '1999-05', '2026-11', '2099-01']) assert.equal(parseYm(bad, NOW), null, bad);
  const p = parseYm('2026-10', NOW)!;
  assert.equal(p.current, true);
  assert.equal(p.start.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(p.end.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(parseYm('2026-09', NOW)!.current, false);
});

test('month boundaries are UTC and half-open', () => {
  const a = mk('a', '2026-09-30T23:59:59.999Z');
  const b = mk('b', '2026-10-01T00:00:00.000Z');
  assert.deepEqual(monthRecap([a, b], '2026-09', NOW)!.trades.map((t) => t.sellId), ['a']);
  assert.deepEqual(monthRecap([a, b], '2026-10', NOW)!.trades.map((t) => t.sellId), ['b']);
});

test('losses-only month keeps every trade, best is the smallest loss', () => {
  const ts = [mk('a', '2026-09-01T00:00:00Z', -0.1), mk('b', '2026-09-02T00:00:00Z', -0.02), mk('c', '2026-09-03T00:00:00Z', -0.3)];
  const r = monthRecap(ts, '2026-09', NOW)!;
  assert.equal(r.wins, 0);
  assert.equal(r.losses, 3);
  assert.equal(r.trades.length, 3);
  assert.equal(r.best.sellId, 'b');
  assert.equal(r.worst.sellId, 'c');
});

test('single trade: no headline, best is worst', () => {
  const r = monthRecap(sept(1), '2026-09', NOW)!;
  assert.equal(r.count, 1);
  assert.equal(r.showHeadline, false);
  assert.equal(r.best, r.worst);
});

test('empty, malformed and future return null; current month is month so far', () => {
  assert.equal(monthRecap(sept(3), '2026-08', NOW), null);
  assert.equal(monthRecap(sept(3), 'nope', NOW), null);
  assert.equal(monthRecap(sept(3), '2026-12', NOW), null);
  assert.equal(monthRecap(sept(3), '2026-09', NOW)!.monthSoFar, false);
  assert.equal(monthRecap([mk('x', '2026-10-02T00:00:00Z')], '2026-10', NOW)!.monthSoFar, true);
});

test('showHeadline threshold is 5; zero returns count in neither bucket', () => {
  assert.equal(monthRecap(sept(4), '2026-09', NOW)!.showHeadline, false);
  assert.equal(monthRecap(sept(5), '2026-09', NOW)!.showHeadline, true);
  const r = monthRecap([mk('a', '2026-09-01T00:00:00Z', 0), mk('b', '2026-09-02T00:00:00Z', 0.1)], '2026-09', NOW)!;
  assert.equal(r.count, 2);
  assert.equal(r.wins, 1);
  assert.equal(r.losses, 0);
});

test('close order with deterministic tie-break', () => {
  const t = '2026-09-05T00:00:00Z';
  const r = monthRecap([mk('z', t), mk('a', t), mk('m', '2026-09-01T00:00:00Z')], '2026-09', NOW)!;
  assert.deepEqual(r.trades.map((x) => x.sellId), ['m', 'a', 'z']);
});

test('latestRecapYm', () => {
  assert.equal(latestRecapYm([]), null);
  assert.equal(latestRecapYm([mk('a', '2026-08-31T23:59:59Z'), mk('b', '2026-09-30T23:59:59Z')]), '2026-09');
});

test('wholeRecord newRecord uses isNewRecord', () => {
  for (const n of [3, 40]) {
    const all = Array.from({ length: n }, (_, i) => mk(`t${i}`, new Date(Date.UTC(2026, 0, 1 + i * 4)).toISOString()));
    const w = wholeRecord(all, NOW);
    assert.equal(w.newRecord, isNewRecord(all, all.length, NOW));
    assert.equal(w.trades, n);
  }
});

// F-4 PR-1 fix round 1 (UX lead D1): the whole record carries the TR-9 too-early state for the month page.
test('D1: wholeRecord().tooEarly is the TR-9 too-early state', () => {
  assert.equal(wholeRecord(sept(5), NOW).tooEarly, false);
  assert.equal(wholeRecord(sept(4), NOW).tooEarly, true);
  assert.equal(wholeRecord(sept(8).map((t, i) => ({ ...t, returnPct: i % 2 ? 0.4 : -0.3 })), NOW).tooEarly, true);
});
