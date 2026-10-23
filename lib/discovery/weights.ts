// F-2: the owner's signal weights (design session 2026-10-22, restored 2026-10-23 in the feature file). Pinned here
// so every PR reads the same numbers. PR-2 stores the explicit choices (follows, exclusions); PR-5 turns them into a
// ranking with these weights. "Not interested" and the reject swipe (PR-4) are one negative action: the same −4 and
// the same EXCLUSION_DAYS exclusion. Pure (lib/discovery/imports.test.ts).
export const WEIGHTS = {
  like: 3, // double tap, private (PR-4)
  swipeOpen: 2, // the opening swipe to the pane (SW-1)
  notInterested: -4, // "Not interested" (PR-2) and the reject swipe (PR-4)
} as const;

// O3 default (plan §3): 90 days. The Undo line says "Hidden for 90 days."; the copy changes with this constant.
export const EXCLUSION_DAYS = 90;
