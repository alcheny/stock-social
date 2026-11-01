// Trade share card: percent only, and layout and colour never vary by sign.
// F-12: drawn inside the anti-crop band (lib/record-strip.ts#layoutBand): the trade's hero lines, then the trader's
// record strip and the disclaimer, so a square or 1.91:1 crop never cuts them. The alt text is the strip in words,
// declared by the trade page's generateMetadata (it depends on the record).
import { ImageResponse } from 'next/og';
import { decodeSellId, loadTradeShare } from '@/lib/trade-share-load.ts';
import { tradeHero, tradeStripInput } from '@/lib/trade-share.ts';
import { layoutBand, recordStrip, stripImageLines } from '@/lib/record-strip.ts';
import { RecordStripImage } from '@/app/record-strip.tsx';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Card({ params }: { params: Promise<{ handle: string; sellId: string }> }) {
  const { handle, sellId } = await params;
  const id = decodeSellId(sellId);
  const t = id === null ? null : await loadTradeShare(handle, id).catch(() => null);

  if (!t) {
    const shell = { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: '#0b0b0f', color: '#f4f4f6', fontFamily: 'sans-serif' } as const;
    return new ImageResponse((
      <div style={shell}><span style={{ fontSize: 36, fontWeight: 800 }}>Stock Social</span><span style={{ fontSize: 72, fontWeight: 800 }}>Trade not found</span><span /></div>
    ), size);
  }

  // Fix round 6 (TR-3, POLICY F3): the label follows the trader's record state (recordStrip); no check-mark glyph.
  const strip = recordStrip(tradeStripInput(t), 'image');
  const { lines } = layoutBand(stripImageLines(strip, { handle: t.handle, newRecord: t.newRecord, hero: tradeHero(t) }));
  return new ImageResponse(<RecordStripImage lines={lines} />, size);
}
