// F-36 · Fees in the return's denominator (docs/features/F-36-fees-in-the-return-denominator.md; plan
// docs/features/logs/F-36/plan.md, Round 2 changes). A return divides by the purchase cost plus the purchase fees, the
// same formula as options. Fictional rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { matchTrades, MATCHER_VERSION, pct, type Activity, type MatchResult } from './trades.ts';
import { signChanges } from './matcher-rebuild.ts';

const ROOT = new URL('..', import.meta.url);
const d = (day: number) => new Date(Date.UTC(2026, 0, day, 15));
let n = 0;
const act = (side: Activity['side'], units: number, price: number, day: number, fee = 0, extra: Partial<Activity> = {}): Activity => ({
  externalId: `f36-${n++}`, accountId: 'acc', symbol: 'FAKE', side, units, price, fee, executedAt: d(day), verified: true, ...extra,
});
// The partition invariant (fixes cycle 4): every sell is shown or counted exactly once.
const partition = (m: MatchResult, acts: Activity[]) =>
  assert.equal(m.trades.length + m.excluded + m.excludedCorporate + (m.excludedHeld ?? 0), acts.filter((a) => a.side === 'SELL').length);

test('F-36 AC1: the probe (fictional: buy 2 @5, fee 10, sell @15) prints +50%', () => {
  const acts = [act('BUY', 2, 5, 1, 10), act('SELL', 2, 15, 5)];
  const m = matchTrades(acts);
  assert.equal(m.trades.length, 1);
  assert.equal(m.trades[0].returnPct, 0.5);
  assert.equal(pct(m.trades[0].returnPct, 0), '+50%');
  partition(m, acts);
});

test('F-36: the /how example (paid 100 plus a fee of 10, sold for 165, no fee on the sale) is exactly +50%', () => {
  const m = matchTrades([act('BUY', 1, 100, 1, 10), act('SELL', 1, 165, 5)]);
  assert.equal(m.trades[0].returnPct, 0.5);
});

test('F-36 AC2: a long share trade is worse than -100% only when its exit fee exceeds its sale proceeds', () => {
  // (proceeds − cost − fees − exitFee) ÷ (cost + fees) < −1  ⇔  proceeds − exitFee < 0: the denominator is positive and
  // adding it to both sides cancels the cost and the entry fees.
  const below = matchTrades([act('BUY', 1, 10, 1), act('SELL', 1, 1, 5, 5)]);
  assert.ok(below.trades[0].returnPct < -1, `${below.trades[0].returnPct}`);
  const cases: [number, number, number, number, number][] = [
    // [units, buy price, entry fee, sell price, exit fee], exit fee ≤ proceeds
    [1, 10, 0, 1, 1], // exit fee equal to the proceeds: exactly −100%
    [1, 10, 1000, 1, 0], // a huge entry fee and no exit fee
    [3, 10, 50, 0.5, 1.5],
    [2, 7, 3, 9, 0.2],
    [5, 100, 400, 1, 4.99],
  ];
  for (const [u, bp, ef, sp, xf] of cases) {
    const m = matchTrades([act('BUY', u, bp, 1, ef), act('SELL', u, sp, 5, xf)]);
    assert.ok(m.trades[0].returnPct >= -1, `${[u, bp, ef, sp, xf]}: ${m.trades[0].returnPct}`);
  }
  assert.equal(matchTrades([act('BUY', 1, 10, 1), act('SELL', 1, 1, 5, 1)]).trades[0].returnPct, -1);
});

test('F-36 AC3: a zero-fee trade keeps exactly the figure it had (byte-identical)', () => {
  const m = matchTrades([act('BUY', 10, 100, 1), act('BUY', 10, 120, 3), act('SELL', 15, 130, 10), act('SELL', 5, 90, 12)]);
  assert.equal(m.trades[0].returnPct, (1950 - 1600) / 1600);
  assert.equal(m.trades[1].returnPct, (450 - 600) / 600);
});

test('F-36: entry fees are prorated by the units taken from each lot, as before; the numerator is unchanged', () => {
  const m = matchTrades([act('SELL', 15, 130, 10, 1.5), act('BUY', 10, 100, 1, 1), act('BUY', 10, 120, 3, 1)]);
  // cost 1600, entry fees 1 + 0.5, proceeds 1950, exit fee 1.5
  assert.ok(Math.abs(m.trades[0].returnPct - (1950 - 1600 - 1.5 - 1.5) / (1600 + 1.5)) < 1e-12);
});

