// The performance chart's drawn series for one range (CH-1): the range start at 0%, then one point per close,
// compounded (equityCurve). The profile computes it in the browser at full resolution from the whole record.
// F-1 PR-3 fix round 7 (business lead re-sit, demand 2): the feed pane draws the same series at screen resolution. The
// server computes each range's series once per trader, keeps at most `maxPoints` of its points (min/max per x slice,
// lib/downsample.ts: the first and last point and every extreme stay), and ships only those points and the closes they
// land on. Before, each card drew one path point per close and the client received the whole record: a feed of heavy
// records weighed 3.5 MB. The header total, the trade count, the max drawdown and the y range are still computed from
// every close in the range, so the numbers the pane shows are the profile's numbers.
import { RANGES, curveDomain, equityCurve, maxDrawdown, rangeTrades, type RangeKey } from './trades.ts';
import { downsampleIndices } from './downsample.ts';
import type { ChartPoint } from './paging.ts';

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
// of kept points [minutes after `base`, value, close (-1 for the range start)]. Times are floored to the minute (a
// point's date never moves to the next day; the range ends are floored alike); values keep 6 decimals (the header shows 1 decimal of a percent).
export type PackedTrade = [id: string, symbol: string, returnPct: number, holdingDays: number, thesis: string | null, index: number];
export type PackedSeries = { t0: number; t1: number; last: number; n: number; dd: number; min: number; max: number; p: number[] };
export type PackedChart = { base: number; trades: PackedTrade[]; ranges: Record<RangeKey, PackedSeries> };

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const MIN = 60_000;

export function packChart(trades: ChartPoint[], now: Date, maxPoints: number): PackedChart {
  const out: PackedTrade[] = [];
  const ref = new Map<string, number>();
  const series = RANGES.map(({ key }) => [key, chartSeries(trades, key, now, maxPoints)] as const);
  const base = Math.floor(Math.min(...series.flatMap(([, s]) => s.pts.map((p) => p.at))) / MIN) * MIN;
  const ranges = {} as Record<RangeKey, PackedSeries>;
  for (const [key, s] of series) {
    const p: number[] = [];
    for (const pt of s.pts) {
      let i = -1;
      if (pt.trade) {
        const t = pt.trade;
        i = ref.get(t.id) ?? -1;
        if (i < 0) {
          i = out.length;
          ref.set(t.id, i);
          out.push([t.id, t.symbol, r6(t.returnPct), t.holdingDays, t.thesis, t.index]);
        }
      }
      p.push(Math.floor((pt.at - base) / MIN), r6(pt.value), i);
    }
    ranges[key] = { t0: Math.floor(s.t0 / MIN) * MIN, t1: Math.floor(s.t1 / MIN) * MIN, last: s.last, n: s.n, dd: s.drawdown, min: s.min, max: s.max, p };
  }
  return { base, trades: out, ranges };
}

export function unpackChart(c: PackedChart): Record<RangeKey, Series> {
  const trades: (ChartPoint | undefined)[] = new Array(c.trades.length);
  const out = {} as Record<RangeKey, Series>;
  for (const { key } of RANGES) {
    const r = c.ranges[key];
    const pts: SeriesPt[] = [];
    for (let i = 0; i < r.p.length; i += 3) {
      const at = c.base + r.p[i] * MIN, k = r.p[i + 2];
      let trade: ChartPoint | null = null;
      if (k >= 0) {
        const [id, symbol, returnPct, holdingDays, thesis, index] = c.trades[k];
        trade = trades[k] ??= { id, symbol, returnPct, closedAt: new Date(at), holdingDays, thesis, index };
      }
      pts.push({ at, value: r.p[i + 1], trade });
    }
    out[key] = { pts, t0: r.t0, t1: r.t1, last: r.last, n: r.n, drawdown: r.dd, min: r.min, max: r.max };
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
