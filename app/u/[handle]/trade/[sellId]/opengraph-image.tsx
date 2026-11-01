// Trade share card: percent only, and layout and colour never vary by sign.
// F-12: drawn inside the anti-crop band (lib/record-strip.ts#layoutBand): the trade's hero lines, then the trader's
// record strip and the disclaimer, so a square or 1.91:1 crop never cuts them. The alt text is the strip in words,
// declared by the trade page's generateMetadata (it depends on the record).
import { ImageResponse } from 'next/og';
import { isFilerHandle } from '@/lib/public-gate.ts';
import { DISCLAIMER, imageNotFound } from '@/lib/share.ts';
import { decodeSellId, loadTradeShare } from '@/lib/trade-share-load.ts';
import { tradeBand, tradeStripInput } from '@/lib/trade-share.ts';
import { recordStrip } from '@/lib/record-strip.ts';
import { disclaimerAtFoot } from '@/lib/stock-image.ts';
import { RecordStripImage } from '@/app/record-strip.tsx';
// FIXES-LABELS (D-09, D-05): the band's F3 lines at lib/image-fit.ts's size (DS-19); the close date always with its year
// (lib/trade-share.ts#closedDay: an image outlives the year it was drawn in).
import { imageFrozenText } from '@/lib/record-status.ts'; // FIXES-LABELS: status

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// F-16 (plan v2 E2): a bounded cache, like story/route.tsx (F-7 filers: never cached), so a hide or a rename reaches a
// shared copy within 300 s.
// ponytail: a cached copy can outlive a hide or a rename by up to 300 s — fix: versioned image keys purged on hide, delete
// and rename (plan §9.1).
const cache = (handle: string) => ({ 'Cache-Control': isFilerHandle(handle) ? 'no-store' : 'public, max-age=300' });

export default async function Card({ params }: { params: Promise<{ handle: string; sellId: string }> }) {
  const { handle, sellId } = await params;
  const id = decodeSellId(sellId);
  // Cycle-2 fix #20: a missing trade (unknown handle or sellId, a deleted trader) is a 404, as the profile card is, never a
  // 200 picture saying "not found" that a link preview would show.
  const t = id === null ? null : await loadTradeShare(handle, id);
  if (!t) return imageNotFound();

  // Fix round 6 (TR-3, POLICY F3): the label follows the trader's record state (recordStrip); no check-mark glyph.
  const strip = recordStrip(tradeStripInput(t), 'image');
  // FIXES-LABELS: status (F-11): a frozen record says so; absolute date with the year, never relative.
  const frozen = imageFrozenText(t.status, new Date());
  // Cycle-2 fix #9: the hero shrinks until the band fits (lib/trade-share.ts#tradeBand), as the month image does.
  const { lines } = tradeBand(t, strip, frozen);
  return new ImageResponse(<RecordStripImage lines={disclaimerAtFoot(lines)} disclaimer={DISCLAIMER} />, { ...size, headers: cache(handle) });
}
