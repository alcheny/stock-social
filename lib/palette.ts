// Share-image colours (F-20, DS-6 shape): next/og cannot read CSS variables, so the images read this one table instead
// of the TOKENS block in app/globals.css. Values are today's, byte for byte: image colour changes are the owner's (card
// Demo hue O-2; gain vs loss OQ-1). lib/a11y-contrast.test.ts holds every entry to the contrast and colour-vision floors;
// lib/colour-literals.test.ts allows colour literals here and in TOKENS only.
// ponytail: images are dark-only and the card's muted grey (#a1a1ad) differs from the strip's (#8b8b98); gain vs loss
// fails the ΔE00 9 floor under deutan (6.3, a todo test) — next step DS-6 (per-scheme images, one grey, the CSS ink for
// up/down) once the owner rules on OQ-1.
export const IMAGE_PALETTE = {
  // The record card (link unfurl, square and story pictures): app/u/[handle]/record-card-image.tsx.
  card: { bg: '#0b0b0f', text: '#f4f4f6', muted: '#a1a1ad', up: '#22c55e', down: '#f43f5e', warn: '#f59e0b', demo: '#38bdf8', base: '#6b6b78' },
  // The record strip's image tones (F-12): lib/record-strip.ts IMAGE_COLOURS, drawn on stripBg.
  strip: { text: '#f4f4f6', muted: '#8b8b98', up: '#22c55e', down: '#f43f5e', warn: '#f59e0b', ok: '#22c55e' },
  stripBg: '#0b0b0f',
} as const;
// <meta name="theme-color">: dark only today. ponytail: one value for both schemes; next step DS-6 (per-scheme theme colour).
export const THEME_COLOR = '#0b0b0f';
