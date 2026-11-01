// F-19 (veto condition DK, LG): the number-format slice leaves ranking and evidence untouched. Pins confidence()'s
// fields, RANK_MIN_BETS, rankTraders' order and headline()'s D23 keys on fixed fixtures, so a formatting change that
// moved any of them fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confidence, evidenceWeight, headline, rankTraders, type ConfidenceInput } from './trades.ts';
import { MIN_BETS, RANK_MIN_BETS } from './confidence.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);
const record = (rs: number[]): ConfidenceInput[] => rs.map((r, i) => ({
  symbol: `S${i % 7}`, openedAt: new Date(t0 + i * 6 * DAY), closedAt: new Date(t0 + (i * 6 + 4) * DAY), returnPct: r, holdingDays: 4,
}));
const today = new Date(t0 + 400 * DAY);
const round = (x: number) => Math.round(x * 1e10) / 1e10;
const roundAll = (v: unknown): unknown => (typeof v === 'number' ? round(v) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, roundAll(x)])) : v);

test('F-19 pin: RANK_MIN_BETS and MIN_BETS', () => {
  assert.equal(RANK_MIN_BETS, 10);
  assert.equal(MIN_BETS, 5);
});

test('F-19 pin: headline() keeps the D23 order (win rate, then average return)', () => {
  assert.deepEqual(Object.keys(headline([{ returnPct: 0.1 }, { returnPct: -0.05 }])), ['winRate', 'avgReturn']);
  assert.deepEqual(headline([{ returnPct: 0.1 }, { returnPct: -0.05 }, { returnPct: 0 }]), { winRate: 1 / 3, avgReturn: 0.05 / 3 });
});

const A = record(Array.from({ length: 40 }, (_, i) => (i % 3 ? 0.04 : -0.03)));
const B = record(Array.from({ length: 20 }, (_, i) => (i % 2 ? 0.5 : -0.4)));
const C = record([0.02, -0.01, 0.03]);

test('F-19 pin: confidence() fields on fixed records', () => {
  assert.deepEqual(roundAll(confidence(A, today)), PIN_A);
  assert.deepEqual(roundAll(confidence(C, today)), PIN_C);
});

test('F-19 pin: rankTraders order and evidence weights', () => {
  const items = [{ id: 'A', c: confidence(A, today) }, { id: 'B', c: confidence(B, today) }, { id: 'C', c: confidence(C, today) }]
    .map((x) => ({ id: x.id, weight: evidenceWeight(x.c), score: headline(x.id === 'A' ? A : x.id === 'B' ? B : C).avgReturn }));
  assert.deepEqual(items.map((x) => round(x.weight)), PIN_WEIGHTS);
  assert.deepEqual(rankTraders(items).map((x) => x.id), PIN_ORDER);
  assert.deepEqual(rankTraders(items.toReversed()).map((x) => x.id), PIN_ORDER); // order comes from the sort, not the input
});

// Values computed on origin/main before the F-19 slice (2026-11-01) and on this branch: identical.
const PIN_A = {
  n: 40, k: 40, spanDays: 238, tradesPerMonth: 5.0420168067, tier: 'moderate', edge: 'positive',
  perTrade: { low: 0.0040826432, mid: 0.0149432919, high: 0.0259214147 },
  pace30: { low: 0.0310291613, mid: 0.1176693247, high: 0.2115900949 },
};
const PIN_C = { n: 3, k: 3, spanDays: 16, tradesPerMonth: 3, tier: 'too-early', edge: null, perTrade: null, pace30: null };
const PIN_WEIGHTS = [0.0305574891, 0, 0];
const PIN_ORDER = ['A', 'B', 'C'];
