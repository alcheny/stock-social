// The share card (F-4): what the profile link unfurls into, the growth loop. Rendered by Next's built-in next/og
// whenever the profile link is posted on a social network or in a messaging app. The Share button's picture
// (story/route.tsx) draws the same card at its own size.
import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { CARD_LAYOUT } from '@/lib/record-card.ts';
import { DISCLAIMER } from '@/lib/share.ts';
import { loadRecordCard } from './record-card-data.ts';
import { RecordCardImage } from './record-card-image.tsx';

export const size = { width: CARD_LAYOUT.unfurl.width, height: CARD_LAYOUT.unfurl.height };
export const contentType = 'image/png';
// The alt text depends on the record state, so the profile page declares it with this image (app/u/[handle]/page.tsx).

export default async function Card({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const m = await loadRecordCard(handle, 'unfurl');
  if (!m) notFound();
  return new ImageResponse(<RecordCardImage m={m} disclaimer={DISCLAIMER} />, size);
}
