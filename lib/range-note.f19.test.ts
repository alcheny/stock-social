// F-19 · What's-this line, first slice: RANGE_NOTE exists as one constant, it is true of the computation behind every
// printed range (lib/record-card.ts#cardEvidence, the arithmetic range of the average per trade), and it uses no advice,
// signal, skill, edge, pick or forecast word. Placement on the stats row is the sweep rework (after F-18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RANGE_NOTE } from './copy.ts';
import { cardEvidence } from './record-card.ts';
import { arithmeticRange } from './bets.ts';
import { headline, type ConfidenceInput } from './trades.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);
const record = (rs: number[]): ConfidenceInput[] => rs.map((r, i) => ({
  symbol: `S${i}`, openedAt: new Date(t0 + i * 10 * DAY), closedAt: new Date(t0 + (i * 10 + 5) * DAY), returnPct: r, holdingDays: 5,
}));
const now = new Date(t0 + 400 * DAY);

test('F-19 RANGE_NOTE: one constant with the decided words', () => {
  assert.equal(RANGE_NOTE, 'the range is for the average, not one trade');
});

test('F-19 RANGE_NOTE is true: the range is centred on the average and single trades fall outside it', () => {
  const fixtures = [
    [0.12, -0.05, 0.03, -0.08, 0.2, 0.01, -0.02, 0.07, -0.11, 0.04, 0.09, -0.03],
    Array.from({ length: 30 }, (_, i) => (i === 0 ? 9 : -0.05)), // 1 × +900%, 29 × −5%
    Array.from({ length: 40 }, (_, i) => (i % 2 ? -0.3 : 0.6)),
  ];
  for (const rs of fixtures) {
    const trades = record(rs);
    const e = cardEvidence(trades, now);
    const r = arithmeticRange(trades)!;
    const { avgReturn } = headline(trades);
    assert.ok(e.perTrade, 'a range is printed');
    assert.ok(Math.abs(e.perTrade.mid - avgReturn) < 1e-12, 'the range is for the average');
    assert.deepEqual(e.perTrade, { low: r.low, mid: r.mid, high: r.high });
    assert.ok(e.perTrade.low <= avgReturn && avgReturn <= e.perTrade.high, 'lo <= avg <= hi');
    assert.ok(rs.some((x) => x < e.perTrade!.low || x > e.perTrade!.high), 'not one trade: a single trade lies outside the range');
  }
});

test('F-19 RANGE_NOTE uses no advice, signal, skill, edge, pick or forecast word (whole words, any case)', () => {
  const banned = ['advice', 'advise', 'recommend', 'signal', 'skill', 'skilled', 'edge', 'pick', 'picks', 'guarantee', 'guaranteed',
    'expect', 'expected', 'will', 'should', 'buy', 'sell', 'predict', 'forecast'];
  const words = RANGE_NOTE.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const w of banned) assert.ok(!words.includes(w), w);
});
