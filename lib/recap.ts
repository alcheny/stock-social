// Pure monthly recap. Keeps each closed trade in the UTC month; no sizes or prices exist here and nothing varies by sign.
import { confidence, evidenceLine, isNewRecord, rangeText, stats, type ConfidenceInput } from './trades.ts';

export type RecapTrade = ConfidenceInput & { sellId: string };

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
  };
}

export function wholeRecord(all: RecapTrade[], now: Date) {
  const s = stats(all.map(toStat));
  const c = confidence(all, now);
  return { trades: s.trades, winRate: s.winRate, avgReturn: s.avgReturn, evidence: evidenceLine(c), range: rangeText(c), tooEarly: c.tier === 'too-early', newRecord: isNewRecord(all, all.length, now) };
}

export function latestRecapYm(trades: { closedAt: Date }[]): string | null {
  if (!trades.length) return null;
  const d = new Date(Math.max(...trades.map((t) => t.closedAt.getTime())));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
