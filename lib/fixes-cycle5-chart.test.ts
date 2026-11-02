// FIXES-CYCLE5 (F5-14, C5-12): a heavy profile sends a bounded chart series (lib/chart-bounded.ts, profileChart). An
// 80,000-close fictional record: the packed chart stays within PROFILE_CHART_POINTS per range and a pinned gzipped size,
// every figure the chart prints at rest (header total, accessible label with trade count and max drawdown, the plotted
// span's end dates, the last-close date, the y range with 0%) equals the full-resolution chart's, every slice keeps its
// first, last, lowest and highest point, and the payload stays percent-only. The rendered page's bytes are pinned by
// e2e/fixes-cycle5-chart.spec.ts. Bytes and counts only, never wall-clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { chartPoints, chartSeries, packChart, profileChart, unpackChart, type Series } from './chart-series.ts';
import { boundedIndices, PROFILE_CHART_POINTS } from './chart-bounded.ts';
import { RANGES, pct } from './trades.ts';
import { wirePct } from './public-wire.ts';

const DAY = 86_400_000;
const now = new Date(Date.UTC(2026, 10, 2, 15, 0, 0));
// Closes every 30 minutes back from two days ago (about 4.6 years), returns from -2% to +2% in a fixed scramble.
const record = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: String(500_000 + i), symbol: `L${i % 300}`, returnPct: (((i * 7919) % 401) - 200) / 10_000,
  closedAt: new Date(now.getTime() - 2 * DAY - i * 1_800_000), holdingDays: 3, thesis: i % 997 === 0 ? `note ${i}` : null,
}));
const HEAVY = record(80_000);
const bounded = profileChart(HEAVY, now);
const full = packChart(chartPoints(HEAVY), now, Infinity); // the pre-F5-14 profile payload: every close
const B = unpackChart(bounded), F = unpackChart(full);

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
// What the chart prints at rest for a range (app/u/[handle]/chart.tsx): header value, the role="img" summary label, the
// plotted span's end dates, the whole record's last-close day, and the y range (which holds 0%).
function printed(all: Record<string, Series>, key: string) {
  const s = all[key];
  const closes = s.pts.filter((p) => p.trade);
  const ends = key === 'ALL' ? (s.n > 0 ? [s.t0, s.t1] : null) : closes.length ? [closes[0].at, closes[closes.length - 1].at] : null;
  return {
    header: pct(s.last, 1),
    label: `${s.n} trades, ${pct(s.last, 0)} total, max drawdown ${pct(-s.drawdown, 0)}`,
    ends: ends?.map(isoDay) ?? null,
    lastClose: isoDay(all.ALL.t1),
    min: s.min, max: s.max, drawdown: s.drawdown, n: s.n, last: s.last,
    zeroOnAxis: s.min <= 0 && s.max >= 0,
  };
}

test('F5-14: an 80,000-close profile chart is bounded per range and in gzipped bytes', () => {
  for (const { key } of RANGES) {
    const kept = bounded.ranges[key].p.length / 3;
    assert.ok(kept <= PROFILE_CHART_POINTS, `${key}: ${kept} points`);
  }
  assert.equal(F.ALL.pts.length, 80_001, 'the full-resolution payload had every close');
  assert.ok(B.ALL.pts.length > 1_000, 'the bounded line still has screen resolution');
  assert.ok(bounded.trades.length <= RANGES.length * PROFILE_CHART_POINTS, `${bounded.trades.length} trades`);
  const gz = gzipSync(JSON.stringify(bounded)).length, gzFull = gzipSync(JSON.stringify(full)).length;
  assert.ok(gz < 160_000, `bounded chart ${gz} B gzipped`); // the chart alone; the whole page's 300 KB bound is e2e/fixes-cycle5-chart.spec.ts
  assert.ok(gzFull > 2.5 * gz, `full ${gzFull} B vs bounded ${gz} B`); // budget 5,000 (e2e run: 2,000 broke dense-profile pins)
});

test('F5-14: every figure the chart prints at rest equals the full-resolution chart', () => {
  for (const { key } of RANGES) {
    assert.deepEqual(printed(B, key), printed(F, key), key);
    // And both equal the server's computation from every stored close, at the printed precision.
    const s = chartSeries(chartPoints(HEAVY), key, now);
    assert.equal(B[key].last, wirePct(s.last), key);
    assert.equal(B[key].drawdown, -wirePct(-s.drawdown) || 0, key);
    assert.equal(B[key].n, s.n, key);
    assert.equal(B[key].min, wirePct(s.min), key);
    assert.equal(B[key].max, wirePct(s.max), key);
    assert.ok(printed(B, key).zeroOnAxis, `${key}: 0% on the axis`);
  }
  // The drawn line reaches the record's lowest and highest cumulative values (drawdowns stay visible), and ends on the total.
  for (const { key } of RANGES) {
    const vs = B[key].pts.map((p) => p.value), fv = F[key].pts.map((p) => p.value);
    assert.equal(Math.min(...vs), Math.min(...fv), `${key} low`);
    assert.equal(Math.max(...vs), Math.max(...fv), `${key} high`);
    assert.equal(vs[vs.length - 1], fv[fv.length - 1], `${key} end`);
  }
});

