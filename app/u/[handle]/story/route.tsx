// The Share button's picture of the whole record (square, or story with ?format=story). F-4: the same record card as
// the link unfurl, at the picture's size, with the profile link printed on it (a saved picture has no link preview).
// Public, percent-only.
import { ImageResponse } from 'next/og';
import { FORMATS, parseFormat } from '@/lib/story-image.ts';
import { DISCLAIMER } from '@/lib/share.ts';
import { loadRecordCard } from '../record-card-data.ts';
import { RecordCardImage } from '../record-card-image.tsx';

export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const url = new URL(req.url);
  const format = parseFormat(url.searchParams.get('format'));
  const m = await loadRecordCard(handle, format, `${url.host}/u/${handle}`);
  if (!m) return new Response('Not found', { status: 404 });
  return new ImageResponse(<RecordCardImage m={m} disclaimer={DISCLAIMER} />, { ...FORMATS[format], headers: { 'Cache-Control': 'public, max-age=300' } });
}
