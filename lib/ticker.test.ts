import { test } from 'node:test';
import assert from 'node:assert/strict';
import { concentration, MIN_REST, selectTheses, THESIS_CAP, type ThesisRow, decodeSymbolParam,monthlyTimeline, normalizeSymbol, parseTickerSort, tickerIndex, tickerSummary, timelineCaption, type SymbolAggregate, type TickerRow } from './ticker.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);
const row = (userId: number, open: number, close: number, r: number, verified = true): TickerRow => ({
  userId, returnPct: r, holdingDays: close - open, openedAt: new Date(t0 + open * DAY), closedAt: new Date(t0 + close * DAY), verified,
});
const today = new Date(t0 + 400 * DAY);

test('ticker summary: empty', () => {
  const s = tickerSummary([], today);
  assert.equal(s.n, 0);
  assert.equal(s.winRate, null);
  assert.equal(s.avgReturn, null);
  assert.equal(s.conf, null);
  assert.equal(s.demoOnly, false);
  assert.equal(s.mixed, false);
});

test('ticker summary: all losses are counted, not hidden', () => {
  const s = tickerSummary([row(1, 0, 5, -0.1), row(2, 10, 15, -0.05), row(3, 20, 25, 0)], today);
  assert.equal(s.n, 3);
  assert.equal(s.losses, 3);
  assert.equal(s.wins, 0);
  assert.equal(s.winRate, 0);
  assert.ok(s.avgReturn! < 0);
});

test('ticker summary: a mix', () => {
  const s = tickerSummary([row(1, 0, 5, 0.1), row(1, 10, 15, -0.02), row(2, 20, 25, 0.04), row(3, 30, 35, -0.04)], today);
  assert.equal(s.wins, 2);
  assert.equal(s.losses, 2);
  assert.equal(s.winRate, 0.5);
  assert.ok(Math.abs(s.avgReturn! - 0.02) < 1e-9);
  assert.equal(s.traders, 3);
  assert.ok(s.conf);
});

test('ticker summary: demo-only and mixed flags', () => {
  const demo = tickerSummary([row(1, 0, 5, 0.1, false), row(2, 0, 5, 0.1, false)], today);
  assert.equal(demo.demoOnly, true);
  assert.equal(demo.mixed, false);
  const mixed = tickerSummary([row(1, 0, 5, 0.1, false), row(2, 0, 5, 0.1, true)], today);
  assert.equal(mixed.demoOnly, false);
  assert.equal(mixed.mixed, true);
  const real = tickerSummary([row(1, 0, 5, 0.1)], today);
  assert.equal(real.demoOnly, false);
  assert.equal(real.mixed, false);
});

test("ticker summary: one trader's overlapping holds are one bet; two traders are two", () => {
  assert.equal(tickerSummary([row(1, 0, 10, 0.1), row(1, 5, 15, 0.1)], today).conf!.k, 1);
  assert.equal(tickerSummary([row(1, 0, 10, 0.1), row(2, 0, 10, 0.1)], today).conf!.k, 2);
});

test('normalizeSymbol', () => {
  assert.equal(normalizeSymbol(' nvda '), 'NVDA');
  assert.equal(normalizeSymbol('brk.b'), 'BRK.B');
  assert.equal(normalizeSymbol('bf-b'), 'BF-B');
  for (const bad of ['', 'a b', 'x'.repeat(11), "'; drop table", '<script>', '1abc']) assert.equal(normalizeSymbol(bad), null);
});

const agg = (symbol: string, day: number, verifiedTrades = 1, trades = 2): SymbolAggregate => ({ symbol, trades, traders: 1, lastClosedAt: new Date(t0 + day * DAY), verifiedTrades });

test('tickerIndex: empty and one symbol', () => {
  assert.deepEqual(tickerIndex([], 'recent'), []);
  const [r] = tickerIndex([agg('NVDA', 3, 2, 5)], 'recent');
  assert.equal(r.symbol, 'NVDA');
  assert.equal(r.trades, 5);
  assert.equal(r.traders, 1);
  assert.equal(r.demoOnly, false);
});

test('tickerIndex: recency order with ties by symbol, and A-Z', () => {
  const rows = [agg('MSFT', 1), agg('TSLA', 5), agg('AAPL', 5), agg('NVDA', 3)];
  assert.deepEqual(tickerIndex(rows, 'recent').map((r) => r.symbol), ['AAPL', 'TSLA', 'NVDA', 'MSFT']);
  assert.deepEqual(tickerIndex(rows, 'az').map((r) => r.symbol), ['AAPL', 'MSFT', 'NVDA', 'TSLA']);
});

test('tickerIndex: demo-only flagged, mixed not', () => {
  const [a, b] = tickerIndex([agg('AAA', 2, 0, 3), agg('BBB', 1, 1, 3)], 'az');
  assert.equal(a.demoOnly, true);
  assert.equal(b.demoOnly, false);
});

