// CHORES-3 (K20): the picture a shared link to "/" unfurls with, referenced only by app/page.tsx's metadata. A route,
// not a root opengraph-image file, which every child route without its own image would inherit. Text only: no name,
// logo, glyph, chart or figure (POLICY T5a, F3); next/og's bundled default font.
import { ImageResponse } from 'next/og';
import { demoShown, homePreview } from '@/lib/home-preview.ts';

export const HOME_CARD_SIZE = { width: 1200, height: 630 };

export async function GET() {
  const { cardText } = homePreview(await demoShown());
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: 80, background: '#0b0b0f', color: '#f2f2f5', fontSize: 60, lineHeight: 1.25 }}>
        {cardText}
      </div>
    ),
    { ...HOME_CARD_SIZE, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
  );
}
