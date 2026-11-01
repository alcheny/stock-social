// The performance chart's drawn series for one range (CH-1): the range start at 0%, then one point per close,
// compounded (equityCurve). The profile computes it in the browser at full resolution from the whole record.
// F-1 PR-3 fix round 7 (business lead re-sit, demand 2): the feed pane draws the same series at screen resolution. The
// server computes each range's series once per trader, keeps at most `maxPoints` of its points (min/max per x slice,
// lib/downsample.ts: the first and last point and every extreme stay), and ships only those points and the closes they
// land on. Before, each card drew one path point per close and the client received the whole record: a feed of heavy
// records weighed 3.5 MB. The header total, the trade count, the max drawdown and the y range are still computed from
// every close in the range, so the numbers the pane shows are the profile's numbers.
import { RANGES, curveDomain, equityCurve, maxDrawdown, pct, rangeTrades, type RangeKey } from './trades.ts';
import { downsampleIndices, FEED_CHART_POINTS, FEED_LITE_POINTS, PANE_EAGER_CLOSES } from './downsample.ts';
import { byListOrder, type ChartPoint } from './paging.ts';
import { wireDay, wireHold, wirePct } from './public-wire.ts'; // F-23

const DAY = 86_400_000;

export type SeriesPt = { value: number; at: number; trade: ChartPoint | null };
export type Series = { pts: SeriesPt[]; t0: number; t1: number; last: number; n: number; drawdown: number; min: number; max: number };

export function chartSeries(trades: ChartPoint[], key: RangeKey, now: Date, maxPoints = Infinity): Series {
  const spec = RANGES.find((r) => r.key === key)!;
  const curve = equityCurve(rangeTrades(trades, key, now));
  const last = curve.length ? curve[curve.length - 1].cumulative : 0;
  const t0 = spec.days === null ? (curve[0]?.trade.closedAt.getTime() ?? 0) : now.getTime() - spec.days * DAY;
  const t1 = spec.days === null ? (curve[curve.length - 1]?.trade.closedAt.getTime() ?? 0) : now.getTime();
  let pts: SeriesPt[] = [{ value: 0, at: t0, trade: null }, ...curve.map((p) => ({ value: p.cumulative, at: p.trade.closedAt.getTime(), trade: p.trade }))];
  if (pts.length > maxPoints) {
    const all = pts;
    pts = downsampleIndices(all.map((p) => p.at), all.map((p) => p.value), maxPoints).map((i) => all[i]);
  }
  const { min, max } = curveDomain(curve);
  return { pts, t0, t1, last, n: curve.length, drawdown: maxDrawdown(curve), min, max };
}

// Wire format for the feed pane, compact because every trader on the feed ships one: the closes the kept points land
// on (once per trader, shared by every range; a close's time is its point's), and per range its numbers and a flat list
// of kept points [days after `base`, value, close (-1 for the range start)].
// Fix round 8 (tester re-run 4, Medium): `lite` marks the feed's server-rendered stand-in: only the ALL line, at
// FEED_LITE_POINTS, as [days, value] pairs with no closes attached, and every range's numbers (header, label, tabs).
// The pane fetches the full chart (`/u/<handle>/pane-chart`) on its first swipe-open, so the feed page no longer
// carries each trader's chart data.
// F-23 (docs/features/F-23-public-payload-precision.md): this is a public payload, so it carries what the chart prints
// and no more. Every return, point value, total, drawdown and y bound goes out through wirePct (lib/public-wire.ts:
// the printed precision), every time as a UTC day (`base`, `t0`, `t1` are days since 1970-01-01; a point is days after
// `base`), hold days at one decimal. Every figure is computed first, from stored values (chartSeries on the caller's
// stored closes); only the output is rounded. `v` is the format version (PAYLOAD_V): the routes' URLs carry it too, so
// no cache serves a pre-F-23 body to a new client.
export const PAYLOAD_V = 2;
export type PackedTrade = [id: string, symbol: string, returnPct: number, holdingDays: number, thesis: string | null, index: number];
export type PackedSeries = { t0: number; t1: number; last: number; n: number; dd: number; min: number; max: number; p: number[] };
export type PackedChart = { v: typeof PAYLOAD_V; base: number; trades: PackedTrade[]; ranges: Record<RangeKey, PackedSeries>; lite?: 1 };

// Kept for its callers: a chart value at the printed precision (F-23: wirePct; it was 6 decimals).
export const packValue = (v: number): number => wirePct(v);

export function packChart(trades: ChartPoint[], now: Date, maxPoints: number, lite = false): PackedChart {
  const out: PackedTrade[] = [];
  const ref = new Map<string, number>();
  const series = RANGES.map(({ key }) => [key, chartSeries(trades, key, now, maxPoints)] as const);
  const base = wireDay(Math.min(...series.flatMap(([, s]) => s.pts.map((p) => p.at))));
  const ranges = {} as Record<RangeKey, PackedSeries>;
  for (const [key, s] of series) {
    const p: number[] = [];
    for (const pt of lite && key !== 'ALL' ? [] : s.pts) {
      let i = -1;
      if (pt.trade && !lite) {
        const t = pt.trade;
        i = ref.get(t.id) ?? -1;
        if (i < 0) {
          i = out.length;
          ref.set(t.id, i);
          out.push([t.id, t.symbol, wirePct(t.returnPct), wireHold(t.holdingDays), t.thesis, t.index]);
        }
      }
      if (lite) p.push(wireDay(pt.at) - base, wirePct(pt.value)); // no close: pairs
      else p.push(wireDay(pt.at) - base, wirePct(pt.value), i);
    }
    ranges[key] = { t0: wireDay(s.t0), t1: wireDay(s.t1), last: wirePct(s.last), n: s.n, dd: wirePct(s.drawdown), min: wirePct(s.min), max: wirePct(s.max), p };
  }
  return lite ? { v: PAYLOAD_V, base, trades: out, ranges, lite: 1 } : { v: PAYLOAD_V, base, trades: out, ranges };
}

