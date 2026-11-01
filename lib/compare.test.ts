import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPARE_COPY, compareDescription, compareTickers, parseCompare, tickerSummary, type TickerRow } from './ticker.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);
const row = (userId: number, open: number, close: number, r: number, verified = true): TickerRow => ({
  userId, returnPct: r, holdingDays: close - open, openedAt: new Date(t0 + open * DAY), closedAt: new Date(t0 + close * DAY), verified,
});
const today = new Date(t0 + 400 * DAY);
const A = [row(1, 0, 5, 0.1), row(2, 10, 15, -0.05), row(3, 20, 25, 0.02)];
const B = [row(1, 0, 5, 0.2), row(4, 10, 15, -0.1)];

test('compare: both populated match tickerSummary, spread n equals rows', () => {
  const c = compareTickers(A, B, today);
  assert.deepEqual(c.a.summary, tickerSummary(A, today));
  assert.deepEqual(c.b.summary, tickerSummary(B, today));
  assert.equal(c.a.spread.n, 3);
  assert.equal(c.b.spread.n, 2);
  assert.equal(c.sameTraders, 1);
});

test('compare: one side empty', () => {
  const c = compareTickers(A, [], today);
  assert.equal(c.b.empty, true);
  assert.equal(c.a.empty, false);
  assert.equal(c.sameTraders, 0);
  assert.deepEqual(c.a.summary, tickerSummary(A, today));
});

test('compare: parseCompare kinds', () => {
  assert.deepEqual(parseCompare('nvda', 'NVDA'), { kind: 'same', a: 'NVDA' });
  assert.deepEqual(parseCompare('nvda', 'amd'), { kind: 'ok', a: 'NVDA', b: 'AMD' });
  assert.equal(parseCompare('nvda', undefined).kind, 'missing');
  assert.equal(parseCompare('nvda', '').kind, 'missing');
  assert.equal(parseCompare('<b>x', 'amd').kind, 'invalid');
});

test('compare: demo-only and mixed sides', () => {
  const demo = compareTickers([row(1, 0, 5, 0.1, false)], A, today);
  assert.equal(demo.a.summary.demoOnly, true);
  assert.equal(demo.a.summary.mixed, false);
  const mixed = compareTickers([row(1, 0, 5, 0.1, false), row(2, 0, 5, 0.1)], A, today);
  assert.equal(mixed.a.summary.mixed, true);
});

test('compare: overlap counts verified rows only, each trader once', () => {
  const a = [row(1, 0, 5, 0.1), row(1, 6, 9, 0.1), row(2, 0, 5, 0.1, false), row(3, 0, 5, 0.1)];
  const b = [row(1, 0, 5, 0.1), row(2, 0, 5, 0.1), row(3, 0, 5, 0.1, false)];
  assert.equal(compareTickers(a, b, today).sameTraders, 1);
});

test('compare: too early side keeps its interval', () => {
  const c = compareTickers(B, A, today);
  assert.equal(c.a.summary.conf!.tier, 'too-early');
  assert.equal(c.a.tier, 'too-early');
  assert.notEqual(c.a.summary.conf, null);
});

test('compare: numbers parity with an empty other side', () => {
  assert.deepEqual(compareTickers(A, [], today).a.summary, tickerSummary(A, today));
});

test('compare: copy has no verdict wording', () => {
  const c = compareTickers(A, B, today);
  const strings: string[] = [
    COMPARE_COPY.title, COMPARE_COPY.explainer, COMPARE_COPY.pick, COMPARE_COPY.invalid('XX'), COMPARE_COPY.same('NVDA'),
    COMPARE_COPY.bothEmpty('A', 'B'), COMPARE_COPY.emptySide('A'), COMPARE_COPY.overlap(0, 'A', 'B'), COMPARE_COPY.overlap(1, 'A', 'B'),
    COMPARE_COPY.overlap(2, 'A', 'B'), COMPARE_COPY.footer, COMPARE_COPY.tooEarly, COMPARE_COPY.demoOnly, COMPARE_COPY.mixed,
    compareDescription('A', 'B', c), compareDescription('A', 'B', compareTickers(A, [], today)),
    compareDescription('A', 'B', compareTickers([], [], today)), compareDescription('A', 'B', compareTickers([row(1, 0, 5, 0.1, false)], B, today)),
  ];
  for (const s of strings) assert.doesNotMatch(s, /winner|better|beats|outperform/i);
  assert.match(compareDescription('A', 'B', compareTickers([row(1, 0, 5, 0.1, false)], B, today)), /Sample data/);
});
