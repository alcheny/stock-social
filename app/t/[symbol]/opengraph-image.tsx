// Ticker share card: unfurls a pasted /t/SYMBOL link. Percentages only; never throws on a bad symbol.
import { ImageResponse } from 'next/og';
import { DISCLAIMER } from '@/lib/share.ts';
import { sql } from '@/lib/db.ts';
import { decodeSymbolParam, tickerSummary, type TickerRow, type TickerSummary } from '@/lib/ticker.ts';
import { evidenceLine, pct, rangeText } from '@/lib/trades.ts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Verified trading records by stock on Stock Social';

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
    const found = (await sql`select user_id, return_pct, holding_days, opened_at, closed_at, verified from closed_trades where symbol = ${symbol}`) as unknown as
      { user_id: number; return_pct: number; holding_days: number; opened_at: Date; closed_at: Date; verified: boolean }[];
    if (!found.length) return neutral(symbol, 'No verified trades yet', 'Stock Social · verified trading records');
    const rows: TickerRow[] = found.map((r) => ({ userId: r.user_id, returnPct: r.return_pct, holdingDays: r.holding_days, openedAt: r.opened_at, closedAt: r.closed_at, verified: r.verified }));
    const s: TickerSummary = tickerSummary(rows, new Date());
    const c = s.conf!;
    const range = rangeText(c);
    const status = s.demoOnly ? 'Sample data' : s.mixed ? 'Includes sample data' : 'Verified from broker' /* no check mark: the image font has no glyph for it */;
    const good = !s.demoOnly && !s.mixed;
    return new ImageResponse(
      (
        <div style={frame}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 36 }}>
            <span style={{ fontWeight: 800 }}>Stock Social</span>
            <span style={{ color: good ? '#22c55e' : '#8b8b98', fontWeight: 700 }}>{status}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 120, fontWeight: 800, lineHeight: 1 }}>{symbol}</span>
            <span style={{ fontSize: 32, color: '#8b8b98' }}>verified closed trades</span>
          </div>
          <div style={{ display: 'flex', gap: 72 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 120, fontWeight: 800, lineHeight: 1 }}>{(s.winRate! * 100).toFixed(0)}%</span>
              <span style={{ fontSize: 28, color: '#8b8b98' }}>win rate</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 120, fontWeight: 800, lineHeight: 1, color: s.avgReturn! > 0 ? '#22c55e' : '#f43f5e' }}>{pct(s.avgReturn!)}</span>
              <span style={{ fontSize: 28, color: '#8b8b98' }}>avg return / trade</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 120, fontWeight: 800, lineHeight: 1 }}>{s.n}</span>
              <span style={{ fontSize: 28, color: '#8b8b98' }}>trades · {s.traders} trader{s.traders === 1 ? '' : 's'} · losses included</span>
            </div>
          </div>
          <span style={{ fontSize: 30, color: '#8b8b98' }}>{range ? `95% range ${range} · ` : ''}{evidenceLine(c)}</span>
          <span style={{ fontSize: 22, color: '#8b8b98' }}>{DISCLAIMER}</span>
        </div>
      ),
      size,
    );
  } catch {
    return neutral('Stock Social', 'Verified trades by stock', 'Stock Social · verified trading records');
  }
}
