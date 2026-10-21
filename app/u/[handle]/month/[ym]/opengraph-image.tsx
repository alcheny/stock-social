// Monthly recap card: percent only, and layout and colour never vary by sign.
import { ImageResponse } from 'next/og';
import { DISCLAIMER } from '@/lib/share.ts';
import { pct } from '@/lib/trades.ts';
import { loadRecap } from '@/lib/recap-load.ts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'A month of verified trades on Stock Social, with the whole record';

const MUTED = '#8b8b98';

export default async function Card({ params }: { params: Promise<{ handle: string; ym: string }> }) {
  const { handle, ym } = await params;
  const r = await loadRecap(handle, ym).catch(() => null);
  const shell = { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: '#0b0b0f', color: '#f4f4f6', fontFamily: 'sans-serif' } as const;

  if (!r) {
    return new ImageResponse((
      <div style={shell}><span style={{ fontSize: 36, fontWeight: 800 }}>Stock Social</span><span style={{ fontSize: 72, fontWeight: 800 }}>Recap not found</span><span /></div>
    ), size);
  }

  const { recap: m, record: w } = r;
  const n = (k: number) => `${k} trade${k === 1 ? '' : 's'}`;
  const line = [`${m.count} closed trade${m.count === 1 ? '' : 's'}`, m.showHeadline ? `${(m.winRate * 100).toFixed(0)}% win rate` : null, m.showHeadline ? `avg ${pct(m.avgReturn)}` : null].filter(Boolean).join(' · ');
  const picks = m.count === 1 ? `Only trade: ${m.worst.symbol} ${pct(m.worst.returnPct)}` : `Worst: ${m.worst.symbol} ${pct(m.worst.returnPct)} · Best: ${m.best.symbol} ${pct(m.best.returnPct)}`;
  return new ImageResponse(
    (
      <div style={shell}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 36 }}>
          <span style={{ fontWeight: 800 }}>Stock Social</span>
          <span style={{ color: MUTED, fontWeight: 700 }}>{r.demo ? 'Demo data' : r.verified ? '✓ Verified from broker' : 'Unverified'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 32, color: MUTED }}>{r.displayName} · @{handle}</span>
          <span style={{ fontSize: 96, fontWeight: 800 }}>{m.label}{m.monthSoFar ? ' · month so far' : ''}</span>
          <span style={{ fontSize: 40, fontWeight: 700 }}>{line}</span>
          <span style={{ fontSize: 40, fontWeight: 700 }}>{picks}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `2px solid ${MUTED}`, paddingTop: 16 }}>
          <span style={{ fontSize: 34, fontWeight: 700 }}>
            Whole record: {(w.winRate * 100).toFixed(0)}% win rate · {n(w.trades)} · avg {pct(w.avgReturn)}
          </span>
          <span style={{ fontSize: 26, color: MUTED }}>{w.range ? `${w.evidence} ${w.range}` : w.evidence || 'Too early to tell'}</span>
          {w.newRecord && <span style={{ fontSize: 26, color: MUTED }}>New record · short record, wide uncertainty</span>}
        </div>
        <span style={{ fontSize: 22, color: '#8b8b98' }}>{DISCLAIMER}</span>
      </div>
    ),
    size,
  );
}
