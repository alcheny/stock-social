import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineVerdict, type Baseline, type TickerSummary } from './ticker.ts';

const conf = (low: number, mid: number, high: number): TickerSummary['conf'] =>
  ({ n: 20, k: 12, spanDays: 100, tier: 'thin', edge: 'unclear', perTrade: { low, mid, high }, pace30: null, tradesPerMonth: 5 });
const summary = (over: Partial<TickerSummary> = {}): TickerSummary =>
  ({ n: 20, wins: 12, losses: 8, winRate: 0.6, avgReturn: 0.02, traders: 12, demoOnly: false, mixed: false, conf: conf(0.01, 0.03, 0.05), ...over });
const base = (over: Partial<Baseline> = {}): Baseline => ({ n: 100, winRate: 0.5, perTrade: 0.02, demoOnly: false, ...over });

test('empty baseline', () => {
  assert.equal(baselineVerdict(summary(), base({ n: 0, winRate: null, perTrade: null })).kind, 'empty');
  assert.equal(baselineVerdict(summary(), base({ perTrade: null })).kind, 'empty');
});

test('too few bets: no verdict, win rate delta still computed', () => {
  const r = baselineVerdict(summary({ conf: { ...conf(0, 0, 0)!, perTrade: null, k: 3, tier: 'too-early', edge: null } }), base());
  assert.equal(r.kind, 'too_few_trades');
  assert.ok(Math.abs(r.winRateDelta! - 0.1) < 1e-9);
  assert.equal(baselineVerdict(summary({ conf: null }), base()).kind, 'too_few_trades');
});

test('overlap and exact boundaries are no clear difference', () => {
  assert.equal(baselineVerdict(summary(), base({ perTrade: 0.03 })).kind, 'no_clear_difference');
  assert.equal(baselineVerdict(summary(), base({ perTrade: 0.05 })).kind, 'no_clear_difference');
  assert.equal(baselineVerdict(summary(), base({ perTrade: 0.01 })).kind, 'no_clear_difference');
});

test('clearly lower / higher are mirror images', () => {
  assert.equal(baselineVerdict(summary(), base({ perTrade: 0.06 })).kind, 'clearly_lower');
  assert.equal(baselineVerdict(summary(), base({ perTrade: 0.005 })).kind, 'clearly_higher');
  const loss = summary({ conf: conf(-0.09, -0.07, -0.05) });
  assert.equal(baselineVerdict(loss, base({ perTrade: 0.02 })).kind, 'clearly_lower');
  assert.equal(baselineVerdict(loss, base({ perTrade: -0.2 })).kind, 'clearly_higher');
});

test('demo-only ticker never gets a verdict; mixed uses the interval', () => {
  assert.equal(baselineVerdict(summary({ demoOnly: true }), base({ perTrade: 0.9, demoOnly: true })).kind, 'demo_only');
  assert.equal(baselineVerdict(summary({ mixed: true }), base({ perTrade: 0.9 })).kind, 'clearly_lower');
});

test('winRateDelta is null when either side is null', () => {
  assert.equal(baselineVerdict(summary({ winRate: null }), base()).winRateDelta, null);
  assert.equal(baselineVerdict(summary(), base({ winRate: null })).winRateDelta, null);
});
