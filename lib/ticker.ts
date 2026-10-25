import { confidence, stats, type Confidence } from './trades.ts';

const SYMBOL = /^[A-Z][A-Z0-9.-]{0,9}$/;

export function normalizeSymbol(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  return SYMBOL.test(s) ? s : null;
}

export type Baseline = { n: number; winRate: number | null; perTrade: number | null; demoOnly: boolean };
export type BaselineVerdictKind = 'empty' | 'demo_only' | 'too_few_trades' | 'clearly_lower' | 'clearly_higher' | 'no_clear_difference';
export type BaselineResult = { kind: BaselineVerdictKind; baseline: Baseline; winRateDelta: number | null };

// Per-trade return only: compares the pooled baseline with this stock's 95% interval. Win rate is context, never a verdict.
export function baselineVerdict(summary: TickerSummary, baseline: Baseline): BaselineResult {
  const winRateDelta = summary.winRate === null || baseline.winRate === null ? null : summary.winRate - baseline.winRate;
  const out = (kind: BaselineVerdictKind): BaselineResult => ({ kind, baseline, winRateDelta });
  if (baseline.n === 0 || baseline.perTrade === null) return out('empty');
  if (summary.demoOnly) return out('demo_only');
  const pt = summary.conf?.perTrade;
  if (!pt || summary.conf?.tier === 'too-early') return out('too_few_trades'); // F-4: too early by width keeps its range, draws no verdict
  if (baseline.perTrade > pt.high) return out('clearly_lower');
  if (baseline.perTrade < pt.low) return out('clearly_higher');
  return out('no_clear_difference');
}

export type TickerRow = { userId: number; returnPct: number; holdingDays: number; openedAt: Date; closedAt: Date; verified: boolean };
export type TickerSummary = {
  n: number; wins: number; losses: number;
  winRate: number | null; avgReturn: number | null;
  traders: number;
  demoOnly: boolean;
  mixed: boolean;
  conf: Confidence | null;
};

export function tickerSummary(rows: TickerRow[], today: Date): TickerSummary {
  const n = rows.length;
  if (!n) return { n: 0, wins: 0, losses: 0, winRate: null, avgReturn: null, traders: 0, demoOnly: false, mixed: false, conf: null };
  const s = stats(rows);
  const wins = rows.filter((r) => r.returnPct > 0).length;
  const verified = rows.filter((r) => r.verified).length;
  // confidence() clusters overlapping same-symbol holds as one bet. Every row here is the same stock, so
  // we pass the trader id as `symbol`: one trader's overlapping holds are one bet, different traders are independent.
  const conf = confidence(rows.map((r) => ({ symbol: String(r.userId), openedAt: r.openedAt, closedAt: r.closedAt, returnPct: r.returnPct, holdingDays: r.holdingDays })), today);
  return {
    n, wins, losses: n - wins, winRate: s.winRate, avgReturn: s.avgReturn,
    traders: new Set(rows.map((r) => r.userId)).size,
    demoOnly: verified === 0, mixed: verified > 0 && verified < n, conf,
  };
}

export type SymbolAggregate = { symbol: string; trades: number; traders: number; lastClosedAt: Date; verifiedTrades: number };
export type TickerIndexRow = { symbol: string; trades: number; traders: number; lastClosedAt: Date; demoOnly: boolean };
export type TickerSort = 'recent' | 'az';

export function parseTickerSort(raw: unknown): TickerSort {
  return raw === 'az' ? 'az' : 'recent';
}

// Never ranked by performance: the row type carries no return, win-rate or P&L field.
export function tickerIndex(rows: SymbolAggregate[], sort: TickerSort | string | undefined): TickerIndexRow[] {
  const out = rows.map((r) => ({ symbol: r.symbol, trades: r.trades, traders: r.traders, lastClosedAt: r.lastClosedAt, demoOnly: r.verifiedTrades === 0 }));
  const bySymbol = (a: TickerIndexRow, b: TickerIndexRow) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0);
  return out.sort(sort === 'az' ? bySymbol : (a, b) => b.lastClosedAt.getTime() - a.lastClosedAt.getTime() || bySymbol(a, b));
}

export function decodeSymbolParam(raw: string): string | null {
  try { return normalizeSymbol(decodeURIComponent(raw)); } catch { return null; }
}

export type MonthBucket = { month: string; up: number; down: number; flat: number; n: number };
export type Timeline = { buckets: MonthBucket[]; n: number; monthsWithTrades: number };

const monthIndex = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
const monthKey = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;

