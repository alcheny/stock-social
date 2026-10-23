// F-1 PR-3 fix round 7 (business lead re-sit, demand 2): the feed pane draws each chart at screen resolution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downsampleIndices, FEED_CHART_POINTS } from './downsample.ts';
import { chartSeries, packChart, unpackChart } from './chart-series.ts';
import { seededActivities } from '../e2e/fakes/vendor.ts';
import { matchTrades, RANGES, type Activity } from './trades.ts';
import { packPoints, unpackPoints } from './paging.ts';

// A seeded random walk with spikes, uneven time steps, repeated instants and a flat run.
function walk(n: number, seed = 7) {
  let s = seed, v = 0, t = 0;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < n; i++) {
    t += rnd() < 0.05 ? 0 : Math.floor(rnd() * 5_000);
    v += (rnd() - 0.5) * 0.1 + (rnd() < 0.002 ? (rnd() - 0.5) * 3 : 0);
    if (i > n / 2 && i < n / 2 + 50) v = ys[ys.length - 1];
    xs.push(t); ys.push(v);
  }
  return { xs, ys };
}

test('downsampling keeps the first, the last, the minimum and the maximum, in order, within the budget', () => {
  for (const n of [401, 1_000, 4_743, 20_000]) for (const max of [4, 10, 100, FEED_CHART_POINTS]) {
    const { xs, ys } = walk(n, n + max);
    const keep = downsampleIndices(xs, ys, max);
    assert.ok(keep.length <= max, `${n}/${max}: ${keep.length} points`);
    assert.equal(keep[0], 0);
    assert.equal(keep[keep.length - 1], n - 1);
    for (let i = 1; i < keep.length; i++) assert.ok(keep[i] > keep[i - 1], 'ascending, no repeats');
    const kept = keep.map((i) => ys[i]);
    assert.equal(Math.min(...kept), Math.min(...ys), `${n}/${max}: minimum`);
    assert.equal(Math.max(...kept), Math.max(...ys), `${n}/${max}: maximum`);
  }
  // Extremes at the very ends, and all points at one instant (sliced by position).
  const ends = downsampleIndices([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [-9, 0, 1, 0, 1, 0, 1, 0, 1, 9], 4);
  assert.deepEqual([ends[0], ends.at(-1)], [0, 9]);
  const same = downsampleIndices(new Array(1000).fill(5), walk(1000).ys, 50);
  assert.ok(same.length <= 50 && same[0] === 0 && same.at(-1) === 999);
});

test('a record that fits the budget is drawn unchanged', () => {
  const { xs, ys } = walk(FEED_CHART_POINTS);
  assert.deepEqual(downsampleIndices(xs, ys, FEED_CHART_POINTS), ys.map((_, i) => i));
});

test('every pixel column keeps its low and high: no column of the full path reaches outside the drawn one', () => {
  // Draw both at a 200-column width (the budget's slices): each column's extremes match exactly.
  const { xs, ys } = walk(10_000, 3);
  const keep = downsampleIndices(xs, ys, FEED_CHART_POINTS);
  const cols = (FEED_CHART_POINTS - 2) / 2;
  const col = (i: number) => Math.min(cols - 1, Math.floor(((xs[i] - xs[0]) / (xs.at(-1)! - xs[0])) * cols));
  const range = (idx: number[]) => {
    const m = new Map<number, [number, number]>();
    for (const i of idx) { const c = col(i), r = m.get(c); m.set(c, r ? [Math.min(r[0], ys[i]), Math.max(r[1], ys[i])] : [ys[i], ys[i]]); }
    return m;
  };
  const full = range(ys.map((_, i) => i)), drawn = range(keep);
  assert.equal(drawn.size, full.size);
  for (const [c, r] of full) assert.deepEqual(drawn.get(c), r, `column ${c}`);
});

// The heavy-use fixture (lib/sync.load.test.ts): 4 accounts × 2,500 seeded activities, about 4,700 closes.
function heavyRecord() {
  const acts: Activity[] = [];
  for (let a = 0; a < 4; a++) for (const r of seededActivities(`acc${a}`, 2_500, 1000 + a)) {
    acts.push({ externalId: r.id, accountId: `acc${a}`, symbol: r.symbol, side: r.type, units: r.units, price: r.price, fee: r.fee ?? 0, executedAt: new Date(r.trade_date), verified: true });
  }
  const { trades } = matchTrades(acts);
  return unpackPoints(packPoints(trades.map((t, i) => ({ id: String(i + 1), symbol: t.symbol, returnPct: t.returnPct, closedAt: t.closedAt, holdingDays: t.holdingDays, thesis: null }))));
}

test('the feed pane\'s chart: every range at most 400 points, the same numbers as full resolution, first/last/min/max kept', () => {
  const trades = heavyRecord();
  assert.ok(trades.length > 4_000);
  const now = new Date(Date.UTC(2026, 0, 15));
  const packed = unpackChart(JSON.parse(JSON.stringify(packChart(trades, now, FEED_CHART_POINTS))));
  for (const { key } of RANGES) {
    const full = chartSeries(trades, key, now), small = packed[key];
    assert.ok(small.pts.length <= FEED_CHART_POINTS, `${key}: ${small.pts.length}`);
    // The header total, the count, the drawdown and the y range are the full record's.
    assert.equal(small.n, full.n);
    assert.equal(small.last, full.last);
    assert.equal(small.drawdown, full.drawdown);
    assert.deepEqual([small.min, small.max], [full.min, full.max]);
    for (const k of ['t0', 't1'] as const) assert.ok(full[k] - small[k] >= 0 && full[k] - small[k] < 60_000, k);
    if (!full.n) continue;
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    assert.ok(near(small.pts[0].value, full.pts[0].value) && small.pts[0].trade === null, `${key}: first`);
    assert.equal(small.pts.at(-1)!.trade!.id, full.pts.at(-1)!.trade!.id, `${key}: last`);
    const vals = (s: typeof full) => s.pts.map((p) => p.value);
    assert.ok(near(Math.min(...vals(small)), Math.min(...vals(full))), `${key}: min`);
    assert.ok(near(Math.max(...vals(small)), Math.max(...vals(full))), `${key}: max`);
    // Each kept point is a real close with its own link target (row index) and value.
    for (const p of small.pts.slice(1)) {
      const orig = full.pts.find((q) => q.trade?.id === p.trade!.id)!;
      // Times are floored to the minute on the wire: never later, never more than a minute earlier.
      assert.ok(near(orig.value, p.value) && orig.at - p.at >= 0 && orig.at - p.at < 60_000 && orig.trade!.index === p.trade!.index);
      assert.ok(Math.abs(p.trade!.returnPct - orig.trade!.returnPct) <= 5e-7 + 1e-12);
    }
  }
  // The ALL range is the one that needed it.
  assert.equal(packed.ALL.pts.length <= FEED_CHART_POINTS && chartSeries(trades, 'ALL', now).pts.length > 4_000, true);
});

test('the profile keeps full resolution: no budget, one point per close', () => {
  const trades = heavyRecord();
  const s = chartSeries(trades, 'ALL', new Date(Date.UTC(2026, 0, 15)));
  assert.equal(s.pts.length, trades.length + 1);
});

test('the path is one move then one relative run, in tenths, with no drift', async () => {
  const { pathD } = await import('./chart-series.ts');
  assert.equal(pathD([0, 1.6, 3.24, 3.24], [10, 8.75, 12, 11.96]), 'M0 10l1.6-1.2 1.6 3.2 0 0');
  // Ends exactly at the rounded last point after many steps.
  const xs = Array.from({ length: 4_000 }, (_, i) => i * 0.16), ys = xs.map((x) => 100 + 50 * Math.sin(x / 7));
  const nums = pathD(xs, ys).slice(1).replace('l', ' ').match(/-?\d+(\.\d+)?/g)!.map(Number);
  let x = nums[0], y = nums[1];
  for (let i = 2; i < nums.length; i += 2) { x += nums[i]; y += nums[i + 1]; }
  assert.ok(Math.abs(x - xs.at(-1)!) <= 0.05 + 1e-9 && Math.abs(y - ys.at(-1)!) <= 0.05 + 1e-9);
  assert.equal(nums.length, 8_000);
});

// F-1 PR-3 fix round 8 (tester re-run 4, Medium): the feed page carries only a stand-in line per long record; the pane
// fetches the full chart (above) on its first swipe-open.
test('fix round 8: the feed\'s stand-in carries the ALL line at FEED_LITE_POINTS with no closes, and every range\'s numbers', async () => {
  const { FEED_LITE_POINTS, PANE_EAGER_CLOSES } = await import('./downsample.ts');
  const { feedPaneChart, paneChart, paneChartSrc } = await import('./chart-series.ts');
  const trades = heavyRecord();
  const now = new Date(Date.UTC(2026, 0, 15));
  const input = trades.map((t) => ({ id: t.id, symbol: t.symbol, returnPct: t.returnPct, closedAt: t.closedAt, holdingDays: t.holdingDays, thesis: 'a thesis that must not ride along' }));
  const lite = feedPaneChart(input, now), full = paneChart(input, now);
  assert.equal(lite.lite, 1);
  assert.equal(full.lite, undefined);
  assert.deepEqual(lite.trades, []);
  assert.ok(!JSON.stringify(lite).includes('a thesis'));
  const l = unpackChart(lite), f = unpackChart(full);
  assert.ok(l.ALL.pts.length <= FEED_LITE_POINTS && l.ALL.pts.length > FEED_LITE_POINTS / 2, String(l.ALL.pts.length));
  assert.ok(l.ALL.pts.every((p) => p.trade === null));
  for (const { key } of RANGES) {
    if (key !== 'ALL') assert.equal(l[key].pts.length, 0, key);
    const { pts: _a, ...ln } = l[key], { pts: _b, ...fn } = f[key];
    assert.deepEqual(ln, fn, key); // header total, count, drawdown, y range, range ends: the full chart's
  }
  // The stand-in keeps the line's ends and extremes (the line is not smoothed).
  const vals = (s: typeof l.ALL) => s.pts.map((p) => p.value);
  assert.equal(Math.min(...vals(l.ALL)), Math.min(...vals(f.ALL)));
  assert.equal(Math.max(...vals(l.ALL)), Math.max(...vals(f.ALL)));
  assert.equal(l.ALL.pts.at(-1)!.value, f.ALL.pts.at(-1)!.value);
  // Several times lighter than the full chart.
  assert.ok(JSON.stringify(lite).length * 5 < JSON.stringify(full).length, `${JSON.stringify(lite).length} vs ${JSON.stringify(full).length}`);
  // A short record ships whole: nothing to fetch.
  assert.equal(feedPaneChart(input.slice(0, PANE_EAGER_CLOSES), now).lite, undefined);
  assert.equal(feedPaneChart(input.slice(0, PANE_EAGER_CLOSES + 1), now).lite, 1);
  assert.equal(paneChartSrc('a b'), '/u/a%20b/pane-chart');
});

test('fix round 8 (tester re-run 4, Low): a near-total loss is never shipped as an exact total loss', async () => {
  const { packValue } = await import('./chart-series.ts');
  const { pct } = await import('./trades.ts');
  for (const v of [-0.9999997, -0.99999949, -0.9999995, -0.99999999, -0.5, 0.1234567891, -1, 0, 3.2]) {
    assert.equal(pct(packValue(v)), pct(v), String(v));
  }
  assert.equal(pct(packValue(-0.99999999)), '≈-100.0%'); // 6 decimals made it −1: "-100.0%"
  assert.equal(pct(-1), '-100.0%');
  assert.equal(packValue(0.1234567891), 0.123457); // rounded where it prints the same
  // End to end: a record that compounds to just above −100% scrubs to "≈-100.0%" at its last point, like the profile.
  const now = new Date(Date.UTC(2026, 0, 15));
  const t = (i: number, r: number) => ({ id: String(i), symbol: 'AAA', returnPct: r, closedAt: new Date(Date.UTC(2025, 5, 1 + i)), holdingDays: 1, thesis: null });
  const trades = unpackPoints(packPoints([t(1, -0.9999), t(2, -0.9999)]));
  const full = chartSeries(trades, 'ALL', now);
  const last = unpackChart(JSON.parse(JSON.stringify(packChart(trades, now, FEED_CHART_POINTS)))).ALL.pts.at(-1)!;
  assert.equal(pct(full.pts.at(-1)!.value), '≈-100.0%');
  assert.equal(pct(last.value), pct(full.pts.at(-1)!.value));
});
