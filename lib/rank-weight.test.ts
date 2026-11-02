// F-33: the ranking weight (docs/features/F-33-ranking-weight-needs-evidence.md, acceptance criteria; plan:
// docs/features/logs/F-33/plan.md §5). Every record here is fictional.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { atRankTier, nearEdge, paceInterval, rankWeight } from './rank-weight.ts';
import { arithmeticFromBets, arithmeticRange, betClusters } from './bets.ts';
import { MODERATE, RANK_FORMULA, RANK_MIN_BETS, RANK_MIN_DAYS, SPREAD_FLOOR, TOO_WIDE_HALF_WIDTH, tierFor } from './confidence.ts';
import { rankTraders, recordSpanDays, tCrit95, type ConfidenceInput } from './trades.ts';
import { prng } from './discovery/explore.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);
// One-trade bets (a distinct symbol each), opens spread evenly so the first open is t0 and the last close is exactly
// t0 + spanDays (to the millisecond).
function record(rs: readonly number[], spanDays: number, hold = 1): ConfidenceInput[] {
  const k = rs.length, step = (spanDays - hold) * DAY / Math.max(k - 1, 1);
  return rs.map((r, i) => {
    const open = i === k - 1 ? t0 + (spanDays - hold) * DAY : t0 + Math.round(i * step);
    return { symbol: `F${i}`, openedAt: new Date(open), closedAt: new Date(open + hold * DAY), returnPct: r, holdingDays: hold };
  });
}
const same = (k: number, r: number) => Array(k).fill(r) as number[];
const negate = (ts: ConfidenceInput[]) => ts.map((t) => ({ ...t, returnPct: -t.returnPct }));
// The 200-bet record of the probe: 200 one-day bets over 200 days, two gains of +3% to each loss of −2%.
const BIG = record(Array.from({ length: 200 }, (_, i) => (i % 3 ? 0.03 : -0.02)), 200);

test('F-33 constants: ranking starts at the moderate tier (30 bets AND 90 days); a 1-point floor; the formula is versioned', () => {
  assert.equal(RANK_MIN_BETS, 30);
  assert.equal(RANK_MIN_DAYS, 90);
  assert.equal(RANK_MIN_BETS, MODERATE.bets);
  assert.equal(RANK_MIN_DAYS, MODERATE.days);
  assert.equal(SPREAD_FLOOR, 0.01);
  assert.match(RANK_FORMULA, /^f33\./);
  // The gate equals tierFor's moderate-or-strong verdict at every count and span around the boundaries.
  for (const k of [0, 5, 29, 30, 31, 99, 100, 400]) for (const d of [0, 89, 89.999, 90, 91, 364, 365, 2000]) {
    const tier = tierFor(k, d);
    assert.equal(atRankTier(k, d), tier === 'moderate' || tier === 'strong', `${k} bets, ${d} days`);
  }
});

test('F-33 AC1: ten +1%, the jitter record and ten −1% each weigh less than the 200-bet record', () => {
  const w200 = rankWeight(BIG);
  assert.ok(w200 > 0, `the 200-bet record weighs ${w200}`);
  const ten = record(same(10, 0.01), 10);
  const jitter = record(Array.from({ length: 10 }, (_, i) => 0.01 + (i % 2 ? 1e-4 : -1e-4)), 10);
  const twin = record(same(10, -0.01), 10);
  for (const [name, r] of [['ten +1%', ten], ['jitter', jitter], ['ten −1%', twin]] as const) {
    const w = rankWeight(r);
    assert.ok(w < w200, `${name}: ${w} vs ${w200}`);
    assert.equal(w, 0, `${name}: below the tier, no weight`);
    // And with equal scores the feed puts the 200-bet record first, in either input order.
    for (const items of [[{ id: name, weight: w, score: 1 }, { id: 'big', weight: w200, score: 1 }], [{ id: 'big', weight: w200, score: 1 }, { id: name, weight: w, score: 1 }]]) {
      assert.equal(rankTraders(items)[0].id, 'big');
    }
  }
  // The same records stretched to the tier still weigh less than the 200-bet one: the floor, not only the tier.
  assert.ok(rankWeight(record(same(30, 0.01), 90)) < w200);
  assert.ok(rankWeight(record(same(30, -0.01), 90)) < w200);
});

