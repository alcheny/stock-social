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
import { byListOrder, noteDaysOf, withNoteDays, type ChartPoint, type PackInput } from './paging.ts';
import { wireDay, wireHold, wirePct } from './public-wire.ts'; // F-23

const DAY = 86_400_000;

export type SeriesPt = { value: number; at: number; trade: ChartPoint | null };
export type Series = { pts: SeriesPt[]; t0: number; t1: number; last: number; n: number; drawdown: number; min: number; max: number };

export function chartSeries(trades: ChartPoint[], key: RangeKey, now: Date, maxPoints = Infinity): Series {
  const spec = RANGES.find((r) => r.key === key)!;
  // F-23 (user test, UX 1): closes at the same instant run in list order, oldest row first (the list's tie-break: the
  // larger id is newer), so the last key step and the right edge land on the list's top row. equityCurve's sort is
  // stable, so this order holds through it.
  const ordered = [...rangeTrades(trades, key, now)].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime() || b.index - a.index);
  const curve = equityCurve(ordered);
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
export const PAYLOAD_V = 3; // F-34: the pane model carries openLine
// FIXES-CYCLE4-PART2 (F4-16): a dated published note adds its written and edited UTC day numbers (lib/paging.ts#noteDays).
export type PackedTrade = [id: string, symbol: string, returnPct: number, holdingDays: number, thesis: string | null, index: number, writtenDay?: number | null, editedDay?: number | null];
export type PackedSeries = { t0: number; t1: number; last: number; n: number; dd: number; min: number; max: number; p: number[] };
// `sfx` (F-23 tester, Medium 1): no range was downsampled, so every close is in ALL and a dated range's closes are the
// last `n` of ALL's (chartSeries sorts every range alike; rangeTrades keeps a suffix). Positions then say what the close
// indices, row indices and a dated range's days would (compact/expand below). A dense 4,700-close profile shipped most
// closes twice (445 KB against the 400 KB budget).
export type PackedChart = { v: typeof PAYLOAD_V; base: number; trades: PackedTrade[]; ranges: Record<RangeKey, PackedSeries>; lite?: 1; sfx?: 1 };

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
          const days = t.thesis !== null && (t.writtenDay != null || t.editedDay != null) ? [t.writtenDay ?? null, t.editedDay ?? null] as [number | null, number | null] : null;
          out.push(withNoteDays<PackedTrade>([t.id, t.symbol, wirePct(t.returnPct), wireHold(t.holdingDays), t.thesis, t.index], 6, days)); // FIXES-CYCLE4-PART2 (F4-16)
        }
      }
      if (lite) p.push(wireDay(pt.at) - base, wirePct(pt.value)); // no close: pairs
      else p.push(wireDay(pt.at) - base, wirePct(pt.value), i);
    }
    ranges[key] = { t0: wireDay(s.t0), t1: wireDay(s.t1), last: wirePct(s.last), n: s.n, dd: -wirePct(-s.drawdown) || 0 /* printed negated ("max drawdown -99.999%"): rounded as printed */, min: wirePct(s.min), max: wirePct(s.max), p };
  }
  if (lite) return { v: PAYLOAD_V, base, trades: out, ranges, lite: 1 };
  const full: PackedChart = { v: PAYLOAD_V, base, trades: out, ranges };
  return series.every(([, s]) => s.pts.length === s.n + 1) ? compact(full) : full;
}