// Count chart only: no returns, averages or best/worst month. Buckets: 'earlier', then 24 UTC months ending at today's.
// Future dates clamp into the last month and NaN counts as flat, so bucket counts always sum to rows.length.
export function monthlyTimeline(rows: { returnPct: number; closedAt: Date }[], today: Date): Timeline {
  const last = monthIndex(today);
  const buckets: MonthBucket[] = [{ month: 'earlier', up: 0, down: 0, flat: 0, n: 0 }];
  for (let i = last - 23; i <= last; i++) buckets.push({ month: monthKey(i), up: 0, down: 0, flat: 0, n: 0 });
  for (const r of rows) {
    const b = buckets[Math.min(24, Math.max(0, monthIndex(r.closedAt) - (last - 23) + 1))];
    if (r.returnPct > 0) b.up++; else if (r.returnPct < 0) b.down++; else b.flat++;
    b.n++;
  }
  return { buckets, n: rows.length, monthsWithTrades: buckets.slice(1).filter((b) => b.n > 0).length };
}

export function timelineCaption(t: Timeline): string {
  if (!t.n) return 'No trades';
  const total = (k: 'up' | 'down' | 'flat') => t.buckets.reduce((a, b) => a + b[k], 0);
  const flat = total('flat');
  const parts = [`${total('up')} up`, `${total('down')} down`];
  if (flat > 0) parts.push(`${flat} flat`);
  const shown = t.n === 1 ? parts.filter((p) => !p.startsWith('0 ')) : parts;
  const tail = t.monthsWithTrades === 0 ? 'all before the last 24 months' : `across ${t.monthsWithTrades} month${t.monthsWithTrades === 1 ? '' : 's'} with trades`;
  return `${t.n} trade${t.n === 1 ? '' : 's'} closed: ${shown.join(', ')}, ${tail}`;
}

export const MIN_HOLD_BUCKET = 5;
export type HoldBucket = {
  key: 'lt1' | '1to7' | '7to28' | 'gte28'; label: string; n: number; shown: boolean;
  winRate: number | null; avgReturn: number | null; conf: Confidence | null;
};
export type HoldBuckets = { buckets: HoldBucket[]; n: number };

const HOLD_DEFS: { key: HoldBucket['key']; label: string }[] = [
  { key: 'lt1', label: 'Under 1 day' }, { key: '1to7', label: '1 to under 7 days' },
  { key: '7to28', label: '7 to under 28 days' }, { key: 'gte28', label: '28 days or more' },
];
const holdIndex = (d: number) => (d >= 28 ? 3 : d >= 7 ? 2 : d >= 1 ? 1 : 0); // NaN and negatives fall to 0

// Fixed time order, never sorted by performance. Under MIN_HOLD_BUCKET trades, no rate or interval is returned at all.
export function holdBuckets(rows: TickerRow[], today: Date): HoldBuckets {
  const groups: TickerRow[][] = [[], [], [], []];
  for (const r of rows) groups[holdIndex(r.holdingDays)].push(r);
  const buckets = HOLD_DEFS.map((d, i): HoldBucket => {
    const g = groups[i];
    if (g.length < MIN_HOLD_BUCKET) return { ...d, n: g.length, shown: false, winRate: null, avgReturn: null, conf: null };
    const s = tickerSummary(g, today);
    return { ...d, n: g.length, shown: true, winRate: s.winRate, avgReturn: s.avgReturn, conf: s.conf };
  });
  return { buckets, n: rows.length };
}

// Counts only: names no best or worst bucket and makes no comparison.
export function holdCaption(h: HoldBuckets): string {
  if (!h.n) return 'No trades';
  return `${h.n} trade${h.n === 1 ? '' : 's'} by hold time: ${h.buckets.map((b) => `${b.n} ${b.label.charAt(0).toLowerCase()}${b.label.slice(1)}`).join(', ')}`;
}

export type SpreadBin= { lo: number | null; hi: number | null; count: number; open: 'low' | 'high' | null };
export type Spread = { n: number; bins: SpreadBin[]; median: number | null; up: number; down: number; flat: number; min: number | null; max: number | null };

