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

// Wire format for the feed pane: the closes the kept points land on (once per trader, shared by every range), and per
// range its numbers and a flat list of kept points [at ms, value, close (-1 for the range start)].
export type PackedTrade = [id: string, symbol: string, returnPct: number, closedAt: number, holdingDays: number, thesis: string | null, index: number];
export type PackedSeries = { t0: number; t1: number; last: number; n: number; dd: number; min: number; max: number; p: number[] };
export type PackedChart = { trades: PackedTrade[]; ranges: Record<RangeKey, PackedSeries> };

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function packChart(trades: ChartPoint[], now: Date, maxPoints: number): PackedChart {
  const out: PackedTrade[] = [];
  const ref = new Map<string, number>();
  const ranges = {} as Record<RangeKey, PackedSeries>;
  for (const { key } of RANGES) {
    const s = chartSeries(trades, key, now, maxPoints);
    const p: number[] = [];
    for (const pt of s.pts) {
      let i = -1;
      if (pt.trade) {
        const t = pt.trade;
        i = ref.get(t.id) ?? -1;
        if (i < 0) {
          i = out.length;
          ref.set(t.id, i);
          out.push([t.id, t.symbol, t.returnPct, t.closedAt.getTime(), t.holdingDays, t.thesis, t.index]);
        }
      }
      p.push(pt.at, r6(pt.value), i);
    }
    ranges[key] = { t0: s.t0, t1: s.t1, last: s.last, n: s.n, dd: s.drawdown, min: s.min, max: s.max, p };
  }
  return { trades: out, ranges };
}

export function unpackChart(c: PackedChart): Record<RangeKey, Series> {
  const trades: ChartPoint[] = c.trades.map(([id, symbol, returnPct, at, holdingDays, thesis, index]) => ({ id, symbol, returnPct, closedAt: new Date(at), holdingDays, thesis, index }));
  const out = {} as Record<RangeKey, Series>;
  for (const { key } of RANGES) {
    const r = c.ranges[key];
    const pts: SeriesPt[] = [];
    for (let i = 0; i < r.p.length; i += 3) pts.push({ at: r.p[i], value: r.p[i + 1], trade: r.p[i + 2] < 0 ? null : trades[r.p[i + 2]] });
    out[key] = { pts, t0: r.t0, t1: r.t1, last: r.last, n: r.n, drawdown: r.dd, min: r.min, max: r.max };
  }
  return out;
}
