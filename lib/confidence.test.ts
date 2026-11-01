import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confidence, evidenceLine, evidenceWeight, isNewRecord, rangeText, rankTraders, tCrit95, type ConfidenceInput, type Confidence } from './trades.ts';
import { evidenceLabel, halfWidth, MIN_BETS, RANK_MIN_BETS, TOO_WIDE_HALF_WIDTH, tooWide, TRUST_BANNED, trustLine, trustSign } from './confidence.ts';

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

// F-4 (owner, 2026-10-22): the floor is 5 independent bets (was 10).
test('K<5 is too early with no interval or edge; K=0/1 are safe', () => {
  for (const n of [0, 1, 4]) {
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
  assert.equal(tier(4, 400), 'too-early'); // F-4: the floor is 5 bets (was 10)
  assert.equal(tier(5, 400), 'thin');
  assert.equal(tier(9, 400), 'thin');
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
  assert.equal(evidenceLine(confidence(clusters(4, 50), today)), 'Too early to tell (4 of 5 bets)'); // F-4: of 5 (was 10)
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
  // F-4: 5 independent bets needed (was 10).
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

// ---- F-4 (owner decisions 2026-10-22): the floor of 5 bets, the t multiplier, "too early" as a model state, the
// plain-language trust line. The threshold lives in lib/confidence.ts (IMPLEMENTATION, gaps item 8).

test('F-4 AC2: the multiplier is Student\'s t with K − 1 degrees of freedom (table at K = 5, 10, 30, 100)', () => {
  const table: [number, number][] = [[5, 2.776], [10, 2.262], [30, 2.045], [100, 1.984]];
  for (const [k, t] of table) assert.ok(Math.abs(tCrit95(k - 1) - t) < 0.001, `K=${k}: ${tCrit95(k - 1)} vs ${t}`);
  // K = 5, hand-computed: x = ±0.02 alternating (3 up, 2 down), m = 0.004, Σ(X−m)² = 0.00192,
  // SE = √(5/4 · 0.00192)/5, half = 2.776 · SE (the multiplier about 2.8, the owner's figure).
  const c = confidence(spaced(5, (i) => Math.expm1(i % 2 ? -0.02 : 0.02)), today);
  const half = 2.776 * (Math.sqrt((5 / 4) * 0.00192) / 5);
  assert.equal(c.k, 5);
  assert.ok(Math.abs(c.perTrade!.low - Math.expm1(0.004 - half)) < 1e-6);
  assert.ok(Math.abs(c.perTrade!.high - Math.expm1(0.004 + half)) < 1e-6);
  assert.equal(MIN_BETS, 5);
});

test('F-4 AC2/AC3: the range exists from 5 bets on, and widens as the sample thins', () => {
  assert.equal(confidence(clusters(4, 400), today).perTrade, null);
  const widths = [5, 10, 30, 100].map((k) => halfWidth(confidence(spaced(k, (i) => Math.expm1(i % 2 ? -0.03 : 0.03)), today).perTrade!));
  for (let i = 1; i < widths.length; i++) assert.ok(widths[i] < widths[i - 1], `half-width ${widths[i]} < ${widths[i - 1]}`);
});

test('F-4 AC3: "too early" is K < 5 or a half-width over 10 points, never a count alone', () => {
  assert.equal(TOO_WIDE_HALF_WIDTH, 0.10);
  assert.equal(tooWide({ low: -0.1, high: 0.1 }), false); // exactly ±10 points: not too wide
  assert.equal(tooWide({ low: -0.1, high: 0.1000001 }), true);
  // Below the floor: too early with no range.
  for (const k of [1, 2, 3, 4]) assert.equal(confidence(spaced(k, () => 0.05), today).tier, 'too-early');
  // From the floor up, a tight record is never too early, whatever its count.
  for (let k = MIN_BETS; k <= 300; k += 7) assert.notEqual(confidence(spaced(k, (i) => Math.expm1(i % 2 ? -0.02 : 0.02)), today).tier, 'too-early', `K=${k}`);
  // The same count, two spreads: the width decides.
  const narrow = confidence(spaced(12, (i) => Math.expm1(i % 2 ? -0.02 : 0.02)), today);
  const wide = confidence(spaced(12, (i) => Math.expm1(i % 2 ? -0.25 : 0.25)), today);
  assert.equal(narrow.tier, 'thin');
  assert.equal(wide.tier, 'too-early');
  assert.ok(halfWidth(wide.perTrade!) > 0.10);
  // A count and span that would be "strong" are still too early when the range is wider than ±10 points.
  const big = confidence(spaced(200, (i) => Math.expm1(i % 2 ? -1 : 1)), today);
  assert.equal(big.k, 200);
  assert.ok(big.spanDays >= 365);
  assert.equal(big.tier, 'too-early');
  // Too wide keeps the range (it is always shown from 5 bets), but no verdict and no ranking weight.
  assert.ok(wide.perTrade && wide.pace30);
  assert.equal(wide.edge, null);
  assert.equal(evidenceWeight(wide), 0);
  assert.equal(evidenceLine(wide), 'Too early to tell: the range is still too wide to say much (12 bets)');
  assert.equal(evidenceLabel(wide), 'Evidence: too early');
  assert.equal(evidenceLabel(narrow), 'Evidence: thin');
});

test('F-4: ranking keeps its floor of 10 bets (F-4 changes what a record shows, not the feed order)', () => {
  assert.equal(RANK_MIN_BETS, 10);
  const tight = (k: number) => confidence(spaced(k, (i) => 0.05 + (i % 2 ? 0.001 : -0.001)), today);
  assert.notEqual(tight(6).tier, 'too-early'); // shown with its range and verdict from 5 bets
  assert.equal(evidenceWeight(tight(6)), 0); // but not ranked ahead before 10
  assert.equal(evidenceWeight(tight(9)), 0);
  assert.ok(evidenceWeight(tight(10)) > 0);
});

const conf = (tier: Confidence['tier'], edge: Confidence['edge'], perTrade: Confidence['perTrade'], k: number, n: number, spanDays: number): Confidence =>
  ({ n, k, spanDays, tier, edge, perTrade, pace30: perTrade, tradesPerMonth: 1 });
const UP = { low: 0.004, mid: 0.013, high: 0.022 };
const DOWN = { low: -0.022, mid: -0.013, high: -0.004 };
const CROSS = { low: -0.001, mid: 0.013, high: 0.027 };

test('F-4 AC4: every cell of the trust-line table, both signs', () => {
  // Too early: any sign, N = closed trades.
  assert.equal(trustLine(conf('too-early', null, null, 3, 3, 20)), 'Based on 3 trades. The range is still too wide to say much.');
  assert.equal(trustLine(conf('too-early', null, null, 1, 1, 2)), 'Based on 1 trade. The range is still too wide to say much.');
  assert.equal(trustLine(conf('too-early', null, { low: -0.2, mid: 0, high: 0.2 }, 12, 4731, 90)), 'Based on 4,731 trades. The range is still too wide to say much.');
  // Thin: N separate bets over D days.
  assert.equal(trustLine(conf('thin', 'positive', UP, 30, 30, 61)), 'Based on 30 separate bets over 61 days. Still early.');
  assert.equal(trustLine(conf('thin', 'unclear', CROSS, 30, 30, 61)), 'Based on 30 separate bets over 61 days. Still early, and results could go either way.');
  assert.equal(trustLine(conf('thin', 'negative', DOWN, 30, 30, 61)), 'Based on 30 separate bets over 61 days. Still early, and results could go either way.');
  // Moderate: N bets over M months (whole 30-day months).
  assert.equal(trustLine(conf('moderate', 'positive', UP, 45, 50, 200)), 'Based on 45 bets over 6 months. A fair sample.');
  assert.equal(trustLine(conf('moderate', 'unclear', CROSS, 45, 50, 200)), 'Based on 45 bets over 6 months. A fair sample, with no clear pattern yet.');
  assert.equal(trustLine(conf('moderate', 'negative', DOWN, 45, 50, 200)), 'Based on 45 bets over 6 months. A fair sample, with no clear pattern yet.');
  // Strong: N bets over Y years (whole years).
  assert.equal(trustLine(conf('strong', 'positive', UP, 140, 150, 800)), 'Based on 140 bets over 2 years. A long, consistent record.');
  assert.equal(trustLine(conf('strong', 'unclear', CROSS, 140, 150, 800)), 'Based on 140 bets over 2 years. A long record, with no clear pattern.');
  assert.equal(trustLine(conf('strong', 'negative', DOWN, 140, 150, 800)), 'Based on 140 bets over 2 years. A long record, with consistent losses.');
  assert.equal(trustLine(conf('strong', 'positive', UP, 1200, 1300, 365)), 'Based on 1,200 bets over 1 year. A long, consistent record.');
  // A thin span under a day reads "1 day"; an empty record has no trust line (the card says "No closed trades yet").
  assert.equal(trustLine(conf('thin', 'positive', UP, 6, 6, 0.2)), 'Based on 6 separate bets over 1 day. Still early.');
  assert.equal(trustLine(conf('too-early', null, null, 0, 0, 0)), null);
});

test('F-4 AC4: "consistent" only in the strong tier with the range entirely on one side of zero, losses as gains', () => {
  // A verdict and a range that disagree are not consistent: the card never says it beside a range that crosses 0.
  assert.equal(trustSign(conf('strong', 'positive', CROSS, 140, 150, 800)), 'unclear');
  assert.equal(trustSign(conf('strong', 'negative', { low: -0.03, mid: -0.01, high: 0.002 }, 140, 150, 800)), 'unclear');
  assert.match(trustLine(conf('strong', 'positive', CROSS, 140, 150, 800))!, /no clear pattern\.$/);
  for (const tier of ['too-early', 'thin', 'moderate', 'strong'] as const)
    for (const edge of ['positive', 'negative', 'unclear', null] as const)
      for (const iv of [UP, DOWN, CROSS, null]) {
        const line = trustLine(conf(tier, edge, iv, 140, 150, 800)) ?? '';
        const agrees = (edge === 'positive' && !!iv && iv.low > 0) || (edge === 'negative' && !!iv && iv.high < 0);
        assert.equal(/consistent/.test(line), tier === 'strong' && agrees, `${tier} ${edge} ${JSON.stringify(iv)}: ${line}`);
      }
  // Real records, mirrored: equal gains and losses both reach "consistent".
  const gain = confidence(spaced(120, (i) => 0.05 + (i % 2 ? 0.001 : -0.001)), today);
  const loss = confidence(spaced(120, (i) => 1 / (1.05 + (i % 2 ? 0.001 : -0.001)) - 1), today);
  assert.equal(gain.tier, 'strong');
  assert.equal(loss.tier, 'strong');
  assert.equal(trustLine(gain), 'Based on 120 bets over 3 years. A long, consistent record.');
  assert.equal(trustLine(loss), 'Based on 120 bets over 3 years. A long record, with consistent losses.');
});

test('F-4 AC5 reader test: the trust line uses no banned term', () => {
  assert.deepEqual([...TRUST_BANNED], ['confidence interval', 'standard error', 'p-value', 'alpha', 'Sharpe', 'edge', 'signal', 'skill']);
  const banned = new RegExp(`\\b(${TRUST_BANNED.map((t) => t.replace(/[- ]/g, '[- ]?')).join('|')})s?\\b`, 'i');
  const lines = new Set<string>();
  for (const tier of ['too-early', 'thin', 'moderate', 'strong'] as const)
    for (const edge of ['positive', 'negative', 'unclear', null] as const)
      for (const iv of [UP, DOWN, CROSS, null])
        for (const [k, n, span] of [[0, 0, 0], [1, 1, 1], [5, 9, 12], [30, 31, 95], [140, 2828, 800], [5000, 9000, 4000]])
          lines.add(trustLine(conf(tier, edge, iv, k, n, span)) ?? '');
  for (const r of [clusters(4, 50), spaced(12, () => 0.02), spaced(40, (i) => (i % 3 ? 0.03 : -0.04)), spaced(120, () => -0.03)])
    lines.add(trustLine(confidence(r, today)) ?? '');
  assert.ok(lines.size >= 9);
  for (const line of lines) assert.doesNotMatch(line, banned, line);
  assert.match('A long record, with an edge.', banned); // the reader regex itself catches a banned word
  // The evidence label and the evidence line obey the same reader rule.
  for (const c of [confidence(clusters(4, 50), today), confidence(spaced(40, (i) => (i % 3 ? 0.03 : -0.04)), today)]) {
    assert.doesNotMatch(evidenceLabel(c), banned);
    assert.doesNotMatch(evidenceLine(c), banned);
  }
});