// Input is percent units (12.5 = +12.5%). Fixed 12 bins, half-open [lo, hi): an edge value goes to the higher bin,
// so 0 sits at the edge between [-10,0) and [0,10). Nothing is dropped or clipped: bin counts sum to n.
export function outcomeSpread(returns: number[]): Spread {
  const bins: SpreadBin[] = [{ lo: null, hi: -50, count: 0, open: 'low' }];
  for (let lo = -50; lo < 50; lo += 10) bins.push({ lo, hi: lo + 10, count: 0, open: null });
  bins.push({ lo: 50, hi: null, count: 0, open: 'high' });
  let up = 0, down = 0, flat = 0;
  for (const raw of returns) {
    const r = raw === 0 ? 0 : raw;
    bins[r < -50 ? 0 : r >= 50 ? 11 : Math.floor(r / 10) + 6].count++;
    if (r > 0) up++; else if (r < 0) down++; else flat++;
  }
  const n = returns.length;
  const s = [...returns].sort((a, b) => a - b);
  const mid = n >> 1;
  const median = n === 0 ? null : n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return { n, bins, median, up, down, flat, min: n ? s[0] : null, max: n ? s[n - 1] : null };
}

const signed = (x: number, digits: number) => {
  const v = x.toFixed(digits);
  return Number(v) === 0 ? `${(0).toFixed(digits)}%` : `${x > 0 ? '+' : ''}${v}%`;
};

// The single text source for the chart: visible caption, aria-label and <title>. Names no best or worst trade.
export function spreadCaption(sp: Spread): string {
  if (!sp.n) return 'No trades';
  const parts = [`${sp.up} up`, `${sp.down} down`];
  if (sp.flat > 0) parts.push(`${sp.flat} flat`);
  // One trade: only the count that applies ("1 up"), not "1 up, 0 down".
  const shown = sp.n === 1 ? parts.filter((p) => !p.startsWith('0 ')) : parts;
  return `${sp.n} trade${sp.n === 1 ? '' : 's'}: ${shown.join(', ')}, median ${signed(sp.median!, 1)}, range ${signed(sp.min!, 0)} to ${signed(sp.max!, 0)}`;
}

// Stored returns are fractions (0.125); the spread works in percent. Rounded so 0.3*100 can't miss a bin edge.
export const toSpreadPct = (fraction: number) => Math.round(Number(fraction) * 1e8) / 1e6;

export type FilterResult = { kind: 'all' | 'exact' | 'prefix' | 'none' | 'invalid'; rows: TickerIndexRow[]; symbol?: string };

// In-memory only: plain startsWith, never LIKE or a regex, so `%` and `_` are inert and nothing reaches SQL.
export function filterTickerIndex(rows: TickerIndexRow[], q: unknown): FilterResult {
  if (typeof q !== 'string' || !q.trim()) return { kind: 'all', rows };
  const symbol = normalizeSymbol(q);
  if (!symbol) return { kind: 'invalid', rows: [] };
  const exact = rows.find((r) => r.symbol === symbol);
  if (exact) return { kind: 'exact', symbol, rows: [exact] };
  const prefix = rows.filter((r) => r.symbol.startsWith(symbol));
  return prefix.length ? { kind: 'prefix', symbol, rows: prefix } : { kind: 'none', rows: [] };
}

// Carries no return, win-rate or P&L field, so related stocks can't be shown or ordered by performance.
export type RelatedSymbol = { symbol: string; traders: number; trades: number; demoOnly: boolean };

export function relatedSymbols(rows: { symbol: string; userId: number; verified: boolean }[], symbol: string): RelatedSymbol[] {
  const other = rows.filter((r) => r.symbol !== symbol);
  if (new Set(other.map((r) => r.userId)).size < 2) return [];
  const by = new Map<string, { users: Set<number>; trades: number; verified: boolean }>();
  for (const r of other) {
    const g = by.get(r.symbol) ?? { users: new Set<number>(), trades: 0, verified: false };
    g.users.add(r.userId); g.trades++; g.verified = g.verified || r.verified;
    by.set(r.symbol, g);
  }
  return [...by].map(([s, g]) => ({ symbol: s, traders: g.users.size, trades: g.trades, demoOnly: !g.verified }))
    .sort((a, b) => b.traders - a.traders || (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0))
    .slice(0, 8);
}

export const THESIS_CAP = 20;
export type ThesisRow = { id: number; handle: string; thesis: string | null; thesisStatus: string | null;
  returnPct: number; holdingDays: number; closedAt: Date; verified: boolean };
export type ThesisItem = Omit<ThesisRow, 'thesisStatus' | 'thesis'> & { thesis: string };
export type ThesisList = { items: ThesisItem[]; n: number; demoOnly: boolean; mixed: boolean };

