// F-2: the owner's signal weights (design session 2026-10-22, restored 2026-10-23 in the feature file). Pinned here
// so every PR reads the same numbers. PR-2 stores the explicit choices (follows, exclusions); PR-5 turns them into a
// ranking with these weights. "Not interested" and the reject swipe (PR-4) are one negative action: the same −4 and
// the same EXCLUSION_DAYS exclusion. Pure (lib/discovery/imports.test.ts).
export const WEIGHTS = {
  like: 3, // double tap, private (PR-4)
  swipeOpen: 2, // the opening swipe to the pane (SW-1)
  notInterested: -4, // "Not interested" (PR-2) and the reject swipe on section rows (PR-3)
  // F-2 PR-4 (O1, 2026-10-24): the reject swipe on a feed card rejects that trade (−4: not shown again for
  // TRADE_REJECT_DAYS) and is a slight negative on its trader for PREF_DAYS. (O4): unfollow is a slight negative on that
  // trader for the exclusion period, never a hide. Both read by lib/discovery/prefs.ts.
  reject: -4,
  rejectTrader: -1,
  unfollow: -1,
} as const;

// O3 default (plan §3): 90 days. The Undo line says "Hidden for 90 days."; the copy changes with this constant.
export const EXCLUSION_DAYS = 90;

// F-2 PR-4: O3 is still open with the owner. One constant for how long a rejected trade stays hidden, with its copy
// (lib/copy.ts#LIKES.hidden). The committee recommends permanent for a rejected trade (business lead, committee PR-1b
// §5): Infinity flips it (stored as until = 'infinity'); the trader part still ends at PREF_DAYS.
export const TRADE_REJECT_DAYS: number = EXCLUSION_DAYS;
export const PREF_DAYS = 90;
// How a negative preference p (a sum of WEIGHTS, ≤ 0) enters the score before PR-5: × PREF_BASE^(−p). −1 → ×0.8.
export const PREF_BASE = 0.8;