test('tickerIndex: unknown sort falls back to recency; input not mutated', () => {
  const rows = [agg('B', 1), agg('A', 2)];
  const copy = [...rows];
  for (const s of ['garbage', undefined, '']) assert.deepEqual(tickerIndex(rows, s).map((r) => r.symbol), ['A', 'B']);
  assert.deepEqual(rows, copy);
  assert.equal(parseTickerSort('az'), 'az');
  assert.equal(parseTickerSort(['az']), 'recent');
  assert.equal(parseTickerSort(undefined), 'recent');
});

const at = (iso: string, returnPct = 0.1) => ({ returnPct, closedAt: new Date(iso) });
const TODAY = new Date('2026-06-15T12:00:00Z');
const tl = (rs: { returnPct: number; closedAt: Date }[]) => monthlyTimeline(rs, TODAY);
const sum = (t: ReturnType<typeof tl>) => t.buckets.reduce((a, b) => a + b.n, 0);
const byMonth = (t: ReturnType<typeof tl>) => Object.fromEntries(t.buckets.map((b) => [b.month, b.n]));

test('timeline: empty', () => {
  const t = tl([]);
  assert.equal(t.buckets.length, 25);
  assert.ok(t.buckets.every((b) => b.n === 0));
  assert.equal(t.n, 0);
  assert.equal(t.monthsWithTrades, 0);
  assert.equal(timelineCaption(t), 'No trades');
});

test('timeline: single trade in current month', () => {
  const t = tl([at('2026-06-02T00:00:00Z')]);
  assert.equal(t.buckets[0].month, 'earlier');
  assert.equal(t.buckets[1].month, '2024-07');
  assert.equal(t.buckets[24].month, '2026-06');
  assert.equal(t.buckets[24].up, 1);
  assert.equal(sum(t), 1);
  assert.equal(timelineCaption(t), '1 trade closed: 1 up, across 1 month with trades');
});

test('timeline: gap months are zeros and series is contiguous', () => {
  const t = tl([at('2026-06-01T00:00:00Z'), at('2026-03-10T00:00:00Z')]);
  const by = byMonth(t);
  assert.equal(by['2026-05'], 0);
  assert.equal(by['2026-04'], 0);
  assert.equal(by['2026-03'], 1);
  assert.equal(t.monthsWithTrades, 2);
  const keys = t.buckets.slice(1).map((b) => b.month);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(new Set(keys).size, 24);
});

test('timeline: all losses', () => {
  const t = tl([at('2026-05-01T00:00:00Z', -0.1), at('2026-05-20T00:00:00Z', -0.3)]);
  assert.deepEqual(t.buckets.find((x) => x.month === '2026-05'), { month: '2026-05', up: 0, down: 2, flat: 0, n: 2 });
});

test('timeline: 0, -0 and NaN count flat', () => {
  const t = tl([at('2026-05-01T00:00:00Z', 0), at('2026-05-02T00:00:00Z', -0)]);
  assert.equal(t.buckets.find((x) => x.month === '2026-05')!.flat, 2);
  assert.match(timelineCaption(t), /2 flat/);
  assert.equal(sum(tl([at('2026-05-01T00:00:00Z', NaN)])), 1);
});

test('timeline: older than 24 months folds into earlier', () => {
  const t = tl([at('2024-06-30T00:00:00Z'), at('2020-01-01T00:00:00Z'), at('2024-07-01T00:00:00Z')]);
  assert.equal(t.buckets[0].n, 2);
  assert.equal(t.buckets[1].n, 1);
  assert.equal(sum(t), 3);
  assert.equal(timelineCaption(tl([at('2020-01-01T00:00:00Z')])), '1 trade closed: 1 up, all before the last 24 months');
});

test('timeline: UTC month boundaries', () => {
  const by = byMonth(tl([at('2026-03-31T23:59:59Z'), at('2026-04-01T00:00:00Z')]));
  assert.equal(by['2026-03'], 1);
  assert.equal(by['2026-04'], 1);
});

test('timeline: future closedAt is clamped, sum holds', () => {
  const t = tl([at('2027-01-01T00:00:00Z')]);
  assert.equal(t.buckets[24].n, 1);
  assert.equal(sum(t), 1);
});

test('timeline: pure, no extra fields, caption pluralises', () => {
  const rows = [at('2026-06-01T00:00:00Z'), at('2026-05-01T00:00:00Z', -0.1)];
  const copy = JSON.stringify(rows);
  const t = tl(rows);
  assert.equal(JSON.stringify(rows), copy);
  assert.deepEqual(Object.keys(t.buckets[3]).sort(), ['down', 'flat', 'month', 'n', 'up']);
  assert.equal(timelineCaption(t), '2 trades closed: 1 up, 1 down, across 2 months with trades');
});