test('F-33 AC3: 29 bets no weight, 30 bets weight; 89 days no weight, 90 days weight (spans to the millisecond)', () => {
  const rs = (k: number) => Array.from({ length: k }, (_, i) => 0.02 + (i % 2 ? 0.005 : -0.005));
  assert.equal(rankWeight(record(rs(29), 120)), 0);
  assert.ok(rankWeight(record(rs(30), 120)) > 0);
  assert.equal(recordSpanDays(record(rs(40), 89)), 89);
  assert.equal(recordSpanDays(record(rs(40), 90)), 90);
  assert.equal(rankWeight(record(rs(40), 89)), 0);
  assert.equal(rankWeight(record(rs(40), 90 - 1 / DAY)), 0, 'one millisecond short of 90 days');
  assert.ok(rankWeight(record(rs(40), 90)) > 0);
  // Mirrored: the same boundaries for a losing record.
  assert.equal(rankWeight(negate(record(rs(29), 120))), 0);
  assert.equal(rankWeight(negate(record(rs(40), 89))), 0);
  assert.equal(rankWeight(negate(record(rs(40), 90))), rankWeight(record(rs(40), 90)));
});

// An independent reference of OD 2.33's method (c) on the simple-return pace interval, written from the plan's formulas
// with its own clustering, so the module is checked against the decision rather than against itself.
function reference(ts: readonly ConfidenceInput[]): number {
  const groups = new Map<string, ConfidenceInput[]>();
  for (const t of ts) groups.set(t.symbol, [...(groups.get(t.symbol) ?? []), t]);
  const bets: { s: number; d: number; n: number }[] = [];
  for (const g of groups.values()) {
    let end = -Infinity, cur: { s: number; d: number; n: number } | null = null;
    for (const t of [...g].sort((a, b) => +a.openedAt - +b.openedAt)) {
      if (cur && +t.openedAt <= end) { cur.s += t.returnPct; cur.d += Math.max(t.holdingDays, 1); cur.n++; }
      else bets.push(cur = { s: t.returnPct, d: Math.max(t.holdingDays, 1), n: 1 });
      end = Math.max(end, +t.closedAt);
    }
  }
  const K = bets.length, n = ts.length;
  const span = (Math.max(...ts.map((t) => +t.closedAt)) - Math.min(...ts.map((t) => +t.openedAt))) / DAY;
  if (K < 30 || span < 90) return 0;
  const mid = bets.reduce((a, b) => a + b.s, 0) / n;
  const halfPrinted = tCrit95(K - 1) * Math.sqrt((K / (K - 1)) * bets.reduce((a, b) => a + (b.s - b.n * mid) ** 2, 0)) / n;
  if (halfPrinted > 0.10) return 0;
  const D = bets.reduce((a, b) => a + b.d, 0), R = bets.reduce((a, b) => a + b.s, 0) / D;
  const v = Math.max(bets.reduce((a, b) => a + (b.s - R * b.d) ** 2, 0) / (K - 1), 0.0001 * n / K);
  const se = Math.sqrt(K * v) / D, t = tCrit95(K - 1);
  return Math.max(0, 30 * (R - t * se), -30 * (R + t * se));
}

// Random fictional records: K 30–150 bets over 90–500 days, mean −5%..+5%, spread 0–8%, random holds; some symbols
// repeat so overlapping holds cluster into one bet. Both signs.
function randomRecords(seed: number, count: number, kMin = 30): ConfidenceInput[][] {
  const r = prng(seed);
  return Array.from({ length: count }, () => {
    const k = kMin + Math.floor(r() * 121), span = 90 + Math.floor(r() * 411), mean = (r() - 0.5) * 0.1, spread = r() * 0.08;
    const zero = r() < 0.1; // some records of identical returns: the floor decides
    return Array.from({ length: k }, (_, i) => {
      const hold = 1 + Math.floor(r() * 20);
      const open = t0 + Math.floor(r() * (span - hold) * DAY);
      const ret = zero ? mean : mean + (r() - 0.5) * 2 * spread;
      return { symbol: r() < 0.2 ? `R${i % 4}` : `U${i}`, openedAt: new Date(open), closedAt: new Date(open + hold * DAY), returnPct: Math.max(-0.99, ret), holdingDays: hold };
    });
  });
}