test('F5-14: each kept point carries its own close (symbol, return, note, row), and only kept points do', () => {
  const keptIds = new Set<string>();
  for (const { key } of RANGES) {
    const byId = new Map(F[key].pts.filter((p) => p.trade).map((p) => [p.trade!.id, p])); // a range compounds from its start
    for (const p of B[key].pts) {
      if (!p.trade) continue;
      keptIds.add(p.trade.id);
      const f = byId.get(p.trade.id)!;
      assert.ok(f, p.trade.id);
      assert.equal(p.value, f.value);
      assert.equal(isoDay(p.at), isoDay(f.at));
      for (const k of ['symbol', 'returnPct', 'holdingDays', 'thesis', 'index'] as const) assert.equal(p.trade[k], f.trade![k], `${p.trade.id} ${k}`);
    }
  }
  assert.equal(bounded.trades.length, keptIds.size, 'no close is sent that no point lands on');
});

test('F5-14: boundedIndices keeps the start, the first and last close, and every slice first, last, low and high', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648);
  for (const [n, max] of [[5_000, 403], [80_001, PROFILE_CHART_POINTS], [10, 7], [1_000, 1_000]] as const) {
    const xs: number[] = [0], ys: number[] = [0];
    for (let i = 1; i < n; i++) { xs.push(xs[i - 1] + Math.floor(rnd() * 3)); ys.push(ys[i - 1] + rnd() - 0.5); }
    const keep = boundedIndices(xs, ys, max);
    assert.ok(keep.length <= max, `${n}/${max}: ${keep.length}`);
    keep.forEach((k, j) => j && assert.ok(k > keep[j - 1], 'ascending, no repeats'));
    if (n <= max) { assert.equal(keep.length, n); continue; }
    const set = new Set(keep);
    for (const i of [0, 1, n - 1]) assert.ok(set.has(i), `${n}: keeps ${i}`);
    const slices = Math.floor((max - 3) / 4), x0 = xs[0], x1 = xs[n - 1];
    const groups = new Map<number, number[]>();
    for (let i = 2; i < n - 1; i++) {
      const s = Math.min(slices - 1, Math.floor(((xs[i] - x0) / (x1 - x0)) * slices));
      groups.set(s, [...(groups.get(s) ?? []), i]);
    }
    for (const [s, ids] of groups) {
      assert.ok(set.has(ids[0]) && set.has(ids[ids.length - 1]), `slice ${s}: first and last`);
      const vals = ids.map((i) => ys[i]), lo = Math.min(...vals), hi = Math.max(...vals);
      assert.ok(ids.some((i) => set.has(i) && ys[i] === lo), `slice ${s}: low`);
      assert.ok(ids.some((i) => set.has(i) && ys[i] === hi), `slice ${s}: high`);
    }
  }
});

test('F5-14: the bounded payload is percent-only: closes carry id, symbol, return, hold, note and row, nothing else', () => {
  for (const t of bounded.trades) {
    assert.ok(t.length === 6 || t.length === 8, `${t.length} fields`);
    const [id, symbol, r, hold, thesis, index] = t;
    assert.equal(typeof id, 'string');
    assert.equal(typeof symbol, 'string');
    assert.ok(Math.abs(r) <= 1, 'a return is a fraction (percent), never a price');
    assert.equal(typeof hold, 'number');
    assert.ok(thesis === null || typeof thesis === 'string');
    assert.ok(Number.isInteger(index));
  }
  assert.deepEqual(Object.keys(bounded).sort(), ['base', 'ranges', 'trades', 'v']);
  for (const { key } of RANGES) assert.deepEqual(Object.keys(bounded.ranges[key]).sort(), ['dd', 'last', 'max', 'min', 'n', 'p', 't0', 't1']);
  assert.doesNotMatch(JSON.stringify(bounded), /price|units|quantity|amount|\$/i);
});

test('F5-14: a record within the budget is sent whole, exactly as before (the compact form)', () => {
  const rec = record(PROFILE_CHART_POINTS - 1); // ALL has the range start plus every close: exactly the budget
  assert.deepEqual(profileChart(rec, now), packChart(chartPoints(rec), now, Infinity));
  assert.equal(profileChart(rec, now).sfx, 1);
  const over = record(PROFILE_CHART_POINTS);
  assert.notDeepEqual(profileChart(over, now), packChart(chartPoints(over), now, Infinity));
});
