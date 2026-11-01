// F-10 follow-ups (approval cycle 2, fixes #15, #16, #18): the feed's focus and sizing rules, pure so they are unit tested
// (lib/f10-followups.test.ts); app/feed-keys.tsx, app/feed-gestures.tsx and app/ui.tsx apply them.

// #16: a feed row (card, then pane, side by side) rests on its card while less than half its pane shows. A resting row's
// pane is off screen, so it is `inert` (out of the Tab order and the accessibility tree), unless focus is already inside
// it (the row is about to scroll to it); a row on its pane never has an inert pane (inert also blocks taps).
export const restsOnCard = (scrollLeft: number, clientWidth: number) => scrollLeft < clientWidth / 2;
export const paneInert = (r: { scrollLeft: number; clientWidth: number; holdsFocus: boolean }) =>
  restsOnCard(r.scrollLeft, r.clientWidth) && !r.holdsFocus;

// #16: where → and ← (and the pane's Back button) leave focus. → goes into the pane (its trader link) unless focus is
// already in it; ← and Back come back to the card (its trader link, as the hide's Undo does) when focus was in that row's
// pane or nowhere (body), so focus never stays on, or is lost with, an off-screen pane. Elsewhere (the nav, another row) focus stays put.
export function focusAfterKey(key: 'ArrowRight' | 'ArrowLeft' | 'back', focus: 'pane' | 'card' | 'none' | 'other'): 'pane' | 'card' | null {
  if (key === 'ArrowRight') return focus === 'pane' ? null : 'pane';
  return focus === 'pane' || focus === 'none' ? 'card' : null;
}

// #15: the signed-out "Sign in to like trades." bar is fixed to the bottom of the screen. It closes on Escape and as soon
// as focus moves anywhere outside it, so it can never cover the focused element (WCAG 2.4.11). Any focus move rather than
// "focus under the bar": the browser scrolls a newly focused element into view after focus, and row snapping moves it
// again, so a geometry test at focus time would race both.
export function closesSignInBar(e: { type: 'keydown'; key: string } | { type: 'focusin'; insideBar: boolean }): boolean {
  return e.type === 'keydown' ? e.key === 'Escape' : !e.insideBar;
}

// #18: the feed hero figure's font size cap from its printed length. The 800-weight tabular figure measures at most
// 0.68 em per character in DejaVu Sans (the e2e font, e2e/fonts.conf; "+61.0%", "+12345.6%", "+123456.7%") and 0.61 em
// in Inter. 0.82 em per character keeps ≥ 15% of the hero's width spare with either (17% in DejaVu). The CSS divides the
// hero's width (100cqi) by this many ems; "+5.2%" is within 2 px of the clamp() size at phone widths, and a 6-character
// figure a little smaller (65 px instead of 79 px at 360).
export const RET_EM_PER_CHAR = 0.82;
export const retEms = (printed: string) => Math.round([...printed].length * RET_EM_PER_CHAR * 100) / 100;