// Second guard after the SQL filter: published and non-blank only, newest first (never by return), capped.
export function selectTheses(rows: ThesisRow[]): ThesisList {
  const items: ThesisItem[] = [];
  for (const { thesisStatus, thesis, ...r } of rows) {
    if (thesisStatus !== 'published' || typeof thesis !== 'string' || !thesis.trim()) continue;
    items.push({ ...r, thesis: thesis.trim() });
  }
  items.sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime() || b.id - a.id);
  const out = items.slice(0, THESIS_CAP);
  const demo = out.filter((i) => !i.verified).length;
  return { items: out, n: out.length, demoOnly: out.length > 0 && demo === out.length, mixed: demo > 0 && demo < out.length };
}

export const MIN_REST = 5;
export type Concentration =
  | { kind: 'single'; n: number }
  | { kind: 'tie'; n: number; tied: number; each: number; share: number }
  | { kind: 'too-few'; n: number; top: number; share: number; rest: number }
  | { kind: 'compare'; n: number; top: number; share: number; rest: TickerSummary };

// How much of a symbol's record one trader accounts for. Counts only: the result never carries who.
export function concentration(rows: TickerRow[], today: Date): Concentration | null {
  const n = rows.length;
  if (n < 2) return null;
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.userId, (counts.get(r.userId) ?? 0) + 1);
  if (counts.size === 1) return { kind: 'single', n };
  const max = Math.max(...counts.values());
  const leaders = [...counts].filter(([, c]) => c === max);
  if (leaders.length > 1) return { kind: 'tie', n, tied: leaders.length, each: max, share: max / n };
  const restRows = rows.filter((r) => r.userId !== leaders[0][0]);
  const share = max / n;
  if (restRows.length < MIN_REST) return { kind: 'too-few', n, top: max, share, rest: restRows.length };
  return { kind: 'compare', n, top: max, share, rest: tickerSummary(restRows, today) };
}

export const MIN_INDEX_TRADES = 3;
export const MIN_INDEX_TRADERS = 2;
export const SITEMAP_LIMIT = 5000;

const count = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

// A one-trader page is effectively a profile, so it is not indexed by symbol. Demo rows are never verified.
export function isIndexableTicker({ verifiedTrades, verifiedTraders }: { verifiedTrades: number; verifiedTraders: number }): boolean {
  return count(verifiedTrades) >= MIN_INDEX_TRADES && count(verifiedTraders) >= MIN_INDEX_TRADERS;
}

