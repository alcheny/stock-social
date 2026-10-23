// Pure layout model for the month recap share card (fix round 6, POLICY F3). The image draws exactly these lines, in
// this order, each on one line (no wrapping; ellipsis as a backstop), so the card's height is fixed by the font sizes
// and the disclaimer always fits. The label's size shrinks with its length so the longest month label stays on one line.
import { imageTrust, type RecordState } from './copy.ts';
import { DISCLAIMER } from './share.ts';
import { pct } from './trades.ts';

export const MONTH_CARD = { width: 1200, height: 630, padding: 64, lineHeight: 1.2, glyph: 0.6, gap: 16 } as const;
const INNER_W = MONTH_CARD.width - 2 * MONTH_CARD.padding;

export type CardLine = { role: 'who' | 'label' | 'month' | 'picks' | 'record' | 'evidence' | 'note' | 'new' | 'disclaimer'; text: string; size: number; muted?: boolean; warn?: boolean };
export type MonthCardInput = {
  handle: string; displayName: string; demo: boolean; verified: boolean; state: RecordState;
  recap: { label: string; monthSoFar: boolean; count: number; showHeadline: boolean; winRate: number; avgReturn: number; best: { symbol: string; returnPct: number }; worst: { symbol: string; returnPct: number } };
  record: { trades: number; winRate: number; avgReturn: number; evidence: string; range: string | null; newRecord: boolean };
};

// Largest size (≤ 96) at which the text fits the card's width at an average glyph width of 0.6 em.
export const fitSize = (text: string, max = 96, width = INNER_W) => Math.min(max, Math.floor(width / (Math.max(text.length, 1) * MONTH_CARD.glyph)));

export function monthCard(r: MonthCardInput) {
  const { recap: m, record: w } = r;
  const trust = imageTrust('month', { state: r.state, demo: r.demo, verified: r.verified, empty: false });
  const n = (k: number) => `${k} trade${k === 1 ? '' : 's'}`;
  const label = `${m.label}${m.monthSoFar ? ' · month so far' : ''}`;
  const month = [`${m.count} closed trade${m.count === 1 ? '' : 's'}`, m.showHeadline ? `${(m.winRate * 100).toFixed(0)}% win rate` : null, m.showHeadline ? `avg ${pct(m.avgReturn)}` : null].filter(Boolean).join(' · ');
  const picks = m.count === 1 ? `Only trade: ${m.worst.symbol} ${pct(m.worst.returnPct)}` : `Worst: ${m.worst.symbol} ${pct(m.worst.returnPct)} · Best: ${m.best.symbol} ${pct(m.best.returnPct)}`;
  const top: CardLine[] = [
    { role: 'who', text: `${r.displayName} · @${r.handle}`, size: 32, muted: true },
    { role: 'label', text: label, size: fitSize(label) },
    { role: 'month', text: month, size: 40 },
    { role: 'picks', text: picks, size: 40 },
  ];
  const bottom: CardLine[] = [];
  if (trust.stats) bottom.push({ role: 'record', text: `Whole record: ${(w.winRate * 100).toFixed(0)}% win rate · ${n(w.trades)} · avg ${pct(w.avgReturn)}`, size: 34 });
  // The incomplete line takes the evidence line's place, as on the profile card.
  if (trust.note) bottom.push({ role: 'note', text: trust.note, size: 26, warn: trust.tone === 'warn', muted: trust.tone !== 'warn' });
  else bottom.push({ role: 'evidence', text: w.range ? `${w.evidence} ${w.range}` : w.evidence || 'Too early to tell', size: 26, muted: true });
  if (trust.stats && w.newRecord) bottom.push({ role: 'new', text: 'New record · short record, wide uncertainty', size: 26, muted: true });
  return { header: { label: trust.label, tone: trust.tone }, top, bottom, disclaimer: { role: 'disclaimer', text: DISCLAIMER, size: 22, muted: true } as CardLine };
}

// Layout assertion behind the test: the card's stacked height (header, lines, rule, disclaimer) at the given line
// height, against the card's inner height; and every one-line text against the inner width.
export function monthCardFits(c: ReturnType<typeof monthCard>): { height: number; room: number; tooWide: string[] } {
  const lh = (s: number) => s * MONTH_CARD.lineHeight;
  const lines = [...c.top, ...c.bottom, c.disclaimer];
  const height = lh(36) + lines.reduce((h, l) => h + lh(l.size), 0) + 2 + MONTH_CARD.gap;
  const tooWide = lines.filter((l) => l.role === 'label' && l.text.length * l.size * MONTH_CARD.glyph > INNER_W).map((l) => l.text);
  return { height, room: MONTH_CARD.height - 2 * MONTH_CARD.padding, tooWide };
}
