// F-2 PR-3: the reject swipe on section rows only (O1 open: feed cards keep SW-1 exactly). Pure: the recognizer's rules,
// used by app/suggest-row.tsx. Each row is a native scroll-snap container [reject tray | row | open sentinel] resting
// on the row; native scrolling gives the momentum and the axis lock, these rules decide what a finished swipe means.
// - It arms only on a touch that starts on a row at rest, with no pane open and not within REJECT_QUIET_MS after one
//   closed (a close tap must never turn into a reject on the row beneath), and only while the travel is horizontal
//   (≥ 2× the vertical travel).
// - Toward the tray it commits ("Not interested", −4, the same action as the menu) only when both hold: the row came to
//   rest past half its swipe area, and the finger itself travelled at least half the row card between touchstart and
//   touchend (fix round 1: a native fling can carry a short flick past half; momentum never counts). Toward the
//   sentinel past half it opens the pane; anything else snaps back. Unarmed, the tray never commits.
export const REJECT_QUIET_MS = 400;
export const LOCK_RATIO = 2;

export function canArm(s: { atRest: boolean; paneOpen: boolean; sinceClose: number }): boolean {
  return s.atRest && !s.paneOpen && s.sinceClose >= REJECT_QUIET_MS;
}
export const horizontal = (dx: number, dy: number) => Math.abs(dx) >= LOCK_RATIO * Math.abs(dy);

// `rest`: the scrollLeft at which the row is at rest (the tray's width); `width`: the swipe area's width; `travel`: the
// finger's own travel toward the tray at lift (px, clientX at touchend − at touchstart); `card`: the row card's width.
export function swipeOutcome(scrollLeft: number, rest: number, width: number, armed: boolean, travel: number, card: number): 'reject' | 'open' | 'back' | 'rest' {
  const d = rest - scrollLeft; // > 0: toward the tray
  if (Math.abs(d) < 1) return 'rest';
  if (d > width / 2) return armed && travel >= card / 2 ? 'reject' : 'back';
  if (-d > width / 2) return 'open';
  return 'back';
}
