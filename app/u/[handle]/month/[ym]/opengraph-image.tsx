// Monthly recap card: percent only, and layout and colour never vary by sign.
// F-12: drawn inside the anti-crop band (lib/month-card.ts#monthBand over lib/record-strip.ts#stripImageLines): the
// month's label, count and figures, then the trader's record strip and the disclaimer. No win rate and no best or
// worst on the image (both questions stay with the page). The header follows the profile card's record rule (a failed
// import is never labelled Verified; an import still running shows no record stats). The alt text is declared by the
// month page's generateMetadata (it depends on the record).
import { ImageResponse } from 'next/og';
import { DISCLAIMER } from '@/lib/share.ts';
import { loadRecap } from '@/lib/recap-load.ts';
import { monthStripInput, recordStripInput } from '@/lib/recap.ts';
import { monthBand } from '@/lib/month-card.ts';
import { recordStrip } from '@/lib/record-strip.ts';
import { disclaimerAtFoot } from '@/lib/stock-image.ts';
import { RecordStripImage } from '@/app/record-strip.tsx';
import { imageFrozenText } from '@/lib/record-status.ts'; // FIXES-LABELS: status

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Card({ params }: { params: Promise<{ handle: string; ym: string }> }) {
  const { handle, ym } = await params;
  const r = await loadRecap(handle, ym).catch(() => null);

  if (!r) {
    const shell = { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: '#0b0b0f', color: '#f4f4f6', fontFamily: 'sans-serif' } as const;
    return new ImageResponse((
      <div style={shell}><span style={{ fontSize: 36, fontWeight: 800 }}>Stock Social</span><span style={{ fontSize: 72, fontWeight: 800 }}>Recap not found</span><span /></div>
    ), size);
  }

  // FIXES-LABELS: status (F-11): a frozen record says so; absolute date with the year, never relative. FIXES-LABELS
  // (D-24): r.months adds "1 of N months on record" under the label.
  const frozen = imageFrozenText(r.status, new Date());
  const { lines } = monthBand(r, recordStrip(recordStripInput(r), 'image'), recordStrip(monthStripInput(r), 'figures'), frozen);
  return new ImageResponse(<RecordStripImage lines={disclaimerAtFoot(lines)} disclaimer={DISCLAIMER} />, size);
}
