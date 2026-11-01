// Monthly recap card: percent only, and layout and colour never vary by sign.
// Fix round 6: the lines come from lib/month-card.ts (one line each, so the disclaimer always fits), and the header
// follows the profile card's record rule (a failed import is never labelled Verified; an import still running shows no
// whole-record stats).
import { ImageResponse } from 'next/og';
import { DISCLAIMER } from '@/lib/share.ts';
import { loadRecap } from '@/lib/recap-load.ts';
import { MONTH_CARD, monthCard, type CardLine } from '@/lib/month-card.ts';
import { imageFrozenText } from '@/lib/record-status.ts'; // FIXES-LABELS: status

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'A month of trades on Stock Social, with the whole record';

const MUTED = '#8b8b98';
const WARN = '#f59e0b';
const TONE = { ok: '#22c55e', muted: MUTED, warn: WARN } as const;
const one = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', flexShrink: 0 } as const;
const Line = ({ l }: { l: CardLine }) => (
  <span style={{ ...one, fontSize: l.size, fontWeight: l.muted || l.warn ? 400 : 700, color: l.warn ? WARN : l.muted ? MUTED : '#f4f4f6' }}>{l.text}</span>
);

export default async function Card({ params }: { params: Promise<{ handle: string; ym: string }> }) {
  const { handle, ym } = await params;
  const r = await loadRecap(handle, ym).catch(() => null);
  const shell = { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: '#0b0b0f', color: '#f4f4f6', fontFamily: 'sans-serif' } as const;

  if (!r) {
    return new ImageResponse((
      <div style={shell}><span style={{ fontSize: 36, fontWeight: 800 }}>Stock Social</span><span style={{ fontSize: 72, fontWeight: 800 }}>Recap not found</span><span /></div>
    ), size);
  }

  const c = monthCard(r);
  // ponytail: the frozen line is drawn beside lib/month-card.ts's lines, outside monthCardFits — fold it into the card model's optional frozen line (plan §3 D-09)
  const frozen = imageFrozenText(r.status, new Date()); // FIXES-LABELS: status
  return new ImageResponse(
    (
      <div style={shell}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 36, flexShrink: 0 }}>
          <span style={{ fontWeight: 800 }}>Stock Social</span>
          <span style={{ color: TONE[c.header.tone], fontWeight: 700 }}>{c.header.label ?? ''}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 1, overflow: 'hidden' }}>
          {c.top.map((l) => <Line key={l.role} l={l} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `2px solid ${MUTED}`, paddingTop: 16, flexShrink: 0 }}>
          {c.bottom.map((l) => <Line key={l.role} l={l} />)}
          {/* FIXES-LABELS: status (F-11): a frozen record says so; absolute date with the year, never relative. */}
          {frozen && <span style={{ ...one, fontSize: 26, color: MUTED }}>{frozen}</span>}
        </div>
        {/* FIXES-LABELS (D-09): the F3 line at its fitted size in a wrapping box, never clipped; lib/month-card.ts budgets its two rows. */}
        <span style={{ fontSize: c.disclaimer.size, lineHeight: MONTH_CARD.lineHeight, color: MUTED, flexShrink: 0 }}>{DISCLAIMER}</span>
      </div>
    ),
    size,
  );
}
