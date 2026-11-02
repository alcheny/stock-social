// F-23 · chart precision (owner decision 2026-11-02, amends CH-1): from +100% the cumulative curve prints, and goes out,
// at about 3 significant figures; below, unchanged. The probe's curve channel (docs/features/logs/F-23/probe.md) is closed:
// consecutive points no longer give a close's return back finer than the row prints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { curvePct, pct, tone } from './format.ts';
import { wireCurve, wirePct } from './public-wire.ts';
import { chartPoints, chartSeries, paneChart, profileChart, unpackChart } from './chart-series.ts';

test('curvePct: unchanged below +100%; from +100% three significant figures with a thousands comma', () => {
  for (const x of [0, 0.123456, -0.5, -0.99984, -1, 0.9994, 0.4999]) for (const d of [0, 1]) assert.equal(curvePct(x, d), pct(x, d), `${x}`);
  assert.equal(curvePct(98.123), '+9,810%');
  assert.equal(curvePct(1.2345), '+123%');
  assert.equal(curvePct(1.2345, 0), '+123%');
  assert.equal(curvePct(0.99996), '+100%'); // prints 100.0 at one decimal: the 3-figure form
  assert.equal(curvePct(12.3456), '+1,230%');
  assert.equal(curvePct(1234.5678), '+123,000%');
  assert.equal(curvePct(9.996), '+1,000%');
});

test('wireCurve: what curvePct prints and no more; idempotent, monotone, never a different tone', () => {
  let seed = 5, prev = -Infinity;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < 50_000; i++) {
    const v = i % 2 ? rnd() * 200 : rnd() * 3 - 1;
    const r = wireCurve(v);
    for (const d of [0, 1]) assert.equal(curvePct(r, d), curvePct(v, d), `${v} → ${r}`);
    assert.equal(tone(r), tone(v));
    assert.equal(wireCurve(r), r);
    if (v >= 1) assert.ok((JSON.stringify(r).replace(/^-?0\.|\./, '').replace(/^0+/, '').replace(/0+$/, '')).length <= 3, `${v} → ${r}`);
  }
  for (let v = -1; v < 300; v += 0.0137) { const r = wireCurve(v); assert.ok(r >= prev, `${v}`); prev = r; }
  for (const v of [0.5, -0.3, 0.9]) assert.equal(wireCurve(v), wirePct(v));
  assert.equal(wireCurve(98.123), 98.1);
});

// Decode a close's return from two consecutive printed points: the set of returns consistent with both prints.
const interval = (printed: string): [number, number] => {
  const n = Number(printed.replace(/[+%,≈]/g, ''));
  const m = /\.(\d+)%$/.exec(printed);
  const half = m ? 0.5 * 10 ** -m[1].length : 0.5 * 10 ** (String(Math.round(Math.abs(n))).length - 3); // 3 figures
  return [(n - half) / 100, (n + half) / 100];
};

test('probe curve channel closed: on a record compounded to +12,000%, no close comes back from the curve finer than its row prints', () => {
  const DAY = 86_400_000, t0 = Date.parse('2025-01-01T12:00:00Z'), now = new Date('2026-10-31T00:00:00Z');
  const trades = Array.from({ length: 400 }, (_, i) => ({ id: String(1000 + i), symbol: 'X', returnPct: ((i * 37) % 23) / 1000 + 0.0123456 - 0.004, closedAt: new Date(t0 + i * DAY), holdingDays: 1, thesis: null }));
  const exact = chartSeries(chartPoints(trades), 'ALL', now);
  assert.ok(exact.last > 100, `the curve grew: ${exact.last}`);
  for (const make of [profileChart, paneChart]) {
    const all = unpackChart(JSON.parse(JSON.stringify(make(trades, now)))).ALL;
    const rowWidth = 0.001; // the row prints one decimal of a percent: a width of 0.1 point
    let minWidth = Infinity;
    for (let k = 1; k < all.pts.length; k++) {
      if (!all.pts[k].trade || !all.pts[k - 1].trade) continue;
      const [a0, a1] = interval(curvePct(all.pts[k - 1].value)), [b0, b1] = interval(curvePct(all.pts[k].value));
      const width = (1 + b1) / (1 + a0) - (1 + b0) / (1 + a1); // the decoded return's uncertainty
      if (all.pts[k].value >= 1) minWidth = Math.min(minWidth, width);
    }
    // Every decode from the 3-figure part of the curve is at least as uncertain as the row itself.
    assert.ok(minWidth >= rowWidth, `${make.name}: decoded width ${minWidth}`);
  }
  // Before the decision (one absolute decimal everywhere) the same decode was 10x finer than the row at this level.
  const old = (v: number) => interval(pct(v));
  const k = exact.pts.length - 1, [a0, a1] = old(exact.pts[k - 1].value), [b0, b1] = old(exact.pts[k].value);
  assert.ok((1 + b1) / (1 + a0) - (1 + b0) / (1 + a1) < 0.0001);
});
