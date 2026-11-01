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
// FIXES-CYCLE4-PART2 (F4-16, C4-17): a published note's written and edited dates travel as two more fields, UTC day
// numbers (noteDays), only when the close has a note and a recorded date, so the chart sheet's UserNote shows the
// profile row's "Written ‹date›, after the trade closed · edited ‹date›" caption. Undated notes add nothing.
export type PackedPoint = [string, string, number, number, number, string | null, (number | null)?, (number | null)?];
export type ChartPoint = { id: string; symbol: string; returnPct: number; closedAt: Date; holdingDays: number; thesis: string | null; index: number;
  writtenDay?: number | null; editedDay?: number | null }; // FIXES-CYCLE4-PART2 (F4-16): UTC day numbers
type PackInput = { id: string; symbol: string; returnPct: number; closedAt: Date; holdingDays: number; thesis: string | null;
  writtenAt?: Date | string | number | null; editedAt?: Date | string | number | null }; // FIXES-CYCLE4-PART2 (F4-16): only a published note's dates
export function packPoints(trades: PackInput[]): PackedPoint[] {
  return [...trades].sort(byListOrder).map((t) => {
    const p: PackedPoint = [t.id, t.symbol, Math.round(t.returnPct * 1e8) / 1e8, t.closedAt.getTime(), Math.round(t.holdingDays * 100) / 100, t.thesis];
    return t.thesis === null ? p : withNoteDays(p, 6, noteDays(t.writtenAt, t.editedAt)); // FIXES-CYCLE4-PART2 (F4-16)
  });
}
export function unpackPoints(p: PackedPoint[]): ChartPoint[] {
  return p.map(([id, symbol, returnPct, at, holdingDays, thesis, w, e], index) => ({ id, symbol, returnPct, closedAt: new Date(at), holdingDays, thesis, index,
    ...(thesis !== null && (w != null || e != null) ? { writtenDay: w ?? null, editedDay: e ?? null } : {}) })); // FIXES-CYCLE4-PART2 (F4-16)
}

// FIXES-CYCLE4-PART2 (F4-16): note dates as UTC day numbers (days since 1970-01-01): the caption prints days only.
const DAY_MS = 86_400_000;
// Engineer review: a Date, or its JSON form (an ISO string or epoch ms) after a fetch; anything unreadable is no date.
type NoteTime = Date | string | number | null | undefined;
export const toNoteDay = (d: NoteTime): number | null => {
  if (d === null || d === undefined || d === '') return null;
  const t = (d instanceof Date ? d : new Date(d)).getTime();
  return Number.isFinite(t) ? Math.floor(t / DAY_MS) : null;
};
export const fromNoteDay = (n: number | null | undefined): Date | null => (typeof n === 'number' && Number.isFinite(n) ? new Date(n * DAY_MS) : null);
export function noteDays(writtenAt: NoteTime, editedAt: NoteTime): [number | null, number | null] | null {
  const w = toNoteDay(writtenAt), e = toNoteDay(editedAt);
  return w === null && e === null ? null : [w, e];
}
// Appends [written, edited] at `at` (a tuple's end) when there is a date; the tuple is unchanged otherwise.
export function withNoteDays<T extends unknown[]>(tuple: T, at: number, days: [number | null, number | null] | null): T {
  if (!days) return tuple;
  tuple[at] = days[0];
  tuple[at + 1] = days[1];
  return tuple;
}
