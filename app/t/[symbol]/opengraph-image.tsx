// Ticker share card: unfurls a pasted /t/SYMBOL link. Never throws on a bad symbol.
// F-12 (committee 2026-11-01, owner note): status, symbol, the closed-trade count and the trader count with "losses
// included", and the disclaimer, all inside the anti-crop band (lib/stock-image.ts). No pooled figure of any kind: about
// one stock it reads as a rating of the stock (POLICY F3b). The alt is static, so it states no figures and no trust word.
import { ImageResponse } from 'next/og';
// FIXES-LABELS (D-09): the F3 lines at the band's disclaimer size (lib/record-strip.ts DISCLAIMER_PX, from lib/image-fit.ts, DS-19).
import { DISCLAIMER } from '@/lib/share.ts';
import { decodeSymbolParam, type TickerSummary } from '@/lib/ticker.ts';
import { tickerHeadline } from '@/lib/ticker-sql.ts';
import { fitPx, layoutBand, STRIP_BAND, type ImageLine } from '@/lib/record-strip.ts';
import { disclaimerAtFoot, stockImageLines } from '@/lib/stock-image.ts';
import { RecordStripImage } from '@/app/record-strip.tsx';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Closed trades in one stock on Stock Social';

// No trades to describe: the same band, with the title and one line (the brand box names the site).
function neutral(title: string, line: string) {
  const lines: ImageLine[] = [
    { role: 'title', text: title, size: Math.max(STRIP_BAND.minPx, fitPx(title, 120)), tone: 'text', weight: 800 },
    { role: 'line', text: line, size: Math.max(STRIP_BAND.minPx, fitPx(line, 40)), tone: 'muted', weight: 400 },
  ];
  return new ImageResponse(<RecordStripImage lines={layoutBand(lines).lines} />, size);
}

export default async function Card({ params }: { params: Promise<{ symbol: string }> }) {
  try {
    const symbol = decodeSymbolParam((await params).symbol);
    if (!symbol) return neutral('Stock Social', 'Verified trades by stock');
    // The page's own SQL summary (lib/ticker-sql.ts, live users only), so the card and the page count the same trades.
    const s: TickerSummary = (await tickerHeadline(symbol)).summary;
    if (!s.n) return neutral(symbol, 'No verified trades yet');
    const { lines } = layoutBand(stockImageLines({ symbol, n: s.n, traders: s.traders, demoOnly: s.demoOnly, mixed: s.mixed }));
    return new ImageResponse(<RecordStripImage lines={disclaimerAtFoot(lines)} disclaimer={DISCLAIMER} />, size);
  } catch {
    return neutral('Stock Social', 'Verified trades by stock');
  }
}
