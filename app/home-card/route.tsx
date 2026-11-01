// CHORES-3 (K20): the picture a shared link to "/" unfurls with, referenced only by app/page.tsx's metadata. A route,
// not a root opengraph-image file, which every child route without its own image would inherit. Text only: no name,
// logo, glyph, chart or figure (POLICY T5a, F3); next/og's bundled default font.
import { ImageResponse } from 'next/og';
import { homePreview } from '@/lib/home-preview.ts';
import { IMAGE_PALETTE } from '@/lib/palette.ts';

export const HOME_CARD_SIZE = { width: 1200, height: 630 };

// `?d=0` draws the card without the Demo sentence, anything else with it: the page's metadata names the state it shows
// (app/page.tsx), so a cached card always matches the page that linked it, and this route reads no data.
export async function GET(req: Request) {
  // FIXES-CYCLE4-PART2 (F4-8): `?p=1` adds the public-filing sentence; any other `p` (or none) draws without it.
  const q = new URL(req.url).searchParams;
  const { cardText } = homePreview(q.get('d') !== '0', q.get('p') === '1');
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: 80, background: IMAGE_PALETTE.home.bg, color: IMAGE_PALETTE.home.text, fontSize: 60, lineHeight: 1.25 }}>
        {cardText}
      </div>
    ),
    { ...HOME_CARD_SIZE, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
  );
}
