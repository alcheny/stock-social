// F-4 rework (owner decision 2026-10-31): the card's "likely between" range is a 95% range around the arithmetic
// average per trade (lib/bets.ts), so the headline always sits inside it. Committee 2026-11-01 (plan v2): the clusters
// equal confidence()'s, tierFor equals confidence()'s tier, the range holds the headline on floats and printed strings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arithmeticRange, betClusters } from './bets.ts';
import { confidence, headline, pct, tCrit95, type ConfidenceInput } from './trades.ts';
import { MIN_BETS, tierFor, tooWide } from './confidence.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2025, 0, 1);
const today = new Date(Date.UTC(2026, 10, 1));
const tr = (symbol: string, open: number, close: number, r: number): ConfidenceInput => ({
  symbol, openedAt: new Date(t0 + open * DAY), closedAt: new Date(t0 + close * DAY), returnPct: r, holdingDays: close - open,
});
let seed = 20261101;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
// Random records: few symbols (so holds overlap into multi-trade bets), holds that touch exactly at the boundary,
// equal entry instants, and one symbol held in several separate runs.
function randomRecord(): ConfidenceInput[] {
  const n = 1 + Math.floor(rnd() * 80), symbols = 1 + Math.floor(rnd() * 12), vol = [0.01, 0.05, 0.3, 0.6][Math.floor(rnd() * 4)];
  const out: ConfidenceInput[] = [];
  for (let i = 0; i < n; i++) {
    const open = Math.floor(rnd() * 400) / (rnd() < 0.3 ? 1 : 4); // whole days often: equal and touching instants
    const close = open + (rnd() < 0.2 ? 0 : Math.floor(rnd() * 20));
    out.push(tr(`S${Math.floor(rnd() * symbols)}`, open, close, Math.max(-0.99, (rnd() - 0.45) * 2 * vol)));
  }
  if (rnd() < 0.3) out.push(tr('S0', 1000, 1010, 0.01), tr('S0', 1010, 1020, -0.02)); // touching: one bet
  return out;
}
const RECORDS = Array.from({ length: 1000 }, randomRecord);

test('F-4 rework: one bet = confidence()\'s cluster (K equal on 1,000 random records)', () => {
  for (const r of RECORDS) assert.equal(betClusters(r).length, confidence(r, today).k);
  // Boundary inclusive: a hold that opens the instant the last one closed is the same bet.
  assert.equal(betClusters([tr('A', 0, 5, 0.01), tr('A', 5, 9, 0.02)]).length, 1);
  assert.equal(betClusters([tr('A', 0, 5, 0.01), tr('A', 6, 9, 0.02), tr('B', 0, 5, 0.01)]).length, 3);
  // Each trade counts once, in its bet's sum.
  const bets = betClusters([tr('A', 0, 5, 0.01), tr('A', 2, 9, 0.03), tr('B', 0, 1, -0.02)]);
  assert.deepEqual(bets.map((b) => [Number(b.sum.toFixed(10)), b.n]).sort(), [[-0.02, 1], [0.04, 2]].sort());
});

test('F-4 rework AC (10-31 range): the headline always sits inside its range, on the numbers and on the printed strings', () => {
  let checked = 0;
  for (const r of RECORDS) {
    const range = arithmeticRange(r);
    const avg = headline(r).avgReturn;
    if (!range) { assert.ok(betClusters(r).length < MIN_BETS); continue; }
    assert.ok(Math.abs(range.mid - avg) < 1e-12, 'centred on the headline');
    assert.ok(range.low <= avg && avg <= range.high);
    const num = (s: string) => Number(s.replace('%', ''));
    assert.ok(num(pct(range.low)) <= num(pct(avg)) && num(pct(avg)) <= num(pct(range.high)), `${pct(range.low)} ${pct(avg)} ${pct(range.high)}`);
    checked++;
  }
  assert.ok(checked > 300, `${checked} ranged records`);
});

