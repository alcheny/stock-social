// F-1 PR-3 fix round 7 (business lead re-sit, demand 2): draw a long record at screen resolution. A feed card's chart
// is at most 560 CSS px wide, so a 4,700-close path (one point per close) drew far more points than the screen has
// pixels and was most of the feed's HTML. Min/max bucketing: the points are split into equal slices of x (one slice per
// pixel column at the chosen budget), and each slice keeps only its lowest and highest point, in x order. The first and
// the last point are always kept, and every slice keeps its extremes, so the whole record's minimum and maximum (the
// worst drawdown and the peak) survive, and nothing that would show at this width is smoothed away.
// Pure; returns the kept indices, ascending. `max` >= 4 (first, last, one slice's low and high).
export const FEED_CHART_POINTS = 400; // ≤ 2 points per CSS px for any chart wider than 200 px; the feed pane's is 335–560

export function downsampleIndices(xs: number[], ys: number[], max: number): number[] {
  const n = ys.length;
  if (n <= max) return ys.map((_, i) => i);
  const buckets = Math.max(1, Math.floor((max - 2) / 2));
  // Slices by x (time) when the x values spread, by position otherwise (all at one instant).
  const x0 = xs[0], x1 = xs[n - 1];
  const byX = x1 > x0;
  const slice = (i: number) => {
    const f = byX ? (xs[i] - x0) / (x1 - x0) : i / (n - 1);
    return Math.min(buckets - 1, Math.max(0, Math.floor(f * buckets)));
  };
  const lo = new Array<number>(buckets).fill(-1), hi = new Array<number>(buckets).fill(-1);
  for (let i = 1; i < n - 1; i++) {
    const s = slice(i);
    if (lo[s] < 0 || ys[i] < ys[lo[s]]) lo[s] = i;
    if (hi[s] < 0 || ys[i] > ys[hi[s]]) hi[s] = i;
  }
  const keep = [0];
  for (let s = 0; s < buckets; s++) {
    if (lo[s] < 0) continue;
    const a = Math.min(lo[s], hi[s]), b = Math.max(lo[s], hi[s]);
    keep.push(a);
    if (b !== a) keep.push(b);
  }
  keep.push(n - 1);
  return keep;
}
