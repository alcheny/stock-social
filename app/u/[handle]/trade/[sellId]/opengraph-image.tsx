// Trade share card: percent only, and layout and colour never vary by sign.
import { ImageResponse } from 'next/og';
import { DISCLAIMER } from '@/lib/share.ts';
import { imageTrust } from '@/lib/copy.ts';
import { pct } from '@/lib/trades.ts';
import { decodeSellId, loadTradeShare } from '@/lib/trade-share-load.ts';
import { counted } from '@/lib/format.ts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'One closed trade on Stock Social, with the full record';

const MUTED = '#8b8b98';
const TONE = { ok: '#22c55e', muted: MUTED, warn: '#f59e0b' } as const;

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

  // Fix round 6 (TR-3, POLICY F3): the profile card's rule from the trader's record state; no check-mark glyph.
  const trust = imageTrust('trade', { state: t.state, demo: t.demo, verified: t.verified, empty: false });
  const closed = new Date(t.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const days = t.holdingDays < 1 ? 'under a day' : `${Math.round(t.holdingDays)} day${Math.round(t.holdingDays) === 1 ? '' : 's'}`;
  return new ImageResponse(
    (
      <div style={shell}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 36, flexShrink: 0 }}>
          <span style={{ fontWeight: 800 }}>Stock Social</span>
          <span style={{ color: TONE[trust.tone], fontWeight: 700 }}>{trust.label ?? ''}</span>
        </div>
        {/* Fix round 6: only the thesis gives way when space runs short, so the record lines and the disclaimer always fit. */}
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 1, minHeight: 0, overflow: 'hidden' }}>
          <span style={{ fontSize: 32, color: MUTED, flexShrink: 0 }}>{t.displayName} · @{t.handle}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 40, flexShrink: 0 }}>
            <span style={{ fontSize: 96, fontWeight: 800 }}>{t.symbol}</span>
            <span style={{ fontSize: 160, fontWeight: 800, lineHeight: 1 }}>{pct(t.returnPct)}</span>
          </div>
          <span style={{ fontSize: 30, color: MUTED, flexShrink: 0 }}>held {days} · closed {closed}</span>
          {t.thesis && <span style={{ fontSize: 34, marginTop: 16, maxHeight: 90, minHeight: 0, flexShrink: 1, overflow: 'hidden' }}>“{clip(t.thesis)}”</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `2px solid ${MUTED}`, paddingTop: 16, flexShrink: 0 }}>
          {trust.stats && (
            <span style={{ fontSize: 34, fontWeight: 700 }}>
              Overall record: {(t.record.winRate * 100).toFixed(0)}% win rate · {counted(t.record.trades, 'trade')} · avg {pct(t.record.avgReturn)}
            </span>
          )}
          {trust.note && <span style={{ fontSize: 26, color: TONE[trust.tone] }}>{trust.note}</span>}
          {trust.stats && t.newRecord && <span style={{ fontSize: 26, color: MUTED }}>New record · short record, wide uncertainty</span>}
        </div>
        <span style={{ fontSize: 22, color: '#8b8b98', flexShrink: 0 }}>{DISCLAIMER}</span>
      </div>
    ),
    size,
  );
}