test('F-4 rework (orchestrator review): 120 one-trade symbols at log returns ±0.5 print the headline inside its range', () => {
  const r = Array.from({ length: 120 }, (_, i) => tr(`V${i}`, i * 4, i * 4 + 2, Math.expm1(i % 2 ? -0.5 : 0.5)));
  const avg = headline(r).avgReturn;
  assert.equal(pct(avg), '+12.8%');
  const range = arithmeticRange(r)!;
  assert.ok(range.low <= avg && avg <= range.high);
  assert.notEqual(`${pct(range.low)} ${pct(range.high)}`, '-8.7% +9.5%'); // the old log-based range left the headline out
  // Hand check: S = the 120 returns; se = sd · √(K/(K−1)) / √n with one trade per bet; t(119) = 1.96 + 2.4/119.
  const sd = Math.sqrt(r.reduce((a, t) => a + (t.returnPct - avg) ** 2, 0) / 119);
  const half = tCrit95(119) * sd / Math.sqrt(120);
  assert.ok(Math.abs(range.high - (avg + half)) < 1e-12 && Math.abs(range.low - (avg - half)) < 1e-12);
  // The mirror record (every return negated) gives the mirrored range: losses read like gains.
  const m = arithmeticRange(r.map((t) => ({ ...t, returnPct: -t.returnPct })))!;
  assert.ok(Math.abs(m.low + range.high) < 1e-12 && Math.abs(m.high + range.low) < 1e-12);
});

test('F-4 rework: Student\'s t with K − 1 degrees of freedom (table at K = 5, 10, 30, 100), null below 5 bets, se = 0', () => {
  const half = (k: number) => {
    const r = Array.from({ length: k }, (_, i) => tr(`T${i}`, i * 3, i * 3 + 1, i % 2 ? 0.02 : 0.04));
    const x = arithmeticRange(r)!;
    const sd = Math.sqrt(r.reduce((a, t) => a + (t.returnPct - x.mid) ** 2, 0) / (k - 1));
    return (x.high - x.mid) / (sd / Math.sqrt(k));
  };
  assert.ok(Math.abs(half(5) - 2.776) < 1e-9);
  assert.ok(Math.abs(half(10) - 2.262) < 1e-9);
  assert.ok(Math.abs(half(30) - 2.045) < 1e-9);
  assert.ok(Math.abs(half(100) - (1.96 + 2.4 / 99)) < 1e-9); // 1.984; the exact t(99) is 1.984
  assert.equal(arithmeticRange(Array.from({ length: 4 }, (_, i) => tr(`T${i}`, i, i + 1, 0.01))), null);
  assert.equal(arithmeticRange([]), null);
  // Every return equal: no spread, the range is the average itself.
  const flat = arithmeticRange(Array.from({ length: 6 }, (_, i) => tr(`T${i}`, i * 3, i * 3 + 1, 0.015)))!;
  assert.equal(pct(flat.low), '+1.5%');
  assert.equal(pct(flat.high), '+1.5%');
});

test('F-4 rework: tierFor is confidence()\'s tier wherever confidence() gives one', () => {
  let same = 0;
  for (const r of RECORDS) {
    const c = confidence(r, today);
    if (c.tier !== 'too-early') { assert.equal(tierFor(c.k, c.spanDays), c.tier); same++; }
    else if (c.k >= MIN_BETS) assert.ok(!c.perTrade || tooWide(c.perTrade)); // too early only by width, never a count
  }
  assert.ok(same > 100, `${same} records compared`);
  assert.equal(tierFor(4, 1000), 'too-early');
  assert.equal(tierFor(5, 1), 'thin');
  assert.equal(tierFor(30, 89.9), 'thin');
  assert.equal(tierFor(30, 90), 'moderate');
  assert.equal(tierFor(100, 364.6), 'moderate'); // the unrounded span decides: 364.6 days is not a year
  assert.equal(tierFor(100, 365), 'strong');
});

test('F-4 rework (committee 2026-11-01): no runtime import cycle between confidence.ts and trades.ts', () => {
  const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
  // confidence.ts may only import types from trades.ts; bets.ts is a leaf nothing in lib/ imports but the card.
  for (const line of src('./confidence.ts').split('\n').filter((l) => /from '\.\/trades\.ts'/.test(l))) assert.match(line, /^import type /);
  assert.doesNotMatch(src('./trades.ts'), /from '\.\/bets\.ts'/);
  assert.doesNotMatch(src('./confidence.ts'), /from '\.\/bets\.ts'/);
});
