import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confidence, evidenceLine, evidenceWeight, isNewRecord, MIN_BETS, RANK_MIN_BETS, rangeText, rankTraders, tCrit95, TOO_EARLY_RULE, tooEarlyText, TOO_WIDE, tooWide, type ConfidenceInput, type Confidence } from './trades.ts';

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

// F-4 PR-1: the owner's floor is 5 independent bets (2026-10-22); the loop covers 0, 1 and the last count below it.
test('K<5 is too early with no interval or direction; K=0/1 are safe', () => {
  for (const n of [0, 1, MIN_BETS - 1]) {
    const c = confidence(clusters(n, 400), today);
    assert.equal(c.tier, 'too-early');
    assert.equal(c.perTrade, null);
    assert.equal(c.pace30, null);
    assert.equal(c.direction, null);
    assert.ok(Number.isFinite(c.tradesPerMonth) && Number.isFinite(c.spanDays));
  }
});

test('hand-computed interval', () => {
  // 10 clusters, x = ±0.02 alternating. m = 0; each X_c = x, so Σ(X-m)² = 10·0.0004 = 0.004.
  // F-4 PR-1 ruling H1: the spread is max(K/(K−1)·S, (PRIOR_BETS·SIGMA_DAY²·Σd + K·S)/(PRIOR_BETS + K − 1)), here
  // max(10/9·0.004, (5·0.01²·50 + 10·0.004)/14): the floor term binds (0.004643 > 0.004444). half = 2.262 · SE (df=9).
  const c = confidence(spaced(10, (i) => Math.expm1(i % 2 ? 0.02 : -0.02)), today);
  const half = 2.262 * (Math.sqrt(Math.max((10 / 9) * 0.004, (5 * 0.01 ** 2 * 50 + 10 * 0.004) / 14)) / 10);
  assert.ok(Math.abs(c.perTrade!.mid) < 1e-12);
  assert.ok(Math.abs(c.perTrade!.low - Math.expm1(-half)) < 1e-6);
  assert.ok(Math.abs(c.perTrade!.high - Math.expm1(half)) < 1e-6);
  assert.equal(c.direction, 'unclear');
});

// F-4 PR-1 ruling H1: zero spread no longer collapses to a zero-width range (that was an artifact; TR-9's Must is "no
// division by zero"). The variance floor gives m ± 2.262·√(5·0.01²·50/14)/10 with m = ln 1.05.
test('zero spread never prints a zero-width range (ruling H1 floor)', () => {
  const c = confidence(spaced(10, () => 0.05), today);
  const m = Math.log(1.05), half = 2.262 * (Math.sqrt((5 * 0.01 ** 2 * 50) / 14) / 10);
  assert.ok(Math.abs(c.perTrade!.low - Math.expm1(m - half)) < 1e-9);
  assert.ok(Math.abs(c.perTrade!.high - Math.expm1(m + half)) < 1e-9);
  assert.ok(c.pace30!.high - c.pace30!.low > 0.001);
  assert.equal(c.direction, 'positive');
  assert.ok(Number.isFinite(c.pace30!.low));
});

test('total loss does not produce NaN', () => {
  const c = confidence(spaced(10, () => -1), today);
  assert.ok(c.perTrade && Number.isFinite(c.perTrade.low));
  assert.equal(c.direction, 'negative');
});

test('tier boundaries', () => {
  const tier = (k: number, span: number) => confidence(clusters(k, span), today).tier;
  assert.equal(tier(4, 400), 'too-early');
  assert.equal(tier(5, 400), 'thin');
  assert.equal(tier(10, 400), 'thin');
  assert.equal(tier(29, 400), 'thin');
  assert.equal(tier(30, 89), 'thin');
  assert.equal(tier(30, 90), 'moderate');
  assert.equal(tier(99, 400), 'moderate');
  assert.equal(tier(100, 364), 'moderate');
  assert.equal(tier(100, 365), 'strong');
});