test('decodeSymbolParam', () => {
  assert.equal(decodeSymbolParam('nvda'), 'NVDA');
  assert.equal(decodeSymbolParam('%E0%A4%A'), null);
  assert.equal(decodeSymbolParam(''), null);
});

const th = (id: number, closeDay: number, over: Partial<ThesisRow> = {}): ThesisRow => ({
  id, handle: 'h', thesis: `why ${id}`, thesisStatus: 'published', returnPct: 0.05, holdingDays: 3, closedAt: new Date(t0 + closeDay * DAY), verified: true, ...over,
});

test('selectTheses: empty', () => {
  assert.deepEqual(selectTheses([]), { items: [], n: 0, demoOnly: false, mixed: false });
});

test('selectTheses: held, pending and null status excluded', () => {
  const r = selectTheses([th(1, 1, { thesisStatus: 'held' }), th(2, 2, { thesisStatus: 'pending' }), th(3, 3, { thesisStatus: null }), th(4, 4)]);
  assert.deepEqual(r.items.map((i) => i.id), [4]);
});

test('selectTheses: null, empty and blank text excluded; text trimmed', () => {
  const r = selectTheses([th(1, 1, { thesis: null }), th(2, 2, { thesis: '' }), th(3, 3, { thesis: '  \n ' }), th(4, 4, { thesis: ' ok ' })]);
  assert.deepEqual(r.items.map((i) => [i.id, i.thesis]), [[4, 'ok']]);
});

test('selectTheses: a loss is included with its sign', () => {
  const r = selectTheses([th(1, 1, { returnPct: -0.05 })]);
  assert.equal(r.items[0].returnPct, -0.05);
});

test('selectTheses: newest first, ties by id desc, never by return', () => {
  const r = selectTheses([th(1, 1, { returnPct: 0.9 }), th(2, 5, { returnPct: -0.01 }), th(3, 3), th(4, 3)]);
  assert.deepEqual(r.items.map((i) => i.id), [2, 4, 3, 1]);
});

test('selectTheses: caps at 20 newest', () => {
  const r = selectTheses(Array.from({ length: 25 }, (_, i) => th(i + 1, i)));
  assert.equal(THESIS_CAP, 20);
  assert.equal(r.n, 20);
  assert.equal(r.items[0].id, 25);
  assert.equal(r.items[19].id, 6);
});

test('selectTheses: demoOnly and mixed flags', () => {
  const d = selectTheses([th(1, 1, { verified: false })]);
  assert.equal(d.demoOnly, true); assert.equal(d.mixed, false);
  const m = selectTheses([th(1, 1, { verified: false }), th(2, 2)]);
  assert.equal(m.mixed, true); assert.equal(m.demoOnly, false);
  const v = selectTheses([th(1, 1)]);
  assert.equal(v.mixed, false); assert.equal(v.demoOnly, false);
});

test('selectTheses: does not mutate input', () => {
  const rows = [th(1, 1), th(2, 2)];
  selectTheses(rows);
  assert.deepEqual(rows.map((r) => r.id), [1, 2]);
});

const many = (userId: number, n: number, r = 0.01, verified = true) => Array.from({ length: n }, (_, i) => row(userId, i, i + 1, r, verified));

test('concentration: fewer than 2 trades is null', () => {
  assert.equal(concentration([], today), null);
  assert.equal(concentration(many(1, 1), today), null);
});

test('concentration: single trader', () => {
  assert.deepEqual(concentration(many(1, 4), today), { kind: 'single', n: 4 });
});

test('concentration: ties report counts, no comparison', () => {
  const two = concentration([...many(1, 3), ...many(2, 3), ...many(3, 1)], today);
  assert.deepEqual(two, { kind: 'tie', n: 7, tied: 2, each: 3, share: 3 / 7 });
  const three = concentration([...many(1, 2), ...many(2, 2), ...many(3, 2)], today);
  assert.ok(three?.kind === 'tie' && three.tied === 3);
});

test('concentration: exactly MIN_REST remaining compares, one fewer does not', () => {
  assert.equal(MIN_REST, 5);
  const c = concentration([...many(1, 6), ...many(2, 3), ...many(3, 2)], today);
  assert.ok(c?.kind === 'compare' && c.rest.n === 5);
  const f = concentration([...many(1, 6), ...many(2, 4)], today);
  assert.deepEqual(f, { kind: 'too-few', n: 10, top: 6, share: 0.6, rest: 4 });
  assert.equal('winRate' in f!, false);
});

