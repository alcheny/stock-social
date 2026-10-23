// F-1 PR-3 fix round 4 (UX lead demand 1, POLICY F3/A1, TR-1): the profile's closed trades come in windows of
// CLOSES_PAGE, newest first, chosen by `?closes=N` (the window that ends at row N), so the page stays short and the
// footer's disclaimer stays in reach on any record, without JavaScript. Nothing is hidden: every close is in exactly
// one window, reached by "Show 50 more" from the newest through to the oldest; the stats and the chart cover the whole
// record. The list order is total (close time, then id, newest first), so windows never overlap or skip a row.
export const CLOSES_PAGE = 50;

// Rows are numbered from 0 in list order. `end` is the window's last row + 1 (a multiple of CLOSES_PAGE).
export type ClosesWindow = { start: number; end: number; total: number; shown: number; next: number | null; prev: number | null };

// `param` is the raw `?closes=` value: rounded up to a whole window, clamped to the record; anything else is window 1.
export function closesWindow(param: string | string[] | undefined, total: number): ClosesWindow {
  const raw = Number(Array.isArray(param) ? param[0] : param);
  const last = Math.max(CLOSES_PAGE, Math.ceil(total / CLOSES_PAGE) * CLOSES_PAGE);
  const end = Number.isFinite(raw) && raw > 0 ? Math.min(last, Math.ceil(raw / CLOSES_PAGE) * CLOSES_PAGE) : CLOSES_PAGE;
  const start = end - CLOSES_PAGE;
  const shown = Math.max(0, Math.min(end, total) - start);
  return { start, end, total, shown, next: end < total ? end + CLOSES_PAGE : null, prev: start > 0 ? end - CLOSES_PAGE : null };
}

// The window a row belongs to (its `?closes=` value).
export const windowOf = (index: number) => Math.floor(index / CLOSES_PAGE) * CLOSES_PAGE + CLOSES_PAGE;

// List order: newest close first, then the larger id (ids are bigint text from the database).
export function byListOrder<T extends { id: string; closedAt: Date }>(a: T, b: T): number {
  return b.closedAt.getTime() - a.closedAt.getTime() || b.id.length - a.id.length || (b.id < a.id ? -1 : b.id > a.id ? 1 : 0);
}

// The trade link a chart point carries: the row's anchor inside the window that renders it. On the page already
// showing that window (`current`), only the anchor; elsewhere (another window, the feed pane) the window and the anchor.
export function tradeHref(linkBase: string, id: string, index: number, current?: number): string {
  const w = windowOf(index);
  return w === current ? `${linkBase}#trade-${id}` : `${linkBase}?closes=${w}#trade-${id}`;
}

// The chart's record, compact for the client (F-1 PR-3 fix round 4: the whole record was serialized as objects, most of
// a heavy profile's HTML). One tuple per close, in list order: [id, symbol, return, close time ms, hold days, thesis].
export type PackedPoint = [string, string, number, number, number, string | null];
export type ChartPoint = { id: string; symbol: string; returnPct: number; closedAt: Date; holdingDays: number; thesis: string | null; index: number };
export function packPoints(trades: { id: string; symbol: string; returnPct: number; closedAt: Date; holdingDays: number; thesis: string | null }[]): PackedPoint[] {
  return [...trades].sort(byListOrder).map((t) => [t.id, t.symbol, Math.round(t.returnPct * 1e8) / 1e8, t.closedAt.getTime(), Math.round(t.holdingDays * 100) / 100, t.thesis]);
}
export function unpackPoints(p: PackedPoint[]): ChartPoint[] {
  return p.map(([id, symbol, returnPct, at, holdingDays, thesis], index) => ({ id, symbol, returnPct, closedAt: new Date(at), holdingDays, thesis, index }));
}
