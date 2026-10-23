import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confidence, evidenceLine, evidenceWeight, isNewRecord, rangeText, rankTraders, type ConfidenceInput, type Confidence } from './trades.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);
const tr = (symbol: string, open: number, close: number, r: number): ConfidenceInput => ({
  symbol, openedAt: new Date(t0 + open * DAY), closedAt: new Date(t0 + close * DAY), returnPct: r, holdingDays: close - open,
});
const today = new Date(t0 + 400 * DAY);
// n single-trade clusters on distinct symbols, the last one closing on day `span`
const clusters = (n: number, span: number, r = (i: number) => (i % 2 ? 0.02 : -0.02)) =>
  Array.from({ length: n }, (_, i) => tr(`S${i}`, i === n - 1 ? span - 1 : 0, i === n - 1 ? span : 1, r(i)));
const spaced = (n: number, r: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => tr(`S${i}`, i * 10, i * 10 + 5, r(i)));

test('overlapping same-symbol trades are one bet', () => {
  assert.equal(confidence([tr('A', 0, 5, 0.1), tr('A', 3, 8, 0.1)], today).k, 1);
  assert.equal(confidence([tr('A', 0, 5, 0.1), tr('A', 5, 8, 0.1)], today).k, 1); // boundary instant overlaps
  assert.equal(confidence([tr('A', 0, 5, 0.1), tr('A', 6, 8, 0.1)], today).k, 2); // back-to-back
  assert.equal(confidence([tr('A', 0, 5, 0.1), tr('B', 0, 5, 0.1)], today).k, 2);
});

test('K<10 is too early with no interval or edge; K=0/1 are safe', () => {
  for (const n of [0, 1, 9]) {
    const c = confidence(clusters(n, 400), today);
    assert.equal(c.tier, 'too-early');
    assert.equal(c.perTrade, null);
    assert.equal(c.pace30, null);
    assert.equal(c.edge, null);
    assert.ok(Number.isFinite(c.tradesPerMonth) && Number.isFinite(c.spanDays));
  }
});

test('hand-computed interval', () => {
  // 10 clusters, x = ±0.02 alternating. m = 0; each X_c = x, so Σ(X-m)² = 10·0.0004 = 0.004.
  // SE = sqrt(10/9 · 0.004)/10 = 0.0066667; half = 2.262 · SE (df=9).
  const c = confidence(spaced(10, (i) => Math.expm1(i % 2 ? 0.02 : -0.02)), today);
  const half = 2.262 * (Math.sqrt((10 / 9) * 0.004) / 10);
  assert.ok(Math.abs(c.perTrade!.mid) < 1e-12);
  assert.ok(Math.abs(c.perTrade!.low - Math.expm1(-half)) < 1e-6);
  assert.ok(Math.abs(c.perTrade!.high - Math.expm1(half)) < 1e-6);
  assert.equal(c.edge, 'unclear');
});

test('zero spread collapses to the point estimate', () => {
  const c = confidence(spaced(10, () => 0.05), today);
  assert.ok(Math.abs(c.perTrade!.low - c.perTrade!.high) < 1e-12);
  assert.ok(Math.abs(c.pace30!.low - c.pace30!.high) < 1e-9);
  assert.equal(c.edge, 'positive');
  assert.ok(Number.isFinite(c.pace30!.low));
});

test('total loss does not produce NaN', () => {
  const c = confidence(spaced(10, () => -1), today);
  assert.ok(c.perTrade && Number.isFinite(c.perTrade.low));
  assert.equal(c.edge, 'negative');
});

test('tier boundaries', () => {
  const tier = (k: number, span: number) => confidence(clusters(k, span), today).tier;
  assert.equal(tier(9, 400), 'too-early');
  assert.equal(tier(10, 400), 'thin');
  assert.equal(tier(29, 400), 'thin');
  assert.equal(tier(30, 89), 'thin');
  assert.equal(tier(30, 90), 'moderate');
  assert.equal(tier(99, 400), 'moderate');
  assert.equal(tier(100, 364), 'moderate');
  assert.equal(tier(100, 365), 'strong');
});

test('edge classification, negative as prominent as positive', () => {
  const mk = (r: number) => confidence(spaced(12, (i) => r + (i % 2 ? 0.001 : -0.001)), today);
  const pos = mk(0.05);
  const neg = mk(-0.05);
  assert.equal(pos.edge, 'positive');
  assert.equal(neg.edge, 'negative');
  assert.equal(evidenceLine(pos).replace('above zero', 'X'), evidenceLine(neg).replace('below zero', 'X'));
  assert.match(evidenceLine(neg), /^Past results: below zero · Evidence: thin \(12 bets, \d+ days\)$/);
});

