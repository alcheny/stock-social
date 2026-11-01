// The share card (F-4): what the profile link unfurls into, the growth loop. Rendered by Next's built-in next/og
// whenever the profile link is posted on a social network or in a messaging app. The Share button's picture
// (story/route.tsx) draws the same card at its own size.
import { ImageResponse } from 'next/og';
import { isFilerHandle } from '@/lib/public-gate.ts';
import { notFound } from 'next/navigation';
import { CARD_LAYOUT } from '@/lib/record-card.ts';
import { DISCLAIMER } from '@/lib/share.ts';
import { loadRecordCard } from './record-card-data.ts';
import { RecordCardImage } from './record-card-image.tsx';

export const size = { width: CARD_LAYOUT.unfurl.width, height: CARD_LAYOUT.unfurl.height };
export const contentType = 'image/png';
// F-16 (plan v2 E2): a bounded cache, like story/route.tsx (F-7 filers: never cached), so a hide or a rename reaches a
// shared copy within 300 s.
// ponytail: a cached copy can outlive a hide or a rename by up to 300 s — fix: versioned image keys purged on hide, delete
// and rename (plan §9.1).
const cache = (handle: string) => ({ 'Cache-Control': isFilerHandle(handle) ? 'no-store' : 'public, max-age=300' });
// The alt text depends on the record state, so the profile page declares it with this image (app/u/[handle]/page.tsx).

export default async function Card({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const m = await loadRecordCard(handle, 'unfurl');
  if (!m) notFound();
  return new ImageResponse(<RecordCardImage m={m} disclaimer={DISCLAIMER} />, { ...size, headers: cache(handle) });
}
