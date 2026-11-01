// F-23 · the chart payloads (lib/chart-series.ts#packChart, lib/paging.ts#packPoints) carry the printed precision and UTC
// days; same-day closes keep their order and each its own x (AC 4, AC 9); range ends hold every point.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chartPoints, chartSeries, feedPaneChart, packChart, paneChart, profileChart, unpackChart, PAYLOAD_V } from './chart-series.ts';
import { packPoints, unpackPoints } from './paging.ts';
import { nearestIndex, RANGES, stepIndex } from './trades.ts';
import { wireDay, wirePct } from './public-wire.ts';

const DAY = 86_400_000;
const now = new Date('2026-10-14T18:00:00Z');
const t = (id: string, r: number, at: string) => ({ id, symbol: `S${id}`, returnPct: r, closedAt: new Date(at), holdingDays: 2.345678, thesis: null });
// A: odd return, 14:31:07 close; B: the same UTC day, later; C, D: earlier days.
const A = t('11', 0.123456789, '2026-10-14T14:31:07.123Z'), B = t('12', -0.0504999, '2026-10-14T16:02:41Z');
const REC = [t('9', 0.02, '2026-09-01T10:00:00Z'), t('10', -0.01, '2026-10-10T10:00:00Z'), A, B];

test('AC 9: packPoints carries the rounded return and the UTC day; the two same-day closes keep their order', () => {
  const p = packPoints(REC);
  assert.deepEqual(p[1], ['11', 'S11', 0.123, wireDay(A.closedAt), 2.3, null]);
  assert.equal(p[0][0], '12'); // list order: B (later) first
  assert.doesNotMatch(JSON.stringify(p), /1234|5049|\b1\d{12}\b/);
  const back = unpackPoints(p);
  assert.ok(back[0].closedAt > back[1].closedAt, 'B after A');
  assert.equal(wireDay(back[0].closedAt), wireDay(B.closedAt));
  assert.equal(wireDay(back[1].closedAt), wireDay(A.closedAt));
  // A chart drawn from them (the points path) scrubs A then B.
  const s = chartSeries(back, 'ALL', now);
  assert.deepEqual(s.pts.slice(-2).map((x) => x.trade!.id), ['11', '12']);
});

test('AC 4: the packed chart keeps two same-day closes in order, each at its own x; keys and drag reach each', () => {
  const c = JSON.parse(JSON.stringify(paneChart(REC, now)));
  assert.equal(c.v, PAYLOAD_V);
  assert.doesNotMatch(JSON.stringify(c), /1234|5049|0504999|\b1\d{12}\b/);
  for (const key of ['ALL', '1W'] as const) {
    const s = unpackChart(c)[key];
    const ids = s.pts.map((p) => p.trade?.id ?? null);
    assert.deepEqual(ids.slice(-2), ['11', '12'], key);
    const xs = s.pts.map((p) => ((p.at - s.t0) / (s.t1 - s.t0)) * 640);
    assert.ok(xs.at(-1)! > xs.at(-2)!, `${key}: distinct x`);
    for (const x of xs) assert.ok(x >= 0 && x <= 640, `${key}: x ${x} inside the chart`);
    // Pointer: the nearest point to each x is that point; keyboard: ArrowRight walks onto each.
    for (let i = 0; i < xs.length; i++) assert.equal(nearestIndex(xs, xs[i]), i);
    const last = xs.length - 1;
    assert.equal(stepIndex(last - 2, 1, xs.length), last - 1);
    assert.equal(stepIndex(last - 1, 1, xs.length), last);
    // The opened trade is the right one, with its figures at the printed precision.
    assert.equal(s.pts[last - 1].trade!.returnPct, 0.123);
    assert.equal(s.pts[last].trade!.returnPct, -0.05);
    assert.equal(s.pts[last].trade!.holdingDays, 2.3);
  }
});

test('every figure is computed on stored values: totals and drawdowns are wirePct of the stored-value series', () => {
  const pts = chartPoints(REC);
  for (const make of [paneChart, profileChart, feedPaneChart]) {
    const c = unpackChart(make(REC, now));
    for (const { key } of RANGES) {
      const s = chartSeries(pts, key, now);
      assert.equal(c[key].last, wirePct(s.last), key);
      assert.equal(c[key].drawdown, wirePct(s.drawdown), key);
      assert.equal(c[key].n, s.n, key);
    }
  }
  // chartPoints keeps the stored values (no rounding on the server's own path).
  assert.equal(pts.find((p) => p.id === '11')!.returnPct, 0.123456789);
});