test('copy: too early, range, banned words', () => {
  assert.equal(evidenceLine(confidence(clusters(4, 50), today)), 'Too early to tell (4 of 10 bets)');
  assert.equal(rangeText(confidence(clusters(4, 50), today)), null);
  const base = { n: 1, k: 30, spanDays: 100, tradesPerMonth: 1 };
  const iv = { low: -0.001, mid: 0.013, high: 0.027 };
  const all: Confidence[] = [];
  for (const tier of ['too-early', 'thin', 'moderate', 'strong'] as const)
    for (const edge of ['positive', 'negative', 'unclear', null] as const)
      all.push({ ...base, tier, edge, perTrade: iv, pace30: iv });
  assert.equal(rangeText(all[4]), '(-0.1% to +2.7%)');
  const text = all.map((c) => evidenceLine(c) + (rangeText(c) ?? '')).join('\n');
  assert.doesNotMatch(text, /skill|proven|guaranteed|all of their trades/i);
});

test('isNewRecord boundaries', () => {
  const tn = new Date(t0 + 100 * DAY);
  const open = (days: number) => [{ openedAt: new Date(tn.getTime() - days * DAY) }];
  assert.equal(isNewRecord(open(29), 50, tn), true);
  assert.equal(isNewRecord(open(30), 50, tn), false);
  assert.equal(isNewRecord(open(90), 9, tn), true);
  assert.equal(isNewRecord(open(90), 10, tn), false);
});

test('rankTraders: confident edge beats wide interval; zero weights keep score order; mirrors tie', () => {
  const confident = { id: 'c', weight: 0.02, score: 1 };
  const wide = { id: 'w', weight: 0, score: 5 };
  assert.deepEqual(rankTraders([wide, confident]).map((x) => x.id), ['c', 'w']);
  const zeros = [{ id: 'a', weight: 0, score: 1 }, { id: 'b', weight: 0, score: 3 }, { id: 'c', weight: 0, score: 2 }];
  assert.deepEqual(rankTraders(zeros).map((x) => x.id), ['b', 'c', 'a']);
  const mk = (r: number) => confidence(spaced(12, () => r), today);
  const g = evidenceWeight(mk(0.05));
  const l = evidenceWeight(mk(1 / 1.05 - 1));
  assert.ok(g > 0 && Math.abs(g - l) < 1e-9);
  assert.equal(evidenceWeight(confidence([], today)), 0);
});

// F-1 PR-3 fix round 4 (UX lead note 3): "Too early to tell (9 of 10 bets)" beside 2,828 trades. The seeded heavy record
// trades the same symbols in four accounts from one start date with partial sells, so each symbol's holds chain into one
// overlapping position: K = 9 is the rule working. The line now says so, and K never depends on input order or paging.
test('evidence line explains overlapping positions when trades outnumber bets; unchanged when each trade is a bet', () => {
  const chain = (sym: string, n: number) => Array.from({ length: n }, (_, i) => tr(sym, i * 2, i * 2 + 3, i % 3 ? 0.01 : -0.01));
  const heavy = [...chain('A', 400), ...chain('B', 400), ...chain('C', 2028)];
  const c = confidence(heavy, today);
  assert.equal(c.n, 2828);
  assert.equal(c.k, 3);
  assert.equal(evidenceLine(c), 'Too early to tell: 2,828 trades in 3 overlapping positions (10 independent bets needed)');
  assert.equal(evidenceLine(confidence(chain('A', 2), today)), 'Too early to tell: 2 trades in 1 overlapping position (10 independent bets needed)');
  assert.equal(evidenceLine(confidence(clusters(9, 50), today)), 'Too early to tell (9 of 10 bets)');
  // Past the threshold, the bets line names the trades behind them, with grouped counts.
  const many = [...spaced(12, (i) => -0.05 + (i % 2 ? 0.001 : -0.001)), ...chain('Z', 4719)];
  const m = confidence(many, today);
  assert.equal(m.k, 13);
  assert.match(evidenceLine(m), /^Past results: .* · Evidence: thin \(13 bets from 4,731 trades, [\d,]+ days\)$/);
});

test('cluster count is the same for any input order or page split (the pure function sorts each symbol itself)', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const rows = Array.from({ length: 3000 }, () => { const o = Math.floor(rnd() * 3000); return tr(['A', 'B', 'C', 'D', 'E'][Math.floor(rnd() * 5)], o, o + Math.floor(rnd() * 6), rnd() - 0.5); });
  const k = confidence(rows, today).k;
  assert.equal(confidence([...rows].reverse(), today).k, k);
  assert.equal(confidence([...rows].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime() || a.symbol.localeCompare(b.symbol)), today).k, k);
  const pages = [rows.slice(0, 1000), rows.slice(1000, 2000), rows.slice(2000)];
  assert.equal(confidence([...pages[2], ...pages[0], ...pages[1]], today).k, k);
  // Reference: connected components of the same-symbol overlap graph, by brute force.
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    if (a.symbol === b.symbol && a.openedAt <= b.closedAt && b.openedAt <= a.closedAt) parent[find(i)] = find(j);
  }
  assert.equal(new Set(rows.map((_, i) => find(i))).size, k);
});
