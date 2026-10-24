// F-2 PR-4: the feed card's gestures. Pure (lib/discovery/imports.test.ts), used by app/feed-gestures.tsx.
// - Double tap = like (+3, private): two taps within DOUBLE_TAP_MS and DOUBLE_TAP_PX of each other on the card body. A
//   tap is a press that moved under TAP_SLOP_PX (a swipe or a scroll is never a tap) on no link, button, menu or chart.
// - Reject (O1, 2026-10-24): on a card at rest, a horizontal drag away from the profile (finger to the right) that
//   travels at least half the card commits; anything shorter snaps back. The opening direction stays SW-1's native
//   scroll. It arms only as the section swipe does (lib/discovery/reject.ts#canArm, #horizontal).
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 24;
export const TAP_SLOP_PX = 10;
export const NOT_TAP = 'a, button, summary, details, input, textarea, select, label, .chart, svg, [data-no-tap]';

export type Tap = { t: number; x: number; y: number };
export const isTap = (down: Tap, up: Tap) => Math.hypot(up.x - down.x, up.y - down.y) < TAP_SLOP_PX;
export const isDoubleTap = (prev: Tap | null, cur: Tap) =>
  !!prev && cur.t - prev.t <= DOUBLE_TAP_MS && cur.t >= prev.t && Math.hypot(cur.x - prev.x, cur.y - prev.y) <= DOUBLE_TAP_PX;

// `travel`: the finger's own travel toward the reject side at lift (px); `card`: the card's width.
export const cardRejectOutcome = (armed: boolean, travel: number, card: number): 'reject' | 'back' =>
  armed && card > 0 && travel >= card / 2 ? 'reject' : 'back';