test('the profile chart is every close (full resolution), and a long record compounds no rounding error into its total', () => {
  const many = Array.from({ length: 900 }, (_, i) => t(String(1000 + i), ((i * 37) % 200 - 100) / 1000 + 0.00049, new Date(Date.parse('2026-10-14T12:00:00Z') - i * 7 * 3_600_000).toISOString()));
  const c = profileChart(many, now);
  assert.equal(c.trades.length, 900);
  assert.equal(c.ranges.ALL.p.length, 901 * 3);
  const exact = chartSeries(chartPoints(many), 'ALL', now);
  assert.equal(c.ranges.ALL.last, wirePct(exact.last));
  const u = unpackChart(c).ALL;
  u.pts.forEach((p, i) => assert.equal(p.value, wirePct(exact.pts[i].value)));
});

test('AC 7: the chart fetch rejects a body of another payload version and forgets it', () => {
  const src = readFileSync(new URL('../app/u/[handle]/chart.tsx', import.meta.url), 'utf8');
  assert.match(src, /\.then\(\(c\) => \(c\.v === PAYLOAD_V \? c : Promise\.reject\(new Error\('payload version'\)\)\)\);/);
  assert.match(src, /p\.catch\(\(\) => fullCharts\.delete\(src\)\);/);
  // packChart stamps the version on every body (the stand-in too).
  assert.equal(packChart(chartPoints(REC), now, 80, true).v, PAYLOAD_V);
});

test('a day offset is a whole number and the base is a UTC day; range ends are whole days', () => {
  const c = paneChart(REC, now);
  assert.equal(c.base, wireDay(now.getTime() - 365 * DAY)); // the earliest point: the 1Y range's start
  for (const { key } of RANGES) {
    const r = c.ranges[key];
    for (let i = 0; i < r.p.length; i += 3) assert.ok(Number.isInteger(r.p[i]));
    assert.ok(Number.isInteger(r.t0) && Number.isInteger(r.t1) && String(r.t0).length === 5);
  }
  assert.equal(unpackChart(c)['1W'].t1, (wireDay(now) + 1) * DAY - 1);
});

test('ALL runs edge to edge with no tail (a 2-close record and a same-day pair); a dated range keeps every point inside', () => {
  for (const rec of [[t('1', 0.01, '2026-10-12T10:00:00Z'), t('2', 0.02, '2026-10-13T10:00:00Z')], [A, B]]) {
    const all = unpackChart(paneChart(rec, now)).ALL;
    const x = (at: number) => ((at - all.t0) / (all.t1 - all.t0)) * 640;
    assert.equal(x(all.pts[0].at), 0);
    assert.equal(x(all.pts.at(-1)!.at), 640);
    assert.ok(!(all.t1 > all.pts.at(-1)!.at), 'no tail');
    assert.equal(wireDay(all.t0), wireDay(rec[0].closedAt));
    assert.equal(wireDay(all.t1), wireDay(rec.at(-1)!.closedAt));
  }
  const w = unpackChart(paneChart([A, B], now))['1W'];
  for (const p of w.pts) assert.ok(p.at >= w.t0 && p.at <= w.t1);
});

test('code review 1 and 2: a drawdown near 100% keeps its printed (negated) accessible name; a dated range starts at its left edge', async () => {
  const { pct } = await import('./format.ts');
  for (const dd of [0.9995, 0.99951, 0.9999, 0.99996, 0.99999, 0.5, 0]) {
    const rec = [t('1', 0, '2026-10-12T10:00:00Z'), t('2', -dd, '2026-10-13T10:00:00Z')];
    const s = chartSeries(chartPoints(rec), 'ALL', now);
    const u = unpackChart(JSON.parse(JSON.stringify(paneChart(rec, now)))).ALL;
    assert.equal(pct(-u.drawdown, 0), pct(-s.drawdown, 0), String(dd));
    assert.equal(pct(-u.drawdown, 1), pct(-s.drawdown, 1), String(dd));
  }
  const w = unpackChart(paneChart([t('1', 0.01, '2026-10-09T10:00:00Z'), t('2', 0.02, '2026-10-12T10:00:00Z')], now))['1W'];
  assert.equal(w.pts[0].trade, null);
  assert.equal(w.pts[0].at, w.t0);
});

test('user test UX 1: closes at the same instant run in list order (the larger id is newer): the last step is the list top row', () => {
  const at = '2026-10-13T10:00:00Z';
  const rec = [t('5', 0.01, at), t('7', 0.02, at), t('6', -0.03, at)];
  const listTop = chartPoints(rec)[0].id; // list order: newest first, ties by the larger id
  assert.equal(listTop, '7');
  for (const c of [paneChart(rec, now), profileChart(rec, now)]) assert.deepEqual(unpackChart(c).ALL.pts.slice(1).map((p) => p.trade!.id), ['5', '6', '7']);
  assert.deepEqual(chartSeries(chartPoints(rec), 'ALL', now).pts.slice(1).map((p) => p.trade!.id), ['5', '6', '7']);
});