// The `sfx` form of a chart no range of which was downsampled (see PackedChart): ALL's points as [day, value] pairs,
// close k (from the oldest) being trades[k] and, in list order, row n-1-k (the chart runs in reverse list order:
// chartSeries sorts by close time, then the row index descending); trades without their row index; a dated range's
// points as its values only. expand() restores the regular form exactly (lib/chart-series.f23.test.ts).
function compact(c: PackedChart): PackedChart {
  const all = c.ranges.ALL.p, pairs: number[] = [], trades: PackedTrade[] = [];
  for (let i = 0; i < all.length; i += 3) {
    pairs.push(all[i], all[i + 1]);
    if (all[i + 2] >= 0) { const t = c.trades[all[i + 2]]; trades.push([...t.slice(0, 5), ...t.slice(6)] as unknown as PackedTrade); } // no row index; note days (F4-16) move up one
  }
  // Only when positions really say the row index (every close in ALL, in reverse list order); else the regular form.
  if (trades.length !== c.trades.length || c.trades.some((_, k) => c.trades[all[(k + 1) * 3 + 2]][5] !== trades.length - 1 - k)) return c;
  const ranges = { ...c.ranges, ALL: { ...c.ranges.ALL, p: pairs } };
  for (const { key } of RANGES) if (key !== 'ALL') { const p = c.ranges[key].p; ranges[key] = { ...c.ranges[key], p: p.filter((_, i) => i % 3 === 1).slice(1) }; }
  return { v: c.v, base: c.base, trades, ranges, sfx: 1 };
}
export function expand(c: PackedChart): PackedChart {
  if (!c.sfx) return c;
  const n = c.trades.length, pairs = c.ranges.ALL.p, all: number[] = [];
  for (let i = 0; i < pairs.length; i += 2) all.push(pairs[i], pairs[i + 1], i / 2 - 1);
  const trades = c.trades.map((t, k) => [...t.slice(0, 5), n - 1 - k, ...t.slice(5)] as unknown as PackedTrade);
  const ranges = { ...c.ranges, ALL: { ...c.ranges.ALL, p: all } };
  for (const { key } of RANGES) {
    if (key === 'ALL') continue;
    const r = c.ranges[key], first = n - r.n, p = [r.t0 - c.base, 0, -1];
    for (let k = 0; k < r.n; k++) p.push(all[(first + k + 1) * 3], r.p[k], first + k);
    ranges[key] = { ...r, p };
  }
  return { v: c.v, base: c.base, trades, ranges };
}

// F-23: a record's closes as chart points, in list order with their row index, from stored values (no rounding: the
// server computes every figure on these; packChart rounds its output).
// FIXES-CYCLE4-PART2 (F4-16): a published note's written and edited UTC days ride along (days, never times).
type PaneInput = PackInput[];
export const chartPoints = (trades: PaneInput): ChartPoint[] =>
  [...trades].sort(byListOrder).map((t, index) => {
    const days = noteDaysOf(t);
    return { id: t.id, symbol: t.symbol, returnPct: t.returnPct, closedAt: t.closedAt, holdingDays: t.holdingDays, thesis: t.thesis, index, ...(days ? { writtenDay: days[0], editedDay: days[1] } : {}) };
  });

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
// the cursor. The spread says only the order, which the list shows. A dated range (1W…1Y) starts at its first day's
// start and ends at its last day's end; ALL runs from its first point to its last.
export function unpackChart(packed: PackedChart): Record<RangeKey, Series> {
  const c = expand(packed);
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
        const [id, symbol, returnPct, holdingDays, thesis, index, w, e] = c.trades[j];
        trade = trades[j] ??= { id, symbol, returnPct, closedAt: new Date(at), holdingDays, thesis, index,
          ...(thesis !== null && (w != null || e != null) ? { writtenDay: w ?? null, editedDay: e ?? null } : {}) }; // FIXES-CYCLE4-PART2 (F4-16)
      }
      pts.push({ at, value: r.p[i + 1], trade });
      }
    }
    // A dated range's start point (0%, no close) sits on the range's left edge (code review 2), not spread in its day.
    if (key !== 'ALL' && pts.length && !pts[0].trade) pts[0] = { ...pts[0], at: r.t0 * DAY };
    // ponytail: a dated range ends at the end of today's UTC day, not at the request time (the wire carries no time
    // finer than a day), so its flat tail after the last close runs up to a day longer than before F-23 — an x-axis
    // shift of at most 1/7 of the 1W width; sending `now` to the minute would undo it at the cost of a sub-day time.
    // ALL spans its first point to its last (edge to edge, no tail, as before F-23); a dated range ends at today's end.
    const all = key === 'ALL' && pts.length > 0;
    out[key] = { pts, t0: all ? pts[0].at : r.t0 * DAY, t1: all ? pts[pts.length - 1].at : (r.t1 + 1) * DAY - 1, last: r.last, n: r.n, drawdown: r.dd, min: r.min, max: r.max };
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
