// FIXES-CYCLE5 (F5-14, C5-12): the profile chart's series is bounded. Before, the profile shipped every close of every
// range (F-23 profileChart at full resolution): an 80,000-close record weighed 3.7 MB of HTML (424 KB gzipped), most of
// it the chart. A range longer than PROFILE_CHART_POINTS is now split into equal slices of time, and each slice keeps
// its first, last, lowest and highest point of the cumulative line (in x order); the range start (0%), the first close
// and the last close are always kept. So the drawn line reaches every extreme it reached before at this width, and every
// figure the chart prints at rest is unchanged: the total, the trade count, the max drawdown (per-trade, equal-weight)
// and the y range are computed from every close (lib/chart-series.ts#chartSeries), and the plotted span's end dates are
// the first and last close, both kept. Scrub details (symbol, return, thesis, row index) ride only on the kept points;
// every close stays reachable through the paged closed-trade list (lib/paging.ts#closesWindow).
// Pure; returns the kept indices, ascending.

// 4 points per slice: 499 slices, under 1 slice per viewBox unit of the 640-wide chart, so a slice spans at most about
// 1.3 CSS px on a 360 px phone and about 1 CSS px at the chart's full width. A record of at most this many closes per
// range is sent whole (the compact `sfx` form).
export const PROFILE_CHART_POINTS = 2_000;

export function boundedIndices(xs: number[], ys: number[], max: number): number[] {
  const n = ys.length;
  if (n <= max) return ys.map((_, i) => i);
  // Always kept: the range start (0), the first close (1) and the last close (n - 1).
  const slices = Math.max(1, Math.floor((max - 3) / 4));
  const x0 = xs[0], x1 = xs[n - 1];
  const byX = x1 > x0; // by time when times spread, by position otherwise (all at one instant)
  const slice = (i: number) => {
    const f = byX ? (xs[i] - x0) / (x1 - x0) : i / (n - 1);
    return Math.min(slices - 1, Math.max(0, Math.floor(f * slices)));
  };
  const first = new Array<number>(slices).fill(-1), last = new Array<number>(slices).fill(-1);
  const lo = new Array<number>(slices).fill(-1), hi = new Array<number>(slices).fill(-1);
  for (let i = 2; i < n - 1; i++) {
    const s = slice(i);
    if (first[s] < 0) first[s] = i;
    last[s] = i;
    if (lo[s] < 0 || ys[i] < ys[lo[s]]) lo[s] = i;
    if (hi[s] < 0 || ys[i] > ys[hi[s]]) hi[s] = i;
  }
  const keep = [0, 1];
  for (let s = 0; s < slices; s++) {
    if (first[s] < 0) continue;
    // A slice's points are contiguous indices (x is ascending), so its kept ones sort within it.
    for (const i of [...new Set([first[s], lo[s], hi[s], last[s]])].sort((a, b) => a - b)) keep.push(i);
  }
  keep.push(n - 1);
  return keep;
}
