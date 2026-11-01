// Share-image colours (F-20, DS-6 shape): next/og cannot read CSS variables, so the images read this one table instead
// of the TOKENS block in app/globals.css. Values are main's, byte for byte, except gain and loss: the committee's decision
// of 2026-11-01 (OQ-1, flagged to the owner, who may revert it) gives the images the page's dark DS-4 ink (--up #3cc4b4,
// --down #ff8a5b), so the share card matches the page it opens and passes the same ΔE00 9 colour-vision floor (deutan was
// 6.3 with #22c55e / #f43f5e). The card's Demo hue (O-2) stays the owner's. lib/a11y-contrast.test.ts holds every entry to
// the contrast and colour-vision floors; lib/colour-literals.test.ts allows colour literals here and in TOKENS only.
// ponytail: images are dark-only, the card's muted grey (#a1a1ad) differs from the strip's (#8b8b98) and the strip's `ok`
// status tone keeps #22c55e — next step DS-6 (per-scheme images, one grey, `ok` on the ink).
export const IMAGE_PALETTE = {
  // The record card (link unfurl, square and story pictures): app/u/[handle]/record-card-image.tsx.
  card: { bg: '#0b0b0f', text: '#f4f4f6', muted: '#a1a1ad', up: '#3cc4b4', down: '#ff8a5b', warn: '#f59e0b', demo: '#38bdf8', base: '#6b6b78' },
  // The record strip's image tones (F-12): lib/record-strip.ts IMAGE_COLOURS, drawn on stripBg.
  strip: { text: '#f4f4f6', muted: '#8b8b98', up: '#3cc4b4', down: '#ff8a5b', warn: '#f59e0b', ok: '#22c55e' },
  stripBg: '#0b0b0f',
  // The home link's preview picture (CHORES-3, K20): app/home-card/route.tsx; text only.
  home: { bg: '#0b0b0f', text: '#f2f2f5' },
} as const;
// <meta name="theme-color">: dark only today. ponytail: one value for both schemes; next step DS-6 (per-scheme theme colour).
export const THEME_COLOR = '#0b0b0f';