// F-23: a record's closes as chart points, in list order with their row index, from stored values (no rounding: the
// server computes every figure on these; packChart rounds its output).
type PaneInput = { id: string; symbol: string; returnPct: number; closedAt: Date; holdingDays: number; thesis: string | null }[];
export const chartPoints = (trades: PaneInput): ChartPoint[] =>
  [...trades].sort(byListOrder).map((t, index) => ({ id: t.id, symbol: t.symbol, returnPct: t.returnPct, closedAt: t.closedAt, holdingDays: t.holdingDays, thesis: t.thesis, index }));

// The feed pane's chart (fix round 7), from a trader's whole record.
export const paneChart = (trades: PaneInput, now: Date): PackedChart => packChart(chartPoints(trades), now, FEED_CHART_POINTS);
// F-23: the profile's chart, every close (full resolution, F-1 fix round 7), ranges computed on the server from stored
// values: the browser compounds nothing, so rounded returns never move a printed total or scrub value.
export const profileChart = (trades: PaneInput, now: Date): PackedChart => packChart(chartPoints(trades), now, Infinity);
// Fix round 8 (tester re-run 4, Medium): what the feed page carries per trader. A record longer than PANE_EAGER_CLOSES
// ships only the stand-in line (`lite`); the pane fetches `paneChart` from `paneChartSrc` (app/u/[handle]/pane-chart)
// on its first swipe-open. Every number the pane shows (header, label, tabs, summary, stats) is in the page either way.
export const feedPaneChart = (trades: PaneInput, now: Date): PackedChart =>
  trades.length <= PANE_EAGER_CLOSES ? paneChart(trades, now) : packChart(chartPoints(trades), now, FEED_LITE_POINTS, true);
export const paneChartSrc = (handle: string) => `/u/${encodeURIComponent(handle)}/pane-chart?v=${PAYLOAD_V}`;

// F-23: a wire day back to a time for drawing. Points of one UTC day are spread across it in their order (the k-th of m
// at k+1 m+1ths of the day), so same-day closes never share an x: a drag reaches each, and release opens the one under
// the cursor. The spread says only the order, which the list shows. A range starts at its first day's start and ends
// at its last day's end.
export function unpackChart(c: PackedChart): Record<RangeKey, Series> {
  const trades: (ChartPoint | undefined)[] = new Array(c.trades.length);
  const out = {} as Record<RangeKey, Series>;
  for (const { key } of RANGES) {
    const r = c.ranges[key];
    const pts: SeriesPt[] = [];
    const stride = c.lite ? 2 : 3;
    for (let i = 0; i < r.p.length;) {
      let end = i; // the run of points on this day: [i, end)
      while (end < r.p.length && r.p[end] === r.p[i]) end += stride;
      const m = (end - i) / stride;
      for (let k = 0; k < m; k++, i += stride) {
      const at = (c.base + r.p[i]) * DAY + Math.round(((k + 1) / (m + 1)) * DAY), j = c.lite ? -1 : r.p[i + 2];
      let trade: ChartPoint | null = null;
      if (j >= 0) {
        const [id, symbol, returnPct, holdingDays, thesis, index] = c.trades[j];
        trade = trades[j] ??= { id, symbol, returnPct, closedAt: new Date(at), holdingDays, thesis, index };
      }
      pts.push({ at, value: r.p[i + 1], trade });
      }
    }
    out[key] = { pts, t0: r.t0 * DAY, t1: (r.t1 + 1) * DAY - 1, last: r.last, n: r.n, drawdown: r.dd, min: r.min, max: r.max };
  }
  return out;
}

// The line's SVG path: an absolute move, then one relative lineto run ("M x y l dx dy dx dy …"), coordinates in tenths.
// Each delta is taken between rounded absolute positions, so rounding never drifts along the line. About a third shorter
// than absolute "L x y" pairs; draws the same line.
export function pathD(xs: number[], ys: number[]): string {
  if (!xs.length) return '';
  const t = (v: number) => Math.round(v * 10);
  const num = (n: number) => String(n / 10);
  let px = t(xs[0]), py = t(ys[0]);
  let d = `M${num(px)} ${num(py)}`;
  for (let i = 1; i < xs.length; i++) {
    const x = t(xs[i]), y = t(ys[i]);
    const dx = num(x - px), dy = num(y - py);
    d += `${i === 1 ? 'l' : dx.startsWith('-') ? '' : ' '}${dx}${dy.startsWith('-') ? '' : ' '}${dy}`;
    px = x; py = y;
  }
  return d;
}