test('concentration: remaining win rate and average exclude the top trader', () => {
  const rest = [0.1, -0.05, 0.2, -0.1, 0.05].map((r, i) => row(2 + (i % 2), i, i + 1, r));
  const c = concentration([...many(1, 6, 0.9), ...rest], today);
  assert.ok(c?.kind === 'compare');
  assert.equal(c.top, 6);
  assert.equal(c.rest.n, 5);
  assert.equal(c.rest.winRate, 0.6);
  assert.ok(Math.abs(c.rest.avgReturn! - 0.04) < 1e-9);
});

test('concentration: demo flags come from the remaining rows', () => {
  const allDemo = concentration([...many(1, 6), ...many(2, 5, 0.01, false)], today);
  assert.ok(allDemo?.kind === 'compare' && allDemo.rest.demoOnly && !allDemo.rest.mixed);
  const mixed = concentration([...many(1, 6), ...many(2, 4), ...many(3, 1, 0.01, false)], today);
  assert.ok(mixed?.kind === 'compare' && mixed.rest.mixed && !mixed.rest.demoOnly);
  const topDemo = concentration([...many(1, 6, 0.01, false), ...many(2, 3), ...many(3, 2)], today);
  assert.ok(topDemo?.kind === 'compare' && !topDemo.rest.demoOnly && !topDemo.rest.mixed);
});

test('concentration: counts every row, not a 500 cap', () => {
  const rows = [...many(1, 300), ...[2, 3, 4, 5, 6, 7].flatMap((u) => many(u, 50))];
  const c = concentration(rows, today);
  assert.ok(c?.kind === 'compare');
  assert.equal(c.n, 600);
  assert.equal(c.top, 300);
  assert.equal(c.share, 0.5);
  assert.equal(c.rest.n, 300);
  const late = [...[2, 3, 4].flatMap((u) => many(u, 100)), ...many(1, 101)];
  const l = concentration(late, today);
  assert.ok(l?.kind === 'compare' && l.top === 101 && l.rest.n === 300);
});

test('concentration: row order does not matter and the result names nobody', () => {
  // binary-exact returns so float summation order cannot differ
  const rows = [...many(1, 6, 0.5), ...many(2, 3, 0.25), ...many(3, 2, -0.25)];
  const a = concentration(rows, today);
  assert.deepEqual(a, concentration([...rows].reverse(), today));
  assert.doesNotMatch(JSON.stringify(a), /userId|handle|rank/i);
});

import { canWatch, watchSummary, WATCH_CAP } from './ticker.ts';

const D = (n: number) => new Date(t0 + n * DAY);
const tr = (symbol: string, day: number, verified = true) => ({ symbol, closedAt: D(day), verified });

test('canWatch: invalid, cap, lowercase', () => {
  for (const bad of ['BRK.B!', '', '  ']) {
    const r = canWatch(0, bad);
    assert.equal(r.ok, false);
    if (!r.ok) { assert.equal(r.reason, 'invalid'); assert.equal(r.message, "That isn't a valid stock symbol."); }
  }
  assert.equal(WATCH_CAP, 25);
  assert.deepEqual(canWatch(24, 'nvda'), { ok: true, symbol: 'NVDA' });
  const c = canWatch(25, 'NVDA');
  assert.equal(c.ok, false);
  if (!c.ok) { assert.equal(c.reason, 'cap'); assert.equal(c.message, "You're watching 25 stocks, the maximum. Unwatch one to add another."); }
  const both = canWatch(25, '!!');
  if (!both.ok) assert.equal(both.reason, 'invalid');
});

test('watchSummary: empty, none new, strict >, mix, demo-only, alphabetical', () => {
  assert.deepEqual(watchSummary([], [tr('NVDA', 1)]), []);
  assert.deepEqual(watchSummary([{ symbol: 'NVDA', lastSeenAt: D(5) }], [tr('NVDA', 1)]), [{ symbol: 'NVDA', newCount: 0, demoOnly: false }]);
  assert.equal(watchSummary([{ symbol: 'NVDA', lastSeenAt: D(5) }], [tr('NVDA', 5), tr('NVDA', 6)])[0].newCount, 1);
  const out = watchSummary(
    [{ symbol: 'TSM', lastSeenAt: D(0) }, { symbol: 'AMD', lastSeenAt: D(10) }, { symbol: 'ZZZ', lastSeenAt: D(0) }, { symbol: 'MU', lastSeenAt: D(0) }],
    [tr('TSM', 1, false), tr('TSM', 2, false), tr('AMD', 5), tr('AMD', 11), tr('MU', 3, true), tr('MU', 4, false), tr('OTHER', 3)],
  );
  assert.deepEqual(out, [
    { symbol: 'AMD', newCount: 1, demoOnly: false },
    { symbol: 'MU', newCount: 1, demoOnly: false },
    { symbol: 'TSM', newCount: 2, demoOnly: true },
    { symbol: 'ZZZ', newCount: 0, demoOnly: false },
  ]);
});