test('direction classification, negative as prominent as positive', () => {
  const mk = (r: number) => confidence(spaced(12, (i) => r + (i % 2 ? 0.001 : -0.001)), today);
  const pos = mk(0.05);
  const neg = mk(-0.05);
  assert.equal(pos.direction, 'positive');
  assert.equal(neg.direction, 'negative');
  assert.equal(evidenceLine(pos).replace('above zero', 'X'), evidenceLine(neg).replace('below zero', 'X'));
  assert.match(evidenceLine(neg), /^Past results: below zero · Evidence: thin \(12 bets, \d+ days\)$/);
});

test('copy: too early, range, banned words', () => {
  assert.equal(evidenceLine(confidence(clusters(4, 50), today)), 'Too early to tell (4 of 5 bets)');
  assert.equal(rangeText(confidence(clusters(4, 50), today)), null);
  const base = { n: 1, k: 30, spanDays: 100, tradesPerMonth: 1 };
  const iv = { low: -0.001, mid: 0.013, high: 0.027 };
  const all: Confidence[] = [];
  for (const tier of ['too-early', 'thin', 'moderate', 'strong'] as const)
    for (const direction of ['positive', 'negative', 'unclear', null] as const)
      all.push({ ...base, tier, direction, perTrade: iv, pace30: iv });
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

test('rankTraders: confident direction beats wide interval; zero weights keep score order; mirrors tie', () => {
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

// F-1 PR-3 fix round 4 (UX lead note 3): "Too early to tell (9 of 10 bets)" beside 2,828 trades (the floor was 10 then,
// 5 since F-4 PR-1). The seeded heavy record trades the same symbols in four accounts from one start date with partial
// sells, so each symbol's holds chain into one overlapping position: K = 9 is the rule working. The line now says so, and K never depends on input order or paging.
test('evidence line explains overlapping positions when trades outnumber bets; unchanged when each trade is a bet', () => {
  const chain = (sym: string, n: number) => Array.from({ length: n }, (_, i) => tr(sym, i * 2, i * 2 + 3, i % 3 ? 0.01 : -0.01));
  const heavy = [...chain('A', 400), ...chain('B', 400), ...chain('C', 2028)];
  const c = confidence(heavy, today);
  assert.equal(c.n, 2828);
  assert.equal(c.k, 3);
  assert.equal(evidenceLine(c), 'Too early to tell: 2,828 trades in 3 overlapping positions (5 independent bets needed)');
  assert.equal(evidenceLine(confidence(chain('A', 2), today)), 'Too early to tell: 2 trades in 1 overlapping position (5 independent bets needed)');
  assert.equal(evidenceLine(confidence(clusters(4, 50), today)), 'Too early to tell (4 of 5 bets)');
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

// ---- F-4 PR-1: TR-9 floor and width (owner decisions 2026-10-22; F-4 criteria 2 and 3) ----

test('F-4 criterion 2: Student\'s t with K − 1 degrees of freedom, against the table at K = 5, 10, 30, 100', () => {
  for (const [df, t] of [[4, 2.776], [9, 2.262], [29, 2.045], [99, 1.984]] as const) {
    assert.ok(Math.abs(tCrit95(df) - t) <= 0.002, `t(${df}) = ${tCrit95(df)}, table ${t}`);
  }
});

test('F-4 criterion 2: a hand-computed interval at K = 5 uses t(4) = 2.776', () => {
  const xs = [-0.02, 0.03, -0.01, 0.04, 0.0];
  const c = confidence(spaced(5, (i) => Math.expm1(xs[i])), today);
  const m = xs.reduce((a, x) => a + x, 0) / 5;
  const half = 2.776 * (Math.sqrt((5 / 4) * xs.reduce((a, x) => a + (x - m) ** 2, 0)) / 5);
  assert.equal(c.k, 5);
  assert.equal(c.tier, 'thin');
  assert.ok(Math.abs(c.perTrade!.mid - Math.expm1(m)) < 1e-12);
  assert.ok(Math.abs(c.perTrade!.low - Math.expm1(m - half)) < 1e-6);
  assert.ok(Math.abs(c.perTrade!.high - Math.expm1(m + half)) < 1e-6);
});

test('F-4 criterion 2: the range is shown from 5 independent bets and not at 4', () => {
  assert.equal(MIN_BETS, 5);
  const five = confidence(clusters(5, 50), today);
  assert.equal(five.tier, 'thin');
  assert.match(rangeText(five)!, /^\([-+]\d+\.\d%( to )[-+]\d+\.\d%\)$/);
  assert.match(evidenceLine(five), /^Past results: unclear · Evidence: thin \(5 bets, 50 days\)$/);
  const four = confidence(clusters(4, 50), today);
  assert.equal(rangeText(four), null);
  assert.equal(four.perTrade, null);
  assert.equal(four.pace30, null);
});

test('F-4 criterion 3: too wide is a half-width over 10 points per trade; exactly 10 points is not too wide', () => {
  assert.equal(TOO_WIDE, 0.10);
  assert.equal(tooWide({ low: -0.1, mid: 0, high: 0.1 }), false);
  assert.equal(tooWide({ low: 0, mid: 0.1, high: 0.2 }), false);
  assert.equal(tooWide({ low: -0.1 - 1e-9, mid: 0, high: 0.1 + 1e-9 }), true);
  // Tester L1: exactly 10.0 points is not too wide at any magnitude (0.9 − 0.7 rounds to 0.20000000000000007).
  assert.equal(tooWide({ low: 0.7, mid: 0.8, high: 0.9 }), false);
  assert.equal(tooWide({ low: 0.1, mid: 0.2, high: 0.3 }), false);
  assert.equal(tooWide({ low: -0.9, mid: -0.8, high: -0.7 }), false);
  assert.equal(tooWide({ low: -0.3, mid: 0.1, high: 0.5 }), true);
});

test('F-4 criterion 3: 200 bets with a ±11-point range is too early, keeps both intervals, has no direction and weight 0', () => {
  // x = ±a alternating over K = 200 single-trade bets: m = 0, SE = a / √(K − 1), half-width in simple returns sinh(t·SE).
  const K = 200, t = tCrit95(K - 1);
  const a = (Math.asinh(0.11) * Math.sqrt(K - 1)) / t;
  const c = confidence(spaced(K, (i) => Math.expm1(i % 2 ? a : -a)), today);
  assert.equal(c.k, K);
  assert.ok(Math.abs((c.perTrade!.high - c.perTrade!.low) / 2 - 0.11) < 1e-9, `${(c.perTrade!.high - c.perTrade!.low) / 2}`);
  assert.equal(c.tier, 'too-early'); // 200 bets over 2,000 days would be strong by count and span alone
  assert.equal(c.direction, null);
  assert.ok(c.perTrade && c.pace30);
  assert.equal(evidenceWeight(c), 0);
  assert.ok(rangeText(c));
  assert.equal(evidenceLine(c), 'Too early to tell: the range is still too wide (200 bets, 1,995 days)');
  assert.equal(tooEarlyText(c), evidenceLine(c));
  // The same record with a ±9-point range is strong: only the width moved it.
  const b = (Math.asinh(0.09) * Math.sqrt(K - 1)) / t;
  const narrow = confidence(spaced(K, (i) => Math.expm1(i % 2 ? b : -b)), today);
  assert.equal(narrow.tier, 'strong');
  assert.equal(narrow.direction, 'unclear');
});

test('F-4 criterion 3: "too early" is never decided by a count alone (the trade count never decides)', () => {
  const chain = (sym: string, n: number, r = (i: number) => (i % 2 ? 0.002 : -0.001)) =>
    Array.from({ length: n }, (_, i) => tr(sym, i * 2, i * 2 + 3, r(i)));
  // 2,000 trades in 3 bets: too early.
  const few = confidence([...chain('A', 700), ...chain('B', 700), ...chain('C', 600)], today);
  assert.equal(few.n, 2000);
  assert.equal(few.k, 3);
  assert.equal(few.tier, 'too-early');
  // K = 5 narrow with n = 5: thin.
  const five = confidence(clusters(5, 50), today);
  assert.equal(five.n, 5);
  assert.equal(five.tier, 'thin');
  // The same 5 bets with n = 5,000 overlapping trades: thin.
  const heavy = confidence(['A', 'B', 'C', 'D', 'E'].flatMap((s) => chain(s, 1000)), today);
  assert.equal(heavy.n, 5000);
  assert.equal(heavy.k, 5);
  assert.equal(heavy.tier, 'thin');
  assert.ok(heavy.perTrade && !tooWide(heavy.perTrade));
  // K = 4 with any n: too early, no range.
  for (const per of [1, 10, 1000]) {
    const c = confidence(['A', 'B', 'C', 'D'].flatMap((s) => chain(s, per)), today);
    assert.equal(c.k, 4);
    assert.equal(c.n, 4 * per);
    assert.equal(c.tier, 'too-early');
    assert.equal(c.perTrade, null);
  }
});

test('F-4 PR-1: no evidence or too-early line says "edge" or "of 10"', () => {
  const lines: string[] = [];
  const iv = { low: -0.2, mid: 0.01, high: 0.25 };
  for (const tier of ['too-early', 'thin', 'moderate', 'strong'] as const)
    for (const direction of ['positive', 'negative', 'unclear', null] as const)
      for (const k of [0, 1, 4, 5, 9, 10, 11, 30, 100])
        for (const n of [k, k * 3 + 1])
          for (const perTrade of [iv, null]) {
            const c: Confidence = { n, k, spanDays: 61.4, tier, direction, perTrade, pace30: perTrade, tradesPerMonth: 1 };
            lines.push(evidenceLine(c), tooEarlyText(c));
          }
  for (const k of [0, 1, 4, 5, 6, 9, 10, 12]) for (const span of [1, 50, 400]) {
    const c = confidence(clusters(k, span), today);
    lines.push(evidenceLine(c), tooEarlyText(c));
  }
  for (const l of lines) {
    assert.doesNotMatch(l, /edge/i, l);
    assert.ok(!l.includes('of 10'), l);
    assert.doesNotMatch(l, /skill|proven|guaranteed|all of their trades/i, l);
  }
  assert.ok(lines.includes('Too early to tell (4 of 5 bets)'));
  assert.ok(lines.some((l) => l.startsWith('Too early to tell: the range is still too wide (5 bets, ')));
});

// ---- F-4 PR-1 fix round 1: business lead ruling H1 (ruling-pr1-h1.md), tester M3, L5, UX lead D4 and D6 ----

// The tester's lucky.ts fixtures. Log mirror: r → 1/(1+r) − 1.
const mirror = (ts: ConfidenceInput[]) => ts.map((t) => ({ ...t, returnPct: 1 / (1 + t.returnPct) - 1 }));
const lucky = [0.01, 0.02, 0.03, 0.015, 0.025].map((r, i) => tr(`L${i}`, 390 + i, 391 + i, r));
const forty = Array.from({ length: 40 }, (_, i) => tr(`F${i}`, i * 4, i * 4 + 2, 0.02 + (((i * 7) % 5) - 2) / 100));
const long = Array.from({ length: 150 }, (_, i) => tr(`G${i % 40}`, i * 3, i * 3 + 2, 0.008 + (((i * 37) % 13) - 6) / 200));

test('H1: a 5-trade lucky record never outranks a 40-bet or a 150-bet record; mirrored losses rank the same', () => {
  for (const f of [(x: ConfidenceInput[]) => x, mirror]) {
    const [l, a, b] = [lucky, forty, long].map((ts) => confidence(f(ts), today));
    assert.equal(l.k, 5);
    assert.equal(b.k, 150);
    assert.equal(evidenceWeight(l), 0);
    assert.ok(evidenceWeight(a) > 0 && evidenceWeight(b) > 0, `${evidenceWeight(a)} ${evidenceWeight(b)}`);
    const items = [{ id: 'lucky', weight: evidenceWeight(l), score: 50 }, { id: '150', weight: evidenceWeight(b), score: 1 }, { id: '40', weight: evidenceWeight(a), score: 1 }];
    assert.deepEqual(rankTraders(items).map((x) => x.id), ['40', '150', 'lucky']);
    // Display keeps the owner's floor of 5: the lucky record shows its range and tier.
    assert.equal(l.tier, 'thin');
    assert.ok(l.perTrade);
  }
  // Mirrored records weigh the same as the originals.
  for (const ts of [lucky, forty, long]) assert.ok(Math.abs(evidenceWeight(confidence(ts, today)) - evidenceWeight(confidence(mirror(ts), today))) < 1e-12);
});

test('H1: zero spread never gives a zero-width range at any K from 5, for gains and losses', () => {
  for (const k of [5, 6, 9, 10, 30, 200]) for (const r of [0.02, -0.02, 0]) {
    const c = confidence(spaced(k, () => r), today);
    assert.ok(c.perTrade && c.perTrade.high - c.perTrade.low > 1e-4, `K=${k} r=${r} perTrade`);
    assert.ok(c.pace30 && c.pace30.high - c.pace30.low > 1e-4, `K=${k} r=${r} pace30`);
  }
});

test('H1: the ranking floor is 10 bets and the display floor stays 5', () => {
  assert.equal(RANK_MIN_BETS, 10);
  const r = (i: number) => 0.02 + (i % 2 ? 0.001 : -0.001);
  const nine = confidence(spaced(9, r), today);
  assert.ok(nine.perTrade);
  assert.equal(nine.tier, 'thin');
  assert.equal(nine.direction, 'positive');
  assert.equal(evidenceWeight(nine), 0);
  assert.ok(evidenceWeight(confidence(spaced(10, r), today)) > 0);
  // Never a count of trades: 5 bets made of 5,000 overlapping trades weigh 0.
  const chain = (sym: string) => Array.from({ length: 1000 }, (_, i) => tr(sym, i * 2, i * 2 + 3, i % 2 ? 0.002 : -0.001));
  const heavy = confidence(['A', 'B', 'C', 'D', 'E'].flatMap(chain), today);
  assert.equal(heavy.n, 5000);
  assert.equal(heavy.k, 5);
  assert.equal(evidenceWeight(heavy), 0);
});

test('M3: the width rule is sign-blind on the range shown: (low, high) and (−high, −low) agree', () => {
  for (let a = -1; a <= 1; a += 0.0137) for (let w = 0; w <= 0.4; w += 0.0071) {
    const iv = { low: a, mid: a + w / 2, high: a + w };
    assert.equal(tooWide(iv), tooWide({ low: -iv.high, mid: -iv.mid, high: -iv.low }), `${iv.low} ${iv.high}`);
  }
});

// (Its log mirror, a ×1e9 gain per trade, is too early by width in simple points: ruling H1 §5 keeps that rule.)
test('L5: a run of total-loss bets weighs a finite amount', () => {
  const loss = confidence(spaced(12, () => -1), today);
  assert.equal(loss.direction, 'negative');
  assert.ok(Number.isFinite(evidenceWeight(loss)) && evidenceWeight(loss) > 0, `${evidenceWeight(loss)}`);
  // Two such records tie instead of comparing Infinity with Infinity.
  assert.equal(evidenceWeight(loss), evidenceWeight(confidence(spaced(20, () => -1), today)));
  // It ranks among the clear records by weight × score, never as NaN or Infinity.
  const order = rankTraders([{ id: 'zero', weight: 0, score: 9 }, { id: 'loss', weight: evidenceWeight(loss), score: 1 }]);
  assert.deepEqual(order.map((x) => x.id), ['loss', 'zero']);
});

test('D4: too wide with trades outnumbering bets names the trades, as the thin line does', () => {
  const base: Confidence = { n: 18, k: 6, spanDays: 67.2, tier: 'too-early', direction: null, perTrade: { low: -0.3, mid: 0, high: 0.3 }, pace30: { low: -0.3, mid: 0, high: 0.3 }, tradesPerMonth: 8 };
  assert.equal(tooEarlyText(base), 'Too early to tell: the range is still too wide (6 bets from 18 trades, 67 days)');
  assert.equal(tooEarlyText({ ...base, n: 6 }), 'Too early to tell: the range is still too wide (6 bets, 67 days)');
});

test('D6: the "What\'s this?" rule is built from the constants and carries no banned term', () => {
  assert.equal(TOO_EARLY_RULE, `It says too early to tell until there are at least ${MIN_BETS} independent bets and the range is no more than ${Math.round(2 * TOO_WIDE * 100)} points wide.`);
  assert.ok(TOO_EARLY_RULE.includes(' 5 independent bets') && TOO_EARLY_RULE.includes(' 20 points'));
  assert.doesNotMatch(TOO_EARLY_RULE, /confidence interval|standard error|p-value|alpha|sharpe|\bedge\b|signal|skill|proven|guaranteed/i);
});

// ---- F-4 PR-1 fix round 2: UX lead D9 ----

test('D9: a non-zero range bound that rounds to 0.0% prints with 2 decimals and its sign, for losses and gains', () => {
  const iv = (low: number, high: number): Confidence => ({ n: 6, k: 6, spanDays: 30, tier: 'thin', direction: null, perTrade: { low, mid: (low + high) / 2, high }, pace30: null, tradesPerMonth: 6 });
  assert.equal(rangeText(iv(-0.026, -0.00018)), '(-2.6% to -0.02%)');
  assert.equal(rangeText(iv(0.00018, 0.026)), '(+0.02% to +2.6%)');
  assert.equal(rangeText(iv(-0.00004, 0.00004)), '(-0.00% to +0.00%)'); // signed even below 2 decimals
  assert.equal(rangeText(iv(0, 0.026)), '(0.0% to +2.6%)'); // an exact zero stays 0.0%
  assert.equal(rangeText(iv(-0.0004, 0.0004)), '(-0.04% to +0.04%)');
  // The UX lead's fixture: 6 small losses, −0.9% to −1.8%, 3-day holds. The range never reaches a printed 0.0%.
  const neg = confidence([-0.009, -0.018, -0.012, -0.015, -0.01, -0.017].map((r, i) => tr(`N${i}`, i * 5, i * 5 + 3, r)), today);
  const negRange = rangeText(neg)!;
  assert.doesNotMatch(negRange, /(\(| )0\.0%/, negRange);
  assert.match(negRange, / to -\d/, negRange);
  // A sweep: no record with a direction word prints a bound as an unsigned 0.0%.
  let seen = 0;
  for (let k = 5; k <= 30; k++) for (let s = 0; s < 40; s++) {
    const mean = (s - 20) / 1500, c = confidence(spaced(k, (i) => mean + ((i * 7) % 5 - 2) / 400), today);
    if (c.direction !== 'positive' && c.direction !== 'negative') continue;
    seen++;
    assert.doesNotMatch(rangeText(c)!, /(\(| )0\.0%/, `${k} ${s}: ${rangeText(c)}`);
  }
  assert.ok(seen > 100, `${seen} records with a direction`);
});