test('F-33 AC4: at the tier, rankWeight equals the OD 2.33 near-edge reference and rankTraders keeps that order', () => {
  const recs = randomRecords(33, 500);
  let weighted = 0;
  const items = recs.map((ts, i) => {
    const w = rankWeight(ts), ref = reference(ts);
    assert.ok(Math.abs(w - ref) <= 1e-12, `record ${i}: ${w} vs reference ${ref}`);
    if (w > 0) weighted++;
    return { i, weight: w, ref, score: 1 };
  });
  assert.ok(weighted > 100, `${weighted} of 500 carry weight (the property needs both kinds)`);
  const byRef = [...items].sort((a, b) => +(b.ref > 0) - +(a.ref > 0) || b.ref - a.ref);
  assert.deepEqual(rankTraders(items).map((x) => x.i), byRef.map((x) => x.i));
  assert.deepEqual(rankTraders(items.toReversed()).filter((x) => x.weight > 0).map((x) => x.i), byRef.filter((x) => x.ref > 0).map((x) => x.i));
});

test('F-33 AC5: below the tier the feed keeps score order with a stable tie-break; trade count never decides', () => {
  const below = randomRecords(5, 200, 5).map((ts) => ts.filter((t) => +t.closedAt < t0 + 80 * DAY && +t.openedAt >= t0));
  for (const ts of below) assert.equal(rankWeight(ts), 0);
  const r = prng(55);
  const items = below.map((ts, i) => ({ i, n: ts.length, weight: rankWeight(ts), score: Math.floor(r() * 5) }));
  const want = (xs: typeof items) => [...xs].sort((a, b) => b.score - a.score).map((x) => x.i); // Array.sort is stable
  assert.deepEqual(rankTraders(items).map((x) => x.i), want(items));
  assert.deepEqual(rankTraders(items.toReversed()).map((x) => x.i), want(items.toReversed()));
  // A 200-close record and a 20-close record, both below the tier (under 90 days), at equal score: only the input order
  // (the SQL's own tie-break: closed_at, id) decides, never the count.
  const many = record(Array.from({ length: 200 }, (_, i) => 0.01 + (i % 2 ? 0.002 : -0.002)), 80);
  const few = record(Array.from({ length: 20 }, (_, i) => 0.01 + (i % 2 ? 0.002 : -0.002)), 80);
  assert.equal(rankWeight(many), 0);
  assert.equal(rankWeight(few), 0);
  const a = { id: 'many', weight: rankWeight(many), score: 2 }, b = { id: 'few', weight: rankWeight(few), score: 2 };
  assert.deepEqual(rankTraders([a, b]).map((x) => x.id), ['many', 'few']);
  assert.deepEqual(rankTraders([b, a]).map((x) => x.id), ['few', 'many']);
});

test('F-33 AC6: a record and its negation weigh exactly the same; +5% and −5% records tie exactly', () => {
  const up = record(Array.from({ length: 40 }, (_, i) => 0.05 + (i % 2 ? 0.01 : -0.01)), 120);
  assert.ok(rankWeight(up) > 0);
  assert.equal(rankWeight(negate(up)), rankWeight(up));
  assert.equal(rankWeight(record(same(40, -0.05), 120)), rankWeight(record(same(40, 0.05), 120)));
  for (const ts of randomRecords(66, 300)) assert.equal(rankWeight(negate(ts)), rankWeight(ts));
  // In the feed: the mirrored pair sit together, in input order, whichever comes first.
  const g = { id: 'gain', weight: rankWeight(up), score: 1 }, l = { id: 'loss', weight: rankWeight(negate(up)), score: 1 };
  assert.deepEqual(rankTraders([g, l]).map((x) => x.id), ['gain', 'loss']);
  assert.deepEqual(rankTraders([l, g]).map((x) => x.id), ['loss', 'gain']);
});

