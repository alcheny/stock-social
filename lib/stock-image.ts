// F-12 (committee 2026-11-01, owner note): the stock image's lines, drawn inside the anti-crop band by
// app/record-strip.tsx#RecordStripImage. It is not a strip: a pooled figure about one stock reads as a rating of the
// stock (POLICY F3b), so it shows the status, the symbol, the closed-trade and trader counts with "losses included",
// and the disclaimer. No average, range, win rate or verdict.
import { DISCLAIMER_LINES, fitPx, STRIP_BAND, type ImageLine } from './record-strip.ts';
import { imageLabel, SHARE_CARD } from './copy.ts';
import { counted } from './format.ts';

export type StockImageInput = { symbol: string; n: number; traders: number; demoOnly: boolean; mixed: boolean };

export function stockImageLines(s: StockImageInput): ImageLine[] {
  const status = s.demoOnly ? SHARE_CARD.demo : s.mixed ? 'Includes sample data' : imageLabel(SHARE_CARD.verified)!;
  const count = counted(s.n, 'closed trade');
  const traders = `${counted(s.traders, 'trader')} · ${SHARE_CARD.lossesIncluded}`;
  return [
    { role: 'label', text: status, size: 28, tone: !s.demoOnly && !s.mixed ? 'ok' : 'muted', weight: 700 },
    { role: 'symbol', text: s.symbol, size: Math.max(STRIP_BAND.minPx, fitPx(s.symbol, 120)), tone: 'text', weight: 800 },
    { role: 'count', text: count, size: Math.max(STRIP_BAND.minPx, fitPx(count, STRIP_BAND.recordPx)), tone: 'text', weight: 700 },
    { role: 'traders', text: traders, size: Math.max(STRIP_BAND.minPx, fitPx(traders, 30)), tone: 'muted', weight: 400 },
    ...DISCLAIMER_LINES.map((d, k): ImageLine => ({ role: `disclaimer${k}`, text: d, size: STRIP_BAND.minPx, tone: 'muted', weight: 400 })),
  ];
}

// The disclaimer block sits at the foot of the band on every F-12 image (trade, month, stock), however few lines sit
// above it: layoutBand stacks top-down, so a short stack would leave it mid-image. Only moves it down, never up.
export function disclaimerAtFoot(placed: ImageLine[]): ImageLine[] {
  const last = placed.findLast((l) => l.role.startsWith('disclaimer'));
  if (!last || last.y === undefined) return placed;
  const shift = STRIP_BAND.bottom - (last.y + last.size * STRIP_BAND.lineHeight);
  return shift > 0 ? placed.map((l) => (l.role.startsWith('disclaimer') ? { ...l, y: l.y! + Math.floor(shift) } : l)) : placed;
}
