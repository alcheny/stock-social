// FIXES-LABELS (code review, C3-4 / F3-2; DESIGN TR-7, TR-9): the swipe pane's evidence, from exactly the profile's path
// (app/u/[handle]/page.tsx: cardEvidence → evidenceRangeText, "‹range› · 95% range" under the average; isNewRecord for
// the "New record" badge), so the pane and the profile print the same text for the same record. Pure.
import { cardEvidence, evidenceRangeText } from './record-card.ts';
import { isNewRecord } from './trades.ts';

const DAY = 86_400_000;
export type PaneEvidenceTrade = { symbol: string; returnPct: number; holdingDays: number; closedAt: Date; openedAt?: Date };
export type PaneEvidence = { range: string | null; rangeLine: string | null; newRecord: boolean };

// A row without its entry time (an older cached pane JSON) falls back to close − holding days.
const opened = (t: PaneEvidenceTrade) => t.openedAt ?? new Date(t.closedAt.getTime() - t.holdingDays * DAY);

export function paneEvidence(trades: PaneEvidenceTrade[], now: Date): PaneEvidence {
  const rows = trades.map((t) => ({ symbol: t.symbol, openedAt: opened(t), closedAt: t.closedAt, returnPct: Number(t.returnPct), holdingDays: Number(t.holdingDays) }));
  const range = rows.length ? evidenceRangeText(cardEvidence(rows, now)) : null;
  return { range, rangeLine: range && `${range} · 95% range`, newRecord: isNewRecord(rows.map((r) => ({ openedAt: r.openedAt })), rows.length, now) };
}
