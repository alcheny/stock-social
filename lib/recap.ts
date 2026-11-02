// Pure monthly recap. Keeps each closed trade in the UTC month; no sizes or prices exist here and nothing varies by sign.
import { confidence, evidenceLine, isNewRecord, rangeText, stats, type ConfidenceInput } from './trades.ts';
import { stripFigures, type Strip, type StripInput, stripTextAfterCount } from './record-strip.ts';
import { RECORD_STRIP, wholeRecordPreview, type RecordState } from './copy.ts';
import { OPTIONS } from './copy.ts'; // FIXES-CYCLE4-PART2 (F4-4)
import { counted } from './format.ts';
import { DISCLAIMER } from './share.ts';
import type { StatusFacts } from './record-status.ts'; // FIXES-LABELS: status

export type RecapTrade = ConfidenceInput & { sellId: string; tradeKey?: string }; // F-25: tradeKey builds the row's link

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function parseYm(raw: string, now: Date) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2000) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  if (start.getTime() > now.getTime()) return null;
  return { year, month, start, end, current: now.getTime() < end.getTime() };
}

const toStat = (t: RecapTrade) => ({ returnPct: t.returnPct, holdingDays: t.holdingDays, closedAt: t.closedAt });

export function monthRecap(all: RecapTrade[], ym: string, now: Date) {
  const p = parseYm(ym, now);
  if (!p) return null;
  const trades = all
    .filter((t) => t.closedAt.getTime() >= p.start.getTime() && t.closedAt.getTime() < p.end.getTime())
    .sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime() || (a.sellId < b.sellId ? -1 : a.sellId > b.sellId ? 1 : 0));
  if (!trades.length) return null;
  const s = stats(trades.map(toStat));
  const c = confidence(trades, now);
  const byReturn = [...trades].sort((a, b) => b.returnPct - a.returnPct);
  return {
    ym,
    label: `${MONTHS[p.month - 1]} ${p.year}`,
    monthSoFar: p.current,
    count: trades.length,
    wins: trades.filter((t) => t.returnPct > 0).length,
    losses: trades.filter((t) => t.returnPct < 0).length,
    avgReturn: s.avgReturn,
    winRate: s.winRate,
    showHeadline: trades.length >= 5,
    best: byReturn[0],
    worst: byReturn[byReturn.length - 1],
    trades,
    evidence: evidenceLine(c),
    range: rangeText(c),
    // F-12: the month's own figures (average with its range, or Too early), over the month's trades only.
    figures: stripFigures(trades, now),
  };
}

// ---- FIXES-LABELS ---- (D-24): a month shows its numbers and a 95% range, never a verdict: the month page's F-12
// figures strip (monthStripInput below) is the one month line.
// Distinct UTC months (YYYY-MM) with a closed trade: "One of N months on record".
export const monthsOnRecord = (all: { closedAt: Date }[]): number =>
  new Set(all.map((t) => `${t.closedAt.getUTCFullYear()}-${t.closedAt.getUTCMonth()}`)).size;

export function wholeRecord(all: RecapTrade[], now: Date) {
  const s = stats(all.map(toStat));
  const c = confidence(all, now);
  return { trades: s.trades, winRate: s.winRate, avgReturn: s.avgReturn, evidence: evidenceLine(c), range: rangeText(c), newRecord: isNewRecord(all, all.length, now), strip: stripFigures(all, now) };
}

// What the month page and image know once loaded (lib/recap-load.ts).
export type RecapView = {
  handle: string; displayName: string; demo: boolean; verified: boolean; state: RecordState;
  recap: NonNullable<ReturnType<typeof monthRecap>>; record: ReturnType<typeof wholeRecord>;
  open?: number[]; // unrealized percents, read for a connected or failed record only
  months?: number; // FIXES-LABELS (D-24): distinct months on record (monthsOnRecord)
  status?: StatusFacts | null; // FIXES-LABELS: status (F-11): the status-line facts beside the state
  excludingOptions?: boolean; // OPTIONS: the trader has option closes or exclusions (lib/options-load.ts#paneView)
  // FIXES-CYCLE4-PART2 (F4-4): the trader's options gate and the month's shown option closes (counts only).
  optionsGate?: 'open' | 'closed'; monthOptionCloses?: number;
  futureWaiting?: number; // F-35: the record's rows dated after now() (shares + options), waiting on the future line
};
const who = (r: RecapView) => ({ state: r.state, demo: r.demo, verified: r.verified, handle: r.handle });
// The trader's record strip (every closed trade) and the month's figures (that month's trades, no count: R3-2).
export const recordStripInput = (r: RecapView): StripInput => ({ ...r.record.strip, ...who(r), open: r.open, excludingOptions: r.excludingOptions /* OPTIONS */ });
export const monthStripInput = (r: RecapView): StripInput => ({ ...r.recap.figures, ...who(r), monthExcludingOptions: r.excludingOptions /* FIXES-CYCLE4-PART2 (F4-4) */ });

export const monthCountText = (count: number) => `${counted(count, 'closed trade')} this month`;
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Image alt (generateMetadata, F-4 pattern): the month and its figures, then the trader's record strip in words.
export function monthAlt(r: RecapView, whole: Strip, month: Strip): string {
  const m = r.recap;
  const figures = month.figures.length ? `, ${month.alt.replace(/\.$/, '')}` : '';
  return `${m.label} closed trades by @${r.handle} on Stock Social. ${sentence(monthCountText(m.count))}${m.monthSoFar ? ' so far' : ''}${figures}. ${RECORD_STRIP.link(r.handle)}: ${whole.alt}`;
}

// Link-preview description: the month's count, then the record under the profile's record-state rule, with the strip's
// figures as its stats and the disclaimer whenever a figure is quoted (POLICY F3).
export function monthDescription(r: RecapView, whole: Strip): string {
  const rec = wholeRecordPreview({ state: r.state, demo: r.demo, verified: r.verified, trades: r.record.trades }, stripTextAfterCount(whole));
  // FIXES-CYCLE4-PART2 (F4-4): the month's count says it leaves options out, and (gate closed) the month's option count.
  const count = `${monthCountText(r.recap.count)}${r.excludingOptions ? `, ${OPTIONS.altQualifier}` : ''}`;
  const optionsLine = monthOptionsLine(r);
  const base = `${count} · ${RECORD_STRIP.link(r.handle)}: ${rec}${optionsLine ? `. ${optionsLine.replace(/\.$/, '')}` : ''}`;
  return whole.importing ? base : `${base}. ${DISCLAIMER}`;
}

// FIXES-CYCLE4-PART2 (F4-4, C4-9; committee): the month's option count line, counts only, in the legal-re-signed words
// (OPTIONS.gated), while the trader's options gate is closed and the month has shown option closes. An open-gate trader
// gets the qualifier and the /how link only: the second sentence would be false there, and a new sentence needs the
// legal committee (Owner items).
export const monthOptionsLine = (r: Pick<RecapView, 'optionsGate' | 'monthOptionCloses'>): string | null =>
  r.optionsGate === 'closed' && (r.monthOptionCloses ?? 0) > 0 ? OPTIONS.gated(r.monthOptionCloses!, 0) : null;

export function latestRecapYm(trades: { closedAt: Date }[]): string | null {
  if (!trades.length) return null;
  const d = new Date(Math.max(...trades.map((t) => t.closedAt.getTime())));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