export function siteUrl(env: Record<string, string | undefined>): string {
  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const url = site || (vercel ? (/^https?:\/\//.test(vercel) ? vercel : `https://${vercel}`) : 'http://localhost:3000');
  return url.replace(/\/+$/, '');
}

export type SitemapRow = { symbol: string; lastClosedAt: Date; verifiedTrades: number; verifiedTraders: number };
export type SitemapEntry = { url: string; lastModified?: Date };

// Symbols and dates only: no handles, returns or counts. Alphabetical, never ranked.
export function buildSitemapEntries(rows: SitemapRow[], baseUrl: string): SitemapEntry[] {
  const base = baseUrl.replace(/\/+$/, '');
  const tickers = rows
    .filter(isIndexableTicker)
    .sort((a, b) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0))
    .slice(0, SITEMAP_LIMIT)
    .map((r): SitemapEntry => {
      const url = `${base}/t/${encodeURIComponent(r.symbol)}`;
      return Number.isNaN(r.lastClosedAt.getTime()) ? { url } : { url, lastModified: r.lastClosedAt };
    });
  return [{ url: `${base}/` }, { url: `${base}/t` }, ...tickers];
}

export type TradeRow = { user_id: number; return_pct: number; holding_days: number; opened_at: Date; closed_at: Date; verified: boolean };
export const toTicker = (r: TradeRow): TickerRow => ({ userId: r.user_id, returnPct: r.return_pct, holdingDays: r.holding_days, openedAt: r.opened_at, closedAt: r.closed_at, verified: r.verified });

export type CompareSide = { summary: TickerSummary; spread: Spread; returns: number[]; tier: string | null; empty: boolean };
export type Compare = { a: CompareSide; b: CompareSide; sameTraders: number };

function compareSide(rows: TickerRow[], today: Date): CompareSide {
  const summary = tickerSummary(rows, today);
  const returns = rows.map((r) => toSpreadPct(r.returnPct)).filter(Number.isFinite);
  return { summary, spread: outcomeSpread(returns), returns, tier: summary.conf?.tier ?? null, empty: summary.n === 0 };
}

// Order is never touched and nothing is ranked or differenced. sameTraders counts verified rows only, never names.
export function compareTickers(rowsA: TickerRow[], rowsB: TickerRow[], today: Date): Compare {
  const ids = new Set(rowsA.filter((r) => r.verified).map((r) => r.userId));
  const both = new Set(rowsB.filter((r) => r.verified && ids.has(r.userId)).map((r) => r.userId));
  return { a: compareSide(rowsA, today), b: compareSide(rowsB, today), sameTraders: both.size };
}

export type ParsedCompare =
  | { kind: 'ok'; a: string; b: string }
  | { kind: 'missing' }
  | { kind: 'invalid'; raw: string }
  | { kind: 'same'; a: string };

export function parseCompare(a: string | undefined, b: string | undefined): ParsedCompare {
  if (!a?.trim() || !b?.trim()) return { kind: 'missing' };
  const sa = decodeSymbolParam(a), sb = decodeSymbolParam(b);
  if (!sa) return { kind: 'invalid', raw: a.slice(0, 12) };
  if (!sb) return { kind: 'invalid', raw: b.slice(0, 12) };
  return sa === sb ? { kind: 'same', a: sa } : { kind: 'ok', a: sa, b: sb };
}

export const COMPARE_COPY = {
  title: 'Compare stocks · Stock Social',
  explainer: 'Verified closed trades in each stock, side by side. Percentages only. Few trades means a wide range, and that is expected.',
  pick: 'Pick two stocks to compare.',
  invalid: (raw: string) => `${raw} doesn't look like a ticker symbol.`,
  same: (a: string) => `Pick two different stocks. You chose ${a} twice.`,
  bothEmpty: (a: string, b: string) => `No verified closed trades in ${a} or ${b} yet.`,
  emptySide: (s: string) => `No verified closed trades in ${s} yet.`,
  overlap: (n: number, a: string, b: string) => n === 0
    ? 'No trader has closed verified trades in both yet.'
    : `${n} trader${n === 1 ? '' : 's'} closed verified trades in both ${a} and ${b}.`,
  footer: 'Different traders, different sizes and timing. This is what happened, not a prediction.',
  tooEarly: 'too early',
  demoOnly: 'All trades on this page are sample data, not from a real broker.',
  mixed: 'Some trades here are sample data and are marked Demo. The summary includes them.',
};

const sideDescription = (symbol: string, s: CompareSide) => s.empty
  ? `${symbol}: no verified trades yet.`
  : `${symbol}: ${s.summary.n} trade${s.summary.n === 1 ? '' : 's'}, ${(s.summary.winRate! * 100).toFixed(0)}% win rate, ${signed(s.summary.avgReturn! * 100, 1)} avg return.`;

export function compareDescription(symbolA: string, symbolB: string, c: Compare): string {
  const demo = c.a.summary.demoOnly || c.a.summary.mixed || c.b.summary.demoOnly || c.b.summary.mixed;
  return `${sideDescription(symbolA, c.a)} ${sideDescription(symbolB, c.b)}${demo ? ' Sample data.' : ''}`;
}

export const WATCH_CAP = 25;
export type CanWatch = { ok: true; symbol: string } | { ok: false; reason: 'invalid' | 'cap'; message: string };

/** Applies to adding a watch only; unwatching is never blocked. */
export function canWatch(currentCount: number, symbol: string): CanWatch {
  const s = normalizeSymbol(symbol);
  if (!s) return { ok: false, reason: 'invalid', message: "That isn't a valid stock symbol." };
  if (currentCount >= WATCH_CAP) return { ok: false, reason: 'cap', message: `You're watching ${WATCH_CAP} stocks, the maximum. Unwatch one to add another.` };
  return { ok: true, symbol: s };
}

export type WatchItem = { symbol: string; newCount: number; demoOnly: boolean };

/** Counts only, no returns. demoOnly looks at ALL of a symbol's trades, not just the new ones. */
export function watchSummary(watches: { symbol: string; lastSeenAt: Date }[], closedTrades: { symbol: string; closedAt: Date; verified: boolean }[]): WatchItem[] {
  return watches.map((w) => {
    const mine = closedTrades.filter((t) => t.symbol === w.symbol);
    const demoOnly = mine.length > 0 && !mine.some((t) => t.verified);
    // Copy says "verified" unless demoOnly, so mixed symbols count verified trades only.
    const counted = demoOnly ? mine : mine.filter((t) => t.verified);
    return {
      symbol: w.symbol,
      newCount: counted.filter((t) => t.closedAt.getTime() > w.lastSeenAt.getTime()).length,
      demoOnly,
    };
  }).sort((a, b) => a.symbol.localeCompare(b.symbol));
}
