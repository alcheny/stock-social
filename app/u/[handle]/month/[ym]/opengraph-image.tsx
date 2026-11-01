// Monthly recap card: percent only, and layout and colour never vary by sign.
// F-12: drawn inside the anti-crop band (lib/month-card.ts#monthBand over lib/record-strip.ts#stripImageLines): the
// month's label, count and figures, then the trader's record strip and the disclaimer. No win rate and no best or
// worst on the image (both questions stay with the page). The header follows the profile card's record rule (a failed
// import is never labelled Verified; an import still running shows no record stats). The alt text is declared by the
// month page's generateMetadata (it depends on the record).
import { ImageResponse } from 'next/og';
import { isFilerHandle } from '@/lib/public-gate.ts';
import { notFound } from 'next/navigation';
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
// F-16 (plan v2 E2): a bounded cache, like story/route.tsx (F-7 filers: never cached), so a hide or a rename reaches a
// shared copy within 300 s.
// ponytail: a cached copy can outlive a hide or a rename by up to 300 s — fix: versioned image keys purged on hide, delete
// and rename (plan §9.1).
const cache = (handle: string) => ({ 'Cache-Control': isFilerHandle(handle) ? 'no-store' : 'public, max-age=300' });

export default async function Card({ params }: { params: Promise<{ handle: string; ym: string }> }) {
  const { handle, ym } = await params;
  // Cycle-2 fix #20: a missing recap (unknown handle, invalid month, a month without trades) is a 404, as the profile
  // card is, never a 200 picture saying "not found" that a link preview would show.
  const r = await loadRecap(handle, ym);
  if (!r) notFound();

  // FIXES-LABELS: status (F-11): a frozen record says so; absolute date with the year, never relative. FIXES-LABELS
  // (D-24): r.months adds "One of N months on record" under the label.
  const frozen = imageFrozenText(r.status, new Date());
  const { lines } = monthBand(r, recordStrip(recordStripInput(r), 'image'), recordStrip(monthStripInput(r), 'figures'), frozen);
  return new ImageResponse(<RecordStripImage lines={disclaimerAtFoot(lines)} disclaimer={DISCLAIMER} />, { ...size, headers: cache(handle) });
}