// Review R3: this compares closed figures only, at equal score. The record's 10 open losers are not in its input, so the
// test shows the tier and floor rank a 30-bet record of these closes below a 200-bet one; the property that open losers
// lower the weight is the OD 2.34 todo below.
test('F-33 AC7 (closed figures only): 30 winners at +1% rank below a 200-bet record of the same closed figures at equal score; open losers are not read (OD 2.34)', () => {
  // The 10 losers at −20% are still open, so they are not closed trades and are not in the record's input at all.
  const thirty = record(same(30, 0.01), 120, 2);
  const twoHundred = record(same(200, 0.01), 400, 2);
  const w30 = rankWeight(thirty), w200 = rankWeight(twoHundred);
  assert.ok(w30 > 0, 'at the tier: the floor alone gives it a range');
  assert.ok(w30 < w200, `${w30} vs ${w200}`);
  for (const items of [[{ id: 30, weight: w30, score: 1 }, { id: 200, weight: w200, score: 1 }], [{ id: 200, weight: w200, score: 1 }, { id: 30, weight: w30, score: 1 }]]) {
    assert.equal(rankTraders(items)[0].id, 200);
  }
});
test.todo('OD 2.34: losers held open at −20% lower the ranking weight (open positions in the range)');

test('F-33 AC8: at or above the 1-point floor the floor changes nothing; no printed range reads the floor', () => {
  let checked = 0;
  for (const ts of randomRecords(88, 400)) {
    const bets = betClusters(ts), n = ts.length, k = bets.length;
    const D = bets.reduce((a, b) => a + b.days, 0), R = bets.reduce((a, b) => a + b.sum, 0) / D;
    const ss = bets.reduce((a, b) => a + (b.sum - R * b.days) ** 2, 0);
    if (ss / (k - 1) >= 1e-4 * n / k) {
      checked++;
      assert.deepEqual(paceInterval(bets, n), paceInterval(bets, n, 0));
    } else {
      // Under the floor the ranking interval is wider than the unfloored one, never narrower.
      const f = paceInterval(bets, n)!, u = paceInterval(bets, n, 0)!;
      assert.ok(f.high - f.low > u.high - u.low);
    }
    // The printed range is the card's arithmetic range, unchanged by the split and blind to the floor.
    assert.deepEqual(arithmeticRange(ts), arithmeticFromBets(bets, n));
  }
  assert.ok(checked > 200, `${checked} records at or above the floor`);
  // Source check: only the constant's file and the ranking weight read SPREAD_FLOOR.
  const readers: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(new URL(dir, import.meta.url))) {
      const rel = `${dir}${f}`;
      if (statSync(new URL(rel, import.meta.url)).isDirectory()) { if (f !== 'node_modules') walk(`${rel}/`); continue; }
      if (!/\.tsx?$/.test(f) || /\.test\.ts$/.test(f)) continue;
      const code = readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      if (code.includes('SPREAD_FLOOR')) readers.push(rel); // code only: comments may name it
    }
  };
  walk('./'); walk('../app/');
  assert.deepEqual(readers.sort(), ['./confidence.ts', './rank-weight.ts']);
});

test('F-33: a too-wide printed range never carries weight; empty and tiny records weigh 0', () => {
  const wide = record(Array.from({ length: 200 }, (_, i) => (i % 2 ? 0.9 : -0.6)), 400);
  assert.ok(arithmeticRange(wide)!.half > TOO_WIDE_HALF_WIDTH);
  assert.equal(rankWeight(wide), 0);
  assert.equal(rankWeight([]), 0);
  assert.equal(rankWeight(record([0.5], 100)), 0);
  assert.equal(nearEdge({ low: -0.1, high: 0.2 }), 0);
  assert.equal(nearEdge({ low: 0.1, high: 0.2 }), 0.1);
  assert.equal(nearEdge({ low: -0.2, high: -0.1 }), 0.1);
});

// R2 (orchestrator ruling 2): zero width is a printing rule; the weight comes from the floored error term. Measured for
// the owner, not asserted against a direction: the numbers are in docs/features/logs/F-33/build.md.
test('F-33 R2: 40 trades of exactly +1% (1-day holds over 120 days) carry weight through the floor', (t) => {
  const forty = record(same(40, 0.01), 120);
  const w = rankWeight(forty), w200 = rankWeight(BIG);
  t.diagnostic(`40 × +1%: weight ${w}; 200-bet record: ${w200}`);
  assert.ok(w > 0);
  assert.equal(rankWeight(negate(forty)), w);
});
