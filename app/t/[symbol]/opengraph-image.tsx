// Ticker share card: unfurls a pasted /t/SYMBOL link. Percentages only; never throws on a bad symbol.
import { ImageResponse } from 'next/og';
// FIXES-LABELS (D-09): sizes from the fit model (lib/image-fit.test.ts); the F3 line at 35 px (DS-19), wrapping to two rows.
import { DISCLAIMER } from '@/lib/share.ts';
import { DISCLAIMER_SIZE, STOCK_IMAGE as S } from '@/lib/image-fit.ts';
import { decodeSymbolParam, trustKind, type TickerSummary } from '@/lib/ticker.ts';
// FIXES-LABELS (D-03): the subtitle, corner and alt name the Demo state and never call Demo trades verified.
import { FIXES_LABELS as FL } from '@/lib/copy.ts';
import { tickerHeadline } from '@/lib/ticker-sql.ts';
import { evidenceLine, pct, rangeText } from '@/lib/trades.ts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = FL.tickerAlt;

const frame = { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: '#0b0b0f', color: '#f4f4f6', fontFamily: 'sans-serif' } as const;

function neutral(title: string, line: string, footer: string) {
  return new ImageResponse(
    (
      <div style={frame}>
        <span style={{ fontSize: 36, fontWeight: 800 }}>Stock Social</span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 120, fontWeight: 800, lineHeight: 1 }}>{title}</span>
          <span style={{ fontSize: 40, color: '#8b8b98' }}>{line}</span>
        </div>
        <span style={{ fontSize: 30, color: '#8b8b98' }}>{footer}</span>
      </div>
    ),
    size,
  );
}

export default async function Card({ params }: { params: Promise<{ symbol: string }> }) {
  try {
    const symbol = decodeSymbolParam((await params).symbol);
    if (!symbol) return neutral('Stock Social', 'Verified trades by stock', 'Stock Social · verified trading records');
    // The page's own SQL summary (live users only), so the card and the page show the same numbers.
    const s: TickerSummary = (await tickerHeadline(symbol)).summary;
    if (!s.n) return neutral(symbol, 'No verified trades yet', 'Stock Social · verified trading records');
    const c = s.conf!;
    const range = rangeText(c);
    const kind = trustKind(s);
    const status = FL.imageStatus[kind] /* no check mark: the image font has no glyph for it */;
    const good = kind === 'verified';
    return new ImageResponse(
      (
        <div style={frame}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: S.header }}>
            <span style={{ fontWeight: 800 }}>Stock Social</span>
            <span style={{ color: good ? '#22c55e' : '#8b8b98', fontWeight: 700 }}>{status}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: S.symbol, fontWeight: 800, lineHeight: 1 }}>{symbol}</span>
            <span style={{ fontSize: S.sub, color: '#8b8b98' }}>{FL.imageSub[kind]}</span>
          </div>
          <div style={{ display: 'flex', gap: 72 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: S.figure, fontWeight: 800, lineHeight: 1 }}>{(s.winRate! * 100).toFixed(0)}%</span>
              <span style={{ fontSize: S.label, color: '#8b8b98' }}>win rate</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: S.figure, fontWeight: 800, lineHeight: 1, color: s.avgReturn! > 0 ? '#22c55e' : '#f43f5e' }}>{pct(s.avgReturn!)}</span>
              <span style={{ fontSize: S.label, color: '#8b8b98' }}>avg return / trade</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: S.figure, fontWeight: 800, lineHeight: 1 }}>{s.n}</span>
              <span style={{ fontSize: S.label, color: '#8b8b98' }}>trades · {s.traders} trader{s.traders === 1 ? '' : 's'} · losses included</span>
            </div>
          </div>
          <span style={{ fontSize: S.evidence, color: '#8b8b98' }}>{range ? `95% range ${range} · ` : ''}{evidenceLine(c)}</span>
          <span style={{ fontSize: DISCLAIMER_SIZE, lineHeight: 1.2, color: '#8b8b98' }}>{DISCLAIMER}</span>
        </div>
      ),
      size,
    );
  } catch {
    return neutral('Stock Social', 'Verified trades by stock', 'Stock Social · verified trading records');
  }
}
