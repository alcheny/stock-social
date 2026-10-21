// Trade share card: percent only, and layout and colour never vary by sign.
import { ImageResponse } from 'next/og';
import { pct } from '@/lib/trades.ts';
import { decodeSellId, loadTradeShare } from '@/lib/trade-share-load.ts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'One verified trade on Stock Social, with the full record';

const MUTED = '#8b8b98';

// Truncate at a word boundary, about 110 chars.
const clip = (s: string, max = 110) => (s.length <= max ? s : `${s.slice(0, max).replace(/\s+\S*$/, '')}…`);

export default async function Card({ params }: { params: Promise<{ handle: string; sellId: string }> }) {
  const { handle, sellId } = await params;
  const id = decodeSellId(sellId);
  const t = id === null ? null : await loadTradeShare(handle, id).catch(() => null);
  const shell = { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: '#0b0b0f', color: '#f4f4f6', fontFamily: 'sans-serif' } as const;

  if (!t) {
    return new ImageResponse((
      <div style={shell}><span style={{ fontSize: 36, fontWeight: 800 }}>Stock Social</span><span style={{ fontSize: 72, fontWeight: 800 }}>Trade not found</span><span /></div>
    ), size);
  }

  const closed = new Date(t.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const days = t.holdingDays < 1 ? 'under a day' : `${Math.round(t.holdingDays)} day${Math.round(t.holdingDays) === 1 ? '' : 's'}`;
  return new ImageResponse(
    (
      <div style={shell}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 36 }}>
          <span style={{ fontWeight: 800 }}>Stock Social</span>
          <span style={{ color: MUTED, fontWeight: 700 }}>{t.demo ? 'Demo data' : '✓ Verified from broker'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, color: MUTED }}>{t.displayName} · @{t.handle}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 40 }}>
            <span style={{ fontSize: 96, fontWeight: 800 }}>{t.symbol}</span>
            <span style={{ fontSize: 160, fontWeight: 800, lineHeight: 1 }}>{pct(t.returnPct)}</span>
          </div>
          <span style={{ fontSize: 30, color: MUTED }}>held {days} · closed {closed}</span>
          {t.thesis && <span style={{ fontSize: 34, marginTop: 16, maxHeight: 90, overflow: 'hidden' }}>“{clip(t.thesis)}”</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `2px solid ${MUTED}`, paddingTop: 16 }}>
          <span style={{ fontSize: 34, fontWeight: 700 }}>
            Overall record: {(t.record.winRate * 100).toFixed(0)}% win rate · {t.record.trades} trade{t.record.trades === 1 ? '' : 's'} · avg {pct(t.record.avgReturn)}
          </span>
          {t.newRecord && <span style={{ fontSize: 26, color: MUTED }}>New record · short record, wide uncertainty</span>}
        </div>
      </div>
    ),
    size,
  );
}
