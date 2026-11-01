// Trade share card: percent only, and layout and colour never vary by sign.
// F-12: drawn inside the anti-crop band (lib/record-strip.ts#layoutBand): the trade's hero lines, then the trader's
// record strip and the disclaimer, so a square or 1.91:1 crop never cuts them. The alt text is the strip in words,
// declared by the trade page's generateMetadata (it depends on the record).
import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { permanentRedirect } from 'next/navigation'; // F-25
import { DISCLAIMER } from '@/lib/share.ts';
import { decodeSellId, legacyTradeKey, loadTradeShareByKey } from '@/lib/trade-share-load.ts';
import { tradePageHref } from '@/lib/trade-href.ts';
import { tradeBand, tradeStripInput } from '@/lib/trade-share.ts';
import { recordStrip } from '@/lib/record-strip.ts';
import { disclaimerAtFoot } from '@/lib/stock-image.ts';
import { RecordStripImage } from '@/app/record-strip.tsx';
// FIXES-LABELS (D-09, D-05): the band's F3 lines at lib/image-fit.ts's size (DS-19); the close date always with its year
// (lib/trade-share.ts#closedDay: an image outlives the year it was drawn in).
import { imageFrozenText } from '@/lib/record-status.ts'; // FIXES-LABELS: status

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Card({ params }: { params: Promise<{ handle: string; sellId: string }> }) {
  const { handle, sellId } = await params;
  const id = decodeSellId(sellId); // F-25: the segment is the trade_key (the folder keeps its old name)
  // Cycle-2 fix #20: a missing trade (unknown handle or sellId, a deleted trader) is a 404, as the profile card is, never a
  // 200 picture saying "not found" that a link preview would show.
  const t = id === null ? null : await loadTradeShareByKey(handle, id);
  // F-25: an old link's image (by the closing sell's vendor id) answers 308 to the trade_key image, under the page's
  // visibility rule; anything else is a 404 with no redirect.
  const legacy = !t && id !== null ? await legacyTradeKey(handle, id) : null;
  if (legacy) permanentRedirect(`${tradePageHref({ handle, tradeKey: legacy })}/opengraph-image`);
  if (!t) notFound();

  // Fix round 6 (TR-3, POLICY F3): the label follows the trader's record state (recordStrip); no check-mark glyph.
  const strip = recordStrip(tradeStripInput(t), 'image');
  // FIXES-LABELS: status (F-11): a frozen record says so; absolute date with the year, never relative.
  const frozen = imageFrozenText(t.status, new Date());
  // Cycle-2 fix #9: the hero shrinks until the band fits (lib/trade-share.ts#tradeBand), as the month image does.
  const { lines } = tradeBand(t, strip, frozen);
  return new ImageResponse(<RecordStripImage lines={disclaimerAtFoot(lines)} disclaimer={DISCLAIMER} />, size);
}