test('F-36 AC5: a lot with no basis (price 0) is never priced from its fees: the sell stays counted', () => {
  const only = [act('BUY', 1, 0, 1, 3), act('SELL', 1, 12, 5)];
  const m1 = matchTrades(only);
  assert.deepEqual([m1.trades.length, m1.excluded, m1.excludedCorporate], [0, 0, 1]);
  partition(m1, only);
  // A mixed draw: one priced lot and one lot with price 0.
  const mixed = [act('BUY', 1, 10, 1, 1), act('BUY', 1, 0, 2, 3), act('SELL', 2, 12, 5)];
  const m2 = matchTrades(mixed);
  assert.deepEqual([m2.trades.length, m2.excluded, m2.excludedCorporate], [0, 0, 1]);
  partition(m2, mixed);
  // No fee at all: still counted, never shown as an infinite return.
  const free = [act('BUY', 1, 0, 1), act('SELL', 1, 12, 5)];
  const m3 = matchTrades(free);
  assert.deepEqual([m3.trades.length, m3.excludedCorporate], [0, 1]);
  // A later sell of the pair from a priced lot is shown as usual.
  const later = [act('BUY', 1, 0, 1, 3), act('SELL', 1, 12, 5), act('BUY', 1, 10, 6, 1), act('SELL', 1, 12, 8)];
  const m4 = matchTrades(later);
  assert.deepEqual([m4.trades.length, m4.excludedCorporate], [1, 1]);
  assert.ok(Math.abs(m4.trades[0].returnPct - (12 - 10 - 1) / 11) < 1e-12);
  partition(m4, later);
});

test('F-36 AC5: a gapped sell that draws a no-basis lot is counted in excludedCorporate (the guard comes first)', () => {
  // An oversell opens a gap; the next sell draws a price-0 lot: the no-basis guard names its cause.
  const acts = [act('SELL', 2, 10, 1), act('BUY', 1, 0, 2, 3), act('SELL', 1, 12, 5)];
  const m = matchTrades(acts);
  assert.deepEqual([m.trades.length, m.excluded, m.excludedCorporate], [0, 1, 1]);
  partition(m, acts);
  // Without the no-basis lot the same gapped sell is "no recorded entry" (unchanged).
  const plain = [act('SELL', 2, 10, 1), act('BUY', 1, 10, 2, 3), act('SELL', 1, 12, 5)];
  const p = matchTrades(plain);
  assert.deepEqual([p.trades.length, p.excluded, p.excludedCorporate], [0, 2, 0]);
});

test('F-36: MATCHER_VERSION is bumped to 3 so the deploy rebuilds every record once', () => {
  assert.equal(MATCHER_VERSION, 3);
});

test('F-36 AC6: signChanges counts changed returns and sign changes among closes in both maps only', () => {
  const before = new Map([['a', 0.5], ['b', -0.2], ['c', 0], ['gone', 0.1]]);
  assert.deepEqual(signChanges(before, new Map([['a', 0.4], ['b', -0.2], ['c', 0], ['new', 1]])), { changed: 1, signChanged: 0 });
  assert.deepEqual(signChanges(before, new Map([['a', -0.1], ['b', -0.1], ['c', 0]])), { changed: 2, signChanged: 1 });
  assert.deepEqual(signChanges(new Map(), new Map()), { changed: 0, signChanged: 0 });
});

// ---- AC8: no page, payload or image shows a fee amount ----
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = `${dir}/${f}`;
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
});
// A fee identifier or field: `fee`, `fees`, `entryFee(s)`, `exitFee`, `fee_…`, `feePerUnit`. ("feed" is not one.)
const FEE = /\bfees?\b|[a-z]Fees?\b|\bfees?_|\bfee[A-Z]|\bfees[A-Z]/;
const SHARE_FILES = ['share.ts', 'share-actions.ts', 'share-prompt.ts', 'record-card.ts', 'trade-share.ts', 'trade-share-load.ts', 'month-card.ts', 'card-head.ts', 'views-shared.ts'];

test('F-36 AC8: source scan: no fee identifier in app/** (pages, routes, images) or the share-card and payload builders', () => {
  const files = [...walk(new URL('app', ROOT).pathname), ...SHARE_FILES.map((f) => new URL(`lib/${f}`, ROOT).pathname)];
  assert.ok(files.length > 50, `${files.length} files scanned`);
  const hits = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l] as const).filter(([, , l]) => FEE.test(l)));
  assert.deepEqual(hits.map(([f, i]) => `${f.slice(ROOT.pathname.length)}:${i}`), []);
});

test('F-36 AC8: no new column: closed_trades and option_trades have no fee column; a shown trade carries no fee key', () => {
  const schema = readFileSync(new URL('db/schema.sql', ROOT), 'utf8');
  for (const table of ['closed_trades', 'option_trades']) {
    const ddl = schema.match(new RegExp(`create table if not exists ${table} \\(([\\s\\S]*?)\\n\\);`, 'i'));
    assert.ok(ddl, `${table} DDL found`);
    assert.doesNotMatch(ddl[1], /fee/i, table);
    assert.doesNotMatch(schema, new RegExp(`schema_add_column\\('${table}', '(?:[a-z0-9]+_)*fees?(?:_[a-z0-9]+)*'`, 'i')); // "feed_after" is not one
  }
  const m = matchTrades([act('BUY', 2, 5, 1, 10), act('SELL', 2, 15, 5, 7)]);
  for (const t of m.trades) assert.deepEqual(Object.keys(t).filter((k) => /fee/i.test(k)), []);
  assert.doesNotMatch(JSON.stringify(m), /fee/i);
});
